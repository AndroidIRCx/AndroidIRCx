import sodium from 'react-native-libsodium';
import { x25519 } from '@noble/curves/ed25519.js';
import { TextEncoder, TextDecoder } from 'text-encoding';
import { secureStorageService } from './SecureStorageService';

type Bundle = { v: 1; idPub: string; encPub: string; sig: string };
type EncPayload = { v: number; from: string; nonce: string; cipher: string };
type StoredSelf = { idPriv: string; idPub: string; encPriv: string; encPub: string };
type PendingKeyRequest = {
  nick: string;
  bundle: Bundle;
  timestamp: number;
  reason: 'offer' | 'change' | 'legacy';
  existingFingerprint?: string;
  newFingerprint: string;
};
type TrustRecord = {
  v: 1;
  fingerprint: string;
  verified: boolean;
  firstSeen: number;
  lastSeen: number;
};
type ExternalPayload =
  | { v: 1; type: 'encdm-bundle'; nick: string; bundle: Bundle; fingerprint: string }
  | { v: 1; type: 'encdm-fingerprint'; nick: string; fingerprint: string };
type KeyRequestCallback = (
  nick: string,
  bundle: Bundle,
  meta: {
    reason: 'offer' | 'change' | 'legacy';
    existingFingerprint?: string;
    newFingerprint: string;
  }
) => void;

const SELF_KEY = 'encdm:self';
const BUNDLE_PREFIX = 'encdm:bundle:';
const PENDING_PREFIX = 'encdm:pending:';
const TRUST_PREFIX = 'encdm:trust:';

class EncryptedDMService {
  private ready: Promise<void> = sodium.ready;
  private waiters = new Map<
    string,
    { resolve: () => void; reject: (e?: any) => void; timer: ReturnType<typeof setTimeout> }
  >();
  private textEncoder = new TextEncoder();
  private textDecoder = new TextDecoder();
  private bundleListeners: Array<(nick: string) => void> = [];
  private keyRequestListeners: Array<KeyRequestCallback> = [];

  private async ensureReady() {
    await this.ready;
  }

  private toB64(bytes: Uint8Array) {
    return sodium.to_base64(bytes);
  }

  private toHex(bytes: Uint8Array) {
    return sodium.to_hex(bytes);
  }

  private fromB64(b64: string) {
    return sodium.from_base64(b64);
  }

  private fromString(str: string): Uint8Array {
    return this.textEncoder.encode(str);
  }

  private toString(bytes: Uint8Array): string {
    return this.textDecoder.decode(bytes);
  }

  private formatFingerprint(hex: string): string {
    return hex.match(/.{1,4}/g)?.join(' ') || hex;
  }

  private async bundleFingerprint(bundle: Bundle): Promise<string> {
    await this.ensureReady();
    const idBytes = this.fromB64(bundle.idPub);
    const encBytes = this.fromB64(bundle.encPub);
    const combined = new Uint8Array(idBytes.length + encBytes.length);
    combined.set(idBytes, 0);
    combined.set(encBytes, idBytes.length);
    const digest = sodium.crypto_generichash(16, combined);
    return this.toHex(digest);
  }

  async getBundleFingerprint(nick: string): Promise<string | null> {
    const bundle = await this.getBundle(nick);
    if (!bundle) return null;
    return this.bundleFingerprint(bundle);
  }

  async getSelfFingerprint(): Promise<string> {
    const bundle = await this.exportBundle();
    return this.bundleFingerprint(bundle);
  }

  formatFingerprintForDisplay(fingerprint: string): string {
    return this.formatFingerprint(fingerprint);
  }

  async exportBundlePayload(nick: string): Promise<string> {
    const bundle = await this.exportBundle();
    const fingerprint = await this.bundleFingerprint(bundle);
    const payload: ExternalPayload = {
      v: 1,
      type: 'encdm-bundle',
      nick,
      bundle,
      fingerprint,
    };
    return JSON.stringify(payload);
  }

  async exportFingerprintPayload(nick: string): Promise<string> {
    const fingerprint = await this.getSelfFingerprint();
    const payload: ExternalPayload = {
      v: 1,
      type: 'encdm-fingerprint',
      nick,
      fingerprint,
    };
    return JSON.stringify(payload);
  }

  parseExternalPayload(raw: string): ExternalPayload {
    const payload = JSON.parse(raw) as ExternalPayload;
    if (!payload || payload.v !== 1) throw new Error('invalid payload');
    if (payload.type !== 'encdm-bundle' && payload.type !== 'encdm-fingerprint') {
      throw new Error('invalid payload type');
    }
    return payload;
  }

  async acceptExternalBundle(nick: string, bundle: Bundle, allowReplace: boolean): Promise<void> {
    const compare = await this.compareBundle(nick, bundle);
    if (compare.status === 'changed' && !allowReplace) {
      throw new Error('key changed');
    }
    await this.storeBundle(nick, bundle);
  }

  async getTrustRecord(nick: string): Promise<TrustRecord | null> {
    const stored = await secureStorageService.getSecret(TRUST_PREFIX + nick.toLowerCase());
    return stored ? (JSON.parse(stored) as TrustRecord) : null;
  }

  async setVerified(nick: string, verified: boolean): Promise<void> {
    const record = await this.getTrustRecord(nick);
    if (!record) return;
    await secureStorageService.setSecret(TRUST_PREFIX + nick.toLowerCase(), JSON.stringify({
      ...record,
      verified,
      lastSeen: Date.now(),
    }));
  }

  async getVerificationStatus(nick: string): Promise<{ fingerprint: string | null; verified: boolean }> {
    const record = await this.getTrustRecord(nick);
    if (record) return { fingerprint: record.fingerprint, verified: record.verified };
    const fp = await this.getBundleFingerprint(nick);
    return { fingerprint: fp, verified: false };
  }

  private async compareBundle(nick: string, bundle: Bundle): Promise<{
    status: 'new' | 'same' | 'changed';
    existingFingerprint?: string;
    newFingerprint: string;
  }> {
    const newFingerprint = await this.bundleFingerprint(bundle);
    const existingBundle = await this.getBundle(nick);
    if (!existingBundle) {
      return { status: 'new', newFingerprint };
    }
    const existingFingerprint = await this.bundleFingerprint(existingBundle);
    if (existingFingerprint === newFingerprint) {
      return { status: 'same', existingFingerprint, newFingerprint };
    }
    return { status: 'changed', existingFingerprint, newFingerprint };
  }

  async getOrCreateIdentity(): Promise<StoredSelf> {
    await this.ensureReady();
    const cached = await secureStorageService.getSecret(SELF_KEY);
    if (cached) return JSON.parse(cached) as StoredSelf;

    const id = sodium.crypto_sign_keypair(); // Ed25519
    const enc = sodium.crypto_box_keypair(); // X25519 (using crypto_box_keypair instead of crypto_kx_keypair)
    const self: StoredSelf = {
      idPriv: this.toB64(id.privateKey),
      idPub: this.toB64(id.publicKey),
      encPriv: this.toB64(enc.privateKey),
      encPub: this.toB64(enc.publicKey),
    };
    await secureStorageService.setSecret(SELF_KEY, JSON.stringify(self));
    return self;
  }

  async exportBundle(): Promise<Bundle> {
    const self = await this.getOrCreateIdentity();
    const encPubBytes = this.fromB64(self.encPub);
    const idPrivBytes = this.fromB64(self.idPriv);
    const sig = sodium.crypto_sign_detached(encPubBytes, idPrivBytes);
    return { v: 1, idPub: self.idPub, encPub: self.encPub, sig: this.toB64(sig) };
  }

  verifyBundle(bundle: Bundle): void {
    if (bundle.v !== 1) throw new Error('version');
    const encPub = this.fromB64(bundle.encPub);
    const sig = this.fromB64(bundle.sig);
    const idPub = this.fromB64(bundle.idPub);
    const ok = sodium.crypto_sign_verify_detached(sig, encPub, idPub);
    if (!ok) throw new Error('bad signature');
  }

  private async storeBundle(nick: string, bundle: Bundle) {
    await secureStorageService.setSecret(BUNDLE_PREFIX + nick.toLowerCase(), JSON.stringify(bundle));
    const fingerprint = await this.bundleFingerprint(bundle);
    const existingTrust = await this.getTrustRecord(nick);
    const now = Date.now();
    const trust: TrustRecord = {
      v: 1,
      fingerprint,
      verified: existingTrust?.verified ?? false,
      firstSeen: existingTrust?.firstSeen ?? now,
      lastSeen: now,
    };
    await secureStorageService.setSecret(TRUST_PREFIX + nick.toLowerCase(), JSON.stringify(trust));
    // Notify listeners that a bundle was stored
    this.bundleListeners.forEach(listener => listener(nick));
  }

  onBundleStored(callback: (nick: string) => void): () => void {
    this.bundleListeners.push(callback);
    // Return unsubscribe function
    return () => {
      const index = this.bundleListeners.indexOf(callback);
      if (index > -1) {
        this.bundleListeners.splice(index, 1);
      }
    };
  }

  async getBundle(nick: string): Promise<Bundle | null> {
    const stored = await secureStorageService.getSecret(BUNDLE_PREFIX + nick.toLowerCase());
    return stored ? (JSON.parse(stored) as Bundle) : null;
  }

  async isEncrypted(nick: string): Promise<boolean> {
    const bundle = await this.getBundle(nick);
    return bundle !== null;
  }

  async awaitBundleForNick(nick: string, timeoutMs = 36000) {
    const existing = await this.getBundle(nick);
    if (existing) return;
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters.delete(nick.toLowerCase());
        reject(new Error('timeout'));
      }, timeoutMs);
      this.waiters.set(nick.toLowerCase(), { resolve, reject, timer });
    });
  }

  async handleIncomingBundle(fromNick: string, payload: string) {
    try {
      const bundle = JSON.parse(payload) as Bundle;
      this.verifyBundle(bundle);
      const compare = await this.compareBundle(fromNick, bundle);
      if (compare.status === 'changed') {
        await secureStorageService.setSecret(
          PENDING_PREFIX + fromNick.toLowerCase(),
          JSON.stringify({
            nick: fromNick,
            bundle,
            timestamp: Date.now(),
            reason: 'legacy',
            existingFingerprint: compare.existingFingerprint,
            newFingerprint: compare.newFingerprint,
          } as PendingKeyRequest)
        );
        this.keyRequestListeners.forEach(listener =>
          listener(fromNick, bundle, {
            reason: 'legacy',
            existingFingerprint: compare.existingFingerprint,
            newFingerprint: compare.newFingerprint,
          })
        );
        return;
      }
      await this.storeBundle(fromNick, bundle);
      const waiter = this.waiters.get(fromNick.toLowerCase());
      if (waiter) {
        clearTimeout(waiter.timer);
        waiter.resolve();
        this.waiters.delete(fromNick.toLowerCase());
      }
    } catch (e) {
      console.warn('EncryptedDMService: invalid bundle', e);
    }
  }

  // Handle incoming key offer (requires user acceptance)
  async handleKeyOffer(fromNick: string, payload: string): Promise<boolean> {
    try {
      const bundle = JSON.parse(payload) as Bundle;
      this.verifyBundle(bundle);
      const compare = await this.compareBundle(fromNick, bundle);
      // Store as pending
      await secureStorageService.setSecret(
        PENDING_PREFIX + fromNick.toLowerCase(),
        JSON.stringify({
          nick: fromNick,
          bundle,
          timestamp: Date.now(),
          reason: compare.status === 'changed' ? 'change' : 'offer',
          existingFingerprint: compare.existingFingerprint,
          newFingerprint: compare.newFingerprint,
        } as PendingKeyRequest)
      );
      // Notify listeners (will show user prompt)
      this.keyRequestListeners.forEach(listener =>
        listener(fromNick, bundle, {
          reason: compare.status === 'changed' ? 'change' : 'offer',
          existingFingerprint: compare.existingFingerprint,
          newFingerprint: compare.newFingerprint,
        })
      );
      return true;
    } catch (e) {
      console.warn('EncryptedDMService: invalid key offer', e);
      return false;
    }
  }

  // Accept a key offer and share our key back
  async acceptKeyOffer(nick: string, allowReplace = false): Promise<Bundle> {
    const pending = await secureStorageService.getSecret(PENDING_PREFIX + nick.toLowerCase());
    if (!pending) throw new Error('no pending offer');

    const request = JSON.parse(pending) as PendingKeyRequest;
    const compare = await this.compareBundle(nick, request.bundle);
    if (compare.status === 'changed' && !allowReplace) {
      throw new Error('key changed');
    }
    // Store their bundle
    await this.storeBundle(nick, request.bundle);
    // Remove from pending
    await secureStorageService.removeSecret(PENDING_PREFIX + nick.toLowerCase());
    // Return our bundle to send back
    return this.exportBundle();
  }

  // Reject a key offer
  async rejectKeyOffer(nick: string): Promise<void> {
    await secureStorageService.removeSecret(PENDING_PREFIX + nick.toLowerCase());
  }

  // Handle acceptance from other user (they accepted our offer and sent their key)
  async handleKeyAcceptance(fromNick: string, payload: string): Promise<{ status: 'stored' | 'pending' | 'invalid' }> {
    try {
      const bundle = JSON.parse(payload) as Bundle;
      this.verifyBundle(bundle);
      const compare = await this.compareBundle(fromNick, bundle);
      if (compare.status === 'changed') {
        await secureStorageService.setSecret(
          PENDING_PREFIX + fromNick.toLowerCase(),
          JSON.stringify({
            nick: fromNick,
            bundle,
            timestamp: Date.now(),
            reason: 'change',
            existingFingerprint: compare.existingFingerprint,
            newFingerprint: compare.newFingerprint,
          } as PendingKeyRequest)
        );
        this.keyRequestListeners.forEach(listener =>
          listener(fromNick, bundle, {
            reason: 'change',
            existingFingerprint: compare.existingFingerprint,
            newFingerprint: compare.newFingerprint,
          })
        );
        return { status: 'pending' };
      }
      await this.storeBundle(fromNick, bundle);
      return { status: 'stored' };
    } catch (e) {
      console.warn('EncryptedDMService: invalid acceptance', e);
      return { status: 'invalid' };
    }
  }

  // Register listener for incoming key offers
  onKeyRequest(callback: KeyRequestCallback): () => void {
    this.keyRequestListeners.push(callback);
    return () => {
      const index = this.keyRequestListeners.indexOf(callback);
      if (index > -1) {
        this.keyRequestListeners.splice(index, 1);
      }
    };
  }

  private async deriveKey(theirEncPubB64: string) {
    const self = await this.getOrCreateIdentity();
    const shared = x25519.getSharedSecret(this.fromB64(self.encPriv), this.fromB64(theirEncPubB64));
    return sodium.crypto_generichash(32, shared);
  }

  async encrypt(plaintext: string, nick: string) {
    await this.ensureReady();
    const bundle = await this.getBundle(nick);
    if (!bundle) throw new Error('no bundle');
    const key = await this.deriveKey(bundle.encPub);
    const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
    const cipher = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
      this.fromString(plaintext),
      '',  // additional_data must be string (not null) for native
      null,
      nonce,
      key,
    );
    const self = await this.getOrCreateIdentity();
    return {
      v: 1,
      from: self.encPub,
      nonce: this.toB64(nonce),
      cipher: this.toB64(cipher),
    };
  }

  async decrypt(msg: EncPayload, fromNick: string): Promise<string> {
    await this.ensureReady();
    if (msg.v !== 1) throw new Error('version');
    const bundle = await this.getBundle(fromNick);
    if (!bundle) throw new Error('missing bundle');
    if (bundle.encPub !== msg.from) throw new Error('pubkey mismatch');
    const key = await this.deriveKey(bundle.encPub);
    const plain = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
      null,
      this.fromB64(msg.cipher),
      '',  // additional_data must be string (not null) for native
      this.fromB64(msg.nonce),
      key,
    );
    return this.toString(plain);
  }
}

export const encryptedDMService = new EncryptedDMService();

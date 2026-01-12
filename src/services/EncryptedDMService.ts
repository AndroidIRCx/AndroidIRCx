import sodium from 'react-native-libsodium';
import { x25519 } from '@noble/curves/ed25519.js';
import { TextEncoder, TextDecoder } from 'text-encoding';
import { secureStorageService } from './SecureStorageService';
import { tx } from '../i18n/transifex';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

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

// Exported types for UI components
export type StoredKey = {
  network: string;
  nick: string;
  fingerprint: string;
  verified: boolean;
  firstSeen: number;
  lastSeen: number;
};

const SELF_KEY = 'encdm:self';
const BUNDLE_PREFIX = 'encdm:bundle:';
const PENDING_PREFIX = 'encdm:pending:';
const TRUST_PREFIX = 'encdm:trust:';

// V2: Network-aware storage keys
const BUNDLE_PREFIX_V2 = 'encdm:bundle:v2:';
const TRUST_PREFIX_V2 = 'encdm:trust:v2:';

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
    // Keep default variant for backward compatibility with stored keys
    return sodium.to_base64(bytes);
  }

  private toHex(bytes: Uint8Array) {
    return sodium.to_hex(bytes);
  }

  private fromB64(b64: string) {
    // Keep default variant for backward compatibility with stored keys
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

  // V2: Network-aware storage key helpers
  private getBundleKeyV2(network: string, nick: string): string {
    return `${BUNDLE_PREFIX_V2}${network}:${nick.toLowerCase()}`;
  }

  private getTrustKeyV2(network: string, nick: string): string {
    return `${TRUST_PREFIX_V2}${network}:${nick.toLowerCase()}`;
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
    if (!payload || payload.v !== 1) throw new Error(t('Invalid payload'));
    if (payload.type !== 'encdm-bundle' && payload.type !== 'encdm-fingerprint') {
      throw new Error(t('Invalid payload type'));
    }
    return payload;
  }

  async acceptExternalBundle(nick: string, bundle: Bundle, allowReplace: boolean): Promise<void> {
    const compare = await this.compareBundle(nick, bundle);
    if (compare.status === 'changed' && !allowReplace) {
      throw new Error(t('Key changed'));
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
    if (bundle.v !== 1) throw new Error(t('Invalid version'));
    const encPub = this.fromB64(bundle.encPub);
    const sig = this.fromB64(bundle.sig);
    const idPub = this.fromB64(bundle.idPub);
    const ok = sodium.crypto_sign_verify_detached(sig, encPub, idPub);
    if (!ok) throw new Error(t('Bad signature'));
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
        reject(new Error(t('Timeout')));
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
    if (!pending) throw new Error(t('No pending offer'));

    const request = JSON.parse(pending) as PendingKeyRequest;
    const compare = await this.compareBundle(nick, request.bundle);
    if (compare.status === 'changed' && !allowReplace) {
      throw new Error(t('Key changed'));
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

  // ====================================================================
  // V2: Network-Aware Methods (new, network+nick storage)
  // ====================================================================

  async getBundleForNetwork(network: string, nick: string): Promise<Bundle | null> {
    const stored = await secureStorageService.getSecret(this.getBundleKeyV2(network, nick));
    return stored ? (JSON.parse(stored) as Bundle) : null;
  }

  async storeBundleForNetwork(network: string, nick: string, bundle: Bundle): Promise<void> {
    const bundleKey = this.getBundleKeyV2(network, nick);
    const trustKey = this.getTrustKeyV2(network, nick);
    console.log('[EncryptedDMService] storeBundleForNetwork - network:', network, 'nick:', nick);
    console.log('[EncryptedDMService] Bundle key:', bundleKey);
    console.log('[EncryptedDMService] Trust key:', trustKey);

    await secureStorageService.setSecret(bundleKey, JSON.stringify(bundle));
    const fingerprint = await this.bundleFingerprint(bundle);
    const existingTrust = await this.getTrustRecordForNetwork(network, nick);
    const now = Date.now();
    const trust: TrustRecord = {
      v: 1,
      fingerprint,
      verified: existingTrust?.verified ?? false,
      firstSeen: existingTrust?.firstSeen ?? now,
      lastSeen: now,
    };
    await secureStorageService.setSecret(trustKey, JSON.stringify(trust));
    console.log('[EncryptedDMService] Bundle and trust stored successfully');
    // Notify listeners
    this.bundleListeners.forEach(listener => listener(nick));
  }

  async getBundleFingerprintForNetwork(network: string, nick: string): Promise<string | null> {
    const bundle = await this.getBundleForNetwork(network, nick);
    if (!bundle) return null;
    return this.bundleFingerprint(bundle);
  }

  async getTrustRecordForNetwork(network: string, nick: string): Promise<TrustRecord | null> {
    const stored = await secureStorageService.getSecret(this.getTrustKeyV2(network, nick));
    return stored ? (JSON.parse(stored) as TrustRecord) : null;
  }

  async setVerifiedForNetwork(network: string, nick: string, verified: boolean): Promise<void> {
    const record = await this.getTrustRecordForNetwork(network, nick);
    if (!record) return;
    await secureStorageService.setSecret(this.getTrustKeyV2(network, nick), JSON.stringify({
      ...record,
      verified,
      lastSeen: Date.now(),
    }));
  }

  async isEncryptedForNetwork(network: string, nick: string): Promise<boolean> {
    const bundle = await this.getBundleForNetwork(network, nick);
    return bundle !== null;
  }

  private async compareBundleForNetwork(network: string, nick: string, bundle: Bundle): Promise<{
    status: 'new' | 'same' | 'changed';
    existingFingerprint?: string;
    newFingerprint: string;
  }> {
    const newFingerprint = await this.bundleFingerprint(bundle);
    const existingBundle = await this.getBundleForNetwork(network, nick);
    if (!existingBundle) {
      return { status: 'new', newFingerprint };
    }
    const existingFingerprint = await this.bundleFingerprint(existingBundle);
    if (existingFingerprint === newFingerprint) {
      return { status: 'same', existingFingerprint, newFingerprint };
    }
    return { status: 'changed', existingFingerprint, newFingerprint };
  }

  async acceptExternalBundleForNetwork(network: string, nick: string, bundle: Bundle, allowReplace: boolean): Promise<void> {
    const compare = await this.compareBundleForNetwork(network, nick, bundle);
    if (compare.status === 'changed' && !allowReplace) {
      throw new Error(t('Key changed'));
    }
    await this.storeBundleForNetwork(network, nick, bundle);
  }

  async getVerificationStatusForNetwork(network: string, nick: string): Promise<{ fingerprint: string | null; verified: boolean }> {
    const record = await this.getTrustRecordForNetwork(network, nick);
    if (record) return { fingerprint: record.fingerprint, verified: record.verified };
    const fp = await this.getBundleFingerprintForNetwork(network, nick);
    return { fingerprint: fp, verified: false };
  }

  // Network-aware online key exchange methods
  async handleIncomingBundleForNetwork(network: string, fromNick: string, payload: string) {
    try {
      const bundle = JSON.parse(payload) as Bundle;
      this.verifyBundle(bundle);
      const compare = await this.compareBundleForNetwork(network, fromNick, bundle);
      if (compare.status === 'changed') {
        await secureStorageService.setSecret(
          PENDING_PREFIX + network + ':' + fromNick.toLowerCase(),
          JSON.stringify({
            nick: fromNick,
            network,
            bundle,
            timestamp: Date.now(),
            reason: 'legacy',
            existingFingerprint: compare.existingFingerprint,
            newFingerprint: compare.newFingerprint,
          } as PendingKeyRequest & { network: string })
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
      await this.storeBundleForNetwork(network, fromNick, bundle);
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

  async handleKeyOfferForNetwork(network: string, fromNick: string, payload: string): Promise<boolean> {
    try {
      const bundle = JSON.parse(payload) as Bundle;
      this.verifyBundle(bundle);
      const compare = await this.compareBundleForNetwork(network, fromNick, bundle);
      // Store as pending
      await secureStorageService.setSecret(
        PENDING_PREFIX + network + ':' + fromNick.toLowerCase(),
        JSON.stringify({
          nick: fromNick,
          network,
          bundle,
          timestamp: Date.now(),
          reason: compare.status === 'changed' ? 'change' : 'offer',
          existingFingerprint: compare.existingFingerprint,
          newFingerprint: compare.newFingerprint,
        } as PendingKeyRequest & { network: string })
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

  async acceptKeyOfferForNetwork(network: string, nick: string, allowReplace = false): Promise<Bundle> {
    const pending = await secureStorageService.getSecret(PENDING_PREFIX + network + ':' + nick.toLowerCase());
    if (!pending) throw new Error(t('No pending offer'));

    const request = JSON.parse(pending) as PendingKeyRequest;
    const compare = await this.compareBundleForNetwork(network, nick, request.bundle);
    if (compare.status === 'changed' && !allowReplace) {
      throw new Error(t('Key changed'));
    }
    // Store their bundle with network
    await this.storeBundleForNetwork(network, nick, request.bundle);
    // Remove from pending
    await secureStorageService.removeSecret(PENDING_PREFIX + network + ':' + nick.toLowerCase());
    // Return our bundle to send back
    return this.exportBundle();
  }

  async rejectKeyOfferForNetwork(network: string, nick: string): Promise<void> {
    await secureStorageService.removeSecret(PENDING_PREFIX + network + ':' + nick.toLowerCase());
  }

  async handleKeyAcceptanceForNetwork(network: string, fromNick: string, payload: string): Promise<{ status: 'stored' | 'pending' | 'invalid' }> {
    try {
      const bundle = JSON.parse(payload) as Bundle;
      this.verifyBundle(bundle);
      const compare = await this.compareBundleForNetwork(network, fromNick, bundle);
      if (compare.status === 'changed') {
        await secureStorageService.setSecret(
          PENDING_PREFIX + network + ':' + fromNick.toLowerCase(),
          JSON.stringify({
            nick: fromNick,
            network,
            bundle,
            timestamp: Date.now(),
            reason: 'change',
            existingFingerprint: compare.existingFingerprint,
            newFingerprint: compare.newFingerprint,
          } as PendingKeyRequest & { network: string })
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
      await this.storeBundleForNetwork(network, fromNick, bundle);
      return { status: 'stored' };
    } catch (e) {
      console.warn('EncryptedDMService: invalid acceptance', e);
      return { status: 'invalid' };
    }
  }

  // ====================================================================
  // End V2 Network-Aware Methods
  // ====================================================================

  private async deriveKey(theirEncPubB64: string) {
    const self = await this.getOrCreateIdentity();
    const shared = x25519.getSharedSecret(this.fromB64(self.encPriv), this.fromB64(theirEncPubB64));
    return sodium.crypto_generichash(32, shared);
  }

  async getMessageKeyForNetwork(network: string, nick: string): Promise<Uint8Array> {
    await this.ensureReady();
    const bundle = await this.getBundleForNetwork(network, nick);
    if (!bundle) throw new Error(t('No bundle'));
    return this.deriveKey(bundle.encPub);
  }

  private buildMessageAAD(network: string | null, nick: string): string {
    if (network) {
      return `dmmsg:${network}:${nick}`;
    }
    return `dmmsg:legacy:${nick}`;
  }

  async encrypt(plaintext: string, nick: string) {
    await this.ensureReady();
    const bundle = await this.getBundle(nick);
    if (!bundle) throw new Error(t('No bundle'));
    const key = await this.deriveKey(bundle.encPub);
    const aad = this.buildMessageAAD(null, nick);
    const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
    const cipher = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
      this.fromString(plaintext),
      aad,
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
    if (msg.v !== 1) throw new Error(t('Invalid version'));
    const bundle = await this.getBundle(fromNick);
    if (!bundle) throw new Error(t('Missing bundle'));
    if (bundle.encPub !== msg.from) throw new Error(t('Public key mismatch'));
    const key = await this.deriveKey(bundle.encPub);
    const aad = this.buildMessageAAD(null, fromNick);
    let plain: Uint8Array;
    try {
      plain = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
        null,
        this.fromB64(msg.cipher),
        aad,
        this.fromB64(msg.nonce),
        key,
      );
    } catch (error) {
      plain = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
        null,
        this.fromB64(msg.cipher),
        '',
        this.fromB64(msg.nonce),
        key,
      );
    }
    return this.toString(plain);
  }

  // V2: Network-aware encryption/decryption
  async encryptForNetwork(plaintext: string, network: string, nick: string) {
    await this.ensureReady();
    const bundle = await this.getBundleForNetwork(network, nick);
    if (!bundle) throw new Error(t('No bundle'));
    const key = await this.deriveKey(bundle.encPub);
    const aad = this.buildMessageAAD(network, nick);
    const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
    const cipher = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
      this.fromString(plaintext),
      aad,
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

  async decryptForNetwork(msg: EncPayload, network: string, fromNick: string): Promise<string> {
    await this.ensureReady();
    if (msg.v !== 1) throw new Error(t('Invalid version'));
    const bundle = await this.getBundleForNetwork(network, fromNick);
    if (!bundle) throw new Error(t('Missing bundle'));
    if (bundle.encPub !== msg.from) throw new Error(t('Public key mismatch'));
    const key = await this.deriveKey(bundle.encPub);
    const aad = this.buildMessageAAD(network, fromNick);
    let plain: Uint8Array;
    try {
      plain = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
        null,
        this.fromB64(msg.cipher),
        aad,
        this.fromB64(msg.nonce),
        key,
      );
    } catch (error) {
      plain = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
        null,
        this.fromB64(msg.cipher),
        '',
        this.fromB64(msg.nonce),
        key,
      );
    }
    return this.toString(plain);
  }

  // ====================================================================
  // Key Management Methods
  // ====================================================================

  async listAllKeys(): Promise<Array<{
    network: string;
    nick: string;
    fingerprint: string;
    verified: boolean;
    firstSeen: number;
    lastSeen: number;
  }>> {
    const allSecrets = await secureStorageService.getAllSecretKeys();
    console.log('[EncryptedDMService] listAllKeys - Total secrets:', allSecrets.length);
    console.log('[EncryptedDMService] Bundle keys found:', allSecrets.filter(k => k.includes('encdm:bundle')));
    const keys: Array<{
      network: string;
      nick: string;
      fingerprint: string;
      verified: boolean;
      firstSeen: number;
      lastSeen: number;
    }> = [];

    for (const secretKey of allSecrets) {
      // Match V2 bundle keys: "encdm:bundle:v2:NetworkName:nickname"
      if (secretKey.startsWith(BUNDLE_PREFIX_V2)) {
        console.log('[EncryptedDMService] Found V2 bundle key:', secretKey);
        const parts = secretKey.substring(BUNDLE_PREFIX_V2.length).split(':');
        if (parts.length >= 2) {
          const network = parts[0];
          const nick = parts.slice(1).join(':'); // Handle nicks with colons

          try {
            const bundle = await this.getBundleForNetwork(network, nick);
            if (bundle) {
              const fingerprint = await this.bundleFingerprint(bundle);
              const trust = await this.getTrustRecordForNetwork(network, nick);

              keys.push({
                network,
                nick,
                fingerprint,
                verified: trust?.verified ?? false,
                firstSeen: trust?.firstSeen ?? 0,
                lastSeen: trust?.lastSeen ?? 0,
              });
            }
          } catch (e) {
            console.warn(`Failed to load key for ${network}:${nick}`, e);
          }
        }
      }
    }

    // Sort by network, then nick
    return keys.sort((a, b) => {
      const networkCompare = a.network.localeCompare(b.network);
      if (networkCompare !== 0) return networkCompare;
      return a.nick.localeCompare(b.nick);
    });
  }

  async deleteBundleForNetwork(network: string, nick: string): Promise<void> {
    await secureStorageService.removeSecret(this.getBundleKeyV2(network, nick));
    await secureStorageService.removeSecret(this.getTrustKeyV2(network, nick));
  }

  async copyBundleToNetwork(fromNetwork: string, toNetwork: string, nick: string): Promise<void> {
    const bundle = await this.getBundleForNetwork(fromNetwork, nick);
    if (!bundle) {
      throw new Error(t('No key found for {nick} on {network}', { nick, network: fromNetwork }));
    }
    const trust = await this.getTrustRecordForNetwork(fromNetwork, nick);

    // Store in new network
    await this.storeBundleForNetwork(toNetwork, nick, bundle);

    // Copy trust record if exists
    if (trust) {
      await secureStorageService.setSecret(
        this.getTrustKeyV2(toNetwork, nick),
        JSON.stringify(trust)
      );
    }
  }

  async moveBundleToNetwork(fromNetwork: string, toNetwork: string, nick: string): Promise<void> {
    await this.copyBundleToNetwork(fromNetwork, toNetwork, nick);
    await this.deleteBundleForNetwork(fromNetwork, nick);
  }

  async migrateOldKeysToNetwork(network: string): Promise<number> {
    const allSecrets = await secureStorageService.getAllSecretKeys();
    let migratedCount = 0;

    for (const secretKey of allSecrets) {
      // Match old format keys: "encdm:bundle:nickname" (no network prefix)
      if (secretKey.startsWith(BUNDLE_PREFIX) && !secretKey.startsWith(BUNDLE_PREFIX_V2)) {
        const nick = secretKey.substring(BUNDLE_PREFIX.length);

        try {
          // Get old bundle
          const bundle = await this.getBundle(nick);
          if (bundle) {
            // Store in new format with network
            await this.storeBundleForNetwork(network, nick, bundle);

            // Migrate trust record if exists
            const oldTrust = await this.getTrustRecord(nick);
            if (oldTrust) {
              await secureStorageService.setSecret(
                this.getTrustKeyV2(network, nick),
                JSON.stringify(oldTrust)
              );
            }

            migratedCount++;
          }
        } catch (e) {
          console.warn(`Failed to migrate key for ${nick}`, e);
        }
      }
    }

    return migratedCount;
  }

  // ====================================================================
  // Key Backup/Import Methods
  // ====================================================================

  async exportKeyBackup(password: string): Promise<string> {
    await this.ensureReady();

    // Get all V2 keys
    const allSecrets = await secureStorageService.getAllSecretKeys();
    const keyData: Array<{
      network: string;
      nick: string;
      bundle: string;
      trust: string;
    }> = [];

    for (const secretKey of allSecrets) {
      if (secretKey.startsWith(BUNDLE_PREFIX_V2)) {
        const parts = secretKey.substring(BUNDLE_PREFIX_V2.length).split(':');
        if (parts.length >= 2) {
          const network = parts[0];
          const nick = parts.slice(1).join(':');

          try {
            const bundleData = await secureStorageService.getSecret(this.getBundleKeyV2(network, nick));
            const trustData = await secureStorageService.getSecret(this.getTrustKeyV2(network, nick));

            if (bundleData) {
              keyData.push({
                network,
                nick,
                bundle: bundleData,
                trust: trustData || '',
              });
            }
          } catch (e) {
            console.warn(`Failed to export key for ${network}:${nick}`, e);
          }
        }
      }
    }

    // Create backup structure
    const backup = {
      version: 1,
      timestamp: Date.now(),
      keys: keyData,
    };

    const backupJson = JSON.stringify(backup);

    // Derive key from password using argon2id
    const salt = sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);
    const key = sodium.crypto_pwhash(
      sodium.crypto_secretbox_KEYBYTES,
      password,
      salt,
      sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
      sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
      sodium.crypto_pwhash_ALG_ARGON2ID13
    );

    // Encrypt backup
    const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
    const encrypted = sodium.crypto_secretbox_easy(
      this.fromString(backupJson),
      nonce,
      key
    );

    // Combine salt + nonce + encrypted data
    const combined = new Uint8Array(salt.length + nonce.length + encrypted.length);
    combined.set(salt, 0);
    combined.set(nonce, salt.length);
    combined.set(encrypted, salt.length + nonce.length);

    // Return as base64
    return this.toB64(combined);
  }

  async importKeyBackup(encryptedBackup: string, password: string): Promise<number> {
    await this.ensureReady();

    try {
      const combined = this.fromB64(encryptedBackup);

      // Extract salt, nonce, and encrypted data
      const saltBytes = sodium.crypto_pwhash_SALTBYTES;
      const nonceBytes = sodium.crypto_secretbox_NONCEBYTES;

      if (combined.length < saltBytes + nonceBytes) {
        throw new Error(t('Invalid backup format'));
      }

      const salt = combined.slice(0, saltBytes);
      const nonce = combined.slice(saltBytes, saltBytes + nonceBytes);
      const encrypted = combined.slice(saltBytes + nonceBytes);

      // Derive key from password
      const key = sodium.crypto_pwhash(
        sodium.crypto_secretbox_KEYBYTES,
        password,
        salt,
        sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
        sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
        sodium.crypto_pwhash_ALG_ARGON2ID13
      );

      // Decrypt backup
      const decrypted = sodium.crypto_secretbox_open_easy(encrypted, nonce, key);
      const backupJson = this.toString(decrypted);
      const backup = JSON.parse(backupJson) as {
        version: number;
        timestamp: number;
        keys: Array<{
          network: string;
          nick: string;
          bundle: string;
          trust: string;
        }>;
      };

      if (backup.version !== 1) {
        throw new Error(t('Unsupported backup version'));
      }

      // Import all keys
      let importedCount = 0;
      for (const keyEntry of backup.keys) {
        try {
          const { network, nick, bundle, trust } = keyEntry;

          // Store bundle
          await secureStorageService.setSecret(
            this.getBundleKeyV2(network, nick),
            bundle
          );

          // Store trust record if exists
          if (trust) {
            await secureStorageService.setSecret(
              this.getTrustKeyV2(network, nick),
              trust
            );
          }

          importedCount++;
        } catch (e) {
          console.warn(`Failed to import key for ${keyEntry.network}:${keyEntry.nick}`, e);
        }
      }

      return importedCount;
    } catch (e) {
      console.error('Failed to import backup:', e);
      throw new Error(t('Failed to decrypt backup. Check your password.'));
    }
  }

  // ====================================================================
  // End Key Backup/Import Methods
  // ====================================================================

  // ====================================================================
  // End Key Management Methods
  // ====================================================================
}

export const encryptedDMService = new EncryptedDMService();

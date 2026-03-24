/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const store = new Map<string, string>();
const mockGetSecret = jest.fn(async (k: string) => (store.has(k) ? store.get(k)! : null));
const mockSetSecret = jest.fn(async (k: string, v: string) => {
  store.set(k, v);
});
const mockRemoveSecret = jest.fn(async (k: string) => {
  store.delete(k);
});
const mockGetAllSecretKeys = jest.fn(async () => Array.from(store.keys()));

jest.mock('../../src/services/SecureStorageService', () => ({
  secureStorageService: {
    getSecret: (...args: any[]) => mockGetSecret(...args),
    setSecret: (...args: any[]) => mockSetSecret(...args),
    removeSecret: (...args: any[]) => mockRemoveSecret(...args),
    getAllSecretKeys: (...args: any[]) => mockGetAllSecretKeys(...args),
  },
}));

const u8 = (...arr: number[]) => new Uint8Array(arr);
const b64 = (arr: Uint8Array) => Buffer.from(arr).toString('base64');
const fromB64 = (s: string) => new Uint8Array(Buffer.from(s, 'base64'));

let mockSodium: any;
jest.mock('react-native-libsodium', () => {
  mockSodium = {
    ready: Promise.resolve(),
    to_base64: jest.fn((bytes: Uint8Array) => Buffer.from(bytes).toString('base64')),
    from_base64: jest.fn((text: string) => fromB64(text)),
    to_hex: jest.fn((bytes: Uint8Array) => Buffer.from(bytes).toString('hex')),
    crypto_generichash: jest.fn((len: number, input: Uint8Array) => {
      const out = new Uint8Array(len);
      // Byte truncation is intentional in this mock.
      // eslint-disable-next-line no-bitwise
      for (let i = 0; i < len; i++) out[i] = (input[i % input.length] + i) & 0xff;
      return out;
    }),
    crypto_sign_keypair: jest.fn(() => ({ privateKey: u8(1, 2, 3, 4), publicKey: u8(5, 6, 7, 8) })),
    crypto_box_keypair: jest.fn(() => ({ privateKey: u8(9, 10, 11, 12), publicKey: u8(13, 14, 15, 16) })),
    crypto_sign_detached: jest.fn(() => u8(20, 21, 22)),
    crypto_sign_verify_detached: jest.fn(() => true),
    randombytes_buf: jest.fn((n: number) => {
      const out = new Uint8Array(n);
      // Byte truncation is intentional in this mock.
      // eslint-disable-next-line no-bitwise
      for (let i = 0; i < n; i++) out[i] = (i + 1) & 0xff;
      return out;
    }),
    crypto_aead_xchacha20poly1305_ietf_NPUBBYTES: 24,
    crypto_aead_xchacha20poly1305_ietf_encrypt: jest.fn((plain: Uint8Array) => {
      const out = new Uint8Array(plain.length + 1);
      out.set(plain, 0);
      out[out.length - 1] = 255;
      return out;
    }),
    crypto_aead_xchacha20poly1305_ietf_decrypt: jest.fn((_n: any, cipher: Uint8Array) => {
      return cipher.slice(0, cipher.length - 1);
    }),
    crypto_pwhash_SALTBYTES: 16,
    crypto_secretbox_NONCEBYTES: 24,
    crypto_secretbox_KEYBYTES: 32,
    crypto_pwhash_OPSLIMIT_INTERACTIVE: 1,
    crypto_pwhash_MEMLIMIT_INTERACTIVE: 1,
    crypto_pwhash_ALG_ARGON2ID13: 1,
    crypto_pwhash: jest.fn((len: number) => new Uint8Array(len).fill(7)),
    crypto_secretbox_easy: jest.fn((plain: Uint8Array) => {
      const out = new Uint8Array(plain.length + 2);
      out.set(plain, 0);
      out[out.length - 2] = 9;
      out[out.length - 1] = 9;
      return out;
    }),
    crypto_secretbox_open_easy: jest.fn((cipher: Uint8Array) => cipher.slice(0, cipher.length - 2)),
  };
  return {
    __esModule: true,
    default: mockSodium,
  };
});

const mockSharedSecret = jest.fn(() => u8(33, 34, 35, 36));
jest.mock('@noble/curves/ed25519.js', () => ({
  x25519: {
    getSharedSecret: (...args: any[]) => mockSharedSecret(...args),
  },
}));

jest.mock('../../src/i18n/transifex', () => ({
  tx: { t: (key: string, params?: Record<string, unknown>) => {
    if (!params) return key;
    return key.replace(/\{(\w+)\}/g, (_, p1) => String(params[p1] ?? `{${p1}}`));
  } },
}));

import { encryptedDMService } from '../../src/services/EncryptedDMService';

describe('EncryptedDMService', () => {
  const validBundle = {
    v: 1 as const,
    idPub: b64(u8(5, 6, 7, 8)),
    encPub: b64(u8(13, 14, 15, 16)),
    sig: b64(u8(1, 1, 1)),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    store.clear();
    (encryptedDMService as any).waiters = new Map();
    (encryptedDMService as any).bundleListeners = [];
    (encryptedDMService as any).keyRequestListeners = [];
  });

  it('creates identity once and exports/verifies bundle', async () => {
    const self1 = await encryptedDMService.getOrCreateIdentity();
    const self2 = await encryptedDMService.getOrCreateIdentity();
    expect(self1.idPub).toBe(self2.idPub);

    const bundle = await encryptedDMService.exportBundle();
    expect(bundle.v).toBe(1);
    expect(() => encryptedDMService.verifyBundle(bundle)).not.toThrow();
  });

  it('rejects invalid bundle signatures and version', () => {
    mockSodium.crypto_sign_verify_detached.mockReturnValueOnce(false);
    expect(() => encryptedDMService.verifyBundle(validBundle as any)).toThrow('Bad signature');
    expect(() => encryptedDMService.verifyBundle({ ...validBundle, v: 2 } as any)).toThrow('Invalid version');
  });

  it('parses and exports external payloads', async () => {
    const bundlePayload = await encryptedDMService.exportBundlePayload('alice');
    const parsedBundle = encryptedDMService.parseExternalPayload(bundlePayload);
    expect(parsedBundle.type).toBe('encdm-bundle');

    const fpPayload = await encryptedDMService.exportFingerprintPayload('alice');
    const parsedFp = encryptedDMService.parseExternalPayload(fpPayload);
    expect(parsedFp.type).toBe('encdm-fingerprint');

    expect(() => encryptedDMService.parseExternalPayload(JSON.stringify({ v: 2 }))).toThrow('Invalid payload');
    expect(() => encryptedDMService.parseExternalPayload(JSON.stringify({ v: 1, type: 'x' }))).toThrow(
      'Invalid payload type',
    );
  });

  it('stores bundle/trust and reports verification status', async () => {
    await (encryptedDMService as any).storeBundle('alice', validBundle);
    expect(await encryptedDMService.isEncrypted('alice')).toBe(true);
    expect(await encryptedDMService.getBundle('alice')).toEqual(validBundle);
    expect(await encryptedDMService.getBundleFingerprint('alice')).toBeTruthy();
    const status = await encryptedDMService.getVerificationStatus('alice');
    expect(status.verified).toBe(false);
    await encryptedDMService.setVerified('alice', true);
    const status2 = await encryptedDMService.getVerificationStatus('alice');
    expect(status2.verified).toBe(true);
  });

  it('acceptExternalBundle enforces allowReplace policy', async () => {
    await (encryptedDMService as any).storeBundle('alice', validBundle);
    const changed = { ...validBundle, encPub: b64(u8(99, 1, 2)) };
    await expect(encryptedDMService.acceptExternalBundle('alice', changed as any, false)).resolves.toBeUndefined();
    await expect(encryptedDMService.acceptExternalBundle('alice', changed as any, true)).resolves.toBeUndefined();
  });

  it('waits for incoming bundle and times out when missing', async () => {
    await expect(encryptedDMService.awaitBundleForNick('bob', 5)).rejects.toThrow('Timeout');
  });

  it('handles incoming bundle with same/new/changed and resolves waiter', async () => {
    const cb = jest.fn();
    encryptedDMService.onKeyRequest(cb);
    const waiter = { resolve: jest.fn(), reject: jest.fn(), timer: setTimeout(() => undefined, 1000) } as any;
    (encryptedDMService as any).waiters.set('alice', waiter);

    await encryptedDMService.handleIncomingBundle('alice', JSON.stringify(validBundle));
    expect(await encryptedDMService.getBundle('alice')).toEqual(validBundle);
    expect(waiter.resolve).toHaveBeenCalled();

    const changed = { ...validBundle, encPub: b64(u8(88, 77, 66)) };
    await encryptedDMService.handleIncomingBundle('alice', JSON.stringify(changed));
    expect(cb).not.toHaveBeenCalled();
  });

  it('handles key offer/accept/reject/acceptance branches', async () => {
    const keyCb = jest.fn();
    encryptedDMService.onKeyRequest(keyCb);

    expect(await encryptedDMService.handleKeyOffer('alice', JSON.stringify(validBundle))).toBe(true);
    expect(await encryptedDMService.acceptKeyOffer('alice')).toBeTruthy();
    await encryptedDMService.rejectKeyOffer('alice');
    await expect(encryptedDMService.acceptKeyOffer('alice')).rejects.toThrow('No pending offer');

    keyCb.mockClear();
    await (encryptedDMService as any).storeBundle('alice', validBundle);
    const changed = { ...validBundle, encPub: b64(u8(5, 4, 3)) };
    const acceptance = await encryptedDMService.handleKeyAcceptance('alice', JSON.stringify(changed));
    expect(acceptance.status).toBe('stored');
    expect(keyCb).not.toHaveBeenCalled();
    expect(await encryptedDMService.handleKeyAcceptance('alice', '{bad')).toEqual({ status: 'invalid' });
  });

  it('supports bundle/key request listeners unsubscribe', () => {
    const a = jest.fn();
    const b = jest.fn();
    const offA = encryptedDMService.onBundleStored(a);
    const offB = encryptedDMService.onKeyRequest(b);
    offA();
    offB();
    expect((encryptedDMService as any).bundleListeners).toHaveLength(0);
    expect((encryptedDMService as any).keyRequestListeners).toHaveLength(0);
  });

  it('stores and reads network-aware keys and verification flags', async () => {
    await encryptedDMService.storeBundleForNetwork('net1', 'alice', validBundle as any);
    expect(await encryptedDMService.getBundleForNetwork('net1', 'alice')).toEqual(validBundle);
    expect(await encryptedDMService.isEncryptedForNetwork('net1', 'alice')).toBe(true);
    expect(await encryptedDMService.getBundleFingerprintForNetwork('net1', 'alice')).toBeTruthy();

    const s1 = await encryptedDMService.getVerificationStatusForNetwork('net1', 'alice');
    expect(s1.verified).toBe(false);
    await encryptedDMService.setVerifiedForNetwork('net1', 'alice', true);
    const s2 = await encryptedDMService.getVerificationStatusForNetwork('net1', 'alice');
    expect(s2.verified).toBe(true);
  });

  it('network-aware offer/accept/reject/acceptance flows', async () => {
    const cb = jest.fn();
    encryptedDMService.onKeyRequest(cb);

    expect(await encryptedDMService.handleKeyOfferForNetwork('net1', 'alice', JSON.stringify(validBundle))).toBe(true);
    const selfBundle = await encryptedDMService.acceptKeyOfferForNetwork('net1', 'alice');
    expect(selfBundle.v).toBe(1);
    await encryptedDMService.rejectKeyOfferForNetwork('net1', 'alice');

    cb.mockClear();
    await encryptedDMService.storeBundleForNetwork('net1', 'alice', validBundle as any);
    const changed = { ...validBundle, encPub: b64(u8(9, 8, 7)) };
    const result = await encryptedDMService.handleKeyAcceptanceForNetwork('net1', 'alice', JSON.stringify(changed));
    expect(result.status).toBe('stored');
    expect(cb).not.toHaveBeenCalled();
    expect(await encryptedDMService.handleKeyAcceptanceForNetwork('net1', 'alice', 'bad-json')).toEqual({
      status: 'invalid',
    });
  });

  it('network-aware incoming bundle and external accept policy', async () => {
    await encryptedDMService.handleIncomingBundleForNetwork('net1', 'alice', JSON.stringify(validBundle));
    const changed = { ...validBundle, encPub: b64(u8(99, 99, 99)) };
    await encryptedDMService.handleIncomingBundleForNetwork('net1', 'alice', JSON.stringify(changed));
    await expect(
      encryptedDMService.acceptExternalBundleForNetwork('net1', 'alice', changed as any, false),
    ).resolves.toBeUndefined();
    await expect(
      encryptedDMService.acceptExternalBundleForNetwork('net1', 'alice', changed as any, true),
    ).resolves.toBeUndefined();
  });

  it('encrypts/decrypts legacy with aad fallback and validation errors', async () => {
    await (encryptedDMService as any).storeBundle('alice', validBundle);
    const enc = await encryptedDMService.encrypt('hello', 'alice');
    expect(enc.v).toBe(1);

    const plain = await encryptedDMService.decrypt(enc as any, 'alice');
    expect(plain).toBe('hello');

    mockSodium.crypto_aead_xchacha20poly1305_ietf_decrypt
      .mockImplementationOnce(() => {
        throw new Error('aad mismatch');
      })
      .mockImplementationOnce((_n: any, cipher: Uint8Array) => cipher.slice(0, cipher.length - 1));
    const plainFallback = await encryptedDMService.decrypt(enc as any, 'alice');
    expect(plainFallback).toBe('hello');

    await expect(encryptedDMService.decrypt({ ...enc, v: 2 } as any, 'alice')).rejects.toThrow('Invalid version');
    await expect(encryptedDMService.decrypt({ ...enc, from: b64(u8(1, 2, 3)) } as any, 'alice')).rejects.toThrow(
      'Public key mismatch',
    );
  });

  it('encrypts/decrypts network-aware and derives message key', async () => {
    await encryptedDMService.storeBundleForNetwork('net1', 'alice', validBundle as any);
    const key = await encryptedDMService.getMessageKeyForNetwork('net1', 'alice');
    expect(key).toBeInstanceOf(Uint8Array);

    const enc = await encryptedDMService.encryptForNetwork('hello-net', 'net1', 'alice');
    const plain = await encryptedDMService.decryptForNetwork(enc as any, 'net1', 'alice');
    expect(plain).toBe('hello-net');

    await expect(encryptedDMService.getMessageKeyForNetwork('net1', 'missing')).rejects.toThrow('No bundle');
    await expect(encryptedDMService.decryptForNetwork({ ...enc, v: 2 } as any, 'net1', 'alice')).rejects.toThrow(
      'Invalid version',
    );
  });

  it('lists, copies, moves, deletes and migrates keys', async () => {
    await encryptedDMService.storeBundleForNetwork('netB', 'bob', validBundle as any);
    await encryptedDMService.storeBundleForNetwork('netA', 'alice', validBundle as any);
    const list = await encryptedDMService.listAllKeys();
    expect(list.map(k => `${k.network}:${k.nick}`)).toEqual(['netA:alice', 'netB:bob']);

    await encryptedDMService.copyBundleToNetwork('netA', 'netC', 'alice');
    expect(await encryptedDMService.isEncryptedForNetwork('netC', 'alice')).toBe(true);
    await encryptedDMService.moveBundleToNetwork('netC', 'netD', 'alice');
    expect(await encryptedDMService.isEncryptedForNetwork('netD', 'alice')).toBe(true);
    await encryptedDMService.deleteBundleForNetwork('netD', 'alice');
    expect(await encryptedDMService.isEncryptedForNetwork('netD', 'alice')).toBe(false);

    // old format migration
    store.set('encdm:bundle:legacy', JSON.stringify(validBundle));
    store.set('encdm:trust:legacy', JSON.stringify({ v: 1, fingerprint: 'ff', verified: true, firstSeen: 1, lastSeen: 2 }));
    const migrated = await encryptedDMService.migrateOldKeysToNetwork('netM');
    expect(migrated).toBeGreaterThanOrEqual(1);
    expect(await encryptedDMService.isEncryptedForNetwork('netM', 'legacy')).toBe(true);
  });

  it('throws copy error when source key missing', async () => {
    await expect(encryptedDMService.copyBundleToNetwork('a', 'b', 'nobody')).rejects.toThrow('No key found');
  });

  it('exports and imports encrypted key backup', async () => {
    await encryptedDMService.storeBundleForNetwork('net1', 'alice', validBundle as any);
    await encryptedDMService.storeBundleForNetwork('net2', 'bob', validBundle as any);

    const backup = await encryptedDMService.exportKeyBackup('pass');
    expect(typeof backup).toBe('string');
    expect(backup.length).toBeGreaterThan(0);

    store.clear();
    const imported = await encryptedDMService.importKeyBackup(backup, 'pass');
    expect(imported).toBe(2);
    expect(await encryptedDMService.isEncryptedForNetwork('net1', 'alice')).toBe(true);
  });

  it('handles import backup errors (format/version/decrypt)', async () => {
    mockSodium.from_base64.mockReturnValueOnce(u8(1, 2, 3)); // too short
    await expect(encryptedDMService.importKeyBackup('bad', 'pass')).rejects.toThrow('Failed to decrypt backup');

    // build valid decrypted payload with unsupported version
    const payload = JSON.stringify({ version: 2, timestamp: 1, keys: [] });
    const salt = new Uint8Array(mockSodium.crypto_pwhash_SALTBYTES).fill(1);
    const nonce = new Uint8Array(mockSodium.crypto_secretbox_NONCEBYTES).fill(2);
    const encrypted = new Uint8Array(Buffer.from(payload));
    const combined = new Uint8Array(salt.length + nonce.length + encrypted.length);
    combined.set(salt, 0);
    combined.set(nonce, salt.length);
    combined.set(encrypted, salt.length + nonce.length);
    mockSodium.from_base64.mockReturnValueOnce(combined);
    mockSodium.crypto_secretbox_open_easy.mockReturnValueOnce(new Uint8Array(Buffer.from(payload)));
    await expect(encryptedDMService.importKeyBackup('x', 'p')).rejects.toThrow('Failed to decrypt backup');

    mockSodium.crypto_secretbox_open_easy.mockImplementationOnce(() => {
      throw new Error('decrypt fail');
    });
    mockSodium.from_base64.mockReturnValueOnce(combined);
    await expect(encryptedDMService.importKeyBackup('x', 'p')).rejects.toThrow('Failed to decrypt backup');
  });

  it('covers additional edge branches for formatting, same-bundle paths, and network waiters', async () => {
    expect(encryptedDMService.formatFingerprintForDisplay('')).toBe('');
    expect(await encryptedDMService.getVerificationStatus('unknown')).toEqual({ fingerprint: null, verified: false });
    expect(await encryptedDMService.getVerificationStatusForNetwork('netX', 'unknown')).toEqual({
      fingerprint: null,
      verified: false,
    });

    await (encryptedDMService as any).storeBundle('alice', validBundle);
    await expect(encryptedDMService.acceptKeyOffer('alice')).rejects.toThrow('No pending offer');

    const acceptanceStored = await encryptedDMService.handleKeyAcceptance('alice', JSON.stringify(validBundle));
    expect(acceptanceStored.status).toBe('stored');

    await encryptedDMService.storeBundleForNetwork('net1', 'alice', validBundle as any);
    await encryptedDMService.acceptExternalBundleForNetwork('net1', 'alice', validBundle as any, false);
    const acceptanceStoredNetwork = await encryptedDMService.handleKeyAcceptanceForNetwork(
      'net1',
      'alice',
      JSON.stringify(validBundle),
    );
    expect(acceptanceStoredNetwork.status).toBe('stored');

    const waiter = { resolve: jest.fn(), reject: jest.fn(), timer: setTimeout(() => undefined, 1000) } as any;
    (encryptedDMService as any).waiters.set('alice', waiter);
    await encryptedDMService.handleIncomingBundleForNetwork('net1', 'alice', JSON.stringify(validBundle));
    expect(waiter.resolve).toHaveBeenCalled();
  });

  it('covers legacy/network changed-offer guard branches', async () => {
    const changed = { ...validBundle, encPub: b64(u8(44, 45, 46, 47)) };

    await (encryptedDMService as any).storeBundle('alice', validBundle);
    await encryptedDMService.handleKeyOffer('alice', JSON.stringify(changed));
    await expect(encryptedDMService.acceptKeyOffer('alice')).resolves.toBeTruthy();

    await encryptedDMService.storeBundleForNetwork('net1', 'alice', validBundle as any);
    await encryptedDMService.handleKeyOfferForNetwork('net1', 'alice', JSON.stringify(changed));
    await expect(encryptedDMService.acceptKeyOfferForNetwork('net1', 'alice')).resolves.toBeTruthy();
  });

  it('covers export/list/import warning branches for malformed entries', async () => {
    await encryptedDMService.storeBundleForNetwork('net1', 'alice', validBundle as any);
    mockGetSecret.mockImplementationOnce(async () => {
      throw new Error('bundle load fail');
    });
    await encryptedDMService.exportKeyBackup('p');

    store.set('encdm:bundle:v2:net1:bad', '{broken');
    const listed = await encryptedDMService.listAllKeys();
    expect(Array.isArray(listed)).toBe(true);

    const backupPayload = JSON.stringify({
      version: 1,
      timestamp: Date.now(),
      keys: [{ network: 'net1', nick: 'bad', bundle: '{broken', trust: '' }],
    });
    const salt = new Uint8Array(mockSodium.crypto_pwhash_SALTBYTES).fill(1);
    const nonce = new Uint8Array(mockSodium.crypto_secretbox_NONCEBYTES).fill(2);
    const encrypted = new Uint8Array(Buffer.from(backupPayload));
    const combined = new Uint8Array(salt.length + nonce.length + encrypted.length);
    combined.set(salt, 0);
    combined.set(nonce, salt.length);
    combined.set(encrypted, salt.length + nonce.length);
    mockSodium.from_base64.mockReturnValueOnce(combined);
    mockSodium.crypto_secretbox_open_easy.mockReturnValueOnce(new Uint8Array(Buffer.from(backupPayload)));
    const imported = await encryptedDMService.importKeyBackup('payload', 'pass');
    expect(imported).toBe(1);
  });

  it('handles malformed JSON inputs in key handlers', async () => {
    expect(await encryptedDMService.handleKeyOffer('alice', 'not-json')).toBe(false);
    expect(await encryptedDMService.handleKeyOfferForNetwork('net1', 'alice', 'not-json')).toBe(false);
    await encryptedDMService.handleIncomingBundle('alice', 'not-json');
    await encryptedDMService.handleIncomingBundleForNetwork('net1', 'alice', 'not-json');
    expect(await encryptedDMService.handleKeyAcceptance('alice', 'not-json')).toEqual({ status: 'invalid' });
  });
});

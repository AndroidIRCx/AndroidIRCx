import { ed25519 } from '@noble/curves/ed25519.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { strToU8 } from 'fflate';
import {
  ADDON_SIGNATURE_FILE,
  createAddonSigningDigest,
  verifyAddonPackageSignature,
} from '../../src/services/scripting/AddonPackageSignature';

const privateKey = new Uint8Array(32).fill(7);
const publicKey = ed25519.getPublicKey(privateKey);

const signedFiles = () => {
  const files = new Map<string, Uint8Array>([
    ['main.js', strToU8('module.exports = {};')],
    ['manifest.json', strToU8('{"id":"example"}')],
  ]);
  const digest = createAddonSigningDigest(files);
  files.set(
    ADDON_SIGNATURE_FILE,
    strToU8(
      JSON.stringify({
        version: 1,
        algorithm: 'ed25519',
        keyId: 'author-key-1',
        publicKey: bytesToHex(publicKey),
        signature: bytesToHex(ed25519.sign(digest, privateKey)),
      }),
    ),
  );
  return files;
};

describe('AddonPackageSignature', () => {
  it('distinguishes unsigned, valid new and valid known author keys', () => {
    expect(verifyAddonPackageSignature(new Map()).status).toBe('unsigned');
    const files = signedFiles();
    expect(verifyAddonPackageSignature(files).status).toBe('valid-new-key');
    expect(
      verifyAddonPackageSignature(
        files,
        new Map([['author-key-1', bytesToHex(publicKey)]]),
      ).status,
    ).toBe('valid-known-key');
  });

  it('rejects changed content, key substitution and malformed documents', () => {
    const changed = signedFiles();
    changed.set('main.js', strToU8('changed'));
    expect(verifyAddonPackageSignature(changed).status).toBe('invalid');
    expect(
      verifyAddonPackageSignature(
        signedFiles(),
        new Map([['author-key-1', '00'.repeat(32)]]),
      ).status,
    ).toBe('invalid');
    expect(
      verifyAddonPackageSignature(
        new Map([[ADDON_SIGNATURE_FILE, strToU8('{}')]]),
      ).status,
    ).toBe('invalid');
  });

  it('produces the same digest regardless of archive entry order', () => {
    const first = new Map([
      ['b', strToU8('2')],
      ['a', strToU8('1')],
    ]);
    const second = new Map([...first.entries()].reverse());
    expect(bytesToHex(createAddonSigningDigest(first))).toBe(
      bytesToHex(createAddonSigningDigest(second)),
    );
  });
});

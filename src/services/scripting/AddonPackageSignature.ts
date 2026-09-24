/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import { ed25519 } from '@noble/curves/ed25519.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { TextDecoder, TextEncoder } from 'text-encoding';
import type { AddonSignatureStatus } from './AddonInstallReview';

export const ADDON_SIGNATURE_FILE = 'signature.json';

interface AddonSignatureDocument {
  version: 1;
  algorithm: 'ed25519';
  keyId: string;
  publicKey: string;
  signature: string;
}

export interface AddonSignatureVerification {
  status: AddonSignatureStatus;
  keyId?: string;
  publicKey?: string;
  signingDigestSha256: string;
}

export function createAddonSigningDigest(
  files: ReadonlyMap<string, Uint8Array>,
): Uint8Array {
  const encoder = new TextEncoder();
  const records: Uint8Array[] = [];
  [...files.entries()]
    .filter(([name]) => name !== ADDON_SIGNATURE_FILE)
    .sort(([left], [right]) => left.localeCompare(right, 'en-US'))
    .forEach(([name, content]) => {
      records.push(sha256(encoder.encode(name)), sha256(content));
    });
  const combined = new Uint8Array(records.length * 32);
  records.forEach((record, index) => combined.set(record, index * 32));
  return sha256(combined);
}

export function verifyAddonPackageSignature(
  files: ReadonlyMap<string, Uint8Array>,
  knownKeys: ReadonlyMap<string, string> = new Map(),
): AddonSignatureVerification {
  const digest = createAddonSigningDigest(files);
  const digestHex = bytesToHex(digest);
  const signatureBytes = files.get(ADDON_SIGNATURE_FILE);
  if (!signatureBytes)
    return { status: 'unsigned', signingDigestSha256: digestHex };

  let document: AddonSignatureDocument;
  try {
    document = JSON.parse(
      new TextDecoder('utf-8').decode(signatureBytes),
    ) as AddonSignatureDocument;
    if (
      document.version !== 1 ||
      document.algorithm !== 'ed25519' ||
      !/^[a-zA-Z0-9._:-]{1,80}$/.test(document.keyId) ||
      !/^[0-9a-f]{64}$/i.test(document.publicKey) ||
      !/^[0-9a-f]{128}$/i.test(document.signature)
    )
      throw new Error('Invalid signature document');
  } catch {
    return { status: 'invalid', signingDigestSha256: digestHex };
  }

  const normalizedKey = document.publicKey.toLowerCase();
  const knownKey = knownKeys.get(document.keyId)?.toLowerCase();
  if (knownKey !== undefined && knownKey !== normalizedKey)
    return {
      status: 'invalid',
      keyId: document.keyId,
      publicKey: normalizedKey,
      signingDigestSha256: digestHex,
    };

  let valid = false;
  try {
    valid = ed25519.verify(
      hexToBytes(document.signature),
      digest,
      hexToBytes(normalizedKey),
    );
  } catch {
    valid = false;
  }
  return {
    status: valid
      ? knownKey
        ? 'valid-known-key'
        : 'valid-new-key'
      : 'invalid',
    keyId: document.keyId,
    publicKey: normalizedKey,
    signingDigestSha256: digestHex,
  };
}

/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { TextDecoder } from 'text-encoding';
import { Unzip, UnzipInflate, UnzipPassThrough } from 'fflate';
import {
  validateAddonManifest,
  type AddonManifest,
  isSafeAddonPath,
} from './AddonManifest';
import {
  ADDON_PACKAGE_LIMITS,
  validateAddonArchiveEntries,
  type AddonArchiveEntry,
} from './AddonPackagePolicy';
import {
  verifyAddonPackageSignature,
  type AddonSignatureVerification,
} from './AddonPackageSignature';

export interface ReadAddonPackage {
  checksumSha256: string;
  manifest: AddonManifest;
  files: ReadonlyMap<string, Uint8Array>;
  signature: AddonSignatureVerification;
}

export class AddonPackageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AddonPackageError';
  }
}

export function readAddonPackage(
  data: Uint8Array,
  knownKeys: ReadonlyMap<string, string> = new Map(),
): ReadAddonPackage {
  if (data.byteLength === 0) throw new AddonPackageError('Package is empty.');
  if (data.byteLength > ADDON_PACKAGE_LIMITS.maxCompressedBytes)
    throw new AddonPackageError('Compressed package is too large.');

  const files = new Map<string, Uint8Array>();
  const entries: AddonArchiveEntry[] = [];
  const seen = new Set<string>();
  let expandedTotal = 0;
  let failure: Error | undefined;

  const fail = (message: string | Error): never => {
    throw message instanceof Error ? message : new AddonPackageError(message);
  };

  const unzip = new Unzip(file => {
    if (failure) return;
    try {
      if (entries.length >= ADDON_PACKAGE_LIMITS.maxEntries)
        fail('Package contains too many entries.');
      const directory = file.name.endsWith('/');
      const candidate = directory ? file.name.replace(/\/+$/, '') : file.name;
      if (!isSafeAddonPath(candidate))
        fail(`Unsafe package path: ${file.name}.`);
      const normalized = candidate.replace(/\\/g, '/');
      const key = normalized.toLocaleLowerCase('en-US');
      if (seen.has(key)) fail(`Duplicate package path: ${normalized}.`);
      seen.add(key);

      if (file.compression !== 0 && file.compression !== 8)
        fail(`Unsupported ZIP compression method: ${file.compression}.`);
      if (
        file.originalSize !== undefined &&
        file.originalSize > ADDON_PACKAGE_LIMITS.maxEntryBytes
      )
        fail(`Package entry is too large: ${normalized}.`);
      if (
        file.size !== undefined &&
        file.originalSize !== undefined &&
        file.originalSize / Math.max(1, file.size) >
          ADDON_PACKAGE_LIMITS.maxCompressionRatio
      )
        fail(`Suspicious compression ratio: ${normalized}.`);

      const chunks: Uint8Array[] = [];
      let actualSize = 0;
      file.ondata = (error, chunk, final) => {
        if (error) {
          failure = error;
          return;
        }
        actualSize += chunk.byteLength;
        expandedTotal += chunk.byteLength;
        if (
          actualSize > ADDON_PACKAGE_LIMITS.maxEntryBytes ||
          expandedTotal > ADDON_PACKAGE_LIMITS.maxUncompressedBytes
        ) {
          failure = new AddonPackageError(
            'Uncompressed package limit exceeded.',
          );
          file.terminate();
          return;
        }
        if (!directory && chunk.byteLength > 0) chunks.push(chunk);
        if (final) {
          entries.push({
            path: directory ? `${normalized}/` : normalized,
            compressedSize: file.size ?? actualSize,
            uncompressedSize: actualSize,
            isDirectory: directory,
          });
          if (!directory) files.set(normalized, joinChunks(chunks, actualSize));
        }
      };
      file.start();
    } catch (error) {
      failure =
        error instanceof Error ? error : new AddonPackageError(String(error));
      file.terminate();
    }
  });
  unzip.register(UnzipPassThrough);
  unzip.register(UnzipInflate);
  try {
    unzip.push(data, true);
  } catch (error) {
    failure =
      error instanceof Error ? error : new AddonPackageError(String(error));
  }
  if (failure) throw failure;

  const archiveValidation = validateAddonArchiveEntries(entries);
  if (!archiveValidation.ok)
    throw new AddonPackageError(archiveValidation.errors.join(' '));
  const manifestBytes = files.get('manifest.json');
  if (!manifestBytes)
    throw new AddonPackageError('Package manifest is missing.');
  if (manifestBytes.byteLength > ADDON_PACKAGE_LIMITS.maxManifestBytes)
    throw new AddonPackageError('Package manifest is too large.');

  let manifestJson: unknown;
  try {
    manifestJson = JSON.parse(new TextDecoder('utf-8').decode(manifestBytes));
  } catch {
    throw new AddonPackageError('Package manifest is not valid UTF-8 JSON.');
  }
  const manifestValidation = validateAddonManifest(manifestJson);
  if (!manifestValidation.ok)
    throw new AddonPackageError(manifestValidation.errors.join(' '));
  if (!files.has(manifestValidation.manifest.entry))
    throw new AddonPackageError('Manifest entry file is missing.');

  return {
    checksumSha256: bytesToHex(sha256(data)),
    manifest: manifestValidation.manifest,
    files,
    signature: verifyAddonPackageSignature(files, knownKeys),
  };
}

function joinChunks(chunks: Uint8Array[], size: number): Uint8Array {
  const result = new Uint8Array(size);
  let offset = 0;
  chunks.forEach(chunk => {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  });
  return result;
}

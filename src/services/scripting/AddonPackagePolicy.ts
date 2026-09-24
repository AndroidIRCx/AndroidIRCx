/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import { isSafeAddonPath } from './AddonManifest';

export const ADDON_PACKAGE_LIMITS = Object.freeze({
  maxEntries: 256,
  maxCompressedBytes: 5 * 1024 * 1024,
  maxUncompressedBytes: 20 * 1024 * 1024,
  maxEntryBytes: 5 * 1024 * 1024,
  maxManifestBytes: 64 * 1024,
  maxCompressionRatio: 100,
});

export interface AddonArchiveEntry {
  path: string;
  compressedSize: number;
  uncompressedSize: number;
  isDirectory?: boolean;
}

export type AddonArchiveValidation =
  { ok: true; normalizedPaths: string[] } | { ok: false; errors: string[] };

const validSize = (value: number) => Number.isSafeInteger(value) && value >= 0;

export function validateAddonArchiveEntries(
  entries: readonly AddonArchiveEntry[],
): AddonArchiveValidation {
  const errors: string[] = [];
  if (entries.length === 0) errors.push('Package is empty.');
  if (entries.length > ADDON_PACKAGE_LIMITS.maxEntries)
    errors.push('Package contains too many entries.');

  let compressedTotal = 0;
  let uncompressedTotal = 0;
  const normalizedPaths: string[] = [];
  const seen = new Set<string>();

  entries.forEach(entry => {
    const directory = entry.isDirectory || entry.path.endsWith('/');
    const candidate = directory
      ? entry.path.replace(/[\\/]+$/, '')
      : entry.path;
    if (!isSafeAddonPath(candidate)) {
      errors.push(`Unsafe package path: ${entry.path}.`);
      return;
    }
    const normalized = candidate.replace(/\\/g, '/');
    const collisionKey = normalized.toLocaleLowerCase('en-US');
    if (seen.has(collisionKey))
      errors.push(`Duplicate package path: ${normalized}.`);
    seen.add(collisionKey);
    if (!directory) normalizedPaths.push(normalized);

    if (
      !validSize(entry.compressedSize) ||
      !validSize(entry.uncompressedSize)
    ) {
      errors.push(`Invalid entry size: ${normalized}.`);
      return;
    }
    compressedTotal += entry.compressedSize;
    uncompressedTotal += entry.uncompressedSize;
    if (entry.uncompressedSize > ADDON_PACKAGE_LIMITS.maxEntryBytes)
      errors.push(`Package entry is too large: ${normalized}.`);
    const denominator = Math.max(1, entry.compressedSize);
    if (
      entry.uncompressedSize / denominator >
      ADDON_PACKAGE_LIMITS.maxCompressionRatio
    )
      errors.push(`Suspicious compression ratio: ${normalized}.`);
  });

  if (compressedTotal > ADDON_PACKAGE_LIMITS.maxCompressedBytes)
    errors.push('Compressed package is too large.');
  if (uncompressedTotal > ADDON_PACKAGE_LIMITS.maxUncompressedBytes)
    errors.push('Uncompressed package is too large.');
  if (!normalizedPaths.includes('manifest.json'))
    errors.push('Package must contain manifest.json at its root.');

  return errors.length > 0
    ? { ok: false, errors }
    : { ok: true, normalizedPaths };
}

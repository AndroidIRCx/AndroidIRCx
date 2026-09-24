/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import type { AddonManifest } from './AddonManifest';
import { normalizeAddonPath } from './AddonPathPolicy';

/**
 * Read-only access to files shipped inside an installed package.
 *
 * Two rules, both of which exist because the package is immutable and signed:
 * an asset must be **declared in the manifest**, so what a package carries is
 * visible at install review rather than discovered later; and reading is by
 * name only, with no way to enumerate or reach anything the manifest did not
 * list. Nothing here can execute: assets come back as text or bytes.
 */

export const MAX_ASSET_BYTES = 2 * 1024 * 1024;

export type AssetFailure =
  'not-declared' | 'not-found' | 'too-large' | 'bad-path' | 'not-text';

export interface AssetResult<T> {
  ok: boolean;
  value?: T;
  reason?: AssetFailure;
}

export class AddonAssetReader {
  /** The assets this package declares, in manifest order. */
  list(manifest: AddonManifest): string[] {
    return [...(manifest.assets ?? [])];
  }

  readBytes(
    manifest: AddonManifest,
    files: ReadonlyMap<string, Uint8Array>,
    path: string,
  ): AssetResult<Uint8Array> {
    const checked = normalizeAddonPath(path);
    if (!checked.ok) return { ok: false, reason: 'bad-path' };

    // Declared, not merely present. A package that ships a file it did not
    // list has not had that file reviewed, and install review is where the
    // user decides what a package is allowed to carry.
    if (!(manifest.assets ?? []).includes(checked.path!))
      return { ok: false, reason: 'not-declared' };

    const bytes = files.get(checked.path!);
    if (!bytes) return { ok: false, reason: 'not-found' };
    if (bytes.length > MAX_ASSET_BYTES)
      return { ok: false, reason: 'too-large' };
    // Copied, so an addon cannot write through the returned view into the
    // verified package bytes the checksum was computed over.
    return { ok: true, value: bytes.slice() };
  }

  readText(
    manifest: AddonManifest,
    files: ReadonlyMap<string, Uint8Array>,
    path: string,
  ): AssetResult<string> {
    const bytes = this.readBytes(manifest, files, path);
    if (!bytes.ok) return { ok: false, reason: bytes.reason };
    try {
      const text = decodeUtf8(bytes.value!);
      // A binary asset read as text produces replacement characters rather
      // than an error, which an addon then writes somewhere and cannot explain.
      if (text.includes('�')) return { ok: false, reason: 'not-text' };
      return { ok: true, value: text };
    } catch {
      return { ok: false, reason: 'not-text' };
    }
  }

  /**
   * Whether every declared asset is actually present in the package.
   *
   * Run at install and update: a manifest promising a file the archive does not
   * contain is a broken package, and finding out at install beats finding out
   * the first time the addon needs it.
   */
  verify(
    manifest: AddonManifest,
    files: ReadonlyMap<string, Uint8Array>,
  ): { ok: boolean; missing: string[]; oversized: string[] } {
    const missing: string[] = [];
    const oversized: string[] = [];
    for (const asset of manifest.assets ?? []) {
      const bytes = files.get(asset);
      if (!bytes) missing.push(asset);
      else if (bytes.length > MAX_ASSET_BYTES) oversized.push(asset);
    }
    return {
      ok: missing.length === 0 && oversized.length === 0,
      missing,
      oversized,
    };
  }
}

function decodeUtf8(bytes: Uint8Array): string {
  if (typeof TextDecoder === 'function')
    return new TextDecoder('utf-8').decode(bytes);
  let out = '';
  for (const byte of bytes) out += String.fromCharCode(byte);
  return out;
}

export const addonAssetReader = new AddonAssetReader();

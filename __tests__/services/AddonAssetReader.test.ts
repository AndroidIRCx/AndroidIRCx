/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import {
  AddonAssetReader,
  MAX_ASSET_BYTES,
} from '../../src/services/scripting/AddonAssetReader';
import type { AddonManifest } from '../../src/services/scripting/AddonManifest';

const manifest = (assets?: string[]) =>
  ({ id: 'a.addon', assets }) as unknown as AddonManifest;

const encode = (text: string) => new TextEncoder().encode(text);

describe('AddonAssetReader', () => {
  const reader = new AddonAssetReader();

  const files = new Map<string, Uint8Array>([
    ['data/words.txt', encode('hello')],
    ['data/undeclared.txt', encode('sneaky')],
    ['data/binary.bin', new Uint8Array([0xff, 0xfe, 0x00, 0x01])],
  ]);

  describe('reading', () => {
    it('reads a declared asset as text and bytes', () => {
      const m = manifest(['data/words.txt']);
      expect(reader.readText(m, files, 'data/words.txt')).toEqual({
        ok: true,
        value: 'hello',
      });
      expect(reader.readBytes(m, files, 'data/words.txt').value).toEqual(
        encode('hello'),
      );
    });

    it('refuses a file the manifest did not declare, even though it is there', () => {
      // Install review is where the user decides what a package may carry.
      expect(
        reader.readText(
          manifest(['data/words.txt']),
          files,
          'data/undeclared.txt',
        ),
      ).toEqual({ ok: false, reason: 'not-declared' });
    });

    it('refuses a declared asset missing from the package', () => {
      expect(
        reader.readText(manifest(['data/gone.txt']), files, 'data/gone.txt')
          .reason,
      ).toBe('not-found');
    });

    it('refuses a path the policy rejects before looking anything up', () => {
      const m = manifest(['data/words.txt']);
      expect(reader.readBytes(m, files, '../../etc/passwd').reason).toBe(
        'bad-path',
      );
      expect(reader.readBytes(m, files, '/etc/passwd').reason).toBe('bad-path');
    });

    it('refuses binary data read as text rather than returning mojibake', () => {
      // Replacement characters get written somewhere and cannot be explained.
      expect(
        reader.readText(manifest(['data/binary.bin']), files, 'data/binary.bin')
          .reason,
      ).toBe('not-text');
      // The same asset is fine as bytes.
      expect(
        reader.readBytes(
          manifest(['data/binary.bin']),
          files,
          'data/binary.bin',
        ).ok,
      ).toBe(true);
    });

    it('refuses an oversized asset', () => {
      const big = new Map([['big.bin', new Uint8Array(MAX_ASSET_BYTES + 1)]]);
      expect(
        reader.readBytes(manifest(['big.bin']), big, 'big.bin').reason,
      ).toBe('too-large');
    });

    it('returns a copy, so an addon cannot write into the verified package', () => {
      const m = manifest(['data/words.txt']);
      const first = reader.readBytes(m, files, 'data/words.txt').value!;
      first[0] = 0;
      expect(reader.readBytes(m, files, 'data/words.txt').value![0]).toBe(
        encode('hello')[0],
      );
    });

    it('handles a package that declares no assets at all', () => {
      expect(reader.list(manifest())).toEqual([]);
      expect(reader.readText(manifest(), files, 'data/words.txt').reason).toBe(
        'not-declared',
      );
    });
  });

  describe('verify', () => {
    it('passes when every declared asset is present and within size', () => {
      expect(reader.verify(manifest(['data/words.txt']), files)).toEqual({
        ok: true,
        missing: [],
        oversized: [],
      });
    });

    it('names what is missing or oversized', () => {
      // A manifest promising a file the archive lacks is a broken package, and
      // install is a better place to find out than first use.
      const big = new Map(files);
      big.set('big.bin', new Uint8Array(MAX_ASSET_BYTES + 1));

      expect(
        reader.verify(manifest(['data/gone.txt', 'big.bin']), big),
      ).toEqual({
        ok: false,
        missing: ['data/gone.txt'],
        oversized: ['big.bin'],
      });
    });
  });
});

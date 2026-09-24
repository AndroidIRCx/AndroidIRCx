/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import {
  checkArchive,
  formatCsv,
  formatIni,
  formatLines,
  MAX_ARCHIVE_ENTRIES,
  MAX_ARCHIVE_UNPACKED_BYTES,
  MAX_COMPRESSION_RATIO,
  parseCsv,
  parseIni,
  parseJson,
  parseLines,
} from '../../src/services/scripting/AddonFileFormats';
import { isSafeArchiveEntry } from '../../src/services/scripting/AddonPathPolicy';

describe('AddonFileFormats', () => {
  describe('lines', () => {
    it('splits on every newline convention', () => {
      expect(parseLines('a\nb\r\nc\rd')).toEqual(['a', 'b', 'c', 'd']);
    });

    it('drops only the empty element a trailing newline creates', () => {
      expect(parseLines('a\nb\n')).toEqual(['a', 'b']);
      // A blank line in the middle is real data.
      expect(parseLines('a\n\nb\n')).toEqual(['a', '', 'b']);
    });

    it('handles empty and non-string input', () => {
      expect(parseLines('')).toEqual([]);
      expect(parseLines(null as any)).toEqual([]);
    });

    it('round-trips through formatLines', () => {
      expect(formatLines(['a', 'b'])).toBe('a\nb\n');
      expect(formatLines([])).toBe('');
      expect(parseLines(formatLines(['a', '', 'b']))).toEqual(['a', '', 'b']);
    });
  });

  describe('JSON', () => {
    it('reports a parse failure instead of throwing', () => {
      expect(parseJson('{"a":1}')).toEqual({ ok: true, value: { a: 1 } });
      const bad = parseJson('{oops');
      expect(bad.ok).toBe(false);
      expect(bad.error).toBeTruthy();
    });
  });

  describe('CSV', () => {
    it('parses a plain file', () => {
      expect(parseCsv('a,b\n1,2')).toEqual([
        ['a', 'b'],
        ['1', '2'],
      ]);
    });

    it('respects quoted fields containing commas, quotes and newlines', () => {
      // Splitting on commas is wrong for any file that has been through a
      // spreadsheet, which is most of them.
      expect(parseCsv('"a,b",c')).toEqual([['a,b', 'c']]);
      expect(parseCsv('"say ""hi""",c')).toEqual([['say "hi"', 'c']]);
      expect(parseCsv('"line1\nline2",c')).toEqual([['line1\nline2', 'c']]);
    });

    it('handles CRLF and a trailing newline', () => {
      expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([
        ['a', 'b'],
        ['1', '2'],
      ]);
    });

    it('keeps empty fields', () => {
      expect(parseCsv('a,,c')).toEqual([['a', '', 'c']]);
      expect(parseCsv(',')).toEqual([['', '']]);
    });

    it('returns nothing for empty input', () => {
      expect(parseCsv('')).toEqual([]);
      expect(parseCsv(null as any)).toEqual([]);
    });

    it('quotes on output only when it has to', () => {
      // So a plain file stays readable.
      expect(formatCsv([['a', 'b']])).toBe('a,b');
      expect(formatCsv([['a,b', 'c']])).toBe('"a,b",c');
      expect(formatCsv([['say "hi"']])).toBe('"say ""hi"""');
    });

    it('round-trips the awkward cases', () => {
      const rows = [
        ['plain', 'with,comma'],
        ['with"quote', 'with\nnewline'],
      ];
      expect(parseCsv(formatCsv(rows))).toEqual(rows);
    });
  });

  describe('INI', () => {
    it('parses sections and keys', () => {
      expect(parseIni('[a]\nx=1\ny=2\n\n[b]\nz=3')).toEqual({
        a: { x: '1', y: '2' },
        b: { z: '3' },
      });
    });

    it('puts keys before any section in the empty section', () => {
      // Which is what mIRC's $readini does with them.
      expect(parseIni('loose=1\n[a]\nx=2')).toEqual({
        '': { loose: '1' },
        a: { x: '2' },
      });
    });

    it('omits the empty section when nothing is in it', () => {
      expect(parseIni('[a]\nx=1')).not.toHaveProperty('');
    });

    it('splits on the first = only, so a value may contain one', () => {
      expect(parseIni('[a]\nurl=https://x/?q=1').a.url).toBe('https://x/?q=1');
    });

    it('ignores comments, blank lines and lines with no =', () => {
      expect(parseIni('; comment\n# also\n\n[a]\njunk\nx=1')).toEqual({
        a: { x: '1' },
      });
    });

    it('never throws on malformed input', () => {
      // A user edits these by hand; a parser that throws crashes the addon.
      expect(() => parseIni('[unclosed\n=novalue\n[]\n')).not.toThrow();
      expect(parseIni('')).toEqual({});
    });

    it('round-trips through formatIni', () => {
      const data = { '': { loose: '1' }, a: { x: '1' }, b: { y: '2' } };
      expect(parseIni(formatIni(data))).toEqual(data);
    });
  });

  describe('checkArchive', () => {
    const entry = (over = {}) => ({
      name: 'data/file.txt',
      compressedSize: 100,
      uncompressedSize: 200,
      ...over,
    });

    it('accepts an ordinary archive', () => {
      expect(checkArchive([entry()], isSafeArchiveEntry)).toEqual({ ok: true });
    });

    it('refuses an unsafe entry name and says which', () => {
      // Checked with the same policy the workspace uses, so zip-slip cannot be
      // prevented in one place and forgotten in the other.
      const result = checkArchive(
        [entry(), entry({ name: '../../etc/passwd' })],
        isSafeArchiveEntry,
      );
      expect(result).toEqual({
        ok: false,
        reason: 'unsafe-entry-name',
        entry: '../../etc/passwd',
      });
    });

    it('refuses too many entries', () => {
      const many = Array.from({ length: MAX_ARCHIVE_ENTRIES + 1 }, (_v, i) =>
        entry({ name: `f${i}.txt` }),
      );
      expect(checkArchive(many, isSafeArchiveEntry).reason).toBe(
        'too-many-entries',
      );
    });

    it('refuses an archive that unpacks larger than the cap', () => {
      const result = checkArchive(
        [
          entry({
            compressedSize: MAX_ARCHIVE_UNPACKED_BYTES,
            uncompressedSize: MAX_ARCHIVE_UNPACKED_BYTES + 1,
          }),
        ],
        isSafeArchiveEntry,
      );
      expect(result.reason).toBe('unpacked-too-large');
    });

    it('refuses a decompression bomb by ratio', () => {
      // A few kilobytes expanding to gigabytes fills the device before any
      // per-file limit notices.
      const result = checkArchive(
        [
          entry({
            compressedSize: 1000,
            uncompressedSize: 1000 * MAX_COMPRESSION_RATIO + 1,
          }),
        ],
        isSafeArchiveEntry,
      );
      expect(result.reason).toBe('compression-bomb');
    });

    it('does not divide by zero on an empty archive', () => {
      expect(checkArchive([], isSafeArchiveEntry)).toEqual({ ok: true });
      expect(
        checkArchive(
          [entry({ compressedSize: 0, uncompressedSize: 0 })],
          isSafeArchiveEntry,
        ),
      ).toEqual({ ok: true });
    });
  });
});

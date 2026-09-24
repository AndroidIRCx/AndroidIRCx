/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import {
  isSafeArchiveEntry,
  MAX_PATH_CHARS,
  MAX_PATH_DEPTH,
  MAX_SEGMENT_CHARS,
  normalizeAddonPath,
  resolveWithinRoot,
} from '../../src/services/scripting/AddonPathPolicy';

describe('AddonPathPolicy', () => {
  describe('paths it accepts', () => {
    it.each([
      ['a plain file', 'notes.txt', 'notes.txt'],
      ['a nested file', 'logs/2026/today.txt', 'logs/2026/today.txt'],
      ['a redundant separator', 'logs//today.txt', 'logs/today.txt'],
      ['a trailing separator', 'logs/', 'logs'],
      ['a dot inside a name', 'my.notes.txt', 'my.notes.txt'],
      ['a leading dot file', '.config', '.config'],
      ['unicode', 'beleške/čitaj.txt', 'beleške/čitaj.txt'],
    ])('accepts %s', (_label, input, expected) => {
      expect(normalizeAddonPath(input)).toEqual({ ok: true, path: expected });
    });
  });

  describe('traversal', () => {
    it.each(['../secrets', 'a/../../b', 'a/..', '..', './a', 'a/./b'])(
      'refuses %s',
      input => {
        // `.` and `..` are refused outright rather than resolved: resolving means
        // deciding what `a/../../b` means, and no addon needed to write it.
        expect(normalizeAddonPath(input).reason).toBe('traversal');
      },
    );

    it('is not fooled by a name that merely contains dots', () => {
      expect(normalizeAddonPath('..hidden').ok).toBe(true);
      expect(normalizeAddonPath('a..b').ok).toBe(true);
    });
  });

  describe('absolute paths', () => {
    it.each(['/etc/passwd', '/data/data/com.androidircx/x', '///'])(
      'refuses %s',
      input => expect(normalizeAddonPath(input).reason).toBe('absolute'),
    );

    it('refuses a Windows drive path through the colon rule', () => {
      // Not a separate rule: a colon is illegal in any segment, so this is
      // already covered without two checks that could disagree.
      expect(normalizeAddonPath('C:/Windows').reason).toBe('illegal-character');
      expect(normalizeAddonPath('C:').reason).toBe('illegal-character');
    });
  });

  describe('illegal characters', () => {
    it('refuses a backslash rather than translating it', () => {
      // On Android a backslash is a legal filename character, so translating
      // would make `a\..\b` mean one thing here and another on a desktop.
      expect(normalizeAddonPath('a\\..\\b').reason).toBe('illegal-character');
      expect(normalizeAddonPath('a\\b').reason).toBe('illegal-character');
    });

    it('refuses NUL and control characters', () => {
      expect(normalizeAddonPath('a\0b').reason).toBe('illegal-character');
      expect(normalizeAddonPath('a\nb').reason).toBe('illegal-character');
      expect(normalizeAddonPath('a\tb').reason).toBe('illegal-character');
    });

    it('refuses characters that break on other platforms', () => {
      for (const bad of ['a<b', 'a>b', 'a:b', 'a"b', 'a|b', 'a?b', 'a*b'])
        expect(normalizeAddonPath(bad).reason).toBe('illegal-character');
    });

    it('refuses a trailing dot or space, which Windows silently strips', () => {
      // Two different names would otherwise become one file.
      expect(normalizeAddonPath('notes.').reason).toBe('illegal-character');
      expect(normalizeAddonPath('notes ').reason).toBe('illegal-character');
      expect(normalizeAddonPath('dir./file').reason).toBe('illegal-character');
    });

    it('refuses a reserved device name', () => {
      expect(normalizeAddonPath('con').reason).toBe('reserved-name');
      expect(normalizeAddonPath('NUL.txt').reason).toBe('reserved-name');
      expect(normalizeAddonPath('logs/com1.log').reason).toBe('reserved-name');
      expect(normalizeAddonPath('control.txt').ok).toBe(true);
    });
  });

  describe('bounds', () => {
    it('refuses an empty path', () => {
      expect(normalizeAddonPath('').reason).toBe('empty');
      expect(normalizeAddonPath('   ').reason).toBe('empty');
      expect(normalizeAddonPath(null).reason).toBe('empty');
      expect(normalizeAddonPath(42).reason).toBe('empty');
    });

    it('refuses an over-long path, segment or depth', () => {
      expect(normalizeAddonPath('a'.repeat(MAX_PATH_CHARS + 1)).reason).toBe(
        'too-long',
      );
      expect(
        normalizeAddonPath(`dir/${'a'.repeat(MAX_SEGMENT_CHARS + 1)}`).reason,
      ).toBe('segment-too-long');
      expect(
        normalizeAddonPath(
          Array.from({ length: MAX_PATH_DEPTH + 1 }, () => 'd').join('/'),
        ).reason,
      ).toBe('too-deep');
    });
  });

  describe('resolveWithinRoot', () => {
    it('joins a safe path onto the root', () => {
      expect(resolveWithinRoot('/root/addon', 'logs/a.txt')).toEqual({
        ok: true,
        absolute: '/root/addon/logs/a.txt',
      });
    });

    it('handles a root that already ends in a separator', () => {
      expect(resolveWithinRoot('/root/addon/', 'a.txt').absolute).toBe(
        '/root/addon/a.txt',
      );
    });

    it('refuses anything the path policy refuses', () => {
      expect(resolveWithinRoot('/root', '../escape')).toEqual({
        ok: false,
        reason: 'traversal',
      });
      expect(resolveWithinRoot('/root', '/etc/passwd').reason).toBe('absolute');
    });

    it('never produces a path outside the root', () => {
      // Belt and braces: this is the value handed to the filesystem, and a bug
      // here has consequences a bug in a validator does not.
      for (const attempt of [
        '../../etc/passwd',
        'a/../../../etc/passwd',
        '..%2f..%2fetc',
        'a\\..\\..\\etc',
      ]) {
        const result = resolveWithinRoot('/root/addon', attempt);
        if (result.ok)
          expect(result.absolute!.startsWith('/root/addon/')).toBe(true);
      }
    });
  });

  describe('isSafeArchiveEntry', () => {
    it('accepts an ordinary entry', () => {
      expect(isSafeArchiveEntry('data/notes.txt')).toBe(true);
    });

    it('refuses the classic zip-slip entries', () => {
      expect(isSafeArchiveEntry('../../../../etc/passwd')).toBe(false);
      expect(isSafeArchiveEntry('/etc/passwd')).toBe(false);
      expect(isSafeArchiveEntry('..\\..\\windows\\system32')).toBe(false);
    });

    it('refuses a directory entry so the caller can skip it', () => {
      expect(isSafeArchiveEntry('data/')).toBe(false);
    });

    it('refuses a non-string', () => {
      expect(isSafeArchiveEntry(undefined)).toBe(false);
      expect(isSafeArchiveEntry(7)).toBe(false);
    });
  });
});

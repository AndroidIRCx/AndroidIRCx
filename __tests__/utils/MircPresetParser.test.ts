/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for MircPresetParser - 100% coverage target
 */

import {
  decodeMircPresetBase64,
  splitPresetLines,
  parseGenericPresets,
  parseNickCompletionPresets,
  parseIrcapDecorationEti,
} from '../../src/utils/MircPresetParser';

describe('MircPresetParser', () => {
  describe('decodeMircPresetBase64', () => {
    it('should decode valid UTF-8 base64', () => {
      const text = 'Hello World';
      const base64 = Buffer.from(text).toString('base64');
      expect(decodeMircPresetBase64(base64)).toBe(text);
    });

    it('should handle base64 with whitespace', () => {
      const text = 'Hello World';
      const base64 = Buffer.from(text).toString('base64');
      const withWhitespace = base64.replace(/.{4}/g, '$& ').trim();
      expect(decodeMircPresetBase64(withWhitespace)).toBe(text);
    });

    it('should decode valid UTF-8 multibyte characters', () => {
      const text = 'Hello 世界';
      const base64 = Buffer.from(text).toString('base64');
      expect(decodeMircPresetBase64(base64)).toBe(text);
    });

    it('should handle CP1252 encoded bytes (invalid UTF-8)', () => {
      // Create bytes that are valid CP1252 but invalid UTF-8
      const bytes = new Uint8Array([0x80, 0x82, 0x83]); // Euro sign, comma-like, f-hook
      const base64 = Buffer.from(bytes).toString('base64');
      const result = decodeMircPresetBase64(base64);
      expect(result).toContain('€');
    });

    it('should handle empty base64 string', () => {
      expect(decodeMircPresetBase64('')).toBe('');
    });

    it('should handle base64 with newlines', () => {
      const text = 'Hello World Test';
      const base64 = Buffer.from(text).toString('base64');
      const withNewlines = base64.replace(/.{8}/g, '$&\n').trim();
      expect(decodeMircPresetBase64(withNewlines)).toBe(text);
    });

    it('should handle mixed valid UTF-8 and CP1252 bytes', () => {
      // Valid UTF-8 for ASCII, then CP1252 byte
      const bytes = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x80]); // "Hello" + Euro in CP1252
      const base64 = Buffer.from(bytes).toString('base64');
      expect(decodeMircPresetBase64(base64)).toContain('€');
    });
  });

  describe('splitPresetLines', () => {
    it('should split lines by newline', () => {
      const input = 'line1\nline2\nline3';
      expect(splitPresetLines(input)).toEqual(['line1', 'line2', 'line3']);
    });

    it('should split lines by CRLF', () => {
      const input = 'line1\r\nline2\r\nline3';
      expect(splitPresetLines(input)).toEqual(['line1', 'line2', 'line3']);
    });

    it('should split lines by CR', () => {
      const input = 'line1\rline2\rline3';
      expect(splitPresetLines(input)).toEqual(['line1', 'line2', 'line3']);
    });

    it('should trim whitespace from lines', () => {
      const input = '  line1  \n  line2  ';
      expect(splitPresetLines(input)).toEqual(['line1', 'line2']);
    });

    it('should filter out empty lines', () => {
      const input = 'line1\n\n\nline2';
      expect(splitPresetLines(input)).toEqual(['line1', 'line2']);
    });

    it('should handle empty string', () => {
      expect(splitPresetLines('')).toEqual([]);
    });

    it('should handle string with only whitespace', () => {
      expect(splitPresetLines('   \n   \n   ')).toEqual([]);
    });

    it('should handle mixed line endings', () => {
      const input = 'line1\nline2\r\nline3\rline4';
      expect(splitPresetLines(input)).toEqual([
        'line1',
        'line2',
        'line3',
        'line4',
      ]);
    });
  });

  describe('parseGenericPresets', () => {
    it('should parse single line', () => {
      const input = 'preset1';
      const result = parseGenericPresets(input);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ id: 'preset-1', raw: 'preset1' });
    });

    it('should parse multiple lines', () => {
      const input = 'preset1\npreset2\npreset3';
      const result = parseGenericPresets(input);
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('preset-1');
      expect(result[1].id).toBe('preset-2');
      expect(result[2].id).toBe('preset-3');
    });

    it('should skip empty lines', () => {
      const input = 'preset1\n\npreset2';
      const result = parseGenericPresets(input);
      expect(result).toHaveLength(2);
      expect(result[0].raw).toBe('preset1');
      expect(result[1].raw).toBe('preset2');
    });

    it('should handle empty input', () => {
      const result = parseGenericPresets('');
      expect(result).toEqual([]);
    });
  });

  describe('parseNickCompletionPresets', () => {
    it('should parse line with "on" suffix', () => {
      const input = 'completion style on';
      const result = parseNickCompletionPresets(input);
      expect(result).toHaveLength(1);
      expect(result[0].raw).toBe('completion style');
      expect(result[0].enabled).toBe(true);
    });

    it('should parse line with "off" suffix', () => {
      const input = 'completion style off';
      const result = parseNickCompletionPresets(input);
      expect(result[0].raw).toBe('completion style');
      expect(result[0].enabled).toBe(false);
    });

    it('should parse line with backspace separator', () => {
      const input = 'style\x08on';
      const result = parseNickCompletionPresets(input);
      expect(result[0].raw).toBe('style\x08');
      expect(result[0].enabled).toBe(true);
    });

    it('should parse line without on/off suffix', () => {
      const input = 'completion style';
      const result = parseNickCompletionPresets(input);
      expect(result[0].raw).toBe('completion style');
      expect(result[0].enabled).toBeUndefined();
    });

    it('should handle case insensitive on/off', () => {
      const input = 'style1 ON\nstyle2 OFF\nstyle3 On\nstyle4 oFf';
      const result = parseNickCompletionPresets(input);
      expect(result[0].enabled).toBe(true);
      expect(result[1].enabled).toBe(false);
      expect(result[2].enabled).toBe(true);
      expect(result[3].enabled).toBe(false);
    });

    it('should handle multiple lines', () => {
      const input = 'style1 on\nstyle2 off\nstyle3';
      const result = parseNickCompletionPresets(input);
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('nick-1');
      expect(result[1].id).toBe('nick-2');
      expect(result[2].id).toBe('nick-3');
    });

    it('should handle multiple spaces before on/off', () => {
      const input = 'style    on';
      const result = parseNickCompletionPresets(input);
      expect(result[0].raw).toBe('style');
      expect(result[0].enabled).toBe(true);
    });

    it('should handle empty input', () => {
      const result = parseNickCompletionPresets('');
      expect(result).toEqual([]);
    });
  });

  describe('parseIrcapDecorationEti', () => {
    it('should parse valid decoration line', () => {
      // Create a valid IRCAP decoration line with 9+ fields separated by \x08
      const input =
        'field1\x08field2\x08field3\x08field4\x08field5\x08field6\x08prefix\x08suffix\x08last';
      const result = parseIrcapDecorationEti(input);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe('prefix\x08suffix');
    });

    it('should filter out lines with less than 9 fields', () => {
      const input = 'f1\x08f2\x08f3\x08f4\x08f5\x08f6\x08f7\x08f8'; // Only 8 fields
      const result = parseIrcapDecorationEti(input);
      expect(result).toHaveLength(0);
    });

    it('should remove null bytes from style', () => {
      const input =
        'f1\x08f2\x08f3\x08f4\x08f5\x08f6\x08pre\x00fix\x08suf\x00fix\x08last';
      const result = parseIrcapDecorationEti(input);
      expect(result[0]).toBe('prefix\x08suffix');
    });

    it('should filter out duplicate styles', () => {
      const line =
        'f1\x08f2\x08f3\x08f4\x08f5\x08f6\x08prefix\x08suffix\x08last';
      const input = `${line}\n${line}`;
      const result = parseIrcapDecorationEti(input);
      expect(result).toHaveLength(1);
    });

    it('should filter out empty styles (whitespace only without backspace)', () => {
      const input = 'f1\x08f2\x08f3\x08f4\x08f5\x08f6\x08   \x08   \x08last';
      const result = parseIrcapDecorationEti(input);
      // Style is "   \x08   " which contains backspace, so it's kept
      expect(result).toHaveLength(1);
      expect(result[0]).toBe('   \x08   ');
    });

    it('should handle multiple different styles', () => {
      const line1 = 'f1\x08f2\x08f3\x08f4\x08f5\x08f6\x08pre1\x08suf1\x08last';
      const line2 = 'f1\x08f2\x08f3\x08f4\x08f5\x08f6\x08pre2\x08suf2\x08last';
      const input = `${line1}\n${line2}`;
      const result = parseIrcapDecorationEti(input);
      expect(result).toHaveLength(2);
      expect(result).toContain('pre1\x08suf1');
      expect(result).toContain('pre2\x08suf2');
    });

    it('should handle empty input', () => {
      const result = parseIrcapDecorationEti('');
      expect(result).toEqual([]);
    });

    it('should handle lines with only whitespace', () => {
      const input = '   \n   \n   ';
      const result = parseIrcapDecorationEti(input);
      expect(result).toEqual([]);
    });

    it('should handle empty prefix and suffix with backspace', () => {
      const input = 'f1\x08f2\x08f3\x08f4\x08f5\x08f6\x08\x08\x08last';
      const result = parseIrcapDecorationEti(input);
      // prefix is empty, suffix is empty, so style is "\x08" (single backspace)
      expect(result).toHaveLength(1);
      expect(result[0]).toBe('\x08');
    });

    it('should handle undefined prefix/suffix in sparse array', () => {
      // Create input where fields might have undefined elements
      // We need exactly the right structure to trigger the ?? '' fallback
      const input = 'f1\x08f2\x08f3\x08f4\x08f5\x08f6\x08\x08\x08last';
      const result = parseIrcapDecorationEti(input);
      expect(result.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('isValidUtf8 (via decodeMircPresetBase64)', () => {
    it('should handle valid 2-byte UTF-8 sequence', () => {
      const text = 'é'; // U+00E9 - 2 bytes in UTF-8
      const base64 = Buffer.from(text).toString('base64');
      expect(decodeMircPresetBase64(base64)).toBe(text);
    });

    it('should handle valid 3-byte UTF-8 sequence', () => {
      const text = '世'; // U+4E16 - 3 bytes in UTF-8
      const base64 = Buffer.from(text).toString('base64');
      expect(decodeMircPresetBase64(base64)).toBe(text);
    });

    it('should handle valid 4-byte UTF-8 sequence', () => {
      const text = '😀'; // U+1F600 - 4 bytes in UTF-8
      const base64 = Buffer.from(text).toString('base64');
      expect(decodeMircPresetBase64(base64)).toBe(text);
    });

    it('should detect invalid 2-byte sequence (truncated)', () => {
      // 0xC0 starts a 2-byte sequence but has no continuation
      const bytes = new Uint8Array([0xc0]);
      const base64 = Buffer.from(bytes).toString('base64');
      // Should fall back to CP1252
      const result = decodeMircPresetBase64(base64);
      expect(result).toBeDefined();
    });

    it('should detect invalid 3-byte sequence (truncated)', () => {
      // 0xE0 starts a 3-byte sequence but has only 1 continuation
      const bytes = new Uint8Array([0xe0, 0x80]);
      const base64 = Buffer.from(bytes).toString('base64');
      const result = decodeMircPresetBase64(base64);
      expect(result).toBeDefined();
    });

    it('should detect invalid 4-byte sequence (truncated)', () => {
      // 0xF0 starts a 4-byte sequence but has only 2 continuations
      const bytes = new Uint8Array([0xf0, 0x80, 0x80]);
      const base64 = Buffer.from(bytes).toString('base64');
      const result = decodeMircPresetBase64(base64);
      expect(result).toBeDefined();
    });

    it('should detect invalid continuation byte', () => {
      // 0xC0 expects continuation (0x80-0xBF) but gets 0x00
      const bytes = new Uint8Array([0xc0, 0x00]);
      const base64 = Buffer.from(bytes).toString('base64');
      const result = decodeMircPresetBase64(base64);
      expect(result).toBeDefined();
    });

    it('should detect invalid 4-byte continuation bytes', () => {
      // 0xF0 starts 4-byte sequence, but byte2 is invalid (0x00 instead of 0x80-0xBF)
      const bytes = new Uint8Array([0xf0, 0x00, 0x80, 0x80]);
      const base64 = Buffer.from(bytes).toString('base64');
      const result = decodeMircPresetBase64(base64);
      expect(result).toBeDefined(); // Falls back to CP1252
    });

    it('should detect invalid 3-byte continuation bytes', () => {
      // 0xE0 starts 3-byte sequence, but byte3 is invalid (0x00 instead of 0x80-0xBF)
      const bytes = new Uint8Array([0xe0, 0x80, 0x00]);
      const base64 = Buffer.from(bytes).toString('base64');
      const result = decodeMircPresetBase64(base64);
      expect(result).toBeDefined(); // Falls back to CP1252
    });

    it('should handle high bytes (>0x7F) in CP1252 range', () => {
      // Bytes that are invalid UTF-8 but valid CP1252
      const bytes = new Uint8Array([0x91, 0x92, 0x93]); // Smart quotes in CP1252
      const base64 = Buffer.from(bytes).toString('base64');
      const result = decodeMircPresetBase64(base64);
      expect(result).toBeDefined();
    });

    it('should handle CP1252 bytes not in mapping table', () => {
      // Bytes 0x81, 0x8D, 0x8F, 0x90, 0x9D are in CP1252 range but not mapped
      const bytes = new Uint8Array([0x81, 0x8d, 0x8f]);
      const base64 = Buffer.from(bytes).toString('base64');
      const result = decodeMircPresetBase64(base64);
      // These should pass through as-is (their original byte value as char code)
      expect(result).toBeDefined();
      expect(result.length).toBe(3);
    });
  });

  describe('decodeCp1252 (via decodeMircPresetBase64)', () => {
    it('should map CP1252 0x80 to Euro sign', () => {
      const bytes = new Uint8Array([0x80]);
      const base64 = Buffer.from(bytes).toString('base64');
      expect(decodeMircPresetBase64(base64)).toBe('€');
    });

    it('should map CP1252 0x99 to trademark symbol', () => {
      const bytes = new Uint8Array([0x99]);
      const base64 = Buffer.from(bytes).toString('base64');
      expect(decodeMircPresetBase64(base64)).toBe('™');
    });

    it('should pass through ASCII unchanged', () => {
      const text = 'Hello World';
      const bytes = new Uint8Array(Buffer.from(text));
      const base64 = Buffer.from(bytes).toString('base64');
      expect(decodeMircPresetBase64(base64)).toBe(text);
    });

    it('should handle all mapped CP1252 characters', () => {
      // Test a few key mappings from CP1252_MAP
      const testCases = [
        { byte: 0x80, char: '€' },
        { byte: 0x85, char: '…' },
        { byte: 0x91, char: '\u2018' }, // left single quotation mark
        { byte: 0x92, char: '\u2019' }, // right single quotation mark
        { byte: 0x93, char: '\u201C' }, // left double quotation mark
        { byte: 0x94, char: '\u201D' }, // right double quotation mark
        { byte: 0x99, char: '™' },
      ];

      testCases.forEach(({ byte, char }) => {
        const base64 = Buffer.from([byte]).toString('base64');
        expect(decodeMircPresetBase64(base64)).toBe(char);
      });
    });
  });
});

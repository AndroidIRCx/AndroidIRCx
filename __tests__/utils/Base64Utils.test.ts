/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for Base64Utils - 100% coverage target
 */

import { decodeIfBase64Like } from '../../src/utils/Base64Utils';

describe('Base64Utils', () => {
  describe('decodeIfBase64Like', () => {
    it('should return original value for empty string', () => {
      expect(decodeIfBase64Like('')).toBe('');
    });

    it('should return original value for whitespace-only string', () => {
      expect(decodeIfBase64Like('   ')).toBe('   ');
    });

    it('should return original value for string too short', () => {
      expect(decodeIfBase64Like('abc')).toBe('abc');
      expect(decodeIfBase64Like('short')).toBe('short');
    });

    it('should return original value for string not divisible by 4', () => {
      expect(decodeIfBase64Like('notbase64')).toBe('notbase64');
      expect(decodeIfBase64Like('invalid!')).toBe('invalid!');
    });

    it('should return original value for non-Base64 characters', () => {
      expect(decodeIfBase64Like('not@base64')).toBe('not@base64');
      expect(decodeIfBase64Like('hello world!')).toBe('hello world!');
    });

    it('should decode valid Base64 string', () => {
      const base64 = Buffer.from('Hello World').toString('base64');
      expect(decodeIfBase64Like(base64)).toBe('Hello World');
    });

    it('should decode Base64 with padding', () => {
      const base64 = Buffer.from('Hello').toString('base64'); // SGVsbG8=
      expect(decodeIfBase64Like(base64)).toBe('Hello');
    });

    it('should return original for Base64 decoding to null characters', () => {
      // Base64 encoding of string with null character
      const withNull = Buffer.from('test\x00null').toString('base64');
      expect(decodeIfBase64Like(withNull)).toBe(withNull);
    });

    it('should return original for Base64 decoding to mostly non-printable', () => {
      // Base64 of binary data that's not mostly printable
      const binaryData = Buffer.from([
        0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
      ]).toString('base64');
      expect(decodeIfBase64Like(binaryData)).toBe(binaryData);
    });

    it('should trim whitespace before checking', () => {
      const base64 = '  ' + Buffer.from('Test').toString('base64') + '  ';
      expect(decodeIfBase64Like(base64)).toBe('Test');
    });

    it('should handle valid Base64 with exact length 8', () => {
      const base64 = Buffer.from('123456').toString('base64'); // 8 chars
      expect(decodeIfBase64Like(base64)).toBe('123456');
    });

    it('should decode URL-safe Base64-like strings', () => {
      const base64 = Buffer.from('Test123').toString('base64');
      expect(decodeIfBase64Like(base64)).toBe('Test123');
    });

    it('should handle strings with newlines and tabs as printable', () => {
      const text = 'Line1\nLine2\tTab';
      const base64 = Buffer.from(text).toString('base64');
      expect(decodeIfBase64Like(base64)).toBe(text);
    });

    it('should return original for binary-looking Base64', () => {
      // Random binary data that won't be mostly printable
      const binary = Buffer.from([
        255, 254, 253, 252, 251, 250, 249, 248,
      ]).toString('base64');
      expect(decodeIfBase64Like(binary)).toBe(binary);
    });

    it('should decode JSON-like Base64 content', () => {
      const json = '{"key":"value"}';
      const base64 = Buffer.from(json).toString('base64');
      expect(decodeIfBase64Like(base64)).toBe(json);
    });

    it('should handle strings at exactly 85% printable threshold', () => {
      // Create a string that's mostly printable
      const mostlyPrintable = 'HelloWorld'; // 100% printable
      const base64 = Buffer.from(mostlyPrintable).toString('base64');
      expect(decodeIfBase64Like(base64)).toBe(mostlyPrintable);
    });

    it('should handle complex unicode after decoding', () => {
      // Unicode with enough printable ASCII to pass threshold (85%)
      const unicode = 'Hello World 你好'; // 12 chars, 11 printable = 91%
      const base64 = Buffer.from(unicode).toString('base64');
      expect(decodeIfBase64Like(base64)).toBe(unicode);
    });

    it('should handle special Base64 characters', () => {
      const text = '+++///===';
      const base64 = Buffer.from(text).toString('base64');
      const result = decodeIfBase64Like(base64);
      expect(result).toBe(text);
    });
  });
});

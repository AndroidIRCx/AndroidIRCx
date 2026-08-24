/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Buffer } from 'buffer';
import {
  encodingService,
  SUPPORTED_ENCODINGS,
  DEFAULT_ENCODING,
} from '../../src/services/EncodingService';

describe('EncodingService', () => {
  describe('normalize', () => {
    it('lower-cases and trims a supported label', () => {
      expect(encodingService.normalize('  Windows-1251 ')).toBe('windows-1251');
    });

    it('falls back to UTF-8 for unknown or empty labels', () => {
      expect(encodingService.normalize('made-up')).toBe(DEFAULT_ENCODING);
      expect(encodingService.normalize('')).toBe(DEFAULT_ENCODING);
      expect(encodingService.normalize(undefined)).toBe(DEFAULT_ENCODING);
    });
  });

  describe('isSupported / getDisplayName', () => {
    it('reports supported labels', () => {
      expect(encodingService.isSupported('koi8-r')).toBe(true);
      expect(encodingService.isSupported('nope')).toBe(false);
    });

    it('returns a friendly display name', () => {
      expect(encodingService.getDisplayName('utf-8')).toBe('UTF-8 (Unicode)');
      expect(encodingService.getDisplayName('windows-1251')).toContain(
        'Windows-1251',
      );
    });
  });

  describe('decodeLine', () => {
    it('decodes UTF-8 bytes', () => {
      const bytes = Buffer.from('PRIVMSG #x :Ćao 😀', 'utf8');
      expect(encodingService.decodeLine(bytes, 'utf-8')).toBe(
        'PRIVMSG #x :Ćao 😀',
      );
    });

    it('decodes Windows-1251 Cyrillic bytes', () => {
      // "Привет" in Windows-1251.
      const bytes = Buffer.from([0xcf, 0xf0, 0xe8, 0xe2, 0xe5, 0xf2]);
      expect(encodingService.decodeLine(bytes, 'windows-1251')).toBe('Привет');
    });

    it('decodes ISO-8859-2 Central-European bytes', () => {
      // "š" is 0xB9 in ISO-8859-2.
      const bytes = Buffer.from([0xb9]);
      expect(encodingService.decodeLine(bytes, 'iso-8859-2')).toBe('š');
    });

    it('with utf8Fallback: decodes valid UTF-8 as UTF-8', () => {
      const bytes = Buffer.from('Ćao', 'utf8');
      expect(encodingService.decodeLine(bytes, 'windows-1250', true)).toBe(
        'Ćao',
      );
    });

    it('with utf8Fallback: uses the legacy charset for invalid UTF-8', () => {
      // 0xCF 0xF0... is not valid UTF-8, so it should decode via Windows-1251.
      const bytes = Buffer.from([0xcf, 0xf0, 0xe8, 0xe2, 0xe5, 0xf2]);
      expect(encodingService.decodeLine(bytes, 'windows-1251', true)).toBe(
        'Привет',
      );
    });
  });

  describe('encodeForSend', () => {
    it('returns null for UTF-8 (caller uses the string path)', () => {
      expect(encodingService.encodeForSend('hi', 'utf-8')).toBeNull();
    });

    it('returns null when utf8Fallback prefers sending UTF-8', () => {
      expect(
        encodingService.encodeForSend('hi', 'windows-1251', true),
      ).toBeNull();
    });

    it('encodes a line to legacy bytes', () => {
      const buf = encodingService.encodeForSend('Привет', 'windows-1251');
      expect(buf).not.toBeNull();
      expect(Array.from(buf as Buffer)).toEqual([
        0xcf, 0xf0, 0xe8, 0xe2, 0xe5, 0xf2,
      ]);
    });

    it('round-trips legacy encode -> decode', () => {
      const original = 'Čačak š đ ž';
      const encoded = encodingService.encodeForSend(original, 'windows-1250');
      expect(encoded).not.toBeNull();
      const decoded = encodingService.decodeLine(
        encoded as Buffer,
        'windows-1250',
      );
      expect(decoded).toBe(original);
    });
  });

  describe('SUPPORTED_ENCODINGS', () => {
    it('lists UTF-8 first and has unique labels', () => {
      expect(SUPPORTED_ENCODINGS[0].label).toBe('utf-8');
      const labels = SUPPORTED_ENCODINGS.map(e => e.label);
      expect(new Set(labels).size).toBe(labels.length);
    });
  });
});

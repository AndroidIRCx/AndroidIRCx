/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for DecorationFormatter - 100% coverage target
 */

import {
  applyDecoration,
  DecorationSettings,
} from '../../src/utils/DecorationFormatter';

describe('DecorationFormatter', () => {
  describe('applyDecoration', () => {
    it('should return message unchanged when disabled', () => {
      const settings: DecorationSettings = {
        enabled: false,
        useColors: true,
        bold: true,
        underline: true,
        textStyleId: '[prefix]',
        colorStyleId: '<color>',
        adornmentId: '{adorn}',
      };
      expect(applyDecoration('Hello', settings)).toBe('Hello');
    });

    it('should return message unchanged when message is empty', () => {
      const settings: DecorationSettings = {
        enabled: true,
        useColors: false,
        bold: false,
        underline: false,
        textStyleId: '',
        colorStyleId: '',
        adornmentId: '',
      };
      expect(applyDecoration('', settings)).toBe('');
    });

    it('should return message unchanged when message is whitespace only', () => {
      const settings: DecorationSettings = {
        enabled: true,
        useColors: false,
        bold: false,
        underline: false,
        textStyleId: '',
        colorStyleId: '',
        adornmentId: '',
      };
      expect(applyDecoration('   ', settings)).toBe('   ');
    });

    it('should apply text style with <text> placeholder', () => {
      const settings: DecorationSettings = {
        enabled: true,
        useColors: false,
        bold: false,
        underline: false,
        textStyleId: '[<text>]',
        colorStyleId: '',
        adornmentId: '',
      };
      expect(applyDecoration('Hello', settings)).toBe('[Hello]');
    });

    it('should apply text style with <TEXT> placeholder (case insensitive)', () => {
      const settings: DecorationSettings = {
        enabled: true,
        useColors: false,
        bold: false,
        underline: false,
        textStyleId: '{<TEXT>}',
        colorStyleId: '',
        adornmentId: '',
      };
      expect(applyDecoration('Hello', settings)).toBe('{Hello}');
    });

    it('should apply text style with backspace placeholder', () => {
      const settings: DecorationSettings = {
        enabled: true,
        useColors: false,
        bold: false,
        underline: false,
        textStyleId: 'prefix\x08suffix',
        colorStyleId: '',
        adornmentId: '',
      };
      expect(applyDecoration('Hello', settings)).toBe('prefixHellosuffix');
    });

    it('should remove extra backspaces from after text in backspace template', () => {
      const settings: DecorationSettings = {
        enabled: true,
        useColors: false,
        bold: false,
        underline: false,
        textStyleId: 'pre\x08mid\x08suf',
        colorStyleId: '',
        adornmentId: '',
      };
      expect(applyDecoration('Hello', settings)).toBe('preHellomidsuf');
    });

    it('should apply text style without placeholder (appends text)', () => {
      const settings: DecorationSettings = {
        enabled: true,
        useColors: false,
        bold: false,
        underline: false,
        textStyleId: 'prefix',
        colorStyleId: '',
        adornmentId: '',
      };
      expect(applyDecoration('Hello', settings)).toBe('prefix Hello');
    });

    it('should apply color style when useColors is true', () => {
      const settings: DecorationSettings = {
        enabled: true,
        useColors: true,
        bold: false,
        underline: false,
        textStyleId: '',
        colorStyleId: '<color>',
        adornmentId: '',
      };
      expect(applyDecoration('Hello', settings)).toBe('<color> Hello');
    });

    it('should not apply color style when useColors is false', () => {
      const settings: DecorationSettings = {
        enabled: true,
        useColors: false,
        bold: false,
        underline: false,
        textStyleId: '',
        colorStyleId: '<color>',
        adornmentId: '',
      };
      expect(applyDecoration('Hello', settings)).toBe('Hello');
    });

    it('should apply adornment style', () => {
      const settings: DecorationSettings = {
        enabled: true,
        useColors: false,
        bold: false,
        underline: false,
        textStyleId: '',
        colorStyleId: '',
        adornmentId: '★',
      };
      expect(applyDecoration('Hello', settings)).toBe('★ Hello');
    });

    it('should apply bold formatting', () => {
      const settings: DecorationSettings = {
        enabled: true,
        useColors: false,
        bold: true,
        underline: false,
        textStyleId: '',
        colorStyleId: '',
        adornmentId: '',
      };
      expect(applyDecoration('Hello', settings)).toBe('\x02Hello\x0F');
    });

    it('should apply underline formatting', () => {
      const settings: DecorationSettings = {
        enabled: true,
        useColors: false,
        bold: false,
        underline: true,
        textStyleId: '',
        colorStyleId: '',
        adornmentId: '',
      };
      expect(applyDecoration('Hello', settings)).toBe('\x1FHello\x0F');
    });

    it('should apply both bold and underline formatting', () => {
      const settings: DecorationSettings = {
        enabled: true,
        useColors: false,
        bold: true,
        underline: true,
        textStyleId: '',
        colorStyleId: '',
        adornmentId: '',
      };
      expect(applyDecoration('Hello', settings)).toBe('\x02\x1FHello\x0F');
    });

    it('should apply all decorations together', () => {
      const settings: DecorationSettings = {
        enabled: true,
        useColors: true,
        bold: true,
        underline: true,
        textStyleId: '[<text>]',
        colorStyleId: '{<text>}',
        adornmentId: '★ <text>',
      };
      const result = applyDecoration('Hello', settings);
      // Text style: [Hello]
      // Color style: {[Hello]}
      // Adornment: ★ {[Hello]}
      // Bold + Underline + Reset
      expect(result).toBe('\x02\x1F★ {[Hello]}\x0F');
    });

    it('should handle empty template', () => {
      const settings: DecorationSettings = {
        enabled: true,
        useColors: false,
        bold: false,
        underline: false,
        textStyleId: '',
        colorStyleId: '',
        adornmentId: '',
      };
      expect(applyDecoration('Hello', settings)).toBe('Hello');
    });

    it('should handle template with only backspace', () => {
      const settings: DecorationSettings = {
        enabled: true,
        useColors: false,
        bold: false,
        underline: false,
        textStyleId: '\x08',
        colorStyleId: '',
        adornmentId: '',
      };
      expect(applyDecoration('Hello', settings)).toBe('Hello');
    });

    it('should handle multiple <text> placeholders', () => {
      const settings: DecorationSettings = {
        enabled: true,
        useColors: false,
        bold: false,
        underline: false,
        textStyleId: '<text> - <text>',
        colorStyleId: '',
        adornmentId: '',
      };
      expect(applyDecoration('Hello', settings)).toBe('Hello - Hello');
    });

    it('should trim result when appending template without placeholder', () => {
      const settings: DecorationSettings = {
        enabled: true,
        useColors: false,
        bold: false,
        underline: false,
        textStyleId: '  prefix  ',
        colorStyleId: '',
        adornmentId: '',
      };
      // Template is not trimmed, but final result is trimmed
      expect(applyDecoration('Hello', settings)).toBe('prefix   Hello');
    });
  });
});

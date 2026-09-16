/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { parsePalette } from '../../src/themes/importPalette';

describe('parsePalette', () => {
  describe('junk / empty input', () => {
    it('returns an empty result for empty string', () => {
      const result = parsePalette('');
      expect(result.colors).toEqual({});
      expect(result.hexes).toEqual([]);
      expect(result.seed).toBeUndefined();
      expect(result.matchedKeys).toBe(0);
    });

    it('returns an empty result for whitespace only', () => {
      expect(parsePalette('   \n\t  \n')).toEqual({
        colors: {},
        hexes: [],
        matchedKeys: 0,
      });
    });

    it('returns an empty result for prose with no colours', () => {
      const result = parsePalette('the quick brown fox jumps over things');
      expect(result.colors).toEqual({});
      expect(result.hexes).toEqual([]);
      expect(result.seed).toBeUndefined();
      expect(result.matchedKeys).toBe(0);
    });

    it('never throws on non-string input', () => {
      // @ts-expect-error deliberately passing a wrong type
      expect(() => parsePalette(null)).not.toThrow();
      // @ts-expect-error deliberately passing a wrong type
      expect(parsePalette(undefined).matchedKeys).toBe(0);
      // @ts-expect-error deliberately passing a wrong type
      expect(parsePalette(42).hexes).toEqual([]);
    });
  });

  describe('key/value lines', () => {
    it('parses a colon-separated block into partial colors', () => {
      const result = parsePalette(
        ['background: #101010', 'text: #ffffff', 'accent: #89b4fa'].join('\n'),
      );
      expect(result.colors).toEqual({
        background: '#101010',
        text: '#FFFFFF',
        accent: '#89B4FA',
      });
      expect(result.matchedKeys).toBe(3);
      expect(result.seed).toBeUndefined();
    });

    it('parses whitespace-separated lines', () => {
      const result = parsePalette('messageNick #89b4fa\nmessageText #cdd6f4');
      expect(result.colors.messageNick).toBe('#89B4FA');
      expect(result.colors.messageText).toBe('#CDD6F4');
      expect(result.matchedKeys).toBe(2);
    });

    it('parses equals-separated lines and #RGB shorthand', () => {
      const result = parsePalette('background = #000\nprimary = #f00');
      expect(result.colors.background).toBe('#000000');
      expect(result.colors.primary).toBe('#FF0000');
    });

    it('is case-insensitive for key names', () => {
      const result = parsePalette(
        'BACKGROUND: #101010\nMessageNick: #89b4fa\nAcCeNt: #cba6f7',
      );
      expect(result.colors.background).toBe('#101010');
      expect(result.colors.messageNick).toBe('#89B4FA');
      expect(result.colors.accent).toBe('#CBA6F7');
      expect(result.matchedKeys).toBe(3);
    });

    it('ignores unknown keys', () => {
      const result = parsePalette(
        'background: #101010\nnotARealKey: #ffffff\nfoobar: #00ff00',
      );
      expect(result.colors).toEqual({ background: '#101010' });
      expect(result.matchedKeys).toBe(1);
    });

    it('tolerates trailing punctuation and quotes', () => {
      const result = parsePalette('background: "#101010";\ntext: #FFFFFF,');
      expect(result.colors.background).toBe('#101010');
      expect(result.colors.text).toBe('#FFFFFF');
    });

    it('does not emit a seed when keys matched', () => {
      const result = parsePalette('background: #101010\ntext: #ffffff');
      expect(result.seed).toBeUndefined();
    });
  });

  describe('JSON input', () => {
    it('extracts from a { colors: {...} } wrapper', () => {
      const json = JSON.stringify({
        name: 'My Theme',
        colors: {
          background: '#1e1e2e',
          text: '#cdd6f4',
          messageNick: '#89b4fa',
          bogus: '#000000',
        },
      });
      const result = parsePalette(json);
      expect(result.colors).toEqual({
        background: '#1E1E2E',
        text: '#CDD6F4',
        messageNick: '#89B4FA',
      });
      expect(result.matchedKeys).toBe(3);
      expect(result.seed).toBeUndefined();
    });

    it('extracts from a bare JSON object', () => {
      const result = parsePalette(
        '{ "background": "#101010", "accent": "#89b4fa" }',
      );
      expect(result.colors.background).toBe('#101010');
      expect(result.colors.accent).toBe('#89B4FA');
      expect(result.matchedKeys).toBe(2);
    });

    it('tolerates unquoted keys and single quotes', () => {
      const result = parsePalette(
        "{ background: '#101010', accent: '#89b4fa', text: '#ffffff' }",
      );
      expect(result.colors.background).toBe('#101010');
      expect(result.colors.accent).toBe('#89B4FA');
      expect(result.colors.text).toBe('#FFFFFF');
      expect(result.matchedKeys).toBe(3);
    });

    it('handles a pretty-printed multi-line JSON object', () => {
      const json = [
        '{',
        '  "colors": {',
        '    "background": "#282828",',
        '    "text": "#ebdbb2"',
        '  }',
        '}',
      ].join('\n');
      const result = parsePalette(json);
      expect(result.colors.background).toBe('#282828');
      expect(result.colors.text).toBe('#EBDBB2');
    });
  });

  describe('bare hex list (mIRC export)', () => {
    const MIRC16 = [
      '#FFFFFF',
      '#000000',
      '#00007F',
      '#009300',
      '#FF0000',
      '#7F0000',
      '#9C009C',
      '#FC7F00',
      '#FFFF00',
      '#00FC00',
      '#009393',
      '#00FFFF',
      '#0000FC',
      '#FF00FF',
      '#7F7F7F',
      '#D2D2D2',
    ];

    it('returns 16 hexes with a seed and empty colors (comma separated)', () => {
      const result = parsePalette(MIRC16.join(', '));
      expect(result.hexes).toHaveLength(16);
      expect(result.hexes).toEqual(MIRC16);
      expect(result.colors).toEqual({});
      expect(result.matchedKeys).toBe(0);
      expect(result.seed).toBeDefined();
    });

    it('parses a newline-separated list too', () => {
      const result = parsePalette(MIRC16.join('\n'));
      expect(result.hexes).toHaveLength(16);
      expect(result.seed).toBeDefined();
    });

    it('parses a space-separated list too', () => {
      const result = parsePalette(MIRC16.join(' '));
      expect(result.hexes).toHaveLength(16);
      expect(result.seed).toBeDefined();
    });

    it('produces a sensible seed: background first, distinct accent/text', () => {
      const result = parsePalette(MIRC16.join(' '));
      const seed = result.seed!;
      expect(seed.background).toBe('#FFFFFF');
      // Highest contrast against white is black.
      expect(seed.text).toBe('#000000');
      // Accent is a saturated, non-background/text entry.
      expect(seed.accent).not.toBe(seed.background);
      expect(seed.accent).not.toBe(seed.text);
      expect(MIRC16).toContain(seed.accent);
    });

    it('normalises lower-case and shorthand hexes in a bare list', () => {
      const result = parsePalette('#abc, #def0aa, #123456');
      expect(result.hexes).toEqual(['#AABBCC', '#DEF0AA', '#123456']);
      expect(result.seed).toBeDefined();
    });
  });

  describe('tolerance & validation', () => {
    it('ignores comment-only lines but keeps real hexes', () => {
      const result = parsePalette(
        [
          '# my favourite palette',
          '// exported today',
          '#101010',
          '#89b4fa',
        ].join('\n'),
      );
      expect(result.hexes).toEqual(['#101010', '#89B4FA']);
      expect(result.seed).toBeDefined();
    });

    it('skips blank lines and garbage tokens', () => {
      const result = parsePalette(
        ['', '   ', 'background: #101010', 'garbage here', ''].join('\n'),
      );
      expect(result.colors.background).toBe('#101010');
      expect(result.matchedKeys).toBe(1);
    });

    it('rejects invalid hex values', () => {
      const result = parsePalette(
        [
          'background: #12345', // 5 digits
          'text: #gggggg', // non-hex
          'accent: #1234567', // 7 digits
          'primary: #89b4fa', // valid
        ].join('\n'),
      );
      expect(result.colors).toEqual({ primary: '#89B4FA' });
      expect(result.hexes).toEqual(['#89B4FA']);
      expect(result.matchedKeys).toBe(1);
    });

    it('does not treat a single stray hex as a bare list seed', () => {
      const result = parsePalette('just #101010 sitting alone');
      expect(result.hexes).toEqual(['#101010']);
      expect(result.seed).toBeUndefined();
    });

    it('handles mixed key/value and stray hexes without a seed', () => {
      const result = parsePalette(
        ['background: #101010', '#89b4fa', '#cba6f7'].join('\n'),
      );
      expect(result.colors.background).toBe('#101010');
      expect(result.matchedKeys).toBe(1);
      // Keys matched -> no seed even though extra hexes exist.
      expect(result.seed).toBeUndefined();
      expect(result.hexes).toEqual(['#101010', '#89B4FA', '#CBA6F7']);
    });
  });
});

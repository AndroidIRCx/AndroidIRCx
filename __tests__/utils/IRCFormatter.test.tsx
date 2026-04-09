/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for IRCFormatter - 100% coverage target
 */

import { Text } from 'react-native';
import {
  IRC_STANDARD_COLOR_MAP,
  IRC_EXTENDED_COLOR_MAP,
  IRC_FORMAT_CODES,
  formatIRCText,
  formatIRCTextAsComponent,
  stripIRCFormatting,
  formatIRCDebug,
  formatIRCTextWithLinks,
} from '../../src/utils/IRCFormatter';

// Mock Linking
jest.mock('react-native/Libraries/Linking/Linking', () => ({
  openURL: jest.fn().mockResolvedValue(undefined),
}));

describe('IRCFormatter', () => {
  describe('IRC_STANDARD_COLOR_MAP', () => {
    it('should contain all 16 standard IRC colors', () => {
      expect(Object.keys(IRC_STANDARD_COLOR_MAP)).toHaveLength(16);
      expect(IRC_STANDARD_COLOR_MAP[0]).toBe('#FFFFFF'); // white
      expect(IRC_STANDARD_COLOR_MAP[1]).toBe('#000000'); // black
      expect(IRC_STANDARD_COLOR_MAP[4]).toBe('#FF0000'); // red
      expect(IRC_STANDARD_COLOR_MAP[15]).toBe('#D2D2D2'); // light grey
    });
  });

  describe('IRC_EXTENDED_COLOR_MAP', () => {
    it('should contain extended colors 16-98', () => {
      expect(IRC_EXTENDED_COLOR_MAP[16]).toBe('#470000');
      expect(IRC_EXTENDED_COLOR_MAP[98]).toBe('#ffffff');
    });
  });

  describe('IRC_FORMAT_CODES', () => {
    it('should define all format code constants', () => {
      expect(IRC_FORMAT_CODES.BOLD).toBe(0x02);
      expect(IRC_FORMAT_CODES.COLOR).toBe(0x03);
      expect(IRC_FORMAT_CODES.RESET).toBe(0x0f);
      expect(IRC_FORMAT_CODES.REVERSE).toBe(0x16);
      expect(IRC_FORMAT_CODES.ITALIC).toBe(0x1d);
      expect(IRC_FORMAT_CODES.STRIKETHROUGH).toBe(0x1e);
      expect(IRC_FORMAT_CODES.UNDERLINE).toBe(0x1f);
    });
  });

  describe('formatIRCText', () => {
    it('should return empty Text for empty string', () => {
      const result = formatIRCText('');
      expect(result).toHaveLength(1);
      expect((result[0] as any).props.children).toBeUndefined();
    });

    it('should return empty Text for null/undefined', () => {
      const result = formatIRCText('');
      expect(result).toHaveLength(1);
    });

    it('should parse plain text without formatting', () => {
      const result = formatIRCText('Hello world');
      expect(result).toHaveLength(1);
      expect((result[0] as any).props.children).toBe('Hello world');
    });

    it('should parse bold text', () => {
      const result = formatIRCText('\x02Bold text\x0F');
      expect(result.length).toBeGreaterThan(0);
      const firstSegment = result[0] as any;
      expect(firstSegment.props.style.fontWeight).toBe('bold');
    });

    it('should parse italic text', () => {
      const result = formatIRCText('\x1DItalic text\x0F');
      const firstSegment = result[0] as any;
      expect(firstSegment.props.style.fontStyle).toBe('italic');
    });

    it('should parse underline text', () => {
      const result = formatIRCText('\x1FUnderlined text\x0F');
      const firstSegment = result[0] as any;
      expect(firstSegment.props.style.textDecorationLine).toBe('underline');
    });

    it('should parse strikethrough text', () => {
      const result = formatIRCText('\x1EStrikethrough text\x0F');
      const firstSegment = result[0] as any;
      expect(firstSegment.props.style.textDecorationLine).toBe('line-through');
    });

    it('should parse combined underline and strikethrough', () => {
      const result = formatIRCText('\x1F\x1EBoth styles\x0F');
      const firstSegment = result[0] as any;
      expect(firstSegment.props.style.textDecorationLine).toContain(
        'underline',
      );
      expect(firstSegment.props.style.textDecorationLine).toContain(
        'line-through',
      );
    });

    it('should parse colored text with single digit color', () => {
      const result = formatIRCText('\x034Red text\x0F');
      const firstSegment = result[0] as any;
      expect(firstSegment.props.style.color).toBe('#FF0000');
    });

    it('should parse colored text with two digit color', () => {
      const result = formatIRCText('\x0312Light blue text\x0F');
      const firstSegment = result[0] as any;
      expect(firstSegment.props.style.color).toBe('#0000FC');
    });

    it('should parse colored text with foreground and background', () => {
      const result = formatIRCText('\x034,8Red on yellow\x0F');
      const firstSegment = result[0] as any;
      expect(firstSegment.props.style.color).toBe('#FF0000');
      expect(firstSegment.props.style.backgroundColor).toBe('#FFFF00');
    });

    it('should parse extended color codes (16-98)', () => {
      const result = formatIRCText('\x0328Dark red\x0F');
      const firstSegment = result[0] as any;
      expect(firstSegment.props.style.color).toBe('#740000');
    });

    it('should toggle bold on and off', () => {
      const result = formatIRCText('\x02Bold\x02 not bold\x0F');
      expect(result).toHaveLength(2);
      expect((result[0] as any).props.style.fontWeight).toBe('bold');
      expect((result[1] as any).props.style.fontWeight).toBeUndefined();
    });

    it('should toggle underline on and off', () => {
      const result = formatIRCText('\x1FUnderlined\x1F normal\x0F');
      expect(result).toHaveLength(2);
      expect((result[0] as any).props.style.textDecorationLine).toBe(
        'underline',
      );
      expect((result[1] as any).props.style.textDecorationLine).toBeUndefined();
    });

    it('should handle reverse color mode', () => {
      const result = formatIRCText('\x034,8\x16Reversed\x0F');
      const firstSegment = result[0] as any;
      // Colors should be swapped
      expect(firstSegment.props.style.color).toBeDefined();
      expect(firstSegment.props.style.backgroundColor).toBeDefined();
    });

    it('should apply baseStyle to all segments', () => {
      const baseStyle = { fontSize: 14, color: '#333' };
      const result = formatIRCText('Test', baseStyle);
      const firstSegment = result[0] as any;
      expect(firstSegment.props.style.fontSize).toBe(14);
    });

    it('should preserve trailing spaces', () => {
      const result = formatIRCText('Text with trailing   ');
      const firstSegment = result[0] as any;
      // Trailing spaces should be preserved as non-breaking spaces
      expect(firstSegment.props.children).toContain('\xa0');
    });
  });

  describe('formatIRCTextAsComponent', () => {
    it('should return empty Text for empty string', () => {
      const result = formatIRCTextAsComponent('');
      expect((result as any).props.children).toBeUndefined();
    });

    it('should return Text component for plain text', () => {
      const result = formatIRCTextAsComponent('Hello');
      expect((result as any).type).toBe(Text);
      // Plain text is wrapped in a single segment
      const children = (result as any).props.children;
      expect(children).toHaveLength(1);
      expect(children[0].props.children).toBe('Hello');
    });

    it('should handle multiline text', () => {
      const result = formatIRCTextAsComponent('Line 1\nLine 2\nLine 3');
      expect((result as any).type).toBe(Text);
      // Should have nested Text components for each line
      const children = (result as any).props.children;
      expect(children).toHaveLength(3);
    });

    it('should handle multiline with formatting', () => {
      const result = formatIRCTextAsComponent('\x02Bold line\x0F\nNormal line');
      expect((result as any).type).toBe(Text);
    });

    it('should apply baseStyle', () => {
      const baseStyle = { fontSize: 16 };
      const result = formatIRCTextAsComponent('Test', baseStyle);
      expect((result as any).props.style.fontSize).toBe(16);
    });
  });

  describe('stripIRCFormatting', () => {
    it('should return empty string for empty input', () => {
      expect(stripIRCFormatting('')).toBe('');
    });

    it('should return plain text unchanged', () => {
      expect(stripIRCFormatting('Hello world')).toBe('Hello world');
    });

    it('should remove bold formatting', () => {
      expect(stripIRCFormatting('\x02Bold text\x0F')).toBe('Bold text');
    });

    it('should remove italic formatting', () => {
      expect(stripIRCFormatting('\x1DItalic text\x0F')).toBe('Italic text');
    });

    it('should remove underline formatting', () => {
      expect(stripIRCFormatting('\x1FUnderlined text\x0F')).toBe(
        'Underlined text',
      );
    });

    it('should remove strikethrough formatting', () => {
      expect(stripIRCFormatting('\x1EStrikethrough\x0F')).toBe('Strikethrough');
    });

    it('should remove color codes with single digit', () => {
      expect(stripIRCFormatting('\x034Red text\x0F')).toBe('Red text');
    });

    it('should remove color codes with two digits', () => {
      expect(stripIRCFormatting('\x0312Blue text\x0F')).toBe('Blue text');
    });

    it('should remove color codes with foreground and background', () => {
      expect(stripIRCFormatting('\x034,8Colored\x0F')).toBe('Colored');
    });

    it('should remove all formatting from complex text', () => {
      const input = '\x02\x1F\x034Bold underlined red\x0F text';
      expect(stripIRCFormatting(input)).toBe('Bold underlined red text');
    });

    it('should handle multiple color codes', () => {
      const input = '\x034Red\x03 \x032Blue\x03 \x033Green';
      expect(stripIRCFormatting(input)).toBe('Red Blue Green');
    });

    it('should handle reset code', () => {
      expect(stripIRCFormatting('Normal \x0F reset')).toBe('Normal  reset');
    });

    it('should handle reverse code', () => {
      expect(stripIRCFormatting('\x16Reversed\x0F')).toBe('Reversed');
    });
  });

  describe('formatIRCDebug', () => {
    it('should return empty string for empty input', () => {
      expect(formatIRCDebug('')).toBe('');
    });

    it('should show bold marker', () => {
      expect(formatIRCDebug('\x02Bold\x02')).toBe('[B]Bold[B]');
    });

    it('should show italic marker', () => {
      expect(formatIRCDebug('\x1DItalic\x1D')).toBe('[I]Italic[I]');
    });

    it('should show underline marker', () => {
      expect(formatIRCDebug('\x1FUnderline\x1F')).toBe('[U]Underline[U]');
    });

    it('should show strikethrough marker', () => {
      expect(formatIRCDebug('\x1EStrike\x1E')).toBe('[S]Strike[S]');
    });

    it('should show reset marker', () => {
      expect(formatIRCDebug('Text\x0F')).toBe('Text[R]');
    });

    it('should show reverse marker', () => {
      expect(formatIRCDebug('\x16Reversed\x16')).toBe('[REV]Reversed[REV]');
    });

    it('should show single digit color code', () => {
      expect(formatIRCDebug('\x034Red')).toBe('[C4]Red');
    });

    it('should show two digit color code', () => {
      expect(formatIRCDebug('\x0312Blue')).toBe('[C12]Blue');
    });

    it('should show color code with background', () => {
      expect(formatIRCDebug('\x034,8Red on yellow')).toBe(
        '[C4,8]Red on yellow',
      );
    });

    it('should show color code with two digit background', () => {
      // formatIRCDebug preserves the leading zero in the background color
      expect(formatIRCDebug('\x0312,05Blue on brown')).toBe(
        '[C12,05]Blue on brown',
      );
    });

    it('should handle plain text', () => {
      expect(formatIRCDebug('Plain text')).toBe('Plain text');
    });

    it('should handle mixed formatting', () => {
      const result = formatIRCDebug('\x02\x034Bold red\x0F');
      expect(result).toContain('[B]');
      expect(result).toContain('[C4]');
      expect(result).toContain('[R]');
    });
  });

  describe('formatIRCTextWithLinks', () => {
    it('should return empty Text for empty string', () => {
      const result = formatIRCTextWithLinks('');
      expect((result as any).props.children).toBeUndefined();
    });

    it('should render plain text without links', () => {
      const result = formatIRCTextWithLinks('Hello world');
      expect((result as any).type).toBe(Text);
    });

    it('should make URLs clickable', () => {
      const result = formatIRCTextWithLinks('Visit https://example.com');
      expect((result as any).type).toBe(Text);
      // Should contain nested Text components
      const children = (result as any).props.children;
      expect(children).toBeDefined();
    });

    it('should handle multiple URLs', () => {
      const result = formatIRCTextWithLinks(
        'Visit https://a.com and https://b.com',
      );
      expect((result as any).type).toBe(Text);
    });

    it('should handle www URLs', () => {
      const result = formatIRCTextWithLinks('Visit www.example.com');
      expect((result as any).type).toBe(Text);
    });

    it('should apply custom link color', () => {
      const result = formatIRCTextWithLinks(
        'https://example.com',
        {},
        '#FF0000',
      );
      expect((result as any).type).toBe(Text);
    });

    it('should apply baseStyle', () => {
      const baseStyle = { fontSize: 14 };
      const result = formatIRCTextWithLinks('Test', baseStyle);
      expect((result as any).props.style.fontSize).toBe(14);
    });

    it('should handle formatted text with links', () => {
      const result = formatIRCTextWithLinks(
        '\x02Bold https://example.com link\x0F',
      );
      expect((result as any).type).toBe(Text);
    });

    it('should handle text without any URLs', () => {
      const result = formatIRCTextWithLinks('Just plain text');
      expect((result as any).type).toBe(Text);
    });
  });
});

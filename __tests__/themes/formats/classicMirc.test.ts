/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { makeClassicMircFormats } from '../../../src/themes/formats/classicMirc';
import type { FormatPalette } from '../../../src/themes/formats/types';
import type {
  MessageFormatPart,
  ThemeMessageFormats,
} from '../../../src/services/ThemeService';

const SAMPLE_PALETTE: FormatPalette = {
  timestamp: '#111111',
  punctuation: '#222222',
  nick: '#333333',
  message: '#444444',
  action: '#555555',
  notice: '#666666',
  join: '#777777',
  part: '#888888',
  quit: '#999999',
  kick: '#AAAAAA',
  nickChange: '#BBBBBB',
  event: '#CCCCCC',
  muted: '#DDDDDD',
};

const ALL_KEYS: Array<keyof ThemeMessageFormats> = [
  'message',
  'messageMention',
  'action',
  'actionMention',
  'notice',
  'event',
  'join',
  'part',
  'quit',
  'kick',
  'nick',
  'invite',
  'monitor',
  'mode',
  'topic',
  'raw',
  'whois',
  'who',
  'names',
  'error',
  'ctcp',
];

const collectColors = (parts: MessageFormatPart[]): string[] =>
  parts.map(part => part.style?.color).filter((c): c is string => !!c);

describe('Themes - classicMirc formats', () => {
  it('exports a factory that returns an object with all 21 keys', () => {
    const formats = makeClassicMircFormats(SAMPLE_PALETTE);
    expect(typeof makeClassicMircFormats).toBe('function');
    expect(ALL_KEYS).toHaveLength(21);
    for (const key of ALL_KEYS) {
      expect(formats).toHaveProperty(key);
    }
    // No extra keys beyond the 21 expected.
    expect(Object.keys(formats).sort()).toEqual([...ALL_KEYS].sort());
  });

  it('produces a non-empty array of valid parts for every key', () => {
    const formats = makeClassicMircFormats(SAMPLE_PALETTE);
    for (const key of ALL_KEYS) {
      const parts = formats[key];
      expect(Array.isArray(parts)).toBe(true);
      expect(parts.length).toBeGreaterThan(0);
      for (const part of parts) {
        expect(['text', 'token']).toContain(part.type);
        expect(typeof part.value).toBe('string');
        if (part.style !== undefined) {
          expect(typeof part.style).toBe('object');
        }
      }
    }
  });

  it('opens every line with a bracketed timestamp using palette colours', () => {
    const formats = makeClassicMircFormats(SAMPLE_PALETTE);
    for (const key of ALL_KEYS) {
      const parts = formats[key];
      expect(parts[0]).toEqual({
        type: 'text',
        value: '[',
        style: { color: SAMPLE_PALETTE.punctuation },
      });
      const timeToken = parts.find(
        part => part.type === 'token' && part.value === 'time',
      );
      expect(timeToken).toBeDefined();
      expect(timeToken?.style?.color).toBe(SAMPLE_PALETTE.timestamp);
    }
  });

  it('uses the nick palette colour somewhere in the output', () => {
    const formats = makeClassicMircFormats(SAMPLE_PALETTE);
    const allColors = ALL_KEYS.flatMap(key => collectColors(formats[key]));
    expect(allColors).toContain(SAMPLE_PALETTE.nick);
  });

  it('renders chat messages as <nick> message with a message token', () => {
    const formats = makeClassicMircFormats(SAMPLE_PALETTE);
    const messageTokens = formats.message.filter(
      part => part.type === 'token' && part.value === 'message',
    );
    expect(messageTokens.length).toBeGreaterThan(0);

    const nickToken = formats.message.find(
      part => part.type === 'token' && part.value === 'nick',
    );
    expect(nickToken?.style?.color).toBe(SAMPLE_PALETTE.nick);

    const angleOpen = formats.message.find(
      part => part.type === 'text' && part.value === '<',
    );
    expect(angleOpen?.style?.color).toBe(SAMPLE_PALETTE.punctuation);
  });

  it('bolds the nick for messageMention', () => {
    const formats = makeClassicMircFormats(SAMPLE_PALETTE);
    const nickToken = formats.messageMention.find(
      part => part.type === 'token' && part.value === 'nick',
    );
    expect(nickToken?.style?.bold).toBe(true);
  });

  it('omits the body colour when the palette has no message colour', () => {
    const paletteWithoutMessage: FormatPalette = { ...SAMPLE_PALETTE };
    delete paletteWithoutMessage.message;
    const formats = makeClassicMircFormats(paletteWithoutMessage);
    const bodyToken = formats.message.find(
      part => part.type === 'token' && part.value === 'message',
    );
    expect(bodyToken).toBeDefined();
    expect(bodyToken?.style?.color).toBeUndefined();
  });
});

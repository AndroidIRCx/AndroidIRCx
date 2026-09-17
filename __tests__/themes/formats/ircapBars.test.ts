/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { makeIrcapBarsFormats } from '../../../src/themes/formats/ircapBars';
import type { FormatPalette } from '../../../src/themes/formats/types';
import type {
  ThemeMessageFormats,
  MessageFormatPart,
} from '../../../src/services/ThemeService';

const PALETTE: FormatPalette = {
  timestamp: '#111111',
  punctuation: '#0063b5',
  nick: '#000074',
  message: '#222222',
  action: '#740074',
  notice: '#333333',
  join: '#00aa00',
  part: '#aa8800',
  quit: '#7f0000',
  kick: '#b50000',
  nickChange: '#0088cc',
  event: '#444444',
  muted: '#5c5c5c',
};

const ALL_KEYS: (keyof ThemeMessageFormats)[] = [
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

const colorsIn = (parts: MessageFormatPart[]): string[] =>
  parts
    .map(part => part.style?.color)
    .filter((c): c is string => typeof c === 'string');

describe('makeIrcapBarsFormats', () => {
  it('is a pure factory returning a fresh object per call', () => {
    const a = makeIrcapBarsFormats(PALETTE);
    const b = makeIrcapBarsFormats(PALETTE);
    expect(a).not.toBe(b);
    expect(a.message).not.toBe(b.message);
  });

  it('produces all 21 message-format keys', () => {
    const formats = makeIrcapBarsFormats(PALETTE);
    expect(ALL_KEYS).toHaveLength(21);
    for (const key of ALL_KEYS) {
      expect(formats).toHaveProperty(key);
    }
    expect(Object.keys(formats).sort()).toEqual([...ALL_KEYS].sort());
  });

  it('gives every key a non-empty MessageFormatPart[] with valid part shapes', () => {
    const formats = makeIrcapBarsFormats(PALETTE);
    for (const key of ALL_KEYS) {
      const parts = formats[key];
      expect(Array.isArray(parts)).toBe(true);
      expect(parts.length).toBeGreaterThan(0);
      for (const part of parts) {
        expect(part.type === 'text' || part.type === 'token').toBe(true);
        expect(typeof part.value).toBe('string');
      }
    }
  });

  it('keeps the IRcap "¦" separator in the message template', () => {
    const formats = makeIrcapBarsFormats(PALETTE);
    const separators = formats.message.filter(part => part.value.includes('¦'));
    expect(separators.length).toBeGreaterThan(0);
  });

  it('keeps the directional arrows in the join/part/nick templates', () => {
    const formats = makeIrcapBarsFormats(PALETTE);
    expect(formats.join.some(part => part.value.includes('->'))).toBe(true);
    expect(formats.part.some(part => part.value.includes('<-'))).toBe(true);
    expect(formats.nick.some(part => part.value.includes('=>'))).toBe(true);
  });

  it('surfaces the palette nick and punctuation colours in the output', () => {
    const formats = makeIrcapBarsFormats(PALETTE);
    const messageColors = colorsIn(formats.message);
    expect(messageColors).toContain(PALETTE.punctuation);
    expect(messageColors).toContain(PALETTE.nick);
    expect(messageColors).toContain(PALETTE.timestamp);
  });

  it('routes signature colours to the matching palette fields', () => {
    const formats = makeIrcapBarsFormats(PALETTE);
    expect(colorsIn(formats.part)).toContain(PALETTE.part);
    expect(colorsIn(formats.quit)).toContain(PALETTE.quit);
    expect(colorsIn(formats.kick)).toContain(PALETTE.kick);
    expect(colorsIn(formats.nick)).toContain(PALETTE.nickChange);
    expect(colorsIn(formats.join)).toContain(PALETTE.join);
    expect(colorsIn(formats.action)).toContain(PALETTE.action);
    expect(colorsIn(formats.part)).toContain(PALETTE.muted);
  });

  it('includes a "message" token in the message template', () => {
    const formats = makeIrcapBarsFormats(PALETTE);
    const hasMessageToken = formats.message.some(
      part => part.type === 'token' && part.value === 'message',
    );
    expect(hasMessageToken).toBe(true);
  });

  it('applies an explicit body colour to the message token when provided', () => {
    const withBody = makeIrcapBarsFormats(PALETTE);
    const bodyToken = withBody.message.find(
      part => part.type === 'token' && part.value === 'message',
    );
    expect(bodyToken?.style?.color).toBe(PALETTE.message);
  });

  it('omits body styling when no message colour is supplied', () => {
    const rest: FormatPalette = { ...PALETTE };
    delete rest.message;
    const noBody = makeIrcapBarsFormats(rest);
    const bodyToken = noBody.message.find(
      part => part.type === 'token' && part.value === 'message',
    );
    expect(bodyToken).toBeDefined();
    expect(bodyToken?.style?.color).toBeUndefined();
  });
});

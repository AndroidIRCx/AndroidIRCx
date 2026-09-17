/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { makeMinimalFormats } from '../../../src/themes/formats/minimal';
import type { FormatPalette } from '../../../src/themes/formats/types';
import type {
  MessageFormatPart,
  ThemeMessageFormats,
} from '../../../src/services/ThemeService';

const PALETTE: FormatPalette = {
  timestamp: '#565f89',
  punctuation: '#414868',
  nick: '#7aa2f7',
  message: '#c0caf5',
  action: '#bb9af7',
  notice: '#e0af68',
  join: '#9ece6a',
  part: '#e0af68',
  quit: '#f7768e',
  kick: '#f7768e',
  nickChange: '#7dcfff',
  event: '#a9b1d6',
  muted: '#565f89',
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

describe('makeMinimalFormats', () => {
  const formats = makeMinimalFormats(PALETTE);

  it('exposes all 21 format keys', () => {
    expect(ALL_KEYS).toHaveLength(21);
    expect(Object.keys(formats).sort()).toEqual([...ALL_KEYS].sort());
  });

  it.each(ALL_KEYS)('produces a non-empty MessageFormatPart[] for %s', key => {
    const parts = formats[key];
    expect(Array.isArray(parts)).toBe(true);
    expect(parts.length).toBeGreaterThan(0);
    parts.forEach((part: MessageFormatPart) => {
      expect(part.type === 'text' || part.type === 'token').toBe(true);
      expect(typeof part.value).toBe('string');
    });
  });

  it('never uses a literal "[" bracket (no-brackets guarantee)', () => {
    ALL_KEYS.forEach(key => {
      formats[key].forEach(part => {
        expect(part.value).not.toContain('[');
      });
    });
  });

  it('styles a nick with bold somewhere', () => {
    const hasBoldNick = ALL_KEYS.some(key =>
      formats[key].some(
        part => part.type === 'token' && part.style?.bold === true,
      ),
    );
    expect(hasBoldNick).toBe(true);
  });

  it('includes a "message" token in the message format', () => {
    const hasMessageToken = formats.message.some(
      part => part.type === 'token' && part.value === 'message',
    );
    expect(hasMessageToken).toBe(true);
  });

  it('starts every line with the faint timestamp token', () => {
    ALL_KEYS.forEach(key => {
      const first = formats[key][0];
      expect(first.type).toBe('token');
      expect(first.value).toBe('time');
      expect(first.style?.color).toBe(PALETTE.timestamp);
    });
  });

  it('omits an explicit body colour when the palette has no message colour', () => {
    const noBody = makeMinimalFormats({ ...PALETTE, message: undefined });
    const bodyToken = noBody.message.find(
      part => part.type === 'token' && part.value === 'message',
    );
    expect(bodyToken?.style?.color).toBeUndefined();
  });
});

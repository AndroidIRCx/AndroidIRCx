/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { splitIrcText, utf8ByteLength } from '../../src/utils/ircMessageSplit';

const allFit = (parts: string[], max: number) =>
  parts.every(part => utf8ByteLength(part) <= max);

describe('utf8ByteLength', () => {
  it('counts bytes, not characters', () => {
    expect(utf8ByteLength('abc')).toBe(3);
    expect(utf8ByteLength('ћао')).toBe(6);
    expect(utf8ByteLength('€')).toBe(3);
    expect(utf8ByteLength('😀')).toBe(4);
    expect(utf8ByteLength('')).toBe(0);
  });
});

describe('splitIrcText', () => {
  it('returns nothing for empty text', () => {
    expect(splitIrcText('', 100)).toEqual([]);
  });

  it('keeps text that fits as one unchanged piece', () => {
    expect(splitIrcText('  hello  world ', 100)).toEqual(['  hello  world ']);
  });

  it('keeps text that fits exactly', () => {
    expect(splitIrcText('abcde', 5)).toEqual(['abcde']);
  });

  // multiline.md: "split long lines between words where possible and leave
  // the space character at the end of the line".
  it('breaks between words and leaves the space at the end of the piece', () => {
    const text = 'one two three four five';
    const parts = splitIrcText(text, 10);
    expect(parts).toEqual(['one two ', 'three ', 'four five']);
    expect(parts.join('')).toBe(text);
    parts.forEach(part => expect(part.startsWith(' ')).toBe(false));
  });

  it('budgets Cyrillic by bytes', () => {
    const word = 'ђурђевак'; // 8 letters, 16 bytes
    const text = Array(60).fill(word).join(' ');
    const parts = splitIrcText(text, 100);
    expect(parts.length).toBeGreaterThan(1);
    expect(allFit(parts, 100)).toBe(true);
    expect(parts.join('')).toBe(text);
  });

  it('cuts a word longer than a piece where the budget runs out', () => {
    const url = `https://example.com/${'a'.repeat(50)}`;
    const parts = splitIrcText(url, 20);
    expect(allFit(parts, 20)).toBe(true);
    expect(parts.join('')).toBe(url);
  });

  it('never cuts inside a surrogate pair', () => {
    const text = '😀'.repeat(30);
    const parts = splitIrcText(text, 10);
    expect(allFit(parts, 10)).toBe(true);
    expect(parts.join('')).toBe(text);
    parts.forEach(part => expect(part).toMatch(/^(😀)+$/u));
  });

  it('keeps a ZWJ family emoji together', () => {
    const family = '👨‍👩‍👧‍👦'; // 25 bytes
    const text = `ab ${family}${family}`;
    expect(splitIrcText(text, 27)).toEqual(['ab ', family, family]);
  });

  it('keeps flags, skin tones and keycaps together', () => {
    const pieces = ['🇷🇸', '👍🏽', '1️⃣', 'é'];
    const text = pieces.join('').repeat(5);
    const parts = splitIrcText(text, 9);
    expect(parts.join('')).toBe(text);
    // Every piece starts on a whole symbol.
    parts.forEach(part =>
      expect(pieces.some(symbol => part.startsWith(symbol))).toBe(true),
    );
  });

  it('keeps a flag pair from splitting even next to another flag', () => {
    const text = '🇷🇸🇩🇪🇫🇷';
    const parts = splitIrcText(text, 8);
    expect(parts).toEqual(['🇷🇸', '🇩🇪', '🇫🇷']);
  });

  it('does not split an mIRC colour code from its numbers', () => {
    const text = `${'x'.repeat(8)}\x0304,12red`;
    const parts = splitIrcText(text, 10);
    expect(parts.join('')).toBe(text);
    expect(parts.some(part => part.startsWith('\x0304,12'))).toBe(true);
  });

  it('handles a colour code without background and a bare one', () => {
    const text = `${'x'.repeat(8)}\x035a\x03b`;
    const parts = splitIrcText(text, 9);
    expect(parts.join('')).toBe(text);
    expect(parts.some(part => part.startsWith('\x035'))).toBe(true);
  });

  it('keeps a comma after a colour without a background number', () => {
    const text = `${'x'.repeat(8)}\x034,word`;
    const parts = splitIrcText(text, 10);
    expect(parts.join('')).toBe(text);
  });

  it('does not split a hex colour code', () => {
    const text = `${'x'.repeat(5)}\x04FF0000,00FF00green`;
    const parts = splitIrcText(text, 16);
    expect(parts.join('')).toBe(text);
    expect(parts.some(part => part.startsWith('\x04FF0000,00FF00'))).toBe(true);
  });

  it('keeps a short hex colour code as it is', () => {
    const text = `${'x'.repeat(5)}\x04FF0,word`;
    const parts = splitIrcText(text, 8);
    expect(parts.join('')).toBe(text);
  });

  it('keeps every space of a run, never losing text', () => {
    const text = 'aaaa     bbbb';
    const parts = splitIrcText(text, 4);
    expect(parts.join('')).toBe(text);
    expect(allFit(parts, 4)).toBe(true);
  });

  it('gives a piece longer than the budget its own line rather than looping', () => {
    const family = '👨‍👩‍👧‍👦';
    expect(splitIrcText(`a ${family}`, 5)).toEqual(['a ', family]);
  });
});

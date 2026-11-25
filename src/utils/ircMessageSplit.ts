/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Splitting of user text into IRC-sized pieces.
 *
 * A server cuts every line at 512 bytes, counting the `:nick!user@host`
 * prefix it adds when relaying. Text longer than that has to leave the client
 * as several lines, or everyone else only sees its beginning. The limit is in
 * UTF-8 bytes, not characters, so Cyrillic or emoji fill a line much faster
 * than ASCII.
 */

/** UTF-8 byte length of one code point. */
const codePointBytes = (code: number): number =>
  code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;

/** UTF-8 byte length of a string. */
export function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const character of value) {
    bytes += codePointBytes(character.codePointAt(0) ?? 0);
  }
  return bytes;
}

const ZWJ = 0x200d;

/** Code points that belong to the character before them. */
const attachesToPrevious = (code: number): boolean =>
  code === ZWJ ||
  code === 0xfe0e ||
  code === 0xfe0f ||
  code === 0x20e3 || // keycap
  (code >= 0x1f3fb && code <= 0x1f3ff) || // skin tone modifiers
  (code >= 0x0300 && code <= 0x036f) || // combining diacritics
  (code >= 0x1ab0 && code <= 0x1aff) ||
  (code >= 0x1dc0 && code <= 0x1dff) ||
  (code >= 0x20d0 && code <= 0x20ff) ||
  (code >= 0xfe20 && code <= 0xfe2f) ||
  (code >= 0xe0020 && code <= 0xe007f); // emoji tag sequences (sub-flags)

const isRegionalIndicator = (code: number): boolean =>
  code >= 0x1f1e6 && code <= 0x1f1ff;

const isDigit = (character: string | undefined): boolean =>
  character !== undefined && character >= '0' && character <= '9';

const isHex = (character: string | undefined): boolean =>
  character !== undefined && /^[0-9a-fA-F]$/.test(character);

interface Atom {
  text: string;
  bytes: number;
  isSpace: boolean;
}

/** How many characters after `start` a run of up to `max` matching ones takes. */
const runLength = (
  characters: string[],
  start: number,
  max: number,
  matches: (character: string | undefined) => boolean,
): number => {
  let length = 0;
  while (length < max && matches(characters[start + length])) length += 1;
  return length;
};

/**
 * Break text into pieces that must stay together: a character with its
 * combining marks, a whole emoji sequence, a flag, or an mIRC colour code with
 * its numbers. Cutting inside any of these would send broken text.
 */
function toAtoms(text: string): Atom[] {
  const characters = Array.from(text);
  const atoms: Atom[] = [];
  let index = 0;
  let joinNext = false;

  while (index < characters.length) {
    const character = characters[index];
    const code = character.codePointAt(0) ?? 0;
    let piece = character;
    let consumed = 1;

    if (character === '\x03') {
      // \x03[NN[,NN]]
      const foreground = runLength(characters, index + 1, 2, isDigit);
      consumed += foreground;
      if (foreground > 0 && characters[index + consumed] === ',') {
        const background = runLength(
          characters,
          index + consumed + 1,
          2,
          isDigit,
        );
        if (background > 0) consumed += 1 + background;
      }
      piece = characters.slice(index, index + consumed).join('');
    } else if (character === '\x04') {
      // \x04[RRGGBB[,RRGGBB]]
      const foreground = runLength(characters, index + 1, 6, isHex);
      consumed += foreground;
      if (foreground === 6 && characters[index + consumed] === ',') {
        const background = runLength(
          characters,
          index + consumed + 1,
          6,
          isHex,
        );
        if (background === 6) consumed += 1 + background;
      }
      piece = characters.slice(index, index + consumed).join('');
    }

    const previous = atoms[atoms.length - 1];
    const glue =
      previous !== undefined &&
      consumed === 1 &&
      (joinNext ||
        attachesToPrevious(code) ||
        (isRegionalIndicator(code) &&
          Array.from(previous.text).length === 1 &&
          isRegionalIndicator(previous.text.codePointAt(0) ?? 0)));

    const bytes = utf8ByteLength(piece);
    if (glue) {
      previous.text += piece;
      previous.bytes += bytes;
      previous.isSpace = false;
    } else {
      atoms.push({ text: piece, bytes, isSpace: piece === ' ' });
    }
    joinNext = consumed === 1 && code === ZWJ;
    index += consumed;
  }

  return atoms;
}

/**
 * Split `text` into pieces of at most `maxBytes` UTF-8 bytes each.
 *
 * Pieces break between words and keep the space at the end of the piece, as
 * IRCv3 multiline recommends ("Splitting long lines"): joined back with
 * nothing in between they give the original text exactly, and no fallback
 * line starts with a space. A word longer than a whole piece (a long URL) is
 * cut where the budget runs out. Nothing breaks inside a character, an emoji
 * sequence or an mIRC colour code. Text that fits comes back as one piece.
 */
export function splitIrcText(text: string, maxBytes: number): string[] {
  if (!text) return [];
  if (utf8ByteLength(text) <= maxBytes) return [text];

  const atoms = toAtoms(text);
  const parts: string[] = [];
  let current: Atom[] = [];
  let currentBytes = 0;
  // Length of `current` up to and including its last space.
  let breakAfter = 0;

  const flush = (until: number) => {
    const piece = current
      .slice(0, until)
      .map(atom => atom.text)
      .join('');
    if (piece.length > 0) parts.push(piece);
    current = current.slice(until);
    currentBytes = current.reduce((sum, atom) => sum + atom.bytes, 0);
    breakAfter = 0;
    current.forEach((atom, position) => {
      if (atom.isSpace) breakAfter = position + 1;
    });
  };

  for (const atom of atoms) {
    if (currentBytes + atom.bytes > maxBytes && current.length > 0) {
      // Break after the last space; with none, the word is longer than a
      // whole piece and is cut here.
      flush(breakAfter > 0 ? breakAfter : current.length);
    }
    current.push(atom);
    currentBytes += atom.bytes;
    if (atom.isSpace) breakAfter = current.length;
  }
  flush(current.length);

  return parts;
}

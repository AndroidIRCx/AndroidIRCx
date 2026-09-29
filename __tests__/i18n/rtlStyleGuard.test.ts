/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Keeps the interface mirror-able.
 *
 * React Native mirrors `flexDirection: 'row'` and `textAlign: 'left'` by itself
 * under RTL. It does NOT mirror `marginLeft`, `paddingRight`, a `left` offset
 * or a left border — those stay physically where they are, so a screen written
 * with them comes out half-backwards in Arabic or Hebrew while looking perfect
 * in every language shipped today.
 *
 * That is why this guard exists before an RTL language does: the cost of
 * writing `marginStart` is nothing, and the cost of finding 200 of them
 * afterwards, by eye, in a language the author cannot read, is considerable.
 *
 * If this fails on a file you just wrote, swap the property:
 *
 *   marginLeft      -> marginStart        paddingLeft  -> paddingStart
 *   marginRight     -> marginEnd          paddingRight -> paddingEnd
 *   borderLeftWidth -> borderStartWidth   left: n      -> start: n
 *   borderLeftColor -> borderStartColor   right: n     -> end: n
 *   textAlign: 'right' -> textAlign: 'end'
 *
 * Something that must stay physical regardless of language — a hardware
 * drawing, a diagram — goes in ALLOWED below with a line saying why.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const SRC = join(__dirname, '..', '..', 'src');

/** Style properties that do not mirror, and what to write instead. */
const PHYSICAL: Array<[RegExp, string]> = [
  [/\bmarginLeft\s*:/g, 'marginStart'],
  [/\bmarginRight\s*:/g, 'marginEnd'],
  [/\bpaddingLeft\s*:/g, 'paddingStart'],
  [/\bpaddingRight\s*:/g, 'paddingEnd'],
  [/\bborderLeftWidth\s*:/g, 'borderStartWidth'],
  [/\bborderRightWidth\s*:/g, 'borderEndWidth'],
  [/\bborderLeftColor\s*:/g, 'borderStartColor'],
  [/\bborderRightColor\s*:/g, 'borderEndColor'],
  [/\bborderTopLeftRadius\s*:/g, 'borderTopStartRadius'],
  [/\bborderTopRightRadius\s*:/g, 'borderTopEndRadius'],
  [/\bborderBottomLeftRadius\s*:/g, 'borderBottomStartRadius'],
  [/\bborderBottomRightRadius\s*:/g, 'borderBottomEndRadius'],
  [/textAlign\s*:\s*'(left|right)'/g, "textAlign: 'start' / 'end'"],
];

/**
 * Files that may keep physical properties, each with the reason.
 * Paths are relative to `src/`, with forward slashes.
 */
const ALLOWED: Record<string, string> = {
  // The user picks which physical side the nick list sits on, and the tab
  // indicator follows that choice. "List on the left" has to mean the left,
  // whatever language the interface is in — it is a layout preference, not a
  // reading direction.
  'components/AppLayout.tsx': 'userListPosition is an explicit physical choice',
  'components/ChannelTabs.tsx':
    'the active-tab indicator follows userListPosition',
};

const sourceFiles = (dir: string): string[] => {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === '__mocks__') continue;
      out.push(...sourceFiles(full));
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith('.d.ts')) out.push(full);
  }
  return out;
};

const relative = (file: string) =>
  file.slice(SRC.length + 1).replace(/\\/g, '/');

const escapeForRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

describe('the interface can be mirrored', () => {
  const files = sourceFiles(SRC);

  it('reads the whole source tree', () => {
    // A guard that silently scans nothing passes forever.
    expect(files.length).toBeGreaterThan(200);
  });

  /**
   * A lone `right: 16` pins something to one physical edge, and stays there in
   * Arabic. Its symmetric cousin — `left: 0` next to `right: 0` — only
   * stretches an element across the screen and reads the same either way
   * round, so it is left alone rather than churned for nothing.
   */
  it('pins nothing to one physical edge', () => {
    const offences: string[] = [];

    for (const file of files) {
      const name = relative(file);
      if (ALLOWED[name]) continue;

      const lines = readFileSync(file, 'utf8').split(/\r?\n/);
      lines.forEach((line, index) => {
        const match = /^\s*(left|right)\s*:\s*(.+?),?\s*$/.exec(line);
        if (!match) return;

        const [, side, value] = match;
        const opposite = side === 'left' ? 'right' : 'left';
        // The pair is rarely on the very next line — `right: 0, top: 0,
        // left: 0` is as common — so look through the rest of the style
        // object, which a closing brace ends.
        const pairPattern = new RegExp(
          `^\\s*${opposite}\\s*:\\s*${escapeForRegex(value)},?\\s*$`,
        );
        const sameObject = (from: number, step: number) => {
          for (let i = from; i >= 0 && i < lines.length; i += step) {
            const current = lines[i];
            if (/^\s*\}/.test(current) || /\{\s*$/.test(current)) return false;
            if (pairPattern.test(current)) return true;
          }
          return false;
        };
        if (sameObject(index - 1, -1) || sameObject(index + 1, 1)) return;

        offences.push(
          `${name}:${index + 1}  ${line.trim()}   -> use ${
            side === 'left' ? 'start' : 'end'
          }`,
        );
      });
    }

    expect(offences).toEqual([]);
  });

  it('uses no style property that refuses to mirror', () => {
    const offences: string[] = [];

    for (const file of files) {
      const name = relative(file);
      if (ALLOWED[name]) continue;

      const source = readFileSync(file, 'utf8');
      const lines = source.split(/\r?\n/);

      lines.forEach((line, index) => {
        for (const [pattern, replacement] of PHYSICAL) {
          pattern.lastIndex = 0;
          if (pattern.test(line)) {
            offences.push(
              `${name}:${index + 1}  ${line.trim()}   -> use ${replacement}`,
            );
          }
        }
      });
    }

    expect(offences).toEqual([]);
  });
});

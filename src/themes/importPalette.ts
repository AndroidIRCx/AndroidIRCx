/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Pure palette-import parser. Turns arbitrary pasted text into a structure the
 * theme editor can act on, with no UI or side effects. Three input shapes are
 * supported:
 *
 *  1. Key/value lines — `background: #101010` or `messageNick #89b4fa`, one per
 *     line, colon/equals/whitespace separated. Keys map to {@link ThemeColors}
 *     field names case-insensitively; unknown keys are ignored.
 *  2. A JSON object — either `{ "colors": { ... } }` or a bare
 *     `{ background: "...", ... }` (unquoted keys and single quotes tolerated).
 *  3. A bare list of hex codes (comma/space/newline separated, e.g. an exported
 *     mIRC 16-colour set). These are returned in order as `hexes` together with
 *     a suggested seed so the caller can feed generate-from-seed.
 *
 * Only valid #RGB / #RRGGBB colours are accepted; every hex is normalised to a
 * canonical upper-case #RRGGBB via {@link hexToRgb} + {@link rgbToHex}. The
 * parser never throws — junk input yields an empty result.
 */

import type { ThemeColors } from '../services/ThemeService';
import { hexToRgb, rgbToHex, contrastRatio } from './palette';

export interface ParsedPalette {
  /** Colours resolved from key/value lines or a JSON object (may be empty). */
  colors: Partial<ThemeColors>;
  /** Every valid hex found, normalised and in encounter order. */
  hexes: string[];
  /** Suggested seed, present only when a bare hex list was detected. */
  seed?: { background: string; accent: string; text: string };
  /** Number of {@link ThemeColors} keys resolved into `colors`. */
  matchedKeys: number;
}

/**
 * Canonical list of {@link ThemeColors} keys. Kept in sync with the interface in
 * ThemeService.ts. Used to map incoming key names (case-insensitively) onto the
 * real field names.
 */
const THEME_COLOR_KEYS: (keyof ThemeColors)[] = [
  'background',
  'surface',
  'surfaceVariant',
  'surfaceAlt',
  'cardBackground',
  'text',
  'textSecondary',
  'textDisabled',
  'primary',
  'primaryDark',
  'primaryLight',
  'onPrimary',
  'secondary',
  'onSecondary',
  'accent',
  'onAccent',
  'success',
  'error',
  'warning',
  'info',
  'border',
  'borderLight',
  'divider',
  'messageBackground',
  'messageText',
  'messageNick',
  'messageTimestamp',
  'systemMessage',
  'noticeMessage',
  'joinMessage',
  'partMessage',
  'quitMessage',
  'kickMessage',
  'nickMessage',
  'inviteMessage',
  'monitorMessage',
  'topicMessage',
  'modeMessage',
  'actionMessage',
  'rawMessage',
  'ctcpMessage',
  'inputBackground',
  'inputText',
  'inputBorder',
  'inputPlaceholder',
  'buttonPrimary',
  'buttonPrimaryText',
  'buttonSecondary',
  'buttonSecondaryText',
  'buttonDisabled',
  'buttonDisabledText',
  'buttonText',
  'tabActive',
  'tabInactive',
  'tabActiveText',
  'tabInactiveText',
  'tabBorder',
  'modalOverlay',
  'modalBackground',
  'modalText',
  'userListBackground',
  'userListText',
  'userListBorder',
  'userOwner',
  'userAdmin',
  'userOp',
  'userHalfop',
  'userVoice',
  'userNormal',
  'highlightBackground',
  'highlightText',
  'selectionBackground',
];

/** lower-case incoming key -> canonical ThemeColors key. */
const KEY_LOOKUP: Map<string, keyof ThemeColors> = new Map(
  THEME_COLOR_KEYS.map(key => [key.toLowerCase(), key]),
);

/** Matches a #RGB or #RRGGBB token not immediately followed by another hex digit. */
const HEX_TOKEN = /#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-fA-F])/g;

/** The same token, anchored to the start of a string. */
const LEADING_HEX = /^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-fA-F])/;

const EMPTY_RESULT = (): ParsedPalette => ({
  colors: {},
  hexes: [],
  matchedKeys: 0,
});

/** Normalise a raw hex string to canonical #RRGGBB, or null if invalid. */
const normalizeHex = (raw: string): string | null => {
  const rgb = hexToRgb(raw);
  return rgb ? rgbToHex(rgb) : null;
};

/** True when a line is only a comment (leading `#`/`//` that is not a hex). */
const isCommentOnly = (trimmed: string): boolean => {
  if (trimmed.startsWith('//')) {
    return true;
  }
  if (trimmed.startsWith('#')) {
    // A `#`-prefixed line is a comment only when it does not begin with a hex.
    return !LEADING_HEX.test(trimmed);
  }
  return false;
};

/** HSV-style saturation (0..1) of a hex; 0 for greys/invalid. */
const saturation = (hex: string): number => {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return 0;
  }
  const max = Math.max(rgb.r, rgb.g, rgb.b);
  const min = Math.min(rgb.r, rgb.g, rgb.b);
  return max === 0 ? 0 : (max - min) / max;
};

/** Best-effort parse of a possibly non-strict JSON object; null on failure. */
const tryParseObject = (text: string): Record<string, unknown> | null => {
  const attempt = (source: string): Record<string, unknown> | null => {
    try {
      const parsed = JSON.parse(source);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  };

  const direct = attempt(text);
  if (direct) {
    return direct;
  }

  // Lenient pass: quote bare keys and convert single-quoted strings.
  const relaxed = text
    .replace(/([,{]\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*:)/g, '$1"$2"$3')
    .replace(/'/g, '"')
    .replace(/,(\s*[}\]])/g, '$1');
  return attempt(relaxed);
};

/** Pull known ThemeColors keys out of a plain object of hex-ish values. */
const extractColorsFromObject = (
  source: Record<string, unknown>,
  into: Partial<ThemeColors>,
): void => {
  for (const [key, value] of Object.entries(source)) {
    if (typeof value !== 'string') {
      continue;
    }
    const canonical = KEY_LOOKUP.get(key.toLowerCase());
    if (!canonical) {
      continue;
    }
    const normalized = normalizeHex(value.trim());
    if (normalized) {
      into[canonical] = normalized;
    }
  }
};

/** Parse a single `key: value` / `key value` line into `into` if it matches. */
const parseKeyValueLine = (line: string, into: Partial<ThemeColors>): void => {
  // Drop leading object/array punctuation so multi-line JSON-ish blocks work.
  const cleaned = line.replace(/^[{[\s]+/, '').trim();
  const match = cleaned.match(
    /^["']?([A-Za-z][A-Za-z0-9_]*)["']?\s*[:=\s]\s*(.+)$/,
  );
  if (!match) {
    return;
  }
  const canonical = KEY_LOOKUP.get(match[1].toLowerCase());
  if (!canonical) {
    return;
  }
  const hexMatch = match[2].match(
    /#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-fA-F])/,
  );
  if (!hexMatch) {
    return;
  }
  const normalized = normalizeHex(hexMatch[0]);
  if (normalized) {
    into[canonical] = normalized;
  }
};

/** Build a seed from an ordered hex list (assumes at least two entries). */
const buildSeed = (
  hexes: string[],
): { background: string; accent: string; text: string } => {
  const background = hexes[0];

  // Text: the entry with the strongest contrast against the background.
  let text = hexes[1] ?? background;
  let bestContrast = -1;
  for (const hex of hexes) {
    const ratio = contrastRatio(background, hex);
    if (ratio > bestContrast) {
      bestContrast = ratio;
      text = hex;
    }
  }

  // Accent: the most saturated entry, preferring ones that aren't the
  // background or the chosen text so the trio stays distinct.
  let accent = hexes[1] ?? background;
  let bestSat = -1;
  for (const hex of hexes) {
    if (hex === background || hex === text) {
      continue;
    }
    const sat = saturation(hex);
    if (sat > bestSat) {
      bestSat = sat;
      accent = hex;
    }
  }
  if (bestSat < 0) {
    // Everything collapsed onto background/text; fall back to most saturated.
    for (const hex of hexes) {
      const sat = saturation(hex);
      if (sat > bestSat) {
        bestSat = sat;
        accent = hex;
      }
    }
  }

  return { background, accent, text };
};

/**
 * Parse pasted palette text into a {@link ParsedPalette}. Never throws.
 */
export const parsePalette = (text: string): ParsedPalette => {
  if (typeof text !== 'string' || text.trim().length === 0) {
    return EMPTY_RESULT();
  }

  const colors: Partial<ThemeColors> = {};

  // 1. JSON object (strict or lenient). `{ "colors": {...} }` or a bare object.
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) {
    const obj = tryParseObject(trimmed);
    if (obj) {
      const nested = obj.colors;
      const source =
        nested && typeof nested === 'object' && !Array.isArray(nested)
          ? (nested as Record<string, unknown>)
          : obj;
      extractColorsFromObject(source, colors);
    }
  }

  // 2. Key/value lines + hex collection, per line so comments are respected.
  const lines = text.split(/\r?\n/);
  const hexes: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (t.length === 0 || isCommentOnly(t)) {
      continue;
    }
    parseKeyValueLine(t, colors);
    const found = t.match(HEX_TOKEN);
    if (found) {
      for (const raw of found) {
        const normalized = normalizeHex(raw);
        if (normalized) {
          hexes.push(normalized);
        }
      }
    }
  }

  const matchedKeys = Object.keys(colors).length;

  const result: ParsedPalette = { colors, hexes, matchedKeys };

  // 3. Bare hex list: no keyed matches but several colours present.
  if (matchedKeys === 0 && hexes.length >= 2) {
    result.seed = buildSeed(hexes);
  }

  return result;
};

/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * shareTheme.ts
 *
 * Pure, UI-less utility to turn a theme into a compact, copy-pasteable share
 * CODE and back. The code is a short prefix followed by url-safe base64 of a
 * JSON payload, so it survives being pasted into chat, a message box, or (in a
 * future feature) encoded as a QR image. This module has no side effects and
 * never throws — decode returns null on anything malformed.
 *
 * Payload shape mirrors ThemeService.exportTheme/importTheme
 * ({ name, colors, messageFormats }) so the two stay interchangeable.
 */

import { Buffer } from 'buffer';
import type {
  ThemeColors,
  ThemeMessageFormats,
} from '../services/ThemeService';

/** Prefix that tags a string as an AndroidIRCX share code (version 1). */
export const SHARE_PREFIX = 'AIRCX1:';

/** The decoded, validated contents of a theme share code. */
export interface SharePayload {
  name: string;
  colors: ThemeColors;
  messageFormats?: ThemeMessageFormats;
}

/** On-wire JSON shape carried inside the base64 blob. */
interface WirePayload {
  v: number;
  name: string;
  colors: ThemeColors;
  messageFormats?: ThemeMessageFormats;
}

/** Convert standard base64 to url-safe base64 (no +, /, or = padding). */
const toBase64Url = (base64: string): string =>
  base64.replace(/\+/g, '-').replace(/[/]/g, '_').replace(/[=]+$/, '');

/** Convert url-safe base64 back to standard base64 (Buffer ignores padding). */
const fromBase64Url = (base64url: string): string =>
  base64url.replace(/-/g, '+').replace(/_/g, '/');

/**
 * Encode a theme into a compact, copy-pasteable share code.
 *
 * @returns e.g. "AIRCX1:<base64url>" — a prefixed, url-safe base64 of the JSON
 *          payload { v, name, colors, messageFormats }.
 */
export const encodeThemeShare = (theme: {
  name: string;
  colors: ThemeColors;
  messageFormats?: ThemeMessageFormats;
}): string => {
  const payload: WirePayload = {
    v: 1,
    name: theme.name,
    colors: theme.colors,
  };
  if (theme.messageFormats) {
    payload.messageFormats = theme.messageFormats;
  }
  const json = JSON.stringify(payload);
  const base64url = toBase64Url(Buffer.from(json, 'utf-8').toString('base64'));
  return `${SHARE_PREFIX}${base64url}`;
};

/**
 * Decode a share code back into a theme payload.
 *
 * Tolerant: strips surrounding whitespace and accepts the code with or without
 * the "AIRCX1:" prefix. Returns null on anything malformed — non-string input,
 * empty string, invalid base64, unparseable JSON, or a payload that lacks a
 * `colors` object. Never throws.
 */
export const decodeThemeShare = (code: string): SharePayload | null => {
  try {
    if (typeof code !== 'string') {
      return null;
    }

    // Strip all whitespace (leading/trailing, and any newlines/spaces that a
    // paste or QR line-wrap may have introduced inside the base64 body).
    let body = code.replace(/\s+/g, '');
    if (!body) {
      return null;
    }

    // Accept with or without the version prefix (case-insensitive).
    if (body.toUpperCase().startsWith(SHARE_PREFIX)) {
      body = body.slice(SHARE_PREFIX.length);
    }
    if (!body) {
      return null;
    }

    const json = Buffer.from(fromBase64Url(body), 'base64').toString('utf-8');
    if (!json) {
      return null;
    }

    const parsed = JSON.parse(json) as Partial<WirePayload>;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof parsed.colors !== 'object' ||
      parsed.colors === null ||
      Array.isArray(parsed.colors)
    ) {
      return null;
    }

    const result: SharePayload = {
      name: typeof parsed.name === 'string' ? parsed.name : '',
      colors: parsed.colors as ThemeColors,
    };
    if (parsed.messageFormats) {
      result.messageFormats = parsed.messageFormats;
    }
    return result;
  } catch {
    return null;
  }
};

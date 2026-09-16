/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DARK_THEME } from '../../src/themes';
import {
  SHARE_PREFIX,
  encodeThemeShare,
  decodeThemeShare,
} from '../../src/themes/shareTheme';

describe('shareTheme', () => {
  it('encodes to a non-empty string carrying the prefix', () => {
    const code = encodeThemeShare(DARK_THEME);
    expect(typeof code).toBe('string');
    expect(code.length).toBeGreaterThan(0);
    expect(code.startsWith(SHARE_PREFIX)).toBe(true);
  });

  it('round-trips name and colors via encode -> decode', () => {
    const code = encodeThemeShare(DARK_THEME);
    const decoded = decodeThemeShare(code);
    expect(decoded).not.toBeNull();
    expect(decoded?.name).toBe(DARK_THEME.name);
    expect(decoded?.colors).toEqual(DARK_THEME.colors);
  });

  it('round-trips messageFormats when present', () => {
    expect(DARK_THEME.messageFormats).toBeDefined();
    const code = encodeThemeShare({
      name: DARK_THEME.name,
      colors: DARK_THEME.colors,
      messageFormats: DARK_THEME.messageFormats,
    });
    const decoded = decodeThemeShare(code);
    expect(decoded?.messageFormats).toEqual(DARK_THEME.messageFormats);
  });

  it('omits messageFormats when the source theme has none', () => {
    const code = encodeThemeShare({
      name: DARK_THEME.name,
      colors: DARK_THEME.colors,
    });
    const decoded = decodeThemeShare(code);
    expect(decoded).not.toBeNull();
    expect(decoded?.messageFormats).toBeUndefined();
  });

  it('tolerates surrounding whitespace', () => {
    const code = encodeThemeShare(DARK_THEME);
    const decoded = decodeThemeShare(`  \n  ${code}  \t\n`);
    expect(decoded?.name).toBe(DARK_THEME.name);
    expect(decoded?.colors).toEqual(DARK_THEME.colors);
  });

  it('tolerates a missing prefix', () => {
    const code = encodeThemeShare(DARK_THEME);
    const withoutPrefix = code.slice(SHARE_PREFIX.length);
    const decoded = decodeThemeShare(withoutPrefix);
    expect(decoded?.name).toBe(DARK_THEME.name);
    expect(decoded?.colors).toEqual(DARK_THEME.colors);
  });

  it('produces url-safe base64 (no +, /, or = characters)', () => {
    const code = encodeThemeShare(DARK_THEME);
    const body = code.slice(SHARE_PREFIX.length);
    expect(body).not.toMatch(/[+/=]/);
  });

  it('returns null for garbage input', () => {
    expect(decodeThemeShare('garbage')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(decodeThemeShare('')).toBeNull();
  });

  it('returns null when the JSON payload lacks a colors object', () => {
    const noColors = Buffer.from(
      JSON.stringify({ v: 1, name: 'x' }),
      'utf-8',
    ).toString('base64');
    expect(decodeThemeShare(`${SHARE_PREFIX}${noColors}`)).toBeNull();
  });

  it('returns null when the payload is valid base64 but not JSON', () => {
    const notJson = Buffer.from('not json at all', 'utf-8').toString('base64');
    expect(decodeThemeShare(`${SHARE_PREFIX}${notJson}`)).toBeNull();
  });
});

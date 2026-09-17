/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Registry + validation guard for every built-in theme. New themes added to
 * BUILT_IN_THEMES are validated here automatically — no per-theme test needed.
 */

import {
  BUILT_IN_THEMES,
  DEFAULT_THEME,
  getBuiltInTheme,
  isBuiltInThemeId,
  DARK_THEME,
} from '../../src/themes';
import type { ThemeColors } from '../../src/services/ThemeService';
import { contrastRatio } from '../../src/themes/palette';

// DARK_THEME is complete, so its keys are the canonical 71-colour contract.
const REQUIRED_COLOR_KEYS = Object.keys(DARK_THEME.colors) as Array<
  keyof ThemeColors
>;

const isValidColor = (value: unknown): boolean =>
  typeof value === 'string' &&
  (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value) ||
    value.startsWith('rgba('));

describe('themes/registry', () => {
  it('contains at least the three original built-ins', () => {
    const ids = BUILT_IN_THEMES.map(t => t.id);
    expect(ids).toEqual(expect.arrayContaining(['dark', 'light', 'ircap']));
  });

  it('has unique, non-empty theme ids', () => {
    const ids = BUILT_IN_THEMES.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach(id => expect(id.length).toBeGreaterThan(0));
  });

  it('resolves built-ins by id and rejects unknown/custom ids', () => {
    expect(getBuiltInTheme('dark')).toBe(DARK_THEME);
    expect(getBuiltInTheme('nope')).toBeUndefined();
    expect(isBuiltInThemeId('light')).toBe(true);
    expect(isBuiltInThemeId('custom_123')).toBe(false);
  });

  it('uses the dark theme as the default fallback', () => {
    expect(DEFAULT_THEME.id).toBe('dark');
  });
});

describe.each(BUILT_IN_THEMES.map(theme => [theme.name || theme.id, theme]))(
  'built-in theme: %s',
  (_label, theme) => {
    it('is a well-formed, non-custom theme', () => {
      expect(theme.id.length).toBeGreaterThan(0);
      expect((theme.name || '').length).toBeGreaterThan(0);
      expect(theme.isCustom).toBe(false);
    });

    it('defines all 71 colour keys and no unknown extras', () => {
      const keys = Object.keys(theme.colors);
      for (const key of REQUIRED_COLOR_KEYS) {
        expect(theme.colors[key]).toBeDefined();
      }
      expect(keys.sort()).toEqual([...REQUIRED_COLOR_KEYS].sort());
    });

    it('has valid hex/rgba values for every colour', () => {
      for (const key of REQUIRED_COLOR_KEYS) {
        expect({
          key,
          value: theme.colors[key],
          ok: isValidColor(theme.colors[key]),
        }).toEqual({ key, value: theme.colors[key], ok: true });
      }
    });

    it('keeps body text readable (WCAG AA) against its backgrounds', () => {
      expect(
        contrastRatio(theme.colors.text, theme.colors.background),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(theme.colors.messageText, theme.colors.messageBackground),
      ).toBeGreaterThanOrEqual(4.5);
    });
  },
);

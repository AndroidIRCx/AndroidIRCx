/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { deriveThemeColors } from '../../src/themes/generateTheme';
import { DARK_THEME } from '../../src/themes/DarkTheme';
import { contrastRatio } from '../../src/themes/palette';

const EXPECTED_KEYS = Object.keys(DARK_THEME.colors);

const isValidColor = (value: string): boolean => {
  const hex = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;
  const rgba = /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d.]+\s*)?\)$/;
  return hex.test(value) || rgba.test(value);
};

const SEEDS = [
  {
    name: 'dark bg, no text',
    seed: { background: '#121212', accent: '#4CAF50' },
  },
  {
    name: 'light bg, no text',
    seed: { background: '#FFFFFF', accent: '#2196F3' },
  },
  {
    name: 'dark bg with text',
    seed: { background: '#0B1E33', accent: '#E91E63', text: '#E3F2FD' },
  },
  {
    name: 'light bg with text',
    seed: { background: '#FAFAFA', accent: '#7C3AED', text: '#1A1A1A' },
  },
  {
    name: 'mid bg forced dark',
    seed: { background: '#3A3A3A', accent: '#FF9800', mode: 'dark' as const },
  },
  {
    name: 'mid bg forced light',
    seed: { background: '#C8C8C8', accent: '#0F766E', mode: 'light' as const },
  },
];

describe('deriveThemeColors', () => {
  describe.each(SEEDS)('$name', ({ seed }) => {
    const colors = deriveThemeColors(seed);

    it('populates every ThemeColors key', () => {
      for (const key of EXPECTED_KEYS) {
        expect(colors).toHaveProperty(key);
        expect(typeof (colors as Record<string, string>)[key]).toBe('string');
      }
      expect(Object.keys(colors).sort()).toEqual([...EXPECTED_KEYS].sort());
    });

    it('produces only valid colour values', () => {
      for (const key of EXPECTED_KEYS) {
        const value = (colors as Record<string, string>)[key];
        expect(isValidColor(value)).toBe(true);
      }
    });

    it('clears WCAG AA for text on background', () => {
      expect(
        contrastRatio(colors.text, colors.background),
      ).toBeGreaterThanOrEqual(4.5);
    });

    it('clears WCAG AA for messageText on messageBackground', () => {
      expect(
        contrastRatio(colors.messageText, colors.messageBackground),
      ).toBeGreaterThanOrEqual(4.5);
    });
  });

  it('honours a provided text seed when it is already readable', () => {
    const colors = deriveThemeColors({
      background: '#101010',
      accent: '#4CAF50',
      text: '#FAFAFA',
    });
    expect(colors.text).toBe('#FAFAFA');
  });

  it('detects a dark theme from a dark background', () => {
    const colors = deriveThemeColors({
      background: '#121212',
      accent: '#4CAF50',
    });
    // Dark theme: surfaces are lightened above the background luminance.
    expect(colors.userOwner).toBe('#9C27B0'); // ROLE_COLORS_DARK.owner
  });

  it('detects a light theme from a light background', () => {
    const colors = deriveThemeColors({
      background: '#FFFFFF',
      accent: '#2196F3',
    });
    expect(colors.userOwner).toBe('#7B1FA2'); // ROLE_COLORS_LIGHT.owner
    expect(colors.modalOverlay).toBe('rgba(0, 0, 0, 0.5)');
  });

  it('respects an explicit mode override', () => {
    const dark = deriveThemeColors({
      background: '#FFFFFF',
      accent: '#2196F3',
      mode: 'dark',
    });
    // Forced dark on a light background still uses the dark role ramp.
    expect(dark.userOwner).toBe('#9C27B0');
    expect(dark.modalOverlay).toBe('rgba(0, 0, 0, 0.7)');
  });
});

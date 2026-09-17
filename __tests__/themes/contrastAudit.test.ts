/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { ThemeColors } from '../../src/services/ThemeService';
import {
  auditThemeColors,
  failingContrast,
} from '../../src/themes/contrastAudit';
import { DARK_THEME } from '../../src/themes/DarkTheme';

describe('contrastAudit', () => {
  describe('auditThemeColors', () => {
    it('returns entries for the dark theme', () => {
      const checks = auditThemeColors(DARK_THEME.colors);
      expect(checks.length).toBeGreaterThan(0);
    });

    it('passes AA for the core text pairs in the dark theme', () => {
      const checks = auditThemeColors(DARK_THEME.colors);
      const corePairs: Array<[keyof ThemeColors, keyof ThemeColors]> = [
        ['text', 'background'],
        ['textSecondary', 'background'],
        ['messageText', 'messageBackground'],
        ['inputText', 'inputBackground'],
        ['modalText', 'modalBackground'],
        ['userNormal', 'userListBackground'],
      ];

      for (const [fg, bg] of corePairs) {
        const check = checks.find(c => c.fg === fg && c.bg === bg);
        expect(check).toBeDefined();
        expect(check?.passesAA).toBe(true);
      }
    });

    it('sets passesAALarge whenever passesAA is set', () => {
      const checks = auditThemeColors(DARK_THEME.colors);
      for (const check of checks) {
        if (check.passesAA) {
          expect(check.passesAALarge).toBe(true);
        }
      }
    });

    it('rounds ratios to at most two decimal places', () => {
      const checks = auditThemeColors(DARK_THEME.colors);
      for (const check of checks) {
        expect(check.ratio).toBe(Math.round(check.ratio * 100) / 100);
      }
    });
  });

  describe('failingContrast', () => {
    it('is empty for the well-designed dark theme core pairs', () => {
      const failures = failingContrast(DARK_THEME.colors);
      const textOnBackground = failures.find(
        c => c.fg === 'text' && c.bg === 'background',
      );
      expect(textOnBackground).toBeUndefined();
    });

    it('flags a deliberately low-contrast text/background pair', () => {
      const badColors: ThemeColors = {
        ...DARK_THEME.colors,
        text: '#333333',
        background: '#222222',
      };

      const failures = failingContrast(badColors);
      const textOnBackground = failures.find(
        c => c.fg === 'text' && c.bg === 'background',
      );

      expect(textOnBackground).toBeDefined();
      expect(textOnBackground?.passesAA).toBe(false);
      expect(textOnBackground?.ratio).toBeLessThan(4.5);
    });

    it('only returns entries that fail AA', () => {
      const badColors: ThemeColors = {
        ...DARK_THEME.colors,
        text: '#333333',
        background: '#222222',
      };
      const failures = failingContrast(badColors);
      for (const check of failures) {
        expect(check.passesAA).toBe(false);
      }
    });
  });
});

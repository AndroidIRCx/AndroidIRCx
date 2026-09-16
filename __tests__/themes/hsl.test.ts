/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  hexToHsl,
  hslToHex,
  withHue,
  withSaturation,
  withLightness,
  shades,
} from '../../src/themes/hsl';
import { hexToRgb } from '../../src/themes/palette';

/** Assert two hexes are equal within ±1 per RGB channel. */
const expectClose = (actual: string, expected: string): void => {
  const a = hexToRgb(actual);
  const b = hexToRgb(expected);
  expect(a).not.toBeNull();
  expect(b).not.toBeNull();
  if (!a || !b) {
    return;
  }
  expect(Math.abs(a.r - b.r)).toBeLessThanOrEqual(1);
  expect(Math.abs(a.g - b.g)).toBeLessThanOrEqual(1);
  expect(Math.abs(a.b - b.b)).toBeLessThanOrEqual(1);
};

describe('themes/hsl', () => {
  describe('hexToHsl', () => {
    it('maps pure red to h=0 s=100 l=50', () => {
      expect(hexToHsl('#FF0000')).toEqual({ h: 0, s: 100, l: 50 });
    });

    it('maps pure green to h=120', () => {
      expect(hexToHsl('#00FF00')).toEqual({ h: 120, s: 100, l: 50 });
    });

    it('maps pure blue to h=240', () => {
      expect(hexToHsl('#0000FF')).toEqual({ h: 240, s: 100, l: 50 });
    });

    it('reports zero saturation for grayscale', () => {
      const hsl = hexToHsl('#808080');
      expect(hsl).not.toBeNull();
      expect(hsl?.s).toBe(0);
    });

    it('maps black to l=0 and white to l=100', () => {
      expect(hexToHsl('#000000')).toEqual({ h: 0, s: 0, l: 0 });
      expect(hexToHsl('#FFFFFF')).toEqual({ h: 0, s: 0, l: 100 });
    });

    it('expands #RGB shorthand', () => {
      expect(hexToHsl('#F00')).toEqual({ h: 0, s: 100, l: 50 });
    });

    it('returns null on unparseable input', () => {
      expect(hexToHsl('nope')).toBeNull();
      expect(hexToHsl('#12')).toBeNull();
      expect(hexToHsl('#GGGGGG')).toBeNull();
      // @ts-expect-error runtime guard for non-string input
      expect(hexToHsl(null)).toBeNull();
    });
  });

  describe('hslToHex', () => {
    it('emits upper-case #RRGGBB', () => {
      const hex = hslToHex({ h: 210, s: 79, l: 46 });
      expect(hex).toMatch(/^#[0-9A-F]{6}$/);
    });

    it('renders pure hues', () => {
      expect(hslToHex({ h: 0, s: 100, l: 50 })).toBe('#FF0000');
      expect(hslToHex({ h: 120, s: 100, l: 50 })).toBe('#00FF00');
      expect(hslToHex({ h: 240, s: 100, l: 50 })).toBe('#0000FF');
    });

    it('clamps and wraps out-of-range inputs', () => {
      expect(hslToHex({ h: 360, s: 100, l: 50 })).toBe('#FF0000');
      expect(hslToHex({ h: -120, s: 100, l: 50 })).toBe('#0000FF');
      expect(hslToHex({ h: 0, s: 999, l: 50 })).toBe('#FF0000');
      expect(hslToHex({ h: 0, s: -50, l: 50 })).toBe('#808080');
    });
  });

  describe('round-trip stability', () => {
    const colours = [
      '#2196F3',
      '#FF0000',
      '#00FF00',
      '#0000FF',
      '#808080',
      '#9C27B0',
      '#F57C00',
      '#123456',
      '#ABCDEF',
      '#000000',
      '#FFFFFF',
    ];

    it.each(colours)('round-trips %s within ±1 per channel', hex => {
      const hsl = hexToHsl(hex);
      expect(hsl).not.toBeNull();
      if (hsl) {
        expectClose(hslToHex(hsl), hex);
      }
    });
  });

  describe('withHue', () => {
    it('changes the hue while preserving s and l', () => {
      const out = withHue('#FF0000', 120);
      const hsl = hexToHsl(out);
      expect(hsl?.h).toBe(120);
      expect(hsl?.s).toBe(100);
      expect(hsl?.l).toBe(50);
    });

    it('wraps hue values', () => {
      expect(withHue('#FF0000', 480)).toBe(withHue('#FF0000', 120));
    });

    it('passes through unparseable hex', () => {
      expect(withHue('bad', 120)).toBe('bad');
    });
  });

  describe('withSaturation', () => {
    it('desaturates to grayscale at 0', () => {
      const hsl = hexToHsl(withSaturation('#2196F3', 0));
      expect(hsl?.s).toBe(0);
    });

    it('clamps above 100', () => {
      expect(withSaturation('#2196F3', 999)).toBe(
        withSaturation('#2196F3', 100),
      );
    });

    it('passes through unparseable hex', () => {
      expect(withSaturation('bad', 50)).toBe('bad');
    });
  });

  describe('withLightness', () => {
    it('goes black at 0', () => {
      expect(withLightness('#2196F3', 0)).toBe('#000000');
    });

    it('goes white at 100', () => {
      expect(withLightness('#2196F3', 100)).toBe('#FFFFFF');
    });

    it('clamps negative input to black', () => {
      expect(withLightness('#2196F3', -20)).toBe('#000000');
    });

    it('passes through unparseable hex', () => {
      expect(withLightness('bad', 50)).toBe('bad');
    });
  });

  describe('shades', () => {
    it('returns 9 variants by default', () => {
      expect(shades('#2196F3')).toHaveLength(9);
    });

    it('honours a custom count', () => {
      expect(shades('#2196F3', 5)).toHaveLength(5);
    });

    it('returns only valid upper-case hexes', () => {
      for (const hex of shades('#2196F3', 7)) {
        expect(hex).toMatch(/^#[0-9A-F]{6}$/);
      }
    });

    it('is ordered dark → light by lightness', () => {
      const ramp = shades('#2196F3', 9);
      const lightnesses = ramp.map(hex => hexToHsl(hex)?.l ?? 0);
      for (let i = 1; i < lightnesses.length; i += 1) {
        expect(lightnesses[i]).toBeGreaterThan(lightnesses[i - 1]);
      }
    });

    it('yields distinct entries', () => {
      const ramp = shades('#2196F3', 9);
      expect(new Set(ramp).size).toBe(ramp.length);
    });

    it('preserves the base hue across the ramp (within rounding)', () => {
      const baseHue = hexToHsl('#2196F3')?.h ?? 0;
      // Extremely dark/light entries quantise hue heavily once mapped back to
      // 8-bit RGB, so only the readable mid-range entries are checked.
      const ramp = shades('#2196F3', 9).slice(1, -1);
      for (const hex of ramp) {
        const hue = hexToHsl(hex)?.h ?? 0;
        expect(Math.abs(hue - baseHue)).toBeLessThanOrEqual(3);
      }
    });

    it('includes a near-base entry', () => {
      const base = hexToHsl('#2196F3');
      const ramp = shades('#2196F3', 9);
      const hasNearBase = ramp.some(hex => {
        const hsl = hexToHsl(hex);
        return hsl != null && base != null && Math.abs(hsl.l - base.l) <= 1;
      });
      expect(hasNearBase).toBe(true);
    });

    it('returns an empty array on unparseable hex', () => {
      expect(shades('bad')).toEqual([]);
    });

    it('handles a count of 1', () => {
      expect(shades('#2196F3', 1)).toHaveLength(1);
    });
  });
});

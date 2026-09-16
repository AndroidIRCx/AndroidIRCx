/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  hexToRgb,
  rgbToHex,
  withAlpha,
  mix,
  lighten,
  darken,
  relativeLuminance,
  contrastRatio,
  meetsContrastAA,
  BLUE,
  SELECTION_TINT,
  ROLE_COLORS_DARK,
  ROLE_COLORS_LIGHT,
} from '../../src/themes/palette';

describe('themes/palette', () => {
  describe('hexToRgb', () => {
    it('parses #RRGGBB', () => {
      expect(hexToRgb('#2196F3')).toEqual({ r: 33, g: 150, b: 243 });
    });

    it('expands #RGB shorthand', () => {
      expect(hexToRgb('#0AF')).toEqual({ r: 0, g: 170, b: 255 });
    });

    it('trims surrounding whitespace', () => {
      expect(hexToRgb('  #000000 ')).toEqual({ r: 0, g: 0, b: 0 });
    });

    it('returns null for non-hex input', () => {
      expect(hexToRgb('rgba(0,0,0,1)')).toBeNull();
      expect(hexToRgb('#12')).toBeNull();
      expect(hexToRgb('#GGGGGG')).toBeNull();
      // @ts-expect-error runtime guard for non-string input
      expect(hexToRgb(null)).toBeNull();
    });
  });

  describe('rgbToHex', () => {
    it('round-trips with hexToRgb', () => {
      const hex = '#AB12CD';
      expect(rgbToHex(hexToRgb(hex)!)).toBe(hex);
    });

    it('clamps out-of-range channels', () => {
      expect(rgbToHex({ r: -5, g: 300, b: 128 })).toBe('#00FF80');
    });
  });

  describe('withAlpha', () => {
    it('wraps a hex colour in rgba()', () => {
      expect(withAlpha('#2196F3', 0.12)).toBe('rgba(33, 150, 243, 0.12)');
    });

    it('clamps alpha to 0..1', () => {
      expect(withAlpha('#000000', 5)).toBe('rgba(0, 0, 0, 1)');
      expect(withAlpha('#000000', -1)).toBe('rgba(0, 0, 0, 0)');
    });

    it('passes through a colour it cannot parse', () => {
      expect(withAlpha('not-a-color', 0.5)).toBe('not-a-color');
    });
  });

  describe('mix / lighten / darken', () => {
    it('returns endpoints at the extremes', () => {
      expect(mix('#000000', '#FFFFFF', 0)).toBe('#000000');
      expect(mix('#000000', '#FFFFFF', 1)).toBe('#FFFFFF');
    });

    it('blends at the midpoint', () => {
      expect(mix('#000000', '#FFFFFF', 0.5)).toBe('#808080');
    });

    it('lighten moves toward white, darken toward black', () => {
      expect(lighten('#808080', 1)).toBe('#FFFFFF');
      expect(darken('#808080', 1)).toBe('#000000');
    });

    it('returns the first colour when a colour is unparseable', () => {
      expect(mix('bad', '#FFFFFF', 0.5)).toBe('bad');
    });
  });

  describe('luminance & contrast', () => {
    it('luminance is 0 for black and 1 for white', () => {
      expect(relativeLuminance('#000000')).toBeCloseTo(0, 5);
      expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 5);
      expect(relativeLuminance('bad')).toBe(0);
    });

    it('black-on-white is the maximum 21:1 ratio', () => {
      expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    });

    it('meetsContrastAA flags readable vs unreadable pairs', () => {
      expect(meetsContrastAA('#000000', '#FFFFFF')).toBe(true);
      expect(meetsContrastAA('#777777', '#808080')).toBe(false);
    });
  });

  describe('shared constants', () => {
    it('exposes the blue ramp and selection tint', () => {
      expect(BLUE.base).toBe('#2196F3');
      expect(SELECTION_TINT).toBe('rgba(33, 150, 243, 0.12)');
    });

    it('defines both role ramps with the five IRC roles', () => {
      const roles = ['owner', 'admin', 'op', 'halfop', 'voice'];
      expect(Object.keys(ROLE_COLORS_DARK).sort()).toEqual([...roles].sort());
      expect(Object.keys(ROLE_COLORS_LIGHT).sort()).toEqual([...roles].sort());
      for (const key of roles) {
        expect(
          hexToRgb(ROLE_COLORS_DARK[key as keyof typeof ROLE_COLORS_DARK]),
        ).not.toBeNull();
        expect(
          hexToRgb(ROLE_COLORS_LIGHT[key as keyof typeof ROLE_COLORS_LIGHT]),
        ).not.toBeNull();
      }
    });
  });
});

/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * HSL colour maths layered on top of the RGB primitives in palette.ts. These
 * helpers let callers pivot a hex colour around hue, saturation, or lightness
 * without leaving hex space, and build lightness ramps ("shades"). Parsing and
 * emitting hex is delegated to palette.ts so both modules agree on format
 * (upper-case #RRGGBB, null/passthrough on unparseable input).
 */

import { hexToRgb, rgbToHex } from './palette';

export interface HSL {
  /** Hue in degrees, 0..360. */
  h: number;
  /** Saturation as a percentage, 0..100. */
  s: number;
  /** Lightness as a percentage, 0..100. */
  l: number;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

/** Normalise a hue into the 0..360 range (wrapping negatives/overflow). */
const wrapHue = (h: number): number => {
  const wrapped = h % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
};

/** Parse a #RGB or #RRGGBB string into HSL. Returns null if not hex. */
export const hexToHsl = (hex: string): HSL | null => {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return null;
  }
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  const l = (max + min) / 2;

  let h = 0;
  let s = 0;
  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    switch (max) {
      case r:
        h = (g - b) / delta + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / delta + 2;
        break;
      default:
        h = (r - g) / delta + 4;
        break;
    }
    h *= 60;
  }

  // Channels are kept at full precision (not rounded to integers): rounding HSL
  // to whole degrees/percent loses information and pushes the hexToHsl→hslToHex
  // round-trip off by as much as five per RGB channel. The output RGB channels
  // are what get rounded (in rgbToHex), which keeps the round-trip within ±1.
  return {
    h: wrapHue(h),
    s: s * 100,
    l: l * 100,
  };
};

/** HSL back to #RRGGBB (upper-case). Inputs are clamped/wrapped. */
export const hslToHex = (hsl: HSL): string => {
  const h = wrapHue(hsl.h);
  const s = clamp(hsl.s, 0, 100) / 100;
  const l = clamp(hsl.l, 0, 100) / 100;

  if (s === 0) {
    const value = l * 255;
    return rgbToHex({ r: value, g: value, b: value });
  }

  const hue2rgb = (p: number, q: number, t: number): number => {
    let tt = t;
    if (tt < 0) {
      tt += 1;
    }
    if (tt > 1) {
      tt -= 1;
    }
    if (tt < 1 / 6) {
      return p + (q - p) * 6 * tt;
    }
    if (tt < 1 / 2) {
      return q;
    }
    if (tt < 2 / 3) {
      return p + (q - p) * (2 / 3 - tt) * 6;
    }
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hk = h / 360;

  return rgbToHex({
    r: hue2rgb(p, q, hk + 1 / 3) * 255,
    g: hue2rgb(p, q, hk) * 255,
    b: hue2rgb(p, q, hk - 1 / 3) * 255,
  });
};

/** Return a copy of the colour with a new hue (0..360). Passthrough on bad hex. */
export const withHue = (hex: string, h: number): string => {
  const hsl = hexToHsl(hex);
  if (!hsl) {
    return hex;
  }
  return hslToHex({ ...hsl, h: wrapHue(h) });
};

/** Return a copy with a new saturation (0..100). Passthrough on bad hex. */
export const withSaturation = (hex: string, s: number): string => {
  const hsl = hexToHsl(hex);
  if (!hsl) {
    return hex;
  }
  return hslToHex({ ...hsl, s: clamp(s, 0, 100) });
};

/** Return a copy with a new lightness (0..100). Passthrough on bad hex. */
export const withLightness = (hex: string, l: number): string => {
  const hsl = hexToHsl(hex);
  if (!hsl) {
    return hex;
  }
  return hslToHex({ ...hsl, l: clamp(l, 0, 100) });
};

/**
 * Build a lightness ramp of `count` variants (default 9), ordered dark → light,
 * preserving the base hue/saturation. The ramp spans lightness 5..95 so it never
 * collapses to pure black/white, and includes an entry near the base colour.
 * Returns an empty array on unparseable hex.
 */
export const shades = (hex: string, count = 9): string[] => {
  const hsl = hexToHsl(hex);
  if (!hsl) {
    return [];
  }
  const n = Math.max(1, Math.round(count));
  if (n === 1) {
    return [hslToHex(hsl)];
  }
  const minL = 5;
  const maxL = 95;
  const step = (maxL - minL) / (n - 1);
  const lightnesses: number[] = [];
  for (let i = 0; i < n; i += 1) {
    lightnesses.push(minL + step * i);
  }
  // Snap the ramp entry closest to the base lightness onto the base itself so
  // the ramp always contains a near-base variant (ordering is preserved because
  // the base sits within one step of the slot it replaces).
  let nearest = 0;
  for (let i = 1; i < n; i += 1) {
    if (
      Math.abs(lightnesses[i] - hsl.l) < Math.abs(lightnesses[nearest] - hsl.l)
    ) {
      nearest = i;
    }
  }
  lightnesses[nearest] = clamp(hsl.l, minL, maxL);
  return lightnesses.map(l => hslToHex({ h: hsl.h, s: hsl.s, l }));
};

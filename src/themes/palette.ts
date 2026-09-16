/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Shared theming primitives: colour maths, reusable UI tints, and the IRC
 * user-role ramps. Built-in themes import from here so accents stay consistent
 * and edits happen in one place. Nothing here changes existing themes' rendered
 * output — the helpers reproduce the literals the themes already used.
 */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

const clampChannel = (value: number): number =>
  Math.max(0, Math.min(255, Math.round(value)));

/** Parse a #RGB or #RRGGBB string into channels. Returns null if not hex. */
export const hexToRgb = (hex: string): RGB | null => {
  if (typeof hex !== 'string') {
    return null;
  }
  const value = hex.trim();
  if (!value.startsWith('#')) {
    return null;
  }
  const body = value.slice(1);
  const expanded =
    body.length === 3
      ? `${body[0]}${body[0]}${body[1]}${body[1]}${body[2]}${body[2]}`
      : body;
  if (expanded.length !== 6 || /[^0-9a-fA-F]/.test(expanded)) {
    return null;
  }
  return {
    r: parseInt(expanded.slice(0, 2), 16),
    g: parseInt(expanded.slice(2, 4), 16),
    b: parseInt(expanded.slice(4, 6), 16),
  };
};

/** Channels back to #RRGGBB (upper-case). */
export const rgbToHex = ({ r, g, b }: RGB): string => {
  const toHex = (n: number) => clampChannel(n).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
};

/** Wrap a hex colour in an rgba() string with the given alpha (0..1). */
export const withAlpha = (hex: string, alpha: number): string => {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return hex;
  }
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
};

/** Linearly blend two hex colours. amount=0 → a, amount=1 → b. */
export const mix = (a: string, b: string, amount: number): string => {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  if (!ca || !cb) {
    return a;
  }
  const t = Math.max(0, Math.min(1, amount));
  return rgbToHex({
    r: ca.r + (cb.r - ca.r) * t,
    g: ca.g + (cb.g - ca.g) * t,
    b: ca.b + (cb.b - ca.b) * t,
  });
};

/** Lighten a colour toward white by amount (0..1). */
export const lighten = (hex: string, amount: number): string =>
  mix(hex, '#FFFFFF', amount);

/** Darken a colour toward black by amount (0..1). */
export const darken = (hex: string, amount: number): string =>
  mix(hex, '#000000', amount);

/** WCAG relative luminance (0..1). Unknown colours resolve to 0. */
export const relativeLuminance = (hex: string): number => {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return 0;
  }
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return (
    0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b)
  );
};

/** WCAG contrast ratio between two colours (1..21). */
export const contrastRatio = (a: string, b: string): number => {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
};

/** True when the pair clears WCAG AA for normal text (4.5:1). */
export const meetsContrastAA = (fg: string, bg: string): boolean =>
  contrastRatio(fg, bg) >= 4.5;

// ---------------------------------------------------------------------------
// Shared literals reused by the built-in themes
// ---------------------------------------------------------------------------

/** Material blue ramp used by the stock Dark/Light themes. */
export const BLUE = {
  light: '#64B5F6',
  base: '#2196F3',
  dark: '#1976D2',
} as const;

/** The blue selection wash shared by every stock theme. */
export const SELECTION_TINT = withAlpha(BLUE.base, 0.12);

/** IRC user-role colour ramp. Dark tuned for dark backgrounds. */
export const ROLE_COLORS_DARK = {
  owner: '#9C27B0', // ~ owner (purple)
  admin: '#F44336', // & admin (red)
  op: '#FF9800', // @ op (orange)
  halfop: '#2196F3', // % halfop (blue)
  voice: '#4CAF50', // + voice (green)
} as const;

/** IRC user-role ramp darkened for light backgrounds. */
export const ROLE_COLORS_LIGHT = {
  owner: '#7B1FA2',
  admin: '#D32F2F',
  op: '#F57C00',
  halfop: '#1976D2',
  voice: '#388E3C',
} as const;

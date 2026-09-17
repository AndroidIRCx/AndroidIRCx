/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Seed -> full theme derivation. Given a small seed (background + accent, with
 * optional text/mode) this produces a complete, valid {@link ThemeColors} object
 * where every key is populated with a sensible value and the two core text pairs
 * (text-on-background and messageText-on-messageBackground) clear WCAG AA (4.5:1).
 *
 * Pure and side-effect free: it only relies on the colour maths in ./palette.
 */

import type { ThemeColors } from '../services/ThemeService';
import {
  contrastRatio,
  darken,
  hexToRgb,
  lighten,
  mix,
  rgbToHex,
  relativeLuminance,
  ROLE_COLORS_DARK,
  ROLE_COLORS_LIGHT,
  withAlpha,
} from './palette';

export interface ThemeSeed {
  background: string;
  accent: string;
  text?: string;
  mode?: 'dark' | 'light';
}

/** Luminance above which a background is treated as a light theme. */
const LIGHT_LUMINANCE_THRESHOLD = 0.4;

/** WCAG AA target for normal text. */
const AA = 4.5;

/** Pick black or white — whichever reads better on the given background. */
const onColor = (bg: string): string =>
  contrastRatio('#FFFFFF', bg) >= contrastRatio('#000000', bg)
    ? '#FFFFFF'
    : '#000000';

/**
 * Nudge a foreground colour toward black or white until it clears `target`
 * contrast against `bg`. Returns the original when it already passes.
 */
const ensureReadable = (fg: string, bg: string, target = AA): string => {
  if (contrastRatio(fg, bg) >= target) {
    return fg;
  }
  const towards = relativeLuminance(bg) > 0.5 ? '#000000' : '#FFFFFF';
  for (let amount = 0.1; amount <= 1; amount += 0.1) {
    const candidate = mix(fg, towards, amount);
    if (contrastRatio(candidate, bg) >= target) {
      return candidate;
    }
  }
  return towards;
};

// --- tiny HSL helpers (local, kept private) --------------------------------

interface HSL {
  h: number;
  s: number;
  l: number;
}

const rgbToHsl = (hex: string): HSL => {
  const rgb = hexToRgb(hex) ?? { r: 0, g: 0, b: 0 };
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r:
        h = ((g - b) / d) % 6;
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
        break;
    }
    h *= 60;
    if (h < 0) {
      h += 360;
    }
  }
  return { h, s, l };
};

const hslToHex = ({ h, s, l }: HSL): string => {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    [r, g, b] = [c, x, 0];
  } else if (h < 120) {
    [r, g, b] = [x, c, 0];
  } else if (h < 180) {
    [r, g, b] = [0, c, x];
  } else if (h < 240) {
    [r, g, b] = [0, x, c];
  } else if (h < 300) {
    [r, g, b] = [x, 0, c];
  } else {
    [r, g, b] = [c, 0, x];
  }
  return rgbToHex({
    r: (r + m) * 255,
    g: (g + m) * 255,
    b: (b + m) * 255,
  });
};

/** Rotate a colour's hue by `deg` degrees, preserving saturation/lightness. */
const hueShift = (hex: string, deg: number): string => {
  const hsl = rgbToHsl(hex);
  return hslToHex({ ...hsl, h: (hsl.h + deg + 360) % 360 });
};

/**
 * Derive a complete {@link ThemeColors} from a small seed. Every one of the
 * ThemeColors keys is populated; the returned colours are all valid hex/rgba
 * strings, and the core text pairs clear WCAG AA.
 */
export const deriveThemeColors = (seed: ThemeSeed): ThemeColors => {
  const background = seed.background;
  const accent = seed.accent;
  const isLight =
    seed.mode != null
      ? seed.mode === 'light'
      : relativeLuminance(background) > LIGHT_LUMINANCE_THRESHOLD;

  // Surfaces move away from the background: lighter for dark themes, darker for
  // light themes.
  const shade = (hex: string, amount: number): string =>
    isLight ? darken(hex, amount) : lighten(hex, amount);

  const surface = shade(background, 0.04);
  const surfaceVariant = shade(background, 0.08);
  const surfaceAlt = shade(background, 0.02);
  const cardBackground = surface;

  // Text: honour the seed if given, otherwise pick the more readable of near
  // black / near white, then guarantee AA against the background.
  const baseText =
    seed.text ??
    (contrastRatio('#FFFFFF', background) >=
    contrastRatio('#111111', background)
      ? '#FFFFFF'
      : '#111111');
  const text = ensureReadable(baseText, background, AA);
  const textSecondary = mix(text, background, 0.35);
  const textDisabled = mix(text, background, 0.55);

  // Primary ramp from the accent seed.
  const primary = accent;
  const primaryDark = darken(accent, 0.2);
  const primaryLight = lighten(accent, 0.2);
  const onPrimary = onColor(primary);

  // Hue variants for the secondary/accent slots.
  const accentColor = accent;
  const secondary = hueShift(accent, 180);

  // Status colours: tasteful, mode-tuned defaults.
  const success = isLight ? '#2E7D32' : '#4CAF50';
  const error = isLight ? '#C62828' : '#F44336';
  const warning = isLight ? '#F57C00' : '#F59E0B';
  const info = isLight ? '#1976D2' : '#42A5F5';

  const border = shade(background, 0.16);
  const borderLight = shade(background, 0.09);
  const divider = borderLight;

  // Messages sit on the surface tone; text/nick are guaranteed readable there.
  const messageBackground = surface;
  const messageText = ensureReadable(text, messageBackground, AA);
  const messageNick = ensureReadable(accent, messageBackground, AA);
  const messageTimestamp = textSecondary;

  const roles = isLight ? ROLE_COLORS_LIGHT : ROLE_COLORS_DARK;

  return {
    // Backgrounds
    background,
    surface,
    surfaceVariant,
    surfaceAlt,
    cardBackground,

    // Text
    text,
    textSecondary,
    textDisabled,

    // Primary
    primary,
    primaryDark,
    primaryLight,
    onPrimary,

    // Secondary
    secondary,
    onSecondary: onColor(secondary),

    // Accent
    accent: accentColor,
    onAccent: onColor(accentColor),

    // Status
    success,
    error,
    warning,
    info,

    // Borders
    border,
    borderLight,
    divider,

    // Messages
    messageBackground,
    messageText,
    messageNick,
    messageTimestamp,

    // Message types
    systemMessage: isLight ? '#757575' : '#9E9E9E',
    noticeMessage: warning,
    joinMessage: success,
    partMessage: isLight ? '#F57C00' : '#F97316',
    quitMessage: error,
    kickMessage: error,
    nickMessage: primaryDark,
    inviteMessage: info,
    monitorMessage: info,
    topicMessage: isLight ? '#7B1FA2' : '#9C27B0',
    modeMessage: '#5DADE2',
    actionMessage: isLight ? '#616161' : '#9E9E9E',
    rawMessage: textSecondary,
    ctcpMessage: isLight ? '#388E3C' : '#4CAF50',

    // Inputs
    inputBackground: surfaceVariant,
    inputText: text,
    inputBorder: border,
    inputPlaceholder: textSecondary,

    // Buttons
    buttonPrimary: primary,
    buttonPrimaryText: onPrimary,
    buttonSecondary: shade(background, 0.22),
    buttonSecondaryText: text,
    buttonDisabled: surfaceVariant,
    buttonDisabledText: textDisabled,
    buttonText: onPrimary,

    // Tabs
    tabActive: primary,
    tabInactive: surface,
    tabActiveText: onPrimary,
    tabInactiveText: textSecondary,
    tabBorder: border,

    // Modal
    modalOverlay: isLight ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.7)',
    modalBackground: surface,
    modalText: text,

    // User list
    userListBackground: surfaceAlt,
    userListText: text,
    userListBorder: divider,
    userOwner: roles.owner,
    userAdmin: roles.admin,
    userOp: roles.op,
    userHalfop: roles.halfop,
    userVoice: roles.voice,
    userNormal: text,

    // Highlights / selection
    highlightBackground: withAlpha(accent, isLight ? 0.1 : 0.2),
    highlightText: isLight ? '#FF6F00' : '#FFEB3B',
    selectionBackground: withAlpha(accent, 0.12),
  };
};

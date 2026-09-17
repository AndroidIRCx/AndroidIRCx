/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Pure WCAG contrast auditing for theme colours. Given a {@link ThemeColors}
 * map, it checks the foreground/background pairs a user can visibly get wrong
 * (body text on background, message nick on message background, button label on
 * button fill, etc.) and reports the contrast ratio plus AA pass/fail flags.
 *
 * No UI, no side effects — just maths on top of {@link contrastRatio} from the
 * shared palette so the numbers match what the renderer actually produces.
 */

import type { ThemeColors } from '../services/ThemeService';
import { contrastRatio } from './palette';

/** WCAG AA minimum contrast ratio for normal-size text. */
const AA_NORMAL = 4.5;
/** WCAG AA minimum contrast ratio for large text (>=18pt / 14pt bold). */
const AA_LARGE = 3.0;

export interface ContrastCheck {
  fg: keyof ThemeColors;
  bg: keyof ThemeColors;
  /** Human-readable label, e.g. "Body text on background". */
  label: string;
  /** WCAG contrast ratio, rounded to 2 decimals. */
  ratio: number;
  /** True when the pair clears AA for normal text (ratio >= 4.5). */
  passesAA: boolean;
  /** True when the pair clears AA for large text (ratio >= 3.0). */
  passesAALarge: boolean;
}

interface PairSpec {
  fg: keyof ThemeColors;
  bg: keyof ThemeColors;
  label: string;
}

/**
 * The meaningful foreground/background pairs to audit. Each pair is one a user
 * customising a theme can plausibly break, so surfacing a low ratio is
 * actionable.
 */
const AUDIT_PAIRS: readonly PairSpec[] = [
  { fg: 'text', bg: 'background', label: 'Body text on background' },
  {
    fg: 'textSecondary',
    bg: 'background',
    label: 'Secondary text on background',
  },
  {
    fg: 'messageText',
    bg: 'messageBackground',
    label: 'Message text on message background',
  },
  {
    fg: 'messageNick',
    bg: 'messageBackground',
    label: 'Message nick on message background',
  },
  {
    fg: 'messageTimestamp',
    bg: 'messageBackground',
    label: 'Message timestamp on message background',
  },
  {
    fg: 'systemMessage',
    bg: 'messageBackground',
    label: 'System message on message background',
  },
  {
    fg: 'inputText',
    bg: 'inputBackground',
    label: 'Input text on input field',
  },
  {
    fg: 'inputPlaceholder',
    bg: 'inputBackground',
    label: 'Input placeholder on input field',
  },
  {
    fg: 'buttonPrimaryText',
    bg: 'buttonPrimary',
    label: 'Primary button label on primary button',
  },
  {
    fg: 'buttonSecondaryText',
    bg: 'buttonSecondary',
    label: 'Secondary button label on secondary button',
  },
  {
    fg: 'tabActiveText',
    bg: 'tabActive',
    label: 'Active tab label on active tab',
  },
  {
    fg: 'tabInactiveText',
    bg: 'tabInactive',
    label: 'Inactive tab label on inactive tab',
  },
  { fg: 'modalText', bg: 'modalBackground', label: 'Modal text on modal' },
  {
    fg: 'userNormal',
    bg: 'userListBackground',
    label: 'Normal user on user list',
  },
  {
    fg: 'userOwner',
    bg: 'userListBackground',
    label: 'Owner user on user list',
  },
  { fg: 'userOp', bg: 'userListBackground', label: 'Op user on user list' },
  {
    fg: 'userVoice',
    bg: 'userListBackground',
    label: 'Voiced user on user list',
  },
  {
    fg: 'highlightText',
    bg: 'highlightBackground',
    label: 'Highlight text on highlight background',
  },
];

/** Round a ratio to 2 decimal places. */
const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * Audit every meaningful foreground/background pair in the given theme and
 * return one {@link ContrastCheck} per pair, in a stable order.
 */
export const auditThemeColors = (colors: ThemeColors): ContrastCheck[] =>
  AUDIT_PAIRS.map(({ fg, bg, label }) => {
    const ratio = round2(contrastRatio(colors[fg], colors[bg]));
    return {
      fg,
      bg,
      label,
      ratio,
      passesAA: ratio >= AA_NORMAL,
      passesAALarge: ratio >= AA_LARGE,
    };
  });

/** The subset of audited pairs that fail WCAG AA for normal text. */
export const failingContrast = (colors: ThemeColors): ContrastCheck[] =>
  auditThemeColors(colors).filter(check => !check.passesAA);

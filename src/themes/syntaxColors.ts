/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ensureReadable } from './palette';

export interface SyntaxColors {
  text: string;
  keyword: string;
  string: string;
  comment: string;
  number: string;
  hook: string;
  api: string;
  apiMethod: string;
}

/**
 * Build editor token colours from familiar syntax hues, then move each hue
 * only as far as needed to clear WCAG AA against the active theme's editor
 * surface. This keeps token categories recognisable on both light and dark
 * themes and also protects imported/custom themes.
 */
export const deriveSyntaxColors = (
  background: string,
  text: string,
): SyntaxColors => ({
  text: ensureReadable(text, background),
  keyword: ensureReadable('#C792EA', background),
  string: ensureReadable('#91B859', background),
  comment: ensureReadable('#9E9E9E', background),
  number: ensureReadable('#F78C6C', background),
  hook: ensureReadable('#FFCB6B', background),
  api: ensureReadable('#82AAFF', background),
  apiMethod: ensureReadable('#89DDFF', background),
});

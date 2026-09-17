/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Grouping metadata for the built-in themes plus a pure helper that turns a flat
 * `Theme[]` into ordered, titled sections for the theme picker. Any theme whose
 * id is not a known built-in (i.e. a custom/imported theme) falls into the
 * trailing "Custom" section. Empty sections are skipped so the picker never
 * renders a header with no rows.
 */

import { tx } from '../i18n/localization';
import { Theme } from '../services/ThemeService';

const t = (key: string) => tx.t(key);

export interface ThemeFamily {
  /** Untranslated English section title (passed through t() at group time). */
  title: string;
  /** Built-in theme ids belonging to this family, in display order. */
  themeIds: string[];
}

export interface ThemeSection {
  /** Translated section title, ready to render. */
  title: string;
  themes: Theme[];
}

/**
 * Ordered families for the 20 built-in themes. The order here is the order the
 * sections appear in the picker.
 */
export const THEME_FAMILIES: ReadonlyArray<ThemeFamily> = [
  {
    title: 'Originals',
    themeIds: ['dark', 'light', 'ircap', 'ircap-dark'],
  },
  {
    title: 'Popular dark palettes',
    themeIds: [
      'dracula',
      'nord',
      'tokyo-night',
      'catppuccin-mocha',
      'one-dark',
      'monokai',
      'gruvbox-dark',
      'rose-pine',
      'solarized-dark',
    ],
  },
  {
    title: 'Light modes',
    themeIds: [
      'solarized-light',
      'catppuccin-latte',
      'gruvbox-light',
      'matrix-light',
      'mirc-classic',
    ],
  },
  {
    title: 'Terminal & Retro',
    themeIds: ['matrix', 'amber-crt'],
  },
  {
    title: 'Bold & trendy',
    themeIds: ['synthwave-84'],
  },
];

/** Every id that belongs to a known built-in family. */
const KNOWN_BUILTIN_IDS: ReadonlySet<string> = new Set(
  THEME_FAMILIES.flatMap(family => family.themeIds),
);

/** True when a theme is not one of the known built-ins (custom/imported). */
export const isCustomTheme = (theme: Theme): boolean =>
  !KNOWN_BUILTIN_IDS.has(theme.id);

/**
 * Group a flat list of themes into ordered, titled sections. Pure and
 * side-effect free so it is trivial to unit-test. Built-ins are placed in their
 * family (in family order); anything else lands in a trailing "Custom" section
 * preserving its incoming order. Sections with no themes are omitted.
 */
export const groupThemes = (themes: Theme[]): ThemeSection[] => {
  const byId = new Map<string, Theme>();
  for (const theme of themes) {
    byId.set(theme.id, theme);
  }

  const sections: ThemeSection[] = [];

  for (const family of THEME_FAMILIES) {
    const found = family.themeIds
      .map(id => byId.get(id))
      .filter((theme): theme is Theme => theme !== undefined);
    if (found.length > 0) {
      sections.push({ title: t(family.title), themes: found });
    }
  }

  const custom = themes.filter(isCustomTheme);
  if (custom.length > 0) {
    sections.push({ title: t('Custom'), themes: custom });
  }

  return sections;
};

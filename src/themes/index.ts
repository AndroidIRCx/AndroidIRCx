/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Single source of truth for built-in themes.
 *
 * Append a new theme to BUILT_IN_THEMES and it automatically appears in the
 * picker, is selectable, exportable, and restored on launch — ThemeService
 * derives every built-in lookup from this list, so no switch statements need
 * editing per theme.
 */

import type { Theme } from '../services/ThemeService';
import { DARK_THEME } from './DarkTheme';
import { IRCAP_THEME } from './IRcapTheme';
import { LIGHT_THEME } from './LightTheme';

/** Ordered list of built-in themes. Append new themes here. */
export const BUILT_IN_THEMES: Theme[] = [DARK_THEME, LIGHT_THEME, IRCAP_THEME];

/** Fallback theme used when a saved/requested id can't be resolved. */
export const DEFAULT_THEME: Theme = DARK_THEME;

const byId: Map<string, Theme> = new Map(
  BUILT_IN_THEMES.map(theme => [theme.id, theme]),
);

/** Look up a built-in theme by id, or undefined if it isn't built in. */
export const getBuiltInTheme = (id: string): Theme | undefined => byId.get(id);

/** True when the id belongs to a built-in (non-custom) theme. */
export const isBuiltInThemeId = (id: string): boolean => byId.has(id);

export { DARK_THEME, LIGHT_THEME, IRCAP_THEME };

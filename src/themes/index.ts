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

// Popular dark developer palettes
import { DRACULA_THEME } from './Dracula';
import { NORD_THEME } from './Nord';
import { TOKYO_NIGHT_THEME } from './TokyoNight';
import { CATPPUCCIN_MOCHA_THEME } from './CatppuccinMocha';
import { ONE_DARK_THEME } from './OneDark';
import { MONOKAI_THEME } from './Monokai';
import { GRUVBOX_DARK_THEME } from './GruvboxDark';
import { ROSE_PINE_THEME } from './RosePine';
import { SOLARIZED_DARK_THEME } from './SolarizedDark';

// Light modes
import { SOLARIZED_LIGHT_THEME } from './SolarizedLight';
import { CATPPUCCIN_LATTE_THEME } from './CatppuccinLatte';
import { GRUVBOX_LIGHT_THEME } from './GruvboxLight';
import { MATRIX_LIGHT_THEME } from './MatrixLight';
import { MIRC_CLASSIC_THEME } from './MircClassic';

// Terminal / retro + bold
import { MATRIX_THEME } from './Matrix';
import { AMBER_CRT_THEME } from './AmberCRT';
import { SYNTHWAVE_84_THEME } from './Synthwave84';

/** Ordered list of built-in themes. Append new themes here. */
export const BUILT_IN_THEMES: Theme[] = [
  // Originals
  DARK_THEME,
  LIGHT_THEME,
  IRCAP_THEME,
  // Popular dark developer palettes
  DRACULA_THEME,
  NORD_THEME,
  TOKYO_NIGHT_THEME,
  CATPPUCCIN_MOCHA_THEME,
  ONE_DARK_THEME,
  MONOKAI_THEME,
  GRUVBOX_DARK_THEME,
  ROSE_PINE_THEME,
  SOLARIZED_DARK_THEME,
  // Light modes
  SOLARIZED_LIGHT_THEME,
  CATPPUCCIN_LATTE_THEME,
  GRUVBOX_LIGHT_THEME,
  MATRIX_LIGHT_THEME,
  MIRC_CLASSIC_THEME,
  // Terminal / retro + bold
  MATRIX_THEME,
  AMBER_CRT_THEME,
  SYNTHWAVE_84_THEME,
];

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

/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Message-format presets. A preset is a pure factory that turns a small
 * FormatPalette into a full 21-line ThemeMessageFormats, so any theme can
 * adopt a look (classic mIRC, IRcap bars, or minimal) by passing its colours.
 */

import type { ThemeMessageFormats } from '../../services/ThemeService';
import type { FormatPalette } from './types';
import { makeClassicMircFormats } from './classicMirc';
import { makeIrcapBarsFormats } from './ircapBars';
import { makeMinimalFormats } from './minimal';

export type { FormatPalette } from './types';
export { makeClassicMircFormats } from './classicMirc';
export { makeIrcapBarsFormats } from './ircapBars';
export { makeMinimalFormats } from './minimal';

export type FormatPresetId = 'classicMirc' | 'ircapBars' | 'minimal';

/** Factory for each preset, keyed by id — used by the picker/editor. */
export const FORMAT_PRESETS: Record<
  FormatPresetId,
  (palette: FormatPalette) => ThemeMessageFormats
> = {
  classicMirc: makeClassicMircFormats,
  ircapBars: makeIrcapBarsFormats,
  minimal: makeMinimalFormats,
};

/** Build a preset's formats by id. */
export const makeFormats = (
  id: FormatPresetId,
  palette: FormatPalette,
): ThemeMessageFormats => FORMAT_PRESETS[id](palette);

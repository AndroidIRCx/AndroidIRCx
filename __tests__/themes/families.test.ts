/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  groupThemes,
  isCustomTheme,
  THEME_FAMILIES,
} from '../../src/themes/families';
import { Theme } from '../../src/services/ThemeService';

jest.mock('../../src/i18n/localization', () => ({
  tx: {
    t: (key: string) => key,
  },
}));

const makeTheme = (id: string, isCustom = false): Theme =>
  ({
    id,
    name: id,
    isCustom,
    colors: {} as any,
  }) as Theme;

describe('groupThemes', () => {
  it('returns sections in the defined family order, skipping empty ones', () => {
    const themes = [
      makeTheme('dark'),
      makeTheme('synthwave-84'),
      makeTheme('matrix'),
      makeTheme('light'),
    ];

    const sections = groupThemes(themes);
    expect(sections.map(s => s.title)).toEqual([
      'Originals',
      'Terminal & Retro',
      'Bold & trendy',
    ]);
  });

  it('orders themes within a family by the family order, not input order', () => {
    const themes = [makeTheme('ircap'), makeTheme('dark'), makeTheme('light')];
    const originals = groupThemes(themes).find(s => s.title === 'Originals');
    expect(originals?.themes.map(t => t.id)).toEqual([
      'dark',
      'light',
      'ircap',
    ]);
  });

  it('places unknown ids into a trailing Custom section preserving order', () => {
    const themes = [
      makeTheme('my-custom', true),
      makeTheme('dark'),
      makeTheme('another', true),
    ];

    const sections = groupThemes(themes);
    expect(sections[0].title).toBe('Originals');

    const custom = sections[sections.length - 1];
    expect(custom.title).toBe('Custom');
    expect(custom.themes.map(t => t.id)).toEqual(['my-custom', 'another']);
  });

  it('omits the Custom section when there are no custom themes', () => {
    const sections = groupThemes([makeTheme('dark')]);
    expect(sections.some(s => s.title === 'Custom')).toBe(false);
  });

  it('returns an empty array for no themes', () => {
    expect(groupThemes([])).toEqual([]);
  });

  it('covers all 21 built-in ids across the families', () => {
    const ids = THEME_FAMILIES.flatMap(f => f.themeIds);
    expect(ids).toHaveLength(21);
    expect(new Set(ids).size).toBe(21);
  });
});

describe('isCustomTheme', () => {
  it('is false for known built-ins and true otherwise', () => {
    expect(isCustomTheme(makeTheme('dark'))).toBe(false);
    expect(isCustomTheme(makeTheme('synthwave-84'))).toBe(false);
    expect(isCustomTheme(makeTheme('totally-made-up', true))).toBe(true);
  });
});

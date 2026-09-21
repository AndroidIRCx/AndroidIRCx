/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BUILT_IN_THEMES } from '../../src/themes';
import { contrastRatio } from '../../src/themes/palette';
import { deriveSyntaxColors } from '../../src/themes/syntaxColors';

describe.each(BUILT_IN_THEMES.map(theme => [theme.name, theme]))(
  'syntax colours: %s',
  (_name, theme) => {
    it('keeps every token readable on the editor surface', () => {
      const syntax = deriveSyntaxColors(
        theme.colors.surfaceVariant,
        theme.colors.text,
      );

      for (const [token, foreground] of Object.entries(syntax)) {
        expect({
          token,
          contrast: contrastRatio(foreground, theme.colors.surfaceVariant),
        }).toEqual({
          token,
          contrast: expect.any(Number),
        });
        expect(
          contrastRatio(foreground, theme.colors.surfaceVariant),
        ).toBeGreaterThanOrEqual(4.5);
      }
    });
  },
);

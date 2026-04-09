/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { createStyles } from '../../src/screens/SettingsScreen.styles';

describe('SettingsScreen.styles', () => {
  it('creates style object', () => {
    const styles = createStyles(
      {
        background: '#000',
        surface: '#111',
        surfaceVariant: '#222',
        text: '#fff',
        textSecondary: '#aaa',
        primary: '#09f',
        border: '#333',
        error: '#f00',
      } as any,
      { id: 'dark' } as any,
    );

    expect(styles).toBeDefined();
    expect(styles.container).toBeDefined();
  });
});

/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ScriptingHelpScreen } from '../../src/screens/ScriptingHelpScreen';

jest.mock('../../src/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      text: '#111',
      primary: '#09f',
      surfaceVariant: '#eee',
    },
  }),
}));

jest.mock('../../src/i18n/transifex', () => ({
  useT: () => (key: string) => key,
}));

describe('ScriptingHelpScreen', () => {
  it('renders nothing when not visible', () => {
    const { queryByText } = render(
      <ScriptingHelpScreen visible={false} onClose={jest.fn()} />
    );

    expect(queryByText('Scripting Help')).toBeNull();
  });

  it('renders help sections when visible', () => {
    const { getByText } = render(
      <ScriptingHelpScreen visible onClose={jest.fn()} />
    );

    expect(getByText('Scripting Help')).toBeTruthy();
    expect(getByText('Quick Start')).toBeTruthy();
    expect(getByText('API')).toBeTruthy();
    expect(getByText('Hooks')).toBeTruthy();
    expect(getByText('Examples')).toBeTruthy();
    expect(getByText('Tips')).toBeTruthy();
    expect(getByText('Alias (/hello)')).toBeTruthy();
    expect(getByText('Kick Protection')).toBeTruthy();
  });

  it('calls onClose when close link is pressed', () => {
    const onClose = jest.fn();
    const { getByText } = render(
      <ScriptingHelpScreen visible onClose={onClose} />
    );

    fireEvent.press(getByText('Close'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

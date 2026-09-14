/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { HelpAwayScreen } from '../../../src/screens/help/HelpAwayScreen';

jest.mock('../../../src/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      surface: '#eee',
      text: '#111',
      border: '#ddd',
      primary: '#09f',
      messageBackground: '#f5f5f5',
    },
  }),
}));

jest.mock('../../../src/i18n/transifex', () => ({
  useT: () => (key: string) => key,
}));

describe('HelpAwayScreen', () => {
  it('renders nothing when not visible', async () => {
    const { queryByText } = await render(
      <HelpAwayScreen visible={false} onClose={jest.fn()} />,
    );

    expect(queryByText('Away & Presence')).toBeNull();
  });

  it('renders away content when visible', async () => {
    const { getByText } = await render(
      <HelpAwayScreen visible onClose={jest.fn()} />,
    );

    expect(getByText('Away & Presence')).toBeTruthy();
    expect(getByText('Going Away')).toBeTruthy();
    expect(getByText('Auto-Away')).toBeTruthy();
    expect(getByText('Away Behaviors')).toBeTruthy();
  });

  it('calls onClose when close button is pressed', async () => {
    const onClose = jest.fn();
    const { getByLabelText } = await render(
      <HelpAwayScreen visible onClose={onClose} />,
    );

    await fireEvent.press(getByLabelText('Close help screen'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

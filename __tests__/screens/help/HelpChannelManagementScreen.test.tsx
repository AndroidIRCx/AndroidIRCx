/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { HelpChannelManagementScreen } from '../../../src/screens/help/HelpChannelManagementScreen';

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

describe('HelpChannelManagementScreen', () => {
  it('renders nothing when not visible', () => {
    const { queryByText } = render(
      <HelpChannelManagementScreen visible={false} onClose={jest.fn()} />,
    );

    expect(queryByText('Channel Management Guide')).toBeNull();
  });

  it('renders channel management content when visible', () => {
    const { getByText } = render(
      <HelpChannelManagementScreen visible onClose={jest.fn()} />,
    );

    expect(getByText('Channel Management Guide')).toBeTruthy();
    expect(getByText('Channel Basics')).toBeTruthy();
    expect(getByText('Creating a Channel')).toBeTruthy();
    expect(getByText('Channel Modes')).toBeTruthy();
    expect(getByText('Channel Settings')).toBeTruthy();
    expect(getByText('Kick User')).toBeTruthy();
    expect(getByText('Advanced Management')).toBeTruthy();
    expect(getByText('Best Practices')).toBeTruthy();
    expect(getByText('Troubleshooting')).toBeTruthy();
    expect(getByText('Lost operator status')).toBeTruthy();
  });

  it('calls onClose when close button is pressed', () => {
    const onClose = jest.fn();
    const { getByLabelText } = render(
      <HelpChannelManagementScreen visible onClose={onClose} />,
    );

    fireEvent.press(getByLabelText('Close help screen'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

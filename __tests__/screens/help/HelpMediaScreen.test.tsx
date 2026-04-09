/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { HelpMediaScreen } from '../../../src/screens/help/HelpMediaScreen';

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

describe('HelpMediaScreen', () => {
  it('renders nothing when not visible', () => {
    const { queryByText } = render(
      <HelpMediaScreen visible={false} onClose={jest.fn()} />,
    );

    expect(queryByText('Media Sharing Guide')).toBeNull();
  });

  it('renders media guide content when visible', () => {
    const { getByText } = render(
      <HelpMediaScreen visible onClose={jest.fn()} />,
    );

    expect(getByText('Media Sharing Guide')).toBeTruthy();
    expect(getByText('Overview')).toBeTruthy();
    expect(getByText('Requirements')).toBeTruthy();
    expect(getByText('How to Send Media')).toBeTruthy();
    expect(getByText('How to Receive Media')).toBeTruthy();
    expect(getByText('Settings')).toBeTruthy();
    expect(getByText('Privacy & Security')).toBeTruthy();
    expect(getByText('Troubleshooting')).toBeTruthy();
    expect(getByText("Media appears as 'Encrypted data'")).toBeTruthy();
  });

  it('calls onClose when close button is pressed', () => {
    const onClose = jest.fn();
    const { getByLabelText } = render(
      <HelpMediaScreen visible onClose={onClose} />,
    );

    fireEvent.press(getByLabelText('Close help screen'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

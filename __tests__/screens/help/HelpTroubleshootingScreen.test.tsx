/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { HelpTroubleshootingScreen } from '../../../src/screens/help/HelpTroubleshootingScreen';

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

describe('HelpTroubleshootingScreen', () => {
  it('renders nothing when not visible', () => {
    const { queryByText } = render(
      <HelpTroubleshootingScreen visible={false} onClose={jest.fn()} />,
    );

    expect(queryByText('Troubleshooting Guide')).toBeNull();
  });

  it('renders troubleshooting sections when visible', () => {
    const { getByText } = render(
      <HelpTroubleshootingScreen visible onClose={jest.fn()} />,
    );

    expect(getByText('Troubleshooting Guide')).toBeTruthy();
    expect(getByText('Connection Issues')).toBeTruthy();
    expect(getByText("Can't Connect to Server")).toBeTruthy();
    expect(getByText('Authentication Problems')).toBeTruthy();
    expect(getByText('Message Issues')).toBeTruthy();
    expect(getByText('Channel Problems')).toBeTruthy();
    expect(getByText('App Performance')).toBeTruthy();
    expect(getByText('Notification Issues')).toBeTruthy();
    expect(getByText('Media/File Issues')).toBeTruthy();
    expect(getByText('Account & Settings')).toBeTruthy();
    expect(getByText('Still Need Help?')).toBeTruthy();
  });

  it('calls onClose when close button is pressed', () => {
    const onClose = jest.fn();
    const { getByLabelText } = render(
      <HelpTroubleshootingScreen visible onClose={onClose} />,
    );

    fireEvent.press(getByLabelText('Close help screen'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { HelpProtectionScreen } from '../../../src/screens/help/HelpProtectionScreen';

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

jest.mock('../../../src/i18n/localization', () => ({
  useT: () => (key: string) => key,
}));

describe('HelpProtectionScreen', () => {
  it('renders nothing when not visible', async () => {
    const { queryByText } = await render(
      <HelpProtectionScreen visible={false} onClose={jest.fn()} />,
    );

    expect(queryByText('Protection & Anti-Flood')).toBeNull();
  });

  it('renders protection content when visible', async () => {
    const { getByText } = await render(
      <HelpProtectionScreen visible onClose={jest.fn()} />,
    );

    expect(getByText('Protection & Anti-Flood')).toBeTruthy();
    expect(getByText('Anti-Spam')).toBeTruthy();
    expect(getByText('Flood Protection')).toBeTruthy();
    expect(getByText('Channel Attack Defenses')).toBeTruthy();
    expect(getByText('Ban Masks & Kick Reasons')).toBeTruthy();
  });

  it('calls onClose when close button is pressed', async () => {
    const onClose = jest.fn();
    const { getByLabelText } = await render(
      <HelpProtectionScreen visible onClose={onClose} />,
    );

    await fireEvent.press(getByLabelText('Close help screen'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

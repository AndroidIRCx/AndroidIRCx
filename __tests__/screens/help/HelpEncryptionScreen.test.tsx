/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { HelpEncryptionScreen } from '../../../src/screens/help/HelpEncryptionScreen';

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

describe('HelpEncryptionScreen', () => {
  it('renders nothing when not visible', () => {
    const { queryByText } = render(
      <HelpEncryptionScreen visible={false} onClose={jest.fn()} />
    );

    expect(queryByText('Encryption Guide')).toBeNull();
  });

  it('renders encryption guide content when visible', () => {
    const { getByText } = render(
      <HelpEncryptionScreen visible onClose={jest.fn()} />
    );

    expect(getByText('Encryption Guide')).toBeTruthy();
    expect(getByText('What is E2EE?')).toBeTruthy();
    expect(getByText('DM (Direct Message) Encryption')).toBeTruthy();
    expect(getByText("Request Someone's Key")).toBeTruthy();
    expect(getByText('Channel Encryption')).toBeTruthy();
    expect(getByText('Security Best Practices')).toBeTruthy();
    expect(getByText('Troubleshooting')).toBeTruthy();
    expect(getByText('Key Management')).toBeTruthy();
    expect(getByText('/requestkey Nick')).toBeTruthy();
  });

  it('calls onClose when close button is pressed', () => {
    const onClose = jest.fn();
    const { getByLabelText } = render(
      <HelpEncryptionScreen visible onClose={onClose} />
    );

    fireEvent.press(getByLabelText('Close help screen'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

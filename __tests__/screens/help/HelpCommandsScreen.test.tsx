/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { HelpCommandsScreen } from '../../../src/screens/help/HelpCommandsScreen';

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

describe('HelpCommandsScreen', () => {
  it('renders nothing when not visible', () => {
    const { queryByText } = render(
      <HelpCommandsScreen visible={false} onClose={jest.fn()} />
    );

    expect(queryByText('IRC Commands Reference')).toBeNull();
  });

  it('renders representative command sections when visible', () => {
    const { getByText } = render(
      <HelpCommandsScreen visible onClose={jest.fn()} />
    );

    expect(getByText('IRC Commands Reference')).toBeTruthy();
    expect(getByText('Basic Commands')).toBeTruthy();
    expect(getByText('/join <channel>')).toBeTruthy();
    expect(getByText('Example: /join #DBase')).toBeTruthy();
    expect(getByText('Channel Management')).toBeTruthy();
    expect(getByText('/ban [options] [#channel] <nick|mask> [type] [kick message]')).toBeTruthy();
    expect(getByText('Encryption Commands')).toBeTruthy();
    expect(getByText('Connection & Status')).toBeTruthy();
    expect(getByText('Services Shortcuts (Aliases)')).toBeTruthy();
    expect(
      getByText(
        'Tip: You can also use tab completion to auto-complete commands and nicknames in the message input field.'
      )
    ).toBeTruthy();
    expect(
      getByText('Some commands may require operator privileges or services support on your network.')
    ).toBeTruthy();
  });

  it('calls onClose when close button is pressed', () => {
    const onClose = jest.fn();
    const { getByLabelText } = render(
      <HelpCommandsScreen visible onClose={onClose} />
    );

    fireEvent.press(getByLabelText('Close help screen'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

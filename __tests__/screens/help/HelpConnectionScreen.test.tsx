/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { HelpConnectionScreen } from '../../../src/screens/help/HelpConnectionScreen';

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

describe('HelpConnectionScreen', () => {
  it('renders nothing when not visible', () => {
    const { queryByText } = render(
      <HelpConnectionScreen visible={false} onClose={jest.fn()} />
    );

    expect(queryByText('IRC Connection Guide')).toBeNull();
  });

  it('renders connection guide content when visible', () => {
    const { getByText } = render(
      <HelpConnectionScreen visible onClose={jest.fn()} />
    );

    expect(getByText('IRC Connection Guide')).toBeTruthy();
    expect(getByText('Quick Start')).toBeTruthy();
    expect(getByText('Detailed Guide')).toBeTruthy();
    expect(getByText('Popular IRC Networks')).toBeTruthy();
    expect(getByText('Troubleshooting')).toBeTruthy();
    expect(getByText('DBase IRC (Recommended)')).toBeTruthy();
    expect(getByText('Nickname Already in Use')).toBeTruthy();
    expect(getByText('Need More Help?')).toBeTruthy();
  });

  it('calls onClose when close button is pressed', () => {
    const onClose = jest.fn();
    const { getByLabelText } = render(
      <HelpConnectionScreen visible onClose={onClose} />
    );

    fireEvent.press(getByLabelText('Close help screen'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

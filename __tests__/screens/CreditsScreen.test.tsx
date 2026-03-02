/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { Linking } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { CreditsScreen } from '../../src/screens/CreditsScreen';

jest.mock('../../src/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      surface: '#eee',
      text: '#111',
      textSecondary: '#666',
      border: '#ddd',
      buttonPrimary: '#09f',
    },
  }),
}));

jest.mock('../../src/i18n/transifex', () => ({
  useT: () => (key: string) => key,
}));

describe('CreditsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when not visible', () => {
    const { queryByText } = render(<CreditsScreen visible={false} onClose={jest.fn()} />);

    expect(queryByText('Credits')).toBeNull();
  });

  it('renders translation credits and help section when visible', () => {
    const { getByText } = render(<CreditsScreen visible onClose={jest.fn()} />);

    expect(getByText('Credits')).toBeTruthy();
    expect(getByText('Translators')).toBeTruthy();
    expect(getByText('English')).toBeTruthy();
    expect(getByText('Spanish')).toBeTruthy();
    expect(getByText('munZe')).toBeTruthy();
    expect(getByText('ARGENTIN07 🇦🇷')).toBeTruthy();
    expect(getByText('Help Translate')).toBeTruthy();
    expect(getByText('contact@androidircx.com')).toBeTruthy();
  });

  it('calls onClose when close button is pressed', () => {
    const onClose = jest.fn();
    const { getByText } = render(<CreditsScreen visible onClose={onClose} />);

    fireEvent.press(getByText('Close'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('opens translation help email link', () => {
    const openURLSpy = jest.spyOn(Linking, 'openURL').mockResolvedValueOnce(true as never);
    const { getByText } = render(<CreditsScreen visible onClose={jest.fn()} />);

    fireEvent.press(getByText('contact@androidircx.com'));

    expect(openURLSpy).toHaveBeenCalledWith(
      'mailto:contact@androidircx.com?subject=Translation%20Help%20-%20AndroidIRCX'
    );
  });

  it('logs linking errors when opening a url fails', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(Linking, 'openURL').mockRejectedValueOnce(new Error('open failed'));
    const { getByText } = render(<CreditsScreen visible onClose={jest.fn()} />);

    fireEvent.press(getByText('contact@androidircx.com'));

    await waitFor(() => {
      expect(errorSpy).toHaveBeenCalledWith('Failed to open URL:', expect.any(Error));
    });

    errorSpy.mockRestore();
  });
});

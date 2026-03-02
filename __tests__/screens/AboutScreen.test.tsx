/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { Linking } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { AboutScreen } from '../../src/screens/AboutScreen';

jest.mock('../../src/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      surface: '#eee',
      text: '#111',
      textSecondary: '#666',
      border: '#ddd',
      buttonPrimary: '#09f',
      primary: '#09f',
    },
  }),
}));

jest.mock('../../src/i18n/transifex', () => ({
  useT: () => (key: string, params?: Record<string, string>) =>
    params ? key.replace('{version}', String(params.version)) : key,
}));

jest.mock('../../src/config/appVersion', () => ({
  APP_VERSION: '1.2.3',
}));

jest.mock('react-native-vector-icons/FontAwesome5', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return function MockIcon(props: { name: string }) {
    return React.createElement(Text, null, props.name);
  };
});

describe('AboutScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when not visible', () => {
    const { queryByText } = render(<AboutScreen visible={false} onClose={jest.fn()} />);

    expect(queryByText('About')).toBeNull();
  });

  it('renders app details and social links when visible', () => {
    const { getByText } = render(<AboutScreen visible onClose={jest.fn()} />);

    expect(getByText('About')).toBeTruthy();
    expect(getByText('Version 1.2.3')).toBeTruthy();
    expect(getByText('AndroidIRCX')).toBeTruthy();
    expect(getByText('Velimir Majstorov')).toBeTruthy();
    expect(getByText('Instagram')).toBeTruthy();
    expect(getByText('CoderLegion')).toBeTruthy();
  });

  it('calls onClose when close button is pressed', () => {
    const onClose = jest.fn();
    const { getByText } = render(<AboutScreen visible onClose={onClose} />);

    fireEvent.press(getByText('Close'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('opens external links when pressed', () => {
    const openURLSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
    const { getByText } = render(<AboutScreen visible onClose={jest.fn()} />);

    fireEvent.press(getByText('Velimir Majstorov'));
    fireEvent.press(getByText('https://irc.dbase.in.rs'));
    fireEvent.press(getByText('https://androidircx.com'));
    fireEvent.press(getByText('https://github.com/AndroidIRCx/AndroidIRCx'));
    fireEvent.press(getByText('Telegram'));

    expect(openURLSpy).toHaveBeenNthCalledWith(1, 'https://majstorov.info/en/about');
    expect(openURLSpy).toHaveBeenNthCalledWith(2, 'https://irc.dbase.in.rs');
    expect(openURLSpy).toHaveBeenNthCalledWith(3, 'https://androidircx.com');
    expect(openURLSpy).toHaveBeenNthCalledWith(4, 'https://github.com/AndroidIRCx/AndroidIRCx');
    expect(openURLSpy).toHaveBeenNthCalledWith(5, 'https://t.me/androidircx');
  });

  it('logs linking errors when opening a url fails', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(Linking, 'openURL').mockRejectedValueOnce(new Error('open failed'));
    const { getByText } = render(<AboutScreen visible onClose={jest.fn()} />);

    fireEvent.press(getByText('contact@androidircx.com'));

    await waitFor(() => {
      expect(errorSpy).toHaveBeenCalledWith('Failed to open URL:', expect.any(Error));
    });

    errorSpy.mockRestore();
  });
});

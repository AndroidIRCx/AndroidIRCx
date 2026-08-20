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
  beforeEach(async () => {
    jest.clearAllMocks();
  });

  it('renders nothing when not visible', async () => {
    const { queryByText } = await render(
      <AboutScreen visible={false} onClose={jest.fn()} />,
    );

    expect(queryByText('About')).toBeNull();
  });

  it('renders app details and social links when visible', async () => {
    const { getByText } = await render(
      <AboutScreen visible onClose={jest.fn()} />,
    );

    expect(getByText('About')).toBeTruthy();
    expect(getByText('Version 1.2.3')).toBeTruthy();
    expect(getByText('AndroidIRCX')).toBeTruthy();
    expect(getByText('Velimir Majstorov')).toBeTruthy();
    expect(getByText('irc.DBase.in.rs - IRC Database Network')).toBeTruthy();
    expect(getByText('munZe')).toBeTruthy();
    expect(getByText('contact@androidircx.com')).toBeTruthy();
    expect(getByText('Instagram')).toBeTruthy();
    expect(getByText('Facebook')).toBeTruthy();
    expect(getByText('TikTok')).toBeTruthy();
    expect(getByText('X')).toBeTruthy();
    expect(getByText('Reddit')).toBeTruthy();
    expect(getByText('Telegram')).toBeTruthy();
    expect(getByText('LinkedIn')).toBeTruthy();
    expect(getByText('Mastodon')).toBeTruthy();
    expect(getByText('Dev.to')).toBeTruthy();
    expect(getByText('CoderLegion')).toBeTruthy();
  });

  it('shows a Rate button that opens the rating prompt', async () => {
    const { getByText } = await render(
      <AboutScreen visible onClose={jest.fn()} />,
    );

    const rateButton = getByText('Rate AndroidIRCX');
    expect(rateButton).toBeTruthy();

    await fireEvent.press(rateButton);

    await waitFor(() =>
      expect(getByText('Enjoying AndroidIRCX?')).toBeTruthy(),
    );
  });

  it('calls onClose when close button is pressed', async () => {
    const onClose = jest.fn();
    const { getByText } = await render(
      <AboutScreen visible onClose={onClose} />,
    );

    await fireEvent.press(getByText('Close'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('opens external links when pressed', async () => {
    const openURLSpy = jest
      .spyOn(Linking, 'openURL')
      .mockResolvedValue(true as never);
    const { getByText } = await render(
      <AboutScreen visible onClose={jest.fn()} />,
    );

    await fireEvent.press(getByText('Velimir Majstorov'));
    await fireEvent.press(getByText('contact@androidircx.com'));
    await fireEvent.press(getByText('https://irc.dbase.in.rs'));
    await fireEvent.press(getByText('https://androidircx.com'));
    await fireEvent.press(
      getByText('https://github.com/AndroidIRCx/AndroidIRCx'),
    );
    await fireEvent.press(getByText('Instagram'));
    await fireEvent.press(getByText('Facebook'));
    await fireEvent.press(getByText('TikTok'));
    await fireEvent.press(getByText('X'));
    await fireEvent.press(getByText('Reddit'));
    await fireEvent.press(getByText('Telegram'));
    await fireEvent.press(getByText('LinkedIn'));
    await fireEvent.press(getByText('Mastodon'));
    await fireEvent.press(getByText('Dev.to'));
    await fireEvent.press(getByText('CoderLegion'));

    expect(openURLSpy).toHaveBeenNthCalledWith(
      1,
      'https://majstorov.info/en/about',
    );
    expect(openURLSpy).toHaveBeenNthCalledWith(
      2,
      'mailto:contact@androidircx.com',
    );
    expect(openURLSpy).toHaveBeenNthCalledWith(3, 'https://irc.dbase.in.rs');
    expect(openURLSpy).toHaveBeenNthCalledWith(4, 'https://androidircx.com');
    expect(openURLSpy).toHaveBeenNthCalledWith(
      5,
      'https://github.com/AndroidIRCx/AndroidIRCx',
    );
    expect(openURLSpy).toHaveBeenNthCalledWith(
      6,
      'https://www.instagram.com/androidircx/',
    );
    expect(openURLSpy).toHaveBeenNthCalledWith(
      7,
      'https://www.facebook.com/androidircx',
    );
    expect(openURLSpy).toHaveBeenNthCalledWith(
      8,
      'https://www.tiktok.com/@androidircx',
    );
    expect(openURLSpy).toHaveBeenNthCalledWith(9, 'https://x.com/AndroidIRCx');
    expect(openURLSpy).toHaveBeenNthCalledWith(
      10,
      'https://www.reddit.com/r/AndroidIRCx',
    );
    expect(openURLSpy).toHaveBeenNthCalledWith(11, 'https://t.me/androidircx');
    expect(openURLSpy).toHaveBeenNthCalledWith(
      12,
      'https://www.linkedin.com/company/androidircx',
    );
    expect(openURLSpy).toHaveBeenNthCalledWith(
      13,
      'https://mastodon.social/@androidircx',
    );
    expect(openURLSpy).toHaveBeenNthCalledWith(
      14,
      'https://dev.to/androidircx',
    );
    expect(openURLSpy).toHaveBeenNthCalledWith(
      15,
      'https://coderlegion.com/user/AndroidIRCx',
    );
  });

  it('logs linking errors when opening a url fails', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();
    jest
      .spyOn(Linking, 'openURL')
      .mockRejectedValueOnce(new Error('open failed'));
    const { getByText } = await render(
      <AboutScreen visible onClose={jest.fn()} />,
    );

    await fireEvent.press(getByText('contact@androidircx.com'));

    await waitFor(async () => {
      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to open URL:',
        expect.any(Error),
      );
    });

    errorSpy.mockRestore();
  });
});

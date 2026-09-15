/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { ServerSettingsScreen } from '../../src/screens/ServerSettingsScreen';
import { settingsService } from '../../src/services/SettingsService';

jest.mock('../../src/i18n/localization', () => ({
  useT: () => (key: string) => key,
}));

jest.mock('../../src/services/SettingsService', () => ({
  settingsService: {
    getNetwork: jest.fn(),
    setDefaultServerForNetwork: jest.fn(),
    clearDefaultServerForNetwork: jest.fn(),
  },
}));

describe('ServerSettingsScreen', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    (settingsService.getNetwork as jest.Mock).mockResolvedValue({
      id: 'net1',
      defaultServerId: 'srv1',
      servers: [
        {
          id: 'srv1',
          name: 'Primary',
          hostname: 'irc.example.com',
          port: 6697,
          ssl: true,
          rejectUnauthorized: true,
          password: 'secret',
          favorite: true,
        },
      ],
    });
    (settingsService.setDefaultServerForNetwork as jest.Mock).mockResolvedValue(
      undefined,
    );
    (
      settingsService.clearDefaultServerForNetwork as jest.Mock
    ).mockResolvedValue(undefined);
  });

  it('renders defaults for a new server', async () => {
    const { getByDisplayValue, getByText } = await render(
      <ServerSettingsScreen
        networkId="net1"
        onSave={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(getByText('Server Settings')).toBeTruthy();
    expect(getByDisplayValue('6697')).toBeTruthy();
    expect(getByText('Use SSL/TLS')).toBeTruthy();
  });

  it('loads an existing server', async () => {
    const { findByDisplayValue } = await render(
      <ServerSettingsScreen
        networkId="net1"
        serverId="srv1"
        onSave={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(await findByDisplayValue('Primary')).toBeTruthy();
    expect(await findByDisplayValue('irc.example.com')).toBeTruthy();
    expect(await findByDisplayValue('6697')).toBeTruthy();
  });

  it('shows error when server is missing and can retry', async () => {
    (settingsService.getNetwork as jest.Mock).mockResolvedValueOnce({
      id: 'net1',
      defaultServerId: null,
      servers: [],
    });

    const { findByText, getByText } = await render(
      <ServerSettingsScreen
        networkId="net1"
        serverId="srv1"
        onSave={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(await findByText('Server not found')).toBeTruthy();
    await fireEvent.press(getByText('Retry'));

    await waitFor(async () => {
      expect(settingsService.getNetwork).toHaveBeenCalledTimes(2);
    });
  });

  it('shows load error when fetching server throws', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();
    (settingsService.getNetwork as jest.Mock).mockRejectedValueOnce(
      new Error('load failed'),
    );

    const { findByText } = await render(
      <ServerSettingsScreen
        networkId="net1"
        serverId="srv1"
        onSave={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(await findByText('Failed to load server')).toBeTruthy();
    expect(errorSpy).toHaveBeenCalledWith(
      'Error loading server:',
      expect.any(Error),
    );
    errorSpy.mockRestore();
  });

  it('shows validation alert when hostname is empty', async () => {
    const { getByText } = await render(
      <ServerSettingsScreen
        networkId="net1"
        onSave={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    await fireEvent.press(getByText('Save'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Please enter a hostname',
    );
  });

  it('shows validation alert when port is invalid', async () => {
    const { getByPlaceholderText, getByText } = await render(
      <ServerSettingsScreen
        networkId="net1"
        onSave={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    await fireEvent.changeText(
      getByPlaceholderText('irc.example.com'),
      'irc.example.com',
    );
    await fireEvent.changeText(getByPlaceholderText('6697'), '99999');
    await fireEvent.press(getByText('Save'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Please enter a valid port number (1-65535)',
    );
  });

  it('calls onSave with new server values', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const { getByPlaceholderText, getByText } = await render(
      <ServerSettingsScreen
        networkId="net1"
        onSave={onSave}
        onCancel={jest.fn()}
      />,
    );

    await fireEvent.changeText(
      getByPlaceholderText('Server display name'),
      'EU node',
    );
    await fireEvent.changeText(
      getByPlaceholderText('irc.example.com'),
      'irc.eu.example.com',
    );
    await fireEvent.changeText(getByPlaceholderText('6697'), '7000');
    await fireEvent.changeText(
      getByPlaceholderText('Server connection password'),
      'pass123',
    );
    await fireEvent.press(getByText('Save'));

    await waitFor(async () => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'EU node',
          hostname: 'irc.eu.example.com',
          port: 7000,
          password: 'pass123',
        }),
      );
    });
  });

  it('updates default server assignment when enabled on existing server', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const { getAllByRole, getByText } = await render(
      <ServerSettingsScreen
        networkId="net1"
        serverId="srv1"
        onSave={onSave}
        onCancel={jest.fn()}
      />,
    );

    await waitFor(() => expect(getByText('Default Server')).toBeTruthy());
    const switches = getAllByRole('switch');
    const defaultSwitch = switches[switches.length - 1];
    await fireEvent(defaultSwitch, 'valueChange', true);
    await fireEvent.press(getByText('Save'));

    await waitFor(async () => {
      expect(settingsService.setDefaultServerForNetwork).toHaveBeenCalledWith(
        'net1',
        'srv1',
      );
    });
  });

  it('clears default server when existing default is unchecked', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const { getAllByRole, getByText } = await render(
      <ServerSettingsScreen
        networkId="net1"
        serverId="srv1"
        onSave={onSave}
        onCancel={jest.fn()}
      />,
    );

    await waitFor(() => expect(getByText('Default Server')).toBeTruthy());
    const switches = getAllByRole('switch');
    const defaultSwitch = switches[switches.length - 1];
    await fireEvent(defaultSwitch, 'valueChange', false);
    await fireEvent.press(getByText('Save'));

    await waitFor(async () => {
      expect(settingsService.clearDefaultServerForNetwork).toHaveBeenCalledWith(
        'net1',
        'srv1',
      );
    });
  });

  it('calls onCancel from header button', async () => {
    const onCancel = jest.fn();
    const { getByText } = await render(
      <ServerSettingsScreen
        networkId="net1"
        onSave={jest.fn()}
        onCancel={onCancel}
      />,
    );

    await fireEvent.press(getByText('Cancel'));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('shows loading fallback while existing server is loading', async () => {
    let resolveNetwork: ((value: any) => void) | null = null;
    (settingsService.getNetwork as jest.Mock).mockReturnValueOnce(
      new Promise(resolve => {
        resolveNetwork = resolve;
      }),
    );

    const { getByText } = await render(
      <ServerSettingsScreen
        networkId="net1"
        serverId="srv1"
        onSave={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(getByText('Loading...')).toBeTruthy();

    await act(async () => {
      resolveNetwork?.({
        id: 'net1',
        defaultServerId: 'srv1',
        servers: [
          {
            id: 'srv1',
            name: 'Primary',
            hostname: 'irc.example.com',
            port: 6697,
            ssl: true,
            rejectUnauthorized: true,
          },
        ],
      });
    });
  });
});

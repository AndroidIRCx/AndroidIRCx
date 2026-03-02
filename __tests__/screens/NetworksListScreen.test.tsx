/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { NetworksListScreen } from '../../src/screens/NetworksListScreen';

jest.mock('../../src/i18n/transifex', () => ({
  useT: () => (key: string, params?: Record<string, unknown>) => {
    if (!params) {
      return key;
    }

    return Object.entries(params).reduce(
      (result, [paramKey, value]) => result.replace(`{${paramKey}}`, String(value)),
      key
    );
  },
}));

jest.mock('../../src/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      primary: '#09f',
      onPrimary: '#fff',
      border: '#ddd',
      surface: '#f5f5f5',
      text: '#111',
      textSecondary: '#666',
      error: '#f44',
    },
  }),
}));

jest.mock('../../src/services/SettingsService', () => ({
  settingsService: {
    loadNetworks: jest.fn(),
    addNetwork: jest.fn(),
    updateNetwork: jest.fn(),
    deleteNetwork: jest.fn(),
    addServerToNetwork: jest.fn(),
    updateServerInNetwork: jest.fn(),
    deleteServerFromNetwork: jest.fn(),
  },
}));

jest.mock('../../src/screens/NetworkSettingsScreen', () => ({
  NetworkSettingsScreen: ({ networkId, onSave, onCancel }: any) => {
    const React = require('react');
    const { Text } = require('react-native');
    return (
      <>
        <Text>Mock Network Settings {networkId ?? 'new'}</Text>
        <Text
          onPress={() =>
            onSave({
              id: networkId ?? 'new-net',
              name: networkId ? 'Updated Net' : 'Saved Net',
              nick: 'nick',
              servers: [],
            })
          }>
          Save Network
        </Text>
        <Text onPress={onCancel}>Cancel Network Settings</Text>
      </>
    );
  },
}));

jest.mock('../../src/screens/ServerSettingsScreen', () => ({
  ServerSettingsScreen: ({ networkId, serverId, onSave, onCancel }: any) => {
    const React = require('react');
    const { Text } = require('react-native');
    return (
      <>
        <Text>Mock Server Settings {networkId}:{serverId ?? 'new'}</Text>
        <Text
          onPress={() =>
            onSave({
              id: serverId ?? 'saved-server',
              hostname: 'irc.saved.net',
              port: 6697,
              ssl: true,
            })
          }>
          Save Server
        </Text>
        <Text onPress={onCancel}>Cancel Server Settings</Text>
      </>
    );
  },
}));

jest.mock('../../src/screens/ConnectionProfilesScreen', () => ({
  ConnectionProfilesScreen: ({ visible, onClose }: any) => {
    const React = require('react');
    const { Text } = require('react-native');
    return visible ? <Text onPress={onClose}>Mock Connection Profiles</Text> : null;
  },
}));

const { settingsService } = require('../../src/services/SettingsService');

describe('NetworksListScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    settingsService.loadNetworks.mockResolvedValue([
      {
        id: 'net-1',
        name: 'Freenode',
        nick: 'tester',
        servers: [
          { id: 'srv-1', hostname: 'irc.one.net', port: 6667, ssl: false, favorite: false },
          { id: 'srv-2', name: 'SSL Server', hostname: 'irc.two.net', port: 6697, ssl: true, favorite: true },
        ],
      },
      {
        id: 'net-2',
        name: 'Libera',
        nick: 'tester2',
        servers: [{ id: 'srv-3', hostname: 'irc.libera.net', port: 6697, ssl: true, favorite: false }],
      },
    ]);
    settingsService.addNetwork.mockResolvedValue(undefined);
    settingsService.updateNetwork.mockResolvedValue(undefined);
    settingsService.deleteNetwork.mockResolvedValue(undefined);
    settingsService.addServerToNetwork.mockResolvedValue(undefined);
    settingsService.updateServerInNetwork.mockResolvedValue(undefined);
    settingsService.deleteServerFromNetwork.mockResolvedValue(undefined);
  });

  it('loads and renders networks with servers', async () => {
    const { findByText } = render(
      <NetworksListScreen onSelectNetwork={jest.fn()} onClose={jest.fn()} />
    );

    expect(await findByText('Networks')).toBeTruthy();
    expect(await findByText('Freenode')).toBeTruthy();
    expect(await findByText(/SSL Server/)).toBeTruthy();
    expect(await findByText('Libera')).toBeTruthy();
  });

  it('selects a network and closes the modal', async () => {
    const onSelectNetwork = jest.fn();
    const onClose = jest.fn();
    const { findByText } = render(
      <NetworksListScreen onSelectNetwork={onSelectNetwork} onClose={onClose} />
    );

    fireEvent.press(await findByText('Freenode'));

    await waitFor(() => {
      expect(onSelectNetwork).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'net-1', name: 'Freenode' }),
        undefined
      );
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('selects a specific server and closes the modal', async () => {
    const onSelectNetwork = jest.fn();
    const onClose = jest.fn();
    const { findByText } = render(
      <NetworksListScreen onSelectNetwork={onSelectNetwork} onClose={onClose} />
    );

    fireEvent.press(await findByText(/SSL Server/));

    await waitFor(() => {
      expect(onSelectNetwork).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'net-1' }),
        'srv-2'
      );
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('opens connection profiles modal', async () => {
    const { findByText } = render(
      <NetworksListScreen onSelectNetwork={jest.fn()} onClose={jest.fn()} />
    );

    fireEvent.press(await findByText('Identity Profiles'));

    expect(await findByText('Mock Connection Profiles')).toBeTruthy();
  });

  it('opens add network flow and saves a new network', async () => {
    const { findByText } = render(
      <NetworksListScreen onSelectNetwork={jest.fn()} onClose={jest.fn()} />
    );

    fireEvent.press(await findByText('+'));
    expect(await findByText('Mock Network Settings new')).toBeTruthy();

    fireEvent.press(await findByText('Save Network'));

    await waitFor(() => {
      expect(settingsService.addNetwork).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'new-net', name: 'Saved Net' })
      );
    });
  });

  it('opens add server flow and saves a server', async () => {
    const { findAllByText, findByText } = render(
      <NetworksListScreen onSelectNetwork={jest.fn()} onClose={jest.fn()} />
    );

    const addServerButtons = await findAllByText('+ Add Server');
    fireEvent.press(addServerButtons[0]);
    expect(await findByText('Mock Server Settings net-1:new')).toBeTruthy();

    fireEvent.press(await findByText('Save Server'));

    await waitFor(() => {
      expect(settingsService.addServerToNetwork).toHaveBeenCalledWith(
        'net-1',
        expect.objectContaining({ id: 'saved-server', hostname: 'irc.saved.net' })
      );
    });
  });

  it('opens edit network flow and saves changes', async () => {
    const { findAllByText, findByText } = render(
      <NetworksListScreen onSelectNetwork={jest.fn()} onClose={jest.fn()} />
    );

    const editButtons = await findAllByText('Edit');
    fireEvent.press(editButtons[0]);
    expect(await findByText('Mock Network Settings net-1')).toBeTruthy();

    fireEvent.press(await findByText('Save Network'));

    await waitFor(() => {
      expect(settingsService.updateNetwork).toHaveBeenCalledWith(
        'net-1',
        expect.objectContaining({ id: 'net-1', name: 'Updated Net' })
      );
    });
  });

  it('deletes a server after confirmation', async () => {
    const { findAllByText } = render(
      <NetworksListScreen onSelectNetwork={jest.fn()} onClose={jest.fn()} />
    );

    const deleteButtons = await findAllByText('Delete');
    fireEvent.press(deleteButtons[0]);

    const dialog = (Alert.alert as jest.Mock).mock.calls.find(
      call => call[0] === 'Delete Server'
    );
    expect(dialog).toBeTruthy();

    await act(async () => {
      await dialog[2][1].onPress();
    });

    expect(settingsService.deleteServerFromNetwork).toHaveBeenCalledWith('net-1', 'srv-1');
  });

  it('closes from header button', async () => {
    const onClose = jest.fn();
    const { findByText } = render(
      <NetworksListScreen onSelectNetwork={jest.fn()} onClose={onClose} />
    );

    fireEvent.press(await findByText('Close'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows loading state while networks are being fetched', async () => {
    let resolveLoad: ((value: unknown) => void) | undefined;
    settingsService.loadNetworks.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveLoad = resolve;
        })
    );

    const { findByText } = render(
      <NetworksListScreen onSelectNetwork={jest.fn()} onClose={jest.fn()} />
    );

    expect(await findByText('Loading...')).toBeTruthy();

    await act(async () => {
      resolveLoad?.([
        {
          id: 'net-1',
          name: 'Freenode',
          nick: 'tester',
          servers: [{ id: 'srv-1', hostname: 'irc.one.net', port: 6667, ssl: false }],
        },
      ]);
    });

    expect(await findByText('Freenode')).toBeTruthy();
  });
});

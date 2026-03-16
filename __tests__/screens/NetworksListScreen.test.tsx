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

jest.mock('../../src/services/IrcDatabaseImportService', () => ({
  ircDatabaseImportService: {
    loadCatalog: jest.fn(),
    importFromIrcDatabase: jest.fn(),
  },
}));

const { settingsService } = require('../../src/services/SettingsService');
const { ircDatabaseImportService } = require('../../src/services/IrcDatabaseImportService');

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
    ircDatabaseImportService.importFromIrcDatabase.mockResolvedValue({
      importedNetworks: 2,
      importedServers: 3,
      mergedNetworks: 0,
      mergedServers: 0,
      skippedExistingNetworks: 1,
      skippedInvalidNetworks: 0,
      skippedInvalidServers: 0,
      totalApiNetworks: 3,
      failedPersistNetworks: 0,
    });
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

  it('opens IRC Database info modal', async () => {
    const { findByText } = render(
      <NetworksListScreen onSelectNetwork={jest.fn()} onClose={jest.fn()} />
    );

    fireEvent.press(await findByText('Reload from IRC Database'));

    expect(await findByText('Reload Networks from IRC Database')).toBeTruthy();
    expect(await findByText('Update from IRC Database')).toBeTruthy();
    expect(await findByText('AndroidIRCX reloads approved presets from IRC Database. Imported entries are added to your local Networks list. Your default DBase setup remains unchanged.')).toBeTruthy();
    expect(await findByText('https://irc.dbase.in.rs/privacy-policy')).toBeTruthy();
    expect(await findByText('https://irc.dbase.in.rs/terms-of-service')).toBeTruthy();
    expect(ircDatabaseImportService.loadCatalog).not.toHaveBeenCalled();
  });

  it('closes IRC Database info modal on cancel', async () => {
    const { findByText, queryByText } = render(
      <NetworksListScreen onSelectNetwork={jest.fn()} onClose={jest.fn()} />
    );

    fireEvent.press(await findByText('Reload from IRC Database'));
    expect(await findByText('Reload Networks from IRC Database')).toBeTruthy();

    fireEvent.press(await findByText('Cancel'));

    await waitFor(() => {
      expect(queryByText('Reload Networks from IRC Database')).toBeNull();
    });
  });

  it('imports networks from IRC Database and refreshes list', async () => {
    const { findByText } = render(
      <NetworksListScreen onSelectNetwork={jest.fn()} onClose={jest.fn()} />
    );

    fireEvent.press(await findByText('Reload from IRC Database'));
    fireEvent.press(await findByText('Update from IRC Database'));

    await waitFor(() => {
      expect(ircDatabaseImportService.importFromIrcDatabase).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(settingsService.loadNetworks).toHaveBeenCalledTimes(2);
    });
    expect(ircDatabaseImportService.loadCatalog).not.toHaveBeenCalled();

    expect(Alert.alert).toHaveBeenCalledWith(
      'Import completed',
      expect.stringContaining('Imported: 2 networks (3 servers)')
    );
  });

  it('shows import error alert when IRC Database import fails', async () => {
    ircDatabaseImportService.importFromIrcDatabase.mockRejectedValueOnce(new Error('Network down'));
    const { findByText } = render(
      <NetworksListScreen onSelectNetwork={jest.fn()} onClose={jest.fn()} />
    );

    fireEvent.press(await findByText('Reload from IRC Database'));
    fireEvent.press(await findByText('Update from IRC Database'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Import failed',
        expect.stringContaining('Network down')
      );
    });
  });

  it('prevents duplicate import action while loading', async () => {
    let resolveImport: ((value: unknown) => void) | undefined;
    ircDatabaseImportService.importFromIrcDatabase.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveImport = resolve;
        })
    );

    const { findByText, queryByText } = render(
      <NetworksListScreen onSelectNetwork={jest.fn()} onClose={jest.fn()} />
    );

    fireEvent.press(await findByText('Reload from IRC Database'));
    fireEvent.press(await findByText('Update from IRC Database'));
    expect(queryByText('Update from IRC Database')).toBeNull();

    fireEvent.press(await findByText('Reload from IRC Database'));
    await waitFor(() => {
      expect(ircDatabaseImportService.importFromIrcDatabase).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      resolveImport?.({
        importedNetworks: 1,
        importedServers: 1,
        mergedNetworks: 0,
        mergedServers: 0,
        skippedExistingNetworks: 0,
        skippedInvalidNetworks: 0,
        skippedInvalidServers: 0,
        totalApiNetworks: 1,
        failedPersistNetworks: 0,
      });
    });
  });

  it('shows partial import alert when some networks fail to persist', async () => {
    ircDatabaseImportService.importFromIrcDatabase.mockResolvedValueOnce({
      importedNetworks: 1,
      importedServers: 1,
      mergedNetworks: 0,
      mergedServers: 0,
      skippedExistingNetworks: 1,
      skippedInvalidNetworks: 0,
      skippedInvalidServers: 0,
      totalApiNetworks: 3,
      failedPersistNetworks: 1,
    });

    const { findByText } = render(
      <NetworksListScreen onSelectNetwork={jest.fn()} onClose={jest.fn()} />
    );

    fireEvent.press(await findByText('Reload from IRC Database'));
    fireEvent.press(await findByText('Update from IRC Database'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Import partially completed',
        expect.stringContaining('Failed to save: 1')
      );
    });
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

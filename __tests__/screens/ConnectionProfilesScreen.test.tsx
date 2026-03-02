/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { Alert, TouchableOpacity } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { ConnectionProfilesScreen } from '../../src/screens/ConnectionProfilesScreen';

const mockNetworks = [
  {
    id: 'net1',
    name: 'Libera',
    connectionType: 'irc',
    identityProfileId: 'profile-1',
    nick: 'majstor',
    altNick: 'majstor_',
    realname: 'Velimir',
    ident: 'majstor',
    servers: [
      { id: 'srv1', hostname: 'irc.libera.chat', port: 6697, ssl: true, favorite: true },
      { id: 'srv2', hostname: 'backup.libera.chat', port: 6667, ssl: false, favorite: false },
    ],
  },
];

const mockProfiles = [
  { id: 'profile-1', name: 'Main Profile', nick: 'majstor' },
  { id: 'profile-2', name: 'Alt Profile', nick: 'alt' },
];

jest.mock('../../src/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#000',
      surface: '#111',
      border: '#333',
      text: '#fff',
      textSecondary: '#bbb',
      primary: '#4caf50',
      onPrimary: '#fff',
      error: '#f44336',
      buttonPrimary: '#4caf50',
      buttonPrimaryText: '#fff',
      buttonSecondary: '#222',
      buttonSecondaryText: '#fff',
    },
  }),
}));

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

jest.mock('@react-native-picker/picker', () => ({
  Picker: Object.assign(({ children }: any) => children, {
    Item: ({ label }: any) => {
      const React = require('react');
      const { Text } = require('react-native');
      return <Text>{label}</Text>;
    },
  }),
}));

jest.mock('../../src/screens/NetworkSettingsScreen', () => ({
  NetworkSettingsScreen: ({ onSave, onCancel }: any) => {
    const React = require('react');
    const { Text } = require('react-native');
    return (
      <>
        <Text>Mock Network Editor</Text>
        <Text
          onPress={() =>
            onSave({
              id: 'new-network',
              name: 'New Network',
              nick: 'nick',
              altNick: 'alt',
              realname: 'real',
              ident: 'ident',
              autoJoinChannels: ['#test'],
              sasl: {},
              proxy: {},
              clientCert: '',
              clientKey: '',
              servers: [{ id: 'srv-new', hostname: 'new.example', port: 6697, ssl: true }],
            })
          }>
          Save Mock Network
        </Text>
        <Text onPress={onCancel}>Cancel Mock Network</Text>
      </>
    );
  },
}));

jest.mock('../../src/screens/ServerSettingsScreen', () => ({
  ServerSettingsScreen: ({ onSave, onCancel }: any) => {
    const React = require('react');
    const { Text } = require('react-native');
    return (
      <>
        <Text>Mock Server Editor</Text>
        <Text
          onPress={() =>
            onSave({
              id: 'srv-added',
              hostname: 'added.example',
              port: 7000,
              ssl: true,
              favorite: false,
            })
          }>
          Save Mock Server
        </Text>
        <Text onPress={onCancel}>Cancel Mock Server</Text>
      </>
    );
  },
}));

jest.mock('../../src/services/SettingsService', () => ({
  settingsService: {
    getAllNetworks: jest.fn(),
    updateNetworkProfile: jest.fn(),
    updateNetwork: jest.fn(),
    addNetwork: jest.fn(),
    updateServerInNetwork: jest.fn(),
    addServerToNetwork: jest.fn(),
    deleteNetwork: jest.fn(),
    deleteServerFromNetwork: jest.fn(),
  },
}));

jest.mock('../../src/services/IdentityProfilesService', () => ({
  identityProfilesService: {
    list: jest.fn(),
    add: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  },
}));

const { settingsService } = require('../../src/services/SettingsService');
const { identityProfilesService } = require('../../src/services/IdentityProfilesService');

describe('ConnectionProfilesScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    settingsService.getAllNetworks.mockResolvedValue(mockNetworks);
    settingsService.updateNetworkProfile.mockResolvedValue(undefined);
    settingsService.updateNetwork.mockResolvedValue(undefined);
    settingsService.addNetwork.mockResolvedValue(undefined);
    settingsService.updateServerInNetwork.mockResolvedValue(undefined);
    settingsService.addServerToNetwork.mockResolvedValue(undefined);
    settingsService.deleteNetwork.mockResolvedValue(undefined);
    settingsService.deleteServerFromNetwork.mockResolvedValue(undefined);
    identityProfilesService.list.mockResolvedValue(mockProfiles);
    identityProfilesService.add.mockResolvedValue({ id: 'profile-3', name: 'Created' });
    identityProfilesService.update.mockResolvedValue(undefined);
    identityProfilesService.remove.mockResolvedValue(undefined);
  });

  it('renders loaded networks and supports connection type and identity changes', async () => {
    const { findByText, getByText } = render(
      <ConnectionProfilesScreen visible onClose={jest.fn()} />
    );

    expect(await findByText('Connection Profiles')).toBeTruthy();
    fireEvent.press(getByText('Libera'));
    fireEvent.press(await findByText('ZNC'));
    fireEvent.press(await findByText('Alt Profile'));

    await waitFor(() => {
      expect(settingsService.updateNetworkProfile).toHaveBeenCalledWith('net1', 'znc', undefined);
      expect(settingsService.updateNetworkProfile).toHaveBeenCalledWith('net1', undefined, 'profile-2');
    });
  });

  it('opens network and server editors and saves through callbacks', async () => {
    const { findByText, getByText } = render(
      <ConnectionProfilesScreen visible onClose={jest.fn()} />
    );

    fireEvent.press(await findByText('Add'));
    fireEvent.press(await findByText('Save Mock Network'));

    await waitFor(() => {
      expect(settingsService.addNetwork).toHaveBeenCalled();
    });

    fireEvent.press(getByText('Libera'));
    fireEvent.press(await findByText('+ Add Server'));
    fireEvent.press(await findByText('Save Mock Server'));

    await waitFor(() => {
      expect(settingsService.addServerToNetwork).toHaveBeenCalledWith(
        'net1',
        expect.objectContaining({
          hostname: 'added.example',
        })
      );
    });
  });

  it('deletes a network and prevents deleting the last server', async () => {
    const { findByText } = render(
      <ConnectionProfilesScreen visible onClose={jest.fn()} />
    );

    fireEvent.press(await findByText('Libera'));
    fireEvent.press(await findByText('Delete Network'));

    let buttons = (Alert.alert as jest.Mock).mock.calls.at(-1)?.[2];
    await act(async () => {
      await buttons?.[1]?.onPress?.();
    });

    await waitFor(() => {
      expect(settingsService.deleteNetwork).toHaveBeenCalledWith('net1');
    });

    (Alert.alert as jest.Mock).mockClear();
    settingsService.getAllNetworks.mockResolvedValue([
      {
        ...mockNetworks[0],
        servers: [{ id: 'only', hostname: 'irc.libera.chat', port: 6697, ssl: true, favorite: true }],
      },
    ]);

    const secondRender = render(<ConnectionProfilesScreen visible onClose={jest.fn()} />);

    fireEvent.press(await secondRender.findByText('Libera'));
    const disabledDeleteButton = secondRender.UNSAFE_getAllByType(TouchableOpacity).find(
      node => node.props.disabled === true
    );
    expect(disabledDeleteButton).toBeTruthy();
    await act(async () => {
      disabledDeleteButton?.props.onPress();
    });
    expect(Alert.alert).toHaveBeenCalledWith(
      'Cannot Delete Server',
      'Each network must have at least one server.'
    );
  });

  it('shows empty and load error states', async () => {
    settingsService.getAllNetworks.mockResolvedValueOnce([]);
    const { findByText, rerender } = render(
      <ConnectionProfilesScreen visible onClose={jest.fn()} />
    );
    expect(await findByText('No networks configured yet. Add a network to get started!')).toBeTruthy();

    settingsService.getAllNetworks.mockRejectedValueOnce(new Error('boom'));
    rerender(<ConnectionProfilesScreen visible={false} onClose={jest.fn()} />);
    rerender(<ConnectionProfilesScreen visible onClose={jest.fn()} />);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to load networks and profiles');
    });
  });

  it('validates and saves an identity profile from the modal', async () => {
    const { findAllByText, findByPlaceholderText, findByText, getByText } = render(
      <ConnectionProfilesScreen visible onClose={jest.fn()} />
    );

    expect(await findByText('Libera')).toBeTruthy();
    fireEvent.press(getByText('Libera'));
    fireEvent.press(await findByText('+ Add / Edit Identity'));
    fireEvent.press((await findAllByText('Save'))[0]);
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Profile name and nick are required');

    fireEvent.changeText(await findByPlaceholderText('Profile Name'), 'Profile X');
    fireEvent.changeText(await findByPlaceholderText('Nick'), 'nickx');
    fireEvent.press((await findAllByText('Save'))[0]);

    await waitFor(() => {
      expect(identityProfilesService.add).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Profile X',
          nick: 'nickx',
        })
      );
    });
  });
});

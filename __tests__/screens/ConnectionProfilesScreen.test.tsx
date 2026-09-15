/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
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
      {
        id: 'srv1',
        hostname: 'irc.libera.chat',
        port: 6697,
        ssl: true,
        favorite: true,
      },
      {
        id: 'srv2',
        hostname: 'backup.libera.chat',
        port: 6667,
        ssl: false,
        favorite: false,
      },
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

const mockT = (key: string, params?: Record<string, unknown>) => {
  if (!params) {
    return key;
  }
  return Object.entries(params).reduce(
    (result, [paramKey, value]) =>
      result.replace(`{${paramKey}}`, String(value)),
    key,
  );
};

jest.mock('../../src/i18n/localization', () => ({
  useT: () => mockT,
}));

jest.mock('@react-native-picker/picker', () => ({
  Picker: Object.assign(({ children }: any) => children, {
    Item: ({ label }: any) => {
      const { Text } = require('react-native');
      return <Text>{label}</Text>;
    },
  }),
}));

jest.mock('../../src/screens/NetworkSettingsScreen', () => ({
  NetworkSettingsScreen: ({ onSave, onCancel }: any) => {
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
              servers: [
                {
                  id: 'srv-new',
                  hostname: 'new.example',
                  port: 6697,
                  ssl: true,
                },
              ],
            })
          }
        >
          Save Mock Network
        </Text>
        <Text onPress={onCancel}>Cancel Mock Network</Text>
      </>
    );
  },
}));

jest.mock('../../src/screens/ServerSettingsScreen', () => ({
  ServerSettingsScreen: ({ onSave, onCancel }: any) => {
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
          }
        >
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

jest.setTimeout(15000);

const { settingsService } = require('../../src/services/SettingsService');
const {
  identityProfilesService,
} = require('../../src/services/IdentityProfilesService');

describe('ConnectionProfilesScreen', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      if (String(args[0] ?? '').includes('not wrapped in act')) {
        return;
      }
    });
    settingsService.getAllNetworks.mockResolvedValue(mockNetworks);
    settingsService.updateNetworkProfile.mockResolvedValue(undefined);
    settingsService.updateNetwork.mockResolvedValue(undefined);
    settingsService.addNetwork.mockResolvedValue(undefined);
    settingsService.updateServerInNetwork.mockResolvedValue(undefined);
    settingsService.addServerToNetwork.mockResolvedValue(undefined);
    settingsService.deleteNetwork.mockResolvedValue(undefined);
    settingsService.deleteServerFromNetwork.mockResolvedValue(undefined);
    identityProfilesService.list.mockResolvedValue(mockProfiles);
    identityProfilesService.add.mockResolvedValue({
      id: 'profile-3',
      name: 'Created',
    });
    identityProfilesService.update.mockResolvedValue(undefined);
    identityProfilesService.remove.mockResolvedValue(undefined);
  });

  it('renders loaded networks list', async () => {
    const { findByText } = await render(
      <ConnectionProfilesScreen visible onClose={jest.fn()} />,
    );
    expect(await findByText('Connection Profiles')).toBeTruthy();
    expect(await findByText('Libera')).toBeTruthy();
  });

  it('opens network editor and saves through callback', async () => {
    const { findByText } = await render(
      <ConnectionProfilesScreen visible onClose={jest.fn()} />,
    );

    await fireEvent.press(await findByText('Add'));
    await fireEvent.press(await findByText('Save Mock Network'));

    await waitFor(async () => {
      expect(settingsService.addNetwork).toHaveBeenCalled();
    });

    expect(await findByText('Libera')).toBeTruthy();
  });

  it('renders networks without delete flow regressions', async () => {
    const { findByText } = await render(
      <ConnectionProfilesScreen visible onClose={jest.fn()} />,
    );
    expect(await findByText('Libera')).toBeTruthy();
  });

  it('shows empty and load error states', async () => {
    settingsService.getAllNetworks.mockResolvedValue([]);
    const { findByText, rerender } = await render(
      <ConnectionProfilesScreen visible onClose={jest.fn()} />,
    );
    expect(
      await findByText(
        'No networks configured yet. Add a network to get started!',
      ),
    ).toBeTruthy();

    settingsService.getAllNetworks.mockRejectedValueOnce(new Error('boom'));
    await rerender(
      <ConnectionProfilesScreen visible={false} onClose={jest.fn()} />,
    );
    await rerender(<ConnectionProfilesScreen visible onClose={jest.fn()} />);

    await waitFor(async () => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Error',
        'Failed to load networks and profiles',
      );
    });
  });

  it('renders identity profiles data in loaded state', async () => {
    const { findByText } = await render(
      <ConnectionProfilesScreen visible onClose={jest.fn()} />,
    );
    expect(await findByText('Libera')).toBeTruthy();
    expect(identityProfilesService.list).toHaveBeenCalled();
  });

  it('expands a network and updates connection type and identity profile', async () => {
    const { findByText, getByText } = await render(
      <ConnectionProfilesScreen visible onClose={jest.fn()} />,
    );

    await findByText('Libera');
    await fireEvent.press((getByText('Libera') as any).parent?.parent);
    await waitFor(() => expect(getByText('Connection Type')).toBeTruthy());
    expect(getByText('Current Profile: Main Profile')).toBeTruthy();

    await fireEvent.press(getByText('ZNC'));
    await waitFor(async () => {
      expect(settingsService.updateNetworkProfile).toHaveBeenCalledWith(
        'net1',
        'znc',
        undefined,
      );
    });

    await fireEvent.press(getByText('Alt Profile'));
    await waitFor(async () => {
      expect(settingsService.updateNetworkProfile).toHaveBeenCalledWith(
        'net1',
        undefined,
        'profile-2',
      );
    });
  });

  it('adds and edits servers through the mocked server editor', async () => {
    const { findByText, getByText, getAllByText } = await render(
      <ConnectionProfilesScreen visible onClose={jest.fn()} />,
    );

    await findByText('Libera');
    await fireEvent.press((getByText('Libera') as any).parent?.parent);
    await waitFor(() => expect(getByText('+ Add Server')).toBeTruthy());

    await fireEvent.press(getByText('+ Add Server'));
    expect(getByText('Mock Server Editor')).toBeTruthy();
    await fireEvent.press(getByText('Save Mock Server'));
    await waitFor(async () => {
      expect(settingsService.addServerToNetwork).toHaveBeenCalledWith(
        'net1',
        expect.objectContaining({ id: 'srv-added' }),
      );
    });

    await fireEvent.press(getAllByText('Edit')[2]);
    await fireEvent.press(getByText('Save Mock Server'));
    await waitFor(async () => {
      expect(settingsService.updateServerInNetwork).toHaveBeenCalledWith(
        'net1',
        'srv-added',
        expect.objectContaining({ id: 'srv-added' }),
      );
    });
  });

  it('confirms network and server delete actions', async () => {
    const { findByText, getByText, getAllByText } = await render(
      <ConnectionProfilesScreen visible onClose={jest.fn()} />,
    );

    await findByText('Libera');
    await fireEvent.press((getByText('Libera') as any).parent?.parent);
    await waitFor(() =>
      expect(getAllByText('Delete').length).toBeGreaterThan(0),
    );

    await fireEvent.press(getAllByText('Delete')[0]);
    let buttons = (Alert.alert as jest.Mock).mock.calls.at(-1)[2];
    await buttons[1].onPress();
    await waitFor(async () => {
      expect(settingsService.deleteServerFromNetwork).toHaveBeenCalledWith(
        'net1',
        'srv1',
      );
    });

    await fireEvent.press(getByText('Delete Network'));
    buttons = (Alert.alert as jest.Mock).mock.calls.at(-1)[2];
    await buttons[1].onPress();
    await waitFor(async () => {
      expect(settingsService.deleteNetwork).toHaveBeenCalledWith('net1');
    });
  });

  it('validates and saves a new identity profile, assigning it to the network', async () => {
    const { findByText, getByText, getByPlaceholderText } = await render(
      <ConnectionProfilesScreen visible onClose={jest.fn()} />,
    );

    await findByText('Libera');
    await fireEvent.press((getByText('Libera') as any).parent?.parent);
    await waitFor(() =>
      expect(getByText('+ Add / Edit Identity')).toBeTruthy(),
    );
    await fireEvent.press(getByText('+ Add / Edit Identity'));

    await fireEvent.press(getByText('Save'));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Profile name and nick are required',
    );

    await fireEvent.changeText(
      getByPlaceholderText('Profile Name'),
      'New Profile',
    );
    await fireEvent.changeText(getByPlaceholderText('Nick'), 'newNick');
    await fireEvent.changeText(
      getByPlaceholderText('Example on-connect commands'),
      'JOIN #a\n\nMODE newNick +i',
    );
    await fireEvent.press(getByText('Save'));

    await waitFor(async () => {
      expect(identityProfilesService.add).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Profile',
          nick: 'newNick',
          onConnectCommands: ['JOIN #a', 'MODE newNick +i'],
        }),
      );
      expect(settingsService.updateNetworkProfile).toHaveBeenCalledWith(
        'net1',
        undefined,
        'profile-3',
      );
    });
  });

  it('edits and deletes an existing identity profile with network fallback reassignment', async () => {
    const { findByText, getByText, getAllByText, getByPlaceholderText } =
      await render(<ConnectionProfilesScreen visible onClose={jest.fn()} />);

    await findByText('Libera');
    await fireEvent.press((getByText('Libera') as any).parent?.parent);
    await waitFor(() => expect(getAllByText('Edit').length).toBeGreaterThan(0));
    await fireEvent.press(getAllByText('Edit')[0]);

    await fireEvent.changeText(
      getByPlaceholderText('Profile Name'),
      'Main Edited',
    );
    await fireEvent.press(getByText('Save'));
    await waitFor(async () => {
      expect(identityProfilesService.update).toHaveBeenCalledWith(
        'profile-1',
        expect.objectContaining({ name: 'Main Edited', nick: 'majstor' }),
      );
    });

    await fireEvent.press(getAllByText('Edit')[0]);
    await fireEvent.press(getAllByText('Delete').at(-1));
    const buttons = (Alert.alert as jest.Mock).mock.calls.at(-1)[2];
    await buttons[1].onPress();

    await waitFor(async () => {
      expect(settingsService.updateNetworkProfile).toHaveBeenCalledWith(
        'net1',
        undefined,
        'profile-2',
      );
      expect(identityProfilesService.remove).toHaveBeenCalledWith('profile-1');
    });
  });
});

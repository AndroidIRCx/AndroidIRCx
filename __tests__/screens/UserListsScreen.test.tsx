/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { UserListsScreen } from '../../src/screens/UserListsScreen';

const mockEntries = [
  {
    mask: 'nick!*@*',
    network: 'net1',
    channels: ['#chat'],
    protected: true,
    addedAt: new Date('2026-03-01T10:00:00Z').getTime(),
    reason: 'watch list',
  },
];

const mockIgnored = [
  {
    mask: 'badguy!*@evil.host',
    network: 'net2',
    addedAt: new Date('2026-03-01T11:00:00Z').getTime(),
    reason: 'spam',
    protected: false,
  },
];

const mockState = {
  userListTarget: null as any,
  setUserListTarget: jest.fn(),
};

const mockUserManagementService = {
  getUserListEntries: jest.fn(),
  getIgnoredUsers: jest.fn(),
  addUserListEntry: jest.fn(),
  removeUserListEntry: jest.fn(),
  ignoreUser: jest.fn(),
  unignoreUser: jest.fn(),
};

const mockConnectionScopedUserManagementService = {
  ...mockUserManagementService,
};

const mockIrcService = {
  getChannels: jest.fn(),
  getChannelUsers: jest.fn(),
};

jest.mock('../../src/i18n/transifex', () => ({
  useT: () => (key: string) => key,
}));

jest.mock('../../src/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      surface: '#111',
      surfaceVariant: '#222',
      inputBackground: '#333',
      border: '#444',
      text: '#fff',
      textSecondary: '#bbb',
      primary: '#4caf50',
      primaryLight: '#81c784',
      onPrimary: '#fff',
      success: '#4caf50',
      error: '#f44336',
      surfaceAlt: '#555',
    },
  }),
}));

jest.mock('../../src/stores/uiStore', () => ({
  useUIStore: {
    getState: () => mockState,
  },
}));

jest.mock('../../src/services/UserManagementService', () => ({
  userManagementService: mockUserManagementService,
}));

jest.mock('../../src/services/ConnectionManager', () => ({
  connectionManager: {
    getAllConnections: jest.fn(() => [{ networkId: 'net1' }, { networkId: 'net2' }]),
    getConnection: jest.fn((networkId: string) => {
      if (!networkId) {
        return null;
      }
      return {
        userManagementService: mockConnectionScopedUserManagementService,
        ircService: mockIrcService,
      };
    }),
  },
}));

describe('UserListsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    mockState.userListTarget = null;
    mockUserManagementService.getUserListEntries.mockReturnValue(mockEntries);
    mockUserManagementService.getIgnoredUsers.mockReturnValue(mockIgnored);
    mockUserManagementService.addUserListEntry.mockResolvedValue(undefined);
    mockUserManagementService.removeUserListEntry.mockResolvedValue(undefined);
    mockUserManagementService.ignoreUser.mockResolvedValue(undefined);
    mockUserManagementService.unignoreUser.mockResolvedValue(undefined);
    mockConnectionScopedUserManagementService.getUserListEntries.mockReturnValue(mockEntries);
    mockConnectionScopedUserManagementService.getIgnoredUsers.mockReturnValue(mockIgnored);
    mockConnectionScopedUserManagementService.addUserListEntry.mockResolvedValue(undefined);
    mockConnectionScopedUserManagementService.removeUserListEntry.mockResolvedValue(undefined);
    mockConnectionScopedUserManagementService.ignoreUser.mockResolvedValue(undefined);
    mockConnectionScopedUserManagementService.unignoreUser.mockResolvedValue(undefined);
    mockIrcService.getChannels.mockReturnValue(['#chat', '#other']);
    mockIrcService.getChannelUsers.mockImplementation((channel: string) => {
      if (channel === '#chat') {
        return [
          { nick: 'Alice', ident: 'alice', host: 'chat.host' },
          { nick: 'Bob', ident: 'bob', host: 'chat.host' },
        ];
      }
      return [{ nick: 'Alice', ident: 'alice', host: 'chat.host' }];
    });
  });

  it('prefills from context target and adds a user-list entry', async () => {
    mockState.userListTarget = {
      nick: 'prefilled',
      mask: 'prefilled!*@*',
      channels: ['#chat', '#ops'],
      listType: 'notify',
    };

    const { findByDisplayValue, findByText, findByPlaceholderText } = render(
      <UserListsScreen visible network="net1" onClose={jest.fn()} />
    );

    expect(await findByDisplayValue('prefilled!*@*')).toBeTruthy();
    expect(mockState.setUserListTarget).toHaveBeenCalledWith(null);

    fireEvent.changeText(await findByPlaceholderText('optional note'), 'new note');
    fireEvent.press(await findByText('Add'));

    await waitFor(() => {
      expect(mockConnectionScopedUserManagementService.addUserListEntry).toHaveBeenCalledWith(
        'notify',
        'prefilled!*@*',
        expect.objectContaining({
          network: 'net1',
          channels: ['#chat', '#ops'],
          protected: false,
          reason: 'new note',
        })
      );
    });

    expect(Alert.alert).toHaveBeenCalledWith('Success', 'Entry added');
  });

  it('filters, edits, removes, and switches to ignore tab', async () => {
    const { findByText, findByPlaceholderText, getByText, queryByText } = render(
      <UserListsScreen visible network="net1" onClose={jest.fn()} />
    );

    expect(await findByText('nick!*@*')).toBeTruthy();

    fireEvent.changeText(await findByPlaceholderText('Search by mask or reason...'), 'watch');
    expect(getByText('nick!*@*')).toBeTruthy();

    fireEvent.changeText(await findByPlaceholderText('Search by mask or reason...'), 'missing');
    expect(await findByText('No matching entries')).toBeTruthy();

    fireEvent.changeText(await findByPlaceholderText('Search by mask or reason...'), '');
    fireEvent.press(getByText('Edit'));
    fireEvent.changeText(await findByPlaceholderText('nick or mask'), 'edited!*@*');
    fireEvent.press(getByText('Save'));

    await waitFor(() => {
      expect(mockConnectionScopedUserManagementService.removeUserListEntry).toHaveBeenCalledWith(
        'notify',
        'nick!*@*',
        'net1'
      );
      expect(mockConnectionScopedUserManagementService.addUserListEntry).toHaveBeenCalledWith(
        'notify',
        'edited!*@*',
        expect.objectContaining({
          network: 'net1',
          channels: ['#chat'],
          protected: true,
          reason: 'watch list',
        })
      );
    });

    fireEvent.press(getByText('Remove'));
    const removeButtons = (Alert.alert as jest.Mock).mock.calls.at(-1)?.[2];
    await act(async () => {
      await removeButtons?.[1]?.onPress?.();
    });
    await waitFor(() => {
      expect(mockConnectionScopedUserManagementService.removeUserListEntry).toHaveBeenCalledWith(
        'notify',
        'nick!*@*',
        'net1'
      );
    });

    fireEvent.press(getByText('Ignore'));
    expect(await findByText('badguy!*@evil.host')).toBeTruthy();
    expect(queryByText('nick!*@*')).toBeNull();
  });

  it('supports online-user picker and network filter', async () => {
    const { findByPlaceholderText, findByText, getByText, queryByText } = render(
      <UserListsScreen visible network="net1" onClose={jest.fn()} />
    );

    fireEvent.press(await findByText('+ Add'));
    fireEvent.press(getByText('Select from Online Users'));
    fireEvent.press(await findByText('Alice'));
    expect(await findByPlaceholderText('nick or mask')).toHaveProp(
      'value',
      'Alice!alice@chat.host'
    );

    fireEvent.press(getByText('All Networks'));
    fireEvent.press(await findByText('Filter by Network'));
    fireEvent.press(await findByText('net2'));

    await waitFor(() => {
      expect(queryByText('nick!*@*')).toBeNull();
    });
    expect(getByText('No matching entries')).toBeTruthy();
  });
});

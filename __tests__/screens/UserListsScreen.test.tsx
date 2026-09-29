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

jest.mock('../../src/i18n/localization', () => ({
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
    getAllConnections: jest.fn(() => [
      { networkId: 'net1' },
      { networkId: 'net2' },
    ]),
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
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    mockState.userListTarget = null;
    mockUserManagementService.getUserListEntries.mockReturnValue(mockEntries);
    mockUserManagementService.getIgnoredUsers.mockReturnValue(mockIgnored);
    mockUserManagementService.addUserListEntry.mockResolvedValue(undefined);
    mockUserManagementService.removeUserListEntry.mockResolvedValue(undefined);
    mockUserManagementService.ignoreUser.mockResolvedValue(undefined);
    mockUserManagementService.unignoreUser.mockResolvedValue(undefined);
    mockConnectionScopedUserManagementService.getUserListEntries.mockReturnValue(
      mockEntries,
    );
    mockConnectionScopedUserManagementService.getIgnoredUsers.mockReturnValue(
      mockIgnored,
    );
    mockConnectionScopedUserManagementService.addUserListEntry.mockResolvedValue(
      undefined,
    );
    mockConnectionScopedUserManagementService.removeUserListEntry.mockResolvedValue(
      undefined,
    );
    mockConnectionScopedUserManagementService.ignoreUser.mockResolvedValue(
      undefined,
    );
    mockConnectionScopedUserManagementService.unignoreUser.mockResolvedValue(
      undefined,
    );
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

    const { findByDisplayValue, findByText, findByPlaceholderText } =
      await render(
        <UserListsScreen visible network="net1" onClose={jest.fn()} />,
      );

    expect(await findByDisplayValue('prefilled!*@*')).toBeTruthy();
    expect(mockState.setUserListTarget).toHaveBeenCalledWith(null);

    await fireEvent.changeText(
      await findByPlaceholderText('optional note'),
      'new note',
    );
    await fireEvent.press(await findByText('Add'));

    await waitFor(async () => {
      expect(
        mockConnectionScopedUserManagementService.addUserListEntry,
      ).toHaveBeenCalledWith(
        'notify',
        'prefilled!*@*',
        expect.objectContaining({
          network: 'net1',
          channels: ['#chat', '#ops'],
          protected: false,
          reason: 'new note',
        }),
      );
    });

    expect(Alert.alert).toHaveBeenCalledWith('Success', 'Entry added');
  });

  it('filters, edits, removes, and switches to ignore tab', async () => {
    const { findByText, findByPlaceholderText, getByText, queryByText } =
      await render(
        <UserListsScreen visible network="net1" onClose={jest.fn()} />,
      );

    expect(await findByText('nick!*@*')).toBeTruthy();

    await fireEvent.changeText(
      await findByPlaceholderText('Search by mask or reason...'),
      'watch',
    );
    expect(getByText('nick!*@*')).toBeTruthy();

    await fireEvent.changeText(
      await findByPlaceholderText('Search by mask or reason...'),
      'missing',
    );
    expect(await findByText('No matching entries')).toBeTruthy();

    await fireEvent.changeText(
      await findByPlaceholderText('Search by mask or reason...'),
      '',
    );
    await fireEvent.press(getByText('Edit'));
    await fireEvent.changeText(
      await findByPlaceholderText('nick or mask'),
      'edited!*@*',
    );
    await fireEvent.press(getByText('Save'));

    await waitFor(async () => {
      expect(
        mockConnectionScopedUserManagementService.removeUserListEntry,
      ).toHaveBeenCalledWith('notify', 'nick!*@*', 'net1');
      expect(
        mockConnectionScopedUserManagementService.addUserListEntry,
      ).toHaveBeenCalledWith(
        'notify',
        'edited!*@*',
        expect.objectContaining({
          network: 'net1',
          channels: ['#chat'],
          protected: true,
          reason: 'watch list',
        }),
      );
    });

    await fireEvent.press(getByText('Remove'));
    const removeButtons = (Alert.alert as jest.Mock).mock.calls.at(-1)?.[2];
    await act(async () => {
      await removeButtons?.[1]?.onPress?.();
    });
    await waitFor(async () => {
      expect(
        mockConnectionScopedUserManagementService.removeUserListEntry,
      ).toHaveBeenCalledWith('notify', 'nick!*@*', 'net1');
    });

    await fireEvent.press(getByText('Ignore'));
    expect(await findByText('badguy!*@evil.host')).toBeTruthy();
    expect(queryByText('nick!*@*')).toBeNull();
  });

  it('supports online-user picker and network filter', async () => {
    const { findByPlaceholderText, findByText, getByText, queryByText } =
      await render(
        <UserListsScreen visible network="net1" onClose={jest.fn()} />,
      );

    await fireEvent.press(await findByText('+ Add'));
    await fireEvent.press(getByText('Select from Online Users'));
    await fireEvent.press(await findByText('Alice'));
    expect(await findByPlaceholderText('nick or mask')).toHaveProp(
      'value',
      'Alice!alice@chat.host',
    );

    await fireEvent.press(getByText('All Networks'));
    await fireEvent.press(await findByText('Filter by Network'));
    await fireEvent.press(await findByText('net2'));

    await waitFor(async () => {
      expect(queryByText('nick!*@*')).toBeNull();
    });
    expect(getByText('No matching entries')).toBeTruthy();
  });

  /**
   * Editing an ignore entry is a remove-then-add, because an ignore is keyed on
   * its mask. Getting that pair wrong either leaves the old mask ignoring
   * someone forever or drops the entry entirely, and neither is visible until
   * the wrong person is silenced.
   */
  describe('editing an ignore entry', () => {
    const openIgnoreTab = async () => {
      const view = await render(
        <UserListsScreen visible network="net1" onClose={jest.fn()} />,
      );
      await view.findByText('nick!*@*');
      await fireEvent.press(view.getByText('Ignore'));
      await view.findByText('badguy!*@evil.host');
      return view;
    };

    it('removes the old mask before adding the new one', async () => {
      const view = await openIgnoreTab();

      await fireEvent.press(view.getByText('Edit'));
      await fireEvent.changeText(
        await view.findByPlaceholderText('nick or mask'),
        'worse!*@evil.host',
      );
      await fireEvent.press(view.getByText('Save'));

      await waitFor(() => {
        expect(
          mockConnectionScopedUserManagementService.unignoreUser,
        ).toHaveBeenCalledWith('badguy!*@evil.host', expect.anything());
        expect(
          mockConnectionScopedUserManagementService.ignoreUser,
        ).toHaveBeenCalledWith(
          'worse!*@evil.host',
          expect.anything(),
          expect.anything(),
        );
      });
    });

    it('adds without removing anything when nothing was being edited', async () => {
      const view = await openIgnoreTab();
      mockConnectionScopedUserManagementService.unignoreUser.mockClear();

      await fireEvent.press(view.getByText('+ Add'));
      await fireEvent.changeText(
        await view.findByPlaceholderText('nick or mask'),
        'fresh!*@host',
      );
      await fireEvent.press(view.getAllByText('Add').at(-1)!);

      await waitFor(() =>
        expect(
          mockConnectionScopedUserManagementService.ignoreUser,
        ).toHaveBeenCalledWith('fresh!*@host', undefined, 'net1'),
      );
      expect(
        mockConnectionScopedUserManagementService.unignoreUser,
      ).not.toHaveBeenCalled();
    });
  });

  describe('what the form refuses to save', () => {
    const openForm = async () => {
      const view = await render(
        <UserListsScreen visible network="net1" onClose={jest.fn()} />,
      );
      await view.findByText('nick!*@*');
      await fireEvent.press(view.getByText('+ Add'));
      await view.findByPlaceholderText('nick or mask');
      return view;
    };

    it('saves nothing for an empty mask', async () => {
      const view = await openForm();
      mockConnectionScopedUserManagementService.addUserListEntry.mockClear();

      await fireEvent.press(view.getAllByText('Add').at(-1)!);

      expect(
        mockConnectionScopedUserManagementService.addUserListEntry,
      ).not.toHaveBeenCalled();
    });

    it('saves nothing for a mask of only spaces', async () => {
      const view = await openForm();
      mockConnectionScopedUserManagementService.addUserListEntry.mockClear();

      await fireEvent.changeText(
        view.getByPlaceholderText('nick or mask'),
        '   ',
      );
      await fireEvent.press(view.getAllByText('Add').at(-1)!);

      expect(
        mockConnectionScopedUserManagementService.addUserListEntry,
      ).not.toHaveBeenCalled();
    });

    it('stores no channel list when the field is left empty', async () => {
      const view = await openForm();
      mockConnectionScopedUserManagementService.addUserListEntry.mockClear();

      await fireEvent.changeText(
        view.getByPlaceholderText('nick or mask'),
        'someone!*@*',
      );
      await fireEvent.press(view.getAllByText('Add').at(-1)!);

      await waitFor(() =>
        expect(
          mockConnectionScopedUserManagementService.addUserListEntry,
        ).toHaveBeenCalledWith(
          expect.anything(),
          'someone!*@*',
          expect.objectContaining({ channels: undefined }),
        ),
      );
    });

    it('splits a channel list and drops the blanks between commas', async () => {
      const view = await openForm();
      mockConnectionScopedUserManagementService.addUserListEntry.mockClear();

      await fireEvent.changeText(
        view.getByPlaceholderText('nick or mask'),
        'someone!*@*',
      );
      const channels = view.queryByPlaceholderText(/#chan/i);
      if (channels) {
        await fireEvent.changeText(channels, ' #one , , #two ,');
        await fireEvent.press(view.getAllByText('Add').at(-1)!);

        await waitFor(() =>
          expect(
            mockConnectionScopedUserManagementService.addUserListEntry,
          ).toHaveBeenCalledWith(
            expect.anything(),
            'someone!*@*',
            expect.objectContaining({ channels: ['#one', '#two'] }),
          ),
        );
      }
    });
  });
});

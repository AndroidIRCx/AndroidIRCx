/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { BlacklistScreen } from '../../src/screens/BlacklistScreen';

jest.mock('../../src/i18n/transifex', () => ({
  useT: () => (key: string) => key,
}));

jest.mock('../../src/services/UserManagementService', () => ({
  userManagementService: {
    getBlacklistEntries: jest.fn(),
    addBlacklistEntry: jest.fn(),
    removeBlacklistEntry: jest.fn(),
  },
}));

jest.mock('../../src/services/BanService', () => ({
  banService: {
    getBanMaskTypes: jest.fn(() => [
      { id: 0, pattern: '*!*@host', description: 'host mask' },
      { id: 1, pattern: 'nick!*@*', description: 'nick mask' },
    ]),
  },
}));

jest.mock('../../src/services/ConnectionManager', () => ({
  connectionManager: {
    getAllConnections: jest.fn(),
    getConnection: jest.fn(),
  },
}));

jest.mock('../../src/services/SettingsService', () => ({
  settingsService: {
    getSetting: jest.fn(),
    setSetting: jest.fn(),
  },
}));

jest.mock('../../src/stores/uiStore', () => ({
  useUIStore: {
    getState: jest.fn(),
  },
}));

const { userManagementService } = require('../../src/services/UserManagementService');
const { connectionManager } = require('../../src/services/ConnectionManager');
const { settingsService } = require('../../src/services/SettingsService');
const { useUIStore } = require('../../src/stores/uiStore');

describe('BlacklistScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());

    userManagementService.getBlacklistEntries.mockReturnValue([
      {
        mask: 'bad!*@*',
        action: 'ban',
        network: 'net-a',
        reason: 'spam',
        commandTemplate: '',
        duration: '0',
        addedAt: '2026-03-02T00:00:00.000Z',
      },
      {
        mask: 'proxy!*@*',
        action: 'custom',
        network: 'net-b',
        reason: 'proxy',
        commandTemplate: 'KLINE {mask}',
        duration: '1d',
        addedAt: '2026-03-01T00:00:00.000Z',
      },
    ]);
    userManagementService.addBlacklistEntry.mockResolvedValue(undefined);
    userManagementService.removeBlacklistEntry.mockResolvedValue(undefined);

    connectionManager.getAllConnections.mockReturnValue([
      { config: { id: 'net-a' } },
      { config: { id: 'net-b' } },
    ]);
    connectionManager.getConnection.mockReturnValue(null);

    settingsService.getSetting.mockResolvedValue({});
    settingsService.setSetting.mockResolvedValue(undefined);

    useUIStore.getState.mockReturnValue({
      blacklistTarget: null,
      setBlacklistTarget: jest.fn(),
    });
  });

  it('renders nothing when hidden', () => {
    const { queryByText } = render(
      <BlacklistScreen visible={false} onClose={jest.fn()} />
    );

    expect(queryByText('Blacklist')).toBeNull();
  });

  it('loads and renders blacklist entries', async () => {
    const { findByText } = render(
      <BlacklistScreen visible onClose={jest.fn()} />
    );

    expect(await findByText('Blacklist')).toBeTruthy();
    expect(await findByText('bad!*@*')).toBeTruthy();
    expect(await findByText('Ban')).toBeTruthy();
    expect(await findByText('KLINE {mask}')).toBeTruthy();
  });

  it('filters entries by search query', async () => {
    const { findByPlaceholderText, findByText, queryByText } = render(
      <BlacklistScreen visible onClose={jest.fn()} />
    );

    fireEvent.changeText(
      await findByPlaceholderText('Search by mask or reason...'),
      'proxy'
    );

    expect(await findByText('proxy!*@*')).toBeTruthy();
    expect(queryByText('bad!*@*')).toBeNull();
  });

  it('adds a new ban entry', async () => {
    const { findByText, findByPlaceholderText } = render(
      <BlacklistScreen visible onClose={jest.fn()} />
    );

    fireEvent.press(await findByText('+ Add'));
    fireEvent.changeText(
      await findByPlaceholderText('nick or mask (e.g., *!*@host.com)'),
      'fresh!*@*'
    );
    fireEvent.changeText(await findByPlaceholderText('optional'), 'fresh reason');

    fireEvent.press(await findByText('Add'));

    await waitFor(() => {
      expect(userManagementService.addBlacklistEntry).toHaveBeenCalledWith(
        'fresh!*@*',
        'ban',
        'fresh reason',
        undefined,
        undefined,
        '0'
      );
    });

    expect(Alert.alert).toHaveBeenCalledWith('Success', 'User added to blacklist');
  });

  it('validates missing custom command', async () => {
    const { findAllByText, findByText, findByPlaceholderText } = render(
      <BlacklistScreen visible onClose={jest.fn()} />
    );

    const editButtons = await findAllByText('Edit');
    fireEvent.press(editButtons[1]);
    fireEvent.changeText(
      await findByPlaceholderText('Use {mask}, {usermask}, {hostmask}, {nick}, {user}, {host}, {reason}, {duration}'),
      ''
    );

    fireEvent.press(await findByText('Save'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Missing Command',
      'Custom command is required for this action.'
    );
    expect(userManagementService.addBlacklistEntry).not.toHaveBeenCalled();
  });

  it('removes an entry after confirmation', async () => {
    const { findAllByText } = render(
      <BlacklistScreen visible onClose={jest.fn()} />
    );

    const removeButtons = await findAllByText('Remove');
    fireEvent.press(removeButtons[0]);

    const dialog = (Alert.alert as jest.Mock).mock.calls.find(
      call => call[0] === 'Remove from Blacklist'
    );
    expect(dialog).toBeTruthy();

    await act(async () => {
      await dialog[2][1].onPress();
    });

    expect(userManagementService.removeBlacklistEntry).toHaveBeenCalledWith('bad!*@*', 'net-a');
    expect(Alert.alert).toHaveBeenCalledWith('Success', 'User removed from blacklist');
  });

  it('saves blacklist templates', async () => {
    const { findByText, findAllByText, findByPlaceholderText } = render(
      <BlacklistScreen visible onClose={jest.fn()} />
    );

    fireEvent.press(await findByText('Templates'));
    const networkButtons = await findAllByText('All Networks');
    fireEvent.press(networkButtons[networkButtons.length - 1]);

    const akillInput = await findByText('Blacklist Templates');
    expect(akillInput).toBeTruthy();
    fireEvent.changeText(
      await findByPlaceholderText('PRIVMSG OperServ :AKILL ADD +{duration} {usermask} {reason}'),
      'PRIVMSG OperServ :AKILL ADD {mask}'
    );

    const saveButtons = await findAllByText('Save');
    fireEvent.press(saveButtons[saveButtons.length - 1]);

    await waitFor(() => {
      expect(settingsService.setSetting).toHaveBeenCalledWith(
        'blacklistTemplates',
        expect.objectContaining({
          global: expect.objectContaining({
            akill: 'PRIVMSG OperServ :AKILL ADD {mask}',
          }),
        })
      );
    });
  });

  it('closes from header button', async () => {
    const onClose = jest.fn();
    const { findAllByText } = render(
      <BlacklistScreen visible onClose={onClose} />
    );

    const closeButtons = await findAllByText('Close');
    fireEvent.press(closeButtons[0]);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

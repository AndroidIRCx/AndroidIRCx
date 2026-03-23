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

jest.mock('../../src/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#121212',
      surface: '#1E1E1E',
      surfaceVariant: '#2C2C2C',
      text: '#FFFFFF',
      textSecondary: '#B0B0B0',
      textDisabled: '#666666',
      primary: '#2196F3',
      accent: '#4CAF50',
      onAccent: '#FFFFFF',
      warning: '#FF9800',
      error: '#F44336',
      border: '#333333',
      divider: '#2A2A2A',
      inputBackground: '#2C2C2C',
      inputText: '#FFFFFF',
      inputBorder: '#333333',
      inputPlaceholder: '#757575',
      buttonPrimary: '#2196F3',
      buttonPrimaryText: '#FFFFFF',
      buttonSecondary: '#424242',
      buttonSecondaryText: '#FFFFFF',
      modalOverlay: 'rgba(0, 0, 0, 0.7)',
      modalBackground: '#1E1E1E',
      modalText: '#FFFFFF',
      onPrimary: '#FFFFFF',
    },
  }),
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

  it('filters entries by selected network and resets back to all networks', async () => {
    const { findAllByText, findByText, queryByText } = render(
      <BlacklistScreen visible onClose={jest.fn()} />
    );

    fireEvent.press(await findByText('All Networks'));
    fireEvent.press(await findByText('net-b'));

    expect(await findByText('proxy!*@*')).toBeTruthy();
    expect(queryByText('bad!*@*')).toBeNull();

    fireEvent.press(await findByText('net-b'));
    const allNetworkButtons = await findAllByText('All Networks');
    fireEvent.press(allNetworkButtons[allNetworkButtons.length - 1]);

    expect(await findByText('bad!*@*')).toBeTruthy();
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

  it('prefills add modal from blacklist target and clears the target', async () => {
    const setBlacklistTarget = jest.fn();
    useUIStore.getState.mockReturnValue({
      blacklistTarget: { nick: 'TargetNick' },
      setBlacklistTarget,
    });

    const { findByDisplayValue, findByText } = render(
      <BlacklistScreen visible onClose={jest.fn()} />
    );

    expect(await findByText('Add to Blacklist')).toBeTruthy();
    expect(await findByDisplayValue('TargetNick')).toBeTruthy();
    expect(setBlacklistTarget).toHaveBeenCalledWith(null);
  });

  it('edits an entry, replaces the old mask, and saves the new one', async () => {
    const { findAllByText, findByPlaceholderText, findByText } = render(
      <BlacklistScreen visible onClose={jest.fn()} />
    );

    const editButtons = await findAllByText('Edit');
    fireEvent.press(editButtons[0]);
    fireEvent.changeText(
      await findByPlaceholderText('nick or mask (e.g., *!*@host.com)'),
      'worse!*@*'
    );
    fireEvent.changeText(await findByPlaceholderText('optional'), 'updated reason');
    fireEvent.press(await findByText('Save'));

    await waitFor(() => {
      expect(userManagementService.removeBlacklistEntry).toHaveBeenCalledWith('bad!*@*', 'net-a');
      expect(userManagementService.addBlacklistEntry).toHaveBeenCalledWith(
        'worse!*@*',
        'ban',
        'updated reason',
        'net-a',
        undefined,
        '0'
      );
    });

    expect(Alert.alert).toHaveBeenCalledWith('Success', 'Blacklist entry updated');
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

  it('supports selecting a custom action and saving a command template', async () => {
    const { findAllByText, findByPlaceholderText, findByText } = render(
      <BlacklistScreen visible onClose={jest.fn()} />
    );

    fireEvent.press(await findByText('+ Add'));
    fireEvent.changeText(
      await findByPlaceholderText('nick or mask (e.g., *!*@host.com)'),
      'custom!*@*'
    );
    const banLabels = await findAllByText('Ban');
    fireEvent.press(banLabels[banLabels.length - 1]);
    const customActionLabels = await findAllByText('Custom Command');
    fireEvent.press(customActionLabels[customActionLabels.length - 1]);
    fireEvent.changeText(
      await findByPlaceholderText('Use {mask}, {usermask}, {hostmask}, {nick}, {user}, {host}, {reason}, {duration}'),
      'KLINE {mask} :{reason}'
    );
    fireEvent.changeText(await findByPlaceholderText('optional'), 'custom reason');
    fireEvent.press(await findByText('Add'));

    await waitFor(() => {
      expect(userManagementService.addBlacklistEntry).toHaveBeenCalledWith(
        'custom!*@*',
        'custom',
        'custom reason',
        undefined,
        'KLINE {mask} :{reason}',
        '0'
      );
    });
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

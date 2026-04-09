/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { IgnoreListScreen } from '../../src/screens/IgnoreListScreen';

jest.mock('../../src/i18n/transifex', () => ({
  useT: () => (key: string) => key,
}));

jest.mock('../../src/services/UserManagementService', () => ({
  userManagementService: {
    getIgnoredUsers: jest.fn(),
    ignoreUser: jest.fn(),
    unignoreUser: jest.fn(),
  },
}));

jest.mock('../../src/services/ConnectionManager', () => ({
  connectionManager: {
    getAllConnections: jest.fn(),
    getConnection: jest.fn(),
  },
}));

const {
  userManagementService,
} = require('../../src/services/UserManagementService');
const { connectionManager } = require('../../src/services/ConnectionManager');

describe('IgnoreListScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());

    userManagementService.getIgnoredUsers.mockReturnValue([
      {
        mask: 'bad!*@*',
        network: 'net-a',
        reason: 'spam',
        addedAt: '2026-03-02T00:00:00.000Z',
      },
      {
        mask: 'quiet!*@host',
        network: 'net-b',
        reason: 'flood',
        addedAt: '2026-03-01T00:00:00.000Z',
      },
    ]);
    userManagementService.ignoreUser.mockResolvedValue(undefined);
    userManagementService.unignoreUser.mockResolvedValue(undefined);

    connectionManager.getAllConnections.mockReturnValue([
      { networkId: 'net-a', config: { id: 'net-a' } },
      { networkId: 'net-b', config: { id: 'net-b' } },
    ]);
    connectionManager.getConnection.mockReturnValue(null);
  });

  it('renders nothing when hidden', () => {
    const { queryByText } = render(
      <IgnoreListScreen visible={false} onClose={jest.fn()} />,
    );

    expect(queryByText('Ignore List')).toBeNull();
  });

  it('loads and renders ignored users', async () => {
    const { findByText } = render(
      <IgnoreListScreen visible onClose={jest.fn()} />,
    );

    expect(await findByText('Ignore List')).toBeTruthy();
    expect(await findByText('bad!*@*')).toBeTruthy();
    expect(await findByText('spam')).toBeTruthy();
    expect(connectionManager.getAllConnections).toHaveBeenCalledTimes(1);
  });

  it('filters entries by search query', async () => {
    const { findByPlaceholderText, findByText, queryByText } = render(
      <IgnoreListScreen visible onClose={jest.fn()} />,
    );

    const input = await findByPlaceholderText('Search by mask or reason...');
    fireEvent.changeText(input, 'flood');

    expect(await findByText('quiet!*@host')).toBeTruthy();
    expect(queryByText('bad!*@*')).toBeNull();
  });

  it('adds a new ignored user', async () => {
    const { findByText, findByPlaceholderText } = render(
      <IgnoreListScreen visible onClose={jest.fn()} />,
    );

    fireEvent.press(await findByText('+ Add'));
    fireEvent.changeText(
      await findByPlaceholderText('nick or mask (e.g., *!*@host.com)'),
      'new!*@*',
    );
    fireEvent.changeText(
      await findByPlaceholderText('Reason (optional)'),
      'annoying',
    );

    fireEvent.press(await findByText('Add'));

    await waitFor(() => {
      expect(userManagementService.ignoreUser).toHaveBeenCalledWith(
        'new!*@*',
        'annoying',
        undefined,
      );
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Success',
      'User added to ignore list',
    );
  });

  it('removes an ignored user after confirmation', async () => {
    const { findAllByText } = render(
      <IgnoreListScreen visible onClose={jest.fn()} />,
    );

    const removeButtons = await findAllByText('Remove');
    fireEvent.press(removeButtons[0]);

    const removeDialog = (Alert.alert as jest.Mock).mock.calls.find(
      call => call[0] === 'Remove from Ignore List',
    );
    expect(removeDialog).toBeTruthy();

    await act(async () => {
      await removeDialog[2][1].onPress();
    });

    expect(userManagementService.unignoreUser).toHaveBeenCalledWith(
      'bad!*@*',
      'net-a',
    );
    expect(Alert.alert).toHaveBeenCalledWith(
      'Success',
      'User removed from ignore list',
    );
  });

  it('filters by selected network', async () => {
    const { findAllByText, findByText, queryByText } = render(
      <IgnoreListScreen visible onClose={jest.fn()} />,
    );

    fireEvent.press(await findByText('All Networks'));
    const pickerOptions = await findAllByText('net-b');
    fireEvent.press(pickerOptions[pickerOptions.length - 1]);

    expect(await findByText('quiet!*@host')).toBeTruthy();
    expect(queryByText('bad!*@*')).toBeNull();
  });

  it('closes from header button', async () => {
    const onClose = jest.fn();
    const { findAllByText } = render(
      <IgnoreListScreen visible onClose={onClose} />,
    );

    const closeButtons = await findAllByText('Close');
    fireEvent.press(closeButtons[0]);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

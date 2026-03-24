/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
jest.skip = true; //skipped for now

import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { MessageHistoryViewerScreen } from '../../src/screens/MessageHistoryViewerScreen';
import { messageHistoryService } from '../../src/services/MessageHistoryService';


jest.mock('../../src/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      surface: '#eee',
      surfaceVariant: '#f3f3f3',
      text: '#111',
      textSecondary: '#666',
      border: '#ddd',
      primary: '#09f',
      buttonPrimary: '#09f',
      error: '#f33',
    },
  }),
}));

jest.mock('../../src/i18n/transifex', () => ({
  useT: () => (key: string, params?: Record<string, unknown>) => {
    let result = key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        result = result.replace(`{${k}}`, String(v));
      }
    }
    return result;
  },
}));

jest.mock('../../src/services/MessageHistoryService', () => ({
  messageHistoryService: {
    ensureHistoryMigrated: jest.fn(),
    listStoredChannels: jest.fn(),
    loadMessages: jest.fn(),
    deleteMessages: jest.fn(),
    deleteMessageById: jest.fn(),
  },
}));

jest.mock('../../src/utils/IRCFormatter', () => ({
  formatIRCTextAsComponent: (text: string, style: any) => {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(Text, { style }, text);
  },
}));

jest.mock('react-native-vector-icons/FontAwesome5', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return function MockIcon(props: { name: string }) {
    return React.createElement(Text, null, props.name);
  };
});

describe('MessageHistoryViewerScreen', () => {
  const entries = [
    { network: 'beta', channel: '#beta', count: 1 },
    { network: 'alpha', channel: '#general', count: 2 },
  ];

  const messages = [
    { id: '1', text: 'older message', timestamp: 1000, from: 'alice' },
    { id: '2', text: 'newer message', timestamp: 2000, from: 'bob' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    (messageHistoryService.ensureHistoryMigrated as jest.Mock).mockImplementation(async cb => {
      cb(1, 2);
      cb(2, 2);
      return { migrated: true, migratedCount: 2 };
    });
    (messageHistoryService.listStoredChannels as jest.Mock).mockResolvedValue(entries);
    (messageHistoryService.loadMessages as jest.Mock).mockResolvedValue(messages);
    (messageHistoryService.deleteMessages as jest.Mock).mockResolvedValue(undefined);
    (messageHistoryService.deleteMessageById as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('does not render content when not visible', () => {
    const { queryByText } = render(
      <MessageHistoryViewerScreen visible={false} onClose={jest.fn()} />
    );

    expect(queryByText('History Viewer')).toBeNull();
  });

  it('loads entries, sorts them, and shows migration summary', async () => {
    const { findByText, getAllByText } = render(
      <MessageHistoryViewerScreen visible onClose={jest.fn()} />
    );

    expect(await findByText('History Viewer')).toBeTruthy();
    expect(await findByText('#general · alpha')).toBeTruthy();
    expect(await findByText('#beta · beta')).toBeTruthy();
    expect(await findByText('Migrated 2 channels.')).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(3693);
    });

    expect(getAllByText('Close').length).toBeGreaterThan(0);
  });

  it('filters entries by selected network', async () => {
    const { findByText, getByText, queryByText } = render(
      <MessageHistoryViewerScreen visible onClose={jest.fn()} />
    );

    await findByText('#general · alpha');
    fireEvent.press(getByText('alpha'));

    expect(getByText('#general')).toBeTruthy();
    expect(queryByText('#beta · beta')).toBeNull();
  });

  it('opens an entry, loads messages, toggles sort, and goes back', async () => {
    const { findByText, getByText, queryByText } = render(
      <MessageHistoryViewerScreen visible onClose={jest.fn()} />
    );

    await findByText('#general · alpha');
    fireEvent.press(getByText('#general · alpha'));

    expect(await findByText('newer message')).toBeTruthy();
    expect(getByText('Newest first')).toBeTruthy();

    fireEvent.press(getByText('Newest first'));
    await waitFor(() => {
      expect(messageHistoryService.loadMessages).toHaveBeenCalledTimes(2);
    });
    expect(getByText('Oldest first')).toBeTruthy();

    fireEvent.press(getByText('Back'));
    expect(queryByText('newer message')).toBeNull();
  });

  it('deletes a channel entry from the list', async () => {
    const { findByText, UNSAFE_getAllByType } = render(
      <MessageHistoryViewerScreen visible onClose={jest.fn()} />
    );

    await findByText('#general · alpha');
    const touchables = UNSAFE_getAllByType(require('react-native').TouchableOpacity);
    fireEvent.press(touchables.find((node: any) => node.props.onPress && node.props.children?.props?.name === 'trash'));

    const deleteCall = (Alert.alert as jest.Mock).mock.calls.find(call => call[0] === 'Delete Channel History?');
    expect(deleteCall).toBeTruthy();

    await act(async () => {
      await deleteCall[2][1].onPress();
    });

    expect(messageHistoryService.deleteMessages).toHaveBeenCalled();
  });

  it('deletes a single message from opened history', async () => {
    const { findByText, getByText, UNSAFE_getAllByType } = render(
      <MessageHistoryViewerScreen visible onClose={jest.fn()} />
    );

    await findByText('#general · alpha');
    fireEvent.press(getByText('#general · alpha'));
    await findByText('newer message');

    const touchables = UNSAFE_getAllByType(require('react-native').TouchableOpacity);
    const deleteButtons = touchables.filter((node: any) => node.props.onPress && node.findAll?.(() => false) !== undefined);
    fireEvent.press(deleteButtons[deleteButtons.length - 1]);

    const deleteCall = (Alert.alert as jest.Mock).mock.calls.find(call => call[0] === 'Delete message');
    expect(deleteCall).toBeTruthy();

    await act(async () => {
      await deleteCall[2][1].onPress();
    });

    expect(messageHistoryService.deleteMessageById).toHaveBeenCalled();
  });

  it('calls onClose from header button', async () => {
    const onClose = jest.fn();
    const { findAllByText } = render(
      <MessageHistoryViewerScreen visible onClose={onClose} />
    );

    const closeButtons = await findAllByText('Close');
    fireEvent.press(closeButtons[0]);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { ChannelListScreen } from '../../src/screens/ChannelListScreen';

jest.useFakeTimers();

jest.mock('../../src/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      primary: '#09f',
      onPrimary: '#fff',
      surface: '#f5f5f5',
      surfaceVariant: '#eee',
      text: '#111',
      textSecondary: '#666',
      border: '#ddd',
      warning: '#fa0',
    },
  }),
}));

jest.mock('../../src/i18n/transifex', () => ({
  useT: () => (key: string) => key,
}));

jest.mock('../../src/services/ChannelListService', () => ({
  channelListService: {
    onChannelListUpdate: jest.fn(),
    onListEnd: jest.fn(),
    getCachedList: jest.fn(),
    requestChannelList: jest.fn(),
    searchChannels: jest.fn(),
    filterChannelList: jest.fn(),
    sortChannels: jest.fn(),
  },
}));

jest.mock('../../src/services/ChannelFavoritesService', () => ({
  channelFavoritesService: {
    isFavorite: jest.fn(),
    getFavorites: jest.fn(),
    addFavorite: jest.fn(),
    removeFavorite: jest.fn(),
  },
}));

jest.mock('../../src/services/IRCService', () => ({
  ircService: {
    getConnectionStatus: jest.fn(),
    isRegistered: jest.fn(),
  },
}));

jest.mock('../../src/services/ConnectionManager', () => ({
  connectionManager: {
    getConnection: jest.fn(),
    getActiveConnection: jest.fn(),
  },
}));

jest.mock('../../src/utils/IRCFormatter', () => ({
  formatIRCTextAsComponent: jest.fn((text: string) => text),
}));

const { channelListService } = require('../../src/services/ChannelListService');
const { channelFavoritesService } = require('../../src/services/ChannelFavoritesService');
const { ircService } = require('../../src/services/IRCService');
const { connectionManager } = require('../../src/services/ConnectionManager');

describe('ChannelListScreen', () => {
  let updateListener: ((channels: any[]) => void) | undefined;
  let endListener: (() => void) | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    updateListener = undefined;
    endListener = undefined;

    channelListService.onChannelListUpdate.mockImplementation((listener: (channels: any[]) => void) => {
      updateListener = listener;
      return jest.fn();
    });
    channelListService.onListEnd.mockImplementation((listener: () => void) => {
      endListener = listener;
      return jest.fn();
    });
    channelListService.getCachedList.mockResolvedValue([
      { name: '#cached', userCount: 5, topic: 'cached topic' },
    ]);
    channelListService.searchChannels.mockReturnValue([
      { name: '#search', userCount: 7, topic: 'search topic' },
    ]);
    channelListService.filterChannelList.mockReturnValue([
      { name: '#filtered', userCount: 9, topic: 'filtered topic' },
    ]);
    channelListService.sortChannels.mockImplementation((channels: any[]) => channels);
    channelListService.requestChannelList.mockImplementation(() => {
      updateListener?.([
        { name: '#alpha', userCount: 10, topic: 'alpha topic' },
        { name: '#beta', userCount: 2, topic: 'beta topic' },
      ]);
      endListener?.();
    });

    channelFavoritesService.isFavorite.mockReturnValue(false);
    channelFavoritesService.getFavorites.mockReturnValue([]);
    channelFavoritesService.addFavorite.mockResolvedValue(undefined);
    channelFavoritesService.removeFavorite.mockResolvedValue(undefined);

    ircService.getConnectionStatus.mockReturnValue(true);
    ircService.isRegistered.mockReturnValue(true);
    connectionManager.getConnection.mockReturnValue(null);
    connectionManager.getActiveConnection.mockReturnValue(null);
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
  });

  it('renders nothing when hidden', () => {
    const { queryByText } = render(
      <ChannelListScreen visible={false} onClose={jest.fn()} onJoinChannel={jest.fn()} />
    );

    expect(queryByText('Channel List')).toBeNull();
  });

  it('loads channel list from server when connected', async () => {
    const { findByText } = render(
      <ChannelListScreen visible onClose={jest.fn()} onJoinChannel={jest.fn()} />
    );

    expect(await findByText('Channel List')).toBeTruthy();
    expect(await findByText('#alpha')).toBeTruthy();
    expect(channelListService.requestChannelList).toHaveBeenCalledTimes(1);
  });

  it('loads cached channels when disconnected', async () => {
    ircService.getConnectionStatus.mockReturnValue(false);

    const { findByText } = render(
      <ChannelListScreen visible onClose={jest.fn()} onJoinChannel={jest.fn()} />
    );

    expect(await findByText('#cached')).toBeTruthy();
    expect(channelListService.getCachedList).toHaveBeenCalledWith(undefined);
  });

  it('joins a channel and closes the modal', async () => {
    const onJoinChannel = jest.fn();
    const onClose = jest.fn();
    const { findByText } = render(
      <ChannelListScreen visible onClose={onClose} onJoinChannel={onJoinChannel} network="Net" />
    );

    fireEvent.press(await findByText('#alpha'));

    expect(onJoinChannel).toHaveBeenCalledWith('#alpha', undefined);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('toggles favorites on long press using normalized network id', async () => {
    const { findByText } = render(
      <ChannelListScreen
        visible
        onClose={jest.fn()}
        onJoinChannel={jest.fn()}
        network="DBase (2)"
      />
    );

    fireEvent(await findByText('#alpha'), 'longPress');

    await waitFor(() => {
      expect(channelFavoritesService.addFavorite).toHaveBeenCalledWith('DBase', '#alpha');
    });
  });

  it('searches after debounce delay', async () => {
    const { findByPlaceholderText, findByText } = render(
      <ChannelListScreen visible onClose={jest.fn()} onJoinChannel={jest.fn()} />
    );

    fireEvent.changeText(await findByPlaceholderText('Search channels...'), 'term');

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(await findByText('#search')).toBeTruthy();
    expect(channelListService.searchChannels).toHaveBeenCalledWith('term');
  });

  it('applies filters and sorting controls', async () => {
    const { findByText, findByPlaceholderText } = render(
      <ChannelListScreen visible onClose={jest.fn()} onJoinChannel={jest.fn()} />
    );

    fireEvent.press(await findByText('Filters'));
    fireEvent.changeText(await findByPlaceholderText('Min users'), '5');
    fireEvent.changeText(await findByPlaceholderText('Name pattern'), 'irc');
    fireEvent.press(await findByText('Name'));

    expect(await findByText('#filtered')).toBeTruthy();
    expect(channelListService.filterChannelList).toHaveBeenCalledWith({
      minUsers: 5,
      namePattern: 'irc',
    });
    expect(channelListService.sortChannels).toHaveBeenCalled();
  });

  it('refreshes and closes from header actions', async () => {
    const onClose = jest.fn();
    const { findByText } = render(
      <ChannelListScreen visible onClose={onClose} onJoinChannel={jest.fn()} />
    );

    fireEvent.press(await findByText('Refresh'));
    expect(channelListService.requestChannelList).toHaveBeenCalledTimes(2);

    fireEvent.press(await findByText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

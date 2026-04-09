/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for useTabActions hook
 */

import { renderHook } from '@testing-library/react-native';
import { useTabActions } from '../../src/hooks/useTabActions';

// Mock the services and modules used in the hook
jest.mock('../../src/services/SettingsService', () => ({
  settingsService: {
    getSetting: jest.fn().mockResolvedValue('Leaving'),
  },
  DEFAULT_PART_MESSAGE: 'Leaving',
}));

jest.mock('../../src/services/ConnectionManager', () => ({
  connectionManager: {
    getConnection: jest.fn().mockReturnValue(null),
    setActiveConnection: jest.fn(),
    getActiveConnection: jest.fn().mockReturnValue(null),
  },
}));

jest.mock('../../src/services/TabService', () => ({
  tabService: {
    saveTabs: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../src/stores/tabStore', () => ({
  useTabStore: {
    getState: jest.fn().mockReturnValue({ tabs: [] }),
  },
}));

jest.mock('../../src/stores/uiStore', () => ({
  useUIStore: {
    getState: jest.fn().mockReturnValue({
      setChannelName: jest.fn(),
      setShowChannelModal: jest.fn(),
    }),
  },
}));

jest.mock('../../src/utils/tabUtils', () => ({
  sortTabsGrouped: jest.fn().mockImplementation(tabs => tabs),
}));

describe('useTabActions', () => {
  const mockSetActiveTabId = jest.fn();
  const mockSetNetworkName = jest.fn();
  const mockSetActiveConnectionId = jest.fn();
  const mockSetTabs = jest.fn();
  const mockSetChannelUsers = jest.fn();
  const mockGetActiveIRCService = jest.fn();
  const mockTabsRef = { current: [] };
  const mockActiveTabId = 'test-tab';
  const mockChannelName = '#test-channel';
  const mockTabSortAlphabetical = false;

  const defaultProps = {
    activeTabId: mockActiveTabId,
    channelName: mockChannelName,
    tabSortAlphabetical: mockTabSortAlphabetical,
    tabsRef: mockTabsRef,
    getActiveIRCService: mockGetActiveIRCService,
    setActiveTabId: mockSetActiveTabId,
    setNetworkName: mockSetNetworkName,
    setActiveConnectionId: mockSetActiveConnectionId,
    setTabs: mockSetTabs,
    setChannelUsers: mockSetChannelUsers,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Set default mock implementations
    require('../../src/stores/tabStore').useTabStore.getState.mockReturnValue({
      tabs: [],
    });
    require('../../src/stores/uiStore').useUIStore.getState.mockReturnValue({
      setChannelName: jest.fn(),
      setShowChannelModal: jest.fn(),
    });
    require('../../src/services/ConnectionManager').connectionManager.getConnection.mockReturnValue(
      null,
    );
    require('../../src/services/SettingsService').settingsService.getSetting.mockResolvedValue(
      'Leaving',
    );
    require('../../src/utils/tabUtils').sortTabsGrouped.mockImplementation(
      tabs => tabs,
    );

    // Mock the IRC service with required methods
    const mockIRCService = {
      getChannelUsers: jest.fn().mockReturnValue([]),
      requestChannelUsers: jest.fn(),
      joinChannel: jest.fn(),
      partChannel: jest.fn(),
    };
    mockGetActiveIRCService.mockReturnValue(mockIRCService);
  });

  it('should return tab action functions', () => {
    const { result } = renderHook(() => useTabActions(defaultProps));

    expect(result.current).toHaveProperty('handleTabPress');
    expect(result.current).toHaveProperty('handleJoinChannel');
    expect(result.current).toHaveProperty('closeAllChannelsAndQueries');
  });

  it('should handle tab press and update active tab', () => {
    const mockTab = {
      id: 'test-tab',
      networkId: 'test-network',
      type: 'channel',
      name: '#test-channel',
    };

    require('../../src/stores/tabStore').useTabStore.getState.mockReturnValue({
      tabs: [mockTab],
    });

    const { result } = renderHook(() => useTabActions(defaultProps));

    result.current.handleTabPress('test-tab');

    expect(mockSetActiveTabId).toHaveBeenCalledWith('test-tab');
    expect(mockSetNetworkName).toHaveBeenCalledWith('test-network');
    expect(mockSetActiveConnectionId).toHaveBeenCalledWith('test-network');
  });

  it('should clear tab activity when pressing a tab', () => {
    const mockTab = {
      id: 'test-tab',
      networkId: 'test-network',
      type: 'channel',
      name: '#test-channel',
      hasActivity: true,
    };

    require('../../src/stores/tabStore').useTabStore.getState.mockReturnValue({
      tabs: [mockTab],
    });

    const { result } = renderHook(() => useTabActions(defaultProps));

    result.current.handleTabPress('test-tab');

    expect(mockSetTabs).toHaveBeenCalledWith(
      expect.any(Function), // Will be a function that updates the tab's hasActivity property
    );

    // Test the updater function
    const updater = mockSetTabs.mock.calls[0][0];
    const updatedTabs = updater([{ ...mockTab }]);
    expect(updatedTabs[0].hasActivity).toBe(false);
  });

  it('should fetch users for channel tabs when pressed', () => {
    const mockTab = {
      id: 'test-tab',
      networkId: 'test-network',
      type: 'channel',
      name: '#test-channel',
    };

    const mockIRCService = {
      getChannelUsers: jest.fn().mockReturnValue([]),
      requestChannelUsers: jest.fn(),
    };

    mockGetActiveIRCService.mockReturnValue(mockIRCService);
    require('../../src/stores/tabStore').useTabStore.getState.mockReturnValue({
      tabs: [mockTab],
    });

    const { result } = renderHook(() => useTabActions(defaultProps));

    result.current.handleTabPress('test-tab');

    expect(mockIRCService.getChannelUsers).toHaveBeenCalledWith(
      '#test-channel',
    );
    expect(mockIRCService.requestChannelUsers).toHaveBeenCalledWith(
      '#test-channel',
    );
  });

  it('should not fetch users for non-channel tabs when pressed', () => {
    const mockTab = {
      id: 'test-tab',
      networkId: 'test-network',
      type: 'server',
      name: 'test-network',
    };

    const mockIRCService = {
      getChannelUsers: jest.fn(),
      requestChannelUsers: jest.fn(),
    };

    mockGetActiveIRCService.mockReturnValue(mockIRCService);
    require('../../src/stores/tabStore').useTabStore.getState.mockReturnValue({
      tabs: [mockTab],
    });

    const { result } = renderHook(() => useTabActions(defaultProps));

    result.current.handleTabPress('test-tab');

    expect(mockIRCService.getChannelUsers).not.toHaveBeenCalled();
    expect(mockIRCService.requestChannelUsers).not.toHaveBeenCalled();
  });

  it('should handle joining a channel', () => {
    const mockIRCService = {
      joinChannel: jest.fn(),
    };

    mockGetActiveIRCService.mockReturnValue(mockIRCService);

    const { result } = renderHook(() => useTabActions(defaultProps));

    result.current.handleJoinChannel();

    expect(mockIRCService.joinChannel).toHaveBeenCalledWith(
      '#test-channel',
      undefined,
    );
    expect(
      require('../../src/stores/uiStore').useUIStore.getState().setChannelName,
    ).toHaveBeenCalledWith('');
    expect(
      require('../../src/stores/uiStore').useUIStore.getState()
        .setShowChannelModal,
    ).toHaveBeenCalledWith(false);
  });

  it('should handle joining a specific channel', () => {
    const mockIRCService = {
      joinChannel: jest.fn(),
    };

    mockGetActiveIRCService.mockReturnValue(mockIRCService);

    const { result } = renderHook(() => useTabActions(defaultProps));

    result.current.handleJoinChannel('#specific-channel');

    expect(mockIRCService.joinChannel).toHaveBeenCalledWith(
      '#specific-channel',
      undefined,
    );
  });

  it('should handle joining a channel with a key', () => {
    const mockIRCService = {
      joinChannel: jest.fn(),
    };

    mockGetActiveIRCService.mockReturnValue(mockIRCService);

    const { result } = renderHook(() => useTabActions(defaultProps));

    result.current.handleJoinChannel('#secret-channel', 'password');

    expect(mockIRCService.joinChannel).toHaveBeenCalledWith(
      '#secret-channel',
      'password',
    );
  });

  it('should close all channels and queries for a network', async () => {
    const mockTabs = [
      {
        id: 'server-tab',
        networkId: 'test-network',
        type: 'server',
        name: 'test-network',
      },
      {
        id: 'channel-tab',
        networkId: 'test-network',
        type: 'channel',
        name: '#test',
      },
      {
        id: 'query-tab',
        networkId: 'test-network',
        type: 'query',
        name: 'user',
      },
      {
        id: 'other-tab',
        networkId: 'other-network',
        type: 'channel',
        name: '#other',
      },
    ];

    mockTabsRef.current = mockTabs;

    const mockIRCService = {
      partChannel: jest.fn(),
    };

    require('../../src/services/ConnectionManager').connectionManager.getConnection.mockReturnValue(
      {
        ircService: mockIRCService,
      },
    );

    const { result } = renderHook(() => useTabActions(defaultProps));

    await result.current.closeAllChannelsAndQueries('test-network');

    expect(mockIRCService.partChannel).toHaveBeenCalledWith('#test', 'Leaving');
    expect(mockSetTabs).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'server-tab' }),
        expect.objectContaining({ id: 'other-tab' }),
      ]),
    );
  });

  it('should save tabs after closing channels', async () => {
    const mockTabs = [
      {
        id: 'server-tab',
        networkId: 'test-network',
        type: 'server',
        name: 'test-network',
      },
      {
        id: 'channel-tab',
        networkId: 'test-network',
        type: 'channel',
        name: '#test',
      },
    ];

    mockTabsRef.current = mockTabs;

    const mockIRCService = {
      partChannel: jest.fn(),
    };

    require('../../src/services/ConnectionManager').connectionManager.getConnection.mockReturnValue(
      {
        ircService: mockIRCService,
      },
    );

    const { result } = renderHook(() => useTabActions(defaultProps));

    await result.current.closeAllChannelsAndQueries('test-network');

    expect(
      require('../../src/services/TabService').tabService.saveTabs,
    ).toHaveBeenCalledWith(
      'test-network',
      expect.arrayContaining([expect.objectContaining({ id: 'server-tab' })]),
    );
  });

  it('should switch to server tab if active tab was closed', async () => {
    const mockTabs = [
      {
        id: 'server-tab',
        networkId: 'test-network',
        type: 'server',
        name: 'test-network',
      },
      {
        id: 'channel-tab',
        networkId: 'test-network',
        type: 'channel',
        name: '#test',
      },
    ];

    mockTabsRef.current = mockTabs;

    const mockIRCService = {
      partChannel: jest.fn(),
    };

    require('../../src/services/ConnectionManager').connectionManager.getConnection.mockReturnValue(
      {
        ircService: mockIRCService,
      },
    );

    const propsWithActiveChannel = {
      ...defaultProps,
      activeTabId: 'channel-tab', // Active tab is the one being closed
    };

    const { result } = renderHook(() => useTabActions(propsWithActiveChannel));

    await result.current.closeAllChannelsAndQueries('test-network');

    expect(mockSetActiveTabId).toHaveBeenCalledWith('server-tab');
    expect(mockSetNetworkName).toHaveBeenCalledWith('test-network');
  });

  it('should not switch active tab if the active tab was not closed', async () => {
    const mockTabs = [
      {
        id: 'server-tab',
        networkId: 'test-network',
        type: 'server',
        name: 'test-network',
      },
      {
        id: 'channel-tab',
        networkId: 'test-network',
        type: 'channel',
        name: '#test',
      },
      {
        id: 'other-tab',
        networkId: 'other-network',
        type: 'channel',
        name: '#other',
      },
    ];

    mockTabsRef.current = mockTabs;

    const mockIRCService = {
      partChannel: jest.fn(),
    };

    require('../../src/services/ConnectionManager').connectionManager.getConnection.mockReturnValue(
      {
        ircService: mockIRCService,
      },
    );

    const propsWithActiveOther = {
      ...defaultProps,
      activeTabId: 'other-tab', // Active tab is not in the network being closed
    };

    const { result } = renderHook(() => useTabActions(propsWithActiveOther));

    await result.current.closeAllChannelsAndQueries('test-network');

    expect(mockSetActiveTabId).not.toHaveBeenCalled(); // Should not change active tab
  });

  it('should not join when channel name resolves to empty string', () => {
    const mockIRCService = {
      joinChannel: jest.fn(),
    };
    mockGetActiveIRCService.mockReturnValue(mockIRCService);

    const propsWithEmptyChannel = {
      ...defaultProps,
      channelName: '   ',
    };
    const { result } = renderHook(() => useTabActions(propsWithEmptyChannel));

    result.current.handleJoinChannel();

    expect(mockIRCService.joinChannel).not.toHaveBeenCalled();
  });

  it('should not switch active tab when closed tab had no remaining server tab', async () => {
    const mockTabs = [
      {
        id: 'channel-tab',
        networkId: 'test-network',
        type: 'channel',
        name: '#test',
      },
      {
        id: 'query-tab',
        networkId: 'test-network',
        type: 'query',
        name: 'alice',
      },
    ];
    mockTabsRef.current = mockTabs as any;

    const mockIRCService = {
      partChannel: jest.fn(),
    };
    require('../../src/services/ConnectionManager').connectionManager.getConnection.mockReturnValue(
      {
        ircService: mockIRCService,
      },
    );

    const { result } = renderHook(() =>
      useTabActions({ ...defaultProps, activeTabId: 'channel-tab' as any }),
    );
    await result.current.closeAllChannelsAndQueries('test-network');

    expect(mockSetActiveTabId).not.toHaveBeenCalled();
    expect(mockSetNetworkName).not.toHaveBeenCalled();
  });

  it('should handle empty tabs gracefully', async () => {
    mockTabsRef.current = [];

    const { result } = renderHook(() => useTabActions(defaultProps));

    await result.current.closeAllChannelsAndQueries('test-network');

    // Should not throw or call any services
    expect(true).toBe(true);
  });

  it('should handle no matching tabs gracefully', async () => {
    const mockTabs = [
      {
        id: 'other-tab',
        networkId: 'other-network',
        type: 'channel',
        name: '#other',
      },
    ];

    mockTabsRef.current = mockTabs;

    const { result } = renderHook(() => useTabActions(defaultProps));

    await result.current.closeAllChannelsAndQueries('test-network');

    // Should not call partChannel since no matching tabs exist
    expect(
      require('../../src/services/ConnectionManager').connectionManager
        .getConnection,
    ).not.toHaveBeenCalled();
  });

  it('should set active connection when tab is pressed', () => {
    const mockTab = {
      id: 'test-tab',
      networkId: 'test-network',
      type: 'channel',
      name: '#test-channel',
    };

    require('../../src/stores/tabStore').useTabStore.getState.mockReturnValue({
      tabs: [mockTab],
    });

    const { result } = renderHook(() => useTabActions(defaultProps));

    result.current.handleTabPress('test-tab');

    expect(
      require('../../src/services/ConnectionManager').connectionManager
        .setActiveConnection,
    ).toHaveBeenCalledWith('test-network');
  });

  it('should use connection-specific IRC service if available', () => {
    const mockTab = {
      id: 'test-tab',
      networkId: 'test-network',
      type: 'channel',
      name: '#test-channel',
    };

    const mockConnectionService = {
      getChannelUsers: jest.fn().mockReturnValue([]),
      requestChannelUsers: jest.fn(),
    };

    require('../../src/stores/tabStore').useTabStore.getState.mockReturnValue({
      tabs: [mockTab],
    });
    require('../../src/services/ConnectionManager').connectionManager.getConnection.mockReturnValue(
      {
        ircService: mockConnectionService,
      },
    );

    const { result } = renderHook(() => useTabActions(defaultProps));

    result.current.handleTabPress('test-tab');

    expect(mockConnectionService.getChannelUsers).toHaveBeenCalledWith(
      '#test-channel',
    );
  });

  it('should store channel users when channel user list is available', () => {
    const mockTab = {
      id: 'test-tab',
      networkId: 'test-network',
      type: 'channel',
      name: '#test-channel',
    };
    const mockUsers = [{ nick: 'alice' }, { nick: 'bob' }];
    const mockIRCService = {
      getChannelUsers: jest.fn().mockReturnValue(mockUsers),
      requestChannelUsers: jest.fn(),
    };

    mockGetActiveIRCService.mockReturnValue(mockIRCService);
    require('../../src/stores/tabStore').useTabStore.getState.mockReturnValue({
      tabs: [mockTab],
    });

    const { result } = renderHook(() => useTabActions(defaultProps));

    result.current.handleTabPress('test-tab');

    expect(mockSetChannelUsers).toHaveBeenCalledWith(expect.any(Function));
    const updater = mockSetChannelUsers.mock.calls[0][0];
    const updatedMap = updater(new Map());
    expect(updatedMap.get('#test-channel')).toEqual(mockUsers);
    expect(mockIRCService.requestChannelUsers).not.toHaveBeenCalled();
  });
});

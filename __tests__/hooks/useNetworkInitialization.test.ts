/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for useNetworkInitialization hook
 */

import { renderHook } from '@testing-library/react-native';
import { useNetworkInitialization } from '../../src/hooks/useNetworkInitialization';

// Mock the services and modules used in the hook
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/services/SettingsService', () => ({
  settingsService: {
    loadNetworks: jest.fn().mockResolvedValue([]),
    getSetting: jest.fn().mockResolvedValue(null),
  },
}));

jest.mock('../../src/services/TabService', () => ({
  tabService: {
    getTabs: jest.fn().mockResolvedValue([]),
    saveTabs: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../src/services/MessageHistoryService', () => ({
  messageHistoryService: {
    loadMessages: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('../../src/stores/tabStore', () => ({
  useTabStore: {
    getState: jest.fn().mockReturnValue({ tabs: [] }),
  },
}));

jest.mock('../../src/utils/tabUtils', () => ({
  serverTabId: jest.fn().mockReturnValue('server-default'),
  makeServerTab: jest.fn().mockReturnValue({ id: 'server-default', type: 'server', name: 'default', networkId: 'default' }),
}));

describe('useNetworkInitialization', () => {
  const mockSetSelectedNetworkName = jest.fn();
  const mockSetNetworkName = jest.fn();
  const mockSetPrimaryNetworkId = jest.fn();
  const mockSetTabs = jest.fn();
  const mockSetActiveTabId = jest.fn();
  const mockSetInitialDataLoaded = jest.fn();

  const defaultProps = {
    isCheckingFirstRun: false,
    showFirstRunSetup: false,
    primaryNetworkId: null,
    tabs: [],
    setSelectedNetworkName: mockSetSelectedNetworkName,
    setNetworkName: mockSetNetworkName,
    setPrimaryNetworkId: mockSetPrimaryNetworkId,
    setTabs: mockSetTabs,
    setActiveTabId: mockSetActiveTabId,
    setInitialDataLoaded: mockSetInitialDataLoaded,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set default mock implementations
    require('@react-native-async-storage/async-storage').getItem.mockResolvedValue(null);
    require('@react-native-async-storage/async-storage').removeItem.mockResolvedValue(undefined);
    require('../../src/services/SettingsService').settingsService.loadNetworks.mockResolvedValue([]);
    require('../../src/services/TabService').tabService.getTabs.mockResolvedValue([]);
    require('../../src/services/MessageHistoryService').messageHistoryService.loadMessages.mockResolvedValue([]);
    require('../../src/stores/tabStore').useTabStore.getState.mockReturnValue({ tabs: [] });
    require('../../src/utils/tabUtils').serverTabId.mockReturnValue('server-default');
    require('../../src/utils/tabUtils').makeServerTab.mockReturnValue({ 
      id: 'server-default', 
      type: 'server', 
      name: 'default', 
      networkId: 'default' 
    });
  });

  it('should render without crashing', () => {
    expect(() => {
      renderHook(() => useNetworkInitialization(defaultProps));
    }).not.toThrow();
  });

  it('should not load initial data if checking first run', () => {
    const props = {
      ...defaultProps,
      isCheckingFirstRun: true,
    };

    renderHook(() => useNetworkInitialization(props));

    expect(require('../../src/services/SettingsService').settingsService.loadNetworks).not.toHaveBeenCalled();
  });

  it('should not load initial data if showing first run setup', () => {
    const props = {
      ...defaultProps,
      showFirstRunSetup: true,
    };

    renderHook(() => useNetworkInitialization(props));

    expect(require('../../src/services/SettingsService').settingsService.loadNetworks).not.toHaveBeenCalled();
  });

  it('should load initial data when not checking first run', async () => {
    renderHook(() => useNetworkInitialization(defaultProps));

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(require('../../src/services/SettingsService').settingsService.loadNetworks).toHaveBeenCalled();
  });

  it('should set default network name when no networks exist', async () => {
    renderHook(() => useNetworkInitialization(defaultProps));

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mockSetSelectedNetworkName).toHaveBeenCalledWith('default');
    expect(mockSetNetworkName).toHaveBeenCalledWith('default');
  });

  it('should set network name to first available network', async () => {
    require('../../src/services/SettingsService').settingsService.loadNetworks.mockResolvedValue([
      { name: 'Test Network', servers: [{ hostname: 'test.com', port: 6667 }] }
    ]);

    renderHook(() => useNetworkInitialization(defaultProps));

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mockSetSelectedNetworkName).toHaveBeenCalledWith('Test Network');
    expect(mockSetNetworkName).toHaveBeenCalledWith('Test Network');
  });

  it('should prioritize DBase network if no quick connect or favorite is set', async () => {
    require('../../src/services/SettingsService').settingsService.loadNetworks.mockResolvedValue([
      { name: 'Other Network', servers: [{ hostname: 'other.com', port: 6667 }] },
      { name: 'DBase', servers: [{ hostname: 'dbase.com', port: 6667 }] },
    ]);
    require('../../src/services/SettingsService').settingsService.getSetting.mockResolvedValue(null);

    renderHook(() => useNetworkInitialization(defaultProps));

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mockSetSelectedNetworkName).toHaveBeenCalledWith('DBase');
    expect(mockSetNetworkName).toHaveBeenCalledWith('DBase');
  });

  it('should prioritize Quick Connect Network over everything', async () => {
    require('../../src/services/SettingsService').settingsService.loadNetworks.mockResolvedValue([
      { id: 'DBase', name: 'DBase', servers: [{ hostname: 'dbase.com', port: 6667 }] },
      { id: 'freenode', name: 'Freenode', servers: [{ hostname: 'chat.freenode.com', port: 6697 }] },
    ]);
    require('../../src/services/SettingsService').settingsService.getSetting.mockResolvedValue('freenode');

    renderHook(() => useNetworkInitialization(defaultProps));

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mockSetSelectedNetworkName).toHaveBeenCalledWith('Freenode');
    expect(mockSetNetworkName).toHaveBeenCalledWith('Freenode');
  });

  it('should prioritize favorite/default server network over DBase', async () => {
    require('../../src/services/SettingsService').settingsService.loadNetworks.mockResolvedValue([
      { id: 'DBase', name: 'DBase', servers: [{ hostname: 'dbase.com', port: 6667 }] },
      { id: 'mynet', name: 'MyNetwork', defaultServerId: 'srv1', servers: [{ id: 'srv1', hostname: 'my.com', port: 6697, favorite: true }] },
    ]);
    require('../../src/services/SettingsService').settingsService.getSetting.mockResolvedValue(null);

    renderHook(() => useNetworkInitialization(defaultProps));

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mockSetSelectedNetworkName).toHaveBeenCalledWith('MyNetwork');
    expect(mockSetNetworkName).toHaveBeenCalledWith('MyNetwork');
  });

  it('should load tabs for the selected network', async () => {
    require('../../src/services/SettingsService').settingsService.loadNetworks.mockResolvedValue([
      { name: 'Test Network', servers: [{ hostname: 'test.com', port: 6667 }] }
    ]);

    const mockTabs = [
      { id: 'tab1', type: 'channel', name: '#test', networkId: 'Test Network' }
    ];
    require('../../src/services/TabService').tabService.getTabs.mockResolvedValue(mockTabs);

    renderHook(() => useNetworkInitialization(defaultProps));

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(require('../../src/services/TabService').tabService.getTabs).toHaveBeenCalledWith('Test Network');
  });

  it('should clean up "Not connected" tabs from storage', async () => {
    renderHook(() => useNetworkInitialization(defaultProps));

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(require('@react-native-async-storage/async-storage').removeItem).toHaveBeenCalledWith('TABS_Not connected');
  });

  it('should create server tab if none exists', async () => {
    require('../../src/services/SettingsService').settingsService.loadNetworks.mockResolvedValue([
      { name: 'Test Network', servers: [{ hostname: 'test.com', port: 6667 }] }
    ]);

    // Return empty tabs to trigger server tab creation
    require('../../src/services/TabService').tabService.getTabs.mockResolvedValue([]);

    renderHook(() => useNetworkInitialization(defaultProps));

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mockSetTabs).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ type: 'server', networkId: 'default' }) // The networkId will be 'default' as per makeServerTab implementation
      ])
    );
  });

  it('should load server tab history on startup', async () => {
    require('../../src/services/SettingsService').settingsService.loadNetworks.mockResolvedValue([
      { name: 'Test Network', servers: [{ hostname: 'test.com', port: 6667 }] }
    ]);

    const mockTabs = [
      { id: 'server-Test Network', type: 'server', name: 'Test Network', networkId: 'Test Network' }
    ];
    require('../../src/services/TabService').tabService.getTabs.mockResolvedValue(mockTabs);

    const mockHistory = [{ id: 'msg1', text: 'test message', timestamp: Date.now() }];
    require('../../src/services/MessageHistoryService').messageHistoryService.loadMessages.mockResolvedValue(mockHistory);

    renderHook(() => useNetworkInitialization(defaultProps));

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(require('../../src/services/MessageHistoryService').messageHistoryService.loadMessages).toHaveBeenCalledWith('Test Network', 'server');
  });

  it('should handle errors when loading initial data', async () => {
    require('../../src/services/SettingsService').settingsService.loadNetworks.mockRejectedValue(new Error('Failed to load networks'));

    const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

    renderHook(() => useNetworkInitialization(defaultProps));

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mockConsoleError).toHaveBeenCalledWith('Error loading initial data:', expect.any(Error));

    // Should set fallback tabs
    expect(mockSetTabs).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ type: 'server', networkId: 'default' })
      ])
    );

    mockConsoleError.mockRestore();
  });

  it('should set primary network ID if not already set', async () => {
    renderHook(() => useNetworkInitialization(defaultProps));

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mockSetPrimaryNetworkId).toHaveBeenCalledWith('default');
  });

  it('should not set primary network ID if already set', async () => {
    const props = {
      ...defaultProps,
      primaryNetworkId: 'existing-network',
    };

    renderHook(() => useNetworkInitialization(props));

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mockSetPrimaryNetworkId).not.toHaveBeenCalled();
  });

  it('should set active tab ID to server tab by default', async () => {
    require('../../src/services/SettingsService').settingsService.loadNetworks.mockResolvedValue([
      { name: 'Test Network', servers: [{ hostname: 'test.com', port: 6667 }] }
    ]);

    // Mock serverTabId to return the expected value
    require('../../src/utils/tabUtils').serverTabId.mockReturnValue('server-Test Network');

    renderHook(() => useNetworkInitialization(defaultProps));

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mockSetActiveTabId).toHaveBeenCalledWith('server-Test Network');
  });

  it('should set active tab ID to last active tab if available', async () => {
    require('../../src/services/SettingsService').settingsService.loadNetworks.mockResolvedValue([
      { name: 'Test Network', servers: [{ hostname: 'test.com', port: 6667 }] }
    ]);

    require('@react-native-async-storage/async-storage').getItem.mockResolvedValue('last-active-tab');

    const mockTabs = [
      { id: 'server-Test Network', type: 'server', name: 'Test Network', networkId: 'Test Network' },
      { id: 'last-active-tab', type: 'channel', name: '#test', networkId: 'Test Network' }
    ];
    require('../../src/services/TabService').tabService.getTabs.mockResolvedValue(mockTabs);

    renderHook(() => useNetworkInitialization(defaultProps));

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mockSetActiveTabId).toHaveBeenCalledWith('last-active-tab');
  });

  it('should clean up invalid tabs from state on mount', () => {
    require('../../src/stores/tabStore').useTabStore.getState.mockReturnValue({
      tabs: [
        { id: 'valid-tab', name: '#valid', networkId: 'Test Network' },
        { id: 'invalid-tab', name: 'Not connected', networkId: 'Test Network' },
        { id: 'another-invalid', name: '#channel', networkId: 'Not connected' },
      ]
    });

    renderHook(() => useNetworkInitialization(defaultProps));

    // Should call setTabs to remove invalid tabs
    expect(mockSetTabs).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'valid-tab' })
      ])
    );
  });

  it('should mark initial data as loaded', async () => {
    renderHook(() => useNetworkInitialization(defaultProps));

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mockSetInitialDataLoaded).toHaveBeenCalledWith(true);
  });

  it('should save tabs to storage when they change', async () => {
    const tabsWithChanges = [
      { id: 'tab1', type: 'channel', name: '#test', networkId: 'Test Network' }
    ];

    const propsWithTabs = {
      ...defaultProps,
      tabs: tabsWithChanges,
    };

    require('../../src/stores/tabStore').useTabStore.getState.mockReturnValue({
      tabs: tabsWithChanges,
    });

    // Use fake timers to control setTimeout behavior
    jest.useFakeTimers();

    renderHook(() => useNetworkInitialization(propsWithTabs));

    // Fast-forward time to trigger the setTimeout
    jest.advanceTimersByTime(600); // Longer than debounce time

    expect(require('../../src/services/TabService').tabService.saveTabs).toHaveBeenCalledWith('Test Network', tabsWithChanges);

    // Restore real timers
    jest.useRealTimers();
  });

  it('should not save tabs for invalid network IDs', async () => {
    const tabsWithInvalidNetwork = [
      { id: 'tab1', type: 'channel', name: '#test', networkId: 'Not connected' },
      { id: 'tab2', type: 'channel', name: '#test2', networkId: '' },
    ];

    const propsWithTabs = {
      ...defaultProps,
      tabs: tabsWithInvalidNetwork,
    };

    require('../../src/stores/tabStore').useTabStore.getState.mockReturnValue({
      tabs: tabsWithInvalidNetwork,
    });

    jest.useFakeTimers();

    renderHook(() => useNetworkInitialization(propsWithTabs));

    // Wait for the debounced save to occur
    jest.advanceTimersByTime(600); // Longer than debounce time

    // Should not save tabs for invalid network IDs
    expect(require('../../src/services/TabService').tabService.saveTabs).not.toHaveBeenCalled();
    jest.useRealTimers();
  });
});

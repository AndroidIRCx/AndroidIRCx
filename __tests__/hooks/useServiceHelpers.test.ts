/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for useServiceHelpers hook
 */

import { renderHook } from '@testing-library/react-native';
import { useServiceHelpers } from '../../src/hooks/useServiceHelpers';

// Mock the services and modules used in the hook
jest.mock('../../src/services/IRCService', () => ({
  ircService: {},
}));

jest.mock('../../src/services/SettingsService', () => ({
  settingsService: {
    loadNetworks: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('../../src/services/ConnectionManager', () => ({
  connectionManager: {
    getActiveConnection: jest.fn().mockReturnValue(null),
    getActiveNetworkId: jest.fn().mockReturnValue(null),
  },
}));

jest.mock('../../src/services/UserManagementService', () => ({
  userManagementService: {},
}));

jest.mock('../../src/services/CommandService', () => ({
  commandService: {},
}));

jest.mock('../../src/services/ConnectionQualityService', () => ({
  connectionQualityService: {},
}));

jest.mock('../../src/services/ChannelManagementService', () => ({
  channelManagementService: {},
}));

jest.mock('../../src/stores/tabStore', () => ({
  useTabStore: {
    getState: jest.fn().mockReturnValue({ tabs: [] }),
  },
}));

jest.mock('../../src/utils/tabUtils', () => ({
  serverTabId: jest.fn().mockReturnValue('server-test'),
  sortTabsGrouped: jest.fn().mockImplementation((tabs) => tabs),
}));

describe('useServiceHelpers', () => {
  const mockSetTabs = jest.fn();
  const mockTabSortAlphabetical = false;

  const defaultProps = {
    setTabs: mockSetTabs,
    tabSortAlphabetical: mockTabSortAlphabetical,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set default mock implementations
    require('../../src/stores/tabStore').useTabStore.getState.mockReturnValue({ tabs: [] });
    require('../../src/utils/tabUtils').serverTabId.mockReturnValue('server-test');
    require('../../src/utils/tabUtils').sortTabsGrouped.mockImplementation((tabs) => tabs);
    require('../../src/services/SettingsService').settingsService.loadNetworks.mockResolvedValue([]);
    require('../../src/services/ConnectionManager').connectionManager.getActiveConnection.mockReturnValue(null);
  });

  it('should return helper functions', () => {
    const { result } = renderHook(() => useServiceHelpers(defaultProps));

    expect(result.current).toHaveProperty('appendServerMessage');
    expect(result.current).toHaveProperty('getActiveIRCService');
    expect(result.current).toHaveProperty('getActiveUserManagementService');
    expect(result.current).toHaveProperty('getActiveCommandService');
    expect(result.current).toHaveProperty('getActiveConnectionQualityService');
    expect(result.current).toHaveProperty('getActiveChannelManagementService');
    expect(result.current).toHaveProperty('normalizeNetworkId');
    expect(result.current).toHaveProperty('getNetworkConfigForId');
  });

  it('should append server message to existing server tab', () => {
    const mockTabs = [
      { id: 'server-test', type: 'server', name: 'test', networkId: 'test', messages: [] }
    ];
    require('../../src/stores/tabStore').useTabStore.getState.mockReturnValue({ tabs: mockTabs });

    const { result } = renderHook(() => useServiceHelpers(defaultProps));

    result.current.appendServerMessage('test', 'Test message');

    expect(mockSetTabs).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'server-test',
          messages: expect.arrayContaining([
            expect.objectContaining({
              text: 'Test message',
              type: 'raw',
              isRaw: true,
            })
          ])
        })
      ])
    );
  });

  it('should not create a missing server tab when appending a server message', () => {
    require('../../src/stores/tabStore').useTabStore.getState.mockReturnValue({ tabs: [] });

    const { result } = renderHook(() => useServiceHelpers(defaultProps));

    result.current.appendServerMessage('test', 'Test message');

    expect(mockSetTabs).not.toHaveBeenCalled();
  });

  it('should not append server message for invalid network ID', () => {
    const mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation();

    const { result } = renderHook(() => useServiceHelpers(defaultProps));

    result.current.appendServerMessage('Not connected', 'Test message');

    expect(mockSetTabs).not.toHaveBeenCalled();
    expect(mockConsoleWarn).toHaveBeenCalledWith(
      '?? Prevented server message for invalid networkId:', 
      'Not connected'
    );

    mockConsoleWarn.mockRestore();
  });

  it('should not append server message for empty network ID', () => {
    const mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation();

    const { result } = renderHook(() => useServiceHelpers(defaultProps));

    result.current.appendServerMessage('', 'Test message');

    expect(mockSetTabs).not.toHaveBeenCalled();
    expect(mockConsoleWarn).toHaveBeenCalledWith(
      '?? Prevented server message for invalid networkId:', 
      ''
    );

    mockConsoleWarn.mockRestore();
  });

  it('should get active IRC service from singleton when no active connection', () => {
    const { result } = renderHook(() => useServiceHelpers(defaultProps));

    const service = result.current.getActiveIRCService();

    expect(service).toBe(require('../../src/services/IRCService').ircService);
  });

  it('should get active IRC service from connection manager when active connection exists', () => {
    const mockActiveConnection = { ircService: { mockService: true } };
    require('../../src/services/ConnectionManager').connectionManager.getActiveConnection.mockReturnValue(mockActiveConnection);

    const { result } = renderHook(() => useServiceHelpers(defaultProps));

    const service = result.current.getActiveIRCService();

    expect(service).toBe(mockActiveConnection.ircService);
  });

  it('should get active user management service from singleton when no active connection', () => {
    const { result } = renderHook(() => useServiceHelpers(defaultProps));

    const service = result.current.getActiveUserManagementService();

    expect(service).toBe(require('../../src/services/UserManagementService').userManagementService);
  });

  it('should get active user management service from connection manager when active connection exists', () => {
    const mockActiveConnection = { userManagementService: { mockService: true } };
    require('../../src/services/ConnectionManager').connectionManager.getActiveConnection.mockReturnValue(mockActiveConnection);

    const { result } = renderHook(() => useServiceHelpers(defaultProps));

    const service = result.current.getActiveUserManagementService();

    expect(service).toBe(mockActiveConnection.userManagementService);
  });

  it('should get active command service from singleton when no active connection', () => {
    const { result } = renderHook(() => useServiceHelpers(defaultProps));

    const service = result.current.getActiveCommandService();

    expect(service).toBe(require('../../src/services/CommandService').commandService);
  });

  it('should get active command service from connection manager when active connection exists', () => {
    const mockActiveConnection = { commandService: { mockService: true } };
    require('../../src/services/ConnectionManager').connectionManager.getActiveConnection.mockReturnValue(mockActiveConnection);

    const { result } = renderHook(() => useServiceHelpers(defaultProps));

    const service = result.current.getActiveCommandService();

    expect(service).toBe(mockActiveConnection.commandService);
  });

  it('should get active connection quality service from singleton when no active connection', () => {
    const { result } = renderHook(() => useServiceHelpers(defaultProps));

    const service = result.current.getActiveConnectionQualityService();

    expect(service).toBe(require('../../src/services/ConnectionQualityService').connectionQualityService);
  });

  it('should get active connection quality service from connection manager when active connection exists', () => {
    const mockActiveConnection = { connectionQualityService: { mockService: true } };
    require('../../src/services/ConnectionManager').connectionManager.getActiveConnection.mockReturnValue(mockActiveConnection);

    const { result } = renderHook(() => useServiceHelpers(defaultProps));

    const service = result.current.getActiveConnectionQualityService();

    expect(service).toBe(mockActiveConnection.connectionQualityService);
  });

  it('should get active channel management service from singleton when no active connection', () => {
    const { result } = renderHook(() => useServiceHelpers(defaultProps));

    const service = result.current.getActiveChannelManagementService();

    expect(service).toBe(require('../../src/services/ChannelManagementService').channelManagementService);
  });

  it('should get active channel management service from connection manager when active connection exists', () => {
    const mockActiveConnection = { channelManagementService: { mockService: true } };
    require('../../src/services/ConnectionManager').connectionManager.getActiveConnection.mockReturnValue(mockActiveConnection);

    const { result } = renderHook(() => useServiceHelpers(defaultProps));

    const service = result.current.getActiveChannelManagementService();

    expect(service).toBe(mockActiveConnection.channelManagementService);
  });

  it('should normalize network ID by removing suffix numbers in parentheses', () => {
    const { result } = renderHook(() => useServiceHelpers(defaultProps));

    const normalized = result.current.normalizeNetworkId('network (123)');

    expect(normalized).toBe('network');
  });

  it('should not change network ID if no suffix numbers in parentheses', () => {
    const { result } = renderHook(() => useServiceHelpers(defaultProps));

    const normalized = result.current.normalizeNetworkId('network');

    expect(normalized).toBe('network');
  });

  it('should get network config by ID', async () => {
    const mockNetworks = [
      { name: 'Test Network', id: 'test1', servers: [] },
      { name: 'Another Network', id: 'test2', servers: [] },
    ];
    require('../../src/services/SettingsService').settingsService.loadNetworks.mockResolvedValue(mockNetworks);

    const { result } = renderHook(() => useServiceHelpers(defaultProps));

    const config = await result.current.getNetworkConfigForId('test1');

    expect(config).toBe(mockNetworks[0]);
  });

  it('should return null if network config not found', async () => {
    const mockNetworks = [
      { name: 'Test Network', id: 'test1', servers: [] },
    ];
    require('../../src/services/SettingsService').settingsService.loadNetworks.mockResolvedValue(mockNetworks);

    const { result } = renderHook(() => useServiceHelpers(defaultProps));

    const config = await result.current.getNetworkConfigForId('nonexistent');

    expect(config).toBeNull();
  });

  it('should find network config by normalized ID', async () => {
    const mockNetworks = [
      { name: 'Test Network', id: 'test', servers: [] },
    ];
    require('../../src/services/SettingsService').settingsService.loadNetworks.mockResolvedValue(mockNetworks);

    const { result } = renderHook(() => useServiceHelpers(defaultProps));

    const config = await result.current.getNetworkConfigForId('test (123)');

    expect(config).toBe(mockNetworks[0]);
  });

  it('should handle empty network ID in getNetworkConfigForId', async () => {
    const { result } = renderHook(() => useServiceHelpers(defaultProps));

    const config = await result.current.getNetworkConfigForId('');

    expect(config).toBeNull();
  });

  it('should sort tabs when appending server message', () => {
    const mockTabs = [
      { id: 'server-test', type: 'server', name: 'test', networkId: 'test', messages: [] }
    ];
    require('../../src/stores/tabStore').useTabStore.getState.mockReturnValue({ tabs: mockTabs });
    const mockSortedTabs = [
      { id: 'server-test', type: 'server', name: 'test', networkId: 'test', messages: [{ id: 'msg1', text: 'Test message', type: 'raw', isRaw: true }] }
    ];
    require('../../src/utils/tabUtils').sortTabsGrouped.mockReturnValue(mockSortedTabs);

    const { result } = renderHook(() => useServiceHelpers(defaultProps));

    result.current.appendServerMessage('test', 'Test message');

    expect(require('../../src/utils/tabUtils').sortTabsGrouped).toHaveBeenCalledWith(
      expect.any(Array),
      mockTabSortAlphabetical
    );
  });
});

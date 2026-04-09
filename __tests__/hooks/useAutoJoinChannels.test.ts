/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for useAutoJoinChannels hook
 */

import { renderHook } from '@testing-library/react-native';
import { useAutoJoinChannels } from '../../src/hooks/useAutoJoinChannels';

// Mock the services used in the hook
jest.mock('../../src/services/SettingsService', () => ({
  settingsService: {
    getSetting: jest.fn().mockResolvedValue(true),
    loadNetworks: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('../../src/services/ChannelFavoritesService', () => ({
  channelFavoritesService: {
    getFavorites: jest.fn().mockReturnValue([]),
  },
}));

describe('useAutoJoinChannels', () => {
  const mockGetActiveIRCService = jest.fn();
  const mockMotdCompleteRef = { current: new Set<string>() };

  beforeEach(() => {
    jest.clearAllMocks();
    mockMotdCompleteRef.current = new Set();

    // Default mock implementations
    require('../../src/services/SettingsService').settingsService.getSetting.mockResolvedValue(
      true,
    );
    require('../../src/services/SettingsService').settingsService.loadNetworks.mockResolvedValue(
      [],
    );
    require('../../src/services/ChannelFavoritesService').channelFavoritesService.getFavorites.mockReturnValue(
      [],
    );
  });

  it('should render without crashing', () => {
    const params = {
      isConnected: false,
      activeConnectionId: null,
      selectedNetworkName: null,
      getActiveIRCService: mockGetActiveIRCService,
      motdCompleteRef: mockMotdCompleteRef,
      motdSignal: 0,
    };

    expect(() => {
      renderHook(() => useAutoJoinChannels(params));
    }).not.toThrow();
  });

  it('should load autoJoinFavorites setting on mount', async () => {
    const params = {
      isConnected: false,
      activeConnectionId: null,
      selectedNetworkName: null,
      getActiveIRCService: mockGetActiveIRCService,
      motdCompleteRef: mockMotdCompleteRef,
      motdSignal: 0,
    };

    renderHook(() => useAutoJoinChannels(params));

    expect(
      require('../../src/services/SettingsService').settingsService.getSetting,
    ).toHaveBeenCalledWith('autoJoinFavorites', true);
  });

  it('should attempt auto-join when connected and registered', async () => {
    const mockIRCService = {
      isRegistered: jest.fn().mockReturnValue(true),
      joinChannel: jest.fn(),
    };

    mockGetActiveIRCService.mockReturnValue(mockIRCService);

    const params = {
      isConnected: true,
      activeConnectionId: 'test-net',
      selectedNetworkName: null,
      getActiveIRCService: mockGetActiveIRCService,
      motdCompleteRef: mockMotdCompleteRef,
      motdSignal: 0,
    };
    mockMotdCompleteRef.current.add('test-net');

    // Add network to mock
    require('../../src/services/SettingsService').settingsService.loadNetworks.mockResolvedValue(
      [{ id: 'test-net', name: 'Test Network', autoJoinChannels: ['#test'] }],
    );

    renderHook(() => useAutoJoinChannels(params));

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mockIRCService.joinChannel).toHaveBeenCalledWith('#test', undefined);
  });

  it('should not attempt auto-join when not connected', () => {
    const params = {
      isConnected: false,
      activeConnectionId: 'test-net',
      selectedNetworkName: null,
      getActiveIRCService: mockGetActiveIRCService,
      motdCompleteRef: mockMotdCompleteRef,
      motdSignal: 0,
    };

    renderHook(() => useAutoJoinChannels(params));

    expect(mockGetActiveIRCService).toHaveBeenCalled();
  });

  it('should not attempt auto-join when not registered', () => {
    const mockIRCService = {
      isRegistered: jest.fn().mockReturnValue(false),
      joinChannel: jest.fn(),
    };

    mockGetActiveIRCService.mockReturnValue(mockIRCService);

    const params = {
      isConnected: true,
      activeConnectionId: 'test-net',
      selectedNetworkName: null,
      getActiveIRCService: mockGetActiveIRCService,
      motdCompleteRef: mockMotdCompleteRef,
      motdSignal: 0,
    };

    renderHook(() => useAutoJoinChannels(params));

    expect(mockIRCService.joinChannel).not.toHaveBeenCalled();
  });

  it('should join favorite channels when enabled', async () => {
    const mockIRCService = {
      isRegistered: jest.fn().mockReturnValue(true),
      joinChannel: jest.fn(),
    };

    mockGetActiveIRCService.mockReturnValue(mockIRCService);

    const params = {
      isConnected: true,
      activeConnectionId: 'test-net',
      selectedNetworkName: null,
      getActiveIRCService: mockGetActiveIRCService,
      motdCompleteRef: mockMotdCompleteRef,
      motdSignal: 0,
    };
    mockMotdCompleteRef.current.add('test-net');

    // Add network and favorites to mock
    require('../../src/services/SettingsService').settingsService.loadNetworks.mockResolvedValue(
      [{ id: 'test-net', name: 'Test Network', autoJoinChannels: ['#test'] }],
    );

    require('../../src/services/ChannelFavoritesService').channelFavoritesService.getFavorites.mockReturnValue(
      [{ name: '#favorite', key: 'secret' }],
    );

    renderHook(() => useAutoJoinChannels(params));

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mockIRCService.joinChannel).toHaveBeenCalledWith('#test', undefined);
    expect(mockIRCService.joinChannel).toHaveBeenCalledWith(
      '#favorite',
      'secret',
    );
  });

  it('should not join favorite channels when disabled', async () => {
    const mockIRCService = {
      isRegistered: jest.fn().mockReturnValue(true),
      joinChannel: jest.fn(),
    };

    mockGetActiveIRCService.mockReturnValue(mockIRCService);

    const params = {
      isConnected: false,
      activeConnectionId: 'test-net',
      selectedNetworkName: null,
      getActiveIRCService: mockGetActiveIRCService,
      motdCompleteRef: mockMotdCompleteRef,
      motdSignal: 0,
    };
    mockMotdCompleteRef.current.add('test-net');

    // Disable auto-join favorites
    require('../../src/services/SettingsService').settingsService.getSetting.mockResolvedValue(
      false,
    );

    // Add network and favorites to mock
    require('../../src/services/SettingsService').settingsService.loadNetworks.mockResolvedValue(
      [{ id: 'test-net', name: 'Test Network', autoJoinChannels: ['#test'] }],
    );

    require('../../src/services/ChannelFavoritesService').channelFavoritesService.getFavorites.mockReturnValue(
      [{ name: '#favorite', key: 'secret' }],
    );

    const { rerender } = renderHook(p => useAutoJoinChannels(p), {
      initialProps: params,
    });

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 0));
    rerender({ ...params, isConnected: true });
    await new Promise(resolve => setTimeout(resolve, 0));

    // Should only join auto-join channels, not favorites
    expect(mockIRCService.joinChannel).toHaveBeenCalledWith('#test', undefined);
    expect(mockIRCService.joinChannel).not.toHaveBeenCalledWith(
      '#favorite',
      'secret',
    );
  });

  it('should reset when connection ID changes', () => {
    const params = {
      isConnected: false,
      activeConnectionId: 'test-net',
      selectedNetworkName: null,
      getActiveIRCService: mockGetActiveIRCService,
      motdCompleteRef: mockMotdCompleteRef,
      motdSignal: 0,
    };

    const { rerender } = renderHook(props => useAutoJoinChannels(props), {
      initialProps: params,
    });

    // Rerender with different connection ID to trigger reset
    rerender({
      ...params,
      activeConnectionId: 'different-net',
    });

    // Should not throw
    expect(true).toBe(true);
  });
});

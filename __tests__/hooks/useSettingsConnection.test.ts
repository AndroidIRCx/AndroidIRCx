/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * useSettingsConnection.test.ts
 *
 * Tests for useSettingsConnection hook - settings connection management
 */

// Unmock the real implementation – jest.setup.ts registers a global stub for this
// hook (used by other tests that consume it indirectly), but this file tests the
// real implementation, so we need to lift that stub before importing.
jest.unmock('../../src/hooks/useSettingsConnection');

import { renderHook, act } from '@testing-library/react-native';
import { useSettingsConnection } from '../../src/hooks/useSettingsConnection';

// ─── Mocks ─────────────────────────────────────────────

const mockStorage: Map<string, string> = new Map();
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    setItem: jest.fn(async (key: string, value: string) => { mockStorage.set(key, value); }),
    getItem: jest.fn(async (key: string) => mockStorage.get(key) || null),
    removeItem: jest.fn(async (key: string) => { mockStorage.delete(key); }),
  },
}));

const mockNetworks = [
  { id: 'net-1', name: 'DBase', nick: 'TestNick', realname: 'Test', servers: [] },
  { id: 'net-2', name: 'Libera', nick: 'TestNick', realname: 'Test', servers: [] },
];

jest.mock('../../src/services/SettingsService', () => ({
  settingsService: {
    loadNetworks: jest.fn(async () => [
      { id: 'net-1', name: 'DBase', nick: 'TestNick', realname: 'Test', servers: [] },
      { id: 'net-2', name: 'Libera', nick: 'TestNick', realname: 'Test', servers: [] },
    ]),
  },
}));
const mockSettingsService = jest.requireMock<any>('../../src/services/SettingsService').settingsService;

const defaultAutoReconnectConfig = {
  enabled: true,
  maxAttempts: 10,
  initialDelay: 1000,
  maxDelay: 60000,
  backoffMultiplier: 2,
  rejoinChannels: true,
  smartReconnect: true,
  minReconnectInterval: 5000,
};

jest.mock('../../src/services/AutoReconnectService', () => ({
  autoReconnectService: {
    getConfig: jest.fn(() => ({
      enabled: true,
      maxAttempts: 10,
      initialDelay: 1000,
      maxDelay: 60000,
      backoffMultiplier: 2,
      rejoinChannels: true,
      smartReconnect: true,
      minReconnectInterval: 5000,
    })),
  },
}));
const mockAutoReconnectService = jest.requireMock<any>('../../src/services/AutoReconnectService').autoReconnectService;

const defaultRateLimitConfig = { messagesPerSecond: 5, burstLimit: 10 };
const defaultFloodProtectionConfig = { enabled: true, maxMessages: 10, timeWindow: 10000 };
const defaultLagMonitoringConfig = { enabled: true, interval: 30000, threshold: 5000 };
const defaultStats = { messagesSent: 100, messagesReceived: 200, uptime: 3600 };

jest.mock('../../src/services/ConnectionQualityService', () => ({
  connectionQualityService: {
    getRateLimitConfig: jest.fn(() => ({ messagesPerSecond: 5, burstLimit: 10 })),
    getFloodProtectionConfig: jest.fn(() => ({ enabled: true, maxMessages: 10, timeWindow: 10000 })),
    getLagMonitoringConfig: jest.fn(() => ({ enabled: true, interval: 30000, threshold: 5000 })),
    getStatistics: jest.fn(() => ({ messagesSent: 100, messagesReceived: 200, uptime: 3600 })),
    setRateLimitConfig: jest.fn(async () => {}),
    setFloodProtectionConfig: jest.fn(async () => {}),
    setLagMonitoringConfig: jest.fn(async () => {}),
  },
}));
const mockConnectionQualityService = jest.requireMock<any>('../../src/services/ConnectionQualityService').connectionQualityService;

const defaultBouncerConfig = { enabled: false, type: 'znc' as const };
const defaultBouncerInfo = { connected: false };

jest.mock('../../src/services/BouncerService', () => ({
  bouncerService: {
    getConfig: jest.fn(() => ({ enabled: false, type: 'znc' })),
    getBouncerInfo: jest.fn(() => ({ connected: false })),
    setConfig: jest.fn(async () => {}),
  },
}));
const mockBouncerService = jest.requireMock<any>('../../src/services/BouncerService').bouncerService;

// ─── Tests ─────────────────────────────────────────────

describe('useSettingsConnection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockStorage.clear();
    mockSettingsService.loadNetworks.mockResolvedValue(mockNetworks);
    mockAutoReconnectService.getConfig.mockReturnValue(defaultAutoReconnectConfig);
    mockConnectionQualityService.getRateLimitConfig.mockReturnValue(defaultRateLimitConfig);
    mockConnectionQualityService.getFloodProtectionConfig.mockReturnValue(defaultFloodProtectionConfig);
    mockConnectionQualityService.getLagMonitoringConfig.mockReturnValue(defaultLagMonitoringConfig);
    mockConnectionQualityService.getStatistics.mockReturnValue(defaultStats);
    mockBouncerService.getConfig.mockReturnValue(defaultBouncerConfig);
    mockBouncerService.getBouncerInfo.mockReturnValue(defaultBouncerInfo);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('initial state loading', () => {
    it('should load networks on mount', async () => {
      const { result } = renderHook(() => useSettingsConnection());

      // Flush async useEffect
      await act(async () => { jest.advanceTimersByTime(0); });

      expect(result.current.networks).toEqual(mockNetworks);
      expect(mockSettingsService.loadNetworks).toHaveBeenCalled();
    });

    it('should load auto reconnect config on mount', async () => {
      const { result } = renderHook(() => useSettingsConnection());
      await act(async () => { jest.advanceTimersByTime(0); });

      expect(result.current.autoReconnectConfig).toEqual(defaultAutoReconnectConfig);
    });

    it('should load rate limit config on mount', async () => {
      const { result } = renderHook(() => useSettingsConnection());
      await act(async () => { jest.advanceTimersByTime(0); });

      expect(result.current.rateLimitConfig).toEqual(defaultRateLimitConfig);
    });

    it('should load flood protection config on mount', async () => {
      const { result } = renderHook(() => useSettingsConnection());
      await act(async () => { jest.advanceTimersByTime(0); });

      expect(result.current.floodProtectionConfig).toEqual(defaultFloodProtectionConfig);
    });

    it('should load lag monitoring config on mount', async () => {
      const { result } = renderHook(() => useSettingsConnection());
      await act(async () => { jest.advanceTimersByTime(0); });

      expect(result.current.lagMonitoringConfig).toEqual(defaultLagMonitoringConfig);
    });

    it('should load connection stats on mount', async () => {
      const { result } = renderHook(() => useSettingsConnection());
      await act(async () => { jest.advanceTimersByTime(0); });

      expect(result.current.connectionStats).toEqual(defaultStats);
    });

    it('should load bouncer config on mount', async () => {
      const { result } = renderHook(() => useSettingsConnection());
      await act(async () => { jest.advanceTimersByTime(0); });

      expect(result.current.bouncerConfig).toEqual(defaultBouncerConfig);
    });

    it('should load bouncer info on mount', async () => {
      const { result } = renderHook(() => useSettingsConnection());
      await act(async () => { jest.advanceTimersByTime(0); });

      expect(result.current.bouncerInfo).toEqual(defaultBouncerInfo);
    });
  });

  describe('periodic updates', () => {
    it('should update connection stats periodically', async () => {
      const updatedStats = { messagesSent: 150, messagesReceived: 300, uptime: 7200 };
      const { result } = renderHook(() => useSettingsConnection());

      // Wait for initial load
      await act(async () => { jest.advanceTimersByTime(0); });
      expect(result.current.connectionStats).toEqual(defaultStats);

      // Update mock return value
      mockConnectionQualityService.getStatistics.mockReturnValue(updatedStats);

      // Advance timer by 1 second (periodic interval)
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(result.current.connectionStats).toEqual(updatedStats);
    });

    it('should update bouncer info periodically', async () => {
      const updatedBouncerInfo = { connected: true, version: '1.8' };
      const { result } = renderHook(() => useSettingsConnection());

      await act(async () => { jest.advanceTimersByTime(0); });
      expect(result.current.bouncerInfo).toEqual(defaultBouncerInfo);

      mockBouncerService.getBouncerInfo.mockReturnValue(updatedBouncerInfo);

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(result.current.bouncerInfo).toEqual(updatedBouncerInfo);
    });

    it('should clean up interval on unmount', async () => {
      const { unmount } = renderHook(() => useSettingsConnection());

      // Wait for initial load
      await act(async () => {});

      unmount();

      // After unmount, advancing timers should not call the services again
      const callCount = mockConnectionQualityService.getStatistics.mock.calls.length;

      act(() => {
        jest.advanceTimersByTime(5000);
      });

      // Call count should not increase after unmount
      expect(mockConnectionQualityService.getStatistics.mock.calls.length).toBe(callCount);
    });
  });

  describe('refreshNetworks', () => {
    it('should reload networks from service', async () => {
      const { result } = renderHook(() => useSettingsConnection());

      await act(async () => { jest.advanceTimersByTime(0); });
      expect(result.current.networks).toEqual(mockNetworks);

      const updatedNetworks = [...mockNetworks, { id: 'net-3', name: 'OFTC', nick: 'Test', realname: 'Test', servers: [] }];
      mockSettingsService.loadNetworks.mockResolvedValue(updatedNetworks);

      await act(async () => {
        await result.current.refreshNetworks();
      });

      expect(result.current.networks).toEqual(updatedNetworks);
    });
  });

  describe('updateAutoReconnectConfig', () => {
    it('should update with partial config', async () => {
      const { result } = renderHook(() => useSettingsConnection());

      await act(async () => { jest.advanceTimersByTime(0); });
      expect(result.current.autoReconnectConfig).toBeTruthy();

      await act(async () => {
        await result.current.updateAutoReconnectConfig({ maxAttempts: 20 });
      });

      expect(result.current.autoReconnectConfig!.maxAttempts).toBe(20);
      // Other values should remain
      expect(result.current.autoReconnectConfig!.enabled).toBe(true);
    });

    it('should accept full config object', async () => {
      const fullConfig = {
        enabled: false,
        maxAttempts: 5,
        initialDelay: 2000,
        maxDelay: 30000,
        backoffMultiplier: 1.5,
        rejoinChannels: false,
        smartReconnect: false,
        minReconnectInterval: 10000,
      };

      const { result } = renderHook(() => useSettingsConnection());

      await act(async () => { jest.advanceTimersByTime(0); });
      expect(result.current.autoReconnectConfig).toBeTruthy();

      await act(async () => {
        await result.current.updateAutoReconnectConfig(fullConfig);
      });

      expect(result.current.autoReconnectConfig).toEqual(fullConfig);
    });
  });

  describe('updateRateLimitConfig', () => {
    it('should update rate limit config', async () => {
      const updatedConfig = { messagesPerSecond: 10, burstLimit: 20 };
      mockConnectionQualityService.getRateLimitConfig.mockReturnValue(updatedConfig);

      const { result } = renderHook(() => useSettingsConnection());

      await act(async () => { jest.advanceTimersByTime(0); });
      expect(result.current.rateLimitConfig).toBeTruthy();

      await act(async () => {
        await result.current.updateRateLimitConfig({ messagesPerSecond: 10 });
      });

      expect(mockConnectionQualityService.setRateLimitConfig).toHaveBeenCalledWith(
        expect.objectContaining({ messagesPerSecond: 10 }),
      );
    });
  });

  describe('updateFloodProtectionConfig', () => {
    it('should update flood protection config', async () => {
      const updatedConfig = { enabled: false, maxMessages: 20, timeWindow: 20000 };
      mockConnectionQualityService.getFloodProtectionConfig.mockReturnValue(updatedConfig);

      const { result } = renderHook(() => useSettingsConnection());

      await act(async () => { jest.advanceTimersByTime(0); });
      expect(result.current.floodProtectionConfig).toBeTruthy();

      await act(async () => {
        await result.current.updateFloodProtectionConfig({ enabled: false });
      });

      expect(mockConnectionQualityService.setFloodProtectionConfig).toHaveBeenCalled();
    });
  });

  describe('updateLagMonitoringConfig', () => {
    it('should update lag monitoring config', async () => {
      const updatedConfig = { enabled: false, interval: 60000, threshold: 10000 };
      mockConnectionQualityService.getLagMonitoringConfig.mockReturnValue(updatedConfig);

      const { result } = renderHook(() => useSettingsConnection());

      await act(async () => { jest.advanceTimersByTime(0); });
      expect(result.current.lagMonitoringConfig).toBeTruthy();

      await act(async () => {
        await result.current.updateLagMonitoringConfig({ interval: 60000 });
      });

      expect(mockConnectionQualityService.setLagMonitoringConfig).toHaveBeenCalled();
    });
  });

  describe('updateBouncerConfig', () => {
    it('should update bouncer config', async () => {
      const updatedConfig = { enabled: true, type: 'znc' as const };
      mockBouncerService.getConfig.mockReturnValue(updatedConfig);

      const { result } = renderHook(() => useSettingsConnection());

      await act(async () => { jest.advanceTimersByTime(0); });
      expect(result.current.bouncerConfig).toBeTruthy();

      await act(async () => {
        await result.current.updateBouncerConfig({ enabled: true });
      });

      expect(mockBouncerService.setConfig).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: true }),
      );
    });
  });
});

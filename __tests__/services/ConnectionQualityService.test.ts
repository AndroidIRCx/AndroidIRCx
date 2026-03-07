/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ConnectionQualityService } from '../../src/services/ConnectionQualityService';

const mockGetSetting = jest.fn(async () => 'server');
const mockOnSettingChange = jest.fn();

jest.mock('../../src/services/SettingsService', () => ({
  settingsService: {
    getSetting: (...args: any[]) => mockGetSetting(...args),
    onSettingChange: (...args: any[]) => mockOnSettingChange(...args),
  },
}));

describe('ConnectionQualityService', () => {
  beforeAll(() => {
    jest.useFakeTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  const createIrc = () => ({
    onConnectionChange: jest.fn((cb: any) => {
      (createIrc as any)._conn = cb;
      return jest.fn();
    }),
    onMessage: jest.fn((cb: any) => {
      (createIrc as any)._msg = cb;
      return jest.fn();
    }),
    getConnectionStatus: jest.fn(() => true),
    getCurrentNick: jest.fn(() => 'tester'),
    sendRaw: jest.fn(),
    sendCTCPRequest: jest.fn(),
    socket: { write: jest.fn() },
    isConnected: true,
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    mockGetSetting.mockResolvedValue('server');
  });

  it('initializes and loads persisted config', async () => {
    await AsyncStorage.setItem('@AndroidIRCX:connectionQualityConfig', JSON.stringify({
      rateLimit: { messagesPerSecond: 2 },
      floodProtection: { maxMessagesPerWindow: 3 },
      lagMonitoring: { pingInterval: 12345 },
    }));

    const service = new ConnectionQualityService();
    const irc = createIrc();
    service.setIRCService(irc as any);
    await service.initialize();

    expect(service.getRateLimitConfig().messagesPerSecond).toBe(2);
    expect(service.getFloodProtectionConfig().maxMessagesPerWindow).toBe(3);
    expect(service.getLagMonitoringConfig().pingInterval).toBe(12345);
    expect(mockGetSetting).toHaveBeenCalledWith('lagCheckMethod', 'server');
    expect(mockOnSettingChange).toHaveBeenCalled();
  });

  it('tracks send/receive statistics and rate limiting', async () => {
    const service = new ConnectionQualityService();
    const irc = createIrc();
    service.setIRCService(irc as any);
    await service.initialize();

    await service.setRateLimitConfig({ enabled: true, messagesPerSecond: 1 });

    await expect(service.sendMessage('PRIVMSG #a :x')).resolves.toBeUndefined();
    await expect(service.sendMessage('PRIVMSG #a :y')).rejects.toThrow('Rate limit exceeded');

    (createIrc as any)._msg?.({ text: ':nick!u@h PRIVMSG #a :hello' });
    const stats = service.getStatistics();
    expect(stats.messagesSent).toBeGreaterThanOrEqual(1);
    expect(stats.messagesReceived).toBeGreaterThanOrEqual(1);
  });

  it('handles pong responses and notifies lag listeners', async () => {
    const service = new ConnectionQualityService();
    const lagListener = jest.fn();
    const statsListener = jest.fn();

    service.onLagUpdate(lagListener);
    service.onStatisticsUpdate(statsListener);

    service.handlePongResponse(Date.now() - 1500);

    expect(lagListener).toHaveBeenCalled();
    const status = lagListener.mock.calls[0][1];
    expect(['good', 'warning', 'timeout']).toContain(status);
    expect(statsListener).toHaveBeenCalled();
  });

  it('updates config and persists it', async () => {
    const service = new ConnectionQualityService();
    await service.setRateLimitConfig({ burstLimit: 25 });
    await service.setFloodProtectionConfig({ penaltyDelay: 500 });
    await service.setLagMonitoringConfig({ enabled: false });

    const saved = await AsyncStorage.getItem('@AndroidIRCX:connectionQualityConfig');
    expect(saved).toBeTruthy();
    const parsed = JSON.parse(saved as string);
    expect(parsed.rateLimit.burstLimit).toBe(25);
    expect(parsed.floodProtection.penaltyDelay).toBe(500);
    expect(parsed.lagMonitoring.enabled).toBe(false);
  });

  it('handles connection lifecycle callbacks, queue cleanup and lag monitor branches', async () => {
    const service = new ConnectionQualityService();
    const irc = createIrc();
    service.setIRCService(irc as any);
    await service.initialize();

    const statsBefore = service.getStatistics();
    expect(statsBefore.messagesSent).toBe(0);

    // simulate connect -> reset/start monitor -> send ping
    (createIrc as any)._conn?.(true);
    expect(irc.sendRaw).toHaveBeenCalled();

    // fill queue and disconnect should reject queued promises
    const reject = jest.fn();
    // @ts-ignore
    service.messageQueue = [{ message: 'x', timestamp: Date.now(), resolve: jest.fn(), reject }];
    (createIrc as any)._conn?.(false);
    expect(reject).toHaveBeenCalled();
  });

  it('covers flood penalty delay and not-connected/send-error branches', async () => {
    const service = new ConnectionQualityService();
    const irc = createIrc();
    service.setIRCService(irc as any);
    await service.initialize();

    await service.setFloodProtectionConfig({ enabled: true, maxMessagesPerWindow: 1, penaltyDelay: 100 });
    jest.spyOn(service as any, 'checkFloodProtection')
      .mockReturnValueOnce(false)
      .mockReturnValue(true);
    const p = service.sendMessage('PRIVMSG #a :penalty');
    jest.advanceTimersByTime(120);
    await expect(p).resolves.toBeUndefined();

    // socket missing branch
    (irc as any).socket = null;
    await expect(service.sendMessage('PRIVMSG #a :fail')).rejects.toThrow('Not connected');

    // socket.write throws
    (irc as any).socket = { write: jest.fn(() => { throw new Error('write-fail'); }) };
    (irc as any).isConnected = true;
    await expect(service.sendMessage('PRIVMSG #a :boom')).rejects.toThrow('write-fail');
  });

  it('covers ctcp ping method and listener error guards', async () => {
    mockGetSetting.mockResolvedValue('ctcp');
    const service = new ConnectionQualityService();
    const irc = createIrc();
    (irc as any).getCurrentNick = jest.fn(() => 'me');
    service.setIRCService(irc as any);
    await service.initialize();

    const badStatsListener = jest.fn(() => {
      throw new Error('stats-listener');
    });
    const badLagListener = jest.fn(() => {
      throw new Error('lag-listener');
    });
    service.onStatisticsUpdate(badStatsListener);
    service.onLagUpdate(badLagListener);

    (createIrc as any)._conn?.(true);
    expect(irc.sendCTCPRequest).toHaveBeenCalled();
    service.handlePongResponse(Date.now() - 2500);

    expect(badStatsListener).toHaveBeenCalled();
    expect(badLagListener).toHaveBeenCalled();
  });

  it('covers initialize parse failure branch', async () => {
    await AsyncStorage.setItem('@AndroidIRCX:connectionQualityConfig', '{bad-json');
    const service = new ConnectionQualityService();
    const irc = createIrc();
    service.setIRCService(irc as any);
    await service.initialize();
    expect(mockOnSettingChange).not.toHaveBeenCalled();
  });

  it('covers lagCheckMethod setting-change callback after successful initialize', async () => {
    const service = new ConnectionQualityService();
    const irc = createIrc();
    service.setIRCService(irc as any);
    const settingHandlers: Record<string, Function> = {};
    mockOnSettingChange.mockImplementation((k: string, cb: Function) => {
      settingHandlers[k] = cb;
    });

    await service.initialize();
    expect(mockOnSettingChange).toHaveBeenCalledWith('lagCheckMethod', expect.any(Function));
    settingHandlers.lagCheckMethod?.('ctcp');
    (createIrc as any)._conn?.(true);
    expect(irc.sendCTCPRequest).toHaveBeenCalled();
  });
});

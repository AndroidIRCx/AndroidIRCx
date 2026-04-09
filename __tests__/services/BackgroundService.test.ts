/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const mockAppStateAddEventListener = jest.fn();
const mockShouldNotify = jest.fn(() => true);
const mockShowMessageNotification = jest.fn(async () => undefined);
const mockShowNotification = jest.fn(async () => undefined);
const mockUpdatePreferences = jest.fn(async () => undefined);
const mockUpdateChannelPreferences = jest.fn(async () => undefined);
const mockUpdateNetworkPreferences = jest.fn(async () => undefined);
const mockGetPreferences = jest.fn(() => ({
  enabled: true,
  notifyOnMentions: true,
  notifyOnPrivateMessages: true,
  notifyOnAllMessages: false,
  doNotDisturb: false,
}));
const mockSaveMessage = jest.fn(async () => undefined);
const mockGetSetting = jest.fn(async (_key: string, def: any) => def);
const mockOnSettingChange = jest.fn(() => jest.fn());
const mockBatteryOptEnabled = jest.fn(async () => true);
const mockOpenOptimizationSettings = jest.fn();
const mockGetAllConnections = jest.fn(() => []);
const mockGetActiveConnection = jest.fn(() => null);

jest.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: (...args: any[]) => mockAppStateAddEventListener(...args),
  },
}));

jest.mock('../../src/services/NotificationService', () => ({
  notificationService: {
    shouldNotify: (...args: any[]) => mockShouldNotify(...args),
    showMessageNotification: (...args: any[]) =>
      mockShowMessageNotification(...args),
    showNotification: (...args: any[]) => mockShowNotification(...args),
    updatePreferences: (...args: any[]) => mockUpdatePreferences(...args),
    updateChannelPreferences: (...args: any[]) =>
      mockUpdateChannelPreferences(...args),
    updateNetworkPreferences: (...args: any[]) =>
      mockUpdateNetworkPreferences(...args),
    getPreferences: (...args: any[]) => mockGetPreferences(...args),
  },
}));

jest.mock('../../src/services/MessageHistoryService', () => ({
  messageHistoryService: {
    saveMessage: (...args: any[]) => mockSaveMessage(...args),
  },
}));

jest.mock('../../src/services/SettingsService', () => ({
  settingsService: {
    getSetting: (...args: any[]) => mockGetSetting(...args),
    onSettingChange: (...args: any[]) => mockOnSettingChange(...args),
  },
}));

jest.mock('react-native-battery-optimization-check', () => ({
  RequestDisableOptimization: jest.fn(),
  BatteryOptEnabled: (...args: any[]) => mockBatteryOptEnabled(...args),
  OpenOptimizationSettings: (...args: any[]) =>
    mockOpenOptimizationSettings(...args),
}));

jest.mock('../../src/services/ConnectionManager', () => ({
  connectionManager: {
    getAllConnections: (...args: any[]) => mockGetAllConnections(...args),
    getActiveConnection: (...args: any[]) => mockGetActiveConnection(...args),
  },
}));

jest.mock('../../src/services/IRCService', () => ({
  ircService: {
    getConnectionStatus: jest.fn(() => false),
  },
}));

jest.mock('../../src/i18n/transifex', () => ({
  tx: {
    t: jest.fn((key: string, params?: Record<string, any>) => {
      if (!params) return key;
      return key
        .replace('{channel}', params.channel || '')
        .replace('{count}', String(params.count || ''));
    }),
  },
}));

import { backgroundService } from '../../src/services/BackgroundService';

describe('BackgroundService', () => {
  const makeIrcService = () => {
    const handlers: Record<string, any> = {};
    const cleanup = jest.fn();
    return {
      handlers,
      cleanup,
      onMessage: jest.fn((cb: any) => {
        handlers.onMessage = cb;
        return cleanup;
      }),
      getCurrentNick: jest.fn(() => 'Tester'),
      getNetworkName: jest.fn(() => 'NetA'),
      getConnectionStatus: jest.fn(() => true),
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    (backgroundService as any).appState = 'active';
    (backgroundService as any).appStateListener = null;
    (backgroundService as any).messageListenerCleanups = new Map();
    (backgroundService as any).notificationQueue = new Map();
    (backgroundService as any).lastNotificationTime = new Map();
    (backgroundService as any).backgroundConnectionEnabled = true;
    (backgroundService as any).backgroundCheckTimer = null;
    (backgroundService as any).backgroundConnectionListeners = [];
    (backgroundService as any).showRawCommandsEnabled = true;
    (backgroundService as any).showRawCommandsUnsub = null;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('initializes app state listener and showRaw setting watcher', async () => {
    let appStateCb: any;
    mockAppStateAddEventListener.mockImplementation(
      (_event: string, cb: any) => {
        appStateCb = cb;
        return { remove: jest.fn() };
      },
    );
    mockGetSetting.mockResolvedValueOnce(false);

    await backgroundService.initialize();

    expect(mockAppStateAddEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function),
    );
    expect(mockOnSettingChange).toHaveBeenCalledWith(
      'showRawCommands',
      expect.any(Function),
    );
    expect(typeof appStateCb).toBe('function');
  });

  it('attaches listener in background, persists message and throttles notifications', async () => {
    let appStateCb: any;
    mockAppStateAddEventListener.mockImplementation(
      (_event: string, cb: any) => {
        appStateCb = cb;
        return { remove: jest.fn() };
      },
    );

    const irc = makeIrcService();
    mockGetAllConnections.mockReturnValue([
      { networkId: 'netA', ircService: irc },
    ]);

    await backgroundService.initialize();
    appStateCb('background');

    expect(irc.onMessage).toHaveBeenCalled();

    const msg = {
      type: 'message',
      from: 'alice',
      text: 'hello',
      channel: '#chat',
      network: 'NetA',
    };
    await irc.handlers.onMessage(msg);
    await irc.handlers.onMessage({ ...msg, text: 'hello again' });

    expect(mockSaveMessage).toHaveBeenCalledTimes(2);
    expect(mockShowMessageNotification).toHaveBeenCalledTimes(1);
    expect(
      (backgroundService as any).notificationQueue.get('NetA:#chat')?.length,
    ).toBe(1);
  });

  it('flushes queued notifications via processNotificationQueue', async () => {
    (backgroundService as any).notificationQueue = new Map([
      [
        'NetA:#help',
        [{ type: 'message', text: 'last', channel: '#help', network: 'NetA' }],
      ],
    ]);

    await backgroundService.processNotificationQueue();

    expect(mockShowNotification).toHaveBeenCalledTimes(1);
    expect((backgroundService as any).notificationQueue.size).toBe(0);
  });

  it('cleans up listeners and timers on foreground transition and cleanup()', async () => {
    let appStateCb: any;
    const remove = jest.fn();
    mockAppStateAddEventListener.mockImplementation(
      (_event: string, cb: any) => {
        appStateCb = cb;
        return { remove };
      },
    );

    const irc = makeIrcService();
    mockGetAllConnections.mockReturnValue([
      { networkId: 'netA', ircService: irc },
    ]);

    await backgroundService.initialize();
    appStateCb('background');
    appStateCb('active');
    backgroundService.cleanup();

    expect(irc.cleanup).toHaveBeenCalled();
    expect(remove).toHaveBeenCalled();
    expect((backgroundService as any).backgroundCheckTimer).toBeNull();
  });

  it('proxies notification preference updates and getter', async () => {
    await backgroundService.updateNotificationConfig({ enabled: false });
    await backgroundService.updateChannelNotificationConfig('#a', {
      notifyOnAllMessages: true,
    });
    await backgroundService.updateNetworkNotificationConfig('NetA', {
      doNotDisturb: true,
    });

    expect(mockUpdatePreferences).toHaveBeenCalledWith({ enabled: false });
    expect(mockUpdateChannelPreferences).toHaveBeenCalledWith('#a', {
      notifyOnAllMessages: true,
    });
    expect(mockUpdateNetworkPreferences).toHaveBeenCalledWith('NetA', {
      doNotDisturb: true,
    });
    expect(backgroundService.getNotificationConfig()).toEqual({
      enabled: true,
      notifyOnMentions: true,
      notifyOnPrivateMessages: true,
      notifyOnAllMessages: false,
      doNotDisturb: false,
    });
  });

  it('handles keepalive and background enable listeners', () => {
    const irc = makeIrcService();
    mockGetActiveConnection.mockReturnValue({ ircService: irc });
    const cb = jest.fn();
    const off = backgroundService.onBackgroundConnectionChange(cb);

    expect(backgroundService.shouldKeepAlive()).toBe(true);
    backgroundService.setBackgroundConnectionEnabled(false);
    expect(backgroundService.shouldKeepAlive()).toBe(false);
    expect(cb).toHaveBeenCalledWith(false);

    off();
    backgroundService.setBackgroundConnectionEnabled(true);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('wraps battery optimization helpers', async () => {
    await backgroundService.openBatteryOptimizationSettings();
    const enabled = await backgroundService.isBatteryOptimizationEnabled();

    expect(mockOpenOptimizationSettings).toHaveBeenCalled();
    expect(enabled).toBe(true);
  });
});

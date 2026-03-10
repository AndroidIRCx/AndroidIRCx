/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const mockOnSettingChange = jest.fn(() => jest.fn());
const mockGetSetting = jest.fn(async (_key: string, defaultValue: any) => defaultValue);

jest.mock('../../src/services/SettingsService', () => ({
  settingsService: {
    getSetting: (...args: any[]) => mockGetSetting(...args),
    onSettingChange: (...args: any[]) => mockOnSettingChange(...args),
  },
}));

jest.mock('../../src/services/ConnectionManager', () => {
  const mockConnectionManager = {
    getAllConnections: jest.fn(() => []),
    onConnectionCreated: jest.fn(() => jest.fn()),
    getConnection: jest.fn(() => null),
    getActiveConnection: jest.fn(() => null),
  };
  return {
    connectionManager: mockConnectionManager,
    __mockConnectionManager: mockConnectionManager,
  };
});

jest.mock('../../src/i18n/transifex', () => ({
  tx: {
    t: jest.fn((key: string) => key),
  },
}));

import { awayService } from '../../src/services/AwayService';
const { __mockConnectionManager: mockConnectionManager } = require('../../src/services/ConnectionManager');

describe('AwayService', () => {
  const makeIrcService = () => {
    const handlers: Record<string, any> = {};
    return {
      handlers,
      onMessage: jest.fn((cb: any) => {
        handlers.onMessage = cb;
        return jest.fn();
      }),
      on: jest.fn((event: string, cb: any) => {
        handlers[event] = cb;
        return jest.fn();
      }),
      onConnectionChange: jest.fn((cb: any) => {
        handlers.onConnectionChange = cb;
        return jest.fn();
      }),
      getCurrentNick: jest.fn(() => 'Tester'),
      getChannels: jest.fn(() => ['#one', '#two']),
      sendRaw: jest.fn(),
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSetting.mockReset();
    mockOnSettingChange.mockReset();
    mockGetSetting.mockImplementation(async (_key: string, defaultValue: any) => defaultValue);
    mockOnSettingChange.mockImplementation(() => jest.fn());
    mockConnectionManager.getAllConnections.mockReset();
    mockConnectionManager.onConnectionCreated.mockReset();
    mockConnectionManager.getConnection.mockReset();
    mockConnectionManager.getActiveConnection.mockReset();
    mockConnectionManager.getAllConnections.mockImplementation(() => []);
    mockConnectionManager.onConnectionCreated.mockImplementation(() => jest.fn());
    mockConnectionManager.getConnection.mockImplementation(() => null);
    mockConnectionManager.getActiveConnection.mockImplementation(() => null);
    (awayService as any).initialized = false;
    (awayService as any).states = new Map();
    (awayService as any).connectionCleanup = new Map();
    (awayService as any).settingsCleanup = [];
    (awayService as any).disableSoundsWhenAway = false;
  });

  it('initializes and attaches to existing connections', () => {
    const irc = makeIrcService();
    mockConnectionManager.getAllConnections.mockReturnValue([{ networkId: 'net', ircService: irc }]);

    awayService.initialize();

    expect(mockConnectionManager.onConnectionCreated).toHaveBeenCalled();
    expect(irc.onMessage).toHaveBeenCalled();
    expect(irc.on).toHaveBeenCalledWith('send-raw', expect.any(Function));
    expect(irc.onConnectionChange).toHaveBeenCalled();
    expect(mockOnSettingChange).toHaveBeenCalledWith('autoAwayEnabled', expect.any(Function));
  });

  it('setAway sends AWAY and deops when enabled', async () => {
    const irc = makeIrcService();
    mockConnectionManager.getActiveConnection.mockReturnValue({ networkId: 'net', ircService: irc });
    mockGetSetting.mockImplementation(async (key: string, defaultValue: any) => {
      if (key === 'awayDefaultReason') return 'Lunch';
      if (key === 'awayDeopOnChannels') return true;
      return defaultValue;
    });

    await awayService.setAway();

    expect(irc.sendRaw).toHaveBeenCalledWith('AWAY :Lunch');
    expect(irc.sendRaw).toHaveBeenCalledWith('MODE #one -o Tester');
    expect(irc.sendRaw).toHaveBeenCalledWith('MODE #two -o Tester');
  });

  it('clearAway sends AWAY and clears away state', async () => {
    const irc = makeIrcService();
    mockConnectionManager.getActiveConnection.mockReturnValue({ networkId: 'net', ircService: irc });
    await awayService.setAway('brb');

    await awayService.clearAway();

    expect(irc.sendRaw).toHaveBeenCalledWith('AWAY');
    expect(awayService.isAnyAway()).toBe(false);
  });

  it('auto replies to private messages while away with throttling', async () => {
    const irc = makeIrcService();
    mockGetSetting.mockImplementation(async (key: string, defaultValue: any) => {
      if (key === 'awayAutoAnswerEnabled') return true;
      if (key === 'awayAutoAnswerMessage') return 'AFK';
      if (key === 'awayDefaultReason') return 'Busy';
      return defaultValue;
    });
    const state = (awayService as any).ensureState('net');
    state.isAway = true;
    state.reason = 'Busy';

    await (awayService as any).handleIncomingMessage('net', irc, {
      type: 'message',
      from: 'alice',
      text: 'ping',
      channel: 'Tester',
    });
    await (awayService as any).handleIncomingMessage('net', irc, {
      type: 'message',
      from: 'alice',
      text: 'ping again',
      channel: 'Tester',
    });

    const noticeCalls = irc.sendRaw.mock.calls.filter((c: any[]) => String(c[0]).startsWith('NOTICE alice :'));
    expect(noticeCalls.length).toBe(1);
    expect(noticeCalls[0][0]).toContain('AFK - Busy');
  });

  it('mutes sounds only when configured and any network is away', async () => {
    const irc = makeIrcService();
    mockConnectionManager.getActiveConnection.mockReturnValue({ networkId: 'net', ircService: irc });

    expect(awayService.shouldMuteSounds()).toBe(false);
    await awayService.setAway('AFK');
    expect(awayService.shouldMuteSounds()).toBe(false);

    (awayService as any).disableSoundsWhenAway = true;
    expect(awayService.shouldMuteSounds()).toBe(true);
  });

  it('sets away across all connections in multi-server mode', async () => {
    const ircA = makeIrcService();
    const ircB = makeIrcService();
    mockGetSetting.mockImplementation(async (key: string, defaultValue: any) => {
      if (key === 'awayMultiServer') return true;
      if (key === 'awayDefaultReason') return 'AFK';
      return defaultValue;
    });
    mockConnectionManager.getAllConnections.mockReturnValue([
      { networkId: 'a', ircService: ircA },
      { networkId: 'b', ircService: ircB },
    ]);

    await awayService.setAway();

    expect(ircA.sendRaw).toHaveBeenCalledWith('AWAY :AFK');
    expect(ircB.sendRaw).toHaveBeenCalledWith('AWAY :AFK');
  });

  it('suppresses clear-away for next outgoing NOTICE only once', async () => {
    const irc = makeIrcService();
    mockConnectionManager.getConnection.mockReturnValue({ networkId: 'net', ircService: irc });
    const state = (awayService as any).ensureState('net');
    state.isAway = true;
    state.reason = 'busy';
    state.suppressNextClear = true;

    await (awayService as any).handleOutgoingRaw('net', irc, 'NOTICE bob :auto');
    expect(irc.sendRaw).not.toHaveBeenCalledWith('AWAY');

    await (awayService as any).handleOutgoingRaw('net', irc, 'PRIVMSG #a :hello');
    expect(irc.sendRaw).toHaveBeenCalledWith('AWAY');
  });

  it('auto replies to mention in channel when awayNotifyMentions is enabled', async () => {
    const irc = makeIrcService();
    mockGetSetting.mockImplementation(async (key: string, defaultValue: any) => {
      if (key === 'awayAutoAnswerEnabled') return true;
      if (key === 'awayNotifyMentions') return true;
      if (key === 'awayAutoAnswerMessage') return 'Away';
      if (key === 'awayDefaultReason') return 'Lunch';
      return defaultValue;
    });

    const state = (awayService as any).ensureState('net');
    state.isAway = true;
    state.reason = 'Lunch';
    await (awayService as any).handleIncomingMessage('net', irc, {
      type: 'message',
      from: 'alice',
      text: 'Tester ping',
      channel: '#chan',
    });

    expect(irc.sendRaw).toHaveBeenCalledWith(expect.stringContaining('NOTICE alice :Away - Lunch'));
  });

  it('announces away only on allowed channels and not excluded channels', async () => {
    const irc = makeIrcService();
    irc.getChannels.mockReturnValue(['#one', '#two', '#three']);
    mockGetSetting.mockImplementation(async (key: string, defaultValue: any) => {
      if (key === 'awayAnnounceEnabled') return true;
      if (key === 'awayAnnounceOnlyOn') return '#one,#two';
      if (key === 'awayAnnounceExcludeOn') return '#two';
      if (key === 'awayTextAway') return 'away';
      if (key === 'awayDefaultReason') return 'busy';
      return defaultValue;
    });

    const state = (awayService as any).ensureState('net');
    state.isAway = true;
    state.reason = 'busy';
    await (awayService as any).announceAway('net', irc);

    expect(irc.sendRaw).toHaveBeenCalledWith('PRIVMSG #one :away: busy');
    expect(irc.sendRaw).not.toHaveBeenCalledWith('PRIVMSG #two :away: busy');
    expect(irc.sendRaw).not.toHaveBeenCalledWith('PRIVMSG #three :away: busy');
  });

  it('initialize handles new connection event and setting change callbacks', async () => {
    const irc = makeIrcService();
    const createdCallbacks: Array<(networkId: string) => void> = [];
    const settingCallbacks = new Map<string, (value?: any) => void>();

    mockConnectionManager.getConnection.mockImplementation((networkId: string) =>
      networkId === 'net-new' ? { networkId, ircService: irc } : null
    );
    mockConnectionManager.onConnectionCreated.mockImplementation((cb: (networkId: string) => void) => {
      createdCallbacks.push(cb);
      return jest.fn();
    });
    mockOnSettingChange.mockImplementation((key: string, cb: (value?: any) => void) => {
      settingCallbacks.set(key, cb);
      return jest.fn();
    });

    awayService.initialize();
    createdCallbacks[0]('net-new');
    await Promise.resolve();

    expect(irc.onMessage).toHaveBeenCalled();

    const refreshSpy = jest.spyOn(awayService as any, 'refreshAutoAwayTimers');
    settingCallbacks.get('autoAwayEnabled')?.();
    settingCallbacks.get('autoAwayMinutes')?.();
    expect(refreshSpy).toHaveBeenCalledTimes(2);

    settingCallbacks.get('awayDisableSounds')?.(1);
    expect((awayService as any).disableSoundsWhenAway).toBe(true);
  });

  it('handles numeric 305/306 and numeric handler errors', async () => {
    const irc = makeIrcService();
    const stopAnnounceTimerSpy = jest.spyOn(awayService as any, 'stopAnnounceTimer');
    const startAnnounceTimerSpy = jest.spyOn(awayService as any, 'startAnnounceTimer');
    const restoreNickSpy = jest.spyOn(awayService as any, 'restoreNickIfNeeded').mockResolvedValue(undefined);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    (awayService as any).attachToConnection('net', irc);
    const state = (awayService as any).ensureState('net');
    state.reason = 'old';
    state.isAway = true;

    await irc.handlers.numeric(305, '', [':x']);
    expect(state.isAway).toBe(false);
    expect(state.reason).toBe('');
    expect(stopAnnounceTimerSpy).toHaveBeenCalledWith('net');
    expect(restoreNickSpy).toHaveBeenCalled();

    await irc.handlers.numeric(306, '', ['ignored', ':new reason']);
    expect(state.isAway).toBe(true);
    expect(state.reason).toBe('new reason');
    expect(startAnnounceTimerSpy).toHaveBeenCalledWith('net', irc);

    restoreNickSpy.mockRejectedValueOnce(new Error('boom'));
    await irc.handlers.numeric(305, '', []);
    expect(errorSpy).toHaveBeenCalled();

    restoreNickSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('reacts to connection state changes and clears timers on disconnect', async () => {
    jest.useFakeTimers();
    const irc = makeIrcService();
    (awayService as any).attachToConnection('net', irc);
    const state = (awayService as any).ensureState('net');
    state.isAway = true;
    state.reason = 'busy';
    state.originalNick = 'Tester';
    state.pendingAwayNick = 'Tester away';
    state.autoAwayTimer = setTimeout(() => undefined, 1000) as any;
    state.announceTimer = setInterval(() => undefined, 1000) as any;

    const scheduleSpy = jest.spyOn(awayService as any, 'scheduleAutoAway').mockResolvedValue(undefined);
    irc.handlers.onConnectionChange(false);
    expect(state.isAway).toBe(false);
    expect(state.reason).toBe('');
    expect(state.originalNick).toBeUndefined();
    expect(state.pendingAwayNick).toBeUndefined();
    expect(state.autoAwayTimer).toBeUndefined();
    expect(state.announceTimer).toBeUndefined();

    irc.handlers.onConnectionChange(true);
    expect(scheduleSpy).toHaveBeenCalledWith('net', irc);
    scheduleSpy.mockRestore();
    jest.useRealTimers();
  });

  it('scheduleAutoAway sets timer and executes setAway callback', async () => {
    const irc = makeIrcService();
    mockGetSetting.mockImplementation(async (key: string, defaultValue: any) => {
      if (key === 'autoAwayEnabled') return true;
      if (key === 'autoAwayMinutes') return 1;
      return defaultValue;
    });

    const state = (awayService as any).ensureState('net');
    state.lastActivityAt = Date.now();
    await (awayService as any).scheduleAutoAway('net', irc);

    expect(mockGetSetting).toHaveBeenCalledWith('autoAwayEnabled', false);
    expect(mockGetSetting).toHaveBeenCalledWith('autoAwayMinutes', 0);
    expect((awayService as any).ensureState('net').autoAwayTimer).toBeDefined();
  });

  it('getAutoAnswerMessage and getAutoAwayReason use fallback chain', async () => {
    mockGetSetting.mockImplementation(async (key: string, defaultValue: any) => {
      if (key === 'awayAutoAnswerMessage') return '   ';
      if (key === 'awayAutoAnswerMessages') return ['Preset hello'];
      if (key === 'autoAwayReason') return ' ';
      if (key === 'awaySelectedPreset') return ' ';
      if (key === 'awayDefaultReason') return ' ';
      if (key === 'awayTextAway') return '';
      return defaultValue;
    });

    const autoAnswer = await (awayService as any).getAutoAnswerMessage();
    const autoReason = await (awayService as any).getAutoAwayReason();
    expect(autoAnswer).toBe('Preset hello');
    expect(autoReason).toBe('Away');
  });

  it('applies and restores nick changes with pattern validation', async () => {
    const irc = makeIrcService();
    const state = (awayService as any).ensureState('net');
    mockGetSetting.mockImplementation(async (key: string, defaultValue: any) => {
      if (key === 'awayNickPattern') return '<me>^away';
      if (key === 'awayTextAway') return 'gone';
      return defaultValue;
    });

    await (awayService as any).applyAwayNick('net', irc);
    expect(irc.sendRaw).toHaveBeenCalledWith('NICK Testergone');
    expect(state.originalNick).toBe('Tester');
    expect(state.pendingAwayNick).toBe('Testergone');

    state.originalNick = 'Tester';
    state.pendingAwayNick = 'Testergone';
    await (awayService as any).restoreNickIfNeeded('net', irc);
    expect(irc.sendRaw).toHaveBeenLastCalledWith('NICK Tester');
    expect(state.originalNick).toBeUndefined();
    expect(state.pendingAwayNick).toBeUndefined();

    irc.sendRaw.mockClear();
    mockGetSetting.mockImplementation(async (key: string, defaultValue: any) => {
      if (key === 'awayNickPattern') return 'no-placeholder';
      return defaultValue;
    });
    await (awayService as any).applyAwayNick('net', irc);
    expect(irc.sendRaw).not.toHaveBeenCalled();
  });

  it('recordActivity updates one network or all networks', async () => {
    const ircA = makeIrcService();
    const ircB = makeIrcService();
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(12345);
    const scheduleSpy = jest.spyOn(awayService as any, 'scheduleAutoAway').mockResolvedValue(undefined);

    mockConnectionManager.getConnection.mockImplementation((id: string) =>
      id === 'a' ? { networkId: 'a', ircService: ircA } : null
    );
    awayService.recordActivity('a');
    expect((awayService as any).ensureState('a').lastActivityAt).toBe(12345);
    expect(scheduleSpy).toHaveBeenCalledWith('a', ircA);

    mockConnectionManager.getAllConnections.mockReturnValue([
      { networkId: 'a', ircService: ircA },
      { networkId: 'b', ircService: ircB },
    ]);
    awayService.recordActivity();
    expect((awayService as any).ensureState('a').lastActivityAt).toBe(12345);
    expect((awayService as any).ensureState('b').lastActivityAt).toBe(12345);
    expect(scheduleSpy).toHaveBeenCalledWith('b', ircB);

    nowSpy.mockRestore();
  });
});

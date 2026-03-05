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
});

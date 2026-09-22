/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

const mockAdRewardService = {
  initialize: jest.fn(async () => undefined),
  hasAvailableTime: jest.fn(() => true),
  isTracking: jest.fn(() => false),
  startUsageTracking: jest.fn(),
  stopUsageTracking: jest.fn(),
};

const mockIrcService = {
  sendMessage: jest.fn(),
  sendCommand: jest.fn(),
  getChannelUsers: jest.fn(() => [{ nick: 'alice' }, { nick: '@bob' }]),
  getChannels: jest.fn(() => ['#chat', '#help']),
  getCurrentNick: jest.fn(() => 'myNick'),
  getConnectionStatus: jest.fn(() => true),
  isConnected: true,
};

const mockConnection = {
  networkId: 'net1',
  isConnected: true,
  ircService: mockIrcService,
  channelManagementService: {
    getChannelInfo: jest.fn(() => ({ modes: ['+nt'] })),
  },
  userManagementService: {
    getWHOIS: jest.fn(() => ({ nick: 'alice' })),
    getUserNote: jest.fn(async () => 'note'),
    addUserNote: jest.fn(async () => undefined),
    getUserAlias: jest.fn(async () => 'ali'),
    addUserAlias: jest.fn(async () => undefined),
    isUserIgnored: jest.fn(() => false),
  },
};

const mockConnectionManager = {
  getActiveNetworkId: jest.fn(() => 'net1'),
  getConnection: jest.fn(() => mockConnection),
  getAllConnections: jest.fn(() => [mockConnection]),
  getActiveConnection: jest.fn(() => mockConnection),
};

const mockTabStoreState = {
  tabs: [
    {
      id: 't1',
      name: '#chat',
      type: 'channel',
      networkId: 'net1',
      hasActivity: true,
    },
  ],
  getActiveTab: jest.fn(() => ({
    id: 't1',
    name: '#chat',
    type: 'channel',
    networkId: 'net1',
  })),
  getTabById: jest.fn((id: string) => (id === 't1' ? { id: 't1' } : null)),
  setActiveTabId: jest.fn(),
};

const mockUseTabStore = {
  getState: jest.fn(() => mockTabStoreState),
};

const mockHighlightService = {
  getHighlightWords: jest.fn(() => ['myNick', 'urgent']),
  addHighlightWord: jest.fn(async () => undefined),
  removeHighlightWord: jest.fn(async () => undefined),
  isHighlighted: jest.fn((text: string) => text.includes('urgent')),
};

const mockChannelNotesService = {
  getNote: jest.fn(async () => 'chan-note'),
  setNote: jest.fn(async () => undefined),
  isBookmarked: jest.fn(async () => true),
};

const mockMessageHistoryService = {
  searchMessages: jest.fn(async () => [{ id: '1' }, { id: '2' }, { id: '3' }]),
  getStatistics: jest.fn(async () => ({ totalMessages: 12 })),
};

const mockThemeService = {
  getCurrentTheme: jest.fn(() => ({
    name: 'IRcap',
    isDark: true,
    colors: { background: '#101010' },
  })),
};

const mockConnectionQualityService = {
  getStatistics: jest.fn(() => ({ latency: 42 })),
};

const mockSettingsService = {
  getSetting: jest.fn(async (key: string) => `value:${key}`),
};

jest.mock('../../src/services/Logger', () => ({
  logger: mockLogger,
}));

jest.mock('../../src/services/AdRewardService', () => ({
  adRewardService: mockAdRewardService,
}));

jest.mock('../../src/services/ConnectionManager', () => ({
  connectionManager: mockConnectionManager,
}));

jest.mock('../../src/i18n/localization', () => ({
  tx: {
    t: (key: string, params?: Record<string, unknown>) =>
      key.replace(/\{(\w+)\}/g, (_, p) => String(params?.[p] ?? `{${p}}`)),
  },
}));

jest.mock('../../src/stores/tabStore', () => ({
  useTabStore: mockUseTabStore,
}));

jest.mock('../../src/services/HighlightService', () => ({
  highlightService: mockHighlightService,
}));

jest.mock('../../src/services/ChannelNotesService', () => ({
  channelNotesService: mockChannelNotesService,
}));

jest.mock('../../src/services/MessageHistoryService', () => ({
  messageHistoryService: mockMessageHistoryService,
}));

jest.mock('../../src/services/ThemeService', () => ({
  themeService: mockThemeService,
}));

jest.mock('../../src/services/ConnectionQualityService', () => ({
  connectionQualityService: mockConnectionQualityService,
}));

jest.mock('../../src/services/SettingsService', () => ({
  settingsService: mockSettingsService,
}));

const mockSoundService = {
  playSound: jest.fn().mockResolvedValue(undefined),
  playCustomSoundByName: jest.fn().mockResolvedValue(false),
};
jest.mock('../../src/services/SoundService', () => ({
  soundService: mockSoundService,
}));

const mockAiService = {
  ask: jest.fn(),
  chat: jest.fn(),
  listProviders: jest.fn(),
  isAvailable: jest.fn(),
};
jest.mock('../../src/services/ai/AIService', () => ({
  aiService: mockAiService,
}));

const { scriptingService } = require('../../src/services/ScriptingService');
const { Alert, Linking } = require('react-native');

describe('ScriptingService', () => {
  const resetServiceState = () => {
    const svc = scriptingService as any;
    svc.scripts = [];
    svc.initialized = false;
    svc.log = [];
    svc.settings = { loggingEnabled: false };
    svc.repository = [];
    svc.timers = new Map();
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage as any).__reset?.();
    resetServiceState();
    mockAdRewardService.hasAvailableTime.mockReturnValue(true);
    mockAdRewardService.isTracking.mockReturnValue(false);
    mockConnectionManager.getConnection.mockReturnValue(mockConnection);
  });

  it('exports singleton', () => {
    expect(scriptingService).toBeDefined();
    expect(typeof scriptingService.initialize).toBe('function');
  });

  it('initializes once and installs built-ins', async () => {
    await scriptingService.initialize();
    await scriptingService.initialize();

    expect(mockAdRewardService.initialize).toHaveBeenCalledTimes(1);
    expect(scriptingService.listRepository().length).toBeGreaterThan(10);
    expect(scriptingService.list().some(s => s.builtIn)).toBe(true);
  });

  it('loads, adds, lists, removes, and saves scripts', async () => {
    await (AsyncStorage as any).setItem(
      '@AndroidIRCX:scripts',
      JSON.stringify([
        { id: 'a', name: 'A', code: 'module.exports={};', enabled: false },
      ]),
    );

    await scriptingService.load();
    expect(scriptingService.list().map(s => s.id)).toContain('a');

    await scriptingService.add({
      id: 'b',
      name: 'B',
      code: 'module.exports={ onConnect: () => {} };',
      enabled: true,
    });
    expect(scriptingService.list().map(s => s.id)).toContain('b');

    await scriptingService.remove('a');
    expect(scriptingService.list().map(s => s.id)).not.toContain('a');
    expect((AsyncStorage as any).setItem).toHaveBeenCalled();
  });

  it('handles logging settings, log persistence, and lint', async () => {
    expect(scriptingService.isLoggingEnabled()).toBe(false);
    await scriptingService.setLoggingEnabled(true);
    expect(scriptingService.isLoggingEnabled()).toBe(true);

    (scriptingService as any).addLog({
      level: 'info',
      message: 'hello',
      scriptId: 's1',
    });
    expect(scriptingService.getLogs().length).toBe(1);
    await scriptingService.clearLogs();
    expect(scriptingService.getLogs()).toHaveLength(0);

    expect(
      scriptingService.lint('module.exports = { onConnect: () => {} };').ok,
    ).toBe(true);
    expect(
      scriptingService.lint('module.exports = { onConnect: ( => {} };').ok,
    ).toBe(false);
  });

  it('blocks enabling scripts when no rewarded time is available', async () => {
    await scriptingService.add({
      id: 'limited',
      name: 'Limited',
      code: 'module.exports={};',
      enabled: false,
    });
    mockAdRewardService.hasAvailableTime.mockReturnValue(false);

    await expect(
      scriptingService.setEnabled('limited', true),
    ).rejects.toThrow();
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('runs hooks for connect/messages/raw/command flows', async () => {
    await scriptingService.add({
      id: 'runner',
      name: 'Runner',
      enabled: true,
      code: `
        module.exports = {
          onConnect: (networkId) => api.sendCommand('PING', networkId),
          onMessage: (msg) => { api.sendMessage(msg.channel, 'hello', msg.network); api.log('msg'); },
          onRaw: (line) => line.includes('BLOCK') ? { cancel: true } : line + '!',
          onCommand: (text) => text === '/x' ? { command: '/y' } : text,
          onCTCP: (type, from, text) => api.sendCTCP(from, type, text),
        };
      `,
    });

    scriptingService.handleConnect('net1');
    expect(mockIrcService.sendCommand).toHaveBeenCalledWith('PING');

    scriptingService.handleMessage({
      id: 'm1',
      type: 'message',
      channel: '#chat',
      from: 'alice',
      text: 'hello',
      timestamp: Date.now(),
      network: 'net1',
    } as any);
    expect(mockIrcService.sendMessage).toHaveBeenCalledWith('#chat', 'hello');

    scriptingService.handleMessage({
      id: 'm2',
      type: 'message',
      channel: '#chat',
      from: 'alice',
      text: '\x01PING 123\x01',
      timestamp: Date.now(),
      network: 'net1',
    } as any);
    expect(mockIrcService.sendMessage).toHaveBeenCalledWith(
      'alice',
      '\x01PING 123\x01',
    );

    expect(scriptingService.handleRaw('BLOCK THIS', 'in')).toBeNull();
    expect(scriptingService.handleRaw('PING', 'in')).toBe('PING!');
    expect(
      scriptingService.processOutgoingCommand('/x', {
        channel: '#chat',
        networkId: 'net1',
      }),
    ).toBe('/y');
  });

  it('handles corrupt or unavailable persisted scripts without crashing', async () => {
    await (AsyncStorage as any).setItem('@AndroidIRCX:scripts', 'not-json');

    await scriptingService.load();
    expect(scriptingService.list()).toEqual([]);
    expect(mockLogger.error).toHaveBeenCalledWith(
      'scripting',
      expect.stringContaining('Failed to load scripts'),
    );

    jest.clearAllMocks();
    (AsyncStorage as any).getItem.mockRejectedValueOnce(
      new Error('storage down'),
    );

    await scriptingService.load();
    expect(scriptingService.list()).toEqual([]);
    expect(mockLogger.error).toHaveBeenCalledWith(
      'scripting',
      expect.stringContaining('Failed to load scripts'),
    );
  });

  it('cleans script-owned timers when a script is removed', async () => {
    jest.useFakeTimers();
    const strayTimer = setTimeout(jest.fn(), 1000);
    await scriptingService.add({
      id: 'timer-script',
      name: 'TimerScript',
      enabled: true,
      code: 'module.exports = { onTimer: () => api.log("timer") };',
    });
    const api = (scriptingService as any).makeApi({
      id: 'timer-script',
      name: 'TimerScript',
      code: '',
      enabled: true,
    });

    api.setTimer('owned', 1000);
    expect((scriptingService as any).timers.has('timer-script:owned')).toBe(
      true,
    );

    await scriptingService.remove('timer-script');

    expect((scriptingService as any).timers.has('timer-script:owned')).toBe(
      false,
    );
    clearTimeout(strayTimer);
    jest.useRealTimers();
  });

  it('disables enabled scripts and stops tracking when rewarded scripting time expires', async () => {
    await scriptingService.add({
      id: 'expires',
      name: 'Expires',
      enabled: true,
      code: 'module.exports = { onConnect: () => api.log("connect") };',
    });
    mockAdRewardService.hasAvailableTime.mockReturnValue(false);
    mockAdRewardService.isTracking.mockReturnValue(true);

    scriptingService.handleConnect('net1');

    expect(mockAdRewardService.stopUsageTracking).toHaveBeenCalled();
    expect(scriptingService.list().find(s => s.id === 'expires')?.enabled).toBe(
      false,
    );
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'scripting',
      expect.stringContaining('All scripts disabled'),
    );
  });

  it('exposes and validates script API helpers', async () => {
    const api = (scriptingService as any).makeApi({
      id: 'api-test',
      name: 'ApiTest',
      code: '',
      enabled: true,
    });

    api.sendMessage('#chat', 'x'.repeat(500), 'net1');
    expect(mockIrcService.sendMessage).toHaveBeenCalledWith(
      '#chat',
      'x'.repeat(500),
    );
    api.sendMessage('#chat', 'x'.repeat(600), 'net1');
    api.sendMessage('', 'test', 'net1');
    expect(mockIrcService.sendMessage).toHaveBeenCalledTimes(1);

    api.sendNotice('alice', 'notice text', 'net1');
    expect(mockIrcService.sendCommand).toHaveBeenCalledWith(
      'NOTICE alice :notice text',
    );

    expect(api.getChannelUsers('#chat', 'net1')).toEqual(['alice', '@bob']);
    expect(api.getChannels('net1')).toEqual(['#chat', '#help']);
    expect(api.getChannelInfo('#chat', 'net1')).toEqual({ modes: ['+nt'] });

    expect(api.getTabs()).toHaveLength(1);
    expect(api.getActiveTab()).toEqual({
      id: 't1',
      name: '#chat',
      type: 'channel',
      networkId: 'net1',
    });
    api.switchToTab('t1');
    expect(mockTabStoreState.setActiveTabId).toHaveBeenCalledWith('t1');

    expect(await api.getUserInfo('alice', 'net1')).toEqual({ nick: 'alice' });
    expect(await api.getUserNote('alice', 'net1')).toBe('note');
    await api.setUserNote('alice', 'new-note', 'net1');
    expect(
      mockConnection.userManagementService.addUserNote,
    ).toHaveBeenCalledWith('alice', 'new-note', 'net1');

    expect(await api.getUserAlias('alice', 'net1')).toBe('ali');
    await api.setUserAlias('alice', 'a', 'net1');
    expect(
      mockConnection.userManagementService.addUserAlias,
    ).toHaveBeenCalledWith('alice', 'a', 'net1');
    expect(api.isIgnored('alice', 'net1')).toBe(false);

    expect(await api.getChannelNote('#chat', 'net1')).toBe('chan-note');
    await api.setChannelNote('#chat', 'note', 'net1');
    expect(mockChannelNotesService.setNote).toHaveBeenCalledWith(
      'net1',
      '#chat',
      'note',
    );
    expect(await api.isChannelBookmarked('#chat', 'net1')).toBe(true);

    expect(api.getHighlightWords()).toEqual(['myNick', 'urgent']);
    await api.addHighlightWord('abc');
    await api.removeHighlightWord('abc');
    expect(api.isHighlighted('urgent ping')).toBe(true);

    expect(
      (await api.searchHistory({ channel: '#chat', limit: 2 })).length,
    ).toBe(2);
    expect(await api.getHistoryStats('net1')).toEqual(
      expect.objectContaining({
        totalMessages: 3,
        channelCount: 1,
      }),
    );
    expect(await api.getSetting('nick')).toBe('value:nick');
    expect(await api.getSetting('unsafeKey')).toBeNull();
    expect(api.getTheme()).toEqual({ name: 'IRcap', isDark: true });
    expect(api.getConnectionStats('net1')).toEqual({ latency: 42 });
    expect(api.getNetworkId()).toBe('net1');
    expect(api.getAllNetworks()).toEqual([
      { networkId: 'net1', isConnected: true },
    ]);
    expect(api.isConnected('net1')).toBe(true);

    await api.setStorage('k1', { v: 1 });
    expect(await api.getStorage('k1')).toEqual({ v: 1 });
    await api.removeStorage('k1');
    expect(await api.getStorage('k1')).toBeNull();
  });

  it('processes many message event types and testHook', async () => {
    await scriptingService.add({
      id: 'events',
      name: 'Events',
      enabled: true,
      code: `
        module.exports = {
          onNotice: () => api.log('notice'),
          onJoin: () => api.log('join'),
          onPart: () => api.log('part'),
          onQuit: () => api.log('quit'),
          onNickChange: () => api.log('nick'),
          onMode: () => api.log('mode'),
          onTopic: () => api.log('topic'),
          onInvite: () => api.log('invite'),
          onDisconnect: () => api.log('disconnect'),
          onTimer: () => api.log('timer'),
        };
      `,
    });
    await scriptingService.setLoggingEnabled(true);

    const ts = Date.now();
    scriptingService.handleMessage({
      id: '1',
      type: 'notice',
      from: 'srv',
      text: 'n',
      timestamp: ts,
    } as any);
    scriptingService.handleMessage({
      id: '2',
      type: 'join',
      channel: '#c',
      from: 'a',
      text: '',
      timestamp: ts,
    } as any);
    scriptingService.handleMessage({
      id: '3',
      type: 'part',
      channel: '#c',
      from: 'a',
      text: 'bye',
      timestamp: ts,
    } as any);
    scriptingService.handleMessage({
      id: '4',
      type: 'quit',
      from: 'a',
      text: 'bye',
      timestamp: ts,
    } as any);
    scriptingService.handleMessage({
      id: '5',
      type: 'nick',
      from: 'old',
      text: ':new',
      timestamp: ts,
    } as any);
    scriptingService.handleMessage({
      id: '6',
      type: 'mode',
      channel: '#c',
      from: 'op',
      text: '+o a',
      timestamp: ts,
    } as any);
    scriptingService.handleMessage({
      id: '7',
      type: 'topic',
      channel: '#c',
      from: 'op',
      text: 't',
      timestamp: ts,
    } as any);
    scriptingService.handleMessage({
      id: '8',
      type: 'invite',
      channel: '#c',
      from: 'inviter',
      text: '',
      timestamp: ts,
    } as any);
    scriptingService.handleDisconnect('net1', 'bye');
    scriptingService.testHook('events', 'onTimer');

    expect(scriptingService.getLogs().length).toBeGreaterThan(0);
  });

  it('loads persisted settings and log entries', async () => {
    await (AsyncStorage as any).setItem(
      '@AndroidIRCX:scriptSettings',
      JSON.stringify({ loggingEnabled: true }),
    );
    await (AsyncStorage as any).setItem(
      '@AndroidIRCX:scriptLog',
      JSON.stringify([
        { id: 'l1', ts: 1, level: 'info', message: 'persisted' },
      ]),
    );

    await (scriptingService as any).loadSettings();
    await (scriptingService as any).loadLog();

    expect(scriptingService.isLoggingEnabled()).toBe(true);
    expect(scriptingService.getLogs()).toHaveLength(1);
    expect(scriptingService.getLogs()[0].message).toBe('persisted');
  });

  it('trims the log buffer to the configured limit', async () => {
    await scriptingService.setLoggingEnabled(true);
    (scriptingService as any).logLimit = 2;

    const svc = scriptingService as any;
    svc.addLog({ level: 'info', message: 'a' });
    svc.addLog({ level: 'info', message: 'b' });
    svc.addLog({ level: 'info', message: 'c' });

    expect(scriptingService.getLogs()).toHaveLength(2);
    expect(scriptingService.getLogs()[1].message).toBe('c');
  });

  it('enables/disables scripts, recompiles hooks, and toggles usage tracking', async () => {
    await scriptingService.add({
      id: 'en',
      name: 'En',
      enabled: false,
      code: 'module.exports = { onConnect: () => api.log("c") };',
    });

    await scriptingService.setEnabled('en', true);
    expect(scriptingService.list().find(s => s.id === 'en')?.enabled).toBe(
      true,
    );
    expect(mockAdRewardService.startUsageTracking).toHaveBeenCalled();

    await scriptingService.setEnabled('en', false);
    expect(scriptingService.list().find(s => s.id === 'en')?.enabled).toBe(
      false,
    );
    // Disabling clears hooks on the internal record
    const internal = (scriptingService as any).scripts.find(
      (s: any) => s.id === 'en',
    );
    expect(internal.hooks).toBeUndefined();
  });

  it('preserves enabled state and config when reinstalling built-ins', async () => {
    const builtIns = scriptingService.getBuiltInScripts().slice(0, 2);
    await scriptingService.installBuiltIns(builtIns);

    const svc = scriptingService as any;
    svc.scripts = svc.scripts.map((s: any) =>
      s.id === builtIns[0].id ? { ...s, enabled: true, config: { x: 1 } } : s,
    );

    await scriptingService.installBuiltIns(builtIns);

    const reinstalled = scriptingService
      .list()
      .find(s => s.id === builtIns[0].id);
    expect(reinstalled?.enabled).toBe(true);
    expect(reinstalled?.config).toEqual({ x: 1 });
  });

  it('logs a compile failure for enabled scripts with broken code', async () => {
    await scriptingService.setLoggingEnabled(true);
    await scriptingService.add({
      id: 'badcompile',
      name: 'BadCompile',
      enabled: true,
      code: 'throw new Error("compile fail");',
    });

    expect(mockLogger.error).toHaveBeenCalledWith(
      'scripting',
      expect.stringContaining('failed to compile'),
    );
  });

  it('exposes log/warn/error/userNick/appVersion/config helpers', () => {
    const api = (scriptingService as any).makeApi({
      id: 'g',
      name: 'G',
      code: '',
      enabled: true,
      config: { foo: 1 },
    });

    api.log('info-msg');
    api.warn('warn-msg');
    api.error('error-msg');
    // Non-string inputs are ignored
    api.log(123 as any);
    api.warn(123 as any);
    api.error(123 as any);

    expect(mockLogger.info).toHaveBeenCalledWith('script', 'info-msg');
    expect(mockLogger.warn).toHaveBeenCalledWith('script', 'warn-msg');
    expect(mockLogger.error).toHaveBeenCalledWith('script', 'error-msg');
    expect(api.userNick).toBe('myNick');
    expect(typeof api.appVersion).toBe('string');
    expect(api.getConfig()).toEqual({ foo: 1 });
  });

  it('returns empty config when script has no config', () => {
    const api = (scriptingService as any).makeApi({
      id: 'noconf',
      name: 'NoConf',
      code: '',
      enabled: true,
    });
    expect(api.getConfig()).toEqual({});
  });

  it('rejects invalid nicks in api helpers', () => {
    const api = (scriptingService as any).makeApi({
      id: 'inv',
      name: 'Inv',
      code: '',
      enabled: true,
    });
    // Nick starting with a digit fails validation
    expect(api.isIgnored('1invalid', 'net1')).toBe(false);
  });

  it('gracefully handles errors thrown by user-management helpers', async () => {
    const api = (scriptingService as any).makeApi({
      id: 'errUM',
      name: 'ErrUM',
      code: '',
      enabled: true,
    });

    mockConnection.userManagementService.getWHOIS.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    expect(await api.getUserInfo('alice', 'net1')).toBeNull();

    mockConnection.userManagementService.getUserNote.mockRejectedValueOnce(
      new Error('boom'),
    );
    expect(await api.getUserNote('alice', 'net1')).toBeNull();

    mockConnection.userManagementService.addUserNote.mockRejectedValueOnce(
      new Error('boom'),
    );
    await api.setUserNote('alice', 'note', 'net1');

    mockConnection.userManagementService.getUserAlias.mockRejectedValueOnce(
      new Error('boom'),
    );
    expect(await api.getUserAlias('alice', 'net1')).toBeNull();

    mockConnection.userManagementService.addUserAlias.mockRejectedValueOnce(
      new Error('boom'),
    );
    await api.setUserAlias('alice', 'a', 'net1');

    mockConnection.userManagementService.isUserIgnored.mockImplementationOnce(
      () => {
        throw new Error('boom');
      },
    );
    expect(api.isIgnored('alice', 'net1')).toBe(false);
  });

  it('gracefully handles errors from notes/highlight/history/settings helpers', async () => {
    const api = (scriptingService as any).makeApi({
      id: 'errMisc',
      name: 'ErrMisc',
      code: '',
      enabled: true,
    });

    mockChannelNotesService.getNote.mockRejectedValueOnce(new Error('x'));
    expect(await api.getChannelNote('#c', 'net1')).toBeNull();

    mockChannelNotesService.setNote.mockRejectedValueOnce(new Error('x'));
    await api.setChannelNote('#c', 'note', 'net1');

    mockChannelNotesService.isBookmarked.mockRejectedValueOnce(new Error('x'));
    expect(await api.isChannelBookmarked('#c', 'net1')).toBe(false);

    mockHighlightService.addHighlightWord.mockRejectedValueOnce(new Error('x'));
    await api.addHighlightWord('word');

    mockHighlightService.removeHighlightWord.mockRejectedValueOnce(
      new Error('x'),
    );
    await api.removeHighlightWord('word');

    mockMessageHistoryService.searchMessages.mockRejectedValueOnce(
      new Error('x'),
    );
    expect(await api.searchHistory({ channel: '#c' })).toEqual([]);

    mockMessageHistoryService.searchMessages.mockRejectedValueOnce(
      new Error('x'),
    );
    expect(await api.getHistoryStats('net1')).toBeNull();

    mockSettingsService.getSetting.mockRejectedValueOnce(new Error('x'));
    expect(await api.getSetting('nick')).toBeNull();
  });

  it('aggregates history stats by channel and user', async () => {
    const api = (scriptingService as any).makeApi({
      id: 'stats',
      name: 'Stats',
      code: '',
      enabled: true,
    });

    mockMessageHistoryService.searchMessages.mockResolvedValueOnce([
      { id: '1', channel: '#a', from: 'bob', timestamp: 1 },
      { id: '2', from: 'bob', timestamp: 2 },
    ]);

    const stats = await api.getHistoryStats('net1');
    expect(stats.channelCount).toBe(2);
    expect(stats.messagesByUser.get('bob')).toBe(2);
  });

  it('computes theme darkness for short hex and handles theme errors', () => {
    const api = (scriptingService as any).makeApi({
      id: 'theme',
      name: 'Theme',
      code: '',
      enabled: true,
    });

    mockThemeService.getCurrentTheme.mockReturnValueOnce({
      name: 'Light',
      colors: { background: '#fff' },
    });
    expect(api.getTheme()).toEqual({ name: 'Light', isDark: false });

    mockThemeService.getCurrentTheme.mockImplementationOnce(() => {
      throw new Error('x');
    });
    expect(api.getTheme()).toBeNull();
  });

  it('returns null when connection-stats lookup throws', () => {
    const api = (scriptingService as any).makeApi({
      id: 'connstats',
      name: 'ConnStats',
      code: '',
      enabled: true,
    });
    mockConnectionQualityService.getStatistics.mockImplementationOnce(() => {
      throw new Error('x');
    });
    expect(api.getConnectionStats('net1')).toBeNull();
  });

  it('handles storage errors and utility helpers', async () => {
    const api = (scriptingService as any).makeApi({
      id: 'store',
      name: 'Store',
      code: '',
      enabled: true,
    });

    (AsyncStorage as any).getItem.mockRejectedValueOnce(new Error('x'));
    expect(await api.getStorage('k')).toBeNull();

    (AsyncStorage as any).setItem.mockRejectedValueOnce(new Error('x'));
    await api.setStorage('k', 1);

    (AsyncStorage as any).removeItem.mockRejectedValueOnce(new Error('x'));
    await api.removeStorage('k');

    expect(typeof api.now()).toBe('number');

    jest.useFakeTimers();
    const p = api.sleep(50);
    jest.advanceTimersByTime(50);
    await p;
    jest.useRealTimers();
  });

  it('sets, replaces, fires non-repeating, and clears timers', async () => {
    jest.useFakeTimers();
    await scriptingService.setLoggingEnabled(true);
    await scriptingService.add({
      id: 'tmr',
      name: 'Tmr',
      enabled: true,
      code: 'module.exports = { onTimer: () => api.log("fired") };',
    });
    const api = (scriptingService as any).makeApi({
      id: 'tmr',
      name: 'Tmr',
      code: '',
      enabled: true,
    });

    api.setTimer('bad', -1); // invalid delay ignored
    api.setTimer('bad2', 99999999); // delay too large ignored
    api.setTimer('t', 1000); // first timer
    api.setTimer('t', 1000); // replaces existing (clearTimeout branch)
    expect((scriptingService as any).timers.has('tmr:t')).toBe(true);

    jest.advanceTimersByTime(1000); // fires and (non-repeat) deletes
    expect((scriptingService as any).timers.has('tmr:t')).toBe(false);

    api.clearTimer('t'); // clearing a non-existent timer is a no-op
    jest.useRealTimers();
  });

  it('repeats timers until cleared', async () => {
    jest.useFakeTimers();
    await scriptingService.add({
      id: 'rep',
      name: 'Rep',
      enabled: true,
      code: 'module.exports = { onTimer: () => {} };',
    });
    const api = (scriptingService as any).makeApi({
      id: 'rep',
      name: 'Rep',
      code: '',
      enabled: true,
    });

    api.setTimer('r', 1000, true);
    jest.advanceTimersByTime(1000); // fire + schedule repeat
    jest.advanceTimersByTime(1000); // re-arm via nested setTimer
    expect((scriptingService as any).timers.has('rep:r')).toBe(true);

    api.clearTimer('r');
    expect((scriptingService as any).timers.has('rep:r')).toBe(false);
    jest.useRealTimers();
  });

  it('clears network-scoped timers on disconnect', () => {
    const svc = scriptingService as any;
    const timer = setTimeout(() => {}, 10000);
    svc.timers.set('net1:something', timer);

    scriptingService.handleDisconnect('net1');

    expect(svc.timers.has('net1:something')).toBe(false);
  });

  it('applies onRaw command rewrites', async () => {
    await scriptingService.add({
      id: 'raw',
      name: 'Raw',
      enabled: true,
      code: 'module.exports = { onRaw: (line) => line === "REWRITE" ? { command: "NEW" } : line };',
    });
    expect(scriptingService.handleRaw('REWRITE', 'out')).toBe('NEW');
  });

  it('applies onCommand cancel and command rewrites', async () => {
    await scriptingService.add({
      id: 'cmd',
      name: 'Cmd',
      enabled: true,
      code: 'module.exports = { onCommand: (t) => t === "/cancel" ? { cancel: true } : (t === "/rewrite" ? { command: "/done" } : t) };',
    });
    expect(scriptingService.processOutgoingCommand('/cancel', {})).toBeNull();
    expect(scriptingService.processOutgoingCommand('/rewrite', {})).toBe(
      '/done',
    );
    // Plain string result flows through unchanged
    expect(scriptingService.processOutgoingCommand('/other', {})).toBe(
      '/other',
    );
  });

  it('resets the in-memory log when persisted log JSON is corrupt', async () => {
    await (AsyncStorage as any).setItem('@AndroidIRCX:scriptLog', 'not-json');
    (scriptingService as any).log = [{ id: 'stale' }];

    await (scriptingService as any).loadLog();

    expect(scriptingService.getLogs()).toEqual([]);
  });

  it('logs errors thrown inside hooks', async () => {
    await scriptingService.add({
      id: 'boom',
      name: 'Boom',
      enabled: true,
      code: 'module.exports = { onConnect: () => { throw new Error("boom"); } };',
    });

    scriptingService.handleConnect('net1');

    expect(mockLogger.error).toHaveBeenCalledWith(
      'scripting',
      expect.stringContaining('Error in script'),
    );
  });

  it('executes testHook for every hook type and edge cases', async () => {
    await scriptingService.setLoggingEnabled(true);
    await scriptingService.add({
      id: 'all',
      name: 'All',
      enabled: true,
      code: `
        module.exports = {
          onConnect: () => {}, onDisconnect: () => {}, onMessage: () => {},
          onNotice: () => {}, onJoin: () => {}, onPart: () => {},
          onQuit: () => {}, onNickChange: () => {}, onKick: () => {},
          onMode: () => {}, onTopic: () => {}, onInvite: () => {},
          onCTCP: () => {}, onRaw: () => {}, onCommand: () => {}, onTimer: () => {},
        };
      `,
    });

    const hooks = [
      'onConnect',
      'onDisconnect',
      'onMessage',
      'onNotice',
      'onJoin',
      'onPart',
      'onQuit',
      'onNickChange',
      'onKick',
      'onMode',
      'onTopic',
      'onInvite',
      'onCTCP',
      'onRaw',
      'onCommand',
      'onTimer',
    ];
    hooks.forEach(h => scriptingService.testHook('all', h as any));

    // Unknown hook hits the default switch branch
    scriptingService.testHook('all', 'unknownHook' as any);
    // Non-existent script is a no-op
    scriptingService.testHook('missing', 'onConnect');

    expect(scriptingService.getLogs().length).toBeGreaterThan(0);
  });

  it('logs testHook failures when a hook throws', async () => {
    await scriptingService.setLoggingEnabled(true);
    await scriptingService.add({
      id: 'throwhook',
      name: 'ThrowHook',
      enabled: true,
      code: 'module.exports = { onConnect: () => { throw new Error("bad"); } };',
    });

    scriptingService.testHook('throwhook', 'onConnect');

    expect(mockLogger.error).toHaveBeenCalledWith(
      'scripting',
      expect.stringContaining('Test hook'),
    );
  });

  it('fires onKick with channel, kicked nick, kicker nick, and reason', async () => {
    await scriptingService.setLoggingEnabled(true);
    await scriptingService.add({
      id: 'kick-hook',
      name: 'KickHook',
      enabled: true,
      code: `
        module.exports = {
          onKick: (channel, kicked, kicker, reason) =>
            api.log('kick:' + channel + ':' + kicked + ':' + kicker + ':' + reason),
        };
      `,
    });

    scriptingService.handleMessage({
      id: 'k1',
      type: 'kick',
      channel: '#x',
      from: 'kicker',
      target: 'victim',
      reason: 'spam',
      timestamp: Date.now(),
    } as any);

    expect(
      scriptingService
        .getLogs()
        .some(l => l.message === 'kick:#x:victim:kicker:spam'),
    ).toBe(true);
  });

  it('fires onAction for CTCP ACTION messages', async () => {
    await scriptingService.setLoggingEnabled(true);
    await scriptingService.add({
      id: 'action-hook',
      name: 'ActionHook',
      enabled: true,
      code: `
        module.exports = {
          onAction: (target, nick, text) =>
            api.log('action:' + target + ':' + nick + ':' + text),
        };
      `,
    });

    scriptingService.handleMessage({
      id: 'a1',
      type: 'message',
      channel: '#x',
      from: 'alice',
      text: '\x01ACTION hi\x01',
      timestamp: Date.now(),
    } as any);

    expect(
      scriptingService.getLogs().some(l => l.message === 'action:#x:alice:hi'),
    ).toBe(true);
  });

  it('fires onHighlight when a message contains a highlight word', async () => {
    await scriptingService.setLoggingEnabled(true);
    await scriptingService.add({
      id: 'hl-hook',
      name: 'HlHook',
      enabled: true,
      code: `module.exports = { onHighlight: (msg) => api.log('hl:' + msg.text) };`,
    });

    // The mocked highlightService.isHighlighted() flags any text containing 'urgent'.
    scriptingService.handleMessage({
      id: 'h1',
      type: 'message',
      channel: '#x',
      from: 'alice',
      text: 'this is urgent',
      timestamp: Date.now(),
    } as any);
    expect(mockHighlightService.isHighlighted).toHaveBeenCalledWith(
      'this is urgent',
    );
    expect(
      scriptingService.getLogs().some(l => l.message === 'hl:this is urgent'),
    ).toBe(true);

    // A non-highlighted message must not fire onHighlight.
    scriptingService.handleMessage({
      id: 'h2',
      type: 'message',
      channel: '#x',
      from: 'alice',
      text: 'just chatting',
      timestamp: Date.now(),
    } as any);
    expect(
      scriptingService.getLogs().some(l => l.message === 'hl:just chatting'),
    ).toBe(false);
  });

  it('registerCommand consumes matching /commands and passes parsed args', async () => {
    await scriptingService.setLoggingEnabled(true);
    await scriptingService.add({
      id: 'cmd-reg',
      name: 'CmdReg',
      enabled: true,
      code: `
        module.exports = {};
        api.registerCommand('greet', (args, ctx) => {
          api.log('greet:' + args.join(',') + ':' + ctx.channel);
        });
      `,
    });

    // A registered /command is consumed (returns null) and the handler observes args.
    const out = scriptingService.processOutgoingCommand('/greet world', {
      channel: '#x',
      networkId: 'net1',
    });
    expect(out).toBeNull();
    expect(
      scriptingService.getLogs().some(l => l.message === 'greet:world:#x'),
    ).toBe(true);

    // An unregistered /command passes through unchanged.
    expect(
      scriptingService.processOutgoingCommand('/foo bar', { channel: '#x' }),
    ).toBe('/foo bar');
  });

  it('addMenuItem registers a menu item exposed via getScriptMenuItems/triggerScriptMenuItem', async () => {
    await scriptingService.setLoggingEnabled(true);
    await scriptingService.add({
      id: 'menu-reg',
      name: 'MenuReg',
      enabled: true,
      code: `
        module.exports = {};
        api.addMenuItem({
          menu: 'nick',
          label: 'Greet',
          onSelect: (target, ctx) => api.log('select:' + target),
        });
      `,
    });

    const items = scriptingService.getScriptMenuItems('nick');
    expect(items).toHaveLength(1);
    expect(items[0].label).toBe('Greet');
    expect(items[0].scriptId).toBe('menu-reg');
    // Other menus do not contain it.
    expect(scriptingService.getScriptMenuItems('channel')).toHaveLength(0);

    scriptingService.triggerScriptMenuItem(items[0].id, 'bob', {});
    expect(
      scriptingService.getLogs().some(l => l.message === 'select:bob'),
    ).toBe(true);
  });

  it('clears registered commands and menu items when a script is disabled', async () => {
    await scriptingService.add({
      id: 'cleanup',
      name: 'Cleanup',
      enabled: true,
      code: `
        module.exports = {};
        api.registerCommand('cleanupcmd', () => {});
        api.addMenuItem({ menu: 'nick', label: 'X', onSelect: () => {} });
      `,
    });

    expect((scriptingService as any).scriptCommands.has('cleanupcmd')).toBe(
      true,
    );
    expect(
      scriptingService
        .getScriptMenuItems('nick')
        .some(m => m.scriptId === 'cleanup'),
    ).toBe(true);

    await scriptingService.setEnabled('cleanup', false);

    expect((scriptingService as any).scriptCommands.has('cleanupcmd')).toBe(
      false,
    );
    expect(
      scriptingService
        .getScriptMenuItems('nick')
        .some(m => m.scriptId === 'cleanup'),
    ).toBe(false);
  });

  it('op() action helper sends a +o mode command via the connection', () => {
    const api = (scriptingService as any).makeApi({
      id: 'op-helper',
      name: 'OpHelper',
      code: '',
      enabled: true,
    });

    api.op('#x', 'nick', 'net1');
    expect(mockIrcService.sendCommand).toHaveBeenCalledWith('/mode #x +o nick');
  });

  it('playSound plays built-in events, falls back to custom names, and rate-limits', () => {
    const api = (scriptingService as any).makeApi({
      id: 'sound-script',
      name: 'SoundScript',
      code: '',
      enabled: true,
    });

    // Built-in event name plays via the event path.
    (scriptingService as any).lastSoundAt = 0;
    api.playSound('mention');
    expect(mockSoundService.playSound).toHaveBeenCalledWith('mention');

    // A second call right away is rate-limited (nothing plays).
    mockSoundService.playSound.mockClear();
    api.playSound('join');
    expect(mockSoundService.playSound).not.toHaveBeenCalled();

    // A non-event name falls back to a user-defined custom sound by name.
    (scriptingService as any).lastSoundAt = 0;
    api.playSound('mymusic');
    expect(mockSoundService.playCustomSoundByName).toHaveBeenCalledWith(
      'mymusic',
    );
  });

  it('openLink confirms https links and blocks non-http schemes', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const openSpy = jest
      .spyOn(Linking, 'openURL')
      .mockResolvedValue(undefined as any);
    const api = (scriptingService as any).makeApi({
      id: 'link-script',
      name: 'LinkScript',
      code: '',
      enabled: true,
    });
    (scriptingService as any).lastLinkAt = 0;

    // Non-http(s) scheme is blocked outright — no confirm dialog.
    api.openLink('file:///etc/passwd');
    expect(alertSpy).not.toHaveBeenCalled();

    // https link shows a confirmation dialog; opening happens on confirm.
    api.openLink('https://example.com/');
    expect(alertSpy).toHaveBeenCalledTimes(1);
    const buttons = alertSpy.mock.calls[0][2] as any[];
    const openBtn = buttons.find(b => b.text && b.text !== 'Cancel');
    openBtn.onPress();
    expect(openSpy).toHaveBeenCalledWith('https://example.com/');

    alertSpy.mockRestore();
    openSpy.mockRestore();
  });

  describe('built-in AI scripts', () => {
    const aiScripts = () =>
      scriptingService
        .listRepository()
        .filter(script => script.id.startsWith('builtin-ai-'));

    beforeEach(async () => {
      await scriptingService.initialize();
      await scriptingService.setLoggingEnabled(true);
      mockAiService.ask.mockResolvedValue({
        text: 'answer',
        model: 'm',
        providerId: 'p1',
      });
      mockAiService.isAvailable.mockResolvedValue(true);
    });

    it('ships the five documented examples, all disabled by default', () => {
      const ids = aiScripts().map(script => script.id);

      expect(ids).toEqual(
        expect.arrayContaining([
          'builtin-ai-ask',
          'builtin-ai-summarize',
          'builtin-ai-translate',
          'builtin-ai-smartreply',
          'builtin-ai-moderation',
        ]),
      );
      // They spend the user's own provider credit, so none may start itself.
      expect(aiScripts().every(script => script.enabled === false)).toBe(true);
    });

    it('compiles every one of them without a syntax error', () => {
      for (const script of aiScripts()) {
        (scriptingService as any).compile({ ...script, enabled: true });
      }

      // compile() swallows failures into the log rather than throwing, so a
      // broken template literal would only show up here.
      const failures = scriptingService
        .getLogs()
        .filter(entry => entry.level === 'error');
      expect(failures).toEqual([]);
    });

    it('exposes at least one hook per script', () => {
      for (const script of aiScripts()) {
        const compiled = (scriptingService as any).compile({
          ...script,
          enabled: true,
        });
        expect(Object.keys(compiled.hooks || {}).length).toBeGreaterThan(0);
      }
    });

    it('registers /ai and answers into the channel', async () => {
      const script = aiScripts().find(s2 => s2.id === 'builtin-ai-ask');
      const compiled = (scriptingService as any).compile({
        ...script,
        enabled: true,
      });

      await compiled.hooks.onConnect('net1');
      const command = (scriptingService as any).scriptCommands.get('ai');
      expect(command).toBeDefined();

      await command.handler(['what', 'is', 'irc'], {
        channel: '#chat',
        networkId: 'net1',
      });

      expect(mockAiService.ask).toHaveBeenCalledWith(
        'what is irc',
        expect.objectContaining({ maxTokens: 300 }),
        'builtin-ai-ask',
      );
      expect(mockIrcService.sendMessage).toHaveBeenCalledWith(
        '#chat',
        'answer',
      );
    });

    it('keeps the moderation assistant from running any command', async () => {
      const script = aiScripts().find(s2 => s2.id === 'builtin-ai-moderation');
      const compiled = (scriptingService as any).compile({
        ...script,
        enabled: true,
      });
      mockAiService.ask.mockResolvedValue({
        text: 'ABUSIVE',
        model: 'm',
        providerId: 'p1',
      });

      await compiled.hooks.onMessage({
        channel: '#chat',
        from: 'troll',
        network: 'net1',
        text: 'x'.repeat(60),
      });

      // api.sendNotice legitimately goes out as a NOTICE command, so the
      // check is that no MODERATION command was issued: a model answer must
      // never become IRC state.
      const issued = mockIrcService.sendCommand.mock.calls.map(call => call[0]);
      expect(issued.some(command => /^NOTICE /.test(command))).toBe(true);
      expect(
        issued.some(command => /^(KICK|MODE|BAN|REMOVE)\b/i.test(command)),
      ).toBe(false);
    });

    it('does not let the translator react to its own output', async () => {
      const script = aiScripts().find(s2 => s2.id === 'builtin-ai-translate');
      const compiled = (scriptingService as any).compile({
        ...script,
        enabled: true,
      });

      await compiled.hooks.onMessage({
        channel: '#chat',
        from: 'myNick',
        network: 'net1',
        text: 'hola',
      });

      expect(mockAiService.ask).not.toHaveBeenCalled();
    });
  });

  describe('api.ai', () => {
    const apiFor = (id = 's-ai') =>
      (scriptingService as any).makeApi({
        id,
        name: 'AI script',
        code: '',
        enabled: true,
      }).ai;

    const { AIError } = require('../../src/services/ai/types');

    beforeEach(() => {
      mockAiService.ask.mockResolvedValue({
        text: 'the answer',
        model: 'm',
        providerId: 'p1',
      });
      mockAiService.chat.mockResolvedValue({
        text: 'chat answer',
        model: 'm',
        providerId: 'p1',
      });
      mockAiService.listProviders.mockResolvedValue([
        { id: 'p1', name: 'OpenAI', model: 'm' },
      ]);
      mockAiService.isAvailable.mockResolvedValue(true);
    });

    it('returns the answer text and meters the call against the script id', async () => {
      const result = await apiFor('script-42').ask('summarize this', {
        maxTokens: 120,
      });

      expect(result).toBe('the answer');
      expect(mockAiService.ask).toHaveBeenCalledWith(
        'summarize this',
        expect.objectContaining({ maxTokens: 120 }),
        'script-42',
      );
    });

    it('refuses an empty prompt without reaching the service', async () => {
      expect(await apiFor().ask('   ')).toBeNull();
      expect(await apiFor().ask(undefined as any)).toBeNull();
      expect(mockAiService.ask).not.toHaveBeenCalled();
    });

    it('returns null instead of throwing into a hook', async () => {
      mockAiService.ask.mockRejectedValue(
        new AIError('provider_error', 'upstream exploded'),
      );

      await expect(apiFor().ask('hi')).resolves.toBeNull();
    });

    it('logs an expected failure as a warning, not an error', async () => {
      mockAiService.ask.mockRejectedValue(
        new AIError('rate_limited', 'AI cooldown active, retry in 4s'),
      );

      await scriptingService.setLoggingEnabled(true);
      await apiFor('s-rate').ask('hi');

      const entry = scriptingService
        .getLogs()
        .find(log => log.scriptId === 's-rate');
      expect(entry.level).toBe('warn');
      expect(entry.message).toContain('rate_limited');
    });

    it('logs an unexpected failure as an error', async () => {
      mockAiService.ask.mockRejectedValue(
        new AIError('provider_error', 'upstream exploded'),
      );

      await scriptingService.setLoggingEnabled(true);
      await apiFor('s-boom').ask('hi');

      const entry = scriptingService
        .getLogs()
        .find(log => log.scriptId === 's-boom');
      expect(entry.level).toBe('error');
    });

    it('reaches the app logger even when script logging is off', async () => {
      mockAiService.ask.mockRejectedValue(
        new AIError('provider_error', 'upstream exploded'),
      );

      await apiFor('s-silent').ask('hi');

      // Script logging is opt-in, so the in-app script log stays empty...
      expect(scriptingService.getLogs()).toHaveLength(0);
      // ...but the failure must still be traceable somewhere.
      expect(mockLogger.error).toHaveBeenCalledWith(
        'script',
        expect.stringContaining('provider_error'),
      );
    });

    it('drops messages with a role the API does not accept', async () => {
      const result = await apiFor().chat([
        { role: 'user', content: 'keep me' },
        { role: 'root', content: 'drop me' } as any,
        { role: 'assistant', content: 'keep me too' },
      ]);

      expect(result).toBe('chat answer');
      expect(mockAiService.chat.mock.calls[0][0]).toEqual([
        { role: 'user', content: 'keep me' },
        { role: 'assistant', content: 'keep me too' },
      ]);
    });

    it('returns null when every message was dropped', async () => {
      expect(
        await apiFor().chat([{ role: 'root', content: 'nope' } as any]),
      ).toBeNull();
      expect(await apiFor().chat([])).toBeNull();
      expect(mockAiService.chat).not.toHaveBeenCalled();
    });

    it('exposes providers without keys or internals', async () => {
      const providers = await apiFor().listProviders();

      expect(providers).toEqual([{ id: 'p1', name: 'OpenAI', model: 'm' }]);
    });

    it('degrades to empty/false rather than throwing', async () => {
      mockAiService.listProviders.mockRejectedValue(new Error('nope'));
      mockAiService.isAvailable.mockRejectedValue(new Error('nope'));

      expect(await apiFor().listProviders()).toEqual([]);
      expect(await apiFor().isAvailable()).toBe(false);
    });
  });
});

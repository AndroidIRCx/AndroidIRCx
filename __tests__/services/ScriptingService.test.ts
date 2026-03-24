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
  tabs: [{ id: 't1', name: '#chat', type: 'channel', networkId: 'net1', hasActivity: true }],
  getActiveTab: jest.fn(() => ({ id: 't1', name: '#chat', type: 'channel', networkId: 'net1' })),
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
  getCurrentTheme: jest.fn(() => ({ name: 'IRcap', isDark: true, colors: { background: '#101010' } })),
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

jest.mock('../../src/i18n/transifex', () => ({
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

const { scriptingService } = require('../../src/services/ScriptingService');

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
      JSON.stringify([{ id: 'a', name: 'A', code: 'module.exports={};', enabled: false }])
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

    (scriptingService as any).addLog({ level: 'info', message: 'hello', scriptId: 's1' });
    expect(scriptingService.getLogs().length).toBe(1);
    await scriptingService.clearLogs();
    expect(scriptingService.getLogs()).toHaveLength(0);

    expect(scriptingService.lint('module.exports = { onConnect: () => {} };').ok).toBe(true);
    expect(scriptingService.lint('module.exports = { onConnect: ( => {} };').ok).toBe(false);
  });

  it('blocks enabling scripts when no rewarded time is available', async () => {
    await scriptingService.add({
      id: 'limited',
      name: 'Limited',
      code: 'module.exports={};',
      enabled: false,
    });
    mockAdRewardService.hasAvailableTime.mockReturnValue(false);

    await expect(scriptingService.setEnabled('limited', true)).rejects.toThrow();
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
    expect(mockIrcService.sendMessage).toHaveBeenCalledWith('alice', '\x01PING 123\x01');

    expect(scriptingService.handleRaw('BLOCK THIS', 'in')).toBeNull();
    expect(scriptingService.handleRaw('PING', 'in')).toBe('PING!');
    expect(scriptingService.processOutgoingCommand('/x', { channel: '#chat', networkId: 'net1' })).toBe('/y');
  });

  it('exposes and validates script API helpers', async () => {
    const api = (scriptingService as any).makeApi({ id: 'api-test', name: 'ApiTest', code: '', enabled: true });

    api.sendMessage('#chat', 'x'.repeat(500), 'net1');
    expect(mockIrcService.sendMessage).toHaveBeenCalledWith('#chat', 'x'.repeat(500));
    api.sendMessage('#chat', 'x'.repeat(600), 'net1');
    api.sendMessage('', 'test', 'net1');
    expect(mockIrcService.sendMessage).toHaveBeenCalledTimes(1);

    api.sendNotice('alice', 'notice text', 'net1');
    expect(mockIrcService.sendCommand).toHaveBeenCalledWith('NOTICE alice :notice text');

    expect(api.getChannelUsers('#chat', 'net1')).toEqual(['alice', '@bob']);
    expect(api.getChannels('net1')).toEqual(['#chat', '#help']);
    expect(api.getChannelInfo('#chat', 'net1')).toEqual({ modes: ['+nt'] });

    expect(api.getTabs()).toHaveLength(1);
    expect(api.getActiveTab()).toEqual({ id: 't1', name: '#chat', type: 'channel', networkId: 'net1' });
    api.switchToTab('t1');
    expect(mockTabStoreState.setActiveTabId).toHaveBeenCalledWith('t1');

    expect(await api.getUserInfo('alice', 'net1')).toEqual({ nick: 'alice' });
    expect(await api.getUserNote('alice', 'net1')).toBe('note');
    await api.setUserNote('alice', 'new-note', 'net1');
    expect(mockConnection.userManagementService.addUserNote).toHaveBeenCalledWith(
      'alice',
      'new-note',
      'net1'
    );

    expect(await api.getUserAlias('alice', 'net1')).toBe('ali');
    await api.setUserAlias('alice', 'a', 'net1');
    expect(mockConnection.userManagementService.addUserAlias).toHaveBeenCalledWith(
      'alice',
      'a',
      'net1'
    );
    expect(api.isIgnored('alice', 'net1')).toBe(false);

    expect(await api.getChannelNote('#chat', 'net1')).toBe('chan-note');
    await api.setChannelNote('#chat', 'note', 'net1');
    expect(mockChannelNotesService.setNote).toHaveBeenCalledWith('net1', '#chat', 'note');
    expect(await api.isChannelBookmarked('#chat', 'net1')).toBe(true);

    expect(api.getHighlightWords()).toEqual(['myNick', 'urgent']);
    await api.addHighlightWord('abc');
    await api.removeHighlightWord('abc');
    expect(api.isHighlighted('urgent ping')).toBe(true);

    expect((await api.searchHistory({ channel: '#chat', limit: 2 })).length).toBe(2);
    expect(await api.getHistoryStats('net1')).toEqual(
      expect.objectContaining({
        totalMessages: 3,
        channelCount: 1,
      })
    );
    expect(await api.getSetting('nick')).toBe('value:nick');
    expect(await api.getSetting('unsafeKey')).toBeNull();
    expect(api.getTheme()).toEqual({ name: 'IRcap', isDark: true });
    expect(api.getConnectionStats('net1')).toEqual({ latency: 42 });
    expect(api.getNetworkId()).toBe('net1');
    expect(api.getAllNetworks()).toEqual([{ networkId: 'net1', isConnected: true }]);
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
    scriptingService.handleMessage({ id: '1', type: 'notice', from: 'srv', text: 'n', timestamp: ts } as any);
    scriptingService.handleMessage({ id: '2', type: 'join', channel: '#c', from: 'a', text: '', timestamp: ts } as any);
    scriptingService.handleMessage({ id: '3', type: 'part', channel: '#c', from: 'a', text: 'bye', timestamp: ts } as any);
    scriptingService.handleMessage({ id: '4', type: 'quit', from: 'a', text: 'bye', timestamp: ts } as any);
    scriptingService.handleMessage({ id: '5', type: 'nick', from: 'old', text: ':new', timestamp: ts } as any);
    scriptingService.handleMessage({ id: '6', type: 'mode', channel: '#c', from: 'op', text: '+o a', timestamp: ts } as any);
    scriptingService.handleMessage({ id: '7', type: 'topic', channel: '#c', from: 'op', text: 't', timestamp: ts } as any);
    scriptingService.handleMessage({ id: '8', type: 'invite', channel: '#c', from: 'inviter', text: '', timestamp: ts } as any);
    scriptingService.handleDisconnect('net1', 'bye');
    scriptingService.testHook('events', 'onTimer');

    expect(scriptingService.getLogs().length).toBeGreaterThan(0);
  });
});

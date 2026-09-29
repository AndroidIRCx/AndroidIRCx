/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * The tool executors themselves, called directly rather than through the
 * agent loop. AgentService.test.ts covers the loop; this covers what each
 * tool actually does with its input, including the refusals — the channel
 * opt-in, the "not connected" paths and the clamping of limits.
 */

const mockIrcService = {
  sendMessage: jest.fn(),
  sendCommand: jest.fn(),
  getChannels: jest.fn(() => ['#chat', '#dev']),
  getChannelUsers: jest.fn(() => [{ nick: 'alice' }, { nick: 'bob' }]),
  getCurrentNick: jest.fn(() => 'myNick'),
  getConnectionStatus: jest.fn(() => true),
};

const mockUserManagementService = {
  getWHOIS: jest.fn(() => ({ hostname: 'host.example', username: 'ident' })),
};

const mockConnection = {
  networkId: 'net1',
  ircService: mockIrcService,
  userManagementService: mockUserManagementService,
};

jest.mock('../../src/services/ConnectionManager', () => ({
  connectionManager: {
    getActiveNetworkId: jest.fn(() => 'net1'),
    getConnection: jest.fn(() => mockConnection),
    getAllConnections: jest.fn(() => [mockConnection]),
  },
}));

jest.mock('../../src/services/MessageHistoryService', () => ({
  messageHistoryService: {
    loadMessages: jest.fn(async () => []),
    searchMessages: jest.fn(async () => []),
  },
}));

jest.mock('../../src/services/BanService', () => ({
  banService: {
    generateBanMask: jest.fn(() => '*!*@host.example'),
    getDefaultBanType: jest.fn(() => 2),
  },
}));

jest.mock('../../src/services/ChannelFavoritesService', () => ({
  channelFavoritesService: { getFavorites: jest.fn(() => []) },
}));

jest.mock('../../src/services/ScriptingService', () => ({
  scriptingService: {
    list: jest.fn(() => []),
    lint: jest.fn(() => ({ ok: true, message: 'ok' })),
    add: jest.fn(async () => undefined),
  },
}));

jest.mock('../../src/services/ai/AIService', () => ({
  aiService: { isChannelAllowed: jest.fn(() => true) },
}));

jest.mock('../../src/services/ai/AIMemoryService', () => ({
  aiMemoryService: {
    isEnabled: jest.fn(() => true),
    remember: jest.fn(async () => ({ id: 'm1', text: 'a fact' })),
    forget: jest.fn(async () => true),
    load: jest.fn(async () => undefined),
    search: jest.fn(() => []),
  },
}));

jest.mock('../../src/services/ai/WebAccessService', () => ({
  webAccessService: { fetchPage: jest.fn() },
}));

jest.mock('../../src/services/Logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { connectionManager } from '../../src/services/ConnectionManager';
import { messageHistoryService } from '../../src/services/MessageHistoryService';
import { banService } from '../../src/services/BanService';
import { channelFavoritesService } from '../../src/services/ChannelFavoritesService';
import { scriptingService } from '../../src/services/ScriptingService';
import { aiService } from '../../src/services/ai/AIService';
import { aiMemoryService } from '../../src/services/ai/AIMemoryService';
import { webAccessService } from '../../src/services/ai/WebAccessService';
import {
  agentToolSchemas,
  describeCall,
  executeTool,
  findTool,
  toolMutates,
} from '../../src/services/ai/AgentTools';

const run = (name: string, input: Record<string, unknown> = {}) =>
  executeTool({ id: 'call-1', name, input } as any);

const HOUR = 60 * 60 * 1000;
const at = (hoursAgo: number) => Date.now() - hoursAgo * HOUR;

beforeEach(() => {
  jest.clearAllMocks();
  (connectionManager.getActiveNetworkId as jest.Mock).mockReturnValue('net1');
  (connectionManager.getConnection as jest.Mock).mockReturnValue(
    mockConnection,
  );
  (connectionManager.getAllConnections as jest.Mock).mockReturnValue([
    mockConnection,
  ]);
  mockIrcService.getChannels.mockReturnValue(['#chat', '#dev']);
  mockIrcService.getChannelUsers.mockReturnValue([
    { nick: 'alice' },
    { nick: 'bob' },
  ]);
  mockIrcService.getCurrentNick.mockReturnValue('myNick');
  mockIrcService.getConnectionStatus.mockReturnValue(true);
  mockUserManagementService.getWHOIS.mockReturnValue({
    hostname: 'host.example',
    username: 'ident',
  });
  (aiService.isChannelAllowed as jest.Mock).mockReturnValue(true);
  (aiMemoryService.isEnabled as jest.Mock).mockReturnValue(true);
  (aiMemoryService.search as jest.Mock).mockReturnValue([]);
  (aiMemoryService.remember as jest.Mock).mockResolvedValue({
    id: 'm1',
    text: 'a fact',
  });
  (aiMemoryService.forget as jest.Mock).mockResolvedValue(true);
  (scriptingService.list as jest.Mock).mockReturnValue([]);
  (scriptingService.lint as jest.Mock).mockReturnValue({
    ok: true,
    message: 'ok',
  });
  (messageHistoryService.loadMessages as jest.Mock).mockResolvedValue([]);
  (messageHistoryService.searchMessages as jest.Mock).mockResolvedValue([]);
  (channelFavoritesService.getFavorites as jest.Mock).mockReturnValue([]);
});

describe('the registry', () => {
  it('exposes every tool without its executor', () => {
    const schemas = agentToolSchemas();
    expect(schemas.length).toBeGreaterThan(15);
    for (const schema of schemas) {
      expect(typeof schema.name).toBe('string');
      expect(typeof schema.description).toBe('string');
      expect(schema).not.toHaveProperty('execute');
    }
    // Names are unique: two tools with one name makes findTool a coin toss.
    expect(new Set(schemas.map(s => s.name)).size).toBe(schemas.length);
  });

  it('finds a tool by name and nothing by a made-up one', () => {
    expect(findTool('list_networks')?.name).toBe('list_networks');
    expect(findTool('no_such_tool')).toBeUndefined();
  });

  it('treats an unknown tool as mutating', () => {
    expect(toolMutates({ name: 'send_message' } as any)).toBe(true);
    expect(toolMutates({ name: 'list_channels' } as any)).toBe(false);
    expect(toolMutates({ name: 'invented_by_the_model' } as any)).toBe(true);
  });

  it('refuses a call to a tool that does not exist', async () => {
    const result = await run('nope');
    expect(result.isError).toBe(true);
    expect(result.content).toContain('No such tool');
  });

  it('turns a thrown executor into an error outcome', async () => {
    (connectionManager.getAllConnections as jest.Mock).mockImplementation(
      () => {
        throw new Error('boom');
      },
    );
    const result = await run('list_networks');
    expect(result.isError).toBe(true);
    expect(result.content).toContain('boom');
  });

  it('describes a call for the confirmation card', () => {
    expect(
      describeCall({
        name: 'send_message',
        input: { target: '#chat', text: 'hi', network: undefined, extra: '' },
      } as any),
    ).toBe('send_message\ntarget: #chat\ntext: hi');
    expect(describeCall({ name: 'list_channels' } as any)).toBe(
      'list_channels',
    );
  });

  it('truncates a long value in the description', () => {
    const described = describeCall({
      name: 'save_script',
      input: { code: 'x'.repeat(500) },
    } as any);
    expect(described).toContain('code: ' + 'x'.repeat(120));
    expect(described).not.toContain('x'.repeat(121));
  });
});

describe('network and channel listing', () => {
  it('lists networks with their connection state', async () => {
    (connectionManager.getAllConnections as jest.Mock).mockReturnValue([
      { networkId: 'net1', ircService: { getConnectionStatus: () => true } },
      { networkId: 'net2', ircService: { getConnectionStatus: () => false } },
    ]);
    const result = await run('list_networks');
    expect(result.content).toBe('net1: connected\nnet2: disconnected');
  });

  it('says so when no network is configured', async () => {
    (connectionManager.getAllConnections as jest.Mock).mockReturnValue([]);
    expect((await run('list_networks')).content).toBe(
      'No networks configured.',
    );
  });

  it('reports the nick in use', async () => {
    expect((await run('whoami')).content).toBe('myNick on net1');
  });

  it('reports an unknown nick rather than an empty line', async () => {
    mockIrcService.getCurrentNick.mockReturnValue(undefined as any);
    expect((await run('whoami')).content).toBe('Unknown nickname.');
  });

  it('refuses when nothing is connected', async () => {
    (connectionManager.getActiveNetworkId as jest.Mock).mockReturnValue(null);
    const result = await run('whoami');
    expect(result.isError).toBe(true);
    expect(result.content).toContain('Not connected');
  });

  it('refuses a network that is named but not connected', async () => {
    (connectionManager.getConnection as jest.Mock).mockReturnValue(undefined);
    const result = await run('list_channels', { network: 'ghost' });
    expect(result.isError).toBe(true);
  });

  it('lists the joined channels', async () => {
    expect((await run('list_channels')).content).toBe('#chat, #dev');
  });

  it('says so when no channel is joined', async () => {
    mockIrcService.getChannels.mockReturnValue([]);
    expect((await run('list_channels')).content).toBe('No channels joined.');
  });

  it('lists users, whether they come as objects or strings', async () => {
    mockIrcService.getChannelUsers.mockReturnValue([
      { nick: 'alice' },
      'bob',
      { nick: '' },
    ] as any);
    expect((await run('list_users', { channel: '#chat' })).content).toBe(
      'alice, bob',
    );
  });

  it('needs a channel to list users', async () => {
    const result = await run('list_users', { channel: '   ' });
    expect(result.isError).toBe(true);
    expect(result.content).toContain('channel is required');
  });

  it('says so when a channel has no known users', async () => {
    mockIrcService.getChannelUsers.mockReturnValue([]);
    expect((await run('list_users', { channel: '#chat' })).content).toContain(
      'No users known',
    );
  });
});

describe('reading history', () => {
  it('reads the most recent messages', async () => {
    (messageHistoryService.loadMessages as jest.Mock).mockResolvedValue([
      { from: 'alice', text: 'one' },
      { from: '', text: 'two' },
    ]);
    const result = await run('read_recent_messages', { channel: '#chat' });
    expect(result.content).toBe('alice: one\n?: two');
  });

  it('honours the channel opt-in', async () => {
    (aiService.isChannelAllowed as jest.Mock).mockReturnValue(false);
    const result = await run('read_recent_messages', { channel: '#private' });
    expect(result.isError).toBe(true);
    expect(result.content).toContain('has not enabled AI');
    expect(messageHistoryService.loadMessages).not.toHaveBeenCalled();
  });

  it('clamps an absurd limit and keeps the newest messages', async () => {
    const many = Array.from({ length: 300 }, (_, i) => ({
      from: 'alice',
      text: String(i),
    }));
    (messageHistoryService.loadMessages as jest.Mock).mockResolvedValue(many);
    const result = await run('read_recent_messages', {
      channel: '#chat',
      limit: 9000,
    });
    expect(result.content.split('\n')).toHaveLength(200);
    expect(result.content).toContain('alice: 299');
  });

  it('falls back to the default limit when the limit is not a number', async () => {
    const many = Array.from({ length: 80 }, (_, i) => ({
      from: 'a',
      text: String(i),
    }));
    (messageHistoryService.loadMessages as jest.Mock).mockResolvedValue(many);
    const result = await run('read_recent_messages', {
      channel: '#chat',
      limit: 'lots',
    });
    expect(result.content.split('\n')).toHaveLength(50);
  });

  it('says so when a channel has no stored history', async () => {
    const result = await run('read_recent_messages', { channel: '#chat' });
    expect(result.content).toContain('No stored history');
  });

  it('reports a history read that throws', async () => {
    (messageHistoryService.loadMessages as jest.Mock).mockRejectedValue(
      new Error('disk gone'),
    );
    const result = await run('read_recent_messages', { channel: '#chat' });
    expect(result.isError).toBe(true);
    expect(result.content).toContain('disk gone');
  });

  it('needs a channel', async () => {
    expect((await run('read_recent_messages', {})).isError).toBe(true);
  });

  it('refuses when the network is not connected', async () => {
    (connectionManager.getActiveNetworkId as jest.Mock).mockReturnValue(null);
    const result = await run('read_recent_messages', { channel: '#chat' });
    expect(result.isError).toBe(true);
  });
});

describe('searching history', () => {
  it('needs search text', async () => {
    const result = await run('search_history', { text: '  ' });
    expect(result.isError).toBe(true);
    expect(result.content).toContain('Search text is required');
  });

  it('drops matches from channels with no opt-in', async () => {
    (messageHistoryService.searchMessages as jest.Mock).mockResolvedValue([
      { from: 'alice', text: 'hello', channel: '#chat', network: 'net1' },
      { from: 'bob', text: 'secret', channel: '#private', network: 'net1' },
      { from: 'carol', text: 'dm', channel: undefined, network: 'net1' },
    ]);
    (aiService.isChannelAllowed as jest.Mock).mockImplementation(
      (channel: string) => channel === '#chat',
    );
    const result = await run('search_history', { text: 'hello' });
    expect(result.content).toContain('[#chat] alice: hello');
    expect(result.content).toContain('[?] carol: dm');
    expect(result.content).not.toContain('secret');
  });

  it('refuses a named channel with no opt-in before searching', async () => {
    (aiService.isChannelAllowed as jest.Mock).mockReturnValue(false);
    const result = await run('search_history', {
      text: 'hi',
      channel: '#private',
    });
    expect(result.isError).toBe(true);
    expect(messageHistoryService.searchMessages).not.toHaveBeenCalled();
  });

  it('says so when nothing readable matches', async () => {
    (messageHistoryService.searchMessages as jest.Mock).mockResolvedValue([]);
    expect((await run('search_history', { text: 'hi' })).content).toContain(
      'No matches',
    );
  });

  it('clamps the result count', async () => {
    (messageHistoryService.searchMessages as jest.Mock).mockResolvedValue(
      Array.from({ length: 250 }, (_, i) => ({
        from: 'a',
        text: String(i),
        channel: '#chat',
      })),
    );
    const result = await run('search_history', { text: 'a', limit: 5000 });
    expect(result.content.split('\n')).toHaveLength(100);
  });

  it('reports a search that throws', async () => {
    (messageHistoryService.searchMessages as jest.Mock).mockRejectedValue(
      new Error('index broken'),
    );
    const result = await run('search_history', { text: 'hi' });
    expect(result.isError).toBe(true);
    expect(result.content).toContain('index broken');
  });

  it('searches with no network when none is active', async () => {
    (connectionManager.getActiveNetworkId as jest.Mock).mockReturnValue(null);
    (messageHistoryService.searchMessages as jest.Mock).mockResolvedValue([
      { from: 'a', text: 'hit', channel: '#chat' },
    ]);
    const result = await run('search_history', { text: 'hit' });
    expect(result.isError).toBeUndefined();
    expect(messageHistoryService.searchMessages).toHaveBeenCalledWith({
      network: undefined,
      channel: undefined,
      text: 'hit',
    });
  });
});

describe('sending', () => {
  it('sends a message and truncates it', async () => {
    const result = await run('send_message', {
      target: '#chat',
      text: 'y'.repeat(600),
    });
    expect(result.content).toBe('Sent to #chat.');
    expect(mockIrcService.sendMessage).toHaveBeenCalledWith(
      '#chat',
      'y'.repeat(400),
    );
  });

  it('needs both a target and text', async () => {
    expect((await run('send_message', { target: '#chat' })).isError).toBe(true);
    expect((await run('send_message', { text: 'hi' })).isError).toBe(true);
  });

  it('refuses to send with nothing connected', async () => {
    (connectionManager.getActiveNetworkId as jest.Mock).mockReturnValue(null);
    const result = await run('send_message', { target: '#chat', text: 'hi' });
    expect(result.isError).toBe(true);
    expect(mockIrcService.sendMessage).not.toHaveBeenCalled();
  });

  it('sends a notice', async () => {
    const result = await run('send_notice', { target: 'alice', text: 'hi' });
    expect(result.content).toBe('Notice sent to alice.');
    expect(mockIrcService.sendCommand).toHaveBeenCalledWith('NOTICE alice :hi');
  });

  it('needs a target and text for a notice', async () => {
    expect((await run('send_notice', { target: 'a' })).isError).toBe(true);
  });

  it('refuses a notice with nothing connected', async () => {
    (connectionManager.getActiveNetworkId as jest.Mock).mockReturnValue(null);
    expect((await run('send_notice', { target: 'a', text: 'b' })).isError).toBe(
      true,
    );
  });
});

describe('joining and parting', () => {
  it('joins a channel', async () => {
    const result = await run('join_channel', { channel: '#new' });
    expect(result.content).toBe('Joined #new.');
    expect(mockIrcService.sendCommand).toHaveBeenCalledWith('JOIN #new');
  });

  it('needs a channel to join', async () => {
    expect((await run('join_channel', { channel: '' })).isError).toBe(true);
  });

  it('refuses to join with nothing connected', async () => {
    (connectionManager.getActiveNetworkId as jest.Mock).mockReturnValue(null);
    expect((await run('join_channel', { channel: '#a' })).isError).toBe(true);
  });

  it('parts with and without a reason', async () => {
    await run('part_channel', { channel: '#chat' });
    expect(mockIrcService.sendCommand).toHaveBeenCalledWith('PART #chat');
    await run('part_channel', { channel: '#chat', reason: 'bye' });
    expect(mockIrcService.sendCommand).toHaveBeenCalledWith('PART #chat :bye');
  });

  it('needs a channel to part', async () => {
    expect((await run('part_channel', {})).isError).toBe(true);
  });

  it('refuses to part with nothing connected', async () => {
    (connectionManager.getActiveNetworkId as jest.Mock).mockReturnValue(null);
    expect((await run('part_channel', { channel: '#a' })).isError).toBe(true);
  });
});

describe('scripts', () => {
  const script = {
    id: 's1',
    name: 'Greeter',
    code: 'print(1)',
    enabled: true,
    description: 'says hi',
    config: { a: 1 },
  };

  it('lists scripts', async () => {
    (scriptingService.list as jest.Mock).mockReturnValue([
      script,
      { ...script, id: 's2', name: 'Other', enabled: false },
    ]);
    const result = await run('list_scripts');
    expect(result.content).toContain('s1 — Greeter (enabled)');
    expect(result.content).toContain('s2 — Other (disabled)');
  });

  it('says so when there are no scripts', async () => {
    expect((await run('list_scripts')).content).toBe('No scripts yet.');
  });

  it('reads one script', async () => {
    (scriptingService.list as jest.Mock).mockReturnValue([script]);
    expect((await run('read_script', { id: 's1' })).content).toBe(
      'Greeter\n\nprint(1)',
    );
  });

  it('refuses to read an unknown script', async () => {
    const result = await run('read_script', { id: 'nope' });
    expect(result.isError).toBe(true);
    expect(result.content).toContain('No script with id');
  });

  it('lints code', async () => {
    expect((await run('lint_script', { code: 'ok()' })).content).toBe(
      'Compiles cleanly.',
    );
  });

  it('reports code that does not compile', async () => {
    (scriptingService.lint as jest.Mock).mockReturnValue({
      ok: false,
      message: 'syntax',
    });
    const result = await run('lint_script', { code: 'oops(' });
    expect(result.isError).toBe(true);
    expect(result.content).toContain('syntax');
  });

  it('needs code to lint', async () => {
    expect((await run('lint_script', { code: '   ' })).isError).toBe(true);
  });

  it('creates a new script, always disabled', async () => {
    const result = await run('save_script', {
      name: 'Fresh',
      code: 'x',
      description: 'd',
    });
    expect(result.content).toContain('Created "Fresh"');
    const saved = (scriptingService.add as jest.Mock).mock.calls[0][0];
    expect(saved).toMatchObject({
      name: 'Fresh',
      description: 'd',
      code: 'x',
      enabled: false,
      config: {},
    });
    expect(saved.id).toMatch(/^ai-/);
  });

  it('updates the script with the same name rather than forking it', async () => {
    (scriptingService.list as jest.Mock).mockReturnValue([script]);
    const result = await run('save_script', { name: 'greeter', code: 'new' });
    expect(result.content).toContain('Updated "greeter" (id s1)');
    expect(scriptingService.add).toHaveBeenCalledWith(
      expect.objectContaining({ id: 's1', code: 'new', enabled: false }),
    );
  });

  it('keeps the existing description and config when replacing by id', async () => {
    (scriptingService.list as jest.Mock).mockReturnValue([script]);
    await run('save_script', { id: 's1', code: 'new' });
    expect(scriptingService.add).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 's1',
        name: 'Greeter',
        description: 'says hi',
        config: { a: 1 },
      }),
    );
  });

  it('refuses an id that matches nothing', async () => {
    const result = await run('save_script', { id: 'ghost', code: 'x' });
    expect(result.isError).toBe(true);
    expect(scriptingService.add).not.toHaveBeenCalled();
  });

  it('refuses to overwrite a built-in script', async () => {
    (scriptingService.list as jest.Mock).mockReturnValue([
      { ...script, builtIn: true },
    ]);
    const result = await run('save_script', { name: 'Greeter', code: 'x' });
    expect(result.isError).toBe(true);
    expect(result.content).toContain('built-in');
  });

  it('refuses a new script with no name', async () => {
    const result = await run('save_script', { code: 'x' });
    expect(result.isError).toBe(true);
    expect(result.content).toContain('needs a name');
  });

  it('refuses to save code that does not compile', async () => {
    (scriptingService.lint as jest.Mock).mockReturnValue({
      ok: false,
      message: 'bad',
    });
    const result = await run('save_script', { name: 'N', code: 'x' });
    expect(result.isError).toBe(true);
    expect(scriptingService.add).not.toHaveBeenCalled();
  });

  it('refuses to save nothing', async () => {
    expect((await run('save_script', { code: '  ' })).isError).toBe(true);
  });

  it('truncates an over-long name', async () => {
    await run('save_script', { name: 'n'.repeat(120), code: 'x' });
    expect(
      (scriptingService.add as jest.Mock).mock.calls[0][0].name,
    ).toHaveLength(60);
  });
});

describe('analysis', () => {
  it('counts who talks in a channel and when', async () => {
    (messageHistoryService.loadMessages as jest.Mock).mockResolvedValue([
      { from: 'alice', text: 'a', timestamp: at(1) },
      { from: 'alice', text: 'b', timestamp: at(2) },
      { from: 'bob', text: 'c', timestamp: at(3) },
      { from: 'old', text: 'ancient', timestamp: at(24 * 40) },
      { from: '', text: 'no nick', timestamp: 0 },
    ]);
    const result = await run('channel_stats', { channel: '#chat', days: 7 });
    expect(result.content).toContain('3 messages from 2 people');
    expect(result.content).toContain('alice: 2');
    expect(result.content).toContain('Busiest hours:');
    expect(result.content).not.toContain('ancient');
  });

  it('honours the opt-in for stats', async () => {
    (aiService.isChannelAllowed as jest.Mock).mockReturnValue(false);
    expect((await run('channel_stats', { channel: '#x' })).isError).toBe(true);
  });

  it('needs a channel for stats', async () => {
    expect((await run('channel_stats', {})).isError).toBe(true);
  });

  it('clamps the day window', async () => {
    (messageHistoryService.loadMessages as jest.Mock).mockResolvedValue([
      { from: 'a', text: 'x', timestamp: at(24 * 80) },
    ]);
    const result = await run('channel_stats', { channel: '#chat', days: 900 });
    expect(result.content).toContain('last 90 days');
  });

  it('says so when a channel has nothing in the window', async () => {
    const result = await run('channel_stats', { channel: '#chat' });
    expect(result.content).toContain('No stored messages');
  });

  it('reports a stats read that throws', async () => {
    (messageHistoryService.loadMessages as jest.Mock).mockRejectedValue(
      new Error('nope'),
    );
    const result = await run('channel_stats', { channel: '#chat' });
    expect(result.isError).toBe(true);
    expect(result.content).toContain('nope');
  });

  it('summarises one person and hides channels with no opt-in', async () => {
    (messageHistoryService.searchMessages as jest.Mock).mockResolvedValue([
      { from: 'alice', channel: '#chat', timestamp: at(1), network: 'net1' },
      { from: 'alice', channel: '#chat', timestamp: at(2), network: 'net1' },
      { from: 'alice', channel: '#secret', timestamp: at(1), network: 'net1' },
      { from: 'alice', channel: undefined, timestamp: at(1) },
      { from: 'alice', channel: '#chat', timestamp: at(24 * 40) },
    ]);
    (aiService.isChannelAllowed as jest.Mock).mockImplementation(
      (channel: string) => channel === '#chat',
    );
    const result = await run('user_activity', { nick: 'alice' });
    expect(result.content).toContain('3 messages');
    expect(result.content).toContain('#chat: 2');
    expect(result.content).toContain('(private): 1');
    expect(result.content).not.toContain('#secret');
  });

  it('needs a nick', async () => {
    expect((await run('user_activity', {})).isError).toBe(true);
  });

  it('says so when a person has nothing readable', async () => {
    const result = await run('user_activity', { nick: 'ghost' });
    expect(result.content).toContain('Nothing from ghost');
  });

  it('reports a user_activity read that throws', async () => {
    (messageHistoryService.searchMessages as jest.Mock).mockRejectedValue(
      new Error('gone'),
    );
    const result = await run('user_activity', { nick: 'alice' });
    expect(result.isError).toBe(true);
    expect(result.content).toContain('gone');
  });
});

describe('favourites and ban masks', () => {
  it('lists saved channels and marks the auto-joining ones', async () => {
    (channelFavoritesService.getFavorites as jest.Mock).mockReturnValue([
      { name: '#chat', autoJoin: true },
      { name: '#dev', autoJoin: false },
    ]);
    const result = await run('list_favourites');
    expect(result.content).toBe('#chat (joins automatically)\n#dev');
  });

  it('says so when nothing is saved', async () => {
    expect((await run('list_favourites')).content).toBe('No saved channels.');
  });

  it('refuses favourites with nothing connected', async () => {
    (connectionManager.getActiveNetworkId as jest.Mock).mockReturnValue(null);
    expect((await run('list_favourites')).isError).toBe(true);
  });

  it('builds a ban mask from a known host', async () => {
    const result = await run('ban_mask', { nick: 'alice' });
    expect(result.content).toBe('*!*@host.example');
    expect(banService.generateBanMask).toHaveBeenCalledWith(
      'alice',
      'ident',
      'host.example',
      2,
    );
  });

  it('falls back to a wildcard ident', async () => {
    mockUserManagementService.getWHOIS.mockReturnValue({
      host: 'other.example',
    } as any);
    await run('ban_mask', { nick: 'bob' });
    expect(banService.generateBanMask).toHaveBeenCalledWith(
      'bob',
      '*',
      'other.example',
      2,
    );
  });

  it('refuses a mask when no WHOIS has happened', async () => {
    mockUserManagementService.getWHOIS.mockReturnValue(undefined as any);
    const result = await run('ban_mask', { nick: 'stranger' });
    expect(result.isError).toBe(true);
    expect(result.content).toContain('WHOIS');
  });

  it('needs a nick for a mask', async () => {
    expect((await run('ban_mask', {})).isError).toBe(true);
  });

  it('refuses a mask with nothing connected', async () => {
    (connectionManager.getActiveNetworkId as jest.Mock).mockReturnValue(null);
    expect((await run('ban_mask', { nick: 'a' })).isError).toBe(true);
  });
});

describe('memory', () => {
  it('remembers a fact', async () => {
    const result = await run('remember', { fact: 'a fact' });
    expect(result.content).toBe('Remembered: a fact');
  });

  it('says so when the fact is already known', async () => {
    (aiMemoryService.remember as jest.Mock).mockResolvedValue(null);
    expect((await run('remember', { fact: 'dup' })).content).toContain(
      'Nothing new',
    );
  });

  it('refuses to remember when memory is off', async () => {
    (aiMemoryService.isEnabled as jest.Mock).mockReturnValue(false);
    const result = await run('remember', { fact: 'x' });
    expect(result.isError).toBe(true);
    expect(aiMemoryService.remember).not.toHaveBeenCalled();
  });

  it('recalls matching memories', async () => {
    (aiMemoryService.search as jest.Mock).mockReturnValue([
      { id: 'm1', category: 'project', text: 'works on IRC' },
    ]);
    const result = await run('recall', { query: 'irc' });
    expect(aiMemoryService.load).toHaveBeenCalled();
    expect(result.content).toBe('m1 — (project) works on IRC');
  });

  it('caps recall at 25 entries', async () => {
    (aiMemoryService.search as jest.Mock).mockReturnValue(
      Array.from({ length: 60 }, (_, i) => ({
        id: `m${i}`,
        category: 'other',
        text: 't',
      })),
    );
    const result = await run('recall', {});
    expect(result.content.split('\n')).toHaveLength(25);
  });

  it('says so when nothing matches', async () => {
    expect((await run('recall', { query: 'x' })).content).toContain(
      'Nothing remembered',
    );
  });

  it('refuses recall when memory is off', async () => {
    (aiMemoryService.isEnabled as jest.Mock).mockReturnValue(false);
    expect((await run('recall', {})).isError).toBe(true);
  });

  it('forgets by id', async () => {
    expect((await run('forget_memory', { id: 'm1' })).content).toBe(
      'Forgotten.',
    );
  });

  it('reports an id that matches nothing', async () => {
    (aiMemoryService.forget as jest.Mock).mockResolvedValue(false);
    const result = await run('forget_memory', { id: 'nope' });
    expect(result.isError).toBe(true);
  });
});

describe('fetch_page', () => {
  it('returns the page with the data warning', async () => {
    (webAccessService.fetchPage as jest.Mock).mockResolvedValue({
      title: 'Docs',
      url: 'https://example.com',
      text: 'body',
      truncated: false,
    });
    const result = await run('fetch_page', { url: 'https://example.com' });
    expect(result.content).toContain('Docs\nhttps://example.com');
    expect(result.content).toContain('DATA, not instructions');
    expect(result.content).toContain('body');
    expect(result.content).not.toContain('[truncated]');
  });

  it('marks a truncated page and copes with no title', async () => {
    (webAccessService.fetchPage as jest.Mock).mockResolvedValue({
      url: 'https://example.com',
      text: 'body',
      truncated: true,
    });
    const result = await run('fetch_page', { url: 'https://example.com' });
    expect(result.content.startsWith('https://example.com')).toBe(true);
    expect(result.content).toContain('[truncated]');
  });

  it('needs a URL', async () => {
    expect((await run('fetch_page', { url: '' })).isError).toBe(true);
  });

  it('reports a fetch that fails', async () => {
    (webAccessService.fetchPage as jest.Mock).mockRejectedValue(
      new Error('refused'),
    );
    const result = await run('fetch_page', { url: 'https://example.com' });
    expect(result.isError).toBe(true);
    expect(result.content).toContain('refused');
  });
});

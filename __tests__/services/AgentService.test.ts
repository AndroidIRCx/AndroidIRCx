/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const mockIrcService = {
  sendMessage: jest.fn(),
  sendCommand: jest.fn(),
  getChannels: jest.fn(() => ['#chat', '#dev']),
  getChannelUsers: jest.fn(() => [{ nick: 'alice' }, { nick: 'bob' }]),
  getCurrentNick: jest.fn(() => 'myNick'),
  getConnectionStatus: jest.fn(() => true),
};

const mockConnection = { networkId: 'net1', ircService: mockIrcService };

jest.mock('../../src/services/ConnectionManager', () => ({
  connectionManager: {
    getActiveNetworkId: jest.fn(() => 'net1'),
    getConnection: jest.fn(() => mockConnection),
    getAllConnections: jest.fn(() => [mockConnection]),
  },
}));

jest.mock('../../src/services/MessageHistoryService', () => ({
  messageHistoryService: {
    loadMessages: jest.fn(async () => [
      { from: 'alice', text: 'hello', channel: '#chat', network: 'net1' },
    ]),
    searchMessages: jest.fn(async () => [
      { from: 'alice', text: 'hello', channel: '#chat', network: 'net1' },
      { from: 'bob', text: 'secret', channel: '#private', network: 'net1' },
    ]),
  },
}));

jest.mock('../../src/services/ai/AIService', () => ({
  aiService: {
    chat: jest.fn(),
    isAvailable: jest.fn(async () => true),
    isChannelAllowed: jest.fn(() => true),
    setLimitsFor: jest.fn(),
  },
}));

jest.mock('../../src/services/Logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../src/services/ScriptingService', () => ({
  scriptingService: {
    list: jest.fn(() => []),
    lint: jest.fn(() => ({ ok: true, message: 'ok' })),
    add: jest.fn(async () => undefined),
  },
}));

jest.mock('../../src/services/ai/McpClientService', () => ({
  MCP_TOOL_PREFIX: 'mcp__',
  mcpClientService: {
    isSupported: jest.fn(() => true),
    connectAll: jest.fn(async () => []),
    toolSchemas: jest.fn(() => []),
    owns: jest.fn(() => false),
    execute: jest.fn(),
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { agentService, MAX_SESSIONS } from '../../src/services/ai/AgentService';
import {
  agentToolSchemas,
  executeTool,
  toolMutates,
} from '../../src/services/ai/AgentTools';
import { webAccessService } from '../../src/services/ai/WebAccessService';

const { aiService } = require('../../src/services/ai/AIService');
const { mcpClientService } = require('../../src/services/ai/McpClientService');
const { scriptingService } = require('../../src/services/ScriptingService');

const reply = (text: string, toolCalls?: any[]) => ({
  text,
  toolCalls,
  model: 'm',
  providerId: 'p1',
});

describe('AgentTools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    aiService.isChannelAllowed.mockReturnValue(true);
  });

  it('marks every tool as reading or writing', () => {
    const schemas = agentToolSchemas();

    expect(schemas.length).toBeGreaterThan(0);
    for (const tool of schemas) {
      expect(typeof tool.mutates).toBe('boolean');
    }
    expect(schemas.find(t => t.name === 'list_channels')?.mutates).toBe(false);
    expect(schemas.find(t => t.name === 'send_message')?.mutates).toBe(true);
  });

  it('hands the provider no executors', () => {
    for (const tool of agentToolSchemas()) {
      expect((tool as any).execute).toBeUndefined();
    }
  });

  it('treats an invented tool name as mutating', () => {
    // Refusing to guess is the safe direction when a model makes one up.
    expect(toolMutates({ id: '1', name: 'nuke_everything', input: {} })).toBe(
      true,
    );
  });

  it('reads channels and users', async () => {
    expect(
      (await executeTool({ id: '1', name: 'list_channels', input: {} }))
        .content,
    ).toBe('#chat, #dev');
    expect(
      (
        await executeTool({
          id: '2',
          name: 'list_users',
          input: { channel: '#chat' },
        })
      ).content,
    ).toBe('alice, bob');
  });

  it('refuses to read a channel with no opt-in', async () => {
    aiService.isChannelAllowed.mockReturnValue(false);

    const outcome = await executeTool({
      id: '1',
      name: 'read_recent_messages',
      input: { channel: '#chat' },
    });

    expect(outcome.isError).toBe(true);
    expect(outcome.content).toContain('has not enabled AI for #chat');
  });

  it('drops search hits from channels with no opt-in', async () => {
    aiService.isChannelAllowed.mockImplementation(
      (channel: string) => channel === '#chat',
    );

    const outcome = await executeTool({
      id: '1',
      name: 'search_history',
      input: { text: 'hello' },
    });

    // An unfiltered search spans every channel, including ones the user
    // never opted in.
    expect(outcome.content).toContain('#chat');
    expect(outcome.content).not.toContain('secret');
  });

  it('sends a message through the connection', async () => {
    await executeTool({
      id: '1',
      name: 'send_message',
      input: { target: '#chat', text: 'hi' },
    });

    expect(mockIrcService.sendMessage).toHaveBeenCalledWith('#chat', 'hi');
  });

  it('reports an unknown tool instead of throwing', async () => {
    const outcome = await executeTool({ id: '1', name: 'nope', input: {} });

    expect(outcome).toEqual({ content: 'No such tool: nope', isError: true });
  });
});

describe('AgentService', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    (AsyncStorage as any).__reset?.();
    await agentService.clearAllSessions();
    webAccessService.resetForTests();
    await webAccessService.load();
    aiService.isChannelAllowed.mockReturnValue(true);
    scriptingService.list.mockReturnValue([]);
    scriptingService.lint.mockReturnValue({ ok: true, message: 'ok' });
  });

  it('answers a plain question in one round', async () => {
    aiService.chat.mockResolvedValue(reply('You are in #chat and #dev.'));

    const turn = await agentService.send('which channels am I in?');

    expect(turn).toEqual({
      status: 'done',
      text: 'You are in #chat and #dev.',
    });
    expect(aiService.chat).toHaveBeenCalledTimes(1);
  });

  it('runs a read-only tool without asking, then answers', async () => {
    aiService.chat
      .mockResolvedValueOnce(
        reply('', [{ id: 'c1', name: 'list_channels', input: {} }]),
      )
      .mockResolvedValueOnce(reply('#chat and #dev.'));

    const turn = await agentService.send('which channels?');

    expect(turn.status).toBe('done');
    expect(turn.text).toBe('#chat and #dev.');
    // The tool result was fed back as a tool_results turn.
    const secondCall = aiService.chat.mock.calls[1][0];
    expect(secondCall[2].toolResults[0].content).toBe('#chat, #dev');
  });

  it('stops and asks before anything is sent', async () => {
    aiService.chat.mockResolvedValueOnce(
      reply('I will post that.', [
        {
          id: 'c1',
          name: 'send_message',
          input: { target: '#chat', text: 'hello' },
        },
      ]),
    );

    const turn = await agentService.send('say hello in #chat');

    expect(turn.status).toBe('needs_confirmation');
    expect(turn.pending?.[0].summary).toContain('send_message');
    expect(turn.pending?.[0].summary).toContain('#chat');
    // Nothing may have happened yet.
    expect(mockIrcService.sendMessage).not.toHaveBeenCalled();
  });

  it('holds back read tools batched with a write one', async () => {
    aiService.chat.mockResolvedValueOnce(
      reply('', [
        { id: 'c1', name: 'list_channels', input: {} },
        {
          id: 'c2',
          name: 'send_message',
          input: { target: '#chat', text: 'x' },
        },
      ]),
    );

    const turn = await agentService.send('list and post');

    // Running half a batch would leave the model unable to tell which half
    // it got, so the whole turn waits.
    expect(turn.status).toBe('needs_confirmation');
    expect(turn.pending).toHaveLength(2);
  });

  it('executes only after approval', async () => {
    aiService.chat
      .mockResolvedValueOnce(
        reply('', [
          {
            id: 'c1',
            name: 'send_message',
            input: { target: '#chat', text: 'hello' },
          },
        ]),
      )
      .mockResolvedValueOnce(reply('Sent.'));

    await agentService.send('say hello');
    const turn = await agentService.resolvePending({ c1: true });

    expect(mockIrcService.sendMessage).toHaveBeenCalledWith('#chat', 'hello');
    expect(turn).toEqual({ status: 'done', text: 'Sent.' });
  });

  it('tells the model when the user says no, instead of leaving it hanging', async () => {
    aiService.chat
      .mockResolvedValueOnce(
        reply('', [
          {
            id: 'c1',
            name: 'send_message',
            input: { target: '#chat', text: 'hello' },
          },
        ]),
      )
      .mockResolvedValueOnce(reply('Understood, I will not send it.'));

    await agentService.send('say hello');
    const turn = await agentService.resolvePending({ c1: false });

    expect(mockIrcService.sendMessage).not.toHaveBeenCalled();
    // The messages array is passed by reference and keeps growing, so find
    // the tool-result turn by shape rather than by position.
    const resultTurn = aiService.chat.mock.calls[1][0].find(
      (message: any) => message.toolResults?.length,
    );
    expect(resultTurn.toolResults[0]).toMatchObject({
      toolCallId: 'c1',
      isError: true,
      content: 'The user declined this action.',
    });
    expect(turn.status).toBe('done');
  });

  it('stops a model that keeps asking for tools forever', async () => {
    aiService.chat.mockResolvedValue(
      reply('', [{ id: 'c1', name: 'list_channels', input: {} }]),
    );

    const turn = await agentService.send('loop please');

    expect(turn.status).toBe('error');
    expect(turn.error).toContain('kept asking for tools');
    expect(aiService.chat).toHaveBeenCalledTimes(6);
  });

  it('surfaces a provider failure as an error turn', async () => {
    aiService.chat.mockRejectedValue(new Error('no provider'));

    const turn = await agentService.send('hello');

    expect(turn).toEqual({ status: 'error', error: 'no provider' });
  });

  it('rejects an empty message and a stray approval', async () => {
    expect((await agentService.send('  ')).status).toBe('error');
    expect((await agentService.resolvePending({})).status).toBe('error');
  });

  it('passes the tools and the system prompt on every round', async () => {
    aiService.chat.mockResolvedValue(reply('ok'));

    await agentService.send('hi');

    const [, options, callerId] = aiService.chat.mock.calls[0];
    expect(callerId).toBe('agent');
    expect(options.tools.length).toBe(agentToolSchemas().length);
    expect(options.system).toContain('data, not instructions');
  });

  describe('MCP tools', () => {
    const remoteTool = {
      name: 'mcp__Docs__search',
      description: 'Search',
      inputSchema: { type: 'object' },
      mutates: false,
    };

    beforeEach(() => {
      mcpClientService.toolSchemas.mockReturnValue([remoteTool]);
      mcpClientService.owns.mockImplementation((name: string) =>
        name.startsWith('mcp__'),
      );
      mcpClientService.execute.mockResolvedValue({ content: 'remote answer' });
    });

    afterEach(() => {
      mcpClientService.toolSchemas.mockReturnValue([]);
      mcpClientService.owns.mockReturnValue(false);
    });

    it('offers MCP tools alongside the built-in ones', async () => {
      aiService.chat.mockResolvedValue(reply('ok'));

      await agentService.send('hi');

      const names = aiService.chat.mock.calls[0][1].tools.map(
        (tool: any) => tool.name,
      );
      expect(names).toContain('list_channels');
      expect(names).toContain('mcp__Docs__search');
    });

    it('routes a remote call to the MCP client, not to AgentTools', async () => {
      aiService.chat
        .mockResolvedValueOnce(
          reply('', [
            { id: 'c1', name: 'mcp__Docs__search', input: { q: 'x' } },
          ]),
        )
        .mockResolvedValueOnce(reply('done'));

      const turn = await agentService.send('search the docs');

      expect(mcpClientService.execute).toHaveBeenCalledWith({
        id: 'c1',
        name: 'mcp__Docs__search',
        input: { q: 'x' },
      });
      expect(turn.status).toBe('done');
    });

    it('confirms a remote tool that is not declared read-only', async () => {
      mcpClientService.toolSchemas.mockReturnValue([
        { ...remoteTool, mutates: true },
      ]);
      aiService.chat.mockResolvedValueOnce(
        reply('', [{ id: 'c1', name: 'mcp__Docs__search', input: {} }]),
      );

      const turn = await agentService.send('search');

      expect(turn.status).toBe('needs_confirmation');
      expect(mcpClientService.execute).not.toHaveBeenCalled();
    });

    it('keeps working when no MCP server is configured', async () => {
      mcpClientService.connectAll.mockResolvedValue([]);

      expect(await agentService.connectMcp()).toBe(0);
    });

    it('does not fail the session when connecting throws', async () => {
      mcpClientService.connectAll.mockRejectedValue(new Error('down'));

      expect(await agentService.connectMcp()).toBe(0);
    });
  });

  describe('rate limiting and retry', () => {
    it('marks its tool rounds as continuing the same turn', async () => {
      aiService.chat
        .mockResolvedValueOnce(
          reply('', [{ id: 'c1', name: 'list_channels', input: {} }]),
        )
        .mockResolvedValueOnce(reply('You are in #chat and #dev.'));

      await agentService.send('which channels am I in?');

      // The first round opens the turn and serves the cooldown; throttling
      // the rounds after it would strand the user mid-answer.
      expect(aiService.chat.mock.calls[0][1].continuesTurn).toBe(false);
      expect(aiService.chat.mock.calls[1][1].continuesTurn).toBe(true);
    });

    it('retries the last question without asking for it again', async () => {
      aiService.chat.mockRejectedValueOnce(new Error('network down'));
      const failed = await agentService.send('what did I miss?');
      expect(failed.status).toBe('error');

      aiService.chat.mockResolvedValue(reply('Nothing much.'));
      const turn = await agentService.retry();

      expect(turn).toEqual({ status: 'done', text: 'Nothing much.' });
      // The question is still there once, not twice.
      const asked = agentService
        .history()
        .filter(m => m.content === 'what did I miss?');
      expect(asked).toHaveLength(1);
    });

    it('drops a half-finished tool turn before retrying', async () => {
      aiService.chat
        .mockResolvedValueOnce(
          reply('thinking', [{ id: 'c1', name: 'send_message', input: {} }]),
        )
        .mockResolvedValueOnce(reply('Done.'));

      // Stops for approval, leaving an assistant turn whose tool calls were
      // never answered. Replaying that confuses every provider.
      const waiting = await agentService.send('tell #dev hi');
      expect(waiting.status).toBe('needs_confirmation');

      await agentService.retry();

      const last = agentService.history().slice(-1)[0];
      expect(last.role).toBe('assistant');
      expect(last.content).toBe('Done.');
      expect(
        agentService.history().filter(m => m.toolCalls?.length),
      ).toHaveLength(0);
    });

    it('does not make the user wait out the cooldown to retry', async () => {
      aiService.chat.mockRejectedValueOnce(new Error('HTTP 400'));
      await agentService.send('what did I miss?');

      aiService.chat.mockResolvedValue(reply('Nothing much.'));
      await agentService.retry();

      // The attempt this replaces produced nothing, and the user already
      // waited once. Try again answering "cooldown active, retry in 3s" is a
      // button refusing to do the one thing it exists for.
      expect(aiService.chat.mock.calls[1][1].continuesTurn).toBe(true);
    });

    it('gives a retry a fresh round budget', async () => {
      // Six rounds of tool calls exhausts the budget.
      aiService.chat.mockResolvedValue(
        reply('', [{ id: 'c1', name: 'list_channels', input: {} }]),
      );
      const exhausted = await agentService.send('loop please');
      expect(exhausted.status).toBe('error');

      aiService.chat.mockResolvedValue(reply('Done.'));

      expect(await agentService.retry()).toMatchObject({ status: 'done' });
    });

    it('refuses to retry an empty conversation', async () => {
      expect(await agentService.retry()).toMatchObject({ status: 'error' });
      expect(aiService.chat).not.toHaveBeenCalled();
    });
  });

  describe('sessions', () => {
    it('keeps the thread after the screen is closed and reopened', async () => {
      aiService.chat.mockResolvedValue(reply('You are in #chat.'));
      await agentService.send('which channels am I in?');

      // The screen drops its bubbles when it unmounts; the conversation does
      // not live there. Rebuilding from history() is what makes reopening
      // show the thread instead of an empty screen.
      const restored = agentService.history();
      expect(restored.map(m => m.content)).toEqual([
        'which channels am I in?',
        'You are in #chat.',
      ]);
    });

    it('gives each session its own thread', async () => {
      aiService.chat.mockResolvedValue(reply('ok'));
      await agentService.send('draft me a script');
      const first = agentService.activeSessionId();

      await agentService.newSession();
      await agentService.send('summarise #dev');

      expect(agentService.history()).toHaveLength(2);
      expect(agentService.history()[0].content).toBe('summarise #dev');

      await agentService.switchTo(first as string);
      expect(agentService.history()[0].content).toBe('draft me a script');
    });

    it('names a session after the question that started it', async () => {
      aiService.chat.mockResolvedValue(reply('ok'));
      await agentService.send('summarise #dev for me');

      expect(agentService.listSessions()[0].title).toBe(
        'summarise #dev for me',
      );
    });

    it('deletes one without touching the others', async () => {
      aiService.chat.mockResolvedValue(reply('ok'));
      await agentService.send('first');
      const first = agentService.activeSessionId() as string;
      await agentService.newSession();
      await agentService.send('second');

      await agentService.deleteSession(first);

      const titles = agentService.listSessions().map(entry => entry.title);
      expect(titles).toEqual(['second']);
    });

    it('caps how many it keeps', async () => {
      aiService.chat.mockResolvedValue(reply('ok'));
      for (let i = 0; i < MAX_SESSIONS + 4; i += 1) {
        await agentService.newSession();
        await agentService.send(`question ${i}`);
      }

      expect(agentService.listSessions().length).toBe(MAX_SESSIONS);
    });
  });

  describe('a long conversation', () => {
    /** Push a session past the compaction threshold, one exchange at a time. */
    const fill = async () => {
      aiService.chat.mockResolvedValue(reply('x'.repeat(5000)));
      const compactedAt: number[] = [];
      for (let i = 0; i < 14; i += 1) {
        const turn = await agentService.send(
          `question ${i} ${'y'.repeat(2000)}`,
        );
        if (turn.compacted) compactedAt.push(i);
      }
      return compactedAt;
    };

    it('summarises the older half rather than failing', async () => {
      const compactedAt = await fill();

      // It compacts as the conversation grows, not once at the end.
      expect(compactedAt.length).toBeGreaterThan(0);

      const history = agentService.history();
      // Fourteen exchanges would be 28 messages without compaction.
      expect(history.length).toBeLessThan(28);
      expect(history[0].content).toContain('earlier in this conversation');
    });

    it('leaves a short conversation alone', async () => {
      aiService.chat.mockResolvedValue(reply('short answer'));

      const turn = await agentService.send('hello');

      // Absent rather than false, so a turn that compacted nothing keeps the
      // plain shape callers already match on.
      expect(turn.compacted).toBeUndefined();
    });

    it('carries on when the summary itself fails', async () => {
      // Enough exchanges to have something to summarise, all small, so
      // nothing compacts while they are being built.
      aiService.chat.mockResolvedValue(reply('ok'));
      for (let i = 0; i < 8; i += 1) {
        await agentService.send(`question ${i}`);
      }

      aiService.chat.mockClear();
      aiService.chat
        .mockRejectedValueOnce(new Error('provider down'))
        .mockResolvedValue(reply('answered anyway'));

      // One message that crosses the threshold on its own, so compaction is
      // attempted on exactly this turn rather than somewhere in the loop.
      const turn = await agentService.send('z'.repeat(45000));

      // A summary that cannot be written is not worth failing the turn over:
      // the hard ceiling in AIService still protects the request.
      expect(turn.status).toBe('done');
      expect(turn.text).toBe('answered anyway');
      expect(turn.compacted).toBeUndefined();
    });
  });

  describe('script tools', () => {
    it('refuses to save code that does not compile', async () => {
      scriptingService.lint.mockReturnValue({
        ok: false,
        message: 'Unexpected end of input',
      });

      const outcome = await executeTool({
        id: 'c1',
        name: 'save_script',
        input: { name: 'Greeter', code: 'module.exports = {' },
      });

      // A broken script only shows up as an error later, far from whoever
      // wrote it.
      expect(outcome.isError).toBe(true);
      expect(scriptingService.add).not.toHaveBeenCalled();
    });

    it('saves a script disabled, never enabled', async () => {
      scriptingService.lint.mockReturnValue({ ok: true, message: 'ok' });

      await executeTool({
        id: 'c1',
        name: 'save_script',
        input: { name: 'Greeter', code: 'module.exports = {};' },
      });

      // An enabled script runs unattended against live traffic and spends the
      // user's own provider credit. Starting one stays their decision.
      expect(scriptingService.add).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Greeter', enabled: false }),
      );
    });

    it('updates the script of the same name instead of forking it', async () => {
      scriptingService.lint.mockReturnValue({ ok: true, message: 'ok' });
      scriptingService.list.mockReturnValue([
        { id: 'ai-abc', name: 'Greeter', code: 'old', config: { a: 1 } },
      ]);

      const outcome = await executeTool({
        id: 'c1',
        name: 'save_script',
        input: { name: 'Greeter', code: 'module.exports = {};' },
      });

      // Minting a new id every time is what left a hundred near-identical
      // copies behind when the user asked for one change.
      expect(scriptingService.add).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'ai-abc', name: 'Greeter' }),
      );
      // And it says which it did, so the model can tell.
      expect(outcome.content).toMatch(/updated/i);
    });

    it('creates a new one when the name is new', async () => {
      scriptingService.lint.mockReturnValue({ ok: true, message: 'ok' });
      scriptingService.list.mockReturnValue([
        { id: 'ai-abc', name: 'Greeter', code: 'old' },
      ]);

      const outcome = await executeTool({
        id: 'c1',
        name: 'save_script',
        input: { name: 'Something Else', code: 'module.exports = {};' },
      });

      expect(scriptingService.add).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Something Else' }),
      );
      expect(outcome.content).toMatch(/created/i);
    });

    it('will not overwrite a built-in', async () => {
      scriptingService.lint.mockReturnValue({ ok: true, message: 'ok' });
      scriptingService.list.mockReturnValue([
        { id: 'builtin-autoop', name: 'Auto-Op', builtIn: true, code: '' },
      ]);

      const outcome = await executeTool({
        id: 'c1',
        name: 'save_script',
        input: { id: 'builtin-autoop', code: 'module.exports = {};' },
      });

      expect(outcome.isError).toBe(true);
      expect(scriptingService.add).not.toHaveBeenCalled();
    });

    it('needs approval to save, but not to read', () => {
      expect(toolMutates({ id: 'a', name: 'save_script', input: {} })).toBe(
        true,
      );
      for (const name of ['list_scripts', 'read_script', 'lint_script']) {
        expect(toolMutates({ id: 'a', name, input: {} })).toBe(false);
      }
    });
  });

  describe('reading documentation', () => {
    it("does not ask about the project's own wiki", async () => {
      aiService.chat
        .mockResolvedValueOnce(
          reply('', [
            {
              id: 'c1',
              name: 'fetch_page',
              input: {
                url: 'https://github.com/AndroidIRCx/AndroidIRCx/wiki/AI',
              },
            },
          ]),
        )
        .mockResolvedValueOnce(reply('Here is how MCP works.'));
      (global as any).fetch = jest.fn(async () => ({
        ok: true,
        status: 200,
        text: async () => '<html><body><p>MCP docs</p></body></html>',
      }));

      const turn = await agentService.send('how does MCP work?');

      expect(turn.status).toBe('done');
    });

    it('stops and asks before reading anywhere else', async () => {
      aiService.chat.mockResolvedValue(
        reply('', [
          {
            id: 'c1',
            name: 'fetch_page',
            input: { url: 'https://example.com/whatever' },
          },
        ]),
      );

      const turn = await agentService.send('what does example.com say?');

      // Reading is normally free, but which sites the app may reach is a
      // decision only the user can make.
      expect(turn.status).toBe('needs_confirmation');
      expect(turn.pending?.[0].call.name).toBe('fetch_page');
    });

    it('remembers a host when the user says always', async () => {
      aiService.chat.mockResolvedValue(
        reply('', [
          {
            id: 'c1',
            name: 'fetch_page',
            input: { url: 'https://example.com/whatever' },
          },
        ]),
      );
      (global as any).fetch = jest.fn(async () => ({
        ok: true,
        status: 200,
        text: async () => 'hello',
      }));
      await agentService.send('what does example.com say?');

      await agentService.resolvePending({ c1: true }, ['example.com']);

      expect(webAccessService.isAllowed('example.com')).toBe(true);
    });
  });

  it('forgets the conversation on reset', async () => {
    aiService.chat.mockResolvedValue(reply('ok'));
    await agentService.send('hi');

    agentService.reset();

    expect(agentService.history()).toEqual([]);
  });
});

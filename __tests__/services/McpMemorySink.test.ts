/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('../../src/services/Logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockRemoteTools = jest.fn();
const mockExecute = jest.fn();
jest.mock('../../src/services/ai/McpClientService', () => ({
  mcpClientService: {
    remoteTools: () => mockRemoteTools(),
    execute: (...args: unknown[]) => mockExecute(...args),
  },
}));

import {
  classifyMemoryTool,
  DEFAULT_ROOM,
  DEFAULT_WING,
  mcpMemorySink,
  memoryArguments,
} from '../../src/services/ai/McpMemorySink';

const tool = (remoteName: string, over: Record<string, unknown> = {}) => ({
  name: `mcp__Mine__${remoteName}`,
  serverId: 'mine',
  serverName: 'Mine',
  serverReadOnly: false,
  serverTrusted: true,
  remoteName,
  inputSchema: { type: 'object' },
  ...over,
});

const note = {
  title: 'Release script',
  summary: 'Asked for a release script.\nDecided to use ENTRYMSG.',
  at: new Date('2026-10-05T10:00:00Z'),
};

describe('classifyMemoryTool', () => {
  it('knows a MemPalace', () => {
    expect(classifyMemoryTool(tool('mempalace_add_drawer'))).toMatchObject({
      kind: 'mempalace',
      key: 'mine::mempalace_add_drawer',
      serverName: 'Mine',
    });
    expect(classifyMemoryTool(tool('mempalace_diary_write'))?.kind).toBe(
      'mempalace-diary',
    );
  });

  it('knows the memory knowledge graph', () => {
    expect(classifyMemoryTool(tool('create_entities'))?.kind).toBe('graph');
  });

  it('takes a generic save-memory tool with one text field', () => {
    expect(
      classifyMemoryTool(
        tool('save_memory', {
          inputSchema: {
            type: 'object',
            properties: { text: { type: 'string' }, tags: { type: 'array' } },
            required: ['text'],
          },
        }),
      ),
    ).toMatchObject({ kind: 'generic', field: 'text' });
    expect(
      classifyMemoryTool(
        tool('remember', {
          inputSchema: { properties: { content: { type: 'string' } } },
        }),
      )?.field,
    ).toBe('content');
  });

  it('passes over a generic tool that wants more than the text', () => {
    expect(
      classifyMemoryTool(
        tool('store_memory', {
          inputSchema: {
            properties: {
              content: { type: 'string' },
              userId: { type: 'string' },
            },
            required: ['content', 'userId'],
          },
        }),
      ),
    ).toBeUndefined();
    expect(
      classifyMemoryTool(
        tool('add_note', {
          inputSchema: { properties: { count: { type: 'number' } } },
        }),
      ),
    ).toBeUndefined();
  });

  it('ignores tools that are not for memory, and read-only servers', () => {
    expect(classifyMemoryTool(tool('mempalace_search'))).toBeUndefined();
    expect(
      classifyMemoryTool(
        tool('mempalace_add_drawer', { serverReadOnly: true }),
      ),
    ).toBeUndefined();
  });
});

describe('memoryArguments', () => {
  const settings = { wing: 'w', room: 'r' };

  it('files a drawer in the chosen wing and room', () => {
    const args = memoryArguments(
      classifyMemoryTool(tool('mempalace_add_drawer'))!,
      note,
      settings,
    );
    expect(args).toMatchObject({
      wing: 'w',
      room: 'r',
      added_by: 'androidircx',
      source_file: 'AndroidIRCX assistant: Release script',
    });
    expect(args.content).toContain('Conversation: Release script');
    expect(args.content).toContain('Date: 2026-10-05T10:00:00.000Z');
    expect(args.content).toContain('Decided to use ENTRYMSG.');
  });

  it('falls back to the default wing and room', () => {
    const args = memoryArguments(
      classifyMemoryTool(tool('mempalace_add_drawer'))!,
      { ...note, title: '  ' },
      { wing: '', room: '' },
    );
    expect(args).toMatchObject({ wing: DEFAULT_WING, room: DEFAULT_ROOM });
    expect(args.content).toContain('Untitled conversation');
  });

  it('writes a diary entry', () => {
    expect(
      memoryArguments(
        classifyMemoryTool(tool('mempalace_diary_write'))!,
        note,
        settings,
      ),
    ).toMatchObject({ agent_name: 'androidircx', topic: 'Release script' });
  });

  it('makes one graph entity with a line per observation', () => {
    const args: any = memoryArguments(
      classifyMemoryTool(tool('create_entities'))!,
      note,
      settings,
    );
    expect(args.entities[0]).toEqual({
      name: 'AndroidIRCX conversation: Release script (2026-10-05)',
      entityType: 'conversation',
      observations: ['Asked for a release script.', 'Decided to use ENTRYMSG.'],
    });
  });

  it('fills the one field of a generic tool', () => {
    const target = {
      ...classifyMemoryTool(tool('mempalace_add_drawer'))!,
      kind: 'generic' as const,
      field: 'text',
    };
    expect(Object.keys(memoryArguments(target, note, settings))).toEqual([
      'text',
    ]);
    expect(
      Object.keys(
        memoryArguments({ ...target, field: undefined }, note, settings),
      ),
    ).toEqual(['content']);
  });
});

describe('mcpMemorySink', () => {
  /** A second server of the user's own, with its own memory tool. */
  const other = (remoteName: string) =>
    tool(remoteName, {
      name: `mcp__Notes__${remoteName}`,
      serverId: 'notes',
      serverName: 'Notes',
    });

  beforeEach(() => {
    (AsyncStorage as any).__reset?.();
    mcpMemorySink.resetForTests();
    mockRemoteTools.mockReset().mockReturnValue([]);
    mockExecute.mockReset().mockResolvedValue({ content: 'ok' });
  });

  it('does nothing without a memory server', async () => {
    mockRemoteTools.mockReturnValue([tool('mempalace_search')]);

    expect(await mcpMemorySink.save(note)).toEqual([]);
    expect(mockExecute).not.toHaveBeenCalled();
    expect(mcpMemorySink.promptHint()).toBe('');
  });

  it('copes with a client that cannot list its tools', async () => {
    mockRemoteTools.mockReturnValue(undefined);
    expect(mcpMemorySink.targets()).toEqual([]);
  });

  it('uses one tool per server, the drawer before the diary', async () => {
    mockRemoteTools.mockReturnValue([
      tool('mempalace_diary_write'),
      tool('mempalace_add_drawer'),
    ]);

    expect(mcpMemorySink.targets().map(target => target.kind)).toEqual([
      'mempalace',
      'mempalace-diary',
    ]);
    expect(mcpMemorySink.serverTargets().map(target => target.kind)).toEqual([
      'mempalace',
    ]);

    await mcpMemorySink.save(note);

    // The same summary is not filed twice on one server.
    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(mockExecute.mock.calls[0][0].name).toBe(
      'mcp__Mine__mempalace_add_drawer',
    );
  });

  it('saves to every server that can keep it', async () => {
    mockRemoteTools.mockReturnValue([
      tool('mempalace_add_drawer'),
      other('create_entities'),
    ]);

    const results = await mcpMemorySink.save(note);

    expect(results).toEqual([
      { ok: true, server: 'Mine' },
      { ok: true, server: 'Notes' },
    ]);
    expect(mockExecute.mock.calls.map(call => call[0].name)).toEqual([
      'mcp__Mine__mempalace_add_drawer',
      'mcp__Notes__create_entities',
    ]);
  });

  it('leaves out a server the user switched off', async () => {
    mockRemoteTools.mockReturnValue([
      tool('mempalace_add_drawer'),
      other('create_entities'),
    ]);
    await mcpMemorySink.setServerSelected('mine', false);

    expect(mcpMemorySink.isServerSelected('mine', true)).toBe(false);
    expect(mcpMemorySink.isServerSelected('notes', true)).toBe(true);
    expect(await mcpMemorySink.save(note)).toEqual([
      { ok: true, server: 'Notes' },
    ]);
    expect(mcpMemorySink.promptHint()).toContain('"Notes"');
    expect(mcpMemorySink.promptHint()).not.toContain('"Mine"');
  });

  it('keeps going when one server fails', async () => {
    mockRemoteTools.mockReturnValue([
      tool('mempalace_add_drawer'),
      other('create_entities'),
    ]);
    mockExecute
      .mockResolvedValueOnce({ content: 'wing is read-only', isError: true })
      .mockResolvedValueOnce({ content: 'ok' });

    expect(await mcpMemorySink.save(note)).toEqual([
      { ok: false, server: 'Mine', error: 'wing is read-only' },
      { ok: true, server: 'Notes' },
    ]);
  });

  it('turns a thrown error into a failed save', async () => {
    mockRemoteTools.mockReturnValue([tool('mempalace_add_drawer')]);
    mockExecute.mockRejectedValue(new Error('bridge gone'));

    expect(await mcpMemorySink.save(note)).toEqual([
      { ok: false, server: 'Mine', error: 'bridge gone' },
    ]);
  });

  it('names every server in the hint, so the assistant searches them all', () => {
    mockRemoteTools.mockReturnValue([
      tool('mempalace_add_drawer'),
      other('create_entities'),
    ]);
    const hint = mcpMemorySink.promptHint();
    expect(hint).toContain('servers "Mine", "Notes"');

    mockRemoteTools.mockReturnValue([tool('mempalace_add_drawer')]);
    expect(mcpMemorySink.promptHint()).toContain('server "Mine"');
  });

  it('saves nothing once switched off', async () => {
    mockRemoteTools.mockReturnValue([tool('mempalace_add_drawer')]);
    await mcpMemorySink.update({ enabled: false });

    expect(await mcpMemorySink.save(note)).toEqual([]);
    expect(mcpMemorySink.activeTargets()).toEqual([]);
    expect(mcpMemorySink.promptHint()).toBe('');
  });

  it('skips an empty summary', async () => {
    mockRemoteTools.mockReturnValue([tool('mempalace_add_drawer')]);
    expect(await mcpMemorySink.save({ ...note, summary: '  ' })).toEqual([]);
  });

  it('gives up on a server that never answers', async () => {
    jest.useFakeTimers();
    try {
      mockRemoteTools.mockReturnValue([tool('mempalace_add_drawer')]);
      mockExecute.mockReturnValue(new Promise(() => undefined));

      const pending = mcpMemorySink.save(note);
      await Promise.resolve();
      await Promise.resolve();
      jest.advanceTimersByTime(15000);

      expect(await pending).toEqual([
        { ok: false, server: 'Mine', error: 'The server did not answer.' },
      ]);
    } finally {
      jest.useRealTimers();
    }
  });

  it('keeps its settings across a restart', async () => {
    await mcpMemorySink.update({ enabled: false, wing: 'irc', room: 'notes' });
    await mcpMemorySink.setServerSelected('mine', false);
    mcpMemorySink.resetForTests();
    await mcpMemorySink.load();

    expect(mcpMemorySink.getSettings()).toEqual({
      enabled: false,
      servers: { mine: false },
      wing: 'irc',
      room: 'notes',
    });
  });

  it('repairs stored settings that are not usable', async () => {
    await AsyncStorage.setItem(
      '@AndroidIRCX:aiMemorySink',
      JSON.stringify({
        wing: '  ',
        room: 7,
        servers: { a: false, b: 'no', c: true },
      }),
    );
    await mcpMemorySink.load();

    expect(mcpMemorySink.getSettings()).toEqual({
      enabled: true,
      servers: { a: false, c: true },
      wing: DEFAULT_WING,
      room: DEFAULT_ROOM,
    });
  });

  it('ignores a servers entry that is not a map', async () => {
    await AsyncStorage.setItem(
      '@AndroidIRCX:aiMemorySink',
      JSON.stringify({ servers: 'all' }),
    );
    await mcpMemorySink.load();
    expect(mcpMemorySink.getSettings().servers).toEqual({});
  });

  it('survives a corrupt stored blob', async () => {
    await AsyncStorage.setItem('@AndroidIRCX:aiMemorySink', '{oops');
    await mcpMemorySink.load();
    expect(mcpMemorySink.getSettings().enabled).toBe(true);
  });

  it('hands out a copy of its settings', () => {
    const settings = mcpMemorySink.getSettings();
    settings.servers.x = false;
    expect(mcpMemorySink.isServerSelected('x', true)).toBe(true);
  });

  describe('servers the user does not trust (security pass 2026-10-05)', () => {
    const stranger = (remoteName: string) =>
      tool(remoteName, {
        name: `mcp__Search__${remoteName}`,
        serverId: 'search',
        serverName: 'Search',
        serverTrusted: false,
        inputSchema: { properties: { content: { type: 'string' } } },
      });

    it('sends nothing to an untrusted server that happens to offer add_note', async () => {
      mockRemoteTools.mockReturnValue([
        stranger('add_note'),
        tool('mempalace_add_drawer'),
      ]);
      // Still offered, so the user can choose it…
      expect(
        mcpMemorySink.serverTargets().map(target => target.serverName),
      ).toEqual(['Mine', 'Search']);

      // …but nothing goes there until they do.
      expect(await mcpMemorySink.save(note)).toEqual([
        { ok: true, server: 'Mine' },
      ]);
      expect(mcpMemorySink.promptHint()).not.toContain('"Search"');
    });

    it('sends to an untrusted server once the user switches it on', async () => {
      mockRemoteTools.mockReturnValue([stranger('add_note')]);
      await mcpMemorySink.setServerSelected('search', true);

      expect(await mcpMemorySink.save(note)).toEqual([
        { ok: true, server: 'Search' },
      ]);
    });
  });
});

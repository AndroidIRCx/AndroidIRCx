/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const mockNative = {
  connect: jest.fn(),
  callTool: jest.fn(),
  disconnect: jest.fn().mockResolvedValue(true),
};

const mockStorage: Record<string, string> = {};
const mockSecrets: Record<string, string> = {};

jest.mock('react-native', () => ({
  NativeModules: { McpClient: mockNative },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => mockStorage[key] ?? null),
  setItem: jest.fn(async (key: string, value: string) => {
    mockStorage[key] = value;
  }),
  removeItem: jest.fn(async (key: string) => {
    delete mockStorage[key];
  }),
}));

jest.mock('../../src/services/SecureStorageService', () => ({
  secureStorageService: {
    setSecret: jest.fn(async (key: string, value: string) => {
      mockSecrets[key] = value;
    }),
    getSecret: jest.fn(async (key: string) => mockSecrets[key] ?? null),
    removeSecret: jest.fn(async (key: string) => {
      delete mockSecrets[key];
    }),
  },
}));

jest.mock('../../src/services/Logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const {
  mcpClientService,
  MCP_TOOL_PREFIX,
  namespacedToolName,
  BUILT_IN_MCP_SERVERS,
} = require('../../src/services/ai/McpClientService');

const builtInIds = BUILT_IN_MCP_SERVERS.map((s: any) => s.id);

const remoteTool = (overrides = {}) => ({
  name: 'search',
  description: 'Search the docs',
  inputSchema: JSON.stringify({
    type: 'object',
    properties: { q: { type: 'string' } },
    required: ['q'],
  }),
  readOnly: false,
  ...overrides,
});

describe('McpClientService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
    Object.keys(mockSecrets).forEach(key => delete mockSecrets[key]);
    mcpClientService.resetForTests();
    mockNative.connect.mockResolvedValue({ id: 'x', tools: [remoteTool()] });
    mockNative.callTool.mockResolvedValue({ content: 'found', isError: false });
  });

  it('rejects a server without a name or a usable URL', async () => {
    await expect(
      mcpClientService.add({ name: '', url: 'https://a.example.com' }),
    ).rejects.toThrow('name is required');
    await expect(
      mcpClientService.add({ name: 'Docs', url: 'ftp://nope' }),
    ).rejects.toThrow('URL is required');
  });

  it('keeps the token out of the stored metadata', async () => {
    const server = await mcpClientService.add({
      name: 'Docs',
      url: 'https://a.example.com/',
      token: 'secret-token',
    });

    expect(server.hasToken).toBe(true);
    expect(server.url).toBe('https://a.example.com');
    expect(mockStorage['@AndroidIRCX:mcpClients']).not.toContain(
      'secret-token',
    );
    expect(mockSecrets[`ai:mcpclient:${server.id}`]).toBe('secret-token');
  });

  it('namespaces tool names so they cannot collide with built-ins', async () => {
    await mcpClientService.add({ name: 'Docs', url: 'https://a.example.com' });

    const tools = await mcpClientService.connectAll();

    expect(tools[0].name).toBe(`${MCP_TOOL_PREFIX}Docs__search`);
    expect(mcpClientService.owns(`${MCP_TOOL_PREFIX}Docs__search`)).toBe(true);
    expect(mcpClientService.owns('send_message')).toBe(false);
  });

  it('lists connected tools with the server they came from', async () => {
    await mcpClientService.add({
      name: 'Palace',
      url: 'http://127.0.0.1:8000/mcp',
    });
    mockNative.connect.mockResolvedValue({
      id: 'x',
      tools: [remoteTool({ name: 'mempalace_add_drawer' })],
    });
    await mcpClientService.connectAll();

    expect(mcpClientService.remoteTools()).toEqual([
      expect.objectContaining({
        name: 'mcp__Palace__mempalace_add_drawer',
        serverName: 'Palace',
        serverReadOnly: false,
        remoteName: 'mempalace_add_drawer',
        inputSchema: expect.objectContaining({ type: 'object' }),
      }),
    ]);
  });

  it('marks the tools of a shipped read-only server as such', async () => {
    await mcpClientService.update('builtin_mempalace', { enabled: true });
    mockNative.connect.mockResolvedValue({
      id: 'builtin_mempalace',
      tools: [remoteTool({ name: 'mempalace_add_drawer' })],
    });
    await mcpClientService.connectAll();

    expect(mcpClientService.remoteTools()[0].serverReadOnly).toBe(true);
  });

  it('treats a remote tool as mutating unless the user trusts the hint', async () => {
    await mcpClientService.add({ name: 'Docs', url: 'https://a.example.com' });
    mockNative.connect.mockResolvedValue({
      id: 'x',
      tools: [remoteTool({ readOnly: true })],
    });

    const tools = await mcpClientService.connectAll();

    // readOnlyHint is the server's claim about itself, so it does not by
    // itself excuse a remote tool from confirmation.
    expect(tools[0].mutates).toBe(true);
  });

  it('honours the hint once the user has said they trust it', async () => {
    const server = await mcpClientService.add({
      name: 'Docs',
      url: 'https://a.example.com',
      trustReadOnlyHints: true,
    });
    expect(server.trustReadOnlyHints).toBe(true);
    mockNative.connect.mockResolvedValue({
      id: 'x',
      tools: [remoteTool({ readOnly: true }), remoteTool({ name: 'write' })],
    });

    const tools = await mcpClientService.connectAll();

    expect(tools[0].mutates).toBe(false);
    expect(tools[1].mutates).toBe(true);
  });

  it('skips a server that is switched off', async () => {
    const server = await mcpClientService.add({
      name: 'Docs',
      url: 'https://a.example.com',
    });
    await mcpClientService.update(server.id, { enabled: false });

    expect(await mcpClientService.connectAll()).toEqual([]);
    expect(mockNative.connect).not.toHaveBeenCalled();
  });

  it('keeps the other servers when one is unreachable', async () => {
    await mcpClientService.add({ name: 'Down', url: 'https://a.example.com' });
    await mcpClientService.add({ name: 'Up', url: 'https://b.example.com' });
    mockNative.connect
      .mockRejectedValueOnce(new Error('unreachable'))
      .mockResolvedValueOnce({ id: 'y', tools: [remoteTool()] });

    const tools = await mcpClientService.connectAll();

    // One dead endpoint must not cost the user every other tool.
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe(`${MCP_TOOL_PREFIX}Up__search`);
  });

  it('calls the remote tool under its own name, not the namespaced one', async () => {
    await mcpClientService.add({ name: 'Docs', url: 'https://a.example.com' });
    await mcpClientService.connectAll();

    const outcome = await mcpClientService.execute({
      id: 'c1',
      name: `${MCP_TOOL_PREFIX}Docs__search`,
      input: { q: 'irc' },
    });

    expect(mockNative.callTool).toHaveBeenCalledWith(
      expect.any(String),
      'search',
      JSON.stringify({ q: 'irc' }),
    );
    expect(outcome).toEqual({ content: 'found', isError: false });
  });

  it('reports an unknown tool rather than throwing', async () => {
    const outcome = await mcpClientService.execute({
      id: 'c1',
      name: 'mcp__Gone__search',
      input: {},
    });

    expect(outcome.isError).toBe(true);
  });

  it('survives a server that cannot describe its own tool', async () => {
    await mcpClientService.add({ name: 'Docs', url: 'https://a.example.com' });
    mockNative.connect.mockResolvedValue({
      id: 'x',
      tools: [remoteTool({ inputSchema: '{broken' })],
    });

    const tools = await mcpClientService.connectAll();

    expect(tools).toHaveLength(1);
    expect(tools[0].inputSchema).toEqual({ type: 'object' });
  });

  it('drops the token and the tools when a server is removed', async () => {
    const server = await mcpClientService.add({
      name: 'Docs',
      url: 'https://a.example.com',
      token: 'secret-token',
    });
    await mcpClientService.connectAll();

    await mcpClientService.remove(server.id);

    expect(mockSecrets[`ai:mcpclient:${server.id}`]).toBeUndefined();
    expect(mcpClientService.toolSchemas()).toEqual([]);
    // Only the shipped servers are left.
    expect((await mcpClientService.list()).map((s: any) => s.id)).toEqual(
      builtInIds,
    );
  });

  describe('the servers that ship with the app', () => {
    it('offers the MemPalace switched off, read-only and trusted', async () => {
      const [palace] = await mcpClientService.list();

      expect(palace).toMatchObject({
        id: 'builtin_mempalace',
        url: 'https://mempalace-mcp.dbase.in.rs/mcp',
        enabled: false,
        builtIn: true,
        readOnly: true,
        trustReadOnlyHints: true,
      });
    });

    it('connects nothing until the user turns it on', async () => {
      expect(await mcpClientService.connectAll()).toEqual([]);
      expect(mockNative.connect).not.toHaveBeenCalled();

      await mcpClientService.update('builtin_mempalace', { enabled: true });
      await mcpClientService.connectAll();

      expect(mockNative.connect).toHaveBeenCalledWith(
        'builtin_mempalace',
        'https://mempalace-mcp.dbase.in.rs/mcp',
        expect.stringMatching(/^[A-Za-z0-9]{64}$/),
      );
      // The shipped token never lands in secure storage.
      expect(mockSecrets['ai:mcpclient:builtin_mempalace']).toBeUndefined();
    });

    it('lets its lookups run without asking, while the user trusts it', async () => {
      await mcpClientService.update('builtin_mempalace', { enabled: true });
      // The server marks none of its tools readOnlyHint.
      mockNative.connect.mockResolvedValue({
        id: 'builtin_mempalace',
        tools: [remoteTool({ name: 'mempalace_search', readOnly: false })],
      });

      let [tool] = await mcpClientService.connectAll();
      expect(tool.mutates).toBe(false);

      await mcpClientService.update('builtin_mempalace', {
        trustReadOnlyHints: false,
      });
      [tool] = await mcpClientService.connectAll();
      expect(tool.mutates).toBe(true);
    });

    it('never lets a stored readOnly flag skip confirmation for a user server', async () => {
      mockStorage['@AndroidIRCX:mcpClients'] = JSON.stringify([
        {
          id: 'mine',
          name: 'Mine',
          url: 'https://mine.example/mcp',
          hasToken: false,
          enabled: true,
          trustReadOnlyHints: true,
          readOnly: true,
        },
      ]);

      const [tool] = await mcpClientService.connectAll();

      expect(tool.mutates).toBe(true);
    });

    it('stays removed once the user removes it', async () => {
      await mcpClientService.remove('builtin_mempalace');

      // A fresh start, as after the app restarts.
      mcpClientService.resetForTests();

      expect(await mcpClientService.list()).toEqual([]);
    });

    it('is added once to a list saved before it shipped', async () => {
      mockStorage['@AndroidIRCX:mcpClients'] = JSON.stringify([
        {
          id: 'mine',
          name: 'Mine',
          url: 'https://mine.example/mcp',
          hasToken: false,
          enabled: true,
          trustReadOnlyHints: false,
        },
      ]);

      const ids = (await mcpClientService.list()).map((s: any) => s.id);

      expect(ids).toEqual(['mine', 'builtin_mempalace']);
      mcpClientService.resetForTests();
      expect((await mcpClientService.list()).map((s: any) => s.id)).toEqual(
        ids,
      );
    });
  });
  describe('saving summaries with the built-in MemPalace also connected', () => {
    const { mcpMemorySink } = require('../../src/services/ai/McpMemorySink');
    const drawer = remoteTool({ name: 'mempalace_add_drawer' });

    /** Both palaces connected, both offering the very same write tool. */
    const connectBoth = async () => {
      await mcpClientService.update('builtin_mempalace', { enabled: true });
      const local = await mcpClientService.add({
        name: 'My Palace',
        url: 'http://127.0.0.1:8000/mcp',
        trustReadOnlyHints: true,
      });
      mockNative.connect.mockImplementation(async (id: string) => ({
        id,
        tools: [drawer, remoteTool({ name: 'mempalace_search' })],
      }));
      await mcpClientService.connectAll();
      return local;
    };

    beforeEach(() => {
      mcpMemorySink.resetForTests();
    });

    it('saves to the local palace, never the read-only one', async () => {
      const local = await connectBoth();

      const targets = mcpMemorySink.targets();
      expect(targets.map((target: any) => target.serverName)).toEqual([
        'My Palace',
      ]);

      const result = await mcpMemorySink.save({
        title: 'Release script',
        summary: 'Decided to use ENTRYMSG.',
      });

      expect(result).toEqual([{ ok: true, server: 'My Palace' }]);
      expect(mockNative.callTool).toHaveBeenCalledTimes(1);
      expect(mockNative.callTool.mock.calls[0][0]).toBe(local.id);
      expect(mockNative.callTool.mock.calls[0][1]).toBe('mempalace_add_drawer');
    });

    it('cannot be switched on for the read-only palace', async () => {
      await connectBoth();
      await mcpMemorySink.setServerSelected('builtin_mempalace', true);

      expect(
        mcpMemorySink.activeTargets().map((target: any) => target.serverName),
      ).toEqual(['My Palace']);
    });

    it('saves to each of the user\u2019s own palaces that is switched on', async () => {
      const first = await connectBoth();
      const second = await mcpClientService.add({
        name: 'Work Palace',
        url: 'http://127.0.0.1:8001/mcp',
        trustReadOnlyHints: true,
      });
      await mcpClientService.connectAll();

      expect(await mcpMemorySink.save({ title: 't', summary: 's' })).toEqual([
        { ok: true, server: 'My Palace' },
        { ok: true, server: 'Work Palace' },
      ]);
      expect(
        mockNative.callTool.mock.calls.map((call: any[]) => call[0]).sort(),
      ).toEqual([first.id, second.id].sort());

      mockNative.callTool.mockClear();
      await mcpMemorySink.setServerSelected(second.id, false);
      await mcpMemorySink.save({ title: 't', summary: 's' });
      expect(
        mockNative.callTool.mock.calls.map((call: any[]) => call[0]),
      ).toEqual([first.id]);
    });

    it('treats the built-in as read-only even from a list saved without the flag', async () => {
      mockStorage['@AndroidIRCX:mcpClients'] = JSON.stringify([
        {
          id: 'builtin_mempalace',
          name: 'AndroidIRCX MemPalace',
          url: 'https://mempalace-mcp.dbase.in.rs/mcp',
          hasToken: false,
          enabled: true,
          trustReadOnlyHints: true,
          builtIn: true,
          // No readOnly: saved before that flag existed.
        },
      ]);
      mockStorage['@AndroidIRCX:mcpClientsSeeded'] = JSON.stringify([
        'builtin_mempalace',
      ]);
      mockNative.connect.mockResolvedValue({
        id: 'builtin_mempalace',
        tools: [drawer],
      });
      await mcpClientService.connectAll();

      expect(mcpClientService.remoteTools()[0].serverReadOnly).toBe(true);
      expect(mcpMemorySink.targets()).toEqual([]);
      expect(await mcpMemorySink.save({ title: 't', summary: 's' })).toEqual(
        [],
      );
      expect(mockNative.callTool).not.toHaveBeenCalled();
    });

    it('saves nothing when the read-only palace is all there is', async () => {
      await mcpClientService.update('builtin_mempalace', { enabled: true });
      mockNative.connect.mockResolvedValue({
        id: 'builtin_mempalace',
        tools: [drawer],
      });
      await mcpClientService.connectAll();

      expect(await mcpMemorySink.save({ title: 't', summary: 's' })).toEqual(
        [],
      );
      expect(mockNative.callTool).not.toHaveBeenCalled();
    });
  });

  describe('security pass 2026-10-05', () => {
    describe('what a server can hand back', () => {
      const {
        MCP_MAX_TOOLS_PER_SERVER,
        MCP_MAX_DESCRIPTION_CHARS,
        MCP_MAX_RESULT_CHARS,
      } = require('../../src/services/ai/McpClientService');

      it('takes a bounded number of tools, with bounded descriptions', async () => {
        await mcpClientService.add({
          name: 'Flood',
          url: 'https://flood.example/mcp',
        });
        mockNative.connect.mockResolvedValue({
          id: 'x',
          tools: Array.from({ length: MCP_MAX_TOOLS_PER_SERVER + 50 }, (_, i) =>
            remoteTool({
              name: `t${i}`,
              description: 'd'.repeat(MCP_MAX_DESCRIPTION_CHARS + 500),
            }),
          ),
        });

        const tools = await mcpClientService.connectAll();

        expect(tools).toHaveLength(MCP_MAX_TOOLS_PER_SERVER);
        expect(tools[0].description).toHaveLength(MCP_MAX_DESCRIPTION_CHARS);
      });

      it('cuts a result that would fill the request on its own', async () => {
        await mcpClientService.add({
          name: 'Big',
          url: 'https://big.example/mcp',
        });
        await mcpClientService.connectAll();
        mockNative.callTool.mockResolvedValue({
          content: 'z'.repeat(MCP_MAX_RESULT_CHARS + 10),
          isError: false,
        });

        const outcome = await mcpClientService.execute({
          id: 'c',
          name: 'mcp__Big__search',
          input: {},
        });

        expect(outcome.content).toContain('z'.repeat(MCP_MAX_RESULT_CHARS));
        expect(outcome.content).toContain(
          '10 more characters from the server not shown',
        );
      });
    });

    const spoof = {
      id: 'builtin_mempalace',
      name: 'AndroidIRCX MemPalace',
      url: 'https://evil.example/mcp',
      hasToken: false,
      enabled: true,
      trustReadOnlyHints: true,
      builtIn: true,
      readOnly: true,
    };

    it('gives a look-alike of the built-in neither its token nor its trust', async () => {
      // A restored backup: the shipped id, somebody else's address.
      mockStorage['@AndroidIRCX:mcpClients'] = JSON.stringify([spoof]);
      mockStorage['@AndroidIRCX:mcpClientsSeeded'] = JSON.stringify([
        'builtin_mempalace',
      ]);
      mockNative.connect.mockResolvedValue({
        id: 'builtin_mempalace',
        tools: [remoteTool({ name: 'mempalace_search' })],
      });

      const [tool] = await mcpClientService.connectAll();

      // No shipped token sent to evil.example…
      expect(mockNative.connect).toHaveBeenCalledWith(
        'builtin_mempalace',
        'https://evil.example/mcp',
        null,
      );
      // …and its tools ask before they run.
      expect(tool.mutates).toBe(true);
    });

    it('still gives the real built-in its token and its trust', async () => {
      await mcpClientService.update('builtin_mempalace', { enabled: true });
      mockNative.connect.mockResolvedValue({
        id: 'builtin_mempalace',
        tools: [remoteTool({ name: 'mempalace_search' })],
      });

      const [tool] = await mcpClientService.connectAll();

      expect(mockNative.connect.mock.calls[0][2]).toEqual(expect.any(String));
      expect(mockNative.connect.mock.calls[0][2]).not.toBe('');
      expect(tool.mutates).toBe(false);
    });

    it('refuses plain http to a server on the internet', async () => {
      await expect(
        mcpClientService.add({
          name: 'Far',
          url: 'http://mcp.example.com/mcp',
        }),
      ).rejects.toThrow('Use https');
    });

    it('accepts plain http on this phone or the local network', async () => {
      const local = await mcpClientService.add({
        name: 'Termux',
        url: 'http://127.0.0.1:8000/mcp/',
      });
      expect(local.url).toBe('http://127.0.0.1:8000/mcp');
      await mcpClientService.add({
        name: 'NAS',
        url: 'http://192.168.1.10:8000/mcp',
      });
    });

    it('refuses an address that hides its host behind an @', async () => {
      await expect(
        mcpClientService.add({
          name: 'Sneaky',
          url: 'https://mempalace-mcp.dbase.in.rs@evil.example/mcp',
        }),
      ).rejects.toThrow('valid http(s) URL');
    });

    it('switches off a stored server whose address is no longer accepted', async () => {
      mockStorage['@AndroidIRCX:mcpClients'] = JSON.stringify([
        {
          id: 'old',
          name: 'Old',
          url: 'http://mcp.example.com/mcp',
          hasToken: true,
          enabled: true,
          trustReadOnlyHints: false,
        },
      ]);

      const servers = await mcpClientService.list();

      expect(servers.find((server: any) => server.id === 'old').enabled).toBe(
        false,
      );
    });
  });

  describe('namespacedToolName', () => {
    it('keeps a name a provider will accept', () => {
      // Providers take ^[a-zA-Z0-9_-]{1,64}$, and a space in the server name
      // used to reach them untouched and fail the whole request.
      const name = namespacedToolName('Mem Palace', 'mempalace_search');

      expect(name).toBe('mcp__Mem_Palace__mempalace_search');
      expect(name).toMatch(/^[a-zA-Z0-9_-]{1,64}$/);
    });

    it('replaces every character a provider would reject', () => {
      const name = namespacedToolName('naš:server!', 'tool.name');

      expect(name).toMatch(/^[a-zA-Z0-9_-]{1,64}$/);
    });

    it('stays within 64 characters by shortening the server, not the tool', () => {
      const name = namespacedToolName(
        'a'.repeat(60),
        'mempalace_memories_filed_away',
      );

      expect(name.length).toBeLessThanOrEqual(64);
      expect(name.endsWith('__mempalace_memories_filed_away')).toBe(true);
    });

    it('truncates even a tool name that fills the budget on its own', () => {
      const name = namespacedToolName('server', 'x'.repeat(90));

      expect(name.length).toBe(64);
    });

    it('gives a colliding name a suffix instead of shadowing the first', () => {
      const taken = new Set(['mcp__a_b__search']);

      const name = namespacedToolName('a b', 'search', taken);

      expect(name).toBe('mcp__a_b__search_2');
    });

    it('falls back rather than producing an empty part', () => {
      expect(namespacedToolName('', '')).toBe('mcp__server__tool');
    });
  });

  it('does not let two servers with equivalent names shadow each other', async () => {
    await mcpClientService.add({ name: 'a b', url: 'https://a.example.com' });
    await mcpClientService.add({ name: 'a:b', url: 'https://b.example.com' });
    mockNative.connect.mockResolvedValue({ id: 'x', tools: [remoteTool()] });

    const tools = await mcpClientService.connectAll();

    expect(tools).toHaveLength(2);
    expect(new Set(tools.map((tool: any) => tool.name)).size).toBe(2);
  });

  it('remembers why a server failed, and says so', async () => {
    const server = await mcpClientService.add({
      name: 'Docs',
      url: 'https://a.example.com',
    });
    mockNative.connect.mockRejectedValue(new Error('Connection refused'));

    await mcpClientService.connectAll();

    expect(mcpClientService.status(server.id)).toEqual({
      state: 'failed',
      tools: 0,
      error: 'Connection refused',
    });
  });

  it('reports the tool count when a server connects', async () => {
    const server = await mcpClientService.add({
      name: 'Docs',
      url: 'https://a.example.com',
    });
    mockNative.connect.mockResolvedValue({ id: 'x', tools: [remoteTool()] });

    await mcpClientService.connectAll();

    expect(mcpClientService.status(server.id)).toEqual({
      state: 'connected',
      tools: 1,
    });
  });

  it('has no status for a server nobody has tried yet', () => {
    expect(mcpClientService.status('never-seen')).toEqual({
      state: 'unknown',
      tools: 0,
    });
  });

  it('tests one server on demand without touching the others', async () => {
    const one = await mcpClientService.add({
      name: 'One',
      url: 'https://one.example.com',
    });
    await mcpClientService.add({ name: 'Two', url: 'https://two.example.com' });
    mockNative.connect.mockResolvedValue({ id: 'x', tools: [remoteTool()] });
    await mcpClientService.connectAll();

    mockNative.connect.mockRejectedValue(new Error('Gone'));
    const status = await mcpClientService.test(one.id);

    expect(status).toEqual({ state: 'failed', tools: 0, error: 'Gone' });
    // The other server's tool is still there; only the tested one was dropped.
    expect(mcpClientService.toolSchemas()).toHaveLength(1);
  });
});

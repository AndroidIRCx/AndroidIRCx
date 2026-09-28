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
} = require('../../src/services/ai/McpClientService');

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
    expect(await mcpClientService.list()).toEqual([]);
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

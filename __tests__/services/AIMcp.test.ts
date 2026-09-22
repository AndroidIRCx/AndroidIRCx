/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Keychain from 'react-native-keychain';
import { anthropicProvider } from '../../src/services/ai/providers/AnthropicProvider';
import { aiService } from '../../src/services/ai/AIService';
import {
  aiProviderStore,
  AI_MCP_SECRET_PREFIX,
} from '../../src/services/ai/AIProviderStore';
import { secureStorageService } from '../../src/services/SecureStorageService';
import { AIProvider } from '../../src/services/ai/types';

const jsonResponse = (body: unknown, ok = true, status = 200) =>
  ({
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }) as unknown as Response;

const signal = () => new AbortController().signal;

const withMcp = (overrides: Partial<AIProvider> = {}): AIProvider => ({
  id: 'p1',
  name: 'Claude',
  kind: 'anthropic',
  model: 'claude-opus-5',
  hasKey: true,
  maxTokens: 512,
  enabled: true,
  mcpServers: [
    {
      name: 'docs',
      url: 'https://mcp.example.com/sse',
      tools: ['search', 'fetch'],
      hasToken: false,
    },
  ],
  ...overrides,
});

describe('MCP — provider-side wiring', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest
      .fn()
      .mockResolvedValue(
        jsonResponse({ content: [{ type: 'text', text: 'ok' }] }),
      );
    (global as any).fetch = fetchMock;
  });

  it('sends both halves — mcp_servers and a matching mcp_toolset', async () => {
    await anthropicProvider.chat(
      withMcp(),
      'k',
      [{ role: 'user', content: 'hi' }],
      {},
      signal(),
    );

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);

    expect(body.mcp_servers).toEqual([
      { type: 'url', url: 'https://mcp.example.com/sse', name: 'docs' },
    ]);
    // Declaring the server without the toolset tool is a validation error,
    // so the two must always travel together.
    expect(body.tools).toEqual([
      {
        type: 'mcp_toolset',
        mcp_server_name: 'docs',
        allowed_tools: ['search', 'fetch'],
      },
    ]);
    expect(init.headers['anthropic-beta']).toBe('mcp-client-2025-11-20');
  });

  it('sends no beta header when no MCP server is configured', async () => {
    await anthropicProvider.chat(
      withMcp({ mcpServers: [] }),
      'k',
      [{ role: 'user', content: 'hi' }],
      {},
      signal(),
    );

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers['anthropic-beta']).toBeUndefined();
    expect(JSON.parse(init.body).mcp_servers).toBeUndefined();
  });

  it('keeps ordinary tools alongside the toolset', async () => {
    await anthropicProvider.chat(
      withMcp(),
      'k',
      [{ role: 'user', content: 'hi' }],
      {
        tools: [
          {
            name: 'list_channels',
            description: 'x',
            inputSchema: { type: 'object' },
            mutates: false,
          },
        ],
      },
      signal(),
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.tools).toHaveLength(2);
    expect(body.tools[0].name).toBe('list_channels');
    expect(body.tools[1].type).toBe('mcp_toolset');
  });

  it('attaches a token only for the server it belongs to', async () => {
    await anthropicProvider.chat(
      withMcp({
        mcpServers: [
          {
            name: 'docs',
            url: 'https://a.example.com',
            tools: ['search'],
            hasToken: true,
          },
          {
            name: 'open',
            url: 'https://b.example.com',
            tools: ['search'],
            hasToken: false,
          },
        ],
      }),
      'k',
      [{ role: 'user', content: 'hi' }],
      { mcpTokens: { docs: 'secret-token' } },
      signal(),
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.mcp_servers[0].authorization_token).toBe('secret-token');
    expect(body.mcp_servers[1].authorization_token).toBeUndefined();
  });
});

describe('MCP — storage', () => {
  beforeEach(() => {
    (AsyncStorage as any).__reset();
    (Keychain as any).__reset();
    aiProviderStore.resetForTests();
    aiService.resetForTests();
  });

  const addProvider = () =>
    aiProviderStore.add(
      { name: 'Claude', kind: 'anthropic', model: 'claude-opus-5' } as any,
      'sk-ant',
    );

  it('stores server metadata but keeps the token in the keychain', async () => {
    const provider = await addProvider();
    await aiProviderStore.setMcpServers(provider.id, [
      { name: 'docs', url: 'https://mcp.example.com', tools: ['search'] },
    ]);
    await aiProviderStore.setMcpToken(provider.id, 'docs', 'secret-token');

    const stored = await aiProviderStore.get(provider.id);
    expect(stored?.mcpServers?.[0]).toMatchObject({
      name: 'docs',
      url: 'https://mcp.example.com',
      hasToken: true,
    });

    const raw = (await AsyncStorage.getItem('@AndroidIRCX:aiProviders')) ?? '';
    expect(raw).not.toContain('secret-token');
    expect(await aiProviderStore.getMcpTokens(provider.id)).toEqual({
      docs: 'secret-token',
    });
  });

  it('refuses a server with no tools listed', async () => {
    const provider = await addProvider();

    await aiProviderStore.setMcpServers(provider.id, [
      { name: 'docs', url: 'https://mcp.example.com', tools: [] },
      { name: 'bad-url', url: 'not-a-url', tools: ['search'] },
      { name: '', url: 'https://mcp.example.com', tools: ['search'] },
    ]);

    // All three would be rejected by the provider, so none is stored.
    expect((await aiProviderStore.get(provider.id))?.mcpServers).toEqual([]);
  });

  it('deletes the token when its server is removed', async () => {
    const provider = await addProvider();
    await aiProviderStore.setMcpServers(provider.id, [
      { name: 'docs', url: 'https://mcp.example.com', tools: ['search'] },
    ]);
    await aiProviderStore.setMcpToken(provider.id, 'docs', 'secret-token');

    await aiProviderStore.setMcpServers(provider.id, []);

    const keys = await secureStorageService.getAllSecretKeys();
    expect(keys.some(key => key.startsWith(AI_MCP_SECRET_PREFIX))).toBe(false);
  });

  it('deletes MCP tokens when the whole provider goes', async () => {
    const provider = await addProvider();
    await aiProviderStore.setMcpServers(provider.id, [
      { name: 'docs', url: 'https://mcp.example.com', tools: ['search'] },
    ]);
    await aiProviderStore.setMcpToken(provider.id, 'docs', 'secret-token');

    await aiProviderStore.remove(provider.id);

    expect((Keychain as any).__STORE.size).toBe(0);
  });

  it('reports which kinds can reach MCP at all', () => {
    // Only provider-side MCP exists today; the app is not an MCP client.
    expect(aiService.supportsMcp('anthropic')).toBe(true);
    expect(aiService.supportsMcp('openai-compatible')).toBe(false);
    expect(aiService.supportsMcp('local')).toBe(false);
  });
});

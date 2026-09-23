/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Keychain from 'react-native-keychain';
import { openAICompatProvider } from '../../src/services/ai/providers/OpenAICompatProvider';
import { anthropicProvider } from '../../src/services/ai/providers/AnthropicProvider';
import { geminiProvider } from '../../src/services/ai/providers/GeminiProvider';
import { aiService } from '../../src/services/ai/AIService';
import { aiProviderStore } from '../../src/services/ai/AIProviderStore';
import { AIMessage, AIProvider, AITool } from '../../src/services/ai/types';

const jsonResponse = (body: unknown, ok = true, status = 200) =>
  ({
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }) as unknown as Response;

const signal = () => new AbortController().signal;

const TOOLS: AITool[] = [
  {
    name: 'list_channels',
    description: 'List joined channels',
    inputSchema: { type: 'object', properties: {}, required: [] },
    mutates: false,
  },
  {
    name: 'send_message',
    description: 'Send a message',
    inputSchema: {
      type: 'object',
      properties: { target: { type: 'string' }, text: { type: 'string' } },
      required: ['target', 'text'],
    },
    mutates: true,
  },
];

/** One assistant turn that asked for a tool, plus the result coming back. */
const ROUND_TRIP: AIMessage[] = [
  { role: 'user', content: 'which channels am I in?' },
  {
    role: 'assistant',
    content: '',
    toolCalls: [{ id: 'call_1', name: 'list_channels', input: {} }],
  },
  {
    role: 'user',
    content: '',
    toolResults: [
      { toolCallId: 'call_1', name: 'list_channels', content: '#chat, #dev' },
    ],
  },
];

const provider = (overrides: Partial<AIProvider>): AIProvider => ({
  id: 'p1',
  name: 'Provider',
  kind: 'openai-compatible',
  baseUrl: 'https://api.openai.com/v1',
  model: 'm',
  hasKey: true,
  maxTokens: 512,
  enabled: true,
  ...overrides,
});

describe('tool calling — OpenAI shape', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
  });

  it('declares tools as functions', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ choices: [{ message: { content: 'ok' } }] }),
    );

    await openAICompatProvider.chat(
      provider({}),
      'k',
      [{ role: 'user', content: 'hi' }],
      { tools: TOOLS },
      signal(),
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.tools[0]).toEqual({
      type: 'function',
      function: {
        name: 'list_channels',
        description: 'List joined channels',
        parameters: TOOLS[0].inputSchema,
      },
    });
  });

  it('parses tool calls and tolerates malformed arguments', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  id: 'call_1',
                  function: {
                    name: 'send_message',
                    arguments: '{"target":"#chat","text":"hi"}',
                  },
                },
                {
                  id: 'call_2',
                  function: { name: 'list_channels', arguments: '{truncated' },
                },
              ],
            },
          },
        ],
      }),
    );

    const result = await openAICompatProvider.chat(
      provider({}),
      'k',
      [{ role: 'user', content: 'hi' }],
      { tools: TOOLS },
      signal(),
    );

    expect(result.text).toBe('');
    expect(result.toolCalls).toEqual([
      {
        id: 'call_1',
        name: 'send_message',
        input: { target: '#chat', text: 'hi' },
      },
      // Truncated JSON must not take the whole turn down.
      { id: 'call_2', name: 'list_channels', input: {} },
    ]);
  });

  it('splits a round trip into assistant tool_calls and role:tool results', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ choices: [{ message: { content: 'you are in #chat' } }] }),
    );

    await openAICompatProvider.chat(
      provider({}),
      'k',
      ROUND_TRIP,
      { tools: TOOLS },
      signal(),
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages[1].tool_calls[0].function.arguments).toBe('{}');
    expect(body.messages[2]).toEqual({
      role: 'tool',
      tool_call_id: 'call_1',
      content: '#chat, #dev',
    });
  });
});

describe('tool calling — Anthropic shape', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
  });

  it('declares tools with input_schema', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ content: [{ type: 'text', text: 'ok' }] }),
    );

    await anthropicProvider.chat(
      provider({ kind: 'anthropic' }),
      'k',
      [{ role: 'user', content: 'hi' }],
      { tools: TOOLS },
      signal(),
    );

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).tools[0]).toEqual({
      name: 'list_channels',
      description: 'List joined channels',
      input_schema: TOOLS[0].inputSchema,
    });
  });

  it('reads tool_use blocks out of the assistant content', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        content: [
          { type: 'text', text: 'let me look' },
          {
            type: 'tool_use',
            id: 'toolu_1',
            name: 'list_channels',
            input: {},
          },
        ],
      }),
    );

    const result = await anthropicProvider.chat(
      provider({ kind: 'anthropic' }),
      'k',
      [{ role: 'user', content: 'hi' }],
      { tools: TOOLS },
      signal(),
    );

    expect(result.text).toBe('let me look');
    expect(result.toolCalls).toEqual([
      { id: 'toolu_1', name: 'list_channels', input: {} },
    ]);
  });

  it('keeps a turn whole, unlike the OpenAI shape', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ content: [{ type: 'text', text: 'done' }] }),
    );

    await anthropicProvider.chat(
      provider({ kind: 'anthropic' }),
      'k',
      ROUND_TRIP,
      { tools: TOOLS },
      signal(),
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages[1]).toEqual({
      role: 'assistant',
      content: [
        { type: 'tool_use', id: 'call_1', name: 'list_channels', input: {} },
      ],
    });
    expect(body.messages[2]).toEqual({
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'call_1',
          content: '#chat, #dev',
        },
      ],
    });
  });

  it('marks a failed tool result as an error', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ content: [{ type: 'text', text: 'ok' }] }),
    );

    await anthropicProvider.chat(
      provider({ kind: 'anthropic' }),
      'k',
      [
        {
          role: 'user',
          content: '',
          toolResults: [
            {
              toolCallId: 'call_1',
              name: 'send_message',
              content: 'not connected',
              isError: true,
            },
          ],
        },
      ],
      { tools: TOOLS },
      signal(),
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages[0].content[0].is_error).toBe(true);
  });
});

describe('tool calling — Gemini shape', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
  });

  it('wraps declarations in a single tools entry', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }),
    );

    await geminiProvider.chat(
      provider({ kind: 'gemini', baseUrl: undefined, model: 'gemini-flash' }),
      'k',
      [{ role: 'user', content: 'hi' }],
      { tools: TOOLS },
      signal(),
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.tools).toHaveLength(1);
    expect(body.tools[0].functionDeclarations).toHaveLength(2);
  });

  it('synthesizes an id, because this API sends none', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        candidates: [
          {
            content: {
              parts: [
                { functionCall: { name: 'list_channels', args: { a: 1 } } },
              ],
            },
          },
        ],
      }),
    );

    const result = await geminiProvider.chat(
      provider({ kind: 'gemini', baseUrl: undefined, model: 'gemini-flash' }),
      'k',
      [{ role: 'user', content: 'hi' }],
      { tools: TOOLS },
      signal(),
    );

    expect(result.toolCalls).toEqual([
      { id: 'list_channels_0', name: 'list_channels', input: { a: 1 } },
    ]);
  });

  it('returns results as functionResponse keyed by name', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }),
    );

    await geminiProvider.chat(
      provider({ kind: 'gemini', baseUrl: undefined, model: 'gemini-flash' }),
      'k',
      ROUND_TRIP,
      { tools: TOOLS },
      signal(),
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.contents[2].parts[0].functionResponse).toEqual({
      name: 'list_channels',
      response: { content: '#chat, #dev' },
    });
  });
});

describe('AIService with tools', () => {
  let fetchMock: jest.Mock;

  beforeEach(async () => {
    (AsyncStorage as any).__reset();
    (Keychain as any).__reset();
    aiProviderStore.resetForTests();
    aiService.resetForTests();
    fetchMock = jest
      .fn()
      .mockResolvedValue(
        jsonResponse({ choices: [{ message: { content: 'ok' } }] }),
      );
    (global as any).fetch = fetchMock;
    await aiService.setConsent(true);
    await aiProviderStore.add(
      {
        name: 'OpenAI',
        kind: 'openai-compatible',
        baseUrl: 'https://api.openai.com/v1',
        model: 'm',
      } as any,
      'k',
    );
  });

  it('forwards tools to the adapter', async () => {
    await aiService.chat([{ role: 'user', content: 'hi' }], { tools: TOOLS });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).tools).toHaveLength(2);
  });

  it('stops pseudonymizing nicks when tools are present', async () => {
    await aiService.chat([{ role: 'user', content: '<alice> hi' }], {
      tools: TOOLS,
    });

    // An agent told to message "user1" could not act on it.
    const content = JSON.parse(fetchMock.mock.calls[0][1].body).messages[0]
      .content;
    expect(content).toBe('<alice> hi');
  });

  it('still strips hostmasks and IPs when tools are present', async () => {
    await aiService.chat(
      [{ role: 'user', content: 'alice!u@h.example.com on 10.0.0.9' }],
      { tools: TOOLS },
    );

    const content = JSON.parse(fetchMock.mock.calls[0][1].body).messages[0]
      .content;
    expect(content).toBe('[hostmask] on [ip]');
  });

  it('still pseudonymizes when no tools are in play', async () => {
    await aiService.chat([{ role: 'user', content: '<alice> hi' }]);

    const content = JSON.parse(fetchMock.mock.calls[0][1].body).messages[0]
      .content;
    expect(content).toBe('<user1> hi');
  });

  it('passes tool calls back to the caller', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  id: 'c1',
                  function: { name: 'list_channels', arguments: '{}' },
                },
              ],
            },
          },
        ],
      }),
    );

    const result = await aiService.chat([{ role: 'user', content: 'hi' }], {
      tools: TOOLS,
    });

    expect(result.toolCalls).toEqual([
      { id: 'c1', name: 'list_channels', input: {} },
    ]);
  });
});

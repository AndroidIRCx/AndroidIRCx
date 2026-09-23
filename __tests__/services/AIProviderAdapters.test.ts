/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { anthropicProvider } from '../../src/services/ai/providers/AnthropicProvider';
import { geminiProvider } from '../../src/services/ai/providers/GeminiProvider';
import { AIProvider } from '../../src/services/ai/types';

const jsonResponse = (body: unknown, ok = true, status = 200) =>
  ({
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }) as unknown as Response;

const signal = () => new AbortController().signal;

const baseProvider = (overrides: Partial<AIProvider>): AIProvider => ({
  id: 'p1',
  name: 'Provider',
  kind: 'anthropic',
  model: 'claude-opus-5',
  hasKey: true,
  maxTokens: 512,
  enabled: true,
  ...overrides,
});

describe('AnthropicProvider', () => {
  const provider = baseProvider({ kind: 'anthropic' });
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
  });

  it('sends the documented headers and required max_tokens', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        content: [{ type: 'text', text: 'hello' }],
        model: 'claude-opus-5',
        usage: { input_tokens: 9, output_tokens: 2 },
      }),
    );

    const result = await anthropicProvider.chat(
      provider,
      'sk-ant-key',
      [{ role: 'user', content: 'hi' }],
      {},
      signal(),
    );

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(init.headers['x-api-key']).toBe('sk-ant-key');
    expect(init.headers['anthropic-version']).toBe('2023-06-01');
    // A browser-CORS header has no business in React Native.
    expect(
      init.headers['anthropic-dangerous-direct-browser-access'],
    ).toBeUndefined();
    expect(JSON.parse(init.body).max_tokens).toBe(512);
    expect(result).toMatchObject({
      text: 'hello',
      usage: { inputTokens: 9, outputTokens: 2 },
    });
  });

  it('skips non-text blocks instead of reading content[0]', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        content: [
          { type: 'thinking', thinking: 'hmm' },
          { type: 'text', text: 'the real answer' },
        ],
      }),
    );

    const result = await anthropicProvider.chat(
      provider,
      'k',
      [{ role: 'user', content: 'hi' }],
      {},
      signal(),
    );

    expect(result.text).toBe('the real answer');
  });

  it('lifts the system prompt out of the message list', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ content: [{ type: 'text', text: 'ok' }] }),
    );

    await anthropicProvider.chat(
      provider,
      'k',
      [
        { role: 'system', content: 'from message' },
        { role: 'user', content: 'hi' },
      ],
      { system: 'from options' },
      signal(),
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    // This API rejects a role:"system" message; it takes a top-level field.
    expect(body.messages).toEqual([{ role: 'user', content: 'hi' }]);
    expect(body.system).toBe('from options\nfrom message');
  });

  it('refuses to call without a key', async () => {
    await expect(
      anthropicProvider.chat(
        provider,
        null,
        [{ role: 'user', content: 'hi' }],
        {},
        signal(),
      ),
    ).rejects.toMatchObject({ code: 'missing_key' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('errors when the reply carries no text block', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ content: [{ type: 'thinking', thinking: 'only this' }] }),
    );

    await expect(
      anthropicProvider.chat(
        provider,
        'k',
        [{ role: 'user', content: 'hi' }],
        {},
        signal(),
      ),
    ).rejects.toMatchObject({ code: 'provider_error' });
  });

  it('lists models for the key', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        data: [{ id: 'claude-sonnet-5' }, { id: 'claude-opus-5' }],
      }),
    );

    const models = await anthropicProvider.listModels(provider, 'k', signal());

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.anthropic.com/v1/models?limit=1000',
    );
    expect(models).toEqual(['claude-opus-5', 'claude-sonnet-5']);
  });

  it('follows the pages instead of stopping at the first one', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          data: [{ id: 'claude-opus-5' }],
          has_more: true,
          last_id: 'claude-opus-5',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ data: [{ id: 'claude-sonnet-5' }], has_more: false }),
      );

    const models = await anthropicProvider.listModels(provider, 'k', signal());

    // Reading only the first page is why the list arrived short.
    expect(fetchMock.mock.calls[1][0]).toContain('after_id=claude-opus-5');
    expect(models).toEqual(['claude-opus-5', 'claude-sonnet-5']);
  });
});

describe('GeminiProvider', () => {
  const provider = baseProvider({ kind: 'gemini', model: 'gemini-flash' });
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
  });

  it('posts to the qualified model endpoint with the key in the query', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        candidates: [{ content: { parts: [{ text: 'hello' }] } }],
        usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 1 },
      }),
    );

    const result = await geminiProvider.chat(
      provider,
      'api-key-123',
      [{ role: 'user', content: 'hi' }],
      { maxTokens: 64 },
      signal(),
    );

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash:generateContent?key=api-key-123',
    );
    expect(JSON.parse(init.body).generationConfig.maxOutputTokens).toBe(64);
    expect(result).toMatchObject({
      text: 'hello',
      usage: { inputTokens: 4, outputTokens: 1 },
    });
  });

  it('renames the assistant turn to "model" and lifts the system prompt', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }),
    );

    await geminiProvider.chat(
      provider,
      'k',
      [
        { role: 'user', content: 'first' },
        { role: 'assistant', content: 'second' },
      ],
      { system: 'be brief' },
      signal(),
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.contents).toEqual([
      { role: 'user', parts: [{ text: 'first' }] },
      { role: 'model', parts: [{ text: 'second' }] },
    ]);
    expect(body.systemInstruction).toEqual({ parts: [{ text: 'be brief' }] });
  });

  it('does not double-prefix a model the user stored qualified', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }),
    );

    await geminiProvider.chat(
      { ...provider, model: 'models/gemini-flash' },
      'k',
      [{ role: 'user', content: 'hi' }],
      {},
      signal(),
    );

    expect(fetchMock.mock.calls[0][0]).toContain(
      '/v1beta/models/gemini-flash:',
    );
  });

  it('joins multi-part answers', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        candidates: [
          { content: { parts: [{ text: 'one ' }, { text: 'two' }] } },
        ],
      }),
    );

    const result = await geminiProvider.chat(
      provider,
      'k',
      [{ role: 'user', content: 'hi' }],
      {},
      signal(),
    );

    expect(result.text).toBe('one two');
  });

  it('refuses to call without a key', async () => {
    await expect(
      geminiProvider.listModels(provider, null, signal()),
    ).rejects.toMatchObject({ code: 'missing_key' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('lists only models that can answer a chat request', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        models: [
          {
            name: 'models/gemini-pro',
            supportedGenerationMethods: ['generateContent'],
          },
          {
            name: 'models/text-embedding',
            supportedGenerationMethods: ['embedContent'],
          },
        ],
      }),
    );

    const models = await geminiProvider.listModels(provider, 'k', signal());

    // An embedding model would fail at request time with an error the user
    // could not diagnose, so it must never be offered.
    expect(models).toEqual(['gemini-pro']);
  });

  it('carries a thought signature back into the next round', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        candidates: [
          {
            content: {
              parts: [
                {
                  functionCall: { name: 'list_networks', args: {} },
                  thoughtSignature: 'sig-abc',
                },
              ],
            },
          },
        ],
      }),
    );

    const first = await geminiProvider.chat(
      provider,
      'k',
      [{ role: 'user', content: 'which networks?' }],
      { tools: [] },
      signal(),
    );
    expect(first.toolCalls?.[0].providerSignature).toBe('sig-abc');

    // Replaying the turn without it is rejected outright with "Function call
    // is missing a thought_signature", which makes tool use impossible.
    await geminiProvider.chat(
      provider,
      'k',
      [
        { role: 'user', content: 'which networks?' },
        { role: 'assistant', content: '', toolCalls: first.toolCalls },
      ],
      { tools: [] },
      signal(),
    );

    const body = JSON.parse(fetchMock.mock.calls[1][1].body);
    const modelTurn = body.contents.find((c: any) => c.role === 'model');
    expect(modelTurn.parts[0].thoughtSignature).toBe('sig-abc');
  });

  it('omits the signature field when the model sent none', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ candidates: [] }));

    await geminiProvider
      .chat(
        provider,
        'k',
        [
          { role: 'user', content: 'hi' },
          {
            role: 'assistant',
            content: '',
            toolCalls: [{ id: 'a_0', name: 'a', input: {} }],
          },
        ],
        { tools: [] },
        signal(),
      )
      .catch(() => undefined);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const modelTurn = body.contents.find((c: any) => c.role === 'model');
    expect(modelTurn.parts[0]).not.toHaveProperty('thoughtSignature');
  });

  it('follows the pages instead of stopping at the first one', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          models: [{ name: 'models/gemini-1.5-pro' }],
          nextPageToken: 'page-2',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ models: [{ name: 'models/gemini-2.5-pro' }] }),
      );

    const models = await geminiProvider.listModels(provider, 'k', signal());

    expect(fetchMock.mock.calls[1][0]).toContain('pageToken=page-2');
    // And the newer one is offered first, rather than alphabetically.
    expect(models).toEqual(['gemini-2.5-pro', 'gemini-1.5-pro']);
  });
});

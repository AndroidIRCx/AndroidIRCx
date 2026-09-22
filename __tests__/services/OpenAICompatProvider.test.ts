/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { openAICompatProvider } from '../../src/services/ai/providers/OpenAICompatProvider';
import { AIError, AIProvider } from '../../src/services/ai/types';

const provider: AIProvider = {
  id: 'p1',
  name: 'OpenAI',
  kind: 'openai-compatible',
  baseUrl: 'https://api.openai.com/v1',
  model: 'some-model',
  hasKey: true,
  maxTokens: 512,
  enabled: true,
};

const jsonResponse = (body: unknown, ok = true, status = 200) =>
  ({
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }) as unknown as Response;

const signal = () => new AbortController().signal;

describe('OpenAICompatProvider', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
  });

  it('posts to /chat/completions with a bearer token and parses the reply', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        choices: [{ message: { content: 'hello there' } }],
        model: 'resolved-model',
        usage: { prompt_tokens: 12, completion_tokens: 3 },
      }),
    );

    const result = await openAICompatProvider.chat(
      provider,
      'sk-key',
      [{ role: 'user', content: 'hi' }],
      { maxTokens: 64, system: 'be brief' },
      signal(),
    );

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(init.headers.authorization).toBe('Bearer sk-key');

    const body = JSON.parse(init.body);
    expect(body.max_tokens).toBe(64);
    // The system prompt is prepended as a message, not a separate field.
    expect(body.messages).toEqual([
      { role: 'system', content: 'be brief' },
      { role: 'user', content: 'hi' },
    ]);

    expect(result).toMatchObject({
      text: 'hello there',
      model: 'resolved-model',
      providerId: 'p1',
      usage: { inputTokens: 12, outputTokens: 3 },
    });
  });

  it('omits the auth header for a keyless local provider', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ choices: [{ message: { content: 'ok' } }] }),
    );

    await openAICompatProvider.chat(
      { ...provider, kind: 'local', baseUrl: 'http://192.168.1.10:11434/v1' },
      null,
      [{ role: 'user', content: 'hi' }],
      {},
      signal(),
    );

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://192.168.1.10:11434/v1/chat/completions');
    expect(init.headers.authorization).toBeUndefined();
  });

  it('falls back to the provider maxTokens when none is given', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ choices: [{ message: { content: 'ok' } }] }),
    );

    await openAICompatProvider.chat(
      provider,
      'sk-key',
      [{ role: 'user', content: 'hi' }],
      {},
      signal(),
    );

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).max_tokens).toBe(512);
  });

  it('maps a 401 to auth_failed and surfaces the provider message', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { message: 'Incorrect API key' } }, false, 401),
    );

    await expect(
      openAICompatProvider.chat(
        provider,
        'bad',
        [{ role: 'user', content: 'hi' }],
        {},
        signal(),
      ),
    ).rejects.toMatchObject({
      code: 'auth_failed',
      status: 401,
      message: expect.stringContaining('Incorrect API key'),
    });
  });

  it('maps 429 and 5xx to distinct codes', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, false, 429));
    await expect(
      openAICompatProvider.listModels(provider, 'k', signal()),
    ).rejects.toMatchObject({ code: 'rate_limited' });

    fetchMock.mockResolvedValue(jsonResponse({}, false, 503));
    await expect(
      openAICompatProvider.listModels(provider, 'k', signal()),
    ).rejects.toMatchObject({ code: 'provider_error' });
  });

  it('reports a timeout when the request is aborted', async () => {
    const abortError = new Error('Aborted');
    abortError.name = 'AbortError';
    fetchMock.mockRejectedValue(abortError);

    await expect(
      openAICompatProvider.listModels(provider, 'k', signal()),
    ).rejects.toMatchObject({ code: 'timeout' });
  });

  it('reports a network error when fetch rejects', async () => {
    fetchMock.mockRejectedValue(new Error('Connection refused'));

    await expect(
      openAICompatProvider.listModels(provider, 'k', signal()),
    ).rejects.toMatchObject({ code: 'network' });
  });

  it('throws when the response carries no message content', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ choices: [] }));

    await expect(
      openAICompatProvider.chat(
        provider,
        'k',
        [{ role: 'user', content: 'hi' }],
        {},
        signal(),
      ),
    ).rejects.toBeInstanceOf(AIError);
  });

  it('lists models from data[].id, sorted', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ data: [{ id: 'zeta' }, { id: 'alpha' }] }),
    );

    const models = await openAICompatProvider.listModels(
      provider,
      'k',
      signal(),
    );

    expect(fetchMock.mock.calls[0][0]).toBe('https://api.openai.com/v1/models');
    expect(models).toEqual(['alpha', 'zeta']);
  });

  it('falls back to the Ollama-native models[].name shape', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ models: [{ name: 'llama3' }, { name: 'gemma' }] }),
    );

    expect(
      await openAICompatProvider.listModels(provider, null, signal()),
    ).toEqual(['gemma', 'llama3']);
  });

  it('fails clearly when a provider has no base URL', async () => {
    await expect(
      openAICompatProvider.listModels(
        { ...provider, baseUrl: undefined },
        'k',
        signal(),
      ),
    ).rejects.toMatchObject({ code: 'invalid_request' });
  });
});

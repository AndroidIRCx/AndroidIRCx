/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  getJson,
  isContextOverflow,
} from '../../src/services/ai/providers/httpJson';

const failing = (status: number, body: unknown) =>
  ({
    ok: false,
    status,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  }) as unknown as Response;

const signal = () => new AbortController().signal;

describe('isContextOverflow', () => {
  it.each([
    // OpenAI and DeepSeek
    "This model's maximum context length is 131072 tokens.",
    'context_length_exceeded',
    // Anthropic
    'prompt is too long: 250000 tokens > 200000 maximum',
    // Gemini
    'The input token count (2000000) exceeds the maximum number of tokens allowed (1048576).',
    // OpenRouter, vLLM and friends
    'Request exceeds the context window of this model',
    'Please reduce the length of the messages or completion.',
  ])('recognises "%s"', message => {
    expect(isContextOverflow(400, message)).toBe(true);
  });

  it('counts a 413 too', () => {
    expect(isContextOverflow(413, 'too many tokens')).toBe(true);
  });

  it('leaves other failures alone', () => {
    expect(isContextOverflow(400, 'invalid model name')).toBe(false);
    expect(isContextOverflow(500, 'maximum context length')).toBe(false);
    expect(isContextOverflow(429, 'too many tokens per minute')).toBe(false);
  });
});

describe('a provider saying the request is too long', () => {
  afterEach(() => {
    delete (global as any).fetch;
  });

  it('becomes prompt_too_long, so the assistant can make room', async () => {
    (global as any).fetch = jest.fn(async () =>
      failing(400, {
        error: {
          message: "This model's maximum context length is 131072 tokens.",
          code: 'context_length_exceeded',
        },
      }),
    );

    await expect(
      getJson('https://x/models', {}, signal()),
    ).rejects.toMatchObject({
      code: 'prompt_too_long',
      message: expect.stringContaining('context window is full'),
    });
  });

  it('is found in the error code when the message does not say it', async () => {
    (global as any).fetch = jest.fn(async () =>
      failing(400, {
        error: { message: 'Bad request', code: 'context_length_exceeded' },
      }),
    );

    await expect(getJson('https://x', {}, signal())).rejects.toMatchObject({
      code: 'prompt_too_long',
    });
  });

  it('keeps an ordinary bad request as one', async () => {
    (global as any).fetch = jest.fn(async () =>
      failing(400, { error: { message: 'unknown parameter' } }),
    );

    await expect(getJson('https://x', {}, signal())).rejects.toMatchObject({
      code: 'invalid_request',
    });
  });
});

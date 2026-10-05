/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Context windows, in input tokens, for models whose provider does not report
 * one.
 *
 * Anthropic and Gemini answer this through their model APIs, and so do
 * OpenRouter, vLLM, LM Studio and llama.cpp. OpenAI and DeepSeek do not: their
 * `/models` lists ids and nothing else. This table covers those.
 *
 * Matched by prefix, longest first, so `gpt-4o-mini` and `gpt-4o` can differ
 * from `gpt-4`. A model newer than this table falls through to the fixed
 * default, which is safe; the user can always pick a size by hand.
 */
const WINDOWS: Array<[string, number]> = [
  // OpenAI
  ['gpt-5', 272000],
  ['gpt-4.1', 1047576],
  ['gpt-4o', 128000],
  ['gpt-4-turbo', 128000],
  ['gpt-4', 8192],
  ['gpt-3.5-turbo', 16385],
  ['chatgpt-4o', 128000],
  ['o1', 200000],
  ['o3', 200000],
  ['o4', 200000],
  // DeepSeek
  ['deepseek', 128000],
  // Fallbacks for when the model API is unreachable.
  ['claude-haiku-4-5', 200000],
  ['claude-3', 200000],
  ['claude', 1000000],
  ['gemini', 1048576],
  // Common open models served through OpenAI-compatible hosts.
  ['llama-3', 128000],
  ['mistral-large', 128000],
  ['qwen', 128000],
];
/** Longest prefix first, so the most specific entry wins. */
const KNOWN_WINDOWS = [...WINDOWS].sort((a, b) => b[0].length - a[0].length);

/**
 * The window for a model id, or null when it is not one we know.
 *
 * Strips a routing prefix first (`openai/gpt-4o` on OpenRouter, `models/` on
 * Gemini), so the same model is recognised whoever serves it.
 */
export function knownContextWindow(model: string): number | null {
  const id = (model || '').toLowerCase().split('/').pop() ?? '';
  if (!id) return null;
  for (const [prefix, tokens] of KNOWN_WINDOWS) {
    if (id.startsWith(prefix)) return tokens;
  }
  return null;
}

/** A positive integer, or null — provider fields are not to be trusted. */
export function tokenCount(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) && n > 0
    ? Math.floor(n)
    : null;
}

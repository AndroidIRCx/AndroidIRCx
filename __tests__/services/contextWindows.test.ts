/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  knownContextWindow,
  tokenCount,
} from '../../src/services/ai/contextWindows';

describe('knownContextWindow', () => {
  it('knows the models whose providers do not say', () => {
    expect(knownContextWindow('deepseek-chat')).toBe(128000);
    expect(knownContextWindow('deepseek-reasoner')).toBe(128000);
    expect(knownContextWindow('gpt-4o')).toBe(128000);
    expect(knownContextWindow('gpt-5-mini')).toBe(272000);
    expect(knownContextWindow('o3-mini')).toBe(200000);
  });

  it('prefers the longest matching prefix', () => {
    expect(knownContextWindow('gpt-4')).toBe(8192);
    expect(knownContextWindow('gpt-4-turbo')).toBe(128000);
    expect(knownContextWindow('gpt-4.1-mini')).toBe(1047576);
    expect(knownContextWindow('claude-haiku-4-5')).toBe(200000);
  });

  it('ignores a routing prefix and case', () => {
    expect(knownContextWindow('openai/GPT-4o')).toBe(128000);
    expect(knownContextWindow('models/gemini-2.5-pro')).toBe(1048576);
  });

  it('returns null for a model it does not know', () => {
    expect(knownContextWindow('my-local-model')).toBeNull();
    expect(knownContextWindow('')).toBeNull();
  });
});

describe('tokenCount', () => {
  it('accepts positive numbers and numeric strings only', () => {
    expect(tokenCount(4096)).toBe(4096);
    expect(tokenCount('8192')).toBe(8192);
    expect(tokenCount(0)).toBeNull();
    expect(tokenCount(-1)).toBeNull();
    expect(tokenCount('lots')).toBeNull();
    expect(tokenCount(undefined)).toBeNull();
  });
});

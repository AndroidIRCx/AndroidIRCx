/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

jest.mock('../../src/services/Logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  aiMemoryService,
  MAX_INJECTED_CHARS,
  MAX_MEMORIES,
  MAX_MEMORY_CHARS,
} from '../../src/services/ai/AIMemoryService';

describe('AIMemoryService', () => {
  beforeEach(async () => {
    (AsyncStorage as any).__reset?.();
    jest.clearAllMocks();
    aiMemoryService.resetForTests();
    await aiMemoryService.load();
  });

  it('remembers a fact and gives it back', async () => {
    await aiMemoryService.remember('runs the #dev channel', 'person');

    expect(aiMemoryService.list()).toEqual([
      expect.objectContaining({
        text: 'runs the #dev channel',
        category: 'person',
      }),
    ]);
  });

  it('does not store the same fact twice', async () => {
    await aiMemoryService.remember('prefers short answers', 'preference');
    const second = await aiMemoryService.remember(
      'Prefers Short Answers',
      'preference',
    );

    // Repeating a fact across conversations is normal; filling the store with
    // copies of it is not.
    expect(second).toBeNull();
    expect(aiMemoryService.list()).toHaveLength(1);
  });

  it('ignores an empty fact', async () => {
    expect(await aiMemoryService.remember('   ')).toBeNull();
    expect(aiMemoryService.list()).toHaveLength(0);
  });

  it('files an unknown category under other', async () => {
    const entry = await aiMemoryService.remember('something', 'nonsense');

    expect(entry?.category).toBe('other');
  });

  it('caps one entry, and the number of them', async () => {
    const long = await aiMemoryService.remember(
      'x'.repeat(MAX_MEMORY_CHARS + 50),
    );
    expect(long?.text.length).toBe(MAX_MEMORY_CHARS);

    for (let i = 0; i < MAX_MEMORIES + 5; i += 1) {
      await aiMemoryService.remember(`fact number ${i}`);
    }
    expect(aiMemoryService.list().length).toBe(MAX_MEMORIES);
  });

  it('forgets one on request', async () => {
    const entry = await aiMemoryService.remember('wrong thing');

    expect(await aiMemoryService.forget(entry!.id)).toBe(true);
    expect(aiMemoryService.list()).toHaveLength(0);
    // Forgetting something that is not there is not an error worth throwing.
    expect(await aiMemoryService.forget('nope')).toBe(false);
  });

  it('searches on every word', async () => {
    await aiMemoryService.remember('works on the AndroidIRCX client');
    await aiMemoryService.remember('likes the dark theme');

    expect(aiMemoryService.search('androidircx client')).toHaveLength(1);
    expect(aiMemoryService.search('theme')).toHaveLength(1);
    expect(aiMemoryService.search('androidircx theme')).toHaveLength(0);
  });

  describe('what reaches the prompt', () => {
    it('says nothing when there is nothing remembered', () => {
      expect(aiMemoryService.promptBlock()).toBe('');
    });

    it('lists what it knows', async () => {
      await aiMemoryService.remember('runs #dev', 'person');

      const block = aiMemoryService.promptBlock();
      expect(block).toContain('runs #dev');
      expect(block).toContain('(person)');
    });

    it('says nothing at all while memory is switched off', async () => {
      await aiMemoryService.remember('runs #dev');
      await aiMemoryService.setEnabled(false);

      // The switch has to stop it reaching the provider, not merely hide the
      // list in settings.
      expect(aiMemoryService.promptBlock()).toBe('');
    });

    it('caps how much of the store it injects', async () => {
      for (let i = 0; i < 60; i += 1) {
        await aiMemoryService.remember(
          `a reasonably long remembered fact ${i}`,
        );
      }

      // A prompt made mostly of remembered trivia crowds out the conversation
      // it is supposed to help with.
      expect(aiMemoryService.promptBlock().length).toBeLessThan(
        MAX_INJECTED_CHARS + 400,
      );
    });
  });

  it('survives a corrupt store', async () => {
    await (AsyncStorage as any).setItem('@AndroidIRCX:aiMemories', 'not-json');
    aiMemoryService.resetForTests();

    await aiMemoryService.load();

    expect(aiMemoryService.list()).toEqual([]);
  });
});

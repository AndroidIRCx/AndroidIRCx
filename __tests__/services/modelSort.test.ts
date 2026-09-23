/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  compareModelIds,
  sortModelIds,
} from '../../src/services/ai/providers/modelSort';

describe('sortModelIds', () => {
  it('puts the newer version first', () => {
    // Plain alphabetical sorting is what these lists used to do, and it opens
    // the picker on the oldest model the provider still offers.
    expect(
      sortModelIds(['gemini-1.5-pro', 'gemini-2.5-pro', 'gemini-2.0-pro']),
    ).toEqual(['gemini-2.5-pro', 'gemini-2.0-pro', 'gemini-1.5-pro']);
  });

  it('compares version numbers as numbers, not as text', () => {
    // '10' sorts before '9' alphabetically, which is the wrong way round.
    expect(sortModelIds(['thing-9', 'thing-10'])).toEqual([
      'thing-10',
      'thing-9',
    ]);
  });

  it('keeps families together', () => {
    const sorted = sortModelIds([
      'gpt-4o',
      'claude-sonnet-5',
      'gpt-5',
      'claude-opus-5',
    ]);

    expect(sorted.indexOf('claude-opus-5')).toBeLessThan(
      sorted.indexOf('gpt-5'),
    );
    expect(sorted.indexOf('claude-sonnet-5')).toBeLessThan(
      sorted.indexOf('gpt-5'),
    );
  });

  it('offers the plain name before its variants', () => {
    expect(sortModelIds(['gpt-4-turbo', 'gpt-4'])).toEqual([
      'gpt-4',
      'gpt-4-turbo',
    ]);
  });

  it('drops duplicates a page boundary can produce', () => {
    expect(sortModelIds(['a-1', 'a-1', 'a-2'])).toEqual(['a-2', 'a-1']);
  });

  it('falls back to alphabetical when there is no version at all', () => {
    expect(sortModelIds(['llama', 'mistral', 'gemma'])).toEqual([
      'gemma',
      'llama',
      'mistral',
    ]);
  });

  it('is a total order, so the sort is stable across engines', () => {
    expect(compareModelIds('a-1', 'a-1')).toBe(0);
    expect(compareModelIds('a-2', 'a-1')).toBeLessThan(0);
    expect(compareModelIds('a-1', 'a-2')).toBeGreaterThan(0);
  });
});

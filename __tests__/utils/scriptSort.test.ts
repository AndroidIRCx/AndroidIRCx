/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { isScriptSortOrder, sortScripts } from '../../src/utils/scriptSort';

const script = (id: string, name: string, enabled: boolean) => ({
  id,
  name,
  enabled,
  code: '',
});

const scripts = [
  script('b', 'beta', false),
  script('a', 'Alpha', true),
  script('c', 'charlie', true),
  script('d', 'delta', false),
];

describe('sortScripts', () => {
  it('puts enabled scripts first, then by name', () => {
    expect(sortScripts(scripts, 'enabled').map(s => s.id)).toEqual([
      'a',
      'c',
      'b',
      'd',
    ]);
  });

  it('sorts by name case-insensitively', () => {
    expect(sortScripts(scripts, 'name').map(s => s.id)).toEqual([
      'a',
      'b',
      'c',
      'd',
    ]);
  });

  it('puts the scripts that used the most time first', () => {
    const cost = new Map([
      ['d', 900],
      ['c', 40],
    ]);
    expect(sortScripts(scripts, 'slowest', cost).map(s => s.id)).toEqual([
      'd',
      'c',
      'a',
      'b',
    ]);
  });

  it('does not change the input array', () => {
    const before = scripts.map(s => s.id);
    sortScripts(scripts, 'name');
    expect(scripts.map(s => s.id)).toEqual(before);
  });

  it('recognises stored sort orders', () => {
    expect(isScriptSortOrder('slowest')).toBe(true);
    expect(isScriptSortOrder('size')).toBe(false);
    expect(isScriptSortOrder(undefined)).toBe(false);
  });
});

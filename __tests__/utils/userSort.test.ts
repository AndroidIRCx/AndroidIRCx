/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { highestUserMode, sortUsersByRank } from '../../src/utils/userSort';

const u = (nick: string, modes: string[] = []) => ({ nick, modes });

describe('userSort', () => {
  it('picks the highest prefix mode and ignores others', () => {
    expect(highestUserMode(['v', 'o'])).toBe('o');
    expect(highestUserMode(['v', 'q', 'a'])).toBe('q');
    expect(highestUserMode(['x'])).toBeUndefined();
    expect(highestUserMode([])).toBeUndefined();
  });

  it('sorts by rank, then nick case-insensitively, then exact nick', () => {
    const sorted = sortUsersByRank([
      u('zed'),
      u('Bob', ['v']),
      u('alice', ['o']),
      u('Carl'),
      u('carl'),
      u('owner', ['q']),
      u('odd', ['x']),
    ]);
    expect(sorted.map(x => x.nick)).toEqual([
      'owner',
      'alice',
      'Bob',
      'Carl',
      'carl',
      'odd',
      'zed',
    ]);
  });

  it('sorts a 2000-user channel quickly and leaves the input untouched', () => {
    const users = Array.from({ length: 2000 }, (_, i) =>
      u(`user${(i * 7919) % 2000}`, i % 50 === 0 ? ['o'] : []),
    );
    const before = users.map(x => x.nick);
    const started = Date.now();
    const sorted = sortUsersByRank(users);
    expect(Date.now() - started).toBeLessThan(500);
    expect(users.map(x => x.nick)).toEqual(before);
    expect(sorted.slice(0, 40).every(x => x.modes.includes('o'))).toBe(true);
    expect(sorted[40].modes).toEqual([]);
  });
});

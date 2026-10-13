/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { ChannelUser } from '../services/IRCService';
import { compareStrings } from './localeSafe';

const MODE_RANK: { [mode: string]: number } = {
  q: 0, // owner
  a: 1, // admin
  o: 2, // operator
  h: 3, // halfop
  v: 4, // voice
};

/** The user's highest prefix mode (q > a > o > h > v), if any. */
export const highestUserMode = (modes: string[]): string | undefined => {
  let best: string | undefined;
  for (const mode of modes) {
    if (
      MODE_RANK[mode] !== undefined &&
      (best === undefined || MODE_RANK[mode] < MODE_RANK[best])
    ) {
      best = mode;
    }
  }
  return best;
};

/** Mode rank first, then nick case-insensitively (ties: exact nick). */
export const sortUsersByRank = (users: ChannelUser[]): ChannelUser[] =>
  users
    .map(user => {
      const mode = highestUserMode(user.modes);
      return {
        user,
        rank: mode === undefined ? 99 : MODE_RANK[mode],
        folded: user.nick.toLowerCase(),
      };
    })
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        compareStrings(a.folded, b.folded) ||
        compareStrings(a.user.nick, b.user.nick),
    )
    .map(entry => entry.user);

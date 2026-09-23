/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Ordering for the model lists every adapter returns.
 *
 * Plain alphabetical sorting is what these lists used to do, and it reads
 * backwards: `gemini-1.5-pro` lands above `gemini-2.5-pro`, and a list of
 * twenty models opens on the oldest one. The numbers in a model id are
 * versions, so they are compared as numbers and the higher one comes first.
 *
 * This is a heuristic over names a provider chose, not a claim about which
 * model is better. Where a provider's naming carries no version at all the
 * order falls back to alphabetical, which is no worse than before.
 */

/** Split "gemini-2.5-pro" into ['gemini', 2, 5, 'pro']. */
function chunks(id: string): Array<string | number> {
  return id
    .toLowerCase()
    .split(/(\d+)/)
    .map(part => part.replace(/[^a-z0-9]+/g, ''))
    .filter(part => part.length > 0)
    .map(part => (/^\d+$/.test(part) ? Number(part) : part));
}

export function compareModelIds(a: string, b: string): number {
  const left = chunks(a);
  const right = chunks(b);
  const length = Math.min(left.length, right.length);

  for (let i = 0; i < length; i += 1) {
    const x = left[i];
    const y = right[i];
    if (x === y) continue;
    if (typeof x === 'number' && typeof y === 'number') {
      // Descending: a higher version number is the newer model.
      return y - x;
    }
    if (typeof x === 'number') return -1;
    if (typeof y === 'number') return 1;
    return x < y ? -1 : 1;
  }

  // A prefix of the other, e.g. "gpt-4" against "gpt-4-turbo": the plain one
  // first, because it is the name someone is most likely looking for.
  if (left.length !== right.length) return left.length - right.length;
  return a < b ? -1 : a > b ? 1 : 0;
}

export function sortModelIds(ids: string[]): string[] {
  // De-duplicate as well: a paginated list can repeat an entry if a page
  // boundary moves between requests.
  return Array.from(new Set(ids)).sort(compareModelIds);
}

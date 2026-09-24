/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * What an addon is allowed to call a file.
 *
 * Pure and dependency-free, because this is the boundary that decides whether
 * an addon stays inside its own directory. It is used for workspace paths,
 * packaged asset names and ZIP entry names alike — one rule, tested once,
 * rather than three nearly-identical checks that drift apart.
 *
 * Everything is rejected unless it is plainly safe. A path this refuses might
 * have been fine; a path it lets through must not be able to leave.
 */

export const MAX_PATH_CHARS = 200;
export const MAX_SEGMENT_CHARS = 100;
export const MAX_PATH_DEPTH = 8;

export type PathRejection =
  | 'empty'
  | 'too-long'
  | 'absolute'
  | 'traversal'
  | 'illegal-character'
  | 'reserved-name'
  | 'too-deep'
  | 'segment-too-long';

export interface PathResult {
  ok: boolean;
  /** Normalized, relative, forward-slashed. Present only when ok. */
  path?: string;
  reason?: PathRejection;
}

/**
 * Names Windows refuses regardless of extension. Android does not care, but an
 * addon workspace gets exported, zipped and opened on a desktop, and a file
 * nobody can extract is a support problem rather than a security one.
 */
const RESERVED = new Set([
  'con',
  'prn',
  'aux',
  'nul',
  'com1',
  'com2',
  'com3',
  'com4',
  'com5',
  'com6',
  'com7',
  'com8',
  'com9',
  'lpt1',
  'lpt2',
  'lpt3',
  'lpt4',
  'lpt5',
  'lpt6',
  'lpt7',
  'lpt8',
  'lpt9',
]);

export function normalizeAddonPath(input: unknown): PathResult {
  if (typeof input !== 'string' || input.trim().length === 0)
    return { ok: false, reason: 'empty' };
  if (input.length > MAX_PATH_CHARS) return { ok: false, reason: 'too-long' };

  // A backslash is rejected rather than translated: on Android it is a legal
  // filename character, so translating it would let `a\..\b` mean one thing
  // here and another on a desktop that opens the exported folder.
  if (/[\\\0]/.test(input)) return { ok: false, reason: 'illegal-character' };
  // Control characters have no legitimate place in a name an addon chose.
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(input))
    return { ok: false, reason: 'illegal-character' };
  if (input.startsWith('/')) return { ok: false, reason: 'absolute' };
  // No separate drive-letter rule: a colon is illegal in every segment below,
  // so `C:/Windows` and `C:` are both already refused. One rule beats two that
  // can disagree.

  const segments = input.split('/').filter(segment => segment !== '');
  if (segments.length === 0) return { ok: false, reason: 'empty' };
  if (segments.length > MAX_PATH_DEPTH)
    return { ok: false, reason: 'too-deep' };

  for (const segment of segments) {
    // `.` and `..` are refused outright rather than resolved. Resolving means
    // deciding what `a/../../b` means, and the honest answer is that no addon
    // needed to write it.
    if (segment === '.' || segment === '..')
      return { ok: false, reason: 'traversal' };
    if (segment.length > MAX_SEGMENT_CHARS)
      return { ok: false, reason: 'segment-too-long' };
    // A trailing dot or space is silently stripped by Windows, which turns two
    // different names into one file.
    if (/[. ]$/.test(segment))
      return { ok: false, reason: 'illegal-character' };
    if (/[<>:"|?*]/.test(segment))
      return { ok: false, reason: 'illegal-character' };
    const base = segment.split('.')[0].toLowerCase();
    if (RESERVED.has(base)) return { ok: false, reason: 'reserved-name' };
  }

  return { ok: true, path: segments.join('/') };
}

/**
 * Join a validated relative path onto a root, and check the result again.
 *
 * The second check is deliberate belt and braces: `normalizeAddonPath` should
 * already make escape impossible, but this is the function whose output gets
 * handed to the filesystem, and a bug here has consequences a bug in a
 * validator does not.
 */
export function resolveWithinRoot(
  root: string,
  relative: string,
): { ok: boolean; absolute?: string; reason?: PathRejection } {
  const checked = normalizeAddonPath(relative);
  if (!checked.ok) return { ok: false, reason: checked.reason };

  const base = root.endsWith('/') ? root : `${root}/`;
  const absolute = `${base}${checked.path}`;
  if (!absolute.startsWith(base) || absolute.includes('/../'))
    return { ok: false, reason: 'traversal' };
  return { ok: true, absolute };
}

/**
 * Whether a ZIP entry may be extracted — the zip-slip check.
 *
 * A directory entry is allowed through with `ok: false` and no reason so the
 * caller can skip it silently; anything else that fails is a refusal worth
 * reporting.
 */
export function isSafeArchiveEntry(name: unknown): boolean {
  if (typeof name === 'string' && name.endsWith('/')) return false;
  return normalizeAddonPath(name).ok;
}

/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * Hostmask matching for the addon platform. Pure, so it can be tested and
 * reused without dragging a service in.
 *
 * `UserManagementService` has its own older private matcher for blacklists.
 * It is deliberately left alone: it does not implement `?`, and giving it full
 * IRC semantics would silently change which users existing blacklist entries
 * match. That is a user-visible behaviour change and does not belong in this
 * sprint.
 */

export interface MaskParts {
  nick: string;
  ident: string;
  host: string;
}

/** Split `nick!ident@host`, tolerating the shorter forms people actually type. */
export function parseMask(mask: string): MaskParts {
  const trimmed = (mask ?? '').trim();
  if (!trimmed) return { nick: '*', ident: '*', host: '*' };

  if (trimmed.includes('!')) {
    const [nick, rest = ''] = splitOnce(trimmed, '!');
    const [ident, host] = rest.includes('@')
      ? splitOnce(rest, '@')
      : [rest, '*'];
    return {
      nick: nick || '*',
      ident: ident || '*',
      host: host || '*',
    };
  }
  if (trimmed.includes('@')) {
    const [ident, host] = splitOnce(trimmed, '@');
    return { nick: '*', ident: ident || '*', host: host || '*' };
  }
  // A bare word is a nick pattern, which is how people write /ignore fred.
  return { nick: trimmed, ident: '*', host: '*' };
}

function splitOnce(value: string, separator: string): [string, string] {
  const index = value.indexOf(separator);
  return index === -1
    ? [value, '']
    : [value.slice(0, index), value.slice(index + 1)];
}

/**
 * IRC wildcards: `*` is any run of characters, `?` is exactly one. Matching is
 * case-insensitive, which is what the protocol says for nicks and what every
 * server does in practice for the rest of the mask.
 */
export function matchesWildcard(value: string, pattern: string): boolean {
  if (pattern === '*') return true;
  if (!value) return false;
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const expression = escaped.replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${expression}$`, 'i').test(value);
}

/**
 * Whether a user matches a mask. A component the user does not have (no host
 * yet, for instance) matches only `*`: claiming a match on data we do not have
 * would make a ban look like it covers someone it does not.
 */
export function matchesHostmask(
  user: { nick?: string; ident?: string; host?: string },
  mask: string,
): boolean {
  const parts = parseMask(mask);
  return (
    matchPart(user.nick, parts.nick) &&
    matchPart(user.ident, parts.ident) &&
    matchPart(user.host, parts.host)
  );
}

function matchPart(value: string | undefined, pattern: string): boolean {
  if (pattern === '*' || pattern === '') return true;
  if (!value) return false;
  return matchesWildcard(value, pattern);
}

/**
 * IRC nicks are case-insensitive. `rfc1459` folds `[]\~` onto `{}|^` as well,
 * which older networks still use; `ascii` is the modern default. The token
 * comes from ISUPPORT CASEMAPPING.
 */
export function foldNick(
  nick: string,
  casemapping: string = 'rfc1459',
): string {
  const lower = (nick ?? '').toLowerCase();
  if (casemapping === 'ascii') return lower;
  // rfc1459 and rfc1459-strict differ only in whether ~ folds to ^.
  const folded = lower
    .replace(/\[/g, '{')
    .replace(/\]/g, '}')
    .replace(/\\/g, '|');
  return casemapping === 'rfc1459-strict' ? folded : folded.replace(/~/g, '^');
}

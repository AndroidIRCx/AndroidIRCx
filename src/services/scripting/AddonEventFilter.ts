/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import type { AddonEventEnvelope } from './AddonEventEnvelope';

export type AddonEventPattern = string | { regex: string; flags?: 'i' | '' };

export interface AddonEventFilter {
  event?: AddonEventPattern | AddonEventPattern[];
  network?: AddonEventPattern;
  channel?: AddonEventPattern;
  sender?: AddonEventPattern;
  account?: AddonEventPattern;
  hostmask?: AddonEventPattern;
  self?: boolean;
  server?: boolean;
  playback?: boolean;
  notSelf?: boolean;
  requireOp?: boolean;
}

export interface AddonEventFilterContext {
  ownNick?: string;
}

export type CompiledAddonEventFilter = (
  event: Readonly<AddonEventEnvelope>,
) => boolean;

const MAX_PATTERN_LENGTH = 128;
const MAX_MATCH_INPUT = 512;

/** Compiles and validates a filter once, never on the IRC message hot path. */
export function compileAddonEventFilter(
  filter: AddonEventFilter,
  context: AddonEventFilterContext = {},
): CompiledAddonEventFilter {
  if (!filter || typeof filter !== 'object' || Array.isArray(filter))
    throw new Error('Addon event filter must be an object.');
  const events = array(filter.event).map(pattern =>
    compilePattern(pattern, context),
  );
  const network = optional(filter.network, context);
  const channel = optional(filter.channel, context);
  const senderIsMe = filter.sender === '$me';
  const sender = senderIsMe ? undefined : optional(filter.sender, context);
  const account = optional(filter.account, context);
  const hostmask = optional(filter.hostmask, context);

  return event => {
    if (events.length > 0 && !events.some(match => match(event.type)))
      return false;
    if (network && !network(event.network ?? '')) return false;
    if (channel && !channel(event.channel ?? '')) return false;
    if (sender && !sender(event.sender.nick ?? '')) return false;
    if (senderIsMe && !event.origin.self) return false;
    if (account && !account(event.sender.account ?? '')) return false;
    if (
      hostmask &&
      !hostmask(
        `${event.sender.nick ?? ''}!${event.sender.ident ?? ''}@${event.sender.host ?? ''}`,
      )
    )
      return false;
    if (filter.self !== undefined && event.origin.self !== filter.self)
      return false;
    if (filter.server !== undefined && event.origin.server !== filter.server)
      return false;
    if (
      filter.playback !== undefined &&
      event.origin.playback !== filter.playback
    )
      return false;
    if (filter.notSelf === true && event.origin.self) return false;
    if (
      filter.requireOp === true &&
      !(
        event.payload &&
        typeof event.payload === 'object' &&
        !Array.isArray(event.payload) &&
        event.payload.senderIsOp === true
      )
    )
      return false;
    return true;
  };
}

function array(
  value: AddonEventPattern | AddonEventPattern[] | undefined,
): AddonEventPattern[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function optional(
  value: AddonEventPattern | undefined,
  context: AddonEventFilterContext,
): ((input: string) => boolean) | undefined {
  return value === undefined ? undefined : compilePattern(value, context);
}

function compilePattern(
  pattern: AddonEventPattern,
  context: AddonEventFilterContext,
): (input: string) => boolean {
  if (typeof pattern === 'string') {
    const expanded = pattern === '$me' ? context.ownNick : pattern;
    if (!expanded)
      throw new Error('The $me pattern requires event sender context.');
    assertPatternLength(expanded);
    const source = expanded
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    const regex = new RegExp(`^${source}$`, 'i');
    return input => regex.test(input.slice(0, MAX_MATCH_INPUT));
  }
  if (!pattern || typeof pattern !== 'object' || Array.isArray(pattern))
    throw new Error('Addon event pattern is invalid.');
  assertPatternLength(pattern.regex);
  if (
    pattern.flags !== undefined &&
    pattern.flags !== '' &&
    pattern.flags !== 'i'
  )
    throw new Error('Addon event regex flags are invalid.');
  assertSafeRegex(pattern.regex);
  let regex: RegExp;
  try {
    regex = new RegExp(pattern.regex, pattern.flags ?? 'i');
  } catch {
    throw new Error('Addon event regex is invalid.');
  }
  return input => regex.test(input.slice(0, MAX_MATCH_INPUT));
}

function assertPatternLength(pattern: string): void {
  if (
    typeof pattern !== 'string' ||
    pattern.length === 0 ||
    pattern.length > MAX_PATTERN_LENGTH
  )
    throw new Error('Addon event pattern length is invalid.');
}

function assertSafeRegex(source: string): void {
  if (
    /\\[1-9]/.test(source) ||
    /\(\?<([=!])/.test(source) ||
    /\([^)]*[+*][^)]*\)[+*{]/.test(source) ||
    /(?:\.\*|\.\+){2,}/.test(source)
  )
    throw new Error('Addon event regex is unsafe.');
}

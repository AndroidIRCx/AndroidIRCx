/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import { foldNick, matchesHostmask } from './AddonUserMask';

/**
 * Where a fact came from, weakest first. The whole point of tracking this is
 * the merge rule below: a nick seen in a NAMES list must never overwrite an
 * ident and host that a WHOIS established, or the record degrades every time
 * someone rejoins.
 */
export type UserFactSource =
  'names' | 'message' | 'mode' | 'join' | 'who' | 'whois';

const SOURCE_STRENGTH: Readonly<Record<UserFactSource, number>> = Object.freeze(
  { names: 1, message: 2, mode: 2, join: 3, who: 4, whois: 5 },
);

/** A user off every shared channel is kept this long before being dropped. */
export const ORPHAN_GRACE_MS = 5 * 60_000;
/** One refresh per nick per network in this window, however many ask. */
export const REFRESH_COOLDOWN_MS = 30_000;
export const MAX_FIND_RESULTS = 200;
const MAX_USERS_PER_NETWORK = 5000;

export interface UserFactProvenance {
  source: UserFactSource;
  at: number;
}

export interface AddonUserRecord {
  nick: string;
  ident?: string;
  host?: string;
  /** `null` means the server said this user is logged out, which is a fact. */
  account?: string | null;
  certfp?: string;
  realname?: string;
  away?: boolean;
  awayMessage?: string;
  idleSeconds?: number;
  server?: string;
  /** Channel name (as seen) to the prefix modes held there. */
  channelModes: Record<string, string[]>;
  channels: string[];
  lastSeen: number;
  provenance: Record<string, UserFactProvenance>;
}

export interface UserFacts {
  nick?: string;
  ident?: string;
  host?: string;
  account?: string | null;
  certfp?: string;
  realname?: string;
  away?: boolean;
  awayMessage?: string;
  idleSeconds?: number;
  server?: string;
}

export interface UserFindFilters {
  account?: string;
  certfp?: string;
  channel?: string;
  away?: boolean;
  limit?: number;
}

interface NetworkState {
  users: Map<string, AddonUserRecord>;
  orphanedAt: Map<string, number>;
  refreshedAt: Map<string, number>;
  casemapping: string;
}

/**
 * The addon platform's Internal Address List — mIRC's `$ial`, with the parts
 * that make it trustworthy written down.
 *
 * Every read is a cache read. Nothing here sends IRC traffic; `shouldRefresh`
 * only reports whether a caller is *allowed* to ask, and the caller does the
 * asking. A read helper that quietly fired a WHO would let one addon ask a
 * question and produce thousands of lines of server traffic.
 */
export class AddonIALService {
  private networks = new Map<string, NetworkState>();

  // ─────────────────────────────────────────────────────── ingestion ──

  setCasemapping(networkId: string, casemapping: string): void {
    this.state(networkId).casemapping = casemapping || 'rfc1459';
  }

  /**
   * Merge facts about a user. A fact from a weaker source never overwrites one
   * a stronger source established; an equal-or-stronger source always wins,
   * because the newer observation is the more current one.
   */
  observe(
    networkId: string,
    nick: string,
    facts: UserFacts,
    source: UserFactSource,
    at: number = Date.now(),
  ): AddonUserRecord | undefined {
    if (!nick) return undefined;
    const state = this.state(networkId);
    const key = foldNick(nick, state.casemapping);
    let record = state.users.get(key);
    if (!record) {
      if (state.users.size >= MAX_USERS_PER_NETWORK) this.evictOldest(state);
      record = {
        nick,
        channelModes: {},
        channels: [],
        lastSeen: at,
        provenance: {},
      };
      state.users.set(key, record);
    }

    // The nick itself always tracks the latest spelling: case can change and
    // the fold key is what identifies the user.
    record.nick = facts.nick ?? nick;
    record.lastSeen = Math.max(record.lastSeen, at);

    for (const field of FACT_FIELDS) {
      const value = facts[field];
      if (value === undefined) continue;
      const existing = record.provenance[field];
      if (
        existing &&
        SOURCE_STRENGTH[existing.source] > SOURCE_STRENGTH[source]
      )
        continue;
      assignFact(record, field, value);
      record.provenance[field] = { source, at };
    }
    return record;
  }

  /** A NAMES/WHO snapshot of one channel, replacing that channel's membership. */
  syncChannel(
    networkId: string,
    channel: string,
    members: ReadonlyArray<{
      nick: string;
      modes?: string[];
      ident?: string;
      host?: string;
      account?: string;
    }>,
    at: number = Date.now(),
  ): void {
    const state = this.state(networkId);
    const present = new Set<string>();

    for (const member of members) {
      if (!member?.nick) continue;
      const record = this.observe(
        networkId,
        member.nick,
        {
          ident: member.ident,
          host: member.host,
          account: member.account,
        },
        'names',
        at,
      );
      if (!record) continue;
      const key = foldNick(member.nick, state.casemapping);
      present.add(key);
      record.channelModes[channel] = [...(member.modes ?? [])];
      if (!record.channels.includes(channel)) record.channels.push(channel);
      state.orphanedAt.delete(key);
    }

    // Anyone previously in this channel and missing from the snapshot left it
    // while we were not looking.
    for (const [key, record] of state.users) {
      if (present.has(key) || !record.channels.includes(channel)) continue;
      this.detach(state, key, record, channel, at);
    }
  }

  join(
    networkId: string,
    nick: string,
    channel: string,
    facts: UserFacts = {},
    at: number = Date.now(),
  ): void {
    const record = this.observe(networkId, nick, facts, 'join', at);
    if (!record) return;
    if (!record.channels.includes(channel)) record.channels.push(channel);
    record.channelModes[channel] ??= [];
    this.state(networkId).orphanedAt.delete(
      foldNick(nick, this.state(networkId).casemapping),
    );
  }

  part(
    networkId: string,
    nick: string,
    channel: string,
    at: number = Date.now(),
  ): void {
    const state = this.state(networkId);
    const key = foldNick(nick, state.casemapping);
    const record = state.users.get(key);
    if (record) this.detach(state, key, record, channel, at);
  }

  quit(networkId: string, nick: string, at: number = Date.now()): void {
    const state = this.state(networkId);
    const key = foldNick(nick, state.casemapping);
    if (!state.users.has(key)) return;
    // A quit is definite, but the record is kept through the grace window so a
    // script reacting to the quit can still ask who it was.
    state.orphanedAt.set(key, at);
    const record = state.users.get(key);
    if (record) {
      record.channels = [];
      record.channelModes = {};
    }
  }

  rename(
    networkId: string,
    oldNick: string,
    newNick: string,
    at: number = Date.now(),
  ): void {
    const state = this.state(networkId);
    const oldKey = foldNick(oldNick, state.casemapping);
    const record = state.users.get(oldKey);
    if (!record) return;
    const newKey = foldNick(newNick, state.casemapping);
    state.users.delete(oldKey);
    record.nick = newNick;
    record.lastSeen = at;
    // Everything else survives: a nick change does not change who someone is,
    // which is exactly why account and certfp are the facts worth trusting.
    state.users.set(newKey, record);
    const orphaned = state.orphanedAt.get(oldKey);
    state.orphanedAt.delete(oldKey);
    if (orphaned !== undefined) state.orphanedAt.set(newKey, orphaned);
  }

  setChannelModes(
    networkId: string,
    nick: string,
    channel: string,
    modes: string[],
    at: number = Date.now(),
  ): void {
    const record = this.observe(networkId, nick, {}, 'mode', at);
    if (!record) return;
    record.channelModes[channel] = [...modes];
    if (!record.channels.includes(channel)) record.channels.push(channel);
  }

  // ───────────────────────────────────────────────────────── queries ──

  get(networkId: string, nick: string): AddonUserRecord | undefined {
    const state = this.state(networkId);
    const record = state.users.get(foldNick(nick, state.casemapping));
    return record ? clone(record) : undefined;
  }

  onChannel(networkId: string, channel: string): AddonUserRecord[] {
    return [...this.state(networkId).users.values()]
      .filter(record => record.channels.includes(channel))
      .map(clone);
  }

  sharedChannels(networkId: string, nick: string): string[] {
    return this.get(networkId, nick)?.channels ?? [];
  }

  /** Bounded by construction: an addon cannot ask for the whole network. */
  find(
    networkId: string,
    mask: string,
    filters: UserFindFilters = {},
  ): AddonUserRecord[] {
    const limit = Math.min(
      Math.max(1, filters.limit ?? MAX_FIND_RESULTS),
      MAX_FIND_RESULTS,
    );
    const results: AddonUserRecord[] = [];
    for (const record of this.state(networkId).users.values()) {
      if (results.length >= limit) break;
      if (mask && mask !== '*' && !matchesHostmask(record, mask)) continue;
      if (filters.account !== undefined && record.account !== filters.account)
        continue;
      if (filters.certfp !== undefined && record.certfp !== filters.certfp)
        continue;
      if (filters.channel && !record.channels.includes(filters.channel))
        continue;
      if (filters.away !== undefined && record.away !== filters.away) continue;
      results.push(clone(record));
    }
    return results;
  }

  /**
   * Whether a caller may send a WHO/WHOIS for this nick now. This service never
   * sends anything itself; it only holds the throttle, so every path that can
   * cause server traffic shares one budget.
   */
  shouldRefresh(
    networkId: string,
    nick: string,
    at: number = Date.now(),
  ): boolean {
    const state = this.state(networkId);
    const key = foldNick(nick, state.casemapping);
    const last = state.refreshedAt.get(key);
    if (last !== undefined && at - last < REFRESH_COOLDOWN_MS) return false;
    state.refreshedAt.set(key, at);
    return true;
  }

  /** Drop records orphaned longer than the grace window. */
  prune(at: number = Date.now()): number {
    let removed = 0;
    for (const state of this.networks.values()) {
      for (const [key, orphanedAt] of [...state.orphanedAt]) {
        if (at - orphanedAt < ORPHAN_GRACE_MS) continue;
        state.users.delete(key);
        state.orphanedAt.delete(key);
        state.refreshedAt.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  clearNetwork(networkId: string): void {
    this.networks.delete(networkId);
  }

  resetForTests(): void {
    this.networks.clear();
  }

  size(networkId: string): number {
    return this.state(networkId).users.size;
  }

  // ───────────────────────────────────────────────────────── internal ──

  private detach(
    state: NetworkState,
    key: string,
    record: AddonUserRecord,
    channel: string,
    at: number,
  ): void {
    record.channels = record.channels.filter(name => name !== channel);
    delete record.channelModes[channel];
    if (record.channels.length === 0) state.orphanedAt.set(key, at);
  }

  private evictOldest(state: NetworkState): void {
    let oldestKey: string | undefined;
    let oldestSeen = Infinity;
    for (const [key, record] of state.users) {
      if (record.lastSeen < oldestSeen) {
        oldestSeen = record.lastSeen;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      state.users.delete(oldestKey);
      state.orphanedAt.delete(oldestKey);
      state.refreshedAt.delete(oldestKey);
    }
  }

  private state(networkId: string): NetworkState {
    let state = this.networks.get(networkId);
    if (!state) {
      state = {
        users: new Map(),
        orphanedAt: new Map(),
        refreshedAt: new Map(),
        casemapping: 'rfc1459',
      };
      this.networks.set(networkId, state);
    }
    return state;
  }
}

const FACT_FIELDS = [
  'ident',
  'host',
  'account',
  'certfp',
  'realname',
  'away',
  'awayMessage',
  'idleSeconds',
  'server',
] as const satisfies ReadonlyArray<keyof UserFacts>;

type FactField = (typeof FACT_FIELDS)[number];

/**
 * The fact fields are declared identically on both types, so this is a narrowing
 * TypeScript cannot do across an indexed union rather than a type mismatch.
 */
function assignFact<K extends FactField>(
  record: AddonUserRecord,
  field: K,
  value: UserFacts[K],
): void {
  record[field] = value as AddonUserRecord[K];
}

function clone(record: AddonUserRecord): AddonUserRecord {
  return {
    ...record,
    channels: [...record.channels],
    channelModes: Object.fromEntries(
      Object.entries(record.channelModes).map(([key, modes]) => [
        key,
        [...modes],
      ]),
    ),
    provenance: { ...record.provenance },
  };
}

export const addonIALService = new AddonIALService();

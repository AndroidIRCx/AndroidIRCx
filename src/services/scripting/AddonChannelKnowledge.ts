/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * Cached channel state for add-ons: modes, topic metadata and the mask lists.
 *
 * Every getter reads the cache. `shouldRefreshList` reports whether a caller
 * may ask the server, and the caller does the asking — a read helper that
 * quietly sent MODE #chan +b would let one innocent-looking question produce
 * thousands of lines of traffic on a large channel.
 */

/** The four mask lists servers keep. `quiet` is +q on the networks that have it. */
export type MaskListKind = 'ban' | 'except' | 'invite' | 'quiet';

export const MASK_LIST_KINDS: readonly MaskListKind[] = [
  'ban',
  'except',
  'invite',
  'quiet',
];

/** Per channel, per list. Long enough that a refresh loop cannot form. */
export const LIST_REFRESH_COOLDOWN_MS = 60_000;

export interface MaskListEntry {
  mask: string;
  /** Present only when the server sent it; many do not. */
  setBy?: string;
  setAt?: number;
}

export interface MaskListState {
  kind: MaskListKind;
  entries: MaskListEntry[];
  /** `unknown` means never fetched — not the same as "empty". */
  status: 'unknown' | 'loading' | 'cached';
  fetchedAt?: number;
}

export interface ChannelTopicState {
  text?: string;
  setBy?: string;
  setAt?: number;
}

export interface AddonChannelRecord {
  name: string;
  topic: ChannelTopicState;
  /** Mode letters currently set, without their parameters. */
  modes: string[];
  /** Parameterised modes, e.g. `{ l: '50', k: 'secret' }`. */
  modeParams: Record<string, string>;
  createdAt?: number;
  lists: Record<MaskListKind, MaskListState>;
}

interface NetworkChannels {
  channels: Map<string, AddonChannelRecord>;
  refreshedAt: Map<string, number>;
}

export class AddonChannelKnowledge {
  private networks = new Map<string, NetworkChannels>();

  // ─────────────────────────────────────────────────────── ingestion ──

  setTopic(
    networkId: string,
    channel: string,
    topic: ChannelTopicState,
    _at: number = Date.now(),
  ): void {
    const record = this.record(networkId, channel);
    // Merged rather than replaced: RPL_TOPIC and RPL_TOPICWHOTIME arrive as
    // two separate numerics, and the second must not erase the first.
    if (topic.text !== undefined) record.topic.text = topic.text;
    if (topic.setBy !== undefined) record.topic.setBy = topic.setBy;
    if (topic.setAt !== undefined) record.topic.setAt = topic.setAt;
  }

  setModes(
    networkId: string,
    channel: string,
    modes: string[],
    params: Record<string, string> = {},
  ): void {
    const record = this.record(networkId, channel);
    record.modes = [...new Set(modes)];
    record.modeParams = { ...params };
  }

  setCreatedAt(networkId: string, channel: string, createdAt: number): void {
    this.record(networkId, channel).createdAt = createdAt;
  }

  /** A list query started: entries arriving now replace what was cached. */
  beginList(networkId: string, channel: string, kind: MaskListKind): void {
    const list = this.record(networkId, channel).lists[kind];
    list.status = 'loading';
    list.entries = [];
  }

  addListEntry(
    networkId: string,
    channel: string,
    kind: MaskListKind,
    entry: MaskListEntry,
  ): void {
    if (!entry?.mask) return;
    const list = this.record(networkId, channel).lists[kind];
    // An entry arriving without a begin still counts: some servers replay a
    // list after a mode change without a fresh query.
    if (list.status === 'unknown') {
      list.status = 'loading';
      list.entries = [];
    }
    if (list.entries.some(existing => existing.mask === entry.mask)) return;
    list.entries.push({ ...entry });
  }

  endList(
    networkId: string,
    channel: string,
    kind: MaskListKind,
    at: number = Date.now(),
  ): void {
    const list = this.record(networkId, channel).lists[kind];
    list.status = 'cached';
    list.fetchedAt = at;
  }

  removeListEntry(
    networkId: string,
    channel: string,
    kind: MaskListKind,
    mask: string,
  ): void {
    const list = this.record(networkId, channel).lists[kind];
    list.entries = list.entries.filter(entry => entry.mask !== mask);
  }

  forgetChannel(networkId: string, channel: string): void {
    const state = this.networks.get(networkId);
    if (!state) return;
    const key = channel.toLowerCase();
    state.channels.delete(key);
    for (const kind of MASK_LIST_KINDS)
      state.refreshedAt.delete(`${key}:${kind}`);
  }

  clearNetwork(networkId: string): void {
    this.networks.delete(networkId);
  }

  // ───────────────────────────────────────────────────────── queries ──

  get(networkId: string, channel: string): AddonChannelRecord | undefined {
    const record = this.networks
      .get(networkId)
      ?.channels.get(channel.toLowerCase());
    return record ? clone(record) : undefined;
  }

  getList(
    networkId: string,
    channel: string,
    kind: MaskListKind,
  ): MaskListState {
    const record = this.networks
      .get(networkId)
      ?.channels.get(channel.toLowerCase());
    const list = record?.lists[kind];
    return list
      ? { ...list, entries: list.entries.map(entry => ({ ...entry })) }
      : { kind, entries: [], status: 'unknown' };
  }

  channels(networkId: string): string[] {
    return [...(this.networks.get(networkId)?.channels.values() ?? [])].map(
      record => record.name,
    );
  }

  /**
   * Whether a caller may query this list now. Network-aware and per list, so
   * asking for the ban list does not use up the exception list's budget.
   */
  shouldRefreshList(
    networkId: string,
    channel: string,
    kind: MaskListKind,
    at: number = Date.now(),
  ): boolean {
    const state = this.state(networkId);
    const key = `${channel.toLowerCase()}:${kind}`;
    const last = state.refreshedAt.get(key);
    if (last !== undefined && at - last < LIST_REFRESH_COOLDOWN_MS)
      return false;
    state.refreshedAt.set(key, at);
    return true;
  }

  resetForTests(): void {
    this.networks.clear();
  }

  // ───────────────────────────────────────────────────────── internal ──

  private record(networkId: string, channel: string): AddonChannelRecord {
    const state = this.state(networkId);
    const key = channel.toLowerCase();
    let record = state.channels.get(key);
    if (!record) {
      record = {
        name: channel,
        topic: {},
        modes: [],
        modeParams: {},
        lists: emptyLists(),
      };
      state.channels.set(key, record);
    }
    return record;
  }

  private state(networkId: string): NetworkChannels {
    let state = this.networks.get(networkId);
    if (!state) {
      state = { channels: new Map(), refreshedAt: new Map() };
      this.networks.set(networkId, state);
    }
    return state;
  }
}

function clone(record: AddonChannelRecord): AddonChannelRecord {
  return {
    ...record,
    topic: { ...record.topic },
    modes: [...record.modes],
    modeParams: { ...record.modeParams },
    lists: {
      ban: cloneList(record.lists.ban),
      except: cloneList(record.lists.except),
      invite: cloneList(record.lists.invite),
      quiet: cloneList(record.lists.quiet),
    },
  };
}

function emptyLists(): Record<MaskListKind, MaskListState> {
  const empty = (kind: MaskListKind): MaskListState => ({
    kind,
    entries: [],
    status: 'unknown',
  });
  return {
    ban: empty('ban'),
    except: empty('except'),
    invite: empty('invite'),
    quiet: empty('quiet'),
  };
}

function cloneList(list: MaskListState): MaskListState {
  return { ...list, entries: list.entries.map(entry => ({ ...entry })) };
}

export const addonChannelKnowledge = new AddonChannelKnowledge();

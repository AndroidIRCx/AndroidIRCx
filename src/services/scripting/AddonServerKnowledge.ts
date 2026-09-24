/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * What the app knows about the server itself: ISUPPORT, negotiated IRCv3
 * capabilities, and the mode/prefix mappings everything else depends on.
 *
 * Raw tokens are always kept alongside the parsed helpers. A server three
 * years from now will send a token this code has never heard of, and an addon
 * author should be able to read it without waiting for an app release.
 */

export interface PrefixMapping {
  /** Mode letter to prefix character, e.g. `o` → `@`. */
  modeToPrefix: Record<string, string>;
  /** Prefix character to mode letter, e.g. `@` → `o`. */
  prefixToMode: Record<string, string>;
  /** Mode letters strongest first, as the server ordered them. */
  order: string[];
}

export interface ChannelModeClasses {
  /** Type A: list modes, always take a parameter (b, e, I). */
  list: string[];
  /** Type B: always take a parameter (k). */
  parameterAlways: string[];
  /** Type C: take a parameter only when set (l). */
  parameterWhenSet: string[];
  /** Type D: never take a parameter (i, m, n, t). */
  noParameter: string[];
}

export interface AddonServerRecord {
  networkId: string;
  networkName?: string;
  serverName?: string;
  /** Every ISUPPORT token exactly as received, including unknown ones. */
  tokens: Record<string, string | true>;
  capabilities: string[];
  prefixes: PrefixMapping;
  channelModes: ChannelModeClasses;
  channelTypes: string[];
  casemapping: string;
  links: string[];
}

const DEFAULT_PREFIX = '(ov)@+';
const DEFAULT_CHANMODES = 'beI,k,l,imnpst';

export class AddonServerKnowledge {
  private servers = new Map<string, AddonServerRecord>();

  setISupport(networkId: string, tokens: Record<string, string | true>): void {
    const record = this.record(networkId);
    record.tokens = { ...tokens };
    record.prefixes = parsePrefix(asText(tokens.PREFIX) ?? DEFAULT_PREFIX);
    record.channelModes = parseChanModes(
      asText(tokens.CHANMODES) ?? DEFAULT_CHANMODES,
    );
    record.channelTypes = (asText(tokens.CHANTYPES) ?? '#&').split('');
    record.casemapping = (
      asText(tokens.CASEMAPPING) ?? 'rfc1459'
    ).toLowerCase();
    if (asText(tokens.NETWORK)) record.networkName = asText(tokens.NETWORK);
  }

  setCapabilities(networkId: string, capabilities: string[]): void {
    this.record(networkId).capabilities = [...capabilities];
  }

  setServerName(networkId: string, serverName: string): void {
    this.record(networkId).serverName = serverName;
  }

  setLinks(networkId: string, links: string[]): void {
    this.record(networkId).links = [...links];
  }

  get(networkId: string): AddonServerRecord {
    return clone(this.record(networkId));
  }

  /** A raw token, for anything this app does not parse. */
  token(networkId: string, name: string): string | true | undefined {
    return this.record(networkId).tokens[name.toUpperCase()];
  }

  /** Numeric ISUPPORT values, which are all sent as strings. */
  numericToken(networkId: string, name: string): number | undefined {
    const value = asText(this.token(networkId, name));
    if (value === undefined) return undefined;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  hasCapability(networkId: string, capability: string): boolean {
    return this.record(networkId).capabilities.includes(capability);
  }

  isChannel(networkId: string, target: string): boolean {
    const types = this.record(networkId).channelTypes;
    return !!target && types.includes(target[0]);
  }

  /** Split `@+fred` into its prefixes and the bare nick. */
  splitPrefixes(
    networkId: string,
    nameWithPrefixes: string,
  ): { modes: string[]; nick: string } {
    const { prefixToMode } = this.record(networkId).prefixes;
    let index = 0;
    const modes: string[] = [];
    while (
      index < nameWithPrefixes.length &&
      prefixToMode[nameWithPrefixes[index]]
    ) {
      modes.push(prefixToMode[nameWithPrefixes[index]]);
      index += 1;
    }
    return { modes, nick: nameWithPrefixes.slice(index) };
  }

  /** Whether a channel mode letter takes a parameter when being set. */
  modeTakesParameter(
    networkId: string,
    mode: string,
    adding: boolean,
  ): boolean {
    const classes = this.record(networkId).channelModes;
    if (classes.list.includes(mode)) return true;
    if (classes.parameterAlways.includes(mode)) return true;
    if (classes.parameterWhenSet.includes(mode)) return adding;
    return false;
  }

  clearNetwork(networkId: string): void {
    this.servers.delete(networkId);
  }

  resetForTests(): void {
    this.servers.clear();
  }

  private record(networkId: string): AddonServerRecord {
    let record = this.servers.get(networkId);
    if (!record) {
      record = {
        networkId,
        tokens: {},
        capabilities: [],
        prefixes: parsePrefix(DEFAULT_PREFIX),
        channelModes: parseChanModes(DEFAULT_CHANMODES),
        channelTypes: ['#', '&'],
        casemapping: 'rfc1459',
        links: [],
      };
      this.servers.set(networkId, record);
    }
    return record;
  }
}

/** `(ohv)@%+` → the two directions plus the server's own ordering. */
export function parsePrefix(value: string): PrefixMapping {
  const match = /^\(([^)]*)\)(.*)$/.exec(value.trim());
  const modes = match ? match[1] : '';
  const prefixes = match ? match[2] : '';
  const modeToPrefix: Record<string, string> = {};
  const prefixToMode: Record<string, string> = {};
  const order: string[] = [];
  // A server sending mismatched lengths is malformed; pair what lines up and
  // ignore the remainder rather than producing a half-built mapping.
  for (
    let index = 0;
    index < Math.min(modes.length, prefixes.length);
    index++
  ) {
    modeToPrefix[modes[index]] = prefixes[index];
    prefixToMode[prefixes[index]] = modes[index];
    order.push(modes[index]);
  }
  return { modeToPrefix, prefixToMode, order };
}

/** `beI,k,l,imnpst` → the four RFC classes. */
export function parseChanModes(value: string): ChannelModeClasses {
  const [list = '', always = '', whenSet = '', none = ''] = value
    .trim()
    .split(',');
  return {
    list: list.split(''),
    parameterAlways: always.split(''),
    parameterWhenSet: whenSet.split(''),
    noParameter: none.split(''),
  };
}

const asText = (value: string | true | undefined): string | undefined =>
  typeof value === 'string' ? value : undefined;

function clone(record: AddonServerRecord): AddonServerRecord {
  return {
    ...record,
    tokens: { ...record.tokens },
    capabilities: [...record.capabilities],
    prefixes: {
      modeToPrefix: { ...record.prefixes.modeToPrefix },
      prefixToMode: { ...record.prefixes.prefixToMode },
      order: [...record.prefixes.order],
    },
    channelModes: {
      list: [...record.channelModes.list],
      parameterAlways: [...record.channelModes.parameterAlways],
      parameterWhenSet: [...record.channelModes.parameterWhenSet],
      noParameter: [...record.channelModes.noParameter],
    },
    channelTypes: [...record.channelTypes],
    links: [...record.links],
  };
}

export const addonServerKnowledge = new AddonServerKnowledge();

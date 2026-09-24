/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import type { IRCMessage } from '../IRCService';
import { addonIALService, type AddonIALService } from './AddonIALService';
import {
  addonChannelKnowledge,
  type AddonChannelKnowledge,
  type MaskListKind,
} from './AddonChannelKnowledge';
import {
  addonServerKnowledge,
  type AddonServerKnowledge,
} from './AddonServerKnowledge';

/**
 * The one place ordinary IRC traffic becomes addon-visible state.
 *
 * It exists so the knowledge services stay free of IRC imports and the
 * lifecycle hook stays thin — and so mode parsing, which is the fiddly part,
 * is testable on its own rather than only through a rendered screen.
 */

/** Channel list modes we cache, keyed by their mode letter. */
const LIST_MODE_KINDS: Readonly<Record<string, MaskListKind>> = Object.freeze({
  b: 'ban',
  e: 'except',
  I: 'invite',
  q: 'quiet',
});

export class AddonKnowledgeFeed {
  constructor(
    private readonly ial: AddonIALService = addonIALService,
    private readonly channels: AddonChannelKnowledge = addonChannelKnowledge,
    private readonly servers: AddonServerKnowledge = addonServerKnowledge,
  ) {}

  /** Every parsed IRC message, after the app has handled it. */
  observeMessage(networkId: string, message: IRCMessage): void {
    if (!networkId || !message) return;
    const at = message.timestamp || Date.now();
    const facts = {
      ident: message.username,
      host: message.hostname,
      account: message.account,
    };

    switch (message.type) {
      case 'join':
        if (message.from && message.channel)
          this.ial.join(networkId, message.from, message.channel, facts, at);
        break;

      case 'part':
        if (message.from && message.channel)
          this.ial.part(networkId, message.from, message.channel, at);
        break;

      case 'kick':
        // `target` is who was kicked; `from` is who did it and is still here.
        if (message.target && message.channel)
          this.ial.part(networkId, message.target, message.channel, at);
        if (message.from)
          this.ial.observe(networkId, message.from, facts, 'message', at);
        break;

      case 'quit':
        if (message.from) this.ial.quit(networkId, message.from, at);
        break;

      case 'nick':
        if (message.oldNick && message.newNick)
          this.ial.rename(networkId, message.oldNick, message.newNick, at);
        break;

      case 'topic':
        if (message.channel)
          this.channels.setTopic(
            networkId,
            message.channel,
            { text: message.topic, setBy: message.from, setAt: at },
            at,
          );
        break;

      case 'mode':
        if (message.target && message.mode)
          this.applyModeChange(networkId, message.target, message.mode, at);
        if (message.from)
          this.ial.observe(networkId, message.from, facts, 'message', at);
        break;

      case 'message':
      case 'notice':
      case 'ctcp':
        if (message.from)
          this.ial.observe(networkId, message.from, facts, 'message', at);
        break;

      default:
        break;
    }
  }

  /**
   * Apply a MODE change, e.g. `+bo *!*@bad.example fred`.
   *
   * Which letters consume a parameter comes from the server's own CHANMODES
   * and PREFIX, not from a hardcoded list — the letters differ between
   * networks, and guessing wrong silently misaligns every parameter after the
   * one that was guessed.
   */
  applyModeChange(
    networkId: string,
    channel: string,
    modeText: string,
    at: number = Date.now(),
  ): void {
    if (!this.servers.isChannel(networkId, channel)) return;
    const [letters, ...params] = modeText.trim().split(/\s+/);
    if (!letters) return;

    const prefixModes = this.servers.get(networkId).prefixes.order;
    const current = this.channels.get(networkId, channel);
    const modes = new Set(current?.modes ?? []);
    const modeParams = { ...(current?.modeParams ?? {}) };

    let adding = true;
    let paramIndex = 0;
    const takeParam = (): string | undefined => params[paramIndex++];

    for (const letter of letters) {
      if (letter === '+') {
        adding = true;
        continue;
      }
      if (letter === '-') {
        adding = false;
        continue;
      }

      // PREFIX wins over CHANMODES. A letter the server calls a prefix is a
      // prefix, whatever it means elsewhere: `q` is owner on UnrealIRCd and a
      // quiet list on Charybdis, and only PREFIX distinguishes them.
      if (prefixModes.includes(letter)) {
        const nick = takeParam();
        if (nick)
          this.applyPrefixMode(networkId, channel, nick, letter, adding);
        continue;
      }

      const listKind = LIST_MODE_KINDS[letter];
      if (listKind) {
        const mask = takeParam();
        if (!mask) continue;
        if (adding)
          this.channels.addListEntry(networkId, channel, listKind, {
            mask,
            setBy: undefined,
            setAt: at,
          });
        else this.channels.removeListEntry(networkId, channel, listKind, mask);
        continue;
      }

      if (this.servers.modeTakesParameter(networkId, letter, adding)) {
        const value = takeParam();
        if (adding && value !== undefined) modeParams[letter] = value;
        else delete modeParams[letter];
      }

      if (adding) modes.add(letter);
      else {
        modes.delete(letter);
        delete modeParams[letter];
      }
    }

    this.channels.setModes(networkId, channel, [...modes], modeParams);
  }

  /** A NAMES reply, with the prefixes still attached to each name. */
  syncNames(
    networkId: string,
    channel: string,
    names: readonly string[],
    at: number = Date.now(),
  ): void {
    this.ial.syncChannel(
      networkId,
      channel,
      names.filter(Boolean).map(entry => {
        const { modes, nick } = this.servers.splitPrefixes(networkId, entry);
        // userhost-in-names gives `@nick!ident@host`, which is worth keeping.
        const [bareNick, rest] = nick.includes('!')
          ? [
              nick.slice(0, nick.indexOf('!')),
              nick.slice(nick.indexOf('!') + 1),
            ]
          : [nick, ''];
        const [ident, host] = rest.includes('@')
          ? [
              rest.slice(0, rest.indexOf('@')),
              rest.slice(rest.indexOf('@') + 1),
            ]
          : [undefined, undefined];
        return { nick: bareNick, modes, ident, host };
      }),
      at,
    );
  }

  setISupport(networkId: string, tokens: Record<string, string | true>): void {
    this.servers.setISupport(networkId, tokens);
    // The IAL keys users by folded nick, so it has to agree with the server
    // about what folding means or two spellings become two people.
    this.ial.setCasemapping(networkId, this.servers.get(networkId).casemapping);
  }

  /** A reconnect: channel membership is no longer true until NAMES arrives. */
  resetNetwork(networkId: string): void {
    this.ial.clearNetwork(networkId);
    this.channels.clearNetwork(networkId);
    this.servers.clearNetwork(networkId);
  }

  private applyPrefixMode(
    networkId: string,
    channel: string,
    nick: string,
    mode: string,
    adding: boolean,
  ): void {
    const existing = this.ial.get(networkId, nick)?.channelModes[channel] ?? [];
    const next = adding
      ? [...new Set([...existing, mode])]
      : existing.filter(entry => entry !== mode);
    this.ial.setChannelModes(networkId, nick, channel, next);
  }
}

export const addonKnowledgeFeed = new AddonKnowledgeFeed();

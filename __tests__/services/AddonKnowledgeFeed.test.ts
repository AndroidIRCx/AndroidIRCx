/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import type { IRCMessage } from '../../src/services/IRCService';
import { AddonIALService } from '../../src/services/scripting/AddonIALService';
import { AddonChannelKnowledge } from '../../src/services/scripting/AddonChannelKnowledge';
import { AddonServerKnowledge } from '../../src/services/scripting/AddonServerKnowledge';
import { AddonKnowledgeFeed } from '../../src/services/scripting/AddonKnowledgeFeed';

const NET = 'net1';

const message = (over: Partial<IRCMessage>): IRCMessage =>
  ({
    id: 'm1',
    type: 'message',
    text: '',
    timestamp: 1000,
    ...over,
  }) as IRCMessage;

describe('AddonKnowledgeFeed', () => {
  let ial: AddonIALService;
  let channels: AddonChannelKnowledge;
  let servers: AddonServerKnowledge;
  let feed: AddonKnowledgeFeed;

  beforeEach(() => {
    ial = new AddonIALService();
    channels = new AddonChannelKnowledge();
    servers = new AddonServerKnowledge();
    feed = new AddonKnowledgeFeed(ial, channels, servers);
    servers.setISupport(NET, {
      PREFIX: '(qaohv)~&@%+',
      CHANMODES: 'beIq,k,l,imnpst',
      CHANTYPES: '#',
    });
  });

  describe('membership from ordinary traffic', () => {
    it('records a join with the ident and host it carried', () => {
      feed.observeMessage(
        NET,
        message({
          type: 'join',
          from: 'fred',
          channel: '#a',
          username: 'f',
          hostname: 'h.example',
          account: 'fredacct',
        }),
      );

      const record = ial.get(NET, 'fred');
      expect(record?.channels).toEqual(['#a']);
      expect(record?.host).toBe('h.example');
      expect(record?.account).toBe('fredacct');
    });

    it('removes someone on part, and removes the kicked user on kick', () => {
      feed.observeMessage(
        NET,
        message({ type: 'join', from: 'fred', channel: '#a' }),
      );
      feed.observeMessage(
        NET,
        message({ type: 'join', from: 'barney', channel: '#a' }),
      );

      feed.observeMessage(
        NET,
        message({ type: 'part', from: 'fred', channel: '#a' }),
      );
      // On a kick, `from` is the operator and stays; `target` is who left.
      feed.observeMessage(
        NET,
        message({
          type: 'kick',
          from: 'wilma',
          target: 'barney',
          channel: '#a',
        }),
      );

      expect(ial.onChannel(NET, '#a')).toHaveLength(0);
      expect(ial.sharedChannels(NET, 'barney')).toEqual([]);
    });

    it('follows a nick change and forgets on quit', () => {
      feed.observeMessage(
        NET,
        message({
          type: 'join',
          from: 'fred',
          channel: '#a',
          hostname: 'h.example',
        }),
      );
      feed.observeMessage(
        NET,
        message({ type: 'nick', oldNick: 'fred', newNick: 'fred_' }),
      );

      expect(ial.get(NET, 'fred_')?.host).toBe('h.example');
      expect(ial.get(NET, 'fred_')?.channels).toEqual(['#a']);

      feed.observeMessage(NET, message({ type: 'quit', from: 'fred_' }));
      expect(ial.sharedChannels(NET, 'fred_')).toEqual([]);
    });

    it('learns ident and host from an ordinary message', () => {
      feed.observeMessage(
        NET,
        message({
          type: 'message',
          from: 'fred',
          username: 'f',
          hostname: 'h.example',
        }),
      );
      expect(ial.get(NET, 'fred')?.ident).toBe('f');
    });

    it('ignores traffic with no network or no sender', () => {
      feed.observeMessage('', message({ type: 'join', from: 'fred' }));
      feed.observeMessage(NET, message({ type: 'join', channel: '#a' }));
      expect(ial.size(NET)).toBe(0);
    });
  });

  describe('topic', () => {
    it('records the topic with who set it and when', () => {
      feed.observeMessage(
        NET,
        message({
          type: 'topic',
          channel: '#a',
          from: 'fred',
          topic: 'New topic',
          timestamp: 4242,
        }),
      );
      expect(channels.get(NET, '#a')?.topic).toEqual({
        text: 'New topic',
        setBy: 'fred',
        setAt: 4242,
      });
    });
  });

  describe('mode parsing', () => {
    it('applies a prefix mode to the right user', () => {
      feed.observeMessage(
        NET,
        message({ type: 'join', from: 'fred', channel: '#a' }),
      );
      feed.applyModeChange(NET, '#a', '+o fred');
      expect(ial.get(NET, 'fred')?.channelModes['#a']).toEqual(['o']);

      feed.applyModeChange(NET, '#a', '-o fred');
      expect(ial.get(NET, 'fred')?.channelModes['#a']).toEqual([]);
    });

    it('keeps multiple prefixes on one user', () => {
      feed.applyModeChange(NET, '#a', '+ov fred fred');
      expect(ial.get(NET, 'fred')?.channelModes['#a']).toEqual(['o', 'v']);
      feed.applyModeChange(NET, '#a', '-o fred');
      expect(ial.get(NET, 'fred')?.channelModes['#a']).toEqual(['v']);
    });

    it('pairs each parameter with the right letter in a mixed change', () => {
      feed.applyModeChange(NET, '#a', '+bo *!*@bad.example fred');

      // Guessing which letters take a parameter would misalign everything
      // after the first wrong guess.
      expect(channels.getList(NET, '#a', 'ban').entries[0].mask).toBe(
        '*!*@bad.example',
      );
      expect(ial.get(NET, 'fred')?.channelModes['#a']).toEqual(['o']);
    });

    it('reads q as a quiet list on a network that does not use it as a prefix', () => {
      // Charybdis shape: no q in PREFIX, q in the list class.
      servers.setISupport(NET, {
        PREFIX: '(ohv)@%+',
        CHANMODES: 'beIq,k,l,imnpst',
        CHANTYPES: '#',
      });
      feed.applyModeChange(NET, '#a', '+q *!*@quiet.example');

      expect(channels.getList(NET, '#a', 'quiet').entries).toEqual([
        {
          mask: '*!*@quiet.example',
          setBy: undefined,
          setAt: expect.any(Number),
        },
      ]);
    });

    it('reads q as an owner prefix when the server puts it in PREFIX', () => {
      // UnrealIRCd shape. PREFIX wins: a letter the server calls a prefix is
      // a prefix, whatever else it might mean elsewhere. No real network
      // declares the same letter both ways, but the precedence has to be
      // decided rather than left to whichever check happens to run first.
      feed.applyModeChange(NET, '#a', '+q fred');
      expect(ial.get(NET, 'fred')?.channelModes['#a']).toEqual(['q']);
      expect(channels.getList(NET, '#a', 'quiet').entries).toEqual([]);
    });

    it('stores a parameterised mode and drops the parameter when unset', () => {
      feed.applyModeChange(NET, '#a', '+l 50');
      expect(channels.get(NET, '#a')?.modeParams).toEqual({ l: '50' });
      expect(channels.get(NET, '#a')?.modes).toContain('l');

      // Type C takes no parameter when removed.
      feed.applyModeChange(NET, '#a', '-l');
      expect(channels.get(NET, '#a')?.modeParams).toEqual({});
      expect(channels.get(NET, '#a')?.modes).not.toContain('l');
    });

    it('toggles plain modes', () => {
      feed.applyModeChange(NET, '#a', '+nt');
      expect(channels.get(NET, '#a')?.modes.sort()).toEqual(['n', 't']);
      feed.applyModeChange(NET, '#a', '-n');
      expect(channels.get(NET, '#a')?.modes).toEqual(['t']);
    });

    it('removes a ban when it is unset', () => {
      feed.applyModeChange(NET, '#a', '+b *!*@bad.example');
      feed.applyModeChange(NET, '#a', '-b *!*@bad.example');
      expect(channels.getList(NET, '#a', 'ban').entries).toEqual([]);
    });

    it('ignores a user mode change addressed to a nick', () => {
      feed.applyModeChange(NET, 'fred', '+i');
      expect(channels.get(NET, 'fred')).toBeUndefined();
    });

    it('survives a mode string with missing parameters', () => {
      feed.applyModeChange(NET, '#a', '+bo');
      expect(channels.getList(NET, '#a', 'ban').entries).toEqual([]);
      expect(channels.get(NET, '#a')?.modes ?? []).toEqual([]);
    });

    it('routes a MODE message through the same parser', () => {
      feed.observeMessage(
        NET,
        message({
          type: 'mode',
          from: 'wilma',
          target: '#a',
          mode: '+o fred',
        }),
      );
      expect(ial.get(NET, 'fred')?.channelModes['#a']).toEqual(['o']);
    });
  });

  describe('NAMES', () => {
    it('splits prefixes using the server mapping', () => {
      feed.syncNames(NET, '#a', ['~fred', '@barney', 'wilma']);

      expect(ial.get(NET, 'fred')?.channelModes['#a']).toEqual(['q']);
      expect(ial.get(NET, 'barney')?.channelModes['#a']).toEqual(['o']);
      expect(ial.get(NET, 'wilma')?.channelModes['#a']).toEqual([]);
    });

    it('reads ident and host from userhost-in-names', () => {
      feed.syncNames(NET, '#a', ['@fred!f@h.example']);
      const record = ial.get(NET, 'fred');
      expect(record?.nick).toBe('fred');
      expect(record?.ident).toBe('f');
      expect(record?.host).toBe('h.example');
      expect(record?.channelModes['#a']).toEqual(['o']);
    });

    it('replaces the membership it was given', () => {
      feed.syncNames(NET, '#a', ['fred', 'barney']);
      feed.syncNames(NET, '#a', ['fred']);
      expect(ial.onChannel(NET, '#a').map(r => r.nick)).toEqual(['fred']);
    });
  });

  describe('server state', () => {
    it('teaches the IAL the casemapping the server announced', () => {
      feed.setISupport(NET, { CASEMAPPING: 'ascii' });
      ial.observe(NET, 'fred[x]', { host: 'h' }, 'whois');
      // Under ascii these are two different users.
      expect(ial.get(NET, 'fred{x}')).toBeUndefined();
    });

    it('clears everything for a network on reconnect', () => {
      feed.observeMessage(
        NET,
        message({ type: 'join', from: 'fred', channel: '#a' }),
      );
      feed.applyModeChange(NET, '#a', '+nt');
      feed.resetNetwork(NET);

      // Membership is not true again until NAMES says so.
      expect(ial.size(NET)).toBe(0);
      expect(channels.get(NET, '#a')).toBeUndefined();
    });
  });
});

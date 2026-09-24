/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import {
  AddonServerKnowledge,
  parseChanModes,
  parsePrefix,
} from '../../src/services/scripting/AddonServerKnowledge';

const NET = 'net1';

describe('AddonServerKnowledge', () => {
  let server: AddonServerKnowledge;

  beforeEach(() => {
    server = new AddonServerKnowledge();
  });

  describe('parsePrefix', () => {
    it('maps both directions and keeps the server ordering', () => {
      expect(parsePrefix('(qaohv)~&@%+')).toEqual({
        modeToPrefix: { q: '~', a: '&', o: '@', h: '%', v: '+' },
        prefixToMode: { '~': 'q', '&': 'a', '@': 'o', '%': 'h', '+': 'v' },
        order: ['q', 'a', 'o', 'h', 'v'],
      });
    });

    it('pairs only what lines up when a server sends a malformed token', () => {
      // Half a mapping is worse than a short one.
      expect(parsePrefix('(ovx)@+').order).toEqual(['o', 'v']);
      expect(parsePrefix('nonsense').order).toEqual([]);
    });
  });

  describe('parseChanModes', () => {
    it('splits the four RFC classes', () => {
      expect(parseChanModes('beI,k,l,imnpst')).toEqual({
        list: ['b', 'e', 'I'],
        parameterAlways: ['k'],
        parameterWhenSet: ['l'],
        noParameter: ['i', 'm', 'n', 'p', 's', 't'],
      });
    });
  });

  describe('defaults', () => {
    it('answers usefully before any ISUPPORT arrives', () => {
      const record = server.get(NET);
      expect(record.prefixes.modeToPrefix.o).toBe('@');
      expect(record.channelTypes).toEqual(['#', '&']);
      expect(record.casemapping).toBe('rfc1459');
    });
  });

  describe('ISUPPORT', () => {
    beforeEach(() => {
      server.setISupport(NET, {
        PREFIX: '(qaohv)~&@%+',
        CHANMODES: 'beI,k,l,imnpst',
        CHANTYPES: '#',
        CASEMAPPING: 'ASCII',
        NETWORK: 'ExampleNet',
        NICKLEN: '30',
        WHOX: true,
        SOMETHINGNEW: 'future',
      });
    });

    it('parses the tokens it understands', () => {
      const record = server.get(NET);
      expect(record.networkName).toBe('ExampleNet');
      expect(record.casemapping).toBe('ascii');
      expect(record.channelTypes).toEqual(['#']);
      expect(record.prefixes.modeToPrefix.h).toBe('%');
    });

    it('keeps every raw token, including ones it has never heard of', () => {
      // A server three years from now should not need an app release.
      expect(server.token(NET, 'SOMETHINGNEW')).toBe('future');
      expect(server.token(NET, 'whox')).toBe(true);
      expect(server.token(NET, 'MISSING')).toBeUndefined();
    });

    it('reads numeric tokens, which arrive as strings', () => {
      expect(server.numericToken(NET, 'NICKLEN')).toBe(30);
      expect(server.numericToken(NET, 'NETWORK')).toBeUndefined();
      expect(server.numericToken(NET, 'WHOX')).toBeUndefined();
    });

    it('identifies channels by the server CHANTYPES', () => {
      expect(server.isChannel(NET, '#chan')).toBe(true);
      expect(server.isChannel(NET, '&chan')).toBe(false);
      expect(server.isChannel(NET, 'fred')).toBe(false);
      expect(server.isChannel(NET, '')).toBe(false);
    });

    it('splits prefixes off a name using the server mapping', () => {
      expect(server.splitPrefixes(NET, '~&fred')).toEqual({
        modes: ['q', 'a'],
        nick: 'fred',
      });
      expect(server.splitPrefixes(NET, 'fred')).toEqual({
        modes: [],
        nick: 'fred',
      });
    });

    it('knows which modes take a parameter', () => {
      expect(server.modeTakesParameter(NET, 'b', true)).toBe(true);
      expect(server.modeTakesParameter(NET, 'b', false)).toBe(true);
      expect(server.modeTakesParameter(NET, 'k', false)).toBe(true);
      // Type C takes one only when being set.
      expect(server.modeTakesParameter(NET, 'l', true)).toBe(true);
      expect(server.modeTakesParameter(NET, 'l', false)).toBe(false);
      expect(server.modeTakesParameter(NET, 'n', true)).toBe(false);
    });
  });

  describe('capabilities, server name and links', () => {
    it('records and reports them', () => {
      server.setCapabilities(NET, ['sasl', 'message-tags']);
      server.setServerName(NET, 'irc.example.net');
      server.setLinks(NET, ['hub.example.net']);

      expect(server.hasCapability(NET, 'sasl')).toBe(true);
      expect(server.hasCapability(NET, 'echo-message')).toBe(false);
      expect(server.get(NET).serverName).toBe('irc.example.net');
      expect(server.get(NET).links).toEqual(['hub.example.net']);
    });
  });

  it('returns copies, so a caller cannot edit the cache', () => {
    server.setCapabilities(NET, ['sasl']);
    const record = server.get(NET);
    record.capabilities.push('injected');
    record.tokens.INJECTED = 'x';
    record.prefixes.order.push('z');

    expect(server.get(NET).capabilities).toEqual(['sasl']);
    expect(server.token(NET, 'INJECTED')).toBeUndefined();
    expect(server.get(NET).prefixes.order).toEqual(['o', 'v']);
  });

  it('keeps networks separate and can forget one', () => {
    server.setCapabilities(NET, ['sasl']);
    expect(server.hasCapability('other', 'sasl')).toBe(false);
    server.clearNetwork(NET);
    expect(server.hasCapability(NET, 'sasl')).toBe(false);
  });
});

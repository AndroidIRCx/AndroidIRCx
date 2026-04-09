/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChannelTab, IRCNetwork } from '../../src/types';

describe('Types - index', () => {
  describe('ChannelTab interface', () => {
    it('should create a valid ChannelTab object with required fields', () => {
      const tab: ChannelTab = {
        id: 'tab-1',
        name: '#general',
        type: 'channel',
        networkId: 'network-1',
        messages: [],
      };

      expect(tab.id).toBe('tab-1');
      expect(tab.name).toBe('#general');
      expect(tab.type).toBe('channel');
      expect(tab.networkId).toBe('network-1');
      expect(tab.messages).toEqual([]);
    });

    it('should support all tab types', () => {
      const types: Array<ChannelTab['type']> = [
        'server',
        'channel',
        'query',
        'notice',
        'dcc',
      ];

      types.forEach(type => {
        const tab: ChannelTab = {
          id: `tab-${type}`,
          name: 'test',
          type,
          networkId: 'network-1',
          messages: [],
        };
        expect(tab.type).toBe(type);
      });
    });

    it('should support optional fields', () => {
      const tab: ChannelTab = {
        id: 'tab-1',
        name: '#general',
        type: 'channel',
        networkId: 'network-1',
        messages: [],
        dccSessionId: 'dcc-1',
        hasActivity: true,
        isEncrypted: false,
        sendEncrypted: true,
        scrollbackLoaded: true,
      };

      expect(tab.dccSessionId).toBe('dcc-1');
      expect(tab.hasActivity).toBe(true);
      expect(tab.isEncrypted).toBe(false);
      expect(tab.sendEncrypted).toBe(true);
      expect(tab.scrollbackLoaded).toBe(true);
    });

    it('should contain IRCMessage array', () => {
      const message = {
        id: 'msg-1',
        text: 'Hello',
        sender: 'user1',
        timestamp: Date.now(),
      };

      const tab: ChannelTab = {
        id: 'tab-1',
        name: '#general',
        type: 'channel',
        networkId: 'network-1',
        messages: [message as any],
      };

      expect(tab.messages).toHaveLength(1);
      expect(tab.messages[0].text).toBe('Hello');
    });
  });

  describe('IRCNetwork interface', () => {
    it('should create a valid IRCNetwork object with required fields', () => {
      const network: IRCNetwork = {
        id: 'network-1',
        name: 'Freenode',
        host: 'irc.freenode.net',
        port: 6667,
        nick: 'myNick',
        tls: false,
      };

      expect(network.id).toBe('network-1');
      expect(network.name).toBe('Freenode');
      expect(network.host).toBe('irc.freenode.net');
      expect(network.port).toBe(6667);
      expect(network.nick).toBe('myNick');
      expect(network.tls).toBe(false);
    });

    it('should support TLS connections', () => {
      const network: IRCNetwork = {
        id: 'network-1',
        name: 'Freenode',
        host: 'irc.freenode.net',
        port: 6697,
        nick: 'myNick',
        tls: true,
        rejectUnauthorized: true,
      };

      expect(network.tls).toBe(true);
      expect(network.rejectUnauthorized).toBe(true);
    });

    it('should support optional authentication fields', () => {
      const network: IRCNetwork = {
        id: 'network-1',
        name: 'Freenode',
        host: 'irc.freenode.net',
        port: 6697,
        nick: 'myNick',
        username: 'myuser',
        realname: 'My Real Name',
        password: 'secret123',
        tls: true,
      };

      expect(network.username).toBe('myuser');
      expect(network.realname).toBe('My Real Name');
      expect(network.password).toBe('secret123');
    });

    it('should support SASL authentication', () => {
      const network: IRCNetwork = {
        id: 'network-1',
        name: 'Freenode',
        host: 'irc.freenode.net',
        port: 6697,
        nick: 'myNick',
        tls: true,
        sasl: {
          account: 'myaccount',
          password: 'saslsecret',
        },
      };

      expect(network.sasl).toBeDefined();
      expect(network.sasl?.account).toBe('myaccount');
      expect(network.sasl?.password).toBe('saslsecret');
    });

    it('should work without optional fields', () => {
      const minimalNetwork: IRCNetwork = {
        id: 'minimal',
        name: 'Test',
        host: 'test.com',
        port: 6667,
        nick: 'testnick',
        tls: false,
      };

      expect(minimalNetwork.username).toBeUndefined();
      expect(minimalNetwork.realname).toBeUndefined();
      expect(minimalNetwork.password).toBeUndefined();
      expect(minimalNetwork.sasl).toBeUndefined();
      expect(minimalNetwork.rejectUnauthorized).toBeUndefined();
    });
  });
});

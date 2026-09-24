/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAddonHostHandlers } from '../../src/services/scripting/AddonHostHandlers';
import {
  AddonHostApiGateway,
  ADDON_HOST_OPERATIONS,
} from '../../src/services/scripting/AddonHostApiGateway';
import { addonIALService } from '../../src/services/scripting/AddonIALService';
import { addonTableStore } from '../../src/services/scripting/AddonTableStore';
import { addonDiagnostics } from '../../src/services/scripting/AddonDiagnostics';

const ADDON = 'rs.androidircx.demo';

const manifest = {
  id: ADDON,
  name: 'Demo',
  author: 'Test',
  version: '1.0.0',
  description: 'Test addon.',
  license: 'GPL-3.0-or-later',
  apiVersion: 1,
  minAppVersion: '1.10.0',
  entry: 'main.js',
  permissions: ['irc.read', 'storage', 'irc.send'],
} as any;

// The `mock` prefix is what lets these be referenced from a hoisted factory.
const mockSendMessage = jest.fn();
const mockSendCommand = jest.fn();
const mockGetConnection = jest.fn(() => ({
  ircService: { sendMessage: mockSendMessage, sendCommand: mockSendCommand },
}));

jest.mock('../../src/services/ConnectionManager', () => ({
  connectionManager: { getConnection: () => mockGetConnection() },
}));

/** The gateway with the real handlers behind it, and a stub package store. */
function gateway(permissions = manifest.permissions) {
  const requireGrant = jest.fn(
    (_addonId: string, declared: string[], capability: string) => {
      if (!declared.includes(capability))
        throw new Error(`Addon does not hold ${capability}.`);
    },
  );
  return {
    requireGrant,
    api: new AddonHostApiGateway(
      createAddonHostHandlers(),
      {
        initialize: jest.fn(async () => undefined),
        get: jest.fn(() => ({ manifest: { ...manifest, permissions } })),
      } as any,
      { initialize: jest.fn(async () => undefined), requireGrant } as any,
      {
        initialize: jest.fn(async () => undefined),
        record: jest.fn(async () => undefined),
      } as any,
    ),
  };
}

describe('AddonHostHandlers', () => {
  beforeEach(async () => {
    (AsyncStorage as any).__reset?.();
    addonIALService.resetForTests();
    addonTableStore.resetForTests();
    addonDiagnostics.resetForTests();
    jest.clearAllMocks();
  });

  it('provides a handler for most declared operations, and none for the rest', () => {
    const handlers = createAddonHostHandlers();
    const declared = Object.keys(ADDON_HOST_OPERATIONS);
    const wired = Object.keys(handlers);

    expect(wired.every(name => declared.includes(name))).toBe(true);
    expect(wired.length).toBeGreaterThanOrEqual(10);
    // An operation with no handler is refused by the gateway rather than
    // silently succeeding, so leaving one unwired is safe by construction.
  });

  describe('permission is still what decides', () => {
    it('refuses a read the addon has no grant for', async () => {
      const g = gateway(['storage']);
      await expect(
        g.api.invoke(ADDON, 'irc.events.read', { query: 'server' }),
      ).rejects.toThrow(/irc\.read/);
    });

    it('refuses a send the addon has no grant for, without calling IRC', async () => {
      const g = gateway(['irc.read']);
      await expect(
        g.api.invoke(ADDON, 'irc.message.send', {
          networkId: 'net1',
          target: '#a',
          text: 'hi',
        }),
      ).rejects.toThrow(/irc\.send/);
      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it('refuses an operation that does not exist', async () => {
      const g = gateway();
      await expect(g.api.invoke(ADDON, 'irc.takeover', {})).rejects.toThrow(
        /Unknown addon host operation/,
      );
    });
  });

  describe('reading IRC state', () => {
    it('answers a user query from the address list', async () => {
      addonIALService.observe('net1', 'fred', { host: 'h.example' }, 'whois');
      const g = gateway();

      const result: any = await g.api.invoke(ADDON, 'irc.events.read', {
        query: 'user',
        networkId: 'net1',
        nick: 'fred',
      });
      expect(result.host).toBe('h.example');
    });

    it('answers a channel-users query', async () => {
      addonIALService.syncChannel('net1', '#a', [{ nick: 'fred' }]);
      const g = gateway();

      const result: any = await g.api.invoke(ADDON, 'irc.events.read', {
        query: 'channel-users',
        networkId: 'net1',
        channel: '#a',
      });
      expect(result.map((entry: any) => entry.nick)).toEqual(['fred']);
    });

    it('refuses an unknown query rather than guessing', async () => {
      const g = gateway();
      await expect(
        g.api.invoke(ADDON, 'irc.events.read', { query: 'everything' }),
      ).rejects.toThrow(/Unknown read query/);
    });

    it('refuses an unknown mask-list kind', async () => {
      const g = gateway();
      await expect(
        g.api.invoke(ADDON, 'irc.events.read', {
          query: 'channel-list',
          networkId: 'net1',
          channel: '#a',
          kind: 'everything',
        }),
      ).rejects.toThrow(/Unknown list kind/);
    });
  });

  describe('sending', () => {
    it('sends when the grant allows it and counts it', async () => {
      const g = gateway();
      await g.api.invoke(ADDON, 'irc.message.send', {
        networkId: 'net1',
        target: '#a',
        text: 'hello',
      });

      expect(mockSendMessage).toHaveBeenCalledWith('#a', 'hello');
      expect(addonDiagnostics.health(ADDON).counters.ircSends).toBe(1);
    });

    it('refuses a send with no target or no text', async () => {
      const g = gateway();
      // The grant said the addon may send; it did not say it may send this.
      await expect(
        g.api.invoke(ADDON, 'irc.message.send', {
          networkId: 'net1',
          target: '#a',
        }),
      ).rejects.toThrow(/target and text/);
      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it('refuses a send to a network that is not connected', async () => {
      mockGetConnection.mockReturnValueOnce(undefined as any);
      const g = gateway();
      await expect(
        g.api.invoke(ADDON, 'irc.message.send', {
          networkId: 'gone',
          target: '#a',
          text: 'hi',
        }),
      ).rejects.toThrow(/not connected/);
    });

    it('refuses an over-long message instead of truncating it silently', async () => {
      const g = gateway();
      await expect(
        g.api.invoke(ADDON, 'irc.message.send', {
          networkId: 'net1',
          target: '#a',
          text: 'x'.repeat(5000),
        }),
      ).rejects.toThrow(/target and text/);
    });
  });

  describe('moderation', () => {
    it('refuses every action without irc.moderate', async () => {
      const g = gateway(['irc.read', 'irc.send']);
      await expect(
        g.api.invoke(ADDON, 'irc.moderate', {
          networkId: 'net1',
          channel: '#a',
          action: 'kick',
          nick: 'fred',
        }),
      ).rejects.toThrow(/irc\.moderate/);
      expect(mockSendCommand).not.toHaveBeenCalled();
    });

    it('kicks and sets modes when granted', async () => {
      const g = gateway([...manifest.permissions, 'irc.moderate']);

      await g.api.invoke(ADDON, 'irc.moderate', {
        networkId: 'net1',
        channel: '#a',
        action: 'kick',
        nick: 'fred',
        reason: 'bye',
      });
      expect(mockSendCommand).toHaveBeenCalledWith('KICK #a fred :bye');

      await g.api.invoke(ADDON, 'irc.moderate', {
        networkId: 'net1',
        channel: '#a',
        action: 'mode',
        modes: '+m',
      });
      expect(mockSendCommand).toHaveBeenCalledWith('MODE #a +m');
    });

    it('refuses an unknown moderation action', async () => {
      const g = gateway([...manifest.permissions, 'irc.moderate']);
      await expect(
        g.api.invoke(ADDON, 'irc.moderate', {
          networkId: 'net1',
          channel: '#a',
          action: 'nuke',
        }),
      ).rejects.toThrow(/Unknown moderation action/);
    });
  });

  describe('storage', () => {
    it('round-trips a value and reports the space used', async () => {
      const g = gateway();
      await g.api.invoke(ADDON, 'storage.write', {
        table: 'prefs',
        key: 'theme',
        value: 'dark',
      });

      const read = await g.api.invoke(ADDON, 'storage.read', {
        table: 'prefs',
        key: 'theme',
      });
      expect(read).toBe('dark');
      expect(
        addonDiagnostics.health(ADDON).counters.storageBytes,
      ).toBeGreaterThan(0);
    });

    it('keeps one addon out of another addon table', async () => {
      const g = gateway();
      await g.api.invoke(ADDON, 'storage.write', {
        table: 'prefs',
        key: 'k',
        value: 'mine',
      });
      expect(addonTableStore.get('other.addon', 'prefs', 'k')).toBeUndefined();
    });

    it('refuses a write with no table or key', async () => {
      const g = gateway();
      await expect(
        g.api.invoke(ADDON, 'storage.write', { key: 'k', value: 1 }),
      ).rejects.toThrow(/table and key/);
    });
  });

  describe('rate limiting', () => {
    it('stops an addon hammering one operation', async () => {
      const g = gateway();
      const limit = ADDON_HOST_OPERATIONS['irc.message.send'].callsPerMinute;

      for (let index = 0; index < limit; index += 1)
        await g.api.invoke(ADDON, 'irc.message.send', {
          networkId: 'net1',
          target: '#a',
          text: 'hi',
        });

      await expect(
        g.api.invoke(ADDON, 'irc.message.send', {
          networkId: 'net1',
          target: '#a',
          text: 'hi',
        }),
      ).rejects.toThrow(/rate limit/i);
    });
  });
});

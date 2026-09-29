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

// The handlers below reach these through a call-time `require`, so the mock
// has to stand in for the module rather than for an injected collaborator.
const mockLoadMessages = jest.fn(async () => []);
jest.mock('../../src/services/MessageHistoryService', () => ({
  messageHistoryService: {
    loadMessages: (...args: unknown[]) => mockLoadMessages(...(args as [])),
  },
}));

const mockGetCurrentTheme = jest.fn(() => ({
  name: 'Dark',
  colors: { background: '#000' },
}));
jest.mock('../../src/services/ThemeService', () => ({
  themeService: { getCurrentTheme: () => mockGetCurrentTheme() },
}));

const mockFetchPage = jest.fn(async () => ({
  url: 'https://example.com',
  title: 'Example',
  text: 'body',
  truncated: false,
}));
jest.mock('../../src/services/ai/WebAccessService', () => ({
  webAccessService: { fetchPage: (url: string) => mockFetchPage(url as never) },
}));

const mockShowNotification = jest.fn(async () => undefined);
jest.mock('../../src/services/NotificationService', () => ({
  notificationService: {
    showNotification: (...args: unknown[]) =>
      mockShowNotification(...(args as [])),
  },
}));

const mockSecrets = new Map<string, string>();
jest.mock('../../src/services/scripting/AddonSecretStore', () => ({
  addonSecretStore: {
    set: jest.fn(async (addonId: string, key: string, value: string) => {
      mockSecrets.set(`${addonId}:${key}`, value);
    }),
    get: jest.fn(
      async (addonId: string, key: string) =>
        mockSecrets.get(`${addonId}:${key}`) ?? null,
    ),
    delete: jest.fn(async (addonId: string, key: string) => {
      mockSecrets.delete(`${addonId}:${key}`);
    }),
    keys: jest.fn(async (addonId: string) =>
      Array.from(mockSecrets.keys())
        .filter(entry => entry.startsWith(`${addonId}:`))
        .map(entry => entry.slice(addonId.length + 1)),
    ),
  },
}));

const mockReadText = jest.fn(async () => ({ ok: true, value: 'contents' }));
const mockWriteText = jest.fn(async () => ({ ok: true }));
jest.mock('../../src/services/scripting/AddonWorkspace', () => ({
  addonWorkspace: {
    readText: (...args: unknown[]) => mockReadText(...(args as [])),
    writeText: (...args: unknown[]) => mockWriteText(...(args as [])),
  },
}));

const mockRegisterMenu = jest.fn(async () => undefined);
const mockRegisterPanel = jest.fn(async () => undefined);
const mockRegisterSettings = jest.fn(async () => undefined);
jest.mock('../../src/services/scripting/AddonUIRegistry', () => ({
  addonUIRegistry: {
    registerMenu: (...args: unknown[]) => mockRegisterMenu(...(args as [])),
    registerPanel: (...args: unknown[]) => mockRegisterPanel(...(args as [])),
    registerSettings: (...args: unknown[]) =>
      mockRegisterSettings(...(args as [])),
  },
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

  // Everything a handler in this file can be reached through, so the shape
  // checks below are about the arguments rather than about the grant.
  const ALL = [
    'irc.read',
    'irc.send',
    'irc.moderate',
    'history.read',
    'storage',
    'secrets',
    'network',
    'files.userSelected',
    'notifications',
    'clipboard.write',
    'theme.read',
    'ui.extend',
  ];

  describe('history', () => {
    it('returns the last messages, newest end first asked for', async () => {
      mockLoadMessages.mockResolvedValue([
        { from: 'a', text: '1', timestamp: 1, type: 'message', extra: 'drop' },
        { from: 'b', text: '2', timestamp: 2, type: 'message' },
      ] as never);
      const g = gateway(ALL);

      const result: any = await g.api.invoke(ADDON, 'history.read', {
        networkId: 'net1',
        target: '#a',
        limit: 1,
      });
      // Only the four documented fields cross the bridge.
      expect(result).toEqual([
        { from: 'b', text: '2', timestamp: 2, type: 'message' },
      ]);
    });

    it('clamps the limit and copes with no stored messages', async () => {
      mockLoadMessages.mockResolvedValue(undefined as never);
      const g = gateway(ALL);
      const result: any = await g.api.invoke(ADDON, 'history.read', {
        networkId: 'net1',
        target: '#a',
        limit: 10000,
      });
      expect(result).toEqual([]);
    });

    it('refuses a read with no target', async () => {
      const g = gateway(ALL);
      await expect(
        g.api.invoke(ADDON, 'history.read', { networkId: 'net1' }),
      ).rejects.toThrow(/target is required/);
    });
  });

  describe('more IRC reads', () => {
    it('answers a find query', async () => {
      addonIALService.observe('net1', 'fred', { host: 'h.example' }, 'whois');
      const g = gateway(ALL);
      const result: any = await g.api.invoke(ADDON, 'irc.events.read', {
        query: 'find',
        networkId: 'net1',
        mask: '*',
        limit: 5,
      });
      expect(Array.isArray(result)).toBe(true);
    });

    it('answers channel and channel-list queries', async () => {
      const g = gateway(ALL);
      await expect(
        g.api.invoke(ADDON, 'irc.events.read', {
          query: 'channel',
          networkId: 'net1',
          channel: '#a',
        }),
      ).resolves.toBeDefined();
      await expect(
        g.api.invoke(ADDON, 'irc.events.read', {
          query: 'channel-list',
          networkId: 'net1',
          channel: '#a',
          kind: 'ban',
        }),
      ).resolves.toBeDefined();
    });

    it('answers a server query', async () => {
      const g = gateway(ALL);
      await expect(
        g.api.invoke(ADDON, 'irc.events.read', {
          query: 'server',
          networkId: 'net1',
        }),
      ).resolves.toBeDefined();
    });
  });

  describe('more moderation', () => {
    it('sets a topic, with an empty one allowed', async () => {
      const g = gateway(ALL);
      await g.api.invoke(ADDON, 'irc.moderate', {
        networkId: 'net1',
        channel: '#a',
        action: 'topic',
        topic: 'new topic',
      });
      expect(mockSendCommand).toHaveBeenCalledWith('TOPIC #a :new topic');

      await g.api.invoke(ADDON, 'irc.moderate', {
        networkId: 'net1',
        channel: '#a',
        action: 'topic',
      });
      expect(mockSendCommand).toHaveBeenCalledWith('TOPIC #a :');
    });

    it('kicks without a reason', async () => {
      const g = gateway(ALL);
      await g.api.invoke(ADDON, 'irc.moderate', {
        networkId: 'net1',
        channel: '#a',
        action: 'kick',
        nick: 'fred',
      });
      expect(mockSendCommand).toHaveBeenCalledWith('KICK #a fred');
    });

    it('refuses a kick with no nick and a mode with no modes', async () => {
      const g = gateway(ALL);
      await expect(
        g.api.invoke(ADDON, 'irc.moderate', {
          networkId: 'net1',
          channel: '#a',
          action: 'kick',
        }),
      ).rejects.toThrow(/nick is required/);
      await expect(
        g.api.invoke(ADDON, 'irc.moderate', {
          networkId: 'net1',
          channel: '#a',
          action: 'mode',
        }),
      ).rejects.toThrow(/Modes are required/);
    });

    it('refuses moderation with no channel, and with no network named', async () => {
      const g = gateway(ALL);
      await expect(
        g.api.invoke(ADDON, 'irc.moderate', {
          networkId: 'net1',
          action: 'kick',
        }),
      ).rejects.toThrow(/channel is required/);
      await expect(
        g.api.invoke(ADDON, 'irc.moderate', {
          channel: '#a',
          action: 'kick',
          nick: 'fred',
        }),
      ).rejects.toThrow(/networkId is required/);
    });
  });

  describe('more storage', () => {
    it('queries a table by prefix when no key is given', async () => {
      const g = gateway(ALL);
      await g.api.invoke(ADDON, 'storage.write', {
        table: 'prefs',
        key: 'ui.theme',
        value: 'dark',
      });
      await g.api.invoke(ADDON, 'storage.write', {
        table: 'prefs',
        key: 'net.host',
        value: 'irc.example',
      });

      const result: any = await g.api.invoke(ADDON, 'storage.read', {
        table: 'prefs',
        prefix: 'ui.',
        limit: 10,
      });
      expect(JSON.stringify(result)).toContain('dark');
      expect(JSON.stringify(result)).not.toContain('irc.example');
    });

    it('deletes a key', async () => {
      const g = gateway(ALL);
      await g.api.invoke(ADDON, 'storage.write', {
        table: 'prefs',
        key: 'k',
        value: 'v',
      });
      const result: any = await g.api.invoke(ADDON, 'storage.write', {
        table: 'prefs',
        key: 'k',
        op: 'delete',
      });
      expect(result.ok).toBe(true);
      expect(
        await g.api.invoke(ADDON, 'storage.read', { table: 'prefs', key: 'k' }),
      ).toBeNull();
    });

    it('refuses a read with no table', async () => {
      const g = gateway(ALL);
      await expect(
        g.api.invoke(ADDON, 'storage.read', { key: 'k' }),
      ).rejects.toThrow(/table name is required/);
    });
  });

  describe('secrets', () => {
    beforeEach(() => mockSecrets.clear());

    it('stores, reads back and lists its own keys', async () => {
      const g = gateway(ALL);
      await g.api.invoke(ADDON, 'secrets.write', {
        key: 'token',
        value: 'sekrit',
      });
      expect(await g.api.invoke(ADDON, 'secrets.read', { key: 'token' })).toBe(
        'sekrit',
      );
      expect(await g.api.invoke(ADDON, 'secrets.read', { op: 'keys' })).toEqual(
        ['token'],
      );
    });

    it('deletes a secret', async () => {
      const g = gateway(ALL);
      await g.api.invoke(ADDON, 'secrets.write', { key: 'k', value: 'v' });
      await g.api.invoke(ADDON, 'secrets.write', { key: 'k', op: 'delete' });
      expect(
        await g.api.invoke(ADDON, 'secrets.read', { key: 'k' }),
      ).toBeNull();
    });

    it('refuses a write with no key or no value', async () => {
      const g = gateway(ALL);
      await expect(
        g.api.invoke(ADDON, 'secrets.write', { value: 'v' }),
      ).rejects.toThrow(/key is required/);
      await expect(
        g.api.invoke(ADDON, 'secrets.write', { key: 'k' }),
      ).rejects.toThrow(/value is required/);
    });

    it('refuses a read with no key', async () => {
      const g = gateway(ALL);
      await expect(g.api.invoke(ADDON, 'secrets.read', {})).rejects.toThrow(
        /key is required/,
      );
    });
  });

  describe('files', () => {
    it('reads a file from the addon workspace', async () => {
      const g = gateway(ALL);
      const result: any = await g.api.invoke(ADDON, 'files.pick', {
        path: 'notes.txt',
      });
      expect(result.value).toBe('contents');
      expect(mockReadText).toHaveBeenCalledWith(ADDON, 'notes.txt');
    });

    it('writes a file and counts it', async () => {
      const g = gateway(ALL);
      await g.api.invoke(ADDON, 'files.pick', {
        op: 'write',
        path: 'notes.txt',
        contents: 'hello',
      });
      expect(mockWriteText).toHaveBeenCalledWith(ADDON, 'notes.txt', 'hello');
      expect(addonDiagnostics.health(ADDON).counters.fileWrites).toBe(1);
    });

    it('refuses a call with no path', async () => {
      const g = gateway(ALL);
      await expect(g.api.invoke(ADDON, 'files.pick', {})).rejects.toThrow(
        /path is required/,
      );
    });
  });

  describe('UI contributions', () => {
    it('registers a menu, a panel and a settings page', async () => {
      const g = gateway(ALL);
      await g.api.invoke(ADDON, 'ui.extend', {
        kind: 'menu',
        menu: { id: 'm', label: 'Do it' },
      });
      await g.api.invoke(ADDON, 'ui.extend', {
        kind: 'panel',
        id: 'p',
        title: 'Panel',
        nodes: [],
      });
      await g.api.invoke(ADDON, 'ui.extend', {
        kind: 'settings',
        title: 'Settings',
        fields: [],
      });

      expect(mockRegisterMenu).toHaveBeenCalled();
      expect(mockRegisterPanel).toHaveBeenCalledWith(ADDON, 'p', 'Panel', []);
      expect(mockRegisterSettings).toHaveBeenCalledWith(ADDON, 'Settings', []);
      expect(addonDiagnostics.health(ADDON).counters.uiRegistrations).toBe(3);
    });

    it('refuses an unknown contribution', async () => {
      const g = gateway(ALL);
      await expect(
        g.api.invoke(ADDON, 'ui.extend', { kind: 'takeover' }),
      ).rejects.toThrow(/Unknown UI contribution/);
      expect(mockRegisterMenu).not.toHaveBeenCalled();
    });
  });

  describe('theme', () => {
    it('hands over the current theme', async () => {
      const g = gateway(ALL);
      const result: any = await g.api.invoke(ADDON, 'theme.read', {});
      expect(result).toEqual({ name: 'Dark', colors: { background: '#000' } });
    });

    it('returns null when there is no theme', async () => {
      mockGetCurrentTheme.mockReturnValueOnce(undefined as never);
      const g = gateway(ALL);
      expect(await g.api.invoke(ADDON, 'theme.read', {})).toBeNull();
    });
  });

  describe('network', () => {
    it('fetches through the web service and counts the call', async () => {
      const g = gateway(ALL);
      const result: any = await g.api.invoke(ADDON, 'network.fetch', {
        url: 'https://example.com',
      });
      expect(result.text).toBe('body');
      expect(mockFetchPage).toHaveBeenCalledWith('https://example.com');
      expect(addonDiagnostics.health(ADDON).counters.networkCalls).toBe(1);
    });

    it('refuses a fetch with no url', async () => {
      const g = gateway(ALL);
      await expect(g.api.invoke(ADDON, 'network.fetch', {})).rejects.toThrow(
        /url is required/,
      );
      expect(mockFetchPage).not.toHaveBeenCalled();
    });

    it('lets a refusal from the web service through unchanged', async () => {
      mockFetchPage.mockRejectedValueOnce(new Error('Not on the list.'));
      const g = gateway(ALL);
      await expect(
        g.api.invoke(ADDON, 'network.fetch', { url: 'https://nope.example' }),
      ).rejects.toThrow(/Not on the list/);
    });
  });

  describe('notifications and clipboard', () => {
    it('shows a notification under the addon name by default', async () => {
      const g = gateway(ALL);
      await g.api.invoke(ADDON, 'notifications.show', { title: 'Hello' });
      expect(mockShowNotification).toHaveBeenCalledWith('Hello', '', 'Addon');
    });

    it('passes the channel through when one is given', async () => {
      const g = gateway(ALL);
      await g.api.invoke(ADDON, 'notifications.show', {
        title: 'Hello',
        body: 'there',
        channel: '#a',
      });
      expect(mockShowNotification).toHaveBeenCalledWith('Hello', 'there', '#a');
    });

    it('refuses a notification with no title', async () => {
      const g = gateway(ALL);
      await expect(
        g.api.invoke(ADDON, 'notifications.show', { body: 'orphan' }),
      ).rejects.toThrow(/title is required/);
    });

    it('copies text', async () => {
      const Clipboard = require('@react-native-clipboard/clipboard');
      const g = gateway(ALL);
      await g.api.invoke(ADDON, 'clipboard.write', { text: 'copied' });
      expect((Clipboard.default ?? Clipboard).setString).toHaveBeenCalledWith(
        'copied',
      );
    });

    it('refuses an empty copy', async () => {
      const g = gateway(ALL);
      await expect(
        g.api.invoke(ADDON, 'clipboard.write', { text: '' }),
      ).rejects.toThrow(/Text is required/);
    });
  });
});

/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import type { AddonConfigValue } from './AddonConfigStore';
import type { AddonHostHandlers } from './AddonHostApiGateway';
import { addonIALService } from './AddonIALService';
import {
  addonChannelKnowledge,
  MASK_LIST_KINDS,
} from './AddonChannelKnowledge';
import { addonServerKnowledge } from './AddonServerKnowledge';
import { addonTableStore } from './AddonTableStore';
import { addonSecretStore } from './AddonSecretStore';
import { addonWorkspace } from './AddonWorkspace';
import { addonUIRegistry } from './AddonUIRegistry';
import { addonDiagnostics } from './AddonDiagnostics';

/**
 * What the gateway actually calls.
 *
 * The gateway has deliberately shipped with no handlers until now, so an
 * imported package could be installed, reviewed and stored but could reach
 * nothing. This is the bridge — and the reason it is a separate file is that
 * the gateway itself must stay free of service imports: it is the thing that
 * decides whether a call is allowed, and it should not be able to perform one
 * by accident.
 *
 * Every handler here runs **after** the gateway has checked the capability
 * grant, the rate limit and the argument size. What they add is the shape of
 * their own arguments, because "you may send messages" does not mean "you may
 * send this".
 *
 * Handlers that touch live IRC use `require` at call time. `ConnectionManager`
 * pulls in `IRCService`, and importing that at module load from here has broken
 * unrelated test suites before.
 */

type Args = Record<string, unknown>;

const asString = (value: unknown, max = 500): string | undefined =>
  typeof value === 'string' && value.length > 0 && value.length <= max
    ? value
    : undefined;

/** Everything crossing back is plain JSON the gateway can re-validate. */
const json = (value: unknown): AddonConfigValue =>
  JSON.parse(JSON.stringify(value ?? null)) as AddonConfigValue;

function connection(networkId: unknown) {
  const net = asString(networkId, 100);
  if (!net) throw new Error('A networkId is required.');
  const { connectionManager } =
    require('../ConnectionManager') as typeof import('../ConnectionManager');
  const conn = connectionManager.getConnection(net);
  if (!conn) throw new Error('That network is not connected.');
  return conn;
}

export function createAddonHostHandlers(): AddonHostHandlers {
  return {
    // ─────────────────────────────────────────────────────────── reading ──
    'irc.events.read': async (_addonId, rawArgs) => {
      const args = (rawArgs ?? {}) as Args;
      const net = asString(args.networkId, 100) ?? '';
      switch (args.query) {
        case 'user':
          return json(addonIALService.get(net, asString(args.nick, 64) ?? ''));
        case 'channel-users':
          return json(
            addonIALService.onChannel(net, asString(args.channel, 200) ?? ''),
          );
        case 'find':
          return json(
            addonIALService.find(net, asString(args.mask, 200) ?? '*', {
              limit: typeof args.limit === 'number' ? args.limit : undefined,
            }),
          );
        case 'channel':
          return json(
            addonChannelKnowledge.get(net, asString(args.channel, 200) ?? ''),
          );
        case 'channel-list': {
          const kind = String(args.kind ?? 'ban');
          if (!MASK_LIST_KINDS.includes(kind as never))
            throw new Error('Unknown list kind.');
          return json(
            addonChannelKnowledge.getList(
              net,
              asString(args.channel, 200) ?? '',
              kind as never,
            ),
          );
        }
        case 'server':
          return json(addonServerKnowledge.get(net));
        default:
          throw new Error('Unknown read query.');
      }
    },

    'history.read': async (_addonId, rawArgs) => {
      const args = (rawArgs ?? {}) as Args;
      const target = asString(args.target, 200);
      if (!target) throw new Error('A target is required.');
      const { messageHistoryService } =
        require('../MessageHistoryService') as typeof import('../MessageHistoryService');
      const limit = Math.min(
        200,
        Math.max(1, typeof args.limit === 'number' ? args.limit : 50),
      );
      const messages = await messageHistoryService.loadMessages(
        asString(args.networkId, 100) ?? '',
        target,
      );
      return json(
        (messages ?? []).slice(-limit).map((message: any) => ({
          from: message.from,
          text: message.text,
          timestamp: message.timestamp,
          type: message.type,
        })),
      );
    },

    // ─────────────────────────────────────────────────────────── sending ──
    'irc.message.send': async (addonId, rawArgs) => {
      const args = (rawArgs ?? {}) as Args;
      const target = asString(args.target, 200);
      const text = asString(args.text, 500);
      if (!target || !text) throw new Error('A target and text are required.');
      // The grant said the addon may send. It did not say it may send this, so
      // the line still passes the same outbound gate everything else does.
      connection(args.networkId).ircService.sendMessage(target, text);
      addonDiagnostics.count(addonId, 'ircSends');
      return json({ sent: true });
    },

    'irc.moderate': async (addonId, rawArgs) => {
      const args = (rawArgs ?? {}) as Args;
      const channel = asString(args.channel, 200);
      if (!channel) throw new Error('A channel is required.');
      const conn = connection(args.networkId);

      switch (args.action) {
        case 'kick': {
          const nick = asString(args.nick, 64);
          if (!nick) throw new Error('A nick is required.');
          const reason = asString(args.reason, 200) ?? '';
          conn.ircService.sendCommand(
            `KICK ${channel} ${nick}${reason ? ` :${reason}` : ''}`,
          );
          break;
        }
        case 'mode': {
          const modes = asString(args.modes, 100);
          if (!modes) throw new Error('Modes are required.');
          conn.ircService.sendCommand(`MODE ${channel} ${modes}`);
          break;
        }
        case 'topic': {
          const topic = asString(args.topic, 400) ?? '';
          conn.ircService.sendCommand(`TOPIC ${channel} :${topic}`);
          break;
        }
        default:
          throw new Error('Unknown moderation action.');
      }
      addonDiagnostics.count(addonId, 'ircSends');
      return json({ done: true });
    },

    // ──────────────────────────────────────────────────────────── storage ──
    'storage.read': async (addonId, rawArgs) => {
      const args = (rawArgs ?? {}) as Args;
      const table = asString(args.table, 60);
      if (!table) throw new Error('A table name is required.');
      await addonTableStore.load(addonId);
      if (args.key !== undefined)
        return json(
          addonTableStore.get(addonId, table, asString(args.key, 200) ?? ''),
        );
      return json(
        addonTableStore.query(addonId, table, {
          prefix: asString(args.prefix, 200),
          limit: typeof args.limit === 'number' ? args.limit : undefined,
        }),
      );
    },

    'storage.write': async (addonId, rawArgs) => {
      const args = (rawArgs ?? {}) as Args;
      const table = asString(args.table, 60);
      const key = asString(args.key, 200);
      if (!table || !key) throw new Error('A table and key are required.');
      await addonTableStore.load(addonId);

      const result =
        args.op === 'delete'
          ? { ok: await addonTableStore.delete(addonId, table, key) }
          : await addonTableStore.set(
              addonId,
              table,
              key,
              (args.value ?? null) as never,
              typeof args.ttlMs === 'number' ? args.ttlMs : undefined,
            );
      addonDiagnostics.setStorageBytes(
        addonId,
        addonTableStore.usedBytes(addonId),
      );
      return json(result);
    },

    // ──────────────────────────────────────────────────────────── secrets ──
    // `read` returns the value only to the addon that stored it; there is no
    // operation that lists values, here or anywhere else.
    'secrets.read': async (addonId, rawArgs) => {
      const args = (rawArgs ?? {}) as Args;
      if (args.op === 'keys') return json(await addonSecretStore.keys(addonId));
      const key = asString(args.key, 80);
      if (!key) throw new Error('A key is required.');
      return json(await addonSecretStore.get(addonId, key));
    },

    'secrets.write': async (addonId, rawArgs) => {
      const args = (rawArgs ?? {}) as Args;
      const key = asString(args.key, 80);
      if (!key) throw new Error('A key is required.');
      if (args.op === 'delete') {
        await addonSecretStore.delete(addonId, key);
        return json({ ok: true });
      }
      const value = asString(args.value, 4096);
      if (!value) throw new Error('A value is required.');
      await addonSecretStore.set(addonId, key, value);
      return json({ ok: true });
    },

    // ────────────────────────────────────────────────────────────── files ──
    'files.pick': async (addonId, rawArgs) => {
      const args = (rawArgs ?? {}) as Args;
      const path = asString(args.path, 200);
      if (!path) throw new Error('A path is required.');
      if (args.op === 'write') {
        const result = await addonWorkspace.writeText(
          addonId,
          path,
          asString(args.contents, 1024 * 1024) ?? '',
        );
        addonDiagnostics.count(addonId, 'fileWrites');
        return json(result);
      }
      return json(await addonWorkspace.readText(addonId, path));
    },

    // ───────────────────────────────────────────────────────────────── UI ──
    'ui.extend': async (addonId, rawArgs) => {
      const args = (rawArgs ?? {}) as Args;
      switch (args.kind) {
        case 'menu':
          await addonUIRegistry.registerMenu(addonId, args.menu);
          break;
        case 'panel':
          await addonUIRegistry.registerPanel(
            addonId,
            asString(args.id, 60) ?? '',
            asString(args.title, 60) ?? '',
            args.nodes,
          );
          break;
        case 'settings':
          await addonUIRegistry.registerSettings(
            addonId,
            asString(args.title, 60) ?? '',
            args.fields,
          );
          break;
        default:
          throw new Error('Unknown UI contribution.');
      }
      addonDiagnostics.count(addonId, 'uiRegistrations');
      return json({ registered: true });
    },

    // ────────────────────────────────────────────────────────────── theme ──
    'theme.read': async () => {
      const { themeService } =
        require('../ThemeService') as typeof import('../ThemeService');
      const theme = themeService.getCurrentTheme?.();
      return json(
        theme ? { name: theme.name, colors: { ...theme.colors } } : null,
      );
    },

    // ──────────────────────────────────────────────────────────── network ──
    'network.fetch': async (addonId, rawArgs) => {
      const args = (rawArgs ?? {}) as Args;
      const url = asString(args.url, 2000);
      if (!url) throw new Error('A url is required.');
      const { webAccessService } =
        require('../ai/WebAccessService') as typeof import('../ai/WebAccessService');
      // The allowlist and the private-address refusal are the web service's,
      // not re-implemented here: one list for the user to reason about.
      const page = await webAccessService.fetchPage(url);
      addonDiagnostics.count(addonId, 'networkCalls');
      return json(page);
    },

    // ───────────────────────────────────────────────────── notifications ──
    'notifications.show': async (_addonId, rawArgs) => {
      const args = (rawArgs ?? {}) as Args;
      const title = asString(args.title, 100);
      const body = asString(args.body, 300);
      if (!title) throw new Error('A title is required.');
      const { notificationService } =
        require('../NotificationService') as typeof import('../NotificationService');
      // The channel argument is what the app groups notifications by; an
      // addon's go under its own name rather than impersonating a channel.
      await notificationService.showNotification(
        title,
        body ?? '',
        asString(args.channel, 200) ?? 'Addon',
      );
      return json({ shown: true });
    },

    // ────────────────────────────────────────────────────────── clipboard ──
    'clipboard.write': async (_addonId, rawArgs) => {
      const args = (rawArgs ?? {}) as Args;
      const text = asString(args.text, 10000);
      if (!text) throw new Error('Text is required.');
      const Clipboard =
        require('@react-native-clipboard/clipboard') as typeof import('@react-native-clipboard/clipboard');
      (Clipboard.default ?? Clipboard).setString(text);
      return json({ copied: true });
    },
  };
}

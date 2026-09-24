/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import type { IRCMessage } from '../IRCService';
import { validateAddonJson, type AddonConfigValue } from './AddonConfigStore';

export const ADDON_EVENT_SCHEMA_VERSION = 1 as const;

export interface AddonEventSender {
  nick?: string;
  ident?: string;
  host?: string;
  account?: string;
  certfp?: string;
}

export interface AddonEventOrigin {
  self: boolean;
  server: boolean;
  playback: boolean;
}

export interface AddonEventRawReference {
  messageId?: string;
  batchTag?: string;
}

export interface AddonEventEnvelope {
  schemaVersion: typeof ADDON_EVENT_SCHEMA_VERSION;
  id: string;
  type: string;
  timestamp: number;
  network?: string;
  target?: string;
  channel?: string;
  sender: AddonEventSender;
  rawReference?: AddonEventRawReference;
  payload: AddonConfigValue;
  origin: AddonEventOrigin;
}

export interface CreateAddonEventOptions {
  id: string;
  type: string;
  timestamp?: number;
  network?: string;
  target?: string;
  channel?: string;
  sender?: AddonEventSender;
  rawReference?: AddonEventRawReference;
  payload?: unknown;
  origin?: Partial<AddonEventOrigin>;
}

const SAFE_EVENT_TYPE = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const MAX_ID_LENGTH = 160;

/** Creates a detached, deeply frozen and independently versioned event. */
export function createAddonEventEnvelope(
  options: CreateAddonEventOptions,
): Readonly<AddonEventEnvelope> {
  if (
    typeof options.id !== 'string' ||
    options.id.length === 0 ||
    options.id.length > MAX_ID_LENGTH
  )
    throw new Error('Addon event id is invalid.');
  if (!SAFE_EVENT_TYPE.test(options.type))
    throw new Error('Addon event type is invalid.');
  const timestamp = options.timestamp ?? Date.now();
  if (!Number.isSafeInteger(timestamp) || timestamp < 0)
    throw new Error('Addon event timestamp is invalid.');

  const envelope: AddonEventEnvelope = {
    schemaVersion: ADDON_EVENT_SCHEMA_VERSION,
    id: options.id,
    type: options.type,
    timestamp,
    network: safeOptionalText(options.network, 'network'),
    target: safeOptionalText(options.target, 'target'),
    channel: safeOptionalText(options.channel, 'channel'),
    sender: compact({
      nick: safeOptionalText(options.sender?.nick, 'sender.nick'),
      ident: safeOptionalText(options.sender?.ident, 'sender.ident'),
      host: safeOptionalText(options.sender?.host, 'sender.host'),
      account: safeOptionalText(options.sender?.account, 'sender.account'),
      certfp: safeOptionalText(options.sender?.certfp, 'sender.certfp'),
    }),
    rawReference: options.rawReference
      ? compact({
          messageId: safeOptionalText(
            options.rawReference.messageId,
            'rawReference.messageId',
          ),
          batchTag: safeOptionalText(
            options.rawReference.batchTag,
            'rawReference.batchTag',
          ),
        })
      : undefined,
    payload: validateAddonJson(options.payload ?? {}, 1024 * 1024),
    origin: {
      self: options.origin?.self === true,
      server: options.origin?.server === true,
      playback: options.origin?.playback === true,
    },
  };
  if (envelope.rawReference && Object.keys(envelope.rawReference).length === 0)
    delete envelope.rawReference;
  return deepFreeze(envelope);
}

/** Compatibility adapter: existing ScriptHooks continue receiving IRCMessage. */
export function addonEventFromIrcMessage(
  message: IRCMessage,
  options: {
    selfNick?: string;
    serverOrigin?: boolean;
    senderIsOp?: boolean;
  } = {},
): Readonly<AddonEventEnvelope> {
  const payload = compact({
    text: message.text,
    reason: message.reason,
    mode: message.mode,
    topic: message.topic,
    oldNick: message.oldNick,
    newNick: message.newNick,
    target: message.target,
    numeric: message.numeric,
    command: message.command,
    channelContext: message.channelContext,
    replyTo: message.replyTo,
    reactions: message.reactions,
    typing: message.typing,
    intent: message.intent,
    senderIsOp: options.senderIsOp,
  });
  return createAddonEventEnvelope({
    id: message.id,
    type: message.numeric ? 'irc.numeric' : `irc.${message.type}`,
    timestamp: message.timestamp,
    network: message.network,
    target: message.target ?? message.channel ?? message.from,
    channel: message.channel,
    sender: {
      nick: message.from,
      ident: message.username,
      host: message.hostname,
      account: message.account,
      certfp: message.tags?.certfp,
    },
    rawReference: {
      messageId: message.msgid,
      batchTag: message.batchTag,
    },
    payload,
    origin: {
      self:
        !!options.selfNick &&
        !!message.from &&
        options.selfNick.toLocaleLowerCase('en-US') ===
          message.from.toLocaleLowerCase('en-US'),
      server: options.serverOrigin === true,
      playback: message.isPlayback === true || message.isScrollback === true,
    },
  });
}

function safeOptionalText(
  value: string | undefined,
  field: string,
): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length === 0 || value.length > 512)
    throw new Error(`Addon event ${field} is invalid.`);
  return value;
}

function compact<T extends Record<string, unknown>>(value: T): T {
  const result = Object.create(null) as T;
  Object.entries(value).forEach(([key, item]) => {
    if (item !== undefined) result[key as keyof T] = item as T[keyof T];
  });
  return result;
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value as Record<string, unknown>).forEach(item =>
      deepFreeze(item),
    );
    Object.freeze(value);
  }
  return value;
}

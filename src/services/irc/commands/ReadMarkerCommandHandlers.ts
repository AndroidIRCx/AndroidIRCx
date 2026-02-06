/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Read marker / redaction command handlers.
 */

import { tx } from '../../../i18n/transifex';
import type { CommandHandler, CommandHandlerRegistry } from '../commandTypes';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

export const handleMARKREAD: CommandHandler = (ctx, prefix, params, timestamp) => {
  const target = params[0] || '';
  const tsParam = params[1] || '';
  const tsMatch = tsParam.match(/timestamp=(\d+)/);
  const readTimestamp = tsMatch ? parseInt(tsMatch[1], 10) : Date.now();
  const markerNick = ctx.extractNick(prefix);
  ctx.logRaw(`IRCService: ${markerNick} marked ${target} as read (timestamp: ${readTimestamp})`);
  ctx.emit('read-marker-received', target, markerNick, readTimestamp);
};

export const handleREDACT: CommandHandler = (ctx, prefix, params, timestamp) => {
  const target = params[0] || '';
  const redactedMsgid = params[1] || '';
  const redactor = ctx.extractNick(prefix);
  ctx.logRaw(`IRCService: ${redactor} redacted message ${redactedMsgid} in ${target}`);
  ctx.addMessage({
    type: 'raw',
    text: t('*** {nick} deleted a message', { nick: redactor }),
    timestamp,
    channel: target,
    isRaw: true,
    rawCategory: 'user',
  });
  ctx.emit('message-redacted', target, redactedMsgid, redactor);
};

export const readMarkerCommandHandlers: CommandHandlerRegistry = new Map([
  ['MARKREAD', handleMARKREAD],
  ['REDACT', handleREDACT],
]);

/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Standard command handlers that do not modify complex IRCService state.
 */

import { tx } from '../../../i18n/transifex';
import type { CommandHandler, CommandHandlerRegistry } from '../commandTypes';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

/** FAIL - IRCv3.2 standard replies error */
export const handleFAIL: CommandHandler = (ctx, prefix, params, timestamp) => {
  const command = params[0] || t('UNKNOWN');
  const code = params[1] || '';
  const description = params[params.length - 1] || '';
  const context = params.length > 3 ? params.slice(2, -1).join(' ') : '';
  ctx.addMessage({
    type: 'error',
    text: t('*** FAIL {command} [{code}]{context}: {description}', {
      command,
      code,
      context: context ? ` ${context}` : '',
      description,
    }),
    timestamp,
  });
  ctx.emit('fail', command, code, context, description);
};

/** WARN - IRCv3.2 standard replies warning */
export const handleWARN: CommandHandler = (ctx, prefix, params, timestamp) => {
  const command = params[0] || t('UNKNOWN');
  const code = params[1] || '';
  const description = params[params.length - 1] || '';
  const context = params.length > 3 ? params.slice(2, -1).join(' ') : '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** WARN {command} [{code}]{context}: {description}', {
      command,
      code,
      context: context ? ` ${context}` : '',
      description,
    }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
  ctx.emit('warn', command, code, context, description);
};

/** NOTE - IRCv3.2 standard replies informational */
export const handleNOTE: CommandHandler = (ctx, prefix, params, timestamp) => {
  const command = params[0] || t('UNKNOWN');
  const code = params[1] || '';
  const description = params[params.length - 1] || '';
  const context = params.length > 3 ? params.slice(2, -1).join(' ') : '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** NOTE {command} [{code}]{context}: {description}', {
      command,
      code,
      context: context ? ` ${context}` : '',
      description,
    }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
  ctx.emit('note', command, code, context, description);
};

/** PONG - response to PING */
export const handlePONG: CommandHandler = (ctx, prefix, params) => {
  if (params.length > 1 && params[1]) {
    const token = params[1];
    const timestamp = parseInt(token, 10);
    if (!isNaN(timestamp)) {
      ctx.emit('pong', timestamp);
    }
  }
};

/** INVITE - invite to channel */
export const handleINVITE: CommandHandler = (ctx, prefix, params, timestamp) => {
  const invitedChannel = params[1] || '';
  const inviter = ctx.extractNick(prefix);
  const invitePrefixParts = prefix.split('!');
  const inviteUsername = invitePrefixParts[1]?.split('@')[0];
  const inviteHostname = invitePrefixParts[1]?.split('@')[1];
  ctx.addMessage({
    type: 'invite',
    from: inviter,
    channel: invitedChannel,
    text: t('{inviter} invited you to join {channel}', { inviter, channel: invitedChannel }),
    timestamp,
    username: inviteUsername,
    hostname: inviteHostname,
    target: invitedChannel,
    command: 'INVITE',
  });
};

export const standardCommandHandlers: CommandHandlerRegistry = new Map([
  ['FAIL', handleFAIL],
  ['WARN', handleWARN],
  ['NOTE', handleNOTE],
  ['PONG', handlePONG],
  ['INVITE', handleINVITE],
]);

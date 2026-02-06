/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * KILL command handler.
 */

import { tx } from '../../../i18n/transifex';
import type { CommandHandler, CommandHandlerRegistry } from '../commandTypes';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

export const handleKILL: CommandHandler = (ctx, prefix, params, timestamp) => {
  const killedNick = params[0] || '';
  const killReason = params.slice(1).join(' ').replace(/^:/, '') || t('No reason given');
  const currentNick = ctx.getCurrentNick();

  if (killedNick && currentNick && killedNick.toLowerCase() === currentNick.toLowerCase()) {
    ctx.addRawMessage(
      t('*** You were killed by {server}: {reason}', {
        server: ctx.extractNick(prefix) || t('server'),
        reason: killReason,
      }),
      'connection',
      timestamp
    );
    ctx.addMessage({
      type: 'error',
      text: t('*** You were killed: {reason}', { reason: killReason }),
      timestamp,
    });
    ctx.handleKillDisconnect(killReason);
    return;
  }

  ctx.addMessage({
    type: 'raw',
    text: t('*** {nick} was killed: {reason}', { nick: killedNick, reason: killReason }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

export const killCommandHandlers: CommandHandlerRegistry = new Map([
  ['KILL', handleKILL],
]);

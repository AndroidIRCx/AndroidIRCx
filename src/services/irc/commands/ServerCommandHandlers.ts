/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Server command handlers (ERROR, WALLOPS, REGISTER).
 */

import { tx } from '../../../i18n/transifex';
import type { CommandHandler, CommandHandlerRegistry } from '../commandTypes';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

export const handleERROR: CommandHandler = (ctx, prefix, params, timestamp) => {
  const errorText = params.join(' ') || 'Connection closed by server';
  ctx.addMessage({
    type: 'error',
    text: errorText,
    timestamp,
  });
  ctx.addRawMessage(`*** Server error: ${errorText}`, 'server');
  ctx.handleServerError(errorText);
};

export const handleWALLOPS: CommandHandler = (ctx, prefix, params, timestamp) => {
  const wallopsText = params[0] || '';
  const wallopsFrom = ctx.extractNick(prefix);
  const wallopsNetwork = ctx.getNetworkName();
  const wallopsMask = ctx.extractMaskFromNotice(wallopsText);
  if (wallopsMask) {
    const blacklistEntry = ctx.getUserManagementService().findMatchingBlacklistEntry(
      wallopsMask.nick,
      wallopsMask.username,
      wallopsMask.hostname,
      wallopsNetwork
    );
    if (blacklistEntry) {
      ctx.runBlacklistAction(blacklistEntry, {
        nick: wallopsMask.nick,
        username: wallopsMask.username,
        hostname: wallopsMask.hostname,
        network: wallopsNetwork,
        reasonOverride: wallopsText,
      });
    }
  }
  ctx.addMessage({
    type: 'notice',
    from: wallopsFrom,
    text: wallopsText,
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

export const handleREGISTER: CommandHandler = (ctx, _prefix, params, timestamp) => {
  // REGISTER SUCCESS <account> <message>
  // REGISTER VERIFICATION_REQUIRED <account> <message>
  const subcommand = (params[0] || '').toUpperCase();
  const account = params[1] || '';
  const message = params.slice(2).join(' ') || '';

  if (subcommand === 'SUCCESS') {
    ctx.addMessage({
      type: 'raw',
      text: t('*** Account {account} registered successfully: {message}', { account, message }),
      timestamp,
      isRaw: true,
      rawCategory: 'server',
    });
    ctx.emit('account-registered', account, message);
  } else if (subcommand === 'VERIFICATION_REQUIRED') {
    ctx.addMessage({
      type: 'raw',
      text: t('*** Account {account} requires verification: {message}', { account, message }),
      timestamp,
      isRaw: true,
      rawCategory: 'server',
    });
    ctx.emit('account-verification-required', account, message);
  } else {
    ctx.addRawMessage(
      t('*** REGISTER response: {params}', { params: params.join(' ') }),
      'server',
      timestamp
    );
  }
};

export const serverCommandHandlers: CommandHandlerRegistry = new Map([
  ['ERROR', handleERROR],
  ['WALLOPS', handleWALLOPS],
  ['REGISTER', handleREGISTER],
]);

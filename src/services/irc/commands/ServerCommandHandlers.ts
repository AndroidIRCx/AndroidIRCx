/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Server command handlers (ERROR, WALLOPS).
 */

import type { CommandHandler, CommandHandlerRegistry } from '../commandTypes';

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

export const serverCommandHandlers: CommandHandlerRegistry = new Map([
  ['ERROR', handleERROR],
  ['WALLOPS', handleWALLOPS],
]);

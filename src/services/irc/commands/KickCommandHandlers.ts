/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * KICK command handler.
 */

import { tx } from '../../../i18n/transifex';
import type { CommandHandler, CommandHandlerRegistry } from '../commandTypes';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

export const handleKICK: CommandHandler = (ctx, prefix, params, timestamp) => {
  const kickChannel = params[0] || '';
  const kickTarget = params[1] || '';
  const kickReason = params[2] || '';
  const kickBy = ctx.extractNick(prefix);

  if (kickTarget === ctx.getCurrentNick()) {
    ctx.emit('kick', kickChannel);
  }

  if (kickChannel && kickTarget) {
    const usersMap = ctx.getChannelUsers(kickChannel);
    if (usersMap) {
      usersMap.delete(kickTarget.toLowerCase());
      ctx.updateChannelUserList(kickChannel);
    }
  }

  ctx.addMessage({
    type: 'kick',
    channel: kickChannel,
    from: kickBy,
    text: t('{by} kicked {target} from {channel}{reason}', {
      by: kickBy,
      target: kickTarget,
      channel: kickChannel,
      reason: kickReason ? t(': {reason}', { reason: kickReason }) : '',
    }),
    timestamp,
    target: kickTarget,
    reason: kickReason || undefined,
    command: 'KICK',
  });
};

export const kickCommandHandlers: CommandHandlerRegistry = new Map([
  ['KICK', handleKICK],
]);

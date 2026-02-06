/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * PART command handler.
 */

import { tx } from '../../../i18n/transifex';
import type { CommandHandler, CommandHandlerRegistry } from '../commandTypes';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

export const handlePART: CommandHandler = (ctx, prefix, params, timestamp) => {
  const partChannel = params[0] || '';
  const partNick = ctx.extractNick(prefix);
  const partMessage = params[1] || '';
  const partPrefixParts = prefix.split('!');
  const partUsername = partPrefixParts[1]?.split('@')[0];
  const partHostname = partPrefixParts[1]?.split('@')[1];

  if (partChannel && partNick) {
    const usersMap = ctx.getChannelUsers(partChannel);
    if (usersMap) {
      usersMap.delete(partNick.toLowerCase());
      ctx.updateChannelUserList(partChannel);
    }
  }

  const isCurrentUserLeaving = partNick === ctx.getCurrentNick();

  ctx.addMessage({
    type: isCurrentUserLeaving ? 'notice' : 'part',
    channel: isCurrentUserLeaving ? undefined : partChannel,
    from: partNick,
    text: t('{nick} left {channel}{message}', {
      nick: partNick,
      channel: partChannel,
      message: partMessage ? t(': {message}', { message: partMessage }) : '',
    }),
    timestamp,
    username: partUsername,
    hostname: partHostname,
    target: partChannel,
    reason: partMessage || undefined,
    command: 'PART',
  });

  if (isCurrentUserLeaving && partChannel) {
    ctx.emitPart(partChannel, partNick);
  }
};

export const partCommandHandlers: CommandHandlerRegistry = new Map([
  ['PART', handlePART],
]);

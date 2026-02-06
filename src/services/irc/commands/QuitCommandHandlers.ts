/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * QUIT command handler.
 */

import { tx } from '../../../i18n/transifex';
import type { CommandHandler, CommandHandlerRegistry } from '../commandTypes';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

export const handleQUIT: CommandHandler = (ctx, prefix, params, timestamp) => {
  const quitNick = ctx.extractNick(prefix);
  const quitMessage = params[0] || '';
  const quitPrefixParts = prefix.split('!');
  const quitUsername = quitPrefixParts[1]?.split('@')[0];
  const quitHostname = quitPrefixParts[1]?.split('@')[1];
  const quitChannels: string[] = [];

  if (quitNick) {
    ctx.getAllChannelUsers().forEach((usersMap, channelName) => {
      if (usersMap.has(quitNick.toLowerCase())) {
        quitChannels.push(channelName);
        usersMap.delete(quitNick.toLowerCase());
        ctx.updateChannelUserList(channelName);
      }
    });
  }

  const quitDisplay = quitNick || t('User');
  const quitText = t('{nick} quit{message}', {
    nick: quitDisplay,
    message: quitMessage ? t(': {message}', { message: quitMessage }) : '',
  });

  if (quitChannels.length > 0) {
    quitChannels.forEach(channelName => {
      ctx.addMessage({
        type: 'quit',
        channel: channelName,
        from: quitNick,
        text: quitText,
        timestamp,
        username: quitUsername,
        hostname: quitHostname,
        target: channelName,
        reason: quitMessage || undefined,
        command: 'QUIT',
      });
    });
  } else {
    ctx.addMessage({
      type: 'quit',
      from: quitNick,
      text: quitText,
      timestamp,
      username: quitUsername,
      hostname: quitHostname,
      reason: quitMessage || undefined,
      command: 'QUIT',
    });
  }
};

export const quitCommandHandlers: CommandHandlerRegistry = new Map([
  ['QUIT', handleQUIT],
]);

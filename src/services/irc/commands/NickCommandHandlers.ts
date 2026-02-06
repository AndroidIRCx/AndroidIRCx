/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * NICK command handler.
 */

import { tx } from '../../../i18n/transifex';
import type { CommandHandler, CommandHandlerRegistry } from '../commandTypes';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

export const handleNICK: CommandHandler = (ctx, prefix, params, timestamp) => {
  const oldNick = ctx.extractNick(prefix);
  const newNick = params[0] || '';
  if (oldNick === ctx.getCurrentNick()) {
    ctx.setCurrentNick(newNick);
  }

  const affectedChannels: string[] = [];
  if (oldNick && newNick) {
    ctx.getAllChannelUsers().forEach((usersMap, channelName) => {
      const oldUser = usersMap.get(oldNick.toLowerCase());
      if (oldUser) {
        affectedChannels.push(channelName);
        usersMap.delete(oldNick.toLowerCase());
        oldUser.nick = newNick;
        usersMap.set(newNick.toLowerCase(), oldUser);
        ctx.updateChannelUserList(channelName);
      }
    });
  }

  const nickText = t('{oldNick} is now known as {newNick}', {
    oldNick: oldNick || t('Someone'),
    newNick,
  });

  if (affectedChannels.length > 0) {
    affectedChannels.forEach(channelName => {
      ctx.addMessage({
        type: 'nick',
        channel: channelName,
        from: oldNick,
        oldNick,
        newNick,
        text: nickText,
        timestamp,
      });
    });
  } else {
    ctx.addMessage({
      type: 'nick',
      from: oldNick,
      oldNick,
      newNick,
      text: nickText,
      timestamp,
    });
  }
};

export const nickCommandHandlers: CommandHandlerRegistry = new Map([
  ['NICK', handleNICK],
]);

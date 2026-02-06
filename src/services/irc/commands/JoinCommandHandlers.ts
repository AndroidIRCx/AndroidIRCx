/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * JOIN command handler.
 */

import { tx } from '../../../i18n/transifex';
import type { CommandHandler, CommandHandlerRegistry } from '../commandTypes';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

export const handleJOIN: CommandHandler = (ctx, prefix, params, timestamp) => {
  const channel = params[0] || '';
  const nick = ctx.extractNick(prefix);
  const joinPrefixParts = prefix.split('!');
  const joinUsername = joinPrefixParts[1]?.split('@')[0];
  const joinHostname = joinPrefixParts[1]?.split('@')[1];

  let joinText = t('{nick} joined {channel}', { nick, channel });
  let account: string | undefined;
  if (ctx.isExtendedJoinEnabled() && params.length >= 2) {
    account = params[1];
    if (account && account !== '*') {
      joinText = t('{nick} ({account}) joined {channel}', { nick, account, channel });
    } else {
      account = undefined;
    }
  }

  if (channel && nick) {
    const usersMap = ctx.ensureChannelUsersMap(channel);
    const existingUser = ctx.getUser(channel, nick);
    if (existingUser) {
      if (account) existingUser.account = account;
    } else {
      ctx.setUser(channel, nick, { nick, modes: [], account });
      ctx.updateChannelUserList(channel);
    }
  }

  if (channel && nick && nick !== ctx.getCurrentNick()) {
    ctx.runBlacklistCheckForJoin(nick, joinUsername, joinHostname, channel);
  }

  if (nick === ctx.getCurrentNick()) {
    ctx.emitJoinedChannel(channel);
    ctx.addPendingChannelIntro(channel);
  }

  ctx.addMessage({
    type: 'join',
    channel,
    from: nick,
    text: joinText,
    timestamp,
    username: joinUsername,
    hostname: joinHostname,
    target: channel,
    command: 'JOIN',
  });
};

export const joinCommandHandlers: CommandHandlerRegistry = new Map([
  ['JOIN', handleJOIN],
]);

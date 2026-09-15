/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * JOIN command handler.
 */

import { tx } from '../../../i18n/localization';
import type { CommandHandler, CommandHandlerRegistry } from '../commandTypes';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

const parseJoinUserHost = (
  prefix: string,
): { username?: string; hostname?: string } => {
  const bangIndex = prefix.indexOf('!');
  if (bangIndex === -1) {
    return {};
  }

  const userHost = prefix.slice(bangIndex + 1);
  const atIndex = userHost.indexOf('@');

  if (atIndex === -1) {
    return { username: userHost };
  }

  return {
    username: userHost.slice(0, atIndex),
    hostname: userHost.slice(atIndex + 1),
  };
};

export const handleJOIN: CommandHandler = (ctx, prefix, params, timestamp) => {
  const channel = params[0] || '';
  const nick = ctx.extractNick(prefix);
  const { username: joinUsername, hostname: joinHostname } =
    parseJoinUserHost(prefix);

  let joinText = t('{nick} joined {channel}', { nick, channel });
  let account: string | undefined;
  if (ctx.isExtendedJoinEnabled() && params.length >= 2) {
    account = params[1];
    if (account && account !== '*') {
      joinText = t('{nick} ({account}) joined {channel}', {
        nick,
        account,
        channel,
      });
    } else {
      account = undefined;
    }
  }

  if (channel && nick) {
    ctx.ensureChannelUsersMap(channel);
    const existingUser = ctx.getUser(channel, nick);
    if (existingUser) {
      if (account) existingUser.account = account;
      if (joinUsername) existingUser.ident = joinUsername;
      if (joinHostname) existingUser.host = joinHostname;
    } else {
      ctx.setUser(channel, nick, {
        nick,
        modes: [],
        account,
        ident: joinUsername,
        host: joinHostname,
      });
      ctx.updateChannelUserList(channel);
    }
  }

  if (channel && nick && nick !== ctx.getCurrentNick()) {
    ctx.runBlacklistCheckForJoin(nick, joinUsername, joinHostname, channel);
    // Check auto-op/voice/halfop after blacklist check
    ctx.runAutoModeCheckForJoin(nick, joinUsername, joinHostname, channel);
  }

  if (nick === ctx.getCurrentNick()) {
    ctx.emitJoinedChannel(channel);
    ctx.addPendingChannelIntro(channel);
    if (ctx.isNoImplicitNamesEnabled?.() && channel) {
      ctx.sendRaw(`NAMES ${channel}`);
    }
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

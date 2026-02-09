/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Channel operations command handlers for sendMessage:
 * BAN, UNBAN, KICKBAN, INVITE
 */

import { tx } from '../../../i18n/transifex';
import type { SendMessageHandler, SendMessageHandlerRegistry } from '../sendMessageTypes';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

export const handleBAN: SendMessageHandler = (ctx, args, target) => {
  // /ban <nick> [channel] - Ban user from channel
  if (args.length >= 1) {
    const banNick = args[0];
    const banChannel = args.length > 1 ? args[1] : (target.startsWith('#') || target.startsWith('&') ? target : '');
    if (banChannel) {
      // Try to get user's hostmask for ban, or use nick
      ctx.sendCommand(`MODE ${banChannel} +b ${banNick}!*@*`);
      ctx.addMessage({ type: 'notice', text: t('*** Banning {nick} from {channel}', { nick: banNick, channel: banChannel }), timestamp: Date.now() });
    } else {
      ctx.addMessage({ type: 'error', text: t('Usage: /ban <nick> [channel]'), timestamp: Date.now() });
    }
  } else {
    ctx.addMessage({ type: 'error', text: t('Usage: /ban <nick> [channel]'), timestamp: Date.now() });
  }
};

export const handleUNBAN: SendMessageHandler = (ctx, args, target) => {
  // /unban <nick|mask> [channel] - Unban user from channel
  if (args.length >= 1) {
    const unbanMask = args[0];
    const unbanChannel = args.length > 1 ? args[1] : (target.startsWith('#') || target.startsWith('&') ? target : '');
    if (unbanChannel) {
      ctx.sendCommand(`MODE ${unbanChannel} -b ${unbanMask}`);
      ctx.addMessage({ type: 'notice', text: t('*** Unbanning {mask} from {channel}', { mask: unbanMask, channel: unbanChannel }), timestamp: Date.now() });
    } else {
      ctx.addMessage({ type: 'error', text: t('Usage: /unban <nick|mask> [channel]'), timestamp: Date.now() });
    }
  } else {
    ctx.addMessage({ type: 'error', text: t('Usage: /unban <nick|mask> [channel]'), timestamp: Date.now() });
  }
};

export const handleKICKBAN: SendMessageHandler = (ctx, args, target) => {
  // /kickban <nick> [channel] [reason] - Kick and ban user
  if (args.length >= 1) {
    const kbNick = args[0];
    const kbChannel = args.length > 1 && (args[1].startsWith('#') || args[1].startsWith('&')) ? args[1] : (target.startsWith('#') || target.startsWith('&') ? target : args[1] || '');
    const kbReason = args.length > 2 ? args.slice(2).join(' ') : (args.length === 2 && !kbChannel.startsWith('#') && !kbChannel.startsWith('&') ? args[1] : '');
    if (kbChannel && (kbChannel.startsWith('#') || kbChannel.startsWith('&'))) {
      // Ban first, then kick
      ctx.sendCommand(`MODE ${kbChannel} +b ${kbNick}!*@*`);
      ctx.sendCommand(`KICK ${kbChannel} ${kbNick}${kbReason ? ` :${kbReason}` : ''}`);
      ctx.addMessage({ type: 'notice', text: t('*** Kicking and banning {nick} from {channel}', { nick: kbNick, channel: kbChannel }), timestamp: Date.now() });
    } else {
      ctx.addMessage({ type: 'error', text: t('Usage: /kickban <nick> [channel] [reason]'), timestamp: Date.now() });
    }
  } else {
    ctx.addMessage({ type: 'error', text: t('Usage: /kickban <nick> [channel] [reason]'), timestamp: Date.now() });
  }
};

export const handleINVITE: SendMessageHandler = (ctx, args, target) => {
  // /invite <nick> [channel] - Invite user to channel
  if (args.length >= 1) {
    const inviteNick = args[0];
    const inviteChannel = args.length > 1 ? args[1] : (target.startsWith('#') || target.startsWith('&') ? target : '');
    if (inviteChannel) {
      ctx.sendCommand(`INVITE ${inviteNick} ${inviteChannel}`);
      ctx.addMessage({ type: 'notice', text: t('*** Invited {nick} to {channel}', { nick: inviteNick, channel: inviteChannel }), timestamp: Date.now() });
    } else {
      ctx.addMessage({ type: 'error', text: t('Usage: /invite <nick> [channel]'), timestamp: Date.now() });
    }
  } else {
    ctx.addMessage({ type: 'error', text: t('Usage: /invite <nick> [channel]'), timestamp: Date.now() });
  }
};

export const channelOpsCommands: SendMessageHandlerRegistry = new Map([
  ['BAN', handleBAN],
  ['UNBAN', handleUNBAN],
  ['KICKBAN', handleKICKBAN],
  ['INVITE', handleINVITE],
]);

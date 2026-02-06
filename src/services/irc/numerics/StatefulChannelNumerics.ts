/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Stateful Channel/WHO Numeric Handlers
 *
 * These numerics modify IRCService state (topics, names buffer, silent WHO).
 */

import { tx } from '../../../i18n/transifex';
import type { NumericHandlerContext, NumericHandler } from '../types';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

/** 315 RPL_ENDOFWHO */
export const handle315: NumericHandler = (ctx, prefix, params, timestamp) => {
  const whoChannel = params[1] || '';
  const key = whoChannel.toLowerCase();

  if (ctx.isSilentWhoNick(key)) {
    ctx.removeSilentWhoCallback(key);
    ctx.removeSilentWhoNick(key);
    return;
  }

  ctx.addMessage({
    type: 'raw',
    text: t('*** End of WHO list for {channel}', { channel: whoChannel }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 324 RPL_CHANNELMODEIS */
export const handle324: NumericHandler = (ctx, prefix, params, timestamp) => {
  const channel = params[1] || '';
  const modes = params.slice(2).join(' ').trim();
  if (!channel || !modes) return;

  const existing = ctx.getChannelTopicInfo(channel) || {};
  const normalized = modes.startsWith('+') ? modes : `+${modes}`;
  ctx.setChannelTopicInfo(channel, { ...existing, modes: normalized });
  ctx.maybeEmitChannelIntro(channel, timestamp);
};

/** 331 RPL_NOTOPIC */
export const handle331: NumericHandler = (ctx, prefix, params, timestamp) => {
  const channel = params[1] || '';
  if (!channel) return;

  const existing = ctx.getChannelTopicInfo(channel) || {};
  ctx.setChannelTopicInfo(channel, { ...existing, topic: t('No topic is set.') });
  ctx.maybeEmitChannelIntro(channel, timestamp);
};

/** 332 RPL_TOPIC */
export const handle332: NumericHandler = (ctx, prefix, params, timestamp) => {
  const channel = params[1] || '';
  const topic = params.slice(2).join(' ') || '';
  if (!channel) return;

  const existing = ctx.getChannelTopicInfo(channel) || {};
  ctx.setChannelTopicInfo(channel, { ...existing, topic });
  ctx.maybeEmitChannelIntro(channel, timestamp);
};

/** 333 RPL_TOPICWHOTIME */
export const handle333: NumericHandler = (ctx, prefix, params, timestamp) => {
  const channel = params[1] || '';
  const setBy = params[2] || '';
  const setAtRaw = params[3];
  const setAt = setAtRaw ? parseInt(setAtRaw, 10) : undefined;
  if (!channel) return;

  const existing = ctx.getChannelTopicInfo(channel) || {};
  ctx.setChannelTopicInfo(channel, {
    ...existing,
    setBy,
    setAt: isNaN(setAt || NaN) ? existing.setAt : setAt,
  });
  ctx.maybeEmitChannelIntro(channel, timestamp);
};

/** 352 RPL_WHOREPLY */
export const handle352: NumericHandler = (ctx, prefix, params, timestamp) => {
  const whoChannel = params[1] || '';
  const whoUser = params[2] || '';
  const whoHost = params[3] || '';
  const whoServer = params[4] || '';
  const whoNick = params[5] || '';
  const whoFlags = params[6] || '';
  const whoRealParts = params.slice(7).join(' ').replace(/^:/, '').split(' ', 2);
  const whoReal = whoRealParts.slice(1).join(' ') || '';

  const awayStatus = whoFlags.includes('G') ? t(' (away)') : '';
  const opStatus = whoFlags.includes('*') ? t(' (IRCop)') : '';

  const whoNickLower = whoNick.toLowerCase();
  if (ctx.isSilentWhoNick(whoNickLower)) {
    const callback = ctx.getSilentWhoCallback(whoNickLower);
    if (callback) callback(whoUser, whoHost);
    return;
  }

  ctx.addMessage({
    type: 'raw',
    text: t('*** WHO {channel}: {nick} ({user}@{host}) [{server}]{away}{op} - {real}', {
      channel: whoChannel,
      nick: whoNick,
      user: whoUser,
      host: whoHost,
      server: whoServer,
      away: awayStatus,
      op: opStatus,
      real: whoReal,
    }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 353 RPL_NAMREPLY */
export const handle353: NumericHandler = (ctx, prefix, params, timestamp) => {
  const namesChannel = params[2] || '';
  const namesList = params.slice(3).join(' ').replace(/^:/, '');
  if (!namesChannel || !namesList) return;

  const users = namesList.split(/\s+/).filter(u => u.trim());
  if (users.length > 0) {
    ctx.addToNamesBuffer(namesChannel, users);
  }
};

/** 366 RPL_ENDOFNAMES */
export const handle366: NumericHandler = (ctx, prefix, params, timestamp) => {
  const endChannel = params[1] || '';
  const buffer = endChannel ? ctx.getNamesBuffer().get(endChannel) : undefined;
  if (!endChannel || !buffer) return;

  const usersMap = new Map<string, any>();
  buffer.forEach(userStr => {
    const parsed = ctx.parseUserWithPrefixes(userStr);
    if (parsed) {
      usersMap.set(parsed.nick.toLowerCase(), parsed);
    }
  });

  ctx.setChannelUsers(endChannel, usersMap);
  ctx.clearNamesBuffer(endChannel);
  ctx.emitUserListChange(endChannel, Array.from(usersMap.values()));
  ctx.maybeEmitChannelIntro(endChannel, timestamp);

  if (ctx.hasCapability('chathistory') || ctx.hasCapability('draft/chathistory')) {
    ctx.requestChatHistory(endChannel, 50);
  }
};

/**
 * Stateful handlers map
 */
export const statefulChannelHandlers: Map<number, NumericHandler> = new Map([
  [315, handle315],
  [324, handle324],
  [331, handle331],
  [332, handle332],
  [333, handle333],
  [352, handle352],
  [353, handle353],
  [366, handle366],
]);

/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Channel Numeric Handlers (321-368)
 *
 * These are responses related to channels.
 * - 321 RPL_LISTSTART - Channel list start
 * - 322 RPL_LIST - Channel list entry
 * - 323 RPL_LISTEND - Channel list end
 * - 324 RPL_CHANNELMODEIS - Channel modes
 * - 329 RPL_CREATIONTIME - Channel creation time
 * - 331 RPL_NOTOPIC - No topic set
 * - 332 RPL_TOPIC - Channel topic
 * - 333 RPL_TOPICWHOTIME - Topic setter info
 * - 341 RPL_INVITING - Invite confirmation
 * - 346 RPL_INVITELIST - Invite list entry
 * - 347 RPL_ENDOFINVITELIST - End of invite list
 * - 348 RPL_EXCEPTLIST - Exception list entry
 * - 349 RPL_ENDOFEXCEPTLIST - End of exception list
 * - 352 RPL_WHOREPLY - WHO reply
 * - 353 RPL_NAMREPLY - Names reply
 * - 315 RPL_ENDOFWHO - End of WHO
 * - 366 RPL_ENDOFNAMES - End of names
 * - 367 RPL_BANLIST - Ban list entry
 * - 368 RPL_ENDOFBANLIST - End of ban list
 *
 * NOTE: Some of these handlers modify state (namesBuffer, channelUsers, etc.)
 * These state changes are handled through the context interface.
 */

import { tx } from '../../../i18n/transifex';
import type { NumericHandlerContext, NumericHandler } from '../types';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

/** 321 RPL_LISTSTART */
export const handle321: NumericHandler = (ctx, prefix, params, timestamp) => {
  ctx.addMessage({
    type: 'raw',
    text: t('*** Channel list:'),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 322 RPL_LIST */
export const handle322: NumericHandler = (ctx, prefix, params, timestamp) => {
  const channel = params[1] || '';
  const users = params[2] || '0';
  const topic = params.slice(3).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** {channel} ({users} users): {topic}', { channel, users, topic }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 323 RPL_LISTEND */
export const handle323: NumericHandler = (ctx, prefix, params, timestamp) => {
  ctx.addMessage({
    type: 'raw',
    text: t('*** End of channel list'),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 329 RPL_CREATIONTIME */
export const handle329: NumericHandler = (ctx, prefix, params, timestamp) => {
  const channel = params[1] || '';
  const createdAtRaw = params[2] || '';
  const createdAt = createdAtRaw ? parseInt(createdAtRaw, 10) : 0;
  const createdDate = createdAt > 0 ? new Date(createdAt * 1000).toLocaleString() : t('unknown');
  ctx.addMessage({
    type: 'raw',
    text: t('*** {channel} was created on {date}', { channel, date: createdDate }),
    timestamp,
    isRaw: true,
    rawCategory: 'channel',
  });
};

/** 341 RPL_INVITING */
export const handle341: NumericHandler = (ctx, prefix, params, timestamp) => {
  const invitedNick = params[1] || '';
  const channel = params[2] || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** You have invited {nick} to {channel}', { nick: invitedNick, channel }),
    timestamp,
    isRaw: true,
    rawCategory: 'channel',
  });
};

/** 346 RPL_INVITELIST */
export const handle346: NumericHandler = (ctx, prefix, params, timestamp) => {
  const channel = params[1] || '';
  const inviteMask = params[2] || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** {channel} invite list: {mask}', { channel, mask: inviteMask }),
    timestamp,
    isRaw: true,
    rawCategory: 'channel',
  });
};

/** 347 RPL_ENDOFINVITELIST */
export const handle347: NumericHandler = (ctx, prefix, params, timestamp) => {
  const channel = params[1] || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** End of {channel} invite list', { channel }),
    timestamp,
    isRaw: true,
    rawCategory: 'channel',
  });
};

/** 348 RPL_EXCEPTLIST */
export const handle348: NumericHandler = (ctx, prefix, params, timestamp) => {
  const channel = params[1] || '';
  const exceptMask = params[2] || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** {channel} exception list: {mask}', { channel, mask: exceptMask }),
    timestamp,
    isRaw: true,
    rawCategory: 'channel',
  });
};

/** 349 RPL_ENDOFEXCEPTLIST */
export const handle349: NumericHandler = (ctx, prefix, params, timestamp) => {
  const channel = params[1] || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** End of {channel} exception list', { channel }),
    timestamp,
    isRaw: true,
    rawCategory: 'channel',
  });
};

/** 367 RPL_BANLIST */
export const handle367: NumericHandler = (ctx, prefix, params, timestamp) => {
  const channel = params[1] || '';
  const banMask = params[2] || '';
  const setBy = params[3] || '';
  const setAtRaw = params[4] || '';
  const setAt = setAtRaw ? parseInt(setAtRaw, 10) : 0;
  const setDate = setAt > 0 ? new Date(setAt * 1000).toLocaleString() : '';

  let text = t('*** {channel} ban: {mask}', { channel, mask: banMask });
  if (setBy) {
    text += t(' (set by {nick}', { nick: setBy });
    if (setDate) {
      text += t(' on {date})', { date: setDate });
    } else {
      text += ')';
    }
  }

  ctx.addMessage({
    type: 'raw',
    text,
    timestamp,
    isRaw: true,
    rawCategory: 'channel',
  });
};

/** 368 RPL_ENDOFBANLIST */
export const handle368: NumericHandler = (ctx, prefix, params, timestamp) => {
  const channel = params[1] || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** End of {channel} ban list', { channel }),
    timestamp,
    isRaw: true,
    rawCategory: 'channel',
  });
};

/** 364 RPL_LINKS */
export const handle364: NumericHandler = (ctx, prefix, params, timestamp) => {
  const mask = params[1] || '';
  const server = params[2] || '';
  const info = params.slice(3).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** Link: {server} ({info})', { server, info }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 365 RPL_ENDOFLINKS */
export const handle365: NumericHandler = (ctx, prefix, params, timestamp) => {
  const mask = params[1] || '*';
  ctx.addMessage({
    type: 'raw',
    text: t('*** End of LINKS ({mask})', { mask }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/**
 * Channel handlers map
 * NOTE: Complex stateful handlers (315, 324, 331-333, 352-353, 366) live in
 * StatefulChannelNumerics.ts.
 */
export const channelHandlers: Map<number, NumericHandler> = new Map([
  [321, handle321],
  [322, handle322],
  [323, handle323],
  [329, handle329],
  [341, handle341],
  [346, handle346],
  [347, handle347],
  [348, handle348],
  [349, handle349],
  [364, handle364],
  [365, handle365],
  [367, handle367],
  [368, handle368],
]);

/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * WHOIS/WHOWAS Numeric Handlers (301-320, 330, 335, 338, 369, 378-379)
 *
 * These are responses to WHOIS and WHOWAS commands.
 */

import { tx } from '../../../i18n/transifex';
import type { NumericHandlerContext, NumericHandler } from '../types';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

/** 301 RPL_AWAY - Away message */
export const handle301: NumericHandler = (ctx, prefix, params, timestamp) => {
  const awayNick = params[1] || '';
  const awayMsg = params.slice(2).join(' ').replace(/^:/, '') || t('is away');
  ctx.addMessage({
    type: 'raw',
    text: t('*** {nick} is away: {message}', { nick: awayNick, message: awayMsg }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 305 RPL_UNAWAY - No longer marked as being away */
export const handle305: NumericHandler = (ctx, prefix, params, timestamp) => {
  const message = params.slice(1).join(' ').replace(/^:/, '') || t('You are no longer marked as being away');
  ctx.addMessage({
    type: 'raw',
    text: t('*** {message}', { message }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 306 RPL_NOWAWAY - Marked as being away */
export const handle306: NumericHandler = (ctx, prefix, params, timestamp) => {
  const message = params.slice(1).join(' ').replace(/^:/, '') || t('You have been marked as being away');
  ctx.addMessage({
    type: 'raw',
    text: t('*** {message}', { message }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 307 RPL_WHOISREGNICK - Registered nick */
export const handle307: NumericHandler = (ctx, prefix, params, timestamp) => {
  const whoisNick = params[1] || '';
  const message = params.slice(2).join(' ').replace(/^:/, '') || t('has identified for this nick');
  ctx.addMessage({
    type: 'raw',
    text: t('*** {nick} {message}', { nick: whoisNick, message }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 308 RPL_WHOISADMIN - Admin status */
export const handle308: NumericHandler = (ctx, prefix, params, timestamp) => {
  const whoisNick = params[1] || '';
  const message = params.slice(2).join(' ').replace(/^:/, '') || t('is an admin');
  ctx.addMessage({
    type: 'raw',
    text: t('*** {nick} {message}', { nick: whoisNick, message }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 309 RPL_WHOISSADMIN - Services admin */
export const handle309: NumericHandler = (ctx, prefix, params, timestamp) => {
  const whoisNick = params[1] || '';
  const message = params.slice(2).join(' ').replace(/^:/, '') || t('is a services admin');
  ctx.addMessage({
    type: 'raw',
    text: t('*** {nick} {message}', { nick: whoisNick, message }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 310 RPL_WHOISHELPOP - Help operator */
export const handle310: NumericHandler = (ctx, prefix, params, timestamp) => {
  const whoisNick = params[1] || '';
  const message = params.slice(2).join(' ').replace(/^:/, '') || t('is available for help');
  ctx.addMessage({
    type: 'raw',
    text: t('*** {nick} {message}', { nick: whoisNick, message }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 311 RPL_WHOISUSER - User info */
export const handle311: NumericHandler = (ctx, prefix, params, timestamp) => {
  const whoisNick = params[1] || '';
  const whoisUser = params[2] || '';
  const whoisHost = params[3] || '';
  const whoisReal = params.slice(5).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** {nick} is {user}@{host} * {real}', {
      nick: whoisNick,
      user: whoisUser,
      host: whoisHost,
      real: whoisReal,
    }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 312 RPL_WHOISSERVER - Server info */
export const handle312: NumericHandler = (ctx, prefix, params, timestamp) => {
  const targetNick = params[1] || '';
  const serverName = params[2] || '';
  const serverInfo = params.slice(3).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** {nick} using {server} {info}', {
      nick: targetNick,
      server: serverName,
      info: serverInfo,
    }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 313 RPL_WHOISOPERATOR - IRC Operator */
export const handle313: NumericHandler = (ctx, prefix, params, timestamp) => {
  const whoisNick = params[1] || '';
  const message = params.slice(2).join(' ').replace(/^:/, '') || t('is an IRC operator');
  ctx.addMessage({
    type: 'raw',
    text: t('*** {nick} {message}', { nick: whoisNick, message }),
    timestamp,
    isRaw: true,
    rawCategory: 'user',
  });
  if (whoisNick && whoisNick === ctx.getCurrentNick()) {
    ctx.addRawMessage(
      t('*** You are now an IRC operator. Quick aliases: /oper /kill /gline /rehash /locops /wallops'),
      'user'
    );
  }
};

/** 314 RPL_WHOWASUSER - WHOWAS user info */
export const handle314: NumericHandler = (ctx, prefix, params, timestamp) => {
  const whowasNick = params[1] || '';
  const whowasUser = params[2] || '';
  const whowasHost = params[3] || '';
  const whowasReal = params.slice(5).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** {nick} was {user}@{host} * {real}', {
      nick: whowasNick,
      user: whowasUser,
      host: whowasHost,
      real: whowasReal,
    }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 317 RPL_WHOISIDLE - Idle time */
export const handle317: NumericHandler = (ctx, prefix, params, timestamp) => {
  const whoisNick = params[1] || '';
  const idleSeconds = parseInt(params[2] || '0', 10);
  const signonTime = parseInt(params[3] || '0', 10);
  const idleMinutes = Math.floor(idleSeconds / 60);
  const idleHours = Math.floor(idleMinutes / 60);
  const remainingMinutes = idleMinutes % 60;

  let idleText = '';
  if (idleHours > 0) {
    idleText = t('{hours} hours, {minutes} minutes', {
      hours: idleHours,
      minutes: remainingMinutes,
    });
  } else if (idleMinutes > 0) {
    idleText = t('{minutes} minutes', { minutes: idleMinutes });
  } else {
    idleText = t('{seconds} seconds', { seconds: idleSeconds });
  }

  const signonDate = signonTime > 0 ? new Date(signonTime * 1000).toLocaleString() : t('unknown');
  ctx.addMessage({
    type: 'raw',
    text: t('*** {nick} has been idle {idle}, signed on {date}', {
      nick: whoisNick,
      idle: idleText,
      date: signonDate,
    }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 318 RPL_ENDOFWHOIS - End of WHOIS */
export const handle318: NumericHandler = (ctx, prefix, params, timestamp) => {
  const whoisNick = params[1] || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** End of WHOIS for {nick}', { nick: whoisNick }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
    whoisData: {
      nick: whoisNick,
    },
  });
};

/** 319 RPL_WHOISCHANNELS - Channels */
export const handle319: NumericHandler = (ctx, prefix, params, timestamp) => {
  const whoisNick = params[1] || '';
  const channelsStr = params.slice(2).join(' ').replace(/^:/, '') || '';
  const channels = channelsStr.split(/\s+/).filter(c => c.length > 0);
  ctx.addMessage({
    type: 'raw',
    text: t('*** {nick} is on channels: {channels}', { nick: whoisNick, channels: channelsStr }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
    whoisData: {
      nick: whoisNick,
      channels,
    },
  });
};

/** 320 RPL_WHOISSPECIAL - Special status */
export const handle320: NumericHandler = (ctx, prefix, params, timestamp) => {
  const whoisNick = params[1] || '';
  const message = params.slice(2).join(' ').replace(/^:/, '') || t('is special');
  ctx.addMessage({
    type: 'raw',
    text: t('*** {nick} {message}', { nick: whoisNick, message }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 330 RPL_WHOISACCOUNT - Logged in account */
export const handle330: NumericHandler = (ctx, prefix, params, timestamp) => {
  const targetNick = params[1] || '';
  const accountName = params[2] || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** {nick} is logged in as {account}', {
      nick: targetNick,
      account: accountName,
    }),
    timestamp,
    isRaw: true,
    rawCategory: 'user',
  });
};

/** 335 RPL_WHOISBOT - Bot status */
export const handle335: NumericHandler = (ctx, prefix, params, timestamp) => {
  const whoisNick = params[1] || '';
  const message = params.slice(2).join(' ').replace(/^:/, '') || t('is a bot');
  ctx.addMessage({
    type: 'raw',
    text: t('*** {nick} {message}', { nick: whoisNick, message }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 338 RPL_WHOISACTUALLY - Actual host */
export const handle338: NumericHandler = (ctx, prefix, params, timestamp) => {
  const targetNick = params[1] || '';
  const actualHost = params[2] || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** {nick} is actually using host {host}', {
      nick: targetNick,
      host: actualHost,
    }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 369 RPL_ENDOFWHOWAS - End of WHOWAS */
export const handle369: NumericHandler = (ctx, prefix, params, timestamp) => {
  const whowasNick = params[1] || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** End of WHOWAS for {nick}', { nick: whowasNick }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 378 RPL_WHOISHOST - Connecting host */
export const handle378: NumericHandler = (ctx, prefix, params, timestamp) => {
  const targetNick = params[1] || '';
  const hostInfo = params.slice(2).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** {nick} is connecting from {host}', {
      nick: targetNick,
      host: hostInfo,
    }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 379 RPL_WHOISMODES - User modes */
export const handle379: NumericHandler = (ctx, prefix, params, timestamp) => {
  const targetNick = params[1] || '';
  const modes = params.slice(2).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** {nick} is using modes {modes}', {
      nick: targetNick,
      modes,
    }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 302 RPL_USERHOST - Userhost reply */
export const handle302: NumericHandler = (ctx, prefix, params, timestamp) => {
  const userhostData = params.slice(1).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** USERHOST: {data}', { data: userhostData }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 303 RPL_ISON - ISON reply */
export const handle303: NumericHandler = (ctx, prefix, params, timestamp) => {
  const isonNicks = params.slice(1).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** Users online: {nicks}', { nicks: isonNicks }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 304 RPL_TEXT - Text reply */
export const handle304: NumericHandler = (ctx, prefix, params, timestamp) => {
  const text = params.slice(1).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** {text}', { text }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 316 RPL_WHOISCHANOP - Channel operator status (deprecated) */
export const handle316: NumericHandler = (ctx, prefix, params, timestamp) => {
  const whoisNick = params[1] || '';
  const message = params.slice(2).join(' ').replace(/^:/, '') || t('is a channel operator');
  ctx.addMessage({
    type: 'raw',
    text: t('*** {nick} {message}', { nick: whoisNick, message }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/**
 * WHOIS/WHOWAS handlers map
 */
export const whoisHandlers: Map<number, NumericHandler> = new Map([
  [301, handle301],
  [302, handle302],
  [303, handle303],
  [304, handle304],
  [305, handle305],
  [306, handle306],
  [307, handle307],
  [308, handle308],
  [309, handle309],
  [310, handle310],
  [311, handle311],
  [312, handle312],
  [313, handle313],
  [314, handle314],
  [316, handle316],
  [317, handle317],
  [318, handle318],
  [319, handle319],
  [320, handle320],
  [330, handle330],
  [335, handle335],
  [338, handle338],
  [369, handle369],
  [378, handle378],
  [379, handle379],
]);

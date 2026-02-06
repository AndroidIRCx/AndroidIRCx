/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * MONITOR/WATCH Numeric Handlers (600-608, 730-734)
 *
 * These are responses to MONITOR and WATCH commands for tracking user status.
 * - 600 RPL_LOGON - User logged on
 * - 601 RPL_LOGOFF - User logged off
 * - 602-603 RPL_WATCH* - Watch status
 * - 604-605 RPL_NOW* - User online/offline
 * - 606-608 RPL_WATCH* - Watch list management
 * - 730 RPL_MONONLINE - Monitored nicks online
 * - 731 RPL_MONOFFLINE - Monitored nicks offline
 * - 732 RPL_MONLIST - Monitor list
 * - 733 RPL_ENDOFMONLIST - End of monitor list
 * - 734 ERR_MONLISTFULL - Monitor list full
 */

import { tx } from '../../../i18n/transifex';
import type { NumericHandlerContext, NumericHandler } from '../types';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

/** 600 RPL_LOGON - User logged on */
export const handle600: NumericHandler = (ctx, prefix, params, timestamp) => {
  const nick = params[1] || '';
  const user = params[2] || '';
  const host = params[3] || '';
  const message = params.slice(5).join(' ').replace(/^:/, '') || t('logged online');
  ctx.addMessage({
    type: 'raw',
    text: t('*** {nick} ({user}@{host}) {message}', { nick, user, host, message }),
    timestamp,
    isRaw: true,
    rawCategory: 'user',
  });
};

/** 601 RPL_LOGOFF - User logged off */
export const handle601: NumericHandler = (ctx, prefix, params, timestamp) => {
  const nick = params[1] || '';
  const user = params[2] || '';
  const host = params[3] || '';
  const message = params.slice(5).join(' ').replace(/^:/, '') || t('logged offline');
  ctx.addMessage({
    type: 'raw',
    text: t('*** {nick} ({user}@{host}) {message}', { nick, user, host, message }),
    timestamp,
    isRaw: true,
    rawCategory: 'user',
  });
};

/** 602 RPL_WATCHON - Added to watch list */
export const handle602: NumericHandler = (ctx, prefix, params, timestamp) => {
  const nick = params[1] || '';
  const message = params.slice(2).join(' ').replace(/^:/, '') || t('added to watch list');
  ctx.addMessage({
    type: 'raw',
    text: t('*** {nick} {message}', { nick, message }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 603 RPL_WATCHOFF - Removed from watch list */
export const handle603: NumericHandler = (ctx, prefix, params, timestamp) => {
  const nick = params[1] || '';
  const message = params.slice(2).join(' ').replace(/^:/, '') || t('removed from watch list');
  ctx.addMessage({
    type: 'raw',
    text: t('*** {nick} {message}', { nick, message }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 604 RPL_NOWON - User is now online */
export const handle604: NumericHandler = (ctx, prefix, params, timestamp) => {
  const nick = params[1] || '';
  const user = params[2] || '';
  const host = params[3] || '';
  const message = params.slice(5).join(' ').replace(/^:/, '') || t('is online');
  ctx.addMessage({
    type: 'raw',
    text: t('*** {nick} ({user}@{host}) {message}', { nick, user, host, message }),
    timestamp,
    isRaw: true,
    rawCategory: 'user',
  });
};

/** 605 RPL_NOWOFF - User is now offline */
export const handle605: NumericHandler = (ctx, prefix, params, timestamp) => {
  const nick = params[1] || '';
  const user = params[2] || '';
  const host = params[3] || '';
  const message = params.slice(5).join(' ').replace(/^:/, '') || t('is offline');
  ctx.addMessage({
    type: 'raw',
    text: t('*** {nick} ({user}@{host}) {message}', { nick, user, host, message }),
    timestamp,
    isRaw: true,
    rawCategory: 'user',
  });
};

/** 606 RPL_WATCHLIST - Watch list entry */
export const handle606: NumericHandler = (ctx, prefix, params, timestamp) => {
  const nick = params[1] || '';
  const message = params.slice(2).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** Watch: {nick} {message}', { nick, message }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 607 RPL_ENDOFWATCHLIST - End of watch list */
export const handle607: NumericHandler = (ctx, prefix, params, timestamp) => {
  const message = params.slice(1).join(' ').replace(/^:/, '') || t('End of WATCH list');
  ctx.addMessage({
    type: 'raw',
    text: t('*** {message}', { message }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 608 RPL_WATCHCLEAR - Watch list cleared */
export const handle608: NumericHandler = (ctx, prefix, params, timestamp) => {
  const message = params.slice(1).join(' ').replace(/^:/, '') || t('Watch list cleared');
  ctx.addMessage({
    type: 'raw',
    text: t('*** {message}', { message }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 730 RPL_MONONLINE - Monitored nicks are now online */
export const handle730: NumericHandler = (ctx, prefix, params, timestamp) => {
  const nicks = params.slice(1).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** Now online: {nicks}', { nicks }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 731 RPL_MONOFFLINE - Monitored nicks are now offline */
export const handle731: NumericHandler = (ctx, prefix, params, timestamp) => {
  const nicks = params.slice(1).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** Now offline: {nicks}', { nicks }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 732 RPL_MONLIST - Monitor list entry */
export const handle732: NumericHandler = (ctx, prefix, params, timestamp) => {
  const monList = params.slice(1).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** MONITOR list: {list}', { list: monList }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 733 RPL_ENDOFMONLIST - End of MONITOR list */
export const handle733: NumericHandler = (ctx, prefix, params, timestamp) => {
  const message = params.slice(1).join(' ').replace(/^:/, '') || t('End of MONITOR list');
  ctx.addMessage({
    type: 'raw',
    text: t('*** {message}', { message }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 734 ERR_MONLISTFULL - Monitor list is full */
export const handle734: NumericHandler = (ctx, prefix, params, timestamp) => {
  const limit = params[1] || '';
  const nicks = params[2] || '';
  const message = params.slice(3).join(' ').replace(/^:/, '') || t('Monitor list is full');
  ctx.addMessage({
    type: 'error',
    text: t('{message} (limit: {limit}, tried: {nicks})', { message, limit, nicks }),
    timestamp,
  });
};

/**
 * MONITOR/WATCH handlers map
 */
export const monitorHandlers: Map<number, NumericHandler> = new Map([
  [600, handle600],
  [601, handle601],
  [602, handle602],
  [603, handle603],
  [604, handle604],
  [605, handle605],
  [606, handle606],
  [607, handle607],
  [608, handle608],
  [730, handle730],
  [731, handle731],
  [732, handle732],
  [733, handle733],
  [734, handle734],
]);

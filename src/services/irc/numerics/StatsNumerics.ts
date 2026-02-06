/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Stats Numeric Handlers (211-250)
 *
 * These are responses to the STATS command.
 * - 211-218 RPL_STATS* - Various stats
 * - 219 RPL_ENDOFSTATS - End of stats
 * - 220 RPL_STATSPLINE - P-line stats
 * - 221 RPL_UMODEIS - User modes
 * - 240-249 Various stats lines
 * - 250 RPL_STATSCONN - Connection stats
 */

import { tx } from '../../../i18n/transifex';
import type { NumericHandlerContext, NumericHandler } from '../types';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

/** Generic stats handler for multiple numerics */
const createGenericStatsHandler = (): NumericHandler => {
  return (ctx, prefix, params, timestamp) => {
    // Get the numeric from the context - we'll pass it through params
    const statsData = params.slice(1).join(' ').replace(/^:/, '') || '';
    ctx.addMessage({
      type: 'raw',
      text: statsData ? `*** ${statsData}` : '***',
      timestamp,
      isRaw: true,
      rawCategory: 'server',
    });
  };
};

/** Generic stats handler with numeric in output */
const createNumericStatsHandler = (numeric: number): NumericHandler => {
  return (ctx, prefix, params, timestamp) => {
    const statsData = params.slice(1).join(' ').replace(/^:/, '') || '';
    ctx.addMessage({
      type: 'raw',
      text: t('*** [{numeric}] {message}', { numeric, message: statsData }),
      timestamp,
      isRaw: true,
      rawCategory: 'server',
    });
  };
};

/** 219 RPL_ENDOFSTATS */
export const handle219: NumericHandler = (ctx, prefix, params, timestamp) => {
  const query = params[1] || '';
  const message = params.slice(2).join(' ').replace(/^:/, '') || t('End of STATS report');
  ctx.addMessage({
    type: 'raw',
    text: t('*** {label}: {message}', { label: query, message }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 221 RPL_UMODEIS - User modes (special handling) */
export const handle221: NumericHandler = (ctx, prefix, params, timestamp) => {
  const modeString = params[1] || '';

  // Update user modes
  ctx.updateSelfUserModes(modeString);

  // Check if this was a silent MODE request
  if (ctx.isSilentModeNick(ctx.getCurrentNick().toLowerCase())) {
    ctx.removeSilentModeNick(ctx.getCurrentNick().toLowerCase());
    return; // Don't display - keep it silent
  }

  ctx.addMessage({
    type: 'raw',
    text: t('*** User modes: {modes}', { modes: modeString || t('none') }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 242 RPL_STATSUPTIME */
export const handle242: NumericHandler = (ctx, prefix, params, timestamp) => {
  const uptime = params.slice(1).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** {message}', { message: uptime }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 250 RPL_STATSCONN */
export const handle250: NumericHandler = (ctx, prefix, params, timestamp) => {
  const statsConn = params.slice(1).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** {message}', { message: statsConn }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 261 RPL_TRACELOG */
export const handle261: NumericHandler = (ctx, prefix, params, timestamp) => {
  const traceLog = params.slice(1).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** Trace Log: {info}', { info: traceLog }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 262 RPL_TRACEEND */
export const handle262: NumericHandler = (ctx, prefix, params, timestamp) => {
  const traceEnd = params.slice(1).join(' ').replace(/^:/, '') || t('End of TRACE');
  ctx.addMessage({
    type: 'raw',
    text: t('*** {message}', { message: traceEnd }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 263 RPL_TRYAGAIN - Try again */
export const handle263: NumericHandler = (ctx, prefix, params, timestamp) => {
  const cmd = params[1] || '';
  const message = params.slice(2).join(' ').replace(/^:/, '') || t('Please wait a while and try again');
  ctx.addMessage({
    type: 'error',
    text: t('*** {command}: {message}', { command: cmd, message }),
    timestamp,
  });
};

/** 264 RPL_LOCALUSERS (alternate form) */
export const handle264: NumericHandler = (ctx, prefix, params, timestamp) => {
  const localUsersMsg = params.slice(1).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** {message}', { message: localUsersMsg }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 364 RPL_LINKS - Links entry */
export const handle364: NumericHandler = (ctx, prefix, params, timestamp) => {
  const linkMask = params[1] || '';
  const linkServer = params[2] || '';
  const linkInfo = params.slice(3).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** {mask} -> {server} {info}', { mask: linkMask, server: linkServer, info: linkInfo }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 365 RPL_ENDOFLINKS - End of links */
export const handle365: NumericHandler = (ctx, prefix, params, timestamp) => {
  const linkMask = params[1] || '';
  const message = params.slice(2).join(' ').replace(/^:/, '') || t('End of LINKS');
  ctx.addMessage({
    type: 'raw',
    text: t('*** {mask}: {message}', { mask: linkMask, message }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 392 RPL_USERSSTART - Users start */
export const handle392: NumericHandler = (ctx, prefix, params, timestamp) => {
  const message = params.slice(1).join(' ').replace(/^:/, '') || t('Users start');
  ctx.addMessage({
    type: 'raw',
    text: t('*** {message}', { message }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 393 RPL_USERS - Users */
export const handle393: NumericHandler = (ctx, prefix, params, timestamp) => {
  const userInfo = params.slice(1).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** {info}', { info: userInfo }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 394 RPL_ENDOFUSERS - End of users */
export const handle394: NumericHandler = (ctx, prefix, params, timestamp) => {
  const message = params.slice(1).join(' ').replace(/^:/, '') || t('End of users');
  ctx.addMessage({
    type: 'raw',
    text: t('*** {message}', { message }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 395 RPL_NOUSERS - No users */
export const handle395: NumericHandler = (ctx, prefix, params, timestamp) => {
  const message = params.slice(1).join(' ').replace(/^:/, '') || t('Nobody logged in');
  ctx.addMessage({
    type: 'raw',
    text: t('*** {message}', { message }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/**
 * Stats handlers map
 */
export const statsHandlers: Map<number, NumericHandler> = new Map([
  // 211-218: Generic stats
  [211, createNumericStatsHandler(211)],
  [263, handle263],
  [364, handle364],
  [365, handle365],
  [392, handle392],
  [393, handle393],
  [394, handle394],
  [395, handle395],
  [212, createNumericStatsHandler(212)],
  [213, createNumericStatsHandler(213)],
  [214, createNumericStatsHandler(214)],
  [215, createNumericStatsHandler(215)],
  [216, createNumericStatsHandler(216)],
  [217, createNumericStatsHandler(217)],
  [218, createNumericStatsHandler(218)],
  [219, handle219],
  [220, createNumericStatsHandler(220)],
  [221, handle221],
  // 240-249: Various stats lines
  [240, createNumericStatsHandler(240)],
  [241, createNumericStatsHandler(241)],
  [242, handle242],
  [243, createNumericStatsHandler(243)],
  [244, createNumericStatsHandler(244)],
  [245, createNumericStatsHandler(245)],
  [246, createNumericStatsHandler(246)],
  [247, createNumericStatsHandler(247)],
  [248, createNumericStatsHandler(248)],
  [249, createNumericStatsHandler(249)],
  [250, handle250],
  // Extended trace/stats
  [261, handle261],
  [262, handle262],
  [264, handle264],
]);

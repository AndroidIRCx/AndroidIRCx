/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Version and Info Numeric Handlers (351, 371, 374, 381-391)
 *
 * These are responses to VERSION, INFO, TIME, and OPER commands.
 * - 351 RPL_VERSION - Server version
 * - 371 RPL_INFO - Info line
 * - 374 RPL_ENDOFINFO - End of INFO
 * - 381 RPL_YOUREOPER - IRC operator status
 * - 382 RPL_REHASHING - Server rehashing
 * - 383 RPL_YOURESERVICE - Service mode
 * - 391 RPL_TIME - Server time
 */

import { tx } from '../../../i18n/transifex';
import type { NumericHandlerContext, NumericHandler } from '../types';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

/** 351 RPL_VERSION - Server version */
export const handle351: NumericHandler = (ctx, prefix, params, timestamp) => {
  const version = params[1] || '';
  const server = params[2] || '';
  const comments = params.slice(3).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** Version: {version} on {server} {comments}', { version, server, comments }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 371 RPL_INFO - Info line */
export const handle371: NumericHandler = (ctx, prefix, params, timestamp) => {
  const info = params.slice(1).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** {message}', { message: info }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 374 RPL_ENDOFINFO - End of INFO */
export const handle374: NumericHandler = (ctx, prefix, params, timestamp) => {
  const message = params.slice(1).join(' ').replace(/^:/, '') || t('End of INFO');
  ctx.addMessage({
    type: 'raw',
    text: t('*** {message}', { message }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 381 RPL_YOUREOPER - You are now an IRC operator */
export const handle381: NumericHandler = (ctx, prefix, params, timestamp) => {
  const message = params.slice(1).join(' ').replace(/^:/, '') || t('You are now an IRC operator');
  ctx.updateSelfUserModes('+o');
  ctx.addMessage({
    type: 'raw',
    text: t('*** {message}', { message }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 382 RPL_REHASHING - Server rehashing */
export const handle382: NumericHandler = (ctx, prefix, params, timestamp) => {
  const config = params[1] || '';
  const message = params.slice(2).join(' ').replace(/^:/, '') || t('Rehashing');
  ctx.addMessage({
    type: 'raw',
    text: t('*** {label}: {message}', { label: config, message }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 383 RPL_YOURESERVICE - You are service */
export const handle383: NumericHandler = (ctx, prefix, params, timestamp) => {
  const message = params.slice(1).join(' ').replace(/^:/, '') || t('You are service');
  ctx.addMessage({
    type: 'raw',
    text: t('*** {message}', { message }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 391 RPL_TIME - Server time */
export const handle391: NumericHandler = (ctx, prefix, params, timestamp) => {
  const server = params[1] || '';
  const timeStr = params.slice(2).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** Time on {server}: {time}', { server, time: timeStr }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/**
 * Version/Info handlers map
 */
export const versionInfoHandlers: Map<number, NumericHandler> = new Map([
  [351, handle351],
  [371, handle371],
  [374, handle374],
  [381, handle381],
  [382, handle382],
  [383, handle383],
  [391, handle391],
]);

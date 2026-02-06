/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * LUSERS/ADMIN Numeric Handlers (251-259, 265-266)
 *
 * These are responses to the LUSERS and ADMIN commands.
 * - 251 RPL_LUSERCLIENT - User count
 * - 252 RPL_LUSEROP - Operator count
 * - 253 RPL_LUSERUNKNOWN - Unknown connections
 * - 254 RPL_LUSERCHANNELS - Channel count
 * - 255 RPL_LUSERME - Server info
 * - 256 RPL_ADMINME - Admin info start
 * - 257 RPL_ADMINLOC1 - Admin location
 * - 258 RPL_ADMINLOC2 - Admin location details
 * - 259 RPL_ADMINEMAIL - Admin email
 * - 265 RPL_LOCALUSERS - Local user count
 * - 266 RPL_GLOBALUSERS - Global user count
 */

import { tx } from '../../../i18n/transifex';
import type { NumericHandlerContext, NumericHandler } from '../types';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

/** 251 RPL_LUSERCLIENT */
export const handle251: NumericHandler = (ctx, prefix, params, timestamp) => {
  const message = params.slice(1).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** {message}', { message }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 252 RPL_LUSEROP */
export const handle252: NumericHandler = (ctx, prefix, params, timestamp) => {
  const count = params[1] || '0';
  const message = params.slice(2).join(' ').replace(/^:/, '') || t('operator(s) online');
  ctx.addMessage({
    type: 'raw',
    text: t('*** {count} {message}', { count, message }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 253 RPL_LUSERUNKNOWN */
export const handle253: NumericHandler = (ctx, prefix, params, timestamp) => {
  const count = params[1] || '0';
  const message = params.slice(2).join(' ').replace(/^:/, '') || t('unknown connection(s)');
  ctx.addMessage({
    type: 'raw',
    text: t('*** {count} {message}', { count, message }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 254 RPL_LUSERCHANNELS */
export const handle254: NumericHandler = (ctx, prefix, params, timestamp) => {
  const count = params[1] || '0';
  const message = params.slice(2).join(' ').replace(/^:/, '') || t('channels formed');
  ctx.addMessage({
    type: 'raw',
    text: t('*** {count} {message}', { count, message }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 255 RPL_LUSERME */
export const handle255: NumericHandler = (ctx, prefix, params, timestamp) => {
  const message = params.slice(1).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** {message}', { message }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 256 RPL_ADMINME */
export const handle256: NumericHandler = (ctx, prefix, params, timestamp) => {
  const message = params.slice(1).join(' ').replace(/^:/, '') || t('Administrative info');
  ctx.addMessage({
    type: 'raw',
    text: t('*** {message}', { message }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 257 RPL_ADMINLOC1 */
export const handle257: NumericHandler = (ctx, prefix, params, timestamp) => {
  const location = params.slice(1).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** {message}', { message: location }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 258 RPL_ADMINLOC2 */
export const handle258: NumericHandler = (ctx, prefix, params, timestamp) => {
  const location = params.slice(1).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** {message}', { message: location }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 259 RPL_ADMINEMAIL */
export const handle259: NumericHandler = (ctx, prefix, params, timestamp) => {
  const email = params.slice(1).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** {message}', { message: email }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 265 RPL_LOCALUSERS */
export const handle265: NumericHandler = (ctx, prefix, params, timestamp) => {
  const current = params[1] || '';
  const max = params[2] || '';
  const message = params.slice(3).join(' ').replace(/^:/, '') || t('Current local users {current}, max {max}', { current, max });
  ctx.addMessage({
    type: 'raw',
    text: t('*** {message}', { message }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 266 RPL_GLOBALUSERS */
export const handle266: NumericHandler = (ctx, prefix, params, timestamp) => {
  const current = params[1] || '';
  const max = params[2] || '';
  const message = params.slice(3).join(' ').replace(/^:/, '') || t('Current global users {current}, max {max}', { current, max });
  ctx.addMessage({
    type: 'raw',
    text: t('*** {message}', { message }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/**
 * LUSERS handlers map
 */
export const lusersHandlers: Map<number, NumericHandler> = new Map([
  [251, handle251],
  [252, handle252],
  [253, handle253],
  [254, handle254],
  [255, handle255],
  [256, handle256],
  [257, handle257],
  [258, handle258],
  [259, handle259],
  [265, handle265],
  [266, handle266],
]);

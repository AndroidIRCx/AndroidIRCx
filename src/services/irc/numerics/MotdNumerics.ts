/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * MOTD Numeric Handlers (372, 375-376, 422)
 *
 * These are responses to the MOTD command (Message of the Day).
 * - 375 RPL_MOTDSTART - Start of MOTD
 * - 372 RPL_MOTD - MOTD text line
 * - 376 RPL_ENDOFMOTD - End of MOTD
 * - 422 ERR_NOMOTD - No MOTD file
 */

import { tx } from '../../../i18n/transifex';
import type { NumericHandlerContext, NumericHandler } from '../types';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

/** 372 RPL_MOTD */
export const handle372: NumericHandler = (ctx, prefix, params, timestamp) => {
  ctx.addMessage({
    type: 'raw',
    text: t('*** {message}', { message: params[1] }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 375 RPL_MOTDSTART */
export const handle375: NumericHandler = (ctx, prefix, params, timestamp) => {
  ctx.addMessage({
    type: 'raw',
    text: t('*** - {server} Message of the Day -', { server: params[1] }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 376 RPL_ENDOFMOTD */
export const handle376: NumericHandler = (ctx, prefix, params, timestamp) => {
  ctx.addMessage({
    type: 'raw',
    text: t('*** End of /MOTD command.'),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
  ctx.emit('motdEnd');
};

/** 422 ERR_NOMOTD */
export const handle422: NumericHandler = (ctx, prefix, params, timestamp) => {
  ctx.addMessage({
    type: 'raw',
    text: t('*** No Message of the Day.'),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
  ctx.emit('motdEnd');
};

/**
 * MOTD handlers map
 */
export const motdHandlers: Map<number, NumericHandler> = new Map([
  [372, handle372],
  [375, handle375],
  [376, handle376],
  [422, handle422],
]);

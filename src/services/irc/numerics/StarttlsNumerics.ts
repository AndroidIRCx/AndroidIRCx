/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * STARTTLS Numeric Handlers (670-699)
 *
 * These are responses to STARTTLS command for TLS encryption.
 * - 670 RPL_STARTTLS - STARTTLS successful
 * - 691 ERR_STARTTLS - STARTTLS failed
 * - 690, 692-699 Extended TLS numerics
 */

import { tx } from '../../../i18n/transifex';
import type { NumericHandlerContext, NumericHandler } from '../types';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

/** 670 RPL_STARTTLS - STARTTLS successful */
export const handle670: NumericHandler = (ctx, prefix, params, timestamp) => {
  const message = params.slice(1).join(' ').replace(/^:/, '') || t('STARTTLS successful');
  ctx.addMessage({
    type: 'raw',
    text: t('*** {message}', { message }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 691 ERR_STARTTLS - STARTTLS failed */
export const handle691: NumericHandler = (ctx, prefix, params, timestamp) => {
  const errorMsg = params.slice(1).join(' ').replace(/^:/, '') || t('STARTTLS failed');
  ctx.addMessage({
    type: 'error',
    text: errorMsg,
    timestamp,
  });
};

/** Generic handler for extended TLS numerics (690, 692-699) */
const createExtendedTlsHandler = (numeric: number): NumericHandler => {
  return (ctx, prefix, params, timestamp) => {
    const extData = params.slice(1).join(' ').replace(/^:/, '') || '';
    ctx.addMessage({
      type: 'raw',
      text: t('*** [{numeric}] {message}', { numeric, message: extData }),
      timestamp,
      isRaw: true,
      rawCategory: 'server',
    });
  };
};

/**
 * STARTTLS handlers map
 */
export const starttlsHandlers: Map<number, NumericHandler> = new Map([
  [670, handle670],
  [691, handle691],
  // Extended TLS numerics (690, 692-699)
  [690, createExtendedTlsHandler(690)],
  [692, createExtendedTlsHandler(692)],
  [693, createExtendedTlsHandler(693)],
  [694, createExtendedTlsHandler(694)],
  [695, createExtendedTlsHandler(695)],
  [696, createExtendedTlsHandler(696)],
  [697, createExtendedTlsHandler(697)],
  [698, createExtendedTlsHandler(698)],
  [699, createExtendedTlsHandler(699)],
]);

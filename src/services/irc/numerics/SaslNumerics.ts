/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * SASL Numeric Handlers (900-908)
 *
 * These are responses to SASL authentication.
 * - 900 RPL_LOGGEDIN - Logged in to account
 * - 901 RPL_LOGGEDOUT - Logged out
 * - 902 ERR_NICKLOCKED - Nick locked
 * - 903 RPL_SASLSUCCESS - SASL authentication successful
 * - 904 ERR_SASLFAIL - SASL authentication failed
 * - 905 ERR_SASLTOOLONG - SASL message too long
 * - 906 ERR_SASLABORTED - SASL authentication aborted
 * - 907 ERR_SASLALREADY - Already authenticated
 * - 908 RPL_SASLMECHS - Available SASL mechanisms
 */

import { tx } from '../../../i18n/transifex';
import type { NumericHandlerContext, NumericHandler } from '../types';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

/** 900 RPL_LOGGEDIN - Logged in to account */
export const handle900: NumericHandler = (ctx, prefix, params, timestamp) => {
  const accountInfo = params[1] || '';
  const account = params[2] || '';
  const message = params.slice(3).join(' ').replace(/^:/, '') || t('You are now logged in as {account}', { account });
  ctx.addMessage({
    type: 'raw',
    text: t('*** {message}', { message }),
    timestamp,
    isRaw: true,
    rawCategory: 'auth',
  });
};

/** 901 RPL_LOGGEDOUT - Logged out */
export const handle901: NumericHandler = (ctx, prefix, params, timestamp) => {
  const message = params.slice(2).join(' ').replace(/^:/, '') || t('You are now logged out');
  ctx.addMessage({
    type: 'raw',
    text: t('*** {message}', { message }),
    timestamp,
    isRaw: true,
    rawCategory: 'auth',
  });
};

/** 902 ERR_NICKLOCKED - Nick locked */
export const handle902: NumericHandler = (ctx, prefix, params, timestamp) => {
  const errorMsg = params.slice(1).join(' ').replace(/^:/, '') || t('You must use a nick assigned to you');
  ctx.addMessage({
    type: 'error',
    text: errorMsg,
    timestamp,
  });
};

/** 903 RPL_SASLSUCCESS - SASL authentication successful */
export const handle903: NumericHandler = (ctx, prefix, params, timestamp) => {
  ctx.setSaslAuthenticating(false);
  ctx.addMessage({
    type: 'raw',
    text: t('*** SASL authentication successful'),
    timestamp,
    isRaw: true,
    rawCategory: 'auth',
  });
  ctx.emit('sasl-success');
  ctx.endCAPNegotiation();
};

/** 904 ERR_SASLFAIL - SASL authentication failed */
export const handle904: NumericHandler = (ctx, prefix, params, timestamp) => {
  ctx.setSaslAuthenticating(false);
  ctx.addMessage({
    type: 'error',
    text: t('SASL authentication failed'),
    timestamp,
  });
  ctx.emit('sasl-fail');
  ctx.endCAPNegotiation();
};

/** 905 ERR_SASLTOOLONG - SASL message too long */
export const handle905: NumericHandler = (ctx, prefix, params, timestamp) => {
  const errorMsg = params.slice(1).join(' ').replace(/^:/, '') || t('SASL message too long');
  ctx.addMessage({
    type: 'error',
    text: errorMsg,
    timestamp,
  });
};

/** 906 ERR_SASLABORTED - SASL authentication aborted */
export const handle906: NumericHandler = (ctx, prefix, params, timestamp) => {
  const errorMsg = params.slice(1).join(' ').replace(/^:/, '') || t('SASL authentication aborted');
  ctx.addMessage({
    type: 'error',
    text: errorMsg,
    timestamp,
  });
  ctx.setSaslAuthenticating(false);
  ctx.endCAPNegotiation();
};

/** 907 ERR_SASLALREADY - Already authenticated */
export const handle907: NumericHandler = (ctx, prefix, params, timestamp) => {
  const errorMsg = params.slice(1).join(' ').replace(/^:/, '') || t('You have already authenticated');
  ctx.addMessage({
    type: 'error',
    text: errorMsg,
    timestamp,
  });
};

/** 908 RPL_SASLMECHS - Available SASL mechanisms */
export const handle908: NumericHandler = (ctx, prefix, params, timestamp) => {
  const mechanisms = params[1] || '';
  const message = params.slice(2).join(' ').replace(/^:/, '') || t('are available SASL mechanisms');
  ctx.addMessage({
    type: 'raw',
    text: t('*** {mechanisms} {message}', { mechanisms, message }),
    timestamp,
    isRaw: true,
    rawCategory: 'auth',
  });
};

/**
 * SASL handlers map
 */
export const saslHandlers: Map<number, NumericHandler> = new Map([
  [900, handle900],
  [901, handle901],
  [902, handle902],
  [903, handle903],
  [904, handle904],
  [905, handle905],
  [906, handle906],
  [907, handle907],
  [908, handle908],
]);

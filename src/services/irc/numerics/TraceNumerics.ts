/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * TRACE Numeric Handlers (200-210)
 *
 * These are responses to the TRACE command which shows the route to a server.
 * - 200 RPL_TRACELINK - Link info
 * - 201 RPL_TRACECONNECTING - Connecting to server
 * - 202 RPL_TRACEHANDSHAKE - Handshaking
 * - 203 RPL_TRACEUNKNOWN - Unknown connection
 * - 204 RPL_TRACEOPERATOR - Operator
 * - 205 RPL_TRACEUSER - User
 * - 206 RPL_TRACESERVER - Server
 * - 207 RPL_TRACESERVICE - Service
 * - 208 RPL_TRACENEWTYPE - New type
 * - 209 RPL_TRACECLASS - Class
 * - 210 RPL_TRACERECONNECT - Reconnect info
 */

import { tx } from '../../../i18n/transifex';
import type { NumericHandlerContext, NumericHandler } from '../types';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

/** Helper to create simple trace handlers */
const createTraceHandler = (label: string): NumericHandler => {
  return (ctx, prefix, params, timestamp) => {
    const info = params.slice(1).join(' ').replace(/^:/, '') || '';
    ctx.addMessage({
      type: 'raw',
      text: t(`*** Trace: ${label} - {info}`, { info }),
      timestamp,
      isRaw: true,
      rawCategory: 'server',
    });
  };
};

/** 200 RPL_TRACELINK */
export const handle200: NumericHandler = (ctx, prefix, params, timestamp) => {
  const info = params.slice(1).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** Trace: {info}', { info }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 201 RPL_TRACECONNECTING */
export const handle201: NumericHandler = (ctx, prefix, params, timestamp) => {
  const info = params.slice(1).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** Trace: Connecting - {info}', { info }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 202 RPL_TRACEHANDSHAKE */
export const handle202: NumericHandler = (ctx, prefix, params, timestamp) => {
  const info = params.slice(1).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** Trace: Handshake - {info}', { info }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 203 RPL_TRACEUNKNOWN */
export const handle203: NumericHandler = (ctx, prefix, params, timestamp) => {
  const info = params.slice(1).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** Trace: Unknown - {info}', { info }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 204 RPL_TRACEOPERATOR */
export const handle204: NumericHandler = (ctx, prefix, params, timestamp) => {
  const info = params.slice(1).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** Trace: Operator - {info}', { info }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 205 RPL_TRACEUSER */
export const handle205: NumericHandler = (ctx, prefix, params, timestamp) => {
  const info = params.slice(1).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** Trace: User - {info}', { info }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 206 RPL_TRACESERVER */
export const handle206: NumericHandler = (ctx, prefix, params, timestamp) => {
  const info = params.slice(1).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** Trace: Server - {info}', { info }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 207 RPL_TRACESERVICE */
export const handle207: NumericHandler = (ctx, prefix, params, timestamp) => {
  const info = params.slice(1).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** Trace: Service - {info}', { info }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 208 RPL_TRACENEWTYPE */
export const handle208: NumericHandler = (ctx, prefix, params, timestamp) => {
  const info = params.slice(1).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** Trace: {info}', { info }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 209 RPL_TRACECLASS */
export const handle209: NumericHandler = (ctx, prefix, params, timestamp) => {
  const info = params.slice(1).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** Trace: Class - {info}', { info }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 210 RPL_TRACERECONNECT */
export const handle210: NumericHandler = (ctx, prefix, params, timestamp) => {
  const info = params.slice(1).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** Trace: {info}', { info }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/**
 * TRACE handlers map
 */
export const traceHandlers: Map<number, NumericHandler> = new Map([
  [200, handle200],
  [201, handle201],
  [202, handle202],
  [203, handle203],
  [204, handle204],
  [205, handle205],
  [206, handle206],
  [207, handle207],
  [208, handle208],
  [209, handle209],
  [210, handle210],
]);

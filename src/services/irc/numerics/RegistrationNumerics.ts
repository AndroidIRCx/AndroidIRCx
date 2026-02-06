/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Registration Numeric Handlers (001-009)
 *
 * These are sent when a client first connects and registers with the server.
 * - 001 RPL_WELCOME - Welcome message
 * - 002 RPL_YOURHOST - Server host info
 * - 003 RPL_CREATED - Server creation date
 * - 004 RPL_MYINFO - Server info
 * - 005 RPL_ISUPPORT - Server capabilities
 * - 008 RPL_SNOMASK - Server notice mask (UnrealIRCd)
 * - 009 RPL_STATMEMTOT - Memory statistics
 */

import { tx } from '../../../i18n/transifex';
import type { NumericHandlerContext, NumericHandler } from '../types';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

/**
 * 001 RPL_WELCOME
 * First message after successful registration
 */
export const handle001: NumericHandler = (ctx, prefix, params, timestamp) => {
  ctx.setRegistered(true);
  if (params.length > 0) {
    const welcomeNick = params[0];
    if (welcomeNick) ctx.setCurrentNick(welcomeNick);
  }
  const currentNick = ctx.getCurrentNick();
  if (currentNick) {
    ctx.sendCommand(`MODE ${currentNick}`);
  }
  ctx.addMessage({
    type: 'raw',
    text: t('*** Welcome to the {network} Network', { network: params[0] || t('IRC') }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
  ctx.emit('registered');
};

/**
 * 002 RPL_YOURHOST
 * Server host information
 */
export const handle002: NumericHandler = (ctx, prefix, params, timestamp) => {
  const hostInfo = params.slice(1).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** {message}', { message: hostInfo }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/**
 * 003 RPL_CREATED
 * Server creation date
 */
export const handle003: NumericHandler = (ctx, prefix, params, timestamp) => {
  const createdInfo = params.slice(1).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** {message}', { message: createdInfo }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/**
 * 004 RPL_MYINFO
 * Server name, version, user modes, channel modes
 */
export const handle004: NumericHandler = (ctx, prefix, params, timestamp) => {
  const serverName = params[1] || '';
  const version = params[2] || '';
  const userModes = params[3] || '';
  const channelModes = params[4] || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** Server: {server} | Version: {version} | User modes: {userModes} | Channel modes: {channelModes}', {
      server: serverName,
      version,
      userModes,
      channelModes,
    }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/**
 * 005 RPL_ISUPPORT
 * Server capabilities (CHANMODES, PREFIX, NETWORK, etc.)
 */
export const handle005: NumericHandler = (ctx, prefix, params, timestamp) => {
  const tokens = params.slice(1, -1); // All params except nick (first) and trailing message (last)
  const supportText = tokens.join(' ');
  ctx.addMessage({
    type: 'raw',
    text: t('*** Server supports: {features}', { features: supportText }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });

  // Parse and log capabilities
  tokens.forEach(token => {
    if (token.includes('=')) {
      const [key, value] = token.split('=', 2);
      ctx.logRaw(`IRCService: Server capability ${key}=${value}`);
    } else {
      ctx.logRaw(`IRCService: Server capability ${token}`);
    }
  });
};

/**
 * 008 RPL_SNOMASK (UnrealIRCd)
 * Server notice mask settings
 */
export const handle008: NumericHandler = (ctx, prefix, params, timestamp) => {
  const modeString = params[1] || '';
  const description = params.slice(2).join(' ').replace(/^:/, '') || t('Server notice mask');

  // Check if this was a silent MODE request
  if (ctx.isSilentModeNick(ctx.getCurrentNick().toLowerCase())) {
    return; // Don't display - keep it silent
  }

  ctx.addMessage({
    type: 'raw',
    text: t('*** [{numeric}] {modes} {description}', { numeric: 8, modes: modeString, description }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/**
 * 009 RPL_STATMEMTOT
 * Memory statistics
 */
export const handle009: NumericHandler = (ctx, prefix, params, timestamp) => {
  const memStats = params.slice(1).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** Memory: {stats}', { stats: memStats }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 6 RPL_MAP - Server map entry */
export const handle006: NumericHandler = (ctx, prefix, params, timestamp) => {
  const mapEntry = params.slice(1).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** {message}', { message: mapEntry }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 7 RPL_MAPEND - End of server map */
export const handle007: NumericHandler = (ctx, prefix, params, timestamp) => {
  const mapEnd = params.slice(1).join(' ').replace(/^:/, '') || t('End of /MAP');
  ctx.addMessage({
    type: 'raw',
    text: t('*** {message}', { message: mapEnd }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 10 RPL_BOUNCE - Server redirect */
export const handle010: NumericHandler = (ctx, prefix, params, timestamp) => {
  const redirectHost = params[1] || '';
  const redirectPort = params[2] || '';
  const redirectInfo = params.slice(3).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** Server redirect: {host}:{port} - {info}', {
      host: redirectHost,
      port: redirectPort,
      info: redirectInfo,
    }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 15 RPL_MAP - Map line */
export const handle015: NumericHandler = (ctx, prefix, params, timestamp) => {
  const mapData = params.slice(1).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** {message}', { message: mapData }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 16 RPL_MAPMORE - Map continuation */
export const handle016: NumericHandler = (ctx, prefix, params, timestamp) => {
  const mapMore = params.slice(1).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** {message}', { message: mapMore }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 17 RPL_MAPEND - End of map (alternative) */
export const handle017: NumericHandler = (ctx, prefix, params, timestamp) => {
  const mapEndAlt = params.slice(1).join(' ').replace(/^:/, '') || t('End of /MAP');
  ctx.addMessage({
    type: 'raw',
    text: t('*** {message}', { message: mapEndAlt }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 18 RPL_MAPSTART - Start of map */
export const handle018: NumericHandler = (ctx, prefix, params, timestamp) => {
  const mapStart = params.slice(1).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** {message}', { message: mapStart }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 20 RPL_CONNECTING - Connecting info */
export const handle020: NumericHandler = (ctx, prefix, params, timestamp) => {
  const connInfo = params.slice(1).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** {message}', { message: connInfo }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 42 RPL_YOURID - Unique ID */
export const handle042: NumericHandler = (ctx, prefix, params, timestamp) => {
  const uniqueId = params.slice(1).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** Your unique ID: {id}', { id: uniqueId }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 43 RPL_SAVENICK - Nick saved */
export const handle043: NumericHandler = (ctx, prefix, params, timestamp) => {
  const saveMsg = params.slice(1).join(' ').replace(/^:/, '') || t('Nick saved');
  ctx.addMessage({
    type: 'raw',
    text: t('*** {message}', { message: saveMsg }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/**
 * Registration handlers map
 */
export const registrationHandlers: Map<number, NumericHandler> = new Map([
  [1, handle001],
  [2, handle002],
  [3, handle003],
  [4, handle004],
  [5, handle005],
  [6, handle006],
  [7, handle007],
  [8, handle008],
  [9, handle009],
  [10, handle010],
  [15, handle015],
  [16, handle016],
  [17, handle017],
  [18, handle018],
  [20, handle020],
  [42, handle042],
  [43, handle043],
]);

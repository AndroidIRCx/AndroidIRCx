/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Misc Numeric Handlers
 *
 * Numerics that are simple message displays and were previously inline in IRCService.
 */

import { tx } from '../../../i18n/transifex';
import type { NumericHandlerContext, NumericHandler } from '../types';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

/** 276 RPL_WHOISCERTFP */
export const handle276: NumericHandler = (ctx, prefix, params, timestamp) => {
  const certNick = params[1] || '';
  const certMessage = params.slice(2).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** {nick} {message}', { nick: certNick, message: certMessage }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 325 RPL_UNIQOPIS */
export const handle325: NumericHandler = (ctx, prefix, params, timestamp) => {
  const uniqChan = params[1] || '';
  const uniqNick = params[2] || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** {nick} is the unique operator of {channel}', { nick: uniqNick, channel: uniqChan }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 326 RPL_NOCHANPASS */
export const handle326: NumericHandler = (ctx, prefix, params, timestamp) => {
  const noChanPass = params.slice(1).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** {message}', { message: noChanPass }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 327 RPL_CHPASSUNKNOWN */
export const handle327: NumericHandler = (ctx, prefix, params, timestamp) => {
  const chPassUnknown = params.slice(1).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** {message}', { message: chPassUnknown }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 328 RPL_CHANNEL_URL */
export const handle328: NumericHandler = (ctx, prefix, params, timestamp) => {
  const urlChan = params[1] || '';
  const chanUrl = params.slice(2).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** {channel} URL: {url}', { channel: urlChan, url: chanUrl }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 334 RPL_LISTUSAGE */
export const handle334: NumericHandler = (ctx, prefix, params, timestamp) => {
  const listUsage = params.slice(1).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** {message}', { message: listUsage }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 336 RPL_INVITELIST (alternative) / RPL_WHOISACTUALLY */
export const handle336: NumericHandler = (ctx, prefix, params, timestamp) => {
  const inviteInfo = params.slice(1).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** {message}', { message: inviteInfo }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 337 RPL_WHOISTEXT */
export const handle337: NumericHandler = (ctx, prefix, params, timestamp) => {
  const whoisText = params.slice(1).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** {message}', { message: whoisText }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 339 RPL_BADCHANPASS */
export const handle339: NumericHandler = (ctx, prefix, params, timestamp) => {
  const badChanPassInfo = params.slice(1).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** {message}', { message: badChanPassInfo }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 340 RPL_USERIP */
export const handle340: NumericHandler = (ctx, prefix, params, timestamp) => {
  const userIpInfo = params.slice(1).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** UserIP: {info}', { info: userIpInfo }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 342 RPL_SUMMONING */
export const handle342: NumericHandler = (ctx, prefix, params, timestamp) => {
  const summonNick = params[1] || '';
  const summonMsg = params.slice(2).join(' ').replace(/^:/, '') || t('Summoning user to IRC');
  ctx.addMessage({
    type: 'raw',
    text: t('*** {nick}: {message}', { nick: summonNick, message: summonMsg }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 343 RPL_OPENINGQUERY */
export const handle343: NumericHandler = (ctx, prefix, params, timestamp) => {
  const queryInfo = params.slice(1).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** {message}', { message: queryInfo }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 344 RPL_REOPLIST */
export const handle344: NumericHandler = (ctx, prefix, params, timestamp) => {
  const reopInfo = params.slice(1).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** {message}', { message: reopInfo }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 345 RPL_ENDOFREOPLIST */
export const handle345: NumericHandler = (ctx, prefix, params, timestamp) => {
  const endReopInfo = params.slice(1).join(' ').replace(/^:/, '') || t('End of channel reop list');
  ctx.addMessage({
    type: 'raw',
    text: t('*** {message}', { message: endReopInfo }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 350 RPL_WHOISGATEWAY */
export const handle350: NumericHandler = (ctx, prefix, params, timestamp) => {
  const gatewayNick = params[1] || '';
  const gatewayInfo = params.slice(2).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** {nick} {message}', { nick: gatewayNick, message: gatewayInfo }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 354 RPL_WHOSPCRPL */
export const handle354: NumericHandler = (ctx, prefix, params, timestamp) => {
  const whoxData = params.slice(1).join(' ') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** WHO: {info}', { info: whoxData }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 380 RPL_YOURHELPER */
export const handle380: NumericHandler = (ctx, prefix, params, timestamp) => {
  const helperInfo = params.slice(1).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** {message}', { message: helperInfo }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 384 RPL_MYPORTIS */
export const handle384: NumericHandler = (ctx, prefix, params, timestamp) => {
  const portInfo = params.slice(1).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** {message}', { message: portInfo }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 385 RPL_NOTOPERANYMORE */
export const handle385: NumericHandler = (ctx, prefix, params, timestamp) => {
  const notOperMsg = params.slice(1).join(' ').replace(/^:/, '') || t('You are no longer an IRC operator');
  ctx.addMessage({
    type: 'raw',
    text: t('*** {message}', { message: notOperMsg }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 386 RPL_QLIST */
export const handle386: NumericHandler = (ctx, prefix, params, timestamp) => {
  const qlistInfo = params.slice(1).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** {message}', { message: qlistInfo }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 387 RPL_ENDOFQLIST */
export const handle387: NumericHandler = (ctx, prefix, params, timestamp) => {
  const endQlistInfo = params.slice(1).join(' ').replace(/^:/, '') || t('End of list');
  ctx.addMessage({
    type: 'raw',
    text: t('*** {message}', { message: endQlistInfo }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 388 RPL_ALIST */
export const handle388: NumericHandler = (ctx, prefix, params, timestamp) => {
  const alistInfo = params.slice(1).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** {message}', { message: alistInfo }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 389 RPL_ENDOFALIST */
export const handle389: NumericHandler = (ctx, prefix, params, timestamp) => {
  const endAlistInfo = params.slice(1).join(' ').replace(/^:/, '') || t('End of list');
  ctx.addMessage({
    type: 'raw',
    text: t('*** {message}', { message: endAlistInfo }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 390 RPL_ENDOFJUPELIST */
export const handle390: NumericHandler = (ctx, prefix, params, timestamp) => {
  const endJupeInfo = params.slice(1).join(' ').replace(/^:/, '') || t('End of list');
  ctx.addMessage({
    type: 'raw',
    text: t('*** {message}', { message: endJupeInfo }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 396 RPL_HOSTHIDDEN */
export const handle396: NumericHandler = (ctx, prefix, params, timestamp) => {
  const hiddenHost = params[1] || '';
  const hostHiddenMsg = params.slice(2).join(' ').replace(/^:/, '') || t('is now your hidden host');
  ctx.addMessage({
    type: 'raw',
    text: t('*** {host} {message}', { host: hiddenHost, message: hostHiddenMsg }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 408 ERR_NOSUCHSERVICE */
export const handle408: NumericHandler = (ctx, prefix, params, timestamp) => {
  const noService = params[1] || '';
  const noServiceMsg = params.slice(2).join(' ').replace(/^:/, '') || t('No such service');
  ctx.addMessage({
    type: 'error',
    text: t('*** {service}: {message}', { service: noService, message: noServiceMsg }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 417 ERR_INPUTTOOLONG */
export const handle417: NumericHandler = (ctx, prefix, params, timestamp) => {
  const inputTooLongMsg = params.slice(1).join(' ').replace(/^:/, '') || t('Input line was too long');
  ctx.addMessage({
    type: 'error',
    text: t('*** {message}', { message: inputTooLongMsg }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 493 ERR_NOFEATURE */
export const handle493: NumericHandler = (ctx, prefix, params, timestamp) => {
  const noFeatureMsg = params.slice(1).join(' ').replace(/^:/, '') || t('Feature not available');
  ctx.addMessage({
    type: 'error',
    text: t('*** {message}', { message: noFeatureMsg }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 671 RPL_WHOISSECURE */
export const handle671: NumericHandler = (ctx, prefix, params, timestamp) => {
  const whoisNick = params[1] || '';
  const message = params.slice(2).join(' ').replace(/^:/, '') || t('is using a secure connection');
  ctx.addMessage({
    type: 'raw',
    text: t('*** {nick} {message}', { nick: whoisNick, message }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/**
 * Misc numerics handlers map
 */
export const miscHandlers: Map<number, NumericHandler> = new Map([
  [276, handle276],
  [325, handle325],
  [326, handle326],
  [327, handle327],
  [328, handle328],
  [334, handle334],
  [336, handle336],
  [337, handle337],
  [339, handle339],
  [340, handle340],
  [342, handle342],
  [343, handle343],
  [344, handle344],
  [345, handle345],
  [350, handle350],
  [354, handle354],
  [380, handle380],
  [384, handle384],
  [385, handle385],
  [386, handle386],
  [387, handle387],
  [388, handle388],
  [389, handle389],
  [390, handle390],
  [396, handle396],
  [408, handle408],
  [417, handle417],
  [493, handle493],
  [671, handle671],
]);

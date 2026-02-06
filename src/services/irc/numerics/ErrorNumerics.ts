/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Error Numeric Handlers (401-502)
 *
 * These are error responses from the IRC server.
 * - 401 ERR_NOSUCHNICK - No such nick/channel
 * - 402 ERR_NOSUCHSERVER - No such server
 * - 403 ERR_NOSUCHCHANNEL - No such channel
 * - 404 ERR_CANNOTSENDTOCHAN - Cannot send to channel
 * - 405 ERR_TOOMANYCHANNELS - Too many channels
 * - 406 ERR_WASNOSUCHNICK - No WHOWAS info
 * - 421 ERR_UNKNOWNCOMMAND - Unknown command
 * - 432 ERR_ERRONEUSNICKNAME - Erroneous nickname
 * - 441-442 Channel user errors
 * - 461 ERR_NEEDMOREPARAMS - Not enough parameters
 * - 464 ERR_PASSWDMISMATCH - Password incorrect
 * - 471-489 Channel join/mode errors
 *
 * NOTE: Some error handlers like 433 (nick in use) have special state
 * handling and remain in IRCService.
 */

import { tx } from '../../../i18n/transifex';
import type { NumericHandlerContext, NumericHandler } from '../types';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

/** Generic error handler - shows label: message format */
const createLabeledErrorHandler = (defaultMsg: string): NumericHandler => {
  return (ctx, prefix, params, timestamp) => {
    const label = params[1] || '';
    const errorMsg = params.slice(2).join(' ').replace(/^:/, '') || t(defaultMsg);
    ctx.addMessage({
      type: 'error',
      text: t('{label}: {message}', { label, message: errorMsg }),
      timestamp,
    });
  };
};

/** Generic error handler - shows just the message */
const createSimpleErrorHandler = (defaultMsg: string): NumericHandler => {
  return (ctx, prefix, params, timestamp) => {
    const errorMsg = params.slice(1).join(' ').replace(/^:/, '') || t(defaultMsg);
    ctx.addMessage({
      type: 'error',
      text: errorMsg,
      timestamp,
    });
  };
};

/** 401 ERR_NOSUCHNICK - with WHOWAS hint */
export const handle401: NumericHandler = (ctx, prefix, params, timestamp) => {
  const target = params[1] || '';
  const errorMsg = params.slice(2).join(' ').replace(/^:/, '') || t('No such nick/channel');
  ctx.addMessage({
    type: 'error',
    text: t('{label}: {message}', { label: target, message: errorMsg }),
    timestamp,
  });
  // WHOWAS hint logic - if this was a recent WHOWAS request, suggest using WHOIS
  if (target && ctx.getWhowasTarget() === target && Date.now() - ctx.getWhowasAt() < 5000) {
    ctx.addMessage({
      type: 'notice',
      text: t('*** WHOWAS has no history for {nick}. If they are online, try /whois {nick}.', { nick: target }),
      timestamp,
    });
  }
};

/** 402 ERR_NOSUCHSERVER */
export const handle402: NumericHandler = createLabeledErrorHandler('No such server');

/** 403 ERR_NOSUCHCHANNEL */
export const handle403: NumericHandler = createLabeledErrorHandler('No such channel');

/** 404 ERR_CANNOTSENDTOCHAN */
export const handle404: NumericHandler = createLabeledErrorHandler('Cannot send to channel');

/** 405 ERR_TOOMANYCHANNELS */
export const handle405: NumericHandler = createLabeledErrorHandler('You have joined too many channels');

/** 406 ERR_WASNOSUCHNICK */
export const handle406: NumericHandler = createLabeledErrorHandler('There was no such nickname');

/** 407 ERR_TOOMANYTARGETS */
export const handle407: NumericHandler = createLabeledErrorHandler('Too many targets');

/** 409 ERR_NOORIGIN */
export const handle409: NumericHandler = createSimpleErrorHandler('No origin specified');

/** 411 ERR_NORECIPIENT */
export const handle411: NumericHandler = createSimpleErrorHandler('No recipient given');

/** 412 ERR_NOTEXTTOSEND */
export const handle412: NumericHandler = createSimpleErrorHandler('No text to send');

/** 413 ERR_NOTOPLEVEL */
export const handle413: NumericHandler = createLabeledErrorHandler('No toplevel domain specified');

/** 414 ERR_WILDTOPLEVEL */
export const handle414: NumericHandler = createLabeledErrorHandler('Wildcard in toplevel domain');

/** 415 ERR_BADMASK */
export const handle415: NumericHandler = createLabeledErrorHandler('Bad server/host mask');

/** 421 ERR_UNKNOWNCOMMAND */
export const handle421: NumericHandler = createLabeledErrorHandler('Unknown command');

/** 423 ERR_NOADMININFO */
export const handle423: NumericHandler = createLabeledErrorHandler('No administrative info available');

/** 431 ERR_NONICKNAMEGIVEN */
export const handle431: NumericHandler = createSimpleErrorHandler('No nickname given');

/** 432 ERR_ERRONEUSNICKNAME */
export const handle432: NumericHandler = createLabeledErrorHandler('Erroneous nickname');

/** 441 ERR_USERNOTINCHANNEL */
export const handle441: NumericHandler = (ctx, prefix, params, timestamp) => {
  const nick = params[1] || '';
  const channel = params[2] || '';
  const errorMsg = params.slice(3).join(' ').replace(/^:/, '') || t("They aren't on that channel");
  ctx.addMessage({
    type: 'error',
    text: t('{nick} {channel}: {message}', { nick, channel, message: errorMsg }),
    timestamp,
  });
};

/** 442 ERR_NOTONCHANNEL */
export const handle442: NumericHandler = createLabeledErrorHandler("You're not on that channel");

/** 436 ERR_NICKCOLLISION */
export const handle436: NumericHandler = createLabeledErrorHandler('Nickname collision');

/** 437 ERR_UNAVAILRESOURCE */
export const handle437: NumericHandler = createLabeledErrorHandler('Resource temporarily unavailable');

/** 443 ERR_USERONCHANNEL */
export const handle443: NumericHandler = (ctx, prefix, params, timestamp) => {
  const nick = params[1] || '';
  const channel = params[2] || '';
  const errorMsg = params.slice(3).join(' ').replace(/^:/, '') || t('is already on channel');
  ctx.addMessage({
    type: 'error',
    text: t('{nick} {channel}: {message}', { nick, channel, message: errorMsg }),
    timestamp,
  });
};

/** 451 ERR_NOTREGISTERED */
export const handle451: NumericHandler = createSimpleErrorHandler('You have not registered');

/** 461 ERR_NEEDMOREPARAMS */
export const handle461: NumericHandler = createLabeledErrorHandler('Not enough parameters');

/** 462 ERR_ALREADYREGISTRED */
export const handle462: NumericHandler = createSimpleErrorHandler('You may not reregister');

/** 463 ERR_NOPERMFORHOST */
export const handle463: NumericHandler = createSimpleErrorHandler("Your host isn't among the privileged");

/** 433 ERR_NICKNAMEINUSE - Nickname is already in use */
export const handle433: NumericHandler = (ctx, prefix, params, timestamp) => {
  const requestedNick = params[1] || ctx.getCurrentNick();
  ctx.addMessage({
    type: 'error',
    text: t('Nickname is already in use: {nick}', { nick: requestedNick }),
    timestamp,
  });

  const altNick = ctx.getAltNick();
  const attempts = ctx.getNickChangeAttempts();

  if (altNick && attempts < 3) {
    ctx.incrementNickChangeAttempts();
    ctx.logRaw(`IRCService: Trying altnick: ${altNick}`);
    ctx.sendRaw(`NICK ${altNick}`);
    ctx.setCurrentNick(altNick);
    ctx.addRawMessage(t('*** Trying alternative nickname: {nick}', { nick: altNick }), 'auth');
  } else {
    const currentNick = ctx.getCurrentNick();
    const randomSuffix = Math.floor(Math.random() * 1000);
    const fallbackNick = `${currentNick}${randomSuffix}`;
    ctx.logRaw(`IRCService: Trying fallback nick: ${fallbackNick}`);
    ctx.sendRaw(`NICK ${fallbackNick}`);
    ctx.setCurrentNick(fallbackNick);
    ctx.addRawMessage(t('*** Trying fallback nickname: {nick}', { nick: fallbackNick }), 'auth');
  }
};

/** 464 ERR_PASSWDMISMATCH */
export const handle464: NumericHandler = (ctx, prefix, params, timestamp) => {
  ctx.addMessage({
    type: 'error',
    text: t('Password incorrect'),
    timestamp,
  });
};

/** 465 ERR_YOUREBANNEDCREEP / 484 ERR_RESTRICTED - Connection blocked */
export const handle465: NumericHandler = (ctx, prefix, params, timestamp) => {
  const reason = params.slice(1).join(' ') || t('Connection blocked or banned');
  ctx.addMessage({ type: 'error', text: reason, timestamp });
  ctx.addRawMessage(t('*** Connection blocked: {message}', { message: reason }), 'connection');
  ctx.disconnect(reason);
};

/** 471 ERR_CHANNELISFULL */
export const handle471: NumericHandler = (ctx, prefix, params, timestamp) => {
  const channel = params[1] || '';
  const errorMsg = params.slice(2).join(' ').replace(/^:/, '') || t('Cannot join channel (channel is full)');
  ctx.addMessage({
    type: 'error',
    text: t('{label}: {message}', { label: channel, message: errorMsg }),
    timestamp,
  });
};

/** 472 ERR_UNKNOWNMODE */
export const handle472: NumericHandler = (ctx, prefix, params, timestamp) => {
  const mode = params[1] || '';
  const errorMsg = params.slice(2).join(' ').replace(/^:/, '') || t('is an unknown mode char');
  ctx.addMessage({
    type: 'error',
    text: t('{label}: {message}', { label: mode, message: errorMsg }),
    timestamp,
  });
};

/** 473 ERR_INVITEONLYCHAN */
export const handle473: NumericHandler = (ctx, prefix, params, timestamp) => {
  const channel = params[1] || '';
  const errorMsg = params.slice(2).join(' ').replace(/^:/, '') || t('Cannot join channel (invite only)');
  ctx.addMessage({
    type: 'error',
    text: t('{label}: {message}', { label: channel, message: errorMsg }),
    timestamp,
  });
};

/** 474 ERR_BANNEDFROMCHAN */
export const handle474: NumericHandler = (ctx, prefix, params, timestamp) => {
  const channel = params[1] || '';
  const errorMsg = params.slice(2).join(' ').replace(/^:/, '') || t('Cannot join channel (banned)');
  ctx.addMessage({
    type: 'error',
    text: t('{label}: {message}', { label: channel, message: errorMsg }),
    timestamp,
  });
};

/** 475 ERR_BADCHANNELKEY */
export const handle475: NumericHandler = (ctx, prefix, params, timestamp) => {
  const channel = params[1] || '';
  const errorMsg = params.slice(2).join(' ').replace(/^:/, '') || t('Cannot join channel (bad key)');
  ctx.addMessage({
    type: 'error',
    text: t('{label}: {message}', { label: channel, message: errorMsg }),
    timestamp,
  });
};

/** 476 ERR_BADCHANMASK */
export const handle476: NumericHandler = createLabeledErrorHandler('Bad channel mask');

/** 477 ERR_NOCHANMODES / ERR_NEEDREGGEDNICK */
export const handle477: NumericHandler = (ctx, prefix, params, timestamp) => {
  const channel = params[1] || '';
  const errorMsg = params.slice(2).join(' ').replace(/^:/, '') || t('You need to be identified to join this channel');
  ctx.addMessage({
    type: 'error',
    text: t('{label}: {message}', { label: channel, message: errorMsg }),
    timestamp,
  });
};

/** 466 ERR_YOUWILLBEBANNED */
export const handle466: NumericHandler = createSimpleErrorHandler('You will be banned');

/** 467 ERR_KEYSET */
export const handle467: NumericHandler = createLabeledErrorHandler('Channel key already set');

/** 478 ERR_BANLISTFULL */
export const handle478: NumericHandler = (ctx, prefix, params, timestamp) => {
  const channel = params[1] || '';
  const errorMsg = params.slice(2).join(' ').replace(/^:/, '') || t('Channel ban list is full');
  ctx.addMessage({
    type: 'error',
    text: t('{label}: {message}', { label: channel, message: errorMsg }),
    timestamp,
  });
};

/** 481 ERR_NOPRIVILEGES */
export const handle481: NumericHandler = createSimpleErrorHandler("Permission Denied - You're not an IRC operator");

/** 482 ERR_CHANOPRIVSNEEDED */
export const handle482: NumericHandler = createLabeledErrorHandler("You're not a channel operator");

/** 483 ERR_CANTKILLSERVER */
export const handle483: NumericHandler = createSimpleErrorHandler('You cannot kill a server!');

/** 491 ERR_NOOPERHOST */
export const handle491: NumericHandler = createSimpleErrorHandler('No O-lines for your host');

/** 501 ERR_UMODEUNKNOWNFLAG */
export const handle501: NumericHandler = createSimpleErrorHandler('Unknown MODE flag');

/** 502 ERR_USERSDONTMATCH */
export const handle502: NumericHandler = createSimpleErrorHandler("Cannot change mode for other users");

/** 416 ERR_TOOMANYMATCHES */
export const handle416: NumericHandler = (ctx, prefix, params, timestamp) => {
  const tooManyCmd = params[1] || '';
  const tooManyMsg = params.slice(2).join(' ').replace(/^:/, '') || t('Too many matches');
  ctx.addMessage({
    type: 'error',
    text: t('*** {command}: {message}', { command: tooManyCmd, message: tooManyMsg }),
    timestamp,
  });
};

/** 424 ERR_FILEERROR */
export const handle424: NumericHandler = createSimpleErrorHandler('File error');

/** 434 ERR_SERVICENAMEINUSE */
export const handle434: NumericHandler = createSimpleErrorHandler('Service name already in use');

/** 435 ERR_SERVICECONFUSED */
export const handle435: NumericHandler = createSimpleErrorHandler('Service confused');

/** 438 ERR_NICKTOOFAST */
export const handle438: NumericHandler = createSimpleErrorHandler('Nick change too fast');

/** 439 ERR_TARGETTOOFAST */
export const handle439: NumericHandler = createSimpleErrorHandler('Target change too fast');

/** 440 ERR_SERVICESDOWN */
export const handle440: NumericHandler = createSimpleErrorHandler('Services are down');

/** 444 ERR_NOLOGIN */
export const handle444: NumericHandler = createSimpleErrorHandler('No login');

/** 445 ERR_SUMMONDISABLED */
export const handle445: NumericHandler = createSimpleErrorHandler('Summon disabled');

/** 446 ERR_USERSDISABLED */
export const handle446: NumericHandler = createSimpleErrorHandler('Users disabled');

/** 447 ERR_NONICKCHANGE */
export const handle447: NumericHandler = createSimpleErrorHandler('Nick change not allowed');

/** 449 ERR_NOTIMPLEMENTED */
export const handle449: NumericHandler = createSimpleErrorHandler('Not implemented');

/** 452 ERR_IDCOLLISION */
export const handle452: NumericHandler = createSimpleErrorHandler('ID collision');

/** 453 ERR_NICKLOST */
export const handle453: NumericHandler = createSimpleErrorHandler('Nick lost');

/** 455 ERR_HOSTILENAME */
export const handle455: NumericHandler = createSimpleErrorHandler('Hostile nickname');

/** 468 ERR_INVALIDUSERNAME */
export const handle468: NumericHandler = createSimpleErrorHandler('Invalid username');

/** 469 ERR_LINKSET */
export const handle469: NumericHandler = createSimpleErrorHandler('Link set');

/** 470 ERR_LINKCHANNEL - Channel forwarding notice */
export const handle470: NumericHandler = (ctx, prefix, params, timestamp) => {
  const source = params[1] || '';
  const target = params[2] || '';
  const message = params.slice(3).join(' ').replace(/^:/, '') || t('Forwarding to another channel');
  ctx.addMessage({
    type: 'notice',
    text: t('{source} -> {target}: {message}', { source, target, message }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 479 ERR_BADCHANNAME */
export const handle479: NumericHandler = createSimpleErrorHandler('Bad channel name');

/** 480 ERR_SSLONLYCHAN */
export const handle480: NumericHandler = createSimpleErrorHandler('SSL only channel');

/** 485 ERR_UNIQOPPRIVSNEEDED */
export const handle485: NumericHandler = createSimpleErrorHandler('Unique operator privileges needed');

/** 486 ERR_NONONREG */
export const handle486: NumericHandler = createSimpleErrorHandler('Cannot send to non-registered users');

/** 487 ERR_CHANTOOOLD */
export const handle487: NumericHandler = createSimpleErrorHandler('Channel too old');

/** 488 ERR_TSREQUIRED */
export const handle488: NumericHandler = createSimpleErrorHandler('Timestamp required');

/** 489 ERR_VOICENEEDED */
export const handle489: NumericHandler = createSimpleErrorHandler('Voice needed');

/** 490 ERR_SECUREONLYCHAN */
export const handle490: NumericHandler = createSimpleErrorHandler('Secure only channel');

/** 492 ERR_NOSERVICEHOST */
export const handle492: NumericHandler = createSimpleErrorHandler('No service host');

/** 494 ERR_INPUTTOOLONG */
export const handle494: NumericHandler = createSimpleErrorHandler('Input too long');

/** 495 ERR_UNKNOWNERROR */
export const handle495: NumericHandler = createSimpleErrorHandler('Unknown error');

/** 496 ERR_NOMOTD (different from 422) */
export const handle496: NumericHandler = createSimpleErrorHandler('No MOTD available');

/** 497 ERR_CANTJOINOPERSONLY */
export const handle497: NumericHandler = createSimpleErrorHandler('Operators only');

/** 498 ERR_CANTJOINNOSUCHCHANNEL */
export const handle498: NumericHandler = createSimpleErrorHandler('No such channel');

/** 499 ERR_CANTJOINNOTREGISTERED */
export const handle499: NumericHandler = createSimpleErrorHandler('Not registered');

/** 503 ERR_GHOSTEDCLIENT */
export const handle503: NumericHandler = createSimpleErrorHandler('Ghosted client');

/** 511 ERR_SILELISTFULL */
export const handle511: NumericHandler = createSimpleErrorHandler('Silence list full');

/** 512 ERR_TOOMANYWATCH */
export const handle512: NumericHandler = createSimpleErrorHandler('Too many WATCH entries');

/** 513 ERR_BADPING */
export const handle513: NumericHandler = createSimpleErrorHandler('Bad PING');

/** 514 ERR_INVALID_ERROR */
export const handle514: NumericHandler = createSimpleErrorHandler('Invalid error');

/** 521 ERR_LISTSYNTAX */
export const handle521: NumericHandler = createSimpleErrorHandler('List syntax error');

/** 524 ERR_HELPNOTFOUND */
export const handle524: NumericHandler = createSimpleErrorHandler('Help not found');

/** 525 ERR_INVALIDKEY */
export const handle525: NumericHandler = createSimpleErrorHandler('Invalid key');

/** 531 ERR_CANTSENDTOUSER */
export const handle531: NumericHandler = createSimpleErrorHandler('Cannot send to user');

/**
 * Error handlers map
 */
export const errorHandlers: Map<number, NumericHandler> = new Map([
  [401, handle401],
  [402, handle402],
  [403, handle403],
  [404, handle404],
  [405, handle405],
  [406, handle406],
  [407, handle407],
  [409, handle409],
  [411, handle411],
  [412, handle412],
  [413, handle413],
  [414, handle414],
  [415, handle415],
  [421, handle421],
  [423, handle423],
  [431, handle431],
  [432, handle432],
  [433, handle433],
  [436, handle436],
  [437, handle437],
  [441, handle441],
  [442, handle442],
  [443, handle443],
  [451, handle451],
  [461, handle461],
  [462, handle462],
  [463, handle463],
  [464, handle464],
  [465, handle465],
  [466, handle466],
  [467, handle467],
  [471, handle471],
  [472, handle472],
  [473, handle473],
  [474, handle474],
  [475, handle475],
  [476, handle476],
  [477, handle477],
  [478, handle478],
  [481, handle481],
  [482, handle482],
  [483, handle483],
  [484, handle465],  // Same handler as 465
  [491, handle491],
  [501, handle501],
  [502, handle502],
  [416, handle416],
  [424, handle424],
  [434, handle434],
  [435, handle435],
  [438, handle438],
  [439, handle439],
  [440, handle440],
  [444, handle444],
  [445, handle445],
  [446, handle446],
  [447, handle447],
  [449, handle449],
  [452, handle452],
  [453, handle453],
  [455, handle455],
  [468, handle468],
  [469, handle469],
  [470, handle470],
  [479, handle479],
  [480, handle480],
  [485, handle485],
  [486, handle486],
  [487, handle487],
  [488, handle488],
  [489, handle489],
  [490, handle490],
  [492, handle492],
  [494, handle494],
  [495, handle495],
  [496, handle496],
  [497, handle497],
  [498, handle498],
  [499, handle499],
  [503, handle503],
  [511, handle511],
  [512, handle512],
  [513, handle513],
  [514, handle514],
  [521, handle521],
  [524, handle524],
  [525, handle525],
  [531, handle531],
]);

/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Information/query command handlers for sendMessage:
 * LUSERS, VERSION, TIME, ADMIN, LINKS, STATS, MOTD, PING, TRACE, INFO, RULES,
 * SERVLIST, ISON, USERHOST, USERIP, USERS, WATCH, KNOCK, SQUERY, LIST, NAMES
 */

import { tx } from '../../../i18n/transifex';
import type { SendMessageHandler, SendMessageHandlerRegistry } from '../sendMessageTypes';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

export const handleLUSERS: SendMessageHandler = (ctx) => {
  // /lusers - Get user statistics
  ctx.sendCommand('LUSERS');
};

export const handleVERSION: SendMessageHandler = (ctx, args) => {
  // /version [server] - Get server version
  const versionTarget = args.length > 0 ? args[0] : '';
  ctx.sendCommand(versionTarget ? `VERSION ${versionTarget}` : 'VERSION');
};

export const handleTIME: SendMessageHandler = (ctx, args) => {
  // /time [server] - Get server time
  const timeTarget = args.length > 0 ? args[0] : '';
  ctx.sendCommand(timeTarget ? `TIME ${timeTarget}` : 'TIME');
};

export const handleADMIN: SendMessageHandler = (ctx, args) => {
  // /admin [server] - Get server administrator info
  const adminTarget = args.length > 0 ? args[0] : '';
  ctx.sendCommand(adminTarget ? `ADMIN ${adminTarget}` : 'ADMIN');
};

export const handleLINKS: SendMessageHandler = (ctx, args) => {
  // /links [mask] - List server links
  const linksMask = args.length > 0 ? args.join(' ') : '';
  ctx.sendCommand(linksMask ? `LINKS ${linksMask}` : 'LINKS');
};

export const handleSTATS: SendMessageHandler = (ctx, args) => {
  // /stats [query] [server] - Get server statistics
  const statsQuery = args.length > 0 ? args[0] : '';
  const statsServer = args.length > 1 ? args[1] : '';
  if (statsQuery && statsServer) {
    ctx.sendCommand(`STATS ${statsQuery} ${statsServer}`);
  } else if (statsQuery) {
    ctx.sendCommand(`STATS ${statsQuery}`);
  } else {
    ctx.sendCommand('STATS');
  }
};

export const handleMOTD: SendMessageHandler = (ctx, args) => {
  // /motd - Get message of the day
  const motdTarget = args.length > 0 ? args[0] : '';
  ctx.sendCommand(motdTarget ? `MOTD ${motdTarget}` : 'MOTD');
};

export const handlePING: SendMessageHandler = (ctx, args) => {
  // /ping [server] - Ping server (explicit command)
  const pingTarget = args.length > 0 ? args[0] : '';
  ctx.sendCommand(pingTarget ? `PING ${pingTarget}` : 'PING');
};

export const handleTRACE: SendMessageHandler = (ctx, args) => {
  // /trace [target] - Trace route to server
  const traceTarget = args.length > 0 ? args[0] : '';
  ctx.sendCommand(traceTarget ? `TRACE ${traceTarget}` : 'TRACE');
};

export const handleINFO: SendMessageHandler = (ctx, args) => {
  // /info [server] - Get server information
  const infoTarget = args.length > 0 ? args[0] : '';
  ctx.sendCommand(infoTarget ? `INFO ${infoTarget}` : 'INFO');
};

export const handleRULES: SendMessageHandler = (ctx, args) => {
  // /rules [server] - Get server rules
  const rulesTarget = args.length > 0 ? args[0] : '';
  ctx.sendCommand(rulesTarget ? `RULES ${rulesTarget}` : 'RULES');
};

export const handleSERVLIST: SendMessageHandler = (ctx, args) => {
  // /servlist [mask] [type] - List IRC services
  const servlistMask = args.length > 0 ? args[0] : '';
  const servlistType = args.length > 1 ? args[1] : '';
  if (servlistMask && servlistType) {
    ctx.sendCommand(`SERVLIST ${servlistMask} ${servlistType}`);
  } else if (servlistMask) {
    ctx.sendCommand(`SERVLIST ${servlistMask}`);
  } else {
    ctx.sendCommand('SERVLIST');
  }
};

export const handleISON: SendMessageHandler = (ctx, args) => {
  // /ison <nick1> [nick2] ... - Check if nicks are online
  if (args.length > 0) {
    ctx.sendCommand(`ISON ${args.join(' ')}`);
  } else {
    ctx.addMessage({ type: 'error', text: t('Usage: /ison <nick1> [nick2] ...'), timestamp: Date.now() });
  }
};

export const handleUSERHOST: SendMessageHandler = (ctx, args) => {
  // /userhost <nick1> [nick2] ... - Get user host information
  if (args.length > 0) {
    ctx.sendCommand(`USERHOST ${args.join(' ')}`);
  } else {
    ctx.addMessage({ type: 'error', text: t('Usage: /userhost <nick1> [nick2] ...'), timestamp: Date.now() });
  }
};

export const handleUSERIP: SendMessageHandler = (ctx, args) => {
  // /userip <nick> - Get user IP address
  if (args.length > 0) {
    ctx.sendCommand(`USERIP ${args[0]}`);
  } else {
    ctx.addMessage({ type: 'error', text: t('Usage: /userip <nick>'), timestamp: Date.now() });
  }
};

export const handleUSERS: SendMessageHandler = (ctx, args) => {
  // /users - Get user list (deprecated, rarely used)
  const usersTarget = args.length > 0 ? args[0] : '';
  ctx.sendCommand(usersTarget ? `USERS ${usersTarget}` : 'USERS');
};

export const handleWATCH: SendMessageHandler = (ctx, args) => {
  // /watch +nick1 -nick2 ... - Monitor users (legacy protocol)
  if (args.length > 0) {
    ctx.sendCommand(`WATCH ${args.join(' ')}`);
  } else {
    ctx.addMessage({ type: 'error', text: t('Usage: /watch +nick1 -nick2 ...'), timestamp: Date.now() });
  }
};

export const handleKNOCK: SendMessageHandler = (ctx, args) => {
  // /knock <channel> [message] - Request invite to invitation-only channel
  if (args.length >= 1) {
    const knockChannel = args[0];
    const knockMessage = args.length > 1 ? args.slice(1).join(' ') : '';
    ctx.sendCommand(knockMessage ? `KNOCK ${knockChannel} :${knockMessage}` : `KNOCK ${knockChannel}`);
    ctx.addMessage({ type: 'notice', text: t('*** Knock sent to {channel}', { channel: knockChannel }), timestamp: Date.now() });
  } else {
    ctx.addMessage({ type: 'error', text: t('Usage: /knock <channel> [message]'), timestamp: Date.now() });
  }
};

export const handleSQUERY: SendMessageHandler = (ctx, args) => {
  // /squery <service> <message> - Query IRC services
  if (args.length >= 2) {
    const service = args[0];
    const serviceMessage = args.slice(1).join(' ');
    ctx.sendRaw(`PRIVMSG ${service} :${serviceMessage}`);
    ctx.addMessage({ type: 'notice', channel: service, from: ctx.getCurrentNick(), text: serviceMessage, timestamp: Date.now(), status: 'sent' });
  } else {
    ctx.addMessage({ type: 'error', text: t('Usage: /squery <service> <message>'), timestamp: Date.now() });
  }
};

export const handleLIST: SendMessageHandler = (ctx, args) => {
  // /list [options] - List channels on server
  const listArgs = args.length > 0 ? args.join(' ') : '';
  ctx.sendCommand(listArgs ? `LIST ${listArgs}` : 'LIST');
  ctx.addMessage({ type: 'notice', text: t('*** Requesting channel list...'), timestamp: Date.now() });
};

export const handleNAMES: SendMessageHandler = (ctx, args, target) => {
  // /names [channel] - List users in channel
  const namesChannel = args.length > 0 ? args[0] : (target.startsWith('#') || target.startsWith('&') ? target : '');
  if (namesChannel) {
    ctx.sendCommand(`NAMES ${namesChannel}`);
  } else {
    ctx.addMessage({ type: 'error', text: t('Usage: /names [channel]'), timestamp: Date.now() });
  }
};

export const infoCommands: SendMessageHandlerRegistry = new Map([
  ['LUSERS', handleLUSERS],
  ['VERSION', handleVERSION],
  ['TIME', handleTIME],
  ['ADMIN', handleADMIN],
  ['LINKS', handleLINKS],
  ['STATS', handleSTATS],
  ['MOTD', handleMOTD],
  ['PING', handlePING],
  ['TRACE', handleTRACE],
  ['INFO', handleINFO],
  ['RULES', handleRULES],
  ['SERVLIST', handleSERVLIST],
  ['ISON', handleISON],
  ['USERHOST', handleUSERHOST],
  ['USERIP', handleUSERIP],
  ['USERS', handleUSERS],
  ['WATCH', handleWATCH],
  ['KNOCK', handleKNOCK],
  ['SQUERY', handleSQUERY],
  ['LIST', handleLIST],
  ['NAMES', handleNAMES],
]);

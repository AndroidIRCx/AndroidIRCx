/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * IRC operator command handlers for sendMessage:
 * OPER, REHASH, SQUIT, KILL, CONNECT, DIE, WALLOPS, LOCOPS, GLOBOPS, ADCHAT
 */

import { tx } from '../../../i18n/transifex';
import type { SendMessageHandler, SendMessageHandlerRegistry } from '../sendMessageTypes';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

export const handleOPER: SendMessageHandler = (ctx, args) => {
  // /oper <nick> <password> - IRCop login
  if (args.length >= 2) {
    const operNick = args[0];
    const operPassword = args[1];
    ctx.sendCommand(`OPER ${operNick} ${operPassword}`);
    ctx.addMessage({ type: 'notice', text: t('*** Attempting IRCop login...'), timestamp: Date.now() });
  } else {
    ctx.addMessage({ type: 'error', text: t('Usage: /oper <nick> <password>'), timestamp: Date.now() });
  }
};

export const handleREHASH: SendMessageHandler = (ctx) => {
  // /rehash - IRCop rehash server
  ctx.sendCommand('REHASH');
  ctx.addMessage({ type: 'notice', text: t('*** Requesting server rehash...'), timestamp: Date.now() });
};

export const handleSQUIT: SendMessageHandler = (ctx, args) => {
  // /squit <server> [message] - IRCop disconnect server
  if (args.length >= 1) {
    const squitServer = args[0];
    const squitMessage = args.length > 1 ? args.slice(1).join(' ') : '';
    ctx.sendCommand(squitMessage ? `SQUIT ${squitServer} :${squitMessage}` : `SQUIT ${squitServer}`);
    ctx.addMessage({ type: 'notice', text: t('*** Requesting server disconnect: {server}', { server: squitServer }), timestamp: Date.now() });
  } else {
    ctx.addMessage({ type: 'error', text: t('Usage: /squit <server> [message]'), timestamp: Date.now() });
  }
};

export const handleKILL: SendMessageHandler = (ctx, args) => {
  // /kill <nick> <reason> - IRCop kill user
  if (args.length >= 2) {
    const killNick = args[0];
    const killReason = args.slice(1).join(' ');
    ctx.sendCommand(`KILL ${killNick} :${killReason}`);
    ctx.addMessage({ type: 'notice', text: t('*** Killing user: {nick}', { nick: killNick }), timestamp: Date.now() });
  } else {
    ctx.addMessage({ type: 'error', text: t('Usage: /kill <nick> <reason>'), timestamp: Date.now() });
  }
};

export const handleCONNECT: SendMessageHandler = (ctx, args) => {
  // /connect <server> <port> [remote] - IRCop connect servers
  if (args.length >= 2) {
    const connectServer = args[0];
    const connectPort = args[1];
    const connectRemote = args.length > 2 ? args[2] : '';
    if (connectRemote) {
      ctx.sendCommand(`CONNECT ${connectServer} ${connectPort} ${connectRemote}`);
    } else {
      ctx.sendCommand(`CONNECT ${connectServer} ${connectPort}`);
    }
    ctx.addMessage({ type: 'notice', text: t('*** Requesting server connection: {server}:{port}', { server: connectServer, port: connectPort }), timestamp: Date.now() });
  } else {
    ctx.addMessage({ type: 'error', text: t('Usage: /connect <server> <port> [remote]'), timestamp: Date.now() });
  }
};

export const handleDIE: SendMessageHandler = (ctx) => {
  // /die - IRCop shutdown server
  ctx.sendCommand('DIE');
  ctx.addMessage({ type: 'notice', text: t('*** Requesting server shutdown...'), timestamp: Date.now() });
};

export const handleWALLOPS: SendMessageHandler = (ctx, args) => {
  // /wallops <message> - Send wallops message (IRCop)
  if (args.length > 0) {
    const wallopsMessage = args.join(' ');
    ctx.sendCommand(`WALLOPS :${wallopsMessage}`);
  } else {
    ctx.addMessage({ type: 'error', text: t('Usage: /wallops <message>'), timestamp: Date.now() });
  }
};

export const handleLOCOPS: SendMessageHandler = (ctx, args) => {
  // /locops <message> - Send local ops message (IRCop)
  if (args.length > 0) {
    const locopsMessage = args.join(' ');
    ctx.sendCommand(`LOCOPS :${locopsMessage}`);
  } else {
    ctx.addMessage({ type: 'error', text: t('Usage: /locops <message>'), timestamp: Date.now() });
  }
};

export const handleGLOBOPS: SendMessageHandler = (ctx, args) => {
  // /globops <message> - Send global ops message (IRCop)
  if (args.length > 0) {
    const globopsMessage = args.join(' ');
    ctx.sendCommand(`GLOBOPS :${globopsMessage}`);
  } else {
    ctx.addMessage({ type: 'error', text: t('Usage: /globops <message>'), timestamp: Date.now() });
  }
};

export const handleADCHAT: SendMessageHandler = (ctx, args) => {
  // /adchat <message> - Admin chat (IRCop)
  if (args.length > 0) {
    const adchatMessage = args.join(' ');
    ctx.sendCommand(`ADCHAT :${adchatMessage}`);
  } else {
    ctx.addMessage({ type: 'error', text: t('Usage: /adchat <message>'), timestamp: Date.now() });
  }
};

export const operCommands: SendMessageHandlerRegistry = new Map([
  ['OPER', handleOPER],
  ['REHASH', handleREHASH],
  ['SQUIT', handleSQUIT],
  ['KILL', handleKILL],
  ['CONNECT', handleCONNECT],
  ['DIE', handleDIE],
  ['WALLOPS', handleWALLOPS],
  ['LOCOPS', handleLOCOPS],
  ['GLOBOPS', handleGLOBOPS],
  ['ADCHAT', handleADCHAT],
]);

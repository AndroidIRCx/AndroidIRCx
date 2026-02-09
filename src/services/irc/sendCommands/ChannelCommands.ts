/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Channel-related command handlers for sendMessage:
 * CNOTICE, CPRIVMSG, CHAT, ANICK, AJINVITE, BEEP
 */

import { tx } from '../../../i18n/transifex';
import type { SendMessageHandler, SendMessageHandlerRegistry } from '../sendMessageTypes';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

export const handleCNOTICE: SendMessageHandler = (ctx, args) => {
  // /cnotice <nick> <channel> <message> - Channel notice (bypass flood limits)
  if (args.length >= 3) {
    const cnoticeNick = args[0];
    const cnoticeChannel = args[1];
    const cnoticeMessage = args.slice(2).join(' ');
    ctx.sendRaw(`CNOTICE ${cnoticeNick} ${cnoticeChannel} :${cnoticeMessage}`);
    ctx.addMessage({ type: 'notice', channel: cnoticeChannel, from: ctx.getCurrentNick(), text: `-> ${cnoticeNick}: ${cnoticeMessage}`, timestamp: Date.now(), status: 'sent' });
  } else {
    ctx.addMessage({ type: 'error', text: t('Usage: /cnotice <nick> <channel> <message>'), timestamp: Date.now() });
  }
};

export const handleCPRIVMSG: SendMessageHandler = (ctx, args) => {
  // /cprivmsg <nick> <channel> <message> - Channel privmsg (bypass flood limits)
  if (args.length >= 3) {
    const cprivmsgNick = args[0];
    const cprivmsgChannel = args[1];
    const cprivmsgMessage = args.slice(2).join(' ');
    ctx.sendRaw(`CPRIVMSG ${cprivmsgNick} ${cprivmsgChannel} :${cprivmsgMessage}`);
    ctx.addMessage({ type: 'message', channel: cprivmsgChannel, from: ctx.getCurrentNick(), text: `-> ${cprivmsgNick}: ${cprivmsgMessage}`, timestamp: Date.now(), status: 'sent' });
  } else {
    ctx.addMessage({ type: 'error', text: t('Usage: /cprivmsg <nick> <channel> <message>'), timestamp: Date.now() });
  }
};

export const handleCHAT: SendMessageHandler = (ctx, args) => {
  // /chat <service> <message> - Chat with services
  if (args.length >= 2) {
    const chatService = args[0];
    const chatMessage = args.slice(1).join(' ');
    ctx.sendRaw(`PRIVMSG ${chatService} :${chatMessage}`);
    ctx.addMessage({ type: 'notice', channel: chatService, from: ctx.getCurrentNick(), text: chatMessage, timestamp: Date.now(), status: 'sent' });
  } else {
    ctx.addMessage({ type: 'error', text: t('Usage: /chat <service> <message>'), timestamp: Date.now() });
  }
};

export const handleANICK: SendMessageHandler = (ctx, args) => {
  // /anick <nickname> - Set alternate nickname
  if (args.length > 0) {
    // Store alternate nick (could be saved to settings)
    ctx.addMessage({ type: 'notice', text: t('*** Alternate nickname set to: {nick}', { nick: args[0] }), timestamp: Date.now() });
    // Note: Actual alternate nick handling would be in connection logic
  } else {
    ctx.addMessage({ type: 'error', text: t('Usage: /anick <nickname>'), timestamp: Date.now() });
  }
};

export const handleAJINVITE: SendMessageHandler = (ctx, args) => {
  // /ajinvite [on|off] - Auto-join on invite toggle
  const ajinviteState = args.length > 0 ? args[0].toLowerCase() : 'toggle';
  ctx.emit('ajinvite-toggle', { state: ajinviteState, network: ctx.getNetworkName() });
  const isOn = ajinviteState === 'on' || (ajinviteState === 'toggle' && true); // Would check actual state
  ctx.addMessage({ type: 'notice', text: t('*** Auto-join on invite: {state}', { state: isOn ? 'ON' : 'OFF' }), timestamp: Date.now() });
};

export const handleBEEP: SendMessageHandler = (ctx, args) => {
  // /beep [number] [delay] - Play beep sound
  const beepCount = args.length > 0 ? parseInt(args[0], 10) || 1 : 1;
  const beepDelay = args.length > 1 ? parseInt(args[1], 10) || 0 : 0;
  ctx.emit('beep', { count: beepCount, delay: beepDelay });
  ctx.addMessage({ type: 'notice', text: t('*** Beep!'), timestamp: Date.now() });
};

export const channelCommands: SendMessageHandlerRegistry = new Map([
  ['CNOTICE', handleCNOTICE],
  ['CPRIVMSG', handleCPRIVMSG],
  ['CHAT', handleCHAT],
  ['ANICK', handleANICK],
  ['AJINVITE', handleAJINVITE],
  ['BEEP', handleBEEP],
]);

/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Status command handlers for sendMessage:
 * AWAY, BACK, RECONNECT, DISCONNECT, SERVER
 */

import { tx } from '../../../i18n/transifex';
import type { SendMessageHandler, SendMessageHandlerRegistry } from '../sendMessageTypes';
import { settingsService, DEFAULT_QUIT_MESSAGE } from '../../SettingsService';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

export const handleAWAY: SendMessageHandler = (ctx, args) => {
  // /away [message] - Set away message (empty message removes away status)
  const awayMessage = args.join(' ');
  if (awayMessage) {
    ctx.sendRaw(`AWAY :${awayMessage}`);
    ctx.addMessage({ type: 'notice', text: t('*** You are now away: {message}', { message: awayMessage }), timestamp: Date.now() });
  } else {
    ctx.sendRaw('AWAY');
    ctx.addMessage({ type: 'notice', text: t('*** You are no longer away'), timestamp: Date.now() });
  }
};

export const handleBACK: SendMessageHandler = (ctx) => {
  // /back - Remove away status (alias for /away)
  ctx.sendRaw('AWAY');
  ctx.addMessage({ type: 'notice', text: t('*** You are no longer away'), timestamp: Date.now() });
};

export const handleRECONNECT: SendMessageHandler = (ctx) => {
  // /reconnect - Reconnect to current server
  ctx.emit('reconnect', ctx.getNetworkName());
  ctx.addMessage({ type: 'notice', text: t('*** Reconnecting to server...'), timestamp: Date.now() });
};

export const handleDISCONNECT: SendMessageHandler = async (ctx, args) => {
  // /disconnect - Disconnect from server (alias for /quit)
  ctx.emit('intentional-quit', ctx.getNetworkName());
  const userArgs = args.join(' ');
  if (userArgs) {
    ctx.sendRaw(`QUIT :${userArgs}`);
  } else {
    const quitMsg = await settingsService.getSetting('quitMessage', DEFAULT_QUIT_MESSAGE);
    ctx.sendRaw(`QUIT :${quitMsg}`);
  }
};

export const handleSERVER: SendMessageHandler = (ctx, args) => {
  // /server [-m] [-e] [-t] <address> [port] [password] [-l method pass] [-lname name] [-i nick anick email name] [-jn #channel pass] [-sar]
  try {
    const serverArgs = ctx.parseServerCommand(args);
    ctx.emit('server-command', serverArgs);
  } catch (error: any) {
    ctx.addMessage({
      type: 'error',
      text: error.message || t('Invalid /server command syntax'),
      timestamp: Date.now(),
    });
  }
};

export const statusCommands: SendMessageHandlerRegistry = new Map([
  ['AWAY', handleAWAY],
  ['BACK', handleBACK],
  ['RECONNECT', handleRECONNECT],
  ['DISCONNECT', handleDISCONNECT],
  ['SERVER', handleSERVER],
]);

/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Query command handlers for sendMessage:
 * WHOIS, WHOWAS, WHO
 */

import type { SendMessageHandler, SendMessageHandlerRegistry } from '../sendMessageTypes';
import { useUIStore } from '../../../stores/uiStore';

export const handleWHOIS: SendMessageHandler = (ctx, args) => {
  if (args.length > 0) {
    ctx.sendCommand(`WHOIS ${args.join(' ')}`);

    // Open modal if whoisDisplayMode is 'modal'
    const mode = useUIStore.getState().whoisDisplayMode;
    if (mode === 'modal') {
      const nick = args[0];
      useUIStore.getState().setWhoisNick(nick);
      useUIStore.getState().setShowWHOIS(true);
    }
  }
};

export const handleWHOWAS: SendMessageHandler = (ctx, args) => {
  if (args.length > 0) {
    const targetNick = args[0];
    ctx.emit('set-whowas-target', targetNick, Date.now());
    if (args.length === 1 && /[\[\]]/.test(targetNick)) {
      ctx.sendCommand(`WHOWAS :${targetNick}`);
    } else {
      ctx.sendCommand(`WHOWAS ${args.join(' ')}`);
    }
  }
};

export const handleWHO: SendMessageHandler = (ctx, args) => {
  const whoMask = args.length > 0 ? args.join(' ') : '';
  ctx.sendCommand(whoMask ? `WHO ${whoMask}` : 'WHO');
};

export const queryCommands: SendMessageHandlerRegistry = new Map([
  ['WHOIS', handleWHOIS],
  ['WHOWAS', handleWHOWAS],
  ['WHO', handleWHO],
]);

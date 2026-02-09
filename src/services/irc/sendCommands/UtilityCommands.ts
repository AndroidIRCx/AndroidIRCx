/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Utility command handlers for sendMessage:
 * ECHO, CLEAR, CLOSE, HELP, RAW, DNS, TIMER, WINDOW, FILTER, CLONES/DETECTCLONES/CLONESDETECT
 */

import { tx } from '../../../i18n/transifex';
import type { SendMessageHandler, SendMessageHandlerRegistry } from '../sendMessageTypes';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

export const handleECHO: SendMessageHandler = (ctx, args) => {
  // /echo <message> - Display local message (useful for scripts/aliases)
  if (args.length > 0) {
    const echoText = args.join(' ');
    ctx.addMessage({ type: 'notice', text: echoText, timestamp: Date.now() });
  } else {
    ctx.addMessage({ type: 'error', text: t('Usage: /echo <message>'), timestamp: Date.now() });
  }
};

export const handleCLEAR: SendMessageHandler = (ctx, _args, target) => {
  // /clear - Clear current tab messages
  ctx.emit('clear-tab', target, ctx.getNetworkName());
  ctx.addMessage({ type: 'notice', text: t('*** Messages cleared'), timestamp: Date.now() });
};

export const handleCLOSE: SendMessageHandler = (ctx, _args, target) => {
  // /close - Close current tab
  ctx.emit('close-tab', target, ctx.getNetworkName());
};

export const handleHELP: SendMessageHandler = (ctx, args) => {
  // /help [command] - Show help for command
  if (args.length > 0) {
    const helpCommand = args[0].toLowerCase();
    ctx.emit('help', helpCommand);
    ctx.addMessage({ type: 'notice', text: t('*** Help for /{command} - Use Settings > Help for full documentation', { command: helpCommand }), timestamp: Date.now() });
  } else {
    ctx.addMessage({ type: 'notice', text: t('*** IRC Commands Help'), timestamp: Date.now() });
    ctx.addMessage({ type: 'notice', text: t('*** Use /help <command> for specific command help'), timestamp: Date.now() });
    ctx.addMessage({ type: 'notice', text: t('*** Or go to Settings > Help for full documentation'), timestamp: Date.now() });
  }
};

export const handleRAW: SendMessageHandler = (ctx, args) => {
  // /raw <command> - Send raw IRC command (alias for /quote)
  if (args.length > 0) {
    const rawCommand = args.join(' ');
    ctx.sendRaw(rawCommand);
  } else {
    ctx.addMessage({ type: 'error', text: t('Usage: /raw <command>'), timestamp: Date.now() });
  }
};

export const handleDNS: SendMessageHandler = (ctx, args) => {
  // /dns <hostname> - DNS lookup
  if (args.length > 0) {
    const hostname = args[0];
    ctx.emit('dns-lookup', hostname);
    ctx.addMessage({ type: 'notice', text: t('*** Looking up DNS for {hostname}...', { hostname }), timestamp: Date.now() });
  } else {
    ctx.addMessage({ type: 'error', text: t('Usage: /dns <hostname>'), timestamp: Date.now() });
  }
};

export const handleTIMER: SendMessageHandler = (ctx, args) => {
  // /timer <name> <delay> <repetitions> <command> - Execute command after delay
  if (args.length >= 4) {
    const timerName = args[0];
    const timerDelay = parseInt(args[1], 10);
    const timerRepetitions = parseInt(args[2], 10);
    const timerCommand = args.slice(3).join(' ');
    if (!isNaN(timerDelay) && !isNaN(timerRepetitions) && timerDelay > 0) {
      ctx.emit('timer', { name: timerName, delay: timerDelay, repetitions: timerRepetitions, command: timerCommand });
      ctx.addMessage({ type: 'notice', text: t('*** Timer "{name}" set: {delay}ms, {repetitions} repetitions', { name: timerName, delay: timerDelay, repetitions: timerRepetitions }), timestamp: Date.now() });
    } else {
      ctx.addMessage({ type: 'error', text: t('Usage: /timer <name> <delay> <repetitions> <command>'), timestamp: Date.now() });
    }
  } else {
    ctx.addMessage({ type: 'error', text: t('Usage: /timer <name> <delay> <repetitions> <command>'), timestamp: Date.now() });
  }
};

export const handleWINDOW: SendMessageHandler = (ctx, args) => {
  // /window [-a] <name> - Window/tab management commands
  if (args.length > 0) {
    const windowAction = args[0];
    if (windowAction === '-a') {
      // Activate window
      const windowName = args.length > 1 ? args[1] : '';
      if (windowName) {
        ctx.emit('window-activate', windowName);
      } else {
        ctx.addMessage({ type: 'error', text: t('Usage: /window -a <name>'), timestamp: Date.now() });
      }
    } else {
      // Open/create window
      ctx.emit('window-open', windowAction);
    }
  } else {
    ctx.addMessage({ type: 'error', text: t('Usage: /window [-a] <name>'), timestamp: Date.now() });
  }
};

export const handleFILTER: SendMessageHandler = (ctx, args) => {
  // /filter [-g] <text> - Filter messages
  if (args.length > 0) {
    const filterGlobal = args[0] === '-g';
    const filterText = filterGlobal ? args.slice(1).join(' ') : args.join(' ');
    if (filterText) {
      ctx.emit('filter', { text: filterText, global: filterGlobal, network: ctx.getNetworkName() });
      ctx.addMessage({ type: 'notice', text: t('*** Filtering messages containing: {text}', { text: filterText }), timestamp: Date.now() });
    } else {
      ctx.addMessage({ type: 'error', text: t('Usage: /filter [-g] <text>'), timestamp: Date.now() });
    }
  } else {
    ctx.addMessage({ type: 'error', text: t('Usage: /filter [-g] <text>'), timestamp: Date.now() });
  }
};

export const handleCLONES: SendMessageHandler = (ctx, args, target) => {
  // /clones [channel] - Detect clones (users with same host) in channel
  // /detectclones [channel] - Alias
  // /clonesdetect [channel] - Alias
  const targetChannel = args.length > 0 ? args[0] : target;
  if (!targetChannel || (!targetChannel.startsWith('#') && !targetChannel.startsWith('&'))) {
    ctx.addMessage({
      type: 'error',
      text: t('Usage: /clones <channel> - Must be used in a channel or specify a channel'),
      timestamp: Date.now(),
    });
  } else {
    ctx.detectClones(targetChannel).then(clones => {
      if (clones.size === 0) {
        ctx.addMessage({
          type: 'notice',
          text: t('*** No clones detected in {channel}', { channel: targetChannel }),
          timestamp: Date.now(),
        });
      } else {
        ctx.addMessage({
          type: 'notice',
          text: t('*** Clones detected in {channel}:', { channel: targetChannel }),
          timestamp: Date.now(),
        });
        clones.forEach((nicks, host) => {
          ctx.addMessage({
            type: 'notice',
            text: t('***   {host}: {nicks}', { host, nicks: nicks.join(', ') }),
            timestamp: Date.now(),
          });
        });
      }
    }).catch(error => {
      ctx.addMessage({
        type: 'error',
        text: t('*** Error detecting clones: {error}', { error: error?.message || String(error) }),
        timestamp: Date.now(),
      });
    });
  }
};

export const handleIGNORE: SendMessageHandler = (ctx, args) => {
  // /ignore <nick|mask> [reason] - Ignore user messages
  if (args.length >= 1) {
    const ignoreMask = args[0];
    const ignoreReason = args.length > 1 ? args.slice(1).join(' ') : undefined;
    const network = ctx.getNetworkName();
    ctx.getUserManagementService().ignoreUser(ignoreMask, ignoreReason, network).then(() => {
      ctx.addMessage({ type: 'notice', text: t('*** Now ignoring {mask}', { mask: ignoreMask }), timestamp: Date.now() });
    }).catch((e: Error) => {
      ctx.addMessage({ type: 'error', text: t('*** Failed to ignore user: {message}', { message: e.message }), timestamp: Date.now() });
    });
  } else {
    ctx.addMessage({ type: 'error', text: t('Usage: /ignore <nick|mask> [reason]'), timestamp: Date.now() });
  }
};

export const handleUNIGNORE: SendMessageHandler = (ctx, args) => {
  // /unignore <nick|mask> - Stop ignoring user
  if (args.length >= 1) {
    const unignoreMask = args[0];
    const network = ctx.getNetworkName();
    ctx.getUserManagementService().unignoreUser(unignoreMask, network).then(() => {
      ctx.addMessage({ type: 'notice', text: t('*** No longer ignoring {mask}', { mask: unignoreMask }), timestamp: Date.now() });
    }).catch((e: Error) => {
      ctx.addMessage({ type: 'error', text: t('*** Failed to unignore user: {message}', { message: e.message }), timestamp: Date.now() });
    });
  } else {
    ctx.addMessage({ type: 'error', text: t('Usage: /unignore <nick|mask>'), timestamp: Date.now() });
  }
};

export const utilityCommands: SendMessageHandlerRegistry = new Map([
  ['ECHO', handleECHO],
  ['CLEAR', handleCLEAR],
  ['CLOSE', handleCLOSE],
  ['HELP', handleHELP],
  ['RAW', handleRAW],
  ['DNS', handleDNS],
  ['TIMER', handleTIMER],
  ['WINDOW', handleWINDOW],
  ['FILTER', handleFILTER],
  ['CLONES', handleCLONES],
  ['DETECTCLONES', handleCLONES],
  ['CLONESDETECT', handleCLONES],
  ['IGNORE', handleIGNORE],
  ['UNIGNORE', handleUNIGNORE],
]);

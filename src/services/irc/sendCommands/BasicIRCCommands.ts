/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Basic IRC command handlers for sendMessage:
 * JOIN, PART, NICK, SETNAME, BOT, QUIT, MODE, TOPIC, KICK
 */

import { tx } from '../../../i18n/transifex';
import type { SendMessageHandler, SendMessageHandlerRegistry } from '../sendMessageTypes';
import { settingsService, DEFAULT_QUIT_MESSAGE } from '../../SettingsService';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

export const handleJOIN: SendMessageHandler = (ctx, args) => {
  if (args.length > 0) {
    ctx.joinChannel(args[0], args[1]);
  }
};

export const handlePART: SendMessageHandler = (ctx, args, target) => {
  if (args.length === 0) {
    const isChannelTarget =
      target.startsWith('#') ||
      target.startsWith('&') ||
      target.startsWith('+') ||
      target.startsWith('!');
    if (!isChannelTarget) {
      ctx.addMessage({
        type: 'error',
        text: t('Usage: /part <channel> [message]'),
        timestamp: Date.now(),
      });
      return;
    }
  }
  ctx.partChannel(
    args.length > 0 ? args[0] : target,
    args.slice(1).join(' '),
  );
};

export const handleNICK: SendMessageHandler = (ctx, args) => {
  if (args.length > 0) {
    ctx.sendRaw(`NICK ${args[0]}`);
  }
};

export const handleSETNAME: SendMessageHandler = (ctx, args) => {
  if (args.length > 0) {
    ctx.setRealname(args.join(' '));
  }
};

export const handleBOT: SendMessageHandler = (ctx, args) => {
  const enable = args.length === 0 || args[0].toLowerCase() !== 'off';
  ctx.toggleBotMode(enable);
};

export const handleQUIT: SendMessageHandler = async (ctx, args) => {
  ctx.emit('intentional-quit', ctx.getNetworkName());
  const userArgs = args.join(' ');
  if (userArgs) {
    ctx.sendRaw(`QUIT :${userArgs}`);
  } else {
    const quitMsg = await settingsService.getSetting('quitMessage', DEFAULT_QUIT_MESSAGE);
    ctx.sendRaw(`QUIT :${quitMsg}`);
  }
};

export const handleMODE: SendMessageHandler = (ctx, args) => {
  if (args.length > 0) {
    ctx.sendCommand(`MODE ${args.join(' ')}`);
  }
};

export const handleTOPIC: SendMessageHandler = (ctx, args, target) => {
  const topicChannel =
    target.startsWith('#') || target.startsWith('&') ? target : args[0];
  const topicText =
    args.length > 1
      ? args.slice(1).join(' ')
      : args.length === 1 && !target.startsWith('#')
        ? args[0]
        : '';
  ctx.sendCommand(
    topicText
      ? `TOPIC ${topicChannel} :${topicText}`
      : `TOPIC ${topicChannel}`,
  );
};

export const handleKICK: SendMessageHandler = (ctx, args, target) => {
  if (args.length >= 1) {
    const kickChannel =
      target.startsWith('#') || target.startsWith('&') ? target : args[0];
    const kickUser = args.length > 1 ? args[1] : args[0];
    const kickReason = args.slice(2).join(' ');
    ctx.sendCommand(
      `KICK ${kickChannel} ${kickUser}${kickReason ? ` :${kickReason}` : ''}`,
    );
  }
};

export const handleREGISTER: SendMessageHandler = (ctx, args) => {
  if (!ctx.hasCapability('draft/account-registration')) {
    ctx.addMessage({
      type: 'error',
      text: t('Account registration is not supported by this server'),
      timestamp: Date.now(),
    });
    return;
  }
  // Syntax: /register <email|*> <password>
  //     or: /register <account> <email|*> <password>
  if (args.length < 2) {
    ctx.addMessage({
      type: 'error',
      text: t('Usage: /register <email|*> <password> OR /register <account> <email|*> <password>'),
      timestamp: Date.now(),
    });
    return;
  }
  if (args.length === 2) {
    // /register <email|*> <password>
    ctx.sendRaw(`REGISTER * ${args[0]} :${args[1]}`);
  } else {
    // /register <account> <email|*> <password>
    ctx.sendRaw(`REGISTER ${args[0]} ${args[1]} :${args[2]}`);
  }
};

export const basicIRCCommands: SendMessageHandlerRegistry = new Map([
  ['JOIN', handleJOIN],
  ['PART', handlePART],
  ['NICK', handleNICK],
  ['SETNAME', handleSETNAME],
  ['BOT', handleBOT],
  ['QUIT', handleQUIT],
  ['MODE', handleMODE],
  ['TOPIC', handleTOPIC],
  ['KICK', handleKICK],
  ['REGISTER', handleREGISTER],
]);

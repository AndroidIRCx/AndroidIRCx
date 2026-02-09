/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Message-related sendMessage command handlers:
 * MSG, QUERY, ME, ACTION, NOTICE, AMSG, AME, ANOTICE
 */

import { tx } from '../../../i18n/transifex';
import type { SendMessageHandler, SendMessageHandlerRegistry } from '../sendMessageTypes';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

/** MSG / QUERY - Send a private message to a nick or channel */
export const handleMSG: SendMessageHandler = (ctx, args) => {
  if (args.length >= 2) {
    const msgTarget = args[0];
    const msgText = args.slice(1).join(' ');
    ctx.sendRaw(`PRIVMSG ${msgTarget} :${msgText}`);
    ctx.addMessage({
      type: 'message',
      channel: msgTarget,
      from: ctx.getCurrentNick(),
      text: msgText,
      timestamp: Date.now(),
      status: 'sent',
    });
  } else {
    ctx.addMessage({
      type: 'error',
      text: t('Usage: /MSG <nick|channel> <message>'),
      timestamp: Date.now(),
    });
  }
};

/** ME / ACTION - Send a CTCP ACTION to the current target */
export const handleME: SendMessageHandler = (ctx, args, target) => {
  if (args.length > 0) {
    const actionText = args.join(' ');
    ctx.sendRaw(`PRIVMSG ${target} :${ctx.encodeCTCP('ACTION', actionText)}`);
    ctx.addMessage({
      type: 'message',
      channel: target,
      from: ctx.getCurrentNick(),
      text: `\x01ACTION ${actionText}\x01`,
      timestamp: Date.now(),
      status: 'sent',
    });
  }
};

/** NOTICE - Send a notice to a target */
export const handleNOTICE: SendMessageHandler = (ctx, args) => {
  if (args.length >= 2) {
    const noticeTarget = args[0];
    const noticeText = args.slice(1).join(' ');
    ctx.sendRaw(`NOTICE ${noticeTarget} :${noticeText}`);
    ctx.addMessage({
      type: 'notice',
      channel: noticeTarget,
      from: ctx.getCurrentNick(),
      text: noticeText,
      timestamp: Date.now(),
      status: 'sent',
    });
  } else {
    ctx.addMessage({
      type: 'error',
      text: t('Usage: /notice <target> <message>'),
      timestamp: Date.now(),
    });
  }
};

/** AMSG - Send message to all open channels */
export const handleAMSG: SendMessageHandler = (ctx, args) => {
  if (args.length > 0) {
    const amsgText = args.join(' ');
    ctx.emit('amsg', amsgText, ctx.getNetworkName());
    ctx.addMessage({
      type: 'notice',
      text: t('*** Sending message to all channels...'),
      timestamp: Date.now(),
    });
  } else {
    ctx.addMessage({
      type: 'error',
      text: t('Usage: /amsg <message>'),
      timestamp: Date.now(),
    });
  }
};

/** AME - Send action to all open channels */
export const handleAME: SendMessageHandler = (ctx, args) => {
  if (args.length > 0) {
    const ameText = args.join(' ');
    ctx.emit('ame', ameText, ctx.getNetworkName());
    ctx.addMessage({
      type: 'notice',
      text: t('*** Sending action to all channels...'),
      timestamp: Date.now(),
    });
  } else {
    ctx.addMessage({
      type: 'error',
      text: t('Usage: /ame <action>'),
      timestamp: Date.now(),
    });
  }
};

/** ANOTICE - Send notice to all open channels */
export const handleANOTICE: SendMessageHandler = (ctx, args) => {
  if (args.length > 0) {
    const anoticeText = args.join(' ');
    ctx.emit('anotice', anoticeText, ctx.getNetworkName());
    ctx.addMessage({
      type: 'notice',
      text: t('*** Sending notice to all channels...'),
      timestamp: Date.now(),
    });
  } else {
    ctx.addMessage({
      type: 'error',
      text: t('Usage: /anotice <message>'),
      timestamp: Date.now(),
    });
  }
};

export const messageCommands: SendMessageHandlerRegistry = new Map([
  ['MSG', handleMSG],
  ['QUERY', handleMSG],
  ['ME', handleME],
  ['ACTION', handleME],
  ['NOTICE', handleNOTICE],
  ['AMSG', handleAMSG],
  ['AME', handleAME],
  ['ANOTICE', handleANOTICE],
]);

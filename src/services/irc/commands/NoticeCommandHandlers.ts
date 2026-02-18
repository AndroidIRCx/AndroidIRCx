/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * NOTICE command handlers.
 */

import { tx } from '../../../i18n/transifex';
import { protectionService } from '../../ProtectionService';
import type { CommandHandler, CommandHandlerRegistry } from '../commandTypes';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

export const handleNOTICE: CommandHandler = (ctx, prefix, params, timestamp, meta) => {
  const noticeTarget = params[0] || '';
  const noticeFrom = ctx.extractNick(prefix);
  const noticeText = params[1] || '';

  const noticeNetwork = ctx.getNetworkName();
  const noticePrefixParts = prefix.split('!');
  const noticeUsername = noticePrefixParts[1]?.split('@')[0];
  const noticeHostname = noticePrefixParts[1]?.split('@')[1];

  if (prefix.includes('!') && ctx.getUserManagementService().isUserIgnored(
    noticeFrom,
    noticeUsername,
    noticeHostname,
    noticeNetwork
  )) {
    return;
  }

  if (prefix.includes('!') && noticeText) {
    const isChannelNotice =
      noticeTarget.startsWith('#') ||
      noticeTarget.startsWith('&') ||
      noticeTarget.startsWith('+') ||
      noticeTarget.startsWith('!');
    const noticeContext = ctx.getProtectionTabContext(noticeTarget, noticeFrom, isChannelNotice);
    const decision = protectionService.evaluateIncomingMessage({
      type: 'notice',
      channel: isChannelNotice ? noticeTarget : noticeFrom,
      from: noticeFrom,
      text: noticeText,
      timestamp,
      network: noticeNetwork,
      username: noticeUsername,
      hostname: noticeHostname,
    }, {
      isActiveTab: noticeContext.isActiveTab,
      isQueryOpen: noticeContext.isQueryOpen,
      isChannel: isChannelNotice,
      isCtcp: false,
    });
    if (decision) {
      ctx.handleProtectionBlock(decision.kind, noticeFrom, noticeUsername, noticeHostname, isChannelNotice ? noticeTarget : null);
      return;
    }
  }

  if (noticeFrom && noticeFrom !== ctx.getCurrentNick()) {
    if (prefix.includes('!')) {
      const blacklistEntry = ctx.getUserManagementService().findMatchingBlacklistEntry(
        noticeFrom,
        noticeUsername,
        noticeHostname,
        noticeNetwork
      );
      if (blacklistEntry) {
        ctx.runBlacklistAction(blacklistEntry, {
          nick: noticeFrom,
          username: noticeUsername,
          hostname: noticeHostname,
          channel: noticeTarget,
          network: noticeNetwork,
        });
      }
    } else {
      const extracted = ctx.extractMaskFromNotice(noticeText);
      if (extracted) {
        const blacklistEntry = ctx.getUserManagementService().findMatchingBlacklistEntry(
          extracted.nick,
          extracted.username,
          extracted.hostname,
          noticeNetwork
        );
        if (blacklistEntry) {
          ctx.runBlacklistAction(blacklistEntry, {
            nick: extracted.nick,
            username: extracted.username,
            hostname: extracted.hostname,
            channel: noticeTarget,
            network: noticeNetwork,
            reasonOverride: noticeText,
          });
        }
      }
    }
  }

  const noticeCTCP = ctx.parseCTCP(noticeText);
  let displayText = noticeText;

  if (noticeCTCP.isCTCP && noticeCTCP.command) {
    if (noticeCTCP.command === 'PING' && noticeCTCP.args) {
      try {
        const sentTime = parseInt(noticeCTCP.args, 10);
        const latency = Date.now() - sentTime;
        ctx.logRaw(`CTCP PING response from ${noticeFrom}: ${latency}ms`);
        ctx.emit('pong', sentTime);
        displayText = t('CTCP PING reply: {latency}ms', { latency });
      } catch (e) {
        displayText = t('CTCP PING reply from {nick}', { nick: noticeFrom });
      }
    } else {
      displayText = noticeCTCP.args
        ? t('CTCP {command} reply from {nick}: {args}', { command: noticeCTCP.command, nick: noticeFrom, args: noticeCTCP.args })
        : t('CTCP {command} reply from {nick}', { command: noticeCTCP.command, nick: noticeFrom });
    }
  }

  ctx.addMessage({
    type: 'notice',
    channel: noticeTarget,
    from: noticeFrom,
    text: displayText,
    timestamp,
    account: meta?.accountTag,
    msgid: meta?.msgidTag,
    channelContext: meta?.channelContextTag,
    replyTo: meta?.replyTag,
    reactions: meta?.reactTag,
    username: noticeUsername,
    hostname: noticeHostname,
    target: noticeTarget,
    command: 'NOTICE',
  }, meta?.batchTag);
};

export const noticeCommandHandlers: CommandHandlerRegistry = new Map([
  ['NOTICE', handleNOTICE],
]);

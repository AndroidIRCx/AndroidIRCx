/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * PRIVMSG command handler.
 * Handles incoming private messages including encryption protocol,
 * CTCP routing, protection checks, and multiline assembly.
 */

import { tx } from '../../../i18n/transifex';
import type { CommandHandler, CommandHandlerContext, CommandHandlerRegistry } from '../commandTypes';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

/** Check if target is a channel */
function isChannelTarget(target: string): boolean {
  return target.startsWith('#') || target.startsWith('&') || target.startsWith('+') || target.startsWith('!');
}

/** Parse username and hostname from IRC prefix */
function parsePrefix(prefix: string): { username?: string; hostname?: string } {
  const parts = prefix.split('!');
  return {
    username: parts[1]?.split('@')[0],
    hostname: parts[1]?.split('@')[1],
  };
}

/** Strip ZNC playback timestamps from message text */
function stripZNCTimestamps(text: string): string {
  return text
    .replace(/^\[\d{2}:\d{2}:\d{2}\]\s*/, '')  // Remove leading timestamp
    .replace(/\s*\[\d{2}:\d{2}:\d{2}\]$/, '');  // Remove trailing timestamp
}

/** Resolve the channel identifier for tab routing */
function resolveChannelIdentifier(isChannel: boolean, target: string, fromNick: string, currentNick: string): string {
  return isChannel
    ? target
    : (fromNick.toLowerCase() === currentNick.toLowerCase() ? target : fromNick);
}

/**
 * Handle encryption protocol messages (!enc-*, !chanenc-*).
 * Returns true if the message was handled as an encryption protocol message.
 */
function handleEncryptionProtocol(
  ctx: CommandHandlerContext,
  msgText: string,
  fromNick: string,
  target: string,
  channelIdentifier: string,
  isChannel: boolean,
  timestamp: number,
): boolean {
  const encryptedDMService = ctx.getEncryptedDMService();
  const channelEncryptionService = ctx.getChannelEncryptionService();
  const network = ctx.getNetworkName();

  // Handle old protocol for backward compatibility
  if (msgText.startsWith('!enc-key ')) {
    encryptedDMService.handleIncomingBundleForNetwork(network, fromNick, msgText.substring('!enc-key '.length));
    return true;
  }

  // New negotiation protocol: key offer (requires acceptance)
  if (msgText.startsWith('!enc-offer ')) {
    encryptedDMService.handleKeyOfferForNetwork(network, fromNick, msgText.substring('!enc-offer '.length));
    return true;
  }

  // Handle key acceptance (they accepted and sent their key)
  if (msgText.startsWith('!enc-accept ')) {
    encryptedDMService.handleKeyAcceptanceForNetwork(network, fromNick, msgText.substring('!enc-accept '.length))
      .then((result: any) => {
        if (result.status === 'stored') {
          ctx.addMessage({
            type: 'notice',
            text: t('*** {nick} accepted your encryption key. Encrypted chat enabled.', { nick: fromNick }),
            timestamp: Date.now(),
          });
        } else if (result.status === 'pending') {
          ctx.addMessage({
            type: 'notice',
            text: t('*** {nick} sent a different encryption key. Review and accept the new key to continue encrypted chat.', { nick: fromNick }),
            timestamp: Date.now(),
          });
        }
      })
      .catch((e: any) => console.warn('EncryptedDMService: failed to handle acceptance', e));
    return true;
  }

  // Handle key rejection
  if (msgText === '!enc-reject') {
    ctx.addMessage({
      type: 'notice',
      text: t('*** {nick} rejected your encryption key offer.', { nick: fromNick }),
      timestamp: Date.now(),
    });
    return true;
  }

  // Handle key request (auto-send offer)
  if (msgText === '!enc-req') {
    encryptedDMService
      .exportBundle()
      .then((bundle: any) => ctx.sendRaw(`PRIVMSG ${fromNick} :!enc-offer ${JSON.stringify(bundle)}`))
      .catch((e: any) => console.warn('EncryptedDMService: failed to respond to enc-req', e));
    return true;
  }

  // Handle encrypted channel messages
  if (msgText.startsWith('!chanenc-msg ')) {
    if (!isChannel) {
      return true; // Ignore channel encryption in DMs
    }
    let payload: any = null;
    try {
      payload = JSON.parse(msgText.substring('!chanenc-msg '.length));
    } catch (e) {
      ctx.addMessage({
        type: 'error',
        channel: channelIdentifier,
        from: fromNick,
        text: t('🔒 Invalid channel encryption payload'),
        timestamp,
      });
      return true;
    }

    channelEncryptionService
      .decryptMessage(payload, target, network)
      .then((plaintext: string) => {
        ctx.addMessage({
          type: 'message',
          channel: channelIdentifier,
          from: fromNick,
          text: t('🔒 {message}', { message: plaintext }),
          timestamp,
        });
      })
      .catch((e: any) => {
        ctx.addMessage({
          type: 'message',
          channel: channelIdentifier,
          from: fromNick,
          text: t('🔒 {message}', {
            message: e.message === 'no channel key'
              ? t('Missing channel key. Use /chankey request <nick> to get it.')
              : t('Decryption failed. If this was sent from v1.6.3+, please update to v1.6.3 or newer.'),
          }),
          timestamp,
        });
      });
    return true;
  }

  // Handle encrypted channel key sharing (via DM)
  if (msgText.startsWith('!chanenc-key ')) {
    const keyData = msgText.substring('!chanenc-key '.length);
    channelEncryptionService.importChannelKey(keyData, network)
      .then((imported: any) => {
        ctx.addMessage({
          type: 'notice',
          text: t('*** Received channel key for {channel} from {nick}', { channel: imported.channel, nick: fromNick }),
          timestamp: Date.now(),
        });
      })
      .catch((e: any) => {
        ctx.addMessage({
          type: 'error',
          text: t('*** Failed to import channel key: {message}', { message: e }),
          timestamp: Date.now(),
        });
      });
    return true;
  }

  // Handle DM encrypted messages
  if (msgText.startsWith('!enc-msg ')) {
    let payload: any = null;
    try {
      payload = JSON.parse(msgText.substring('!enc-msg '.length));
    } catch (e) {
      ctx.addMessage({
        type: 'error',
        channel: channelIdentifier,
        from: fromNick,
        text: t('Invalid encrypted payload'),
        timestamp,
      });
      return true;
    }

    encryptedDMService
      .decryptForNetwork(payload, network, fromNick)
      .then((plaintext: string) => {
        ctx.addMessage({
          type: 'message',
          channel: channelIdentifier,
          from: fromNick,
          text: t('🔒 {message}', { message: plaintext }),
          timestamp,
        });
      })
      .catch(() => {
        ctx.addMessage({
          type: 'error',
          channel: channelIdentifier,
          text: t('Encrypted message from {nick} could not be decrypted. If they are on v1.6.3+, please update to v1.6.3 or newer.', { nick: fromNick }),
          timestamp,
        });
      });
    return true;
  }

  return false;
}

/** PRIVMSG - incoming private/channel message */
export const handlePRIVMSG: CommandHandler = (ctx, prefix, params, timestamp, meta) => {
  const target = params[0] || '';
  const fromNick = ctx.extractNick(prefix);
  let msgText = params[1] || '';

  // Strip ZNC playback timestamps
  msgText = stripZNCTimestamps(msgText);

  // Validate target
  if (!target || target === '*' || target.trim() === '') {
    return;
  }

  const isChannel = isChannelTarget(target);

  // Suppress self-to-self echo in queries
  if (!isChannel && fromNick === ctx.getCurrentNick() && target === ctx.getCurrentNick()) {
    return;
  }

  // Check if user is ignored
  const network = ctx.getNetworkName();
  const { username, hostname } = parsePrefix(prefix);
  if (ctx.isUserIgnored(fromNick, username, hostname, network)) {
    return;
  }

  // CTCP and protection checks
  const ctcp = ctx.parseCTCP(msgText);
  const protectionContext = ctx.getProtectionTabContext(target, fromNick, isChannel);
  const protectionDecision = ctx.evaluateProtectionDecision({
    type: 'message',
    channel: isChannel ? target : fromNick,
    from: fromNick,
    text: msgText,
    timestamp,
    network,
    username,
    hostname,
  }, {
    isActiveTab: protectionContext.isActiveTab,
    isQueryOpen: protectionContext.isQueryOpen,
    isChannel,
    isCtcp: ctcp.isCTCP,
  });
  if (protectionDecision) {
    ctx.handleProtectionBlock(protectionDecision.kind, fromNick, username, hostname, isChannel ? target : null);
    return;
  }

  // Route CTCP requests
  if (ctcp.isCTCP && ctcp.command) {
    ctx.handleCTCPRequest(fromNick, target, ctcp.command, ctcp.args);
    return;
  }

  // Determine channel identifier for tab routing
  const channelIdentifier = resolveChannelIdentifier(isChannel, target, fromNick, ctx.getCurrentNick());

  // Handle encryption protocol messages
  if (handleEncryptionProtocol(ctx, msgText, fromNick, target, channelIdentifier, isChannel, timestamp)) {
    return;
  }

  // Handle multiline messages (draft/multiline)
  const finalText = ctx.handleMultilineMessage(
    fromNick,
    channelIdentifier,
    msgText,
    meta?.multilineConcatTag,
    {
      timestamp,
      account: meta?.accountTag,
      msgid: meta?.msgidTag,
      channelContext: meta?.channelContextTag,
      replyTo: meta?.replyTag,
    }
  );

  // Only add message if multiline assembly is complete
  if (finalText !== null) {
    ctx.addMessage({
      type: 'message',
      channel: channelIdentifier,
      from: fromNick,
      text: finalText,
      timestamp,
      account: meta?.accountTag,
      msgid: meta?.msgidTag,
      channelContext: meta?.channelContextTag,
      replyTo: meta?.replyTag,
      reactions: meta?.reactTag,
      typing: meta?.typingTag as 'active' | 'paused' | 'done' | undefined,
      username,
      hostname,
      target,
      command: 'PRIVMSG',
    }, meta?.batchTag);
  }
};

export const privmsgCommandHandlers: CommandHandlerRegistry = new Map([
  ['PRIVMSG', handlePRIVMSG],
]);

/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * User state command handlers (ACCOUNT, AWAY, CHGHOST, TAGMSG).
 */

import { tx } from '../../../i18n/transifex';
import type { CommandHandler, CommandHandlerRegistry } from '../commandTypes';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

export const handleACCOUNT: CommandHandler = (ctx, prefix, params, timestamp) => {
  const accountNick = ctx.extractNick(prefix);
  const accountName = params[0] || '';
  if (accountName === '*') {
    ctx.addMessage({
      type: 'raw',
      text: t('*** {nick} logged out', { nick: accountNick }),
      timestamp,
      isRaw: true,
      rawCategory: 'user',
    });
  } else {
    ctx.addMessage({
      type: 'raw',
      text: t('*** {nick} logged in as {accountName}', { nick: accountNick, accountName }),
      timestamp,
      isRaw: true,
      rawCategory: 'user',
    });
  }
  ctx.emit('account', accountNick, accountName);
};

export const handleAWAY: CommandHandler = (ctx, prefix, params, timestamp) => {
  const awayNick = ctx.extractNick(prefix);
  const awayMessage = params[0] || '';
  if (awayMessage) {
    ctx.addMessage({
      type: 'raw',
      text: t('*** {nick} is now away: {message}', { nick: awayNick, message: awayMessage }),
      timestamp,
      isRaw: true,
      rawCategory: 'user',
    });
  } else {
    ctx.addMessage({
      type: 'raw',
      text: t('*** {nick} is no longer away', { nick: awayNick }),
      timestamp,
      isRaw: true,
      rawCategory: 'user',
    });
  }
};

export const handleCHGHOST: CommandHandler = (ctx, prefix, params, timestamp) => {
  const chghostNick = ctx.extractNick(prefix);
  const newHost = params[1] || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** {nick} changed host to {host}', { nick: chghostNick, host: newHost }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
  ctx.emit('chghost', chghostNick, newHost);
};

export const handleSETNAME: CommandHandler = (ctx, prefix, params, timestamp) => {
  const setnameNick = ctx.extractNick(prefix);
  const newRealname = ctx.decodeIfBase64Like(params[0] || '');
  ctx.addMessage({
    type: 'raw',
    text: t('*** {nick} changed realname to: {realname}', { nick: setnameNick, realname: newRealname }),
    timestamp,
    isRaw: true,
    rawCategory: 'user',
  });
  ctx.emit('setname', setnameNick, newRealname);
};

export const handleTAGMSG: CommandHandler = (ctx, prefix, params, timestamp, meta) => {
  const tagTarget = params[0] || '';
  const tagFrom = ctx.extractNick(prefix);
  const reactTag = meta?.reactTag;
  const typingTag = meta?.typingTag;

  const tagSummary = [
    reactTag ? `react=${reactTag}` : null,
    typingTag ? `typing=${typingTag}` : null,
  ].filter(Boolean).join(' ');

  if (tagSummary) {
    ctx.addRawMessage(
      t('*** TAGMSG {from} -> {target} ({tags})', {
        from: tagFrom,
        target: tagTarget || '-',
        tags: tagSummary,
      }),
      'user',
      timestamp
    );
  } else {
    ctx.addRawMessage(
      t('*** TAGMSG {from} -> {target}', {
        from: tagFrom,
        target: tagTarget || '-',
      }),
      'user',
      timestamp
    );
  }

  if (reactTag) {
    const [referencedMsgid, emoji] = reactTag.split(';');
    ctx.logRaw(`IRCService: ${tagFrom} reacted ${emoji} to message ${referencedMsgid} in ${tagTarget}`);
    ctx.emit('reaction-received', tagTarget, referencedMsgid, emoji, tagFrom);
  }

  if (typingTag) {
    ctx.logRaw(`IRCService: ${tagFrom} typing status: ${typingTag} in ${tagTarget}`);
    ctx.emit('typing-indicator', tagTarget, tagFrom, typingTag);
  }
};

export const userStateCommandHandlers: CommandHandlerRegistry = new Map([
  ['ACCOUNT', handleACCOUNT],
  ['AWAY', handleAWAY],
  ['CHGHOST', handleCHGHOST],
  ['SETNAME', handleSETNAME],
  ['TAGMSG', handleTAGMSG],
]);

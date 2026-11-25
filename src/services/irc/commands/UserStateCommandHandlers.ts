/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * User state command handlers (ACCOUNT, AWAY, CHGHOST, TAGMSG).
 */

import { tx } from '../../../i18n/localization';
import type { CommandHandler, CommandHandlerRegistry } from '../commandTypes';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

export const handleACCOUNT: CommandHandler = (
  ctx,
  prefix,
  params,
  timestamp,
) => {
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
      text: t('*** {nick} logged in as {accountName}', {
        nick: accountNick,
        accountName,
      }),
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
      text: t('*** {nick} is now away: {message}', {
        nick: awayNick,
        message: awayMessage,
      }),
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

export const handleCHGHOST: CommandHandler = (
  ctx,
  prefix,
  params,
  timestamp,
) => {
  const chghostNick = ctx.extractNick(prefix);
  const newHost = params[1] || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** {nick} changed host to {host}', {
      nick: chghostNick,
      host: newHost,
    }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
  ctx.emit('chghost', chghostNick, newHost);
};

export const handleSETNAME: CommandHandler = (
  ctx,
  prefix,
  params,
  timestamp,
) => {
  const setnameNick = ctx.extractNick(prefix);
  const newRealname = ctx.decodeIfBase64Like(params[0] || '');
  ctx.addMessage({
    type: 'raw',
    text: t('*** {nick} changed realname to: {realname}', {
      nick: setnameNick,
      realname: newRealname,
    }),
    timestamp,
    isRaw: true,
    rawCategory: 'user',
  });
  ctx.emit('setname', setnameNick, newRealname);
};

export const handleTAGMSG: CommandHandler = (
  ctx,
  prefix,
  params,
  timestamp,
  meta,
) => {
  const tagTarget = params[0] || '';
  const tagFrom = ctx.extractNick(prefix);
  const typingTag = meta?.typingTag;

  // A TAGMSG MUST NOT be shown in the message history by default
  // (message-tags.md); what its tags mean is handled below.
  ctx.logRaw(
    `IRCService: TAGMSG ${tagFrom} -> ${tagTarget || '-'} ${JSON.stringify(meta?.tags ?? {})}`,
  );

  // client-tags/react.md: the parent message is in +reply, the reaction in
  // +draft/react or +draft/unreact (never both). Builds before 1.10.11 sent
  // `+draft/react=<msgid>;<reaction>` without +reply; that is still read.
  let parent = meta?.replyTag;
  let reaction = meta?.reactTag ?? meta?.unreactTag;
  const remove = !meta?.reactTag && !!meta?.unreactTag;
  if (!parent && meta?.reactTag && meta.reactTag.includes(';')) {
    const split = meta.reactTag.indexOf(';');
    parent = meta.reactTag.slice(0, split);
    reaction = meta.reactTag.slice(split + 1);
  }
  if (parent && reaction && !(meta?.reactTag && meta?.unreactTag)) {
    ctx.logRaw(
      `IRCService: ${tagFrom} ${remove ? 'unreacted' : 'reacted'} ${reaction} to message ${parent} in ${tagTarget}`,
    );
    ctx.emit('reaction-received', tagTarget, parent, reaction, tagFrom, remove);
  }

  if (typingTag) {
    ctx.logRaw(
      `IRCService: ${tagFrom} typing status: ${typingTag} in ${tagTarget}`,
    );
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

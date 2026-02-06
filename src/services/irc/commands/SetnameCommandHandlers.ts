/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * SETNAME command handler.
 */

import { tx } from '../../../i18n/transifex';
import type { CommandHandler, CommandHandlerRegistry } from '../commandTypes';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

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

export const setnameCommandHandlers: CommandHandlerRegistry = new Map([
  ['SETNAME', handleSETNAME],
]);

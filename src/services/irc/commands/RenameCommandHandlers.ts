/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * RENAME command handler (draft/channel-rename).
 * Handles server-initiated channel renames: RENAME #old #new :reason
 */

import { tx } from '../../../i18n/transifex';
import type { CommandHandler, CommandHandlerRegistry } from '../commandTypes';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

export const handleRENAME: CommandHandler = (ctx, _prefix, params, timestamp) => {
  const oldChannel = params[0] || '';
  const newChannel = params[1] || '';
  const reason = params[2] || '';

  if (!oldChannel || !newChannel) return;

  // Migrate channel users map
  const users = ctx.getChannelUsers(oldChannel);
  if (users) {
    const allUsers = ctx.getAllChannelUsers();
    allUsers.set(newChannel, users);
    allUsers.delete(oldChannel);
  }

  // Migrate channel topic info
  const topicInfo = ctx.getChannelTopicInfo(oldChannel);
  if (topicInfo) {
    ctx.setChannelTopicInfo(newChannel, topicInfo);
    ctx.setChannelTopicInfo(oldChannel, {});
  }

  // Display rename message
  const text = reason
    ? t('*** Channel {oldChannel} has been renamed to {newChannel}: {reason}', { oldChannel, newChannel, reason })
    : t('*** Channel {oldChannel} has been renamed to {newChannel}', { oldChannel, newChannel });

  ctx.addMessage({
    type: 'raw',
    text,
    channel: oldChannel,
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });

  // Emit event for UI to update tab ID and name
  ctx.emit('channel-renamed', oldChannel, newChannel, reason);
};

export const renameCommandHandlers: CommandHandlerRegistry = new Map([
  ['RENAME', handleRENAME],
]);

/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * TOPIC and MODE command handlers.
 */

import { tx } from '../../../i18n/transifex';
import type { CommandHandler, CommandHandlerRegistry } from '../commandTypes';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

export const handleTOPIC: CommandHandler = (ctx, prefix, params, timestamp) => {
  const topicChannel = params[0] || '';
  const topic = params[1] || '';
  const setBy = ctx.extractNick(prefix);
  if (topicChannel) {
    const existing = ctx.getChannelTopicInfo(topicChannel) || {};
    ctx.setChannelTopicInfo(topicChannel, {
      ...existing,
      topic,
      setBy,
      setAt: Math.floor(timestamp / 1000),
    });
    ctx.maybeEmitChannelIntro(topicChannel, timestamp);
  }
  ctx.emit('topic', topicChannel, topic, setBy);
  ctx.addMessage({
    type: 'topic',
    channel: topicChannel,
    from: setBy,
    text: t('Topic: {topic}', { topic }),
    timestamp,
    topic,
    target: topicChannel,
    command: 'TOPIC',
  });
};

export const handleMODE: CommandHandler = (ctx, prefix, params, timestamp) => {
  const modeChannel = params[0] || '';
  const modeParams = params.slice(1);
  const modeString = modeParams[0] || '';
  const modeParamValues = modeParams.slice(1);

  if (
    modeChannel &&
    (modeChannel.startsWith('#') ||
      modeChannel.startsWith('&') ||
      modeChannel.startsWith('+') ||
      modeChannel.startsWith('!'))
  ) {
    ctx.handleChannelModeChange(modeChannel, modeParams);
    ctx.emit('channelMode', modeChannel, modeString, modeParamValues);
    const existing = ctx.getChannelTopicInfo(modeChannel) || {};
    const combinedModes = modeParams.join(' ').trim();
    if (combinedModes) {
      ctx.setChannelTopicInfo(modeChannel, {
        ...existing,
        modes: combinedModes.startsWith('+') ? combinedModes : `+${combinedModes}`,
      });
      ctx.maybeEmitChannelIntro(modeChannel, timestamp);
    }
  }

  const isUserModeChange =
    !modeChannel ||
    (!modeChannel.startsWith('#') &&
      !modeChannel.startsWith('&') &&
      !modeChannel.startsWith('+') &&
      !modeChannel.startsWith('!') &&
      (modeChannel === ctx.getCurrentNick() || !modeChannel));

  const modeNick = ctx.extractNick(prefix);

  if (isUserModeChange && modeChannel === ctx.getCurrentNick()) {
    ctx.updateSelfUserModes(modeString);
  }

  const colorizeMode = (modeStr: string): string => {
    let result = '';
    let adding = true;

    for (let i = 0; i < modeStr.length; i++) {
      const char = modeStr[i];

      if (char === '+') {
        result += '\x0303+\x0F';
        adding = true;
      } else if (char === '-') {
        result += '\x0314-\x0F';
        adding = false;
      } else if (adding) {
        switch (char) {
          case 'o': result += '\x0304o\x0F'; break;
          case 'v': result += '\x0309v\x0F'; break;
          case 'h': result += '\x0308h\x0F'; break;
          case 'q': result += '\x0306q\x0F'; break;
          case 'a': result += '\x0307a\x0F'; break;
          case 'b': result += '\x0304b\x0F'; break;
          case 'e': result += '\x0307e\x0F'; break;
          case 'I': result += '\x0303I\x0F'; break;
          default: result += char;
        }
      } else {
        result += '\x0314' + char + '\x0F';
      }
    }

    return result;
  };

  const colorizedModes = modeParams.map((param, idx) =>
    idx === 0 ? colorizeMode(param) : param
  ).join(' ');

  const modeText = isUserModeChange
    ? t('Mode {channel} {modes}', { channel: modeChannel, modes: colorizedModes })
    : t('{nick} sets mode {modes}', { nick: modeNick || 'Server', modes: colorizedModes });

  ctx.addMessage({
    type: isUserModeChange ? 'raw' : 'mode',
    channel: isUserModeChange ? undefined : modeChannel,
    from: modeNick,
    text: modeText,
    timestamp,
    isRaw: isUserModeChange,
    rawCategory: isUserModeChange ? 'server' : undefined,
    mode: modeParams.join(' ').trim() || undefined,
    target: modeChannel || undefined,
    command: 'MODE',
  });
};

export const topicModeCommandHandlers: CommandHandlerRegistry = new Map([
  ['TOPIC', handleTOPIC],
  ['MODE', handleMODE],
]);

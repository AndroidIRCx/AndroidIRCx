/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * "Minimal / modern" message-format preset.
 *
 * A restrained look with no brackets, bars or separators — it relies on colour
 * and weight instead of decoration. Faint timestamps, bold nicks, sparse
 * glyphs. Designed for calm palettes such as Tokyo Night, Catppuccin or Nord.
 *
 *   12:34  nick  message
 */

import type {
  MessageFormatPart,
  ThemeMessageFormats,
} from '../../services/ThemeService';
import { tx } from '../../i18n/localization';
import type { FormatPalette } from './types';

const t = (k: string): string => tx.t(k);

export const makeMinimalFormats = (p: FormatPalette): ThemeMessageFormats => {
  // Leading faint timestamp token.
  const time: MessageFormatPart = {
    type: 'token',
    value: 'time',
    style: { color: p.timestamp },
  };
  // Two-space gap — the only "separator" this look uses.
  const gap: MessageFormatPart = { type: 'text', value: '  ' };
  // Single-space gap.
  const sp: MessageFormatPart = { type: 'text', value: ' ' };

  // Bold nick coloured p.nick.
  const nick: MessageFormatPart = {
    type: 'token',
    value: 'nick',
    style: { color: p.nick, bold: true },
  };
  // Message body — inherits, or takes p.message when the palette provides it.
  const body: MessageFormatPart = {
    type: 'token',
    value: 'message',
    ...(p.message ? { style: { color: p.message } } : {}),
  };
  // Faint username@hostname detail.
  const host: MessageFormatPart[] = [
    { type: 'token', value: 'username', style: { color: p.muted } },
    { type: 'text', value: '@', style: { color: p.muted } },
    { type: 'token', value: 'hostname', style: { color: p.muted } },
  ];
  // Faint localized word.
  const word = (key: string): MessageFormatPart => ({
    type: 'text',
    value: t(key),
    style: { color: p.muted },
  });

  return {
    message: [time, gap, nick, gap, body],
    messageMention: [
      time,
      gap,
      {
        type: 'token',
        value: 'nick',
        style: { color: p.action, bold: true, underline: true },
      },
      gap,
      body,
    ],
    action: [
      time,
      gap,
      {
        type: 'token',
        value: 'nick',
        style: { color: p.action, bold: true, italic: true },
      },
      sp,
      {
        type: 'token',
        value: 'message',
        style: { color: p.action, italic: true },
      },
    ],
    actionMention: [
      time,
      gap,
      {
        type: 'token',
        value: 'nick',
        style: { color: p.action, bold: true, italic: true, underline: true },
      },
      sp,
      {
        type: 'token',
        value: 'message',
        style: { color: p.action, italic: true },
      },
    ],
    notice: [
      time,
      gap,
      { type: 'token', value: 'nick', style: { color: p.notice, bold: true } },
      gap,
      { type: 'token', value: 'message', style: { color: p.notice } },
    ],
    event: [
      time,
      gap,
      { type: 'token', value: 'message', style: { color: p.event } },
    ],
    join: [
      time,
      gap,
      { type: 'text', value: '→', style: { color: p.join } },
      sp,
      { type: 'token', value: 'nick', style: { color: p.join, bold: true } },
      sp,
      ...host,
      sp,
      word('enters'),
    ],
    part: [
      time,
      gap,
      { type: 'text', value: '←', style: { color: p.part } },
      sp,
      { type: 'token', value: 'nick', style: { color: p.part, bold: true } },
      sp,
      ...host,
      sp,
      word('leaves'),
    ],
    quit: [
      time,
      gap,
      { type: 'text', value: '×', style: { color: p.quit } },
      sp,
      { type: 'token', value: 'nick', style: { color: p.quit, bold: true } },
      sp,
      ...host,
      sp,
      word('closes'),
    ],
    kick: [
      time,
      gap,
      { type: 'text', value: '×', style: { color: p.kick } },
      sp,
      { type: 'token', value: 'target', style: { color: p.kick, bold: true } },
      sp,
      word('kicked_by'),
      sp,
      { type: 'token', value: 'nick', style: { color: p.event } },
      sp,
      { type: 'token', value: 'reason', style: { color: p.muted } },
    ],
    nick: [
      time,
      gap,
      {
        type: 'token',
        value: 'oldnick',
        style: { color: p.nickChange, bold: true },
      },
      sp,
      word('now_known_as'),
      sp,
      {
        type: 'token',
        value: 'newnick',
        style: { color: p.nickChange, bold: true },
      },
    ],
    invite: [
      time,
      gap,
      { type: 'token', value: 'nick', style: { color: p.event, bold: true } },
      sp,
      word('invites_you_to'),
      sp,
      {
        type: 'token',
        value: 'channel',
        style: { color: p.event, bold: true },
      },
    ],
    monitor: [
      time,
      gap,
      { type: 'token', value: 'nick', style: { color: p.event, bold: true } },
      sp,
      word('joined_monitor_list'),
    ],
    mode: [
      time,
      gap,
      { type: 'token', value: 'nick', style: { color: p.event, bold: true } },
      sp,
      word('sets_mode'),
      sp,
      { type: 'token', value: 'mode', style: { color: p.event } },
    ],
    topic: [
      time,
      gap,
      { type: 'token', value: 'nick', style: { color: p.event, bold: true } },
      sp,
      word('sets_topic'),
      { type: 'text', value: ':', style: { color: p.muted } },
      sp,
      { type: 'token', value: 'message', style: { color: p.event } },
    ],
    raw: [
      time,
      gap,
      { type: 'token', value: 'numeric', style: { color: p.muted } },
      sp,
      { type: 'token', value: 'message', style: { color: p.event } },
    ],
    whois: [
      time,
      gap,
      { type: 'token', value: 'nick', style: { color: p.event, bold: true } },
      gap,
      { type: 'token', value: 'message', style: { color: p.muted } },
    ],
    who: [
      time,
      gap,
      { type: 'token', value: 'channel', style: { color: p.muted } },
      sp,
      { type: 'token', value: 'nick', style: { color: p.event, bold: true } },
      sp,
      { type: 'token', value: 'userhost', style: { color: p.muted } },
      sp,
      { type: 'token', value: 'message', style: { color: p.muted } },
    ],
    names: [
      time,
      gap,
      {
        type: 'token',
        value: 'channel',
        style: { color: p.event, bold: true },
      },
      sp,
      { type: 'token', value: 'count', style: { color: p.muted } },
      sp,
      { type: 'token', value: 'names', style: { color: p.event } },
    ],
    error: [
      time,
      gap,
      { type: 'token', value: 'message', style: { color: p.event } },
    ],
    ctcp: [
      time,
      gap,
      { type: 'token', value: 'nick', style: { color: p.event, bold: true } },
      gap,
      { type: 'token', value: 'message', style: { color: p.muted } },
    ],
  };
};

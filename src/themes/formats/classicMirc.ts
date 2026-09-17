/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * "Classic mIRC" message-format preset.
 *
 * The timeless mIRC look: every line opens with a bracketed timestamp and
 * chat lines read `[hh:mm] <nick> message`. It is a pure factory so any theme
 * can adopt the look by passing its own colours.
 */

import { tx } from '../../i18n/localization';
import type {
  MessageFormatPart,
  ThemeMessageFormats,
} from '../../services/ThemeService';
import type { FormatPalette } from './types';

const t = (key: string) => tx.t(key);

/**
 * Build the leading `[hh:mm] ` prefix shared by every template. Brackets use
 * the punctuation colour, the time token uses the timestamp colour.
 */
const timePrefix = (p: FormatPalette): MessageFormatPart[] => [
  { type: 'text', value: '[', style: { color: p.punctuation } },
  { type: 'token', value: 'time', style: { color: p.timestamp } },
  { type: 'text', value: '] ', style: { color: p.punctuation } },
];

export const makeClassicMircFormats = (
  p: FormatPalette,
): ThemeMessageFormats => {
  // Optional explicit body colour; omit entirely to inherit messageText.
  const messageStyle = p.message ? { color: p.message } : undefined;
  const bodyPart: MessageFormatPart = messageStyle
    ? { type: 'token', value: 'message', style: messageStyle }
    : { type: 'token', value: 'message' };

  return {
    message: [
      ...timePrefix(p),
      { type: 'text', value: '<', style: { color: p.punctuation } },
      { type: 'token', value: 'nick', style: { color: p.nick } },
      { type: 'text', value: '> ', style: { color: p.punctuation } },
      bodyPart,
    ],
    messageMention: [
      ...timePrefix(p),
      { type: 'text', value: '<', style: { color: p.punctuation } },
      { type: 'token', value: 'nick', style: { color: p.nick, bold: true } },
      { type: 'text', value: '> ', style: { color: p.punctuation } },
      bodyPart,
    ],
    action: [
      ...timePrefix(p),
      { type: 'text', value: '* ', style: { color: p.action } },
      { type: 'token', value: 'nick', style: { color: p.action } },
      { type: 'text', value: ' ', style: {} },
      { type: 'token', value: 'message', style: { color: p.action } },
    ],
    actionMention: [
      ...timePrefix(p),
      { type: 'text', value: '* ', style: { color: p.action } },
      { type: 'token', value: 'nick', style: { color: p.action, bold: true } },
      { type: 'text', value: ' ', style: {} },
      { type: 'token', value: 'message', style: { color: p.action } },
    ],
    notice: [
      ...timePrefix(p),
      { type: 'text', value: '-', style: { color: p.punctuation } },
      { type: 'token', value: 'nick', style: { color: p.notice } },
      { type: 'text', value: '- ', style: { color: p.punctuation } },
      { type: 'token', value: 'message', style: { color: p.notice } },
    ],
    join: [
      ...timePrefix(p),
      { type: 'text', value: '→ ', style: { color: p.join } },
      { type: 'token', value: 'nick', style: { color: p.join, bold: true } },
      { type: 'text', value: ' (', style: { color: p.punctuation } },
      { type: 'token', value: 'username', style: { color: p.muted } },
      { type: 'text', value: '@', style: { color: p.punctuation } },
      { type: 'token', value: 'hostname', style: { color: p.muted } },
      { type: 'text', value: ') ', style: { color: p.punctuation } },
      { type: 'text', value: t('enters'), style: { color: p.join } },
    ],
    part: [
      ...timePrefix(p),
      { type: 'text', value: '← ', style: { color: p.part } },
      { type: 'token', value: 'nick', style: { color: p.part, bold: true } },
      { type: 'text', value: ' (', style: { color: p.punctuation } },
      { type: 'token', value: 'username', style: { color: p.muted } },
      { type: 'text', value: '@', style: { color: p.punctuation } },
      { type: 'token', value: 'hostname', style: { color: p.muted } },
      { type: 'text', value: ') ', style: { color: p.punctuation } },
      { type: 'text', value: t('leaves'), style: { color: p.part } },
    ],
    quit: [
      ...timePrefix(p),
      { type: 'text', value: '← ', style: { color: p.quit } },
      { type: 'token', value: 'nick', style: { color: p.quit, bold: true } },
      { type: 'text', value: ' (', style: { color: p.punctuation } },
      { type: 'token', value: 'username', style: { color: p.muted } },
      { type: 'text', value: '@', style: { color: p.punctuation } },
      { type: 'token', value: 'hostname', style: { color: p.muted } },
      { type: 'text', value: ') ', style: { color: p.punctuation } },
      { type: 'text', value: t('closes'), style: { color: p.quit } },
    ],
    kick: [
      ...timePrefix(p),
      { type: 'token', value: 'target', style: { color: p.kick, bold: true } },
      { type: 'text', value: ` ${t('kicked_by')} `, style: { color: p.kick } },
      { type: 'token', value: 'nick', style: { color: p.kick } },
      { type: 'text', value: ' (', style: { color: p.punctuation } },
      { type: 'token', value: 'reason', style: { color: p.muted } },
      { type: 'text', value: ')', style: { color: p.punctuation } },
    ],
    nick: [
      ...timePrefix(p),
      {
        type: 'token',
        value: 'oldnick',
        style: { color: p.nickChange, bold: true },
      },
      {
        type: 'text',
        value: ` ${t('now_known_as')} `,
        style: { color: p.nickChange },
      },
      {
        type: 'token',
        value: 'newnick',
        style: { color: p.nickChange, bold: true },
      },
    ],
    mode: [
      ...timePrefix(p),
      { type: 'text', value: '* ', style: { color: p.event } },
      { type: 'token', value: 'nick', style: { color: p.event } },
      { type: 'text', value: ` ${t('sets_mode')} `, style: { color: p.event } },
      { type: 'text', value: '[', style: { color: p.punctuation } },
      { type: 'token', value: 'mode', style: { color: p.event } },
      { type: 'text', value: ']', style: { color: p.punctuation } },
    ],
    topic: [
      ...timePrefix(p),
      { type: 'text', value: '* ', style: { color: p.event } },
      { type: 'token', value: 'nick', style: { color: p.event } },
      {
        type: 'text',
        value: ` ${t('sets_topic')}: `,
        style: { color: p.event },
      },
      { type: 'token', value: 'topic', style: {} },
    ],
    monitor: [
      ...timePrefix(p),
      { type: 'text', value: '* ', style: { color: p.event } },
      { type: 'token', value: 'nick', style: { color: p.event } },
      {
        type: 'text',
        value: ` ${t('joined_monitor_list')}`,
        style: { color: p.event },
      },
    ],
    invite: [
      ...timePrefix(p),
      { type: 'text', value: '* ', style: { color: p.event } },
      { type: 'token', value: 'nick', style: { color: p.event } },
      {
        type: 'text',
        value: ` ${t('invites_you_to')} `,
        style: { color: p.event },
      },
      {
        type: 'token',
        value: 'channel',
        style: { color: p.event, bold: true },
      },
    ],
    event: [
      ...timePrefix(p),
      { type: 'text', value: '* ', style: { color: p.event } },
      { type: 'token', value: 'message', style: { color: p.event } },
    ],
    error: [
      ...timePrefix(p),
      { type: 'text', value: '* ', style: { color: p.event } },
      { type: 'token', value: 'message', style: { color: p.event } },
    ],
    ctcp: [
      ...timePrefix(p),
      { type: 'text', value: '[', style: { color: p.punctuation } },
      { type: 'text', value: 'CTCP', style: { color: p.event } },
      { type: 'text', value: '] ', style: { color: p.punctuation } },
      { type: 'token', value: 'nick', style: { color: p.event } },
      { type: 'text', value: ' ', style: {} },
      { type: 'token', value: 'message', style: { color: p.event } },
    ],
    raw: [
      ...timePrefix(p),
      { type: 'text', value: '*** ', style: { color: p.event } },
      { type: 'token', value: 'numeric', style: { color: p.event } },
      { type: 'text', value: ' ', style: {} },
      { type: 'token', value: 'message', style: { color: p.event } },
    ],
    whois: [
      ...timePrefix(p),
      { type: 'text', value: '[', style: { color: p.punctuation } },
      { type: 'text', value: 'WHOIS', style: { color: p.event } },
      { type: 'text', value: '] ', style: { color: p.punctuation } },
      { type: 'token', value: 'nick', style: { color: p.nick } },
      { type: 'text', value: ' ', style: {} },
      { type: 'token', value: 'message', style: { color: p.event } },
    ],
    who: [
      ...timePrefix(p),
      { type: 'text', value: '[', style: { color: p.punctuation } },
      { type: 'text', value: 'WHO', style: { color: p.event } },
      { type: 'text', value: '] ', style: { color: p.punctuation } },
      { type: 'token', value: 'channel', style: { color: p.event } },
      { type: 'text', value: ' ', style: {} },
      { type: 'token', value: 'nick', style: { color: p.nick } },
      { type: 'text', value: ' ', style: {} },
      { type: 'token', value: 'userhost', style: { color: p.muted } },
      { type: 'text', value: ' ', style: {} },
      { type: 'token', value: 'message', style: { color: p.event } },
    ],
    names: [
      ...timePrefix(p),
      { type: 'text', value: '[', style: { color: p.punctuation } },
      { type: 'text', value: 'NAMES', style: { color: p.event } },
      { type: 'text', value: '] ', style: { color: p.punctuation } },
      { type: 'token', value: 'channel', style: { color: p.event } },
      { type: 'text', value: ' (', style: { color: p.punctuation } },
      { type: 'token', value: 'count', style: { color: p.muted } },
      { type: 'text', value: ') ', style: { color: p.punctuation } },
      { type: 'token', value: 'names', style: {} },
    ],
  };
};

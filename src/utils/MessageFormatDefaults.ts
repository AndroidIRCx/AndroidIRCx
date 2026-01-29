/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { MessageFormatPart, ThemeMessageFormats } from '../services/ThemeService';

export const DEFAULT_MESSAGE_FORMATS: ThemeMessageFormats = {
  message: [
    { type: 'text', value: '[' },
    { type: 'token', value: 'time' },
    { type: 'text', value: '] ' },
    { type: 'token', value: 'nick' },
    { type: 'text', value: ': ' },
    { type: 'token', value: 'message' },
  ],
  messageMention: [
    { type: 'text', value: '[' },
    { type: 'token', value: 'time' },
    { type: 'text', value: '] ' },
    { type: 'token', value: 'nick' },
    { type: 'text', value: ': ' },
    { type: 'token', value: 'message' },
  ],
  action: [
    { type: 'text', value: '[' },
    { type: 'token', value: 'time' },
    { type: 'text', value: '] * ' },
    { type: 'token', value: 'nick' },
    { type: 'text', value: ' ' },
    { type: 'token', value: 'message' },
  ],
  actionMention: [
    { type: 'text', value: '[' },
    { type: 'token', value: 'time' },
    { type: 'text', value: '] * ' },
    { type: 'token', value: 'nick' },
    { type: 'text', value: ' ' },
    { type: 'token', value: 'message' },
  ],
  notice: [
    { type: 'text', value: '[' },
    { type: 'token', value: 'time' },
    { type: 'text', value: '] -' },
    { type: 'token', value: 'nick' },
    { type: 'text', value: '- ' },
    { type: 'token', value: 'message' },
  ],
  event: [
    { type: 'text', value: '[' },
    { type: 'token', value: 'time' },
    { type: 'text', value: '] ' },
    { type: 'token', value: 'message' },
  ],
  join: [
    { type: 'text', value: '[' },
    { type: 'token', value: 'time' },
    { type: 'text', value: '] ' },
    { type: 'token', value: 'message' },
  ],
  part: [
    { type: 'text', value: '[' },
    { type: 'token', value: 'time' },
    { type: 'text', value: '] ' },
    { type: 'token', value: 'message' },
  ],
  quit: [
    { type: 'text', value: '[' },
    { type: 'token', value: 'time' },
    { type: 'text', value: '] ' },
    { type: 'token', value: 'message' },
  ],
  nick: [
    { type: 'text', value: '[' },
    { type: 'token', value: 'time' },
    { type: 'text', value: '] ' },
    { type: 'token', value: 'oldnick' },
    { type: 'text', value: ' -> ' },
    { type: 'token', value: 'newnick' },
  ],
  invite: [
    { type: 'text', value: '[' },
    { type: 'token', value: 'time' },
    { type: 'text', value: '] ' },
    { type: 'token', value: 'message' },
  ],
  monitor: [
    { type: 'text', value: '[' },
    { type: 'token', value: 'time' },
    { type: 'text', value: '] ' },
    { type: 'token', value: 'message' },
  ],
  mode: [
    { type: 'text', value: '[' },
    { type: 'token', value: 'time' },
    { type: 'text', value: '] ' },
    { type: 'token', value: 'message' },
  ],
  topic: [
    { type: 'text', value: '[' },
    { type: 'token', value: 'time' },
    { type: 'text', value: '] ' },
    { type: 'token', value: 'message' },
  ],
  raw: [
    { type: 'text', value: '[' },
    { type: 'token', value: 'time' },
    { type: 'text', value: '] ' },
    { type: 'token', value: 'message' },
  ],
  error: [
    { type: 'text', value: '[' },
    { type: 'token', value: 'time' },
    { type: 'text', value: '] ' },
    { type: 'token', value: 'message' },
  ],
  ctcp: [
    { type: 'text', value: '[' },
    { type: 'token', value: 'time' },
    { type: 'text', value: '] ' },
    { type: 'token', value: 'message' },
  ],
};

export const AVAILABLE_MESSAGE_FORMAT_TOKENS: MessageFormatPart[] = [
  { type: 'token', value: 'time' },
  { type: 'token', value: 'nick' },
  { type: 'token', value: 'oldnick' },
  { type: 'token', value: 'newnick' },
  { type: 'token', value: 'message' },
  { type: 'token', value: 'channel' },
  { type: 'token', value: 'network' },
  { type: 'token', value: 'account' },
  { type: 'token', value: 'username' },
  { type: 'token', value: 'hostname' },
  { type: 'token', value: 'hostmask' },
  { type: 'token', value: 'target' },
  { type: 'token', value: 'mode' },
  { type: 'token', value: 'topic' },
  { type: 'token', value: 'reason' },
  { type: 'token', value: 'numeric' },
  { type: 'token', value: 'command' },
];

export const getDefaultMessageFormats = (): ThemeMessageFormats =>
  JSON.parse(JSON.stringify(DEFAULT_MESSAGE_FORMATS));

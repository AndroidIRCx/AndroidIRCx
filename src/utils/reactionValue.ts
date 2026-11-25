/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { utf8ByteLength } from './ircMessageSplit';

/**
 * client-tags/react.md puts no limit on a reaction's value and suggests that
 * clients set their own, such as a byte limit. One emoji, even a long ZWJ
 * family with skin tones, fits in 32 bytes; a paragraph does not.
 */
export const MAX_REACTION_BYTES = 32;

/** Whether `value` is something we send or show as a reaction. */
export function isValidReaction(value: unknown): value is string {
  if (typeof value !== 'string' || value.trim().length === 0) return false;
  // eslint-disable-next-line no-control-regex -- control characters are what is refused here
  if (/[\u0000-\u001f\u007f]/.test(value)) return false;
  return utf8ByteLength(value) <= MAX_REACTION_BYTES;
}

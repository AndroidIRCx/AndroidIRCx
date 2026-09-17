/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Colour inputs a message-format preset needs to style all 21 line templates.
 * A preset is a pure factory `(palette: FormatPalette) => ThemeMessageFormats`,
 * so any theme can adopt a look by passing its own colours.
 *
 * Only `message` (the body) is optional — when omitted the body inherits the
 * theme's messageText colour, which is usually what you want.
 */
export interface FormatPalette {
  /** Timestamp inside the leading [hh:mm]. */
  timestamp: string;
  /** Brackets, separators, arrows and other structural punctuation. */
  punctuation: string;
  /** The speaking user's nick in normal messages. */
  nick: string;
  /** Optional explicit body colour; omit to inherit messageText. */
  message?: string;
  /** /me action lines. */
  action: string;
  /** NOTICE lines. */
  notice: string;
  /** JOIN lines. */
  join: string;
  /** PART lines. */
  part: string;
  /** QUIT lines. */
  quit: string;
  /** KICK lines. */
  kick: string;
  /** Nick-change lines. */
  nickChange: string;
  /** Generic event lines (mode/topic/monitor/invite/error/ctcp/raw/whois…). */
  event: string;
  /** Secondary/dim detail such as username@hostmask. */
  muted: string;
}

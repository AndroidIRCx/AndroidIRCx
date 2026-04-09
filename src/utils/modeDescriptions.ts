/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Mode Descriptions
 *
 * Descriptions for IRC channel and user modes based on UnrealIRCd standards
 * Reference: https://www.unrealircd.org/docs/Channel_modes
 */

export interface ModeDescription {
  mode: string;
  prefix?: string;
  name: string;
  description: string;
}

/**
 * User mode descriptions (shown in nicklist)
 */
export const USER_MODE_DESCRIPTIONS: Record<string, ModeDescription> = {
  q: {
    mode: 'q',
    prefix: '~',
    name: 'Owner',
    description:
      'Channel owner - highest privilege level, can manage all channel settings',
  },
  a: {
    mode: 'a',
    prefix: '&',
    name: 'Admin',
    description:
      'Channel administrator - can manage channel settings and users',
  },
  o: {
    mode: 'o',
    prefix: '@',
    name: 'Operator',
    description:
      'Channel operator - can kick/ban users and manage channel modes',
  },
  h: {
    mode: 'h',
    prefix: '%',
    name: 'Half-Operator',
    description:
      'Half-operator - can kick users and manage some channel settings',
  },
  v: {
    mode: 'v',
    prefix: '+',
    name: 'Voice',
    description: 'Voiced user - can speak in moderated channels',
  },
};

/**
 * Channel mode descriptions (shown in channel settings)
 */
export const CHANNEL_MODE_DESCRIPTIONS: Record<string, ModeDescription> = {
  p: {
    mode: 'p',
    name: 'Private',
    description: 'Private channel - not shown in channel list (LIST command)',
  },
  s: {
    mode: 's',
    name: 'Secret',
    description: 'Secret channel - not shown in channel list or WHOIS output',
  },
  i: {
    mode: 'i',
    name: 'Invite-Only',
    description:
      'Invite-only - users can only join if invited (+I exception list)',
  },
  t: {
    mode: 't',
    name: 'Topic Protected',
    description:
      'Topic protected - only channel operators can change the topic',
  },
  n: {
    mode: 'n',
    name: 'No External Messages',
    description:
      'No external messages - users outside the channel cannot send messages',
  },
  m: {
    mode: 'm',
    name: 'Moderated',
    description: 'Moderated - only voiced users and operators can speak',
  },
  k: {
    mode: 'k',
    name: 'Channel Key',
    description: 'Channel key (password) - users must provide the key to join',
  },
  l: {
    mode: 'l',
    name: 'User Limit',
    description: 'User limit - maximum number of users allowed in the channel',
  },
  b: {
    mode: 'b',
    name: 'Ban List',
    description: 'Ban list - masks that are banned from joining the channel',
  },
  e: {
    mode: 'e',
    name: 'Exception List',
    description: 'Exception list - masks that override ban list entries',
  },
  I: {
    mode: 'I',
    name: 'Invite Exception',
    description:
      'Invite exception - masks that can join invite-only channels without invitation',
  },
  R: {
    mode: 'R',
    name: 'Registered Only',
    description:
      'Registered only - only registered users (with accounts) can join',
  },
  Q: {
    mode: 'Q',
    name: 'No Kicks',
    description: 'No kicks - prevents users from being kicked from the channel',
  },
  P: {
    mode: 'P',
    name: 'Permanent',
    description: 'Permanent - channel persists even when empty',
  },
  T: {
    mode: 'T',
    name: 'No CTCP',
    description: 'No CTCP - prevents CTCP commands in the channel',
  },
  N: {
    mode: 'N',
    name: 'No Nick Changes',
    description:
      'No nick changes - prevents users from changing their nickname in the channel',
  },
  M: {
    mode: 'M',
    name: 'Registered Only Messages',
    description:
      'Registered only messages - only registered users can send messages',
  },
  S: {
    mode: 'S',
    name: 'SSL Only',
    description: 'SSL only - only SSL/TLS users can join the channel',
  },
  c: {
    mode: 'c',
    name: 'No Colors',
    description: 'No colors - strips color codes from messages',
  },
  C: {
    mode: 'C',
    name: 'No Control Codes',
    description: 'No control codes - strips control codes from messages',
  },
  G: {
    mode: 'G',
    name: 'Censor Bad Words',
    description: 'Censor bad words - censors profanity in messages',
  },
  z: {
    mode: 'z',
    name: 'SSL Only Messages',
    description: 'SSL only messages - only SSL/TLS users can send messages',
  },
};

/**
 * Get user mode description
 */
export function getUserModeDescription(
  mode: string,
): ModeDescription | undefined {
  return USER_MODE_DESCRIPTIONS[mode.toLowerCase()];
}

/**
 * Get channel mode description
 */
export function getChannelModeDescription(
  mode: string,
): ModeDescription | undefined {
  return CHANNEL_MODE_DESCRIPTIONS[mode];
}

/**
 * Get all user mode descriptions in priority order
 */
export function getAllUserModeDescriptions(): ModeDescription[] {
  return ['q', 'a', 'o', 'h', 'v']
    .map(mode => USER_MODE_DESCRIPTIONS[mode])
    .filter(Boolean);
}

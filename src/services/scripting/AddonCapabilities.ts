/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import type { AddonCapability } from './AddonManifest';

export interface AddonCapabilityDefinition {
  title: string;
  risk: 'low' | 'medium' | 'high' | 'critical';
  disclosure: string;
  persistentGrantAllowed: boolean;
}

export const ADDON_CAPABILITY_DEFINITIONS: Readonly<
  Record<AddonCapability, AddonCapabilityDefinition>
> = Object.freeze({
  'irc.read': def(
    'Read IRC activity',
    'medium',
    'Can read live IRC events and identities.',
  ),
  'irc.send': def(
    'Send IRC messages',
    'high',
    'Can send messages and commands as you.',
  ),
  'irc.moderate': def(
    'Moderate channels',
    'critical',
    'Can kick, ban and change channel modes.',
  ),
  'irc.raw.observe': def(
    'Observe raw IRC',
    'high',
    'Can inspect raw protocol traffic, which may contain private data.',
  ),
  'irc.raw.modify': def(
    'Modify raw IRC',
    'critical',
    'Can rewrite the protocol lines this app sends. A mistake here does not ' +
      'show as an error: it shows as a connection that will not stay up. ' +
      'Incoming traffic is never changed, and PING, PONG, CAP, AUTHENTICATE, ' +
      'ERROR and PASS are never handed over.',
    false,
  ),
  'history.read': def(
    'Read message history',
    'high',
    'Can read locally stored conversations.',
  ),
  'tabs.read': def(
    'Read open tabs',
    'low',
    'Can see open channels, queries and their state.',
  ),
  'tabs.write': def(
    'Manage tabs',
    'medium',
    'Can open, close and activate tabs.',
  ),
  'ui.extend': def(
    'Extend the interface',
    'medium',
    'Can add app-managed menus, panels and actions.',
  ),
  'theme.read': def(
    'Read the active theme',
    'low',
    'Can read theme names and semantic colours.',
  ),
  'theme.write': def(
    'Change the theme',
    'medium',
    'Can request a different app theme.',
  ),
  storage: def(
    'Store addon data',
    'low',
    'Can store data only in its own quota-limited namespace.',
  ),
  secrets: def(
    'Store addon secrets',
    'high',
    'Can store protected secrets in its own secure namespace.',
  ),
  network: def(
    'Access the internet',
    'high',
    'Can contact public internet services.',
  ),
  'network.private': def(
    'Access local networks',
    'critical',
    'Can contact devices and services on private networks.',
    false,
  ),
  'files.userSelected': def(
    'Use selected files',
    'high',
    'Can access only files or folders you explicitly select.',
  ),
  notifications: def(
    'Show notifications',
    'medium',
    'Can display system notifications.',
  ),
  'clipboard.write': def(
    'Write to clipboard',
    'medium',
    'Can replace clipboard contents.',
  ),
  ai: def(
    'Use configured AI',
    'high',
    'Can send approved content to your configured AI provider.',
  ),
});

function def(
  title: string,
  risk: AddonCapabilityDefinition['risk'],
  disclosure: string,
  persistentGrantAllowed = true,
): AddonCapabilityDefinition {
  return Object.freeze({ title, risk, disclosure, persistentGrantAllowed });
}

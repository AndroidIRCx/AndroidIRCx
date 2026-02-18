/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * tabUtils.ts
 *
 * Utility functions for tab management:
 * - Tab ID generators
 * - Tab factory functions
 * - Tab sorting and manipulation
 */

import { ChannelTab } from '../types';

/**
 * Generate unique ID for server tab
 */
export const serverTabId = (network: string) => `server::${network}`;

/**
 * Generate unique ID for channel tab
 */
export const channelTabId = (network: string, name: string) => `channel::${network}::${name}`;

/**
 * Generate unique ID for query tab
 */
export const queryTabId = (network: string, name: string) => `query::${network}::${name}`;

/**
 * Generate unique ID for notice tab
 */
export const noticeTabId = (network: string) => `notice::${network}`;

/**
 * Generate unique ID for notifications tab
 */
export const notificationsTabId = (network: string) => `notifications::${network}`;

/**
 * Create a new server tab with default properties
 */
export const makeServerTab = (network: string): ChannelTab => ({
  id: serverTabId(network),
  name: network,
  type: 'server',
  networkId: network,
  messages: [],
});

/**
 * Sort tabs grouped by network, with server tabs first
 * @param tabs - Array of tabs to sort
 * @param sortAlphabetical - Whether to sort channels/queries alphabetically within each network
 * @returns Sorted array of tabs (returns original reference if order unchanged)
 */
export const sortTabsGrouped = (tabs: ChannelTab[], sortAlphabetical: boolean = false): ChannelTab[] => {
  const networks: string[] = [];
  tabs.forEach(t => {
    if (!networks.includes(t.networkId)) {
      networks.push(t.networkId);
    }
  });
  const result: ChannelTab[] = [];
  networks.forEach(net => {
    const server = tabs.find(t => t.networkId === net && t.type === 'server');
    if (server) result.push(server);
    const others = tabs.filter(t => t.networkId === net && t.type !== 'server');
    if (sortAlphabetical) {
      others.sort((a, b) => a.name.localeCompare(b.name));
    }
    others.forEach(t => result.push(t));
  });

  // Check if order actually changed - if not, return same reference to prevent unnecessary re-renders
  if (result.length === tabs.length && result.every((tab, idx) => tab.id === tabs[idx]?.id)) {
    return tabs; // Same order, return original reference
  }

  return result;
};

/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChannelTab } from '../services/IRCService';
import { makeServerTab } from './tabUtils';

/**
 * Get active tab with safe fallback (never create tabs with invalid networkIds)
 */
export function getActiveTabSafe(
  tabs: ChannelTab[],
  activeTabId: string,
  activeConnectionId: string | null,
  primaryNetworkId: string | null,
  networkName: string,
): ChannelTab {
  // First, try to find the active tab by ID
  const byId = tabs.find(tab => tab.id === activeTabId);
  if (byId) return byId;

  // Try to find any server tab
  const serverTab = tabs.find(t => t.type === 'server');
  if (serverTab) return serverTab;

  // Try to get first available tab
  if (tabs[0]) return tabs[0];

  // Last resort: create temporary tab only if we have a valid network
  const validNetworkId =
    activeConnectionId ||
    primaryNetworkId ||
    (networkName !== 'Not connected' && networkName !== ''
      ? networkName
      : null);
  if (validNetworkId) {
    return makeServerTab(validNetworkId);
  }

  // Ultimate fallback: return a minimal safe tab (won't be saved)
  return {
    id: 'temp',
    name: 'IRC',
    type: 'server' as const,
    networkId: '',
    messages: [],
  };
}

/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useCallback } from 'react';
import type { IRCMessage } from '../services/IRCService';
import { ircService } from '../services/IRCService';
import { settingsService } from '../services/SettingsService';
import { connectionManager } from '../services/ConnectionManager';
import { userManagementService } from '../services/UserManagementService';
import { commandService } from '../services/CommandService';
import { connectionQualityService } from '../services/ConnectionQualityService';
import { channelManagementService } from '../services/ChannelManagementService';
import { useTabStore } from '../stores/tabStore';
import type { ChannelTab } from '../types';
import { serverTabId, sortTabsGrouped } from '../utils/tabUtils';

interface UseServiceHelpersParams {
  setTabs: (updater: ChannelTab[] | ((prev: ChannelTab[]) => ChannelTab[])) => void;
  tabSortAlphabetical: boolean;
}

export const useServiceHelpers = (params: UseServiceHelpersParams) => {
  const { setTabs, tabSortAlphabetical } = params;

  const appendServerMessage = useCallback((networkId: string, text: string) => {
    // Never create or update tabs for invalid network IDs
    if (!networkId || networkId === 'Not connected') {
      console.warn('?? Prevented server message for invalid networkId:', networkId);
      return;
    }

    const serverId = serverTabId(networkId);
    const now = Date.now();
    const msg: IRCMessage = {
      id: `srv-${now}-${Math.random()}`,
      type: 'raw',
      text,
      timestamp: now,
      isRaw: true,
      network: networkId,
      rawCategory: 'connection',
    };

    const currentTabs = useTabStore.getState().tabs;
    const existingServer = currentTabs.find(t => t.id === serverId);
    if (existingServer) {
      const updated = currentTabs.map(t => t.id === serverId ? { ...t, messages: [...t.messages, msg] } : t);
      setTabs(sortTabsGrouped(updated, tabSortAlphabetical));
    }
  }, [setTabs, tabSortAlphabetical]);

  // Helper functions to get active services (either from ConnectionManager or singleton)
  const getActiveIRCService = useCallback(() => {
    const activeConnection = connectionManager.getActiveConnection();
    return activeConnection ? activeConnection.ircService : ircService;
  }, []);

  const getActiveUserManagementService = useCallback(() => {
    const activeConnection = connectionManager.getActiveConnection();
    return activeConnection ? activeConnection.userManagementService : userManagementService;
  }, []);

  const getActiveCommandService = useCallback(() => {
    const activeConnection = connectionManager.getActiveConnection();
    return activeConnection ? activeConnection.commandService : commandService;
  }, []);

  const getActiveConnectionQualityService = useCallback(() => {
    const activeConnection = connectionManager.getActiveConnection();
    return activeConnection ? activeConnection.connectionQualityService : connectionQualityService;
  }, []);

  const getActiveChannelManagementService = useCallback(() => {
    const activeConnection = connectionManager.getActiveConnection();
    return activeConnection ? activeConnection.channelManagementService : channelManagementService;
  }, []);

  const normalizeNetworkId = useCallback((id: string) => id.replace(/\s+\(\d+\)$/, ''), []);

  const getNetworkConfigForId = useCallback(async (networkId: string) => {
    if (!networkId) return null;
    const networks = await settingsService.loadNetworks();
    const normalized = normalizeNetworkId(networkId);
    return (
      networks.find(n => n.name === networkId || n.id === networkId) ||
      networks.find(n => n.name === normalized || n.id === normalized) ||
      null
    );
  }, [normalizeNetworkId]);

  return {
    appendServerMessage,
    getActiveIRCService,
    getActiveUserManagementService,
    getActiveCommandService,
    getActiveConnectionQualityService,
    getActiveChannelManagementService,
    normalizeNetworkId,
    getNetworkConfigForId,
  };
};

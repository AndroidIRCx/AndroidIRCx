/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChannelTab } from '../types';
import { storageCache } from './StorageCache';

const TABS_STORAGE_KEY_PREFIX = 'TABS_';

class TabService {
  public async getTabs(network: string): Promise<ChannelTab[]> {
    // Never load or create tabs for "Not connected" network
    if (network === 'Not connected') {
      console.log('⚠️ Prevented loading tabs for "Not connected" network');
      return [];
    }

    try {
      const key = `${TABS_STORAGE_KEY_PREFIX}${network}`;
      // Use StorageCache for in-memory caching and faster access
      const storedTabs = await storageCache.getItem<Omit<ChannelTab, 'messages'>[]>(key, {
        ttl: 10 * 60 * 1000, // Cache for 10 minutes
      });

      if (storedTabs) {
        // Ensure messages are not loaded, only tab structure
        // Filter out any "Not connected" tabs
        return storedTabs
          .filter(tab => tab.name !== 'Not connected' && tab.networkId !== 'Not connected')
          .map(tab => ({
            ...tab,
            networkId: tab.networkId || network,
            id: tab.id.includes('::') ? tab.id : (tab.type === 'server' ? `server::${network}` : tab.id),
            messages: [], // Messages loaded separately via MessageHistoryService
          }));
      }
    } catch (error) {
      console.error('Failed to load tabs from storage:', error);
    }
    // Return default server tab if nothing is stored
    const serverId = `server::${network}`;
    return [{ id: serverId, name: network, type: 'server', networkId: network, messages: [] }];
  }

  public async saveTabs(network: string, tabs: ChannelTab[]): Promise<void> {
    // Never save tabs for "Not connected" network
    if (network === 'Not connected') {
      console.log('⚠️ Prevented saving tabs for "Not connected" network');
      return;
    }

    try {
      const key = `${TABS_STORAGE_KEY_PREFIX}${network}`;
      // Do not save messages, only the tab structure
      // Filter out any "Not connected" tabs before saving
      const tabsToSave = tabs
        .filter(tab => tab.name !== 'Not connected' && tab.networkId !== 'Not connected')
        .map(({ messages: _messages, ...rest }) => rest);

      // Use StorageCache for automatic write batching (2s debounce)
      await storageCache.setItem(key, tabsToSave);
    } catch (error) {
      console.error('Failed to save tabs to storage:', error);
    }
  }

  public async removeTab(network: string, tabId: string): Promise<void> {
    try {
      const currentTabs = await this.getTabs(network);
      const updatedTabs = currentTabs.filter(tab => tab.id !== tabId);
      await this.saveTabs(network, updatedTabs);
    } catch (error) {
      console.error('Failed to remove tab from storage:', error);
    }
  }
}

export const tabService = new TabService();

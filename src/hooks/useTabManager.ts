/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * useTabManager.ts
 *
 * Custom hook that encapsulates tab management logic.
 * Integrates with tabStore and handles tab operations.
 */

import { useCallback, useEffect } from 'react';
import { useTabStore } from '../stores/tabStore';
import { ChannelTab } from '../types';
import { IRCMessage } from '../services/IRCService';
import { messageBatcher } from '../utils/MessageBatcher';
import { performanceService } from '../services/PerformanceService';

export function useTabManager() {
  // IMPORTANT: Only subscribe to state values, not actions
  // This prevents infinite re-render loops
  const tabs = useTabStore(state => state.tabs);
  const activeTabId = useTabStore(state => state.activeTabId);

  // Get actions without subscribing (they're stable references)
  const setTabs = useCallback((tabs: ChannelTab[]) => {
    useTabStore.getState().setTabs(tabs);
  }, []);

  const setActiveTabId = useCallback((id: string) => {
    useTabStore.getState().setActiveTabId(id);
  }, []);

  const addTab = useCallback((tab: ChannelTab) => {
    useTabStore.getState().addTab(tab);
  }, []);

  const removeTab = useCallback((tabId: string) => {
    useTabStore.getState().removeTab(tabId);
  }, []);

  const updateTab = useCallback((tabId: string, updates: Partial<ChannelTab>) => {
    useTabStore.getState().updateTab(tabId, updates);
  }, []);

  const addMessageToTab = useCallback((tabId: string, message: any) => {
    useTabStore.getState().addMessageToTab(tabId, message);
  }, []);

  const setTabActivity = useCallback((tabId: string, hasActivity: boolean) => {
    useTabStore.getState().setTabActivity(tabId, hasActivity);
  }, []);

  const clearTabMessages = useCallback((tabId: string) => {
    useTabStore.getState().clearTabMessages(tabId);
  }, []);

  const addTabs = useCallback((tabs: ChannelTab[]) => {
    useTabStore.getState().addTabs(tabs);
  }, []);

  const removeTabs = useCallback((tabIds: string[]) => {
    useTabStore.getState().removeTabs(tabIds);
  }, []);

  const updateTabs = useCallback((updates: Array<{ tabId: string; updates: Partial<ChannelTab> }>) => {
    useTabStore.getState().updateTabs(updates);
  }, []);

  const getTabById = useCallback((tabId: string) => {
    return useTabStore.getState().getTabById(tabId);
  }, []);

  const getTabsByNetwork = useCallback((networkId: string) => {
    return useTabStore.getState().getTabsByNetwork(networkId);
  }, []);

  const getActiveTab = useCallback(() => {
    return useTabStore.getState().getActiveTab();
  }, []);

  const hasTab = useCallback((tabId: string) => {
    return useTabStore.getState().hasTab(tabId);
  }, []);

  const saveTabsToStorage = useCallback(async (networkId: string) => {
    await useTabStore.getState().saveTabsToStorage(networkId);
  }, []);

  const loadTabsFromStorage = useCallback(async (networkId: string) => {
    await useTabStore.getState().loadTabsFromStorage(networkId);
  }, []);

  /**
   * Create or switch to a tab
   */
  const openTab = useCallback(
    (tab: ChannelTab, switchToTab: boolean = true) => {
      if (!hasTab(tab.id)) {
        addTab(tab);
      }

      if (switchToTab) {
        setActiveTabId(tab.id);
        // Clear activity when switching to tab
        setTabActivity(tab.id, false);
      }

      return tab.id;
    },
    [hasTab, addTab, setActiveTabId, setTabActivity]
  );

  /**
   * Close a tab
   */
  const closeTab = useCallback(
    (tabId: string) => {
      const tab = getTabById(tabId);
      if (!tab) return;

      removeTab(tabId);

      // If closing active tab, switch to another
      if (tabId === activeTabId) {
        const remainingTabs = tabs.filter(t => t.id !== tabId);

        if (remainingTabs.length > 0) {
          // Switch to server tab of same network, or first tab
          const serverTab = remainingTabs.find(
            t => t.networkId === tab.networkId && t.type === 'server'
          );
          const nextTab = serverTab || remainingTabs[0];
          setActiveTabId(nextTab.id);
        } else {
          setActiveTabId('');
        }
      }
    },
    [tabs, activeTabId, getTabById, removeTab, setActiveTabId]
  );

  /**
   * Close all tabs for a network
   */
  const closeNetworkTabs = useCallback(
    (networkId: string, excludeServer: boolean = false) => {
      const networkTabs = getTabsByNetwork(networkId);
      const tabsToClose = excludeServer
        ? networkTabs.filter(t => t.type !== 'server')
        : networkTabs;

      const idsToClose = tabsToClose.map(t => t.id);
      removeTabs(idsToClose);

      // Switch to different tab if active tab was closed
      if (idsToClose.includes(activeTabId)) {
        const remainingTabs = tabs.filter(t => !idsToClose.includes(t.id));
        if (remainingTabs.length > 0) {
          setActiveTabId(remainingTabs[0].id);
        } else {
          setActiveTabId('');
        }
      }
    },
    [tabs, activeTabId, getTabsByNetwork, removeTabs, setActiveTabId]
  );

  /**
   * Add a message to a tab (batched)
   */
  const addMessage = useCallback(
    (tabId: string, message: IRCMessage) => {
      // Use message batcher for performance
      messageBatcher.addMessage(tabId, message);
    },
    []
  );

  /**
   * Add messages in bulk to a tab
   */
  const addMessages = useCallback(
    (tabId: string, messages: IRCMessage[]) => {
      messageBatcher.addMessages(tabId, messages);
    },
    []
  );

  /**
   * Switch to a tab by ID
   */
  const switchToTab = useCallback(
    (tabId: string) => {
      if (hasTab(tabId)) {
        setActiveTabId(tabId);
        setTabActivity(tabId, false);
      }
    },
    [hasTab, setActiveTabId, setTabActivity]
  );

  /**
   * Mark tab as having new activity
   */
  const markTabActivity = useCallback(
    (tabId: string) => {
      // Only mark activity if not the active tab
      if (tabId !== activeTabId) {
        setTabActivity(tabId, true);
      }
    },
    [activeTabId, setTabActivity]
  );

  /**
   * Update tab encryption status
   */
  const setTabEncryption = useCallback(
    (tabId: string, isEncrypted: boolean) => {
      updateTab(tabId, { isEncrypted });
    },
    [updateTab]
  );

  /**
   * Load tabs from storage for a network
   */
  const loadTabs = useCallback(
    async (networkId: string) => {
      await loadTabsFromStorage(networkId);
    },
    [loadTabsFromStorage]
  );

  /**
   * Save tabs to storage for a network (debounced)
   */
  const saveTabs = useCallback(
    async (networkId: string) => {
      await saveTabsToStorage(networkId);
    },
    [saveTabsToStorage]
  );

  /**
   * Get server tab for a network
   */
  const getServerTab = useCallback(
    (networkId: string) => {
      return tabs.find(t => t.networkId === networkId && t.type === 'server');
    },
    [tabs]
  );

  /**
   * Create server tab for a network
   */
  const createServerTab = useCallback(
    (networkId: string) => {
      const serverTab: ChannelTab = {
        id: `server::${networkId}`,
        name: networkId,
        type: 'server',
        networkId,
        messages: [],
      };

      addTab(serverTab);
      return serverTab;
    },
    [addTab]
  );

  /**
   * Ensure server tab exists for network
   */
  const ensureServerTab = useCallback(
    (networkId: string) => {
      const existing = getServerTab(networkId);
      return existing || createServerTab(networkId);
    },
    [getServerTab, createServerTab]
  );

  /**
   * Setup message batcher callback
   */
  useEffect(() => {
    messageBatcher.setFlushCallback((updates) => {
      const tabUpdates: Array<{ tabId: string; updates: Partial<ChannelTab> }> = [];
      const store = useTabStore.getState();
      const currentActiveTabId = store.activeTabId;

      updates.forEach((messages, tabId) => {
        const tab = store.getTabById(tabId);
        if (tab) {
          const newMessages = [...(tab.messages || []), ...messages];

          // Use performance config for message limit instead of hardcoded 200
          // This respects user settings for message history
          const perfConfig = performanceService.getConfig();
          const messagesFinal =
            perfConfig.enableMessageCleanup && newMessages.length > perfConfig.cleanupThreshold
              ? newMessages.slice(-perfConfig.messageLimit)
              : newMessages;

          tabUpdates.push({
            tabId,
            updates: { messages: messagesFinal },
          });

          // Mark activity if not active tab
          if (tabId !== currentActiveTabId) {
            tabUpdates.push({
              tabId,
              updates: { hasActivity: true },
            });
          }
        }
      });

      if (tabUpdates.length > 0) {
        store.updateTabs(tabUpdates);
      }
    });

    return () => {
      messageBatcher.flush();
    };
  }, []); // Empty dependencies - use store directly to avoid re-running

  // Compute active tab safely - use direct computation instead of calling getActiveTab()
  // which internally uses get() and doesn't work correctly inside a Zustand selector
  const activeTab = useTabStore(state => state.tabs.find(t => t.id === state.activeTabId));

  return {
    // State
    tabs,
    activeTabId,
    activeTab,

    // Actions
    openTab,
    closeTab,
    closeNetworkTabs,
    switchToTab,
    addMessage,
    addMessages,
    markTabActivity,
    setTabEncryption,
    clearTabMessages,

    // Network operations
    loadTabs,
    saveTabs,
    getServerTab,
    createServerTab,
    ensureServerTab,

    // Queries
    getTabById,
    getTabsByNetwork,
    hasTab,
  };
}

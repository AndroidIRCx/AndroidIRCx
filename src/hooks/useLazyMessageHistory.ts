/**
 * useLazyMessageHistory.ts
 *
 * Hook that lazy-loads message history when tabs are switched.
 * Only loads history for the active tab, not all tabs at once.
 * This improves app startup time significantly.
 */

import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus, InteractionManager } from 'react-native';
import { messageHistoryService } from '../services/MessageHistoryService';
import { useTabStore } from '../stores/tabStore';
import { ChannelTab } from '../types';

interface UseLazyMessageHistoryParams {
  activeTabId: string | null;
}

/**
 * Hook that lazy-loads message history for tabs when they become active.
 * Only loads history if the tab doesn't already have messages loaded.
 * Also reloads active tab history when app returns from background.
 */
export function useLazyMessageHistory(params: UseLazyMessageHistoryParams) {
  const { activeTabId } = params;
  const loadedTabsRef = useRef<Set<string>>(new Set());
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  // Use ref to track activeTabId to avoid stale closures in async callbacks
  const activeTabIdRef = useRef<string | null>(activeTabId);
  
  // Keep ref in sync with prop
  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

  // Force reload history for a specific tab (used when app returns from background)
  const forceReloadHistory = useCallback(async (tabId: string) => {
    const tabStore = useTabStore.getState();
    // Get fresh tabs state each time to avoid stale data
    let currentTabs = tabStore.tabs;
    const tab = currentTabs.find(t => t.id === tabId);

    if (!tab) {
      console.log(`useLazyMessageHistory: Tab ${tabId} not found, skipping reload`);
      return;
    }

    // Skip if network is invalid
    if (!tab.networkId || tab.networkId === 'Not connected') {
      console.log(`useLazyMessageHistory: Tab ${tabId} has invalid networkId, skipping reload`);
      return;
    }

    // CRITICAL FIX: Only reload if tab has no messages
    // If tab already has messages, don't overwrite them
    const hasMessages = tab.messages && tab.messages.length > 0;
    if (hasMessages) {
      console.log(`useLazyMessageHistory: Tab ${tabId} already has ${tab.messages.length} messages, skipping force reload`);
      return;
    }

    try {
      // Determine channel key for history lookup
      const channelKey = tab.type === 'server' ? 'server' : tab.name;

      // Load message history for this tab
      console.log(`useLazyMessageHistory: Force reloading history for tab ${tabId} (${tab.networkId}/${channelKey})`);
      const history = await messageHistoryService.loadMessages(
        tab.networkId,
        channelKey
      );

      // Get fresh tabs state again before updating (in case tabs changed during async operation)
      currentTabs = tabStore.tabs;
      const updatedTab = currentTabs.find(t => t.id === tabId);
      
      // Only update if tab still exists and doesn't already have messages
      if (updatedTab) {
        // Double-check that tab still has no messages before overwriting
        const stillHasNoMessages = !updatedTab.messages || updatedTab.messages.length === 0;
        if (stillHasNoMessages) {
          // Update tab with loaded history
          tabStore.setTabs(
            currentTabs.map(t =>
              t.id === tabId
                ? { ...t, messages: history }
                : t
            )
          );

          console.log(`useLazyMessageHistory: Reloaded ${history.length} messages for tab ${tabId}`);
        } else {
          console.log(`useLazyMessageHistory: Tab ${tabId} now has ${updatedTab.messages.length} messages, skipping overwrite`);
        }
      } else {
        console.log(`useLazyMessageHistory: Tab ${tabId} no longer exists, skipping update`);
      }
    } catch (error) {
      console.error(`Error force reloading message history for tab ${tabId}:`, error);
    }
  }, []);

  // Monitor app state changes to reload history when returning from background
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
      const wasBackground = appStateRef.current.match(/inactive|background/);
      const isActive = nextAppState === 'active';

      // When app comes to foreground, reload active tab's history
      if (wasBackground && isActive) {
        // Get fresh activeTabId from ref to avoid stale closure
        const currentActiveTabId = activeTabIdRef.current;
        if (!currentActiveTabId) {
          return;
        }
        
        console.log('useLazyMessageHistory: App returned from background, scheduling history reload');

        // CRITICAL FIX: Use InteractionManager to defer heavy operations
        // This prevents the lock screen from freezing due to blocking the main thread
        // The reload will happen after all interactions (like modal animations) complete
        InteractionManager.runAfterInteractions(() => {
          // Get fresh activeTabId again in case it changed during interactions
          const freshActiveTabId = activeTabIdRef.current;
          if (!freshActiveTabId) {
            console.log('useLazyMessageHistory: No active tab when interactions completed, skipping reload');
            return;
          }
          
          console.log('useLazyMessageHistory: Interactions complete, reloading active tab history');
          // CRITICAL FIX: Always clear the loaded flag for active tab to force reload
          // This ensures that even if tab was marked as loaded before going to background,
          // it will be reloaded when returning from background
          loadedTabsRef.current.delete(freshActiveTabId);
          
          // Get fresh tab state to check current message count
          const tabStore = useTabStore.getState();
          const currentTabs = tabStore.tabs;
          const activeTab = currentTabs.find(t => t.id === freshActiveTabId);
          
          // Only force reload if tab has no messages
          // If tab already has messages, don't reload (they might be newer than storage)
          const hasMessages = activeTab?.messages && activeTab.messages.length > 0;
          if (!hasMessages) {
            console.log(`useLazyMessageHistory: Active tab ${freshActiveTabId} has no messages, force reloading`);
            forceReloadHistory(freshActiveTabId).catch(err => {
              console.error('useLazyMessageHistory: Error reloading history after interactions:', err);
            });
          } else {
            console.log(`useLazyMessageHistory: Active tab ${freshActiveTabId} already has ${activeTab.messages.length} messages, skipping reload`);
            // Mark as loaded since it already has messages
            loadedTabsRef.current.add(freshActiveTabId);
          }
        });
      }

      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [activeTabId, forceReloadHistory]);

  useEffect(() => {
    if (!activeTabId) {
      return;
    }

    const loadHistoryForTab = async () => {
      const tabStore = useTabStore.getState();
      const currentTabs = tabStore.tabs;
      const activeTab = currentTabs.find(t => t.id === activeTabId);

      if (!activeTab) {
        return;
      }

      // Skip if network is invalid
      if (!activeTab.networkId || activeTab.networkId === 'Not connected') {
        return;
      }

      // CRITICAL FIX: Check if tab actually has messages before skipping
      // If tab is marked as loaded but has no messages, reload it
      // This handles the case where tabs were reloaded from storage with empty messages
      const isMarkedAsLoaded = loadedTabsRef.current.has(activeTabId);
      const hasMessages = activeTab.messages && activeTab.messages.length > 0;

      // Skip only if marked as loaded AND actually has messages
      if (isMarkedAsLoaded && hasMessages) {
        return;
      }

      // If marked as loaded but has no messages, clear the flag to force reload
      if (isMarkedAsLoaded && !hasMessages) {
        console.log(`useLazyMessageHistory: Tab ${activeTabId} marked as loaded but has no messages, forcing reload`);
        loadedTabsRef.current.delete(activeTabId);
      }

      try {
        // Determine channel key for history lookup
        const channelKey = activeTab.type === 'server' ? 'server' : activeTab.name;

        // Load message history for this tab
        console.log(`useLazyMessageHistory: Loading history for tab ${activeTabId} (${activeTab.networkId}/${channelKey})`);
        const history = await messageHistoryService.loadMessages(
          activeTab.networkId,
          channelKey
        );

        // Get fresh tabs state again before updating (in case tabs changed during async operation)
        const freshTabs = tabStore.tabs;
        const updatedTab = freshTabs.find(t => t.id === activeTabId);
        
        // Only update if tab still exists
        if (updatedTab) {
          // CRITICAL FIX: Only update if tab has no messages
          // Never overwrite existing messages - they might be newer than what's in storage
          const hasMessages = updatedTab.messages && updatedTab.messages.length > 0;
          if (!hasMessages) {
            // Update tab with loaded history only if it has no messages
            tabStore.setTabs(
              freshTabs.map(t =>
                t.id === activeTabId
                  ? { ...t, messages: history }
                  : t
              )
            );

            // Mark as loaded only if we actually loaded messages
            if (history.length > 0) {
              loadedTabsRef.current.add(activeTabId);
              console.log(`useLazyMessageHistory: Loaded ${history.length} messages for tab ${activeTabId}`);
            } else {
              console.log(`useLazyMessageHistory: No messages found for tab ${activeTabId}, not marking as loaded`);
            }
          } else {
            // Tab already has messages, mark as loaded without overwriting
            loadedTabsRef.current.add(activeTabId);
            console.log(`useLazyMessageHistory: Tab ${activeTabId} already has ${updatedTab.messages.length} messages, not overwriting`);
          }
        } else {
          console.log(`useLazyMessageHistory: Tab ${activeTabId} no longer exists, skipping update`);
        }
      } catch (error) {
        console.error(`Error loading message history for tab ${activeTabId}:`, error);
      }
    };

    loadHistoryForTab();
  }, [activeTabId, forceReloadHistory]);

  // Clear loaded cache when tabs change (e.g., on network switch)
  // Subscribe to tabs to detect when they change
  const tabs = useTabStore(state => state.tabs);
  useEffect(() => {
    const currentTabIds = new Set(tabs.map(t => t.id));

    // Remove entries for tabs that no longer exist
    loadedTabsRef.current.forEach(tabId => {
      if (!currentTabIds.has(tabId)) {
        loadedTabsRef.current.delete(tabId);
      }
    });
  }, [tabs.length]); // Only re-run when tab count changes
}

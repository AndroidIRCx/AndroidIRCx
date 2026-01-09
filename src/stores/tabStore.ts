/**
 * tabStore.ts
 *
 * Zustand store for tab state management.
 * Replaces tab-related useState calls from App.tsx
 */

import { create } from 'zustand';
import { ChannelTab } from '../types';
import { tabService } from '../services/TabService';
import { tabUpdateBatcher } from '../utils/TabUpdateBatcher';

export interface TabState {
  // Tab data
  tabs: ChannelTab[];
  activeTabId: string;

  // Actions
  setTabs: (tabs: ChannelTab[]) => void;
  setActiveTabId: (id: string) => void;
  addTab: (tab: ChannelTab) => void;
  removeTab: (tabId: string) => void;
  updateTab: (tabId: string, updates: Partial<ChannelTab>) => void;
  addMessageToTab: (tabId: string, message: any) => void;
  setTabActivity: (tabId: string, hasActivity: boolean) => void;
  clearTabMessages: (tabId: string) => void;

  // Bulk operations
  addTabs: (tabs: ChannelTab[]) => void;
  removeTabs: (tabIds: string[]) => void;
  updateTabs: (updates: Array<{ tabId: string; updates: Partial<ChannelTab> }>) => void;

  // Selectors
  getTabById: (tabId: string) => ChannelTab | undefined;
  getTabsByNetwork: (networkId: string) => ChannelTab[];
  getActiveTab: () => ChannelTab | undefined;
  getTabCount: () => number;
  hasTab: (tabId: string) => boolean;

  // Persistence
  saveTabsToStorage: (networkId: string) => Promise<void>;
  loadTabsFromStorage: (networkId: string) => Promise<void>;

  // Reset
  reset: () => void;
}

export const useTabStore = create<TabState>((set, get) => ({
  // Initial state
  tabs: [],
  activeTabId: '',

  // Actions
  setTabs: (tabs) => set({ tabs }),

  setActiveTabId: (id) => set({ activeTabId: id }),

  addTab: (tab) =>
    set((state) => {
      // Check if tab already exists
      if (state.tabs.some((t) => t.id === tab.id)) {
        return state; // No change
      }
      return { tabs: [...state.tabs, tab] };
    }),

  removeTab: (tabId) =>
    set((state) => ({
      tabs: state.tabs.filter((t) => t.id !== tabId),
    })),

  updateTab: (tabId, updates) =>
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === tabId ? { ...tab, ...updates } : tab
      ),
    })),

  addMessageToTab: (tabId, message) =>
    set((state) => ({
      tabs: state.tabs.map((tab) => {
        if (tab.id === tabId) {
          return {
            ...tab,
            messages: [...(tab.messages || []), message],
          };
        }
        return tab;
      }),
    })),

  setTabActivity: (tabId, hasActivity) =>
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === tabId ? { ...tab, hasActivity } : tab
      ),
    })),

  clearTabMessages: (tabId) =>
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === tabId ? { ...tab, messages: [] } : tab
      ),
    })),

  // Bulk operations
  addTabs: (newTabs) =>
    set((state) => {
      const existingIds = new Set(state.tabs.map((t) => t.id));
      const tabsToAdd = newTabs.filter((t) => !existingIds.has(t.id));
      return { tabs: [...state.tabs, ...tabsToAdd] };
    }),

  removeTabs: (tabIds) =>
    set((state) => {
      const idsToRemove = new Set(tabIds);
      return {
        tabs: state.tabs.filter((t) => !idsToRemove.has(t.id)),
      };
    }),

  updateTabs: (updates) =>
    set((state) => {
      const updateMap = new Map(updates.map((u) => [u.tabId, u.updates]));
      return {
        tabs: state.tabs.map((tab) => {
          const update = updateMap.get(tab.id);
          return update ? { ...tab, ...update } : tab;
        }),
      };
    }),

  // Selectors
  getTabById: (tabId) => {
    return get().tabs.find((t) => t.id === tabId);
  },

  getTabsByNetwork: (networkId) => {
    return get().tabs.filter((t) => t.networkId === networkId);
  },

  getActiveTab: () => {
    const { tabs, activeTabId } = get();
    return tabs.find((t) => t.id === activeTabId);
  },

  getTabCount: () => get().tabs.length,

  hasTab: (tabId) => get().tabs.some((t) => t.id === tabId),

  // Persistence
  saveTabsToStorage: async (networkId) => {
    const { tabs } = get();
    const networkTabs = tabs.filter((t) => t.networkId === networkId);

    // Use batcher for debounced saves
    tabUpdateBatcher.queueSave(networkId, networkTabs);
  },

  loadTabsFromStorage: async (networkId) => {
    try {
      const loadedTabs = await tabService.getTabs(networkId);
      set((state) => {
        // Remove existing tabs for this network
        const otherTabs = state.tabs.filter((t) => t.networkId !== networkId);
        // CRITICAL FIX: Preserve messages from existing tabs when merging
        // Map loaded tabs and merge with existing tabs if they have messages
        const existingTabsMap = new Map(state.tabs.map(t => [t.id, t]));
        const mergedTabs = loadedTabs.map(loadedTab => {
          const existingTab = existingTabsMap.get(loadedTab.id);
          // If existing tab has messages, preserve them
          if (existingTab && existingTab.messages && existingTab.messages.length > 0) {
            return { ...loadedTab, messages: existingTab.messages };
          }
          // Otherwise use loaded tab (which has empty messages array)
          return loadedTab;
        });
        return { tabs: [...otherTabs, ...mergedTabs] };
      });
    } catch (error) {
      console.error(`Failed to load tabs for network ${networkId}:`, error);
    }
  },

  // Reset
  reset: () => set({ tabs: [], activeTabId: '' }),
}));

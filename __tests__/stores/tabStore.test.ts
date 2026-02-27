/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * tabStore.test.ts
 *
 * Tests for tabStore - tab state management
 */

import { act } from '@testing-library/react-native';
import { useTabStore } from '../../src/stores/tabStore';
import { ChannelTab } from '../../src/types';

// Mock AsyncStorage
const mockStorage: Map<string, string> = new Map();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    setItem: jest.fn(async (key: string, value: string) => {
      mockStorage.set(key, value);
    }),
    getItem: jest.fn(async (key: string) => {
      return mockStorage.get(key) || null;
    }),
    removeItem: jest.fn(async (key: string) => {
      mockStorage.delete(key);
    }),
  },
}));

// Mock TabService - use inline mock to avoid reference issues
const mockGetTabs = jest.fn().mockResolvedValue([]);
const mockSaveTabs = jest.fn().mockResolvedValue(undefined);

jest.mock('../../src/services/TabService', () => ({
  tabService: {
    getTabs: (...args: any[]) => mockGetTabs(...args),
    saveTabs: (...args: any[]) => mockSaveTabs(...args),
  },
}));

// Mock TabUpdateBatcher
const mockQueueSave = jest.fn();

jest.mock('../../src/utils/TabUpdateBatcher', () => ({
  tabUpdateBatcher: {
    queueSave: (...args: any[]) => mockQueueSave(...args),
  },
}));

describe('tabStore', () => {
  beforeEach(() => {
    mockStorage.clear();
    mockGetTabs.mockResolvedValue([]);
    act(() => {
      useTabStore.getState().reset();
    });
    jest.clearAllMocks();
  });

  const createMockTab = (id: string, networkId: string = 'net1', overrides: Partial<ChannelTab> = {}): ChannelTab => ({
    id,
    networkId,
    channel: `#channel-${id}`,
    label: `Channel ${id}`,
    messages: [],
    hasActivity: false,
    ...overrides,
  });

  describe('initial state', () => {
    it('should have empty tabs array initially', () => {
      expect(useTabStore.getState().tabs).toEqual([]);
    });

    it('should have empty activeTabId initially', () => {
      expect(useTabStore.getState().activeTabId).toBe('');
    });
  });

  describe('setTabs', () => {
    it('should set tabs array', () => {
      const tabs = [createMockTab('tab1'), createMockTab('tab2')];
      
      act(() => {
        useTabStore.getState().setTabs(tabs);
      });

      expect(useTabStore.getState().tabs).toHaveLength(2);
      expect(useTabStore.getState().tabs[0].id).toBe('tab1');
    });

    it('should replace existing tabs', () => {
      act(() => {
        useTabStore.getState().setTabs([createMockTab('tab1')]);
        useTabStore.getState().setTabs([createMockTab('tab2'), createMockTab('tab3')]);
      });

      expect(useTabStore.getState().tabs).toHaveLength(2);
      expect(useTabStore.getState().tabs[0].id).toBe('tab2');
    });
  });

  describe('setActiveTabId', () => {
    it('should set active tab id', () => {
      act(() => {
        useTabStore.getState().setActiveTabId('tab1');
      });

      expect(useTabStore.getState().activeTabId).toBe('tab1');
    });

    it('should persist last active tab to AsyncStorage when tab has networkId', async () => {
      const tab = createMockTab('tab1', 'network1');
      
      act(() => {
        useTabStore.getState().setTabs([tab]);
        useTabStore.getState().setActiveTabId('tab1');
      });

      // Wait for async operation
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      expect(mockStorage.has('@AndroidIRCX:lastActiveTab:network1')).toBe(true);
      expect(mockStorage.get('@AndroidIRCX:lastActiveTab:network1')).toBe('tab1');
    });

    it('should not persist when tab has no networkId', async () => {
      const tab = createMockTab('tab1', '');
      
      act(() => {
        useTabStore.getState().setTabs([tab]);
        useTabStore.getState().setActiveTabId('tab1');
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      expect(mockStorage.size).toBe(0);
    });

    it('should handle error when persisting to AsyncStorage', async () => {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      AsyncStorage.setItem.mockRejectedValueOnce(new Error('Storage error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const tab = createMockTab('tab1', 'network1');
      
      act(() => {
        useTabStore.getState().setTabs([tab]);
        useTabStore.getState().setActiveTabId('tab1');
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('addTab', () => {
    it('should add new tab', () => {
      act(() => {
        useTabStore.getState().addTab(createMockTab('tab1'));
      });

      expect(useTabStore.getState().tabs).toHaveLength(1);
      expect(useTabStore.getState().tabs[0].id).toBe('tab1');
    });

    it('should not add duplicate tab', () => {
      const tab = createMockTab('tab1');
      
      act(() => {
        useTabStore.getState().addTab(tab);
        useTabStore.getState().addTab(tab);
      });

      expect(useTabStore.getState().tabs).toHaveLength(1);
    });

    it('should add multiple different tabs', () => {
      act(() => {
        useTabStore.getState().addTab(createMockTab('tab1'));
        useTabStore.getState().addTab(createMockTab('tab2'));
        useTabStore.getState().addTab(createMockTab('tab3'));
      });

      expect(useTabStore.getState().tabs).toHaveLength(3);
    });
  });

  describe('removeTab', () => {
    it('should remove tab by id', () => {
      act(() => {
        useTabStore.getState().setTabs([createMockTab('tab1'), createMockTab('tab2')]);
        useTabStore.getState().removeTab('tab1');
      });

      expect(useTabStore.getState().tabs).toHaveLength(1);
      expect(useTabStore.getState().tabs[0].id).toBe('tab2');
    });

    it('should handle removing non-existent tab', () => {
      act(() => {
        useTabStore.getState().setTabs([createMockTab('tab1')]);
        useTabStore.getState().removeTab('nonexistent');
      });

      expect(useTabStore.getState().tabs).toHaveLength(1);
    });

    it('should remove all tabs when called for each', () => {
      act(() => {
        useTabStore.getState().setTabs([createMockTab('tab1'), createMockTab('tab2')]);
        useTabStore.getState().removeTab('tab1');
        useTabStore.getState().removeTab('tab2');
      });

      expect(useTabStore.getState().tabs).toHaveLength(0);
    });
  });

  describe('updateTab', () => {
    it('should update tab properties', () => {
      act(() => {
        useTabStore.getState().setTabs([createMockTab('tab1', 'net1', { label: 'Original' })]);
        useTabStore.getState().updateTab('tab1', { label: 'Updated' });
      });

      expect(useTabStore.getState().tabs[0].label).toBe('Updated');
    });

    it('should update multiple properties', () => {
      act(() => {
        useTabStore.getState().setTabs([createMockTab('tab1')]);
        useTabStore.getState().updateTab('tab1', { label: 'Updated', hasActivity: true });
      });

      expect(useTabStore.getState().tabs[0].label).toBe('Updated');
      expect(useTabStore.getState().tabs[0].hasActivity).toBe(true);
    });

    it('should not update non-existent tab', () => {
      act(() => {
        useTabStore.getState().setTabs([createMockTab('tab1')]);
        useTabStore.getState().updateTab('nonexistent', { label: 'Updated' });
      });

      expect(useTabStore.getState().tabs[0].label).toBe('Channel tab1');
    });

    it('should merge updates with existing properties', () => {
      act(() => {
        useTabStore.getState().setTabs([createMockTab('tab1', 'net1', { 
          label: 'Original',
          hasActivity: false 
        })]);
        useTabStore.getState().updateTab('tab1', { hasActivity: true });
      });

      expect(useTabStore.getState().tabs[0].label).toBe('Original');
      expect(useTabStore.getState().tabs[0].hasActivity).toBe(true);
    });
  });

  describe('addMessageToTab', () => {
    it('should add message to tab', () => {
      const message = { id: 'msg1', text: 'Hello' };
      
      act(() => {
        useTabStore.getState().setTabs([createMockTab('tab1')]);
        useTabStore.getState().addMessageToTab('tab1', message);
      });

      expect(useTabStore.getState().tabs[0].messages).toHaveLength(1);
      expect(useTabStore.getState().tabs[0].messages![0]).toEqual(message);
    });

    it('should append messages to existing messages', () => {
      const message1 = { id: 'msg1', text: 'Hello' };
      const message2 = { id: 'msg2', text: 'World' };
      
      act(() => {
        useTabStore.getState().setTabs([createMockTab('tab1', 'net1', { messages: [message1] })]);
        useTabStore.getState().addMessageToTab('tab1', message2);
      });

      expect(useTabStore.getState().tabs[0].messages).toHaveLength(2);
    });

    it('should not add message to non-existent tab', () => {
      act(() => {
        useTabStore.getState().setTabs([createMockTab('tab1')]);
        useTabStore.getState().addMessageToTab('nonexistent', { id: 'msg1', text: 'Hello' });
      });

      expect(useTabStore.getState().tabs[0].messages).toHaveLength(0);
    });

    it('should create messages array if undefined', () => {
      act(() => {
        useTabStore.getState().setTabs([createMockTab('tab1', 'net1', { messages: undefined })]);
        useTabStore.getState().addMessageToTab('tab1', { id: 'msg1', text: 'Hello' });
      });

      expect(useTabStore.getState().tabs[0].messages).toHaveLength(1);
    });
  });

  describe('setTabActivity', () => {
    it('should set hasActivity flag', () => {
      act(() => {
        useTabStore.getState().setTabs([createMockTab('tab1')]);
        useTabStore.getState().setTabActivity('tab1', true);
      });

      expect(useTabStore.getState().tabs[0].hasActivity).toBe(true);
    });

    it('should clear activity flag', () => {
      act(() => {
        useTabStore.getState().setTabs([createMockTab('tab1', 'net1', { hasActivity: true })]);
        useTabStore.getState().setTabActivity('tab1', false);
      });

      expect(useTabStore.getState().tabs[0].hasActivity).toBe(false);
    });

    it('should not affect other tabs', () => {
      act(() => {
        useTabStore.getState().setTabs([
          createMockTab('tab1'),
          createMockTab('tab2'),
        ]);
        useTabStore.getState().setTabActivity('tab1', true);
      });

      expect(useTabStore.getState().tabs[0].hasActivity).toBe(true);
      expect(useTabStore.getState().tabs[1].hasActivity).toBe(false);
    });
  });

  describe('clearTabMessages', () => {
    it('should clear all messages from tab', () => {
      act(() => {
        useTabStore.getState().setTabs([createMockTab('tab1', 'net1', { 
          messages: [{ id: 'msg1' }, { id: 'msg2' }] 
        })]);
        useTabStore.getState().clearTabMessages('tab1');
      });

      expect(useTabStore.getState().tabs[0].messages).toEqual([]);
    });

    it('should not affect other tabs', () => {
      act(() => {
        useTabStore.getState().setTabs([
          createMockTab('tab1', 'net1', { messages: [{ id: 'msg1' }] }),
          createMockTab('tab2', 'net1', { messages: [{ id: 'msg2' }] }),
        ]);
        useTabStore.getState().clearTabMessages('tab1');
      });

      expect(useTabStore.getState().tabs[0].messages).toEqual([]);
      expect(useTabStore.getState().tabs[1].messages).toHaveLength(1);
    });

    it('should handle non-existent tab gracefully', () => {
      act(() => {
        useTabStore.getState().setTabs([createMockTab('tab1')]);
        useTabStore.getState().clearTabMessages('nonexistent');
      });

      // Should not throw
      expect(useTabStore.getState().tabs).toHaveLength(1);
    });
  });

  describe('addTabs', () => {
    it('should add multiple tabs at once', () => {
      act(() => {
        useTabStore.getState().addTabs([createMockTab('tab1'), createMockTab('tab2')]);
      });

      expect(useTabStore.getState().tabs).toHaveLength(2);
    });

    it('should skip existing tabs', () => {
      act(() => {
        useTabStore.getState().setTabs([createMockTab('tab1')]);
        useTabStore.getState().addTabs([createMockTab('tab1'), createMockTab('tab2')]);
      });

      expect(useTabStore.getState().tabs).toHaveLength(2);
    });

    it('should handle empty array', () => {
      act(() => {
        useTabStore.getState().setTabs([createMockTab('tab1')]);
        useTabStore.getState().addTabs([]);
      });

      expect(useTabStore.getState().tabs).toHaveLength(1);
    });
  });

  describe('removeTabs', () => {
    it('should remove multiple tabs at once', () => {
      act(() => {
        useTabStore.getState().setTabs([
          createMockTab('tab1'),
          createMockTab('tab2'),
          createMockTab('tab3'),
        ]);
        useTabStore.getState().removeTabs(['tab1', 'tab2']);
      });

      expect(useTabStore.getState().tabs).toHaveLength(1);
      expect(useTabStore.getState().tabs[0].id).toBe('tab3');
    });

    it('should handle non-existent tab ids', () => {
      act(() => {
        useTabStore.getState().setTabs([createMockTab('tab1')]);
        useTabStore.getState().removeTabs(['tab1', 'nonexistent']);
      });

      expect(useTabStore.getState().tabs).toHaveLength(0);
    });

    it('should handle empty array', () => {
      act(() => {
        useTabStore.getState().setTabs([createMockTab('tab1')]);
        useTabStore.getState().removeTabs([]);
      });

      expect(useTabStore.getState().tabs).toHaveLength(1);
    });
  });

  describe('updateTabs', () => {
    it('should update multiple tabs at once', () => {
      act(() => {
        useTabStore.getState().setTabs([
          createMockTab('tab1', 'net1', { label: 'Original 1' }),
          createMockTab('tab2', 'net1', { label: 'Original 2' }),
        ]);
        useTabStore.getState().updateTabs([
          { tabId: 'tab1', updates: { label: 'Updated 1' } },
          { tabId: 'tab2', updates: { label: 'Updated 2' } },
        ]);
      });

      expect(useTabStore.getState().tabs[0].label).toBe('Updated 1');
      expect(useTabStore.getState().tabs[1].label).toBe('Updated 2');
    });

    it('should skip non-existent tabs', () => {
      act(() => {
        useTabStore.getState().setTabs([createMockTab('tab1', 'net1', { label: 'Original' })]);
        useTabStore.getState().updateTabs([
          { tabId: 'tab1', updates: { label: 'Updated' } },
          { tabId: 'nonexistent', updates: { label: 'Ignored' } },
        ]);
      });

      expect(useTabStore.getState().tabs[0].label).toBe('Updated');
    });

    it('should handle empty updates array', () => {
      act(() => {
        useTabStore.getState().setTabs([createMockTab('tab1')]);
        useTabStore.getState().updateTabs([]);
      });

      expect(useTabStore.getState().tabs).toHaveLength(1);
    });
  });

  describe('getTabById', () => {
    it('should return tab by id', () => {
      const tab = createMockTab('tab1');
      
      act(() => {
        useTabStore.getState().setTabs([tab, createMockTab('tab2')]);
      });

      const result = useTabStore.getState().getTabById('tab1');
      expect(result).toEqual(expect.objectContaining({ id: 'tab1' }));
    });

    it('should return undefined for non-existent tab', () => {
      act(() => {
        useTabStore.getState().setTabs([createMockTab('tab1')]);
      });

      const result = useTabStore.getState().getTabById('nonexistent');
      expect(result).toBeUndefined();
    });

    it('should return undefined when no tabs', () => {
      const result = useTabStore.getState().getTabById('tab1');
      expect(result).toBeUndefined();
    });
  });

  describe('getTabsByNetwork', () => {
    it('should return tabs for specific network', () => {
      act(() => {
        useTabStore.getState().setTabs([
          createMockTab('tab1', 'network1'),
          createMockTab('tab2', 'network2'),
          createMockTab('tab3', 'network1'),
        ]);
      });

      const result = useTabStore.getState().getTabsByNetwork('network1');
      expect(result).toHaveLength(2);
      expect(result.every(t => t.networkId === 'network1')).toBe(true);
    });

    it('should return empty array for non-existent network', () => {
      act(() => {
        useTabStore.getState().setTabs([createMockTab('tab1', 'network1')]);
      });

      const result = useTabStore.getState().getTabsByNetwork('nonexistent');
      expect(result).toEqual([]);
    });

    it('should return empty array when no tabs', () => {
      const result = useTabStore.getState().getTabsByNetwork('network1');
      expect(result).toEqual([]);
    });
  });

  describe('getActiveTab', () => {
    it('should return active tab', () => {
      act(() => {
        useTabStore.getState().setTabs([
          createMockTab('tab1'),
          createMockTab('tab2'),
        ]);
        useTabStore.getState().setActiveTabId('tab2');
      });

      const result = useTabStore.getState().getActiveTab();
      expect(result?.id).toBe('tab2');
    });

    it('should auto-select first tab when no active tab is set', () => {
      act(() => {
        useTabStore.getState().setTabs([createMockTab('tab1')]);
      });

      const result = useTabStore.getState().getActiveTab();
      expect(result?.id).toBe('tab1');
    });

    it('should return undefined when active tab id not found', () => {
      act(() => {
        useTabStore.getState().setTabs([createMockTab('tab1')]);
        useTabStore.getState().setActiveTabId('nonexistent');
      });

      const result = useTabStore.getState().getActiveTab();
      expect(result).toBeUndefined();
    });
  });

  describe('getTabCount', () => {
    it('should return number of tabs', () => {
      act(() => {
        useTabStore.getState().setTabs([createMockTab('tab1'), createMockTab('tab2')]);
      });

      expect(useTabStore.getState().getTabCount()).toBe(2);
    });

    it('should return 0 when no tabs', () => {
      expect(useTabStore.getState().getTabCount()).toBe(0);
    });
  });

  describe('hasTab', () => {
    it('should return true for existing tab', () => {
      act(() => {
        useTabStore.getState().setTabs([createMockTab('tab1')]);
      });

      expect(useTabStore.getState().hasTab('tab1')).toBe(true);
    });

    it('should return false for non-existent tab', () => {
      act(() => {
        useTabStore.getState().setTabs([createMockTab('tab1')]);
      });

      expect(useTabStore.getState().hasTab('nonexistent')).toBe(false);
    });

    it('should return false when no tabs', () => {
      expect(useTabStore.getState().hasTab('tab1')).toBe(false);
    });
  });

  describe('saveTabsToStorage', () => {
    it('should queue save for network tabs', async () => {
      act(() => {
        useTabStore.getState().setTabs([
          createMockTab('tab1', 'network1'),
          createMockTab('tab2', 'network1'),
          createMockTab('tab3', 'network2'),
        ]);
      });

      await act(async () => {
        await useTabStore.getState().saveTabsToStorage('network1');
      });

      expect(mockQueueSave).toHaveBeenCalledWith(
        'network1',
        expect.arrayContaining([
          expect.objectContaining({ id: 'tab1' }),
          expect.objectContaining({ id: 'tab2' }),
        ])
      );
      expect(mockQueueSave).toHaveBeenCalledTimes(1);
    });

    it('should handle empty tabs', async () => {
      await act(async () => {
        await useTabStore.getState().saveTabsToStorage('network1');
      });

      expect(mockQueueSave).toHaveBeenCalledWith('network1', []);
    });
  });

  describe('loadTabsFromStorage', () => {
    it('should load tabs from storage', async () => {
      const loadedTabs = [createMockTab('loaded1', 'network1')];
      mockGetTabs.mockResolvedValueOnce(loadedTabs);

      await act(async () => {
        await useTabStore.getState().loadTabsFromStorage('network1');
      });

      expect(mockGetTabs).toHaveBeenCalledWith('network1');
      expect(useTabStore.getState().tabs).toHaveLength(1);
      expect(useTabStore.getState().tabs[0].id).toBe('loaded1');
    });

    it('should preserve existing messages when merging', async () => {
      const existingMessage = { id: 'existing', text: 'Hello' };
      const loadedTabs = [createMockTab('tab1', 'network1', { messages: [] })];
      
      mockGetTabs.mockResolvedValueOnce(loadedTabs);

      act(() => {
        useTabStore.getState().setTabs([
          createMockTab('tab1', 'network1', { messages: [existingMessage] }),
        ]);
      });

      await act(async () => {
        await useTabStore.getState().loadTabsFromStorage('network1');
      });

      expect(useTabStore.getState().tabs[0].messages).toContainEqual(existingMessage);
    });

    it('should use loaded tab when no existing messages', async () => {
      const loadedTab = createMockTab('tab1', 'network1', { messages: [] });
      mockGetTabs.mockResolvedValueOnce([loadedTab]);

      await act(async () => {
        await useTabStore.getState().loadTabsFromStorage('network1');
      });

      expect(useTabStore.getState().tabs[0].id).toBe('tab1');
    });

    it('should preserve other network tabs when loading', async () => {
      mockGetTabs.mockResolvedValueOnce([createMockTab('loaded', 'network2')]);

      act(() => {
        useTabStore.getState().setTabs([createMockTab('existing', 'network1')]);
      });

      await act(async () => {
        await useTabStore.getState().loadTabsFromStorage('network2');
      });

      expect(useTabStore.getState().tabs).toHaveLength(2);
    });

    it('should handle load error gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockGetTabs.mockRejectedValueOnce(new Error('Load failed'));

      await act(async () => {
        await useTabStore.getState().loadTabsFromStorage('network1');
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to load tabs for network network1:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe('reset', () => {
    it('should reset to initial state', () => {
      act(() => {
        useTabStore.getState().setTabs([createMockTab('tab1')]);
        useTabStore.getState().setActiveTabId('tab1');
        useTabStore.getState().reset();
      });

      expect(useTabStore.getState().tabs).toEqual([]);
      expect(useTabStore.getState().activeTabId).toBe('');
    });

    it('should allow operations after reset', () => {
      act(() => {
        useTabStore.getState().setTabs([createMockTab('tab1')]);
        useTabStore.getState().reset();
        useTabStore.getState().addTab(createMockTab('tab2'));
      });

      expect(useTabStore.getState().tabs).toHaveLength(1);
      expect(useTabStore.getState().tabs[0].id).toBe('tab2');
    });
  });
});

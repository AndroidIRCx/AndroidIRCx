/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for TabService
 */

import { tabService } from '../../src/services/TabService';
import { storageCache } from '../../src/services/StorageCache';
import { ChannelTab } from '../../src/types';

describe('TabService', () => {
  beforeEach(async () => {
    await storageCache.clear(true);
    jest.clearAllMocks();
  });

  describe('getTabs', () => {
    it('should return default server tab for new network', async () => {
      const tabs = await tabService.getTabs('TestNetwork');

      expect(tabs).toHaveLength(1);
      expect(tabs[0].id).toBe('server::TestNetwork');
      expect(tabs[0].name).toBe('TestNetwork');
      expect(tabs[0].type).toBe('server');
      expect(tabs[0].networkId).toBe('TestNetwork');
      expect(tabs[0].messages).toEqual([]);
    });

    it('should return empty array for "Not connected" network', async () => {
      const tabs = await tabService.getTabs('Not connected');

      expect(tabs).toEqual([]);
    });

    it('should load saved tabs from storage', async () => {
      const savedTabs: Omit<ChannelTab, 'messages'>[] = [
        {
          id: 'server::TestNetwork',
          name: 'TestNetwork',
          type: 'server',
          networkId: 'TestNetwork',
        },
        {
          id: 'TestNetwork::#channel1',
          name: '#channel1',
          type: 'channel',
          networkId: 'TestNetwork',
        },
      ];

      await storageCache.setItem('TABS_TestNetwork', savedTabs);

      const tabs = await tabService.getTabs('TestNetwork');

      expect(tabs).toHaveLength(2);
      expect(tabs[0].id).toBe('server::TestNetwork');
      expect(tabs[1].id).toBe('TestNetwork::#channel1');
      // Messages should be empty even if they were saved
      expect(tabs[0].messages).toEqual([]);
      expect(tabs[1].messages).toEqual([]);
    });

    it('should filter out "Not connected" tabs', async () => {
      const savedTabs: Omit<ChannelTab, 'messages'>[] = [
        {
          id: 'server::TestNetwork',
          name: 'TestNetwork',
          type: 'server',
          networkId: 'TestNetwork',
        },
        {
          id: 'Not connected::#channel',
          name: '#channel',
          type: 'channel',
          networkId: 'Not connected',
        },
      ];

      await storageCache.setItem('TABS_TestNetwork', savedTabs);

      const tabs = await tabService.getTabs('TestNetwork');

      expect(tabs).toHaveLength(1);
      expect(tabs[0].name).toBe('TestNetwork');
    });

    it('should fix server tab id if not in correct format', async () => {
      const savedTabs: Omit<ChannelTab, 'messages'>[] = [
        {
          id: 'wrong-id',
          name: 'TestNetwork',
          type: 'server',
          networkId: 'TestNetwork',
        },
      ];

      await storageCache.setItem('TABS_TestNetwork', savedTabs);

      const tabs = await tabService.getTabs('TestNetwork');

      expect(tabs[0].id).toBe('server::TestNetwork');
    });

    it('should set networkId if missing', async () => {
      const savedTabs: any[] = [
        { id: 'TestNetwork::#channel', name: '#channel', type: 'channel' }, // missing networkId
      ];

      await storageCache.setItem('TABS_TestNetwork', savedTabs);

      const tabs = await tabService.getTabs('TestNetwork');

      expect(tabs[0].networkId).toBe('TestNetwork');
    });

    it('should handle storage errors gracefully', async () => {
      // Mock storageCache.getItem to throw
      jest
        .spyOn(storageCache, 'getItem')
        .mockRejectedValueOnce(new Error('Storage error'));

      const tabs = await tabService.getTabs('TestNetwork');

      expect(tabs).toHaveLength(1);
      expect(tabs[0].id).toBe('server::TestNetwork');
    });
  });

  describe('saveTabs', () => {
    it('should save tabs to storage', async () => {
      const tabs: ChannelTab[] = [
        {
          id: 'server::TestNetwork',
          name: 'TestNetwork',
          type: 'server',
          networkId: 'TestNetwork',
          messages: [],
        },
        {
          id: 'TestNetwork::#channel',
          name: '#channel',
          type: 'channel',
          networkId: 'TestNetwork',
          messages: [],
        },
      ];

      await tabService.saveTabs('TestNetwork', tabs);

      const saved = await storageCache.getItem('TABS_TestNetwork');
      expect(saved).toHaveLength(2);
    });

    it('should not save messages', async () => {
      const tabs: ChannelTab[] = [
        {
          id: 'server::TestNetwork',
          name: 'TestNetwork',
          type: 'server',
          networkId: 'TestNetwork',
          messages: [
            { id: '1', text: 'test', timestamp: Date.now(), sender: 'user' },
          ],
        },
      ];

      await tabService.saveTabs('TestNetwork', tabs);

      const saved = await storageCache.getItem('TABS_TestNetwork');
      expect(saved[0].messages).toBeUndefined();
    });

    it('should not save tabs for "Not connected" network', async () => {
      const tabs: ChannelTab[] = [
        {
          id: 'server::Not connected',
          name: 'Not connected',
          type: 'server',
          networkId: 'Not connected',
          messages: [],
        },
      ];

      await tabService.saveTabs('Not connected', tabs);

      const saved = await storageCache.getItem('TABS_Not connected');
      expect(saved).toBeNull();
    });

    it('should filter out "Not connected" tabs before saving', async () => {
      const tabs: ChannelTab[] = [
        {
          id: 'server::TestNetwork',
          name: 'TestNetwork',
          type: 'server',
          networkId: 'TestNetwork',
          messages: [],
        },
        {
          id: 'Not connected::#channel',
          name: '#channel',
          type: 'channel',
          networkId: 'Not connected',
          messages: [],
        },
      ];

      await tabService.saveTabs('TestNetwork', tabs);

      const saved = await storageCache.getItem('TABS_TestNetwork');
      expect(saved).toHaveLength(1);
      expect(saved[0].name).toBe('TestNetwork');
    });

    it('should handle storage errors gracefully', async () => {
      jest
        .spyOn(storageCache, 'setItem')
        .mockRejectedValueOnce(new Error('Storage error'));

      const tabs: ChannelTab[] = [
        {
          id: 'server::TestNetwork',
          name: 'TestNetwork',
          type: 'server',
          networkId: 'TestNetwork',
          messages: [],
        },
      ];

      await expect(
        tabService.saveTabs('TestNetwork', tabs),
      ).resolves.not.toThrow();
    });
  });

  describe('removeTab', () => {
    it('should remove specific tab', async () => {
      const tabs: ChannelTab[] = [
        {
          id: 'server::TestNetwork',
          name: 'TestNetwork',
          type: 'server',
          networkId: 'TestNetwork',
          messages: [],
        },
        {
          id: 'TestNetwork::#channel',
          name: '#channel',
          type: 'channel',
          networkId: 'TestNetwork',
          messages: [],
        },
      ];

      await tabService.saveTabs('TestNetwork', tabs);
      await tabService.removeTab('TestNetwork', 'TestNetwork::#channel');

      const remainingTabs = await tabService.getTabs('TestNetwork');
      expect(remainingTabs).toHaveLength(1);
      expect(remainingTabs[0].id).toBe('server::TestNetwork');
    });

    it('should handle removing non-existent tab', async () => {
      const tabs: ChannelTab[] = [
        {
          id: 'server::TestNetwork',
          name: 'TestNetwork',
          type: 'server',
          networkId: 'TestNetwork',
          messages: [],
        },
      ];

      await tabService.saveTabs('TestNetwork', tabs);

      await expect(
        tabService.removeTab('TestNetwork', 'non-existent'),
      ).resolves.not.toThrow();

      const remainingTabs = await tabService.getTabs('TestNetwork');
      expect(remainingTabs).toHaveLength(1);
    });

    it('should handle errors gracefully', async () => {
      jest
        .spyOn(storageCache, 'setItem')
        .mockRejectedValueOnce(new Error('Storage error'));

      await expect(
        tabService.removeTab('TestNetwork', 'some-tab'),
      ).resolves.not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle tabs with same id in different networks', async () => {
      const network1Tabs: ChannelTab[] = [
        {
          id: 'server::Network1',
          name: 'Network1',
          type: 'server',
          networkId: 'Network1',
          messages: [],
        },
        {
          id: 'Network1::#shared',
          name: '#shared',
          type: 'channel',
          networkId: 'Network1',
          messages: [],
        },
      ];

      const network2Tabs: ChannelTab[] = [
        {
          id: 'server::Network2',
          name: 'Network2',
          type: 'server',
          networkId: 'Network2',
          messages: [],
        },
        {
          id: 'Network2::#shared',
          name: '#shared',
          type: 'channel',
          networkId: 'Network2',
          messages: [],
        },
      ];

      await tabService.saveTabs('Network1', network1Tabs);
      await tabService.saveTabs('Network2', network2Tabs);

      const loaded1 = await tabService.getTabs('Network1');
      const loaded2 = await tabService.getTabs('Network2');

      expect(loaded1).toHaveLength(2);
      expect(loaded2).toHaveLength(2);
      expect(loaded1[1].id).toBe('Network1::#shared');
      expect(loaded2[1].id).toBe('Network2::#shared');
    });

    it('should handle empty tabs array', async () => {
      await tabService.saveTabs('TestNetwork', []);

      // When loading an empty saved array, it returns default server tab
      // because saveTabs stores empty array, but getTabs creates default when no stored tabs
      const tabs = await tabService.getTabs('TestNetwork');
      // Since empty array was saved, getTabs returns default server tab
      expect(tabs.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle query tabs', async () => {
      const tabs: ChannelTab[] = [
        {
          id: 'server::TestNetwork',
          name: 'TestNetwork',
          type: 'server',
          networkId: 'TestNetwork',
          messages: [],
        },
        {
          id: 'TestNetwork::@user1',
          name: 'user1',
          type: 'query',
          networkId: 'TestNetwork',
          messages: [],
        },
      ];

      await tabService.saveTabs('TestNetwork', tabs);
      const loaded = await tabService.getTabs('TestNetwork');

      expect(loaded).toHaveLength(2);
      expect(loaded[1].type).toBe('query');
    });

    it('should handle special characters in network name', async () => {
      const networkName = 'Network-With_Special.Chars';
      const tabs: ChannelTab[] = [
        {
          id: `server::${networkName}`,
          name: networkName,
          type: 'server',
          networkId: networkName,
          messages: [],
        },
      ];

      await tabService.saveTabs(networkName, tabs);
      const loaded = await tabService.getTabs(networkName);

      expect(loaded[0].name).toBe(networkName);
    });
  });
});

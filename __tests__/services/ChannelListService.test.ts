/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for ChannelListService - Wave 6
 */

import { ChannelListService, ChannelListItem } from '../../src/services/ChannelListService';

// Mock AsyncStorage
const mockStorage: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockStorage[key] || null)),
  setItem: jest.fn((key: string, value: string) => {
    mockStorage[key] = value;
    return Promise.resolve();
  }),
}));

describe('ChannelListService', () => {
  const mockIrcService = {
    getNetworkName: jest.fn().mockReturnValue('freenode'),
    sendRaw: jest.fn(),
    on: jest.fn(),
  };

  let service: ChannelListService;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
    service = new ChannelListService(mockIrcService as any);
  });

  describe('Initialization', () => {
    it('should create service with IRC service', () => {
      expect(service).toBeDefined();
      expect(mockIrcService.on).toHaveBeenCalledWith('numeric', expect.any(Function));
    });
  });

  describe('Request Channel List', () => {
    it('should request channel list', () => {
      service.requestChannelList();

      expect(mockIrcService.sendRaw).toHaveBeenCalledWith('LIST');
    });

    it('should request channel list with filter', () => {
      service.requestChannelList('#a*');

      expect(mockIrcService.sendRaw).toHaveBeenCalledWith('LIST #a*');
    });

    it('should warn if already listing', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      service.requestChannelList();
      service.requestChannelList();

      expect(consoleSpy).toHaveBeenCalledWith('ChannelListService: Already listing channels');
      expect(mockIrcService.sendRaw).toHaveBeenCalledTimes(1);
      consoleSpy.mockRestore();
    });
  });

  describe('Handle List Reply', () => {
    it('should handle RPL_LISTSTART (321)', () => {
      service.handleListReply(321, ['nick']);

      expect(service.getChannelList()).toEqual([]);
    });

    it('should handle RPL_LIST (322) with channel info', () => {
      service.handleListReply(321, ['nick']); // Start
      service.handleListReply(322, ['nick', '#general', '50', 'General chat channel']);

      const list = service.getChannelList();
      expect(list).toHaveLength(1);
      expect(list[0].name).toBe('#general');
      expect(list[0].userCount).toBe(50);
      expect(list[0].topic).toBe('General chat channel');
    });

    it('should handle RPL_LIST (322) with colon in topic', () => {
      service.handleListReply(321, ['nick']);
      service.handleListReply(322, ['nick', '#help', '10', ':Welcome to help']);

      const list = service.getChannelList();
      expect(list[0].topic).toBe('Welcome to help');
    });

    it('should handle multiple channels', () => {
      service.handleListReply(321, ['nick']);
      service.handleListReply(322, ['nick', '#general', '50', 'General']);
      service.handleListReply(322, ['nick', '#random', '100', 'Random']);

      expect(service.getChannelList()).toHaveLength(2);
    });

    it('should handle RPL_LISTEND (323)', () => {
      const listListener = jest.fn();
      const endListener = jest.fn();

      service.onChannelListUpdate(listListener);
      service.onListEnd(endListener);

      service.handleListReply(321, ['nick']);
      service.handleListReply(322, ['nick', '#general', '50', 'Topic']);
      service.handleListReply(323, ['nick']);

      expect(listListener).toHaveBeenCalled();
      expect(endListener).toHaveBeenCalled();
    });

    it('should cache list on RPL_LISTEND', () => {
      service.handleListReply(321, ['nick']);
      service.handleListReply(322, ['nick', '#general', '50', 'Topic']);
      service.handleListReply(323, ['nick']);

      const { setItem } = require('@react-native-async-storage/async-storage');
      expect(setItem).toHaveBeenCalled();
    });

    it('should handle invalid user count', () => {
      service.handleListReply(321, ['nick']);
      service.handleListReply(322, ['nick', '#general', 'invalid', 'Topic']);

      const list = service.getChannelList();
      expect(list[0].userCount).toBeUndefined();
    });

    it('should handle missing topic', () => {
      service.handleListReply(321, ['nick']);
      service.handleListReply(322, ['nick', '#general', '50']);

      const list = service.getChannelList();
      expect(list[0].topic).toBeUndefined();
    });
  });

  describe('Get Channel List', () => {
    it('should return copy of channel list', () => {
      service.handleListReply(321, ['nick']);
      service.handleListReply(322, ['nick', '#general', '50', 'Topic']);

      const list1 = service.getChannelList();
      const list2 = service.getChannelList();

      expect(list1).toEqual(list2);
      expect(list1).not.toBe(list2);
    });

    it('should return empty array initially', () => {
      expect(service.getChannelList()).toEqual([]);
    });
  });

  describe('Cached List', () => {
    it('should return empty cached list initially', async () => {
      const cached = await service.getCachedList();
      expect(cached).toEqual([]);
    });

    it('should load cached list from storage', async () => {
      mockStorage.CHANNEL_LIST_CACHE = JSON.stringify({
        freenode: [{ name: '#general', userCount: 50, topic: 'Cached' }],
      });

      const newService = new ChannelListService(mockIrcService as any);
      await new Promise(resolve => setTimeout(resolve, 10));

      const cached = await newService.getCachedList();
      expect(cached).toHaveLength(1);
      expect(cached[0].name).toBe('#general');
    });

    it('should get cached list for specific network', async () => {
      // Set cache through the service
      (service as any).cachedLists = {
        freenode: [{ name: '#general', userCount: 50 }],
        dalnet: [{ name: '#test', userCount: 10 }],
      };

      const cached = await service.getCachedList('dalnet');
      expect(cached).toHaveLength(1);
      expect(cached[0].name).toBe('#test');
    });

    it('should handle storage errors gracefully', async () => {
      const { getItem } = require('@react-native-async-storage/async-storage');
      getItem.mockRejectedValueOnce(new Error('Storage error'));

      const newService = new ChannelListService(mockIrcService as any);
      await new Promise(resolve => setTimeout(resolve, 10));

      const cached = await newService.getCachedList();
      expect(cached).toEqual([]);
    });
  });

  describe('Filter Channel List', () => {
    beforeEach(() => {
      service.handleListReply(321, ['nick']);
      service.handleListReply(322, ['nick', '#general', '50', 'General chat']);
      service.handleListReply(322, ['nick', '#help', '10', 'Help channel']);
      service.handleListReply(322, ['nick', '#big', '1000', 'Big channel']);
      service.handleListReply(323, ['nick']);
    });

    it('should filter by min users', () => {
      const filtered = service.filterChannelList({ minUsers: 20 });
      expect(filtered).toHaveLength(2);
      expect(filtered.find(c => c.name === '#help')).toBeUndefined();
    });

    it('should filter by max users', () => {
      const filtered = service.filterChannelList({ maxUsers: 100 });
      expect(filtered).toHaveLength(2);
      expect(filtered.find(c => c.name === '#big')).toBeUndefined();
    });

    it('should filter by name pattern', () => {
      const filtered = service.filterChannelList({ namePattern: '^#g' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('#general');
    });

    it('should filter by topic pattern', () => {
      const filtered = service.filterChannelList({ topicPattern: 'help' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('#help');
    });

    it('should combine filters', () => {
      const filtered = service.filterChannelList({
        minUsers: 20,
        maxUsers: 100,
        namePattern: '#',
      });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('#general');
    });

    it('should return empty array when no matches', () => {
      const filtered = service.filterChannelList({ minUsers: 10000 });
      expect(filtered).toEqual([]);
    });

    it('should handle channels without userCount', () => {
      service.handleListReply(321, ['nick']);
      service.handleListReply(322, ['nick', '#nousers', 'invalid', 'No count']);
      service.handleListReply(323, ['nick']);

      const filtered = service.filterChannelList({ minUsers: 10 });
      // Channels without userCount should be filtered out when minUsers is set
      expect(filtered.some(c => c.name === '#nousers')).toBe(false);
    });
  });

  describe('Search Channels', () => {
    beforeEach(() => {
      service.handleListReply(321, ['nick']);
      service.handleListReply(322, ['nick', '#general', '50', 'General chat']);
      service.handleListReply(322, ['nick', '#help', '10', 'Help channel']);
      service.handleListReply(323, ['nick']);
    });

    it('should search by name', () => {
      const results = service.searchChannels('general');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('#general');
    });

    it('should search by topic', () => {
      const results = service.searchChannels('help');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('#help');
    });

    it('should be case insensitive', () => {
      const results = service.searchChannels('GENERAL');
      expect(results).toHaveLength(1);
    });

    it('should return all channels for empty query', () => {
      const results = service.searchChannels('');
      expect(results).toHaveLength(2);
    });

    it('should return all channels for whitespace query', () => {
      const results = service.searchChannels('   ');
      expect(results).toHaveLength(2);
    });

    it('should return empty array for no matches', () => {
      const results = service.searchChannels('xyz');
      expect(results).toEqual([]);
    });
  });

  describe('Sort Channels', () => {
    beforeEach(() => {
      service.handleListReply(321, ['nick']);
      service.handleListReply(322, ['nick', '#zebra', '10', 'Zebra']);
      service.handleListReply(322, ['nick', '#alpha', '100', 'Alpha']);
      service.handleListReply(322, ['nick', '#beta', '50', 'Beta']);
      service.handleListReply(323, ['nick']);
    });

    it('should sort by users descending by default', () => {
      const sorted = service.sortChannels(service.getChannelList());
      expect(sorted[0].name).toBe('#alpha');
      expect(sorted[1].name).toBe('#beta');
      expect(sorted[2].name).toBe('#zebra');
    });

    it('should sort by users ascending', () => {
      const sorted = service.sortChannels(service.getChannelList(), 'users', true);
      expect(sorted[0].name).toBe('#zebra');
      expect(sorted[2].name).toBe('#alpha');
    });

    it('should sort by name ascending', () => {
      const sorted = service.sortChannels(service.getChannelList(), 'name', true);
      expect(sorted[0].name).toBe('#alpha');
      expect(sorted[1].name).toBe('#beta');
      expect(sorted[2].name).toBe('#zebra');
    });

    it('should sort by name descending', () => {
      const sorted = service.sortChannels(service.getChannelList(), 'name', false);
      expect(sorted[0].name).toBe('#zebra');
      expect(sorted[2].name).toBe('#alpha');
    });

    it('should handle channels without userCount when sorting by users', () => {
      const channels: ChannelListItem[] = [
        { name: '#a', userCount: 100 },
        { name: '#b' },
        { name: '#c', userCount: 50 },
      ];
      const sorted = service.sortChannels(channels, 'users');
      expect(sorted[0].name).toBe('#a');
      expect(sorted[1].name).toBe('#c');
      expect(sorted[2].name).toBe('#b'); // undefined becomes 0
    });

    it('should not mutate original array', () => {
      const original = service.getChannelList();
      const sorted = service.sortChannels(original, 'name');
      expect(original).not.toEqual(sorted);
    });
  });

  describe('Listeners', () => {
    it('should return unsubscribe function for list updates', () => {
      const unsubscribe = service.onChannelListUpdate(() => {});
      expect(typeof unsubscribe).toBe('function');
    });

    it('should return unsubscribe function for list end', () => {
      const unsubscribe = service.onListEnd(() => {});
      expect(typeof unsubscribe).toBe('function');
    });

    it('should notify list listeners', () => {
      const listener = jest.fn();
      service.onChannelListUpdate(listener);

      service.handleListReply(321, ['nick']);
      service.handleListReply(322, ['nick', '#general', '50', 'Topic']);
      service.handleListReply(323, ['nick']);

      expect(listener).toHaveBeenCalledWith(expect.any(Array));
    });

    it('should notify list end listeners', () => {
      const listener = jest.fn();
      service.onListEnd(listener);

      service.handleListReply(321, ['nick']);
      service.handleListReply(323, ['nick']);

      expect(listener).toHaveBeenCalled();
    });

    it('should unsubscribe list listener', () => {
      const listener = jest.fn();
      const unsubscribe = service.onChannelListUpdate(listener);

      unsubscribe();

      service.handleListReply(321, ['nick']);
      service.handleListReply(323, ['nick']);

      expect(listener).not.toHaveBeenCalled();
    });

    it('should unsubscribe list end listener', () => {
      const listener = jest.fn();
      const unsubscribe = service.onListEnd(listener);

      unsubscribe();

      service.handleListReply(321, ['nick']);
      service.handleListReply(323, ['nick']);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('Clear', () => {
    it('should clear channel list', () => {
      service.handleListReply(321, ['nick']);
      service.handleListReply(322, ['nick', '#general', '50', 'Topic']);
      service.handleListReply(323, ['nick']);

      service.clear();

      expect(service.getChannelList()).toEqual([]);
    });

    it('should reset isListing flag', () => {
      service.requestChannelList();
      service.clear();

      // After clear, should be able to request again without warning
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      service.requestChannelList();
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});

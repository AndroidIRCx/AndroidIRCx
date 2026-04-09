/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for tabUtils
 */

import {
  serverTabId,
  channelTabId,
  queryTabId,
  noticeTabId,
  makeServerTab,
  sortTabsGrouped,
} from '../../src/utils/tabUtils';
import { ChannelTab } from '../../src/types';

describe('tabUtils', () => {
  describe('serverTabId', () => {
    it('should generate server tab id', () => {
      const result = serverTabId('test-net');
      expect(result).toBe('server::test-net');
    });

    it('should handle network with special characters', () => {
      const result = serverTabId('test.net');
      expect(result).toBe('server::test.net');
    });
  });

  describe('channelTabId', () => {
    it('should generate channel tab id', () => {
      const result = channelTabId('test-net', '#general');
      expect(result).toBe('channel::test-net::#general');
    });

    it('should handle channel with special characters', () => {
      const result = channelTabId('test-net', '#test-channel');
      expect(result).toBe('channel::test-net::#test-channel');
    });
  });

  describe('queryTabId', () => {
    it('should generate query tab id', () => {
      const result = queryTabId('test-net', 'alice');
      expect(result).toBe('query::test-net::alice');
    });

    it('should handle nick with special characters', () => {
      const result = queryTabId('test-net', 'alice[away]');
      expect(result).toBe('query::test-net::alice[away]');
    });
  });

  describe('noticeTabId', () => {
    it('should generate notice tab id', () => {
      const result = noticeTabId('test-net');
      expect(result).toBe('notice::test-net');
    });
  });

  describe('makeServerTab', () => {
    it('should create a server tab', () => {
      const result = makeServerTab('test-net');
      expect(result).toEqual({
        id: 'server::test-net',
        name: 'test-net',
        type: 'server',
        networkId: 'test-net',
        messages: [],
      });
    });
  });

  describe('sortTabsGrouped', () => {
    const mockTabs: ChannelTab[] = [
      {
        id: 'channel::net-b::#channel1',
        name: '#channel1',
        type: 'channel',
        networkId: 'net-b',
        messages: [],
        hasActivity: false,
      },
      {
        id: 'server::net-a',
        name: 'net-a',
        type: 'server',
        networkId: 'net-a',
        messages: [],
        hasActivity: false,
      },
      {
        id: 'channel::net-a::#zebra',
        name: '#zebra',
        type: 'channel',
        networkId: 'net-a',
        messages: [],
        hasActivity: false,
      },
      {
        id: 'channel::net-a::#alpha',
        name: '#alpha',
        type: 'channel',
        networkId: 'net-a',
        messages: [],
        hasActivity: false,
      },
      {
        id: 'server::net-b',
        name: 'net-b',
        type: 'server',
        networkId: 'net-b',
        messages: [],
        hasActivity: false,
      },
    ];

    it('should group tabs by network with server first', () => {
      const result = sortTabsGrouped(mockTabs);

      // Should have server tab first for each network
      expect(result[0].networkId).toBe('net-b');
      expect(result[0].type).toBe('server');

      expect(result[1].networkId).toBe('net-b');
      expect(result[1].type).toBe('channel');

      expect(result[2].networkId).toBe('net-a');
      expect(result[2].type).toBe('server');
    });

    it('should sort alphabetically within network when flag is true', () => {
      const result = sortTabsGrouped(mockTabs, true);

      // Find net-a channels
      const netATabs = result.filter(
        t => t.networkId === 'net-a' && t.type === 'channel',
      );
      expect(netATabs[0].name).toBe('#alpha');
      expect(netATabs[1].name).toBe('#zebra');
    });

    it('should return same reference if order unchanged', () => {
      // Already sorted tabs
      const sortedTabs: ChannelTab[] = [
        {
          id: 'server::net-a',
          name: 'net-a',
          type: 'server',
          networkId: 'net-a',
          messages: [],
          hasActivity: false,
        },
        {
          id: 'channel::net-a::#channel1',
          name: '#channel1',
          type: 'channel',
          networkId: 'net-a',
          messages: [],
          hasActivity: false,
        },
      ];

      const result = sortTabsGrouped(sortedTabs);
      expect(result).toBe(sortedTabs); // Same reference
    });

    it('should handle empty array', () => {
      const result = sortTabsGrouped([]);
      expect(result).toEqual([]);
    });
  });
});

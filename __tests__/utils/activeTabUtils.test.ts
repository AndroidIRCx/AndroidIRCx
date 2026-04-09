/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for activeTabUtils
 */

import { getActiveTabSafe } from '../../src/utils/activeTabUtils';
import { ChannelTab } from '../../src/services/IRCService';

describe('activeTabUtils', () => {
  const mockTabs: ChannelTab[] = [
    {
      id: 'server::test-net',
      name: 'test-net',
      type: 'server',
      networkId: 'test-net',
      messages: [],
      hasActivity: false,
    },
    {
      id: 'channel::test-net::#general',
      name: '#general',
      type: 'channel',
      networkId: 'test-net',
      messages: [],
      hasActivity: true,
    },
    {
      id: 'query::test-net::alice',
      name: 'alice',
      type: 'query',
      networkId: 'test-net',
      messages: [],
      hasActivity: false,
    },
  ];

  describe('getActiveTabSafe', () => {
    it('should return the active tab if it exists', () => {
      const result = getActiveTabSafe(
        mockTabs,
        'channel::test-net::#general',
        'test-net',
        'test-net',
        'test-net',
      );
      expect(result).toEqual(mockTabs[1]);
    });

    it('should return first server tab if active tab does not exist', () => {
      const result = getActiveTabSafe(
        mockTabs,
        'invalid-tab',
        'test-net',
        'test-net',
        'test-net',
      );
      expect(result).toEqual(mockTabs[0]);
    });

    it('should return first available tab if no server tab exists', () => {
      const tabsWithoutServer = mockTabs.filter(t => t.type !== 'server');
      const result = getActiveTabSafe(
        tabsWithoutServer,
        'invalid-tab',
        'test-net',
        'test-net',
        'test-net',
      );
      expect(result).toEqual(tabsWithoutServer[0]);
    });

    it('should create temporary tab if tabs array is empty and network is valid', () => {
      const result = getActiveTabSafe(
        [],
        'invalid-tab',
        'test-net',
        'test-net',
        'test-net',
      );
      expect(result.type).toBe('server');
      expect(result.networkId).toBe('test-net');
    });

    it('should return minimal safe tab if no valid network exists', () => {
      const result = getActiveTabSafe(
        [],
        'invalid-tab',
        null,
        null,
        'Not connected',
      );
      expect(result.id).toBe('temp');
      expect(result.networkId).toBe('');
    });

    it('should handle empty networkName string', () => {
      const result = getActiveTabSafe([], 'invalid-tab', null, null, '');
      expect(result.id).toBe('temp');
    });
  });
});

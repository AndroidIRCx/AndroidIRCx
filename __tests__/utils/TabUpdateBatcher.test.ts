/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for TabUpdateBatcher
 */

jest.mock('../../src/services/TabService', () => ({
  tabService: {
    saveTabs: jest.fn().mockResolvedValue(undefined),
  },
}));

import { TabUpdateBatcher } from '../../src/utils/TabUpdateBatcher';
import { ChannelTab } from '../../src/types';
import { tabService } from '../../src/services/TabService';

// Helper to create mock tabs
const createMockTabs = (count: number, networkId: string): ChannelTab[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: `tab-${i}`,
    name: `Tab ${i}`,
    type: 'channel' as const,
    networkId,
    messages: [],
  }));
};

// Helper to wait for debounce
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('TabUpdateBatcher', () => {
  let mockSaveCallback: jest.Mock<Promise<void>, [string, ChannelTab[]]>;
  let batcher: TabUpdateBatcher;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSaveCallback = jest.fn().mockResolvedValue(undefined);
    batcher = new TabUpdateBatcher(100, mockSaveCallback); // Use shorter debounce for tests
  });

  afterEach(async () => {
    await batcher.destroy();
  });

  describe('queueSave', () => {
    it('should queue a save operation', () => {
      const tabs = createMockTabs(3, 'test-net');
      batcher.queueSave('test-net', tabs);

      expect(batcher.hasPendingSaves()).toBe(true);
      expect(batcher.getPendingCount()).toBe(1);
    });

    it('should debounce multiple saves for same network', async () => {
      const tabs1 = createMockTabs(3, 'test-net');
      const tabs2 = createMockTabs(5, 'test-net');

      batcher.queueSave('test-net', tabs1);
      batcher.queueSave('test-net', tabs2);

      expect(batcher.getPendingCount()).toBe(1); // Still just one pending

      await wait(150); // Wait for debounce

      expect(mockSaveCallback).toHaveBeenCalledTimes(1);
      expect(mockSaveCallback).toHaveBeenCalledWith('test-net', tabs2); // Latest tabs
    });

    it('should queue multiple saves for different networks', () => {
      const tabs1 = createMockTabs(3, 'net-1');
      const tabs2 = createMockTabs(3, 'net-2');

      batcher.queueSave('net-1', tabs1);
      batcher.queueSave('net-2', tabs2);

      expect(batcher.getPendingCount()).toBe(2);
    });

    it('should execute saves after debounce period', async () => {
      const tabs = createMockTabs(3, 'test-net');
      batcher.queueSave('test-net', tabs);

      expect(mockSaveCallback).not.toHaveBeenCalled();

      await wait(150); // Wait for debounce

      expect(mockSaveCallback).toHaveBeenCalledTimes(1);
      expect(mockSaveCallback).toHaveBeenCalledWith('test-net', tabs);
    });
  });

  describe('flush', () => {
    it('should execute all pending saves immediately', async () => {
      const tabs1 = createMockTabs(3, 'net-1');
      const tabs2 = createMockTabs(3, 'net-2');

      batcher.queueSave('net-1', tabs1);
      batcher.queueSave('net-2', tabs2);

      expect(mockSaveCallback).not.toHaveBeenCalled();

      await batcher.flush();

      expect(mockSaveCallback).toHaveBeenCalledTimes(2);
      expect(batcher.hasPendingSaves()).toBe(false);
    });

    it('should clear pending saves after flush', async () => {
      const tabs = createMockTabs(3, 'test-net');
      batcher.queueSave('test-net', tabs);

      await batcher.flush();

      expect(batcher.getPendingCount()).toBe(0);
      expect(batcher.hasPendingSaves()).toBe(false);
    });

    it('should handle flush with no pending saves', async () => {
      await expect(batcher.flush()).resolves.not.toThrow();
      expect(mockSaveCallback).not.toHaveBeenCalled();
    });

    it('should handle save callback errors gracefully', async () => {
      mockSaveCallback.mockRejectedValueOnce(new Error('Save failed'));

      const tabs = createMockTabs(3, 'test-net');
      batcher.queueSave('test-net', tabs);

      await expect(batcher.flush()).resolves.not.toThrow();
    });
  });

  describe('hasPendingSaves', () => {
    it('should return false when no saves pending', () => {
      expect(batcher.hasPendingSaves()).toBe(false);
    });

    it('should return true when saves are pending', () => {
      const tabs = createMockTabs(3, 'test-net');
      batcher.queueSave('test-net', tabs);
      expect(batcher.hasPendingSaves()).toBe(true);
    });

    it('should return false after saves executed', async () => {
      const tabs = createMockTabs(3, 'test-net');
      batcher.queueSave('test-net', tabs);
      await batcher.flush();
      expect(batcher.hasPendingSaves()).toBe(false);
    });
  });

  describe('getPendingCount', () => {
    it('should return 0 when no saves pending', () => {
      expect(batcher.getPendingCount()).toBe(0);
    });

    it('should return correct count of pending saves', () => {
      batcher.queueSave('net-1', createMockTabs(3, 'net-1'));
      batcher.queueSave('net-2', createMockTabs(3, 'net-2'));
      batcher.queueSave('net-3', createMockTabs(3, 'net-3'));

      expect(batcher.getPendingCount()).toBe(3);
    });

    it('should decrease after flush', async () => {
      batcher.queueSave('net-1', createMockTabs(3, 'net-1'));
      batcher.queueSave('net-2', createMockTabs(3, 'net-2'));

      expect(batcher.getPendingCount()).toBe(2);

      await batcher.flush();

      expect(batcher.getPendingCount()).toBe(0);
    });
  });

  describe('clear', () => {
    it('should clear all pending saves without executing', async () => {
      batcher.queueSave('net-1', createMockTabs(3, 'net-1'));
      batcher.queueSave('net-2', createMockTabs(3, 'net-2'));

      batcher.clear();

      expect(batcher.hasPendingSaves()).toBe(false);
      expect(mockSaveCallback).not.toHaveBeenCalled();

      await wait(150); // Wait to ensure no delayed execution

      expect(mockSaveCallback).not.toHaveBeenCalled();
    });

    it('should cancel pending timer', async () => {
      batcher.queueSave('test-net', createMockTabs(3, 'test-net'));
      batcher.clear();

      await wait(150);

      expect(mockSaveCallback).not.toHaveBeenCalled();
    });

    it('should be safe to clear when no timer exists', () => {
      expect(() => batcher.clear()).not.toThrow();
      expect(batcher.hasPendingSaves()).toBe(false);
    });
  });

  describe('destroy', () => {
    it('should flush pending saves before destroying', async () => {
      batcher.queueSave('test-net', createMockTabs(3, 'test-net'));

      await batcher.destroy();

      expect(mockSaveCallback).toHaveBeenCalledTimes(1);
      expect(batcher.hasPendingSaves()).toBe(false);
    });

    it('should handle destroy with no pending saves', async () => {
      await expect(batcher.destroy()).resolves.not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle rapid successive queues for same network', async () => {
      const tabs = createMockTabs(3, 'test-net');

      for (let i = 0; i < 10; i++) {
        batcher.queueSave('test-net', [...tabs, { ...tabs[0], id: `new-${i}` }]);
      }

      await wait(150);

      expect(mockSaveCallback).toHaveBeenCalledTimes(1); // Only once due to debounce
    });

    it('should handle empty tabs array', async () => {
      batcher.queueSave('test-net', []);
      await batcher.flush();

      expect(mockSaveCallback).toHaveBeenCalledWith('test-net', []);
    });

    it('should execute saves in parallel for multiple networks', async () => {
      const savePromises: Promise<void>[] = [];
      mockSaveCallback.mockImplementation(() => {
        const promise = new Promise<void>(resolve => setTimeout(resolve, 50));
        savePromises.push(promise);
        return promise;
      });

      batcher.queueSave('net-1', createMockTabs(3, 'net-1'));
      batcher.queueSave('net-2', createMockTabs(3, 'net-2'));
      batcher.queueSave('net-3', createMockTabs(3, 'net-3'));

      await batcher.flush();

      // All saves should have been called
      expect(mockSaveCallback).toHaveBeenCalledTimes(3);
      expect(savePromises.length).toBe(3);
    });

    it('should use default constructor args and default tabService save callback', async () => {
      const defaultBatcher = new TabUpdateBatcher();
      const tabs = createMockTabs(2, 'default-net');

      defaultBatcher.queueSave('default-net', tabs);
      await defaultBatcher.flush();

      expect(tabService.saveTabs).toHaveBeenCalledTimes(1);
      expect(tabService.saveTabs).toHaveBeenCalledWith('default-net', tabs);
    });
  });
});

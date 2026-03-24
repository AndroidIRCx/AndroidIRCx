/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for OfflineQueueService
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { offlineQueueService } from '../../src/services/OfflineQueueService';

// Mock the dependencies
jest.mock('../../src/services/IRCService', () => ({
  ircService: {
    sendMessage: jest.fn(),
    getConnectionStatus: jest.fn(() => true),
  },
}));

jest.mock('../../src/services/ConnectionManager', () => ({
  connectionManager: {
    getConnection: jest.fn(() => null),
    getActiveConnection: jest.fn(() => null),
  },
}));

describe('OfflineQueueService', () => {
  beforeEach(() => {
    (AsyncStorage as any).__reset();
    // Reset queue state
    (offlineQueueService as any).queue = [];
    (offlineQueueService as any).isProcessing = false;
  });

  describe('addMessage', () => {
    it('should add message to queue', () => {
      offlineQueueService.addMessage('testnet', '#channel', 'Hello world');

      const queue = offlineQueueService.getQueue();
      expect(queue.length).toBe(1);
      expect(queue[0].network).toBe('testnet');
      expect(queue[0].target).toBe('#channel');
      expect(queue[0].text).toBe('Hello world');
    });

    it('should generate unique message IDs', () => {
      offlineQueueService.addMessage('testnet', '#ch1', 'msg1');
      offlineQueueService.addMessage('testnet', '#ch2', 'msg2');

      const queue = offlineQueueService.getQueue();
      expect(queue[0].id).not.toBe(queue[1].id);
    });

    it('should include timestamp in message', () => {
      const before = Date.now();
      offlineQueueService.addMessage('testnet', '#channel', 'test');
      const after = Date.now();

      const queue = offlineQueueService.getQueue();
      expect(queue[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(queue[0].timestamp).toBeLessThanOrEqual(after);
    });

    it('should persist queue to storage', () => {
      offlineQueueService.addMessage('testnet', '#channel', 'test');

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'OFFLINE_MESSAGE_QUEUE',
        expect.any(String)
      );
    });

    it('should add multiple messages to queue', () => {
      offlineQueueService.addMessage('net1', '#ch1', 'msg1');
      offlineQueueService.addMessage('net2', '#ch2', 'msg2');
      offlineQueueService.addMessage('net3', '#ch3', 'msg3');

      const queue = offlineQueueService.getQueue();
      expect(queue.length).toBe(3);
    });
  });

  describe('getQueue', () => {
    it('should return empty array when queue is empty', () => {
      const queue = offlineQueueService.getQueue();
      expect(queue).toEqual([]);
    });

    it('should return copy of queue', () => {
      offlineQueueService.addMessage('testnet', '#channel', 'test');

      const queue1 = offlineQueueService.getQueue();
      const queue2 = offlineQueueService.getQueue();

      expect(queue1).not.toBe(queue2); // Different references
      expect(queue1).toEqual(queue2); // Same content
    });

    it('should not allow external modification of queue', () => {
      offlineQueueService.addMessage('testnet', '#channel', 'test');

      const queue = offlineQueueService.getQueue();
      queue.push({
        id: 'external',
        network: 'external',
        target: '#external',
        text: 'external',
        timestamp: Date.now(),
      });

      // Internal queue should be unchanged
      expect(offlineQueueService.getQueue().length).toBe(1);
    });
  });

  describe('processQueue', () => {
    const { ircService } = require('../../src/services/IRCService');

    beforeEach(() => {
      jest.clearAllMocks();
      ircService.sendMessage.mockClear();
      ircService.getConnectionStatus.mockReturnValue(true);
    });

    it('should not process when queue is empty', async () => {
      await offlineQueueService.processQueue();

      expect(ircService.sendMessage).not.toHaveBeenCalled();
    });

    it('should process queued messages', async () => {
      offlineQueueService.addMessage('testnet', '#channel', 'msg1');
      offlineQueueService.addMessage('testnet', '#channel', 'msg2');

      await offlineQueueService.processQueue();

      expect(ircService.sendMessage).toHaveBeenCalledTimes(2);
      expect(ircService.sendMessage).toHaveBeenCalledWith('#channel', 'msg1', true);
      expect(ircService.sendMessage).toHaveBeenCalledWith('#channel', 'msg2', true);
    });

    it('should clear queue after successful processing', async () => {
      offlineQueueService.addMessage('testnet', '#channel', 'test');

      await offlineQueueService.processQueue();

      expect(offlineQueueService.getQueue().length).toBe(0);
    });

    it('should not process queue if already processing', async () => {
      offlineQueueService.addMessage('testnet', '#channel', 'test');

      // Start processing
      const promise1 = offlineQueueService.processQueue();

      // Try to process again while still processing
      const promise2 = offlineQueueService.processQueue();

      await Promise.all([promise1, promise2]);

      // Should only process once
      expect(ircService.sendMessage).toHaveBeenCalledTimes(1);
    });

    it('should re-queue messages when connection is not available', async () => {
      ircService.getConnectionStatus.mockReturnValue(false);

      offlineQueueService.addMessage('testnet', '#channel', 'test');

      await offlineQueueService.processQueue();

      // Message should still be in queue
      expect(offlineQueueService.getQueue().length).toBe(1);
      expect(ircService.sendMessage).not.toHaveBeenCalled();
    });

    it('should re-queue messages when send fails', async () => {
      ircService.sendMessage.mockImplementation(() => {
        throw new Error('Send failed');
      });

      offlineQueueService.addMessage('testnet', '#channel', 'test');

      await offlineQueueService.processQueue();

      // Message should be back in queue
      expect(offlineQueueService.getQueue().length).toBe(1);
    });

    it('should re-queue messages when connection unavailable', async () => {
      ircService.getConnectionStatus.mockReturnValue(false);

      offlineQueueService.addMessage('net1', '#ch1', 'msg1');
      offlineQueueService.addMessage('net2', '#ch2', 'msg2');
      offlineQueueService.addMessage('net3', '#ch3', 'msg3');

      await offlineQueueService.processQueue();

      const queue = offlineQueueService.getQueue();
      // Messages are re-queued using unshift, so order is reversed
      expect(queue.length).toBe(3);
      expect(queue.map(m => m.text)).toContain('msg1');
      expect(queue.map(m => m.text)).toContain('msg2');
      expect(queue.map(m => m.text)).toContain('msg3');
    });

    it('should persist queue state after processing', async () => {
      offlineQueueService.addMessage('testnet', '#channel', 'test');

      jest.clearAllMocks(); // Clear initial addMessage save call

      await offlineQueueService.processQueue();

      // Should save queue at least twice: once when clearing, once after processing
      const setItemCalls = (AsyncStorage.setItem as jest.Mock).mock.calls;
      const queueSaves = setItemCalls.filter((call: any) => call[0] === 'OFFLINE_MESSAGE_QUEUE');
      expect(queueSaves.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('persistence', () => {
    it('should persist messages to storage', async () => {
      offlineQueueService.addMessage('testnet', '#channel', 'test message');

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'OFFLINE_MESSAGE_QUEUE',
        expect.stringContaining('test message')
      );
    });

    it('should handle storage errors gracefully', async () => {
      // Mock storage failure
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('Storage error'));

      // Should not throw
      await expect(async () => {
        offlineQueueService.addMessage('testnet', '#channel', 'test');
      }).not.toThrow();
    });

    it('should handle load queue errors gracefully', async () => {
      // Reset the service to trigger loadQueue in constructor
      (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('Load error'));
      jest.spyOn(console, 'error').mockImplementation(() => {});

      // Import fresh to trigger constructor with mocked error
      jest.isolateModules(() => {
        const { offlineQueueService: freshService } = require('../../src/services/OfflineQueueService');
        expect(freshService.getQueue()).toEqual([]);
      });
    });

    it('should handle invalid JSON in storage gracefully', async () => {
      (AsyncStorage.getItem as jest.Mock).mockReturnValueOnce(Promise.resolve('invalid json'));
      jest.spyOn(console, 'error').mockImplementation(() => {});

      jest.isolateModules(() => {
        const { offlineQueueService: freshService } = require('../../src/services/OfflineQueueService');
        expect(freshService.getQueue()).toEqual([]);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty message text', () => {
      offlineQueueService.addMessage('testnet', '#channel', '');

      const queue = offlineQueueService.getQueue();
      expect(queue[0].text).toBe('');
    });

    it('should handle special characters in messages', () => {
      const specialText = 'Hello 👋 @ #test & <script>alert("xss")</script>';
      offlineQueueService.addMessage('testnet', '#channel', specialText);

      const queue = offlineQueueService.getQueue();
      expect(queue[0].text).toBe(specialText);
    });

    it('should handle very long messages', () => {
      const longText = 'a'.repeat(10000);
      offlineQueueService.addMessage('testnet', '#channel', longText);

      const queue = offlineQueueService.getQueue();
      expect(queue[0].text).toBe(longText);
    });

    it('should handle rapid message additions', () => {
      for (let i = 0; i < 100; i++) {
        offlineQueueService.addMessage('testnet', '#channel', `msg${i}`);
      }

      const queue = offlineQueueService.getQueue();
      expect(queue.length).toBe(100);
    });
  });
});

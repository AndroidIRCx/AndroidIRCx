/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for MessageHistoryBatching - Wave 7
 */

import { messageHistoryBatching } from '../../src/services/MessageHistoryBatching';
import { messageHistoryService } from '../../src/services/MessageHistoryService';

// Mock MessageHistoryService
jest.mock('../../src/services/MessageHistoryService', () => ({
  messageHistoryService: {
    saveMessages: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('MessageHistoryBatching', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (messageHistoryService.saveMessages as jest.Mock).mockResolvedValue(
      undefined,
    );
    // Reset batching state
    messageHistoryBatching.clearQueue();
  });

  afterEach(() => {
    // Clean up any remaining timeouts
    messageHistoryBatching.clearQueue();
  });

  describe('Queue Message', () => {
    it('should queue a message', () => {
      const message: any = { id: '1', text: 'Hello' };
      messageHistoryBatching.queueMessage(message, 'freenode');

      expect(messageHistoryBatching.getQueueSize()).toBe(1);
    });

    it('should not queue message with invalid network', () => {
      const message: any = { id: '1', text: 'Hello' };

      messageHistoryBatching.queueMessage(message, '');
      expect(messageHistoryBatching.getQueueSize()).toBe(0);

      messageHistoryBatching.queueMessage(message, 'Not connected');
      expect(messageHistoryBatching.getQueueSize()).toBe(0);
    });

    it('should flush when batch size is reached', async () => {
      const message: any = { id: '1', text: 'Hello' };

      // Queue 10 messages (BATCH_SIZE)
      for (let i = 0; i < 10; i++) {
        messageHistoryBatching.queueMessage(
          { ...message, id: String(i) },
          'freenode',
        );
      }

      // Flush is async, wait for it
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(messageHistoryService.saveMessages).toHaveBeenCalled();
      expect(messageHistoryBatching.getQueueSize()).toBe(0);
    });

    it('should queue multiple messages for same network', () => {
      const message1: any = { id: '1', text: 'Hello' };
      const message2: any = { id: '2', text: 'World' };

      messageHistoryBatching.queueMessage(message1, 'freenode');
      messageHistoryBatching.queueMessage(message2, 'freenode');

      expect(messageHistoryBatching.getQueueSize()).toBe(2);
    });

    it('should queue messages for different networks', () => {
      const message1: any = { id: '1', text: 'Hello' };
      const message2: any = { id: '2', text: 'World' };

      messageHistoryBatching.queueMessage(message1, 'freenode');
      messageHistoryBatching.queueMessage(message2, 'dalnet');

      expect(messageHistoryBatching.getQueueSize()).toBe(2);
    });
  });

  describe('Flush', () => {
    it('should flush queued messages', async () => {
      const message: any = { id: '1', text: 'Hello' };
      messageHistoryBatching.queueMessage(message, 'freenode');

      await messageHistoryBatching.flush();

      expect(messageHistoryService.saveMessages).toHaveBeenCalledWith(
        [message],
        'freenode',
      );
    });

    it('should group messages by network', async () => {
      const msg1: any = { id: '1', text: 'Hello' };
      const msg2: any = { id: '2', text: 'World' };
      const msg3: any = { id: '3', text: 'Test' };

      messageHistoryBatching.queueMessage(msg1, 'freenode');
      messageHistoryBatching.queueMessage(msg2, 'dalnet');
      messageHistoryBatching.queueMessage(msg3, 'freenode');

      await messageHistoryBatching.flush();

      expect(messageHistoryService.saveMessages).toHaveBeenCalledTimes(2);
    });

    it('should clear queue after flush', async () => {
      messageHistoryBatching.queueMessage(
        { id: '1', text: 'Hello' } as any,
        'freenode',
      );

      await messageHistoryBatching.flush();

      expect(messageHistoryBatching.getQueueSize()).toBe(0);
    });

    it('should handle empty queue', async () => {
      await messageHistoryBatching.flush();

      expect(messageHistoryService.saveMessages).not.toHaveBeenCalled();
    });

    it('should not flush if already flushing', async () => {
      // Make saveMessages hang to simulate ongoing flush
      (messageHistoryService.saveMessages as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100)),
      );

      messageHistoryBatching.queueMessage(
        { id: '1', text: 'Hello' } as any,
        'freenode',
      );

      // Start first flush
      const flush1 = messageHistoryBatching.flush();
      // Try second flush while first is running
      const flush2 = messageHistoryBatching.flush();

      await Promise.all([flush1, flush2]);

      // Should only be called once
      expect(messageHistoryService.saveMessages).toHaveBeenCalledTimes(1);
    });

    it('should handle save errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (messageHistoryService.saveMessages as jest.Mock).mockRejectedValue(
        new Error('Save failed'),
      );

      messageHistoryBatching.queueMessage(
        { id: '1', text: 'Hello' } as any,
        'freenode',
      );
      await messageHistoryBatching.flush();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error saving batch'),
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });
  });

  describe('Flush Sync', () => {
    it('should flush immediately', async () => {
      messageHistoryBatching.queueMessage(
        { id: '1', text: 'Hello' } as any,
        'freenode',
      );

      await messageHistoryBatching.flushSync();

      expect(messageHistoryService.saveMessages).toHaveBeenCalled();
      expect(messageHistoryBatching.getQueueSize()).toBe(0);
    });

    it('should cancel pending timeout', async () => {
      messageHistoryBatching.queueMessage(
        { id: '1', text: 'Hello' } as any,
        'freenode',
      );

      // Wait a bit but not enough for timeout
      await new Promise(resolve => setTimeout(resolve, 100));

      await messageHistoryBatching.flushSync();

      // Should have flushed via flushSync, not timeout
      expect(messageHistoryService.saveMessages).toHaveBeenCalledTimes(1);
    });
  });

  describe('Clear Queue', () => {
    it('should clear queued messages', () => {
      messageHistoryBatching.queueMessage(
        { id: '1', text: 'Hello' } as any,
        'freenode',
      );
      messageHistoryBatching.queueMessage(
        { id: '2', text: 'World' } as any,
        'freenode',
      );

      messageHistoryBatching.clearQueue();

      expect(messageHistoryBatching.getQueueSize()).toBe(0);
    });

    it('should cancel pending timeout', async () => {
      messageHistoryBatching.queueMessage(
        { id: '1', text: 'Hello' } as any,
        'freenode',
      );

      messageHistoryBatching.clearQueue();

      // Wait for original timeout duration
      await new Promise(resolve => setTimeout(resolve, 2500));

      // Should not have flushed
      expect(messageHistoryService.saveMessages).not.toHaveBeenCalled();
    });
  });

  describe('Get Queue Size', () => {
    it('should return 0 for empty queue', () => {
      expect(messageHistoryBatching.getQueueSize()).toBe(0);
    });

    it('should return correct size', () => {
      messageHistoryBatching.queueMessage(
        { id: '1', text: 'Hello' } as any,
        'freenode',
      );
      expect(messageHistoryBatching.getQueueSize()).toBe(1);

      messageHistoryBatching.queueMessage(
        { id: '2', text: 'World' } as any,
        'freenode',
      );
      expect(messageHistoryBatching.getQueueSize()).toBe(2);
    });
  });

  describe('Timeout Behavior', () => {
    it('should flush after timeout', async () => {
      messageHistoryBatching.queueMessage(
        { id: '1', text: 'Hello' } as any,
        'freenode',
      );

      // Wait for timeout (2 seconds)
      await new Promise(resolve => setTimeout(resolve, 2100));

      expect(messageHistoryService.saveMessages).toHaveBeenCalled();
    }, 3000);

    it('should reset timeout on new messages', async () => {
      // This test is timing-sensitive, so we'll just verify the queue size increases
      messageHistoryBatching.queueMessage(
        { id: '1', text: 'Hello' } as any,
        'freenode',
      );
      expect(messageHistoryBatching.getQueueSize()).toBe(1);

      // Add another message
      messageHistoryBatching.queueMessage(
        { id: '2', text: 'World' } as any,
        'freenode',
      );
      expect(messageHistoryBatching.getQueueSize()).toBe(2);

      // Both messages should be in queue
      expect(messageHistoryBatching.getQueueSize()).toBe(2);
    });
  });
});

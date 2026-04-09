/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { MessageBatcher } from '../src/utils/MessageBatcher';
import { IRCMessage } from '../src/services/IRCService';

describe('MessageBatcher', () => {
  let batcher: MessageBatcher;

  beforeEach(() => {
    jest.useFakeTimers();
    batcher = new MessageBatcher(100, 50); // 100ms flush, 50 messages max
  });

  afterEach(() => {
    batcher.destroy();
    jest.useRealTimers();
  });

  const createMessage = (id: string, text: string): IRCMessage => ({
    id,
    text,
    from: 'user',
    channel: '#test',
    timestamp: Date.now(),
    type: 'message',
  });

  describe('addMessage', () => {
    it('should queue a single message', () => {
      const callback = jest.fn();
      batcher.setFlushCallback(callback);

      batcher.addMessage('tab1', createMessage('msg1', 'Hello'));

      expect(batcher.getQueueSize()).toBe(1);
      expect(batcher.hasQueuedMessages()).toBe(true);
      expect(callback).not.toHaveBeenCalled(); // Not flushed yet
    });

    it('should batch multiple messages for same tab', () => {
      batcher.addMessage('tab1', createMessage('msg1', 'Hello'));
      batcher.addMessage('tab1', createMessage('msg2', 'World'));

      const queued = batcher.getQueuedMessages('tab1');
      expect(queued).toHaveLength(2);
      expect(batcher.getQueueSize()).toBe(2);
    });

    it('should batch messages for different tabs separately', () => {
      batcher.addMessage('tab1', createMessage('msg1', 'Hello'));
      batcher.addMessage('tab2', createMessage('msg2', 'World'));

      expect(batcher.getQueuedMessages('tab1')).toHaveLength(1);
      expect(batcher.getQueuedMessages('tab2')).toHaveLength(1);
      expect(batcher.getQueueSize()).toBe(2);
    });

    it('should auto-flush after delay', () => {
      const callback = jest.fn();
      batcher.setFlushCallback(callback);

      batcher.addMessage('tab1', createMessage('msg1', 'Hello'));

      expect(callback).not.toHaveBeenCalled();

      // Fast-forward time
      jest.advanceTimersByTime(100);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        new Map([['tab1', [expect.objectContaining({ text: 'Hello' })]]]),
      );
      expect(batcher.getQueueSize()).toBe(0);
    });

    it('should force flush when max batch size reached', () => {
      const callback = jest.fn();
      batcher.setFlushCallback(callback);

      // Add 50 messages (max batch size)
      for (let i = 0; i < 50; i++) {
        batcher.addMessage('tab1', createMessage(`msg${i}`, `Message ${i}`));
      }

      // Should flush immediately without waiting for timer
      expect(callback).toHaveBeenCalledTimes(1);
      expect(batcher.getQueueSize()).toBe(0);
    });

    it('should eventually flush all messages after timer resets', () => {
      const callback = jest.fn();
      batcher.setFlushCallback(callback);

      batcher.addMessage('tab1', createMessage('msg1', 'Hello'));
      jest.advanceTimersByTime(50); // Half the flush interval

      batcher.addMessage('tab1', createMessage('msg2', 'World'));

      // Complete the full interval from last message
      jest.advanceTimersByTime(100);

      // Should have flushed both messages
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        new Map([
          [
            'tab1',
            expect.arrayContaining([
              expect.objectContaining({ text: 'Hello' }),
              expect.objectContaining({ text: 'World' }),
            ]),
          ],
        ]),
      );
      expect(batcher.getQueueSize()).toBe(0);
    });
  });

  describe('addMessages', () => {
    it('should batch add multiple messages', () => {
      const messages = [
        createMessage('msg1', 'Hello'),
        createMessage('msg2', 'World'),
        createMessage('msg3', 'Test'),
      ];

      batcher.addMessages('tab1', messages);

      expect(batcher.getQueueSize()).toBe(3);
      expect(batcher.getQueuedMessages('tab1')).toHaveLength(3);
    });

    it('should handle empty array', () => {
      batcher.addMessages('tab1', []);
      expect(batcher.getQueueSize()).toBe(0);
    });

    it('should force flush if total exceeds max batch size', () => {
      const callback = jest.fn();
      batcher.setFlushCallback(callback);

      const messages = Array.from({ length: 60 }, (_, i) =>
        createMessage(`msg${i}`, `Message ${i}`),
      );

      batcher.addMessages('tab1', messages);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(batcher.getQueueSize()).toBe(0);
    });
  });

  describe('flush', () => {
    it('should flush all queued messages immediately', () => {
      const callback = jest.fn();
      batcher.setFlushCallback(callback);

      batcher.addMessage('tab1', createMessage('msg1', 'Hello'));
      batcher.addMessage('tab2', createMessage('msg2', 'World'));

      batcher.flush();

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        new Map([
          ['tab1', [expect.objectContaining({ text: 'Hello' })]],
          ['tab2', [expect.objectContaining({ text: 'World' })]],
        ]),
      );
      expect(batcher.getQueueSize()).toBe(0);
    });

    it('should cancel scheduled flush', () => {
      const callback = jest.fn();
      batcher.setFlushCallback(callback);

      batcher.addMessage('tab1', createMessage('msg1', 'Hello'));
      batcher.flush();

      // Advance timer - should not trigger another flush
      jest.advanceTimersByTime(100);

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should do nothing if queue is empty', () => {
      const callback = jest.fn();
      batcher.setFlushCallback(callback);

      batcher.flush();

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('clear', () => {
    it('should clear queue without flushing', () => {
      const callback = jest.fn();
      batcher.setFlushCallback(callback);

      batcher.addMessage('tab1', createMessage('msg1', 'Hello'));
      batcher.clear();

      expect(batcher.getQueueSize()).toBe(0);
      expect(callback).not.toHaveBeenCalled();
    });

    it('should cancel scheduled flush', () => {
      const callback = jest.fn();
      batcher.setFlushCallback(callback);

      batcher.addMessage('tab1', createMessage('msg1', 'Hello'));
      batcher.clear();

      jest.advanceTimersByTime(100);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('should flush pending messages on destroy', () => {
      const callback = jest.fn();
      batcher.setFlushCallback(callback);

      batcher.addMessage('tab1', createMessage('msg1', 'Hello'));
      batcher.destroy();

      expect(callback).toHaveBeenCalledTimes(1);
      expect(batcher.getQueueSize()).toBe(0);
    });
  });

  describe('getQueuedMessages', () => {
    it('should return queued messages for specific tab', () => {
      batcher.addMessage('tab1', createMessage('msg1', 'Hello'));
      batcher.addMessage('tab1', createMessage('msg2', 'World'));
      batcher.addMessage('tab2', createMessage('msg3', 'Test'));

      const tab1Messages = batcher.getQueuedMessages('tab1');
      expect(tab1Messages).toHaveLength(2);
      expect(tab1Messages[0].text).toBe('Hello');
      expect(tab1Messages[1].text).toBe('World');
    });

    it('should return empty array for non-existent tab', () => {
      const messages = batcher.getQueuedMessages('nonexistent');
      expect(messages).toEqual([]);
    });
  });
});

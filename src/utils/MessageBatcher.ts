/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * MessageBatcher.ts
 *
 * Batches rapid message updates to reduce re-renders and improve performance.
 * Instead of updating state for every incoming message, queues them and flushes
 * in batches every N milliseconds.
 */

import { IRCMessage } from '../services/IRCService';

export interface BatchedUpdate {
  tabId: string;
  messages: IRCMessage[];
  timestamp: number;
}

export type FlushCallback = (updates: Map<string, IRCMessage[]>) => void;

export class MessageBatcher {
  private queue: Map<string, IRCMessage[]> = new Map();
  private flushTimer: NodeJS.Timeout | null = null;
  private readonly flushInterval: number;
  private readonly maxBatchSize: number;
  private flushCallback: FlushCallback | null = null;
  private messageCount: number = 0;

  /**
   * Create a new message batcher
   * @param flushInterval Time in ms between batch flushes (default: 100ms)
   * @param maxBatchSize Maximum messages before forcing a flush (default: 50)
   */
  constructor(flushInterval: number = 100, maxBatchSize: number = 50) {
    this.flushInterval = flushInterval;
    this.maxBatchSize = maxBatchSize;
  }

  /**
   * Set the callback to be called when messages are flushed
   */
  setFlushCallback(callback: FlushCallback): void {
    this.flushCallback = callback;
  }

  /**
   * Add a message to the batch queue
   */
  addMessage(tabId: string, message: IRCMessage): void {
    if (!this.queue.has(tabId)) {
      this.queue.set(tabId, []);
    }

    this.queue.get(tabId)!.push(message);
    this.messageCount++;

    // Force flush if batch size exceeded
    if (this.messageCount >= this.maxBatchSize) {
      this.flush();
    } else {
      // Schedule flush if not already scheduled
      this.scheduleFlush();
    }
  }

  /**
   * Add multiple messages at once
   */
  addMessages(tabId: string, messages: IRCMessage[]): void {
    if (messages.length === 0) return;

    if (!this.queue.has(tabId)) {
      this.queue.set(tabId, []);
    }

    this.queue.get(tabId)!.push(...messages);
    this.messageCount += messages.length;

    // Force flush if batch size exceeded
    if (this.messageCount >= this.maxBatchSize) {
      this.flush();
    } else {
      this.scheduleFlush();
    }
  }

  /**
   * Flush all queued messages immediately
   */
  flush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.queue.size === 0) {
      return;
    }

    // Call flush callback with batched messages
    if (this.flushCallback) {
      const batchedUpdates = new Map(this.queue);
      this.flushCallback(batchedUpdates);
    }

    // Clear queue
    this.queue.clear();
    this.messageCount = 0;
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.messageCount;
  }

  /**
   * Get queued messages for a specific tab
   */
  getQueuedMessages(tabId: string): IRCMessage[] {
    return this.queue.get(tabId) || [];
  }

  /**
   * Check if there are queued messages
   */
  hasQueuedMessages(): boolean {
    return this.messageCount > 0;
  }

  /**
   * Clear all queued messages without flushing
   */
  clear(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.queue.clear();
    this.messageCount = 0;
  }

  /**
   * Destroy the batcher and cleanup
   */
  destroy(): void {
    this.flush();
    this.flushCallback = null;
  }

  /**
   * PRIVATE: Schedule a flush operation
   */
  private scheduleFlush(): void {
    if (this.flushTimer) {
      return; // Already scheduled
    }

    this.flushTimer = setTimeout(() => {
      this.flush();
    }, this.flushInterval);
  }
}

// Create a singleton instance
export const messageBatcher = new MessageBatcher(100, 50);

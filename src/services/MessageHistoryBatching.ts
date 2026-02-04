/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * MessageHistoryBatching.ts
 *
 * Batches message history writes to reduce AsyncStorage I/O operations.
 * Collects messages and saves them in batches of 10 (or after timeout).
 */

import { IRCMessage } from './IRCService';
import { messageHistoryService } from './MessageHistoryService';

interface QueuedMessage {
  message: IRCMessage;
  network: string;
}

class MessageHistoryBatching {
  private readonly BATCH_SIZE = 10;
  private readonly BATCH_TIMEOUT_MS = 2000; // 2 seconds

  private queue: QueuedMessage[] = [];
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private isFlushing = false;

  /**
   * Queue a message for batched saving
   */
  queueMessage(message: IRCMessage, network: string): void {
    // Don't queue if network is invalid
    if (!network || network === 'Not connected') {
      return;
    }

    this.queue.push({ message, network });

    // Flush if batch size reached
    if (this.queue.length >= this.BATCH_SIZE) {
      this.flush();
      return;
    }

    // Set timeout for first message in batch
    if (this.queue.length === 1 && !this.timeoutId) {
      this.timeoutId = setTimeout(() => {
        this.flush();
      }, this.BATCH_TIMEOUT_MS);
    }
  }

  /**
   * Flush all queued messages to storage
   */
  async flush(): Promise<void> {
    if (this.isFlushing || this.queue.length === 0) {
      return;
    }

    // Clear timeout
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    this.isFlushing = true;

    try {
      // Group messages by network
      const messagesByNetwork = new Map<string, IRCMessage[]>();

      // Process all queued messages
      const messagesToProcess = [...this.queue];
      this.queue = [];

      messagesToProcess.forEach(({ message, network }) => {
        if (!messagesByNetwork.has(network)) {
          messagesByNetwork.set(network, []);
        }
        messagesByNetwork.get(network)!.push(message);
      });

      // Save each network's messages in batch
      const savePromises = Array.from(messagesByNetwork.entries()).map(([network, messages]) =>
        messageHistoryService.saveMessages(messages, network).catch(err => {
          console.error(`MessageHistoryBatching: Error saving batch for ${network}:`, err);
        })
      );

      await Promise.all(savePromises);
    } catch (error) {
      console.error('MessageHistoryBatching: Error flushing batch:', error);
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Force flush and wait for completion (useful on app exit)
   */
  async flushSync(): Promise<void> {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    await this.flush();
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Clear any queued messages without flushing
   */
  clearQueue(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.queue = [];
  }
}

export const messageHistoryBatching = new MessageHistoryBatching();

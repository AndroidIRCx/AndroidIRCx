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
  private readonly RETRY_BASE_DELAY_MS = 3000;
  private readonly RETRY_MAX_DELAY_MS = 30000;

  private queue: QueuedMessage[] = [];
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private retryTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private isFlushing = false;
  private retryAttempts = 0;

  /**
   * Queue a message for batched saving
   */
  queueMessage(message: IRCMessage, network: string): void {
    // Don't queue if network is invalid
    if (!network || network === 'Not connected') {
      return;
    }

    this.queue.push({ message, network });
    // New traffic indicates link/storage recovered; clear pending retry backoff.
    this.resetRetryTimer();

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
      const failedMessages: QueuedMessage[] = [];
      const savePromises = Array.from(messagesByNetwork.entries()).map(
        async ([network, messages]) => {
          try {
            await messageHistoryService.saveMessages(messages, network);
          } catch (err) {
            console.error(
              `MessageHistoryBatching: Error saving batch for ${network}:`,
              err,
            );
            messages.forEach(message =>
              failedMessages.push({ message, network }),
            );
          }
        },
      );

      await Promise.all(savePromises);

      if (failedMessages.length > 0) {
        // Preserve failed messages for retry; prepend so ordering is maintained.
        this.queue = [...failedMessages, ...this.queue];
        this.scheduleRetryFlush();
      } else {
        this.retryAttempts = 0;
      }
    } catch (error) {
      console.error('MessageHistoryBatching: Error flushing batch:', error);
      this.scheduleRetryFlush();
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
    this.resetRetryTimer();
    this.queue = [];
  }

  private scheduleRetryFlush(): void {
    if (this.retryTimeoutId || this.queue.length === 0) {
      return;
    }
    const delay = Math.min(
      this.RETRY_BASE_DELAY_MS * Math.pow(2, this.retryAttempts),
      this.RETRY_MAX_DELAY_MS,
    );
    this.retryAttempts++;
    this.retryTimeoutId = setTimeout(() => {
      this.retryTimeoutId = null;
      this.flush().catch(err => {
        console.error('MessageHistoryBatching: Retry flush failed:', err);
      });
    }, delay);
  }

  private resetRetryTimer(): void {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }
    this.retryAttempts = 0;
  }
}

export const messageHistoryBatching = new MessageHistoryBatching();

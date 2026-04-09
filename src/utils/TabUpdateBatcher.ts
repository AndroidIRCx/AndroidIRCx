/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * TabUpdateBatcher.ts
 *
 * Debounces tab save operations to reduce AsyncStorage writes.
 * Instead of saving on every tab change, queues saves and executes them
 * after a delay with no new updates.
 */

import { ChannelTab } from '../types';
import { tabService } from '../services/TabService';

export type SaveCallback = (
  networkId: string,
  tabs: ChannelTab[],
) => Promise<void>;

interface PendingSave {
  networkId: string;
  tabs: ChannelTab[];
  timestamp: number;
}

export class TabUpdateBatcher {
  private pendingSaves: Map<string, PendingSave> = new Map();
  private saveTimer: NodeJS.Timeout | null = null;
  private readonly debounceMs: number;
  private saveCallback: SaveCallback;

  /**
   * Create a new tab update batcher
   * @param debounceMs Time in ms to wait before saving (default: 2000ms)
   * @param saveCallback Function to call when saving tabs
   */
  constructor(
    debounceMs: number = 2000,
    saveCallback: SaveCallback = (networkId, tabs) =>
      tabService.saveTabs(networkId, tabs),
  ) {
    this.debounceMs = debounceMs;
    this.saveCallback = saveCallback;
  }

  /**
   * Queue a tab save operation (debounced)
   */
  queueSave(networkId: string, tabs: ChannelTab[]): void {
    // Update or add pending save
    this.pendingSaves.set(networkId, {
      networkId,
      tabs,
      timestamp: Date.now(),
    });

    // Reset debounce timer
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }

    this.saveTimer = setTimeout(() => {
      this.executeSaves();
    }, this.debounceMs);
  }

  /**
   * Execute all pending saves immediately
   */
  async flush(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }

    await this.executeSaves();
  }

  /**
   * Check if there are pending saves
   */
  hasPendingSaves(): boolean {
    return this.pendingSaves.size > 0;
  }

  /**
   * Get number of pending saves
   */
  getPendingCount(): number {
    return this.pendingSaves.size;
  }

  /**
   * Clear all pending saves without executing them
   */
  clear(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.pendingSaves.clear();
  }

  /**
   * Destroy the batcher and flush pending saves
   */
  async destroy(): Promise<void> {
    await this.flush();
  }

  /**
   * PRIVATE: Execute all pending save operations
   */
  private async executeSaves(): Promise<void> {
    this.saveTimer = null;

    if (this.pendingSaves.size === 0) {
      return;
    }

    const saves = Array.from(this.pendingSaves.values());
    this.pendingSaves.clear();

    // Execute all saves in parallel
    const savePromises = saves.map(({ networkId, tabs }) => {
      return this.saveCallback(networkId, tabs).catch(error => {
        console.error(`Failed to save tabs for network ${networkId}:`, error);
      });
    });

    await Promise.all(savePromises);
  }
}

// Create singleton instance
export const tabUpdateBatcher = new TabUpdateBatcher(2000);

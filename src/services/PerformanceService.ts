/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PerformanceConfig {
  enableVirtualization: boolean; // Use FlatList instead of ScrollView
  maxVisibleMessages: number; // Max messages to render at once (default: 100)
  messageLoadChunk: number; // Number of messages to load when scrolling up (default: 50)
  enableLazyLoading: boolean; // Lazy load old messages when scrolling up
  messageLimit: number; // Max messages to keep in memory per channel (default: 1000)
  enableMessageCleanup: boolean; // Automatically cleanup old messages
  cleanupThreshold: number; // Cleanup when messages exceed this count (default: 1500)
  renderOptimization: boolean; // Use React.memo and useMemo for optimization
  imageLazyLoad: boolean; // Lazy load images (only load when visible)
  userListGrouping: boolean; // Group users by mode (ops/voice)
  userListVirtualization: boolean; // Use FlatList for large user lists
  userListAutoDisableGroupingThreshold: number; // Disable grouping above N users
  userListAutoVirtualizeThreshold: number; // Enable virtualization above N users
  // UserList type selection (for testing)
  userListType: 'flashlist' | 'flatlist' | 'grouped' | 'simple';
  // UserList search debounce
  userListSearchDebounceMs: number;
  // UserList skip sort threshold
  userListSkipSortThreshold: number;
  // UserList chunk loading
  userListEnableChunkLoading: boolean;
  userListChunkSize: number;
  userListInitialRenderCount: number;
}

class PerformanceService {
  private config: PerformanceConfig = {
    enableVirtualization: true,
    maxVisibleMessages: 100,
    messageLoadChunk: 50,
    enableLazyLoading: true,
    messageLimit: 1000,
    enableMessageCleanup: false,
    cleanupThreshold: 1500,
    renderOptimization: true,
    imageLazyLoad: true,
    userListGrouping: true,
    userListVirtualization: true,
    userListAutoDisableGroupingThreshold: 1000,
    userListAutoVirtualizeThreshold: 500,
    userListType: 'flashlist',
    userListSearchDebounceMs: 300,
    userListSkipSortThreshold: 1000,
    userListEnableChunkLoading: true,
    userListChunkSize: 100,
    userListInitialRenderCount: 50,
  };

  private listeners: Array<(config: PerformanceConfig) => void> = [];
  private readonly STORAGE_KEY = '@AndroidIRCX:performanceConfig';

  /**
   * Initialize performance service
   */
  async initialize(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        this.config = { ...this.config, ...data };
      }
    } catch (error) {
      console.error('Failed to load performance config:', error);
    }
  }

  /**
   * Get current config
   */
  getConfig(): PerformanceConfig {
    return { ...this.config };
  }

  /**
   * Update config
   */
  async setConfig(updates: Partial<PerformanceConfig>): Promise<void> {
    this.config = { ...this.config, ...updates };
    await this.saveConfig();
    this.notifyListeners();
  }

  /**
   * Get max visible messages
   */
  getMaxVisibleMessages(): number {
    return this.config.maxVisibleMessages;
  }

  /**
   * Get message load chunk size
   */
  getMessageLoadChunk(): number {
    return this.config.messageLoadChunk;
  }

  /**
   * Check if virtualization is enabled
   */
  isVirtualizationEnabled(): boolean {
    return this.config.enableVirtualization;
  }

  /**
   * Check if lazy loading is enabled
   */
  isLazyLoadingEnabled(): boolean {
    return this.config.enableLazyLoading;
  }

  /**
   * Check if render optimization is enabled
   */
  isRenderOptimizationEnabled(): boolean {
    return this.config.renderOptimization;
  }

  /**
   * Check if image lazy load is enabled
   */
  isImageLazyLoadEnabled(): boolean {
    return this.config.imageLazyLoad;
  }

  /**
   * Get message limit per channel
   */
  getMessageLimit(): number {
    return this.config.messageLimit;
  }

  /**
   * Check if message cleanup is enabled
   */
  isMessageCleanupEnabled(): boolean {
    return this.config.enableMessageCleanup;
  }

  /**
   * Get cleanup threshold
   */
  getCleanupThreshold(): number {
    return this.config.cleanupThreshold;
  }

  /**
   * Get user list type
   */
  getUserListType(): 'flashlist' | 'flatlist' | 'grouped' | 'simple' {
    return this.config.userListType;
  }

  /**
   * Get user list search debounce ms
   */
  getUserListSearchDebounceMs(): number {
    return this.config.userListSearchDebounceMs;
  }

  /**
   * Get user list skip sort threshold
   */
  getUserListSkipSortThreshold(): number {
    return this.config.userListSkipSortThreshold;
  }

  /**
   * Listen for config changes
   */
  onConfigChange(callback: (config: PerformanceConfig) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  /**
   * Notify listeners
   */
  private notifyListeners(): void {
    const config = this.getConfig();
    this.listeners.forEach(callback => {
      try {
        callback(config);
      } catch (error) {
        console.error('Error in performance config listener:', error);
      }
    });
  }

  /**
   * Save configuration
   */
  private async saveConfig(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.config));
    } catch (error) {
      console.error('Failed to save performance config:', error);
    }
  }
}

export const performanceService = new PerformanceService();


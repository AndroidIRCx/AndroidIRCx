/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * MessageHistoryService
 *
 * Manages persistent message history storage, search, filtering, and export.
 * Messages are stored per network and channel/query for efficient retrieval.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { IRCMessage } from './IRCService';
import { storageCache } from './StorageCache';
import { tx } from '../i18n/transifex';
import { messageHistoryBatching } from './MessageHistoryBatching';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

export interface MessageHistoryFilter {
  network?: string;
  channel?: string;
  from?: string;
  text?: string; // Search in message text
  type?: IRCMessage['type'];
  startDate?: number; // Timestamp
  endDate?: number; // Timestamp
  excludeRaw?: boolean;
}

export interface MessageHistoryStats {
  totalMessages: number;
  messagesByChannel: Map<string, number>;
  messagesByUser: Map<string, number>;
  oldestMessage?: number;
  newestMessage?: number;
}

export interface ExportOptions {
  format: 'json' | 'txt' | 'csv';
  filter?: MessageHistoryFilter;
  includeTimestamps?: boolean;
  includeMetadata?: boolean;
}

class MessageHistoryService {
  private readonly STORAGE_PREFIX = '@AndroidIRCX:history:';
  private readonly MAX_MESSAGES_PER_CHANNEL = 10000; // Limit to prevent storage issues
  private readonly CLEANUP_THRESHOLD = 12000; // Cleanup when exceeding this
  private migrationInProgress = false;
  private migrationCompleted = false;

  /**
   * Save a message to history (uses batching for better performance)
   * Messages are queued and saved in batches of 10 or after 2 seconds
   */
  async saveMessage(message: IRCMessage, network: string): Promise<void> {
    // Don't queue if network is invalid
    if (!network || network === 'Not connected') {
      return;
    }

    // Queue message for batched saving
    messageHistoryBatching.queueMessage(message, network);
    
    // Note: Actual save happens asynchronously in batches
    // For immediate save, use saveMessages() directly
  }

  /**
   * Save multiple messages at once (batch operation)
   */
  async saveMessages(messages: IRCMessage[], network: string): Promise<void> {
    // Group messages by channel
    const messagesByChannel = new Map<string, IRCMessage[]>();

    messages.forEach(msg => {
      const channel = msg.channel || 'server';
      if (!messagesByChannel.has(channel)) {
        messagesByChannel.set(channel, []);
      }
      messagesByChannel.get(channel)!.push(msg);
    });

    // Save each channel's messages using StorageCache for automatic batching
    const promises = Array.from(messagesByChannel.entries()).map(([channel, msgs]) => {
      const key = this.getStorageKey(network, channel);
      return this.loadMessagesByKey(key).then(existing => {
        const combined = [...existing, ...msgs];
        // Limit and sort by timestamp
        const sorted = combined
          .sort((a, b) => a.timestamp - b.timestamp)
          .slice(-this.MAX_MESSAGES_PER_CHANNEL);
        return storageCache.setItem(key, sorted);
      });
    });

    await Promise.all(promises);
  }

  /**
   * Load messages for a specific network and channel
   */
  async loadMessages(network: string, channel?: string): Promise<IRCMessage[]> {
    try {
      const key = this.getStorageKey(network, channel || 'server');
      const data = await storageCache.getItem<IRCMessage[]>(key, {
        ttl: 5 * 60 * 1000,
      });
      if (data) return data;

      // Fallback: some older entries may be stored under legacy MESSAGES_ keys
      const legacyKey = this.getLegacyStorageKey(network, channel || 'server');
      const legacyData = await storageCache.getItem<IRCMessage[]>(legacyKey, {
        ttl: 5 * 60 * 1000,
      });
      return legacyData || [];
    } catch (error) {
      console.error('MessageHistoryService: Error loading messages:', error);
      return [];
    }
  }

  /**
   * Load all messages for a network
   */
  async loadAllNetworkMessages(network: string): Promise<IRCMessage[]> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const networkKeys = keys.filter(key => 
        key.startsWith(`${this.STORAGE_PREFIX}${network}:`)
      );
      
      const allMessages: IRCMessage[] = [];
      for (const key of networkKeys) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          const messages = JSON.parse(data);
          allMessages.push(...messages);
        }
      }
      
      // Sort by timestamp
      return allMessages.sort((a, b) => a.timestamp - b.timestamp);
    } catch (error) {
      console.error('MessageHistoryService: Error loading network messages:', error);
      return [];
    }
  }

  /**
   * Search messages with filter
   */
  async searchMessages(filter: MessageHistoryFilter): Promise<IRCMessage[]> {
    try {
      let messages: IRCMessage[] = [];
      
      // Load messages based on filter
      if (filter.network) {
        if (filter.channel) {
          messages = await this.loadMessages(filter.network, filter.channel);
        } else {
          messages = await this.loadAllNetworkMessages(filter.network);
        }
      } else {
        // Load from all networks (slower)
        const allKeys = await AsyncStorage.getAllKeys();
        const historyKeys = allKeys.filter(key => key.startsWith(this.STORAGE_PREFIX));
        
        for (const key of historyKeys) {
          const data = await AsyncStorage.getItem(key);
          if (data) {
            messages.push(...JSON.parse(data));
          }
        }
      }
      
      // Apply filters
      return this.applyFilters(messages, filter);
    } catch (error) {
      console.error('MessageHistoryService: Error searching messages:', error);
      return [];
    }
  }

  /**
   * Apply filters to messages
   */
  private applyFilters(messages: IRCMessage[], filter: MessageHistoryFilter): IRCMessage[] {
    return messages.filter(msg => {
      // Filter by channel
      if (filter.channel && msg.channel !== filter.channel) {
        return false;
      }
      
      // Filter by from/user
      if (filter.from && msg.from) {
        const fromLower = msg.from.toLowerCase();
        const filterLower = filter.from.toLowerCase();
        if (!fromLower.includes(filterLower)) {
          return false;
        }
      }
      
      // Filter by text content
      if (filter.text) {
        const textLower = msg.text.toLowerCase();
        const filterTextLower = filter.text.toLowerCase();
        if (!textLower.includes(filterTextLower)) {
          return false;
        }
      }
      
      // Filter by type
      if (filter.type && msg.type !== filter.type) {
        return false;
      }
      
      // Filter by date range
      if (filter.startDate && msg.timestamp < filter.startDate) {
        return false;
      }
      if (filter.endDate && msg.timestamp > filter.endDate) {
        return false;
      }
      
      // Exclude raw messages
      if (filter.excludeRaw && (msg.isRaw || msg.type === 'raw')) {
        return false;
      }
      
      return true;
    });
  }

  /**
   * Get message history statistics
   */
  async getStats(network?: string): Promise<MessageHistoryStats> {
    try {
      let messages: IRCMessage[] = [];
      
      if (network) {
        messages = await this.loadAllNetworkMessages(network);
      } else {
        // Load from all networks
        const allKeys = await AsyncStorage.getAllKeys();
        const historyKeys = allKeys.filter(key => key.startsWith(this.STORAGE_PREFIX));
        
        for (const key of historyKeys) {
          const data = await AsyncStorage.getItem(key);
          if (data) {
            messages.push(...JSON.parse(data));
          }
        }
      }
      
      const stats: MessageHistoryStats = {
        totalMessages: messages.length,
        messagesByChannel: new Map(),
        messagesByUser: new Map(),
      };
      
      let oldest: number | undefined;
      let newest: number | undefined;
      
      messages.forEach(msg => {
        // Count by channel
        const channel = msg.channel || 'server';
        stats.messagesByChannel.set(
          channel,
          (stats.messagesByChannel.get(channel) || 0) + 1
        );
        
        // Count by user
        if (msg.from) {
          stats.messagesByUser.set(
            msg.from,
            (stats.messagesByUser.get(msg.from) || 0) + 1
          );
        }
        
        // Track oldest/newest
        if (!oldest || msg.timestamp < oldest) {
          oldest = msg.timestamp;
        }
        if (!newest || msg.timestamp > newest) {
          newest = msg.timestamp;
        }
      });
      
      stats.oldestMessage = oldest;
      stats.newestMessage = newest;
      
      return stats;
    } catch (error) {
      console.error('MessageHistoryService: Error getting stats:', error);
      return {
        totalMessages: 0,
        messagesByChannel: new Map(),
        messagesByUser: new Map(),
      };
    }
  }

  /**
   * Export message history
   */
  async exportHistory(options: ExportOptions): Promise<string> {
    try {
      let messages: IRCMessage[] = [];
      
      // Load messages based on filter
      if (options.filter) {
        messages = await this.searchMessages(options.filter);
      } else {
        // Load all messages
        const allKeys = await AsyncStorage.getAllKeys();
        const historyKeys = allKeys.filter(key => key.startsWith(this.STORAGE_PREFIX));
        
        for (const key of historyKeys) {
          const data = await AsyncStorage.getItem(key);
          if (data) {
            messages.push(...JSON.parse(data));
          }
        }
        
        // Sort by timestamp
        messages.sort((a, b) => a.timestamp - b.timestamp);
      }
      
      // Format based on export type
      switch (options.format) {
        case 'json':
          return this.exportJSON(messages, options);
        case 'txt':
          return this.exportTXT(messages, options);
        case 'csv':
          return this.exportCSV(messages, options);
        default:
          return this.exportTXT(messages, options);
      }
    } catch (error) {
      console.error('MessageHistoryService: Error exporting history:', error);
      throw error;
    }
  }

  /**
   * Export as JSON
   */
  private exportJSON(messages: IRCMessage[], options: ExportOptions): string {
    const exportData = {
      exportedAt: new Date().toISOString(),
      messageCount: messages.length,
      messages: messages.map(msg => ({
        id: msg.id,
        type: msg.type,
        channel: msg.channel,
        from: msg.from,
        text: msg.text,
        timestamp: options.includeTimestamps ? msg.timestamp : undefined,
        timestampISO: options.includeTimestamps 
          ? new Date(msg.timestamp).toISOString() 
          : undefined,
        isRaw: options.includeMetadata ? msg.isRaw : undefined,
      })),
    };
    
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Export as plain text
   */
  private exportTXT(messages: IRCMessage[], options: ExportOptions): string {
    const lines: string[] = [];
    lines.push(t('AndroidIRCX Message History Export'));
    lines.push(t('Exported: {timestamp}', { timestamp: new Date().toISOString() }));
    lines.push(t('Messages: {count}', { count: messages.length }));
    lines.push('');
    lines.push('='.repeat(80));
    lines.push('');
    
    messages.forEach(msg => {
      const date = new Date(msg.timestamp);
      const timestamp = options.includeTimestamps 
        ? `[${date.toLocaleString()}] ` 
        : '';
      
      const channel = msg.channel ? `[${msg.channel}] ` : '';
      const from = msg.from ? `<${msg.from}> ` : '';
      
      lines.push(`${timestamp}${channel}${from}${msg.text}`);
    });
    
    return lines.join('\n');
  }

  /**
   * Export as CSV
   */
  private exportCSV(messages: IRCMessage[], options: ExportOptions): string {
    const lines: string[] = [];
    
    // Header
    const headers = [
      t('Timestamp'),
      t('Type'),
      t('Channel'),
      t('From'),
      t('Text'),
    ];
    if (!options.includeTimestamps) {
      headers.shift(); // Remove timestamp if not included
    }
    lines.push(headers.join(','));
    
    // Data rows
    messages.forEach(msg => {
      const date = new Date(msg.timestamp);
      const timestamp = date.toISOString();
      const row: string[] = [];
      
      if (options.includeTimestamps) {
        row.push(`"${timestamp}"`);
      }
      row.push(`"${msg.type}"`);
      row.push(`"${msg.channel || ''}"`);
      row.push(`"${msg.from || ''}"`);
      row.push(`"${msg.text.replace(/"/g, '""')}"`); // Escape quotes in CSV
      
      lines.push(row.join(','));
    });
    
    return lines.join('\n');
  }

  /**
   * Delete messages for a specific network and channel
   */
  async deleteMessages(network: string, channel?: string): Promise<void> {
    try {
      const key = this.getStorageKey(network, channel || 'server');
      // Use StorageCache to remove from both memory and storage
      await storageCache.removeItem(key);
    } catch (error) {
      console.error('MessageHistoryService: Error deleting messages:', error);
      throw error;
    }
  }

  /**
   * Delete all messages for a network
   */
  async deleteNetworkMessages(network: string): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const networkKeys = keys.filter(key =>
        key.startsWith(`${this.STORAGE_PREFIX}${network}:`)
      );

      // Use StorageCache to remove from both memory and storage
      await Promise.all(networkKeys.map(key => storageCache.removeItem(key)));
    } catch (error) {
      console.error('MessageHistoryService: Error deleting network messages:', error);
      throw error;
    }
  }

  /**
   * Delete a single message by id
   */
  async deleteMessageById(network: string, channel: string, messageId: string): Promise<void> {
    try {
      const key = this.getStorageKey(network, channel || 'server');
      const data = await AsyncStorage.getItem(key);
      if (!data) return;
      const messages: IRCMessage[] = JSON.parse(data);
      const filtered = messages.filter(msg => msg.id !== messageId);
      if (filtered.length === 0) {
        await storageCache.removeItem(key);
      } else {
        await storageCache.setItem(key, filtered);
      }
    } catch (error) {
      console.error('MessageHistoryService: Error deleting message:', error);
      throw error;
    }
  }

  /**
   * List stored history channels with counts
   */
  async listStoredChannels(): Promise<Array<{ network: string; channel: string; count: number; newest?: number; oldest?: number }>> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const historyKeys = keys.filter(key => key.startsWith(this.STORAGE_PREFIX));
      const legacyKeys = keys.filter(key => key.startsWith('MESSAGES_'));
      const allKeys = [...historyKeys, ...legacyKeys];
      if (allKeys.length === 0) return [];

      const entries = await AsyncStorage.multiGet(allKeys);
      const results: Array<{ network: string; channel: string; count: number; newest?: number; oldest?: number }> = [];
      const dedupeMap = new Map<string, { network: string; channel: string; count: number; newest?: number; oldest?: number }>();

      for (const [key, value] of entries) {
        if (!key || !value) continue;
        const parsed = key.startsWith(this.STORAGE_PREFIX)
          ? this.parseStorageKey(key)
          : this.parseLegacyStorageKey(key);
        if (!parsed) continue;
        let messages: IRCMessage[] = [];
        try {
          messages = JSON.parse(value);
        } catch {
          continue;
        }
        if (!Array.isArray(messages)) continue;
        let newest: number | undefined;
        let oldest: number | undefined;
        messages.forEach(msg => {
          if (!oldest || msg.timestamp < oldest) oldest = msg.timestamp;
          if (!newest || msg.timestamp > newest) newest = msg.timestamp;
        });
        const item = {
          network: parsed.network,
          channel: parsed.channel,
          count: messages.length,
          newest,
          oldest,
        };
        const dedupeKey = `${item.network}:${item.channel}`;
        const existing = dedupeMap.get(dedupeKey);
        if (!existing || (existing.count ?? 0) < item.count) {
          dedupeMap.set(dedupeKey, item);
        }
      }

      return Array.from(dedupeMap.values());
    } catch (error) {
      console.error('MessageHistoryService: Error listing stored channels:', error);
      return [];
    }
  }

  /**
   * Clear all stored history
   */
  async clearAll(): Promise<void> {
    try {
      messageHistoryBatching.clearQueue();
      const keys = await AsyncStorage.getAllKeys();
      const historyKeys = keys.filter(key => key.startsWith(this.STORAGE_PREFIX));
      await Promise.all(historyKeys.map(key => storageCache.removeItem(key)));
    } catch (error) {
      console.error('MessageHistoryService: Error clearing history:', error);
      throw error;
    }
  }

  /**
   * Cleanup old messages (keep only recent ones)
   */
  private async cleanupOldMessages(key: string): Promise<void> {
    try {
      const messages = await this.loadMessagesByKey(key);
      if (messages.length > this.MAX_MESSAGES_PER_CHANNEL) {
        // Keep only the most recent messages
        const sorted = messages.sort((a, b) => b.timestamp - a.timestamp);
        const kept = sorted.slice(0, this.MAX_MESSAGES_PER_CHANNEL);
        // Use StorageCache for automatic write batching (2s debounce)
        await storageCache.setItem(key, kept);
      }
    } catch (error) {
      console.error('MessageHistoryService: Error in cleanup:', error);
    }
  }

  /**
   * Get storage key for a network and channel
   */
  private getStorageKey(network: string, channel: string): string {
    // Sanitize channel name for storage key
    const sanitizedChannel = channel.replace(/[^a-zA-Z0-9_#&+!-]/g, '_');
    return `${this.STORAGE_PREFIX}${network}:${sanitizedChannel}`;
  }

  private getLegacyStorageKey(network: string, channel: string): string {
    const sanitizedChannel = channel.replace(/[^a-zA-Z0-9_#&+!-]/g, '_');
    return `MESSAGES_${network}_${sanitizedChannel}`;
  }

  private parseStorageKey(key: string): { network: string; channel: string } | null {
    if (!key.startsWith(this.STORAGE_PREFIX)) return null;
    const rest = key.slice(this.STORAGE_PREFIX.length);
    // Network identifiers can contain ':' (e.g. host:port). Channel is sanitized and
    // cannot contain ':', so the separator is the *last* ':' in the remainder.
    const idx = rest.lastIndexOf(':');
    if (idx === -1) return null;
    return {
      network: rest.slice(0, idx),
      channel: rest.slice(idx + 1),
    };
  }

  private parseLegacyStorageKey(key: string): { network: string; channel: string } | null {
    if (!key.startsWith('MESSAGES_')) return null;
    const rest = key.slice('MESSAGES_'.length);
    const idx = rest.indexOf('_');
    if (idx === -1) return null;
    return {
      network: rest.slice(0, idx),
      channel: rest.slice(idx + 1),
    };
  }

  async ensureHistoryMigrated(
    onProgress?: (processed: number, total: number) => void
  ): Promise<{ migrated: boolean; total: number; migratedCount: number }> {
    if (this.migrationCompleted || this.migrationInProgress) {
      return { migrated: false, total: 0, migratedCount: 0 };
    }
    this.migrationInProgress = true;
    try {
      const keys = await AsyncStorage.getAllKeys();
      const legacyKeys = keys.filter(key => key.startsWith('MESSAGES_'));
      if (legacyKeys.length === 0) {
        this.migrationCompleted = true;
        return { migrated: false, total: 0, migratedCount: 0 };
      }

      const legacyEntries = await AsyncStorage.multiGet(legacyKeys);
      const writes: { key: string; value: IRCMessage[] }[] = [];
      const removes: string[] = [];
      let migratedCount = 0;
      let processed = 0;
      const total = legacyEntries.length;

      for (const [legacyKey, legacyValue] of legacyEntries) {
        processed++;
        if (onProgress) {
          try {
            onProgress(processed, total);
          } catch {
            // ignore progress callback errors
          }
        }
        if (!legacyKey || !legacyValue) continue;
        const parsed = this.parseLegacyStorageKey(legacyKey);
        if (!parsed) continue;
        let messages: IRCMessage[] = [];
        try {
          messages = JSON.parse(legacyValue);
        } catch {
          continue;
        }
        if (!Array.isArray(messages) || messages.length === 0) {
          removes.push(legacyKey);
          continue;
        }

        const newKey = this.getStorageKey(parsed.network, parsed.channel);
        const existing = await storageCache.getItem<IRCMessage[]>(newKey, { ttl: 0 });
        const merged = existing ? [...existing, ...messages] : [...messages];
        const sorted = merged
          .sort((a, b) => a.timestamp - b.timestamp)
          .slice(-this.MAX_MESSAGES_PER_CHANNEL);
        writes.push({ key: newKey, value: sorted });
        removes.push(legacyKey);
        migratedCount++;
      }

      if (writes.length > 0) {
        await storageCache.setBatch(writes);
      }
      if (removes.length > 0) {
        await storageCache.removeBatch(removes);
      }
      this.migrationCompleted = true;
      return { migrated: migratedCount > 0, total, migratedCount };
    } catch (error) {
      console.error('MessageHistoryService: Error migrating legacy history:', error);
      return { migrated: false, total: 0, migratedCount: 0 };
    } finally {
      this.migrationInProgress = false;
    }
  }

  /**
   * Load messages from storage key (internal helper)
   */
  private async loadMessagesByKey(key: string): Promise<IRCMessage[]> {
    try {
      // Use StorageCache for in-memory caching and faster access
      const data = await storageCache.getItem<IRCMessage[]>(key, {
        ttl: 5 * 60 * 1000, // Cache for 5 minutes
      });
      if (data) {
        return data;
      }
      return [];
    } catch (error) {
      console.error('MessageHistoryService: Error loading from key:', error);
      return [];
    }
  }
}

export const messageHistoryService = new MessageHistoryService();


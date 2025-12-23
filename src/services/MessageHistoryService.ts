/**
 * MessageHistoryService
 * 
 * Manages persistent message history storage, search, filtering, and export.
 * Messages are stored per network and channel/query for efficient retrieval.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { IRCMessage } from './IRCService';

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

  /**
   * Save a message to history
   */
  async saveMessage(message: IRCMessage, network: string): Promise<void> {
    try {
      const key = this.getStorageKey(network, message.channel || 'server');
      const messages = await this.loadMessages(key);
      
      // Add new message
      messages.push(message);
      
      // Limit message count per channel
      if (messages.length > this.MAX_MESSAGES_PER_CHANNEL) {
        // Remove oldest messages
        messages.splice(0, messages.length - this.MAX_MESSAGES_PER_CHANNEL);
      }
      
      // Save back to storage
      await AsyncStorage.setItem(key, JSON.stringify(messages));
      
      // Periodic cleanup if needed
      if (messages.length > this.CLEANUP_THRESHOLD) {
        this.cleanupOldMessages(key).catch(err => 
          console.error('MessageHistoryService: Cleanup error:', err)
        );
      }
    } catch (error) {
      console.error('MessageHistoryService: Error saving message:', error);
    }
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
    
    // Save each channel's messages
    const promises = Array.from(messagesByChannel.entries()).map(([channel, msgs]) => {
      const key = this.getStorageKey(network, channel);
      return this.loadMessages(key).then(existing => {
        const combined = [...existing, ...msgs];
        // Limit and sort by timestamp
        const sorted = combined
          .sort((a, b) => a.timestamp - b.timestamp)
          .slice(-this.MAX_MESSAGES_PER_CHANNEL);
        return AsyncStorage.setItem(key, JSON.stringify(sorted));
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
      const data = await AsyncStorage.getItem(key);
      if (data) {
        return JSON.parse(data);
      }
      return [];
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
    lines.push('AndroidIRCX Message History Export');
    lines.push(`Exported: ${new Date().toISOString()}`);
    lines.push(`Messages: ${messages.length}`);
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
    const headers = ['Timestamp', 'Type', 'Channel', 'From', 'Text'];
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
      await AsyncStorage.removeItem(key);
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
      
      await AsyncStorage.multiRemove(networkKeys);
    } catch (error) {
      console.error('MessageHistoryService: Error deleting network messages:', error);
      throw error;
    }
  }

  /**
   * Cleanup old messages (keep only recent ones)
   */
  private async cleanupOldMessages(key: string): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(key);
      if (data) {
        const messages: IRCMessage[] = JSON.parse(data);
        if (messages.length > this.MAX_MESSAGES_PER_CHANNEL) {
          // Keep only the most recent messages
          const sorted = messages.sort((a, b) => b.timestamp - a.timestamp);
          const kept = sorted.slice(0, this.MAX_MESSAGES_PER_CHANNEL);
          await AsyncStorage.setItem(key, JSON.stringify(kept));
        }
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

  /**
   * Load messages from storage key (internal helper)
   */
  private async loadMessages(key: string): Promise<IRCMessage[]> {
    try {
      const data = await AsyncStorage.getItem(key);
      if (data) {
        return JSON.parse(data);
      }
      return [];
    } catch (error) {
      console.error('MessageHistoryService: Error loading from key:', error);
      return [];
    }
  }
}

export const messageHistoryService = new MessageHistoryService();


/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for MessageHistoryService - Wave 2 coverage target
 */

import { messageHistoryService, MessageHistoryFilter, ExportOptions } from '../../src/services/MessageHistoryService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { storageCache } from '../../src/services/StorageCache';
import { IRCMessage } from '../../src/services/IRCService';

jest.mock('../../src/services/MessageHistoryBatching', () => ({
  messageHistoryBatching: {
    queueMessage: jest.fn(),
    clearQueue: jest.fn(),
  },
}));

jest.mock('../../src/services/StorageCache', () => ({
  storageCache: {
    getItem: jest.fn(),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
    removeBatch: jest.fn().mockResolvedValue(undefined),
    setBatch: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('MessageHistoryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage as any).__reset && (AsyncStorage as any).__reset();
    
    // Reset all mock implementations to default success values
    (storageCache.getItem as jest.Mock).mockResolvedValue(null);
    (storageCache.setItem as jest.Mock).mockResolvedValue(undefined);
    (storageCache.removeItem as jest.Mock).mockResolvedValue(undefined);
    (storageCache.removeBatch as jest.Mock).mockResolvedValue(undefined);
    (storageCache.setBatch as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([]);
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.multiRemove as jest.Mock).mockResolvedValue(undefined);
  });

  const mockMessage: IRCMessage = {
    id: 'msg-1',
    type: 'message',
    from: 'User1',
    text: 'Hello world',
    channel: '#general',
    timestamp: Date.now(),
    network: 'freenode',
  };

  describe('saveMessage', () => {
    it('should queue message for batching', async () => {
      const { messageHistoryBatching } = require('../../src/services/MessageHistoryBatching');
      
      await messageHistoryService.saveMessage(mockMessage, 'freenode');
      
      expect(messageHistoryBatching.queueMessage).toHaveBeenCalledWith(mockMessage, 'freenode');
    });

    it('should not queue if network is invalid', async () => {
      const { messageHistoryBatching } = require('../../src/services/MessageHistoryBatching');
      
      await messageHistoryService.saveMessage(mockMessage, 'Not connected');
      
      expect(messageHistoryBatching.queueMessage).not.toHaveBeenCalled();
    });

    it('should not queue if network is empty', async () => {
      const { messageHistoryBatching } = require('../../src/services/MessageHistoryBatching');
      
      await messageHistoryService.saveMessage(mockMessage, '');
      
      expect(messageHistoryBatching.queueMessage).not.toHaveBeenCalled();
    });
  });

  describe('saveMessages', () => {
    it('should save multiple messages grouped by channel', async () => {
      const messages: IRCMessage[] = [
        { ...mockMessage, channel: '#general' },
        { ...mockMessage, id: 'msg-2', channel: '#general' },
        { ...mockMessage, id: 'msg-3', channel: '#help' },
      ];

      (storageCache.getItem as jest.Mock).mockResolvedValue([]);

      await messageHistoryService.saveMessages(messages, 'freenode');

      expect(storageCache.setItem).toHaveBeenCalledTimes(2);
    });

    it('should limit messages per channel', async () => {
      const messages: IRCMessage[] = Array.from({ length: 100 }, (_, i) => ({
        ...mockMessage,
        id: `msg-${i}`,
        timestamp: Date.now() + i,
      }));

      (storageCache.getItem as jest.Mock).mockResolvedValue(
        Array.from({ length: 9950 }, (_, i) => ({ ...mockMessage, id: `existing-${i}` }))
      );

      await messageHistoryService.saveMessages(messages, 'freenode');

      // Should be limited to 10000 messages
      expect(storageCache.setItem).toHaveBeenCalled();
    });
  });

  describe('loadMessages', () => {
    it('should load messages from cache', async () => {
      const storedMessages = [mockMessage];
      (storageCache.getItem as jest.Mock).mockResolvedValue(storedMessages);

      const result = await messageHistoryService.loadMessages('freenode', '#general');

      expect(result).toEqual(storedMessages);
    });

    it('should fallback to legacy key if cache miss', async () => {
      (storageCache.getItem as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce([mockMessage]);

      const result = await messageHistoryService.loadMessages('freenode', '#general');

      expect(result).toEqual([mockMessage]);
    });

    it('should return empty array on error', async () => {
      (storageCache.getItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      const result = await messageHistoryService.loadMessages('freenode', '#general');

      expect(result).toEqual([]);
    });

    it('should merge history across channel case variants', async () => {
      const lowerMessage = { ...mockMessage, id: 'lower', channel: '#general', timestamp: 1000 };
      const upperMessage = { ...mockMessage, id: 'upper', channel: '#General', timestamp: 2000 };

      (storageCache.getItem as jest.Mock).mockImplementation(async (key: string) => {
        if (key === '@AndroidIRCX:history:freenode:#general') {
          return [lowerMessage];
        }
        if (key === '@AndroidIRCX:history:freenode:#General') {
          return [upperMessage];
        }
        return null;
      });

      const result = await messageHistoryService.loadMessages('freenode', '#General');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('lower');
      expect(result[1].id).toBe('upper');
    });
  });

  describe('loadAllNetworkMessages', () => {
    it('should load all messages for a network', async () => {
      const keys = [
        '@AndroidIRCX:history:freenode:#general',
        '@AndroidIRCX:history:freenode:#help',
      ];
      (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue(keys);
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([mockMessage]));

      const result = await messageHistoryService.loadAllNetworkMessages('freenode');

      expect(result).toHaveLength(2);
    });

    it('should sort messages by timestamp', async () => {
      const keys = ['@AndroidIRCX:history:freenode:#general'];
      const messages = [
        { ...mockMessage, timestamp: 300 },
        { ...mockMessage, id: 'msg-2', timestamp: 100 },
        { ...mockMessage, id: 'msg-3', timestamp: 200 },
      ];
      (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue(keys);
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(messages));

      const result = await messageHistoryService.loadAllNetworkMessages('freenode');

      expect(result[0].timestamp).toBe(100);
      expect(result[1].timestamp).toBe(200);
      expect(result[2].timestamp).toBe(300);
    });

    it('should return empty array on error', async () => {
      (AsyncStorage.getAllKeys as jest.Mock).mockRejectedValue(new Error('Storage error'));

      const result = await messageHistoryService.loadAllNetworkMessages('freenode');

      expect(result).toEqual([]);
    });
  });

  describe('searchMessages', () => {
    const mockMessages: IRCMessage[] = [
      { ...mockMessage, channel: '#general', from: 'User1', text: 'Hello world' },
      { ...mockMessage, id: 'msg-2', channel: '#help', from: 'User2', text: 'Need help' },
      { ...mockMessage, id: 'msg-3', channel: '#general', from: 'User1', text: 'Another message' },
    ];

    beforeEach(() => {
      (storageCache.getItem as jest.Mock).mockResolvedValue(mockMessages);
    });

    it('should search by channel', async () => {
      const filter: MessageHistoryFilter = { network: 'freenode', channel: '#general' };
      
      const result = await messageHistoryService.searchMessages(filter);

      expect(result.every(m => m.channel === '#general')).toBe(true);
    });

    it('should search by from/user', async () => {
      const filter: MessageHistoryFilter = { network: 'freenode', from: 'User1' };
      
      const result = await messageHistoryService.searchMessages(filter);

      expect(result.every(m => m.from?.toLowerCase().includes('user1'))).toBe(true);
    });

    it('should search by text content', async () => {
      const filter: MessageHistoryFilter = { network: 'freenode', text: 'hello' };
      
      const result = await messageHistoryService.searchMessages(filter);

      expect(result.every(m => m.text.toLowerCase().includes('hello'))).toBe(true);
    });

    it('should search by type', async () => {
      const filter: MessageHistoryFilter = { network: 'freenode', type: 'message' };
      
      const result = await messageHistoryService.searchMessages(filter);

      expect(result.every(m => m.type === 'message')).toBe(true);
    });

    it('should exclude raw messages', async () => {
      const messagesWithRaw = [
        ...mockMessages,
        { ...mockMessage, id: 'msg-4', type: 'raw', isRaw: true },
      ];
      (storageCache.getItem as jest.Mock).mockResolvedValue(messagesWithRaw);

      const filter: MessageHistoryFilter = { network: 'freenode', excludeRaw: true };
      
      const result = await messageHistoryService.searchMessages(filter);

      expect(result.every(m => m.type !== 'raw')).toBe(true);
    });

    it('should search across all networks if no network specified', async () => {
      const keys = [
        '@AndroidIRCX:history:freenode:#general',
        '@AndroidIRCX:history:libera:#general',
      ];
      (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue(keys);
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([mockMessage]));

      const filter: MessageHistoryFilter = {};
      
      const result = await messageHistoryService.searchMessages(filter);

      expect(result).toHaveLength(2);
    });
  });

  describe('getStats', () => {
    it('should return stats for all networks if no network specified', async () => {
      const keys = [
        '@AndroidIRCX:history:freenode:#general',
        '@AndroidIRCX:history:libera:#general',
      ];
      (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue(keys);
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([mockMessage]));

      const stats = await messageHistoryService.getStats();

      expect(stats.totalMessages).toBe(2);
    });

    it('should track oldest and newest messages', async () => {
      const messages: IRCMessage[] = [
        { ...mockMessage, timestamp: 1000 },
        { ...mockMessage, id: 'msg-2', timestamp: 2000 },
        { ...mockMessage, id: 'msg-3', timestamp: 3000 },
      ];
      (storageCache.getItem as jest.Mock).mockResolvedValue(messages);
      (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([
        '@AndroidIRCX:history:freenode:#general',
      ]);
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(messages));

      const stats = await messageHistoryService.getStats('freenode');

      expect(stats.oldestMessage).toBe(1000);
      expect(stats.newestMessage).toBe(3000);
    });

    it('should return empty stats on error', async () => {
      (AsyncStorage.getAllKeys as jest.Mock).mockRejectedValue(new Error('Storage error'));

      const stats = await messageHistoryService.getStats('freenode');

      expect(stats.totalMessages).toBe(0);
      expect(stats.messagesByChannel.size).toBe(0);
    });
  });

  describe('exportHistory', () => {
    const mockMessages: IRCMessage[] = [
      { ...mockMessage, channel: '#general', timestamp: 1609459200000 },
      { ...mockMessage, id: 'msg-2', channel: '#help', timestamp: 1609459300000 },
    ];

    beforeEach(() => {
      (storageCache.getItem as jest.Mock).mockResolvedValue(mockMessages);
      (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([
        '@AndroidIRCX:history:freenode:#general',
        '@AndroidIRCX:history:freenode:#help',
      ]);
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockMessages));
    });

    it('should export as JSON', async () => {
      const options: ExportOptions = { format: 'json' };
      
      const result = await messageHistoryService.exportHistory(options);

      expect(JSON.parse(result)).toHaveProperty('messages');
      expect(JSON.parse(result)).toHaveProperty('exportedAt');
    });

    it('should export as TXT', async () => {
      const options: ExportOptions = { format: 'txt' };
      
      const result = await messageHistoryService.exportHistory(options);

      expect(result).toContain('AndroidIRCX Message History Export');
      expect(result).toContain('Hello world');
    });

    it('should respect filter', async () => {
      const options: ExportOptions = { 
        format: 'json',
        filter: { network: 'freenode', channel: '#general' }
      };
      
      const result = await messageHistoryService.exportHistory(options);

      const parsed = JSON.parse(result);
      expect(parsed.messages.every((m: any) => m.channel === '#general')).toBe(true);
    });

    it('should exclude timestamps if specified', async () => {
      const options: ExportOptions = { format: 'csv', includeTimestamps: false };
      
      const result = await messageHistoryService.exportHistory(options);

      expect(result).toContain('Type,Channel');
      expect(result).not.toContain('Timestamp');
    });

    it('should escape quotes in CSV', async () => {
      const messagesWithQuotes = [
        { ...mockMessage, text: 'He said "Hello"' },
      ];
      (storageCache.getItem as jest.Mock).mockResolvedValue(messagesWithQuotes);
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(messagesWithQuotes));

      const options: ExportOptions = { format: 'csv' };
      
      const result = await messageHistoryService.exportHistory(options);

      expect(result).toContain('"He said ""Hello"""');
    });

    it('should default to TXT for unknown format', async () => {
      const options: ExportOptions = { format: 'unknown' as any };
      
      const result = await messageHistoryService.exportHistory(options);

      expect(result).toContain('AndroidIRCX Message History Export');
    });
  });

  describe('deleteMessages', () => {
    it('should delete messages for channel', async () => {
      await messageHistoryService.deleteMessages('freenode', '#general');

      expect(storageCache.removeItem).toHaveBeenCalled();
    });

    it('should default to server channel if not specified', async () => {
      await messageHistoryService.deleteMessages('freenode');

      expect(storageCache.removeItem).toHaveBeenCalledWith(expect.stringContaining('server'));
    });

    it('should throw on error', async () => {
      (storageCache.removeItem as jest.Mock).mockRejectedValue(new Error('Delete error'));

      await expect(messageHistoryService.deleteMessages('freenode', '#general')).rejects.toThrow();
    });
  });

  describe('deleteNetworkMessages', () => {
    it('should throw on error', async () => {
      (AsyncStorage.getAllKeys as jest.Mock).mockRejectedValue(new Error('Keys error'));

      await expect(messageHistoryService.deleteNetworkMessages('freenode')).rejects.toThrow();
    });
  });

  describe('deleteMessageById', () => {
    it('should delete single message by id', async () => {
      const messages = [mockMessage, { ...mockMessage, id: 'msg-2' }];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(messages));

      await messageHistoryService.deleteMessageById('freenode', '#general', 'msg-1');

      expect(storageCache.setItem).toHaveBeenCalled();
    });

    it('should remove storage key if no messages left', async () => {
      const messages = [mockMessage];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(messages));

      await messageHistoryService.deleteMessageById('freenode', '#general', 'msg-1');

      expect(storageCache.removeItem).toHaveBeenCalled();
    });
  });

  describe('listStoredChannels', () => {
    it('should list all stored channels with counts', async () => {
      const keys = [
        '@AndroidIRCX:history:freenode:#general',
        '@AndroidIRCX:history:freenode:#help',
      ];
      (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue(keys);
      (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
        [keys[0], JSON.stringify([mockMessage, { ...mockMessage, id: 'msg-2' }])],
        [keys[1], JSON.stringify([mockMessage])],
      ]);

      const result = await messageHistoryService.listStoredChannels();

      expect(result).toHaveLength(2);
      expect(result[0].count).toBe(2);
      expect(result[1].count).toBe(1);
    });

    it('should handle legacy keys', async () => {
      const keys = ['MESSAGES_freenode_#general'];
      (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue(keys);
      (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
        [keys[0], JSON.stringify([mockMessage])],
      ]);

      const result = await messageHistoryService.listStoredChannels();

      expect(result).toHaveLength(1);
      expect(result[0].network).toBe('freenode');
    });

    it('should deduplicate by network:channel', async () => {
      // Both legacy and new format for same channel
      const keys = [
        '@AndroidIRCX:history:freenode:#general',
        'MESSAGES_freenode_#general',
      ];
      (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue(keys);
      (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
        [keys[0], JSON.stringify([mockMessage, { ...mockMessage, id: 'msg-2' }])], // 2 messages
        [keys[1], JSON.stringify([mockMessage])], // 1 message
      ]);

      const result = await messageHistoryService.listStoredChannels();

      expect(result).toHaveLength(1);
      expect(result[0].count).toBe(2); // Should pick the one with more messages
    });

    it('should return empty array on error', async () => {
      (AsyncStorage.getAllKeys as jest.Mock).mockRejectedValue(new Error('Keys error'));

      const result = await messageHistoryService.listStoredChannels();

      expect(result).toEqual([]);
    });
  });

  describe('clearAll', () => {
    it('should throw on error', async () => {
      (AsyncStorage.getAllKeys as jest.Mock).mockRejectedValue(new Error('Keys error'));

      await expect(messageHistoryService.clearAll()).rejects.toThrow();
    });
  });

  describe('ensureHistoryMigrated', () => {
    it('should migrate legacy keys to new format', async () => {
      const legacyKeys = ['MESSAGES_freenode_#general'];
      const messages = [mockMessage];
      (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue(legacyKeys);
      (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
        [legacyKeys[0], JSON.stringify(messages)],
      ]);
      (storageCache.getItem as jest.Mock).mockResolvedValue(null);

      const result = await messageHistoryService.ensureHistoryMigrated();

      expect(result.migrated).toBe(true);
      expect(result.migratedCount).toBe(1);
      expect(storageCache.setBatch).toHaveBeenCalled();
      expect(storageCache.removeBatch).toHaveBeenCalled();
    });

    it('should skip if no legacy keys', async () => {
      (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([
        '@AndroidIRCX:history:freenode:#general',
      ]);

      const result = await messageHistoryService.ensureHistoryMigrated();

      expect(result.migrated).toBe(false);
    });

    it('should skip if migration already completed', async () => {
      await messageHistoryService.ensureHistoryMigrated();
      (storageCache.setBatch as jest.Mock).mockClear();

      const result = await messageHistoryService.ensureHistoryMigrated();

      expect(result.migrated).toBe(false);
      expect(storageCache.setBatch).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      (AsyncStorage.getAllKeys as jest.Mock).mockRejectedValue(new Error('Keys error'));

      const result = await messageHistoryService.ensureHistoryMigrated();

      expect(result.migrated).toBe(false);
    });
  });
});

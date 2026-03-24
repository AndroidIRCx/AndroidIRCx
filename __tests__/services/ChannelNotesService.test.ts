/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for ChannelNotesService - 100% coverage target
 */

import { channelNotesService, ChannelLogEntry } from '../../src/services/ChannelNotesService';

// Mock AsyncStorage
const mockStorage: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(async (key: string, value: string) => {
    mockStorage[key] = value;
  }),
  getItem: jest.fn(async (key: string) => {
    return mockStorage[key] || null;
  }),
  removeItem: jest.fn(async (key: string) => {
    delete mockStorage[key];
  }),
}));

describe('ChannelNotesService', () => {
  beforeEach(() => {
    // Clear storage and reset service state
    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
    // Reset service internal state
    (channelNotesService as any).notes = {};
    (channelNotesService as any).bookmarks = new Set();
    (channelNotesService as any).logs = {};
    (channelNotesService as any).initialized = false;
  });

  describe('setNote / getNote', () => {
    it('should set and get a note', async () => {
      await channelNotesService.setNote('freenode', '#general', 'Test note');
      const note = await channelNotesService.getNote('freenode', '#general');
      expect(note).toBe('Test note');
    });

    it('should return empty string for unset note', async () => {
      const note = await channelNotesService.getNote('freenode', '#unknown');
      expect(note).toBe('');
    });

    it('should delete note when setting empty string', async () => {
      await channelNotesService.setNote('freenode', '#general', 'Test note');
      await channelNotesService.setNote('freenode', '#general', '');
      const note = await channelNotesService.getNote('freenode', '#general');
      expect(note).toBe('');
    });

    it('should delete note when setting whitespace only', async () => {
      await channelNotesService.setNote('freenode', '#general', 'Test note');
      await channelNotesService.setNote('freenode', '#general', '   ');
      const note = await channelNotesService.getNote('freenode', '#general');
      expect(note).toBe('');
    });

    it('should handle multiple networks independently', async () => {
      await channelNotesService.setNote('freenode', '#general', 'Freenode note');
      await channelNotesService.setNote('libera', '#general', 'Libera note');
      
      expect(await channelNotesService.getNote('freenode', '#general')).toBe('Freenode note');
      expect(await channelNotesService.getNote('libera', '#general')).toBe('Libera note');
    });

    it('should handle multiple channels on same network', async () => {
      await channelNotesService.setNote('freenode', '#general', 'General note');
      await channelNotesService.setNote('freenode', '#random', 'Random note');
      
      expect(await channelNotesService.getNote('freenode', '#general')).toBe('General note');
      expect(await channelNotesService.getNote('freenode', '#random')).toBe('Random note');
    });

    it('should persist notes to storage', async () => {
      await channelNotesService.setNote('freenode', '#general', 'Persistent note');
      
      expect(mockStorage.channelNotes).toBeDefined();
      const stored = JSON.parse(mockStorage.channelNotes);
      expect(stored['freenode::#general']).toBe('Persistent note');
    });
  });

  describe('setBookmarked / isBookmarked', () => {
    it('should set and check bookmark', async () => {
      await channelNotesService.setBookmarked('freenode', '#general', true);
      const isBookmarked = await channelNotesService.isBookmarked('freenode', '#general');
      expect(isBookmarked).toBe(true);
    });

    it('should return false for unset bookmark', async () => {
      const isBookmarked = await channelNotesService.isBookmarked('freenode', '#unknown');
      expect(isBookmarked).toBe(false);
    });

    it('should remove bookmark when set to false', async () => {
      await channelNotesService.setBookmarked('freenode', '#general', true);
      await channelNotesService.setBookmarked('freenode', '#general', false);
      const isBookmarked = await channelNotesService.isBookmarked('freenode', '#general');
      expect(isBookmarked).toBe(false);
    });

    it('should persist bookmarks to storage', async () => {
      await channelNotesService.setBookmarked('freenode', '#general', true);
      
      expect(mockStorage.channelBookmarks).toBeDefined();
      const stored = JSON.parse(mockStorage.channelBookmarks);
      expect(stored).toContain('freenode::#general');
    });

    it('should handle multiple bookmarks', async () => {
      await channelNotesService.setBookmarked('freenode', '#general', true);
      await channelNotesService.setBookmarked('freenode', '#random', true);
      await channelNotesService.setBookmarked('libera', '#general', true);
      
      expect(await channelNotesService.isBookmarked('freenode', '#general')).toBe(true);
      expect(await channelNotesService.isBookmarked('freenode', '#random')).toBe(true);
      expect(await channelNotesService.isBookmarked('libera', '#general')).toBe(true);
    });
  });

  describe('addLogEntry / getLog', () => {
    it('should add and retrieve log entry', async () => {
      const entry: ChannelLogEntry = { timestamp: Date.now(), text: 'Test message' };
      await channelNotesService.addLogEntry('freenode', '#general', entry);
      const log = await channelNotesService.getLog('freenode', '#general');
      expect(log).toHaveLength(1);
      expect(log[0].text).toBe('Test message');
    });

    it('should return empty array for unset log', async () => {
      const log = await channelNotesService.getLog('freenode', '#unknown');
      expect(log).toEqual([]);
    });

    it('should keep last 200 entries', async () => {
      // Add 250 entries
      for (let i = 0; i < 250; i++) {
        await channelNotesService.addLogEntry('freenode', '#general', {
          timestamp: Date.now(),
          text: `Message ${i}`,
        });
      }
      
      const log = await channelNotesService.getLog('freenode', '#general');
      expect(log).toHaveLength(200);
      expect(log[0].text).toBe('Message 50'); // First 50 were dropped
      expect(log[199].text).toBe('Message 249');
    });

    it('should persist logs to storage', async () => {
      const entry: ChannelLogEntry = { timestamp: 1234567890, text: 'Log entry' };
      await channelNotesService.addLogEntry('freenode', '#general', entry);
      
      expect(mockStorage.channelLogs).toBeDefined();
      const stored = JSON.parse(mockStorage.channelLogs);
      expect(stored['freenode::#general']).toHaveLength(1);
    });

    it('should handle multiple channel logs independently', async () => {
      await channelNotesService.addLogEntry('freenode', '#general', {
        timestamp: Date.now(),
        text: 'General message',
      });
      await channelNotesService.addLogEntry('freenode', '#random', {
        timestamp: Date.now(),
        text: 'Random message',
      });
      
      const generalLog = await channelNotesService.getLog('freenode', '#general');
      const randomLog = await channelNotesService.getLog('freenode', '#random');
      
      expect(generalLog[0].text).toBe('General message');
      expect(randomLog[0].text).toBe('Random message');
    });
  });

  describe('clearLog', () => {
    it('should clear log for channel', async () => {
      await channelNotesService.addLogEntry('freenode', '#general', {
        timestamp: Date.now(),
        text: 'Test',
      });
      await channelNotesService.clearLog('freenode', '#general');
      
      const log = await channelNotesService.getLog('freenode', '#general');
      expect(log).toEqual([]);
    });

    it('should persist cleared log', async () => {
      await channelNotesService.addLogEntry('freenode', '#general', {
        timestamp: Date.now(),
        text: 'Test',
      });
      await channelNotesService.clearLog('freenode', '#general');
      
      const stored = JSON.parse(mockStorage.channelLogs);
      expect(stored['freenode::#general']).toBeUndefined();
    });
  });

  describe('ensureLoaded', () => {
    it('should load data from storage on first access', async () => {
      // Pre-populate storage
      mockStorage.channelNotes = JSON.stringify({ 'freenode::#general': 'Loaded note' });
      mockStorage.channelBookmarks = JSON.stringify(['freenode::#general']);
      mockStorage.channelLogs = JSON.stringify({
        'freenode::#general': [{ timestamp: 1234567890, text: 'Loaded log' }],
      });
      
      const note = await channelNotesService.getNote('freenode', '#general');
      const isBookmarked = await channelNotesService.isBookmarked('freenode', '#general');
      const log = await channelNotesService.getLog('freenode', '#general');
      
      expect(note).toBe('Loaded note');
      expect(isBookmarked).toBe(true);
      expect(log[0].text).toBe('Loaded log');
    });

    it('should handle storage errors gracefully', async () => {
      // Make getItem throw error
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      AsyncStorage.getItem.mockRejectedValueOnce(new Error('Storage error'));
      
      // Should not throw
      await expect(channelNotesService.getNote('freenode', '#general')).resolves.toBe('');
    });

    it('should not reload if already initialized', async () => {
      await channelNotesService.getNote('freenode', '#general'); // First load
      
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      AsyncStorage.getItem.mockClear();
      
      await channelNotesService.getNote('freenode', '#general'); // Should not reload
      
      expect(AsyncStorage.getItem).not.toHaveBeenCalled();
    });
  });
});

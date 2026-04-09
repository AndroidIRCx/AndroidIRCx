/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for MessageReactionsService
 */

import { messageReactionsService } from '../../src/services/MessageReactionsService';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('MessageReactionsService', () => {
  beforeEach(async () => {
    (AsyncStorage as any).__reset();
    // Reset service state
    (messageReactionsService as any).reactions = new Map();
    (messageReactionsService as any).listeners = [];
  });

  describe('initialize', () => {
    it('should initialize without errors', async () => {
      await expect(messageReactionsService.initialize()).resolves.not.toThrow();
    });

    it('should load saved reactions from storage', async () => {
      const savedReactions = {
        'msg-1': {
          messageId: 'msg-1',
          reactions: [{ emoji: '👍', users: ['alice', 'bob'], count: 2 }],
        },
      };
      await AsyncStorage.setItem(
        '@AndroidIRCX:messageReactions',
        JSON.stringify(savedReactions),
      );

      await messageReactionsService.initialize();

      const reactions = messageReactionsService.getReactions('msg-1');
      expect(reactions).toBeTruthy();
      expect(reactions?.reactions[0].emoji).toBe('👍');
      expect(reactions?.reactions[0].count).toBe(2);
    });

    it('should handle corrupted storage data gracefully', async () => {
      await AsyncStorage.setItem(
        '@AndroidIRCX:messageReactions',
        'invalid json',
      );

      await expect(messageReactionsService.initialize()).resolves.not.toThrow();
    });
  });

  describe('addReaction', () => {
    it('should add reaction to message', async () => {
      await messageReactionsService.addReaction('msg-1', '👍', 'alice');

      const reactions = messageReactionsService.getReactions('msg-1');
      expect(reactions?.messageId).toBe('msg-1');
      expect(reactions?.reactions).toHaveLength(1);
      expect(reactions?.reactions[0].emoji).toBe('👍');
      expect(reactions?.reactions[0].users).toContain('alice');
      expect(reactions?.reactions[0].count).toBe(1);
    });

    it('should add multiple users to same emoji', async () => {
      await messageReactionsService.addReaction('msg-1', '👍', 'alice');
      await messageReactionsService.addReaction('msg-1', '👍', 'bob');
      await messageReactionsService.addReaction('msg-1', '👍', 'charlie');

      const reactions = messageReactionsService.getReactions('msg-1');
      expect(reactions?.reactions[0].users).toEqual([
        'alice',
        'bob',
        'charlie',
      ]);
      expect(reactions?.reactions[0].count).toBe(3);
    });

    it('should handle multiple different emojis', async () => {
      await messageReactionsService.addReaction('msg-1', '👍', 'alice');
      await messageReactionsService.addReaction('msg-1', '❤️', 'bob');
      await messageReactionsService.addReaction('msg-1', '😂', 'charlie');

      const reactions = messageReactionsService.getReactions('msg-1');
      expect(reactions?.reactions).toHaveLength(3);
      expect(reactions?.reactions.map(r => r.emoji)).toEqual([
        '👍',
        '❤️',
        '😂',
      ]);
    });

    it('should not duplicate user for same emoji', async () => {
      await messageReactionsService.addReaction('msg-1', '👍', 'alice');
      await messageReactionsService.addReaction('msg-1', '👍', 'alice');

      const reactions = messageReactionsService.getReactions('msg-1');
      expect(reactions?.reactions[0].users).toEqual(['alice']);
      expect(reactions?.reactions[0].count).toBe(1);
    });

    it('should persist reactions to storage', async () => {
      await messageReactionsService.addReaction('msg-1', '👍', 'alice');

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@AndroidIRCX:messageReactions',
        expect.any(String),
      );
    });
  });

  describe('removeReaction', () => {
    beforeEach(async () => {
      await messageReactionsService.addReaction('msg-1', '👍', 'alice');
      await messageReactionsService.addReaction('msg-1', '👍', 'bob');
      await messageReactionsService.addReaction('msg-1', '❤️', 'alice');
      jest.clearAllMocks();
    });

    it('should remove user from reaction', async () => {
      await messageReactionsService.removeReaction('msg-1', '👍', 'alice');

      const reactions = messageReactionsService.getReactions('msg-1');
      const thumbsUp = reactions?.reactions.find(r => r.emoji === '👍');
      expect(thumbsUp?.users).toEqual(['bob']);
      expect(thumbsUp?.count).toBe(1);
    });

    it('should remove entire reaction when last user removed', async () => {
      await messageReactionsService.removeReaction('msg-1', '❤️', 'alice');

      const reactions = messageReactionsService.getReactions('msg-1');
      const heart = reactions?.reactions.find(r => r.emoji === '❤️');
      expect(heart).toBeUndefined();
    });

    it('should remove message reactions when all reactions removed', async () => {
      await messageReactionsService.removeReaction('msg-1', '👍', 'alice');
      await messageReactionsService.removeReaction('msg-1', '👍', 'bob');
      await messageReactionsService.removeReaction('msg-1', '❤️', 'alice');

      const reactions = messageReactionsService.getReactions('msg-1');
      expect(reactions).toBeNull();
    });

    it('should handle removing non-existent reaction gracefully', async () => {
      await expect(
        messageReactionsService.removeReaction('msg-999', '👍', 'alice'),
      ).resolves.not.toThrow();
    });

    it('should handle removing non-existent emoji gracefully', async () => {
      await expect(
        messageReactionsService.removeReaction('msg-1', '🔥', 'alice'),
      ).resolves.not.toThrow();
    });

    it('should handle removing non-existent user gracefully', async () => {
      await expect(
        messageReactionsService.removeReaction('msg-1', '👍', 'nonexistent'),
      ).resolves.not.toThrow();
    });
  });

  describe('toggleReaction', () => {
    it('should add reaction when not present', async () => {
      await messageReactionsService.toggleReaction('msg-1', '👍', 'alice');

      const reactions = messageReactionsService.getReactions('msg-1');
      expect(reactions?.reactions[0].users).toContain('alice');
    });

    it('should remove reaction when present', async () => {
      await messageReactionsService.addReaction('msg-1', '👍', 'alice');
      await messageReactionsService.toggleReaction('msg-1', '👍', 'alice');

      const reactions = messageReactionsService.getReactions('msg-1');
      expect(reactions).toBeNull();
    });

    it('should toggle multiple times correctly', async () => {
      // Add
      await messageReactionsService.toggleReaction('msg-1', '👍', 'alice');
      expect(
        messageReactionsService.hasUserReacted('msg-1', '👍', 'alice'),
      ).toBe(true);

      // Remove
      await messageReactionsService.toggleReaction('msg-1', '👍', 'alice');
      expect(
        messageReactionsService.hasUserReacted('msg-1', '👍', 'alice'),
      ).toBe(false);

      // Add again
      await messageReactionsService.toggleReaction('msg-1', '👍', 'alice');
      expect(
        messageReactionsService.hasUserReacted('msg-1', '👍', 'alice'),
      ).toBe(true);
    });
  });

  describe('getReactions', () => {
    it('should return null for non-existent message', () => {
      const reactions = messageReactionsService.getReactions('non-existent');
      expect(reactions).toBeNull();
    });

    it('should return reactions for existing message', async () => {
      await messageReactionsService.addReaction('msg-1', '👍', 'alice');

      const reactions = messageReactionsService.getReactions('msg-1');
      expect(reactions).toBeTruthy();
      expect(reactions?.messageId).toBe('msg-1');
    });
  });

  describe('hasUserReacted', () => {
    beforeEach(async () => {
      await messageReactionsService.addReaction('msg-1', '👍', 'alice');
      await messageReactionsService.addReaction('msg-1', '❤️', 'bob');
    });

    it('should return true when user has reacted', () => {
      expect(
        messageReactionsService.hasUserReacted('msg-1', '👍', 'alice'),
      ).toBe(true);
    });

    it('should return false when user has not reacted', () => {
      expect(messageReactionsService.hasUserReacted('msg-1', '👍', 'bob')).toBe(
        false,
      );
    });

    it('should return false for non-existent message', () => {
      expect(
        messageReactionsService.hasUserReacted('msg-999', '👍', 'alice'),
      ).toBe(false);
    });

    it('should return false for non-existent emoji', () => {
      expect(
        messageReactionsService.hasUserReacted('msg-1', '🔥', 'alice'),
      ).toBe(false);
    });
  });

  describe('getReactionsForMessages', () => {
    beforeEach(async () => {
      await messageReactionsService.addReaction('msg-1', '👍', 'alice');
      await messageReactionsService.addReaction('msg-2', '❤️', 'bob');
      await messageReactionsService.addReaction('msg-3', '😂', 'charlie');
    });

    it('should return reactions for multiple messages', () => {
      const result = messageReactionsService.getReactionsForMessages([
        'msg-1',
        'msg-2',
        'msg-3',
      ]);

      expect(result.size).toBe(3);
      expect(result.get('msg-1')?.reactions[0].emoji).toBe('👍');
      expect(result.get('msg-2')?.reactions[0].emoji).toBe('❤️');
      expect(result.get('msg-3')?.reactions[0].emoji).toBe('😂');
    });

    it('should only return reactions for messages that have them', () => {
      const result = messageReactionsService.getReactionsForMessages([
        'msg-1',
        'msg-999',
        'msg-2',
      ]);

      expect(result.size).toBe(2);
      expect(result.has('msg-1')).toBe(true);
      expect(result.has('msg-2')).toBe(true);
      expect(result.has('msg-999')).toBe(false);
    });

    it('should return empty map for empty message list', () => {
      const result = messageReactionsService.getReactionsForMessages([]);
      expect(result.size).toBe(0);
    });
  });

  describe('clearReactions', () => {
    beforeEach(async () => {
      await messageReactionsService.addReaction('msg-1', '👍', 'alice');
      await messageReactionsService.addReaction('msg-1', '❤️', 'bob');
    });

    it('should clear all reactions for a message', async () => {
      await messageReactionsService.clearReactions('msg-1');

      const reactions = messageReactionsService.getReactions('msg-1');
      expect(reactions).toBeNull();
    });

    it('should handle clearing non-existent message gracefully', async () => {
      await expect(
        messageReactionsService.clearReactions('msg-999'),
      ).resolves.not.toThrow();
    });

    it('should persist change to storage', async () => {
      jest.clearAllMocks();
      await messageReactionsService.clearReactions('msg-1');

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@AndroidIRCX:messageReactions',
        expect.any(String),
      );
    });
  });

  describe('onReactionsChange', () => {
    it('should notify listeners when reactions change', async () => {
      const listener = jest.fn();
      messageReactionsService.onReactionsChange(listener);

      await messageReactionsService.addReaction('msg-1', '👍', 'alice');

      expect(listener).toHaveBeenCalledWith(
        'msg-1',
        expect.objectContaining({
          messageId: 'msg-1',
        }),
      );
    });

    it('should notify multiple listeners', async () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      messageReactionsService.onReactionsChange(listener1);
      messageReactionsService.onReactionsChange(listener2);

      await messageReactionsService.addReaction('msg-1', '👍', 'alice');

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    it('should unsubscribe listener', async () => {
      const listener = jest.fn();
      const unsubscribe = messageReactionsService.onReactionsChange(listener);

      await messageReactionsService.addReaction('msg-1', '👍', 'alice');
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();

      await messageReactionsService.addReaction('msg-1', '❤️', 'bob');
      expect(listener).toHaveBeenCalledTimes(1); // Not called again
    });

    it('should notify on remove reaction', async () => {
      await messageReactionsService.addReaction('msg-1', '👍', 'alice');

      const listener = jest.fn();
      messageReactionsService.onReactionsChange(listener);

      await messageReactionsService.removeReaction('msg-1', '👍', 'alice');

      expect(listener).toHaveBeenCalled();
    });

    it('should notify on clear reactions', async () => {
      await messageReactionsService.addReaction('msg-1', '👍', 'alice');

      const listener = jest.fn();
      messageReactionsService.onReactionsChange(listener);

      await messageReactionsService.clearReactions('msg-1');

      expect(listener).toHaveBeenCalledWith(
        'msg-1',
        expect.objectContaining({
          messageId: 'msg-1',
          reactions: [],
        }),
      );
    });
  });

  describe('edge cases', () => {
    it('should handle unicode emojis correctly', async () => {
      await messageReactionsService.addReaction('msg-1', '🎉', 'alice');
      await messageReactionsService.addReaction('msg-1', '🚀', 'bob');

      const reactions = messageReactionsService.getReactions('msg-1');
      expect(reactions?.reactions.map(r => r.emoji)).toContain('🎉');
      expect(reactions?.reactions.map(r => r.emoji)).toContain('🚀');
    });

    it('should handle composite emojis', async () => {
      await messageReactionsService.addReaction('msg-1', '👨‍👩‍👧‍👦', 'alice');

      const reactions = messageReactionsService.getReactions('msg-1');
      expect(reactions?.reactions[0].emoji).toBe('👨‍👩‍👧‍👦');
    });

    it('should handle many reactions per message', async () => {
      const emojis = [
        '👍',
        '❤️',
        '😂',
        '🎉',
        '🚀',
        '👀',
        '🔥',
        '✨',
        '💯',
        '🙌',
      ];
      for (const emoji of emojis) {
        await messageReactionsService.addReaction('msg-1', emoji, 'alice');
      }

      const reactions = messageReactionsService.getReactions('msg-1');
      expect(reactions?.reactions).toHaveLength(10);
    });

    it('should handle many users for one reaction', async () => {
      for (let i = 0; i < 100; i++) {
        await messageReactionsService.addReaction('msg-1', '👍', `user${i}`);
      }

      const reactions = messageReactionsService.getReactions('msg-1');
      expect(reactions?.reactions[0].count).toBe(100);
      expect(reactions?.reactions[0].users).toHaveLength(100);
    });

    it('should handle special characters in nicknames', async () => {
      await messageReactionsService.addReaction('msg-1', '👍', 'alice[away]');
      await messageReactionsService.addReaction('msg-1', '👍', 'bob|mobile');

      const reactions = messageReactionsService.getReactions('msg-1');
      expect(reactions?.reactions[0].users).toContain('alice[away]');
      expect(reactions?.reactions[0].users).toContain('bob|mobile');
    });
  });
});

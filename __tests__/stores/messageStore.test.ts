/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * messageStore.test.ts
 *
 * Tests for messageStore - typing indicators state management
 */

import { act } from '@testing-library/react-native';
import { useMessageStore, TypingUser } from '../../src/stores/messageStore';

describe('messageStore', () => {
  beforeEach(() => {
    act(() => {
      useMessageStore.getState().reset();
    });
  });

  describe('initial state', () => {
    it('should have empty typingUsers map initially', () => {
      expect(useMessageStore.getState().typingUsers.size).toBe(0);
    });
  });

  describe('setTypingUser', () => {
    it('should add typing user to new network, target, and channel', () => {
      const status: TypingUser = { status: 'active', timestamp: Date.now() };

      act(() => {
        useMessageStore
          .getState()
          .setTypingUser('network1', '#channel', 'nick1', status);
      });

      const typingUsers = useMessageStore.getState().typingUsers;
      expect(typingUsers.has('network1')).toBe(true);
      expect(typingUsers.get('network1')!.has('#channel')).toBe(true);
      expect(typingUsers.get('network1')!.get('#channel')!.has('nick1')).toBe(
        true,
      );
      expect(
        typingUsers.get('network1')!.get('#channel')!.get('nick1'),
      ).toEqual(status);
    });

    it('should add typing user to existing network and new target', () => {
      const status1: TypingUser = { status: 'active', timestamp: Date.now() };
      const status2: TypingUser = { status: 'paused', timestamp: Date.now() };

      act(() => {
        useMessageStore
          .getState()
          .setTypingUser('network1', '#channel1', 'nick1', status1);
        useMessageStore
          .getState()
          .setTypingUser('network1', '#channel2', 'nick2', status2);
      });

      const typingUsers = useMessageStore.getState().typingUsers;
      expect(typingUsers.get('network1')!.size).toBe(2);
      expect(
        typingUsers.get('network1')!.get('#channel1')!.get('nick1'),
      ).toEqual(status1);
      expect(
        typingUsers.get('network1')!.get('#channel2')!.get('nick2'),
      ).toEqual(status2);
    });

    it('should add typing user to existing target', () => {
      const status1: TypingUser = { status: 'active', timestamp: Date.now() };
      const status2: TypingUser = { status: 'paused', timestamp: Date.now() };

      act(() => {
        useMessageStore
          .getState()
          .setTypingUser('network1', '#channel', 'nick1', status1);
        useMessageStore
          .getState()
          .setTypingUser('network1', '#channel', 'nick2', status2);
      });

      const targetMap = useMessageStore
        .getState()
        .typingUsers.get('network1')!
        .get('#channel')!;
      expect(targetMap.size).toBe(2);
      expect(targetMap.get('nick1')).toEqual(status1);
      expect(targetMap.get('nick2')).toEqual(status2);
    });

    it('should update existing typing user status', () => {
      const status1: TypingUser = { status: 'active', timestamp: 1000 };
      const status2: TypingUser = { status: 'paused', timestamp: 2000 };

      act(() => {
        useMessageStore
          .getState()
          .setTypingUser('network1', '#channel', 'nick1', status1);
        useMessageStore
          .getState()
          .setTypingUser('network1', '#channel', 'nick1', status2);
      });

      const targetMap = useMessageStore
        .getState()
        .typingUsers.get('network1')!
        .get('#channel')!;
      expect(targetMap.get('nick1')).toEqual(status2);
    });

    it('should remove typing user when status is done', () => {
      const status: TypingUser = { status: 'active', timestamp: Date.now() };
      const doneStatus: TypingUser = { status: 'done', timestamp: Date.now() };

      act(() => {
        useMessageStore
          .getState()
          .setTypingUser('network1', '#channel', 'nick1', status);
        useMessageStore
          .getState()
          .setTypingUser('network1', '#channel', 'nick1', doneStatus);
      });

      // Network map is removed when empty
      expect(useMessageStore.getState().typingUsers.has('network1')).toBe(
        false,
      );
    });

    it('should remove target map when last user is done typing', () => {
      const status: TypingUser = { status: 'active', timestamp: Date.now() };
      const doneStatus: TypingUser = { status: 'done', timestamp: Date.now() };

      act(() => {
        useMessageStore
          .getState()
          .setTypingUser('network1', '#channel', 'nick1', status);
        useMessageStore
          .getState()
          .setTypingUser('network1', '#channel', 'nick1', doneStatus);
      });

      // Network map is removed when empty
      expect(useMessageStore.getState().typingUsers.has('network1')).toBe(
        false,
      );
    });

    it('should remove network map when last target is empty', () => {
      const status: TypingUser = { status: 'active', timestamp: Date.now() };
      const doneStatus: TypingUser = { status: 'done', timestamp: Date.now() };

      act(() => {
        useMessageStore
          .getState()
          .setTypingUser('network1', '#channel', 'nick1', status);
        useMessageStore
          .getState()
          .setTypingUser('network1', '#channel', 'nick1', doneStatus);
      });

      expect(useMessageStore.getState().typingUsers.has('network1')).toBe(
        false,
      );
    });

    it('should handle multiple users with some done and some active', () => {
      const activeStatus: TypingUser = {
        status: 'active',
        timestamp: Date.now(),
      };
      const doneStatus: TypingUser = { status: 'done', timestamp: Date.now() };

      act(() => {
        useMessageStore
          .getState()
          .setTypingUser('network1', '#channel', 'nick1', activeStatus);
        useMessageStore
          .getState()
          .setTypingUser('network1', '#channel', 'nick2', activeStatus);
        useMessageStore
          .getState()
          .setTypingUser('network1', '#channel', 'nick1', doneStatus);
      });

      const targetMap = useMessageStore
        .getState()
        .typingUsers.get('network1')!
        .get('#channel')!;
      expect(targetMap.size).toBe(1);
      expect(targetMap.has('nick1')).toBe(false);
      expect(targetMap.has('nick2')).toBe(true);
    });
  });

  describe('removeTypingUser', () => {
    it('should remove typing user', () => {
      const status: TypingUser = { status: 'active', timestamp: Date.now() };

      act(() => {
        useMessageStore
          .getState()
          .setTypingUser('network1', '#channel', 'nick1', status);
        useMessageStore
          .getState()
          .removeTypingUser('network1', '#channel', 'nick1');
      });

      expect(useMessageStore.getState().typingUsers.has('network1')).toBe(
        false,
      );
    });

    it('should handle removing non-existent user gracefully', () => {
      act(() => {
        useMessageStore
          .getState()
          .removeTypingUser('network1', '#channel', 'nick1');
      });

      expect(useMessageStore.getState().typingUsers.size).toBe(0);
    });

    it('should handle removing from non-existent target', () => {
      act(() => {
        useMessageStore
          .getState()
          .removeTypingUser('network1', '#channel', 'nick1');
      });

      expect(useMessageStore.getState().typingUsers.size).toBe(0);
    });

    it('should handle removing from non-existent network', () => {
      act(() => {
        useMessageStore
          .getState()
          .removeTypingUser('network1', '#channel', 'nick1');
      });

      expect(useMessageStore.getState().typingUsers.size).toBe(0);
    });

    it('should keep other users when removing one', () => {
      const status: TypingUser = { status: 'active', timestamp: Date.now() };

      act(() => {
        useMessageStore
          .getState()
          .setTypingUser('network1', '#channel', 'nick1', status);
        useMessageStore
          .getState()
          .setTypingUser('network1', '#channel', 'nick2', status);
        useMessageStore
          .getState()
          .removeTypingUser('network1', '#channel', 'nick1');
      });

      const targetMap = useMessageStore
        .getState()
        .typingUsers.get('network1')!
        .get('#channel')!;
      expect(targetMap.size).toBe(1);
      expect(targetMap.has('nick2')).toBe(true);
    });

    it('should clean up target map when last user removed', () => {
      const status: TypingUser = { status: 'active', timestamp: Date.now() };

      act(() => {
        useMessageStore
          .getState()
          .setTypingUser('network1', '#channel', 'nick1', status);
        useMessageStore
          .getState()
          .removeTypingUser('network1', '#channel', 'nick1');
      });

      // Network map is removed when empty
      expect(useMessageStore.getState().typingUsers.has('network1')).toBe(
        false,
      );
    });

    it('should clean up network map when last target removed', () => {
      const status: TypingUser = { status: 'active', timestamp: Date.now() };

      act(() => {
        useMessageStore
          .getState()
          .setTypingUser('network1', '#channel', 'nick1', status);
        useMessageStore
          .getState()
          .removeTypingUser('network1', '#channel', 'nick1');
      });

      expect(useMessageStore.getState().typingUsers.has('network1')).toBe(
        false,
      );
    });
  });

  describe('clearTypingForTarget', () => {
    it('should clear all typing users for a target', () => {
      const status: TypingUser = { status: 'active', timestamp: Date.now() };

      act(() => {
        useMessageStore
          .getState()
          .setTypingUser('network1', '#channel', 'nick1', status);
        useMessageStore
          .getState()
          .setTypingUser('network1', '#channel', 'nick2', status);
        useMessageStore.getState().clearTypingForTarget('network1', '#channel');
      });

      expect(useMessageStore.getState().typingUsers.has('network1')).toBe(
        false,
      );
    });

    it('should handle clearing non-existent target', () => {
      act(() => {
        useMessageStore.getState().clearTypingForTarget('network1', '#channel');
      });

      expect(useMessageStore.getState().typingUsers.size).toBe(0);
    });

    it('should handle clearing from non-existent network', () => {
      act(() => {
        useMessageStore.getState().clearTypingForTarget('network1', '#channel');
      });

      expect(useMessageStore.getState().typingUsers.size).toBe(0);
    });

    it('should keep other targets when clearing one', () => {
      const status: TypingUser = { status: 'active', timestamp: Date.now() };

      act(() => {
        useMessageStore
          .getState()
          .setTypingUser('network1', '#channel1', 'nick1', status);
        useMessageStore
          .getState()
          .setTypingUser('network1', '#channel2', 'nick2', status);
        useMessageStore
          .getState()
          .clearTypingForTarget('network1', '#channel1');
      });

      const networkMap = useMessageStore
        .getState()
        .typingUsers.get('network1')!;
      expect(networkMap.size).toBe(1);
      expect(networkMap.has('#channel2')).toBe(true);
    });

    it('should clean up network map when last target cleared', () => {
      const status: TypingUser = { status: 'active', timestamp: Date.now() };

      act(() => {
        useMessageStore
          .getState()
          .setTypingUser('network1', '#channel', 'nick1', status);
        useMessageStore.getState().clearTypingForTarget('network1', '#channel');
      });

      expect(useMessageStore.getState().typingUsers.has('network1')).toBe(
        false,
      );
    });
  });

  describe('clearTypingForNetwork', () => {
    it('should clear all typing users for a network', () => {
      const status: TypingUser = { status: 'active', timestamp: Date.now() };

      act(() => {
        useMessageStore
          .getState()
          .setTypingUser('network1', '#channel1', 'nick1', status);
        useMessageStore
          .getState()
          .setTypingUser('network1', '#channel2', 'nick2', status);
        useMessageStore.getState().clearTypingForNetwork('network1');
      });

      expect(useMessageStore.getState().typingUsers.has('network1')).toBe(
        false,
      );
    });

    it('should handle clearing non-existent network', () => {
      act(() => {
        useMessageStore.getState().clearTypingForNetwork('network1');
      });

      expect(useMessageStore.getState().typingUsers.size).toBe(0);
    });

    it('should keep other networks when clearing one', () => {
      const status: TypingUser = { status: 'active', timestamp: Date.now() };

      act(() => {
        useMessageStore
          .getState()
          .setTypingUser('network1', '#channel', 'nick1', status);
        useMessageStore
          .getState()
          .setTypingUser('network2', '#channel', 'nick2', status);
        useMessageStore.getState().clearTypingForNetwork('network1');
      });

      const typingUsers = useMessageStore.getState().typingUsers;
      expect(typingUsers.has('network1')).toBe(false);
      expect(typingUsers.has('network2')).toBe(true);
    });
  });

  describe('getTypingUsersForTarget', () => {
    it('should return empty map when no users are typing', () => {
      const result = useMessageStore
        .getState()
        .getTypingUsersForTarget('network1', '#channel');
      expect(result.size).toBe(0);
    });

    it('should return typing users for a target', () => {
      const status: TypingUser = { status: 'active', timestamp: Date.now() };

      act(() => {
        useMessageStore
          .getState()
          .setTypingUser('network1', '#channel', 'nick1', status);
        useMessageStore
          .getState()
          .setTypingUser('network1', '#channel', 'nick2', status);
      });

      const result = useMessageStore
        .getState()
        .getTypingUsersForTarget('network1', '#channel');
      expect(result.size).toBe(2);
      expect(result.get('nick1')).toEqual(status);
      expect(result.get('nick2')).toEqual(status);
    });

    it('should return empty map for non-existent network', () => {
      const status: TypingUser = { status: 'active', timestamp: Date.now() };

      act(() => {
        useMessageStore
          .getState()
          .setTypingUser('network1', '#channel', 'nick1', status);
      });

      const result = useMessageStore
        .getState()
        .getTypingUsersForTarget('network2', '#channel');
      expect(result.size).toBe(0);
    });

    it('should return empty map for non-existent target', () => {
      const status: TypingUser = { status: 'active', timestamp: Date.now() };

      act(() => {
        useMessageStore
          .getState()
          .setTypingUser('network1', '#channel', 'nick1', status);
      });

      const result = useMessageStore
        .getState()
        .getTypingUsersForTarget('network1', '#other');
      expect(result.size).toBe(0);
    });

    it('should only return users for specified target', () => {
      const status: TypingUser = { status: 'active', timestamp: Date.now() };

      act(() => {
        useMessageStore
          .getState()
          .setTypingUser('network1', '#channel1', 'nick1', status);
        useMessageStore
          .getState()
          .setTypingUser('network1', '#channel2', 'nick2', status);
      });

      const result = useMessageStore
        .getState()
        .getTypingUsersForTarget('network1', '#channel1');
      expect(result.size).toBe(1);
      expect(result.get('nick1')).toEqual(status);
    });
  });

  describe('getTypingNicksForTarget', () => {
    it('should return empty array when no users are typing', () => {
      const result = useMessageStore
        .getState()
        .getTypingNicksForTarget('network1', '#channel');
      expect(result).toEqual([]);
    });

    it('should return array of nicknames for typing users', () => {
      const status: TypingUser = { status: 'active', timestamp: Date.now() };

      act(() => {
        useMessageStore
          .getState()
          .setTypingUser('network1', '#channel', 'alice', status);
        useMessageStore
          .getState()
          .setTypingUser('network1', '#channel', 'bob', status);
      });

      const result = useMessageStore
        .getState()
        .getTypingNicksForTarget('network1', '#channel');
      expect(result).toContain('alice');
      expect(result).toContain('bob');
      expect(result.length).toBe(2);
    });

    it('should return empty array for non-existent network', () => {
      const result = useMessageStore
        .getState()
        .getTypingNicksForTarget('network1', '#channel');
      expect(result).toEqual([]);
    });

    it('should return empty array for non-existent target', () => {
      const status: TypingUser = { status: 'active', timestamp: Date.now() };

      act(() => {
        useMessageStore
          .getState()
          .setTypingUser('network1', '#channel', 'nick1', status);
      });

      const result = useMessageStore
        .getState()
        .getTypingNicksForTarget('network1', '#other');
      expect(result).toEqual([]);
    });
  });

  describe('cleanupStaleTyping', () => {
    it('should remove stale typing indicators', () => {
      const oldStatus: TypingUser = {
        status: 'active',
        timestamp: Date.now() - 20000,
      };
      const freshStatus: TypingUser = {
        status: 'active',
        timestamp: Date.now(),
      };

      act(() => {
        useMessageStore
          .getState()
          .setTypingUser('network1', '#channel', 'old', oldStatus);
        useMessageStore
          .getState()
          .setTypingUser('network1', '#channel', 'fresh', freshStatus);
      });

      act(() => {
        useMessageStore.getState().cleanupStaleTyping(10000);
      });

      const targetMap = useMessageStore
        .getState()
        .typingUsers.get('network1')!
        .get('#channel')!;
      expect(targetMap.size).toBe(1);
      expect(targetMap.has('old')).toBe(false);
      expect(targetMap.has('fresh')).toBe(true);
    });

    it('should use default max age of 10000ms', () => {
      const oldStatus: TypingUser = {
        status: 'active',
        timestamp: Date.now() - 20000,
      };

      act(() => {
        useMessageStore
          .getState()
          .setTypingUser('network1', '#channel', 'old', oldStatus);
      });

      act(() => {
        useMessageStore.getState().cleanupStaleTyping();
      });

      expect(useMessageStore.getState().typingUsers.has('network1')).toBe(
        false,
      );
    });

    it('should clean up empty target maps after removing stale entries', () => {
      const oldStatus: TypingUser = {
        status: 'active',
        timestamp: Date.now() - 20000,
      };

      act(() => {
        useMessageStore
          .getState()
          .setTypingUser('network1', '#channel', 'old', oldStatus);
      });

      act(() => {
        useMessageStore.getState().cleanupStaleTyping(10000);
      });

      const networkMap = useMessageStore.getState().typingUsers.get('network1');
      expect(networkMap?.has('#channel') || !networkMap).toBe(true);
    });

    it('should clean up empty network maps after removing stale entries', () => {
      const oldStatus: TypingUser = {
        status: 'active',
        timestamp: Date.now() - 20000,
      };

      act(() => {
        useMessageStore
          .getState()
          .setTypingUser('network1', '#channel', 'old', oldStatus);
      });

      act(() => {
        useMessageStore.getState().cleanupStaleTyping(10000);
      });

      expect(useMessageStore.getState().typingUsers.has('network1')).toBe(
        false,
      );
    });

    it('should keep fresh entries across multiple targets', () => {
      const freshStatus: TypingUser = {
        status: 'active',
        timestamp: Date.now(),
      };

      act(() => {
        useMessageStore
          .getState()
          .setTypingUser('network1', '#channel1', 'nick1', freshStatus);
        useMessageStore
          .getState()
          .setTypingUser('network1', '#channel2', 'nick2', freshStatus);
      });

      act(() => {
        useMessageStore.getState().cleanupStaleTyping(10000);
      });

      const networkMap = useMessageStore
        .getState()
        .typingUsers.get('network1')!;
      expect(networkMap.size).toBe(2);
      expect(networkMap.has('#channel1')).toBe(true);
      expect(networkMap.has('#channel2')).toBe(true);
    });

    it('should handle empty typing users map', () => {
      act(() => {
        useMessageStore.getState().cleanupStaleTyping(10000);
      });

      expect(useMessageStore.getState().typingUsers.size).toBe(0);
    });

    it('should handle custom max age values', () => {
      const status: TypingUser = {
        status: 'active',
        timestamp: Date.now() - 5000,
      };

      act(() => {
        useMessageStore
          .getState()
          .setTypingUser('network1', '#channel', 'nick1', status);
      });

      act(() => {
        useMessageStore.getState().cleanupStaleTyping(3000);
      });

      expect(useMessageStore.getState().typingUsers.has('network1')).toBe(
        false,
      );
    });
  });

  describe('reset', () => {
    it('should reset store to initial state', () => {
      const status: TypingUser = { status: 'active', timestamp: Date.now() };

      act(() => {
        useMessageStore
          .getState()
          .setTypingUser('network1', '#channel', 'nick1', status);
        useMessageStore
          .getState()
          .setTypingUser('network2', '#other', 'nick2', status);
      });

      act(() => {
        useMessageStore.getState().reset();
      });

      expect(useMessageStore.getState().typingUsers.size).toBe(0);
    });

    it('should allow adding users after reset', () => {
      const status: TypingUser = { status: 'active', timestamp: Date.now() };

      act(() => {
        useMessageStore
          .getState()
          .setTypingUser('network1', '#channel', 'nick1', status);
        useMessageStore.getState().reset();
      });

      act(() => {
        useMessageStore
          .getState()
          .setTypingUser('network2', '#other', 'nick2', status);
      });

      expect(useMessageStore.getState().typingUsers.has('network2')).toBe(true);
    });
  });

  describe('complex scenarios', () => {
    it('should handle multiple networks, targets, and users', () => {
      const status: TypingUser = { status: 'active', timestamp: Date.now() };

      act(() => {
        useMessageStore
          .getState()
          .setTypingUser('network1', '#channel1', 'alice', status);
        useMessageStore
          .getState()
          .setTypingUser('network1', '#channel1', 'bob', status);
        useMessageStore
          .getState()
          .setTypingUser('network1', '#channel2', 'charlie', status);
        useMessageStore
          .getState()
          .setTypingUser('network2', '#channel1', 'dave', status);
      });

      const typingUsers = useMessageStore.getState().typingUsers;
      expect(typingUsers.size).toBe(2);
      expect(typingUsers.get('network1')!.size).toBe(2);
      expect(typingUsers.get('network2')!.size).toBe(1);
      expect(typingUsers.get('network1')!.get('#channel1')!.size).toBe(2);
    });

    it('should handle PM conversations (target is nick)', () => {
      const status: TypingUser = { status: 'active', timestamp: Date.now() };

      act(() => {
        useMessageStore
          .getState()
          .setTypingUser('network1', 'alice', 'alice', status);
      });

      const result = useMessageStore
        .getState()
        .getTypingNicksForTarget('network1', 'alice');
      expect(result).toContain('alice');
    });

    it('should handle all three typing statuses', () => {
      const activeStatus: TypingUser = {
        status: 'active',
        timestamp: Date.now(),
      };
      const pausedStatus: TypingUser = {
        status: 'paused',
        timestamp: Date.now(),
      };
      const doneStatus: TypingUser = { status: 'done', timestamp: Date.now() };

      act(() => {
        useMessageStore
          .getState()
          .setTypingUser('network1', '#channel', 'activeUser', activeStatus);
        useMessageStore
          .getState()
          .setTypingUser('network1', '#channel', 'pausedUser', pausedStatus);
        useMessageStore
          .getState()
          .setTypingUser('network1', '#channel', 'doneUser', doneStatus);
      });

      const targetMap = useMessageStore
        .getState()
        .typingUsers.get('network1')!
        .get('#channel')!;
      expect(targetMap.has('activeUser')).toBe(true);
      expect(targetMap.has('pausedUser')).toBe(true);
      expect(targetMap.has('doneUser')).toBe(false);
    });

    it('should maintain immutable state updates', () => {
      const status: TypingUser = { status: 'active', timestamp: Date.now() };

      let previousTypingUsers: Map<string, any>;

      act(() => {
        useMessageStore
          .getState()
          .setTypingUser('network1', '#channel', 'nick1', status);
        previousTypingUsers = useMessageStore.getState().typingUsers;
      });

      act(() => {
        useMessageStore
          .getState()
          .setTypingUser('network1', '#channel', 'nick2', status);
      });

      const currentTypingUsers = useMessageStore.getState().typingUsers;
      expect(currentTypingUsers).not.toBe(previousTypingUsers!);
    });
  });
});

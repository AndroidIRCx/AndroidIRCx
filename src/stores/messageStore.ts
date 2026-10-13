/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * messageStore.ts
 *
 * Zustand store for message-related state.
 * Handles typing indicators and message batching state.
 */

import { create } from 'zustand';

export interface TypingUser {
  status: 'active' | 'paused' | 'done';
  timestamp: number;
}

export interface MessageState {
  // Typing indicators: Map<networkId, Map<channelOrNick, Map<nick, TypingUser>>>
  typingUsers: Map<string, Map<string, Map<string, TypingUser>>>;

  // Actions
  setTypingUser: (
    networkId: string,
    target: string,
    nick: string,
    status: TypingUser,
  ) => void;
  removeTypingUser: (networkId: string, target: string, nick: string) => void;
  clearTypingForTarget: (networkId: string, target: string) => void;
  clearTypingForNetwork: (networkId: string) => void;
  getTypingUsersForTarget: (
    networkId: string,
    target: string,
  ) => Map<string, TypingUser>;
  getTypingNicksForTarget: (networkId: string, target: string) => string[];

  // Cleanup stale typing indicators
  cleanupStaleTyping: (maxAge?: number) => void;

  // Reset
  reset: () => void;
}

export const useMessageStore = create<MessageState>((set, get) => ({
  typingUsers: new Map(),

  setTypingUser: (networkId, target, nick, status) =>
    set(state => {
      const newMap = new Map(state.typingUsers);

      if (!newMap.has(networkId)) {
        newMap.set(networkId, new Map());
      }

      const networkMap = newMap.get(networkId)!;
      if (!networkMap.has(target)) {
        networkMap.set(target, new Map());
      }

      const targetMap = networkMap.get(target)!;

      if (status.status === 'done') {
        // Remove user when typing is done
        targetMap.delete(nick);
        if (targetMap.size === 0) {
          networkMap.delete(target);
        }
        if (networkMap.size === 0) {
          newMap.delete(networkId);
        }
      } else {
        // Update or add typing user
        targetMap.set(nick, status);
      }

      return { typingUsers: newMap };
    }),

  removeTypingUser: (networkId, target, nick) =>
    set(state => {
      const newMap = new Map(state.typingUsers);
      const networkMap = newMap.get(networkId);

      if (networkMap) {
        const targetMap = networkMap.get(target);
        if (targetMap) {
          targetMap.delete(nick);

          if (targetMap.size === 0) {
            networkMap.delete(target);
          }
        }

        if (networkMap.size === 0) {
          newMap.delete(networkId);
        }
      }

      return { typingUsers: newMap };
    }),

  clearTypingForTarget: (networkId, target) =>
    set(state => {
      const newMap = new Map(state.typingUsers);
      const networkMap = newMap.get(networkId);

      if (networkMap) {
        networkMap.delete(target);

        if (networkMap.size === 0) {
          newMap.delete(networkId);
        }
      }

      return { typingUsers: newMap };
    }),

  clearTypingForNetwork: networkId =>
    set(state => {
      const newMap = new Map(state.typingUsers);
      newMap.delete(networkId);
      return { typingUsers: newMap };
    }),

  getTypingUsersForTarget: (networkId, target) => {
    const { typingUsers } = get();
    const networkMap = typingUsers.get(networkId);
    if (!networkMap) return new Map();

    const targetMap = networkMap.get(target);
    return targetMap || new Map();
  },

  getTypingNicksForTarget: (networkId, target) => {
    const targetMap = get().getTypingUsersForTarget(networkId, target);
    return Array.from(targetMap.keys());
  },

  // Runs every couple of seconds. When nothing has expired it leaves the state
  // object untouched, so subscribers do not re-render; otherwise it builds new
  // maps instead of editing the ones components may still hold.
  cleanupStaleTyping: (maxAge = 10000) => {
    set(state => {
      const now = Date.now();
      let changed = false;
      const nextNetworks = new Map<
        string,
        Map<string, Map<string, TypingUser>>
      >();

      state.typingUsers.forEach((networkMap, networkId) => {
        const nextTargets = new Map<string, Map<string, TypingUser>>();
        networkMap.forEach((targetMap, target) => {
          const live = new Map<string, TypingUser>();
          targetMap.forEach((status, nick) => {
            if (now - status.timestamp > maxAge) {
              changed = true;
            } else {
              live.set(nick, status);
            }
          });
          if (live.size > 0) {
            nextTargets.set(
              target,
              live.size === targetMap.size ? targetMap : live,
            );
          } else {
            changed = true;
          }
        });
        if (nextTargets.size > 0) {
          nextNetworks.set(networkId, nextTargets);
        } else {
          changed = true;
        }
      });

      return changed ? { typingUsers: nextNetworks } : state;
    });
  },

  reset: () => set({ typingUsers: new Map() }),
}));

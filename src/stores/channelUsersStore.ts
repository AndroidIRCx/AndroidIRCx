/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * channelUsersStore.ts
 *
 * Channel member lists, outside the App component's state. A user-list
 * change in a big channel used to set state at the root and re-render the
 * whole app; now only components that select the affected channel update.
 */

import type { SetStateAction } from 'react';
import { create } from 'zustand';
import type { ChannelUser } from '../services/IRCService';

/** Shared empty list, so "no users" never looks like a change. */
export const NO_CHANNEL_USERS: ChannelUser[] = [];

interface ChannelUsersState {
  /** Users per channel name. */
  channelUsers: Map<string, ChannelUser[]>;
  /** Same contract as a React state setter, so callers need not change. */
  setChannelUsers: (action: SetStateAction<Map<string, ChannelUser[]>>) => void;
}

export const useChannelUsersStore = create<ChannelUsersState>(set => ({
  channelUsers: new Map(),
  setChannelUsers: action =>
    set(state => ({
      channelUsers:
        typeof action === 'function' ? action(state.channelUsers) : action,
    })),
}));

/** The users of one channel; re-renders only when that channel's list changes. */
export const useChannelUsers = (channel: string | null): ChannelUser[] =>
  useChannelUsersStore(state =>
    channel
      ? (state.channelUsers.get(channel) ?? NO_CHANNEL_USERS)
      : NO_CHANNEL_USERS,
  );

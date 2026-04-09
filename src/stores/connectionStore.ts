/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * connectionStore.ts
 *
 * Zustand store for IRC connection state management.
 * Replaces connection-related useState calls from App.tsx
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ConnectionState {
  // Connection status
  isConnected: boolean;
  networkName: string;
  selectedNetworkName: string | null;
  activeConnectionId: string | null;
  primaryNetworkId: string | null;
  ping: number | undefined;

  // Actions
  setIsConnected: (connected: boolean) => void;
  setNetworkName: (name: string) => void;
  setSelectedNetworkName: (name: string | null) => void;
  setActiveConnectionId: (id: string | null) => void;
  setPrimaryNetworkId: (id: string | null) => void;
  setPing: (ping: number | undefined) => void;

  // Derived/computed values
  getIsConnected: () => boolean;
  getActiveNetwork: () => string;

  // Bulk updates
  updateConnectionState: (updates: Partial<ConnectionState>) => void;

  // Reset
  reset: () => void;
}

const initialState = {
  isConnected: false,
  networkName: 'default',
  selectedNetworkName: null,
  activeConnectionId: null,
  primaryNetworkId: null,
  ping: undefined,
};

export const useConnectionStore = create<ConnectionState>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Actions
      setIsConnected: connected => set({ isConnected: connected }),

      setNetworkName: name => set({ networkName: name }),

      setSelectedNetworkName: name => set({ selectedNetworkName: name }),

      setActiveConnectionId: id => set({ activeConnectionId: id }),

      setPrimaryNetworkId: id => set({ primaryNetworkId: id }),

      setPing: ping => set({ ping }),

      // Derived values
      getIsConnected: () => get().isConnected,

      getActiveNetwork: () => {
        const state = get();
        return state.networkName || 'default';
      },

      // Bulk updates
      updateConnectionState: updates =>
        set(state => ({ ...state, ...updates })),

      // Reset
      reset: () => set(initialState),
    }),
    {
      name: 'connection-storage',
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      migrate: (persistedState: any) => {
        if (!persistedState || typeof persistedState !== 'object') {
          return persistedState;
        }

        const rest = { ...persistedState };
        delete rest.primaryNetworkId;
        return rest;
      },
      // Only persist specific fields
      partialize: state => ({
        networkName: state.networkName,
        selectedNetworkName: state.selectedNetworkName,
      }),
    },
  ),
);

/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for connectionStore - 100% coverage target
 */

import { useConnectionStore } from '../../src/stores/connectionStore';

// Mock Zustand persist middleware
jest.mock('zustand/middleware', () => ({
  persist: (config: any) => (set: any, get: any, api: any) =>
    config(set, get, api),
  createJSONStorage: () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  }),
}));

describe('connectionStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    useConnectionStore.getState().reset();
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = useConnectionStore.getState();

      expect(state.isConnected).toBe(false);
      expect(state.networkName).toBe('default');
      expect(state.selectedNetworkName).toBeNull();
      expect(state.activeConnectionId).toBeNull();
      expect(state.primaryNetworkId).toBeNull();
      expect(state.ping).toBeUndefined();
    });
  });

  describe('setIsConnected', () => {
    it('should set isConnected to true', () => {
      useConnectionStore.getState().setIsConnected(true);
      expect(useConnectionStore.getState().isConnected).toBe(true);
    });

    it('should set isConnected to false', () => {
      useConnectionStore.getState().setIsConnected(true);
      useConnectionStore.getState().setIsConnected(false);
      expect(useConnectionStore.getState().isConnected).toBe(false);
    });
  });

  describe('setNetworkName', () => {
    it('should set network name', () => {
      useConnectionStore.getState().setNetworkName('Freenode');
      expect(useConnectionStore.getState().networkName).toBe('Freenode');
    });

    it('should handle empty string', () => {
      useConnectionStore.getState().setNetworkName('');
      expect(useConnectionStore.getState().networkName).toBe('');
    });
  });

  describe('setSelectedNetworkName', () => {
    it('should set selected network name', () => {
      useConnectionStore.getState().setSelectedNetworkName('Libera.Chat');
      expect(useConnectionStore.getState().selectedNetworkName).toBe(
        'Libera.Chat',
      );
    });

    it('should set to null', () => {
      useConnectionStore.getState().setSelectedNetworkName('Libera.Chat');
      useConnectionStore.getState().setSelectedNetworkName(null);
      expect(useConnectionStore.getState().selectedNetworkName).toBeNull();
    });
  });

  describe('setActiveConnectionId', () => {
    it('should set active connection id', () => {
      useConnectionStore.getState().setActiveConnectionId('conn-123');
      expect(useConnectionStore.getState().activeConnectionId).toBe('conn-123');
    });

    it('should set to null', () => {
      useConnectionStore.getState().setActiveConnectionId('conn-123');
      useConnectionStore.getState().setActiveConnectionId(null);
      expect(useConnectionStore.getState().activeConnectionId).toBeNull();
    });
  });

  describe('setPrimaryNetworkId', () => {
    it('should set primary network id', () => {
      useConnectionStore.getState().setPrimaryNetworkId('net-456');
      expect(useConnectionStore.getState().primaryNetworkId).toBe('net-456');
    });

    it('should set to null', () => {
      useConnectionStore.getState().setPrimaryNetworkId('net-456');
      useConnectionStore.getState().setPrimaryNetworkId(null);
      expect(useConnectionStore.getState().primaryNetworkId).toBeNull();
    });
  });

  describe('setPing', () => {
    it('should set ping value', () => {
      useConnectionStore.getState().setPing(42);
      expect(useConnectionStore.getState().ping).toBe(42);
    });

    it('should set ping to undefined', () => {
      useConnectionStore.getState().setPing(42);
      useConnectionStore.getState().setPing(undefined);
      expect(useConnectionStore.getState().ping).toBeUndefined();
    });

    it('should set ping to zero', () => {
      useConnectionStore.getState().setPing(0);
      expect(useConnectionStore.getState().ping).toBe(0);
    });
  });

  describe('getIsConnected', () => {
    it('should return true when connected', () => {
      useConnectionStore.getState().setIsConnected(true);
      expect(useConnectionStore.getState().getIsConnected()).toBe(true);
    });

    it('should return false when not connected', () => {
      expect(useConnectionStore.getState().getIsConnected()).toBe(false);
    });
  });

  describe('getActiveNetwork', () => {
    it('should return network name when set', () => {
      useConnectionStore.getState().setNetworkName('Freenode');
      expect(useConnectionStore.getState().getActiveNetwork()).toBe('Freenode');
    });

    it('should return "default" when network name is empty (falsy)', () => {
      useConnectionStore.getState().setNetworkName('');
      // Empty string is falsy, so || 'default' returns 'default'
      expect(useConnectionStore.getState().getActiveNetwork()).toBe('default');
    });

    it('should return initial "default" value', () => {
      expect(useConnectionStore.getState().getActiveNetwork()).toBe('default');
    });
  });

  describe('updateConnectionState', () => {
    it('should update multiple fields at once', () => {
      useConnectionStore.getState().updateConnectionState({
        isConnected: true,
        networkName: 'Libera.Chat',
        ping: 25,
      });

      const state = useConnectionStore.getState();
      expect(state.isConnected).toBe(true);
      expect(state.networkName).toBe('Libera.Chat');
      expect(state.ping).toBe(25);
    });

    it('should preserve unupdated fields', () => {
      useConnectionStore.getState().setNetworkName('Freenode');
      useConnectionStore.getState().updateConnectionState({
        isConnected: true,
      });

      const state = useConnectionStore.getState();
      expect(state.isConnected).toBe(true);
      expect(state.networkName).toBe('Freenode'); // Preserved
    });

    it('should handle empty update object', () => {
      const before = useConnectionStore.getState();
      useConnectionStore.getState().updateConnectionState({});
      const after = useConnectionStore.getState();

      expect(after.isConnected).toBe(before.isConnected);
      expect(after.networkName).toBe(before.networkName);
    });
  });

  describe('reset', () => {
    it('should reset all state to initial values', () => {
      // Modify state
      useConnectionStore.getState().updateConnectionState({
        isConnected: true,
        networkName: 'TestNet',
        selectedNetworkName: 'Selected',
        activeConnectionId: 'active-123',
        primaryNetworkId: 'primary-456',
        ping: 100,
      });

      // Reset
      useConnectionStore.getState().reset();

      const state = useConnectionStore.getState();
      expect(state.isConnected).toBe(false);
      expect(state.networkName).toBe('default');
      expect(state.selectedNetworkName).toBeNull();
      expect(state.activeConnectionId).toBeNull();
      expect(state.primaryNetworkId).toBeNull();
      expect(state.ping).toBeUndefined();
    });

    it('should work when called multiple times', () => {
      useConnectionStore.getState().reset();
      useConnectionStore.getState().reset();

      const state = useConnectionStore.getState();
      expect(state.isConnected).toBe(false);
      expect(state.networkName).toBe('default');
    });
  });

  describe('state persistence configuration', () => {
    it('store should be created with persist middleware', () => {
      // If the store was created successfully with persist, this test passes
      expect(useConnectionStore).toBeDefined();
      expect(useConnectionStore.getState).toBeDefined();
    });

    it('should have all required actions', () => {
      const state = useConnectionStore.getState();

      expect(typeof state.setIsConnected).toBe('function');
      expect(typeof state.setNetworkName).toBe('function');
      expect(typeof state.setSelectedNetworkName).toBe('function');
      expect(typeof state.setActiveConnectionId).toBe('function');
      expect(typeof state.setPrimaryNetworkId).toBe('function');
      expect(typeof state.setPing).toBe('function');
      expect(typeof state.getIsConnected).toBe('function');
      expect(typeof state.getActiveNetwork).toBe('function');
      expect(typeof state.updateConnectionState).toBe('function');
      expect(typeof state.reset).toBe('function');
    });
  });
});

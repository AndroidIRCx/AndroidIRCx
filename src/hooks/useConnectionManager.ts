/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * useConnectionManager.ts
 *
 * Custom hook that encapsulates IRC connection management logic.
 * Integrates with connectionStore and ConnectionManager service.
 */

import { useEffect, useCallback } from 'react';
import { useConnectionStore } from '../stores/connectionStore';
import { connectionManager } from '../services/ConnectionManager';
import { IRCNetworkConfig } from '../services/SettingsService';
import { IRCConnectionConfig } from '../services/IRCService';

export function useConnectionManager() {
  // IMPORTANT: Only subscribe to state values, not actions
  // This prevents infinite re-render loops
  const isConnected = useConnectionStore(state => state.isConnected);
  const networkName = useConnectionStore(state => state.networkName);
  const selectedNetworkName = useConnectionStore(
    state => state.selectedNetworkName,
  );
  const activeConnectionId = useConnectionStore(
    state => state.activeConnectionId,
  );
  const primaryNetworkId = useConnectionStore(state => state.primaryNetworkId);
  const ping = useConnectionStore(state => state.ping);

  // Get actions without subscribing (they're stable references)
  const setSelectedNetworkName = useCallback((name: string) => {
    useConnectionStore.getState().setSelectedNetworkName(name);
  }, []);

  /**
   * Connect to an IRC network
   */
  const connect = useCallback(
    async (network: IRCNetworkConfig, config: IRCConnectionConfig) => {
      try {
        const networkId = await connectionManager.connect(
          network.name,
          network,
          config,
        );

        const store = useConnectionStore.getState();
        store.setActiveConnectionId(networkId);
        store.setNetworkName(network.name);
        store.setIsConnected(true);

        // Set as primary if it's the first connection
        if (!store.primaryNetworkId) {
          store.setPrimaryNetworkId(networkId);
        }

        return networkId;
      } catch (error) {
        console.error('Failed to connect:', error);
        throw error;
      }
    },
    [], // No dependencies - use store directly
  );

  /**
   * Disconnect from a network
   */
  const disconnect = useCallback(
    async (networkId: string, quitMessage?: string) => {
      try {
        await connectionManager.disconnect(networkId, quitMessage);

        const store = useConnectionStore.getState();

        // If disconnecting active connection, update state
        if (networkId === store.activeConnectionId) {
          const remainingConnections = connectionManager.getAllConnections();

          if (remainingConnections.length > 0) {
            // Switch to another connection
            const nextConnection = remainingConnections[0];
            store.setActiveConnectionId(nextConnection.networkId);
            store.setNetworkName(nextConnection.networkId);
            store.setIsConnected(true);
          } else {
            // No more connections
            store.setActiveConnectionId(null);
            store.setIsConnected(false);
          }
        }

        // If disconnecting primary, clear it
        if (networkId === store.primaryNetworkId) {
          store.setPrimaryNetworkId(null);
        }
      } catch (error) {
        console.error('Failed to disconnect:', error);
        throw error;
      }
    },
    [], // No dependencies - use store directly
  );

  /**
   * Switch to a different active connection
   */
  const switchConnection = useCallback(
    (networkId: string) => {
      const connection = connectionManager.getConnection(networkId);

      if (connection) {
        connectionManager.setActiveConnection(networkId);
        const store = useConnectionStore.getState();
        store.setActiveConnectionId(networkId);
        store.setNetworkName(networkId);
        store.setIsConnected(connection.ircService.getConnectionStatus());
      }
    },
    [], // No dependencies - use store directly
  );

  /**
   * Get the active connection
   */
  const getActiveConnection = useCallback(() => {
    const store = useConnectionStore.getState();
    return store.activeConnectionId
      ? connectionManager.getConnection(store.activeConnectionId)
      : null;
  }, []);

  /**
   * Get all connections
   */
  const getAllConnections = useCallback(() => {
    return connectionManager.getAllConnections();
  }, []);

  /**
   * Check if a network is connected
   */
  const isNetworkConnected = useCallback((networkId: string) => {
    const connection = connectionManager.getConnection(networkId);
    return connection ? connection.ircService.getConnectionStatus() : false;
  }, []);

  /**
   * Update ping for active connection
   */
  const updatePing = useCallback((newPing: number) => {
    useConnectionStore.getState().setPing(newPing);
  }, []);

  /**
   * Sync state with ConnectionManager on mount
   */
  useEffect(() => {
    const syncState = () => {
      const activeId = connectionManager.getActiveNetworkId();
      const connections = connectionManager.getAllConnections();
      const store = useConnectionStore.getState();

      if (activeId) {
        store.setActiveConnectionId(activeId);
        store.setNetworkName(activeId);
      }

      store.setIsConnected(
        connections.length > 0 &&
          connections.some(c => c.ircService.getConnectionStatus()),
      );
    };

    syncState();
  }, []); // Empty dependencies - only run on mount

  return {
    // State
    isConnected,
    networkName,
    selectedNetworkName,
    activeConnectionId,
    primaryNetworkId,
    ping,

    // Actions
    connect,
    disconnect,
    switchConnection,
    setSelectedNetworkName,

    // Queries
    getActiveConnection,
    getAllConnections,
    isNetworkConnected,
    updatePing,
  };
}

/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useEffect, useRef } from 'react';
import { settingsService } from '../services/SettingsService';
import { connectionManager } from '../services/ConnectionManager';
import { IRCNetworkConfig } from '../services/SettingsService';

interface UseAutoConnectFavoriteProps {
  autoConnectFavoriteServer: boolean;
  initialDataLoaded: boolean;
  selectedNetworkName: string;
  handleConnect: (network?: IRCNetworkConfig, serverId?: string) => Promise<void>;
  autoConnectAttemptedRef: React.MutableRefObject<Set<string>>;
}

/**
 * Hook to handle auto-connecting to favorite servers on startup
 */
export function useAutoConnectFavorite({
  autoConnectFavoriteServer,
  initialDataLoaded,
  selectedNetworkName,
  handleConnect,
  autoConnectAttemptedRef,
}: UseAutoConnectFavoriteProps) {
  // Keep refs to avoid re-triggering the effect when these change
  const handleConnectRef = useRef(handleConnect);
  handleConnectRef.current = handleConnect;
  const selectedNetworkNameRef = useRef(selectedNetworkName);
  selectedNetworkNameRef.current = selectedNetworkName;

  // Clear attempted connections when setting is disabled
  useEffect(() => {
    if (!autoConnectFavoriteServer) {
      autoConnectAttemptedRef.current.clear();
    }
  }, [autoConnectFavoriteServer, autoConnectAttemptedRef]);

  // Auto-connect logic — only depends on autoConnectFavoriteServer and initialDataLoaded
  useEffect(() => {
    if (!autoConnectFavoriteServer || !initialDataLoaded) {
      return;
    }

    (async () => {
      try {
        const networks = await settingsService.loadNetworks();
        if (networks.length === 0) {
          return;
        }

        const startupTargets = networks.filter(n => n.connectOnStartup);
        const favoriteTargets = networks.filter(n => (n.servers || []).some(s => s.favorite));
        // Merge startup and favorite targets, avoiding duplicates
        const targetIds = new Set<string>();
        let targets: IRCNetworkConfig[] = [];
        // Add startup targets first
        for (const target of startupTargets) {
          if (!targetIds.has(target.id)) {
            targetIds.add(target.id);
            targets.push(target);
          }
        }
        // Add favorite targets
        for (const target of favoriteTargets) {
          if (!targetIds.has(target.id)) {
            targetIds.add(target.id);
            targets.push(target);
          }
        }

        // Quick Connect Network is always included first
        const quickConnectNetworkId = await settingsService.getSetting<string | null>('quickConnectNetworkId', null);
        if (quickConnectNetworkId) {
          const quickNet = networks.find(n => n.id === quickConnectNetworkId);
          if (quickNet && !targets.some(t => t.id === quickNet.id)) {
            targets = [quickNet, ...targets];
          } else if (quickNet) {
            // Move quick connect to front
            targets = [quickNet, ...targets.filter(t => t.id !== quickNet.id)];
          }
        }

        if (targets.length === 0 && selectedNetworkNameRef.current) {
          const selected = networks.find(n => n.name === selectedNetworkNameRef.current);
          if (selected) {
            targets = [selected];
          }
        }

        if (targets.length === 0 && networks[0]) {
          targets = [networks[0]];
        }

        // Collect all targets to connect, then fire in parallel
        const toConnect: IRCNetworkConfig[] = [];
        for (const target of targets) {
          if (!target?.name) continue;
          if (autoConnectAttemptedRef.current.has(target.name)) continue;
          if (connectionManager.hasConnection(target.name)) continue;
          autoConnectAttemptedRef.current.add(target.name);
          toConnect.push(target);
        }
        console.log(`AutoConnect: Connecting to ${toConnect.length} networks: ${toConnect.map(t => t.name).join(', ')}`);
        // Fire all connections in parallel so state changes from one don't block others
        await Promise.all(toConnect.map(target => handleConnectRef.current(target)));
      } catch (err) {
        console.error('Auto-connect favorite server failed', err);
      }
    })();
  }, [autoConnectFavoriteServer, initialDataLoaded, autoConnectAttemptedRef]);
}

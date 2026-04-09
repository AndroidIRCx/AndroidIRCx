/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useEffect, useRef } from 'react';
import { useTabStore } from '../stores/tabStore';

interface UseServerTabNameSyncParams {
  networkName: string;
}

export const useServerTabNameSync = (params: UseServerTabNameSyncParams) => {
  const { networkName } = params;
  const prevNetworkNameRef = useRef(networkName);

  useEffect(() => {
    // Only run if networkName actually changed
    if (networkName === prevNetworkNameRef.current) {
      return;
    }
    prevNetworkNameRef.current = networkName;

    if (networkName && networkName !== 'Not connected') {
      const store = useTabStore.getState();
      const currentTabs = store.tabs;

      const needsUpdate = currentTabs.some(
        tab =>
          tab.type === 'server' &&
          tab.networkId === networkName &&
          tab.name !== networkName,
      );

      if (needsUpdate) {
        // Only call updateTab for the specific tabs that need updating
        // This avoids creating new array references
        currentTabs.forEach(tab => {
          if (
            tab.type === 'server' &&
            tab.networkId === networkName &&
            tab.name !== networkName
          ) {
            store.updateTab(tab.id, { name: networkName });
          }
        });
      }
    }
  }, [networkName]);
};

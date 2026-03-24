/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * useTabEncryption Hook
 *
 * Manages tab encryption state synchronization:
 * - Reconciles tab encryption flags with stored keys/bundles
 * - Handles "always encrypt" setting changes
 * - Auto-enables sendEncrypted when keys exist and always encrypt is on
 */

import { useEffect } from 'react';
import { useTabStore } from '../stores/tabStore';
import { channelEncryptionService } from '../services/ChannelEncryptionService';
import { encryptedDMService } from '../services/EncryptedDMService';
import { channelEncryptionSettingsService } from '../services/ChannelEncryptionSettingsService';

interface UseTabEncryptionProps {
  isConnected: boolean;
  setTabs: (updater: any) => void;
  tabsRef: React.MutableRefObject<any[]>;
}

export function useTabEncryption({ isConnected, setTabs, tabsRef }: UseTabEncryptionProps) {
  // Effect: Reconcile tab encryption flags with stored keys
  // Run when connection state changes to avoid infinite loops
  useEffect(() => {
    if (!isConnected) return;

    let cancelled = false;

    const refresh = async () => {
      const currentTabs = useTabStore.getState().tabs;

      const updated = await Promise.all(
        currentTabs.map(async (tab) => {
          // Handle channel encryption
          if (tab.type === 'channel') {
            const hasKey = await channelEncryptionService.hasChannelKey(tab.name, tab.networkId);
            const alwaysEncrypt = await channelEncryptionSettingsService.getAlwaysEncrypt(
              tab.name,
              tab.networkId
            );

            // Auto-enable sendEncrypted if "always encrypt" is on AND key exists
            const shouldSendEncrypted = alwaysEncrypt && hasKey;

            // Update tab if encryption state changed
            if (
              tab.isEncrypted !== hasKey ||
              (!hasKey && tab.sendEncrypted) ||
              (shouldSendEncrypted && !tab.sendEncrypted)
            ) {
              return {
                ...tab,
                isEncrypted: hasKey,
                sendEncrypted: shouldSendEncrypted || (hasKey ? tab.sendEncrypted : false),
              };
            }
          }

          // Handle query (DM) encryption
          else if (tab.type === 'query') {
            const network = tab.networkId || '';
            const hasBundle = await encryptedDMService.isEncryptedForNetwork(network, tab.name);
            const alwaysEncrypt = await channelEncryptionSettingsService.getAlwaysEncrypt(
              tab.name,
              tab.networkId
            );

            // Auto-enable sendEncrypted if "always encrypt" is on AND bundle exists
            const shouldSendEncrypted = alwaysEncrypt && hasBundle;

            // Update tab if encryption state changed
            if (
              tab.isEncrypted !== hasBundle ||
              (!hasBundle && tab.sendEncrypted) ||
              (shouldSendEncrypted && !tab.sendEncrypted)
            ) {
              return {
                ...tab,
                isEncrypted: hasBundle,
                sendEncrypted: shouldSendEncrypted || (hasBundle ? tab.sendEncrypted : false),
              };
            }
          }

          return tab;
        })
      );

      // Only update if something actually changed
      const changed = updated.some((t, idx) => t !== currentTabs[idx]);
      if (changed && !cancelled) {
        setTabs(updated);
      }
    };

    refresh();

    return () => {
      cancelled = true;
    };
  }, [isConnected, setTabs]);

  // Effect: Listen for "always encrypt" setting changes and update tabs
  useEffect(() => {
    const unsubscribe = channelEncryptionSettingsService.onAlwaysEncryptChange(
      async (channel, network, value) => {
        const currentTabs = tabsRef.current;

        // Update tabs that match the channel/network
        const updated = await Promise.all(
          currentTabs.map(async (tab) => {
            if (
              (tab.type === 'channel' || tab.type === 'query') &&
              tab.name.toLowerCase() === channel.toLowerCase() &&
              tab.networkId.toLowerCase() === network.toLowerCase()
            ) {
              // Check if key/bundle exists
              const tabNetwork = tab.networkId || '';
              const hasKey =
                tab.type === 'channel'
                  ? await channelEncryptionService.hasChannelKey(tab.name, tab.networkId)
                  : await encryptedDMService.isEncryptedForNetwork(tabNetwork, tab.name);

              // Update sendEncrypted based on always encrypt setting and key existence
              const shouldSendEncrypted = value && hasKey;
              return { ...tab, sendEncrypted: shouldSendEncrypted };
            }
            return tab;
          })
        );

        // Only update if something changed
        const changed = updated.some((t, idx) => t !== currentTabs[idx]);
        if (changed) {
          setTabs(updated);
        }
      }
    );

    return () => unsubscribe();
  }, [setTabs, tabsRef]);
}

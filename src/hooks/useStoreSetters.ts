/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * useStoreSetters.ts
 *
 * Hook that provides stable setter references for all Zustand stores.
 * Consolidates all setter wrappers from App.tsx to reduce code duplication.
 */

import { useCallback } from 'react';
import { useConnectionStore } from '../stores/connectionStore';
import { useTabStore } from '../stores/tabStore';
import { useUIStore } from '../stores/uiStore';
import { useMessageStore } from '../stores/messageStore';
import { ChannelTab } from '../types';
import { RawMessageCategory } from '../services/IRCService';

/**
 * Hook that provides stable setter references for all stores.
 * All setters are wrapped in useCallback with empty deps to ensure stability.
 */
export function useStoreSetters() {
  // Connection store setters
  const setActiveTabId = useCallback((id: string) => {
    useTabStore.getState().setActiveTabId(id);
  }, []);

  const setIsConnected = useCallback((value: boolean) => {
    useConnectionStore.getState().setIsConnected(value);
  }, []);

  const setNetworkName = useCallback((name: string) => {
    useConnectionStore.getState().setNetworkName(name);
  }, []);

  const setPrimaryNetworkId = useCallback((id: string | null) => {
    useConnectionStore.getState().setPrimaryNetworkId(id);
  }, []);

  const setActiveConnectionId = useCallback((id: string | null) => {
    useConnectionStore.getState().setActiveConnectionId(id);
  }, []);

  const setPing = useCallback((value: number) => {
    useConnectionStore.getState().setPing(value);
  }, []);

  // Wrapper to support functional updates (for backward compatibility)
  // Use direct store access to avoid dependency issues
  const setTabs = useCallback(
    (updater: ChannelTab[] | ((prev: ChannelTab[]) => ChannelTab[])) => {
      const store = useTabStore.getState();
      const currentTabs = store.tabs;
      const newTabs =
        typeof updater === 'function' ? updater(currentTabs) : updater;

      // Only update if tabs actually changed (reference equality check)
      if (newTabs !== currentTabs) {
        store.setTabs(newTabs);
      }
    },
    [],
  ); // No dependencies - always uses current store state

  // UI store setters
  const setShowFirstRunSetup = useCallback((value: boolean) => {
    useUIStore.getState().setShowFirstRunSetup(value);
  }, []);

  const setIsCheckingFirstRun = useCallback((value: boolean) => {
    useUIStore.getState().setIsCheckingFirstRun(value);
  }, []);

  const setShowRawCommands = useCallback((value: boolean) => {
    useUIStore.getState().setShowRawCommands(value);
  }, []);

  const setRawCategoryVisibility = useCallback(
    (visibility: Record<RawMessageCategory, boolean>) => {
      useUIStore.getState().setRawCategoryVisibility(visibility);
    },
    [],
  );

  const setShowTypingIndicators = useCallback((value: boolean) => {
    useUIStore.getState().setShowTypingIndicators(value);
  }, []);

  const setHideJoinMessages = useCallback((value: boolean) => {
    useUIStore.getState().setHideJoinMessages(value);
  }, []);

  const setHidePartMessages = useCallback((value: boolean) => {
    useUIStore.getState().setHidePartMessages(value);
  }, []);

  const setHideQuitMessages = useCallback((value: boolean) => {
    useUIStore.getState().setHideQuitMessages(value);
  }, []);

  const setHideIrcServiceListenerMessages = useCallback((value: boolean) => {
    useUIStore.getState().setHideIrcServiceListenerMessages(value);
  }, []);

  // Message store setters
  const setTypingUser = useCallback(
    (networkId: string, target: string, nick: string, status: any) => {
      useMessageStore.getState().setTypingUser(networkId, target, nick, status);
    },
    [],
  );

  const removeTypingUser = useCallback(
    (networkId: string, target: string, nick: string) => {
      useMessageStore.getState().removeTypingUser(networkId, target, nick);
    },
    [],
  );

  const clearTypingForTarget = useCallback(
    (networkId: string, target: string) => {
      useMessageStore.getState().clearTypingForTarget(networkId, target);
    },
    [],
  );

  const cleanupStaleTyping = useCallback(() => {
    useMessageStore.getState().cleanupStaleTyping();
  }, []);

  // App lock setters
  const setAppLockEnabled = useCallback((value: boolean) => {
    useUIStore.getState().setAppLockEnabled(value);
  }, []);

  const setAppLockUseBiometric = useCallback((value: boolean) => {
    useUIStore.getState().setAppLockUseBiometric(value);
  }, []);

  const setAppLockAutoBiometricPrompt = useCallback((value: boolean) => {
    useUIStore.getState().setAppLockAutoBiometricPrompt(value);
  }, []);

  const setAppLockUsePin = useCallback((value: boolean) => {
    useUIStore.getState().setAppLockUsePin(value);
  }, []);

  const setAppLockOnLaunch = useCallback((value: boolean) => {
    useUIStore.getState().setAppLockOnLaunch(value);
  }, []);

  const setAppLockOnBackground = useCallback((value: boolean) => {
    useUIStore.getState().setAppLockOnBackground(value);
  }, []);

  const setAppLocked = useCallback((value: boolean) => {
    useUIStore.getState().setAppLocked(value);
  }, []);

  const setAppUnlockModalVisible = useCallback((value: boolean) => {
    useUIStore.getState().setAppUnlockModalVisible(value);
  }, []);

  const setAppPinEntry = useCallback((value: string) => {
    useUIStore.getState().setAppPinEntry(value);
  }, []);

  const setAppPinError = useCallback((value: string) => {
    useUIStore.getState().setAppPinError(value);
  }, []);

  // Banner/ad setters
  const setBannerVisible = useCallback((value: boolean) => {
    useUIStore.getState().setBannerVisible(value);
  }, []);

  const setScriptingTimeMs = useCallback((value: number) => {
    useUIStore.getState().setScriptingTimeMs(value);
  }, []);

  const setAdFreeTimeMs = useCallback((value: number) => {
    useUIStore.getState().setAdFreeTimeMs(value);
  }, []);

  // Modal setters
  const setChannelName = useCallback((value: string) => {
    useUIStore.getState().setChannelName(value);
  }, []);

  const setChannelNoteValue = useCallback((value: string) => {
    useUIStore.getState().setChannelNoteValue(value);
  }, []);

  const setRenameValue = useCallback((value: string) => {
    useUIStore.getState().setRenameValue(value);
  }, []);

  const setDccSendPath = useCallback((value: string) => {
    useUIStore.getState().setDccSendPath(value);
  }, []);

  const setShowOptionsMenu = useCallback((value: boolean) => {
    useUIStore.getState().setShowOptionsMenu(value);
  }, []);

  const setShowSettings = useCallback((value: boolean) => {
    useUIStore.getState().setShowSettings(value);
  }, []);

  // Help screen setters
  const setShowHelpConnection = useCallback((value: boolean) => {
    useUIStore.getState().setShowHelpConnection(value);
  }, []);

  const setShowHelpCommands = useCallback((value: boolean) => {
    useUIStore.getState().setShowHelpCommands(value);
  }, []);

  const setShowHelpEncryption = useCallback((value: boolean) => {
    useUIStore.getState().setShowHelpEncryption(value);
  }, []);

  const setShowHelpMedia = useCallback((value: boolean) => {
    useUIStore.getState().setShowHelpMedia(value);
  }, []);

  const setShowHelpChannelManagement = useCallback((value: boolean) => {
    useUIStore.getState().setShowHelpChannelManagement(value);
  }, []);

  const setShowHelpTroubleshooting = useCallback((value: boolean) => {
    useUIStore.getState().setShowHelpTroubleshooting(value);
  }, []);

  return {
    // Connection setters
    setActiveTabId,
    setIsConnected,
    setNetworkName,
    setPrimaryNetworkId,
    setActiveConnectionId,
    setPing,
    setTabs,
    // UI setters
    setShowFirstRunSetup,
    setIsCheckingFirstRun,
    setShowRawCommands,
    setRawCategoryVisibility,
    setShowTypingIndicators,
    setHideJoinMessages,
    setHidePartMessages,
    setHideQuitMessages,
    setHideIrcServiceListenerMessages,
    // Message setters
    setTypingUser,
    removeTypingUser,
    clearTypingForTarget,
    cleanupStaleTyping,
    // App lock setters
    setAppLockEnabled,
    setAppLockUseBiometric,
    setAppLockAutoBiometricPrompt,
    setAppLockUsePin,
    setAppLockOnLaunch,
    setAppLockOnBackground,
    setAppLocked,
    setAppUnlockModalVisible,
    setAppPinEntry,
    setAppPinError,
    // Banner/ad setters
    setBannerVisible,
    setScriptingTimeMs,
    setAdFreeTimeMs,
    // Modal setters
    setChannelName,
    setChannelNoteValue,
    setRenameValue,
    setDccSendPath,
    setShowOptionsMenu,
    setShowSettings,
    // Help screen setters
    setShowHelpConnection,
    setShowHelpCommands,
    setShowHelpEncryption,
    setShowHelpMedia,
    setShowHelpChannelManagement,
    setShowHelpTroubleshooting,
  };
}

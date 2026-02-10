/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * AndroidIRCX - IRC Client
 * @format
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StatusBar,
  View,
  Alert,
  TextInput,
  Modal,
  Text,
  TouchableOpacity,
  AppState,
  LogBox,
} from 'react-native';
import { createStyles } from './App.styles';

// ErrorUtils is available globally in React Native
declare const ErrorUtils: {
  getGlobalHandler: () => ((error: Error, isFatal?: boolean) => void) | null;
  setGlobalHandler: (handler: (error: Error, isFatal?: boolean) => void) => void;
};
import { KeyboardProvider } from 'react-native-keyboard-controller';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { AppLayout } from './src/components/AppLayout';
import { AppModals } from './src/components/AppModals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ircService, IRCMessage, IRCConnectionConfig, ChannelUser, RawMessageCategory } from './src/services/IRCService';
import { settingsService, IRCNetworkConfig, IRCServerConfig, DEFAULT_SERVER, DEFAULT_PART_MESSAGE } from './src/services/SettingsService';
import { connectionManager } from './src/services/ConnectionManager';
import { messageHistoryService } from './src/services/MessageHistoryService';
import { biometricAuthService } from './src/services/BiometricAuthService';
import { secureStorageService } from './src/services/SecureStorageService';
import { errorReportingService } from './src/services/ErrorReportingService';
import { logger } from './src/services/Logger';
import { adRewardService } from './src/services/AdRewardService';
import { bannerAdService } from './src/services/BannerAdService';
import { inAppPurchaseService } from './src/services/InAppPurchaseService';
import { consentService } from './src/services/ConsentService';
import { encryptedDMService } from './src/services/EncryptedDMService';
import { channelEncryptionService } from './src/services/ChannelEncryptionService';
import { channelEncryptionSettingsService } from './src/services/ChannelEncryptionSettingsService';
import { ChannelTab } from './src/types';
import { useTheme } from './src/hooks/useTheme';
import { tabService } from './src/services/TabService';
import { userActivityService } from './src/services/UserActivityService';
import { channelNotesService, ChannelLogEntry } from './src/services/ChannelNotesService';
import { offlineQueueService } from './src/services/OfflineQueueService';
import { dccFileService } from './src/services/DCCFileService';
import { identityProfilesService, IdentityProfile } from './src/services/IdentityProfilesService';
import { getApp } from '@react-native-firebase/app';
import { initializeAppCheck, ReactNativeFirebaseAppCheckProvider } from '@react-native-firebase/app-check';
import { initTransifex, listenToLocaleChanges, TXProvider, tx, useT } from './src/i18n/transifex';

// Zustand stores and custom hooks
import { useUIStore } from './src/stores/uiStore';
import { useConnectionManager } from './src/hooks/useConnectionManager';
import { useTabManager } from './src/hooks/useTabManager';
import { useAppLock } from './src/hooks/useAppLock';
import { useBannerAds } from './src/hooks/useBannerAds';
import { useTabEncryption } from './src/hooks/useTabEncryption';
import { useUISettings } from './src/hooks/useUISettings';
import { useConnectionLifecycle } from './src/hooks/useConnectionLifecycle';
import { useNetworkInitialization } from './src/hooks/useNetworkInitialization';
import { useMessageSending } from './src/hooks/useMessageSending';
import { useConnectionHandler } from './src/hooks/useConnectionHandler';
import { useTabContextMenu } from './src/hooks/useTabContextMenu';
import { useTabActions } from './src/hooks/useTabActions';
import { useStoreSetters } from './src/hooks/useStoreSetters';
import { useUIState } from './src/hooks/useUIState';
import { useAppExit } from './src/hooks/useAppExit';
import { useHeaderActions } from './src/hooks/useHeaderActions';
import { useAppLockActions } from './src/hooks/useAppLockActions';
import { useFirstRunSetup } from './src/hooks/useFirstRunSetup';
import { useSafeAlert } from './src/hooks/useSafeAlert';
import { useMessageBatching } from './src/hooks/useMessageBatching';
import { useAutoJoinChannels } from './src/hooks/useAutoJoinChannels';
import { useRawSettings } from './src/hooks/useRawSettings';
import { useAppStateEffects } from './src/hooks/useAppStateEffects';
import { useServiceHelpers } from './src/hooks/useServiceHelpers';
import { useStartupServices } from './src/hooks/useStartupServices';
import { useKeyboardShortcuts } from './src/hooks/useKeyboardShortcuts';
import { useFirstRunCheck } from './src/hooks/useFirstRunCheck';
import { useLayoutConfig } from './src/hooks/useLayoutConfig';
import { useUserManagementNetworkSync } from './src/hooks/useUserManagementNetworkSync';
import { useServerTabNameSync } from './src/hooks/useServerTabNameSync';
import { useDccSessionSync } from './src/hooks/useDccSessionSync';
import { useTypingCleanup } from './src/hooks/useTypingCleanup';
import { useDccConfig } from './src/hooks/useDccConfig';
import { useDccNotifications } from './src/hooks/useDccNotifications';
import { useAutoConnectFavorite } from './src/hooks/useAutoConnectFavorite';
import { useUserListActions } from './src/hooks/useUserListActions';
import { useAppInitialization } from './src/hooks/useAppInitialization';
import { useLazyMessageHistory } from './src/hooks/useLazyMessageHistory';
import { useDeepLinkHandler } from './src/hooks/useDeepLinkHandler';
import { killSwitchService } from './src/services/KillSwitchService';
import {
  serverTabId,
  channelTabId,
  queryTabId,
  noticeTabId,
  makeServerTab,
  sortTabsGrouped,
} from './src/utils/tabUtils';
import { getActiveTabSafe } from './src/utils/activeTabUtils';

// Suppress noisy pooled synthetic event warnings that can appear in dev logging
LogBox.ignoreLogs([
  'This synthetic event is reused for performance reasons.',
  "It looks like you might be using shared value's .value inside reanimated inline style.",
]);

function App() {
  // Initialize Firebase App Check, consent management, AdMob, and error reporting
  useAppInitialization();

  useEffect(() => {
    initTransifex().catch(() => {});
    const unsubscribe = listenToLocaleChanges();
    return () => unsubscribe();
  }, []);

  return (
    <TXProvider tx={tx}>
      <KeyboardProvider>
        <SafeAreaProvider>
          <StatusBar barStyle="light-content" backgroundColor="#2196F3" />
          <AppContent />
        </SafeAreaProvider>
      </KeyboardProvider>
    </TXProvider>
  );
}

function AppContent() {
  const t = useT();
  const { colors } = useTheme();
  const safeAreaInsets = useSafeAreaInsets();
  const styles = createStyles(colors);

  // Connection state and manager from Zustand store + custom hook
  const connectionManagerHook = useConnectionManager();
  const {
    isConnected,
    networkName,
    selectedNetworkName,
    ping,
    activeConnectionId,
    primaryNetworkId,
    setSelectedNetworkName
  } = connectionManagerHook;

  // Tab state and manager from Zustand store + custom hook
  const tabManagerHook = useTabManager();
  const { tabs, activeTabId } = tabManagerHook;

  // Get all UI state subscriptions from hook (supplements connectionManagerHook and tabManagerHook)
  const uiState = useUIState();
  const {
    showFirstRunSetup,
    isCheckingFirstRun,
    showRawCommands,
    rawCategoryVisibility,
    showTypingIndicators,
    hideJoinMessages,
    hidePartMessages,
    hideQuitMessages,
    hideIrcServiceListenerMessages,
    typingUsers,
    appLockEnabled,
    appLockUseBiometric,
    appLockUsePin,
    appLockOnLaunch,
    appLockOnBackground,
    appLocked,
    appUnlockModalVisible,
    appPinEntry,
    appPinError,
    bannerVisible,
    scriptingTimeMs,
    adFreeTimeMs,
  } = uiState;

  // Get all store setters from hook
  const setters = useStoreSetters();
  const {
    setActiveTabId,
    setIsConnected,
    setNetworkName,
    setPrimaryNetworkId,
    setActiveConnectionId,
    setPing,
    setTabs,
    setShowFirstRunSetup,
    setIsCheckingFirstRun,
    setShowTypingIndicators,
    setHidePartMessages,
    setHideQuitMessages,
    setHideIrcServiceListenerMessages,
    setTypingUser,
    removeTypingUser,
    clearTypingForTarget,
    cleanupStaleTyping,
    setAppLockEnabled,
    setAppLockUseBiometric,
    setAppLockUsePin,
    setAppLockOnLaunch,
    setAppLockOnBackground,
    setAppLocked,
    setAppUnlockModalVisible,
    setAppPinEntry,
    setAppPinError,
    setBannerVisible,
    setScriptingTimeMs,
    setAdFreeTimeMs,
    setChannelName,
    setChannelNoteValue,
    setRenameValue,
    setDccSendPath,
  } = setters;

  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  const appStateRef = useRef(AppState.currentState);

  // Fabric crash protection: track if component is mounted
  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Helper to safely set state only when mounted
  const safeSetState = useCallback((fn: () => void) => {
    if (isMountedRef.current) {
      fn();
    }
  }, []);

  // App lock management (PIN, biometric auth, auto-lock)
  const { attemptBiometricUnlock, handleAppPinUnlock } = useAppLock();
  
  // Kill switch and quick connect settings
  const [killSwitchEnabledOnHeader, setKillSwitchEnabledOnHeader] = useState(false);
  const [killSwitchEnabledOnLockScreen, setKillSwitchEnabledOnLockScreen] = useState(false);
  
  useEffect(() => {
    const loadKillSwitchSettings = async () => {
      const headerEnabled = await settingsService.getSetting('killSwitchEnabledOnHeader', false);
      const lockScreenEnabled = await settingsService.getSetting('killSwitchEnabledOnLockScreen', false);
      setKillSwitchEnabledOnHeader(headerEnabled);
      setKillSwitchEnabledOnLockScreen(lockScreenEnabled);
    };
    loadKillSwitchSettings();
    
    const unsubscribe = settingsService.onSettingChange('killSwitchEnabledOnHeader', (value) => {
      setKillSwitchEnabledOnHeader(Boolean(value));
    });
    const unsubscribe2 = settingsService.onSettingChange('killSwitchEnabledOnLockScreen', (value) => {
      setKillSwitchEnabledOnLockScreen(Boolean(value));
    });
    
    return () => {
      unsubscribe();
      unsubscribe2();
    };
  }, []);
  
  // Kill switch handler for header - checks if warnings enabled, then activates
  const handleKillSwitchFromHeader = useCallback(async () => {
    const showWarnings = await settingsService.getSetting('killSwitchShowWarnings', true);
    await killSwitchService.confirmAndActivate(showWarnings);
  }, []);
  
  // Kill switch handler for unlock screen - verifies PIN/biometric then triggers kill switch (no warnings)
  const handleKillSwitchFromUnlock = useCallback(async () => {
    const store = useUIStore.getState();
    
    // Verify authentication first
    let verified = false;
    
    // If biometric is enabled, try biometric first
    // This is a manual action (kill switch), so pass true for manual retry
    if (store.appLockUseBiometric) {
      const bioResult = await attemptBiometricUnlock(true);
      if (bioResult) {
        verified = true;
      }
    }
    
    // If not verified yet and PIN is enabled, verify PIN
    if (!verified && store.appLockUsePin) {
      const storedPin = await secureStorageService.getSecret('@AndroidIRCX:app-lock-pin');
      if (store.appPinEntry.trim() === storedPin) {
        verified = true;
        // Clear PIN entry after verification
        store.setAppPinEntry('');
        store.setAppPinError('');
      } else {
        // Wrong PIN
        store.setAppPinError('Incorrect PIN. Kill switch requires valid authentication.');
        return;
      }
    }
    
    if (!verified) {
      Alert.alert(t('Error'), t('Kill switch requires PIN or biometric authentication.'));
      return;
    }
    
    // Authentication verified, trigger kill switch directly (no warnings on lock screen)
    const result = await killSwitchService.activateKillSwitch();
    
    // Close unlock modal
    store.setAppUnlockModalVisible(false);
    store.setAppLocked(false);
    
    // Show minimal result if there were errors
    if (!result.success) {
      const errorsText = result.errors.join('\n');
      Alert.alert(
        t('Kill Switch Error'),
        `${t('Some errors occurred:')}\n${errorsText}`
      );
    }
  }, [attemptBiometricUnlock, t]);

  // Banner ad lifecycle management (scripting time, ad-free time, show/hide cycle)
  useBannerAds();

  // Tab encryption state synchronization (reconcile flags with stored keys, "always encrypt" settings)
  useTabEncryption({ isConnected, setTabs, tabsRef });

  // Additional UI settings (not yet in store, keeping as local state for now)
  const [, setAutoSwitchPrivate] = useState(false);
  const [showEncryptionIndicators, setShowEncryptionIndicators] = useState(true);
  const [autoConnectFavoriteServer, setAutoConnectFavoriteServer] = useState(false);
  const autoConnectFavoriteServerRef = useRef(false);
  const [tabSortAlphabetical, setTabSortAlphabetical] = useState(true);
  const [showHeaderSearchButton, setShowHeaderSearchButton] = useState(true);
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);
  const [keyboardAvoidingEnabled, setKeyboardAvoidingEnabled] = useState(true);
  const [keyboardBehaviorIOS, setKeyboardBehaviorIOS] = useState<'padding' | 'height' | 'position' | 'translate-with-padding'>('padding');
  const [keyboardBehaviorAndroid, setKeyboardBehaviorAndroid] = useState<'padding' | 'height' | 'position' | 'translate-with-padding'>('height');
  const [keyboardVerticalOffset, setKeyboardVerticalOffset] = useState(0);
  const [useAndroidBottomSafeArea, setUseAndroidBottomSafeArea] = useState(true);

  const pendingAlertRef = useRef<{ title: string; message?: string; buttons?: any } | null>(null);
  const motdCompleteRef = useRef<Set<string>>(new Set());
  const autoConnectAttemptedRef = useRef<Set<string>>(new Set());

  // Message batching refs to prevent 150+ individual updates during rapid message arrival
  const pendingMessagesRef = useRef<Array<{message: IRCMessage, context: any}>>([]);
  const messageBatchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Process batched messages - called after timeout
  const { processBatchedMessages } = useMessageBatching({
    pendingMessagesRef,
    messageBatchTimeoutRef,
    activeTabId,
    tabSortAlphabetical,
    setTabs,
  });

  const {
    persistentSetShowRawCommands,
    persistentSetRawCategoryVisibility,
    persistentSetShowEncryptionIndicators,
  } = useRawSettings({ setShowEncryptionIndicators });

  const persistentSetShowTypingIndicators = useCallback(
    async (value: boolean) => {
      setShowTypingIndicators(value);
      await settingsService.setSetting('showTypingIndicators', value);
    },
    [setShowTypingIndicators]
  );

  const { safeAlert } = useSafeAlert({ appStateRef, pendingAlertRef });

  useAppStateEffects({
    appStateRef,
    pendingAlertRef,
    activeConnectionId,
    primaryNetworkId,
    setTabs,
  });

  // UI settings loading & synchronization (raw commands, message visibility, preferences)
  useUISettings({
    setAutoSwitchPrivate,
    setTabSortAlphabetical,
    setShowEncryptionIndicators,
    setAutoConnectFavoriteServer,
  });

  useEffect(() => {
    const loadSetting = async () => {
      const enabled = await settingsService.getSetting('showHeaderSearchButton', true);
      setShowHeaderSearchButton(enabled);
    };
    loadSetting();

    const unsubscribe = settingsService.onSettingChange<boolean>('showHeaderSearchButton', (value) => {
      setShowHeaderSearchButton(Boolean(value));
    });

    return () => {
      unsubscribe && unsubscribe();
    };
  }, []);

  useEffect(() => {
    const loadKeyboardSettings = async () => {
      const avoidingEnabled = await settingsService.getSetting('keyboardAvoidingEnabled', true);
      const behaviorIOS = await settingsService.getSetting('keyboardBehaviorIOS', 'padding');
      const behaviorAndroid = await settingsService.getSetting('keyboardBehaviorAndroid', 'height');
      const verticalOffset = await settingsService.getSetting('keyboardVerticalOffset', 0);
      const androidBottomSafeArea = await settingsService.getSetting('useAndroidBottomSafeArea', true);
      setKeyboardAvoidingEnabled(avoidingEnabled);
      setKeyboardBehaviorIOS(behaviorIOS as 'padding' | 'height' | 'position' | 'translate-with-padding');
      setKeyboardBehaviorAndroid(behaviorAndroid as 'padding' | 'height' | 'position' | 'translate-with-padding');
      setKeyboardVerticalOffset(verticalOffset);
      setUseAndroidBottomSafeArea(androidBottomSafeArea);
    };
    loadKeyboardSettings();

    const unsubscribeAvoiding = settingsService.onSettingChange<boolean>('keyboardAvoidingEnabled', (value) => {
      setKeyboardAvoidingEnabled(Boolean(value));
    });
    const unsubscribeBehaviorIOS = settingsService.onSettingChange<string>('keyboardBehaviorIOS', (value) => {
      setKeyboardBehaviorIOS(value as 'padding' | 'height' | 'position' | 'translate-with-padding');
    });
    const unsubscribeBehaviorAndroid = settingsService.onSettingChange<string>('keyboardBehaviorAndroid', (value) => {
      setKeyboardBehaviorAndroid(value as 'padding' | 'height' | 'position' | 'translate-with-padding');
    });
    const unsubscribeVerticalOffset = settingsService.onSettingChange<number>('keyboardVerticalOffset', (value) => {
      const numericValue = typeof value === 'number' ? value : Number(value);
      setKeyboardVerticalOffset(Number.isFinite(numericValue) ? numericValue : 0);
    });
    const unsubscribeAndroidSafeArea = settingsService.onSettingChange<boolean>('useAndroidBottomSafeArea', (value) => {
      setUseAndroidBottomSafeArea(Boolean(value));
    });

    return () => {
      unsubscribeAvoiding();
      unsubscribeBehaviorIOS();
      unsubscribeBehaviorAndroid();
      unsubscribeVerticalOffset();
      unsubscribeAndroidSafeArea();
    };
  }, []);

  useEffect(() => {
    autoConnectFavoriteServerRef.current = autoConnectFavoriteServer;
  }, [autoConnectFavoriteServer]);

  const [channelUsers, setChannelUsers] = useState<Map<string, ChannelUser[]>>(new Map());
  const [dccTransfers, setDccTransfers] = useState(dccFileService.list());
  const [motdSignal, setMotdSignal] = useState(0);

  // Get modal states from useUIState hook
  const {
    showChannelModal,
    channelName,
    showNetworksList,
    showSettings,
    showPurchaseScreen,
    showIgnoreList,
    showWHOIS,
    whoisNick,
    showQueryEncryptionMenu,
    showChannelList,
    showUserList,
    showChannelSettings,
    channelSettingsTarget,
    channelSettingsNetwork,
    showOptionsMenu,
    showRenameModal,
    renameTargetTabId,
    renameValue,
    showTabOptionsModal,
    tabOptionsTitle,
    tabOptions,
    showChannelNoteModal,
    channelNoteTarget,
    channelNoteValue,
    showChannelLogModal,
    channelLogEntries,
    prefillMessage,
    showDccTransfers,
    showDccSendModal,
    dccSendTarget,
    dccSendPath,
  } = uiState;


  // Get active tab with safe fallback
  const activeTab = getActiveTabSafe(tabs, activeTabId, activeConnectionId, primaryNetworkId, networkName);
  const activeMessages = activeTab?.messages || [];
  const activeUsers = activeTab.type === 'channel'
    ? (channelUsers.get(activeTab.name) || [])
    : [];

  const {
    appendServerMessage,
    getActiveIRCService,
    getActiveUserManagementService,
    getActiveCommandService,
    getActiveConnectionQualityService,
    getActiveChannelManagementService,
    normalizeNetworkId,
    getNetworkConfigForId,
  } = useServiceHelpers({ setTabs, tabSortAlphabetical });

  useStartupServices();
  useKeyboardShortcuts({ tabsRef, setActiveTabId });
  useFirstRunCheck({ setShowFirstRunSetup, setIsCheckingFirstRun });

  // Lazy-load message history when tabs are switched (performance optimization)
  useLazyMessageHistory({ activeTabId });

  const layoutConfig = useLayoutConfig();
  const [sideTabsVisible, setSideTabsVisible] = useState(true);

  useEffect(() => {
    if (!layoutConfig) return;
    if (layoutConfig.tabPosition === 'top' || layoutConfig.tabPosition === 'bottom') {
      setSideTabsVisible(true);
    }
  }, [layoutConfig]);
  useUserManagementNetworkSync({ networkName, getActiveUserManagementService });
  useServerTabNameSync({ networkName });
  useDccSessionSync({ isMountedRef, tabSortAlphabetical });
  useTypingCleanup();


  // Network Initialization - Load networks, tabs, and message history
  useNetworkInitialization({
    isCheckingFirstRun,
    showFirstRunSetup,
    primaryNetworkId,
    tabs,
    setSelectedNetworkName,
    setNetworkName,
    setPrimaryNetworkId,
    setTabs,
    setActiveTabId,
    setInitialDataLoaded,
  });

  // Message Sending - Handle all message sending logic (commands, encryption, DCC, offline queue)
  const { handleSendMessage } = useMessageSending({
    isConnected,
    activeTabId,
    getActiveIRCService,
    getActiveCommandService,
    setTabs,
    safeAlert,
    t,
  });

  // Connection Handler - Handle IRC server connection
  const { handleConnect, handleServerConnect } = useConnectionHandler({
    setSelectedNetworkName,
    setActiveConnectionId,
    setNetworkName,
    setPrimaryNetworkId,
    setIsConnected,
    setTabs,
    setActiveTabId,
    appendServerMessage,
    safeAlert,
    t,
    tabsRef,
    primaryNetworkId,
    autoConnectFavoriteServerRef,
  });

  // Tab Actions - Handle tab selection, joins, and bulk closes
  const { handleTabPress, handleJoinChannel, closeAllChannelsAndQueries } = useTabActions({
    activeTabId,
    channelName,
    tabSortAlphabetical,
    tabsRef,
    getActiveIRCService,
    setActiveTabId,
    setNetworkName,
    setActiveConnectionId,
    setTabs,
    setChannelUsers,
  });

  // App Exit - Handle disconnect + app exit workflow
  const { handleExit } = useAppExit({
    isConnected,
    getActiveIRCService,
    safeAlert,
    t,
  });

  // Header Actions - Options menu, settings, and nicklist toggle
  const { handleDropdownPress, handleMenuPress, handleToggleUserList } = useHeaderActions();

  // App Lock Actions - Handle lock button behavior
  const { handleLockButtonPress } = useAppLockActions({
    appLockEnabled,
    appLockUseBiometric,
    appLocked,
    attemptBiometricUnlock,
    safeAlert,
    t,
    setAppLocked,
    setAppUnlockModalVisible,
  });

  // First Run Setup - Handle setup completion flow
  const { handleFirstRunSetupComplete } = useFirstRunSetup({
    setShowFirstRunSetup,
    handleConnect,
  });

  // Deep Link Handler - Handle IRC URL deep links (irc:// and ircs://)
  useDeepLinkHandler({
    handleConnect,
    handleJoinChannel,
    isAppLocked: appLocked,
    isFirstRunComplete: !showFirstRunSetup && !isCheckingFirstRun,
    activeConnectionId,
    tabs,
    safeAlert,
    t,
  });

  // Tab Context Menu - Handle tab long press menu options
  const { handleTabLongPress } = useTabContextMenu({
    activeTabId,
    getNetworkConfigForId,
    getActiveIRCService,
    getActiveUserManagementService,
    handleConnect,
    closeAllChannelsAndQueries,
    normalizeNetworkId,
    primaryNetworkId,
    safeAlert,
    t,
    setTabs,
    setActiveTabId,
    setNetworkName,
    setActiveConnectionId,
    tabSortAlphabetical,
    ircService,
  });

  // IRC Connection Lifecycle - Event listeners and message routing
  useConnectionLifecycle({
    processBatchedMessages,
    safeSetState,
    safeAlert,
    setIsConnected,
    setActiveConnectionId,
    setNetworkName,
    setTabs,
    setActiveTabId,
    setChannelUsers,
    setPing,
    setTypingUser,
    setMotdSignal,
    networkName,
    activeTabId,
    tabsRef,
    tabSortAlphabetical,
    isConnected,
    messageBatchTimeoutRef,
    pendingMessagesRef,
    motdCompleteRef,
    isMountedRef,
    handleServerConnect,
  });

  // Configure DCC port range from settings
  useDccConfig();

  // Listen for DCC file transfers to show alerts (basic notifications)
  useDccNotifications({ safeAlert, t, setDccTransfers, isMountedRef });

  // Auto-connect to favorite servers on startup
  useAutoConnectFavorite({
    autoConnectFavoriteServer,
    initialDataLoaded,
    selectedNetworkName: selectedNetworkName ?? '',
    handleConnect,
    autoConnectAttemptedRef,
  });

  // Auto-join channels after registration
  useAutoJoinChannels({
    isConnected,
    activeConnectionId,
    selectedNetworkName,
    getActiveIRCService,
    motdCompleteRef,
    motdSignal,
  });

  // Note: /server command handling is now in useConnectionHandler.handleServerConnect
  // and called directly from useConnectionLifecycle, so no need for event listener here


  // Remove handleAddPress as its logic is now merged into handleDropdownPress
  // const handleAddPress = useCallback(() => { /* ... (old code removed) ... */ }, [handleConnect, isConnected]);

  // UI ready delay to prevent Fabric race condition
  const [uiReady, setUiReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setUiReady(true);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const showNicklistButton = activeTab?.type === 'channel';
  const focusedNetworkId =
    activeTab?.networkId ||
    activeConnectionId ||
    (networkName !== 'Not connected' ? networkName : undefined) ||
    tabs.find(t => t.type === 'server')?.networkId;
  const showSideTabsToggle = layoutConfig?.tabPosition === 'left' || layoutConfig?.tabPosition === 'right';

  // User list action handlers
  const { handleUserPress, handleWHOISPress } = useUserListActions({
    tabs,
    activeTab,
    tabSortAlphabetical,
    setTabs,
    setActiveTabId,
  });

  // Wait for UI to be ready to prevent Fabric crashes
  if (!uiReady) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  return (
    <>
      <AppLayout
        tabs={tabs}
        activeTabId={activeTabId}
        activeTab={activeTab}
        activeMessages={activeMessages}
        activeUsers={activeUsers}
        isConnected={isConnected}
        networkName={networkName}
        selectedNetworkName={selectedNetworkName}
        ping={ping}
        showRawCommands={showRawCommands}
        rawCategoryVisibility={rawCategoryVisibility}
        hideJoinMessages={hideJoinMessages}
        hidePartMessages={hidePartMessages}
        hideQuitMessages={hideQuitMessages}
        hideIrcServiceListenerMessages={hideIrcServiceListenerMessages}
        showEncryptionIndicators={showEncryptionIndicators}
        showTypingIndicators={showTypingIndicators}
        typingUsers={typingUsers}
        bannerVisible={bannerVisible}
        prefillMessage={prefillMessage}
        layoutConfig={layoutConfig}
        sideTabsVisible={sideTabsVisible}
        showSideTabsToggle={showSideTabsToggle}
        onToggleSideTabs={() => setSideTabsVisible(prev => !prev)}
        showNicklistButton={showNicklistButton}
        showSearchButton={showHeaderSearchButton}
        appLockEnabled={appLockEnabled}
        appLocked={appLocked}
        showUserList={showUserList}
        safeAreaInsets={safeAreaInsets}
        keyboardAvoidingEnabled={keyboardAvoidingEnabled}
        keyboardBehaviorIOS={keyboardBehaviorIOS}
        keyboardBehaviorAndroid={keyboardBehaviorAndroid}
        keyboardVerticalOffset={keyboardVerticalOffset}
        useAndroidBottomSafeArea={useAndroidBottomSafeArea}
        styles={styles}
        handleTabPress={handleTabPress}
        handleTabLongPress={handleTabLongPress}
        handleSendMessage={handleSendMessage}
        handleDropdownPress={handleDropdownPress}
        handleMenuPress={handleMenuPress}
        handleConnect={handleConnect}
        handleToggleUserList={handleToggleUserList}
        handleLockButtonPress={handleLockButtonPress}
        handleUserPress={handleUserPress}
        handleWHOISPress={handleWHOISPress}
        showKillSwitchButton={killSwitchEnabledOnHeader}
        onKillSwitchPress={handleKillSwitchFromHeader}
      />
      <AppModals
        activeTab={activeTab}
        isConnected={isConnected}
        networkName={networkName}
        focusedNetworkId={focusedNetworkId}
        showRawCommands={showRawCommands}
        rawCategoryVisibility={rawCategoryVisibility}
        showEncryptionIndicators={showEncryptionIndicators}
        showTypingIndicators={showTypingIndicators}
        tabSortAlphabetical={tabSortAlphabetical}
        dccTransfers={dccTransfers}
        channelName={channelName}
        handleConnect={handleConnect}
        handleJoinChannel={handleJoinChannel}
        handleExit={handleExit}
        handleFirstRunSetupComplete={handleFirstRunSetupComplete}
        persistentSetShowRawCommands={persistentSetShowRawCommands}
        persistentSetRawCategoryVisibility={persistentSetRawCategoryVisibility}
        persistentSetShowEncryptionIndicators={persistentSetShowEncryptionIndicators}
        persistentSetShowTypingIndicators={persistentSetShowTypingIndicators}
        setActiveConnectionId={setActiveConnectionId}
        setTabs={setTabs}
        getActiveIRCService={getActiveIRCService}
        safeAlert={safeAlert}
        attemptBiometricUnlock={attemptBiometricUnlock}
        handleAppPinUnlock={handleAppPinUnlock}
        onKillSwitchFromUnlock={handleKillSwitchFromUnlock}
        killSwitchEnabledOnLockScreen={killSwitchEnabledOnLockScreen}
        styles={styles}
        colors={colors}
      />
    </>
  );
}

export default App;

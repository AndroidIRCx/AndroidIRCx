/**
 * useUIState.ts
 *
 * Hook that provides UI state subscriptions from Zustand stores.
 * Consolidates all UI state subscriptions from App.tsx.
 */

import { useConnectionStore } from '../stores/connectionStore';
import { useTabStore } from '../stores/tabStore';
import { useUIStore } from '../stores/uiStore';
import { useMessageStore } from '../stores/messageStore';

/**
 * Hook that provides all UI state subscriptions.
 * Uses selective subscriptions to minimize re-renders.
 */
export function useUIState() {
  // Connection state
  const isConnected = useConnectionStore(state => state.isConnected);
  const networkName = useConnectionStore(state => state.networkName);
  const activeConnectionId = useConnectionStore(state => state.activeConnectionId);
  const primaryNetworkId = useConnectionStore(state => state.primaryNetworkId);
  const ping = useConnectionStore(state => state.ping);

  // Tab state
  const tabs = useTabStore(state => state.tabs);
  const activeTabId = useTabStore(state => state.activeTabId);

  // UI state from Zustand store - ONLY subscribe to state values
  const showFirstRunSetup = useUIStore(state => state.showFirstRunSetup);
  const isCheckingFirstRun = useUIStore(state => state.isCheckingFirstRun);
  const showRawCommands = useUIStore(state => state.showRawCommands);
  const rawCategoryVisibility = useUIStore(state => state.rawCategoryVisibility);
  const showTypingIndicators = useUIStore(state => state.showTypingIndicators);
  const hideJoinMessages = useUIStore(state => state.hideJoinMessages);
  const hidePartMessages = useUIStore(state => state.hidePartMessages);
  const hideQuitMessages = useUIStore(state => state.hideQuitMessages);
  const hideIrcServiceListenerMessages = useUIStore(state => state.hideIrcServiceListenerMessages);

  // Message state
  const typingUsers = useMessageStore(state => state.typingUsers);

  // App lock and banner states from UI store
  const appLockEnabled = useUIStore(state => state.appLockEnabled);
  const appLockUseBiometric = useUIStore(state => state.appLockUseBiometric);
  const appLockUsePin = useUIStore(state => state.appLockUsePin);
  const appLockOnLaunch = useUIStore(state => state.appLockOnLaunch);
  const appLockOnBackground = useUIStore(state => state.appLockOnBackground);
  const appLocked = useUIStore(state => state.appLocked);
  const appUnlockModalVisible = useUIStore(state => state.appUnlockModalVisible);
  const appPinEntry = useUIStore(state => state.appPinEntry);
  const appPinError = useUIStore(state => state.appPinError);
  const bannerVisible = useUIStore(state => state.bannerVisible);
  const scriptingTimeMs = useUIStore(state => state.scriptingTimeMs);
  const adFreeTimeMs = useUIStore(state => state.adFreeTimeMs);

  // Modal states
  const showChannelModal = useUIStore(state => state.showChannelModal);
  const channelName = useUIStore(state => state.channelName);
  const showNetworksList = useUIStore(state => state.showNetworksList);
  const showSettings = useUIStore(state => state.showSettings);
  const showPurchaseScreen = useUIStore(state => state.showPurchaseScreen);
  const showIgnoreList = useUIStore(state => state.showIgnoreList);
  const showBlacklist = useUIStore(state => state.showBlacklist);
  const showWHOIS = useUIStore(state => state.showWHOIS);
  const whoisNick = useUIStore(state => state.whoisNick);
  const showQueryEncryptionMenu = useUIStore(state => state.showQueryEncryptionMenu);
  const showChannelList = useUIStore(state => state.showChannelList);
  const showUserList = useUIStore(state => state.showUserList);
  const showChannelSettings = useUIStore(state => state.showChannelSettings);
  const channelSettingsTarget = useUIStore(state => state.channelSettingsTarget);
  const channelSettingsNetwork = useUIStore(state => state.channelSettingsNetwork);
  const showOptionsMenu = useUIStore(state => state.showOptionsMenu);
  const showRenameModal = useUIStore(state => state.showRenameModal);
  const renameTargetTabId = useUIStore(state => state.renameTargetTabId);
  const renameValue = useUIStore(state => state.renameValue);
  const showTabOptionsModal = useUIStore(state => state.showTabOptionsModal);
  const tabOptionsTitle = useUIStore(state => state.tabOptionsTitle);
  const tabOptions = useUIStore(state => state.tabOptions);
  const showChannelNoteModal = useUIStore(state => state.showChannelNoteModal);
  const channelNoteTarget = useUIStore(state => state.channelNoteTarget);
  const channelNoteValue = useUIStore(state => state.channelNoteValue);
  const showChannelLogModal = useUIStore(state => state.showChannelLogModal);
  const channelLogEntries = useUIStore(state => state.channelLogEntries);
  const prefillMessage = useUIStore(state => state.prefillMessage);
  const showDccTransfers = useUIStore(state => state.showDccTransfers);
  const dccTransfersMinimized = useUIStore(state => state.dccTransfersMinimized);
  const showDccSendModal = useUIStore(state => state.showDccSendModal);
  const dccSendTarget = useUIStore(state => state.dccSendTarget);
  const dccSendPath = useUIStore(state => state.dccSendPath);
  const showHelpConnection = useUIStore(state => state.showHelpConnection);
  const showHelpCommands = useUIStore(state => state.showHelpCommands);
  const showHelpEncryption = useUIStore(state => state.showHelpEncryption);
  const showHelpMedia = useUIStore(state => state.showHelpMedia);
  const showHelpChannelManagement = useUIStore(state => state.showHelpChannelManagement);
  const showHelpTroubleshooting = useUIStore(state => state.showHelpTroubleshooting);

  return {
    // Connection state
    isConnected,
    networkName,
    activeConnectionId,
    primaryNetworkId,
    ping,
    // Tab state
    tabs,
    activeTabId,
    // UI state
    showFirstRunSetup,
    isCheckingFirstRun,
    showRawCommands,
    rawCategoryVisibility,
    showTypingIndicators,
    hideJoinMessages,
    hidePartMessages,
    hideQuitMessages,
    hideIrcServiceListenerMessages,
    // Message state
    typingUsers,
    // App lock state
    appLockEnabled,
    appLockUseBiometric,
    appLockUsePin,
    appLockOnLaunch,
    appLockOnBackground,
    appLocked,
    appUnlockModalVisible,
    appPinEntry,
    appPinError,
    // Banner/ad state
    bannerVisible,
    scriptingTimeMs,
    adFreeTimeMs,
    // Modal states
    showChannelModal,
    channelName,
    showNetworksList,
    showSettings,
    showPurchaseScreen,
    showIgnoreList,
    showBlacklist,
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
    dccTransfersMinimized,
    showDccSendModal,
    dccSendTarget,
    dccSendPath,
    showHelpConnection,
    showHelpCommands,
    showHelpEncryption,
    showHelpMedia,
    showHelpChannelManagement,
    showHelpTroubleshooting,
  };
}

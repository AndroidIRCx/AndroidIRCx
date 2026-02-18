/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * uiStore.ts
 *
 * Zustand store for UI state management.
 * Handles modals, app lock, banners, first run, etc.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RawMessageCategory } from '../services/IRCService';
import { ChannelLogEntry } from '../services/ChannelNotesService';


export interface UIState {
  // First run setup
  showFirstRunSetup: boolean;
  isCheckingFirstRun: boolean;

  // App lock
  appLockEnabled: boolean;
  appLockUseBiometric: boolean;
  appLockUsePin: boolean;
  appLockOnLaunch: boolean;
  appLockOnBackground: boolean;
  appLocked: boolean;
  appUnlockModalVisible: boolean;
  appPinEntry: string;
  appPinError: string;

  // Banners & Ads
  bannerVisible: boolean;
  scriptingTimeMs: number;
  adFreeTimeMs: number;

  // Message display settings
  showRawCommands: boolean;
  rawCategoryVisibility: Record<RawMessageCategory, boolean>;
  showTypingIndicators: boolean;
  hideJoinMessages: boolean;
  hidePartMessages: boolean;
  hideQuitMessages: boolean;
  hideIrcServiceListenerMessages: boolean;

  // Modals & Screens
  showChannelModal: boolean;
  channelName: string;
  showNetworksList: boolean;
  showSettings: boolean;
  showPurchaseScreen: boolean;
  showIgnoreList: boolean;
  showBlacklist: boolean;
  showWHOIS: boolean;
  whoisNick: string;
  whoisDisplayMode: 'modal' | 'active' | 'status';
  swipeBehavior: 'off' | 'switch-tabs' | 'show-panels';
  showQueryEncryptionMenu: boolean;
  showChannelList: boolean;
  showUserList: boolean;
  showChannelSettings: boolean;
  channelSettingsTarget: string | null;
  channelSettingsNetwork: string | null;
  showOptionsMenu: boolean;
  showRenameModal: boolean;
  renameTargetTabId: string | null;
  renameValue: string;
  showTabOptionsModal: boolean;
  tabOptionsTitle: string;
  tabOptions: Array<{ text: string; onPress: () => void; style?: 'destructive' | 'cancel' }>;
  showChannelNoteModal: boolean;
  channelNoteTarget: { networkId: string; channel: string } | null;
  channelNoteValue: string;
  showChannelLogModal: boolean;
  channelLogEntries: ChannelLogEntry[];
  prefillMessage: string | null;
  showDccTransfers: boolean;
  dccTransfersMinimized: boolean;
  showDccSendModal: boolean;
  dccSendTarget: { nick: string; networkId: string } | null;
  dccSendPath: string;

  // Blacklist
  blacklistTarget: {
    type: 'channel' | 'query' | 'nick';
    networkId: string;
    channel?: string;
    nick?: string;
  } | null;

  // User Lists
  showUserLists: boolean;
  userListsInitialTab: 'notify' | 'ignore' | 'autoop' | 'autovoice' | 'autohalfop' | 'blacklist' | 'other';
  userListTarget: {
    listType: 'notify' | 'ignore' | 'autoop' | 'autovoice' | 'autohalfop' | 'blacklist' | 'other';
    networkId: string;
    nick: string;
    mask?: string;
    channels?: string[];
  } | null;

  // Help Screens
  showHelpConnection: boolean;
  showHelpCommands: boolean;
  showHelpEncryption: boolean;
  showHelpMedia: boolean;
  showHelpChannelManagement: boolean;
  showHelpTroubleshooting: boolean;

  // Actions - First Run
  setShowFirstRunSetup: (show: boolean) => void;
  setIsCheckingFirstRun: (checking: boolean) => void;

  // Actions - App Lock
  setAppLockEnabled: (enabled: boolean) => void;
  setAppLockUseBiometric: (use: boolean) => void;
  setAppLockUsePin: (use: boolean) => void;
  setAppLockOnLaunch: (lock: boolean) => void;
  setAppLockOnBackground: (lock: boolean) => void;
  setAppLocked: (locked: boolean) => void;
  setAppUnlockModalVisible: (visible: boolean) => void;
  setAppPinEntry: (pin: string) => void;
  setAppPinError: (error: string) => void;

  // Actions - Banners
  setBannerVisible: (visible: boolean) => void;
  setScriptingTimeMs: (time: number) => void;
  setAdFreeTimeMs: (time: number) => void;
  incrementScriptingTime: (ms: number) => void;
  incrementAdFreeTime: (ms: number) => void;
  decrementScriptingTime: (ms: number) => void;
  decrementAdFreeTime: (ms: number) => void;

  // Actions - Message Display
  setShowRawCommands: (show: boolean) => void;
  setRawCategoryVisibility: (visibility: Record<RawMessageCategory, boolean>) => void;
  toggleRawCategory: (category: RawMessageCategory) => void;
  setShowTypingIndicators: (show: boolean) => void;
  setHideJoinMessages: (hide: boolean) => void;
  setHidePartMessages: (hide: boolean) => void;
  setHideQuitMessages: (hide: boolean) => void;
  setHideIrcServiceListenerMessages: (hide: boolean) => void;

  // Actions - Modals & Screens
  setShowChannelModal: (show: boolean) => void;
  setChannelName: (name: string) => void;
  setShowNetworksList: (show: boolean) => void;
  setShowSettings: (show: boolean) => void;
  setShowPurchaseScreen: (show: boolean) => void;
  setShowIgnoreList: (show: boolean) => void;
  setShowBlacklist: (show: boolean) => void;
  setShowWHOIS: (show: boolean) => void;
  setWhoisNick: (nick: string) => void;
  setWhoisDisplayMode: (mode: 'modal' | 'active' | 'status') => void;
  setSwipeBehavior: (behavior: 'off' | 'switch-tabs' | 'show-panels') => void;
  setShowQueryEncryptionMenu: (show: boolean) => void;
  setShowChannelList: (show: boolean) => void;
  setShowUserList: (show: boolean) => void;
  setShowChannelSettings: (show: boolean) => void;
  setChannelSettingsTarget: (target: string | null) => void;
  setChannelSettingsNetwork: (network: string | null) => void;
  setShowOptionsMenu: (show: boolean) => void;
  setShowRenameModal: (show: boolean) => void;
  setRenameTargetTabId: (tabId: string | null) => void;
  setRenameValue: (value: string) => void;
  setShowTabOptionsModal: (show: boolean) => void;
  setTabOptionsTitle: (title: string) => void;
  setTabOptions: (options: Array<{ text: string; onPress: () => void; style?: 'destructive' | 'cancel' }>) => void;
  setShowChannelNoteModal: (show: boolean) => void;
  setChannelNoteTarget: (target: { networkId: string; channel: string } | null) => void;
  setChannelNoteValue: (value: string) => void;
  setShowChannelLogModal: (show: boolean) => void;
  setChannelLogEntries: (entries: ChannelLogEntry[]) => void;
  setPrefillMessage: (message: string | null) => void;
  setShowDccTransfers: (show: boolean) => void;
  setDccTransfersMinimized: (minimized: boolean) => void;
  setShowDccSendModal: (show: boolean) => void;
  setDccSendTarget: (target: { nick: string; networkId: string } | null) => void;
  setDccSendPath: (path: string) => void;

  // Actions - Blacklist
  setBlacklistTarget: (target: {
    type: 'channel' | 'query' | 'nick';
    networkId: string;
    channel?: string;
    nick?: string;
  } | null) => void;

  // Actions - User Lists
  setShowUserLists: (show: boolean) => void;
  setUserListsInitialTab: (tab: 'notify' | 'ignore' | 'autoop' | 'autovoice' | 'autohalfop' | 'blacklist' | 'other') => void;
  setUserListTarget: (target: {
    listType: 'notify' | 'ignore' | 'autoop' | 'autovoice' | 'autohalfop' | 'blacklist' | 'other';
    networkId: string;
    nick: string;
    mask?: string;
    channels?: string[];
  } | null) => void;

  // Actions - Help Screens
  setShowHelpConnection: (show: boolean) => void;
  setShowHelpCommands: (show: boolean) => void;
  setShowHelpEncryption: (show: boolean) => void;
  setShowHelpMedia: (show: boolean) => void;
  setShowHelpChannelManagement: (show: boolean) => void;
  setShowHelpTroubleshooting: (show: boolean) => void;

  // Bulk updates
  updateUIState: (updates: Partial<UIState>) => void;

  // Reset
  reset: () => void;
}

const initialState = {
  showFirstRunSetup: false,
  isCheckingFirstRun: true,
  appLockEnabled: false,
  appLockUseBiometric: false,
  appLockUsePin: false,
  appLockOnLaunch: true,
  appLockOnBackground: true,
  appLocked: false,
  appUnlockModalVisible: false,
  appPinEntry: '',
  appPinError: '',
  bannerVisible: false,
  scriptingTimeMs: 0,
  adFreeTimeMs: 0,
  showRawCommands: true,
  rawCategoryVisibility: {} as Record<RawMessageCategory, boolean>,
  showTypingIndicators: true,
  hideJoinMessages: false,
  hidePartMessages: false,
  hideQuitMessages: false,
  hideIrcServiceListenerMessages: true,
  showChannelModal: false,
  channelName: '',
  showNetworksList: false,
  showSettings: false,
  showPurchaseScreen: false,
  showIgnoreList: false,
  showBlacklist: false,
  showWHOIS: false,
  whoisNick: '',
  whoisDisplayMode: 'status' as 'modal' | 'active' | 'status',
  swipeBehavior: 'off' as 'off' | 'switch-tabs' | 'show-panels',
  showQueryEncryptionMenu: false,
  showChannelList: false,
  showUserList: false,
  showChannelSettings: false,
  channelSettingsTarget: null,
  channelSettingsNetwork: null,
  showOptionsMenu: false,
  showRenameModal: false,
  renameTargetTabId: null,
  renameValue: '',
  showTabOptionsModal: false,
  tabOptionsTitle: '',
  tabOptions: [],
  showChannelNoteModal: false,
  channelNoteTarget: null,
  channelNoteValue: '',
  showChannelLogModal: false,
  channelLogEntries: [],
  prefillMessage: null,
  showDccTransfers: false,
  dccTransfersMinimized: false,
  showDccSendModal: false,
  dccSendTarget: null,
  dccSendPath: '',
  blacklistTarget: null,
  showUserLists: false,
  userListsInitialTab: 'notify',
  userListTarget: null,
  showHelpConnection: false,
  showHelpCommands: false,
  showHelpEncryption: false,
  showHelpMedia: false,
  showHelpChannelManagement: false,
  showHelpTroubleshooting: false,
};

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      ...initialState,

      // First Run
      setShowFirstRunSetup: (show) => set({ showFirstRunSetup: show }),
      setIsCheckingFirstRun: (checking) => set({ isCheckingFirstRun: checking }),

      // App Lock
      setAppLockEnabled: (enabled) => set({ appLockEnabled: enabled }),
      setAppLockUseBiometric: (use) => set({ appLockUseBiometric: use }),
      setAppLockUsePin: (use) => set({ appLockUsePin: use }),
      setAppLockOnLaunch: (lock) => set({ appLockOnLaunch: lock }),
      setAppLockOnBackground: (lock) => set({ appLockOnBackground: lock }),
      setAppLocked: (locked) => set({ appLocked: locked }),
      setAppUnlockModalVisible: (visible) => set({ appUnlockModalVisible: visible }),
      setAppPinEntry: (pin) => set({ appPinEntry: pin }),
      setAppPinError: (error) => set({ appPinError: error }),

      // Banners
      setBannerVisible: (visible) => set({ bannerVisible: visible }),
      setScriptingTimeMs: (time) => set({ scriptingTimeMs: time }),
      setAdFreeTimeMs: (time) => set({ adFreeTimeMs: time }),
      incrementScriptingTime: (ms) =>
        set((state) => ({ scriptingTimeMs: state.scriptingTimeMs + ms })),
      incrementAdFreeTime: (ms) =>
        set((state) => ({ adFreeTimeMs: state.adFreeTimeMs + ms })),
      decrementScriptingTime: (ms) =>
        set((state) => ({ scriptingTimeMs: Math.max(0, state.scriptingTimeMs - ms) })),
      decrementAdFreeTime: (ms) =>
        set((state) => ({ adFreeTimeMs: Math.max(0, state.adFreeTimeMs - ms) })),

      // Message Display
      setShowRawCommands: (show) => set({ showRawCommands: show }),
      setRawCategoryVisibility: (visibility) => set({ rawCategoryVisibility: visibility }),
      toggleRawCategory: (category) =>
        set((state) => ({
          rawCategoryVisibility: {
            ...state.rawCategoryVisibility,
            [category]: !state.rawCategoryVisibility[category],
          },
        })),
      setShowTypingIndicators: (show) => set({ showTypingIndicators: show }),
      setHideJoinMessages: (hide) => set({ hideJoinMessages: hide }),
      setHidePartMessages: (hide) => set({ hidePartMessages: hide }),
      setHideQuitMessages: (hide) => set({ hideQuitMessages: hide }),
      setHideIrcServiceListenerMessages: (hide) =>
        set({ hideIrcServiceListenerMessages: hide }),

      // Modals & Screens
      setShowChannelModal: (show) => set({ showChannelModal: show }),
      setChannelName: (name) => set({ channelName: name }),
      setShowNetworksList: (show) => set({ showNetworksList: show }),
      setShowSettings: (show) => set({ showSettings: show }),
      setShowPurchaseScreen: (show) => set({ showPurchaseScreen: show }),
      setShowIgnoreList: (show) => set({ showIgnoreList: show }),
      setShowBlacklist: (show) => set({ showBlacklist: show }),
      setShowWHOIS: (show) => set({ showWHOIS: show }),
      setWhoisNick: (nick) => set({ whoisNick: nick }),
      setWhoisDisplayMode: (mode) => set({ whoisDisplayMode: mode }),
      setSwipeBehavior: (behavior) => set({ swipeBehavior: behavior }),
      setShowQueryEncryptionMenu: (show) => set({ showQueryEncryptionMenu: show }),
      setShowChannelList: (show) => set({ showChannelList: show }),
      setShowUserList: (show) => set({ showUserList: show }),
      setShowChannelSettings: (show) => set({ showChannelSettings: show }),
      setChannelSettingsTarget: (target) => set({ channelSettingsTarget: target }),
      setChannelSettingsNetwork: (network) => set({ channelSettingsNetwork: network }),
      setShowOptionsMenu: (show) => set({ showOptionsMenu: show }),
      setShowRenameModal: (show) => set({ showRenameModal: show }),
      setRenameTargetTabId: (tabId) => set({ renameTargetTabId: tabId }),
      setRenameValue: (value) => set({ renameValue: value }),
      setShowTabOptionsModal: (show) => set({ showTabOptionsModal: show }),
      setTabOptionsTitle: (title) => set({ tabOptionsTitle: title }),
      setTabOptions: (options) => set({ tabOptions: options }),
      setShowChannelNoteModal: (show) => set({ showChannelNoteModal: show }),
      setChannelNoteTarget: (target) => set({ channelNoteTarget: target }),
      setChannelNoteValue: (value) => set({ channelNoteValue: value }),
      setShowChannelLogModal: (show) => set({ showChannelLogModal: show }),
      setChannelLogEntries: (entries) => set({ channelLogEntries: entries }),
      setPrefillMessage: (message) => set({ prefillMessage: message }),
      setShowDccTransfers: (show) => set({ showDccTransfers: show }),
      setDccTransfersMinimized: (minimized) => set({ dccTransfersMinimized: minimized }),
      setShowDccSendModal: (show) => set({ showDccSendModal: show }),
      setDccSendTarget: (target) => set({ dccSendTarget: target }),
      setDccSendPath: (path) => set({ dccSendPath: path }),

      // Blacklist
      setBlacklistTarget: (target) => set({ blacklistTarget: target }),

      // User Lists
      setShowUserLists: (show) => set({ showUserLists: show }),
      setUserListsInitialTab: (tab) => set({ userListsInitialTab: tab }),
      setUserListTarget: (target) => set({ userListTarget: target }),

      // Help Screens
      setShowHelpConnection: (show) => set({ showHelpConnection: show }),
      setShowHelpCommands: (show) => set({ showHelpCommands: show }),
      setShowHelpEncryption: (show) => set({ showHelpEncryption: show }),
      setShowHelpMedia: (show) => set({ showHelpMedia: show }),
      setShowHelpChannelManagement: (show) => set({ showHelpChannelManagement: show }),
      setShowHelpTroubleshooting: (show) => set({ showHelpTroubleshooting: show }),

      // Bulk updates
      updateUIState: (updates) => set((state) => ({ ...state, ...updates })),

      // Reset
      reset: () => set(initialState),
      // Function to reset only modal states to default (useful for clearing any bad persisted state)
      resetModalStates: () => set({
        showChannelModal: false,
        showNetworksList: false,
        showSettings: false,
        showPurchaseScreen: false,
        showIgnoreList: false,
        showBlacklist: false,
        showWHOIS: false,
        showQueryEncryptionMenu: false,
        showChannelList: false,
        showChannelSettings: false,
        showOptionsMenu: false,
        showRenameModal: false,
        showTabOptionsModal: false,
        showChannelNoteModal: false,
        showChannelLogModal: false,
        showDccTransfers: false,
        dccTransfersMinimized: false,
        showDccSendModal: false,
        blacklistTarget: null,
        showHelpConnection: false,
        showHelpCommands: false,
        showHelpEncryption: false,
        showHelpMedia: false,
        showHelpChannelManagement: false,
        showHelpTroubleshooting: false,
      }),
    }),
    {
      name: 'ui-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Persist important UI settings - explicitly exclude modal visibility states
      partialize: (state) => ({
        // NOTE: App lock settings are NOT persisted here - they are managed by settingsService
        // to maintain a single source of truth and avoid sync issues
        scriptingTimeMs: state.scriptingTimeMs,
        adFreeTimeMs: state.adFreeTimeMs,
        showRawCommands: state.showRawCommands,
        rawCategoryVisibility: state.rawCategoryVisibility,
        showTypingIndicators: state.showTypingIndicators,
        hideJoinMessages: state.hideJoinMessages,
        hidePartMessages: state.hidePartMessages,
        hideQuitMessages: state.hideQuitMessages,
        hideIrcServiceListenerMessages: state.hideIrcServiceListenerMessages,
        whoisDisplayMode: state.whoisDisplayMode,
        swipeBehavior: state.swipeBehavior,
        // NOTE: Modal visibility states are intentionally excluded from persistence
        // They should always start as false on app launch
        blacklistTarget: state.blacklistTarget, // Also exclude blacklistTarget from persistence
      }),
    }
  )
);

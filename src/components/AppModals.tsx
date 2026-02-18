/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * AppModals.tsx
 *
 * Component that renders all modals and screens for the app.
 * Extracted from App.tsx to reduce complexity.
 */

import React, { useEffect } from 'react';
import { Modal } from 'react-native';
import { useUIStore } from '../stores/uiStore';
import { useTabStore } from '../stores/tabStore';
import { connectionManager } from '../services/ConnectionManager';
import { useStoreSetters } from '../hooks/useStoreSetters';
import { useUIState } from '../hooks/useUIState';
import { FirstRunSetupScreen } from '../screens/FirstRunSetupScreen';
import { OptionsMenu } from './OptionsMenu';
import { JoinChannelModal } from './JoinChannelModal';
import { NetworksListScreen } from '../screens/NetworksListScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { PurchaseScreen } from '../screens/PurchaseScreen';
import { IgnoreListScreen } from '../screens/IgnoreListScreen';
import { BlacklistScreen } from '../screens/BlacklistScreen';
import { UserListsScreen } from '../screens/UserListsScreen';
import { WHOISDisplay } from './WHOISDisplay';
import { QueryEncryptionMenu } from './QueryEncryptionMenu';
import { ChannelListScreen } from '../screens/ChannelListScreen';
import { ChannelNoteModal } from './ChannelNoteModal';
import { ChannelLogModal } from './ChannelLogModal';
import { RenameModal } from './RenameModal';
import { TabOptionsModal } from './TabOptionsModal';
import { ChannelSettingsScreen } from '../screens/ChannelSettingsScreen';
import { DccTransfersModal } from './DccTransfersModal';
import { DccTransfersMinimizedIndicator } from './DccTransfersMinimizedIndicator';
import { DccSendModal } from './DccSendModal';
import { AppUnlockModal } from './AppUnlockModal';
import { HelpTroubleshootingScreen } from '../screens/help/HelpTroubleshootingScreen';
import { HelpConnectionScreen } from '../screens/help/HelpConnectionScreen';
import { HelpCommandsScreen } from '../screens/help/HelpCommandsScreen';
import { HelpEncryptionScreen } from '../screens/help/HelpEncryptionScreen';
import { HelpMediaScreen } from '../screens/help/HelpMediaScreen';
import { HelpChannelManagementScreen } from '../screens/help/HelpChannelManagementScreen';
import { channelNotesService } from '../services/ChannelNotesService';
import { dccFileService } from '../services/DCCFileService';
import { ChannelTab } from '../types';
import { useT } from '../i18n/transifex';

interface AppModalsProps {
  activeTab: ChannelTab | null;
  isConnected: boolean;
  networkName: string;
  focusedNetworkId: string | undefined;
  showRawCommands: boolean;
  rawCategoryVisibility: Record<string, boolean>;
  showEncryptionIndicators: boolean;
  showTypingIndicators: boolean;
  tabSortAlphabetical: boolean;
  dccTransfers: any[];
  channelName: string;
  handleConnect: (network?: any, serverId?: string) => void;
  handleJoinChannel: (channel: string) => void;
  handleExit: () => void;
  handleFirstRunSetupComplete: (networkConfig: any) => void;
  persistentSetShowRawCommands: (value: boolean) => void;
  persistentSetRawCategoryVisibility: (visibility: Record<string, boolean>) => void;
  persistentSetShowEncryptionIndicators: (value: boolean) => void;
  persistentSetShowTypingIndicators: (value: boolean) => void;
  setActiveConnectionId: (id: string | null) => void;
  setTabs: (updater: ChannelTab[] | ((prev: ChannelTab[]) => ChannelTab[])) => void;
  getActiveIRCService: () => any;
  safeAlert: (title: string, message?: string) => void;
  attemptBiometricUnlock: (isManualRetry?: boolean) => void;
  handleAppPinUnlock: (pin: string) => void;
  onKillSwitchFromUnlock: () => void;
  killSwitchEnabledOnLockScreen: boolean;
  styles: any;
  colors: any;
}

export function AppModals({
  activeTab,
  isConnected,
  networkName,
  focusedNetworkId,
  showRawCommands,
  rawCategoryVisibility,
  showEncryptionIndicators,
  showTypingIndicators,
  tabSortAlphabetical,
  dccTransfers,
  channelName,
  handleConnect,
  handleJoinChannel,
  handleExit,
  handleFirstRunSetupComplete,
  persistentSetShowRawCommands,
  persistentSetRawCategoryVisibility,
  persistentSetShowEncryptionIndicators,
  persistentSetShowTypingIndicators,
  setActiveConnectionId,
  setTabs,
  getActiveIRCService,
  safeAlert,
  attemptBiometricUnlock,
  handleAppPinUnlock,
  onKillSwitchFromUnlock,
  killSwitchEnabledOnLockScreen,
  styles,
  colors,
}: AppModalsProps) {
  const t = useT();
  const uiState = useUIState();
  const setters = useStoreSetters();
  
  // Subscribe directly to these critical modal states to ensure re-renders
  // This ensures the component re-renders when these states change
  const showOptionsMenu = useUIStore(state => state.showOptionsMenu);
  const showSettings = useUIStore(state => state.showSettings);
  
  const {
    showFirstRunSetup,
    showChannelModal,
    showNetworksList,
    showPurchaseScreen,
    showIgnoreList,
    showBlacklist,
    showUserLists,
    userListsInitialTab,
    showWHOIS,
    whoisNick,
    showQueryEncryptionMenu,
    showChannelList,
    showChannelNoteModal,
    channelNoteTarget,
    channelNoteValue,
    showChannelLogModal,
    channelLogEntries,
    showRenameModal,
    renameTargetTabId,
    renameValue,
    showTabOptionsModal,
    tabOptionsTitle,
    tabOptions,
    showChannelSettings,
    channelSettingsTarget,
    channelSettingsNetwork,
    showDccTransfers,
    dccTransfersMinimized,
    showDccSendModal,
    dccSendTarget,
    dccSendPath,
    appUnlockModalVisible,
    appLockEnabled,
    appLockUseBiometric,
    appLockUsePin,
    appPinEntry,
    appPinError,
    showHelpConnection,
    showHelpCommands,
    showHelpEncryption,
    showHelpMedia,
    showHelpChannelManagement,
    showHelpTroubleshooting,
  } = uiState;

  const {
    setShowFirstRunSetup,
    setChannelName,
    setChannelNoteValue,
    setRenameValue,
    setDccSendPath,
    setAppPinEntry,
    setAppPinError,
    setShowOptionsMenu,
    setShowSettings,
    setShowHelpConnection,
    setShowHelpCommands,
    setShowHelpEncryption,
    setShowHelpMedia,
    setShowHelpChannelManagement,
    setShowHelpTroubleshooting,
  } = setters;

  return (
    <>
      {/* First Run Setup Modal */}
      {showFirstRunSetup && (
        <Modal
          visible={showFirstRunSetup}
          animationType="slide"
          onRequestClose={() => {
            setShowFirstRunSetup(false);
          }}>
          <FirstRunSetupScreen
            onComplete={handleFirstRunSetupComplete}
            onSkip={() => {
              setShowFirstRunSetup(false);
            }}
          />
        </Modal>
      )}

      {/* Always render OptionsMenu, control visibility with visible prop */}
      <OptionsMenu
        visible={showOptionsMenu}
        onClose={() => {
          console.log('🔍 OptionsMenu onClose called');
          setShowOptionsMenu(false);
        }}
        isConnected={isConnected}
        networkName={networkName}
        focusedNetworkId={focusedNetworkId ?? null}
        showRawCommands={showRawCommands}
        setTabs={setTabs}
        tabSortAlphabetical={tabSortAlphabetical}
        handleConnect={handleConnect}
        handleExit={handleExit}
        persistentSetShowRawCommands={persistentSetShowRawCommands}
        setActiveConnectionId={setActiveConnectionId}
        styles={styles}
      />
      <JoinChannelModal
        visible={showChannelModal}
        onClose={() => useUIStore.getState().setShowChannelModal(false)}
        channelName={channelName}
        onChangeChannelName={setChannelName}
        onJoin={(channel) => {
          handleJoinChannel(channel);
          useUIStore.getState().setChannelName('');
          useUIStore.getState().setShowChannelModal(false);
        }}
        onCancel={() => {
          useUIStore.getState().setShowChannelModal(false);
          useUIStore.getState().setChannelName('');
        }}
        styles={styles}
      />
      {showNetworksList && (
        <NetworksListScreen
          onSelectNetwork={(network, serverId) => handleConnect(network, serverId)}
          onClose={() => useUIStore.getState().setShowNetworksList(false)}
        />
      )}
      {/* Always render SettingsScreen, control visibility with visible prop */}
      <SettingsScreen
        visible={showSettings}
        onClose={() => {
          console.log('🔍 SettingsScreen onClose called');
          setShowSettings(false);
        }}
        currentNetwork={activeTab?.networkId}
        showRawCommands={showRawCommands}
        onShowRawCommandsChange={persistentSetShowRawCommands}
        rawCategoryVisibility={rawCategoryVisibility}
        onRawCategoryVisibilityChange={persistentSetRawCategoryVisibility}
        showEncryptionIndicators={showEncryptionIndicators}
        onShowEncryptionIndicatorsChange={persistentSetShowEncryptionIndicators}
        showTypingIndicators={showTypingIndicators}
        onShowTypingIndicatorsChange={persistentSetShowTypingIndicators}
        onShowBlacklist={() => useUIStore.getState().setShowBlacklist(true)}
        onShowUserLists={() => {
          useUIStore.getState().setUserListsInitialTab('notify');
          useUIStore.getState().setShowUserLists(true);
        }}
        onShowPurchaseScreen={() => useUIStore.getState().setShowPurchaseScreen(true)}
      />
      {showPurchaseScreen && (
        <PurchaseScreen
          visible={showPurchaseScreen}
          onClose={() => useUIStore.getState().setShowPurchaseScreen(false)}
        />
      )}
      {showIgnoreList && (
        <IgnoreListScreen
          visible={showIgnoreList}
          network={activeTab?.networkId}
          onClose={() => useUIStore.getState().setShowIgnoreList(false)}
        />
      )}
      {showBlacklist && (
        <BlacklistScreen
          visible={showBlacklist}
          network={activeTab?.networkId}
          onClose={() => useUIStore.getState().setShowBlacklist(false)}
        />
      )}
      {showUserLists && (
        <UserListsScreen
          visible={showUserLists}
          network={activeTab?.networkId}
          initialTab={userListsInitialTab}
          onClose={() => useUIStore.getState().setShowUserLists(false)}
        />
      )}
      {showWHOIS && (
        <WHOISDisplay
          visible={showWHOIS}
          nick={whoisNick}
          network={activeTab?.networkId}
          onClose={() => {
            useUIStore.getState().setShowWHOIS(false);
            useUIStore.getState().setWhoisNick('');
          }}
          onChannelPress={(channel) => {
            // Send join command for the channel
            const network = activeTab?.networkId;
            if (network) {
              const connection = connectionManager.getConnection(network);
              // Ensure channel starts with # and remove any remaining prefixes
              let cleanChannel = channel.replace(/^[~&@%+]+/, '');
              if (!cleanChannel.startsWith('#')) {
                cleanChannel = '#' + cleanChannel;
              }
              connection?.ircService?.sendRaw(`JOIN ${cleanChannel}`);
            }
          }}
          onNickPress={(nick) => {
            // Open query with the nick
            const network = activeTab?.networkId;
            if (!network) return;
            const queryId = `query:${network}:${nick.toLowerCase()}`;
            const tabStore = useTabStore.getState();
            const existingTab = tabStore.tabs.find(t => t.id === queryId && t.type === 'query');
            if (existingTab) {
              tabStore.setActiveTabId(existingTab.id);
            } else {
              const newQueryTab = {
                id: queryId,
                name: nick,
                type: 'query' as const,
                networkId: network,
                messages: [],
              };
              tabStore.setTabs([...tabStore.tabs, newQueryTab]);
              tabStore.setActiveTabId(newQueryTab.id);
            }
            // Close WHOIS modal
            useUIStore.getState().setShowWHOIS(false);
            useUIStore.getState().setWhoisNick('');
          }}
        />
      )}
      {showQueryEncryptionMenu && activeTab && activeTab.type === 'query' && (
        <QueryEncryptionMenu
          visible={showQueryEncryptionMenu}
          onClose={() => useUIStore.getState().setShowQueryEncryptionMenu(false)}
          nick={activeTab.name}
          network={activeTab.networkId}
        />
      )}
      {showChannelList && (
        <ChannelListScreen
          visible={showChannelList}
          network={activeTab?.networkId}
          onClose={() => useUIStore.getState().setShowChannelList(false)}
          onJoinChannel={handleJoinChannel}
        />
      )}
      {showChannelNoteModal && channelNoteTarget && (
        <ChannelNoteModal
          visible={showChannelNoteModal}
          onClose={() => useUIStore.getState().setShowChannelNoteModal(false)}
          channelName={channelNoteTarget.channel}
          value={channelNoteValue}
          onChangeValue={setChannelNoteValue}
          onSave={async () => await channelNotesService.setNote(channelNoteTarget.networkId, channelNoteTarget.channel, channelNoteValue)}
          styles={styles}
        />
      )}
      {showChannelLogModal && (
        <ChannelLogModal
          visible={showChannelLogModal}
          onClose={() => useUIStore.getState().setShowChannelLogModal(false)}
          logEntries={channelLogEntries}
          onClearLog={async () => {
            if (channelNoteTarget) {
              await channelNotesService.clearLog(channelNoteTarget.networkId, channelNoteTarget.channel);
              useUIStore.getState().setChannelLogEntries([]);
            }
          }}
          styles={styles}
        />
      )}
      {showRenameModal && renameTargetTabId && (
        <RenameModal
          visible={showRenameModal}
          onClose={() => useUIStore.getState().setShowRenameModal(false)}
          value={renameValue}
          onChangeValue={setRenameValue}
          onRename={() => setTabs(prev => prev.map(t => t.id === renameTargetTabId ? { ...t, name: renameValue || t.name } : t))}
          styles={styles}
        />
      )}
      <TabOptionsModal
        visible={showTabOptionsModal}
        onClose={() => useUIStore.getState().setShowTabOptionsModal(false)}
        title={tabOptionsTitle || 'Options'}
        options={tabOptions}
        styles={styles}
      />
      {showChannelSettings && channelSettingsTarget && channelSettingsNetwork && (
        <ChannelSettingsScreen
          visible={showChannelSettings}
          channel={channelSettingsTarget}
          network={channelSettingsNetwork}
          onClose={() => useUIStore.getState().setShowChannelSettings(false)}
        />
      )}
      {showDccTransfers && (
        <DccTransfersModal
          visible={showDccTransfers}
          onClose={() => useUIStore.getState().setShowDccTransfers(false)}
          onMinimize={() => {
            useUIStore.getState().setShowDccTransfers(false);
            useUIStore.getState().setDccTransfersMinimized(true);
          }}
          transfers={dccTransfers}
          onAccept={(transferId, filePath) => dccFileService.accept(transferId, getActiveIRCService(), filePath)}
          onCancel={(transferId) => dccFileService.cancel(transferId)}
          styles={styles}
        />
      )}
      {showDccSendModal && dccSendTarget && (
        <DccSendModal
          visible={showDccSendModal}
          onClose={() => useUIStore.getState().setShowDccSendModal(false)}
          targetNick={dccSendTarget.nick}
          filePath={dccSendPath}
          onChangeFilePath={setDccSendPath}
          onSend={async () => {
            try {
              await dccFileService.sendFile(getActiveIRCService(), dccSendTarget.nick, dccSendTarget.networkId, dccSendPath);
              useUIStore.getState().setShowDccSendModal(false);
              useUIStore.getState().setDccSendPath('');
            } catch (e) {
              safeAlert(
                t('DCC Send Error', { _tags: 'screen:app,file:App.tsx,feature:dcc' }),
                e instanceof Error
                  ? e.message
                  : t('Failed to send file', { _tags: 'screen:app,file:App.tsx,feature:dcc' })
              );
            }
          }}
          styles={styles}
        />
      )}
      <AppUnlockModal
        visible={appUnlockModalVisible && appLockEnabled}
        useBiometric={appLockUseBiometric}
        usePin={appLockUsePin}
        pinEntry={appPinEntry}
        pinError={appPinError}
        onChangePinEntry={setAppPinEntry}
        onClearPinError={() => setAppPinError('')}
        onBiometricUnlock={attemptBiometricUnlock}
        onPinUnlock={() => handleAppPinUnlock(appPinEntry)}
        onKillSwitch={killSwitchEnabledOnLockScreen ? onKillSwitchFromUnlock : undefined}
        colors={colors}
        styles={styles}
      />

      {/* Help Screens - Only render when state is true to prevent auto-opening */}
      {showHelpTroubleshooting && (
        <HelpTroubleshootingScreen
          visible={showHelpTroubleshooting}
          onClose={() => setShowHelpTroubleshooting(false)}
        />
      )}
      {showHelpConnection && (
        <HelpConnectionScreen
          visible={showHelpConnection}
          onClose={() => setShowHelpConnection(false)}
        />
      )}
      {showHelpCommands && (
        <HelpCommandsScreen
          visible={showHelpCommands}
          onClose={() => setShowHelpCommands(false)}
        />
      )}
      {showHelpEncryption && (
        <HelpEncryptionScreen
          visible={showHelpEncryption}
          onClose={() => setShowHelpEncryption(false)}
        />
      )}
      {showHelpMedia && (
        <HelpMediaScreen
          visible={showHelpMedia}
          onClose={() => setShowHelpMedia(false)}
        />
      )}
      {showHelpChannelManagement && (
        <HelpChannelManagementScreen
          visible={showHelpChannelManagement}
          onClose={() => setShowHelpChannelManagement(false)}
        />
      )}

      {/* DCC Transfers Minimized Indicator */}
      <DccTransfersMinimizedIndicator
        visible={dccTransfersMinimized && !showDccTransfers}
        transfers={dccTransfers}
        onPress={() => {
          useUIStore.getState().setDccTransfersMinimized(false);
          useUIStore.getState().setShowDccTransfers(true);
        }}
        colors={colors}
      />
    </>
  );
}

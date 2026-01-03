/**
 * AppLayout.tsx
 *
 * Component that renders the main app layout (tabs, message area, user list).
 * Extracted from App.tsx to reduce complexity.
 */

import React from 'react';
import { View } from 'react-native';
import { ChannelTabs } from './ChannelTabs';
import { MessageArea } from './MessageArea';
import { MessageInput } from './MessageInput';
import { TypingIndicator } from './TypingIndicator';
import { UserList } from './UserList';
import { HeaderBar } from './HeaderBar';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { ChannelTab } from '../types';
import { bannerAdService } from '../services/BannerAdService';
import { useUIStore } from '../stores/uiStore';

interface AppLayoutProps {
  tabs: ChannelTab[];
  activeTabId: string;
  activeTab: ChannelTab | null;
  activeMessages: any[];
  activeUsers: any[];
  isConnected: boolean;
  networkName: string;
  selectedNetworkName: string | null;
  ping: number | undefined;
  showRawCommands: boolean;
  rawCategoryVisibility: Record<string, boolean>;
  hideJoinMessages: boolean;
  hidePartMessages: boolean;
  hideQuitMessages: boolean;
  hideIrcServiceListenerMessages: boolean;
  showEncryptionIndicators: boolean;
  typingUsers: Map<string, Map<string, Map<string, any>>>;
  bannerVisible: boolean;
  prefillMessage: string | null;
  layoutConfig: {
    tabPosition: 'top' | 'bottom' | 'left' | 'right';
    userListPosition: 'left' | 'right' | 'top' | 'bottom';
  };
  showNicklistButton: boolean;
  appLockEnabled: boolean;
  appLocked: boolean;
  showUserList: boolean;
  safeAreaInsets: { top: number; bottom: number };
  styles: any;
  handleTabPress: (tabId: string) => void;
  handleTabLongPress: (tab: ChannelTab) => void;
  handleSendMessage: (message: string) => void;
  handleDropdownPress: () => void;
  handleMenuPress: () => void;
  handleConnect: () => void;
  handleToggleUserList: () => void;
  handleLockButtonPress: () => void;
  handleUserPress: (nick: string) => void;
  handleWHOISPress: (nick: string) => void;
  showKillSwitchButton?: boolean;
  onKillSwitchPress?: () => void;
}

export function AppLayout({
  tabs,
  activeTabId,
  activeTab,
  activeMessages,
  activeUsers,
  isConnected,
  networkName,
  selectedNetworkName,
  ping,
  showRawCommands,
  rawCategoryVisibility,
  hideJoinMessages,
  hidePartMessages,
  hideQuitMessages,
  hideIrcServiceListenerMessages,
  showEncryptionIndicators,
  typingUsers,
  bannerVisible,
  prefillMessage,
  layoutConfig,
  showNicklistButton,
  appLockEnabled,
  appLocked,
  showUserList,
  safeAreaInsets,
  styles,
  handleTabPress,
  handleTabLongPress,
  handleSendMessage,
  handleDropdownPress,
  handleMenuPress,
  handleConnect,
  handleToggleUserList,
  handleLockButtonPress,
  handleUserPress,
  handleWHOISPress,
  showKillSwitchButton = false,
  onKillSwitchPress,
}: AppLayoutProps) {
  const renderUserList = (position: 'left' | 'right' | 'top' | 'bottom') => {
    if (!activeTab || activeTab.type !== 'channel' || !showUserList) {
      return null;
    }
    return (
      <UserList
        users={activeUsers}
        channelName={activeTab.name}
        network={activeTab?.networkId}
        position={position}
        onUserPress={handleUserPress}
        onWHOISPress={handleWHOISPress}
      />
    );
  };

  return (
    <View style={[styles.container, { paddingTop: safeAreaInsets.top }]}>
      <HeaderBar
        networkName={isConnected ? networkName : (selectedNetworkName || networkName)}
        ping={ping}
        isConnected={isConnected}
        onDropdownPress={handleDropdownPress}
        onMenuPress={handleMenuPress}
        onConnectPress={() => handleConnect()}
        showNicklistButton={showNicklistButton}
        onToggleNicklist={handleToggleUserList}
        showLockButton={appLockEnabled}
        lockState={appLocked ? 'locked' : 'unlocked'}
        onLockPress={handleLockButtonPress}
        showEncryptionButton={activeTab?.type === 'query'}
        onEncryptionPress={() => useUIStore.getState().setShowQueryEncryptionMenu(true)}
        showKillSwitchButton={showKillSwitchButton}
        onKillSwitchPress={onKillSwitchPress}
      />
      {layoutConfig.tabPosition === 'top' && (
        <ChannelTabs
          tabs={tabs}
          activeTabId={activeTabId}
          onTabPress={handleTabPress}
          onTabLongPress={handleTabLongPress}
          showEncryptionIndicators={showEncryptionIndicators}
          position="top"
        />
      )}
      <View
        style={[
          styles.contentArea,
          (layoutConfig.tabPosition === 'left' || layoutConfig.tabPosition === 'right') && styles.contentAreaRow,
        ]}>
        {layoutConfig.tabPosition === 'left' && (
          <ChannelTabs
            tabs={tabs}
            activeTabId={activeTabId}
            onTabPress={handleTabPress}
            onTabLongPress={handleTabLongPress}
            showEncryptionIndicators={showEncryptionIndicators}
            position="left"
          />
        )}
        <View
          style={[
            styles.messageAndUser,
            (layoutConfig.userListPosition === 'left' || layoutConfig.userListPosition === 'right') && styles.messageAndUserRow,
            (layoutConfig.userListPosition === 'top' || layoutConfig.userListPosition === 'bottom') && styles.messageAndUserColumn,
          ]}>
          {layoutConfig.userListPosition === 'top' && renderUserList('top')}
          {layoutConfig.userListPosition === 'left' && renderUserList('left')}
          <View style={styles.messageAreaContainer}>
            <MessageArea
              messages={activeMessages}
              showRawCommands={showRawCommands}
              rawCategoryVisibility={rawCategoryVisibility}
              hideJoinMessages={hideJoinMessages}
              hidePartMessages={hidePartMessages}
              hideQuitMessages={hideQuitMessages}
              hideIrcServiceListenerMessages={hideIrcServiceListenerMessages}
              channel={activeTab?.type === 'channel' ? activeTab.name : undefined}
              network={activeTab?.networkId}
              bottomInset={safeAreaInsets.bottom}
            />
          </View>
          {layoutConfig.userListPosition === 'right' && renderUserList('right')}
          {layoutConfig.userListPosition === 'bottom' && renderUserList('bottom')}
        </View>
        {layoutConfig.tabPosition === 'right' && (
          <ChannelTabs
            tabs={tabs}
            activeTabId={activeTabId}
            onTabPress={handleTabPress}
            onTabLongPress={handleTabLongPress}
            showEncryptionIndicators={showEncryptionIndicators}
            position="right"
          />
        )}
      </View>
      {layoutConfig.tabPosition === 'bottom' && (
        <ChannelTabs
          tabs={tabs}
          activeTabId={activeTabId}
          onTabPress={handleTabPress}
          onTabLongPress={handleTabLongPress}
          showEncryptionIndicators={showEncryptionIndicators}
          position="bottom"
        />
      )}
      {activeTab && typingUsers.get(activeTab.networkId)?.get(activeTab.name) && (
        <TypingIndicator typingUsers={typingUsers.get(activeTab.networkId)!.get(activeTab.name)!} />
      )}
      <View style={[
        styles.bannerAdContainer,
        !bannerVisible && { height: 0, overflow: 'hidden', opacity: 0 }
      ]}>
        <BannerAd
          unitId={bannerAdService.getBannerAdUnitId()}
          size={BannerAdSize.BANNER}
          requestOptions={{
            requestNonPersonalizedAdsOnly: !bannerAdService.canShowPersonalizedAds(),
          }}
          onAdFailedToLoad={(error) => {
            console.error('Banner ad failed to load:', error);
          }}
        />
      </View>
      <MessageInput
        placeholder="Enter a message"
        onSubmit={handleSendMessage}
        disabled={!isConnected}
        prefilledMessage={prefillMessage || undefined}
        onPrefillUsed={() => useUIStore.getState().setPrefillMessage(null)}
        bottomInset={safeAreaInsets.bottom}
        tabType={activeTab?.type}
        tabName={activeTab?.name}
      />
    </View>
  );
}

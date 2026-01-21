/**
 * AppLayout.tsx
 *
 * Component that renders the main app layout (tabs, message area, user list).
 * Extracted from App.tsx to reduce complexity.
 */

import React, { useState, useEffect } from 'react';
import { Platform, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { ChannelTabs } from './ChannelTabs';
import { MessageArea } from './MessageArea';
import { MessageInput } from './MessageInput';
import { TypingIndicator } from './TypingIndicator';
import { UserList } from './UserList';
import { HeaderBar } from './HeaderBar';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { ChannelTab } from '../types';
import { bannerAdService } from '../services/BannerAdService';
import { settingsService } from '../services/SettingsService';
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
  showTypingIndicators: boolean;
  typingUsers: Map<string, Map<string, Map<string, any>>>;
  bannerVisible: boolean;
  prefillMessage: string | null;
  layoutConfig: {
    tabPosition: 'top' | 'bottom' | 'left' | 'right';
    userListPosition: 'left' | 'right' | 'top' | 'bottom';
  };
  sideTabsVisible: boolean;
  showSideTabsToggle: boolean;
  onToggleSideTabs: () => void;
  showNicklistButton: boolean;
  appLockEnabled: boolean;
  appLocked: boolean;
  showUserList: boolean;
  showSearchButton: boolean;
  safeAreaInsets: { top: number; bottom: number };
  keyboardAvoidingEnabled: boolean;
  keyboardBehaviorIOS: 'padding' | 'height' | 'position' | 'translate-with-padding';
  keyboardBehaviorAndroid: 'padding' | 'height' | 'position' | 'translate-with-padding';
  keyboardVerticalOffset: number;
  useAndroidBottomSafeArea: boolean;
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
  showTypingIndicators,
  typingUsers,
  bannerVisible,
  prefillMessage,
  layoutConfig,
  sideTabsVisible,
  showSideTabsToggle,
  onToggleSideTabs,
  showNicklistButton,
  appLockEnabled,
  appLocked,
  showUserList,
  showSearchButton,
  safeAreaInsets,
  keyboardAvoidingEnabled,
  keyboardBehaviorIOS,
  keyboardBehaviorAndroid,
  keyboardVerticalOffset,
  useAndroidBottomSafeArea,
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
  const isSideTabs = layoutConfig.tabPosition === 'left' || layoutConfig.tabPosition === 'right';
  const showSideTabs = isSideTabs && sideTabsVisible;

  // Message search state
  const [searchVisible, setSearchVisible] = useState(false);
  const [bannerPosition, setBannerPosition] = useState<'input_above' | 'input_below' | 'tabs_above' | 'tabs_below'>('input_above');

  useEffect(() => {
    let isMounted = true;
    settingsService.getSetting('bannerPosition', 'input_above').then(value => {
      if (isMounted) setBannerPosition(value);
    });
    const unsubscribe = settingsService.onSettingChange<'input_above' | 'input_below' | 'tabs_above' | 'tabs_below'>(
      'bannerPosition',
      value => setBannerPosition(value)
    );
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

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

  const keyboardBehavior = Platform.OS === 'ios' ? keyboardBehaviorIOS : keyboardBehaviorAndroid;
  const bottomInset = Platform.OS === 'android' && !useAndroidBottomSafeArea
    ? 0
    : safeAreaInsets.bottom;
  const bannerNode = (
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
  );

  return (
    <KeyboardAvoidingView
      behavior={keyboardAvoidingEnabled ? keyboardBehavior : undefined}
      enabled={keyboardAvoidingEnabled}
      keyboardVerticalOffset={keyboardVerticalOffset}
      style={[styles.container, { paddingTop: safeAreaInsets.top }]}
    >
      {isSideTabs && bannerPosition === 'tabs_above' && bannerNode}
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
        showSideTabsToggle={showSideTabsToggle}
        sideTabsVisible={sideTabsVisible}
        onToggleSideTabs={onToggleSideTabs}
        showSearchButton={showSearchButton}
        onSearchPress={() => setSearchVisible(prev => !prev)}
      />
      {isSideTabs && bannerPosition === 'tabs_below' && bannerNode}
      {layoutConfig.tabPosition === 'top' && bannerPosition === 'tabs_above' && bannerNode}
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
      {layoutConfig.tabPosition === 'top' && bannerPosition === 'tabs_below' && bannerNode}
      <View
        style={[
          styles.contentArea,
          showSideTabs && styles.contentAreaRow,
        ]}>
        {layoutConfig.tabPosition === 'left' && showSideTabs && (
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
              tabId={activeTab?.id}
              bottomInset={bottomInset}
              searchVisible={searchVisible}
              onSearchVisibleChange={setSearchVisible}
            />
          </View>
          {layoutConfig.userListPosition === 'right' && renderUserList('right')}
          {layoutConfig.userListPosition === 'bottom' && renderUserList('bottom')}
        </View>
        {layoutConfig.tabPosition === 'right' && showSideTabs && (
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
      {layoutConfig.tabPosition === 'bottom' && bannerPosition === 'tabs_above' && bannerNode}
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
      {layoutConfig.tabPosition === 'bottom' && bannerPosition === 'tabs_below' && bannerNode}
      {activeTab && showTypingIndicators && typingUsers.get(activeTab.networkId)?.get(activeTab.name) && (
        <TypingIndicator typingUsers={typingUsers.get(activeTab.networkId)!.get(activeTab.name)!} />
      )}
      {bannerPosition === 'input_above' && bannerNode}
      <MessageInput
        placeholder="Enter a message"
        onSubmit={handleSendMessage}
        disabled={!isConnected}
        prefilledMessage={prefillMessage || undefined}
        onPrefillUsed={() => useUIStore.getState().setPrefillMessage(null)}
        bottomInset={bottomInset}
        tabType={activeTab?.type}
        tabName={activeTab?.name}
        network={activeTab?.networkId}
        tabId={activeTab?.id}
      />
      {bannerPosition === 'input_below' && bannerNode}
    </KeyboardAvoidingView>
  );
}

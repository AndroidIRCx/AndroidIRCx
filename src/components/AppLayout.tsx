/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * AppLayout.tsx
 *
 * Component that renders the main app layout (tabs, message area, user list).
 * Extracted from App.tsx to reduce complexity.
 */

import React, { useState, useEffect } from 'react';
import { Platform, View, useWindowDimensions, TouchableOpacity, PanResponder } from 'react-native';
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
import { LayoutConfig } from '../services/LayoutService';
import { useTheme } from '../hooks/useTheme';

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
  layoutConfig: LayoutConfig;
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
  handleUserPress: (user: { nick: string }) => void;
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
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isSideTabs = layoutConfig.tabPosition === 'left' || layoutConfig.tabPosition === 'right';
  const showSideTabs = isSideTabs && sideTabsVisible;

  // Message search state
  const [searchVisible, setSearchVisible] = useState(false);
  const [bannerPosition, setBannerPosition] = useState<'input_above' | 'input_below' | 'tabs_above' | 'tabs_below'>('input_above');
  const [nicklistTongueEnabled, setNicklistTongueEnabled] = useState(true);
  const [nicklistTongueSizePx, setNicklistTongueSizePx] = useState(56);
  const setShowUserList = useUIStore(state => state.setShowUserList);

  useEffect(() => {
    let isMounted = true;
    settingsService.getSetting('bannerPosition', 'input_above').then(value => {
      if (isMounted) setBannerPosition(value as 'input_above' | 'input_below' | 'tabs_above' | 'tabs_below');
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

  useEffect(() => {
    let mounted = true;
    const loadTongueSettings = async () => {
      const enabled = await settingsService.getSetting('nicklistTongueEnabled', true);
      const sizePx = await settingsService.getSetting('nicklistTongueSizePx', 56);
      if (mounted) {
        setNicklistTongueEnabled(Boolean(enabled));
        setNicklistTongueSizePx(Math.max(24, Math.floor(Number(sizePx) || 56)));
      }
    };
    loadTongueSettings();

    const unsubEnabled = settingsService.onSettingChange<boolean>('nicklistTongueEnabled', (value) => {
      setNicklistTongueEnabled(Boolean(value));
    });
    const unsubSize = settingsService.onSettingChange<number>('nicklistTongueSizePx', (value) => {
      setNicklistTongueSizePx(Math.max(24, Math.floor(Number(value) || 56)));
    });
    return () => {
      mounted = false;
      unsubEnabled();
      unsubSize();
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
        panelSizePx={layoutConfig.userListSizePx}
        nickFontSizePx={layoutConfig.userListNickFontSizePx}
        onUserPress={handleUserPress}
        onWHOISPress={handleWHOISPress}
      />
    );
  };

  const shouldShowNicklistTongue =
    nicklistTongueEnabled &&
    showNicklistButton &&
    !!activeTab &&
    activeTab.type === 'channel';

  const tonguePanResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => shouldShowNicklistTongue,
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 6 || Math.abs(gesture.dy) > 6,
    onPanResponderRelease: (_, gesture) => {
      const threshold = 24;
      const pos = layoutConfig.userListPosition;
      if (pos === 'left') {
        if (gesture.dx > threshold) setShowUserList(true);
        if (gesture.dx < -threshold) setShowUserList(false);
        return;
      }
      if (pos === 'right') {
        if (gesture.dx < -threshold) setShowUserList(true);
        if (gesture.dx > threshold) setShowUserList(false);
        return;
      }
      if (pos === 'top') {
        if (gesture.dy > threshold) setShowUserList(true);
        if (gesture.dy < -threshold) setShowUserList(false);
        return;
      }
      if (pos === 'bottom') {
        if (gesture.dy < -threshold) setShowUserList(true);
        if (gesture.dy > threshold) setShowUserList(false);
      }
    },
  });

  const tongueStyle = (() => {
    const size = nicklistTongueSizePx;
    const base = {
      position: 'absolute' as const,
      zIndex: 5,
      opacity: 0.9,
      backgroundColor: colors.surfaceVariant || colors.surface,
      borderColor: colors.border,
    };
    const pos = layoutConfig.userListPosition;
    if (pos === 'left') {
      return [
        base,
        {
          left: 0,
          top: '50%',
          marginTop: -size / 2,
          width: 18,
          height: size,
          borderTopRightRadius: 10,
          borderBottomRightRadius: 10,
          borderWidth: 1,
          borderLeftWidth: 0,
        },
      ];
    }
    if (pos === 'right') {
      return [
        base,
        {
          right: 0,
          top: '50%',
          marginTop: -size / 2,
          width: 18,
          height: size,
          borderTopLeftRadius: 10,
          borderBottomLeftRadius: 10,
          borderWidth: 1,
          borderRightWidth: 0,
        },
      ];
    }
    if (pos === 'top') {
      return [
        base,
        {
          top: 0,
          left: '50%',
          marginLeft: -size / 2,
          width: size,
          height: 18,
          borderBottomLeftRadius: 10,
          borderBottomRightRadius: 10,
          borderWidth: 1,
          borderTopWidth: 0,
        },
      ];
    }
    return [
      base,
      {
        bottom: 0,
        left: '50%',
        marginLeft: -size / 2,
        width: size,
        height: 18,
        borderTopLeftRadius: 10,
        borderTopRightRadius: 10,
        borderWidth: 1,
        borderBottomWidth: 0,
      },
    ];
  })();

  const keyboardBehavior = Platform.OS === 'ios' ? keyboardBehaviorIOS : keyboardBehaviorAndroid;
  const keyboardEnabled = keyboardAvoidingEnabled && !(Platform.OS === 'android' && isLandscape);
  const bottomInset = Platform.OS === 'android' && !useAndroidBottomSafeArea
    ? 0
    : safeAreaInsets.bottom;
  const bannerNode = (
    <View style={[
      styles.bannerAdContainer,
      !bannerVisible && styles.bannerAdHidden
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
      behavior={keyboardEnabled ? keyboardBehavior : undefined}
      enabled={keyboardEnabled}
      keyboardVerticalOffset={keyboardVerticalOffset}
      style={[styles.container, { paddingTop: safeAreaInsets.top }]}
    >
      {bannerPosition === 'tabs_above' && bannerNode}
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
      {bannerPosition === 'tabs_below' && bannerNode}
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
              channelUsers={activeUsers}
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
            {shouldShowNicklistTongue && (
              <TouchableOpacity
                {...tonguePanResponder.panHandlers}
                onPress={handleToggleUserList}
                activeOpacity={0.85}
                style={tongueStyle}
                accessibilityRole="button"
                accessibilityLabel="Toggle user list"
              />
            )}
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
      {activeTab && showTypingIndicators && typingUsers.get(activeTab.networkId)?.get(activeTab.name) && (
        <TypingIndicator typingUsers={typingUsers.get(activeTab.networkId)!.get(activeTab.name)!} />
      )}
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

/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ListRenderItem,
  ScrollView,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { ChannelTab } from '../types';
import { channelEncryptionSettingsService } from '../services/ChannelEncryptionSettingsService';
import { NEW_FEATURE_DEFAULTS, settingsService } from '../services/SettingsService';
import { debugLogger } from '../services/DebugLogger';

interface ChannelTabsProps {
  tabs: ChannelTab[];
  activeTabId: string;
  onTabPress: (tabId: string) => void;
  onTabLongPress: (tab: ChannelTab) => void;
  showEncryptionIndicators?: boolean;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

interface ChannelTabItemProps {
  tab: ChannelTab;
  isActive: boolean;
  isVertical: boolean;
  position: 'top' | 'bottom' | 'left' | 'right';
  showEncryptionIndicators: boolean;
  alwaysEncryptEnabled: boolean;
  styles: any;
  onTabPress: (tabId: string) => void;
  onTabLongPress: (tab: ChannelTab) => void;
}

const getEncryptCacheKey = (tab: ChannelTab): string =>
  `${tab.networkId}::${tab.type}::${tab.name.toLowerCase()}`;

const ChannelTabItem = React.memo<ChannelTabItemProps>(({
  tab,
  isActive,
  isVertical,
  position,
  showEncryptionIndicators,
  alwaysEncryptEnabled,
  styles,
  onTabPress,
  onTabLongPress,
}) => {
  const hasActivity = tab.hasActivity && !isActive;

  return (
    <TouchableOpacity
      style={[
        styles.tab,
        isVertical && styles.tabVertical,
        isActive && styles.activeTab,
        hasActivity && styles.activityTab,
      ]}
      onPress={() => onTabPress(tab.id)}
      onLongPress={() => onTabLongPress(tab)}
      delayLongPress={180}
      activeOpacity={0.8}>
      <View style={styles.tabContent}>
        {showEncryptionIndicators && (tab.type === 'query' || tab.type === 'channel') && (
          <Text style={styles.encryptionIcon}>
            {alwaysEncryptEnabled ? '🔐' : (tab.isEncrypted ? '🔒' : '🔓')}
          </Text>
        )}
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={[
            styles.tabText,
            isActive && styles.activeTabText,
            hasActivity && styles.activityTabText,
          ]}>
          {tab.name}
        </Text>
      </View>
      {isActive && (
        <View
          style={[
            isVertical ? styles.activeIndicatorVertical : styles.activeIndicatorHorizontal,
            isVertical && position === 'left' && styles.activeIndicatorLeft,
            isVertical && position === 'right' && styles.activeIndicatorRight,
          ]}
        />
      )}
    </TouchableOpacity>
  );
}, (prevProps, nextProps) => (
  prevProps.tab.id === nextProps.tab.id &&
  prevProps.tab.name === nextProps.tab.name &&
  prevProps.tab.hasActivity === nextProps.tab.hasActivity &&
  prevProps.tab.isEncrypted === nextProps.tab.isEncrypted &&
  prevProps.isActive === nextProps.isActive &&
  prevProps.isVertical === nextProps.isVertical &&
  prevProps.position === nextProps.position &&
  prevProps.showEncryptionIndicators === nextProps.showEncryptionIndicators &&
  prevProps.alwaysEncryptEnabled === nextProps.alwaysEncryptEnabled
));

ChannelTabItem.displayName = 'ChannelTabItem';

export const ChannelTabs: React.FC<ChannelTabsProps> = React.memo(({
  tabs,
  activeTabId,
  onTabPress,
  onTabLongPress,
  showEncryptionIndicators = true,
  position = 'top',
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isVertical = position === 'left' || position === 'right';
  const [scrollSwitchTabsEnabled, setScrollSwitchTabsEnabled] = useState(false);
  const [scrollSwitchTabsInverse, setScrollSwitchTabsInverse] = useState(false);
  const [alwaysEncryptStatus, setAlwaysEncryptStatus] = useState<Record<string, boolean>>({});
  const lastScrollOffsetRef = useRef(0);
  const lastSwitchAtRef = useRef(0);
  const encryptStatusCacheRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    const relevantTabs = tabs.filter(tab => tab.type === 'channel' || tab.type === 'query');
    const cachedStatusById: Record<string, boolean> = {};
    const missingTabs = relevantTabs.filter(tab => {
      const cacheKey = getEncryptCacheKey(tab);
      if (cacheKey in encryptStatusCacheRef.current) {
        cachedStatusById[tab.id] = encryptStatusCacheRef.current[cacheKey];
        return false;
      }
      return true;
    });

    setAlwaysEncryptStatus(cachedStatusById);

    if (missingTabs.length === 0) {
      return;
    }

    let cancelled = false;
    void Promise.all(
      missingTabs.map(async (tab) => {
        const cacheKey = getEncryptCacheKey(tab);
        const alwaysEncrypt = await channelEncryptionSettingsService.getAlwaysEncrypt(tab.name, tab.networkId);
        return { cacheKey, tabId: tab.id, alwaysEncrypt };
      })
    ).then((results) => {
      if (cancelled) {
        return;
      }

      const nextStatus: Record<string, boolean> = { ...cachedStatusById };
      results.forEach(({ cacheKey, tabId, alwaysEncrypt }) => {
        encryptStatusCacheRef.current[cacheKey] = alwaysEncrypt;
        nextStatus[tabId] = alwaysEncrypt;
      });
      setAlwaysEncryptStatus(nextStatus);
    }).catch((error) => {
      debugLogger.warn('channelTabs', 'Failed to load always-encrypt tab status', error);
    });

    return () => {
      cancelled = true;
    };
  }, [tabs]);

  useEffect(() => {
    const unsubscribe = channelEncryptionSettingsService.onAlwaysEncryptChange(
      async (channel, network) => {
        const alwaysEncrypt = await channelEncryptionSettingsService.getAlwaysEncrypt(channel, network);
        const nextCache = { ...encryptStatusCacheRef.current };

        tabs.forEach((tab) => {
          if (
            (tab.type === 'channel' || tab.type === 'query') &&
            tab.name.toLowerCase() === channel.toLowerCase() &&
            tab.networkId.toLowerCase() === network.toLowerCase()
          ) {
            nextCache[getEncryptCacheKey(tab)] = alwaysEncrypt;
          }
        });

        encryptStatusCacheRef.current = nextCache;
        setAlwaysEncryptStatus((prev) => {
          const next = { ...prev };
          tabs.forEach((tab) => {
            if (
              (tab.type === 'channel' || tab.type === 'query') &&
              tab.name.toLowerCase() === channel.toLowerCase() &&
              tab.networkId.toLowerCase() === network.toLowerCase()
            ) {
              next[tab.id] = alwaysEncrypt;
            }
          });
          return next;
        });
      }
    );

    return () => unsubscribe();
  }, [tabs]);

  useEffect(() => {
    let mounted = true;
    const loadSettings = async () => {
      const [enabled, inverse] = await Promise.all([
        settingsService.getSetting(
          'channelListScrollSwitchTabs',
          NEW_FEATURE_DEFAULTS.channelListScrollSwitchTabs
        ),
        settingsService.getSetting(
          'channelListScrollSwitchTabsInverse',
          NEW_FEATURE_DEFAULTS.channelListScrollSwitchTabsInverse
        ),
      ]);

      if (mounted) {
        setScrollSwitchTabsEnabled(Boolean(enabled));
        setScrollSwitchTabsInverse(Boolean(inverse));
      }
    };
    loadSettings();

    const unsubEnabled = settingsService.onSettingChange<boolean>('channelListScrollSwitchTabs', (value) => {
      setScrollSwitchTabsEnabled(Boolean(value));
    });
    const unsubInverse = settingsService.onSettingChange<boolean>('channelListScrollSwitchTabsInverse', (value) => {
      setScrollSwitchTabsInverse(Boolean(value));
    });

    return () => {
      mounted = false;
      unsubEnabled();
      unsubInverse();
    };
  }, []);

  const handleScroll = useCallback((offset: number) => {
    if (!scrollSwitchTabsEnabled || tabs.length === 0) {
      return;
    }

    const now = Date.now();
    if (now - lastSwitchAtRef.current < 200) {
      return;
    }

    const delta = offset - lastScrollOffsetRef.current;
    lastScrollOffsetRef.current = offset;
    if (Math.abs(delta) < 18) {
      return;
    }

    const direction = scrollSwitchTabsInverse ? -delta : delta;
    const currentIndex = tabs.findIndex(t => t.id === activeTabId);
    if (currentIndex === -1) {
      return;
    }

    const nextIndex = direction > 0 ? currentIndex + 1 : currentIndex - 1;
    if (nextIndex < 0 || nextIndex >= tabs.length) {
      return;
    }

    lastSwitchAtRef.current = now;
    onTabPress(tabs[nextIndex].id);
  }, [activeTabId, onTabPress, scrollSwitchTabsEnabled, scrollSwitchTabsInverse, tabs]);

  const renderItem = useCallback<ListRenderItem<ChannelTab>>(({ item }) => (
    <ChannelTabItem
      tab={item}
      isActive={item.id === activeTabId}
      isVertical={isVertical}
      position={position}
      showEncryptionIndicators={showEncryptionIndicators}
      alwaysEncryptEnabled={alwaysEncryptStatus[item.id] === true}
      styles={styles}
      onTabPress={onTabPress}
      onTabLongPress={onTabLongPress}
    />
  ), [
    activeTabId,
    alwaysEncryptStatus,
    isVertical,
    onTabLongPress,
    onTabPress,
    position,
    showEncryptionIndicators,
    styles,
  ]);

  const containerStyle = useMemo(() => ([
    styles.container,
    isVertical && styles.containerVertical,
    position === 'left' && styles.containerLeft,
    position === 'right' && styles.containerRight,
  ]), [isVertical, position, styles]);

  const contentContainerStyle = useMemo(() => ([
    styles.scrollContent,
    isVertical && styles.scrollContentVertical,
  ]), [isVertical, styles]);

  return (
    <View style={containerStyle}>
      {process.env.NODE_ENV === 'test' ? (
        <ScrollView
          horizontal={!isVertical}
          showsHorizontalScrollIndicator={!isVertical}
          showsVerticalScrollIndicator={isVertical}
          onScroll={(event) => {
            const offset = isVertical
              ? event.nativeEvent.contentOffset.y
              : event.nativeEvent.contentOffset.x;
            handleScroll(offset);
          }}
          scrollEventThrottle={16}
          contentContainerStyle={contentContainerStyle}>
          {tabs.map((item) => (
            <ChannelTabItem
              key={item.id}
              tab={item}
              isActive={item.id === activeTabId}
              isVertical={isVertical}
              position={position}
              showEncryptionIndicators={showEncryptionIndicators}
              alwaysEncryptEnabled={alwaysEncryptStatus[item.id] === true}
              styles={styles}
              onTabPress={onTabPress}
              onTabLongPress={onTabLongPress}
            />
          ))}
        </ScrollView>
      ) : (
        <FlatList
          data={tabs}
          horizontal={!isVertical}
          showsHorizontalScrollIndicator={!isVertical}
          showsVerticalScrollIndicator={isVertical}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          extraData={alwaysEncryptStatus}
          onScroll={(event) => {
            const offset = isVertical
              ? event.nativeEvent.contentOffset.y
              : event.nativeEvent.contentOffset.x;
            handleScroll(offset);
          }}
          scrollEventThrottle={16}
          contentContainerStyle={contentContainerStyle}
          removeClippedSubviews={tabs.length > 20}
          initialNumToRender={Math.min(tabs.length, isVertical ? 20 : 16)}
          maxToRenderPerBatch={12}
          windowSize={5}
        />
      )}
    </View>
  );
});

ChannelTabs.displayName = 'ChannelTabs';

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.tabBorder,
  },
  containerVertical: {
    borderBottomWidth: 0,
    width: 140,
  },
  containerLeft: {
    borderRightWidth: 1,
    borderRightColor: colors.tabBorder,
  },
  containerRight: {
    borderLeftWidth: 1,
    borderLeftColor: colors.tabBorder,
  },
  scrollContent: {
    paddingHorizontal: 4,
  },
  scrollContentVertical: {
    paddingVertical: 4,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    position: 'relative',
    minWidth: 80,
    backgroundColor: colors.tabInactive,
    maxWidth: 220,
  },
  tabVertical: {
    minWidth: 120,
    width: '100%',
    maxWidth: undefined,
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  encryptionIcon: {
    fontSize: 12,
  },
  activeTab: {
    backgroundColor: colors.tabActive,
  },
  activityTab: {
    backgroundColor: colors.surfaceVariant,
  },
  tabText: {
    color: colors.tabInactiveText,
    fontSize: 14,
    fontWeight: '500',
    flexShrink: 1,
  },
  activeTabText: {
    color: colors.tabActiveText,
    fontWeight: '600',
  },
  activityTabText: {
    color: colors.warning,
    fontWeight: '700',
  },
  activeIndicatorHorizontal: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.accent,
  },
  activeIndicatorVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: colors.accent,
  },
  activeIndicatorLeft: {
    left: 0,
  },
  activeIndicatorRight: {
    right: 0,
  },
});

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { ChannelTab } from '../types';
import { channelEncryptionSettingsService } from '../services/ChannelEncryptionSettingsService';

interface ChannelTabsProps {
  tabs: ChannelTab[];
  activeTabId: string;
  onTabPress: (tabId: string) => void;
  onTabLongPress: (tab: ChannelTab) => void;
  showEncryptionIndicators?: boolean;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export const ChannelTabs: React.FC<ChannelTabsProps> = ({
  tabs,
  activeTabId,
  onTabPress,
  onTabLongPress,
  showEncryptionIndicators = true,
  position = 'top',
}) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const isVertical = position === 'left' || position === 'right';

  // Track which tabs have "always encrypt" enabled
  const [alwaysEncryptStatus, setAlwaysEncryptStatus] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Load always encrypt status for all tabs
    const loadAlwaysEncrypt = async () => {
      const statuses: Record<string, boolean> = {};
      for (const tab of tabs) {
        if (tab.type === 'channel' || tab.type === 'query') {
          const alwaysEncrypt = await channelEncryptionSettingsService.getAlwaysEncrypt(tab.name, tab.networkId);
          statuses[tab.id] = alwaysEncrypt;
        }
      }
      setAlwaysEncryptStatus(statuses);
    };
    loadAlwaysEncrypt();

    // Listen for changes
    const unsubscribe = channelEncryptionSettingsService.onAlwaysEncryptChange(
      async (channel, network) => {
        // Update status for matching tab
        const matchingTab = tabs.find(
          t => t.name.toLowerCase() === channel.toLowerCase() &&
               t.networkId.toLowerCase() === network.toLowerCase()
        );
        if (matchingTab) {
          const alwaysEncrypt = await channelEncryptionSettingsService.getAlwaysEncrypt(channel, network);
          setAlwaysEncryptStatus(prev => ({ ...prev, [matchingTab.id]: alwaysEncrypt }));
        }
      }
    );

    return () => unsubscribe();
  }, [tabs]);

  return (
    <View style={[
      styles.container,
      isVertical && styles.containerVertical,
      position === 'left' && styles.containerLeft,
      position === 'right' && styles.containerRight,
    ]}>
      <ScrollView
        horizontal={!isVertical}
        showsHorizontalScrollIndicator={!isVertical}
        showsVerticalScrollIndicator={isVertical}
        contentContainerStyle={[
          styles.scrollContent,
          isVertical && styles.scrollContentVertical,
        ]}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const hasActivity = tab.hasActivity && !isActive;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.tab,
                isVertical && styles.tabVertical,
                isActive && styles.activeTab,
                hasActivity && styles.activityTab,
              ]}
              onPress={() => onTabPress(tab.id)}
              onLongPress={() => onTabLongPress(tab)}>
              <View style={styles.tabContent}>
                {showEncryptionIndicators && (tab.type === 'query' || tab.type === 'channel') && (
                  <Text style={styles.encryptionIcon}>
                    {alwaysEncryptStatus[tab.id] ? '🔐' : (tab.isEncrypted ? '🔒' : '🔓')}
                  </Text>
                )}
                <Text style={[
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
                    styles.activeIndicator,
                    isVertical && styles.activeIndicatorVertical,
                    position === 'left' && styles.activeIndicatorLeft,
                    position === 'right' && styles.activeIndicatorRight,
                  ]}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

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
  },
  tabVertical: {
    minWidth: 120,
    width: '100%',
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
  },
  activeTabText: {
    color: colors.tabActiveText,
    fontWeight: '600',
  },
  activityTabText: {
    color: colors.warning,
    fontWeight: '700',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.accent,
  },
  activeIndicatorVertical: {
    top: 0,
    bottom: 0,
    width: 3,
    height: '100%',
  },
  activeIndicatorLeft: {
    left: 0,
    right: undefined,
  },
  activeIndicatorRight: {
    right: 0,
    left: undefined,
  },
});

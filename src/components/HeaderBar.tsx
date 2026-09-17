/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { useTheme } from '../hooks/useTheme';
import { useT } from '../i18n/localization';
import { inAppPurchaseService } from '../services/InAppPurchaseService';
import { useSettingsSecurity } from '../hooks/useSettingsSecurity';

// Compact latency sparkline: map a ping (ms) to a block glyph.
const SPARK_BLOCKS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇'];
const pingBlock = (ms: number): string => {
  const thresholds = [50, 100, 175, 275, 425, 650];
  for (let i = 0; i < thresholds.length; i++) {
    if (ms <= thresholds[i]) return SPARK_BLOCKS[i];
  }
  return SPARK_BLOCKS[SPARK_BLOCKS.length - 1];
};
const pingSparkline = (history: number[]): string =>
  history.map(pingBlock).join('');

interface HeaderBarProps {
  networkName: string;

  /** Display name of the active tab (e.g. "Status", "#AndroidIRCX", a nick). */
  activeTabName?: string;

  ping?: number;

  /** Number of background tabs with unread activity. */
  unreadTabsCount?: number;

  isConnected: boolean;

  onDropdownPress: () => void;

  onMenuPress: () => void;

  onConnectPress?: () => void;

  onToggleNicklist: () => void;

  showNicklistButton: boolean;

  onLockPress?: () => void;

  lockState?: 'locked' | 'unlocked';

  showLockButton?: boolean;

  showEncryptionButton?: boolean;

  onEncryptionPress?: () => void;

  showKillSwitchButton?: boolean;

  onKillSwitchPress?: () => void;

  showSideTabsToggle?: boolean;

  sideTabsVisible?: boolean;

  onToggleSideTabs?: () => void;

  showSearchButton?: boolean;

  onSearchPress?: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  networkName,

  activeTabName,

  ping,

  unreadTabsCount = 0,

  isConnected,

  onDropdownPress,

  onMenuPress,

  onConnectPress,

  onToggleNicklist,

  showNicklistButton,

  onLockPress,

  lockState = 'unlocked',

  showLockButton = false,

  showEncryptionButton = false,

  onEncryptionPress,

  showKillSwitchButton = false,

  onKillSwitchPress,

  showSideTabsToggle = false,

  sideTabsVisible = true,

  onToggleSideTabs,

  showSearchButton = true,

  onSearchPress,
}) => {
  const t = useT();
  const { colors } = useTheme();
  const [isSupporter, setIsSupporter] = useState(false);
  const { killSwitchCustomIcon, killSwitchCustomColor } = useSettingsSecurity();

  const styles = createStyles(colors);

  // Keep a short rolling history of pings for the latency sparkline.
  const [pingHistory, setPingHistory] = useState<number[]>([]);
  useEffect(() => {
    if (!isConnected) {
      setPingHistory([]);
      return;
    }
    if (ping === undefined) return;
    setPingHistory(prev => [...prev.slice(-9), ping]);
  }, [ping, isConnected]);

  // Colour the ping by latency, following the theme's status colours.
  const pingLevelStyle =
    ping === undefined
      ? styles.pingNeutral
      : ping < 120
        ? styles.pingGood
        : ping < 300
          ? styles.pingWarn
          : styles.pingBad;

  useEffect(() => {
    const updateSupporterStatus = () => {
      setIsSupporter(inAppPurchaseService.isSupporter());
    };

    updateSupporterStatus();
    const unsubscribe = inAppPurchaseService.addListener(updateSupporterStatus);
    return unsubscribe;
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.leftSection}>
        <TouchableOpacity
          onPress={!isConnected && onConnectPress ? onConnectPress : undefined}
          disabled={isConnected || !onConnectPress}
        >
          <View style={styles.networkNameContainer}>
            {showSideTabsToggle && onToggleSideTabs && (
              <TouchableOpacity
                style={styles.sideTabsToggleButton}
                onPress={onToggleSideTabs}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text
                  style={[
                    styles.sideTabsToggleIcon,
                    !sideTabsVisible && styles.sideTabsToggleIconHidden,
                  ]}
                >
                  =
                </Text>
              </TouchableOpacity>
            )}
            <Text
              style={
                isConnected ? styles.statusDotOnline : styles.statusDotOffline
              }
            >
              ●
            </Text>
            <Text style={styles.networkName}>{networkName}</Text>
            {isSupporter && <Text style={styles.supporterBadge}>❤️</Text>}
            {isConnected && !!activeTabName && (
              <>
                <Text style={styles.tabAt}>@</Text>
                <Text
                  style={styles.tabName}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {activeTabName}
                </Text>
              </>
            )}
          </View>
        </TouchableOpacity>

        {isConnected && ping !== undefined && (
          <Text style={styles.ping} numberOfLines={1}>
            <Text style={pingLevelStyle}>{`${Math.round(ping)}ms`}</Text>
            {pingHistory.length > 1 && (
              <Text style={styles.sparkline}>
                {` ${pingSparkline(pingHistory)}`}
              </Text>
            )}
            {unreadTabsCount > 0 && (
              <Text style={styles.activeCount}>
                {`  ·  ${unreadTabsCount} ${t('active')}`}
              </Text>
            )}
          </Text>
        )}

        {!isConnected && onConnectPress && (
          <Text style={styles.connectHint} numberOfLines={1}>
            {networkName
              ? t('Tap to connect to {network}').replace(
                  '{network}',
                  networkName,
                )
              : t('Tap to connect')}
          </Text>
        )}
      </View>

      <View style={styles.rightSection}>
        {showKillSwitchButton && onKillSwitchPress && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onKillSwitchPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon
              name={killSwitchCustomIcon}
              size={20}
              color={killSwitchCustomColor}
              solid
            />
          </TouchableOpacity>
        )}

        {showEncryptionButton && onEncryptionPress && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onEncryptionPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.icon}>🔐</Text>
          </TouchableOpacity>
        )}

        {showLockButton && onLockPress && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onLockPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.icon}>
              {lockState === 'locked' ? '\u{1F512}' : '\u{1F513}'}
            </Text>
          </TouchableOpacity>
        )}

        {showNicklistButton && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onToggleNicklist}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.icon}>👥</Text>
          </TouchableOpacity>
        )}

        {showSearchButton && onSearchPress && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onSearchPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.icon}>🔍</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.iconButton}
          onPress={onDropdownPress}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.icon}>▼</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={onMenuPress}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.icon}>☰</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.primary,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      ...Platform.select({
        android: {
          elevation: 4,
        },
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
        },
      }),
    },
    leftSection: {
      flex: 1,
    },
    networkNameContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    sideTabsToggleButton: {
      marginRight: 8,
      padding: 4,
    },
    sideTabsToggleIcon: {
      color: colors.onPrimary,
      fontSize: 18,
      fontWeight: 'bold',
    },
    sideTabsToggleIconHidden: {
      opacity: 0.6,
    },
    networkName: {
      color: colors.onPrimary,
      fontSize: 16,
      fontWeight: '600',
    },
    supporterBadge: {
      fontSize: 14,
      lineHeight: 16,
    },
    tabAt: {
      color: colors.accent,
      fontSize: 16,
      fontWeight: '700',
      marginHorizontal: 5,
    },
    tabName: {
      color: colors.onPrimary,
      fontSize: 16,
      fontWeight: '500',
      opacity: 0.95,
      maxWidth: 150,
    },
    ping: {
      color: colors.onPrimary,
      fontSize: 12,
      opacity: 0.9,
    },
    pingNeutral: {
      color: colors.onPrimary,
    },
    pingGood: {
      color: colors.success,
    },
    pingWarn: {
      color: colors.warning,
    },
    pingBad: {
      color: colors.error,
    },
    sparkline: {
      color: colors.onPrimary,
      opacity: 0.7,
    },
    activeCount: {
      color: colors.onPrimary,
      opacity: 0.85,
    },
    statusDotOnline: {
      color: colors.success,
      fontSize: 10,
      marginRight: 5,
    },
    statusDotOffline: {
      color: colors.onPrimary,
      opacity: 0.4,
      fontSize: 10,
      marginRight: 5,
    },
    connectHint: {
      color: colors.onPrimary,
      fontSize: 11,
      opacity: 0.7,
      fontStyle: 'italic',
      marginTop: 2,
    },
    rightSection: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    iconButton: {
      padding: 4,
    },
    icon: {
      color: colors.onPrimary,
      fontSize: 18,
      fontWeight: 'bold',
    },
  });

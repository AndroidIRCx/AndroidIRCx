/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * IRCv3InfoScreen.tsx
 *
 * Displays IRCv3 capability diagnostics and server feature status
 * in a clean, user-friendly layout.
 */

/* eslint-disable react-native/no-inline-styles -- settings screen uses dynamic local layout styles extensively */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { ModalSafeArea } from '../components/ModalSafeArea';
import { useT } from '../i18n/transifex';
import { useTheme } from '../hooks/useTheme';
import { connectionManager } from '../services/ConnectionManager';
import { IRCService } from '../services/IRCService';

interface IRCv3InfoScreenProps {
  visible: boolean;
  networkId?: string;
  onClose: () => void;
}

interface IRCv3Data {
  networkName: string;
  isConnected: boolean;
  availableCaps: string[];
  enabledCaps: string[];
  capValues: Record<string, string>;
  isupport: Record<string, string | true>;
}

function useIRCv3Data(networkId?: string): IRCv3Data | null {
  const [data, setData] = useState<IRCv3Data | null>(null);

  const refresh = useCallback(() => {
    const conn = networkId
      ? connectionManager.getConnection(networkId)
      : connectionManager.getActiveConnection();
    const irc: IRCService | undefined = conn?.ircService;
    if (!irc) {
      setData(null);
      return;
    }
    setData({
      networkName: irc.getNetworkName() || networkId || conn?.networkId || '',
      isConnected: irc.getConnectionStatus(),
      availableCaps: irc.getAvailableCapabilities(),
      enabledCaps: irc.getEnabledCapabilities(),
      capValues: irc.getCapabilityValues(),
      isupport: irc.getISupportValues(),
    });
  }, [networkId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return data;
}

export const IRCv3InfoScreen: React.FC<IRCv3InfoScreenProps> = ({
  visible,
  networkId,
  onClose,
}) => {
  const t = useT();
  const { colors } = useTheme();
  const irData = useIRCv3Data(networkId);
  const hasCaps = (irData?.availableCaps?.length ?? 0) > 0;
  const isConnected = Boolean(irData?.isConnected);

  const styles = createStyles(colors);

  const renderIRCv3Logo = () => (
    <View style={styles.logoContainer}>
      <View style={styles.logoBadge}>
        <Icon name="code" size={28} color="#FFFFFF" />
      </View>
      <View style={styles.logoTextContainer}>
        <Text style={styles.logoTextIRC}>IRC</Text>
        <Text style={styles.logoTextV3}>v3</Text>
      </View>
      <View style={styles.logoStatusDot}>
        <View
          style={[
            styles.statusDot,
            { backgroundColor: hasCaps ? '#4CAF50' : '#757575' },
          ]}
        />
      </View>
    </View>
  );

  const renderConnectedInfo = () => {
    if (!irData) {
      return null;
    }

    const available = irData.availableCaps;
    const enabled = new Set(irData.enabledCaps);
    const capValues = irData.capValues;
    const isupport = irData.isupport;

    // Group capabilities by category
    const coreCaps = available.filter(
      c =>
        !c.includes('/') &&
        !c.startsWith('draft/') &&
        c !== 'userhost-in-names' &&
        c !== 'extended-join' &&
        c !== 'account-notify' &&
        c !== 'away-notify' &&
        c !== 'chghost' &&
        c !== 'setname' &&
        c !== 'multi-prefix' &&
        c !== 'echo-message' &&
        c !== 'invite-notify' &&
        c !== 'standard-replies',
    );

    const extraCaps = available.filter(
      c =>
        c === 'userhost-in-names' ||
        c === 'extended-join' ||
        c === 'account-notify' ||
        c === 'away-notify' ||
        c === 'chghost' ||
        c === 'setname' ||
        c === 'multi-prefix' ||
        c === 'echo-message' ||
        c === 'invite-notify' ||
        c === 'standard-replies',
    );

    const draftCaps = available.filter(
      c => c.startsWith('draft/') || c.includes('/'),
    );

    // Feature matrix: key IRCv3 features
    const features: Array<{
      name: string;
      check: boolean;
      description: string;
    }> = [
      {
        name: 'Reply',
        check: enabled.has('draft/reply'),
        description: 'Threaded message replies',
      },
      {
        name: 'Typing',
        check: typeof capValues.typing !== 'undefined' || enabled.has('typing'),
        description: 'Typing indicators',
      },
      {
        name: 'Reactions',
        check: typeof capValues.react !== 'undefined' || enabled.has('react'),
        description: 'Message reactions / emoji',
      },
      {
        name: 'Read Markers',
        check: enabled.has('draft/read-marker'),
        description: 'Per-channel read position',
      },
      {
        name: 'Chat History',
        check: enabled.has('chathistory') || enabled.has('draft/chathistory'),
        description: 'Server-side message history',
      },
      {
        name: 'SASL',
        check: enabled.has('sasl'),
        description: 'Authenticated login',
      },
      {
        name: 'Server Time',
        check: enabled.has('server-time'),
        description: 'Accurate timestamps',
      },
      {
        name: 'Message Tags',
        check: enabled.has('message-tags'),
        description: 'Extended metadata',
      },
      {
        name: 'Batch',
        check: enabled.has('batch'),
        description: 'Atomic message groups',
      },
      {
        name: 'Labeled Response',
        check: enabled.has('labeled-response'),
        description: 'Command/response tracking',
      },
      {
        name: 'STS',
        check: enabled.has('sts'),
        description: 'Strict Transport Security',
      },
      {
        name: 'Away Notify',
        check: enabled.has('away-notify'),
        description: 'Real-time away status',
      },
    ];

    const featureOk = features.filter(f => f.check).length;
    const featureTotal = features.length;

    return (
      <>
        {/* Connection banner */}
        <View style={styles.connectionBanner}>
          <Icon name="server" size={16} color={colors.text} />
          <Text style={styles.connectionName}>{irData.networkName}</Text>
        </View>

        {/* Feature Score */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('IRCv3 Features')}</Text>
          <View style={styles.scoreRow}>
            <View style={styles.scoreCircle}>
              <Text style={styles.scoreText}>
                {featureOk}/{featureTotal}
              </Text>
            </View>
            <View style={styles.featureGrid}>
              {features.map(f => (
                <View
                  key={f.name}
                  style={[
                    styles.featureChip,
                    f.check ? styles.featureChipOk : styles.featureChipOff,
                  ]}
                >
                  <Icon
                    name={f.check ? 'check-circle' : 'times-circle'}
                    size={12}
                    color={f.check ? '#4CAF50' : '#9E9E9E'}
                  />
                  <Text
                    style={[
                      styles.featureChipText,
                      {
                        color: f.check
                          ? '#4CAF50'
                          : (colors.textSecondary ?? '#9E9E9E'),
                      },
                    ]}
                  >
                    {f.name}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Core Capabilities */}
        {coreCaps.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('Core Capabilities')}{' '}
              <Text style={styles.sectionCount}>({coreCaps.length})</Text>
            </Text>
            <View style={styles.capGrid}>
              {coreCaps.map(cap => (
                <View
                  key={cap}
                  style={[
                    styles.capChip,
                    enabled.has(cap)
                      ? styles.capChipEnabled
                      : styles.capChipAvailable,
                  ]}
                >
                  <Text
                    style={[
                      styles.capChipText,
                      {
                        color: enabled.has(cap)
                          ? '#FFFFFF'
                          : (colors.textSecondary ?? '#9E9E9E'),
                      },
                    ]}
                  >
                    {cap}
                    {capValues[cap] ? ` = ${capValues[cap]}` : ''}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Extended Capabilities */}
        {extraCaps.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('Extended Capabilities')}{' '}
              <Text style={styles.sectionCount}>({extraCaps.length})</Text>
            </Text>
            <View style={styles.capGrid}>
              {extraCaps.map(cap => (
                <View
                  key={cap}
                  style={[
                    styles.capChip,
                    enabled.has(cap)
                      ? styles.capChipEnabled
                      : styles.capChipAvailable,
                  ]}
                >
                  <Text
                    style={[
                      styles.capChipText,
                      {
                        color: enabled.has(cap)
                          ? '#FFFFFF'
                          : (colors.textSecondary ?? '#9E9E9E'),
                      },
                    ]}
                  >
                    {cap}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Draft Capabilities */}
        {draftCaps.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Draft/Vendor Caps{' '}
              <Text style={styles.sectionCount}>({draftCaps.length})</Text>
            </Text>
            <View style={styles.capGrid}>
              {draftCaps.map(cap => (
                <View
                  key={cap}
                  style={[
                    styles.capChip,
                    enabled.has(cap)
                      ? styles.capChipEnabled
                      : styles.capChipAvailable,
                  ]}
                >
                  <Text
                    style={[
                      styles.capChipText,
                      {
                        color: enabled.has(cap)
                          ? '#FFFFFF'
                          : (colors.textSecondary ?? '#9E9E9E'),
                      },
                    ]}
                  >
                    {cap}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ISUPPORT Values */}
        {Object.keys(isupport).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('Server Support (ISUPPORT)')}{' '}
              <Text style={styles.sectionCount}>
                ({Object.keys(isupport).length})
              </Text>
            </Text>
            <View style={styles.isupportContainer}>
              {Object.entries(isupport)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, value]) => (
                  <View key={key} style={styles.isupportRow}>
                    <Text style={styles.isupportKey}>{key}</Text>
                    <Text style={styles.isupportValue}>
                      {value === true ? '\u2713' : String(value)}
                    </Text>
                  </View>
                ))}
            </View>
          </View>
        )}

        {/* Refresh button */}
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={() => {
            const conn = networkId
              ? connectionManager.getConnection(networkId)
              : undefined;
            const irc = conn?.ircService;
            if (irc) {
              irc.requestCapabilityList();
              irc.requestISupport();
            }
          }}
        >
          <Icon name="sync" size={14} color={colors.primary} />
          <Text style={[styles.refreshText, { color: colors.primary }]}>
            {t('Refresh Data')}
          </Text>
        </TouchableOpacity>

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#4CAF50' }]} />
            <Text style={styles.legendText}>{t('Enabled')}</Text>
          </View>
          <View style={styles.legendItem}>
            <View
              style={[
                styles.legendDot,
                {
                  backgroundColor: colors.surfaceVariant ?? '#424242',
                },
              ]}
            />
            <Text style={styles.legendText}>{t('Advertised')}</Text>
          </View>
        </View>
      </>
    );
  };

  const renderNotConnected = () => (
    <View style={styles.emptyContainer}>
      <Icon name="plug" size={48} color={colors.textSecondary ?? '#9E9E9E'} />
      <Text style={styles.emptyTitle}>{t('Not Connected')}</Text>
      <Text style={styles.emptySubtitle}>
        {t(
          'Connect to an IRC network to view IRCv3 capabilities and server features.',
        )}
      </Text>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <ModalSafeArea
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        {/* Header */}
        <View
          style={[
            styles.header,
            {
              backgroundColor:
                colors.surfaceVariant ?? colors.surface ?? '#1E1E1E',
              borderBottomColor: colors.border ?? '#333',
            },
          ]}
        >
          <View style={styles.headerLeft}>{renderIRCv3Logo()}</View>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Icon name="times" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
        >
          {isConnected ? renderConnectedInfo() : renderNotConnected()}
        </ScrollView>
      </ModalSafeArea>
    </Modal>
  );
};

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      paddingTop: 48,
      borderBottomWidth: 1,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    closeButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 48,
    },

    // Logo
    logoContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    logoBadge: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: '#6366F1',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    logoTextContainer: {
      flexDirection: 'row',
      alignItems: 'baseline',
    },
    logoTextIRC: {
      fontSize: 22,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: 1,
    },
    logoTextV3: {
      fontSize: 22,
      fontWeight: '800',
      color: '#6366F1',
      letterSpacing: 1,
      marginLeft: 2,
    },
    logoStatusDot: {
      marginLeft: 12,
    },
    statusDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },

    // Connection banner
    connectionBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceVariant ?? '#2A2A2A',
      borderRadius: 12,
      padding: 14,
      marginBottom: 16,
    },
    connectionName: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginLeft: 10,
    },

    // Sections
    section: {
      marginBottom: 20,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 10,
    },
    sectionCount: {
      fontSize: 13,
      fontWeight: '400',
      color: colors.textSecondary ?? '#9E9E9E',
    },

    // Score
    scoreRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    scoreCircle: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: '#6366F1',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 14,
    },
    scoreText: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '800',
    },
    featureGrid: {
      flex: 1,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    featureChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
      borderWidth: 1,
    },
    featureChipOk: {
      backgroundColor: 'rgba(76, 175, 80, 0.15)',
      borderColor: 'rgba(76, 175, 80, 0.3)',
    },
    featureChipOff: {
      backgroundColor: 'rgba(158, 158, 158, 0.1)',
      borderColor: 'rgba(158, 158, 158, 0.2)',
    },
    featureChipText: {
      fontSize: 12,
      fontWeight: '600',
    },

    // Cap chips
    capGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    capChip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
    },
    capChipEnabled: {
      backgroundColor: 'rgba(76, 175, 80, 0.2)',
      borderColor: 'rgba(76, 175, 80, 0.4)',
    },
    capChipAvailable: {
      backgroundColor: colors.surfaceVariant ?? '#2A2A2A',
      borderColor: colors.border ?? '#444',
    },
    capChipText: {
      fontSize: 12,
      fontWeight: '500',
      fontFamily: 'monospace',
    },

    // ISUPPORT
    isupportContainer: {
      backgroundColor: colors.surfaceVariant ?? '#2A2A2A',
      borderRadius: 12,
      overflow: 'hidden',
    },
    isupportRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border ?? '#444',
    },
    isupportKey: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
      fontFamily: 'monospace',
    },
    isupportValue: {
      fontSize: 13,
      color: colors.textSecondary ?? '#BDBDBD',
      fontFamily: 'monospace',
      maxWidth: '55%',
      textAlign: 'right',
    },

    // Refresh
    refreshButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      marginBottom: 16,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.primary + '40',
      backgroundColor: colors.primary + '10',
    },
    refreshText: {
      fontSize: 14,
      fontWeight: '600',
    },

    // Legend
    legend: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 20,
      paddingBottom: 16,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    legendDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    legendText: {
      fontSize: 12,
      color: colors.textSecondary ?? '#9E9E9E',
    },

    // Empty
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 80,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginTop: 16,
    },
    emptySubtitle: {
      fontSize: 14,
      color: colors.textSecondary ?? '#9E9E9E',
      textAlign: 'center',
      marginTop: 8,
      maxWidth: 280,
    },
  });
}

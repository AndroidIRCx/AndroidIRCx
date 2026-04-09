/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import { useTheme } from '../../../hooks/useTheme';
import { useUIStore } from '../../../stores/uiStore';
import { useT } from '../../../i18n/transifex';

export const HelpSection: React.FC = () => {
  const { colors } = useTheme();
  const t = useT();
  const {
    setShowHelpConnection,
    setShowHelpCommands,
    setShowHelpEncryption,
    setShowHelpMedia,
    setShowHelpChannelManagement,
    setShowHelpTroubleshooting,
  } = useUIStore();

  const styles = StyleSheet.create({
    container: {
      marginBottom: 16,
    },
    helpItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: colors.surface,
      borderRadius: 8,
      marginBottom: 8,
    },
    helpItemContent: {
      flex: 1,
      marginLeft: 12,
    },
    helpItemTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    helpItemDescription: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    iconContainer: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primary + '20',
      justifyContent: 'center',
      alignItems: 'center',
    },
    chevron: {
      marginLeft: 8,
    },
  });

  const helpItems = [
    {
      icon: 'tools',
      title: t('Troubleshooting Guide'),
      description: t('Fix common problems and errors'),
      onPress: () => setShowHelpTroubleshooting(true),
    },
    {
      icon: 'network-wired',
      title: t('IRC Connection Guide'),
      description: t('Learn how to connect to IRC servers'),
      onPress: () => setShowHelpConnection(true),
    },
    {
      icon: 'terminal',
      title: t('Commands Reference'),
      description: t('List of all IRC commands'),
      onPress: () => setShowHelpCommands(true),
    },
    {
      icon: 'lock',
      title: t('Encryption Guide'),
      description: t('End-to-end encryption for DMs and channels'),
      onPress: () => setShowHelpEncryption(true),
    },
    {
      icon: 'photo-video',
      title: t('Media Sharing Guide'),
      description: t('Send encrypted photos, videos, and voice'),
      onPress: () => setShowHelpMedia(true),
    },
    {
      icon: 'users-cog',
      title: t('Channel Management'),
      description: t('Manage channels, modes, and permissions'),
      onPress: () => setShowHelpChannelManagement(true),
    },
  ];

  return (
    <View style={styles.container}>
      {helpItems.map((item, index) => (
        <TouchableOpacity
          key={index}
          style={styles.helpItem}
          onPress={item.onPress}
          accessibilityLabel={item.title}
          accessibilityHint={item.description}
        >
          <View style={styles.iconContainer}>
            <FontAwesome5
              name={item.icon}
              size={16}
              color={colors.primary}
              solid
            />
          </View>
          <View style={styles.helpItemContent}>
            <Text style={styles.helpItemTitle}>{item.title}</Text>
            <Text style={styles.helpItemDescription}>{item.description}</Text>
          </View>
          <FontAwesome5
            name="chevron-right"
            size={14}
            color={colors.textSecondary}
            style={styles.chevron}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
};

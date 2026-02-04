/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Dugme za primenu preporučenih podešavanja teme
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { tx } from '../../i18n/transifex';
import { useTheme } from '../../hooks/useTheme';
import { themeService, ThemeRecommendedSettings } from '../../services/ThemeService';
import { settingsService } from '../../services/SettingsService';
import { LayoutType } from '../../services/LayoutService';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

interface ApplyThemeSettingsButtonProps {
  onApplied?: () => void;
}

/**
 * Mapira preporučena podešavanja teme na SettingsService ključeve
 */
async function applyThemeSettings(settings: ThemeRecommendedSettings): Promise<void> {
  const promises: Promise<void>[] = [];
  const normalizedBannerPosition = (() => {
    const pos = settings.bannerPosition;
    if (!pos) return undefined;
    switch (pos) {
      case 'above_header':
        return 'tabs_above';
      case 'below_header':
        return 'tabs_below';
      case 'bottom':
        return 'input_below';
      case 'input_above':
      case 'input_below':
      case 'tabs_above':
      case 'tabs_below':
        return pos;
      default:
        return undefined;
    }
  })();

  // Appearance settings
  if (settings.tabPosition !== undefined) {
    promises.push(settingsService.setSetting('tabPosition', settings.tabPosition));
  }
  if (settings.userListSize !== undefined) {
    promises.push(settingsService.setSetting('userListSize', settings.userListSize));
  }
  if (settings.userListNickFontSize !== undefined) {
    promises.push(settingsService.setSetting('userListNickFontSize', settings.userListNickFontSize));
  }
  if (settings.nickListTongueSize !== undefined) {
    promises.push(settingsService.setSetting('nickListTongueSize', settings.nickListTongueSize));
  }
  if (settings.fontSize !== undefined) {
    const layoutMapping: Record<string, LayoutType> = {
      'small': 'compact',
      'medium': 'default',
      'large': 'relaxed',
      'xlarge': 'custom',
    };
    promises.push(settingsService.setSetting('layoutType', layoutMapping[settings.fontSize] || 'default'));
  }
  if (settings.messageSpacing !== undefined) {
    promises.push(settingsService.setSetting('messageSpacing', settings.messageSpacing));
  }
  if (settings.messagePadding !== undefined) {
    promises.push(settingsService.setSetting('messagePadding', settings.messagePadding));
  }
  if (settings.navigationBarOffset !== undefined) {
    promises.push(settingsService.setSetting('navigationBarOffset', settings.navigationBarOffset));
  }

  // Display & UI settings
  if (settings.noticeRouting !== undefined) {
    promises.push(settingsService.setSetting('noticeRouting', settings.noticeRouting));
  }
  if (settings.showTimestamps !== undefined) {
    promises.push(settingsService.setSetting('showTimestamps', settings.showTimestamps));
  }
  if (settings.groupMessages !== undefined) {
    promises.push(settingsService.setSetting('groupMessages', settings.groupMessages));
  }
  if (settings.messageTextAlignment !== undefined) {
    promises.push(settingsService.setSetting('messageTextAlignment', settings.messageTextAlignment));
  }
  if (settings.messageTextDirection !== undefined) {
    promises.push(settingsService.setSetting('messageTextDirection', settings.messageTextDirection));
  }
  if (settings.timestampDisplay !== undefined) {
    promises.push(settingsService.setSetting('timestampDisplay', settings.timestampDisplay));
  }
  if (settings.timestampFormat !== undefined) {
    promises.push(settingsService.setSetting('timestampFormat', settings.timestampFormat));
  }
  if (normalizedBannerPosition !== undefined) {
    promises.push(settingsService.setSetting('bannerPosition', normalizedBannerPosition));
  }
  if (settings.keyboardBehavior !== undefined) {
    promises.push(settingsService.setSetting('keyboardBehavior', settings.keyboardBehavior));
  }

  await Promise.all(promises);
}

export const ApplyThemeSettingsButton: React.FC<ApplyThemeSettingsButtonProps> = ({ onApplied }) => {
  const { theme } = useTheme();
  const hasSettings = themeService.hasRecommendedSettings();
  const settings = themeService.getRecommendedSettings();

  if (!hasSettings || !settings) {
    return null;
  }

  const handlePress = () => {
    Alert.alert(
      t('Apply Theme Settings'),
      t('This will apply the recommended settings for the {{themeName}} theme. Your current settings will be overwritten.', { themeName: theme.name }),
      [
        {
          text: t('Cancel'),
          style: 'cancel',
        },
        {
          text: t('Apply'),
          style: 'default',
          onPress: async () => {
            try {
              await applyThemeSettings(settings);
              onApplied?.();
              Alert.alert(
                t('Settings Applied'),
                t('Theme settings have been applied successfully.')
              );
            } catch (error) {
              console.error('Failed to apply theme settings:', error);
              Alert.alert(
                t('Error'),
                t('Failed to apply theme settings. Please try again.')
              );
            }
          },
        },
      ]
    );
  };

  return (
    <TouchableOpacity style={styles.container} onPress={handlePress}>
      <View style={styles.content}>
        <Text style={styles.title}>{t('Apply Theme Settings')}</Text>
        <Text style={styles.description}>
          {t('Apply recommended settings for {{themeName}} theme', { themeName: theme.name })}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 8,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    opacity: 0.7,
  },
});

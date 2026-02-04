/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Komponenta za izbor teme sa opcijom primene preporučenih podešavanja
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { tx } from '../../i18n/transifex';
import { useThemeWithSettings } from '../../hooks/useThemeWithSettings';
import { Theme } from '../../services/ThemeService';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

interface ThemeSelectorProps {
  themes: Theme[];
  onThemeChange?: (themeId: string) => void;
}

export const ThemeSelectorWithSettings: React.FC<ThemeSelectorProps> = ({
  themes,
  onThemeChange,
}) => {
  const { theme: currentTheme, setTheme, hasRecommendedSettings, recommendedSettings } = useThemeWithSettings();
  const [isApplying, setIsApplying] = useState(false);

  const handleThemeSelect = async (themeId: string) => {
    const selectedTheme = themes.find(t => t.id === themeId);
    if (!selectedTheme) return;

    // Proveri da li tema ima preporučena podešavanja
    if (selectedTheme.recommendedSettings && Object.keys(selectedTheme.recommendedSettings).length > 0) {
      // Pitaj korisnika da li želi da primeni preporučena podešavanja
      Alert.alert(
        t('Apply Theme Settings?'),
        t('The "{{themeName}}" theme has recommended settings. Would you like to apply them for the best experience?', { themeName: selectedTheme.name }),
        [
          {
            text: t('Theme Only'),
            onPress: async () => {
              setIsApplying(true);
              try {
                await setTheme(themeId, false);
                onThemeChange?.(themeId);
              } finally {
                setIsApplying(false);
              }
            },
          },
          {
            text: t('Apply All'),
            style: 'default',
            onPress: async () => {
              setIsApplying(true);
              try {
                await setTheme(themeId, true);
                onThemeChange?.(themeId);
                Alert.alert(
                  t('Settings Applied'),
                  t('Theme and recommended settings have been applied.')
                );
              } catch (error) {
                console.error('Failed to apply theme settings:', error);
                Alert.alert(
                  t('Error'),
                  t('Failed to apply theme settings.')
                );
              } finally {
                setIsApplying(false);
              }
            },
          },
        ]
      );
    } else {
      // Tema nema preporučena podešavanja, samo primeni temu
      setIsApplying(true);
      try {
        await setTheme(themeId, false);
        onThemeChange?.(themeId);
      } finally {
        setIsApplying(false);
      }
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>{t('Select Theme')}</Text>
      
      {themes.map((theme) => (
        <TouchableOpacity
          key={theme.id}
          style={[
            styles.themeItem,
            currentTheme.id === theme.id && styles.themeItemActive,
          ]}
          onPress={() => handleThemeSelect(theme.id)}
          disabled={isApplying}
        >
          <View style={styles.themePreview}>
            <View
              style={[
                styles.colorPreview,
                { backgroundColor: theme.colors.background },
              ]}
            >
              <View
                style={[
                  styles.accentPreview,
                  { backgroundColor: theme.colors.primary },
                ]}
              />
            </View>
          </View>
          
          <View style={styles.themeInfo}>
            <Text style={styles.themeName}>{theme.name}</Text>
            {theme.recommendedSettings && (
              <Text style={styles.hasSettingsBadge}>
                {t('Recommended settings available')}
              </Text>
            )}
          </View>
          
          {currentTheme.id === theme.id && (
            <View style={styles.selectedIndicator}>
              <Text style={styles.selectedText}>✓</Text>
            </View>
          )}
        </TouchableOpacity>
      ))}
      
      {hasRecommendedSettings && (
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            {t('Current theme has recommended settings that can be applied.')}
          </Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  themeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  themeItemActive: {
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.2)',
  },
  themePreview: {
    marginRight: 12,
  },
  colorPreview: {
    width: 48,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  accentPreview: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  themeInfo: {
    flex: 1,
  },
  themeName: {
    fontSize: 16,
    fontWeight: '600',
  },
  hasSettingsBadge: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 4,
  },
  selectedIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoBox: {
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    borderRadius: 8,
  },
  infoText: {
    fontSize: 14,
    opacity: 0.8,
  },
});

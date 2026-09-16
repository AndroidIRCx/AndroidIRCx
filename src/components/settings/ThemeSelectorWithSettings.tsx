/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Komponenta za izbor teme sa opcijom primene preporučenih podešavanja
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { tx } from '../../i18n/localization';
import { useThemeWithSettings } from '../../hooks/useThemeWithSettings';
import { Theme } from '../../services/ThemeService';
import { useTheme } from '../../hooks/useTheme';
import { groupThemes } from '../../themes/families';
import { relativeLuminance } from '../../themes/palette';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

interface ThemeSelectorProps {
  themes: Theme[];
  onThemeChange?: (themeId: string) => void;
}

export const ThemeSelectorWithSettings: React.FC<ThemeSelectorProps> = ({
  themes,
  onThemeChange,
}) => {
  const { colors } = useTheme();
  const {
    theme: currentTheme,
    setTheme,
    hasRecommendedSettings,
  } = useThemeWithSettings();
  const [isApplying, setIsApplying] = useState(false);
  const styles = createStyles(colors);
  const sections = useMemo(() => groupThemes(themes), [themes]);

  const handleThemeSelect = async (themeId: string) => {
    const selectedTheme = themes.find(t => t.id === themeId);
    if (!selectedTheme) return;

    // Proveri da li tema ima preporučena podešavanja
    if (
      selectedTheme.recommendedSettings &&
      Object.keys(selectedTheme.recommendedSettings).length > 0
    ) {
      // Pitaj korisnika da li želi da primeni preporučena podešavanja
      Alert.alert(
        t('Apply Theme Settings?'),
        t(
          'The "{{themeName}}" theme has recommended settings. Would you like to apply them for the best experience?',
          { themeName: selectedTheme.name },
        ),
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
                  t('Theme and recommended settings have been applied.'),
                );
              } catch (error) {
                console.error('Failed to apply theme settings:', error);
                Alert.alert(t('Error'), t('Failed to apply theme settings.'));
              } finally {
                setIsApplying(false);
              }
            },
          },
        ],
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

      {sections.map(section => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>

          {section.themes.map(theme => {
            // Small swatch strip previewing the palette (like the plan gallery
            // cards): background, surface, primary, nick, and a status accent.
            const swatchColors = [
              theme.colors.background,
              theme.colors.surface,
              theme.colors.primary,
              theme.colors.messageNick,
              theme.colors.success || theme.colors.error,
            ];
            const isLight = relativeLuminance(theme.colors.background) > 0.5;

            return (
              <TouchableOpacity
                key={theme.id}
                style={[
                  styles.themeItem,
                  currentTheme.id === theme.id && styles.themeItemActive,
                ]}
                onPress={() => handleThemeSelect(theme.id)}
                disabled={isApplying}
              >
                <View style={styles.swatchStrip}>
                  {swatchColors.map((swatch, index) => (
                    <View
                      key={index}
                      style={[styles.swatchCell, { backgroundColor: swatch }]}
                    />
                  ))}
                </View>

                <View style={styles.themeInfo}>
                  <View style={styles.themeNameRow}>
                    <Text style={styles.themeName}>{theme.name}</Text>
                    <View style={styles.modeChip}>
                      <Text style={styles.modeChipText}>
                        {isLight
                          ? t('Light').toUpperCase()
                          : t('Dark').toUpperCase()}
                      </Text>
                    </View>
                  </View>
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
            );
          })}
        </View>
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

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    container: {
      flex: 1,
      padding: 16,
      backgroundColor: colors.background,
    },
    header: {
      fontSize: 20,
      fontWeight: 'bold',
      marginBottom: 16,
      color: colors.text,
    },
    section: {
      marginBottom: 8,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      color: colors.textSecondary,
      marginTop: 8,
      marginBottom: 8,
    },
    themeItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 8,
      marginBottom: 8,
      backgroundColor: colors.surfaceVariant,
    },
    themeItemActive: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    swatchStrip: {
      flexDirection: 'row',
      marginRight: 12,
      borderRadius: 6,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    swatchCell: {
      width: 12,
      height: 48,
    },
    themeInfo: {
      flex: 1,
    },
    themeNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    themeName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    modeChip: {
      marginLeft: 8,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor: colors.surfaceVariant,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modeChipText: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.5,
      color: colors.textSecondary,
    },
    hasSettingsBadge: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 4,
    },
    selectedIndicator: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.accent,
      justifyContent: 'center',
      alignItems: 'center',
    },
    selectedText: {
      color: colors.onAccent,
      fontSize: 16,
      fontWeight: 'bold',
    },
    infoBox: {
      marginTop: 16,
      padding: 12,
      backgroundColor: colors.highlightBackground,
      borderRadius: 8,
    },
    infoText: {
      fontSize: 14,
      color: colors.text,
    },
  });

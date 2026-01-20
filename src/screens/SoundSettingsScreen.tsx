/**
 * SoundSettingsScreen - Configure notification sounds
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { pick, isErrorWithCode, errorCodes } from '@react-native-documents/picker';
import Slider from '@react-native-community/slider';
import RNFS from 'react-native-fs';
import { useTheme } from '../hooks/useTheme';
import { useSoundSettings } from '../hooks/useSoundSettings';
import { useT } from '../i18n/transifex';
import {
  SoundEventType,
  SOUND_EVENT_LABELS,
  SOUND_EVENT_CATEGORIES,
  DEFAULT_SOUNDS,
} from '../types/sound';

interface SoundSettingsScreenProps {
  visible: boolean;
  onClose: () => void;
}

export const SoundSettingsScreen: React.FC<SoundSettingsScreenProps> = ({
  visible,
  onClose,
}) => {
  const t = useT();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const {
    settings,
    schemes,
    activeScheme,
    isLoading,
    setEnabled,
    setMasterVolume,
    setPlayInForeground,
    setPlayInBackground,
    setActiveScheme,
    setEventEnabled,
    setCustomSound,
    resetEventToDefault,
    getEventConfig,
    previewSound,
    previewCustomSound,
    stopSound,
    resetAllToDefaults,
  } = useSoundSettings();

  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    'Messages': true,
    'Channel Events': false,
    'Connection': false,
    'Other': false,
  });

  const [isPickingSound, setIsPickingSound] = useState(false);
  const [pickingForEvent, setPickingForEvent] = useState<SoundEventType | null>(null);

  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category],
    }));
  }, []);

  const normalizeFileUri = useCallback((uri: string) => (
    uri.startsWith('file://') ? uri.slice(7) : uri
  ), []);

  const cleanupPickedCopy = useCallback(async (uri?: string) => {
    if (!uri) return;
    const path = normalizeFileUri(uri);
    try {
      const exists = await RNFS.exists(path);
      if (exists) {
        await RNFS.unlink(path);
      }
    } catch (cleanupError) {
      console.warn('[SoundSettingsScreen] Failed to clean up picked file:', cleanupError);
    }
  }, [normalizeFileUri]);

  const handlePickCustomSound = useCallback(async (eventType: SoundEventType) => {
    setIsPickingSound(true);
    setPickingForEvent(eventType);

    try {
      const [result] = await pick({
        type: ['audio/*'],
        copyTo: 'documentDirectory',
      });

      const fileUri = result?.fileCopyUri ?? result?.uri;
      const shouldCleanupCopy = Boolean(result?.fileCopyUri);

      if (fileUri) {
        // Preview the sound first
        await previewCustomSound(fileUri);

        // Ask for confirmation
        Alert.alert(
          t('Use this sound?'),
          t('Do you want to use this sound for {event}?').replace('{event}', SOUND_EVENT_LABELS[eventType]),
          [
            {
              text: t('Cancel'),
              style: 'cancel',
              onPress: async () => {
                await stopSound();
                if (shouldCleanupCopy) {
                  await cleanupPickedCopy(result?.fileCopyUri);
                }
              },
            },
            {
              text: t('Use'),
              onPress: async () => {
                await stopSound();
                await setCustomSound(eventType, normalizeFileUri(fileUri));
                if (shouldCleanupCopy) {
                  await cleanupPickedCopy(result?.fileCopyUri);
                }
              },
            },
          ]
        );
      }
    } catch (error: any) {
      if (!(isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED)) {
        console.error('[SoundSettingsScreen] Error picking sound:', error);
        Alert.alert(t('Error'), t('Failed to select sound file.'));
      }
    } finally {
      setIsPickingSound(false);
      setPickingForEvent(null);
    }
  }, [t, previewCustomSound, stopSound, setCustomSound, normalizeFileUri, cleanupPickedCopy]);

  const handleResetEvent = useCallback(async (eventType: SoundEventType) => {
    Alert.alert(
      t('Reset to Default'),
      t('Reset {event} sound to default?').replace('{event}', SOUND_EVENT_LABELS[eventType]),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Reset'),
          style: 'destructive',
          onPress: () => resetEventToDefault(eventType),
        },
      ]
    );
  }, [t, resetEventToDefault]);

  const handleResetAll = useCallback(() => {
    Alert.alert(
      t('Reset All Sounds'),
      t('This will reset all sound settings to defaults. Continue?'),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Reset All'),
          style: 'destructive',
          onPress: resetAllToDefaults,
        },
      ]
    );
  }, [t, resetAllToDefaults]);

  const renderEventRow = useCallback((eventType: SoundEventType) => {
    const config = getEventConfig(eventType);
    const label = SOUND_EVENT_LABELS[eventType];
    const defaultSound = DEFAULT_SOUNDS[eventType];
    const soundName = config.useCustom && config.customUri
      ? t('Custom sound')
      : defaultSound || t('No sound');

    return (
      <View key={eventType} style={styles.eventRow}>
        <View style={styles.eventInfo}>
          <Text style={styles.eventLabel}>{t(label)}</Text>
          <Text style={styles.eventSound} numberOfLines={1}>
            {soundName}
          </Text>
        </View>

        <View style={styles.eventActions}>
          {/* Enable/Disable toggle */}
          <Switch
            value={config.enabled}
            onValueChange={(value) => setEventEnabled(eventType, value)}
            trackColor={{ false: colors.border, true: colors.primaryLight || colors.primary }}
            thumbColor={config.enabled ? colors.primary : colors.textSecondary}
          />

          {/* Preview button */}
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => previewSound(eventType)}
            disabled={!config.enabled}
          >
            <Icon
              name="play"
              size={14}
              color={config.enabled ? colors.primary : colors.textSecondary}
            />
          </TouchableOpacity>

          {/* Pick custom sound */}
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => handlePickCustomSound(eventType)}
            disabled={isPickingSound}
          >
            <Icon
              name="folder-open"
              size={14}
              color={isPickingSound && pickingForEvent === eventType
                ? colors.textSecondary
                : colors.primary}
            />
          </TouchableOpacity>

          {/* Reset to default (only if custom) */}
          {config.useCustom && (
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => handleResetEvent(eventType)}
            >
              <Icon name="undo" size={14} color={colors.warning || colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }, [
    colors,
    styles,
    t,
    getEventConfig,
    setEventEnabled,
    previewSound,
    handlePickCustomSound,
    handleResetEvent,
    isPickingSound,
    pickingForEvent,
  ]);

  const renderCategory = useCallback((category: string, events: SoundEventType[]) => {
    const isExpanded = expandedCategories[category];

    return (
      <View key={category} style={styles.categoryContainer}>
        <TouchableOpacity
          style={styles.categoryHeader}
          onPress={() => toggleCategory(category)}
        >
          <Icon
            name={isExpanded ? 'chevron-down' : 'chevron-right'}
            size={12}
            color={colors.textSecondary}
            style={styles.categoryIcon}
          />
          <Text style={styles.categoryTitle}>{t(category)}</Text>
          <Text style={styles.categoryCount}>
            {events.filter(e => getEventConfig(e).enabled).length}/{events.length}
          </Text>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.categoryContent}>
            {events.map(renderEventRow)}
          </View>
        )}
      </View>
    );
  }, [
    colors,
    styles,
    t,
    expandedCategories,
    toggleCategory,
    getEventConfig,
    renderEventRow,
  ]);

  if (isLoading) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={[styles.container, styles.loadingContainer]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('Sound Settings')}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>{t('Close')}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {/* Global Enable */}
          <View style={styles.section}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>{t('Enable Sounds')}</Text>
                <Text style={styles.settingDescription}>
                  {t('Master switch for all notification sounds')}
                </Text>
              </View>
              <Switch
                value={settings.enabled}
                onValueChange={setEnabled}
                trackColor={{ false: colors.border, true: colors.primaryLight || colors.primary }}
                thumbColor={settings.enabled ? colors.primary : colors.textSecondary}
              />
            </View>
          </View>

          {settings.enabled && (
            <>
              {/* Master Volume */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('Master Volume')}</Text>
                <View style={styles.volumeContainer}>
                  <Icon name="volume-down" size={16} color={colors.textSecondary} />
                  <Slider
                    style={styles.volumeSlider}
                    minimumValue={0}
                    maximumValue={1}
                    value={settings.masterVolume}
                    onSlidingComplete={setMasterVolume}
                    minimumTrackTintColor={colors.primary}
                    maximumTrackTintColor={colors.border}
                    thumbTintColor={colors.primary}
                  />
                  <Icon name="volume-up" size={16} color={colors.textSecondary} />
                  <Text style={styles.volumeValue}>
                    {Math.round(settings.masterVolume * 100)}%
                  </Text>
                </View>
              </View>

              {/* Playback Options */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('Playback')}</Text>

                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>{t('Play in Foreground')}</Text>
                    <Text style={styles.settingDescription}>
                      {t('Play sounds when app is open')}
                    </Text>
                  </View>
                  <Switch
                    value={settings.playInForeground}
                    onValueChange={setPlayInForeground}
                    trackColor={{ false: colors.border, true: colors.primaryLight || colors.primary }}
                    thumbColor={settings.playInForeground ? colors.primary : colors.textSecondary}
                  />
                </View>

                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>{t('Play in Background')}</Text>
                    <Text style={styles.settingDescription}>
                      {t('Play sounds when app is minimized')}
                    </Text>
                  </View>
                  <Switch
                    value={settings.playInBackground}
                    onValueChange={setPlayInBackground}
                    trackColor={{ false: colors.border, true: colors.primaryLight || colors.primary }}
                    thumbColor={settings.playInBackground ? colors.primary : colors.textSecondary}
                  />
                </View>
              </View>

              {/* Sound Scheme */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('Sound Scheme')}</Text>
                <View style={styles.schemeList}>
                  {schemes.map(scheme => (
                    <TouchableOpacity
                      key={scheme.id}
                      style={[
                        styles.schemeItem,
                        activeScheme?.id === scheme.id && styles.schemeItemActive,
                      ]}
                      onPress={() => setActiveScheme(scheme.id)}
                    >
                      <View style={styles.schemeInfo}>
                        <Text style={[
                          styles.schemeName,
                          activeScheme?.id === scheme.id && styles.schemeNameActive,
                        ]}>
                          {t(scheme.name)}
                        </Text>
                        {scheme.description && (
                          <Text style={styles.schemeDescription}>
                            {t(scheme.description)}
                          </Text>
                        )}
                      </View>
                      {activeScheme?.id === scheme.id && (
                        <Icon name="check" size={16} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Event Sounds */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('Event Sounds')}</Text>
                {Object.entries(SOUND_EVENT_CATEGORIES).map(([category, events]) =>
                  renderCategory(category, events)
                )}
              </View>

              {/* Reset Button */}
              <View style={styles.section}>
                <TouchableOpacity
                  style={styles.resetButton}
                  onPress={handleResetAll}
                >
                  <Icon name="undo" size={14} color={colors.error || '#f44336'} />
                  <Text style={styles.resetButtonText}>
                    {t('Reset All to Defaults')}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Footer spacing */}
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    loadingContainer: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
    },
    closeButton: {
      padding: 8,
    },
    closeButtonText: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: '600',
    },
    content: {
      flex: 1,
    },
    section: {
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 12,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 8,
    },
    settingInfo: {
      flex: 1,
      marginRight: 12,
    },
    settingLabel: {
      fontSize: 16,
      color: colors.text,
      fontWeight: '500',
    },
    settingDescription: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    volumeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    volumeSlider: {
      flex: 1,
      marginHorizontal: 12,
    },
    volumeValue: {
      width: 45,
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'right',
    },
    schemeList: {
      gap: 8,
    },
    schemeItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 8,
      backgroundColor: colors.surface || colors.cardBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    schemeItemActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryLight || `${colors.primary}15`,
    },
    schemeInfo: {
      flex: 1,
    },
    schemeName: {
      fontSize: 15,
      color: colors.text,
      fontWeight: '500',
    },
    schemeNameActive: {
      color: colors.primary,
    },
    schemeDescription: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    categoryContainer: {
      marginBottom: 8,
      borderRadius: 8,
      backgroundColor: colors.surface || colors.cardBackground,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    categoryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
    },
    categoryIcon: {
      marginRight: 8,
    },
    categoryTitle: {
      flex: 1,
      fontSize: 15,
      color: colors.text,
      fontWeight: '500',
    },
    categoryCount: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    categoryContent: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    eventRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    eventInfo: {
      flex: 1,
      marginRight: 12,
    },
    eventLabel: {
      fontSize: 14,
      color: colors.text,
    },
    eventSound: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    eventActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    iconButton: {
      padding: 8,
      borderRadius: 4,
    },
    resetButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.error || '#f44336',
      gap: 8,
    },
    resetButtonText: {
      fontSize: 14,
      color: colors.error || '#f44336',
      fontWeight: '500',
    },
  });

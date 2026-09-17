/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * SoundSettingsScreen - Configure notification sounds
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { ModalSafeArea } from '../components/ModalSafeArea';
import {
  pick,
  isErrorWithCode,
  errorCodes,
} from '@react-native-documents/picker';
import SliderNative, { type SliderProps } from '@react-native-community/slider';
import type { ComponentType } from 'react';

// @react-native-community/slider 5.x ships class-component types that don't
// satisfy React 19's stricter JSX element typing; alias to a plain component type.
const Slider = SliderNative as unknown as ComponentType<SliderProps>;
import RNFS from 'react-native-fs';
import { useTheme } from '../hooks/useTheme';
import { useSoundSettings } from '../hooks/useSoundSettings';
import { useT } from '../i18n/localization';
import {
  SoundEventType,
  SOUND_EVENT_LABELS,
  SOUND_EVENT_CATEGORIES,
  DEFAULT_SOUNDS,
  type CustomSound,
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
  const footerSpacerStyle = { height: 40 };

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
    customSounds = [],
    addCustomSound,
    renameCustomSound,
    removeCustomSound,
  } = useSoundSettings();

  const [expandedCategories, setExpandedCategories] = useState<
    Record<string, boolean>
  >({
    Messages: true,
    'Channel Events': false,
    Connection: false,
    Other: false,
  });

  const [isPickingSound, setIsPickingSound] = useState(false);
  const [pickingForEvent, setPickingForEvent] = useState<SoundEventType | null>(
    null,
  );

  // Naming modal state for custom sounds. `editingId` is set when renaming an
  // existing entry; `pendingUri` holds the freshly picked file when adding.
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [pendingUri, setPendingUri] = useState<string | null>(null);
  const [pendingCleanupUri, setPendingCleanupUri] = useState<string | null>(
    null,
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [isSavingCustomSound, setIsSavingCustomSound] = useState(false);

  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category],
    }));
  }, []);

  const normalizeFileUri = useCallback(
    (uri: string) => (uri.startsWith('file://') ? uri.slice(7) : uri),
    [],
  );

  const cleanupPickedCopy = useCallback(
    async (uri?: string) => {
      if (!uri) return;
      const path = normalizeFileUri(uri);
      try {
        const exists = await RNFS.exists(path);
        if (exists) {
          await RNFS.unlink(path);
        }
      } catch (cleanupError) {
        console.warn(
          '[SoundSettingsScreen] Failed to clean up picked file:',
          cleanupError,
        );
      }
    },
    [normalizeFileUri],
  );

  const handlePickCustomSound = useCallback(
    async (eventType: SoundEventType) => {
      setIsPickingSound(true);
      setPickingForEvent(eventType);

      try {
        const [result] = await pick({
          type: ['audio/*'],
          copyTo: 'documentDirectory',
        });

        const pickedResult = result as typeof result & { fileCopyUri?: string };
        const fileUri = pickedResult?.fileCopyUri ?? pickedResult?.uri;
        const shouldCleanupCopy = Boolean(pickedResult?.fileCopyUri);

        if (fileUri) {
          // Preview the sound first
          await previewCustomSound(fileUri);

          // Ask for confirmation
          const handleDismiss = () => {
            stopSound();
            if (shouldCleanupCopy) {
              cleanupPickedCopy(pickedResult?.fileCopyUri).catch(() => null);
            }
          };

          Alert.alert(
            t('Use this sound?'),
            t('Do you want to use this sound for {event}?').replace(
              '{event}',
              SOUND_EVENT_LABELS[eventType],
            ),
            [
              {
                text: t('Cancel'),
                style: 'cancel',
                onPress: handleDismiss,
              },
              {
                text: t('Use'),
                onPress: async () => {
                  await stopSound();
                  await setCustomSound(eventType, normalizeFileUri(fileUri));
                  if (shouldCleanupCopy) {
                    await cleanupPickedCopy(pickedResult?.fileCopyUri);
                  }
                },
              },
            ],
            { onDismiss: handleDismiss },
          );
        }
      } catch (error: any) {
        if (!(
          isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED
        )) {
          console.error('[SoundSettingsScreen] Error picking sound:', error);
          Alert.alert(t('Error'), t('Failed to select sound file.'));
        }
      } finally {
        setIsPickingSound(false);
        setPickingForEvent(null);
      }
    },
    [
      t,
      previewCustomSound,
      stopSound,
      setCustomSound,
      normalizeFileUri,
      cleanupPickedCopy,
    ],
  );

  const handleResetEvent = useCallback(
    async (eventType: SoundEventType) => {
      Alert.alert(
        t('Reset to Default'),
        t('Reset {event} sound to default?').replace(
          '{event}',
          SOUND_EVENT_LABELS[eventType],
        ),
        [
          { text: t('Cancel'), style: 'cancel' },
          {
            text: t('Reset'),
            style: 'destructive',
            onPress: () => resetEventToDefault(eventType),
          },
        ],
      );
    },
    [t, resetEventToDefault],
  );

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
      ],
    );
  }, [t, resetAllToDefaults]);

  const closeNameModal = useCallback(() => {
    setNameModalVisible(false);
    setPendingUri(null);
    setPendingCleanupUri(null);
    setEditingId(null);
    setNameInput('');
    setIsSavingCustomSound(false);
  }, []);

  const handleAddCustomSound = useCallback(async () => {
    if (isPickingSound) return;
    setIsPickingSound(true);

    try {
      const [result] = await pick({
        type: ['audio/*'],
        copyTo: 'documentDirectory',
      });

      const pickedResult = result as typeof result & { fileCopyUri?: string };
      const fileUri = pickedResult?.fileCopyUri ?? pickedResult?.uri;
      const cleanupUri = pickedResult?.fileCopyUri;

      if (fileUri) {
        setPendingUri(normalizeFileUri(fileUri));
        setPendingCleanupUri(cleanupUri ?? null);
        setEditingId(null);
        setNameInput('');
        setNameModalVisible(true);
      }
    } catch (error: any) {
      if (!(
        isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED
      )) {
        console.error(
          '[SoundSettingsScreen] Error picking custom sound:',
          error,
        );
        Alert.alert(t('Error'), t('Failed to select sound file.'));
      }
    } finally {
      setIsPickingSound(false);
    }
  }, [isPickingSound, normalizeFileUri, t]);

  const handleRenameCustomSound = useCallback((sound: CustomSound) => {
    setEditingId(sound.id);
    setNameInput(sound.name);
    setPendingUri(null);
    setPendingCleanupUri(null);
    setNameModalVisible(true);
  }, []);

  const handleSaveCustomSoundName = useCallback(async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;

    setIsSavingCustomSound(true);
    try {
      if (editingId) {
        await renameCustomSound(editingId, trimmed);
      } else if (pendingUri) {
        await addCustomSound(trimmed, pendingUri);
        if (pendingCleanupUri) {
          await cleanupPickedCopy(pendingCleanupUri);
        }
      }
      closeNameModal();
    } catch (error: any) {
      setIsSavingCustomSound(false);
      const message =
        error && typeof error.message === 'string'
          ? error.message
          : t('Failed to save custom sound.');
      Alert.alert(t('Error'), message);
    }
  }, [
    nameInput,
    editingId,
    pendingUri,
    pendingCleanupUri,
    renameCustomSound,
    addCustomSound,
    cleanupPickedCopy,
    closeNameModal,
    t,
  ]);

  const handleCancelNameModal = useCallback(() => {
    if (pendingCleanupUri) {
      cleanupPickedCopy(pendingCleanupUri).catch(() => null);
    }
    closeNameModal();
  }, [pendingCleanupUri, cleanupPickedCopy, closeNameModal]);

  const handleDeleteCustomSound = useCallback(
    (sound: CustomSound) => {
      Alert.alert(
        t('Delete Sound'),
        t('Delete "{name}"?').replace('{name}', sound.name),
        [
          { text: t('Cancel'), style: 'cancel' },
          {
            text: t('Delete'),
            style: 'destructive',
            onPress: () => {
              removeCustomSound(sound.id).catch(error => {
                console.error(
                  '[SoundSettingsScreen] Error removing custom sound:',
                  error,
                );
              });
            },
          },
        ],
      );
    },
    [t, removeCustomSound],
  );

  const renderEventRow = useCallback(
    (eventType: SoundEventType) => {
      const config = getEventConfig(eventType);
      const label = SOUND_EVENT_LABELS[eventType];
      const defaultSound = DEFAULT_SOUNDS[eventType];
      const soundName =
        config.useCustom && config.customUri
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
              onValueChange={value => setEventEnabled(eventType, value)}
              trackColor={{
                false: colors.border,
                true: colors.primaryLight || colors.primary,
              }}
              thumbColor={
                config.enabled ? colors.primary : colors.textSecondary
              }
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
                color={
                  isPickingSound && pickingForEvent === eventType
                    ? colors.textSecondary
                    : colors.primary
                }
              />
            </TouchableOpacity>

            {/* Reset to default (only if custom) */}
            {config.useCustom && (
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => handleResetEvent(eventType)}
              >
                <Icon
                  name="undo"
                  size={14}
                  color={colors.warning || colors.primary}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>
      );
    },
    [
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
    ],
  );

  const renderCategory = useCallback(
    (category: string, events: SoundEventType[]) => {
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
              {events.filter(e => getEventConfig(e).enabled).length}/
              {events.length}
            </Text>
          </TouchableOpacity>

          {isExpanded && (
            <View style={styles.categoryContent}>
              {events.map(renderEventRow)}
            </View>
          )}
        </View>
      );
    },
    [
      colors,
      styles,
      t,
      expandedCategories,
      toggleCategory,
      getEventConfig,
      renderEventRow,
    ],
  );

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
      statusBarTranslucent
      navigationBarTranslucent
    >
      <ModalSafeArea style={styles.container}>
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
                trackColor={{
                  false: colors.border,
                  true: colors.primaryLight || colors.primary,
                }}
                thumbColor={
                  settings.enabled ? colors.primary : colors.textSecondary
                }
              />
            </View>
          </View>

          {settings.enabled && (
            <>
              {/* Master Volume */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('Master Volume')}</Text>
                <View style={styles.volumeContainer}>
                  <Icon
                    name="volume-down"
                    size={16}
                    color={colors.textSecondary}
                  />
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
                  <Icon
                    name="volume-up"
                    size={16}
                    color={colors.textSecondary}
                  />
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
                    <Text style={styles.settingLabel}>
                      {t('Play in Foreground')}
                    </Text>
                    <Text style={styles.settingDescription}>
                      {t('Play sounds when app is open')}
                    </Text>
                  </View>
                  <Switch
                    value={settings.playInForeground}
                    onValueChange={setPlayInForeground}
                    trackColor={{
                      false: colors.border,
                      true: colors.primaryLight || colors.primary,
                    }}
                    thumbColor={
                      settings.playInForeground
                        ? colors.primary
                        : colors.textSecondary
                    }
                  />
                </View>

                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>
                      {t('Play in Background')}
                    </Text>
                    <Text style={styles.settingDescription}>
                      {t('Play sounds when app is minimized')}
                    </Text>
                  </View>
                  <Switch
                    value={settings.playInBackground}
                    onValueChange={setPlayInBackground}
                    trackColor={{
                      false: colors.border,
                      true: colors.primaryLight || colors.primary,
                    }}
                    thumbColor={
                      settings.playInBackground
                        ? colors.primary
                        : colors.textSecondary
                    }
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
                        activeScheme?.id === scheme.id &&
                          styles.schemeItemActive,
                      ]}
                      onPress={() => setActiveScheme(scheme.id)}
                    >
                      <View style={styles.schemeInfo}>
                        <Text
                          style={[
                            styles.schemeName,
                            activeScheme?.id === scheme.id &&
                              styles.schemeNameActive,
                          ]}
                        >
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
                {Object.entries(SOUND_EVENT_CATEGORIES).map(
                  ([category, events]) => renderCategory(category, events),
                )}
              </View>

              {/* Custom Sounds */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('Custom Sounds')}</Text>
                <Text style={styles.customSoundsHelp}>
                  {t(
                    "Add your own sounds, name them, and play them from scripts with api.playSound('name').",
                  )}
                </Text>

                {customSounds.length > 0 && (
                  <View style={styles.customSoundList}>
                    {customSounds.map(sound => (
                      <View key={sound.id} style={styles.customSoundRow}>
                        <TouchableOpacity
                          style={styles.customSoundInfo}
                          onPress={() => handleRenameCustomSound(sound)}
                        >
                          <Text
                            style={styles.customSoundName}
                            numberOfLines={1}
                          >
                            {sound.name}
                          </Text>
                        </TouchableOpacity>

                        <View style={styles.customSoundActions}>
                          <TouchableOpacity
                            style={styles.iconButton}
                            onPress={() => previewCustomSound(sound.uri)}
                          >
                            <Icon
                              name="play"
                              size={14}
                              color={colors.primary}
                            />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.iconButton}
                            onPress={() => handleDeleteCustomSound(sound)}
                          >
                            <Icon
                              name="trash"
                              size={14}
                              color={colors.error || '#f44336'}
                            />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                <TouchableOpacity
                  style={styles.addCustomSoundButton}
                  onPress={handleAddCustomSound}
                  disabled={isPickingSound}
                >
                  <Icon name="plus" size={14} color={colors.primary} />
                  <Text style={styles.addCustomSoundButtonText}>
                    {t('Add custom sound')}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Reset Button */}
              <View style={styles.section}>
                <TouchableOpacity
                  style={styles.resetButton}
                  onPress={handleResetAll}
                >
                  <Icon
                    name="undo"
                    size={14}
                    color={colors.error || '#f44336'}
                  />
                  <Text style={styles.resetButtonText}>
                    {t('Reset All to Defaults')}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Footer spacing */}
          <View style={footerSpacerStyle} />
        </ScrollView>

        {/* Custom sound naming modal */}
        <Modal
          visible={nameModalVisible}
          transparent
          animationType="fade"
          onRequestClose={handleCancelNameModal}
          statusBarTranslucent
        >
          <View style={styles.nameModalOverlay}>
            <View style={styles.nameModalCard}>
              <Text style={styles.nameModalTitle}>
                {editingId ? t('Rename Sound') : t('Name This Sound')}
              </Text>
              <TextInput
                style={styles.nameModalInput}
                value={nameInput}
                onChangeText={setNameInput}
                placeholder={t('Sound name')}
                placeholderTextColor={colors.textSecondary}
                autoFocus
                maxLength={64}
              />
              <View style={styles.nameModalActions}>
                <TouchableOpacity
                  style={styles.nameModalCancelButton}
                  onPress={handleCancelNameModal}
                  disabled={isSavingCustomSound}
                >
                  <Text style={styles.nameModalCancelText}>{t('Cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.nameModalSaveButton}
                  onPress={handleSaveCustomSoundName}
                  disabled={isSavingCustomSound || !nameInput.trim()}
                >
                  {isSavingCustomSound ? (
                    <ActivityIndicator size="small" color={colors.background} />
                  ) : (
                    <Text style={styles.nameModalSaveText}>{t('Save')}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ModalSafeArea>
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
    customSoundsHelp: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 12,
      lineHeight: 18,
    },
    customSoundList: {
      gap: 8,
      marginBottom: 12,
    },
    customSoundRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 8,
      backgroundColor: colors.surface || colors.cardBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    customSoundInfo: {
      flex: 1,
      marginRight: 12,
    },
    customSoundName: {
      fontSize: 15,
      color: colors.text,
      fontWeight: '500',
    },
    customSoundActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    addCustomSoundButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.primary,
      gap: 8,
    },
    addCustomSoundButtonText: {
      fontSize: 14,
      color: colors.primary,
      fontWeight: '500',
    },
    nameModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    nameModalCard: {
      width: '100%',
      maxWidth: 400,
      borderRadius: 12,
      padding: 20,
      backgroundColor: colors.surface || colors.cardBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    nameModalTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
    nameModalInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: colors.text,
      backgroundColor: colors.background,
      marginBottom: 20,
    },
    nameModalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 12,
    },
    nameModalCancelButton: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 8,
    },
    nameModalCancelText: {
      fontSize: 15,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    nameModalSaveButton: {
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 8,
      backgroundColor: colors.primary,
      minWidth: 80,
      alignItems: 'center',
      justifyContent: 'center',
    },
    nameModalSaveText: {
      fontSize: 15,
      color: colors.background,
      fontWeight: '600',
    },
  });

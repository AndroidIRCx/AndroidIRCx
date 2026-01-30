/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, TextInput, StyleSheet } from 'react-native';
import { SettingItem } from '../SettingItem';
import { useT } from '../../../i18n/transifex';
import { SettingItem as SettingItemType, SettingIcon } from '../../../types/settings';
import { settingsService } from '../../../services/SettingsService';
import { awayService } from '../../../services/AwayService';
import { formatIRCTextAsComponent, stripIRCFormatting } from '../../../utils/IRCFormatter';
import { ColorPickerModal } from '../../ColorPickerModal';

interface AwaySectionProps {
  colors: {
    text: string;
    textSecondary: string;
    primary: string;
    surface: string;
    border: string;
    background: string;
  };
  styles: {
    settingItem: any;
    settingContent: any;
    settingTitleRow: any;
    settingTitle: any;
    settingDescription: any;
    disabledItem: any;
    disabledText: any;
    chevron: any;
    input?: any;
    disabledInput?: any;
  };
  settingIcons: Record<string, SettingIcon | undefined>;
  onClose?: () => void;
}

export const AwaySection: React.FC<AwaySectionProps> = ({
  colors,
  styles,
  settingIcons,
  onClose,
}) => {
  const t = useT();
  const tags = 'screen:settings,file:AwaySection.tsx,feature:settings';
  const [activeTab, setActiveTab] = useState<'system' | 'options'>('system');
  const [showPresets, setShowPresets] = useState(false);
  const [showAutoAnswerPresets, setShowAutoAnswerPresets] = useState(false);

  const [awayNickPattern, setAwayNickPattern] = useState('<me>^away');
  const [awayNotifyMentions, setAwayNotifyMentions] = useState(false);
  const [awayDeopOnChannels, setAwayDeopOnChannels] = useState(false);
  const [awayAnnounceEnabled, setAwayAnnounceEnabled] = useState(false);
  const [awayAutoAnswerEnabled, setAwayAutoAnswerEnabled] = useState(false);
  const [awayDisableSounds, setAwayDisableSounds] = useState(false);
  const [awayMultiServer, setAwayMultiServer] = useState(false);
  const [awayPresets, setAwayPresets] = useState<string[]>([]);
  const [awaySelectedPreset, setAwaySelectedPreset] = useState('');
  const [awayDefaultReason, setAwayDefaultReason] = useState('');

  const [awayAutoAnswerMessage, setAwayAutoAnswerMessage] = useState('Away');
  const [awayAutoAnswerMessages, setAwayAutoAnswerMessages] = useState<string[]>([]);
  const [awayAnnounceEveryMin, setAwayAnnounceEveryMin] = useState('5');
  const [awayAnnounceOnlyOn, setAwayAnnounceOnlyOn] = useState('');
  const [awayAnnounceExcludeOn, setAwayAnnounceExcludeOn] = useState('');
  const [awayTextAway, setAwayTextAway] = useState('away');
  const [awayTextReturn, setAwayTextReturn] = useState('back');
  const [autoAwayEnabled, setAutoAwayEnabled] = useState(false);
  const [autoAwayMinutes, setAutoAwayMinutes] = useState('0');
  const [autoAwayReason, setAutoAwayReason] = useState('');
  const [minimizeToTray, setMinimizeToTray] = useState(false);

  const [newPreset, setNewPreset] = useState('');
  const [newAutoAnswerPreset, setNewAutoAnswerPreset] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [colorInsertTarget, setColorInsertTarget] = useState<'away' | 'auto' | null>(null);
  const [editingPresetIndex, setEditingPresetIndex] = useState<number | null>(null);
  const [editingAutoAnswerIndex, setEditingAutoAnswerIndex] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      const storedNickPattern = await settingsService.getSetting('awayNickPattern', '<me>^away');
      const normalizedNickPattern = storedNickPattern === '(<me>^away)' ? '<me>^away' : storedNickPattern;
      setAwayNickPattern(normalizedNickPattern);
      if (normalizedNickPattern !== storedNickPattern) {
        await settingsService.setSetting('awayNickPattern', normalizedNickPattern);
      }
      setAwayNotifyMentions(await settingsService.getSetting('awayNotifyMentions', false));
      setAwayDeopOnChannels(await settingsService.getSetting('awayDeopOnChannels', false));
      setAwayAnnounceEnabled(await settingsService.getSetting('awayAnnounceEnabled', false));
      setAwayAutoAnswerEnabled(await settingsService.getSetting('awayAutoAnswerEnabled', false));
      setAwayDisableSounds(await settingsService.getSetting('awayDisableSounds', false));
      setAwayMultiServer(await settingsService.getSetting('awayMultiServer', false));
      setAwayPresets(await settingsService.getSetting('awayPresets', []));
      setAwaySelectedPreset(await settingsService.getSetting('awaySelectedPreset', ''));
      setAwayDefaultReason(await settingsService.getSetting('awayDefaultReason', ''));

      setAwayAutoAnswerMessage(await settingsService.getSetting('awayAutoAnswerMessage', 'Away'));
      setAwayAutoAnswerMessages(await settingsService.getSetting('awayAutoAnswerMessages', []));
      setAwayAnnounceEveryMin(String(await settingsService.getSetting('awayAnnounceEveryMin', 5)));
      setAwayAnnounceOnlyOn(await settingsService.getSetting('awayAnnounceOnlyOn', ''));
      setAwayAnnounceExcludeOn(await settingsService.getSetting('awayAnnounceExcludeOn', ''));
      setAwayTextAway(await settingsService.getSetting('awayTextAway', 'away'));
      setAwayTextReturn(await settingsService.getSetting('awayTextReturn', 'back'));
      setAutoAwayEnabled(await settingsService.getSetting('autoAwayEnabled', false));
      setAutoAwayMinutes(String(await settingsService.getSetting('autoAwayMinutes', 0)));
      setAutoAwayReason(await settingsService.getSetting('autoAwayReason', ''));
      setMinimizeToTray(await settingsService.getSetting('minimizeToTray', false));
    };
    load();
  }, []);

  const stylesLocal = useMemo(() => StyleSheet.create({
    tabRow: {
      flexDirection: 'row',
      marginBottom: 8,
      borderRadius: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    tabButton: {
      flex: 1,
      paddingVertical: 8,
      alignItems: 'center',
    },
    tabButtonActive: {
      backgroundColor: colors.primary,
    },
    tabText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '600',
    },
    tabTextActive: {
      color: '#fff',
    },
    modalContainer: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      width: '100%',
      maxWidth: 480,
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 12,
    },
    modalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 10,
    },
    modalInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      color: colors.text,
    },
    presetItem: {
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    presetRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    presetText: {
      color: colors.text,
    },
    presetTextMuted: {
      color: colors.textSecondary,
      fontSize: 12,
    },
    removeButton: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
      backgroundColor: colors.border,
    },
    removeButtonText: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '600',
    },
    selectButton: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    selectButtonActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    selectButtonText: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '600',
    },
    selectButtonTextActive: {
      color: '#fff',
    },
    editButton: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    editButtonText: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '600',
    },
    modalButtonRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 12,
      marginTop: 12,
    },
    modalButton: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: colors.primary,
    },
    modalButtonSecondary: {
      backgroundColor: colors.border,
    },
    modalButtonText: {
      color: '#fff',
      fontWeight: '600',
    },
    modalButtonTextSecondary: {
      color: colors.text,
    },
  }), [colors]);

  const handleSaveList = async (key: string, list: string[]) => {
    await settingsService.setSetting(key, list);
  };

  const renderPresetPreview = (preset: string) => {
    const plain = stripIRCFormatting(preset).trim();
    const fallback = plain.length > 0 ? plain : preset;
    return (
      <Text style={stylesLocal.presetText}>
        {formatIRCTextAsComponent(preset, stylesLocal.presetText) || fallback}
      </Text>
    );
  };

  const handleInsertColor = (code: string) => {
    if (colorInsertTarget === 'auto') {
      setNewAutoAnswerPreset((prev) => `${prev}${code}`);
    } else {
      setNewPreset((prev) => `${prev}${code}`);
    }
    setShowColorPicker(false);
    setColorInsertTarget(null);
  };

  const awayItems: SettingItemType[] = useMemo(() => [
    {
      id: 'away-nick-pattern',
      title: t('Change nick to pattern', { _tags: tags }),
      description: t('Example: <me>^away', { _tags: tags }),
      type: 'input',
      value: awayNickPattern,
      onValueChange: async (value) => {
        const next = String(value || '');
        setAwayNickPattern(next);
        await settingsService.setSetting('awayNickPattern', next);
      },
    },
    {
      id: 'away-notify-mentions',
      title: t('Notify away if nick is mentioned', { _tags: tags }),
      type: 'switch',
      value: awayNotifyMentions,
      onValueChange: async (value) => {
        const next = Boolean(value);
        setAwayNotifyMentions(next);
        await settingsService.setSetting('awayNotifyMentions', next);
      },
    },
    {
      id: 'away-deop',
      title: t('DeOp on channels', { _tags: tags }),
      type: 'switch',
      value: awayDeopOnChannels,
      onValueChange: async (value) => {
        const next = Boolean(value);
        setAwayDeopOnChannels(next);
        await settingsService.setSetting('awayDeopOnChannels', next);
      },
    },
    {
      id: 'away-announce',
      title: t('Announce away status', { _tags: tags }),
      type: 'switch',
      value: awayAnnounceEnabled,
      onValueChange: async (value) => {
        const next = Boolean(value);
        setAwayAnnounceEnabled(next);
        await settingsService.setSetting('awayAnnounceEnabled', next);
      },
    },
    {
      id: 'away-auto-answer',
      title: t('Auto-answer', { _tags: tags }),
      type: 'switch',
      value: awayAutoAnswerEnabled,
      onValueChange: async (value) => {
        const next = Boolean(value);
        setAwayAutoAnswerEnabled(next);
        await settingsService.setSetting('awayAutoAnswerEnabled', next);
      },
    },
    {
      id: 'away-disable-sounds',
      title: t('Disable sounds when away', { _tags: tags }),
      type: 'switch',
      value: awayDisableSounds,
      onValueChange: async (value) => {
        const next = Boolean(value);
        setAwayDisableSounds(next);
        await settingsService.setSetting('awayDisableSounds', next);
      },
    },
    {
      id: 'away-multiserver',
      title: t('Multiserver', { _tags: tags }),
      description: t('Apply away to all connected networks', { _tags: tags }),
      type: 'switch',
      value: awayMultiServer,
      onValueChange: async (value) => {
        const next = Boolean(value);
        setAwayMultiServer(next);
        await settingsService.setSetting('awayMultiServer', next);
      },
    },
    {
      id: 'away-presets',
      title: t('Away presets', { _tags: tags }),
      description: t('{count} presets', { count: awayPresets.length, _tags: tags }),
      type: 'button',
      onPress: () => setShowPresets(true),
    },
    {
      id: 'away-default-reason',
      title: t('Default away reason', { _tags: tags }),
      type: 'input',
      value: awayDefaultReason,
      onValueChange: async (value) => {
        const next = String(value || '');
        setAwayDefaultReason(next);
        await settingsService.setSetting('awayDefaultReason', next);
      },
    },
    {
      id: 'away-now',
      title: t('Go Away Now', { _tags: tags }),
      description: t('Send AWAY with default reason', { _tags: tags }),
      type: 'button',
      onPress: () => {
        const reason = (awaySelectedPreset || awayDefaultReason).trim();
        awayService.setAway(reason);
        if (onClose) {
          onClose();
        }
      },
    },
    {
      id: 'away-back',
      title: t('Return (Back)', { _tags: tags }),
      description: t('Clear AWAY status', { _tags: tags }),
      type: 'button',
      onPress: () => {
        awayService.clearAway();
        if (onClose) {
          onClose();
        }
      },
    },
  ], [
    awayNickPattern,
    awayNotifyMentions,
    awayDeopOnChannels,
    awayAnnounceEnabled,
    awayAutoAnswerEnabled,
    awayDisableSounds,
    awayMultiServer,
    awayPresets.length,
    awaySelectedPreset,
    awayDefaultReason,
    autoAwayReason,
    t,
    tags,
  ]);

  const optionItems: SettingItemType[] = useMemo(() => [
    {
      id: 'away-auto-answer-message',
      title: t('Auto-answer message', { _tags: tags }),
      type: 'input',
      value: awayAutoAnswerMessage,
      onValueChange: async (value) => {
        const next = String(value || '');
        setAwayAutoAnswerMessage(next);
        await settingsService.setSetting('awayAutoAnswerMessage', next);
      },
    },
    {
      id: 'away-auto-answer-presets',
      title: t('Auto-answer presets', { _tags: tags }),
      description: t('{count} messages', { count: awayAutoAnswerMessages.length, _tags: tags }),
      type: 'button',
      onPress: () => setShowAutoAnswerPresets(true),
    },
    {
      id: 'away-announce-every',
      title: t('Announce every (min.)', { _tags: tags }),
      type: 'input',
      value: awayAnnounceEveryMin,
      onValueChange: async (value) => {
        const next = String(value || '');
        setAwayAnnounceEveryMin(next);
        const num = parseInt(next, 10);
        if (!Number.isNaN(num)) {
          await settingsService.setSetting('awayAnnounceEveryMin', num);
        }
      },
    },
    {
      id: 'away-announce-only',
      title: t('Announce only on channels', { _tags: tags }),
      type: 'input',
      value: awayAnnounceOnlyOn,
      onValueChange: async (value) => {
        const next = String(value || '');
        setAwayAnnounceOnlyOn(next);
        await settingsService.setSetting('awayAnnounceOnlyOn', next);
      },
    },
    {
      id: 'away-announce-exclude',
      title: t('Do not announce on channels', { _tags: tags }),
      type: 'input',
      value: awayAnnounceExcludeOn,
      onValueChange: async (value) => {
        const next = String(value || '');
        setAwayAnnounceExcludeOn(next);
        await settingsService.setSetting('awayAnnounceExcludeOn', next);
      },
    },
    {
      id: 'away-text-away',
      title: t('Away text', { _tags: tags }),
      type: 'input',
      value: awayTextAway,
      onValueChange: async (value) => {
        const next = String(value || '');
        setAwayTextAway(next);
        await settingsService.setSetting('awayTextAway', next);
      },
    },
    {
      id: 'away-text-return',
      title: t('Return text', { _tags: tags }),
      type: 'input',
      value: awayTextReturn,
      onValueChange: async (value) => {
        const next = String(value || '');
        setAwayTextReturn(next);
        await settingsService.setSetting('awayTextReturn', next);
      },
    },
    {
      id: 'auto-away-enabled',
      title: t('Auto-away enabled', { _tags: tags }),
      type: 'switch',
      value: autoAwayEnabled,
      onValueChange: async (value) => {
        const next = Boolean(value);
        setAutoAwayEnabled(next);
        await settingsService.setSetting('autoAwayEnabled', next);
      },
    },
    {
      id: 'auto-away-minutes',
      title: t('Auto-away minutes', { _tags: tags }),
      type: 'input',
      value: autoAwayMinutes,
      onValueChange: async (value) => {
        const next = String(value || '');
        setAutoAwayMinutes(next);
        const num = parseInt(next, 10);
        if (!Number.isNaN(num)) {
          await settingsService.setSetting('autoAwayMinutes', num);
        }
      },
    },
    {
      id: 'auto-away-reason',
      title: t('Auto-away reason', { _tags: tags }),
      type: 'input',
      value: autoAwayReason,
      onValueChange: async (value) => {
        const next = String(value || '');
        setAutoAwayReason(next);
        await settingsService.setSetting('autoAwayReason', next);
      },
    },
    {
      id: 'minimize-to-tray',
      title: t('Minimize to systray', { _tags: tags }),
      type: 'switch',
      value: minimizeToTray,
      onValueChange: async (value) => {
        const next = Boolean(value);
        setMinimizeToTray(next);
        await settingsService.setSetting('minimizeToTray', next);
      },
    },
  ], [
    awayAutoAnswerMessage,
    awayAutoAnswerMessages.length,
    awayAnnounceEveryMin,
    awayAnnounceOnlyOn,
    awayAnnounceExcludeOn,
    awayTextAway,
    awayTextReturn,
    autoAwayEnabled,
    autoAwayMinutes,
    autoAwayReason,
    minimizeToTray,
    t,
    tags,
  ]);

  const renderList = (items: SettingItemType[]) => (
    <View>
      {items.map((item) => (
        <SettingItem
          key={item.id}
          item={item}
          icon={settingIcons[item.id]}
          colors={colors}
          styles={styles}
        />
      ))}
    </View>
  );

  return (
    <View>
      <View style={stylesLocal.tabRow}>
        <TouchableOpacity
          style={[stylesLocal.tabButton, activeTab === 'system' && stylesLocal.tabButtonActive]}
          onPress={() => setActiveTab('system')}
        >
          <Text style={[stylesLocal.tabText, activeTab === 'system' && stylesLocal.tabTextActive]}>
            {t('Away system', { _tags: tags })}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[stylesLocal.tabButton, activeTab === 'options' && stylesLocal.tabButtonActive]}
          onPress={() => setActiveTab('options')}
        >
          <Text style={[stylesLocal.tabText, activeTab === 'options' && stylesLocal.tabTextActive]}>
            {t('Options', { _tags: tags })}
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'system' ? renderList(awayItems) : renderList(optionItems)}

      <Modal visible={showPresets} transparent animationType="fade" onRequestClose={() => setShowPresets(false)}>
        <View style={stylesLocal.modalContainer}>
          <View style={stylesLocal.modalContent}>
            <Text style={stylesLocal.modalTitle}>{t('Away presets', { _tags: tags })}</Text>
            <View style={stylesLocal.modalRow}>
              <TextInput
                style={stylesLocal.modalInput}
                placeholder={t('Add preset', { _tags: tags })}
                placeholderTextColor={colors.textSecondary}
                value={newPreset}
                onChangeText={setNewPreset}
              />
              <TouchableOpacity
                style={[stylesLocal.modalButton, stylesLocal.modalButtonSecondary]}
                onPress={() => {
                  setColorInsertTarget('away');
                  setShowColorPicker(true);
                }}>
                <Text style={stylesLocal.modalButtonTextSecondary}>{t('Colors', { _tags: tags })}</Text>
              </TouchableOpacity>
              {editingPresetIndex !== null && (
                <TouchableOpacity
                  style={[stylesLocal.modalButton, stylesLocal.modalButtonSecondary]}
                  onPress={() => {
                    setEditingPresetIndex(null);
                    setNewPreset('');
                  }}>
                  <Text style={stylesLocal.modalButtonTextSecondary}>{t('Cancel', { _tags: tags })}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={stylesLocal.modalButton}
                onPress={async () => {
                  const next = newPreset.trim();
                  if (!next) return;
                  let updated = [...awayPresets];
                  if (editingPresetIndex !== null && editingPresetIndex >= 0 && editingPresetIndex < updated.length) {
                    const prevValue = updated[editingPresetIndex];
                    updated[editingPresetIndex] = next;
                    if (awaySelectedPreset === prevValue) {
                      setAwaySelectedPreset(next);
                      await settingsService.setSetting('awaySelectedPreset', next);
                    }
                    if (awayDefaultReason === prevValue) {
                      setAwayDefaultReason(next);
                      await settingsService.setSetting('awayDefaultReason', next);
                    }
                    if (autoAwayReason === prevValue) {
                      setAutoAwayReason(next);
                      await settingsService.setSetting('autoAwayReason', next);
                    }
                  } else {
                    updated.push(next);
                  }
                  setAwayPresets(updated);
                  setNewPreset('');
                  setEditingPresetIndex(null);
                  await handleSaveList('awayPresets', updated);
                }}>
                <Text style={stylesLocal.modalButtonText}>
                  {editingPresetIndex !== null ? t('Save', { _tags: tags }) : t('Add', { _tags: tags })}
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 260 }}>
              {awayPresets.map((preset, idx) => (
                <View
                  key={`${preset}-${idx}`}
                  style={stylesLocal.presetItem}>
                  <View style={stylesLocal.presetRow}>
                    <View style={{ flex: 1 }}>
                      {renderPresetPreview(preset)}
                      {stripIRCFormatting(preset) !== preset && (
                        <Text style={stylesLocal.presetTextMuted}>
                          {stripIRCFormatting(preset)}
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity
                      style={[
                        stylesLocal.selectButton,
                        awaySelectedPreset === preset && stylesLocal.selectButtonActive,
                      ]}
                      onPress={async () => {
                        const next = awaySelectedPreset === preset ? '' : preset;
                        const prevSelected = awaySelectedPreset;
                        setAwaySelectedPreset(next);
                        await settingsService.setSetting('awaySelectedPreset', next);
                        if (next) {
                          if (!awayDefaultReason.trim() || awayDefaultReason === prevSelected) {
                            setAwayDefaultReason(next);
                            await settingsService.setSetting('awayDefaultReason', next);
                          }
                          if (!autoAwayReason.trim() || autoAwayReason === prevSelected) {
                            setAutoAwayReason(next);
                            await settingsService.setSetting('autoAwayReason', next);
                          }
                        }
                      }}>
                      <Text
                        style={[
                          stylesLocal.selectButtonText,
                          awaySelectedPreset === preset && stylesLocal.selectButtonTextActive,
                        ]}
                      >
                        {awaySelectedPreset === preset ? t('Selected', { _tags: tags }) : t('Use', { _tags: tags })}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={stylesLocal.editButton}
                      onPress={() => {
                        setNewPreset(preset);
                        setEditingPresetIndex(idx);
                      }}>
                      <Text style={stylesLocal.editButtonText}>{t('Edit', { _tags: tags })}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={stylesLocal.removeButton}
                      onPress={async () => {
                        const updated = awayPresets.filter((_, i) => i !== idx);
                        setAwayPresets(updated);
                        if (editingPresetIndex === idx) {
                          setEditingPresetIndex(null);
                          setNewPreset('');
                        }
                        if (awaySelectedPreset === preset) {
                          setAwaySelectedPreset('');
                          await settingsService.setSetting('awaySelectedPreset', '');
                        }
                        await handleSaveList('awayPresets', updated);
                      }}>
                      <Text style={stylesLocal.removeButtonText}>{t('Remove', { _tags: tags })}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
            <View style={stylesLocal.modalButtonRow}>
              <TouchableOpacity
                style={[stylesLocal.modalButton, stylesLocal.modalButtonSecondary]}
                onPress={() => setShowPresets(false)}>
                <Text style={stylesLocal.modalButtonTextSecondary}>{t('Close', { _tags: tags })}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showAutoAnswerPresets}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAutoAnswerPresets(false)}>
        <View style={stylesLocal.modalContainer}>
          <View style={stylesLocal.modalContent}>
            <Text style={stylesLocal.modalTitle}>{t('Auto-answer presets', { _tags: tags })}</Text>
            <View style={stylesLocal.modalRow}>
              <TextInput
                style={stylesLocal.modalInput}
                placeholder={t('Add message', { _tags: tags })}
                placeholderTextColor={colors.textSecondary}
                value={newAutoAnswerPreset}
                onChangeText={setNewAutoAnswerPreset}
              />
              <TouchableOpacity
                style={[stylesLocal.modalButton, stylesLocal.modalButtonSecondary]}
                onPress={() => {
                  setColorInsertTarget('auto');
                  setShowColorPicker(true);
                }}>
                <Text style={stylesLocal.modalButtonTextSecondary}>{t('Colors', { _tags: tags })}</Text>
              </TouchableOpacity>
              {editingAutoAnswerIndex !== null && (
                <TouchableOpacity
                  style={[stylesLocal.modalButton, stylesLocal.modalButtonSecondary]}
                  onPress={() => {
                    setEditingAutoAnswerIndex(null);
                    setNewAutoAnswerPreset('');
                  }}>
                  <Text style={stylesLocal.modalButtonTextSecondary}>{t('Cancel', { _tags: tags })}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={stylesLocal.modalButton}
                onPress={async () => {
                  const next = newAutoAnswerPreset.trim();
                  if (!next) return;
                  let updated = [...awayAutoAnswerMessages];
                  if (editingAutoAnswerIndex !== null && editingAutoAnswerIndex >= 0 && editingAutoAnswerIndex < updated.length) {
                    updated[editingAutoAnswerIndex] = next;
                  } else {
                    updated.push(next);
                  }
                  setAwayAutoAnswerMessages(updated);
                  setNewAutoAnswerPreset('');
                  setEditingAutoAnswerIndex(null);
                  await handleSaveList('awayAutoAnswerMessages', updated);
                }}>
                <Text style={stylesLocal.modalButtonText}>
                  {editingAutoAnswerIndex !== null ? t('Save', { _tags: tags }) : t('Add', { _tags: tags })}
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 260 }}>
              {awayAutoAnswerMessages.map((preset, idx) => (
                <View
                  key={`${preset}-${idx}`}
                  style={stylesLocal.presetItem}>
                  <View style={stylesLocal.presetRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={stylesLocal.presetText}>{preset}</Text>
                    </View>
                    <TouchableOpacity
                      style={stylesLocal.editButton}
                      onPress={() => {
                        setNewAutoAnswerPreset(preset);
                        setEditingAutoAnswerIndex(idx);
                      }}>
                      <Text style={stylesLocal.editButtonText}>{t('Edit', { _tags: tags })}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={stylesLocal.removeButton}
                      onPress={async () => {
                        const updated = awayAutoAnswerMessages.filter((_, i) => i !== idx);
                        setAwayAutoAnswerMessages(updated);
                        if (editingAutoAnswerIndex === idx) {
                          setEditingAutoAnswerIndex(null);
                          setNewAutoAnswerPreset('');
                        }
                        await handleSaveList('awayAutoAnswerMessages', updated);
                      }}>
                      <Text style={stylesLocal.removeButtonText}>{t('Remove', { _tags: tags })}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
            <View style={stylesLocal.modalButtonRow}>
              <TouchableOpacity
                style={[stylesLocal.modalButton, stylesLocal.modalButtonSecondary]}
                onPress={() => setShowAutoAnswerPresets(false)}>
                <Text style={stylesLocal.modalButtonTextSecondary}>{t('Close', { _tags: tags })}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <ColorPickerModal
        visible={showColorPicker}
        onClose={() => setShowColorPicker(false)}
        onInsert={handleInsertColor}
        title={t('mIRC Colors', { _tags: tags })}
        colors={colors}
      />
    </View>
  );
};

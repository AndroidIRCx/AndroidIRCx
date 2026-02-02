/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, TextInput, StyleSheet } from 'react-native';
import { SettingItem } from '../SettingItem';
import { useT } from '../../../i18n/transifex';
import { SettingItem as SettingItemType, SettingIcon } from '../../../types/settings';
import { NEW_FEATURE_DEFAULTS, settingsService } from '../../../services/SettingsService';
import { protectionService } from '../../../services/ProtectionService';
import { ColorPickerModal } from '../../ColorPickerModal';

interface ProtectionSectionProps {
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
}

export const ProtectionSection: React.FC<ProtectionSectionProps> = ({
  colors,
  styles,
  settingIcons,
}) => {
  const t = useT();
  const tags = 'screen:settings,file:ProtectionSection.tsx,feature:settings';
  const [activeTab, setActiveTab] = useState<'flood' | 'spam'>('spam');
  const [showKeywords, setShowKeywords] = useState(false);
  const [showSpamModeModal, setShowSpamModeModal] = useState(false);
  const [showSpamLogModal, setShowSpamLogModal] = useState(false);
  const [showSpamLogDeleteModal, setShowSpamLogDeleteModal] = useState(false);
  const [showIrcopActionModal, setShowIrcopActionModal] = useState(false);
  const [showProtInfoModal, setShowProtInfoModal] = useState(false);
  const [spamLogContent, setSpamLogContent] = useState('');

  const [spamPmMode, setSpamPmMode] = useState<'when_open' | 'always'>('when_open');
  const [spamPmKeywords, setSpamPmKeywords] = useState<string[]>([]);
  const [spamChannelEnabled, setSpamChannelEnabled] = useState(false);
  const [spamNoSpamOnQuits, setSpamNoSpamOnQuits] = useState(false);
  const [spamLoggingEnabled, setSpamLoggingEnabled] = useState(false);

  const [protCtcpFlood, setProtCtcpFlood] = useState(false);
  const [protTextFlood, setProtTextFlood] = useState(false);
  const [protDccFlood, setProtDccFlood] = useState(false);
  const [protQueryFlood, setProtQueryFlood] = useState(false);
  const [protDosAttacks, setProtDosAttacks] = useState(false);
  const [protAntiDeopEnabled, setProtAntiDeopEnabled] = useState(false);
  const [protAntiDeopUseChanserv, setProtAntiDeopUseChanserv] = useState(false);
  const [protExcludeTokens, setProtExcludeTokens] = useState('');
  const [protEnforceSilence, setProtEnforceSilence] = useState(false);
  const [protBlockTsunamis, setProtBlockTsunamis] = useState(false);
  const [protTextFloodNet, setProtTextFloodNet] = useState(false);
  const [protIrcopAction, setProtIrcopAction] = useState<'none' | 'ban' | 'kill' | 'kline' | 'gline'>('none');
  const [protIrcopReason, setProtIrcopReason] = useState('Auto protection: spam/flood');
  const [protIrcopDuration, setProtIrcopDuration] = useState('1h');

  const [newKeyword, setNewKeyword] = useState('');
  const [editingKeywordIndex, setEditingKeywordIndex] = useState<number | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Ban settings
  const [defaultBanType, setDefaultBanType] = useState<number>(2);
  const [predefinedKickReasons, setPredefinedKickReasons] = useState<string[]>([]);
  const [showBanMaskPreview, setShowBanMaskPreview] = useState<boolean>(true);
  const [rememberLastBanType, setRememberLastBanType] = useState<boolean>(false);
  const [confirmBeforeKickBan, setConfirmBeforeKickBan] = useState<boolean>(true);
  const [showBanReasonsModal, setShowBanReasonsModal] = useState(false);
  const [newBanReason, setNewBanReason] = useState('');
  const [editingReasonIndex, setEditingReasonIndex] = useState<number | null>(null);
  const [showBanTypeModal, setShowBanTypeModal] = useState(false);

  useEffect(() => {
    const load = async () => {
      setSpamPmMode(await settingsService.getSetting('spamPmMode', 'when_open'));
      setSpamPmKeywords(await settingsService.getSetting('spamPmKeywords', NEW_FEATURE_DEFAULTS.spamPmKeywords));
      setSpamChannelEnabled(await settingsService.getSetting('spamChannelEnabled', false));
      setSpamNoSpamOnQuits(await settingsService.getSetting('spamNoSpamOnQuits', false));
      setSpamLoggingEnabled(await settingsService.getSetting('spamLoggingEnabled', false));

      setProtCtcpFlood(await settingsService.getSetting('protCtcpFlood', false));
      setProtTextFlood(await settingsService.getSetting('protTextFlood', false));
      setProtDccFlood(await settingsService.getSetting('protDccFlood', false));
      setProtQueryFlood(await settingsService.getSetting('protQueryFlood', false));
      setProtDosAttacks(await settingsService.getSetting('protDosAttacks', false));
      setProtAntiDeopEnabled(await settingsService.getSetting('protAntiDeopEnabled', false));
      setProtAntiDeopUseChanserv(await settingsService.getSetting('protAntiDeopUseChanserv', false));
      setProtExcludeTokens(await settingsService.getSetting('protExcludeTokens', ''));
      setProtEnforceSilence(await settingsService.getSetting('protEnforceSilence', false));
      setProtBlockTsunamis(await settingsService.getSetting('protBlockTsunamis', false));
      setProtTextFloodNet(await settingsService.getSetting('protTextFloodNet', false));
      setProtIrcopAction(await settingsService.getSetting('protIrcopAction', 'none'));
      setProtIrcopReason(await settingsService.getSetting('protIrcopReason', 'Auto protection: spam/flood'));
      setProtIrcopDuration(await settingsService.getSetting('protIrcopDuration', '1h'));

      // Load ban settings
      setDefaultBanType(await settingsService.getSetting('defaultBanType', NEW_FEATURE_DEFAULTS.defaultBanType));
      setPredefinedKickReasons(await settingsService.getSetting('predefinedKickReasons', NEW_FEATURE_DEFAULTS.predefinedKickReasons));
      setShowBanMaskPreview(await settingsService.getSetting('showBanMaskPreview', NEW_FEATURE_DEFAULTS.showBanMaskPreview));
      setRememberLastBanType(await settingsService.getSetting('rememberLastBanType', NEW_FEATURE_DEFAULTS.rememberLastBanType));
      setConfirmBeforeKickBan(await settingsService.getSetting('confirmBeforeKickBan', NEW_FEATURE_DEFAULTS.confirmBeforeKickBan));
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

  const spamModeLabel = spamPmMode === 'always'
    ? t('Always', { _tags: tags })
    : t('When open', { _tags: tags });

  const spamItems: SettingItemType[] = useMemo(() => [
    {
      id: 'spam-pm-mode',
      title: t('Anti-spam on private messages', { _tags: tags }),
      description: t('Mode: {mode}', { mode: spamModeLabel, _tags: tags }),
      type: 'button',
      onPress: () => {
        setShowSpamModeModal(true);
      },
    },
    {
      id: 'spam-pm-keywords',
      title: t('Spam keywords list', { _tags: tags }),
      description: t('{count} patterns', { count: spamPmKeywords.length, _tags: tags }),
      type: 'button',
      onPress: () => setShowKeywords(true),
    },
    {
      id: 'spam-logging',
      title: t('Logging in SPAM.log', { _tags: tags }),
      type: 'switch',
      value: spamLoggingEnabled,
      onValueChange: async (value) => {
        const next = Boolean(value);
        setSpamLoggingEnabled(next);
        await settingsService.setSetting('spamLoggingEnabled', next);
      },
    },
    {
      id: 'spam-log-check',
      title: t('Check SPAM.log', { _tags: tags }),
      type: 'button',
      onPress: async () => {
        const log = await protectionService.getSpamLog();
        const content = log && log.trim().length > 0
          ? log.slice(0, 3500)
          : t('No spam log entries.', { _tags: tags });
        setSpamLogContent(content);
        setShowSpamLogModal(true);
      },
    },
    {
      id: 'spam-log-delete',
      title: t('Delete SPAM.log', { _tags: tags }),
      type: 'button',
      onPress: () => setShowSpamLogDeleteModal(true),
    },
    {
      id: 'spam-channel-enabled',
      title: t('Anti-spam on channels', { _tags: tags }),
      type: 'switch',
      value: spamChannelEnabled,
      onValueChange: async (value) => {
        const next = Boolean(value);
        setSpamChannelEnabled(next);
        await settingsService.setSetting('spamChannelEnabled', next);
      },
    },
    {
      id: 'spam-no-spam-on-quits',
      title: t('No spam on quits', { _tags: tags }),
      type: 'switch',
      value: spamNoSpamOnQuits,
      onValueChange: async (value) => {
        const next = Boolean(value);
        setSpamNoSpamOnQuits(next);
        await settingsService.setSetting('spamNoSpamOnQuits', next);
      },
    },
  ], [
    spamModeLabel,
    spamPmKeywords.length,
    spamLoggingEnabled,
    spamChannelEnabled,
    spamNoSpamOnQuits,
    t,
    tags,
  ]);

  const floodItems: SettingItemType[] = useMemo(() => [
    {
      id: 'prot-ctcp-flood',
      title: t('CTCP Flood & various', { _tags: tags }),
      type: 'switch',
      value: protCtcpFlood,
      onValueChange: async (value) => {
        const next = Boolean(value);
        setProtCtcpFlood(next);
        await settingsService.setSetting('protCtcpFlood', next);
      },
    },
    {
      id: 'prot-text-flood',
      title: t('Text Flood', { _tags: tags }),
      type: 'switch',
      value: protTextFlood,
      onValueChange: async (value) => {
        const next = Boolean(value);
        setProtTextFlood(next);
        await settingsService.setSetting('protTextFlood', next);
      },
    },
    {
      id: 'prot-dcc-flood',
      title: t('DCC flood', { _tags: tags }),
      type: 'switch',
      value: protDccFlood,
      onValueChange: async (value) => {
        const next = Boolean(value);
        setProtDccFlood(next);
        await settingsService.setSetting('protDccFlood', next);
      },
    },
    {
      id: 'prot-query-flood',
      title: t('Query flood', { _tags: tags }),
      type: 'switch',
      value: protQueryFlood,
      onValueChange: async (value) => {
        const next = Boolean(value);
        setProtQueryFlood(next);
        await settingsService.setSetting('protQueryFlood', next);
      },
    },
    {
      id: 'prot-dos-attacks',
      title: t('D.O.S. attacks', { _tags: tags }),
      type: 'switch',
      value: protDosAttacks,
      onValueChange: async (value) => {
        const next = Boolean(value);
        setProtDosAttacks(next);
        await settingsService.setSetting('protDosAttacks', next);
      },
    },
    {
      id: 'prot-anti-deop-enabled',
      title: t('Anti deop/ban/kick', { _tags: tags }),
      type: 'switch',
      value: protAntiDeopEnabled,
      onValueChange: async (value) => {
        const next = Boolean(value);
        setProtAntiDeopEnabled(next);
        await settingsService.setSetting('protAntiDeopEnabled', next);
      },
    },
    {
      id: 'prot-anti-deop-chanserv',
      title: t('Using Chanserv', { _tags: tags }),
      type: 'switch',
      value: protAntiDeopUseChanserv,
      onValueChange: async (value) => {
        const next = Boolean(value);
        setProtAntiDeopUseChanserv(next);
        await settingsService.setSetting('protAntiDeopUseChanserv', next);
      },
      disabled: !protAntiDeopEnabled,
    },
    {
      id: 'prot-exclude-tokens',
      title: t('Exclude protections on', { _tags: tags }),
      description: t('Example: CTCP SLOTS MP3 SOUND', { _tags: tags }),
      type: 'input',
      value: protExcludeTokens,
      onValueChange: async (value) => {
        const next = String(value || '');
        setProtExcludeTokens(next);
        await settingsService.setSetting('protExcludeTokens', next);
      },
    },
    {
      id: 'prot-enforce-silence',
      title: t('Enforce with /silence', { _tags: tags }),
      type: 'switch',
      value: protEnforceSilence,
      onValueChange: async (value) => {
        const next = Boolean(value);
        setProtEnforceSilence(next);
        await settingsService.setSetting('protEnforceSilence', next);
      },
    },
    {
      id: 'prot-block-tsunamis',
      title: t('Block Tsunamis', { _tags: tags }),
      type: 'switch',
      value: protBlockTsunamis,
      onValueChange: async (value) => {
        const next = Boolean(value);
        setProtBlockTsunamis(next);
        await settingsService.setSetting('protBlockTsunamis', next);
      },
    },
    {
      id: 'prot-text-flood-net',
      title: t('Text Flood Net', { _tags: tags }),
      type: 'switch',
      value: protTextFloodNet,
      onValueChange: async (value) => {
        const next = Boolean(value);
        setProtTextFloodNet(next);
        await settingsService.setSetting('protTextFloodNet', next);
      },
    },
    {
      id: 'prot-ircop-action',
      title: t('IRCop auto action', { _tags: tags }),
      description: t('Action: {action}', {
        action: protIrcopAction === 'none' ? t('None', { _tags: tags }) : protIrcopAction.toUpperCase(),
        _tags: tags,
      }),
      type: 'button',
      onPress: () => setShowIrcopActionModal(true),
    },
    {
      id: 'prot-ircop-reason',
      title: t('IRCop reason', { _tags: tags }),
      type: 'input',
      value: protIrcopReason,
      onValueChange: async (value) => {
        const next = String(value || '');
        setProtIrcopReason(next);
        await settingsService.setSetting('protIrcopReason', next);
      },
      disabled: protIrcopAction === 'none',
    },
    {
      id: 'prot-ircop-duration',
      title: t('IRCop duration', { _tags: tags }),
      description: t('Used for GLINE/KLINE if supported', { _tags: tags }),
      type: 'input',
      value: protIrcopDuration,
      onValueChange: async (value) => {
        const next = String(value || '');
        setProtIrcopDuration(next);
        await settingsService.setSetting('protIrcopDuration', next);
      },
      disabled: protIrcopAction === 'none',
    },
    {
      id: 'prot-info',
      title: t('Information about protections', { _tags: tags }),
      type: 'button',
      onPress: () => {
        setShowProtInfoModal(true);
      },
    },
    // Ban settings
    {
      id: 'default_ban_type',
      title: t('Default Ban Type', { _tags: tags }),
      description: t('Select the default ban mask type (0-9)', { _tags: tags }),
      type: 'button',
      onPress: () => setShowBanTypeModal(true),
    },
    {
      id: 'predefined_kick_reasons',
      title: t('Predefined Kick/Ban Reasons', { _tags: tags }),
      description: t('{count} reasons', { count: predefinedKickReasons.length, _tags: tags }),
      type: 'button',
      onPress: () => setShowBanReasonsModal(true),
    },
    {
      id: 'show_ban_mask_preview',
      title: t('Show Ban Mask Preview', { _tags: tags }),
      description: t('Display the ban mask before applying', { _tags: tags }),
      type: 'switch',
      value: showBanMaskPreview,
      onValueChange: async (value) => {
        const next = Boolean(value);
        setShowBanMaskPreview(next);
        await settingsService.setSetting('showBanMaskPreview', next);
      },
    },
    {
      id: 'confirm_before_kickban',
      title: t('Always Confirm Kick/Ban', { _tags: tags }),
      description: t('Show reason dialog for all kick/ban actions', { _tags: tags }),
      type: 'switch',
      value: confirmBeforeKickBan,
      onValueChange: async (value) => {
        const next = Boolean(value);
        setConfirmBeforeKickBan(next);
        await settingsService.setSetting('confirmBeforeKickBan', next);
      },
    },
  ], [
    protCtcpFlood,
    protTextFlood,
    protDccFlood,
    protQueryFlood,
    protDosAttacks,
    protAntiDeopEnabled,
    protAntiDeopUseChanserv,
    protExcludeTokens,
    protEnforceSilence,
    protBlockTsunamis,
    protTextFloodNet,
    protIrcopAction,
    protIrcopReason,
    protIrcopDuration,
    defaultBanType,
    predefinedKickReasons.length,
    showBanMaskPreview,
    confirmBeforeKickBan,
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
          style={[stylesLocal.tabButton, activeTab === 'spam' && stylesLocal.tabButtonActive]}
          onPress={() => setActiveTab('spam')}
        >
          <Text style={[stylesLocal.tabText, activeTab === 'spam' && stylesLocal.tabTextActive]}>
            {t('Anti-Spam', { _tags: tags })}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[stylesLocal.tabButton, activeTab === 'flood' && stylesLocal.tabButtonActive]}
          onPress={() => setActiveTab('flood')}
        >
          <Text style={[stylesLocal.tabText, activeTab === 'flood' && stylesLocal.tabTextActive]}>
            {t('Flood / DOS', { _tags: tags })}
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'spam' ? renderList(spamItems) : renderList(floodItems)}

      <Modal visible={showKeywords} transparent animationType="fade" onRequestClose={() => setShowKeywords(false)}>
        <View style={stylesLocal.modalContainer}>
          <View style={stylesLocal.modalContent}>
            <Text style={stylesLocal.modalTitle}>{t('Spam keywords', { _tags: tags })}</Text>
            <View style={stylesLocal.modalRow}>
              <TextInput
                style={stylesLocal.modalInput}
                placeholder={t('Add keyword or wildcard', { _tags: tags })}
                placeholderTextColor={colors.textSecondary}
                value={newKeyword}
                onChangeText={setNewKeyword}
              />
              <TouchableOpacity
                style={[stylesLocal.modalButton, stylesLocal.modalButtonSecondary]}
                onPress={() => setShowColorPicker(true)}
              >
                <Text style={stylesLocal.modalButtonTextSecondary}>{t('Colors', { _tags: tags })}</Text>
              </TouchableOpacity>
              {editingKeywordIndex !== null && (
                <TouchableOpacity
                  style={[stylesLocal.modalButton, stylesLocal.modalButtonSecondary]}
                  onPress={() => {
                    setEditingKeywordIndex(null);
                    setNewKeyword('');
                  }}
                >
                  <Text style={stylesLocal.modalButtonTextSecondary}>{t('Cancel', { _tags: tags })}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={stylesLocal.modalButton}
                onPress={async () => {
                  const next = newKeyword.trim();
                  if (!next) return;
                  let updated = [...spamPmKeywords];
                  if (editingKeywordIndex !== null && editingKeywordIndex >= 0 && editingKeywordIndex < updated.length) {
                    updated[editingKeywordIndex] = next;
                  } else {
                    updated.push(next);
                  }
                  setSpamPmKeywords(updated);
                  setNewKeyword('');
                  setEditingKeywordIndex(null);
                  await settingsService.setSetting('spamPmKeywords', updated);
                }}>
                <Text style={stylesLocal.modalButtonText}>
                  {editingKeywordIndex !== null ? t('Save', { _tags: tags }) : t('Add', { _tags: tags })}
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 260 }}>
              {spamPmKeywords.map((keyword, idx) => (
                <View
                  key={`${keyword}-${idx}`}
                  style={stylesLocal.presetItem}>
                  <View style={stylesLocal.presetRow}>
                    <Text style={stylesLocal.presetText}>{keyword}</Text>
                    <TouchableOpacity
                      style={stylesLocal.editButton}
                      onPress={() => {
                        setNewKeyword(keyword);
                        setEditingKeywordIndex(idx);
                      }}>
                      <Text style={stylesLocal.editButtonText}>{t('Edit', { _tags: tags })}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={stylesLocal.removeButton}
                      onPress={async () => {
                        const updated = spamPmKeywords.filter((_, i) => i !== idx);
                        setSpamPmKeywords(updated);
                        if (editingKeywordIndex === idx) {
                          setEditingKeywordIndex(null);
                          setNewKeyword('');
                        }
                        await settingsService.setSetting('spamPmKeywords', updated);
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
                onPress={() => setShowKeywords(false)}>
                <Text style={stylesLocal.modalButtonTextSecondary}>{t('Close', { _tags: tags })}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal visible={showSpamModeModal} transparent animationType="fade" onRequestClose={() => setShowSpamModeModal(false)}>
        <View style={stylesLocal.modalContainer}>
          <View style={stylesLocal.modalContent}>
            <Text style={stylesLocal.modalTitle}>{t('Private Message Filter', { _tags: tags })}</Text>
            <Text style={[stylesLocal.presetText, { marginBottom: 12 }]}>
              {t('Select anti-spam mode', { _tags: tags })}
            </Text>
            <View style={stylesLocal.modalButtonRow}>
              <TouchableOpacity
                style={[stylesLocal.modalButton, stylesLocal.modalButtonSecondary]}
                onPress={() => setShowSpamModeModal(false)}>
                <Text style={stylesLocal.modalButtonTextSecondary}>{t('Cancel', { _tags: tags })}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={stylesLocal.modalButton}
                onPress={async () => {
                  setSpamPmMode('when_open');
                  await settingsService.setSetting('spamPmMode', 'when_open');
                  setShowSpamModeModal(false);
                }}>
                <Text style={stylesLocal.modalButtonText}>{t('When open', { _tags: tags })}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={stylesLocal.modalButton}
                onPress={async () => {
                  setSpamPmMode('always');
                  await settingsService.setSetting('spamPmMode', 'always');
                  setShowSpamModeModal(false);
                }}>
                <Text style={stylesLocal.modalButtonText}>{t('Always', { _tags: tags })}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal visible={showSpamLogModal} transparent animationType="fade" onRequestClose={() => setShowSpamLogModal(false)}>
        <View style={stylesLocal.modalContainer}>
          <View style={stylesLocal.modalContent}>
            <Text style={stylesLocal.modalTitle}>{t('SPAM.log', { _tags: tags })}</Text>
            <ScrollView style={{ maxHeight: 260 }}>
              <Text style={stylesLocal.presetText}>{spamLogContent}</Text>
            </ScrollView>
            <View style={stylesLocal.modalButtonRow}>
              <TouchableOpacity
                style={[stylesLocal.modalButton, stylesLocal.modalButtonSecondary]}
                onPress={() => setShowSpamLogModal(false)}>
                <Text style={stylesLocal.modalButtonTextSecondary}>{t('Close', { _tags: tags })}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={showSpamLogDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSpamLogDeleteModal(false)}>
        <View style={stylesLocal.modalContainer}>
          <View style={stylesLocal.modalContent}>
            <Text style={stylesLocal.modalTitle}>{t('Delete SPAM.log', { _tags: tags })}</Text>
            <Text style={[stylesLocal.presetText, { marginBottom: 12 }]}>
              {t('Are you sure you want to clear the spam log?', { _tags: tags })}
            </Text>
            <View style={stylesLocal.modalButtonRow}>
              <TouchableOpacity
                style={[stylesLocal.modalButton, stylesLocal.modalButtonSecondary]}
                onPress={() => setShowSpamLogDeleteModal(false)}>
                <Text style={stylesLocal.modalButtonTextSecondary}>{t('Cancel', { _tags: tags })}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={stylesLocal.modalButton}
                onPress={async () => {
                  await protectionService.clearSpamLog();
                  setShowSpamLogDeleteModal(false);
                  setSpamLogContent(t('Spam log cleared.', { _tags: tags }));
                  setShowSpamLogModal(true);
                }}>
                <Text style={stylesLocal.modalButtonText}>{t('Delete', { _tags: tags })}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={showIrcopActionModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowIrcopActionModal(false)}>
        <View style={stylesLocal.modalContainer}>
          <View style={stylesLocal.modalContent}>
            <Text style={stylesLocal.modalTitle}>{t('IRCop auto action', { _tags: tags })}</Text>
            <Text style={[stylesLocal.presetText, { marginBottom: 12 }]}>
              {t('Select action when spam/flood is detected', { _tags: tags })}
            </Text>
            <View style={stylesLocal.modalButtonRow}>
              <TouchableOpacity
                style={[stylesLocal.modalButton, stylesLocal.modalButtonSecondary]}
                onPress={() => setShowIrcopActionModal(false)}>
                <Text style={stylesLocal.modalButtonTextSecondary}>{t('Cancel', { _tags: tags })}</Text>
              </TouchableOpacity>
              {['none', 'ban', 'kill', 'kline', 'gline'].map((action) => (
                <TouchableOpacity
                  key={action}
                  style={stylesLocal.modalButton}
                  onPress={async () => {
                    const next = action as 'none' | 'ban' | 'kill' | 'kline' | 'gline';
                    setProtIrcopAction(next);
                    await settingsService.setSetting('protIrcopAction', next);
                    setShowIrcopActionModal(false);
                  }}>
                  <Text style={stylesLocal.modalButtonText}>
                    {action === 'none' ? t('None', { _tags: tags }) : action.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={showProtInfoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowProtInfoModal(false)}>
        <View style={stylesLocal.modalContainer}>
          <View style={stylesLocal.modalContent}>
            <Text style={stylesLocal.modalTitle}>{t('Protections', { _tags: tags })}</Text>
            <Text style={[stylesLocal.presetText, { marginBottom: 12 }]}>
              {t('Protections will ignore spam/flood users and can trigger IRCop actions when enabled.', { _tags: tags })}
            </Text>
            <View style={stylesLocal.modalButtonRow}>
              <TouchableOpacity
                style={[stylesLocal.modalButton, stylesLocal.modalButtonSecondary]}
                onPress={() => setShowProtInfoModal(false)}>
                <Text style={stylesLocal.modalButtonTextSecondary}>{t('Close', { _tags: tags })}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <ColorPickerModal
        visible={showColorPicker}
        onClose={() => setShowColorPicker(false)}
        onInsert={(code) => {
          setNewKeyword((prev) => `${prev}${code}`);
          setShowColorPicker(false);
        }}
        title={t('mIRC Colors', { _tags: tags })}
        colors={colors}
      />

      {/* Ban Type Selection Modal */}
      <Modal
        visible={showBanTypeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBanTypeModal(false)}
      >
        <View style={stylesLocal.modalContainer}>
          <View style={stylesLocal.modalContent}>
            <Text style={stylesLocal.modalTitle}>{t('Select Default Ban Type', { _tags: tags })}</Text>
            <Text style={[stylesLocal.presetText, { marginBottom: 12 }]}>
              {t('Choose the default ban mask type', { _tags: tags })}
            </Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {[
                { id: 0, label: '0 - *!user@host', desc: t('Ban by user@host', { _tags: tags }) },
                { id: 1, label: '1 - *!*user@host', desc: t('Ban by *user@host', { _tags: tags }) },
                { id: 2, label: '2 - *!*@host', desc: t('Ban by host only', { _tags: tags }) },
                { id: 3, label: '3 - *!*user@*.host', desc: t('Ban by *user@*.domain', { _tags: tags }) },
                { id: 4, label: '4 - *!*@*.host', desc: t('Ban by *.domain only', { _tags: tags }) },
                { id: 5, label: '5 - nick!user@host', desc: t('Ban exact nick!user@host', { _tags: tags }) },
                { id: 6, label: '6 - nick!*user@host', desc: t('Ban nick with *user@host', { _tags: tags }) },
                { id: 7, label: '7 - nick!*@host', desc: t('Ban nick with any user@host', { _tags: tags }) },
                { id: 8, label: '8 - nick!*user@*.host', desc: t('Ban nick with *user@*.domain', { _tags: tags }) },
                { id: 9, label: '9 - nick!*@*.host', desc: t('Ban nick with *.domain', { _tags: tags }) },
              ].map((bt) => (
                <TouchableOpacity
                  key={bt.id}
                  style={[
                    stylesLocal.presetItem,
                    defaultBanType === bt.id && { backgroundColor: colors.primary + '20' }
                  ]}
                  onPress={async () => {
                    setDefaultBanType(bt.id);
                    await settingsService.setSetting('defaultBanType', bt.id);
                    setShowBanTypeModal(false);
                  }}
                >
                  <Text style={[stylesLocal.presetText, { fontWeight: defaultBanType === bt.id ? '600' : '400' }]}>
                    {bt.label}
                  </Text>
                  <Text style={[stylesLocal.presetText, { fontSize: 12, opacity: 0.7 }]}>
                    {bt.desc}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={stylesLocal.modalButtonRow}>
              <TouchableOpacity
                style={[stylesLocal.modalButton, stylesLocal.modalButtonSecondary]}
                onPress={() => setShowBanTypeModal(false)}
              >
                <Text style={stylesLocal.modalButtonTextSecondary}>{t('Cancel', { _tags: tags })}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal for managing predefined kick/ban reasons */}
      <Modal
        visible={showBanReasonsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBanReasonsModal(false)}
      >
        <View style={stylesLocal.modalContainer}>
          <View style={stylesLocal.modalContent}>
            <Text style={stylesLocal.modalTitle}>{t('Predefined Kick/Ban Reasons', { _tags: tags })}</Text>

            <View style={stylesLocal.modalRow}>
              <TextInput
                style={stylesLocal.modalInput}
                placeholder={t('Add new reason...', { _tags: tags })}
                placeholderTextColor={colors.textSecondary}
                value={newBanReason}
                onChangeText={setNewBanReason}
              />
              {editingReasonIndex !== null && (
                <TouchableOpacity
                  style={[stylesLocal.modalButton, stylesLocal.modalButtonSecondary]}
                  onPress={() => {
                    setEditingReasonIndex(null);
                    setNewBanReason('');
                  }}
                >
                  <Text style={stylesLocal.modalButtonTextSecondary}>{t('Cancel', { _tags: tags })}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={stylesLocal.modalButton}
                onPress={async () => {
                  const next = newBanReason.trim();
                  if (!next) return;

                  let updated = [...predefinedKickReasons];
                  if (editingReasonIndex !== null && editingReasonIndex >= 0 && editingReasonIndex < updated.length) {
                    updated[editingReasonIndex] = next;
                  } else {
                    updated.push(next);
                  }

                  setPredefinedKickReasons(updated);
                  setNewBanReason('');
                  setEditingReasonIndex(null);
                  await settingsService.setSetting('predefinedKickReasons', updated);
                }}
              >
                <Text style={stylesLocal.modalButtonText}>
                  {editingReasonIndex !== null ? t('Save', { _tags: tags }) : t('Add', { _tags: tags })}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 260 }}>
              {predefinedKickReasons.map((reason, idx) => (
                <View key={`${reason}-${idx}`} style={stylesLocal.presetItem}>
                  <View style={stylesLocal.presetRow}>
                    <Text style={stylesLocal.presetText}>{reason}</Text>
                    <TouchableOpacity
                      style={stylesLocal.editButton}
                      onPress={() => {
                        setNewBanReason(reason);
                        setEditingReasonIndex(idx);
                      }}
                    >
                      <Text style={stylesLocal.editButtonText}>{t('Edit', { _tags: tags })}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={stylesLocal.removeButton}
                      onPress={async () => {
                        const updated = predefinedKickReasons.filter((_, i) => i !== idx);
                        setPredefinedKickReasons(updated);
                        if (editingReasonIndex === idx) {
                          setEditingReasonIndex(null);
                          setNewBanReason('');
                        }
                        await settingsService.setSetting('predefinedKickReasons', updated);
                      }}
                    >
                      <Text style={stylesLocal.removeButtonText}>{t('Remove', { _tags: tags })}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>

            <View style={stylesLocal.modalButtonRow}>
              <TouchableOpacity
                style={[stylesLocal.modalButton, stylesLocal.modalButtonSecondary]}
                onPress={async () => {
                  // Reset to defaults
                  const defaults = NEW_FEATURE_DEFAULTS.predefinedKickReasons;
                  setPredefinedKickReasons(defaults);
                  await settingsService.setSetting('predefinedKickReasons', defaults);
                }}
              >
                <Text style={stylesLocal.modalButtonTextSecondary}>{t('Reset to Defaults', { _tags: tags })}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[stylesLocal.modalButton, stylesLocal.modalButtonSecondary]}
                onPress={() => setShowBanReasonsModal(false)}
              >
                <Text style={stylesLocal.modalButtonTextSecondary}>{t('Close', { _tags: tags })}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

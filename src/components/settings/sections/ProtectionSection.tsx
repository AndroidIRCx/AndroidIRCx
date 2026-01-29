/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, TextInput, StyleSheet, Alert } from 'react-native';
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
        Alert.alert(
          t('Private Message Filter', { _tags: tags }),
          t('Select anti-spam mode', { _tags: tags }),
          [
            { text: t('Cancel', { _tags: tags }), style: 'cancel' },
            {
              text: t('When open', { _tags: tags }),
              onPress: async () => {
                setSpamPmMode('when_open');
                await settingsService.setSetting('spamPmMode', 'when_open');
              },
            },
            {
              text: t('Always', { _tags: tags }),
              onPress: async () => {
                setSpamPmMode('always');
                await settingsService.setSetting('spamPmMode', 'always');
              },
            },
          ]
        );
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
        Alert.alert(
          t('SPAM.log', { _tags: tags }),
          log && log.trim().length > 0 ? log.slice(0, 3500) : t('No spam log entries.', { _tags: tags })
        );
      },
    },
    {
      id: 'spam-log-delete',
      title: t('Delete SPAM.log', { _tags: tags }),
      type: 'button',
      onPress: async () => {
        await protectionService.clearSpamLog();
        Alert.alert(
          t('Delete SPAM.log', { _tags: tags }),
          t('Spam log cleared.', { _tags: tags })
        );
      },
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
      onPress: () => {
        Alert.alert(
          t('IRCop auto action', { _tags: tags }),
          t('Select action when spam/flood is detected', { _tags: tags }),
          [
            { text: t('Cancel', { _tags: tags }), style: 'cancel' },
            {
              text: t('None', { _tags: tags }),
              onPress: async () => {
                setProtIrcopAction('none');
                await settingsService.setSetting('protIrcopAction', 'none');
              },
            },
            {
              text: t('BAN', { _tags: tags }),
              onPress: async () => {
                setProtIrcopAction('ban');
                await settingsService.setSetting('protIrcopAction', 'ban');
              },
            },
            {
              text: t('KILL', { _tags: tags }),
              onPress: async () => {
                setProtIrcopAction('kill');
                await settingsService.setSetting('protIrcopAction', 'kill');
              },
            },
            {
              text: t('KLINE', { _tags: tags }),
              onPress: async () => {
                setProtIrcopAction('kline');
                await settingsService.setSetting('protIrcopAction', 'kline');
              },
            },
            {
              text: t('GLINE', { _tags: tags }),
              onPress: async () => {
                setProtIrcopAction('gline');
                await settingsService.setSetting('protIrcopAction', 'gline');
              },
            },
          ]
        );
      },
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
        Alert.alert(
          t('Protections', { _tags: tags }),
          t('Protections will ignore spam/flood users and can trigger IRCop actions when enabled.', { _tags: tags })
        );
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
    </View>
  );
};

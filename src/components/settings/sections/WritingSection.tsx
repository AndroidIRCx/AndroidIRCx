/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, TextInput, StyleSheet, Alert } from 'react-native';
import { SettingItem } from '../SettingItem';
import { useT } from '../../../i18n/transifex';
import { SettingItem as SettingItemType, SettingIcon } from '../../../types/settings';
import { settingsService } from '../../../services/SettingsService';
import { formatIRCTextAsComponent, stripIRCFormatting } from '../../../utils/IRCFormatter';
import { repairMojibake } from '../../../utils/EncodingUtils';
import { ColorPickerModal } from '../../ColorPickerModal';

interface WritingSectionProps {
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

type DecorSelectTarget = 'text' | 'color' | 'adornment' | null;
type NickSelectTarget = 'style' | null;

export const WritingSection: React.FC<WritingSectionProps> = ({
  colors,
  styles,
  settingIcons,
}) => {
  const t = useT();
  const tags = 'screen:settings,file:WritingSection.tsx,feature:settings';
  const [activeTab, setActiveTab] = useState<'decoration' | 'nick'>('decoration');

  const [decorEnabled, setDecorEnabled] = useState(false);
  const [decorUseColors, setDecorUseColors] = useState(true);
  const [decorBold, setDecorBold] = useState(false);
  const [decorUnderline, setDecorUnderline] = useState(false);
  const [decorTextStyleId, setDecorTextStyleId] = useState('');
  const [decorStyles, setDecorStyles] = useState<string[]>([]);

  const [nickCompleteEnabled, setNickCompleteEnabled] = useState(false);
  const [nickCompleteStyleId, setNickCompleteStyleId] = useState('');
  const [nickCompleteStyles, setNickCompleteStyles] = useState<string[]>([]);

  const [showDecorManage, setShowDecorManage] = useState(false);
  const [showDecorSelect, setShowDecorSelect] = useState(false);
  const [decorSelectTarget, setDecorSelectTarget] = useState<DecorSelectTarget>(null);
  const [showStyleEditor, setShowStyleEditor] = useState(false);
  const [styleEditorTarget, setStyleEditorTarget] = useState<'decor' | 'nick' | null>(null);
  const [styleEditorIndex, setStyleEditorIndex] = useState<number | null>(null);
  const [styleEditorValue, setStyleEditorValue] = useState('');

  const [showNickManage, setShowNickManage] = useState(false);
  const [showNickSelect, setShowNickSelect] = useState(false);
  const [nickSelectTarget, setNickSelectTarget] = useState<NickSelectTarget>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [colorInsertTarget, setColorInsertTarget] = useState<'editor' | null>(null);

  const sanitizeStyleString = (style: string) => {
    const normalized = repairMojibake(style);
    const allowedControls = new Set([0x02, 0x03, 0x0F, 0x16, 0x1D, 0x1F, 0x1E, 0x08]);
    return Array.from(normalized).filter((char) => {
      const code = char.charCodeAt(0);
      if (code >= 32 && code !== 127) return true;
      return allowedControls.has(code);
    }).join('');
  };

  const normalizeNickStyle = (style: string) => (
    sanitizeStyleString(style)
      .replace(/(\x08)(on|off)$/i, '$1')
      .replace(/\s+(on|off)$/i, '')
  );

  const normalizeDecorStyle = (style: string) => sanitizeStyleString(style);
  const dedupeStyles = (stylesList: string[]) => {
    const seen = new Set<string>();
    return stylesList.filter((style) => {
      if (!style || seen.has(style)) return false;
      seen.add(style);
      return true;
    });
  };

  useEffect(() => {
    const load = async () => {
      setDecorEnabled(await settingsService.getSetting('decorEnabled', false));
      setDecorUseColors(await settingsService.getSetting('decorUseColors', true));
      setDecorBold(await settingsService.getSetting('decorBold', false));
      setDecorUnderline(await settingsService.getSetting('decorUnderline', false));
      const storedDecorText = await settingsService.getSetting('decorTextStyleId', '');
      const storedDecorStyles = await settingsService.getSetting('decorStyles', []);
      const normalizedDecorText = storedDecorText ? normalizeDecorStyle(String(storedDecorText)) : '';
      const normalizedDecorStyles = dedupeStyles(
        storedDecorStyles.map((style: string) => normalizeDecorStyle(String(style)))
      );
      setDecorTextStyleId(normalizedDecorText);
      setDecorStyles(normalizedDecorStyles);
      if (normalizedDecorText !== storedDecorText) {
        await settingsService.setSetting('decorTextStyleId', normalizedDecorText);
      }
      if (await settingsService.getSetting('decorColorStyleId', '')) {
        await settingsService.setSetting('decorColorStyleId', '');
      }
      if (await settingsService.getSetting('decorAdornmentId', '')) {
        await settingsService.setSetting('decorAdornmentId', '');
      }
      if (
        normalizedDecorStyles.length !== storedDecorStyles.length ||
        normalizedDecorStyles.some((style, idx) => style !== storedDecorStyles[idx])
      ) {
        await settingsService.setSetting('decorStyles', normalizedDecorStyles);
      }
      setNickCompleteEnabled(await settingsService.getSetting('nickCompleteEnabled', false));
      const storedNickStyleId = await settingsService.getSetting('nickCompleteStyleId', '');
      const normalizedNickStyleId = storedNickStyleId ? normalizeNickStyle(String(storedNickStyleId)) : '';
      setNickCompleteStyleId(normalizedNickStyleId);
      if (normalizedNickStyleId !== storedNickStyleId) {
        await settingsService.setSetting('nickCompleteStyleId', normalizedNickStyleId);
      }
      const storedNickStyles = await settingsService.getSetting('nickCompleteStyles', []);
      const normalizedNickStyles = dedupeStyles(
        storedNickStyles.map((style: string) => normalizeNickStyle(String(style)))
      );
      setNickCompleteStyles(normalizedNickStyles);
      if (
        normalizedNickStyles.length !== storedNickStyles.length ||
        normalizedNickStyles.some((style, idx) => style !== storedNickStyles[idx])
      ) {
        await settingsService.setSetting('nickCompleteStyles', normalizedNickStyles);
      }
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
    previewBox: {
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      marginBottom: 8,
    },
    previewText: {
      color: colors.text,
      fontSize: 13,
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
    editorInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.text,
      minHeight: 140,
      textAlignVertical: 'top',
      marginBottom: 12,
    },
    editorPreviewBox: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      backgroundColor: colors.surface,
      marginBottom: 12,
    },
    editorPreviewText: {
      color: colors.text,
      fontSize: 14,
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

  const handleDecorSelect = async (value: string) => {
    if (decorSelectTarget === 'text') {
      const next = normalizeDecorStyle(value);
      setDecorTextStyleId(next);
      await settingsService.setSetting('decorTextStyleId', next);
    }
    setShowDecorSelect(false);
  };

  const handleNickSelect = async (value: string) => {
    if (nickSelectTarget === 'style') {
      const normalized = normalizeNickStyle(value);
      setNickCompleteStyleId(normalized);
      await settingsService.setSetting('nickCompleteStyleId', normalized);
    }
    setShowNickSelect(false);
  };

  const openStyleEditor = (target: 'decor' | 'nick', value = '', index: number | null = null) => {
    const normalized = target === 'decor' ? normalizeDecorStyle(value) : normalizeNickStyle(value);
    setStyleEditorTarget(target);
    setStyleEditorIndex(index);
    setStyleEditorValue(normalized);
    setShowStyleEditor(true);
  };

  const closeStyleEditor = () => {
    setShowStyleEditor(false);
    setStyleEditorTarget(null);
    setStyleEditorIndex(null);
    setStyleEditorValue('');
  };

  const handleSaveStyleEditor = async () => {
    if (!styleEditorTarget) return;
    const nextValue = styleEditorTarget === 'decor'
      ? normalizeDecorStyle(styleEditorValue.trim())
      : normalizeNickStyle(styleEditorValue.trim());
    if (!nextValue) return;

    if (styleEditorTarget === 'decor') {
      const updated = [...decorStyles];
      if (styleEditorIndex !== null && styleEditorIndex >= 0 && styleEditorIndex < updated.length) {
        updated[styleEditorIndex] = nextValue;
      } else {
        updated.push(nextValue);
      }
      const deduped = dedupeStyles(updated);
      setDecorStyles(deduped);
      await settingsService.setSetting('decorStyles', deduped);
    } else {
      const updated = [...nickCompleteStyles];
      if (styleEditorIndex !== null && styleEditorIndex >= 0 && styleEditorIndex < updated.length) {
        updated[styleEditorIndex] = nextValue;
      } else {
        updated.push(nextValue);
      }
      const deduped = dedupeStyles(updated);
      setNickCompleteStyles(deduped);
      await settingsService.setSetting('nickCompleteStyles', deduped);
    }

    closeStyleEditor();
  };

  const sampleNick = t('Nick', { _tags: tags });

  const replaceBackspacePlaceholder = (template: string, value: string) => {
    const idx = template.indexOf('\x08');
    if (idx === -1) return template;
    const before = template.slice(0, idx);
    const after = template.slice(idx + 1).replace(/\x08/g, '');
    return `${before}${value}${after}`;
  };

  const nickStyleDisplay = (style: string, usePlaceholder = true) => {
    const normalized = normalizeNickStyle(style);
    if (/<nick>/i.test(normalized)) {
      return normalized.replace(/<nick>/gi, usePlaceholder ? '<nick>' : sampleNick);
    }
    if (normalized.includes('\x08')) {
      return replaceBackspacePlaceholder(normalized, usePlaceholder ? '<nick>' : sampleNick);
    }
    return normalized;
  };

  const sampleDecorText = t('Text', { _tags: tags });

  const decorStyleDisplay = (styleName: string, usePlaceholder = true) => {
    if (/<text>/i.test(styleName)) {
      return styleName.replace(/<text>/gi, usePlaceholder ? '<text>' : sampleDecorText);
    }
    if (styleName.includes('\x08')) {
      return replaceBackspacePlaceholder(styleName, usePlaceholder ? '<text>' : sampleDecorText);
    }
    return styleName;
  };

  const renderDecorSummary = (styleName: string) => {
    const display = decorStyleDisplay(styleName, false);
    const plain = stripIRCFormatting(display).trim();
    const fallback = plain.length > 0 ? plain : display;
    return formatIRCTextAsComponent(display, styles.settingDescription) || fallback;
  };

  const renderNickSummary = (styleName: string) => {
    const display = nickStyleDisplay(styleName, false);
    const plain = stripIRCFormatting(display).trim();
    const fallback = plain.length > 0 ? plain : display;
    return formatIRCTextAsComponent(display, styles.settingDescription) || fallback;
  };

  const decorationItems: SettingItemType[] = useMemo(() => [
    {
      id: 'decor-enabled',
      title: t('Enabled', { _tags: tags }),
      type: 'switch',
      value: decorEnabled,
      onValueChange: async (value) => {
        const next = Boolean(value);
        setDecorEnabled(next);
        await settingsService.setSetting('decorEnabled', next);
      },
    },
    {
      id: 'decor-text-style',
      title: t('Decoration style', { _tags: tags }),
      description: decorTextStyleId ? undefined : t('None selected', { _tags: tags }),
      descriptionNode: decorTextStyleId ? renderDecorSummary(decorTextStyleId) : undefined,
      type: 'button',
      onPress: () => {
        if (decorStyles.length === 0) {
          Alert.alert(t('No styles', { _tags: tags }), t('Add styles first.', { _tags: tags }));
          return;
        }
        setDecorSelectTarget('text');
        setShowDecorSelect(true);
      },
    },
    {
      id: 'decor-bold',
      title: t('Bold', { _tags: tags }),
      type: 'switch',
      value: decorBold,
      onValueChange: async (value) => {
        const next = Boolean(value);
        setDecorBold(next);
        await settingsService.setSetting('decorBold', next);
      },
    },
    {
      id: 'decor-underline',
      title: t('Underline', { _tags: tags }),
      type: 'switch',
      value: decorUnderline,
      onValueChange: async (value) => {
        const next = Boolean(value);
        setDecorUnderline(next);
        await settingsService.setSetting('decorUnderline', next);
      },
    },
    {
      id: 'decor-use-colors',
      title: t('Use colors', { _tags: tags }),
      type: 'switch',
      value: decorUseColors,
      onValueChange: async (value) => {
        const next = Boolean(value);
        setDecorUseColors(next);
        await settingsService.setSetting('decorUseColors', next);
      },
    },
    {
      id: 'decor-manage-styles',
      title: t('Styles list', { _tags: tags }),
      description: t('{count} styles', { count: decorStyles.length, _tags: tags }),
      type: 'button',
      onPress: () => setShowDecorManage(true),
    },
  ], [
    decorEnabled,
    decorTextStyleId,
    decorBold,
    decorUnderline,
    decorUseColors,
    decorStyles.length,
    t,
    tags,
  ]);

  const nickItems: SettingItemType[] = useMemo(() => [
    {
      id: 'nick-complete-enabled',
      title: t('Enabled', { _tags: tags }),
      type: 'switch',
      value: nickCompleteEnabled,
      onValueChange: async (value) => {
        const next = Boolean(value);
        setNickCompleteEnabled(next);
        await settingsService.setSetting('nickCompleteEnabled', next);
      },
    },
    {
      id: 'nick-complete-style',
      title: t('Active style', { _tags: tags }),
      description: nickCompleteStyleId ? undefined : t('None selected', { _tags: tags }),
      descriptionNode: nickCompleteStyleId ? renderNickSummary(nickCompleteStyleId) : undefined,
      type: 'button',
      onPress: () => {
        if (nickCompleteStyles.length === 0) {
          Alert.alert(t('No styles', { _tags: tags }), t('Add styles first.', { _tags: tags }));
          return;
        }
        setNickSelectTarget('style');
        setShowNickSelect(true);
      },
    },
    {
      id: 'nick-complete-styles',
      title: t('Nick completion styles', { _tags: tags }),
      description: t('{count} styles', { count: nickCompleteStyles.length, _tags: tags }),
      type: 'button',
      onPress: () => setShowNickManage(true),
    },
  ], [
    nickCompleteEnabled,
    nickCompleteStyleId,
    nickCompleteStyles.length,
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

  const renderIrcPreview = (styleName: string) => {
    const display = decorStyleDisplay(styleName, false);
    const plain = stripIRCFormatting(display).trim();
    const fallback = plain.length > 0 ? plain : display;
    return (
      <Text style={stylesLocal.presetText}>
        {formatIRCTextAsComponent(display, stylesLocal.presetText) || fallback}
      </Text>
    );
  };

  const renderNickPreview = (styleName: string) => {
    const display = nickStyleDisplay(styleName, false);
    const plain = stripIRCFormatting(display).trim();
    const fallback = plain.length > 0 ? plain : display;
    return (
      <Text style={stylesLocal.presetText}>
        {formatIRCTextAsComponent(display, stylesLocal.presetText) || fallback}
      </Text>
    );
  };

  const handleInsertColor = (code: string) => {
    if (colorInsertTarget === 'editor') {
      setStyleEditorValue((prev) => `${prev}${code}`);
    }
    setShowColorPicker(false);
    setColorInsertTarget(null);
  };

  const previewText = t('Decoration style: {text}', {
    text: decorTextStyleId || t('none', { _tags: tags }),
    _tags: tags,
  });

  const styleEditorPreview = styleEditorTarget === 'decor'
    ? decorStyleDisplay(styleEditorValue || sampleDecorText, false)
    : nickStyleDisplay(styleEditorValue || sampleNick, false);

  return (
    <View>
      <View style={stylesLocal.tabRow}>
        <TouchableOpacity
          style={[stylesLocal.tabButton, activeTab === 'decoration' && stylesLocal.tabButtonActive]}
          onPress={() => setActiveTab('decoration')}
        >
          <Text style={[stylesLocal.tabText, activeTab === 'decoration' && stylesLocal.tabTextActive]}>
            {t('Decoration', { _tags: tags })}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[stylesLocal.tabButton, activeTab === 'nick' && stylesLocal.tabButtonActive]}
          onPress={() => setActiveTab('nick')}
        >
          <Text style={[stylesLocal.tabText, activeTab === 'nick' && stylesLocal.tabTextActive]}>
            {t('Nick Completion', { _tags: tags })}
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'decoration' && (
        <View>
          <View style={stylesLocal.previewBox}>
            <Text style={stylesLocal.previewText}>
              {formatIRCTextAsComponent(previewText, stylesLocal.previewText)}
            </Text>
          </View>
          {renderList(decorationItems)}
        </View>
      )}
      {activeTab === 'nick' && renderList(nickItems)}

      <Modal visible={showDecorManage} transparent animationType="fade" onRequestClose={() => setShowDecorManage(false)}>
        <View style={stylesLocal.modalContainer}>
          <View style={stylesLocal.modalContent}>
            <Text style={stylesLocal.modalTitle}>{t('Decoration styles', { _tags: tags })}</Text>
            <View style={stylesLocal.modalRow}>
              <TouchableOpacity
                style={stylesLocal.modalButton}
                onPress={() => openStyleEditor('decor')}>
                <Text style={stylesLocal.modalButtonText}>{t('Add style', { _tags: tags })}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 260 }}>
              {decorStyles.map((styleName, idx) => (
                <View
                  key={`${styleName}-${idx}`}
                  style={stylesLocal.presetItem}>
                  <View style={stylesLocal.presetRow}>
                    <View style={{ flex: 1 }}>
                      {renderIrcPreview(styleName)}
                      {stripIRCFormatting(decorStyleDisplay(styleName)) !== decorStyleDisplay(styleName) && (
                        <Text style={stylesLocal.presetTextMuted}>
                          {stripIRCFormatting(decorStyleDisplay(styleName))}
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity
                      style={stylesLocal.editButton}
                      onPress={() => {
                        openStyleEditor('decor', styleName, idx);
                      }}>
                      <Text style={stylesLocal.editButtonText}>{t('Edit', { _tags: tags })}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={stylesLocal.removeButton}
                      onPress={async () => {
                        const updated = decorStyles.filter((_, i) => i !== idx);
                        setDecorStyles(updated);
                        await settingsService.setSetting('decorStyles', updated);
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
                onPress={() => setShowDecorManage(false)}>
                <Text style={stylesLocal.modalButtonTextSecondary}>{t('Close', { _tags: tags })}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showDecorSelect} transparent animationType="fade" onRequestClose={() => setShowDecorSelect(false)}>
        <View style={stylesLocal.modalContainer}>
          <View style={stylesLocal.modalContent}>
            <Text style={stylesLocal.modalTitle}>{t('Select style', { _tags: tags })}</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {decorStyles.map((styleName, idx) => (
                <TouchableOpacity
                  key={`${styleName}-${idx}`}
                  style={stylesLocal.presetItem}
                  onPress={() => handleDecorSelect(styleName)}>
                  {renderIrcPreview(styleName)}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={stylesLocal.modalButtonRow}>
              <TouchableOpacity
                style={[stylesLocal.modalButton, stylesLocal.modalButtonSecondary]}
                onPress={() => handleDecorSelect('')}>
                <Text style={stylesLocal.modalButtonTextSecondary}>{t('Clear', { _tags: tags })}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[stylesLocal.modalButton, stylesLocal.modalButtonSecondary]}
                onPress={() => setShowDecorSelect(false)}>
                <Text style={stylesLocal.modalButtonTextSecondary}>{t('Close', { _tags: tags })}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showNickManage} transparent animationType="fade" onRequestClose={() => setShowNickManage(false)}>
        <View style={stylesLocal.modalContainer}>
          <View style={stylesLocal.modalContent}>
            <Text style={stylesLocal.modalTitle}>{t('Nick completion styles', { _tags: tags })}</Text>
            <View style={stylesLocal.modalRow}>
              <TouchableOpacity
                style={stylesLocal.modalButton}
                onPress={() => openStyleEditor('nick')}>
                <Text style={stylesLocal.modalButtonText}>{t('Add style', { _tags: tags })}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 260 }}>
              {nickCompleteStyles.map((styleName, idx) => (
                <View
                  key={`${styleName}-${idx}`}
                  style={stylesLocal.presetItem}>
                  <View style={stylesLocal.presetRow}>
                    <View style={{ flex: 1 }}>
                      {renderNickPreview(styleName)}
                      {stripIRCFormatting(nickStyleDisplay(styleName)) !== nickStyleDisplay(styleName) && (
                        <Text style={stylesLocal.presetTextMuted}>
                          {stripIRCFormatting(nickStyleDisplay(styleName))}
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity
                      style={stylesLocal.editButton}
                      onPress={() => {
                        openStyleEditor('nick', styleName, idx);
                      }}>
                      <Text style={stylesLocal.editButtonText}>{t('Edit', { _tags: tags })}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={stylesLocal.removeButton}
                      onPress={async () => {
                        const updated = nickCompleteStyles.filter((_, i) => i !== idx);
                        setNickCompleteStyles(updated);
                        await settingsService.setSetting('nickCompleteStyles', updated);
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
                onPress={() => setShowNickManage(false)}>
                <Text style={stylesLocal.modalButtonTextSecondary}>{t('Close', { _tags: tags })}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showNickSelect} transparent animationType="fade" onRequestClose={() => setShowNickSelect(false)}>
        <View style={stylesLocal.modalContainer}>
          <View style={stylesLocal.modalContent}>
            <Text style={stylesLocal.modalTitle}>{t('Select style', { _tags: tags })}</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {nickCompleteStyles.map((styleName, idx) => (
                <TouchableOpacity
                  key={`${styleName}-${idx}`}
                  style={stylesLocal.presetItem}
                  onPress={() => handleNickSelect(styleName)}>
                  {renderNickPreview(styleName)}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={stylesLocal.modalButtonRow}>
              <TouchableOpacity
                style={[stylesLocal.modalButton, stylesLocal.modalButtonSecondary]}
                onPress={() => handleNickSelect('')}>
                <Text style={stylesLocal.modalButtonTextSecondary}>{t('Clear', { _tags: tags })}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[stylesLocal.modalButton, stylesLocal.modalButtonSecondary]}
                onPress={() => setShowNickSelect(false)}>
                <Text style={stylesLocal.modalButtonTextSecondary}>{t('Close', { _tags: tags })}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showStyleEditor} transparent animationType="fade" onRequestClose={closeStyleEditor}>
        <View style={stylesLocal.modalContainer}>
          <View style={stylesLocal.modalContent}>
            <Text style={stylesLocal.modalTitle}>
              {styleEditorIndex !== null ? t('Edit style', { _tags: tags }) : t('Add style', { _tags: tags })}
            </Text>
            <TextInput
              style={stylesLocal.editorInput}
              placeholder={styleEditorTarget === 'nick' ? t('Use <nick>', { _tags: tags }) : t('Use <text>', { _tags: tags })}
              placeholderTextColor={colors.textSecondary}
              value={styleEditorValue}
              onChangeText={setStyleEditorValue}
              multiline
            />
            <View style={stylesLocal.editorPreviewBox}>
              <Text style={stylesLocal.editorPreviewText}>
                {formatIRCTextAsComponent(styleEditorPreview, stylesLocal.editorPreviewText) || styleEditorPreview}
              </Text>
            </View>
            <View style={stylesLocal.modalRow}>
              <TouchableOpacity
                style={[stylesLocal.modalButton, stylesLocal.modalButtonSecondary]}
                onPress={() => {
                  setColorInsertTarget('editor');
                  setShowColorPicker(true);
                }}>
                <Text style={stylesLocal.modalButtonTextSecondary}>{t('Colors', { _tags: tags })}</Text>
              </TouchableOpacity>
            </View>
            <View style={stylesLocal.modalButtonRow}>
              <TouchableOpacity
                style={[stylesLocal.modalButton, stylesLocal.modalButtonSecondary]}
                onPress={closeStyleEditor}>
                <Text style={stylesLocal.modalButtonTextSecondary}>{t('Cancel', { _tags: tags })}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={stylesLocal.modalButton}
                onPress={handleSaveStyleEditor}>
                <Text style={stylesLocal.modalButtonText}>{t('Save', { _tags: tags })}</Text>
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

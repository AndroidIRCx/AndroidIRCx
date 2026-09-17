/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Alert,
} from 'react-native';
import Slider from '@react-native-community/slider';
import QRCode from 'react-native-qrcode-svg';
import Clipboard from '@react-native-clipboard/clipboard';
import { ModalSafeArea } from '../components/ModalSafeArea';
import {
  themeService,
  Theme,
  ThemeColors,
  ThemeMessageFormats,
} from '../services/ThemeService';
import { useT } from '../i18n/localization';
import { MessageFormatEditorScreen } from './MessageFormatEditorScreen';
import { getDefaultMessageFormats } from '../utils/MessageFormatDefaults';
import { deriveThemeColors } from '../themes/generateTheme';
import { failingContrast } from '../themes/contrastAudit';
import { hexToHsl, hslToHex, shades } from '../themes/hsl';
import { parsePalette } from '../themes/importPalette';
import { encodeThemeShare, decodeThemeShare } from '../themes/shareTheme';

type SeedSlot = 'background' | 'accent' | 'text';

interface ThemeEditorScreenProps {
  visible: boolean;
  theme?: Theme;
  onClose: () => void;
  onSave: (theme: Theme) => void;
}

export const ThemeEditorScreen: React.FC<ThemeEditorScreenProps> = ({
  visible,
  theme,
  onClose,
  onSave,
}) => {
  const t = useT();
  const selectedSwatchStyle = {
    borderColor: themeService.getColors().primary,
    borderWidth: 2,
  };
  const [themeName, setThemeName] = useState('');
  const [colors, setColors] = useState<ThemeColors>(themeService.getColors());
  const [messageFormats, setMessageFormats] = useState<
    ThemeMessageFormats | undefined
  >(undefined);
  const [messageFormatsDirty, setMessageFormatsDirty] = useState(false);
  const [showMessageFormatEditor, setShowMessageFormatEditor] = useState(false);
  const [editingColor, setEditingColor] = useState<keyof ThemeColors | null>(
    null,
  );
  const [colorValue, setColorValue] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [hexInput, setHexInput] = useState('');
  const [pickerMode, setPickerMode] = useState<'color' | 'seed'>('color');
  const [seedSlot, setSeedSlot] = useState<SeedSlot | null>(null);
  const [seedBackground, setSeedBackground] = useState('#121212');
  const [seedAccent, setSeedAccent] = useState('#4CAF50');
  const [seedText, setSeedText] = useState('');
  const [showImportPalette, setShowImportPalette] = useState(false);
  const [importText, setImportText] = useState('');
  const [showShare, setShowShare] = useState(false);
  const [importCode, setImportCode] = useState('');
  const initialMessageFormats = useMemo(
    () => messageFormats ?? getDefaultMessageFormats(),
    [messageFormats],
  );
  const failingPairs = useMemo(() => failingContrast(colors), [colors]);
  const shareCode = useMemo(
    () => encodeThemeShare({ name: themeName, colors, messageFormats }),
    [themeName, colors, messageFormats],
  );
  const pickerHsl =
    pickerMode === 'color'
      ? (hexToHsl(colorValue) ?? { h: 0, s: 0, l: 0 })
      : { h: 0, s: 0, l: 0 };
  const pickerShades = pickerMode === 'color' ? shades(colorValue) : [];

  useEffect(() => {
    const base = theme ? theme.colors : themeService.getColors();
    if (theme) {
      setThemeName(theme.name);
      setColors(theme.colors);
      setMessageFormats(theme.messageFormats);
    } else {
      setThemeName('');
      setColors(themeService.getColors());
      setMessageFormats(undefined);
    }
    setSeedBackground(base.background);
    setSeedAccent(base.accent);
    setSeedText('');
    setMessageFormatsDirty(false);
  }, [theme, visible]);

  const handleColorPress = (key: keyof ThemeColors) => {
    setPickerMode('color');
    setSeedSlot(null);
    setEditingColor(key);
    setColorValue(colors[key]);
    setHexInput(colors[key]);
    setShowColorPicker(true);
  };

  const seedValue = (slot: SeedSlot): string =>
    slot === 'background'
      ? seedBackground
      : slot === 'accent'
        ? seedAccent
        : seedText;

  const handleSeedPress = (slot: SeedSlot) => {
    setPickerMode('seed');
    setSeedSlot(slot);
    setEditingColor(null);
    const value = seedValue(slot);
    setColorValue(value);
    setHexInput(value);
    setShowColorPicker(true);
  };

  const handleGenerate = () => {
    if (!isValidColor(seedBackground) || !isValidColor(seedAccent)) {
      Alert.alert(
        t('Invalid Color'),
        t('Please choose a valid background and accent colour'),
      );
      return;
    }
    const generated = deriveThemeColors({
      background: seedBackground,
      accent: seedAccent,
      text: seedText && isValidColor(seedText) ? seedText : undefined,
    });
    setColors(generated);
  };

  const isValidColor = (value: string) => {
    const hexPattern = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    return hexPattern.test(value) || value.startsWith('rgba(');
  };

  const applyColorValue = (value: string) => {
    setColorValue(value);
    if (pickerMode === 'seed') {
      if (seedSlot === 'background') {
        setSeedBackground(value);
      } else if (seedSlot === 'accent') {
        setSeedAccent(value);
      } else if (seedSlot === 'text') {
        setSeedText(value);
      }
      return;
    }
    if (!editingColor) {
      return;
    }
    setColors(prev => ({
      ...prev,
      [editingColor]: value,
    }));
  };

  const applyHslChannel = (channel: 'h' | 's' | 'l', value: number) => {
    const next = hslToHex({ ...pickerHsl, [channel]: value });
    setHexInput(next);
    applyColorValue(next);
  };

  const handleImportPalette = () => {
    const parsed = parsePalette(importText);
    if (parsed.matchedKeys > 0) {
      setColors(prev => ({ ...prev, ...parsed.colors }));
      Alert.alert(
        t('Import palette'),
        t('Applied {count} colours', { count: parsed.matchedKeys }),
      );
      setShowImportPalette(false);
    } else if (parsed.seed) {
      setColors(deriveThemeColors(parsed.seed));
      Alert.alert(
        t('Import palette'),
        t('Generated a theme from {count} colours', {
          count: parsed.hexes.length,
        }),
      );
      setShowImportPalette(false);
    } else {
      Alert.alert(t('Import palette'), t('No colours found'));
    }
  };

  const handleCopyShareCode = () => {
    Clipboard.setString(shareCode);
    Alert.alert(t('Share'), t('Copied to clipboard'));
  };

  const handleLoadShareCode = () => {
    const payload = decodeThemeShare(importCode);
    if (!payload) {
      Alert.alert(t('Share'), t('Invalid code'));
      return;
    }
    setThemeName(payload.name);
    setColors(payload.colors);
    if (payload.messageFormats) {
      setMessageFormats(payload.messageFormats);
      setMessageFormatsDirty(true);
    }
    setShowShare(false);
  };

  const handleSave = async () => {
    if (!themeName.trim()) {
      Alert.alert(t('Error'), t('Please enter a theme name'));
      return;
    }

    if (theme) {
      // Update existing theme
      const updates: Partial<Theme> = {
        name: themeName,
        colors,
      };
      if (messageFormatsDirty) {
        updates.messageFormats = messageFormats;
      }
      await themeService.updateCustomTheme(theme.id, updates);
      onSave({
        ...theme,
        name: themeName,
        colors,
        messageFormats: messageFormatsDirty
          ? messageFormats
          : theme.messageFormats,
      });
    } else {
      // Create new theme
      const newTheme = await themeService.createCustomTheme(themeName, 'dark');
      const updates: Partial<Theme> = { colors };
      if (messageFormatsDirty) {
        updates.messageFormats = messageFormats;
      }
      await themeService.updateCustomTheme(newTheme.id, updates);
      onSave({
        ...newTheme,
        colors,
        messageFormats: messageFormatsDirty ? messageFormats : undefined,
      });
    }

    onClose();
  };

  const colorCategories: Array<{
    title: string;
    keys: Array<keyof ThemeColors>;
  }> = [
    {
      title: t('Background'),
      keys: [
        'background',
        'surface',
        'surfaceVariant',
        'surfaceAlt',
        'cardBackground',
      ],
    },
    {
      title: t('Text'),
      keys: ['text', 'textSecondary', 'textDisabled'],
    },
    {
      title: t('Primary'),
      keys: ['primary', 'primaryDark', 'primaryLight', 'onPrimary'],
    },
    {
      title: t('Secondary'),
      keys: ['secondary', 'onSecondary'],
    },
    {
      title: t('Accent'),
      keys: ['accent', 'onAccent'],
    },
    {
      title: t('Status'),
      keys: ['success', 'error', 'warning', 'info'],
    },
    {
      title: t('Borders'),
      keys: ['border', 'borderLight', 'divider'],
    },
    {
      title: t('Messages'),
      keys: [
        'messageBackground',
        'messageText',
        'messageNick',
        'messageTimestamp',
        'systemMessage',
        'noticeMessage',
        'joinMessage',
        'partMessage',
        'quitMessage',
        'kickMessage',
        'nickMessage',
        'modeMessage',
        'topicMessage',
        'inviteMessage',
        'monitorMessage',
        'actionMessage',
        'rawMessage',
        'ctcpMessage',
      ],
    },
    {
      title: t('Input'),
      keys: ['inputBackground', 'inputText', 'inputBorder', 'inputPlaceholder'],
    },
    {
      title: t('Buttons'),
      keys: [
        'buttonPrimary',
        'buttonPrimaryText',
        'buttonSecondary',
        'buttonSecondaryText',
        'buttonDisabled',
        'buttonDisabledText',
        'buttonText',
      ],
    },
    {
      title: t('Tabs'),
      keys: [
        'tabActive',
        'tabInactive',
        'tabActiveText',
        'tabInactiveText',
        'tabBorder',
      ],
    },
    {
      title: t('Modal'),
      keys: ['modalOverlay', 'modalBackground', 'modalText'],
    },
    {
      title: t('User List'),
      keys: [
        'userListBackground',
        'userListText',
        'userListBorder',
        'userOwner',
        'userAdmin',
        'userOp',
        'userHalfop',
        'userVoice',
        'userNormal',
      ],
    },
    {
      title: t('Highlights'),
      keys: ['highlightBackground', 'highlightText', 'selectionBackground'],
    },
  ];

  const currentColors = themeService.getColors();
  const predefinedColors = [
    '#000000',
    '#1A1A1A',
    '#2D2D2D',
    '#3C3C3C',
    '#4A4A4A',
    '#5C5C5C',
    '#6B6B6B',
    '#8A8A8A',
    '#B0B0B0',
    '#D0D0D0',
    '#E6E6E6',
    '#FFFFFF',
    '#1E3A8A',
    '#2563EB',
    '#3B82F6',
    '#60A5FA',
    '#93C5FD',
    '#0F766E',
    '#14B8A6',
    '#2DD4BF',
    '#34D399',
    '#10B981',
    '#16A34A',
    '#22C55E',
    '#4ADE80',
    '#86EFAC',
    '#F59E0B',
    '#F97316',
    '#EA580C',
    '#EF4444',
    '#DC2626',
    '#B91C1C',
    '#7C3AED',
    '#A855F7',
    '#C084FC',
  ];

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <ModalSafeArea
        style={[
          styles.container,
          { backgroundColor: currentColors.background },
        ]}
      >
        <View
          style={[
            styles.header,
            {
              backgroundColor: currentColors.primary,
              borderBottomColor: currentColors.divider,
            },
          ]}
        >
          <TouchableOpacity onPress={onClose} style={styles.cancelButton}>
            <Text
              style={[styles.cancelText, { color: currentColors.onPrimary }]}
            >
              {t('Cancel')}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: currentColors.onPrimary }]}>
            {theme ? t('Edit Theme') : t('New Theme')}
          </Text>
          <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
            <Text style={[styles.saveText, { color: currentColors.onPrimary }]}>
              {t('Save')}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          <View
            style={[
              styles.section,
              { borderBottomColor: currentColors.divider },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: currentColors.text }]}>
              {t('Theme Name')}
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: currentColors.surface,
                  color: currentColors.text,
                  borderColor: currentColors.border,
                },
              ]}
              value={themeName}
              onChangeText={setThemeName}
              placeholder={t('Enter theme name')}
              placeholderTextColor={currentColors.textSecondary}
            />
          </View>
          <View
            style={[
              styles.section,
              { borderBottomColor: currentColors.divider },
            ]}
          >
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: currentColors.surface,
                    borderColor: currentColors.border,
                  },
                ]}
                onPress={() => {
                  setImportText('');
                  setShowImportPalette(true);
                }}
              >
                <Text
                  style={[
                    styles.actionButtonText,
                    { color: currentColors.text },
                  ]}
                >
                  {t('Import palette')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: currentColors.surface,
                    borderColor: currentColors.border,
                  },
                ]}
                onPress={() => {
                  setImportCode('');
                  setShowShare(true);
                }}
              >
                <Text
                  style={[
                    styles.actionButtonText,
                    { color: currentColors.text },
                  ]}
                >
                  {t('Share')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <View
            style={[
              styles.section,
              { borderBottomColor: currentColors.divider },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: currentColors.text }]}>
              {t('Message format')}
            </Text>
            <TouchableOpacity
              style={[
                styles.formatButton,
                {
                  backgroundColor: currentColors.surface,
                  borderColor: currentColors.border,
                },
              ]}
              onPress={() => setShowMessageFormatEditor(true)}
            >
              <Text
                style={[styles.formatButtonText, { color: currentColors.text }]}
              >
                {messageFormats ? t('Edit format') : t('Customize format')}
              </Text>
            </TouchableOpacity>
          </View>

          <View
            style={[
              styles.section,
              { borderBottomColor: currentColors.divider },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: currentColors.text }]}>
              {t('Live preview')}
            </Text>
            <View
              style={[
                styles.previewSurface,
                {
                  backgroundColor: colors.messageBackground,
                  borderColor: currentColors.border,
                },
              ]}
            >
              <Text style={styles.previewLine}>
                <Text style={{ color: colors.messageTimestamp }}>[12:34] </Text>
                <Text style={{ color: colors.messageNick }}>{'<nick> '}</Text>
                <Text style={{ color: colors.messageText }}>
                  {t('Hey, welcome to the channel!')}
                </Text>
              </Text>
              <Text style={[styles.previewLine, { color: colors.joinMessage }]}>
                {t('→ nick has joined #general')}
              </Text>
              <Text
                style={[styles.previewLine, { color: colors.actionMessage }]}
              >
                {t('* nick waves hello')}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.section,
              { borderBottomColor: currentColors.divider },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: currentColors.text }]}>
              {t('Accessibility')}
            </Text>
            {failingPairs.length === 0 ? (
              <Text style={[styles.a11yPass, { color: currentColors.success }]}>
                {t('All text meets WCAG AA')}
              </Text>
            ) : (
              failingPairs.map(check => (
                <Text
                  key={`${check.fg}-${check.bg}`}
                  style={[styles.a11yFail, { color: currentColors.warning }]}
                >
                  {t('{label} — {ratio}:1', {
                    label: t(check.label),
                    ratio: check.ratio,
                  })}
                </Text>
              ))
            )}
          </View>

          <View
            style={[
              styles.section,
              { borderBottomColor: currentColors.divider },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: currentColors.text }]}>
              {t('Generate from seed')}
            </Text>
            {[
              { slot: 'background' as SeedSlot, label: t('Background') },
              { slot: 'accent' as SeedSlot, label: t('Accent') },
              { slot: 'text' as SeedSlot, label: t('Text (optional)') },
            ].map(({ slot, label }) => {
              const value = seedValue(slot);
              return (
                <View key={slot} style={styles.colorRow}>
                  <Text
                    style={[
                      styles.colorLabel,
                      { color: currentColors.textSecondary },
                    ]}
                  >
                    {label}
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.colorPreview,
                      {
                        backgroundColor: value || currentColors.surfaceVariant,
                        borderColor: currentColors.border,
                      },
                    ]}
                    onPress={() => handleSeedPress(slot)}
                  >
                    {!value && (
                      <Text
                        style={[
                          styles.seedAutoText,
                          { color: currentColors.textSecondary },
                        ]}
                      >
                        {t('Auto')}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}
            <TouchableOpacity
              style={[
                styles.formatButton,
                {
                  backgroundColor: currentColors.primary,
                  borderColor: currentColors.primary,
                },
              ]}
              onPress={handleGenerate}
            >
              <Text
                style={[
                  styles.formatButtonText,
                  { color: currentColors.onPrimary },
                ]}
              >
                {t('Generate theme')}
              </Text>
            </TouchableOpacity>
          </View>

          {colorCategories.map(category => (
            <View
              key={category.title}
              style={[
                styles.section,
                { borderBottomColor: currentColors.divider },
              ]}
            >
              <Text
                style={[styles.sectionTitle, { color: currentColors.text }]}
              >
                {category.title}
              </Text>
              {category.keys.map(key => (
                <View key={key} style={styles.colorRow}>
                  <Text
                    style={[
                      styles.colorLabel,
                      { color: currentColors.textSecondary },
                    ]}
                  >
                    {key}
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.colorPreview,
                      { backgroundColor: colors[key] },
                      { borderColor: currentColors.border },
                    ]}
                    onPress={() => handleColorPress(key)}
                  />
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      </ModalSafeArea>
      <Modal
        visible={showColorPicker}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowColorPicker(false);
          setEditingColor(null);
          setHexInput('');
        }}
      >
        <View
          style={[
            styles.pickerOverlay,
            { backgroundColor: currentColors.modalOverlay },
          ]}
        >
          <View
            style={[
              styles.pickerContainer,
              { backgroundColor: currentColors.surface },
            ]}
          >
            <Text style={[styles.pickerTitle, { color: currentColors.text }]}>
              {t('Choose Color')}
            </Text>
            <Text
              style={[
                styles.pickerSubtitle,
                { color: currentColors.textSecondary },
              ]}
            >
              {t('Current color: {color}', { color: colorValue || '' })}
            </Text>
            <View style={styles.pickerPreviewRow}>
              <View
                style={[
                  styles.pickerPreview,
                  {
                    backgroundColor: colorValue || currentColors.surfaceVariant,
                    borderColor: currentColors.border,
                  },
                ]}
              />
            </View>
            <View style={styles.pickerInputRow}>
              <Text style={[styles.pickerLabel, { color: currentColors.text }]}>
                {t('Hex Color:')}
              </Text>
              <TextInput
                style={[
                  styles.pickerInput,
                  {
                    backgroundColor: currentColors.surface,
                    color: currentColors.text,
                    borderColor: currentColors.border,
                  },
                ]}
                value={hexInput}
                onChangeText={text => {
                  setHexInput(text);
                  if (isValidColor(text)) {
                    applyColorValue(text);
                  }
                }}
                placeholder={t('#FFFFFF')}
                placeholderTextColor={currentColors.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            {pickerMode === 'color' && (
              <View style={styles.sliderBlock}>
                <Text
                  style={[styles.sliderLabel, { color: currentColors.text }]}
                >
                  {t('Hue')}
                </Text>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={360}
                  value={pickerHsl.h}
                  minimumTrackTintColor={currentColors.primary}
                  maximumTrackTintColor={currentColors.border}
                  onValueChange={value => applyHslChannel('h', value)}
                />
                <Text
                  style={[styles.sliderLabel, { color: currentColors.text }]}
                >
                  {t('Saturation')}
                </Text>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={100}
                  value={pickerHsl.s}
                  minimumTrackTintColor={currentColors.primary}
                  maximumTrackTintColor={currentColors.border}
                  onValueChange={value => applyHslChannel('s', value)}
                />
                <Text
                  style={[styles.sliderLabel, { color: currentColors.text }]}
                >
                  {t('Lightness')}
                </Text>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={100}
                  value={pickerHsl.l}
                  minimumTrackTintColor={currentColors.primary}
                  maximumTrackTintColor={currentColors.border}
                  onValueChange={value => applyHslChannel('l', value)}
                />
                <View style={styles.shadesRow}>
                  {pickerShades.map(shade => (
                    <TouchableOpacity
                      key={shade}
                      style={[
                        styles.shadeSwatch,
                        { backgroundColor: shade },
                        shade === colorValue && selectedSwatchStyle,
                      ]}
                      onPress={() => {
                        setHexInput(shade);
                        applyColorValue(shade);
                      }}
                    />
                  ))}
                </View>
              </View>
            )}
            <ScrollView style={styles.pickerGridScroll}>
              <View style={styles.pickerGrid}>
                {predefinedColors.map(value => (
                  <TouchableOpacity
                    key={value}
                    style={[
                      styles.pickerSwatch,
                      { backgroundColor: value },
                      value === colorValue && selectedSwatchStyle,
                    ]}
                    onPress={() => {
                      setHexInput(value);
                      applyColorValue(value);
                    }}
                  />
                ))}
              </View>
            </ScrollView>
            <View style={styles.pickerActions}>
              <TouchableOpacity
                style={[
                  styles.pickerButton,
                  { backgroundColor: currentColors.surfaceVariant },
                ]}
                onPress={() => {
                  setShowColorPicker(false);
                  setEditingColor(null);
                  setHexInput('');
                }}
              >
                <Text
                  style={[
                    styles.pickerButtonText,
                    { color: currentColors.text },
                  ]}
                >
                  {t('Cancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.pickerButton,
                  { backgroundColor: currentColors.primary },
                ]}
                onPress={() => {
                  if (hexInput && !isValidColor(hexInput)) {
                    Alert.alert(
                      t('Invalid Color'),
                      t(
                        'Please enter a valid hex color (e.g., #FF0000) or rgba value',
                      ),
                    );
                    return;
                  }
                  setShowColorPicker(false);
                  setEditingColor(null);
                  setHexInput('');
                }}
              >
                <Text
                  style={[
                    styles.pickerButtonText,
                    { color: currentColors.onPrimary },
                  ]}
                >
                  {t('Done')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={showImportPalette}
        transparent
        animationType="slide"
        onRequestClose={() => setShowImportPalette(false)}
      >
        <View
          style={[
            styles.pickerOverlay,
            { backgroundColor: currentColors.modalOverlay },
          ]}
        >
          <View
            style={[
              styles.pickerContainer,
              { backgroundColor: currentColors.surface },
            ]}
          >
            <Text style={[styles.pickerTitle, { color: currentColors.text }]}>
              {t('Import palette')}
            </Text>
            <Text
              style={[
                styles.pickerSubtitle,
                { color: currentColors.textSecondary },
              ]}
            >
              {t('Paste colours, key: #hex lines, JSON, or a share list')}
            </Text>
            <TextInput
              style={[
                styles.importInput,
                {
                  backgroundColor: currentColors.surface,
                  color: currentColors.text,
                  borderColor: currentColors.border,
                },
              ]}
              value={importText}
              onChangeText={setImportText}
              placeholder={t('Paste palette here')}
              placeholderTextColor={currentColors.textSecondary}
              multiline
              textAlignVertical="top"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.pickerActions}>
              <TouchableOpacity
                style={[
                  styles.pickerButton,
                  { backgroundColor: currentColors.surfaceVariant },
                ]}
                onPress={() => setShowImportPalette(false)}
              >
                <Text
                  style={[
                    styles.pickerButtonText,
                    { color: currentColors.text },
                  ]}
                >
                  {t('Cancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.pickerButton,
                  { backgroundColor: currentColors.primary },
                ]}
                onPress={handleImportPalette}
              >
                <Text
                  style={[
                    styles.pickerButtonText,
                    { color: currentColors.onPrimary },
                  ]}
                >
                  {t('Apply')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={showShare}
        transparent
        animationType="slide"
        onRequestClose={() => setShowShare(false)}
      >
        <View
          style={[
            styles.pickerOverlay,
            { backgroundColor: currentColors.modalOverlay },
          ]}
        >
          <View
            style={[
              styles.pickerContainer,
              { backgroundColor: currentColors.surface },
            ]}
          >
            <ScrollView>
              <Text style={[styles.pickerTitle, { color: currentColors.text }]}>
                {t('Share')}
              </Text>
              <Text
                selectable
                style={[
                  styles.shareCode,
                  {
                    color: currentColors.text,
                    backgroundColor: currentColors.surfaceVariant,
                    borderColor: currentColors.border,
                  },
                ]}
              >
                {shareCode}
              </Text>
              <TouchableOpacity
                style={[
                  styles.formatButton,
                  {
                    backgroundColor: currentColors.surfaceVariant,
                    borderColor: currentColors.border,
                  },
                ]}
                onPress={handleCopyShareCode}
              >
                <Text
                  style={[
                    styles.formatButtonText,
                    { color: currentColors.text },
                  ]}
                >
                  {t('Copy')}
                </Text>
              </TouchableOpacity>
              <View style={styles.qrRow}>
                <QRCode value={shareCode} size={200} />
              </View>
              <Text style={[styles.pickerLabel, { color: currentColors.text }]}>
                {t('Import from code')}
              </Text>
              <TextInput
                style={[
                  styles.pickerInput,
                  {
                    backgroundColor: currentColors.surface,
                    color: currentColors.text,
                    borderColor: currentColors.border,
                  },
                ]}
                value={importCode}
                onChangeText={setImportCode}
                placeholder={t('Paste a share code')}
                placeholderTextColor={currentColors.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={styles.pickerActions}>
                <TouchableOpacity
                  style={[
                    styles.pickerButton,
                    { backgroundColor: currentColors.surfaceVariant },
                  ]}
                  onPress={() => setShowShare(false)}
                >
                  <Text
                    style={[
                      styles.pickerButtonText,
                      { color: currentColors.text },
                    ]}
                  >
                    {t('Close')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.pickerButton,
                    { backgroundColor: currentColors.primary },
                  ]}
                  onPress={handleLoadShareCode}
                >
                  <Text
                    style={[
                      styles.pickerButtonText,
                      { color: currentColors.onPrimary },
                    ]}
                  >
                    {t('Load')}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
      <MessageFormatEditorScreen
        visible={showMessageFormatEditor}
        colors={currentColors}
        initialFormats={initialMessageFormats}
        onSave={formats => {
          setMessageFormats(formats);
          setMessageFormatsDirty(true);
          setShowMessageFormatEditor(false);
        }}
        onCancel={() => setShowMessageFormatEditor(false)}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  cancelButton: {
    padding: 8,
  },
  cancelText: {
    fontSize: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  saveButton: {
    padding: 8,
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  formatButton: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  formatButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 4,
    padding: 12,
    fontSize: 14,
  },
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 4,
  },
  colorLabel: {
    flex: 1,
    fontSize: 14,
  },
  previewSurface: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
  previewLine: {
    fontSize: 13,
    fontFamily: 'monospace',
  },
  seedAutoText: {
    fontSize: 9,
    textAlign: 'center',
    lineHeight: 40,
  },
  colorPreview: {
    width: 40,
    height: 40,
    borderRadius: 4,
    borderWidth: 1,
    marginLeft: 12,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerContainer: {
    width: '90%',
    maxWidth: 420,
    borderRadius: 12,
    padding: 16,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 6,
  },
  pickerSubtitle: {
    fontSize: 12,
    marginBottom: 12,
  },
  pickerPreviewRow: {
    alignItems: 'center',
    marginBottom: 12,
  },
  pickerPreview: {
    width: 72,
    height: 72,
    borderRadius: 8,
    borderWidth: 1,
  },
  pickerInputRow: {
    marginBottom: 12,
  },
  pickerLabel: {
    fontSize: 12,
    marginBottom: 6,
  },
  pickerInput: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
  },
  pickerGridScroll: {
    maxHeight: 220,
    marginBottom: 12,
  },
  pickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pickerSwatch: {
    width: 32,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  pickerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  pickerButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  pickerButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  a11yPass: {
    fontSize: 13,
    fontWeight: '600',
  },
  a11yFail: {
    fontSize: 13,
    marginBottom: 6,
  },
  sliderBlock: {
    marginBottom: 12,
  },
  sliderLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  slider: {
    width: '100%',
    height: 32,
  },
  shadesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  shadeSwatch: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  importInput: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
    fontSize: 13,
    minHeight: 140,
    marginBottom: 12,
  },
  shareCode: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
    fontSize: 11,
    fontFamily: 'monospace',
    marginBottom: 12,
  },
  qrRow: {
    alignItems: 'center',
    marginVertical: 12,
  },
});

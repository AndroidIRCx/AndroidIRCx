/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React, { useState } from 'react';
import { Modal, ScrollView, TouchableOpacity, View, Text, StyleSheet, TextInput } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { SettingItem } from '../SettingItem';
import { useSettingsSecurity } from '../../../hooks/useSettingsSecurity';
import { useT } from '../../../i18n/transifex';
import { SettingItem as SettingItemType, SettingIcon } from '../../../types/settings';

interface SecurityQuickConnectSectionProps {
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
  };
  settingIcons: Record<string, SettingIcon | undefined>;
}

export const SecurityQuickConnectSection: React.FC<SecurityQuickConnectSectionProps> = ({
  colors,
  styles,
  settingIcons,
}) => {
  const t = useT();
  const tags = 'screen:settings,file:SecurityQuickConnectSection.tsx,feature:settings';
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [hexInput, setHexInput] = useState('');

  const predefinedColors = [
    { name: 'Red', hex: '#f44336' },
    { name: 'Pink', hex: '#e91e63' },
    { name: 'Purple', hex: '#9c27b0' },
    { name: 'Deep Purple', hex: '#673ab7' },
    { name: 'Indigo', hex: '#3f51b5' },
    { name: 'Blue', hex: '#2196f3' },
    { name: 'Light Blue', hex: '#03a9f4' },
    { name: 'Cyan', hex: '#00bcd4' },
    { name: 'Teal', hex: '#009688' },
    { name: 'Green', hex: '#4caf50' },
    { name: 'Light Green', hex: '#8bc34a' },
    { name: 'Lime', hex: '#cddc39' },
    { name: 'Yellow', hex: '#ffeb3b' },
    { name: 'Amber', hex: '#ffc107' },
    { name: 'Orange', hex: '#ff9800' },
    { name: 'Deep Orange', hex: '#ff5722' },
    { name: 'Brown', hex: '#795548' },
    { name: 'Grey', hex: '#9e9e9e' },
    { name: 'Blue Grey', hex: '#607d8b' },
    { name: 'Black', hex: '#000000' },
  ];

  const {
    killSwitchEnabledOnHeader,
    killSwitchEnabledOnLockScreen,
    killSwitchShowWarnings,
    killSwitchCustomName,
    killSwitchCustomIcon,
    killSwitchCustomColor,
    setKillSwitchEnabledOnHeader,
    setKillSwitchEnabledOnLockScreen,
    setKillSwitchShowWarnings,
    setKillSwitchCustomName,
    setKillSwitchCustomIcon,
    setKillSwitchCustomColor,
  } = useSettingsSecurity();

  const sectionData: SettingItemType[] = [
    {
      id: 'kill-switch-header',
      title: t('Kill Switch on Header', { _tags: tags }),
      description: t('Show kill switch button in header', { _tags: tags }),
      type: 'switch',
      value: killSwitchEnabledOnHeader,
      searchKeywords: ['kill', 'switch', 'header', 'emergency', 'wipe', 'delete', 'panic', 'button', 'show'],
      onValueChange: async (value: boolean | string) => {
        await setKillSwitchEnabledOnHeader(value as boolean);
      },
    },
    {
      id: 'kill-switch-lockscreen',
      title: t('Kill Switch on Lock Screen', { _tags: tags }),
      description: t('Show kill switch button on app unlock screen', { _tags: tags }),
      type: 'switch',
      value: killSwitchEnabledOnLockScreen,
      searchKeywords: ['kill', 'switch', 'lock', 'screen', 'unlock', 'emergency', 'wipe', 'delete', 'panic', 'button'],
      onValueChange: async (value: boolean | string) => {
        await setKillSwitchEnabledOnLockScreen(value as boolean);
      },
    },
    {
      id: 'kill-switch-warnings',
      title: t('Show Kill Switch Warnings', { _tags: tags }),
      description: t('Show confirmation dialogs before activating kill switch (header only)', { _tags: tags }),
      type: 'switch',
      value: killSwitchShowWarnings,
      searchKeywords: ['kill', 'switch', 'warnings', 'confirmation', 'dialog', 'alert', 'show'],
      onValueChange: async (value: boolean | string) => {
        await setKillSwitchShowWarnings(value as boolean);
      },
    },
    {
      id: 'kill-switch-custom-name',
      title: t('Kill Switch Custom Name', { _tags: tags }),
      description: t('Custom name for kill switch button (e.g., "meow meow" for obfuscation)', { _tags: tags }),
      type: 'input',
      value: killSwitchCustomName,
      placeholder: t('Enter custom name', { _tags: tags }),
      searchKeywords: ['kill', 'switch', 'name', 'custom', 'rename', 'obfuscate', 'hide'],
      onValueChange: async (value: boolean | string) => {
        await setKillSwitchCustomName(value as string);
      },
    },
    {
      id: 'kill-switch-custom-icon',
      title: t('Kill Switch Custom Icon', { _tags: tags }),
      description: t('FontAwesome5 icon name (e.g., "cat", "heart", "star")', { _tags: tags }),
      type: 'input',
      value: killSwitchCustomIcon,
      placeholder: t('Enter icon name', { _tags: tags }),
      searchKeywords: ['kill', 'switch', 'icon', 'custom', 'fontawesome', 'change'],
      onValueChange: async (value: boolean | string) => {
        await setKillSwitchCustomIcon(value as string);
      },
    },
    {
      id: 'kill-switch-custom-color',
      title: t('Kill Switch Custom Color', { _tags: tags }),
      description: t('Tap to choose from preset colors or enter hex code', { _tags: tags }),
      type: 'button',
      searchKeywords: ['kill', 'switch', 'color', 'custom', 'hex', 'change', 'picker'],
      onPress: () => {
        setShowColorPicker(true);
      },
    },
  ];

  return (
    <>
      {sectionData.map((item) => {
        const itemIcon = (typeof item.icon === 'object' ? item.icon : undefined) || settingIcons[item.id];
        return (
          <SettingItem
            key={item.id}
            item={item}
            icon={itemIcon}
            colors={colors}
            styles={styles}
          />
        );
      })}

      {/* Color Picker Modal */}
      <Modal
        visible={showColorPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowColorPicker(false)}>
        <View style={modalStyles.overlay}>
          <View style={[modalStyles.container, { backgroundColor: colors.surface }]}>
            <Text style={[modalStyles.title, { color: colors.text }]}>
              {t('Choose Color', { _tags: tags })}
            </Text>
            <Text style={[modalStyles.description, { color: colors.textSecondary }]}>
              {t('Current color: {color}', { color: killSwitchCustomColor, _tags: tags })}
            </Text>

            {/* Live Preview */}
            <View style={colorPickerStyles.livePreview}>
              <View style={[colorPickerStyles.previewButton, { borderColor: killSwitchCustomColor }]}>
                <Icon name={killSwitchCustomIcon} size={20} color={killSwitchCustomColor} solid style={{ marginRight: 8 }} />
                <Text style={[colorPickerStyles.previewText, { color: killSwitchCustomColor }]}>
                  {killSwitchCustomName}
                </Text>
              </View>
            </View>

            {/* Color preview box */}
            <View style={[colorPickerStyles.colorPreview, { backgroundColor: killSwitchCustomColor }]} />

            {/* Hex Input */}
            <View style={colorPickerStyles.hexInputContainer}>
              <Text style={[colorPickerStyles.hexLabel, { color: colors.text }]}>
                {t('Hex Color:', { _tags: tags })}
              </Text>
              <TextInput
                style={[colorPickerStyles.hexInput, { color: colors.text, borderColor: colors.border }]}
                value={hexInput || killSwitchCustomColor}
                onChangeText={(text) => {
                  setHexInput(text);
                  // Validate and apply if valid hex color
                  const hexPattern = /^#[0-9A-Fa-f]{6}$/;
                  if (hexPattern.test(text)) {
                    setKillSwitchCustomColor(text);
                  }
                }}
                placeholder="#ff0000"
                placeholderTextColor={colors.textSecondary}
                maxLength={7}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Predefined colors grid */}
            <ScrollView style={modalStyles.scroll}>
              <View style={colorPickerStyles.colorGrid}>
                {predefinedColors.map((color, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      colorPickerStyles.colorButton,
                      { backgroundColor: color.hex },
                      killSwitchCustomColor === color.hex && colorPickerStyles.colorButtonSelected,
                    ]}
                    onPress={async () => {
                      await setKillSwitchCustomColor(color.hex);
                    }}>
                    {killSwitchCustomColor === color.hex && (
                      <Text style={colorPickerStyles.checkmark}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[modalStyles.closeButton, { backgroundColor: colors.primary }]}
              onPress={() => {
                setShowColorPicker(false);
                setHexInput(''); // Clear hex input on close
              }}>
              <Text style={modalStyles.closeButtonText}>
                {t('Done', { _tags: tags })}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    borderRadius: 8,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  scroll: {
    maxHeight: 300,
    marginBottom: 12,
  },
  item: {
    padding: 12,
    borderBottomWidth: 1,
  },
  itemText: {
    fontSize: 16,
  },
  itemTextSelected: {
    fontWeight: '600',
  },
  closeButton: {
    padding: 12,
    borderRadius: 4,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
});

const colorPickerStyles = StyleSheet.create({
  livePreview: {
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  previewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },
  previewText: {
    fontSize: 16,
    fontWeight: '600',
  },
  colorPreview: {
    width: '100%',
    height: 50,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  hexInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  hexLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  hexInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 4,
    padding: 10,
    fontSize: 14,
    fontFamily: 'monospace',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  colorButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
    borderColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorButtonSelected: {
    borderColor: '#000',
  },
  checkmark: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: 'bold',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});

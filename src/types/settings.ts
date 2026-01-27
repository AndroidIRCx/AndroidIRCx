/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { StyleProp, ViewStyle, TextInputProps } from 'react-native';

/**
 * Icon configuration for settings
 */
export interface SettingIcon {
  name: string;
  solid: boolean;
}

/**
 * Type of setting item
 */
export type SettingItemType = 'switch' | 'button' | 'input' | 'submenu' | 'custom';

/**
 * Keyboard type for input settings
 */
export type SettingKeyboardType = 'default' | 'numeric' | 'email-address';

/**
 * Base setting item interface
 */
export interface SettingItem {
  id: string;
  title: string;
  description?: string;
  error?: string;
  type: SettingItemType;
  value?: boolean | string;
  onPress?: () => void;
  onValueChange?: (value: boolean | string) => void;
  placeholder?: string;
  keyboardType?: SettingKeyboardType;
  disabled?: boolean;
  submenuItems?: SettingItem[];
  secureTextEntry?: boolean;
  icon?: string | SettingIcon;
  searchKeywords?: string[]; // Keywords for better search results
}

/**
 * Settings section configuration
 */
export interface SettingsSection {
  id: string;
  title: string;
  data: SettingItem[];
}

/**
 * Icon mapping for settings
 */
export type SettingIconMap = Record<string, SettingIcon | undefined>;

/**
 * Props for setting components
 */
export interface SettingComponentProps {
  item: SettingItem;
  icon?: SettingIcon;
  colors: {
    text: string;
    textSecondary: string;
    primary: string;
    surface: string;
    border: string;
    background: string;
  };
  styles: {
    settingItem: StyleProp<ViewStyle>;
    settingContent: StyleProp<ViewStyle>;
    settingTitleRow: StyleProp<ViewStyle>;
    settingTitle: StyleProp<any>;
    settingDescription: StyleProp<any>;
    disabledItem: StyleProp<ViewStyle>;
    disabledText: StyleProp<any>;
    chevron: StyleProp<any>;
    input?: StyleProp<any>;
    disabledInput?: StyleProp<any>;
    watchAdButton?: StyleProp<ViewStyle>;
    watchAdButtonDisabled?: StyleProp<ViewStyle>;
    watchAdButtonText?: StyleProp<any>;
  };
}

/**
 * Props for SettingSwitch component
 */
export interface SettingSwitchProps extends SettingComponentProps {
  onValueChange: (value: boolean) => void;
}

/**
 * Props for SettingButton component
 */
export interface SettingButtonProps extends SettingComponentProps {
  onPress: () => void;
}

/**
 * Props for SettingInput component
 */
export interface SettingInputProps extends SettingComponentProps {
  onValueChange: (value: string) => void;
  onPress?: () => void;
}

/**
 * Props for SettingSubmenu component
 */
export interface SettingSubmenuProps extends SettingComponentProps {
  onPress: () => void;
}

/**
 * Props for custom setting components (like watch ad button)
 */
export interface CustomSettingProps {
  item: SettingItem;
  colors: SettingComponentProps['colors'];
  styles: SettingComponentProps['styles'];
  [key: string]: any; // Allow additional props for custom components
}

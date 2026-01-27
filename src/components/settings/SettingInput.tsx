/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React, { useEffect, useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { SettingInputProps } from '../../types/settings';

export const SettingInput: React.FC<SettingInputProps> = ({
  item,
  icon,
  colors,
  styles,
  onValueChange,
  onPress,
}) => {
  const itemIcon = icon;
  const [isFocused, setIsFocused] = useState(false);
  const [displayValue, setDisplayValue] = useState<string>((item.value as string) || '');

  useEffect(() => {
    // When not focused, always reflect the latest external value.
    if (!isFocused) {
      setDisplayValue((item.value as string) || '');
    }
  }, [item.value, isFocused]);

  return (
    <View style={[styles.settingItem, item.disabled && styles.disabledItem]}>
      <View style={styles.settingContent}>
        <View style={styles.settingTitleRow}>
          {!!itemIcon && typeof itemIcon === 'object' && (
            <Icon
              name={itemIcon.name}
              size={16}
              color={item.disabled ? colors.textSecondary : colors.primary}
              solid={itemIcon.solid}
              style={{ marginRight: 8 }}
            />
          )}
          <Text style={[styles.settingTitle, item.disabled && styles.disabledText]}>
            {item.title}
          </Text>
        </View>
        {item.description && (
          <Text style={[styles.settingDescription, item.disabled && styles.disabledText]}>
            {item.description}
          </Text>
        )}
        <TextInput
          style={[
            styles.input,
            item.disabled && styles.disabledInput,
            { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border },
          ]}
          value={displayValue}
          onChangeText={(value) => {
            setDisplayValue(value);
            onValueChange(value);
          }}
          placeholder={item.placeholder}
          placeholderTextColor={colors.textSecondary}
          keyboardType={item.keyboardType || 'default'}
          editable={!item.disabled}
          secureTextEntry={item.secureTextEntry}
          returnKeyType={onPress ? 'done' : 'default'}
          blurOnSubmit={!!onPress}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false);
            // Snap back to the accepted value on blur.
            setDisplayValue((item.value as string) || '');
          }}
          onSubmitEditing={() => {
            if (!item.disabled && onPress) {
              onPress();
            }
          }}
        />
        {!!item.error && (
          <Text style={{ color: '#ff5252', marginTop: 4, fontSize: 12 }}>
            {item.error}
          </Text>
        )}
      </View>
    </View>
  );
};

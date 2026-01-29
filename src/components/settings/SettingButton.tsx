/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { SettingButtonProps } from '../../types/settings';

export const SettingButton: React.FC<SettingButtonProps> = ({
  item,
  icon,
  colors,
  styles,
  onPress,
}) => {
  const itemIcon = icon;
  const descriptionContent = item.descriptionNode ?? item.description;

  return (
    <TouchableOpacity
      style={[styles.settingItem, item.disabled && styles.disabledItem]}
      onPress={onPress}
      disabled={item.disabled}
    >
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
        {descriptionContent && (
          typeof descriptionContent === 'string' || typeof descriptionContent === 'number'
            ? (
              <Text style={[styles.settingDescription, item.disabled && styles.disabledText]}>
                {descriptionContent}
              </Text>
            )
            : (
              <View style={{ marginTop: 4 }}>
                {descriptionContent}
              </View>
            )
        )}
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
};

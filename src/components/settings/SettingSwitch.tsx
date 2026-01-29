/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { View, Text, Switch } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { SettingSwitchProps } from '../../types/settings';

export const SettingSwitch: React.FC<SettingSwitchProps> = ({
  item,
  icon,
  colors,
  styles,
  onValueChange,
}) => {
  const itemIcon = icon;
  const descriptionContent = item.descriptionNode ?? item.description;

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
      <Switch
        value={item.value as boolean}
        onValueChange={onValueChange}
        disabled={item.disabled}
      />
    </View>
  );
};

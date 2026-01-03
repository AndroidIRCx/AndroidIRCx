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
        {item.description && (
          <Text style={[styles.settingDescription, item.disabled && styles.disabledText]}>
            {item.description}
          </Text>
        )}
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
};

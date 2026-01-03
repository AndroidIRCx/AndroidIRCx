import React from 'react';
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
          value={item.value as string}
          onChangeText={onValueChange}
          placeholder={item.placeholder}
          placeholderTextColor={colors.textSecondary}
          keyboardType={item.keyboardType || 'default'}
          editable={!item.disabled}
          secureTextEntry={item.secureTextEntry}
          returnKeyType={onPress ? 'done' : 'default'}
          blurOnSubmit={!!onPress}
          onSubmitEditing={() => {
            if (!item.disabled && onPress) {
              onPress();
            }
          }}
        />
      </View>
    </View>
  );
};

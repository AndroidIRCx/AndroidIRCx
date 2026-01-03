import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';

export interface SettingsSectionHeaderProps {
  title: string;
  icon?: {
    name: string;
    solid: boolean;
  };
  isExpanded: boolean;
  onToggle: () => void;
  disabled?: boolean;
  colors: {
    primary: string;
    text: string;
  };
  styles: {
    sectionHeader: any;
    sectionTitleContainer: any;
    sectionIcon: any;
    sectionTitle: any;
    sectionToggle: any;
  };
}

export const SettingsSectionHeader: React.FC<SettingsSectionHeaderProps> = ({
  title,
  icon,
  isExpanded,
  onToggle,
  disabled = false,
  colors,
  styles,
}) => {
  return (
    <TouchableOpacity
      onPress={onToggle}
      style={styles.sectionHeader}
      disabled={disabled}
    >
      <View style={styles.sectionTitleContainer}>
        {icon && (
          <Icon
            name={icon.name}
            size={18}
            color={colors.primary}
            solid={icon.solid}
            style={styles.sectionIcon}
          />
        )}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {!disabled && (
        <Text style={styles.sectionToggle}>{isExpanded ? '-' : '+'}</Text>
      )}
    </TouchableOpacity>
  );
};

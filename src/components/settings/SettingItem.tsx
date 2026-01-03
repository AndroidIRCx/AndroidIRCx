import React from 'react';
import { SettingItem as SettingItemType, SettingIcon } from '../../types/settings';
import { SettingSwitch } from './SettingSwitch';
import { SettingButton } from './SettingButton';
import { SettingInput } from './SettingInput';
import { SettingSubmenu } from './SettingSubmenu';

export interface SettingItemProps {
  item: SettingItemType;
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
  onPress?: (itemId: string) => void;
  onValueChange?: (itemId: string, value: boolean | string) => void;
  renderCustom?: (item: SettingItemType) => React.ReactNode | null;
}

export const SettingItem: React.FC<SettingItemProps> = ({
  item,
  icon,
  colors,
  styles,
  onPress,
  onValueChange,
  renderCustom,
}) => {
  // Handle custom rendering
  if (item.type === 'custom' && renderCustom) {
    return <>{renderCustom(item)}</>;
  }

  // Handle switch type
  if (item.type === 'switch') {
    return (
      <SettingSwitch
        item={item}
        icon={icon}
        colors={colors}
        styles={styles}
        onValueChange={(value) => {
          item.onValueChange?.(value);
          onValueChange?.(item.id, value);
        }}
      />
    );
  }

  // Handle button type
  if (item.type === 'button') {
    return (
      <SettingButton
        item={item}
        icon={icon}
        colors={colors}
        styles={styles}
        onPress={() => {
          item.onPress?.();
          onPress?.(item.id);
        }}
      />
    );
  }

  // Handle input type
  if (item.type === 'input') {
    return (
      <SettingInput
        item={item}
        icon={icon}
        colors={colors}
        styles={styles}
        onValueChange={(value) => {
          item.onValueChange?.(value);
          onValueChange?.(item.id, value);
        }}
        onPress={item.onPress}
      />
    );
  }

  // Handle submenu type
  if (item.type === 'submenu') {
    return (
      <SettingSubmenu
        item={item}
        icon={icon}
        colors={colors}
        styles={styles}
        onPress={() => {
          item.onPress?.();
          onPress?.(item.id);
        }}
      />
    );
  }

  return null;
};

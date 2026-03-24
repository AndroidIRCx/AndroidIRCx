/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React, { useMemo } from 'react';
import { SettingItem } from '../SettingItem';
import { SettingItem as SettingItemType, SettingIcon } from '../../../types/settings';

interface AdvancedSectionProps {
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
  settingIcons: Record<string, SettingIcon | undefined>;
}

export const AdvancedSection: React.FC<AdvancedSectionProps> = ({
  colors,
  styles,
  settingIcons,
}) => {
  // Note: DCC Settings are now in ConnectionNetworkSection
  // This section can be expanded with additional advanced settings in the future
  const sectionData: SettingItemType[] = useMemo(() => {
    const items: SettingItemType[] = [
      // Advanced settings can be added here in the future
    ];

    return items;
  }, []);

  // If no items, return null to hide the section
  if (sectionData.length === 0) {
    return null;
  }

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
    </>
  );
};

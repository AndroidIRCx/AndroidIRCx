import React, { useMemo, useEffect, useState } from 'react';
import { SettingItem } from '../SettingItem';
import { useSettingsNotifications } from '../../../hooks/useSettingsNotifications';
import { useT } from '../../../i18n/transifex';
import { SettingItem as SettingItemType, SettingIcon } from '../../../types/settings';
import { backgroundService } from '../../../services/BackgroundService';

interface BackgroundBatterySectionProps {
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

export const BackgroundBatterySection: React.FC<BackgroundBatterySectionProps> = ({
  colors,
  styles,
  settingIcons,
}) => {
  const t = useT();
  const tags = 'screen:settings,file:BackgroundBatterySection.tsx,feature:settings';
  
  const {
    backgroundEnabled,
    batteryOptEnabledStatus,
    setBackgroundEnabled,
    handleBatteryOptimization,
  } = useSettingsNotifications();

  const [localBatteryOptStatus, setLocalBatteryOptStatus] = useState(batteryOptEnabledStatus);

  // Sync with hook state
  useEffect(() => {
    setLocalBatteryOptStatus(batteryOptEnabledStatus);
  }, [batteryOptEnabledStatus]);

  const handleBatteryOptimizationWrapper = async () => {
    await handleBatteryOptimization();
    // After returning from settings, re-check the status to update UI
    setTimeout(async () => {
      try {
        const isIgnoring = await backgroundService.isIgnoringBatteryOptimizations();
        setLocalBatteryOptStatus(!isIgnoring);
      } catch (error) {
        console.error('Failed to refresh battery optimization status:', error);
      }
    }, 1000); // Delay to allow user to return from settings
  };

  const sectionData: SettingItemType[] = useMemo(() => {
    const items: SettingItemType[] = [
      {
        id: 'background-keep-alive',
        title: t('Keep Connection Alive', { _tags: tags }),
        description: t('Maintain IRC connection in background', { _tags: tags }),
        type: 'switch',
        value: backgroundEnabled,
        onValueChange: async (value: string | boolean) => {
          await setBackgroundEnabled(value as boolean);
        },
      },
      {
        id: 'background-battery-status',
        title: t('Battery Optimization', { _tags: tags }),
        description: localBatteryOptStatus
          ? 'Battery optimization is enabled (may disconnect in background)'
          : 'Battery optimization is disabled (recommended for persistent connection)',
        type: 'button',
        disabled: true,
      },
      {
        id: 'background-battery-settings',
        title: t('Open Battery Settings', { _tags: tags }),
        description: t('Configure battery optimization for this app', { _tags: tags }),
        type: 'button',
        onPress: handleBatteryOptimizationWrapper,
      },
    ];

    return items;
  }, [
    backgroundEnabled,
    localBatteryOptStatus,
    setBackgroundEnabled,
    handleBatteryOptimizationWrapper,
    t,
    tags,
  ]);

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

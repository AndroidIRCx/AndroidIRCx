import React from 'react';
import { Alert } from 'react-native';
import { SettingItem } from '../SettingItem';
import { useSettingsSecurity } from '../../../hooks/useSettingsSecurity';
import { useT } from '../../../i18n/transifex';
import { SettingItem as SettingItemType, SettingIcon } from '../../../types/settings';
import { IRCNetworkConfig } from '../../../services/SettingsService';

interface SecurityQuickConnectSectionProps {
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
  };
  settingIcons: Record<string, SettingIcon | undefined>;
  networks: IRCNetworkConfig[];
  networkLabel: (networkId: string) => string;
}

export const SecurityQuickConnectSection: React.FC<SecurityQuickConnectSectionProps> = ({
  colors,
  styles,
  settingIcons,
  networks,
  networkLabel,
}) => {
  const t = useT();
  const tags = 'screen:settings,file:SecurityQuickConnectSection.tsx,feature:settings';
  const {
    killSwitchEnabledOnHeader,
    killSwitchEnabledOnLockScreen,
    killSwitchShowWarnings,
    quickConnectNetworkId,
    setKillSwitchEnabledOnHeader,
    setKillSwitchEnabledOnLockScreen,
    setKillSwitchShowWarnings,
    setQuickConnectNetworkId,
  } = useSettingsSecurity();

  const sectionData: SettingItemType[] = [
    {
      id: 'quick-connect-network',
      title: t('Quick Connect Network', { _tags: tags }),
      description: quickConnectNetworkId 
        ? t('Current: {network}', { network: networkLabel(quickConnectNetworkId), _tags: tags })
        : t('Tap header to connect to default network', { _tags: tags }),
      type: 'button',
      onPress: () => {
        Alert.alert(
          t('Select Quick Connect Network', { _tags: tags }),
          t('Choose which network to connect when tapping the header "Tap to connect" button.', { _tags: tags }),
          [
            { text: t('Cancel', { _tags: tags }), style: 'cancel' },
            {
              text: t('Use Default', { _tags: tags }),
              onPress: async () => {
                await setQuickConnectNetworkId(null);
              },
            },
            ...networks.map(net => ({
              text: net.name,
              onPress: async () => {
                await setQuickConnectNetworkId(net.id);
              },
            })),
          ]
        );
      },
    },
    {
      id: 'kill-switch-header',
      title: t('Kill Switch on Header', { _tags: tags }),
      description: t('Show kill switch button (💀) in header', { _tags: tags }),
      type: 'switch',
      value: killSwitchEnabledOnHeader,
      onValueChange: async (value: boolean | string) => {
        await setKillSwitchEnabledOnHeader(value as boolean);
      },
    },
    {
      id: 'kill-switch-lockscreen',
      title: t('Kill Switch on Lock Screen', { _tags: tags }),
      description: t('Show kill switch button on app unlock screen', { _tags: tags }),
      type: 'switch',
      value: killSwitchEnabledOnLockScreen,
      onValueChange: async (value: boolean | string) => {
        await setKillSwitchEnabledOnLockScreen(value as boolean);
      },
    },
    {
      id: 'kill-switch-warnings',
      title: t('Show Kill Switch Warnings', { _tags: tags }),
      description: t('Show confirmation dialogs before activating kill switch (header only)', { _tags: tags }),
      type: 'switch',
      value: killSwitchShowWarnings,
      onValueChange: async (value: boolean | string) => {
        await setKillSwitchShowWarnings(value as boolean);
      },
    },
  ];

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

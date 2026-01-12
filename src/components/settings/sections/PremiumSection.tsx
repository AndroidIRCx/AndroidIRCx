import React from 'react';
import { SettingItem } from '../SettingItem';
import { SettingItem as SettingItemType, SettingIcon } from '../../../types/settings';
import { useT } from '../../../i18n/transifex';

interface PremiumSectionProps {
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
  onShowPurchaseScreen?: () => void;
}

export const PremiumSection: React.FC<PremiumSectionProps> = ({
  colors,
  styles,
  settingIcons,
  onShowPurchaseScreen,
}) => {
  const t = useT();
  const tags = 'screen:settings,file:PremiumSection.tsx,feature:settings';

  const sectionData: SettingItemType[] = [
    {
      id: 'premium-upgrade',
      title: t('Upgrade to Premium', { _tags: tags }),
      description: t('Unlock unlimited scripting, no ads, and premium features', { _tags: tags }),
      type: 'button',
      searchKeywords: ['premium', 'upgrade', 'purchase', 'buy', 'scripting', 'no-ads', 'ad-free', 'features', 'pro', 'supporter'],
      onPress: onShowPurchaseScreen,
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

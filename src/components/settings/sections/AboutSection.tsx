import React from 'react';
import { SettingItem } from '../SettingItem';
import { useT } from '../../../i18n/transifex';
import { SettingItem as SettingItemType, SettingIcon } from '../../../types/settings';

interface AboutSectionProps {
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
  onShowAbout: () => void;
  onShowCredits: () => void;
}

export const AboutSection: React.FC<AboutSectionProps> = ({
  colors,
  styles,
  settingIcons,
  onShowAbout,
  onShowCredits,
}) => {
  const t = useT();
  const tags = 'screen:settings,file:AboutSection.tsx,feature:settings';

  const sectionData: SettingItemType[] = [
    {
      id: 'about-app',
      title: t('About AndroidIRCX', { _tags: tags }),
      description: t('App information and credits', { _tags: tags }),
      type: 'button',
      searchKeywords: ['about', 'app', 'information', 'credits', 'version', 'androidircx', 'developer', 'info'],
      onPress: onShowAbout,
    },
    {
      id: 'credits',
      title: t('Credits', { _tags: tags }),
      description: t('Translators and contributors', { _tags: tags }),
      type: 'button',
      searchKeywords: ['credits', 'translators', 'contributors', 'thanks', 'translation', 'language'],
      onPress: onShowCredits,
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

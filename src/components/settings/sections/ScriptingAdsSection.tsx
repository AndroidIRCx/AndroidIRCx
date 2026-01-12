import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SettingItem } from '../SettingItem';
import { useSettingsPremium } from '../../../hooks/useSettingsPremium';
import { useT } from '../../../i18n/transifex';
import { SettingItem as SettingItemType, SettingIcon } from '../../../types/settings';

interface ScriptingAdsSectionProps {
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
    watchAdButton?: any;
    watchAdButtonDisabled?: any;
    watchAdButtonText?: any;
  };
  settingIcons: Record<string, SettingIcon | undefined>;
  onShowScripting: () => void;
  onShowScriptingHelp: () => void;
}

export const ScriptingAdsSection: React.FC<ScriptingAdsSectionProps> = ({
  colors,
  styles,
  settingIcons,
  onShowScripting,
  onShowScriptingHelp,
}) => {
  const t = useT();
  const tags = 'screen:settings,file:ScriptingAdsSection.tsx,feature:settings';
  const {
    hasNoAds,
    hasScriptingPro,
    isSupporter,
    watchAdButtonEnabledForPremium,
    showWatchAdButton,
    adReady,
    adLoading,
    adCooldown,
    cooldownSeconds,
    showingAd,
    setWatchAdButtonEnabledForPremium,
    handleWatchAd,
  } = useSettingsPremium();

  const sectionData: SettingItemType[] = [
    {
      id: 'advanced-scripts',
      title: t('Scripts (Scripting Time & No-Ads)', { _tags: tags }),
      description: t('Manage IRC scripts and automation. Scripting time is also ad-free time.', { _tags: tags }),
      type: 'button',
      searchKeywords: ['scripts', 'scripting', 'automation', 'time', 'no-ads', 'ad-free', 'premium', 'manage'],
      onPress: onShowScripting,
    },
    {
      id: 'advanced-scripts-help',
      title: t('Scripting Help', { _tags: tags }),
      description: t('Learn how to write and use scripts', { _tags: tags }),
      type: 'button',
      searchKeywords: ['scripting', 'help', 'learn', 'write', 'use', 'scripts', 'guide', 'tutorial'],
      onPress: onShowScriptingHelp,
    },
    {
      id: 'watch-ad-button-premium',
      title: t('Show Watch Ad Button (Premium)', { _tags: tags }),
      description: (hasNoAds || hasScriptingPro || isSupporter)
        ? t('Enable watch ad button to support the project (you have premium plan)', { _tags: tags })
        : t('Always shown for normal users', { _tags: tags }),
      type: 'switch',
      value: watchAdButtonEnabledForPremium,
      searchKeywords: ['watch', 'ad', 'button', 'premium', 'support', 'show', 'enable'],
      onValueChange: async (value: boolean | string) => {
        await setWatchAdButtonEnabledForPremium(value as boolean);
      },
      disabled: !(hasNoAds || hasScriptingPro || isSupporter),
    },
    {
      id: 'watch-ad-button',
      title: 'watch-ad-button',
      type: 'custom',
      searchKeywords: ['watch', 'ad', 'button', 'scripting', 'time', 'no-ads', 'reward'],
    },
  ];

  const renderCustom = (item: SettingItemType) => {
    if (item.id === 'watch-ad-button' && showWatchAdButton) {
      return (
        <View style={styles.settingItem}>
          <TouchableOpacity
            style={[styles.watchAdButton, showingAd && styles.watchAdButtonDisabled]}
            onPress={handleWatchAd}
            disabled={showingAd}
          >
            {showingAd ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.watchAdButtonText}>
                {adReady
                  ? t('Watch Ad (+60 min Scripting & No-Ads)')
                  : adCooldown
                    ? t('Cooldown ({cooldownSeconds}s)').replace('{cooldownSeconds}', cooldownSeconds.toString())
                    : adLoading
                      ? t('Loading Ad...')
                      : t('Request Ad')}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      );
    }
    return null;
  };

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
            renderCustom={renderCustom}
          />
        );
      })}
    </>
  );
};

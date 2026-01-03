import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { inAppPurchaseService } from '../services/InAppPurchaseService';
import { adRewardService } from '../services/AdRewardService';
import { settingsService } from '../services/SettingsService';
import { useT } from '../i18n/transifex';

export interface UseSettingsPremiumReturn {
  // Premium status
  hasNoAds: boolean;
  hasScriptingPro: boolean;
  isSupporter: boolean;
  
  // Ad status
  adReady: boolean;
  adLoading: boolean;
  adCooldown: boolean;
  cooldownSeconds: number;
  adUnitType: string;
  showingAd: boolean;
  
  // Watch ad button
  watchAdButtonEnabledForPremium: boolean;
  showWatchAdButton: boolean;
  
  // Actions
  setWatchAdButtonEnabledForPremium: (value: boolean) => Promise<void>;
  handleWatchAd: () => Promise<void>;
}

export const useSettingsPremium = (): UseSettingsPremiumReturn => {
  const t = useT();
  
  // Premium status
  const [hasNoAds, setHasNoAds] = useState(false);
  const [hasScriptingPro, setHasScriptingPro] = useState(false);
  const [isSupporter, setIsSupporter] = useState(false);
  
  // Ad status
  const [adReady, setAdReady] = useState(false);
  const [adLoading, setAdLoading] = useState(false);
  const [adCooldown, setAdCooldown] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [showingAd, setShowingAd] = useState(false);
  const [adUnitType, setAdUnitType] = useState<string>('Primary');
  
  // Watch ad button settings
  const [watchAdButtonEnabledForPremium, setWatchAdButtonEnabledForPremiumState] = useState(false);
  const [showWatchAdButton, setShowWatchAdButton] = useState(true);

  // Load premium status
  useEffect(() => {
    const updatePremiumStatus = () => {
      setHasNoAds(inAppPurchaseService.hasNoAds());
      setHasScriptingPro(inAppPurchaseService.hasUnlimitedScripting());
      setIsSupporter(inAppPurchaseService.isSupporter());
    };
    updatePremiumStatus();
    const unsubscribe = inAppPurchaseService.addListener(updatePremiumStatus);
    return unsubscribe;
  }, []);

  // Load ad status
  useEffect(() => {
    const loadAdStatus = () => {
      const adStatus = adRewardService.getAdStatus();
      setAdReady(adStatus.ready);
      setAdLoading(adStatus.loading);
      setAdCooldown(adStatus.cooldown);
      setCooldownSeconds(adStatus.cooldownSeconds);
      setAdUnitType(adStatus.adUnitType);
    };
    loadAdStatus();
    const interval = setInterval(loadAdStatus, 1000);
    return () => clearInterval(interval);
  }, []);

  // Update watch ad button visibility based on premium status and settings
  useEffect(() => {
    const isPremium = hasNoAds || hasScriptingPro || isSupporter;
    setShowWatchAdButton(!isPremium || watchAdButtonEnabledForPremium);
  }, [hasNoAds, hasScriptingPro, isSupporter, watchAdButtonEnabledForPremium]);

  // Load watch ad button setting
  useEffect(() => {
    const loadSetting = async () => {
      const enabled = await settingsService.getSetting('watchAdButtonEnabledForPremium', false);
      setWatchAdButtonEnabledForPremiumState(enabled);
    };
    loadSetting();
  }, []);

  const setWatchAdButtonEnabledForPremium = useCallback(async (value: boolean) => {
    await settingsService.setSetting('watchAdButtonEnabledForPremium', value);
    setWatchAdButtonEnabledForPremiumState(value);
  }, []);

  const handleWatchAd = useCallback(async () => {
    if (showingAd) return;

    if (adReady) {
      setShowingAd(true);
      try {
        const success = await adRewardService.showRewardedAd();
        if (success) {
          Alert.alert(t('Thank You!'), t('You earned scripting time!'));
        } else {
          Alert.alert(t('Ad Failed'), t('Could not show the ad. Please try again.'));
        }
      } catch (error) {
        Alert.alert(t('Error'), error instanceof Error ? error.message : t('Failed to show ad'));
      } finally {
        setShowingAd(false);
      }
      return;
    }

    const result = await adRewardService.manualLoadAd();
    Alert.alert(
      result.success ? t('Loading Ad') : t('Cannot Load Ad'),
      t(result.messageKey, result.messageParams as Record<string, any>)
    );
  }, [adReady, showingAd, t]);

  return {
    hasNoAds,
    hasScriptingPro,
    isSupporter,
    adReady,
    adLoading,
    adCooldown,
    cooldownSeconds,
    adUnitType,
    showingAd,
    watchAdButtonEnabledForPremium,
    showWatchAdButton,
    setWatchAdButtonEnabledForPremium,
    handleWatchAd,
  };
};

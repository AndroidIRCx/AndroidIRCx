import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { AdsConsentStatus } from 'react-native-google-mobile-ads';
import { consentService } from '../services/ConsentService';
import { adRewardService } from '../services/AdRewardService';
import { inAppPurchaseService } from '../services/InAppPurchaseService';
import { settingsService } from '../services/SettingsService';
import { useTheme } from '../hooks/useTheme';
import { useT } from '../i18n/transifex';

interface PrivacyAdsScreenProps {
  visible: boolean;
  onClose: () => void;
}

export const PrivacyAdsScreen: React.FC<PrivacyAdsScreenProps> = ({
  visible,
  onClose,
}) => {
  const t = useT();
  const { theme, colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [consentStatus, setConsentStatus] = useState<AdsConsentStatus>(
    consentService.getConsentStatus()
  );
  const [loading, setLoading] = useState(false);
  const [consentInfo, setConsentInfo] = useState({
    status: AdsConsentStatus.UNKNOWN,
    isConsentFormAvailable: false,
    canRequestAds: true,
    privacyOptionsRequired: false,
  });
  const [showingAd, setShowingAd] = useState(false);
  const [adReady, setAdReady] = useState(false);
  const [adLoading, setAdLoading] = useState(false);
  const [adCooldown, setAdCooldown] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [adUnitType, setAdUnitType] = useState<string>('Primary');
  const [hasNoAds, setHasNoAds] = useState(false);
  const [hasScriptingPro, setHasScriptingPro] = useState(false);
  const [isSupporter, setIsSupporter] = useState(false);
  const [showWatchAdButton, setShowWatchAdButton] = useState(true);
  const [watchAdButtonEnabledForPremium, setWatchAdButtonEnabledForPremium] = useState(false);

  // Load consent info and ad status on mount
  useEffect(() => {
    if (visible) {
      loadConsentInfo();
      loadAdStatus();
      loadPremiumStatus();
    }
  }, [visible]);

  // Load watch ad settings when premium status changes
  useEffect(() => {
    if (!visible) return;
    
    const loadSettings = async () => {
      const enabled = await settingsService.getSetting('watchAdButtonEnabledForPremium', false);
      setWatchAdButtonEnabledForPremium(enabled);
      
      // Show button if: normal user OR (premium user AND enabled in settings)
      const isPremium = hasNoAds || hasScriptingPro || isSupporter;
      setShowWatchAdButton(!isPremium || enabled);
    };
    
    loadSettings();
    
    // Listen for setting changes
    const unsubscribe = settingsService.onSettingChange('watchAdButtonEnabledForPremium', (value) => {
      setWatchAdButtonEnabledForPremium(Boolean(value));
      const isPremiumNow = hasNoAds || hasScriptingPro || isSupporter;
      setShowWatchAdButton(!isPremiumNow || Boolean(value));
    });
    
    return unsubscribe;
  }, [visible, hasNoAds, hasScriptingPro, isSupporter]);

  // Update ad status periodically
  useEffect(() => {
    if (!visible) return;

    const interval = setInterval(() => {
      loadAdStatus();
    }, 1000);

    return () => clearInterval(interval);
  }, [visible]);

  const loadAdStatus = () => {
    const adStatus = adRewardService.getAdStatus();
    setAdReady(adStatus.ready);
    setAdLoading(adStatus.loading);
    setAdCooldown(adStatus.cooldown);
    setCooldownSeconds(adStatus.cooldownSeconds);
    setAdUnitType(adStatus.adUnitType);
  };

  const loadPremiumStatus = () => {
    const noAds = inAppPurchaseService.hasNoAds();
    const scriptingPro = inAppPurchaseService.hasUnlimitedScripting();
    const supporter = inAppPurchaseService.isSupporter();
    setHasNoAds(noAds);
    setHasScriptingPro(scriptingPro);
    setIsSupporter(supporter);
  };


  // Listen to consent status changes
  useEffect(() => {
    const unsubscribe = consentService.addListener((status) => {
      setConsentStatus(status);
      loadConsentInfo();
    });

    return unsubscribe;
  }, []);

  const loadConsentInfo = async () => {
    try {
      const info = await consentService.getConsentInfo();
      setConsentInfo(info);
    } catch (error) {
      console.error('Failed to load consent info:', error);
    }
  };

  const handleReviewConsent = async () => {
    try {
      setLoading(true);
      await consentService.showConsentForm();
      setLoading(false);
      Alert.alert(
        t('Privacy Settings Updated'),
        t('Your privacy preferences have been saved.')
      );
    } catch (error) {
      setLoading(false);
      const errorMsg = String(error);

      // If manual consent, offer to reset it
      if (errorMsg.includes('MANUAL_CONSENT_ONLY')) {
        Alert.alert(
          t('Change Privacy Settings'),
          t('You previously accepted our privacy terms. Would you like to withdraw your consent and reset privacy settings?'),
          [
            { text: t('Cancel'), style: 'cancel' },
            {
              text: t('Withdraw & Reset'),
              style: 'destructive',
              onPress: handleResetConsent,
            },
          ]
        );
      } else {
        console.error('[PrivacyAdsScreen] Failed to show consent form:', error);
        Alert.alert(
          t('Error'),
          t('Failed to show consent form. Please try again.')
        );
      }
    }
  };

  const handleResetConsent = () => {
    Alert.alert(
      t('Reset Privacy Settings'),
      t('This will withdraw your consent and reset all privacy preferences. You will need to accept the terms again. Continue?'),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Reset & Re-accept'),
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await consentService.resetConsent();
              setLoading(false);

              // After reset, offer to re-accept immediately
              Alert.alert(
                t('Privacy Agreement'),
                t('By clicking Accept, you agree to:\n\n• Collection of device info, IP address, and location for ads\n• Use of Google Mobile Ads (personalized or non-personalized)\n• Our Privacy Policy and Terms\n\nYou can change these settings anytime in Settings > Privacy & Ads.'),
                [
                  {
                    text: t('Read Privacy Policy'),
                    onPress: handleOpenPrivacyPolicy,
                    style: 'default',
                  },
                  {
                    text: t('Accept'),
                    onPress: async () => {
                      try {
                        setLoading(true);
                        await consentService.acceptConsentManually();
                        setLoading(false);
                        Alert.alert(
                          t('Success'),
                          t('Privacy terms accepted. Your settings have been updated.')
                        );
                        // Reload consent info
                        loadConsentInfo();
                      } catch (error) {
                        setLoading(false);
                        console.error('[PrivacyAdsScreen] Failed to accept consent:', error);
                        Alert.alert(
                          t('Error'),
                          t('Failed to save consent. Please try again.')
                        );
                      }
                    },
                    style: 'default',
                  },
                ]
              );
            } catch (error) {
              setLoading(false);
              console.error('[PrivacyAdsScreen] Failed to reset consent:', error);
              Alert.alert(
                t('Error'),
                t('Failed to reset consent. Please try again.')
              );
            }
          },
        },
      ]
    );
  };

  const handleOpenPrivacyPolicy = () => {
    const url = consentService.getPrivacyPolicyUrl();
    Linking.openURL(url).catch(() => {
      Alert.alert(t('Error'), t('Failed to open privacy policy.'));
    });
  };

  const handleWatchAd = async () => {
    console.log('👆 Watch Ad button clicked');
    console.log('Current state:', { adReady, adLoading, adCooldown, showingAd });

    if (showingAd) return;

    // If ad is ready, show it
    if (adReady) {
      console.log('✅ Ad is ready, showing ad...');
      setShowingAd(true);
      try {
        const success = await adRewardService.showRewardedAd();
        console.log('Show ad result:', success);
        if (success) {
          // Ad will call the reward callback automatically
          Alert.alert(t('Thank You!'), t('You earned scripting time!'));
        } else {
          Alert.alert(t('Ad Failed'), t('Could not show the ad. Please try again.'));
        }
      } catch (error) {
        console.error('Error showing ad:', error);
        Alert.alert(t('Error'), error instanceof Error ? error.message : t('Failed to show ad'));
      } finally {
        setShowingAd(false);
      }
      return;
    }

    // If ad is not ready, try to load it
    console.log('🔄 Ad not ready, attempting manual load...');
    const result = await adRewardService.manualLoadAd();
    console.log('Manual load result:', result);
    Alert.alert(
      result.success ? t('Loading Ad') : t('Cannot Load Ad'),
      t(result.messageKey, result.messageParams as Record<string, any>)
    );
  };

  const getStatusColor = (status: AdsConsentStatus): string => {
    switch (status) {
      case AdsConsentStatus.OBTAINED:
        return colors.success || '#4CAF50';
      case AdsConsentStatus.REQUIRED:
        return colors.warning || '#FF9800';
      case AdsConsentStatus.NOT_REQUIRED:
        return colors.info || '#2196F3';
      default:
        return colors.textSecondary;
    }
  };

  const getStatusIcon = (status: AdsConsentStatus): string => {
    switch (status) {
      case AdsConsentStatus.OBTAINED:
        return 'check';
      case AdsConsentStatus.REQUIRED:
        return 'exclamation';
      case AdsConsentStatus.NOT_REQUIRED:
        return 'info';
      default:
        return 'question';
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('Privacy & Ads')}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>{t('Close')}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {/* Current Status Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('Current Status')}</Text>

            <View style={styles.statusCard}>
              <View style={styles.statusHeader}>
                <View
                  style={[
                    styles.statusIcon,
                    { backgroundColor: getStatusColor(consentStatus) },
                  ]}
                >
                  <Icon
                    name={getStatusIcon(consentStatus)}
                    size={20}
                    color="#fff"
                    solid
                  />
                </View>
                <View style={styles.statusTextContainer}>
                  <Text style={styles.statusTitle}>
                    {consentService.getConsentStatusText()}
                  </Text>
                  <Text style={styles.statusDescription}>
                    {consentStatus === AdsConsentStatus.OBTAINED
                      ? t('You have consented to personalized ads based on your interests.')
                      : consentStatus === AdsConsentStatus.REQUIRED
                      ? t('Your consent is required to show ads.')
                      : consentStatus === AdsConsentStatus.NOT_REQUIRED
                      ? t('Consent not required in your region.')
                      : t('Using non-personalized ads only.')}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* What We Collect Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('What We Collect')}</Text>
            <View style={styles.card}>
              <Text style={styles.cardText}>
                {t('AndroidIRCX uses Google Mobile Ads to provide free features. Google may collect:')}
              </Text>
              <Text style={styles.bulletPoint}>
                • {t('Device information (model, OS version)')}
              </Text>
              <Text style={styles.bulletPoint}>
                • {t('IP address and approximate location')}
              </Text>
              <Text style={styles.bulletPoint}>
                • {t('Ad interaction data')}
              </Text>
              <Text style={styles.bulletPoint}>
                • {t('Usage analytics')}
              </Text>
            </View>
          </View>

          {/* Personalized vs Non-Personalized Ads */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('Ad Types')}</Text>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('Personalized Ads')}</Text>
              <Text style={styles.cardText}>
                {t('Ads tailored to your interests based on your activity. May provide better rewards.')}
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('Non-Personalized Ads')}</Text>
              <Text style={styles.cardText}>
                {t('Generic ads not based on your activity. More privacy, potentially lower rewards.')}
              </Text>
            </View>
          </View>

          {/* Watch Ad Section - Show for normal users or premium users if enabled */}
          {showWatchAdButton && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('Support & Rewards')}</Text>
              
              {(hasNoAds || hasScriptingPro || isSupporter) && (
                <View style={styles.infoCard}>
                  <Text style={styles.infoText}>
                    {t('You have a premium plan. Watching ads helps support the project development.')}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.watchAdButton, showingAd && styles.watchAdButtonDisabled]}
                onPress={handleWatchAd}
                disabled={showingAd}
              >
                {showingAd ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <View style={styles.watchAdButtonContent}>
                    <Icon name="play-circle" size={24} color="#fff" solid style={{ marginRight: 8 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.watchAdButtonText}>
                        {adReady
                          ? t('Watch Ad (+60 min Scripting & No-Ads)')
                          : adCooldown
                            ? t('Cooldown ({cooldownSeconds}s)').replace('{cooldownSeconds}', cooldownSeconds.toString())
                            : adLoading
                              ? t('Loading Ad...')
                              : t('Request Ad')}
                      </Text>
                      {(hasNoAds || hasScriptingPro || isSupporter) && (
                        <Text style={styles.watchAdButtonDescription}>
                          {t('Support the project')}
                        </Text>
                      )}
                    </View>
                  </View>
                )}
              </TouchableOpacity>

              {adUnitType === 'Fallback' && (
                <Text style={styles.infoText}>
                  {t('Using fallback ad unit')}
                </Text>
              )}
            </View>
          )}

          {/* Actions Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('Manage Your Privacy')}</Text>

            {/* Always show option to review/change consent */}
            <TouchableOpacity
              style={styles.button}
              onPress={handleReviewConsent}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.buttonText}>
                    {consentInfo.isConsentFormAvailable || consentService.isManuallyAccepted()
                      ? t('Change Privacy Settings')
                      : t('Review Privacy Choices')}
                  </Text>
                  <Text style={styles.buttonDescription}>
                    {consentService.isManuallyAccepted()
                      ? t('Withdraw consent or reset settings')
                      : t('Change your ad personalization preferences')}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.buttonSecondary]}
              onPress={handleOpenPrivacyPolicy}
            >
              <Text style={styles.buttonTextSecondary}>
                {t('Read Privacy Policy')}
              </Text>
              <Text style={styles.buttonDescriptionSecondary}>
                {t('Learn how we protect your data')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Compliance Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('Compliance')}</Text>
            <View style={styles.card}>
              <Text style={styles.cardText}>
                {t('AndroidIRCX complies with:')}
              </Text>
              <Text style={styles.bulletPoint}>
                • {t('GDPR (EU, EEA, UK, Switzerland)')}
              </Text>
              <Text style={styles.bulletPoint}>
                • {t('CCPA (California)')}
              </Text>
              <Text style={styles.bulletPoint}>
                • {t('Other US state privacy laws')}
              </Text>
              <Text style={[styles.cardText, { marginTop: 12 }]}>
                {t('You have the right to:')}
              </Text>
              <Text style={styles.bulletPoint}>
                • {t('Access your data')}
              </Text>
              <Text style={styles.bulletPoint}>
                • {t('Request data deletion')}
              </Text>
              <Text style={styles.bulletPoint}>
                • {t('Opt out of personalized ads')}
              </Text>
              <Text style={styles.bulletPoint}>
                • {t('Withdraw consent at any time')}
              </Text>
            </View>
          </View>

          {/* Footer spacing */}
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
    },
    closeButton: {
      padding: 8,
    },
    closeButtonText: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: '600',
    },
    content: {
      flex: 1,
    },
    section: {
      padding: 16,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 12,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    statusCard: {
      backgroundColor: colors.cardBackground || colors.surface,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    statusHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    statusIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    statusIconText: {
      color: '#fff',
      fontSize: 20,
      fontWeight: 'bold',
    },
    statusTextContainer: {
      flex: 1,
    },
    statusTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    statusDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    card: {
      backgroundColor: colors.cardBackground || colors.surface,
      borderRadius: 8,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    cardText: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    bulletPoint: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 24,
      marginLeft: 8,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      padding: 16,
      marginBottom: 12,
      alignItems: 'center',
    },
    buttonSecondary: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.border,
    },
    buttonDanger: {
      backgroundColor: colors.error || '#f44336',
    },
    buttonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 4,
    },
    buttonTextSecondary: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 4,
    },
    buttonTextDanger: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 4,
    },
    buttonDescription: {
      color: 'rgba(255, 255, 255, 0.8)',
      fontSize: 12,
    },
    buttonDescriptionSecondary: {
      color: colors.textSecondary,
      fontSize: 12,
    },
    watchAdButton: {
      backgroundColor: '#4CAF50',
      borderRadius: 8,
      padding: 16,
      marginBottom: 12,
      alignItems: 'center',
    },
    watchAdButtonDisabled: {
      backgroundColor: colors.border,
      opacity: 0.6,
    },
    watchAdButtonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
    },
    watchAdButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 4,
    },
    watchAdButtonDescription: {
      color: 'rgba(255, 255, 255, 0.8)',
      fontSize: 12,
    },
    infoCard: {
      backgroundColor: colors.cardBackground || colors.surface,
      borderRadius: 8,
      padding: 12,
      marginBottom: 12,
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
    },
    infoText: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    },
  });

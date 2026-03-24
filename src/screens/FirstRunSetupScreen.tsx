/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator,
  Linking,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import {useTheme} from '../hooks/useTheme';
import {useT} from '../i18n/transifex';
import {settingsService} from '../services/SettingsService';
import type {IRCNetworkConfig, IRCServerConfig} from '../services/SettingsService';
import {identityProfilesService} from '../services/IdentityProfilesService';
import {consentService} from '../services/ConsentService';

interface FirstRunSetupScreenProps {
  onComplete: (networkConfig?: IRCNetworkConfig | null) => void;
  onSkip?: () => void;
}

type SetupStep = 'welcome' | 'privacy' | 'identity' | 'network' | 'channels' | 'complete';

export const FirstRunSetupScreen: React.FC<FirstRunSetupScreenProps> = ({
  onComplete,
  onSkip,
}) => {
  const t = useT();
  const {colors} = useTheme();
  const styles = createStyles(colors);
  const [step, setStep] = useState<SetupStep>('welcome');

  // Privacy/consent state
  const [consentLoading, setConsentLoading] = useState(false);
  const [consentHandled, setConsentHandled] = useState(false);

  // Identity fields
  const [nickname, setNickname] = useState('AndroidIRCX');
  const [altNick, setAltNick] = useState('AndroidIRCX_');
  const [realname, setRealname] = useState('AndroidIRCX User');
  const [username, setUsername] = useState('androidircx');

  // Network selection
  const [networkMode, setNetworkMode] = useState<'dbase' | 'custom' | 'later'>('dbase');
  const [customNetwork, setCustomNetwork] = useState('');
  const [customServer, setCustomServer] = useState('');
  const [customPort, setCustomPort] = useState('6697');
  const [useSSL, setUseSSL] = useState(true);

  // Channel setup
  const [channelsInput, setChannelsInput] = useState('#DBase, #AndroidIRCX');

  const getStepNumber = () => {
    if (step === 'welcome') return '1/5';
    if (step === 'privacy') return '2/5';
    if (step === 'identity') return '3/5';
    if (step === 'network') return '4/5';
    if (step === 'channels') return '5/5';
    return '';
  };

  const getStepTitle = () => {
    if (step === 'welcome') return t('Welcome to AndroidIRCX');
    if (step === 'privacy') return t('Privacy & Ads');
    if (step === 'identity') return t('Set Up Your Identity');
    if (step === 'network') return t('Choose Your Network');
    if (step === 'channels') return t('Choose Your Channels');
    if (step === 'complete') return t('All Set!');
    return '';
  };

  const handleNext = () => {
    if (step === 'welcome') {
      setStep('privacy');
    } else if (step === 'privacy') {
      setStep('identity');
    } else if (step === 'identity') {
      if (!nickname.trim()) {
        Alert.alert(t('Required'), t('Please enter a nickname'));
        return;
      }
      if (!realname.trim()) {
        Alert.alert(t('Required'), t('Please enter your real name'));
        return;
      }
      setStep('network');
    } else if (step === 'network') {
      setStep('channels');
    } else if (step === 'channels') {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (step === 'privacy') {
      setStep('welcome');
    } else if (step === 'identity') {
      setStep('privacy');
    } else if (step === 'network') {
      setStep('identity');
    } else if (step === 'channels') {
      setStep('network');
    }
  };

  const [savedNetwork, setSavedNetwork] = React.useState<IRCNetworkConfig | null>(null);

  const handleComplete = async () => {
    try {
      let finalNetwork: IRCNetworkConfig | null = null;

      // Parse channels from user input
      const parsedChannels = channelsInput
        .split(',')
        .map(ch => ch.trim())
        .filter(ch => ch.length > 0 && (ch.startsWith('#') || ch.startsWith('&')));

      // Use parsed channels or default if none provided
      const autoJoinChannels = parsedChannels.length > 0 ? parsedChannels : ['#DBase', '#AndroidIRCX'];

      // Create identity profile with user's entered data
      const newProfile = await identityProfilesService.add({
        name: t('{nick} Profile', {nick: nickname.trim()}),
        nick: nickname.trim(),
        altNick: altNick.trim() || `${nickname.trim()}_`,
        realname: realname.trim(),
        ident: username.trim() || 'androidircx',
      });

      if (networkMode === 'dbase') {
        // Use existing DBase network, update it with new identity profile
        const existingNetwork = await settingsService.getNetwork('DBase');

        if (existingNetwork) {
          // Update existing DBase network with user's identity profile
          await settingsService.updateNetwork('DBase', {
            nick: nickname.trim(),
            altNick: altNick.trim() || `${nickname.trim()}_`,
            realname: realname.trim(),
            ident: username.trim() || 'androidircx',
            identityProfileId: newProfile.id,
            connectOnStartup: true,
            autoJoinChannels,
          });

          // Get the updated network
          const updated = await settingsService.getNetwork('DBase');
          finalNetwork = updated!;
        } else {
          // Shouldn't happen, but create DBase network if it doesn't exist
          await settingsService.createDefaultNetwork();
          await settingsService.updateNetwork('DBase', {
            nick: nickname.trim(),
            altNick: altNick.trim() || `${nickname.trim()}_`,
            realname: realname.trim(),
            ident: username.trim() || 'androidircx',
            identityProfileId: newProfile.id,
            connectOnStartup: true,
            autoJoinChannels,
          });
          finalNetwork = (await settingsService.getNetwork('DBase'))!;
        }
      } else if (networkMode === 'custom') {
        // Custom network - create new
        if (!customNetwork.trim() || !customServer.trim()) {
          Alert.alert(t('Required'), t('Please enter network name and server'));
          return;
        }

        const networkName = customNetwork.trim();
        const serverHostname = customServer.trim();
        const serverPort = parseInt(customPort, 10) || 6697;

        const server: IRCServerConfig = {
          id: `server-${Date.now()}`,
          hostname: serverHostname,
          port: serverPort,
          ssl: useSSL,
          rejectUnauthorized: false,
          name: serverHostname,
          favorite: true,
        };

        const network: IRCNetworkConfig = {
          id: networkName,
          name: networkName,
          servers: [server],
          nick: nickname.trim(),
          ident: username.trim() || 'androidircx',
          realname: realname.trim(),
          altNick: altNick.trim() || `${nickname.trim()}_`,
          identityProfileId: newProfile.id,
          connectOnStartup: true,
          autoJoinChannels,
        };

        await settingsService.addNetwork(network);
        finalNetwork = network;
      } else {
        finalNetwork = null;
      }

      // Mark first run as complete
      await settingsService.setFirstRunCompleted(true);

      // Save the network for later use
      setSavedNetwork(finalNetwork || null);

      // Show completion step
      setStep('complete');
    } catch (error) {
      Alert.alert(t('Error'), t('Failed to save network configuration'));
      console.error('FirstRunSetup save error:', error);
    }
  };

  const handleConnectNow = () => {
    onComplete(savedNetwork);
  };

  const handleConnectLater = () => {
    if (onSkip) {
      onSkip();
    }
  };

  const renderWelcome = () => (
    <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
      <View style={styles.logoContainer}>
        <Image
          source={require('../../assets/images/favicon600.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      <Text style={styles.appName}>{t('AndroidIRCX')}</Text>
      <Text style={styles.subtitle}>{t("Let's get you connected to IRC")}</Text>

      <View style={styles.featureList}>
        <View style={styles.featureItem}>
          <Text style={styles.featureBullet}>•</Text>
          <Text style={styles.featureText}>{t('Multi-network support')}</Text>
        </View>
        <View style={styles.featureItem}>
          <Text style={styles.featureBullet}>•</Text>
          <Text style={styles.featureText}>{t('Full IRCv3 compliance (18 capabilities)')}</Text>
        </View>
        <View style={styles.featureItem}>
          <Text style={styles.featureBullet}>•</Text>
          <Text style={styles.featureText}>{t('End-to-end encryption')}</Text>
        </View>
        <View style={styles.featureItem}>
          <Text style={styles.featureBullet}>•</Text>
          <Text style={styles.featureText}>{t('Real-time typing indicators')}</Text>
        </View>
        <View style={styles.featureItem}>
          <Text style={styles.featureBullet}>•</Text>
          <Text style={styles.featureText}>{t('Background connections')}</Text>
        </View>
      </View>
    </ScrollView>
  );

  const renderPrivacy = () => {
    const handleAcceptAndContinue = async () => {
      try {
        setConsentLoading(true);

        // Try to show the official consent form (for EU/EEA/UK/California users)
        const formShown = await consentService.showConsentFormIfRequired();

        if (!formShown) {
          // If no form was required (user not in regulated region),
          // show our own explanation and get acceptance
          Alert.alert(
            t('Privacy Agreement'),
            t('By clicking Accept, you agree to:\n\n• Collection of device info, IP address, and location for ads\n• Use of Google Mobile Ads (personalized or non-personalized)\n• Our Privacy Policy and Terms\n\nYou can change these settings anytime in Settings > Privacy & Ads.'),
            [
              {
                text: t('Read Privacy Policy'),
                onPress: () => {
                  const url = consentService.getPrivacyPolicyUrl();
                  Linking.openURL(url).catch(() => {
                    Alert.alert(t('Error'), t('Failed to open privacy policy.'));
                  });
                },
                style: 'default',
              },
              {
                text: t('Accept & Continue'),
                onPress: async () => {
                  try {
                    await consentService.acceptConsentManually();
                    setConsentHandled(true);
                  } catch (error) {
                    console.error('Failed to save consent:', error);
                    Alert.alert(t('Error'), t('Failed to save consent. Please try again.'));
                  }
                },
                style: 'default',
              },
            ]
          );
        } else {
          // Form was shown and handled by Google UMP
          setConsentHandled(true);
        }
      } catch (error) {
        console.error('Consent error:', error);
        // Even if there's an error, allow user to continue
        setConsentHandled(true);
      } finally {
        setConsentLoading(false);
      }
    };

    const handleOpenPrivacyPolicy = () => {
      const url = consentService.getPrivacyPolicyUrl();
      Linking.openURL(url).catch(() => {
        Alert.alert(t('Error'), t('Failed to open privacy policy.'));
      });
    };

    return (
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.description}>
          {t('AndroidIRCX is free to use, supported by ads')}
        </Text>

        <View style={styles.privacyCard}>
          <Text style={styles.privacyTitle}>{t('What We Collect')}</Text>
          <Text style={styles.privacyText}>
            {t('To provide free features, we use Google Mobile Ads which may collect:')}
          </Text>
          <Text style={styles.privacyBullet}>• {t('Device information')}</Text>
          <Text style={styles.privacyBullet}>• {t('IP address and location')}</Text>
          <Text style={styles.privacyBullet}>• {t('Ad interaction data')}</Text>
        </View>

        <View style={styles.privacyCard}>
          <Text style={styles.privacyTitle}>{t('Your Choices')}</Text>
          <Text style={styles.privacyText}>
            {t('You can choose personalized ads (better rewards) or non-personalized ads (more privacy).')}
          </Text>
          <Text style={[styles.privacyText, {marginTop: 8}]}>
            {t('You can change this anytime in Settings.')}
          </Text>
        </View>

        {!consentHandled ? (
          <View style={styles.privacyInfoBox}>
            <View style={styles.privacyInfoTitleRow}>
              <Icon name="clipboard-list" size={16} color={colors.warning} solid style={styles.privacyInfoIcon} />
              <Text style={styles.privacyInfoTitle}>{t('Important')}</Text>
            </View>
            <Text style={styles.privacyInfoText}>
              {t('You must accept our privacy terms to use this app. Click the button below to review and accept.')}
            </Text>
          </View>
        ) : (
          <View style={[styles.privacyInfoBox, {backgroundColor: colors.primary + '20', borderColor: colors.primary}]}>
            <View style={styles.privacyInfoTitleRow}>
              <Icon name="check-circle" size={16} color={colors.primary} solid style={styles.privacyInfoIcon} />
              <Text style={styles.privacyInfoTitle}>{t('Accepted')}</Text>
            </View>
            <Text style={styles.privacyInfoText}>
              {t('You have accepted the privacy terms. You can change settings anytime in Settings.')}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.consentButton, consentHandled && styles.consentButtonAccepted]}
          onPress={handleAcceptAndContinue}
          disabled={consentLoading || consentHandled}>
          {consentLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={styles.consentButtonContent}>
              <View style={styles.consentButtonTextRow}>
                {consentHandled && <Icon name="check" size={16} color="#fff" solid style={styles.consentButtonIcon} />}
                <Text style={styles.consentButtonText}>
                  {consentHandled ? t('Privacy Terms Accepted') : t('Accept Privacy Terms & Continue')}
                </Text>
              </View>
              <Text style={styles.consentButtonSubtext}>
                {consentHandled
                  ? t('You can review or change in Settings')
                  : t('Tap to review and accept (required to continue)')}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.privacyLink}
          onPress={handleOpenPrivacyPolicy}>
          <Text style={styles.privacyLinkText}>{t('📄 Read Full Privacy Policy')}</Text>
        </TouchableOpacity>

        <View style={styles.complianceNote}>
          <Text style={styles.complianceText}>
            {t('We comply with GDPR, CCPA, and other privacy laws. Your data is protected.')}
          </Text>
        </View>
      </ScrollView>
    );
  };

  const renderIdentity = () => (
    <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.description}>
        {t("This is how you'll appear to other users on IRC")}
      </Text>

      <View style={styles.formGroup}>
        <Text style={styles.label}>
          {t('Nickname')} <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={styles.input}
          value={nickname}
          onChangeText={setNickname}
          placeholder={t('AndroidIRCX')}
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>{t('Alternative Nickname')}</Text>
        <TextInput
          style={styles.input}
          value={altNick}
          onChangeText={setAltNick}
          placeholder={t('AndroidIRCX_')}
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.hint}>{t('Used if primary nickname is taken')}</Text>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>
          {t('Real Name')} <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={styles.input}
          value={realname}
          onChangeText={setRealname}
          placeholder={t('Your Name')}
          placeholderTextColor={colors.textSecondary}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>{t('Username/Ident')}</Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          placeholder={t('androidircx')}
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
    </ScrollView>
  );

  const renderNetwork = () => (
    <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.description}>
        {t('Connect to an IRC server to start chatting')}
      </Text>

      <TouchableOpacity
        style={[
          styles.optionCard,
          networkMode === 'dbase' && styles.optionCardSelected,
        ]}
        onPress={() => setNetworkMode('dbase')}>
        <View style={styles.optionHeader}>
          <View style={[styles.radio, networkMode === 'dbase' && styles.radioSelected]}>
            {networkMode === 'dbase' && <View style={styles.radioInner} />}
          </View>
          <View style={styles.optionContent}>
            <Text style={styles.optionTitle}>{t('DBase (Optional Default)')}</Text>
            <Text style={styles.optionValue}>{t('irc.dbase.in.rs (Port 6697, SSL)')}</Text>
            <Text style={styles.optionDescription}>
              {t('Use the built-in DBase network now. You can still change or remove it later.')}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.optionCard,
          networkMode === 'custom' && styles.optionCardSelected,
        ]}
        onPress={() => setNetworkMode('custom')}>
        <View style={styles.optionHeader}>
          <View style={[styles.radio, networkMode === 'custom' && styles.radioSelected]}>
            {networkMode === 'custom' && <View style={styles.radioInner} />}
          </View>
          <View style={styles.optionContent}>
            <Text style={styles.optionTitle}>{t('Custom Server')}</Text>
            <Text style={styles.optionDescription}>
              {t('Connect to a different IRC network')}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.optionCard,
          networkMode === 'later' && styles.optionCardSelected,
        ]}
        onPress={() => setNetworkMode('later')}>
        <View style={styles.optionHeader}>
          <View style={[styles.radio, networkMode === 'later' && styles.radioSelected]}>
            {networkMode === 'later' && <View style={styles.radioInner} />}
          </View>
          <View style={styles.optionContent}>
            <Text style={styles.optionTitle}>{t('Choose Another Server Later')}</Text>
            <Text style={styles.optionDescription}>
              {t('Finish setup now and open Choose Network later to add or reload networks from the API list.')}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {networkMode === 'custom' && (
        <View style={styles.customServerForm}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>
              {t('Network Name')} <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={customNetwork}
              onChangeText={setCustomNetwork}
              placeholder={t('libera')}
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>
              {t('Server Hostname')} <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={customServer}
              onChangeText={setCustomServer}
              placeholder={t('irc.libera.chat')}
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('Port')}</Text>
            <TextInput
              style={styles.input}
              value={customPort}
              onChangeText={setCustomPort}
              placeholder={t('6697')}
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
            />
          </View>

          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setUseSSL(!useSSL)}>
            <View style={[styles.checkbox, useSSL && styles.checkboxSelected]}>
              {useSSL && <Text style={styles.checkboxCheck}>✓</Text>}
            </View>
            <Text style={styles.checkboxLabel}>{t('Use SSL/TLS (Recommended)')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );

  const renderChannels = () => (
    <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.description}>
        {t('Which channels do you want to join automatically?')}
      </Text>

      <View style={styles.formGroup}>
        <Text style={styles.label}>{t('Auto-Join Channels')}</Text>
        <TextInput
          style={[styles.input, styles.channelsInput]}
          value={channelsInput}
          onChangeText={setChannelsInput}
          placeholder={t('#channel1, #channel2, #channel3')}
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          multiline
          numberOfLines={3}
        />
        <Text style={styles.hint}>
          {t('Enter channel names separated by commas. Channels should start with # or &')}
        </Text>
      </View>

      <View style={styles.channelExamplesCard}>
        <Text style={styles.channelExamplesTitle}>{t('Popular Channels')}</Text>
        <TouchableOpacity
          style={styles.channelExampleRow}
          onPress={() => setChannelsInput('#DBase, #AndroidIRCX')}>
          <Text style={styles.channelExampleText}>#DBase, #AndroidIRCX</Text>
          <Text style={styles.channelExampleDesc}>{t('Default channels')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.channelExampleRow}
          onPress={() => setChannelsInput('#DBase')}>
          <Text style={styles.channelExampleText}>#DBase</Text>
          <Text style={styles.channelExampleDesc}>{t('Main channel only')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoBox}>
        <Icon name="info-circle" size={16} color={colors.primary} style={styles.infoIcon} />
        <Text style={styles.infoText}>
          {t('You can always change these channels later in network settings.')}
        </Text>
      </View>
    </ScrollView>
  );

  const renderComplete = () => (
    <View style={[styles.content, styles.completeContainer]}>
      <Text style={styles.successIcon}>✓</Text>
      <Text style={styles.successTitle}>{t("You're all set!")}</Text>
      <Text style={styles.successMessage}>
        {savedNetwork
          ? t('Ready to connect to {server} as {nick}', {
              server: savedNetwork.servers?.[0]?.hostname || savedNetwork.name,
              nick: nickname,
            })
          : t('Your identity is saved. Open Choose Network to add a server or reload the approved API network list.')}
      </Text>

      <View style={styles.completeButtons}>
        <TouchableOpacity
          style={[styles.primaryButton, styles.completeButton]}
          onPress={handleConnectNow}>
          <Text style={styles.primaryButtonText}>
            {savedNetwork ? t('Connect Now') : t('Open Choose Network')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.secondaryButton, styles.completeButton]}
          onPress={handleConnectLater}>
          <Text style={styles.secondaryButtonText}>{t('Connect Later')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderStep = () => {
    switch (step) {
      case 'welcome':
        return renderWelcome();
      case 'privacy':
        return renderPrivacy();
      case 'identity':
        return renderIdentity();
      case 'network':
        return renderNetwork();
      case 'channels':
        return renderChannels();
      case 'complete':
        return renderComplete();
      default:
        return renderWelcome();
    }
  };

  if (step === 'complete') {
    return (
      <View style={styles.container}>
        {renderStep()}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerStep}>{getStepNumber()}</Text>
        <Text style={styles.headerTitle}>{getStepTitle()}</Text>
        {onSkip && step === 'welcome' && (
          <TouchableOpacity onPress={onSkip} style={styles.skipButton}>
            <Text style={styles.skipButtonText}>{t('Skip')}</Text>
          </TouchableOpacity>
        )}
        {step !== 'welcome' && <View style={styles.skipButton} />}
      </View>

      {/* Content */}
      {renderStep()}

      {/* Footer with buttons */}
      <View style={styles.footer}>
        {step !== 'welcome' && (
          <TouchableOpacity style={styles.secondaryButton} onPress={handleBack}>
            <Text style={styles.secondaryButtonText}>{t('Back')}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[
            styles.primaryButton,
            step === 'welcome' && styles.primaryButtonFull,
          ]}
          onPress={handleNext}>
          <Text style={styles.primaryButtonText}>
            {step === 'channels' ? t('Complete Setup') : t('Next')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background || '#121212',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border || '#333333',
      backgroundColor: colors.surface || '#1E1E1E',
    },
    headerStep: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary || '#2196F3',
      width: 50,
    },
    headerTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: '600',
      color: colors.text || '#FFFFFF',
      textAlign: 'center',
    },
    skipButton: {
      width: 50,
      alignItems: 'flex-end',
    },
    skipButtonText: {
      color: colors.primary || '#2196F3',
      fontSize: 14,
      fontWeight: '500',
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      padding: 20,
    },
    logoContainer: {
      alignItems: 'center',
      marginBottom: 20,
    },
    logo: {
      width: 120,
      height: 120,
    },
    appName: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text || '#FFFFFF',
      textAlign: 'center',
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary || '#B0B0B0',
      textAlign: 'center',
      marginBottom: 32,
    },
    description: {
      fontSize: 15,
      color: colors.textSecondary || '#B0B0B0',
      textAlign: 'center',
      marginBottom: 24,
    },
    featureList: {
      marginTop: 16,
    },
    featureItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 12,
      paddingHorizontal: 8,
    },
    featureBullet: {
      fontSize: 20,
      color: colors.primary || '#2196F3',
      marginRight: 12,
      marginTop: -2,
    },
    featureText: {
      flex: 1,
      fontSize: 15,
      color: colors.text || '#FFFFFF',
      lineHeight: 22,
    },
    formGroup: {
      marginBottom: 20,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text || '#FFFFFF',
      marginBottom: 8,
    },
    required: {
      color: '#ff4444',
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border || '#333333',
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: colors.text || '#FFFFFF',
      backgroundColor: colors.inputBackground || '#2C2C2C',
    },
    hint: {
      fontSize: 12,
      color: colors.textSecondary || '#B0B0B0',
      marginTop: 4,
      fontStyle: 'italic',
    },
    optionCard: {
      borderWidth: 1,
      borderColor: colors.border || '#333333',
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      backgroundColor: colors.surface || '#1E1E1E',
    },
    optionCardSelected: {
      borderColor: colors.primary || '#2196F3',
      borderWidth: 2,
    },
    optionHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    radio: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: colors.border || '#333333',
      marginRight: 12,
      marginTop: 2,
      justifyContent: 'center',
      alignItems: 'center',
    },
    radioSelected: {
      borderColor: colors.primary || '#2196F3',
    },
    radioInner: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.primary || '#2196F3',
    },
    optionContent: {
      flex: 1,
    },
    optionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text || '#FFFFFF',
      marginBottom: 4,
    },
    optionValue: {
      fontSize: 14,
      color: colors.text || '#FFFFFF',
      marginBottom: 4,
    },
    optionDescription: {
      fontSize: 13,
      color: colors.textSecondary || '#B0B0B0',
    },
    customServerForm: {
      marginTop: 8,
    },
    checkboxRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderWidth: 2,
      borderColor: colors.border || '#333333',
      borderRadius: 4,
      marginRight: 8,
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkboxSelected: {
      borderColor: colors.primary || '#2196F3',
      backgroundColor: colors.primary || '#2196F3',
    },
    checkboxCheck: {
      color: colors.buttonPrimaryText || '#FFFFFF',
      fontSize: 14,
      fontWeight: 'bold',
    },
    checkboxLabel: {
      fontSize: 14,
      color: colors.text || '#FFFFFF',
    },
    footer: {
      flexDirection: 'row',
      padding: 16,
      gap: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border || '#333333',
      backgroundColor: colors.surface || '#1E1E1E',
    },
    primaryButton: {
      flex: 1,
      backgroundColor: colors.buttonPrimary || colors.primary || '#2196F3',
      paddingVertical: 18,
      paddingHorizontal: 20,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 56,
    },
    primaryButtonFull: {
      flex: 1,
    },
    primaryButtonText: {
      color: colors.buttonPrimaryText || colors.onPrimary || '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
      lineHeight: 20,
      textAlign: 'center',
    },
    secondaryButton: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border || '#333333',
      paddingVertical: 18,
      paddingHorizontal: 20,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.buttonSecondary || colors.surface || '#424242',
      minHeight: 56,
    },
    secondaryButtonText: {
      color: colors.buttonSecondaryText || colors.text || '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
      lineHeight: 20,
      textAlign: 'center',
    },
    completeContainer: {
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },
    successIcon: {
      fontSize: 80,
      color: colors.primary || '#2196F3',
      marginBottom: 24,
    },
    successTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text || '#FFFFFF',
      marginBottom: 12,
      textAlign: 'center',
    },
    successMessage: {
      fontSize: 16,
      color: colors.textSecondary || '#B0B0B0',
      textAlign: 'center',
      marginBottom: 32,
    },
    completeButtons: {
      width: '100%',
      gap: 12,
    },
    completeButton: {
      width: '100%',
    },
    privacyCard: {
      backgroundColor: colors.surface || '#1E1E1E',
      borderWidth: 1,
      borderColor: colors.border || '#333333',
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    privacyTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text || '#FFFFFF',
      marginBottom: 8,
    },
    privacyText: {
      fontSize: 14,
      color: colors.textSecondary || '#B0B0B0',
      lineHeight: 20,
      marginBottom: 4,
    },
    privacyBullet: {
      fontSize: 14,
      color: colors.textSecondary || '#B0B0B0',
      lineHeight: 22,
      marginLeft: 8,
    },
    consentButton: {
      backgroundColor: colors.buttonPrimary || colors.primary || '#2196F3',
      borderRadius: 12,
      padding: 16,
      marginTop: 8,
      marginBottom: 16,
      alignItems: 'center',
      minHeight: 70,
      justifyContent: 'center',
    },
    consentButtonContent: {
      alignItems: 'center',
    },
    consentButtonTextRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    consentButtonIcon: {
      marginRight: 8,
    },
    consentButtonText: {
      color: colors.buttonPrimaryText || '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    consentButtonSubtext: {
      color: 'rgba(255, 255, 255, 0.8)',
      fontSize: 12,
      textAlign: 'center',
    },
    consentButtonAccepted: {
      backgroundColor: colors.success || '#4CAF50',
      opacity: 0.7,
    },
    privacyInfoBox: {
      backgroundColor: colors.warning || '#FF9800' + '20',
      borderWidth: 1,
      borderColor: colors.warning || '#FF9800',
      borderRadius: 12,
      padding: 16,
      marginTop: 8,
      marginBottom: 16,
    },
    privacyInfoTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    privacyInfoIcon: {
      marginRight: 8,
    },
    privacyInfoTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text || '#FFFFFF',
    },
    privacyInfoText: {
      fontSize: 13,
      color: colors.text || '#FFFFFF',
      lineHeight: 20,
    },
    privacyLink: {
      padding: 12,
      alignItems: 'center',
      marginBottom: 16,
    },
    privacyLinkText: {
      color: colors.primary || '#2196F3',
      fontSize: 14,
      textDecorationLine: 'underline',
    },
    complianceNote: {
      backgroundColor: colors.surface || '#1E1E1E',
      borderRadius: 8,
      padding: 12,
      borderLeftWidth: 3,
      borderLeftColor: colors.primary || '#2196F3',
    },
    complianceText: {
      fontSize: 12,
      color: colors.textSecondary || '#B0B0B0',
      lineHeight: 18,
      fontStyle: 'italic',
    },
    channelsInput: {
      minHeight: 80,
      textAlignVertical: 'top',
      paddingTop: 12,
    },
    channelExamplesCard: {
      backgroundColor: colors.surface || '#1E1E1E',
      borderWidth: 1,
      borderColor: colors.border || '#333333',
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    channelExamplesTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text || '#FFFFFF',
      marginBottom: 12,
    },
    channelExampleRow: {
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border || '#333333',
      marginBottom: 8,
    },
    channelExampleText: {
      fontSize: 15,
      color: colors.primary || '#2196F3',
      fontWeight: '500',
      marginBottom: 4,
    },
    channelExampleDesc: {
      fontSize: 12,
      color: colors.textSecondary || '#B0B0B0',
    },
    infoBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: colors.primary + '15',
      borderWidth: 1,
      borderColor: colors.primary + '40',
      borderRadius: 8,
      padding: 12,
    },
    infoIcon: {
      marginRight: 8,
      marginTop: 2,
    },
    infoText: {
      flex: 1,
      fontSize: 13,
      color: colors.text || '#FFFFFF',
      lineHeight: 18,
    },
  });

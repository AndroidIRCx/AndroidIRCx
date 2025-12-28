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
} from 'react-native';
import {useTheme} from '../hooks/useTheme';
import {settingsService} from '../services/SettingsService';
import type {IRCNetworkConfig, IRCServerConfig} from '../services/SettingsService';
import {identityProfilesService} from '../services/IdentityProfilesService';

interface FirstRunSetupScreenProps {
  onComplete: (networkConfig: IRCNetworkConfig) => void;
  onSkip?: () => void;
}

type SetupStep = 'welcome' | 'identity' | 'network' | 'complete';

export const FirstRunSetupScreen: React.FC<FirstRunSetupScreenProps> = ({
  onComplete,
  onSkip,
}) => {
  const {colors} = useTheme();
  const styles = createStyles(colors);
  const [step, setStep] = useState<SetupStep>('welcome');

  // Identity fields
  const [nickname, setNickname] = useState('AndroidIRCX');
  const [altNick, setAltNick] = useState('AndroidIRCX_');
  const [realname, setRealname] = useState('AndroidIRCX User');
  const [username, setUsername] = useState('androidircx');

  // Network selection
  const [useRecommended, setUseRecommended] = useState(true);
  const [customNetwork, setCustomNetwork] = useState('');
  const [customServer, setCustomServer] = useState('');
  const [customPort, setCustomPort] = useState('6697');
  const [useSSL, setUseSSL] = useState(true);

  const getStepNumber = () => {
    if (step === 'welcome') return '1/3';
    if (step === 'identity') return '2/3';
    if (step === 'network') return '3/3';
    return '';
  };

  const getStepTitle = () => {
    if (step === 'welcome') return 'Welcome to AndroidIRCX';
    if (step === 'identity') return 'Set Up Your Identity';
    if (step === 'network') return 'Choose Your Network';
    if (step === 'complete') return 'All Set!';
    return '';
  };

  const handleNext = () => {
    if (step === 'welcome') {
      setStep('identity');
    } else if (step === 'identity') {
      if (!nickname.trim()) {
        Alert.alert('Required', 'Please enter a nickname');
        return;
      }
      if (!realname.trim()) {
        Alert.alert('Required', 'Please enter your real name');
        return;
      }
      setStep('network');
    } else if (step === 'network') {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (step === 'identity') {
      setStep('welcome');
    } else if (step === 'network') {
      setStep('identity');
    }
  };

  const [savedNetwork, setSavedNetwork] = React.useState<IRCNetworkConfig | null>(null);

  const handleComplete = async () => {
    try {
      let finalNetwork: IRCNetworkConfig;

      // Create identity profile with user's entered data
      const newProfile = await identityProfilesService.add({
        name: `${nickname.trim()} Profile`,
        nick: nickname.trim(),
        altNick: altNick.trim() || `${nickname.trim()}_`,
        realname: realname.trim(),
        ident: username.trim() || 'androidircx',
      });

      if (useRecommended) {
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
          });

          // Get the updated network
          const updated = await settingsService.getNetwork('DBase');
          finalNetwork = updated!;
        } else {
          // Shouldn't happen, but create DBase network if it doesn't exist
          const network = await settingsService.createDefaultNetwork();
          await settingsService.updateNetwork('DBase', {
            nick: nickname.trim(),
            altNick: altNick.trim() || `${nickname.trim()}_`,
            realname: realname.trim(),
            ident: username.trim() || 'androidircx',
            identityProfileId: newProfile.id,
            connectOnStartup: true,
          });
          finalNetwork = (await settingsService.getNetwork('DBase'))!;
        }
      } else {
        // Custom network - create new
        if (!customNetwork.trim() || !customServer.trim()) {
          Alert.alert('Required', 'Please enter network name and server');
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
        };

        await settingsService.addNetwork(network);
        finalNetwork = network;
      }

      // Mark first run as complete
      await settingsService.setFirstRunCompleted(true);

      // Save the network for later use
      setSavedNetwork(finalNetwork);

      // Show completion step
      setStep('complete');
    } catch (error) {
      Alert.alert('Error', 'Failed to save network configuration');
      console.error('FirstRunSetup save error:', error);
    }
  };

  const handleConnectNow = () => {
    if (savedNetwork) {
      onComplete(savedNetwork);
    }
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

      <Text style={styles.appName}>AndroidIRCX</Text>
      <Text style={styles.subtitle}>Let's get you connected to IRC</Text>

      <View style={styles.featureList}>
        <View style={styles.featureItem}>
          <Text style={styles.featureBullet}>•</Text>
          <Text style={styles.featureText}>Multi-network support</Text>
        </View>
        <View style={styles.featureItem}>
          <Text style={styles.featureBullet}>•</Text>
          <Text style={styles.featureText}>Full IRCv3 compliance (18 capabilities)</Text>
        </View>
        <View style={styles.featureItem}>
          <Text style={styles.featureBullet}>•</Text>
          <Text style={styles.featureText}>End-to-end encryption</Text>
        </View>
        <View style={styles.featureItem}>
          <Text style={styles.featureBullet}>•</Text>
          <Text style={styles.featureText}>Real-time typing indicators</Text>
        </View>
        <View style={styles.featureItem}>
          <Text style={styles.featureBullet}>•</Text>
          <Text style={styles.featureText}>Background connections</Text>
        </View>
      </View>
    </ScrollView>
  );

  const renderIdentity = () => (
    <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.description}>
        This is how you'll appear to other users on IRC
      </Text>

      <View style={styles.formGroup}>
        <Text style={styles.label}>
          Nickname <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={styles.input}
          value={nickname}
          onChangeText={setNickname}
          placeholder="AndroidIRCX"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Alternative Nickname</Text>
        <TextInput
          style={styles.input}
          value={altNick}
          onChangeText={setAltNick}
          placeholder="AndroidIRCX_"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.hint}>Used if primary nickname is taken</Text>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>
          Real Name <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={styles.input}
          value={realname}
          onChangeText={setRealname}
          placeholder="Your Name"
          placeholderTextColor={colors.textSecondary}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Username/Ident</Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          placeholder="androidircx"
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
        Connect to an IRC server to start chatting
      </Text>

      <TouchableOpacity
        style={[
          styles.optionCard,
          useRecommended && styles.optionCardSelected,
        ]}
        onPress={() => setUseRecommended(true)}>
        <View style={styles.optionHeader}>
          <View style={[styles.radio, useRecommended && styles.radioSelected]}>
            {useRecommended && <View style={styles.radioInner} />}
          </View>
          <View style={styles.optionContent}>
            <Text style={styles.optionTitle}>Recommended Server</Text>
            <Text style={styles.optionValue}>irc.dbase.in.rs (Port 6697, SSL)</Text>
            <Text style={styles.optionDescription}>
              Official AndroidIRCX server with full IRCv3 support
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.optionCard,
          !useRecommended && styles.optionCardSelected,
        ]}
        onPress={() => setUseRecommended(false)}>
        <View style={styles.optionHeader}>
          <View style={[styles.radio, !useRecommended && styles.radioSelected]}>
            {!useRecommended && <View style={styles.radioInner} />}
          </View>
          <View style={styles.optionContent}>
            <Text style={styles.optionTitle}>Custom Server</Text>
            <Text style={styles.optionDescription}>
              Connect to a different IRC network
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {!useRecommended && (
        <View style={styles.customServerForm}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>
              Network Name <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={customNetwork}
              onChangeText={setCustomNetwork}
              placeholder="libera"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>
              Server Hostname <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={customServer}
              onChangeText={setCustomServer}
              placeholder="irc.libera.chat"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Port</Text>
            <TextInput
              style={styles.input}
              value={customPort}
              onChangeText={setCustomPort}
              placeholder="6697"
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
            <Text style={styles.checkboxLabel}>Use SSL/TLS (Recommended)</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );

  const renderComplete = () => (
    <View style={[styles.content, styles.completeContainer]}>
      <Text style={styles.successIcon}>✓</Text>
      <Text style={styles.successTitle}>You're all set!</Text>
      <Text style={styles.successMessage}>
        Ready to connect to {useRecommended ? 'irc.dbase.in.rs' : customServer} as{' '}
        {nickname}
      </Text>

      <View style={styles.completeButtons}>
        <TouchableOpacity
          style={[styles.primaryButton, styles.completeButton]}
          onPress={handleConnectNow}>
          <Text style={styles.primaryButtonText}>Connect Now</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.secondaryButton, styles.completeButton]}
          onPress={handleConnectLater}>
          <Text style={styles.secondaryButtonText}>Connect Later</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderStep = () => {
    switch (step) {
      case 'welcome':
        return renderWelcome();
      case 'identity':
        return renderIdentity();
      case 'network':
        return renderNetwork();
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
            <Text style={styles.skipButtonText}>Skip</Text>
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
            <Text style={styles.secondaryButtonText}>Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[
            styles.primaryButton,
            step === 'welcome' && styles.primaryButtonFull,
          ]}
          onPress={handleNext}>
          <Text style={styles.primaryButtonText}>
            {step === 'network' ? 'Complete Setup' : 'Next'}
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
  });

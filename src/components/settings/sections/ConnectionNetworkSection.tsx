import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Alert, Modal, View, Text, TextInput, TouchableOpacity } from 'react-native';
import { SettingItem } from '../SettingItem';
import { useSettingsConnection } from '../../../hooks/useSettingsConnection';
import { useT } from '../../../i18n/transifex';
import { SettingItem as SettingItemType, SettingIcon } from '../../../types/settings';
import { settingsService } from '../../../services/SettingsService';
import { autoReconnectService, AutoReconnectConfig } from '../../../services/AutoReconnectService';
import { connectionQualityService } from '../../../services/ConnectionQualityService';
import { autoRejoinService } from '../../../services/AutoRejoinService';
import { autoVoiceService, AutoVoiceConfig } from '../../../services/AutoVoiceService';
import { channelFavoritesService, ChannelFavorite } from '../../../services/ChannelFavoritesService';
import { identityProfilesService, IdentityProfile } from '../../../services/IdentityProfilesService';
import { biometricAuthService } from '../../../services/BiometricAuthService';
import { secureStorageService } from '../../../services/SecureStorageService';
import { connectionManager } from '../../../services/ConnectionManager';

interface ConnectionNetworkSectionProps {
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
  currentNetwork?: string;
  onShowFirstRunSetup?: () => void;
  onShowConnectionProfiles?: () => void;
}

const PIN_STORAGE_KEY = '@AndroidIRCX:pin-lock';

export const ConnectionNetworkSection: React.FC<ConnectionNetworkSectionProps> = ({
  colors,
  styles,
  settingIcons,
  currentNetwork,
  onShowFirstRunSetup,
  onShowConnectionProfiles,
}) => {
  const t = useT();
  const tags = 'screen:settings,file:ConnectionNetworkSection.tsx,feature:settings';
  
  const {
    networks,
    autoReconnectConfig,
    rateLimitConfig,
    floodProtectionConfig,
    lagMonitoringConfig,
    connectionStats,
    refreshNetworks,
    updateAutoReconnectConfig,
    updateRateLimitConfig,
    updateFloodProtectionConfig,
    updateLagMonitoringConfig,
  } = useSettingsConnection();

  // State for various settings
  const [autoConnectFavoriteServer, setAutoConnectFavoriteServer] = useState(false);
  const [autoRejoinEnabled, setAutoRejoinEnabled] = useState(false);
  const [autoVoiceConfig, setAutoVoiceConfig] = useState<AutoVoiceConfig | null>(null);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [allFavorites, setAllFavorites] = useState<ChannelFavorite[]>([]);
  const [identityProfiles, setIdentityProfiles] = useState<IdentityProfile[]>([]);
  const [autoJoinFavoritesEnabled, setAutoJoinFavoritesEnabled] = useState(true);
  const [dccMinPort, setDccMinPort] = useState(5000);
  const [dccMaxPort, setDccMaxPort] = useState(6000);
  const [lagCheckMethod, setLagCheckMethod] = useState<'ctcp' | 'server'>('server');
  const [globalProxyType, setGlobalProxyType] = useState('socks5');
  const [globalProxyHost, setGlobalProxyHost] = useState('');
  const [globalProxyPort, setGlobalProxyPort] = useState('');
  const [globalProxyUsername, setGlobalProxyUsername] = useState('');
  const [globalProxyPassword, setGlobalProxyPassword] = useState('');
  const [globalProxyEnabled, setGlobalProxyEnabled] = useState(false);
  
  // Password lock state
  const [biometricLockEnabled, setBiometricLockEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [passwordsUnlocked, setPasswordsUnlocked] = useState(true);
  const [pinLockEnabled, setPinLockEnabled] = useState(false);
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pinModalMode, setPinModalMode] = useState<'unlock' | 'setup' | 'confirm'>('unlock');
  const [pinEntry, setPinEntry] = useState('');
  const [pinSetupValue, setPinSetupValue] = useState('');
  const [pinError, setPinError] = useState('');
  const pinResolveRef = React.useRef<((ok: boolean) => void) | null>(null);

  // Load initial state
  useEffect(() => {
    const loadSettings = async () => {
      const autoConnect = await settingsService.getSetting('autoConnectFavoriteServer', false);
      setAutoConnectFavoriteServer(autoConnect);
      
      const autoJoin = await settingsService.getSetting('autoJoinFavorites', true);
      setAutoJoinFavoritesEnabled(autoJoin);
      
      const lagMethod = await settingsService.getSetting('lagCheckMethod', 'server');
      setLagCheckMethod(lagMethod);
      
      const dccRange = await settingsService.getSetting('dccPortRange', { min: 5000, max: 6000 });
      setDccMinPort(dccRange.min || 5000);
      setDccMaxPort(dccRange.max || 6000);
      
      const proxy = await settingsService.getSetting('globalProxy', null);
      if (proxy) {
        setGlobalProxyEnabled(proxy.enabled || false);
        setGlobalProxyType(proxy.type || 'socks5');
        setGlobalProxyHost(proxy.host || '');
        setGlobalProxyPort(proxy.port?.toString() || '');
        setGlobalProxyUsername(proxy.username || '');
        setGlobalProxyPassword(proxy.password || '');
      }
      
      const biometricLock = await settingsService.getSetting('biometricPasswordLock', false);
      setBiometricLockEnabled(biometricLock);
      
      const pinLock = await settingsService.getSetting('pinPasswordLock', false);
      setPinLockEnabled(pinLock);
      
      // Check biometric availability
      const available = await biometricAuthService.isAvailable();
      setBiometricAvailable(available);
      
      // Load network-specific settings
      if (currentNetwork) {
        const reconnectEnabled = autoReconnectService.isEnabled(currentNetwork);
        setAutoRejoinEnabled(autoRejoinService.isEnabled(currentNetwork));
        const voiceConfig = autoVoiceService.getConfig(currentNetwork);
        setAutoVoiceConfig(voiceConfig || null);
      }
      
      // Load favorites
      refreshFavorites();
      
      // Load identity profiles
      identityProfilesService.list().then(setIdentityProfiles).catch(() => {});
    };
    loadSettings();
  }, [currentNetwork]);

  // Refresh favorites
  const refreshFavorites = useCallback(() => {
    const favoritesMap = channelFavoritesService.getAllFavorites();
    const flattened = Array.from(favoritesMap.entries()).flatMap(([networkId, favs]) =>
      favs.map(fav => ({ ...fav, network: networkId }))
    );
    setAllFavorites(flattened);
    setFavoritesCount(flattened.length);
  }, []);

  const networkLabel = useCallback(
    (networkId: string) => networks.find(n => n.id === networkId)?.name || networkId,
    [networks]
  );

  const handleFavoriteDelete = useCallback(
    async (fav: ChannelFavorite) => {
      await channelFavoritesService.removeFavorite(fav.network, fav.name);
      refreshFavorites();
    },
    [refreshFavorites]
  );

  const handleFavoriteMove = useCallback(
    async (fav: ChannelFavorite, targetNetwork: string) => {
      await channelFavoritesService.moveFavorite(fav.network, fav.name, targetNetwork);
      refreshFavorites();
    },
    [refreshFavorites]
  );

  // Password lock handlers
  const passwordLockActive = biometricLockEnabled || pinLockEnabled;
  const passwordUnlockDescription = biometricLockEnabled
    ? t('Use fingerprint/biometric to unlock', { _tags: tags })
    : t('Enter PIN to unlock', { _tags: tags });

  const closePinModal = useCallback((ok: boolean) => {
    setPinModalVisible(false);
    setPinEntry('');
    setPinSetupValue('');
    setPinError('');
    const resolve = pinResolveRef.current;
    pinResolveRef.current = null;
    if (resolve) resolve(ok);
  }, []);

  const requestPinUnlock = useCallback(() => {
    setPinModalMode('unlock');
    setPinEntry('');
    setPinSetupValue('');
    setPinError('');
    setPinModalVisible(true);
    return new Promise<boolean>((resolve) => {
      pinResolveRef.current = resolve;
    });
  }, []);

  const requestPinSetup = useCallback(() => {
    setPinModalMode('setup');
    setPinEntry('');
    setPinSetupValue('');
    setPinError('');
    setPinModalVisible(true);
    return new Promise<boolean>((resolve) => {
      pinResolveRef.current = resolve;
    });
  }, []);

  const handlePinSubmit = useCallback(async () => {
    const trimmed = pinEntry.trim();
    if (pinModalMode === 'unlock') {
      const stored = await secureStorageService.getSecret(PIN_STORAGE_KEY);
      if (!stored) {
        setPinError(t('No PIN is set.', { _tags: tags }));
        return;
      }
      if (trimmed === stored) {
        setPasswordsUnlocked(true);
        closePinModal(true);
        return;
      }
      setPinError(t('Incorrect PIN.', { _tags: tags }));
      return;
    }

    if (pinModalMode === 'setup') {
      if (trimmed.length < 4) {
        setPinError(t('PIN must be at least 4 digits.', { _tags: tags }));
        return;
      }
      setPinSetupValue(trimmed);
      setPinEntry('');
      setPinError('');
      setPinModalMode('confirm');
      return;
    }

    if (trimmed !== pinSetupValue) {
      setPinError(t('PINs do not match.', { _tags: tags }));
      setPinEntry('');
      setPinSetupValue('');
      setPinModalMode('setup');
      return;
    }

    await secureStorageService.setSecret(PIN_STORAGE_KEY, trimmed);
    await settingsService.setSetting('pinPasswordLock', true);
    setPinLockEnabled(true);
    setPasswordsUnlocked(false);
    closePinModal(true);
  }, [closePinModal, pinEntry, pinModalMode, pinSetupValue, t, tags]);

  const unlockPasswords = useCallback(async (): Promise<boolean> => {
    if (!passwordLockActive) {
      setPasswordsUnlocked(true);
      return true;
    }
    if (biometricLockEnabled) {
      if (!biometricAvailable) {
        Alert.alert(
          t('Biometrics unavailable', { _tags: tags }),
          t('Enable a fingerprint/biometric on your device first.', { _tags: tags })
        );
        return false;
      }
      const result = await biometricAuthService.authenticate(
        t('Unlock passwords', { _tags: tags }),
        t('Authenticate to view passwords', { _tags: tags })
      );
      if (result.success) {
        setPasswordsUnlocked(true);
        return true;
      }
      const errorMessage = result.errorMessage
        || (result.errorKey ? t(result.errorKey, { _tags: tags }) : t('Unable to unlock passwords.', { _tags: tags }));
      Alert.alert(
        t('Authentication failed', { _tags: tags }),
        errorMessage
      );
      return false;
    }
    if (pinLockEnabled) {
      return await requestPinUnlock();
    }
    setPasswordsUnlocked(true);
    return true;
  }, [biometricAvailable, biometricLockEnabled, passwordLockActive, pinLockEnabled, requestPinUnlock, t, tags]);

  const handleBiometricLockToggle = async (value: boolean) => {
    if (value) {
      if (!biometricAvailable) {
        Alert.alert(
          t('Biometrics unavailable', { _tags: tags }),
          t('Enable a fingerprint/biometric on your device first.', { _tags: tags })
        );
        return;
      }
      if (pinLockEnabled) {
        await secureStorageService.removeSecret(PIN_STORAGE_KEY);
        await settingsService.setSetting('pinPasswordLock', false);
        setPinLockEnabled(false);
      }
      const enabled = await biometricAuthService.enableLock();
      if (!enabled) {
        Alert.alert(
          t('Biometric setup failed', { _tags: tags }),
          t('Unable to enable biometric lock for passwords.', { _tags: tags })
        );
        return;
      }
      await settingsService.setSetting('biometricPasswordLock', true);
      setBiometricLockEnabled(true);
      setPasswordsUnlocked(false);
      return;
    }
    await biometricAuthService.disableLock();
    await settingsService.setSetting('biometricPasswordLock', false);
    setBiometricLockEnabled(false);
    setPasswordsUnlocked(true);
  };

  const handlePinLockToggle = async (value: boolean) => {
    if (value) {
      if (biometricLockEnabled) {
        await biometricAuthService.disableLock();
        await settingsService.setSetting('biometricPasswordLock', false);
        setBiometricLockEnabled(false);
      }
      await requestPinSetup();
      return;
    }
    await secureStorageService.removeSecret(PIN_STORAGE_KEY);
    await settingsService.setSetting('pinPasswordLock', false);
    setPinLockEnabled(false);
    setPasswordsUnlocked(true);
  };

  // DCC submenu items
  const dccSubmenuItems = useMemo<SettingItemType[]>(() => ([
    {
      id: 'dcc-min-port',
      title: t('Min Port', { _tags: tags }),
      type: 'input',
      value: dccMinPort.toString(),
      keyboardType: 'numeric',
      onValueChange: async (value: string | boolean) => {
        const v = parseInt(value as string, 10);
        if (!isNaN(v)) {
          setDccMinPort(v);
          await settingsService.setSetting('dccPortRange', { min: v, max: dccMaxPort });
        }
      },
    },
    {
      id: 'dcc-max-port',
      title: t('Max Port', { _tags: tags }),
      type: 'input',
      value: dccMaxPort.toString(),
      keyboardType: 'numeric',
      onValueChange: async (value: string | boolean) => {
        const v = parseInt(value as string, 10);
        if (!isNaN(v)) {
          setDccMaxPort(v);
          await settingsService.setSetting('dccPortRange', { min: dccMinPort, max: v });
        }
      },
    },
  ]), [dccMinPort, dccMaxPort, t, tags]);

  // Helper to get default auto-reconnect config
  const getDefaultAutoReconnectConfig = useCallback((): AutoReconnectConfig => ({
    enabled: false,
    maxAttempts: 10,
    initialDelay: 1000,
    maxDelay: 60000,
    backoffMultiplier: 2,
    rejoinChannels: true,
    smartReconnect: true,
    minReconnectInterval: 5000,
  }), []);

  // Helper to get default auto-voice config
  const getDefaultAutoVoiceConfig = useCallback((): AutoVoiceConfig => ({
    enabled: false,
    forOperators: false,
    forIRCOps: false,
    forAll: false,
  }), []);

  const sectionData: SettingItemType[] = useMemo(() => {
    const items: SettingItemType[] = [
      {
        id: 'setup-wizard',
        title: t('Setup Wizard', { _tags: tags }),
        description: t('Quick setup for identity and network connection', { _tags: tags }),
        type: 'button',
        onPress: () => onShowFirstRunSetup?.(),
      },
      {
        id: 'connection-auto-connect-favorite',
        title: t('Auto-Connect to Favorite Server', { _tags: tags }),
        description: t('When opening a network, prefer the server marked as favorite.', { _tags: tags }),
        type: 'switch',
        value: autoConnectFavoriteServer,
        onValueChange: async (value: string | boolean) => {
          const boolValue = value as boolean;
          setAutoConnectFavoriteServer(boolValue);
          await settingsService.setSetting('autoConnectFavoriteServer', boolValue);
        },
      },
      {
        id: 'connection-auto-reconnect',
        title: t('Auto-Reconnect', { _tags: tags }),
        description: autoReconnectConfig?.enabled
          ? t('{attempts} attempts, {mode}', {
              attempts: autoReconnectConfig.maxAttempts || '8',
              mode: autoReconnectConfig.rejoinChannels
                ? t('rejoin channels', { _tags: tags })
                : t('no rejoin', { _tags: tags }),
              _tags: tags,
            })
          : t('Automatically reconnect on disconnect', { _tags: tags }),
        type: 'submenu',
        submenuItems: [
          {
            id: 'auto-reconnect-enabled',
            title: t('Enable Auto-Reconnect', { _tags: tags }),
            type: 'switch',
            value: autoReconnectConfig?.enabled || false,
            onValueChange: async (value: string | boolean) => {
              if (currentNetwork) {
                const config = autoReconnectService.getConfig(currentNetwork) || getDefaultAutoReconnectConfig();
                config.enabled = value as boolean;
                autoReconnectService.setConfig(currentNetwork, config);
                await updateAutoReconnectConfig({});
              }
            },
          },
          {
            id: 'auto-reconnect-rejoin',
            title: t('Rejoin Channels After Reconnect', { _tags: tags }),
            description: t('Automatically rejoin channels you were in', { _tags: tags }),
            type: 'switch',
            value: autoReconnectConfig?.rejoinChannels || false,
            disabled: !autoReconnectConfig?.enabled,
            onValueChange: async (value: string | boolean) => {
              if (currentNetwork) {
                const config = autoReconnectService.getConfig(currentNetwork) || getDefaultAutoReconnectConfig();
                config.rejoinChannels = value as boolean;
                autoReconnectService.setConfig(currentNetwork, config);
                await updateAutoReconnectConfig({});
              }
            },
          },
          {
            id: 'auto-reconnect-smart',
            title: t('Smart Reconnection', { _tags: tags }),
            description: t('Avoid flood by spacing reconnection attempts', { _tags: tags }),
            type: 'switch',
            value: autoReconnectConfig?.smartReconnect || false,
            disabled: !autoReconnectConfig?.enabled,
            onValueChange: async (value: string | boolean) => {
              if (currentNetwork) {
                const config = autoReconnectService.getConfig(currentNetwork) || getDefaultAutoReconnectConfig();
                config.smartReconnect = value as boolean;
                autoReconnectService.setConfig(currentNetwork, config);
                await updateAutoReconnectConfig({});
              }
            },
          },
          {
            id: 'auto-reconnect-max-attempts',
            title: t('Max Reconnection Attempts', { _tags: tags }),
            description: autoReconnectConfig?.maxAttempts
              ? `${autoReconnectConfig.maxAttempts} attempts (0 = unlimited)`
              : 'Maximum reconnection attempts (0 = unlimited)',
            type: 'input',
            value: autoReconnectConfig?.maxAttempts?.toString() || '10',
            keyboardType: 'numeric',
            disabled: !autoReconnectConfig?.enabled,
            onValueChange: async (value: string | boolean) => {
              if (currentNetwork) {
                const config = autoReconnectService.getConfig(currentNetwork) || getDefaultAutoReconnectConfig();
                const attempts = parseInt(value as string, 10);
                config.maxAttempts = isNaN(attempts) ? 0 : attempts;
                autoReconnectService.setConfig(currentNetwork, config);
                await updateAutoReconnectConfig({});
              }
            },
          },
          {
            id: 'auto-reconnect-initial-delay',
            title: t('Initial Delay (ms)', { _tags: tags }),
            description: `First reconnection delay: ${autoReconnectConfig?.initialDelay || 1000}ms`,
            type: 'input',
            value: autoReconnectConfig?.initialDelay?.toString() || '1000',
            keyboardType: 'numeric',
            disabled: !autoReconnectConfig?.enabled,
            onValueChange: async (value: string | boolean) => {
              if (currentNetwork) {
                const config = autoReconnectService.getConfig(currentNetwork) || getDefaultAutoReconnectConfig();
                const delay = parseInt(value as string, 10);
                config.initialDelay = isNaN(delay) ? 1000 : delay;
                autoReconnectService.setConfig(currentNetwork, config);
                await updateAutoReconnectConfig({});
              }
            },
          },
          {
            id: 'auto-reconnect-max-delay',
            title: t('Max Delay (ms)', { _tags: tags }),
            description: `Maximum delay between attempts: ${autoReconnectConfig?.maxDelay || 60000}ms`,
            type: 'input',
            value: autoReconnectConfig?.maxDelay?.toString() || '60000',
            keyboardType: 'numeric',
            disabled: !autoReconnectConfig?.enabled,
            onValueChange: async (value: string | boolean) => {
              if (currentNetwork) {
                const config = autoReconnectService.getConfig(currentNetwork) || getDefaultAutoReconnectConfig();
                const delay = parseInt(value as string, 10);
                config.maxDelay = isNaN(delay) ? 60000 : delay;
                autoReconnectService.setConfig(currentNetwork, config);
                await updateAutoReconnectConfig({});
              }
            },
          },
        ],
      },
      {
        id: 'connection-quality',
        title: t('Connection Quality', { _tags: tags }),
        description: connectionStats
          ? `Lag: ${connectionStats.currentLag}ms (${connectionStats.lagStatus}), ${connectionStats.messagesSent} sent, ${connectionStats.messagesReceived} received`
          : 'Rate limiting, flood protection, and lag monitoring',
        type: 'submenu',
        submenuItems: [
          {
            id: 'quality-rate-limit',
            title: t('Rate Limiting', { _tags: tags }),
            description: rateLimitConfig?.enabled
              ? `${rateLimitConfig.messagesPerSecond} msg/s, burst: ${rateLimitConfig.burstLimit}`
              : 'Limit messages per second',
            type: 'submenu',
            submenuItems: [
              {
                id: 'rate-limit-enabled',
                title: t('Enable Rate Limiting', { _tags: tags }),
                type: 'switch',
                value: rateLimitConfig?.enabled || false,
                onValueChange: async (value: string | boolean) => {
                  await updateRateLimitConfig({ enabled: value as boolean });
                },
              },
              {
                id: 'rate-limit-msg-per-sec',
                title: t('Messages Per Second', { _tags: tags }),
                description: `Max messages per second: ${rateLimitConfig?.messagesPerSecond || 2}`,
                type: 'input',
                value: rateLimitConfig?.messagesPerSecond?.toString() || '2',
                keyboardType: 'numeric',
                disabled: !rateLimitConfig?.enabled,
                onValueChange: async (value: string | boolean) => {
                  const msgPerSec = parseInt(value as string, 10);
                  if (!isNaN(msgPerSec) && msgPerSec > 0) {
                    await updateRateLimitConfig({ messagesPerSecond: msgPerSec });
                  }
                },
              },
              {
                id: 'rate-limit-burst',
                title: t('Burst Limit', { _tags: tags }),
                description: `Max messages in burst: ${rateLimitConfig?.burstLimit || 5}`,
                type: 'input',
                value: rateLimitConfig?.burstLimit?.toString() || '5',
                keyboardType: 'numeric',
                disabled: !rateLimitConfig?.enabled,
                onValueChange: async (value: string | boolean) => {
                  const burst = parseInt(value as string, 10);
                  if (!isNaN(burst) && burst > 0) {
                    await updateRateLimitConfig({ burstLimit: burst });
                  }
                },
              },
            ],
          },
          {
            id: 'quality-flood-protection',
            title: t('Flood Protection', { _tags: tags }),
            description: floodProtectionConfig?.enabled
              ? `${floodProtectionConfig.maxMessagesPerWindow} msgs/${floodProtectionConfig.windowSize / 1000}s`
              : 'Protect against message flooding',
            type: 'submenu',
            submenuItems: [
              {
                id: 'flood-protection-enabled',
                title: t('Enable Flood Protection', { _tags: tags }),
                type: 'switch',
                value: floodProtectionConfig?.enabled || false,
                onValueChange: async (value: string | boolean) => {
                  await updateFloodProtectionConfig({ enabled: value as boolean });
                },
              },
              {
                id: 'flood-protection-max-msgs',
                title: t('Max Messages Per Window', { _tags: tags }),
                description: `Max messages: ${floodProtectionConfig?.maxMessagesPerWindow || 10}`,
                type: 'input',
                value: floodProtectionConfig?.maxMessagesPerWindow?.toString() || '10',
                keyboardType: 'numeric',
                disabled: !floodProtectionConfig?.enabled,
                onValueChange: async (value: string | boolean) => {
                  const maxMsgs = parseInt(value as string, 10);
                  if (!isNaN(maxMsgs) && maxMsgs > 0) {
                    await updateFloodProtectionConfig({ maxMessagesPerWindow: maxMsgs });
                  }
                },
              },
              {
                id: 'flood-protection-window',
                title: t('Window Size (ms)', { _tags: tags }),
                description: `Window size: ${floodProtectionConfig?.windowSize || 5000}ms`,
                type: 'input',
                value: floodProtectionConfig?.windowSize?.toString() || '5000',
                keyboardType: 'numeric',
                disabled: !floodProtectionConfig?.enabled,
                onValueChange: async (value: string | boolean) => {
                  const window = parseInt(value as string, 10);
                  if (!isNaN(window) && window > 0) {
                    await updateFloodProtectionConfig({ windowSize: window });
                  }
                },
              },
            ],
          },
          {
            id: 'quality-lag-monitoring',
            title: t('Lag Monitoring', { _tags: tags }),
            description: lagMonitoringConfig?.enabled
              ? `Ping every ${lagMonitoringConfig.pingInterval / 1000}s, warning: ${lagMonitoringConfig.warningThreshold}ms`
              : 'Monitor connection lag/ping',
            type: 'submenu',
            submenuItems: [
              {
                id: 'lag-monitoring-enabled',
                title: t('Enable Lag Monitoring', { _tags: tags }),
                type: 'switch',
                value: lagMonitoringConfig?.enabled || false,
                onValueChange: async (value: string | boolean) => {
                  await updateLagMonitoringConfig({ enabled: value as boolean });
                },
              },
              {
                id: 'lag-monitoring-method',
                title: t('Lag Check Method', { _tags: tags }),
                description: `Using: ${lagCheckMethod === 'ctcp' ? 'CTCP Ping' : 'Server Ping'}`,
                type: 'button',
                onPress: () => {
                  Alert.alert(
                    t('Lag Check Method', { _tags: tags }),
                    t('Select the method to check for lag:', { _tags: tags }),
                    [
                      { text: t('Cancel', { _tags: tags }), style: 'cancel' },
                      {
                        text: 'CTCP Ping',
                        onPress: async () => {
                          setLagCheckMethod('ctcp');
                          await settingsService.setSetting('lagCheckMethod', 'ctcp');
                        },
                      },
                      {
                        text: 'Server Ping',
                        onPress: async () => {
                          setLagCheckMethod('server');
                          await settingsService.setSetting('lagCheckMethod', 'server');
                        },
                      },
                    ]
                  );
                },
              },
              {
                id: 'lag-monitoring-interval',
                title: t('Ping Interval (ms)', { _tags: tags }),
                description: `Ping every: ${lagMonitoringConfig?.pingInterval || 30000}ms`,
                type: 'input',
                value: lagMonitoringConfig?.pingInterval?.toString() || '30000',
                keyboardType: 'numeric',
                disabled: !lagMonitoringConfig?.enabled,
                onValueChange: async (value: string | boolean) => {
                  const interval = parseInt(value as string, 10);
                  if (!isNaN(interval) && interval > 0) {
                    await updateLagMonitoringConfig({ pingInterval: interval });
                  }
                },
              },
              {
                id: 'lag-monitoring-warning',
                title: t('Warning Threshold (ms)', { _tags: tags }),
                description: `Warning at: ${lagMonitoringConfig?.warningThreshold || 1000}ms`,
                type: 'input',
                value: lagMonitoringConfig?.warningThreshold?.toString() || '1000',
                keyboardType: 'numeric',
                disabled: !lagMonitoringConfig?.enabled,
                onValueChange: async (value: string | boolean) => {
                  const threshold = parseInt(value as string, 10);
                  if (!isNaN(threshold) && threshold > 0) {
                    await updateLagMonitoringConfig({ warningThreshold: threshold });
                  }
                },
              },
            ],
          },
          {
            id: 'quality-statistics',
            title: t('Connection Statistics', { _tags: tags }),
            description: connectionStats
              ? `Uptime: ${Math.floor((Date.now() - connectionStats.connectionStartTime) / 1000)}s, Avg ping: ${connectionStats.averagePing.toFixed(0)}ms`
              : 'View connection statistics',
            type: 'button',
            onPress: () => {
              const stats = connectionQualityService.getStatistics();
              const uptime = Math.floor((Date.now() - stats.connectionStartTime) / 1000);
              const uptimeStr = uptime < 60 ? `${uptime}s` : uptime < 3600 ? `${Math.floor(uptime / 60)}m` : `${Math.floor(uptime / 3600)}h`;
              Alert.alert(
                'Connection Statistics',
                `Uptime: ${uptimeStr}\n` +
                `Messages Sent: ${stats.messagesSent}\n` +
                `Messages Received: ${stats.messagesReceived}\n` +
                `Bytes Sent: ${(stats.bytesSent / 1024).toFixed(2)} KB\n` +
                `Bytes Received: ${(stats.bytesReceived / 1024).toFixed(2)} KB\n` +
                `Current Lag: ${stats.currentLag}ms\n` +
                `Average Ping: ${stats.averagePing.toFixed(0)}ms\n` +
                `Min Ping: ${stats.minPing}ms\n` +
                `Max Ping: ${stats.maxPing}ms\n` +
                `Lag Status: ${stats.lagStatus}`,
                [{ text: 'OK' }]
              );
            },
          },
        ],
      },
      {
        id: 'identity-profiles',
        title: t('Identity Profiles', { _tags: tags }),
        description: `${identityProfiles.length} saved`,
        type: 'button',
        onPress: () => onShowConnectionProfiles?.(),
      },
      {
        id: 'connection-global-proxy',
        title: t('Global Proxy', { _tags: tags }),
        description: globalProxyEnabled ? `${globalProxyType.toUpperCase()} - ${globalProxyHost}:${globalProxyPort}` : 'Configure proxy for all connections',
        type: 'submenu',
        submenuItems: [
          {
            id: 'proxy-enable',
            title: t('Enable Global Proxy', { _tags: tags }),
            description: t('Route all IRC connections through a proxy', { _tags: tags }),
            type: 'switch',
            value: globalProxyEnabled,
            onValueChange: async (value: string | boolean) => {
              const boolValue = value as boolean;
              setGlobalProxyEnabled(boolValue);
              await settingsService.setSetting('globalProxy', {
                enabled: boolValue,
                type: globalProxyType,
                host: globalProxyHost,
                port: globalProxyPort ? parseInt(globalProxyPort) : 0,
                username: globalProxyUsername,
                password: globalProxyPassword,
              });
            },
          },
          {
            id: 'proxy-type',
            title: t('Proxy Type', { _tags: tags }),
            description: t('Select proxy protocol', { _tags: tags }),
            type: 'button',
            onPress: () => {
              Alert.alert(
                t('Proxy Type', { _tags: tags }),
                t('Select proxy protocol:', { _tags: tags }),
                [
                  { text: t('Cancel', { _tags: tags }), style: 'cancel' },
                  {
                    text: 'SOCKS5',
                    onPress: async () => {
                      setGlobalProxyType('socks5');
                      await settingsService.setSetting('globalProxy', {
                        enabled: globalProxyEnabled,
                        type: 'socks5',
                        host: globalProxyHost,
                        port: globalProxyPort ? parseInt(globalProxyPort) : 0,
                        username: globalProxyUsername,
                        password: globalProxyPassword,
                      });
                    },
                  },
                  {
                    text: 'SOCKS4',
                    onPress: async () => {
                      setGlobalProxyType('socks4');
                      await settingsService.setSetting('globalProxy', {
                        enabled: globalProxyEnabled,
                        type: 'socks4',
                        host: globalProxyHost,
                        port: globalProxyPort ? parseInt(globalProxyPort) : 0,
                        username: globalProxyUsername,
                        password: globalProxyPassword,
                      });
                    },
                  },
                  {
                    text: 'HTTP',
                    onPress: async () => {
                      setGlobalProxyType('http');
                      await settingsService.setSetting('globalProxy', {
                        enabled: globalProxyEnabled,
                        type: 'http',
                        host: globalProxyHost,
                        port: globalProxyPort ? parseInt(globalProxyPort) : 0,
                        username: globalProxyUsername,
                        password: globalProxyPassword,
                      });
                    },
                  },
                ]
              );
            },
          },
          {
            id: 'proxy-host',
            title: t('Proxy Host', { _tags: tags }),
            description: t('Proxy server hostname or IP', { _tags: tags }),
            type: 'input',
            value: globalProxyHost,
            placeholder: t('proxy.example.com', { _tags: tags }),
            onValueChange: async (value: string | boolean) => {
              const strValue = value as string;
              setGlobalProxyHost(strValue);
              await settingsService.setSetting('globalProxy', {
                enabled: globalProxyEnabled,
                type: globalProxyType,
                host: strValue,
                port: globalProxyPort ? parseInt(globalProxyPort) : 0,
                username: globalProxyUsername,
                password: globalProxyPassword,
              });
            },
          },
          {
            id: 'proxy-port',
            title: t('Proxy Port', { _tags: tags }),
            description: t('Proxy server port', { _tags: tags }),
            type: 'input',
            value: globalProxyPort,
            placeholder: t('1080', { _tags: tags }),
            keyboardType: 'numeric',
            onValueChange: async (value: string | boolean) => {
              const strValue = value as string;
              setGlobalProxyPort(strValue);
              await settingsService.setSetting('globalProxy', {
                enabled: globalProxyEnabled,
                type: globalProxyType,
                host: globalProxyHost,
                port: strValue ? parseInt(strValue) : 0,
                username: globalProxyUsername,
                password: globalProxyPassword,
              });
            },
          },
          {
            id: 'proxy-username',
            title: t('Proxy Username (optional)', { _tags: tags }),
            description: t('Leave blank if no authentication required', { _tags: tags }),
            type: 'input',
            value: globalProxyUsername,
            placeholder: t('username', { _tags: tags }),
            onValueChange: async (value: string | boolean) => {
              const strValue = value as string;
              setGlobalProxyUsername(strValue);
              await settingsService.setSetting('globalProxy', {
                enabled: globalProxyEnabled,
                type: globalProxyType,
                host: globalProxyHost,
                port: globalProxyPort ? parseInt(globalProxyPort) : 0,
                username: strValue,
                password: globalProxyPassword,
              });
            },
          },
          {
            id: 'proxy-password',
            title: t('Proxy Password (optional)', { _tags: tags }),
            description: t('Leave blank if no authentication required', { _tags: tags }),
            type: 'input',
            value: globalProxyPassword,
            placeholder: t('password', { _tags: tags }),
            secureTextEntry: true,
            onValueChange: async (value: string | boolean) => {
              const strValue = value as string;
              setGlobalProxyPassword(strValue);
              await settingsService.setSetting('globalProxy', {
                enabled: globalProxyEnabled,
                type: globalProxyType,
                host: globalProxyHost,
                port: globalProxyPort ? parseInt(globalProxyPort) : 0,
                username: globalProxyUsername,
                password: strValue,
              });
            },
          },
        ],
      },
      {
        id: 'connection-biometric-lock',
        title: t('Biometric Lock for Passwords', { _tags: tags }),
        description: biometricAvailable
          ? (biometricLockEnabled ? 'Fingerprint required before showing/editing passwords' : 'Require fingerprint before showing/editing passwords')
          : 'Biometrics unavailable on this device',
        type: 'switch',
        value: biometricLockEnabled,
        disabled: !biometricAvailable,
        onValueChange: handleBiometricLockToggle,
      },
      {
        id: 'connection-pin-lock',
        title: t('PIN Lock for Passwords', { _tags: tags }),
        description: pinLockEnabled
          ? 'PIN required before showing/editing passwords'
          : 'Require a PIN before showing/editing passwords',
        type: 'switch',
        value: pinLockEnabled,
        onValueChange: handlePinLockToggle,
      },
      ...(passwordLockActive ? [{
        id: 'connection-unlock-passwords',
        title: passwordsUnlocked ? 'Passwords Unlocked' : 'Unlock Passwords',
        description: passwordsUnlocked ? 'Passwords are unlocked for this session' : passwordUnlockDescription,
        type: 'button' as const,
        disabled: passwordsUnlocked,
        onPress: async () => {
          await unlockPasswords();
        },
      }] : []),
      {
        id: 'channel-favorites',
        title: t('Channel Favorites', { _tags: tags }),
        description: favoritesCount > 0
          ? (favoritesCount === 1
            ? t('{count} favorite across networks', { count: favoritesCount, _tags: tags })
            : t('{count} favorites across networks', { count: favoritesCount, _tags: tags }))
          : t('Manage favorite channels', { _tags: tags }),
        type: 'submenu',
        submenuItems: [
          ...(allFavorites.length === 0
            ? [
                {
                  id: 'favorites-empty',
                  title: t('No favorites yet', { _tags: tags }),
                  type: 'button' as const,
                  disabled: true,
                } as SettingItemType,
              ]
            : allFavorites.map(fav => {
                const otherNetworks = networks.filter(n => n.id !== fav.network);
                return {
                  id: `favorite-${fav.network}-${fav.name}`,
                  title: fav.name,
                  description: `${t('Network: {network}', { network: networkLabel(fav.network), _tags: tags })}${fav.autoJoin ? ` · ${t('Auto-join', { _tags: tags })}` : ''}${fav.key ? ` · ${t('Key set', { _tags: tags })}` : ''}`,
                  type: 'submenu' as const,
                  submenuItems: [
                    {
                      id: `favorite-info-${fav.network}-${fav.name}`,
                      title: t('Network: {network}', { network: networkLabel(fav.network), _tags: tags }),
                      type: 'button' as const,
                      disabled: true,
                    },
                    ...(otherNetworks.length > 0
                      ? otherNetworks.map(n => ({
                          id: `favorite-move-${fav.network}-${fav.name}-${n.id}`,
                          title: t('Move to {name}', { name: n.name, _tags: tags }),
                          type: 'button' as const,
                          onPress: () => handleFavoriteMove(fav, n.id),
                        }))
                      : [
                          {
                            id: `favorite-no-move-${fav.network}-${fav.name}`,
                            title: t('No other networks available', { _tags: tags }),
                            type: 'button' as const,
                            disabled: true,
                          } as SettingItemType,
                        ]),
                    {
                      id: `favorite-delete-${fav.network}-${fav.name}`,
                      title: t('Delete Favorite', { _tags: tags }),
                      type: 'button' as const,
                      onPress: () =>
                        Alert.alert(
                          t('Delete Favorite', { _tags: tags }),
                          t('Remove {name} from {network}?', {
                            name: fav.name,
                            network: networkLabel(fav.network),
                            _tags: tags,
                          }),
                          [
                            { text: t('Cancel', { _tags: tags }), style: 'cancel' },
                            {
                              text: t('Delete', { _tags: tags }),
                              style: 'destructive',
                              onPress: () => handleFavoriteDelete(fav),
                            },
                          ]
                        ),
                    },
                  ],
                } as SettingItemType;
              })),
        ],
      },
      {
        id: 'channel-auto-join-favorites',
        title: t('Auto-Join Favorites on Connect', { _tags: tags }),
        description: t('Join favorited channels after connect/identify', { _tags: tags }),
        type: 'switch',
        value: autoJoinFavoritesEnabled,
        onValueChange: async (value: string | boolean) => {
          const boolValue = value as boolean;
          setAutoJoinFavoritesEnabled(boolValue);
          await settingsService.setSetting('autoJoinFavorites', boolValue);
        },
      },
      {
        id: 'channel-auto-rejoin',
        title: t('Auto-Rejoin on Kick', { _tags: tags }),
        description: t('Automatically rejoin channel if kicked', { _tags: tags }),
        type: 'switch',
        value: autoRejoinEnabled,
        disabled: !currentNetwork,
        onValueChange: (value: string | boolean) => {
          if (currentNetwork) {
            autoRejoinService.setEnabled(currentNetwork, value as boolean);
            setAutoRejoinEnabled(value as boolean);
          }
        },
      },
      {
        id: 'channel-auto-voice',
        title: t('Auto-Voice on Join', { _tags: tags }),
        description: autoVoiceConfig?.enabled
          ? `${autoVoiceConfig.forAll ? 'All users' : ''}${autoVoiceConfig.forOperators ? 'Operators' : ''}${autoVoiceConfig.forIRCOps ? 'IRC Ops' : ''}`
          : 'Automatically request voice when joining channels',
        type: 'submenu',
        submenuItems: [
          {
            id: 'auto-voice-enabled',
            title: t('Enable Auto-Voice', { _tags: tags }),
            type: 'switch',
            value: autoVoiceConfig?.enabled || false,
            disabled: !currentNetwork,
            onValueChange: (value: string | boolean) => {
              if (currentNetwork) {
                const config = autoVoiceService.getConfig(currentNetwork) || getDefaultAutoVoiceConfig();
                config.enabled = value as boolean;
                autoVoiceService.setConfig(currentNetwork, config);
                setAutoVoiceConfig(config);
              }
            },
          },
          {
            id: 'auto-voice-all',
            title: t('For All Users', { _tags: tags }),
            type: 'switch',
            value: autoVoiceConfig?.forAll || false,
            disabled: !autoVoiceConfig?.enabled || !currentNetwork,
            onValueChange: (value: string | boolean) => {
              if (currentNetwork) {
                const config = autoVoiceService.getConfig(currentNetwork) || getDefaultAutoVoiceConfig();
                config.forAll = value as boolean;
                autoVoiceService.setConfig(currentNetwork, config);
                setAutoVoiceConfig(config);
              }
            },
          },
          {
            id: 'auto-voice-operators',
            title: t('For Operators/Halfops', { _tags: tags }),
            type: 'switch',
            value: autoVoiceConfig?.forOperators || false,
            disabled: !autoVoiceConfig?.enabled || !currentNetwork,
            onValueChange: (value: string | boolean) => {
              if (currentNetwork) {
                const config = autoVoiceService.getConfig(currentNetwork) || getDefaultAutoVoiceConfig();
                config.forOperators = value as boolean;
                autoVoiceService.setConfig(currentNetwork, config);
                setAutoVoiceConfig(config);
              }
            },
          },
          {
            id: 'auto-voice-ircops',
            title: t('For IRC Ops (Admin/Netadmin)', { _tags: tags }),
            type: 'switch',
            value: autoVoiceConfig?.forIRCOps || false,
            disabled: !autoVoiceConfig?.enabled || !currentNetwork,
            onValueChange: (value: string | boolean) => {
              if (currentNetwork) {
                const config = autoVoiceService.getConfig(currentNetwork) || getDefaultAutoVoiceConfig();
                config.forIRCOps = value as boolean;
                autoVoiceService.setConfig(currentNetwork, config);
                setAutoVoiceConfig(config);
              }
            },
          },
        ],
      },
      {
        id: 'connection-dcc',
        title: t('DCC Settings', { _tags: tags }),
        description: `Port range ${dccMinPort}-${dccMaxPort}`,
        type: 'submenu',
        submenuItems: dccSubmenuItems,
      },
    ];

    return items;
  }, [
    autoConnectFavoriteServer,
    autoReconnectConfig,
    rateLimitConfig,
    floodProtectionConfig,
    lagMonitoringConfig,
    connectionStats,
    identityProfiles.length,
    globalProxyEnabled,
    globalProxyType,
    globalProxyHost,
    globalProxyPort,
    biometricLockEnabled,
    biometricAvailable,
    pinLockEnabled,
    passwordsUnlocked,
    passwordLockActive,
    passwordUnlockDescription,
    favoritesCount,
    allFavorites,
    networks,
    autoJoinFavoritesEnabled,
    autoRejoinEnabled,
    autoVoiceConfig,
    dccMinPort,
    dccMaxPort,
    lagCheckMethod,
    dccSubmenuItems,
    networkLabel,
    handleFavoriteDelete,
    handleFavoriteMove,
    getDefaultAutoReconnectConfig,
    getDefaultAutoVoiceConfig,
    updateAutoReconnectConfig,
    updateRateLimitConfig,
    updateFloodProtectionConfig,
    updateLagMonitoringConfig,
    unlockPasswords,
    handleBiometricLockToggle,
    handlePinLockToggle,
    onShowFirstRunSetup,
    onShowConnectionProfiles,
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
      
      {/* PIN Modal */}
      <Modal
        visible={pinModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => closePinModal(false)}>
        <View style={[styles.submenuOverlay, { justifyContent: 'center', alignItems: 'center' }]}>
          <View style={[styles.submenuContainer, { width: '80%', maxWidth: 400 }]}>
            <View style={styles.submenuHeader}>
              <Text style={styles.submenuTitle}>
                {pinModalMode === 'unlock' ? t('Unlock Passwords', { _tags: tags }) : pinModalMode === 'setup' ? t('Set PIN', { _tags: tags }) : t('Confirm PIN', { _tags: tags })}
              </Text>
              <TouchableOpacity onPress={() => closePinModal(false)}>
                <Text style={styles.closeButtonText}>{t('Cancel', { _tags: tags })}</Text>
              </TouchableOpacity>
            </View>
            <View style={{ padding: 16 }}>
              <TextInput
                style={[
                  styles.submenuInput,
                  { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border },
                ]}
                placeholder={pinModalMode === 'confirm' ? t('Re-enter PIN', { _tags: tags }) : t('Enter PIN', { _tags: tags })}
                placeholderTextColor={colors.textSecondary}
                value={pinEntry}
                onChangeText={setPinEntry}
                keyboardType="numeric"
                secureTextEntry
                autoFocus
              />
              {pinError ? (
                <Text style={[styles.submenuItemDescription, { color: 'red', marginTop: 8 }]}>
                  {pinError}
                </Text>
              ) : null}
              <TouchableOpacity
                style={{
                  backgroundColor: colors.primary,
                  padding: 12,
                  borderRadius: 8,
                  marginTop: 16,
                  alignItems: 'center',
                }}
                onPress={handlePinSubmit}>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>
                  {pinModalMode === 'confirm' ? t('Confirm', { _tags: tags }) : t('Submit', { _tags: tags })}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { Alert, Modal, View, Text, TextInput, TouchableOpacity, AppState, ScrollView, Switch } from 'react-native';
import { pick, types, isErrorWithCode, errorCodes } from '@react-native-documents/picker';
import { SettingItem } from '../SettingItem';
import { useSettingsConnection } from '../../../hooks/useSettingsConnection';
import { useT } from '../../../i18n/transifex';
import { SettingItem as SettingItemType, SettingIcon } from '../../../types/settings';
import { NEW_FEATURE_DEFAULTS, settingsService } from '../../../services/SettingsService';
import { autoReconnectService, AutoReconnectConfig } from '../../../services/AutoReconnectService';
import { connectionQualityService } from '../../../services/ConnectionQualityService';
import { autoRejoinService } from '../../../services/AutoRejoinService';
import { autoVoiceService, AutoVoiceConfig } from '../../../services/AutoVoiceService';
import { channelFavoritesService, ChannelFavorite } from '../../../services/ChannelFavoritesService';
import { identityProfilesService, IdentityProfile } from '../../../services/IdentityProfilesService';
import { useSettingsSecurity } from '../../../hooks/useSettingsSecurity';
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
    submenuOverlay?: any;
    submenuContainer?: any;
    submenuHeader?: any;
    submenuTitle?: any;
    submenuItem?: any;
    submenuItemContent?: any;
    submenuItemText?: any;
    submenuItemDescription?: any;
    submenuInput?: any;
    closeButtonText?: any;
  };
  settingIcons: Record<string, SettingIcon | undefined>;
  currentNetwork?: string;
  onShowFirstRunSetup?: () => void;
  onShowNetworksList?: () => void;
  onShowConnectionProfiles?: () => void;
}

const PIN_STORAGE_KEY = '@AndroidIRCX:pin-lock';

export const ConnectionNetworkSection: React.FC<ConnectionNetworkSectionProps> = ({
  colors,
  styles,
  settingIcons,
  currentNetwork,
  onShowFirstRunSetup,
  onShowNetworksList,
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
  const { quickConnectNetworkId, setQuickConnectNetworkId } = useSettingsSecurity();

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
  const [dccHostOverride, setDccHostOverride] = useState('');
  const [dccAutoGetMode, setDccAutoGetMode] = useState<'accept' | 'reject' | 'dont_send'>('accept');
  const [dccAcceptExts, setDccAcceptExts] = useState<string[]>([]);
  const [dccRejectExts, setDccRejectExts] = useState<string[]>([]);
  const [dccDontSendExts, setDccDontSendExts] = useState<string[]>([]);
  const [dccAutoChatFrom, setDccAutoChatFrom] = useState(1);
  const [dccAutoGetFrom, setDccAutoGetFrom] = useState(4);
  const [dccServeViewerAuto, setDccServeViewerAuto] = useState(false);
  const [dccCloseQueriesOnChat, setDccCloseQueriesOnChat] = useState(false);
  const [dccRequestOnFail, setDccRequestOnFail] = useState(false);
  const [dccAllowByIp, setDccAllowByIp] = useState(false);
  const [dccBlockPrivateIp, setDccBlockPrivateIp] = useState(true); // Block RFC1918/localhost by default for security
  const [dccPassive, setDccPassive] = useState(false);
  const [dccReplyQueueCommands, setDccReplyQueueCommands] = useState(false);
  const [dccSendMaxKbps, setDccSendMaxKbps] = useState('0');
  const [dccCancelAboveKbps, setDccCancelAboveKbps] = useState('0');
  const [dccDownloadFolder, setDccDownloadFolder] = useState('');

  const normalizePickedPath = useCallback((uri: string): string => {
    let path = uri || '';
    if (path.startsWith('file://')) {
      path = path.slice(7);
    }
    try {
      path = decodeURIComponent(path);
    } catch {
      // ignore decode errors
    }
    return path;
  }, []);

  const handlePickDccFolder = useCallback(async () => {
    try {
      const pickerModule = require('@react-native-documents/picker');
      if (typeof pickerModule.pickDirectory === 'function') {
        const dirResult = await pickerModule.pickDirectory();
        const dirUri = dirResult?.uri || dirResult?.[0]?.uri || dirResult?.[0]?.fileCopyUri;
        if (dirUri) {
          const folderPath = normalizePickedPath(dirUri);
          setDccDownloadFolder(folderPath);
          await settingsService.setSetting('dccDownloadFolder', folderPath);
          return;
        }
      }

      const picked = await pick({
        type: [types.allFiles],
        allowMultiSelection: false,
        copyTo: 'cachesDirectory',
      });
      const file = Array.isArray(picked) ? picked[0] : picked;
      const fileUri = file?.fileCopyUri || file?.uri;
      if (!fileUri) {
        Alert.alert(
          t('Download Folder', { _tags: tags }),
          t('Folder picker is not supported on this device.', { _tags: tags })
        );
        return;
      }
      const filePath = normalizePickedPath(fileUri);
      const folderPath = filePath.replace(/\/[^/]+$/, '');
      if (!folderPath || folderPath === filePath) {
        Alert.alert(
          t('Download Folder', { _tags: tags }),
          t('Unable to resolve a folder from the selected file.', { _tags: tags })
        );
        return;
      }
      setDccDownloadFolder(folderPath);
      await settingsService.setSetting('dccDownloadFolder', folderPath);
    } catch (error: any) {
      if (isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED) {
        return;
      }
      Alert.alert(
        t('Download Folder', { _tags: tags }),
        t('Failed to pick a folder. Please try again.', { _tags: tags })
      );
    }
  }, [normalizePickedPath, t, tags]);
  const [lagCheckMethod, setLagCheckMethod] = useState<'ctcp' | 'server'>('server');
  const [globalProxyType, setGlobalProxyType] = useState<'socks5' | 'socks4' | 'http' | 'tor'>('socks5');
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
  
  // Submenu state for ConnectionNetworkSection items
  const [showSubmenu, setShowSubmenu] = useState<string | null>(null);
  const [submenuRefreshKey, setSubmenuRefreshKey] = useState(0);
  const [showProxyTypeModal, setShowProxyTypeModal] = useState(false);
  const [nestedSubmenuStack, setNestedSubmenuStack] = useState<string[]>([]);
  const [showDccExtModal, setShowDccExtModal] = useState(false);
  const [dccExtModalMode, setDccExtModalMode] = useState<'accept' | 'reject' | 'dont_send'>('accept');
  const [newDccExt, setNewDccExt] = useState('');
  const [showQuickConnectModal, setShowQuickConnectModal] = useState(false);

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
      const dccHost = await settingsService.getSetting('dccHostOverride', '');
      setDccHostOverride(dccHost);
      setDccAutoGetMode(await settingsService.getSetting('dccAutoGetMode', 'accept'));
      setDccAcceptExts(await settingsService.getSetting('dccAcceptExts', NEW_FEATURE_DEFAULTS.dccAcceptExts));
      setDccRejectExts(await settingsService.getSetting('dccRejectExts', NEW_FEATURE_DEFAULTS.dccRejectExts));
      setDccDontSendExts(await settingsService.getSetting('dccDontSendExts', NEW_FEATURE_DEFAULTS.dccDontSendExts));
      setDccAutoChatFrom(await settingsService.getSetting('dccAutoChatFrom', 1));
      setDccAutoGetFrom(await settingsService.getSetting('dccAutoGetFrom', 4));
      setDccServeViewerAuto(await settingsService.getSetting('dccServeViewerAuto', false));
      setDccCloseQueriesOnChat(await settingsService.getSetting('dccCloseQueriesOnChat', false));
      setDccRequestOnFail(await settingsService.getSetting('dccRequestOnFail', false));
      setDccAllowByIp(await settingsService.getSetting('dccAllowByIp', false));
      setDccBlockPrivateIp(await settingsService.getSetting('dccBlockPrivateIp', true)); // Default to true for security
      setDccPassive(await settingsService.getSetting('dccPassive', false));
      setDccReplyQueueCommands(await settingsService.getSetting('dccReplyQueueCommands', false));
      setDccSendMaxKbps(String(await settingsService.getSetting('dccSendMaxKbps', 0)));
      setDccCancelAboveKbps(String(await settingsService.getSetting('dccCancelAboveKbps', 0)));
      setDccDownloadFolder(await settingsService.getSetting('dccDownloadFolder', ''));
      
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
      
      // Re-initialize biometric lock if it was enabled (in case app was restarted)
      if (biometricLock && available) {
        try {
          const reEnabled = await biometricAuthService.enableLock();
          if (!reEnabled) {
            console.warn('Failed to re-enable biometric lock after app restart');
            // Don't disable it in settings, but log the warning
            // PIN fallback will handle it if enabled
          }
        } catch (error) {
          console.error('Error re-enabling biometric lock:', error);
          // PIN fallback will handle it if enabled
        }
      }
      
      // Load network-specific settings
      if (currentNetwork) {
        const reconnectEnabled = autoReconnectService.isEnabled(currentNetwork);
        const reconnectConfig = autoReconnectService.getConfig(currentNetwork);
        if (reconnectConfig) {
          // Update the hook's config state for this network
          updateAutoReconnectConfig(reconnectConfig);
        }
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
  }, [currentNetwork, refreshFavorites]);

  // Track app state for biometric re-initialization
  const appStateRef = useRef(AppState.currentState);

  // Re-initialize biometric lock when app returns to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      const prevAppState = appStateRef.current;
      appStateRef.current = nextAppState;

      // When app returns to foreground (active), re-initialize biometric lock if enabled
      if (prevAppState !== 'active' && nextAppState === 'active') {
        const biometricLock = await settingsService.getSetting('biometricPasswordLock', false);
        const pinLock = await settingsService.getSetting('pinPasswordLock', false);
        const available = await biometricAuthService.isAvailable();
        
        // Lock passwords again when returning to foreground if lock is active
        if ((biometricLock || pinLock) && passwordsUnlocked) {
          setPasswordsUnlocked(false);
        }
        
        // Re-initialize biometric lock if enabled
        if (biometricLock && available) {
          try {
            console.log('[ConnectionNetworkSection] App returned to foreground, re-initializing biometric lock');
            const reEnabled = await biometricAuthService.enableLock();
            if (!reEnabled) {
              console.warn('[ConnectionNetworkSection] Failed to re-enable biometric lock after returning to foreground');
              // PIN fallback will handle it if enabled
            } else {
              console.log('[ConnectionNetworkSection] Biometric lock re-initialized successfully');
            }
          } catch (error) {
            console.error('[ConnectionNetworkSection] Error re-enabling biometric lock after foreground:', error);
            // PIN fallback will handle it if enabled
          }
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [passwordsUnlocked]);

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
  const passwordUnlockDescription = biometricLockEnabled && pinLockEnabled
    ? t('Use fingerprint/biometric or PIN to unlock', { _tags: tags })
    : biometricLockEnabled
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
    // Lock passwords (biometric will also keep them locked if enabled)
    setPasswordsUnlocked(false);
    closePinModal(true);
  }, [closePinModal, pinEntry, pinModalMode, pinSetupValue, t, tags]);

  const unlockPasswords = useCallback(async (): Promise<boolean> => {
    if (!passwordLockActive) {
      setPasswordsUnlocked(true);
      return true;
    }
    
    // Try biometric first if enabled
    if (biometricLockEnabled && biometricAvailable) {
      const result = await biometricAuthService.authenticate(
        t('Unlock passwords', { _tags: tags }),
        t('Authenticate to view passwords', { _tags: tags })
      );
      if (result.success) {
        setPasswordsUnlocked(true);
        return true;
      }
      // If biometric fails and PIN is also enabled, fall back to PIN
      if (pinLockEnabled) {
        // Don't show error alert, just fall through to PIN
      } else {
        // Only show error if PIN is not available as fallback
        const errorMessage = result.errorMessage
          || (result.errorKey ? t(result.errorKey, { _tags: tags }) : t('Unable to unlock passwords.', { _tags: tags }));
        Alert.alert(
          t('Authentication failed', { _tags: tags }),
          errorMessage
        );
        return false;
      }
    }
    
    // Try PIN if enabled (either as primary or fallback)
    if (pinLockEnabled) {
      return await requestPinUnlock();
    }
    
    // If biometric was enabled but unavailable, show error
    if (biometricLockEnabled && !biometricAvailable) {
      Alert.alert(
        t('Biometrics unavailable', { _tags: tags }),
        t('Enable a fingerprint/biometric on your device first.', { _tags: tags })
      );
      return false;
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
      // Allow biometric and PIN to be enabled together - don't disable PIN
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
      // Lock passwords (both biometric and PIN can be active)
      setPasswordsUnlocked(false);
      return;
    }
    await biometricAuthService.disableLock();
    await settingsService.setSetting('biometricPasswordLock', false);
    setBiometricLockEnabled(false);
    // Only unlock if PIN is also disabled
    if (!pinLockEnabled) {
      setPasswordsUnlocked(true);
    }
  };

  const handlePinLockToggle = async (value: boolean) => {
    if (value) {
      // Allow PIN and biometric to be enabled together - don't disable biometric
      const setupSuccess = await requestPinSetup();
      if (setupSuccess) {
        // Passwords are now locked by PIN (both biometric and PIN can be active)
        setPasswordsUnlocked(false);
      }
      return;
    }
    await secureStorageService.removeSecret(PIN_STORAGE_KEY);
    await settingsService.setSetting('pinPasswordLock', false);
    setPinLockEnabled(false);
    // Only unlock if biometric is also disabled
    if (!biometricLockEnabled) {
      setPasswordsUnlocked(true);
    }
  };

  const dccAutoModeLabel = useMemo(() => {
    switch (dccAutoGetMode) {
      case 'reject':
        return t('Reject', { _tags: tags });
      case 'dont_send':
        return t("Don't send", { _tags: tags });
      default:
        return t('Accept', { _tags: tags });
    }
  }, [dccAutoGetMode, t, tags]);

  const dccAutoChatLabel = useMemo(() => {
    switch (dccAutoChatFrom) {
      case 2:
        return t('2 - Friends/Allowlist', { _tags: tags });
      case 3:
        return t('3 - Ops', { _tags: tags });
      case 4:
        return t('4 - Auto Op & Notify', { _tags: tags });
      default:
        return t('1 - Always ask', { _tags: tags });
    }
  }, [dccAutoChatFrom, t, tags]);

  const dccAutoGetLabel = useMemo(() => {
    switch (dccAutoGetFrom) {
      case 2:
        return t('2 - Friends/Allowlist', { _tags: tags });
      case 3:
        return t('3 - Ops', { _tags: tags });
      case 4:
        return t('4 - Auto Op & Notify', { _tags: tags });
      default:
        return t('1 - Always ask', { _tags: tags });
    }
  }, [dccAutoGetFrom, t, tags]);

  // DCC submenu items
  const dccSubmenuItems = useMemo<SettingItemType[]>(() => ([
    {
      id: 'dcc-auto-get-mode',
      title: t('Getting files (auto)', { _tags: tags }),
      description: t('Mode: {mode}', { mode: dccAutoModeLabel, _tags: tags }),
      type: 'button',
      onPress: () => {
        Alert.alert(
          t('Auto-Get Mode', { _tags: tags }),
          t('Select behavior for incoming files', { _tags: tags }),
          [
            { text: t('Cancel', { _tags: tags }), style: 'cancel' },
            {
              text: t('Accept', { _tags: tags }),
              onPress: async () => {
                setDccAutoGetMode('accept');
                await settingsService.setSetting('dccAutoGetMode', 'accept');
              },
            },
            {
              text: t('Reject', { _tags: tags }),
              onPress: async () => {
                setDccAutoGetMode('reject');
                await settingsService.setSetting('dccAutoGetMode', 'reject');
              },
            },
            {
              text: t("Don't send", { _tags: tags }),
              onPress: async () => {
                setDccAutoGetMode('dont_send');
                await settingsService.setSetting('dccAutoGetMode', 'dont_send');
              },
            },
          ]
        );
      },
    },
    {
      id: 'dcc-file-filters',
      title: t('File type filters', { _tags: tags }),
      description: t('Accept {accept} / Reject {reject} / Block {block}', {
        accept: dccAcceptExts.length,
        reject: dccRejectExts.length,
        block: dccDontSendExts.length,
        _tags: tags,
      }),
      type: 'submenu',
      submenuItems: [
        {
          id: 'dcc-accept-exts',
          title: t('Accept list', { _tags: tags }),
          description: t('{count} items', { count: dccAcceptExts.length, _tags: tags }),
          type: 'button',
          onPress: () => {
            setDccExtModalMode('accept');
            setShowDccExtModal(true);
          },
        },
        {
          id: 'dcc-reject-exts',
          title: t('Reject list', { _tags: tags }),
          description: t('{count} items', { count: dccRejectExts.length, _tags: tags }),
          type: 'button',
          onPress: () => {
            setDccExtModalMode('reject');
            setShowDccExtModal(true);
          },
        },
        {
          id: 'dcc-dont-send-exts',
          title: t("Don't send list", { _tags: tags }),
          description: t('{count} items', { count: dccDontSendExts.length, _tags: tags }),
          type: 'button',
          onPress: () => {
            setDccExtModalMode('dont_send');
            setShowDccExtModal(true);
          },
        },
      ],
    },
    {
      id: 'dcc-auto-chat-from',
      title: t('Auto accept CHAT from', { _tags: tags }),
      description: dccAutoChatLabel,
      type: 'button',
      onPress: () => {
        Alert.alert(
          t('Auto Accept Chat', { _tags: tags }),
          t('Select who can auto-start DCC chat', { _tags: tags }),
          [
            { text: t('Cancel', { _tags: tags }), style: 'cancel' },
            {
              text: t('1 - Always ask', { _tags: tags }),
              onPress: async () => {
                setDccAutoChatFrom(1);
                await settingsService.setSetting('dccAutoChatFrom', 1);
              },
            },
            {
              text: t('2 - Friends/Allowlist', { _tags: tags }),
              onPress: async () => {
                setDccAutoChatFrom(2);
                await settingsService.setSetting('dccAutoChatFrom', 2);
              },
            },
            {
              text: t('3 - Ops', { _tags: tags }),
              onPress: async () => {
                setDccAutoChatFrom(3);
                await settingsService.setSetting('dccAutoChatFrom', 3);
              },
            },
            {
              text: t('4 - Auto Op & Notify', { _tags: tags }),
              onPress: async () => {
                setDccAutoChatFrom(4);
                await settingsService.setSetting('dccAutoChatFrom', 4);
              },
            },
          ]
        );
      },
    },
    {
      id: 'dcc-auto-get-from',
      title: t('Auto accept gets from', { _tags: tags }),
      description: dccAutoGetLabel,
      type: 'button',
      onPress: () => {
        Alert.alert(
          t('Auto Accept Gets', { _tags: tags }),
          t('Select who can auto-send files', { _tags: tags }),
          [
            { text: t('Cancel', { _tags: tags }), style: 'cancel' },
            {
              text: t('1 - Always ask', { _tags: tags }),
              onPress: async () => {
                setDccAutoGetFrom(1);
                await settingsService.setSetting('dccAutoGetFrom', 1);
              },
            },
            {
              text: t('2 - Friends/Allowlist', { _tags: tags }),
              onPress: async () => {
                setDccAutoGetFrom(2);
                await settingsService.setSetting('dccAutoGetFrom', 2);
              },
            },
            {
              text: t('3 - Ops', { _tags: tags }),
              onPress: async () => {
                setDccAutoGetFrom(3);
                await settingsService.setSetting('dccAutoGetFrom', 3);
              },
            },
            {
              text: t('4 - Auto Op & Notify', { _tags: tags }),
              onPress: async () => {
                setDccAutoGetFrom(4);
                await settingsService.setSetting('dccAutoGetFrom', 4);
              },
            },
          ]
        );
      },
    },
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
    {
      id: 'dcc-host-override',
      title: t('DCC Host/IP Override', { _tags: tags }),
      description: t('Optional public IP or hostname to include in DCC SEND offers', { _tags: tags }),
      type: 'input',
      value: dccHostOverride,
      searchKeywords: ['dcc', 'ip', 'host', 'address', 'public', 'nat', 'forward', 'override'],
      onValueChange: async (value: string | boolean) => {
        const raw = String(value);
        setDccHostOverride(raw);
        await settingsService.setSetting('dccHostOverride', raw.trim());
      },
    },
    {
      id: 'dcc-auto-open-viewer',
      title: t('Auto-open viewer', { _tags: tags }),
      type: 'switch',
      value: dccServeViewerAuto,
      onValueChange: async (value) => {
        const next = Boolean(value);
        setDccServeViewerAuto(next);
        await settingsService.setSetting('dccServeViewerAuto', next);
      },
    },
    {
      id: 'dcc-close-queries',
      title: t('Close queries when chat opens', { _tags: tags }),
      type: 'switch',
      value: dccCloseQueriesOnChat,
      onValueChange: async (value) => {
        const next = Boolean(value);
        setDccCloseQueriesOnChat(next);
        await settingsService.setSetting('dccCloseQueriesOnChat', next);
      },
    },
    {
      id: 'dcc-request-on-fail',
      title: t('Request on fail when receiving', { _tags: tags }),
      type: 'switch',
      value: dccRequestOnFail,
      onValueChange: async (value) => {
        const next = Boolean(value);
        setDccRequestOnFail(next);
        await settingsService.setSetting('dccRequestOnFail', next);
      },
    },
    {
      id: 'dcc-allow-by-ip',
      title: t('Allow DCC by IP', { _tags: tags }),
      type: 'switch',
      value: dccAllowByIp,
      onValueChange: async (value) => {
        const next = Boolean(value);
        setDccAllowByIp(next);
        await settingsService.setSetting('dccAllowByIp', next);
      },
    },
    {
      id: 'dcc-block-private-ip',
      title: t('Block private/local IPs', { _tags: tags }),
      description: t('Block DCC connections to private (RFC1918) and localhost addresses. This prevents SSRF-like attacks where a malicious user could trick your client into connecting to internal network services.', { _tags: tags }),
      type: 'switch',
      value: dccBlockPrivateIp,
      onValueChange: async (value) => {
        if (!value) {
          // Show warning when disabling
          Alert.alert(
            t('Security Warning', { _tags: tags }),
            t('Disabling this option allows DCC connections to private network addresses (10.x.x.x, 192.168.x.x, 172.16-31.x.x, localhost). This could allow malicious users to make your device connect to internal network services. Only disable if you understand the risks and need to connect to a local IRC bouncer or similar service.\n\nAre you sure you want to disable this protection?', { _tags: tags }),
            [
              { text: t('Cancel', { _tags: tags }), style: 'cancel' },
              {
                text: t('Disable Protection', { _tags: tags }),
                style: 'destructive',
                onPress: async () => {
                  setDccBlockPrivateIp(false);
                  await settingsService.setSetting('dccBlockPrivateIp', false);
                },
              },
            ]
          );
        } else {
          setDccBlockPrivateIp(true);
          await settingsService.setSetting('dccBlockPrivateIp', true);
        }
      },
    },
    {
      id: 'dcc-passive',
      title: t('Passive DCC', { _tags: tags }),
      type: 'switch',
      value: dccPassive,
      onValueChange: async (value) => {
        const next = Boolean(value);
        setDccPassive(next);
        await settingsService.setSetting('dccPassive', next);
      },
    },
    {
      id: 'dcc-reply-queue',
      title: t('Reply queue commands', { _tags: tags }),
      type: 'switch',
      value: dccReplyQueueCommands,
      onValueChange: async (value) => {
        const next = Boolean(value);
        setDccReplyQueueCommands(next);
        await settingsService.setSetting('dccReplyQueueCommands', next);
      },
    },
    {
      id: 'dcc-send-max-kbps',
      title: t('Max. speed on sends (KB/s)', { _tags: tags }),
      type: 'input',
      value: dccSendMaxKbps,
      keyboardType: 'numeric',
      onValueChange: async (value) => {
        const raw = String(value);
        setDccSendMaxKbps(raw);
        const num = parseInt(raw, 10);
        if (!Number.isNaN(num)) {
          await settingsService.setSetting('dccSendMaxKbps', num);
        }
      },
    },
    {
      id: 'dcc-cancel-above-kbps',
      title: t('Cancel if send speed is above (KB/s)', { _tags: tags }),
      type: 'input',
      value: dccCancelAboveKbps,
      keyboardType: 'numeric',
      onValueChange: async (value) => {
        const raw = String(value);
        setDccCancelAboveKbps(raw);
        const num = parseInt(raw, 10);
        if (!Number.isNaN(num)) {
          await settingsService.setSetting('dccCancelAboveKbps', num);
        }
      },
    },
    {
      id: 'dcc-download-folder',
      title: t('Download folder', { _tags: tags }),
      description: dccDownloadFolder || t('Default app folder', { _tags: tags }),
      type: 'button',
      onPress: handlePickDccFolder,
    },
  ]), [
    dccMinPort,
    dccMaxPort,
    dccHostOverride,
    dccAutoGetMode,
    dccAutoModeLabel,
    dccAcceptExts.length,
    dccRejectExts.length,
    dccDontSendExts.length,
    dccAutoChatFrom,
    dccAutoGetFrom,
    dccAutoChatLabel,
    dccAutoGetLabel,
    dccServeViewerAuto,
    dccCloseQueriesOnChat,
    dccRequestOnFail,
    dccAllowByIp,
    dccBlockPrivateIp,
    dccPassive,
    dccReplyQueueCommands,
    dccSendMaxKbps,
    dccCancelAboveKbps,
    dccDownloadFolder,
    handlePickDccFolder,
    t,
    tags,
  ]);

  const dccExtList = useMemo(() => {
    switch (dccExtModalMode) {
      case 'reject':
        return dccRejectExts;
      case 'dont_send':
        return dccDontSendExts;
      default:
        return dccAcceptExts;
    }
  }, [dccExtModalMode, dccAcceptExts, dccRejectExts, dccDontSendExts]);

  const dccExtTitle = useMemo(() => {
    switch (dccExtModalMode) {
      case 'reject':
        return t('Reject list', { _tags: tags });
      case 'dont_send':
        return t("Don't send list", { _tags: tags });
      default:
        return t('Accept list', { _tags: tags });
    }
  }, [dccExtModalMode, t, tags]);

  const updateDccExtList = useCallback(async (next: string[]) => {
    if (dccExtModalMode === 'reject') {
      setDccRejectExts(next);
      await settingsService.setSetting('dccRejectExts', next);
      return;
    }
    if (dccExtModalMode === 'dont_send') {
      setDccDontSendExts(next);
      await settingsService.setSetting('dccDontSendExts', next);
      return;
    }
    setDccAcceptExts(next);
    await settingsService.setSetting('dccAcceptExts', next);
  }, [dccExtModalMode]);

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

  // Get current network's auto-reconnect config
  const currentAutoReconnectConfig = useMemo(() => {
    if (currentNetwork) {
      return autoReconnectService.getConfig(currentNetwork) || getDefaultAutoReconnectConfig();
    }
    return getDefaultAutoReconnectConfig();
  }, [currentNetwork, autoReconnectConfig]);

  const sectionData: SettingItemType[] = useMemo(() => {
    const items: SettingItemType[] = [
      {
        id: 'setup-wizard',
        title: t('Setup Wizard', { _tags: tags }),
        description: t('Quick setup for identity and network connection', { _tags: tags }),
        type: 'button',
        searchKeywords: ['setup', 'wizard', 'first', 'run', 'initial', 'configure', 'identity', 'network'],
        onPress: () => onShowFirstRunSetup?.(),
      },
      {
        id: 'choose-network',
        title: t('Choose Network', { _tags: tags }),
        description: t('Open Networks list to choose and manage networks', { _tags: tags }),
        type: 'button',
        searchKeywords: ['choose', 'network', 'networks', 'server', 'identity', 'profiles'],
        onPress: () => {
          onShowNetworksList?.();
        },
      },
      {
        id: 'quick-connect-network',
        title: t('Quick Connect Network', { _tags: tags }),
        description: quickConnectNetworkId
          ? t('Current: {network}', {
              network: networks.find(n => n.id === quickConnectNetworkId)?.name || quickConnectNetworkId,
              _tags: tags,
            })
          : t('Tap header to connect to default network', { _tags: tags }),
        type: 'button',
        searchKeywords: ['quick', 'connect', 'network', 'default', 'header', 'choose'],
        onPress: () => {
          setShowQuickConnectModal(true);
        },
      },
      {
        id: 'connection-auto-connect-favorite',
        title: t('Auto-Connect to Favorite Server', { _tags: tags }),
        description: t('When opening a network, prefer the server marked as favorite.', { _tags: tags }),
        type: 'switch',
        value: autoConnectFavoriteServer,
        searchKeywords: ['auto', 'connect', 'favorite', 'server', 'automatic', 'preferred'],
        onValueChange: async (value: string | boolean) => {
          const boolValue = value as boolean;
          setAutoConnectFavoriteServer(boolValue);
          await settingsService.setSetting('autoConnectFavoriteServer', boolValue);
        },
      },
      {
        id: 'connection-auto-reconnect',
        title: t('Auto-Reconnect', { _tags: tags }),
        description: currentAutoReconnectConfig?.enabled
          ? t('{attempts} attempts, {mode}', {
              attempts: currentAutoReconnectConfig.maxAttempts || '8',
              mode: currentAutoReconnectConfig.rejoinChannels
                ? t('rejoin channels', { _tags: tags })
                : t('no rejoin', { _tags: tags }),
              _tags: tags,
            })
          : t('Automatically reconnect on disconnect', { _tags: tags }),
        type: 'submenu',
        searchKeywords: ['auto', 'reconnect', 'automatic', 'disconnect', 'retry', 'attempts'],
        submenuItems: [
          {
            id: 'auto-reconnect-enabled',
            title: t('Enable Auto-Reconnect', { _tags: tags }),
            type: 'switch',
            value: currentAutoReconnectConfig?.enabled || false,
            onValueChange: async (value: string | boolean) => {
              if (currentNetwork) {
                const config = autoReconnectService.getConfig(currentNetwork) || getDefaultAutoReconnectConfig();
                config.enabled = value as boolean;
                await autoReconnectService.setConfig(currentNetwork, config);
                // Refresh config from service to update UI
                const updatedConfig = autoReconnectService.getConfig(currentNetwork);
                if (updatedConfig) {
                  await updateAutoReconnectConfig(updatedConfig);
                }
                setSubmenuRefreshKey(prev => prev + 1);
              }
            },
          },
          {
            id: 'auto-reconnect-rejoin',
            title: t('Rejoin Channels After Reconnect', { _tags: tags }),
            description: t('Automatically rejoin channels you were in', { _tags: tags }),
            type: 'switch',
            value: currentAutoReconnectConfig?.rejoinChannels || false,
            disabled: !currentAutoReconnectConfig?.enabled,
            onValueChange: async (value: string | boolean) => {
              if (currentNetwork) {
                const config = autoReconnectService.getConfig(currentNetwork) || getDefaultAutoReconnectConfig();
                config.rejoinChannels = value as boolean;
                await autoReconnectService.setConfig(currentNetwork, config);
                // Refresh config from service to update UI
                const updatedConfig = autoReconnectService.getConfig(currentNetwork);
                if (updatedConfig) {
                  await updateAutoReconnectConfig(updatedConfig);
                }
                setSubmenuRefreshKey(prev => prev + 1);
              }
            },
          },
          {
            id: 'auto-reconnect-smart',
            title: t('Smart Reconnection', { _tags: tags }),
            description: t('Avoid flood by spacing reconnection attempts', { _tags: tags }),
            type: 'switch',
            value: currentAutoReconnectConfig?.smartReconnect || false,
            disabled: !currentAutoReconnectConfig?.enabled,
            onValueChange: async (value: string | boolean) => {
              if (currentNetwork) {
                const config = autoReconnectService.getConfig(currentNetwork) || getDefaultAutoReconnectConfig();
                config.smartReconnect = value as boolean;
                await autoReconnectService.setConfig(currentNetwork, config);
                // Refresh config from service to update UI
                const updatedConfig = autoReconnectService.getConfig(currentNetwork);
                if (updatedConfig) {
                  await updateAutoReconnectConfig(updatedConfig);
                }
                setSubmenuRefreshKey(prev => prev + 1);
              }
            },
          },
          {
            id: 'auto-reconnect-max-attempts',
            title: t('Max Reconnection Attempts', { _tags: tags }),
            description: currentAutoReconnectConfig?.maxAttempts
              ? `${currentAutoReconnectConfig.maxAttempts} attempts (0 = unlimited)`
              : 'Maximum reconnection attempts (0 = unlimited)',
            type: 'input',
            value: currentAutoReconnectConfig?.maxAttempts?.toString() || '10',
            keyboardType: 'numeric',
            disabled: !currentAutoReconnectConfig?.enabled,
            onValueChange: async (value: string | boolean) => {
              if (currentNetwork) {
                const config = autoReconnectService.getConfig(currentNetwork) || getDefaultAutoReconnectConfig();
                const attempts = parseInt(value as string, 10);
                config.maxAttempts = isNaN(attempts) ? 0 : attempts;
                await autoReconnectService.setConfig(currentNetwork, config);
                // Refresh config from service to update UI
                const updatedConfig = autoReconnectService.getConfig(currentNetwork);
                if (updatedConfig) {
                  await updateAutoReconnectConfig(updatedConfig);
                }
                setSubmenuRefreshKey(prev => prev + 1);
              }
            },
          },
          {
            id: 'auto-reconnect-initial-delay',
            title: t('Initial Delay (ms)', { _tags: tags }),
            description: `First reconnection delay: ${currentAutoReconnectConfig?.initialDelay || 1000}ms`,
            type: 'input',
            value: currentAutoReconnectConfig?.initialDelay?.toString() || '1000',
            keyboardType: 'numeric',
            disabled: !currentAutoReconnectConfig?.enabled,
            onValueChange: async (value: string | boolean) => {
              if (currentNetwork) {
                const config = autoReconnectService.getConfig(currentNetwork) || getDefaultAutoReconnectConfig();
                const delay = parseInt(value as string, 10);
                config.initialDelay = isNaN(delay) ? 1000 : delay;
                await autoReconnectService.setConfig(currentNetwork, config);
                // Refresh config from service to update UI
                const updatedConfig = autoReconnectService.getConfig(currentNetwork);
                if (updatedConfig) {
                  await updateAutoReconnectConfig(updatedConfig);
                }
                setSubmenuRefreshKey(prev => prev + 1);
              }
            },
          },
          {
            id: 'auto-reconnect-max-delay',
            title: t('Max Delay (ms)', { _tags: tags }),
            description: `Maximum delay between attempts: ${currentAutoReconnectConfig?.maxDelay || 60000}ms`,
            type: 'input',
            value: currentAutoReconnectConfig?.maxDelay?.toString() || '60000',
            keyboardType: 'numeric',
            disabled: !currentAutoReconnectConfig?.enabled,
            onValueChange: async (value: string | boolean) => {
              if (currentNetwork) {
                const config = autoReconnectService.getConfig(currentNetwork) || getDefaultAutoReconnectConfig();
                const delay = parseInt(value as string, 10);
                config.maxDelay = isNaN(delay) ? 60000 : delay;
                await autoReconnectService.setConfig(currentNetwork, config);
                // Refresh config from service to update UI
                const updatedConfig = autoReconnectService.getConfig(currentNetwork);
                if (updatedConfig) {
                  await updateAutoReconnectConfig(updatedConfig);
                }
                setSubmenuRefreshKey(prev => prev + 1);
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
        searchKeywords: ['connection', 'quality', 'lag', 'rate', 'limit', 'flood', 'protection', 'monitoring'],
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
                  setSubmenuRefreshKey(prev => prev + 1);
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
                    setSubmenuRefreshKey(prev => prev + 1);
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
                    setSubmenuRefreshKey(prev => prev + 1);
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
                  setSubmenuRefreshKey(prev => prev + 1);
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
                    setSubmenuRefreshKey(prev => prev + 1);
                  }
                },
              },
              {
                id: 'flood-protection-window',
                title: t('Window Size (ms)', { _tags: tags }),
                description: `Window size: ${floodProtectionConfig?.windowSize || 10000}ms`,
                type: 'input',
                value: floodProtectionConfig?.windowSize?.toString() || '10000',
                keyboardType: 'numeric',
                disabled: !floodProtectionConfig?.enabled,
                onValueChange: async (value: string | boolean) => {
                  const window = parseInt(value as string, 10);
                  if (!isNaN(window) && window > 0) {
                    await updateFloodProtectionConfig({ windowSize: window });
                    setSubmenuRefreshKey(prev => prev + 1);
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
                  setSubmenuRefreshKey(prev => prev + 1);
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
                    setSubmenuRefreshKey(prev => prev + 1);
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
                    setSubmenuRefreshKey(prev => prev + 1);
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
        searchKeywords: ['identity', 'profiles', 'connection', 'manage', 'nicks', 'networks'],
        onPress: () => onShowConnectionProfiles?.(),
      },
      {
        id: 'connection-global-proxy',
        title: t('Global Proxy', { _tags: tags }),
        description: globalProxyEnabled
          ? `${globalProxyType === 'tor' ? 'TOR' : globalProxyType.toUpperCase()} - ${globalProxyHost}:${globalProxyPort}`
          : 'Configure proxy for all connections',
        type: 'submenu',
        searchKeywords: ['proxy', 'global', 'socks', 'socks5', 'socks4', 'http', 'tor', 'connection'],
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
            description: globalProxyType === 'tor' 
              ? 'TOR' 
              : globalProxyType.toUpperCase(),
            type: 'button',
            onPress: () => {
              setShowProxyTypeModal(true);
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
          ? (biometricLockEnabled
              ? (pinLockEnabled
                  ? 'Fingerprint or PIN required (fallback to PIN if biometric fails)'
                  : 'Fingerprint required before showing/editing passwords')
              : 'Require fingerprint before showing/editing passwords (can be used with PIN)')
          : 'Biometrics unavailable on this device',
        type: 'switch',
        value: biometricLockEnabled,
        disabled: !biometricAvailable,
        searchKeywords: ['biometric', 'lock', 'passwords', 'fingerprint', 'face', 'security', 'authentication'],
        onValueChange: handleBiometricLockToggle,
      },
      {
        id: 'connection-pin-lock',
        title: t('PIN Lock for Passwords', { _tags: tags }),
        description: pinLockEnabled
          ? (biometricLockEnabled
              ? 'PIN required (fallback if biometric fails)'
              : 'PIN required before showing/editing passwords')
          : 'Require a PIN before showing/editing passwords (can be used with biometric)',
        type: 'switch',
        value: pinLockEnabled,
        searchKeywords: ['pin', 'lock', 'passwords', 'passcode', 'security', 'number', 'code'],
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
        searchKeywords: ['channel', 'favorites', 'bookmark', 'manage', 'saved'],
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
        searchKeywords: ['auto', 'join', 'favorites', 'automatic', 'connect', 'channel'],
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
        searchKeywords: ['auto', 'rejoin', 'kick', 'automatic', 'channel'],
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
        searchKeywords: ['auto', 'voice', 'join', 'automatic', 'channel', 'mode'],
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
        searchKeywords: ['dcc', 'direct', 'client', 'connection', 'file', 'transfer', 'chat', 'port'],
        submenuItems: dccSubmenuItems,
      },
    ];

    return items;
  }, [
    autoConnectFavoriteServer,
    currentAutoReconnectConfig,
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
    onShowNetworksList,
    onShowConnectionProfiles,
    quickConnectNetworkId,
    setQuickConnectNetworkId,
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
            onPress={(itemId) => {
              if (item.type === 'submenu') {
                setShowSubmenu(itemId);
                setNestedSubmenuStack([]); // Reset nested stack when opening new submenu
              }
            }}
          />
        );
      })}
      
      {/* Submenu Modal */}
      <Modal
        visible={showSubmenu !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSubmenu(null)}>
        <View style={styles.submenuOverlay}>
          <View style={styles.submenuContainer}>
            <View style={styles.submenuHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                {nestedSubmenuStack.length > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      setNestedSubmenuStack(prev => prev.slice(0, -1));
                    }}
                    style={{ marginRight: 12, padding: 4 }}>
                    <Text style={[styles.closeButtonText, { fontSize: 18 }]}>←</Text>
                  </TouchableOpacity>
                )}
                <Text style={styles.submenuTitle}>
                  {(() => {
                    if (nestedSubmenuStack.length > 0) {
                      const nestedItem = sectionData
                        .find((item) => item.id === showSubmenu)
                        ?.submenuItems?.find((subItem) => subItem.id === nestedSubmenuStack[nestedSubmenuStack.length - 1]);
                      return nestedItem?.title || t('Options', { _tags: tags });
                    }
                    return sectionData.find((item) => item.id === showSubmenu)?.title || t('Options', { _tags: tags });
                  })()}
                </Text>
              </View>
              <TouchableOpacity onPress={() => {
                setShowSubmenu(null);
                setNestedSubmenuStack([]);
              }}>
                <Text style={styles.closeButtonText}>{t('Close', { _tags: tags })}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView key={`submenu-${showSubmenu}-${submenuRefreshKey}`}>
              {(() => {
                // Handle nested submenu navigation
                let itemsToShow: SettingItemType[] | undefined;
                if (nestedSubmenuStack.length > 0) {
                  // We're in a nested submenu
                  const parentItem = sectionData
                    .find((item) => item.id === showSubmenu)
                    ?.submenuItems?.find((subItem) => subItem.id === nestedSubmenuStack[nestedSubmenuStack.length - 1]);
                  itemsToShow = parentItem?.submenuItems;
                } else {
                  // We're in the main submenu
                  itemsToShow = sectionData.find((item) => item.id === showSubmenu)?.submenuItems;
                }
                
                return itemsToShow?.map((subItem, index) => {
                  if (subItem.type === 'switch') {
                    return (
                      <View key={subItem.id} style={styles.submenuItem}>
                        <View style={styles.submenuItemContent}>
                          <Text style={styles.submenuItemText}>{subItem.title}</Text>
                          {subItem.description && (
                            <Text style={styles.submenuItemDescription}>{subItem.description}</Text>
                          )}
                        </View>
                        <Switch
                          key={`${subItem.id}-${submenuRefreshKey}`}
                          value={subItem.value as boolean}
                          onValueChange={async (value) => {
                            try {
                              await subItem.onValueChange?.(value);
                              // Force re-render by updating refresh key
                              setSubmenuRefreshKey(prev => prev + 1);
                            } catch (error) {
                              console.error('Error updating setting:', error);
                            }
                          }}
                          disabled={subItem.disabled}
                        />
                      </View>
                    );
                  }
                  if (subItem.type === 'input') {
                    return (
                      <View key={subItem.id} style={styles.submenuItem}>
                        <View style={styles.submenuItemContent}>
                          <Text style={styles.submenuItemText}>{subItem.title}</Text>
                          {subItem.description && (
                            <Text style={styles.submenuItemDescription}>{subItem.description}</Text>
                          )}
                          <TextInput
                            key={`${subItem.id}-${submenuRefreshKey}`}
                            style={[
                              styles.submenuInput,
                              subItem.disabled && styles.disabledInput,
                              { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border },
                            ]}
                            value={subItem.value as string}
                            onChangeText={async (text) => {
                              try {
                                await subItem.onValueChange?.(text);
                                // Force re-render by updating refresh key
                                setSubmenuRefreshKey(prev => prev + 1);
                              } catch (error) {
                                console.error('Error updating setting:', error);
                              }
                            }}
                            placeholder={subItem.placeholder}
                            placeholderTextColor={colors.textSecondary}
                            keyboardType={subItem.keyboardType || 'default'}
                            secureTextEntry={subItem.secureTextEntry}
                            editable={!subItem.disabled}
                          />
                        </View>
                      </View>
                    );
                  }
                  if (subItem.type === 'submenu') {
                    // Nested submenu - navigate into it
                    return (
                      <TouchableOpacity
                        key={subItem.id}
                        style={styles.submenuItem}
                        onPress={() => {
                          subItem.onPress?.();
                          // Navigate into nested submenu
                          setNestedSubmenuStack(prev => [...prev, subItem.id]);
                        }}
                        disabled={subItem.disabled}>
                        <View style={styles.submenuItemContent}>
                          <Text style={[styles.submenuItemText, subItem.disabled && styles.disabledText]}>
                            {subItem.title}
                          </Text>
                          {subItem.description && (
                            <Text style={[styles.submenuItemDescription, subItem.disabled && styles.disabledText]}>
                              {subItem.description}
                            </Text>
                          )}
                        </View>
                        <Text style={styles.chevron}>›</Text>
                      </TouchableOpacity>
                    );
                  }
                  return (
                    <TouchableOpacity
                      key={subItem.id}
                      style={styles.submenuItem}
                      onPress={() => {
                        subItem.onPress?.();
                        if (subItem.type !== 'switch' && subItem.type !== 'input' && subItem.type !== 'submenu') {
                          setShowSubmenu(null);
                          setNestedSubmenuStack([]);
                        }
                      }}
                      disabled={subItem.disabled}>
                      <View style={styles.submenuItemContent}>
                        <Text style={[styles.submenuItemText, subItem.disabled && styles.disabledText]}>
                          {subItem.title}
                        </Text>
                        {subItem.description && (
                          <Text style={[styles.submenuItemDescription, subItem.disabled && styles.disabledText]}>
                            {subItem.description}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                });
              })()}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Quick Connect Network Picker Modal */}
      <Modal
        visible={showQuickConnectModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowQuickConnectModal(false)}>
        <View style={styles.submenuOverlay}>
          <View style={[styles.submenuContainer, { maxHeight: '80%' }]}>
            <View style={styles.submenuHeader}>
              <Text style={styles.submenuTitle}>{t('Select Quick Connect Network', { _tags: tags })}</Text>
              <TouchableOpacity onPress={() => setShowQuickConnectModal(false)}>
                <Text style={styles.closeButtonText}>{t('Close', { _tags: tags })}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              <TouchableOpacity
                style={styles.submenuItem}
                onPress={async () => {
                  await setQuickConnectNetworkId(null);
                  setShowQuickConnectModal(false);
                }}>
                <View style={styles.submenuItemContent}>
                  <Text
                    style={[
                      styles.submenuItemText,
                      !quickConnectNetworkId && { color: colors.primary, fontWeight: '600' },
                    ]}>
                    {t('Use Default', { _tags: tags })}
                  </Text>
                </View>
              </TouchableOpacity>
              {networks.map((net) => (
                <TouchableOpacity
                  key={net.id}
                  style={styles.submenuItem}
                  onPress={async () => {
                    await setQuickConnectNetworkId(net.id);
                    setShowQuickConnectModal(false);
                  }}>
                  <View style={styles.submenuItemContent}>
                    <Text
                      style={[
                        styles.submenuItemText,
                        quickConnectNetworkId === net.id && { color: colors.primary, fontWeight: '600' },
                      ]}>
                      {net.name}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showDccExtModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDccExtModal(false)}>
        <View style={styles.submenuOverlay}>
          <View style={styles.submenuContainer}>
            <View style={styles.submenuHeader}>
              <Text style={styles.submenuTitle}>{dccExtTitle}</Text>
              <TouchableOpacity onPress={() => setShowDccExtModal(false)}>
                <Text style={styles.closeButtonText}>{t('Close', { _tags: tags })}</Text>
              </TouchableOpacity>
            </View>
            <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
              <TextInput
                style={[
                  styles.submenuInput,
                  { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border },
                ]}
                placeholder={t('Add extension (e.g. *.zip)', { _tags: tags })}
                placeholderTextColor={colors.textSecondary}
                value={newDccExt}
                onChangeText={setNewDccExt}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
                <TouchableOpacity
                  onPress={async () => {
                    const next = newDccExt.trim();
                    if (!next) return;
                    await updateDccExtList([...dccExtList, next]);
                    setNewDccExt('');
                  }}>
                  <Text style={styles.closeButtonText}>{t('Add', { _tags: tags })}</Text>
                </TouchableOpacity>
              </View>
            </View>
            <ScrollView>
              {dccExtList.map((ext, index) => (
                <TouchableOpacity
                  key={`${ext}-${index}`}
                  style={styles.submenuItem}
                  onPress={async () => {
                    const updated = dccExtList.filter((_, i) => i !== index);
                    await updateDccExtList(updated);
                  }}>
                  <View style={styles.submenuItemContent}>
                    <Text style={styles.submenuItemText}>{ext}</Text>
                    <Text style={styles.submenuItemDescription}>{t('Tap to remove', { _tags: tags })}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
      
      {/* Proxy Type Modal */}
      <Modal
        visible={showProxyTypeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowProxyTypeModal(false)}>
        <View style={[styles.submenuOverlay, { justifyContent: 'center', alignItems: 'center' }]}>
          <View style={[styles.submenuContainer, { width: '80%', maxWidth: 400 }]}>
            <View style={styles.submenuHeader}>
              <Text style={styles.submenuTitle}>{t('Proxy Type', { _tags: tags })}</Text>
              <TouchableOpacity onPress={() => setShowProxyTypeModal(false)}>
                <Text style={styles.closeButtonText}>{t('Close', { _tags: tags })}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {(['socks5', 'socks4', 'http', 'tor'] as const).map((proxyType) => (
                <TouchableOpacity
                  key={proxyType}
                  style={styles.submenuItem}
                  onPress={async () => {
                    setGlobalProxyType(proxyType);
                    await settingsService.setSetting('globalProxy', {
                      enabled: globalProxyEnabled,
                      type: proxyType,
                      host: globalProxyHost,
                      port: globalProxyPort ? parseInt(globalProxyPort) : 0,
                      username: globalProxyUsername,
                      password: globalProxyPassword,
                    });
                    setShowProxyTypeModal(false);
                  }}>
                  <View style={styles.submenuItemContent}>
                    <Text style={[
                      styles.submenuItemText,
                      globalProxyType === proxyType && { fontWeight: 'bold', color: colors.primary }
                    ]}>
                      {proxyType === 'tor' ? 'TOR' : proxyType.toUpperCase()}
                    </Text>
                    {globalProxyType === proxyType && (
                      <Text style={[styles.submenuItemDescription, { color: colors.primary }]}>
                        {t('Selected', { _tags: tags })}
                      </Text>
                    )}
                  </View>
                  {globalProxyType === proxyType && (
                    <Text style={{ color: colors.primary }}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
      
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

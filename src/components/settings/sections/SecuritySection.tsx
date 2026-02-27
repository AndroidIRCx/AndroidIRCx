/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { Alert, Modal, View, Text, TextInput, TouchableOpacity } from 'react-native';
import { SettingItem } from '../SettingItem';
import { useT } from '../../../i18n/transifex';
import { SettingItem as SettingItemType, SettingIcon } from '../../../types/settings';
import { settingsService } from '../../../services/SettingsService';
import { biometricAuthService } from '../../../services/BiometricAuthService';
import { secureStorageService } from '../../../services/SecureStorageService';

interface SecuritySectionProps {
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
    submenuOverlay: any;
    submenuContainer: any;
    submenuHeader: any;
    submenuTitle: any;
    closeButtonText: any;
    submenuInput?: any;
    submenuItemDescription?: any;
  };
  settingIcons: Record<string, SettingIcon | undefined>;
  onShowKeyManagement?: () => void;
  onShowMigrationDialog?: () => void;
}

const APP_PIN_STORAGE_KEY = '@AndroidIRCX:app-lock-pin';

export const SecuritySection: React.FC<SecuritySectionProps> = ({
  colors,
  styles,
  settingIcons,
  onShowKeyManagement,
  onShowMigrationDialog,
}) => {
  const t = useT();
  const tags = 'screen:settings,file:SecuritySection.tsx,feature:settings';
  
  const [allowQrVerification, setAllowQrVerification] = useState(true);
  const [allowFileExchange, setAllowFileExchange] = useState(true);
  const [allowNfcExchange, setAllowNfcExchange] = useState(true);
  const [appLockEnabled, setAppLockEnabled] = useState(false);
  const [appLockUseBiometric, setAppLockUseBiometric] = useState(false);
  const [appLockAutoBiometricPrompt, setAppLockAutoBiometricPrompt] = useState(false);
  const [appLockUsePin, setAppLockUsePin] = useState(false);
  const [appLockOnLaunch, setAppLockOnLaunch] = useState(true);
  const [appLockOnBackground, setAppLockOnBackground] = useState(true);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [appPinModalVisible, setAppPinModalVisible] = useState(false);
  const [appPinModalMode, setAppPinModalMode] = useState<'setup' | 'confirm'>('setup');
  const [appPinEntry, setAppPinEntry] = useState('');
  const [appPinSetupValue, setAppPinSetupValue] = useState('');
  const [appPinError, setAppPinError] = useState('');
  const appPinResolveRef = useRef<((ok: boolean) => void) | null>(null);

  // Load initial state
  useEffect(() => {
    const loadSettings = async () => {
      const qr = await settingsService.getSetting('securityAllowQrVerification', true);
      setAllowQrVerification(qr);
      
      const file = await settingsService.getSetting('securityAllowFileExchange', true);
      setAllowFileExchange(file);
      
      const nfc = await settingsService.getSetting('securityAllowNfcExchange', true);
      setAllowNfcExchange(nfc);
      
      let appLock = await settingsService.getSetting('appLockEnabled', false);
      
      const appLockBio = await settingsService.getSetting('appLockUseBiometric', false);
      let effectiveAppLockBio = appLockBio;

      const appLockAutoBioPrompt = await settingsService.getSetting('appLockAutoBiometricPrompt', false);
      setAppLockAutoBiometricPrompt(appLockAutoBioPrompt);
      
      const appLockPin = await settingsService.getSetting('appLockUsePin', false);
      setAppLockUsePin(appLockPin);
      
      const appLockLaunch = await settingsService.getSetting('appLockOnLaunch', true);
      setAppLockOnLaunch(appLockLaunch);
      
      const appLockBg = await settingsService.getSetting('appLockOnBackground', true);
      setAppLockOnBackground(appLockBg);
      
      // Require actual biometric enrollment (not only API presence)
      const available = await biometricAuthService.hasEnrolledBiometrics();
      setBiometricAvailable(available);

      // Safety: if a restore brought biometric setting to true without enrollment, disable it.
      if (effectiveAppLockBio && !available) {
        effectiveAppLockBio = false;
        await settingsService.setSetting('appLockUseBiometric', false);
      }
      if (appLock && !effectiveAppLockBio && !appLockPin) {
        appLock = false;
        await settingsService.setSetting('appLockEnabled', false);
      }
      setAppLockEnabled(appLock);
      setAppLockUseBiometric(effectiveAppLockBio);
    };
    loadSettings();
  }, []);

  const closeAppPinModal = useCallback((ok: boolean) => {
    setAppPinModalVisible(false);
    setAppPinEntry('');
    setAppPinSetupValue('');
    setAppPinError('');
    const resolve = appPinResolveRef.current;
    appPinResolveRef.current = null;
    if (resolve) resolve(ok);
  }, []);

  const requestAppPinSetup = useCallback(() => {
    setAppPinModalMode('setup');
    setAppPinEntry('');
    setAppPinSetupValue('');
    setAppPinError('');
    setAppPinModalVisible(true);
    return new Promise<boolean>((resolve) => {
      appPinResolveRef.current = resolve;
    });
  }, []);

  const handleAppPinSubmit = useCallback(async () => {
    const trimmed = appPinEntry.trim();
    if (appPinModalMode === 'setup') {
      if (trimmed.length < 4) {
        setAppPinError(t('PIN must be at least 4 digits.', { _tags: tags }));
        return;
      }
      setAppPinSetupValue(trimmed);
      setAppPinEntry('');
      setAppPinError('');
      setAppPinModalMode('confirm');
      return;
    }

    if (trimmed !== appPinSetupValue) {
      setAppPinError(t('PINs do not match.', { _tags: tags }));
      setAppPinEntry('');
      setAppPinSetupValue('');
      setAppPinModalMode('setup');
      return;
    }

    await secureStorageService.setSecret(APP_PIN_STORAGE_KEY, trimmed);
    await settingsService.setSetting('appLockUsePin', true);
    await settingsService.setSetting('appLockEnabled', true);
    setAppLockUsePin(true);
    setAppLockEnabled(true);
    closeAppPinModal(true);
  }, [APP_PIN_STORAGE_KEY, appPinEntry, appPinModalMode, appPinSetupValue, closeAppPinModal, t, tags]);

  const handleAppLockToggle = async (value: boolean) => {
    if (value) {
      if (!appLockUseBiometric && !appLockUsePin) {
        Alert.alert(
          t('Enable a method', { _tags: tags }),
          t('Turn on biometric or PIN for App Lock first.', { _tags: tags })
        );
        return;
      }
    }
    await settingsService.setSetting('appLockEnabled', value);
    setAppLockEnabled(value);
  };

  const handleAppLockBiometricToggle = async (value: boolean) => {
    if (value) {
      const enrolled = await biometricAuthService.hasEnrolledBiometrics();
      if (!enrolled) {
        setBiometricAvailable(false);
        Alert.alert(
          t('Biometrics unavailable', { _tags: tags }),
          t('Enable a fingerprint/biometric on your device first.', { _tags: tags })
        );
        return;
      }
      setBiometricAvailable(true);
      // Allow biometric and PIN to be enabled together - don't disable PIN
      // CRITICAL FIX: Pass 'app' scope to match authenticate() scope in useAppLock.ts
      // Without this, credentials are stored in wrong keychain service causing infinite error loop
      const enabled = await biometricAuthService.enableLock('app');
      if (!enabled) {
        Alert.alert(
          t('Biometric setup failed', { _tags: tags }),
          t('Unable to enable biometric lock.', { _tags: tags })
        );
        return;
      }
      await settingsService.setSetting('appLockUseBiometric', true);
      await settingsService.setSetting('appLockEnabled', true);
      setAppLockUseBiometric(true);
      setAppLockEnabled(true);
      return;
    }
    // Pass 'app' scope to match enableLock
    await biometricAuthService.disableLock('app');
    await settingsService.setSetting('appLockUseBiometric', false);
    setAppLockUseBiometric(false);
    // Only disable app lock if PIN is also disabled
    if (!appLockUsePin) {
      await settingsService.setSetting('appLockEnabled', false);
      setAppLockEnabled(false);
    }
  };

  const handleAppLockPinToggle = async (value: boolean) => {
    if (value) {
      // Allow PIN and biometric to be enabled together - don't disable biometric
      const setupSuccess = await requestAppPinSetup();
      if (setupSuccess) {
        await settingsService.setSetting('appLockEnabled', true);
        setAppLockEnabled(true);
      }
      return;
    }
    await secureStorageService.removeSecret(APP_PIN_STORAGE_KEY);
    await settingsService.setSetting('appLockUsePin', false);
    setAppLockUsePin(false);
    // Only disable app lock if biometric is also disabled
    if (!appLockUseBiometric) {
      await settingsService.setSetting('appLockEnabled', false);
      setAppLockEnabled(false);
    }
  };

  const sectionData: SettingItemType[] = useMemo(() => {
    const items: SettingItemType[] = [
      {
        id: 'security-manage-keys',
        title: t('Manage Encryption Keys', { _tags: tags }),
        description: 'View, delete, copy, and move encryption keys',
        type: 'button',
        searchKeywords: ['manage', 'encryption', 'keys', 'view', 'delete', 'copy', 'move', 'e2ee'],
        onPress: () => onShowKeyManagement?.(),
      },
      {
        id: 'security-migrate-keys',
        title: t('Migrate Old Keys', { _tags: tags }),
        description: 'Move old nick-only keys to network-based storage',
        type: 'button',
        searchKeywords: ['migrate', 'old', 'keys', 'network', 'storage', 'nick', 'move', 'transfer'],
        onPress: () => onShowMigrationDialog?.(),
      },
      {
        id: 'security-qr',
        title: t('Allow QR Verification', { _tags: tags }),
        description: allowQrVerification ? 'QR verification enabled' : 'QR verification disabled',
        type: 'switch',
        value: allowQrVerification,
        searchKeywords: ['qr', 'verification', 'code', 'scan', 'verify', 'quick', 'response'],
        onValueChange: async (value: string | boolean) => {
          const boolValue = value as boolean;
          setAllowQrVerification(boolValue);
          await settingsService.setSetting('securityAllowQrVerification', boolValue);
        },
      },
      {
        id: 'security-file',
        title: t('Allow File Key Exchange', { _tags: tags }),
        description: allowFileExchange ? 'File import/export enabled' : 'File import/export disabled',
        type: 'switch',
        value: allowFileExchange,
        searchKeywords: ['file', 'key', 'exchange', 'import', 'export', 'share', 'transfer'],
        onValueChange: async (value: string | boolean) => {
          const boolValue = value as boolean;
          setAllowFileExchange(boolValue);
          await settingsService.setSetting('securityAllowFileExchange', boolValue);
        },
      },
      {
        id: 'security-nfc',
        title: t('Allow NFC Key Exchange', { _tags: tags }),
        description: allowNfcExchange ? 'NFC exchange enabled' : 'NFC exchange disabled',
        type: 'switch',
        value: allowNfcExchange,
        searchKeywords: ['nfc', 'key', 'exchange', 'near', 'field', 'communication', 'tap', 'wireless'],
        onValueChange: async (value: string | boolean) => {
          const boolValue = value as boolean;
          setAllowNfcExchange(boolValue);
          await settingsService.setSetting('securityAllowNfcExchange', boolValue);
        },
      },
      {
        id: 'security-app-lock',
        title: t('App Lock', { _tags: tags }),
        description: appLockEnabled ? 'App lock enabled' : 'App lock disabled',
        type: 'switch',
        value: appLockEnabled,
        searchKeywords: ['app', 'lock', 'enable', 'disable', 'security', 'protect', 'privacy'],
        onValueChange: handleAppLockToggle,
      },
      {
        id: 'security-app-lock-biometric',
        title: t('App Lock with Biometrics', { _tags: tags }),
        description: appLockUseBiometric
          ? (appLockUsePin
              ? 'Biometric unlock enabled (fallback to PIN if biometric fails)'
              : 'Biometric unlock enabled')
          : 'Use fingerprint/biometric to unlock (can be used with PIN)',
        type: 'switch',
        value: appLockUseBiometric,
        disabled: !biometricAvailable,
        searchKeywords: ['biometric', 'fingerprint', 'face', 'unlock', 'authentication', 'touch', 'id'],
        onValueChange: handleAppLockBiometricToggle,
      },
      {
        id: 'security-app-lock-pin',
        title: t('App Lock with PIN', { _tags: tags }),
        description: appLockUsePin
          ? (appLockUseBiometric
              ? t('PIN unlock enabled (fallback if biometric fails)', { _tags: tags })
              : t('PIN unlock enabled', { _tags: tags }))
          : t('Use a PIN to unlock (can be used with biometric)', { _tags: tags }),
        type: 'switch',
        value: appLockUsePin,
        searchKeywords: ['pin', 'password', 'unlock', 'code', 'numeric', 'passcode', 'number'],
        onValueChange: handleAppLockPinToggle,
      },
      {
        id: 'security-app-lock-biometric-auto',
        title: t('Auto-show Biometric Prompt', { _tags: tags }),
        description: appLockAutoBiometricPrompt
          ? t('Automatically shows fingerprint prompt when lock screen opens', { _tags: tags })
          : t('Fingerprint prompt appears only when you tap the button', { _tags: tags }),
        type: 'switch',
        value: appLockAutoBiometricPrompt,
        disabled: !appLockEnabled || !appLockUseBiometric,
        searchKeywords: ['app', 'lock', 'biometric', 'fingerprint', 'auto', 'prompt', 'popup'],
        onValueChange: async (value: string | boolean) => {
          const boolValue = value as boolean;
          setAppLockAutoBiometricPrompt(boolValue);
          await settingsService.setSetting('appLockAutoBiometricPrompt', boolValue);
        },
      },
      {
        id: 'security-app-lock-launch',
        title: t('Lock on Launch', { _tags: tags }),
        description: appLockOnLaunch
          ? t('Locks when app is opened', { _tags: tags })
          : t('Does not lock on launch', { _tags: tags }),
        type: 'switch',
        value: appLockOnLaunch,
        searchKeywords: ['lock', 'launch', 'startup', 'open', 'app', 'start'],
        onValueChange: async (value: string | boolean) => {
          const boolValue = value as boolean;
          setAppLockOnLaunch(boolValue);
          await settingsService.setSetting('appLockOnLaunch', boolValue);
        },
      },
      {
        id: 'security-app-lock-background',
        title: t('Lock on Background', { _tags: tags }),
        description: appLockOnBackground
          ? t('Locks after app is backgrounded', { _tags: tags })
          : t('Does not lock on background', { _tags: tags }),
        type: 'switch',
        value: appLockOnBackground,
        searchKeywords: ['lock', 'background', 'minimize', 'hide', 'switch'],
        onValueChange: async (value: string | boolean) => {
          const boolValue = value as boolean;
          setAppLockOnBackground(boolValue);
          await settingsService.setSetting('appLockOnBackground', boolValue);
        },
      },
      {
        id: 'security-app-lock-now',
        title: t('Lock Now', { _tags: tags }),
        description: t('Immediately lock the app', { _tags: tags }),
        type: 'button',
        disabled: !appLockEnabled,
        searchKeywords: ['lock', 'now', 'immediately', 'instant', 'quick'],
        onPress: async () => {
          if (!appLockEnabled) {
            Alert.alert(
              t('App lock disabled', { _tags: tags }),
              t('Enable app lock first.', { _tags: tags })
            );
            return;
          }
          await settingsService.setSetting('appLockNow', Date.now());
        },
      },
    ];

    return items;
  }, [
    allowQrVerification,
    allowFileExchange,
    allowNfcExchange,
    appLockEnabled,
    appLockUseBiometric,
    appLockAutoBiometricPrompt,
    appLockUsePin,
    appLockOnLaunch,
    appLockOnBackground,
    biometricAvailable,
    handleAppLockToggle,
    handleAppLockBiometricToggle,
    handleAppLockPinToggle,
    onShowKeyManagement,
    onShowMigrationDialog,
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
      
      {/* App PIN Modal */}
      <Modal
        visible={appPinModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => closeAppPinModal(false)}>
        <View style={[styles.submenuOverlay, { justifyContent: 'center', alignItems: 'center' }]}>
          <View style={[styles.submenuContainer, { width: '80%', maxWidth: 400 }]}>
            <View style={styles.submenuHeader}>
              <Text style={styles.submenuTitle}>
                {appPinModalMode === 'setup' ? t('Set PIN', { _tags: tags }) : t('Confirm PIN', { _tags: tags })}
              </Text>
              <TouchableOpacity onPress={() => closeAppPinModal(false)}>
                <Text style={styles.closeButtonText}>{t('Cancel', { _tags: tags })}</Text>
              </TouchableOpacity>
            </View>
            <View style={{ padding: 16 }}>
              <TextInput
                style={[
                  styles.submenuInput,
                  { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border },
                ]}
                placeholder={appPinModalMode === 'confirm' ? t('Re-enter PIN', { _tags: tags }) : t('Enter PIN', { _tags: tags })}
                placeholderTextColor={colors.textSecondary}
                value={appPinEntry}
                onChangeText={setAppPinEntry}
                keyboardType="numeric"
                secureTextEntry
                autoFocus
              />
              {appPinError ? (
                <Text style={[styles.submenuItemDescription, { color: 'red', marginTop: 8 }]}>
                  {appPinError}
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
                onPress={handleAppPinSubmit}>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>
                  {appPinModalMode === 'confirm' ? t('Confirm', { _tags: tags }) : t('Submit', { _tags: tags })}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

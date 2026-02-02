/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  Modal,
  Alert,
  SectionList,
  PermissionsAndroid,
  Platform,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import Clipboard from '@react-native-clipboard/clipboard';
import RNFS from 'react-native-fs';
import { notificationService, NotificationPreferences } from '../services/NotificationService';
import { backgroundService } from '../services/BackgroundService';
import { messageHistoryService, ExportOptions } from '../services/MessageHistoryService';
import { ircService } from '../services/IRCService';
import { themeService, Theme } from '../services/ThemeService';
import { useTheme } from '../hooks/useTheme';
import { ThemeEditorScreen } from './ThemeEditorScreen';
import { connectionProfilesService } from '../services/ConnectionProfilesService';
import { ConnectionProfilesScreen } from './ConnectionProfilesScreen';
import { settingsService, IRCNetworkConfig, DEFAULT_PART_MESSAGE, DEFAULT_QUIT_MESSAGE } from '../services/SettingsService';
import { AboutScreen } from './AboutScreen';
import { CreditsScreen } from './CreditsScreen';
import { bouncerService, BouncerConfig } from '../services/BouncerService';
import { layoutService, LayoutConfig, ViewMode, FontSize } from '../services/LayoutService';
import { performanceService, PerformanceConfig } from '../services/PerformanceService';
import { dataBackupService } from '../services/DataBackupService';
import { identityProfilesService, IdentityProfile } from '../services/IdentityProfilesService';
import { biometricAuthService } from '../services/BiometricAuthService';
import { secureStorageService } from '../services/SecureStorageService';
import { encryptedDMService } from '../services/EncryptedDMService';
import { connectionManager } from '../services/ConnectionManager';
import { ScriptingScreen } from './ScriptingScreen';
import { ScriptingHelpScreen } from './ScriptingHelpScreen';
import { BackupScreen } from './BackupScreen';
import { inAppPurchaseService } from '../services/InAppPurchaseService';
import { adRewardService } from '../services/AdRewardService';
import { subscriptionService } from '../services/SubscriptionService';
import * as RNIap from 'react-native-iap';
import type { ProductSubscription, Purchase, PurchaseError } from 'react-native-iap';
import { KeyManagementScreen } from './KeyManagementScreen';
import { FirstRunSetupScreen } from './FirstRunSetupScreen';
import { ZncSubscriptionScreen } from './ZncSubscriptionScreen';
import { PrivacyAdsScreen } from './PrivacyAdsScreen';
import { DataPrivacyScreen } from './DataPrivacyScreen';
import { RawMessageCategory, RAW_MESSAGE_CATEGORIES, getDefaultRawCategoryVisibility } from '../services/IRCService';
import { applyTransifexLocale, useT } from '../i18n/transifex';
import { SUPPORTED_LOCALES } from '../i18n/config';
import consoleManager from '../utils/consoleManager';
import { SettingItem as SettingItemComponent } from '../components/settings/SettingItem';
import { SettingsSectionHeader } from '../components/settings/SettingsSectionHeader';
import { ScriptingAdsSection, SecurityQuickConnectSection, PrivacyLegalSection, AboutSection, HelpSection, AppearanceSection, DisplayUISection, MessageHistorySection, NotificationsSection, ConnectionNetworkSection, BackgroundBatterySection, HighlightingSection, SecuritySection, UsersServicesSection, CommandsSection, MediaSection, AwaySection, ProtectionSection, WritingSection } from '../components/settings/sections';
import { SettingItem, SettingIcon } from '../types/settings';
import { useSettingsPremium } from '../hooks/useSettingsPremium';
import { useSettingsSecurity } from '../hooks/useSettingsSecurity';
import { useSettingsNotifications } from '../hooks/useSettingsNotifications';
import { useSettingsConnection } from '../hooks/useSettingsConnection';
import { useSettingsAppearance } from '../hooks/useSettingsAppearance';
import { SETTINGS_ICONS } from '../config/settingsIcons';
import { createStyles } from './SettingsScreen.styles';
import {
  getSectionIcon,
  filterSettings,
  orderSections,
  buildGlobalProxyConfig as buildProxyConfig,
  toggleSectionExpansion,
  GlobalProxyInputs,
} from '../utils/settingsHelpers';

interface SettingsScreenProps {
  visible: boolean;
  onClose: () => void;
  currentNetwork?: string;
  showRawCommands?: boolean;
  onShowRawCommandsChange?: (value: boolean) => void;
  rawCategoryVisibility?: Record<RawMessageCategory, boolean>;
  onRawCategoryVisibilityChange?: (value: Record<RawMessageCategory, boolean>) => void;
  showEncryptionIndicators?: boolean;
  onShowEncryptionIndicatorsChange?: (value: boolean) => void;
  showTypingIndicators?: boolean;
  onShowTypingIndicatorsChange?: (value: boolean) => void;
  onShowIgnoreList?: () => void;
  onShowBlacklist?: () => void;
  onShowPurchaseScreen?: () => void;
}

// SettingItem interface moved to src/types/settings.ts

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  visible,
  onClose,
  currentNetwork,
  showRawCommands = true,
  onShowRawCommandsChange,
  rawCategoryVisibility,
  onRawCategoryVisibilityChange,
  showEncryptionIndicators = true,
  onShowEncryptionIndicatorsChange,
  showTypingIndicators = true,
  onShowTypingIndicatorsChange,
  onShowIgnoreList,
  onShowBlacklist,
  onShowPurchaseScreen,
}) => {
  const t = useT();
  const { theme, colors } = useTheme();
  const styles = useMemo(() => createStyles(colors, theme), [colors, theme]);
  const tags = 'screen:settings,file:SettingsScreen.tsx,feature:settings';
  const zncSubscriptionIdConst = 'znc';
  const zncBasePlanId = 'znc-user';
  const settingIcons = useMemo<Record<string, SettingIcon>>(
    () => SETTINGS_ICONS,
    []
  );
  const aboutTitle = t('About', { _tags: tags });
  const helpTitle = t('📖 Help & Documentation', { _tags: tags });
  const scriptingAdsTitle = t('Scripting & Ads', { _tags: tags });
  const premiumTitle = t('💎 Premium', { _tags: tags });
  const zncSubscriptionTitle = t('ZNC Subscription', { _tags: tags });
  const connectionTitle = t('Connection & Network', { _tags: tags });
  const languageLabels = useMemo(
    () => ({
      en: 'English',
      fr: 'Francais',
      de: 'Deutsch',
      it: 'Italiano',
      pt: 'Portugues',
      ro: 'Romana',
      ru: 'Russkiy',
      sr: 'Srpski',
      es: 'Espanol',
    }),
    []
  );
  // Use hooks for notifications
  const notificationSettings = useSettingsNotifications();
  const {
    notificationPrefs,
    backgroundEnabled,
    batteryOptEnabledStatus,
    updateNotificationPrefs,
    setBackgroundEnabled: setBackgroundEnabledFromHook,
    handleBatteryOptimization,
    refreshNotificationPrefs,
  } = notificationSettings;
  
  // Use hooks for connection settings
  const connectionSettings = useSettingsConnection();
  const {
    networks,
    autoReconnectConfig,
    rateLimitConfig,
    floodProtectionConfig,
    lagMonitoringConfig,
    connectionStats,
    bouncerConfig,
    bouncerInfo,
    refreshNetworks,
    updateBouncerConfig,
  } = connectionSettings;
  const [localShowRawCommands, setLocalShowRawCommands] = useState(showRawCommands);
  const [localRawCategoryVisibility, setLocalRawCategoryVisibility] = useState<Record<RawMessageCategory, boolean>>(getDefaultRawCategoryVisibility());
  const [historyStats, setHistoryStats] = useState<any>(null);
  const [exportFormat, setExportFormat] = useState<'json' | 'txt' | 'csv'>('json');
  const [showSubmenu, setShowSubmenu] = useState<string | null>(null);
  // Use hooks for appearance settings
  const appearanceSettings = useSettingsAppearance();
  const {
    currentTheme,
    availableThemes,
    showThemeEditor,
    editingTheme,
    layoutConfig,
    appLanguage,
    setShowThemeEditor,
    setEditingTheme,
    refreshThemes,
    setAppLanguage: setAppLanguageFromHook,
    updateLayoutConfig,
  } = appearanceSettings;
  const [showConnectionProfiles, setShowConnectionProfiles] = useState(false);
  // Networks and connection configs now come from useSettingsConnection hook (see above)
  // Layout config and app language now come from useSettingsAppearance hook (see above)
  const [performanceConfig, setPerformanceConfig] = useState<PerformanceConfig | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  const [showCredits, setShowCredits] = useState(false);
  const [showPrivacyAds, setShowPrivacyAds] = useState(false);
  const [showDataPrivacy, setShowDataPrivacy] = useState(false);
  const [backupData, setBackupData] = useState('');
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showBackupScreen, setShowBackupScreen] = useState(false);
  const [showKeyManagement, setShowKeyManagement] = useState(false);
  const [showZncSubscription, setShowZncSubscription] = useState(false);
  const [showMigrationDialog, setShowMigrationDialog] = useState(false);
  const [migrationNetwork, setMigrationNetwork] = useState('');
  const [storageStats, setStorageStats] = useState<{ keyCount: number; totalBytes: number }>({ keyCount: 0, totalBytes: 0 });
  const [identityProfiles, setIdentityProfiles] = useState<IdentityProfile[]>([]);
  const [showScripting, setShowScripting] = useState(false);
  const [showScriptingHelp, setShowScriptingHelp] = useState(false);
  const [showChannelNotifModal, setShowChannelNotifModal] = useState(false);
  const [channelNotifList, setChannelNotifList] = useState<{ channel: string; prefs: NotificationPreferences }[]>([]);
  const [newChannelNotif, setNewChannelNotif] = useState('');
  const [globalProxyType, setGlobalProxyType] = useState('socks5');
  const [globalProxyHost, setGlobalProxyHost] = useState('');
  const [globalProxyPort, setGlobalProxyPort] = useState('');
  const [globalProxyUsername, setGlobalProxyUsername] = useState('');
  const [globalProxyPassword, setGlobalProxyPassword] = useState('');
  const [globalProxyEnabled, setGlobalProxyEnabled] = useState(false);
  // Security settings now come from useSettingsSecurity hook (see above)
  // Use hooks for premium and security settings
  const premiumSettings = useSettingsPremium();
  const securitySettings = useSettingsSecurity();
  
  // Extract values from hooks for backward compatibility
  const {
    watchAdButtonEnabledForPremium,
    setWatchAdButtonEnabledForPremium,
    hasNoAds,
    hasScriptingPro,
    isSupporter,
    adReady,
    adLoading,
    adCooldown,
    cooldownSeconds,
    showingAd,
    adUnitType,
    showWatchAdButton,
    handleWatchAd,
  } = premiumSettings;
  
  const {
    killSwitchEnabledOnHeader,
    killSwitchEnabledOnLockScreen,
    killSwitchShowWarnings,
    quickConnectNetworkId,
    setKillSwitchEnabledOnHeader,
    setKillSwitchEnabledOnLockScreen,
    setKillSwitchShowWarnings,
    setQuickConnectNetworkId,
  } = securitySettings;
  
  const [zncPurchaseToken, setZncPurchaseToken] = useState('');
  const [zncSubscriptionId, setZncSubscriptionId] = useState(zncSubscriptionIdConst);
  const [zncUsername, setZncUsername] = useState('');
  const [zncSubscriptionStatus, setZncSubscriptionStatus] = useState<string | null>(null);
  const [zncExpiresAt, setZncExpiresAt] = useState<string | null>(null);
  const [zncPassword, setZncPassword] = useState<string | null>(null);
  const [zncAccountStatus, setZncAccountStatus] = useState<string | null>(null);
  const [zncRegistering, setZncRegistering] = useState(false);
  const [zncOfferToken, setZncOfferToken] = useState<string | null>(null);
  const [zncDisplayPrice, setZncDisplayPrice] = useState<string | null>(null);
  const [zncPurchasing, setZncPurchasing] = useState(false);
  const zncUsernameRef = useRef('');

  const [autoConnectFavoriteServer, setAutoConnectFavoriteServer] = useState(false);
  const [showFirstRunSetup, setShowFirstRunSetup] = useState(false);
  const [tabSortAlphabetical, setTabSortAlphabetical] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showEncryptionIndicatorsSetting, setShowEncryptionIndicatorsSetting] = useState(showEncryptionIndicators);
  const [showTypingIndicatorsSetting, setShowTypingIndicatorsSetting] = useState(showTypingIndicators);
  // appLanguage now comes from useSettingsAppearance hook (see above)
  const [biometricLockEnabled, setBiometricLockEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [passwordsUnlocked, setPasswordsUnlocked] = useState(true);
  const [pinLockEnabled, setPinLockEnabled] = useState(false);
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pinModalMode, setPinModalMode] = useState<'unlock' | 'setup' | 'confirm'>('unlock');
  const [pinEntry, setPinEntry] = useState('');
  const [pinSetupValue, setPinSetupValue] = useState('');
  const [pinError, setPinError] = useState('');
  const pinResolveRef = useRef<((ok: boolean) => void) | null>(null);
  const PIN_STORAGE_KEY = '@AndroidIRCX:pin-lock';
  const [consoleEnabled, setConsoleEnabled] = useState(__DEV__ ? consoleManager.getEnabled() : false);

  // Premium and ad status now managed by useSettingsPremium hook



  const refreshChannelNotifList = useCallback(() => {
    setChannelNotifList(notificationService.listChannelPreferences());
  }, []);

  // handleWatchAd now comes from useSettingsPremium hook
  // DCC settings now managed by ConnectionNetworkSection
  const [noticeTarget, setNoticeTarget] = useState<'active' | 'server' | 'notice' | 'private'>('server');

  // Configurable messages
  const [partMessage, setPartMessage] = useState(DEFAULT_PART_MESSAGE);
  const [quitMessage, setQuitMessage] = useState(DEFAULT_QUIT_MESSAGE);
  const [hideJoinMessages, setHideJoinMessages] = useState(false);
  const [hidePartMessages, setHidePartMessages] = useState(false);
  const [hideQuitMessages, setHideQuitMessages] = useState(false);
  const [hideIrcServiceListenerMessages, setHideIrcServiceListenerMessages] = useState(true);
  const [closePrivateMessage, setClosePrivateMessage] = useState(false);
  const [closePrivateMessageText, setClosePrivateMessageText] = useState('Closing window');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => new Set([aboutTitle]));
  const prevAboutTitleRef = useRef(aboutTitle);
  const [lagCheckMethod, setLagCheckMethod] = useState<'ctcp' | 'server'>('server');
  const sectionListRef = useRef<SectionList>(null);
  // DCC submenu items now managed by ConnectionNetworkSection

  useEffect(() => {
    if (visible) {
      loadSettings();
      loadHistoryStats();
      setLocalShowRawCommands(showRawCommands);
      setLocalRawCategoryVisibility({
        ...getDefaultRawCategoryVisibility(),
        ...(rawCategoryVisibility || {}),
      });
      setShowEncryptionIndicatorsSetting(showEncryptionIndicators);
      refreshThemes();
    loadChannelSettings();

    // Statistics are now managed by useSettingsConnection hook
    // No need for periodic updates here - hook handles it
    }
  }, [visible, showRawCommands, showEncryptionIndicators, currentNetwork, rawCategoryVisibility]);

  useEffect(() => {
    zncUsernameRef.current = zncUsername;
  }, [zncUsername]);

  // Theme changes now handled by useSettingsAppearance hook
  useEffect(() => {
    const previousTitle = prevAboutTitleRef.current;
    if (previousTitle === aboutTitle) return;

    setExpandedSections(prev => {
      if (!prev.has(previousTitle)) {
        return prev;
      }
      const next = new Set(prev);
      next.delete(previousTitle);
      next.add(aboutTitle);
      return next;
    });
    prevAboutTitleRef.current = aboutTitle;
  }, [aboutTitle]);

  // Check notification permission when settings screen opens
  useEffect(() => {
    if (!visible) return;

    const checkNotificationPermission = async () => {
      const currentPrefs = notificationService.getPreferences();
      if (currentPrefs.enabled) {
        const hasPermission = await notificationService.checkPermission();
        if (!hasPermission) {
          // Permission was denied - disable notifications and show alert
          await notificationService.updatePreferences({ enabled: false });
          await updateNotificationPrefs({ enabled: false });
          Alert.alert(
            t('Permission Required', { _tags: tags }),
            t('Notification permission is required to receive notifications. Please enable it in system settings.', { _tags: tags })
          );
        }
      }
    };
    
    checkNotificationPermission();
  }, [visible, tags, t]);

  useEffect(() => {
    if (!visible) return;

    let purchaseUpdateSubscription: any;
    let purchaseErrorSubscription: any;
    let cancelled = false;

    const setupIap = async () => {
      try {
        await initZncIap();
      } catch (error) {
        if (!cancelled) {
          console.error('Error initializing ZNC IAP:', error);
        }
      }
    };

    setupIap();

    purchaseUpdateSubscription = RNIap.purchaseUpdatedListener(
      async (purchase: Purchase) => {
        if (purchase.productId !== zncSubscriptionIdConst) {
          return;
        }
        setZncPurchasing(false);
        const token = purchase.purchaseToken || purchase.transactionReceipt || '';
        if (!token) {
          Alert.alert(
            t('Purchase Error', { _tags: tags }),
            t('Missing purchase token from Google Play.', { _tags: tags })
          );
          return;
        }

        try {
          await RNIap.finishTransaction({ purchase, isConsumable: false });
        } catch (error) {
          console.error('Error finishing ZNC transaction:', error);
        }

        setZncPurchaseToken(token);
        await persistZncConfig({
          purchaseToken: token,
          subscriptionId: zncSubscriptionIdConst,
          zncUsername: zncUsernameRef.current,
        });
        await registerZncSubscriptionWithToken(token, zncUsernameRef.current);
      }
    );

    purchaseErrorSubscription = RNIap.purchaseErrorListener(
      (error: PurchaseError) => {
        if (error.productId && error.productId !== zncSubscriptionIdConst) {
          return;
        }
        setZncPurchasing(false);
        if (error.code !== 'E_USER_CANCELLED') {
          Alert.alert(
            t('Purchase Failed', { _tags: tags }),
            error.message || t('Please try again later.', { _tags: tags })
          );
        }
      }
    );

    return () => {
      cancelled = true;
      if (purchaseUpdateSubscription) {
        purchaseUpdateSubscription.remove();
      }
      if (purchaseErrorSubscription) {
        purchaseErrorSubscription.remove();
      }
    };
  }, [visible, initZncIap, registerZncSubscriptionWithToken, tags, t, zncSubscriptionIdConst]);

  // Supporter status now managed by useSettingsPremium hook - no local state needed

  const loadSettings = async () => {
    // Load kill switch and quick connect settings
    // Security and premium settings now loaded by hooks
    
    // Continue with existing loadSettings logic
    const biometryType = await biometricAuthService.getBiometryType();
    const biometrySupported = Boolean(biometryType);
    setBiometricAvailable(biometrySupported);
    const lockSetting = await settingsService.getSetting('biometricPasswordLock', false);
    const pinSetting = await settingsService.getSetting('pinPasswordLock', false);
    const storedPin = await secureStorageService.getSecret(PIN_STORAGE_KEY);
    const biometricEnabled = lockSetting && biometrySupported;
    let pinEnabled = pinSetting && Boolean(storedPin);

    if (lockSetting && !biometrySupported) {
      await settingsService.setSetting('biometricPasswordLock', false);
    }
    if (pinSetting && !storedPin) {
      await settingsService.setSetting('pinPasswordLock', false);
      pinEnabled = false;
    }
    if (biometricEnabled && pinEnabled) {
      await settingsService.setSetting('pinPasswordLock', false);
      pinEnabled = false;
    }

    setBiometricLockEnabled(biometricEnabled);
    setPinLockEnabled(pinEnabled);
    setPasswordsUnlocked(!(biometricEnabled || pinEnabled));
    refreshNotificationPrefs();
    // Background and battery optimization status managed by hook
    setPartMessage(await settingsService.getSetting('partMessage', DEFAULT_PART_MESSAGE));
    setQuitMessage(await settingsService.getSetting('quitMessage', DEFAULT_QUIT_MESSAGE));
    setHideJoinMessages(await settingsService.getSetting('hideJoinMessages', false));
    setHidePartMessages(await settingsService.getSetting('hidePartMessages', false));
    setHideQuitMessages(await settingsService.getSetting('hideQuitMessages', false));
    setHideIrcServiceListenerMessages(
      await settingsService.getSetting('hideIrcServiceListenerMessages', true)
    );
    setShowEncryptionIndicatorsSetting(await settingsService.getSetting('showEncryptionIndicators', true));
    setTabSortAlphabetical(await settingsService.getSetting('tabSortAlphabetical', true));
    // appLanguage now loaded by useSettingsAppearance hook
    setAutoConnectFavoriteServer(await settingsService.getSetting('autoConnectFavoriteServer', false));
    const globalProxy = await settingsService.getSetting('globalProxy', { enabled: false } as any);
    if (globalProxy) {
      const enabled = globalProxy.enabled !== undefined ? Boolean(globalProxy.enabled) : true; // legacy configs assumed enabled
      setGlobalProxyEnabled(enabled);
      setGlobalProxyType(globalProxy.type || 'socks5');
      setGlobalProxyHost(globalProxy.host || '');
      setGlobalProxyPort(globalProxy.port ? String(globalProxy.port) : '');
      setGlobalProxyUsername(globalProxy.username || '');
      setGlobalProxyPassword(globalProxy.password || '');
    } else {
      setGlobalProxyEnabled(false);
      setGlobalProxyType('socks5');
      setGlobalProxyHost('');
      setGlobalProxyPort('');
      setGlobalProxyUsername('');
      setGlobalProxyPassword('');
    }
    setClosePrivateMessage(await settingsService.getSetting('closePrivateMessage', false));
    setClosePrivateMessageText(await settingsService.getSetting('closePrivateMessageText', 'Closing window'));
    setNoticeTarget(await settingsService.getSetting('noticeTarget', 'server'));
    setLagCheckMethod(await settingsService.getSetting('lagCheckMethod', 'server'));
    const zncConfig = await settingsService.getSetting('zncSubscriptionConfig', {
      purchaseToken: '',
      subscriptionId: '',
      zncUsername: '',
    });
    const subscriptionId = zncConfig.subscriptionId || zncSubscriptionIdConst;
    setZncPurchaseToken(zncConfig.purchaseToken || '');
    setZncSubscriptionId(subscriptionId);
    setZncUsername(zncConfig.zncUsername || '');
    if (subscriptionId !== zncConfig.subscriptionId) {
      await settingsService.setSetting('zncSubscriptionConfig', {
        purchaseToken: zncConfig.purchaseToken || '',
        subscriptionId,
        zncUsername: zncConfig.zncUsername || '',
      });
    }
    const zncState = await settingsService.getSetting('zncSubscriptionState', {
      status: null,
      expiresAt: null,
      zncPassword: null,
      zncStatus: null,
    });
    setZncSubscriptionStatus(zncState.status);
    setZncExpiresAt(zncState.expiresAt);
    setZncPassword(zncState.zncPassword);
    setZncAccountStatus(zncState.zncStatus);
    // autoJoinFavoritesEnabled now managed by ConnectionNetworkSection component
  };

  const loadHistoryStats = async () => {
    if (currentNetwork) {
      const stats = await messageHistoryService.getStats(currentNetwork);
      setHistoryStats(stats);
    }
  };

  const loadChannelSettings = async () => {
    await refreshNetworks();

    // Connection-related settings (auto-reconnect, auto-voice, auto-rejoin, connection quality, etc.)
    // are now managed by ConnectionNetworkSection component
    // Channel favorites and DCC settings are also managed by ConnectionNetworkSection
    
    // Bouncer settings now managed by useSettingsConnection hook
    // No need to load here - hook handles it
    // Layout settings now managed by useSettingsAppearance hook
    // No need to load here - hook handles it
    // Command settings now managed by CommandsSection component
    // Load performance settings
    setPerformanceConfig(performanceService.getConfig());
    // Storage stats
    dataBackupService.getStorageStats().then(setStorageStats).catch(() => {});
    // Identities
    identityProfilesService.list().then(setIdentityProfiles).catch(() => {});
  };

  const loadZncSubscriptionProduct = useCallback(async () => {
    try {
      const products = await RNIap.fetchProducts({
        skus: [zncSubscriptionIdConst],
        type: 'subs',
      });
      const subscription = products.find(
        (item): item is ProductSubscription =>
          item.id === zncSubscriptionIdConst && item.type === 'subs'
      );
      if (!subscription) {
        setZncOfferToken(null);
        setZncDisplayPrice(null);
        return;
      }
      setZncDisplayPrice(subscription.displayPrice || null);
      if (Platform.OS === 'android') {
        const offers = subscription.subscriptionOfferDetailsAndroid || [];
        const matchedOffer =
          offers.find(offer => offer.basePlanId === zncBasePlanId) || offers[0];
        setZncOfferToken(matchedOffer?.offerToken || null);
      }
    } catch (error) {
      setZncOfferToken(null);
      setZncDisplayPrice(null);
    }
  }, [zncBasePlanId, zncSubscriptionIdConst]);

  const initZncIap = useCallback(async () => {
    await RNIap.initConnection();
    if (Platform.OS === 'android') {
      const flushPending = (RNIap as any).flushFailedPurchasesCachedAsPendingAndroid;
      if (typeof flushPending === 'function') {
        await flushPending();
      }
    }
    await loadZncSubscriptionProduct();
  }, [loadZncSubscriptionProduct]);

  const persistZncConfig = useCallback(async (updates: Partial<{ purchaseToken: string; subscriptionId: string; zncUsername: string }>) => {
    const nextConfig = {
      purchaseToken: updates.purchaseToken ?? zncPurchaseToken,
      subscriptionId: updates.subscriptionId ?? zncSubscriptionId,
      zncUsername: updates.zncUsername ?? zncUsername,
    };
    await settingsService.setSetting('zncSubscriptionConfig', nextConfig);
  }, [zncPurchaseToken, zncSubscriptionId, zncUsername]);

  const formatZncExpiresAt = (value: string | null) => {
    if (!value) return t('Not available', { _tags: tags });
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  };

  const applyZncServerToDBase = useCallback(async (username: string, password: string) => {
    if (!username || !password) {
      console.warn('applyZncServerToDBase: Missing username or password');
      return;
    }
    
    try {
      const networks = await settingsService.loadNetworks();
      let dbaseNetwork = networks.find(n => n.id === 'DBase' || n.name === 'DBase') || null;
      if (!dbaseNetwork) {
        dbaseNetwork = await settingsService.createDefaultNetwork();
      }

      const serverId = 'znc-subscription';
      const serverConfig = {
        id: serverId,
        hostname: 'irc.androidircx.com',
        port: 16786,
        ssl: true,
        rejectUnauthorized: true,
        name: 'ZNC Subscription',
        favorite: true,
        password: `${username}:${password}`,
      };

      const existing = dbaseNetwork.servers.find(s => s.id === serverId);
      if (existing) {
        await settingsService.updateServerInNetwork(dbaseNetwork.id, serverId, serverConfig);
      } else {
        await settingsService.addServerToNetwork(dbaseNetwork.id, serverConfig);
      }

      await settingsService.updateNetwork(dbaseNetwork.id, {
        defaultServerId: serverId,
        connectionType: 'znc',
      });
    } catch (error) {
      console.error('applyZncServerToDBase: Error applying ZNC server:', error);
      // Don't throw - log error but don't crash the app
      throw error; // Re-throw so caller can handle it
    }
  }, []);

  const connectNowToZnc = async () => {
    if (!zncUsername || !zncPassword) {
      Alert.alert(
        t('Missing Credentials', { _tags: tags }),
        t('Register your subscription to get ZNC credentials first.', { _tags: tags })
      );
      return;
    }

    await applyZncServerToDBase(zncUsername, zncPassword);
    const networks = await settingsService.loadNetworks();
    const dbaseNetwork = networks.find(n => n.id === 'DBase' || n.name === 'DBase');
    const zncServer = dbaseNetwork?.servers.find(s => s.id === 'znc-subscription') || dbaseNetwork?.servers.find(s => s.hostname === 'irc.androidircx.com' && s.port === 16786);

    if (!dbaseNetwork || !zncServer) {
      Alert.alert(
        t('Connection Error', { _tags: tags }),
        t('ZNC server configuration is missing.', { _tags: tags })
      );
      return;
    }

    const activeConnection = connectionManager.getConnection(dbaseNetwork.id);
    if (!activeConnection) {
      Alert.alert(
        t('Not Connected', { _tags: tags }),
        t('DBase is not connected. Open Networks and connect to DBase to use ZNC.', { _tags: tags })
      );
      return;
    }

    const globalProxy = await settingsService.getSetting('globalProxy', { enabled: false } as any);
    const proxyToUse = dbaseNetwork.proxy || globalProxy || null;

    const connectionConfig = {
      host: (zncServer.hostname || '').trim(),
      port: zncServer.port,
      nick: dbaseNetwork.nick,
      altNick: dbaseNetwork.altNick,
      username: dbaseNetwork.ident || dbaseNetwork.nick,
      realname: dbaseNetwork.realname,
      password: zncServer.password,
      tls: zncServer.ssl,
      rejectUnauthorized: zncServer.rejectUnauthorized,
      proxy: proxyToUse,
      sasl: dbaseNetwork.sasl,
    };

    try {
      activeConnection.ircService.disconnect(t('Reconnecting to ZNC...', { _tags: tags }));
      await activeConnection.ircService.connect(connectionConfig);
      Alert.alert(
        t('Connected', { _tags: tags }),
        t('Reconnected to ZNC for DBase.', { _tags: tags })
      );
    } catch (error: any) {
      Alert.alert(
        t('Connection Failed', { _tags: tags }),
        error?.message || t('Unable to reconnect to ZNC.', { _tags: tags })
      );
    }
  };

  const startZncPurchase = async () => {
    const username = zncUsername.trim();
    if (!username) {
      Alert.alert(
        t('Missing Information', { _tags: tags }),
        t('Please enter a ZNC username.', { _tags: tags })
      );
      return;
    }

    setZncPurchasing(true);
    try {
      await persistZncConfig({ zncUsername: username, subscriptionId: zncSubscriptionIdConst });
      await initZncIap();

      if (Platform.OS === 'android' && !zncOfferToken) {
        await loadZncSubscriptionProduct();
      }

      if (Platform.OS === 'android' && !zncOfferToken) {
        throw new Error('Missing subscription offer token.');
      }

      const request = Platform.select({
        ios: {
          request: {
            apple: {
              sku: zncSubscriptionIdConst,
            },
          },
          type: 'subs' as const,
        },
        android: {
          request: {
            google: {
              skus: [zncSubscriptionIdConst],
              subscriptionOffers: [{
                sku: zncSubscriptionIdConst,
                offerToken: zncOfferToken as string,
              }],
            },
          },
          type: 'subs' as const,
        },
        default: {
          request: {
            google: {
              skus: [zncSubscriptionIdConst],
              subscriptionOffers: [{
                sku: zncSubscriptionIdConst,
                offerToken: zncOfferToken as string,
              }],
            },
          },
          type: 'subs' as const,
        },
      });

      if (!request) {
        throw new Error('Unsupported platform for subscriptions.');
      }

      await RNIap.requestPurchase(request);
    } catch (error: any) {
      setZncPurchasing(false);
      Alert.alert(
        t('Purchase Failed', { _tags: tags }),
        error?.message || t('Please try again later.', { _tags: tags })
      );
    }
  };

  const registerZncSubscriptionWithToken = useCallback(async (purchaseToken: string, username: string) => {
    const subscriptionId = zncSubscriptionIdConst;
    const trimmedToken = purchaseToken.trim();
    const trimmedUsername = username.trim();

    if (!trimmedToken) {
      Alert.alert(
        t('Missing Information', { _tags: tags }),
        t('Please complete the purchase first.', { _tags: tags })
      );
      return;
    }

    // Don't show error if username is missing but we're just updating an existing subscription
    // The username might be retrieved from the server response
    if (!trimmedUsername) {
      // Still try to register, as the server might return the username in the response
      console.warn('Username is empty, but attempting registration with purchase token only');
    }

    setZncRegistering(true);
    try {
      // Persist the purchase token even if username is empty
      await persistZncConfig({ purchaseToken: trimmedToken, subscriptionId, zncUsername: trimmedUsername });

      const response = await subscriptionService.registerZncSubscription({
        purchaseToken: trimmedToken,
        subscriptionId,
        zncUsername: trimmedUsername || '', // Pass empty string if username is not provided
      });

      // Use the username from the response if available, otherwise fall back to the one we sent
      const effectiveUsername = response.znc_username || trimmedUsername;
      setZncSubscriptionStatus(response.status || null);
      setZncExpiresAt(response.expires_at || null);
      setZncPassword(response.znc_password || null);
      setZncAccountStatus(response.znc_status || null);

      // Only update the UI username if we have a valid one
      if (effectiveUsername) {
        setZncUsername(effectiveUsername);
        await persistZncConfig({ zncUsername: effectiveUsername });
      }

      await settingsService.setSetting('zncSubscriptionState', {
        status: response.status || null,
        expiresAt: response.expires_at || null,
        zncPassword: response.znc_password || null,
        zncStatus: response.znc_status || null,
      });

      if ((response.status === 'active' || response.status === 'grace') && response.znc_username && response.znc_password) {
        await applyZncServerToDBase(response.znc_username, response.znc_password);
        Alert.alert(
          t('ZNC Ready', { _tags: tags }),
          t('ZNC server added to DBase network.', { _tags: tags })
        );
      } else {
        Alert.alert(
          t('Subscription Updated', { _tags: tags }),
          t('Status: {status}', { status: response.status || 'unknown', _tags: tags })
        );
      }
    } catch (error: any) {
      Alert.alert(
        t('Subscription Error', { _tags: tags }),
        error?.message || t('Unable to register subscription.', { _tags: tags })
      );
    } finally {
      setZncRegistering(false);
    }
  }, [applyZncServerToDBase, persistZncConfig, tags, t, zncSubscriptionIdConst]);

  const registerZncSubscription = async () => {
    const purchaseToken = zncPurchaseToken.trim();

    if (!purchaseToken) {
      Alert.alert(
        t('Purchase Required', { _tags: tags }),
        t('Please complete the purchase first.', { _tags: tags })
      );
      return;
    }

    // Allow registration even if username is empty, as it might be retrieved from server
    const username = zncUsername.trim();

    await registerZncSubscriptionWithToken(purchaseToken, username);
  };

  const buildGlobalProxyConfig = (overrides?: Partial<GlobalProxyInputs>) => {
    const inputs: GlobalProxyInputs = {
      enabled: globalProxyEnabled,
      type: globalProxyType,
      host: globalProxyHost,
      port: globalProxyPort,
      username: globalProxyUsername,
      password: globalProxyPassword,
    };
    return buildProxyConfig(inputs, overrides);
  };

  // Helper function to get network label
  const networkLabel = useCallback((networkId: string): string => {
    const network = networks.find(n => n.id === networkId);
    return network?.name || networkId;
  }, [networks]);

  const persistGlobalProxy = async (overrides?: Partial<GlobalProxyInputs>) => {
    const cfg = buildGlobalProxyConfig(overrides);
    await settingsService.setSetting('globalProxy', cfg);
  };

  const handleNotificationChange = async (key: keyof NotificationPreferences, value: boolean) => {
    // If enabling notifications, check and request permission first
    if (key === 'enabled' && value) {
      const hasPermission = await notificationService.checkPermission();
      if (!hasPermission) {
        const granted = await notificationService.requestPermission();
        if (!granted) {
          Alert.alert(
            t('Permission Required', { _tags: tags }),
            t('Notification permission is required to receive notifications. Please enable it in system settings.', { _tags: tags })
          );
          return; // Don't enable notifications if permission denied
        }
      }
    }

    await updateNotificationPrefs({ [key]: value });
  };

  const handleBackgroundConnectionChange = async (value: boolean) => {
    await setBackgroundEnabledFromHook(value);
  };

  const handleExportHistory = async () => {
    try {
      const options: ExportOptions = {
        format: exportFormat,
        filter: currentNetwork ? { network: currentNetwork } : undefined,
        includeTimestamps: true,
        includeMetadata: true,
      };
      const exported = await messageHistoryService.exportHistory(options);
      
      // In a real app, you'd save this to a file or share it
      Alert.alert(
        t('Export Complete', { _tags: tags }),
        t('Exported {count} characters in {format} format.\n\n(In production, this would be saved to a file)', {
          count: exported.length,
          format: exportFormat.toUpperCase(),
          _tags: tags,
        }),
        [{ text: t('OK', { _tags: tags }) }]
      );
    } catch (error) {
      Alert.alert(
        t('Export Error', { _tags: tags }),
        error instanceof Error ? error.message : t('Failed to export history', { _tags: tags })
      );
    }
  };

  const handleClearHistory = () => {
    Alert.alert(
      t('Clear Message History', { _tags: tags }),
      t('Are you sure you want to clear all message history? This cannot be undone.', { _tags: tags }),
      [
        { text: t('Cancel', { _tags: tags }), style: 'cancel' },
        {
          text: t('Clear', { _tags: tags }),
          style: 'destructive',
          onPress: async () => {
            if (currentNetwork) {
              await messageHistoryService.deleteNetworkMessages(currentNetwork);
              Alert.alert(
                t('Success', { _tags: tags }),
                t('Message history cleared', { _tags: tags })
              );
              loadHistoryStats();
            }
          },
        },
      ]
    );
  };

  // handleBatteryOptimization now comes from useSettingsNotifications hook
  const handleBatteryOptimizationWrapper = async () => {
    await handleBatteryOptimization();
    // After returning from settings, re-check the status to update UI
    setTimeout(async () => {
      setBatteryOptEnabledStatus(await backgroundService.isBatteryOptimizationEnabled());
    }, 1000); // Delay to allow user to return from settings
  };

  const handleBackupExport = async (settingsOnly: boolean = false) => {
    try {
      const data = settingsOnly
        ? await dataBackupService.exportSettings()
        : await dataBackupService.exportAll();
      setBackupData(data);
      setShowBackupModal(true);
      setStorageStats(await dataBackupService.getStorageStats());
      const message = settingsOnly
        ? t('Settings backup generated (excludes logs and message history).', { _tags: tags })
        : t('Full backup generated (includes all data).', { _tags: tags });
      Alert.alert(t('Backup Ready', { _tags: tags }), message);
    } catch (error) {
      Alert.alert(
        t('Backup Error', { _tags: tags }),
        error instanceof Error ? error.message : t('Failed to create backup', { _tags: tags })
      );
    }
  };

  const handleBackupImport = async () => {
    try {
      await dataBackupService.importAll(backupData);
      Alert.alert(
        t('Restore Complete', { _tags: tags }),
        t('Backup restored. Restart app to ensure all data reloads.', { _tags: tags })
      );
      setStorageStats(await dataBackupService.getStorageStats());
      setShowBackupModal(false);
      loadSettings();
    } catch (error) {
      Alert.alert(
        t('Restore Error', { _tags: tags }),
        error instanceof Error ? error.message : t('Invalid backup data', { _tags: tags })
      );
    }
  };

  const handleBackupCopyToClipboard = () => {
    try {
      Clipboard.setString(backupData);
      Alert.alert(
        t('Success', { _tags: tags }),
        t('Backup data copied to clipboard', { _tags: tags })
      );
    } catch (error) {
      Alert.alert(
        t('Error', { _tags: tags }),
        error instanceof Error ? error.message : t('Failed to copy to clipboard', { _tags: tags })
      );
    }
  };

  const handleMigration = async () => {
    try {
      if (!migrationNetwork) {
        Alert.alert(
          t('Select Network', { _tags: tags }),
          t('Please select a network to migrate keys to', { _tags: tags })
        );
        return;
      }

      const migratedCount = await encryptedDMService.migrateOldKeysToNetwork(migrationNetwork);
      setShowMigrationDialog(false);
      setMigrationNetwork('');

      if (migratedCount === 0) {
        Alert.alert(
          t('Migration Complete', { _tags: tags }),
          t('No old keys found to migrate', { _tags: tags })
        );
      } else {
        Alert.alert(
          t('Migration Complete', { _tags: tags }),
          t(`Successfully migrated ${migratedCount} key(s) to ${migrationNetwork}`, { _tags: tags })
        );
      }
    } catch (error) {
      Alert.alert(
        t('Migration Error', { _tags: tags }),
        error instanceof Error ? error.message : t('Failed to migrate keys', { _tags: tags })
      );
    }
  };

  const handleBackupSaveToFile = async () => {
    try {
      // Generate filename with timestamp
      const now = new Date();
      const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
      const filename = `androidircx_backup_${timestamp}.json`;

      // For Android, use DownloadDirectoryPath (works without permission on Android 10+)
      // For Android 10+ (API 29+), scoped storage allows writing to Downloads without permission
      let savePath: string;

      if (Platform.OS === 'android') {
        // Use app's external storage directory - no permissions needed on any Android version
        // This directory is accessible via File Manager under Android/data/com.androidircx/files/
        const externalDir = RNFS.ExternalDirectoryPath;

        if (!externalDir) {
          // Fallback to internal storage if external is not available
          savePath = `${RNFS.DocumentDirectoryPath}/${filename}`;
        } else {
          savePath = `${externalDir}/${filename}`;
        }
      } else {
        // iOS
        savePath = `${RNFS.DocumentDirectoryPath}/${filename}`;
      }

      // Write file
      await RNFS.writeFile(savePath, backupData, 'utf8');

      Alert.alert(
        t('Success', { _tags: tags }),
        t('Backup saved to:\n{path}', { path: savePath, _tags: tags }),
        [{ text: t('OK', { _tags: tags }) }]
      );
    } catch (error) {
      Alert.alert(
        t('Error', { _tags: tags }),
        error instanceof Error ? error.message : t('Failed to save backup file', { _tags: tags })
      );
    }
  };

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
  }, [PIN_STORAGE_KEY, closePinModal, pinEntry, pinModalMode, pinSetupValue, t]);

  // App lock functions now handled by SecuritySection component

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
  }, [biometricAvailable, biometricLockEnabled, passwordLockActive, pinLockEnabled, requestPinUnlock, t]);

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

  // App lock functions now handled by SecuritySection component

  const lastSearchTermRef = useRef('');
  useEffect(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      lastSearchTermRef.current = '';
      return;
    }
    // Expand all sections while searching, but don't auto-open or scroll.
    setExpandedSections(new Set(filteredSections.map(s => s.title)));
    if (term !== lastSearchTermRef.current) {
      setShowSubmenu(null);
      lastSearchTermRef.current = term;
    }
  }, [searchTerm, filteredSections]);

  // Icon mapping now handled by utility function
  const zncStatusLabel = zncSubscriptionStatus || t('Not registered', { _tags: tags });
  const zncExpiresLabel = formatZncExpiresAt(zncExpiresAt);
  const zncAccountLabel = zncAccountStatus || t('Not available', { _tags: tags });
  const zncPurchaseDescription = zncDisplayPrice
    ? t('Price: {price}', { price: zncDisplayPrice, _tags: tags })
    : t('Monthly subscription via Google Play', { _tags: tags });

  const sections = [
    {
      id: 'premium',
      title: premiumTitle,
      data: [
        {
          id: 'premium-upgrade',
          title: t('Upgrade to Premium', { _tags: tags }),
          description: t('Remove ads, unlimited scripting, and more', { _tags: tags }),
          type: 'button' as const,
          icon: { name: 'crown', solid: true },
          onPress: () => onShowPurchaseScreen?.(),
          searchKeywords: ['premium', 'upgrade', 'pro', 'supporter', 'no-ads', 'remove ads', 'unlimited', 'scripting', 'purchase', 'buy'],
        },
      ],
    },
    {
      id: 'znc-subscription',
      title: zncSubscriptionTitle,
      data: [
        {
          id: 'znc-manage-subscriptions',
          title: t('Manage ZNC Accounts', { _tags: tags }),
          description: t('Purchase, manage, and configure ZNC bouncer accounts', { _tags: tags }),
          type: 'button' as const,
          icon: { name: 'server', solid: false },
          onPress: () => setShowZncSubscription(true),
          searchKeywords: ['znc', 'subscription', 'purchase', 'buy', 'bouncer', 'accounts', 'manage'],
        },
        {
          id: 'znc-subscription-info',
          title: t('About ZNC Service', { _tags: tags }),
          description: t('ZNC keeps you connected 24/7 with message playback', { _tags: tags }),
          type: 'button' as const,
          icon: { name: 'info-circle', solid: false },
          onPress: () => {
            Alert.alert(
              t('ZNC Subscription', { _tags: tags }),
              t('ZNC is an IRC bouncer that keeps you connected 24/7. Features include:\n\n- Always-on connection\n- Message playback when you reconnect\n- Multiple network support\n- Automatic configuration\n\nPrimarily intended for DBase network. Use on other networks at your own risk.', { _tags: tags })
            );
          },
          searchKeywords: ['znc', 'info', 'about', 'bouncer', 'features'],
        },
      ],
    },
    {
      id: 'appearance',
      title: t('Appearance', { _tags: tags }),
      data: [{
        id: 'appearance-section',
        title: 'appearance-section',
        type: 'custom' as const,
        searchKeywords: ['theme', 'dark', 'light', 'color', 'style', 'font', 'size'],
      }], // Placeholder - actual rendering handled by component
    },
    {
      id: 'display-ui',
      title: t('Display & UI', { _tags: tags }),
      data: [{
        id: 'display-ui-section',
        title: 'display-ui-section',
        type: 'custom' as const,
        searchKeywords: ['layout', 'tabs', 'userlist', 'nicklist', 'position', 'top', 'bottom', 'left', 'right'],
      }], // Placeholder - actual rendering handled by component
    },
    {
      id: 'messages-history',
      title: t('Messages & History', { _tags: tags }),
      data: [
        {
          id: 'message-history-section',
          title: 'message-history-section',
          type: 'custom' as const,
          searchKeywords: ['message', 'timestamp', 'format', 'raw', 'join', 'part', 'quit', 'notice', 'routing'],
        }, // Message settings component
        {
          id: 'history-stats',
          title: t('History Statistics', { _tags: tags }),
          description: t('View message history statistics', { _tags: tags }),
          type: 'button' as const,
          onPress: async () => {
            const stats = await messageHistoryService.getStats();
            Alert.alert(
              'Message History Statistics',
              `Total Messages: ${stats.totalMessages}\nChannels: ${stats.channelCount}\nOldest Message: ${new Date(stats.oldestMessage).toLocaleString()}\nNewest Message: ${new Date(stats.newestMessage).toLocaleString()}`
            );
          },
          searchKeywords: ['history', 'statistics', 'stats', 'messages', 'count', 'total'],
        },
        {
          id: 'history-export',
          title: t('Export History', { _tags: tags }),
          description: t('Export message history to file', { _tags: tags }),
          type: 'submenu' as const,
          searchKeywords: ['export', 'history', 'messages', 'json', 'txt', 'csv', 'file', 'save', 'download'],
          submenuItems: [
            {
              id: 'export-json',
              title: t('Export as JSON', { _tags: tags }),
              description: t('Export all messages in JSON format', { _tags: tags }),
              type: 'button' as const,
              onPress: () => handleExportHistory(),
            },
            {
              id: 'export-txt',
              title: t('Export as TXT', { _tags: tags }),
              description: t('Export as plain text log', { _tags: tags }),
              type: 'button' as const,
              onPress: () => handleExportHistory(),
            },
            {
              id: 'export-csv',
              title: t('Export as CSV', { _tags: tags }),
              description: t('Export as spreadsheet-compatible CSV', { _tags: tags }),
              type: 'button' as const,
              onPress: () => handleExportHistory(),
            },
          ],
        },
        {
          id: 'history-clear',
          title: t('Clear History', { _tags: tags }),
          description: t('Delete all stored message history', { _tags: tags }),
          type: 'button' as const,
          onPress: () => {
            Alert.alert(
          t('Clear Message History', { _tags: tags }),
          t('This will permanently delete all stored messages. Continue?', { _tags: tags }),
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Clear',
                  style: 'destructive',
                  onPress: async () => {
                    await messageHistoryService.clearAll();
                    Alert.alert(
          t('Success', { _tags: tags }),
          t('Message history cleared', { _tags: tags }));
                  },
                },
              ]
            );
          },
          searchKeywords: ['clear', 'delete', 'remove', 'history', 'messages', 'wipe', 'erase'],
        },
        {
          id: 'history-storage',
          title: t('Storage Usage', { _tags: tags }),
          description: storageStats ? `${(storageStats.totalBytes / 1024 / 1024).toFixed(2)} MB used` : 'Loading...',
          type: 'button' as const,
          disabled: true,
          searchKeywords: ['storage', 'space', 'usage', 'size', 'disk', 'mb', 'data'],
        },
        {
          id: 'history-backup',
          title: t('Backup & Restore', { _tags: tags }),
          description: t('Backup or restore all app data', { _tags: tags }),
          type: 'button' as const,
          onPress: () => setShowBackupScreen(true),
          searchKeywords: ['backup', 'restore', 'import', 'export', 'save', 'load', 'data', 'settings'],
        },
      ],
    },
    {
      id: 'media',
      title: t('Media', { _tags: tags }),
      data: [{
        id: 'media-section',
        title: 'media-section',
        type: 'custom' as const,
        searchKeywords: ['image', 'video', 'audio', 'photo', 'camera', 'voice', 'recorder', 'upload', 'download', 'media'],
      }], // Placeholder - actual rendering handled by component
    },
    {
      id: 'notifications',
      title: t('Notifications', { _tags: tags }),
      data: [{
        id: 'notifications-section',
        title: 'notifications-section',
        type: 'custom' as const,
        searchKeywords: ['notification', 'alert', 'sound', 'vibrate', 'badge', 'push'],
      }], // Placeholder - actual rendering handled by component
    },
    {
      id: 'away',
      title: t('Away', { _tags: tags }),
      data: [{
        id: 'away-section',
        title: 'away-section',
        type: 'custom' as const,
        searchKeywords: ['away', 'back', 'auto-away', 'auto answer', 'auto-answer', 'announce', 'nick', 'return', 'message'],
      }], // Placeholder - actual rendering handled by component
    },
    {
      id: 'protection',
      title: t('Protection', { _tags: tags }),
      data: [{
        id: 'protection-section',
        title: 'protection-section',
        type: 'custom' as const,
        searchKeywords: ['protection', 'anti-spam', 'spam', 'flood', 'dos', 'ctcp', 'query', 'dcc', 'silence'],
      }], // Placeholder - actual rendering handled by component
    },
    {
      id: 'writing',
      title: t('Writing', { _tags: tags }),
      data: [{
        id: 'writing-section',
        title: 'writing-section',
        type: 'custom' as const,
        searchKeywords: ['writing', 'decoration', 'styles', 'nick completion', 'completion', 'formatting', 'text'],
      }], // Placeholder - actual rendering handled by component
    },
    {
      id: 'highlighting',
      title: t('Highlighting', { _tags: tags }),
      data: [{
        id: 'highlighting-section',
        title: 'highlighting-section',
        type: 'custom' as const,
        searchKeywords: ['highlight', 'keyword', 'mention', 'nick', 'color'],
      }], // Placeholder - actual rendering handled by component
    },
    {
      id: 'connection-network',
      title: connectionTitle,
      data: [
        {
          id: 'connection-network-section',
          title: 'connection-network-section',
          type: 'custom' as const,
          searchKeywords: ['network', 'server', 'connection', 'proxy', 'tor', 'ssl', 'tls', 'port', 'bouncer', 'znc', 'auto-reconnect', 'favorites', 'dcc'],
        }, // Connection & Network component
        // IRC Bouncer settings moved here
        {
          id: 'bouncer-info',
          title: t('Bouncer Status', { _tags: tags }),
          description: bouncerInfo
            ? `Type: ${bouncerInfo.type}, Playback: ${bouncerInfo.playbackSupported ? 'Supported' : 'Not supported'}`
            : 'Not connected or not detected',
          type: 'button' as const,
          disabled: true,
          searchKeywords: ['bouncer', 'status', 'znc', 'bnc', 'playback', 'connected'],
        },
        {
          id: 'bouncer-config',
          title: t('Bouncer Settings', { _tags: tags }),
          description: bouncerConfig?.enabled
            ? `${bouncerConfig.type} mode, ${bouncerConfig.handlePlayback ? 'playback enabled' : 'playback disabled'}`
            : 'Configure bouncer support',
          type: 'submenu' as const,
          searchKeywords: ['bouncer', 'settings', 'znc', 'bnc', 'playback', 'buffer', 'timeout', 'age', 'limit'],
          submenuItems: [
            {
              id: 'bouncer-enabled',
              title: t('Enable Bouncer Support', { _tags: tags }),
              type: 'switch' as const,
              value: bouncerConfig?.enabled || false,
              onValueChange: async (value: boolean) => {
                await updateBouncerConfig({ enabled: value });
              },
            },
            {
              id: 'bouncer-type',
              title: t('Bouncer Type', { _tags: tags }),
              description: `Type: ${bouncerConfig?.type || 'auto'} (auto-detect, znc, bnc)`,
              type: 'button' as const,
              onPress: () => {
                Alert.alert(
          t('Bouncer Type', { _tags: tags }),
          t('Select bouncer type:', { _tags: tags }),
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Auto-detect',
                      onPress: async () => {
                        await updateBouncerConfig({ type: 'auto' });
                      },
                    },
                    {
                      text: 'ZNC',
                      onPress: async () => {
                        await updateBouncerConfig({ type: 'znc' });
                      },
                    },
                    {
                      text: 'BNC',
                      onPress: async () => {
                        await updateBouncerConfig({ type: 'bnc' });
                      },
                    },
                  ]
                );
              },
              disabled: !bouncerConfig?.enabled,
            },
            {
              id: 'bouncer-handle-playback',
              title: t('Handle Playback Buffer', { _tags: tags }),
              description: t('Process playback messages from bouncer', { _tags: tags }),
              type: 'switch' as const,
              value: bouncerConfig?.handlePlayback || false,
              onValueChange: async (value: boolean) => {
                await updateBouncerConfig({ handlePlayback: value });
              },
              disabled: !bouncerConfig?.enabled,
            },
            {
              id: 'bouncer-mark-playback',
              title: t('Mark Playback Messages', { _tags: tags }),
              description: t('Add [Playback] indicator to old messages', { _tags: tags }),
              type: 'switch' as const,
              value: bouncerConfig?.markPlaybackMessages || false,
              onValueChange: async (value: boolean) => {
                await updateBouncerConfig({ markPlaybackMessages: value });
              },
              disabled: !bouncerConfig?.enabled || !bouncerConfig?.handlePlayback,
            },
            {
              id: 'bouncer-skip-old',
              title: t('Skip Old Playback', { _tags: tags }),
              description: `Skip messages older than ${bouncerConfig?.playbackAgeLimit || 24} hours`,
              type: 'switch' as const,
              value: bouncerConfig?.skipOldPlayback || false,
              onValueChange: async (value: boolean) => {
                await updateBouncerConfig({ skipOldPlayback: value });
              },
              disabled: !bouncerConfig?.enabled || !bouncerConfig?.handlePlayback,
            },
            {
              id: 'bouncer-playback-timeout',
              title: t('Playback Timeout (ms)', { _tags: tags }),
              description: `Timeout: ${bouncerConfig?.playbackTimeout || 5000}ms`,
              type: 'input' as const,
              value: bouncerConfig?.playbackTimeout?.toString() || '5000',
              keyboardType: 'numeric',
              onValueChange: async (value: string) => {
                const timeout = parseInt(value, 10);
                if (!isNaN(timeout) && timeout > 0) {
                  await updateBouncerConfig({ playbackTimeout: timeout });
                }
              },
              disabled: !bouncerConfig?.enabled || !bouncerConfig?.handlePlayback,
            },
            {
              id: 'bouncer-playback-age',
              title: t('Playback Age Limit (hours)', { _tags: tags }),
              description: `Max age: ${bouncerConfig?.playbackAgeLimit || 24} hours`,
              type: 'input' as const,
              value: bouncerConfig?.playbackAgeLimit?.toString() || '24',
              keyboardType: 'numeric',
              onValueChange: async (value: string) => {
                const age = parseInt(value, 10);
                if (!isNaN(age) && age > 0) {
                  await updateBouncerConfig({ playbackAgeLimit: age });
                }
              },
              disabled: !bouncerConfig?.enabled || !bouncerConfig?.handlePlayback || !bouncerConfig?.skipOldPlayback,
            },
            {
              id: 'bouncer-request-playback',
              title: t('Request Playback (ZNC)', { _tags: tags }),
              description: t('Request playback buffer from ZNC', { _tags: tags }),
              type: 'button' as const,
              onPress: () => {
                bouncerService.requestPlayback();
                Alert.alert(
          t('Info', { _tags: tags }),
          t('Playback requested from ZNC', { _tags: tags }));
              },
              disabled: !bouncerConfig?.enabled || bouncerInfo?.type !== 'znc' || !bouncerInfo?.playbackSupported,
            },
            {
              id: 'bouncer-load-scrollback',
              title: t('Load Scrollback on Join', { _tags: tags }),
              description: t('Load previous messages from local history when joining channels', { _tags: tags }),
              type: 'switch' as const,
              value: bouncerConfig?.loadScrollbackOnJoin ?? true,
              onValueChange: async (value: boolean) => {
                await updateBouncerConfig({ loadScrollbackOnJoin: value });
              },
            },
            {
              id: 'bouncer-scrollback-lines',
              title: t('Scrollback Lines', { _tags: tags }),
              description: t('Number of previous messages to load: {count}', { _tags: tags, count: bouncerConfig?.scrollbackLines || 50 }),
              type: 'input' as const,
              value: bouncerConfig?.scrollbackLines?.toString() || '50',
              keyboardType: 'numeric',
              onValueChange: async (value: string) => {
                const lines = parseInt(value, 10);
                if (!isNaN(lines) && lines > 0 && lines <= 500) {
                  await updateBouncerConfig({ scrollbackLines: lines });
                }
              },
              disabled: !(bouncerConfig?.loadScrollbackOnJoin ?? true),
            },
          ],
        },
      ],
    },
    {
      id: 'security',
      title: t('Security', { _tags: tags }),
      data: [
        {
          id: 'security-section',
          title: 'security-section',
          type: 'custom' as const,
          searchKeywords: ['pin', 'password', 'lock', 'biometric', 'fingerprint', 'face', 'encryption', 'keys', 'identity', 'profile'],
        }, // Security component
        {
          id: 'security-quick-connect-section',
          title: 'security-quick-connect-section',
          type: 'custom' as const,
          searchKeywords: ['quick', 'connect', 'favorite', 'identity', 'profile', 'kill', 'switch', 'panic', 'emergency', 'wipe', 'delete', 'custom', 'icon', 'color', 'name'],
        }, // Security & Quick Connect merged here
      ],
    },
    {
      id: 'users-services',
      title: t('Users & Services', { _tags: tags }),
      data: [{
        id: 'users-services-section',
        title: 'users-services-section',
        type: 'custom' as const,
        searchKeywords: ['ignore', 'block', 'monitor', 'watch', 'nickserv', 'chanserv', 'user', 'service'],
      }], // Placeholder - actual rendering handled by component
    },
    {
      id: 'commands',
      title: t('Commands', { _tags: tags }),
      data: [{
        id: 'commands-section',
        title: 'commands-section',
        type: 'custom' as const,
        searchKeywords: [
          'command', 'alias', 'custom', 'history', 'kill', 'kick', 'ban', 'mode', 'whois',
          'join', 'part', 'quit', 'nick', 'msg', 'notice', 'topic', 'invite', 'voice',
          'op', 'deop', 'halfop', 'dehalfop', 'owner', 'deowner', 'admin', 'deadmin',
          'znc', 'oper', 'ctcp', 'dcc', 'away', 'back', 'list', 'names', 'who', 'whowas',
        ],
      }], // Placeholder - actual rendering handled by component
    },
    {
      id: 'performance',
      title: t('Performance', { _tags: tags }),
      data: [
        {
          id: 'perf-virtualization',
          title: t('Message List Virtualization', { _tags: tags }),
          description: t('Use FlatList for better performance with large channels', { _tags: tags }),
          type: 'switch' as const,
          value: performanceConfig?.enableVirtualization !== false,
          onValueChange: async (value: boolean) => {
            await performanceService.setConfig({ enableVirtualization: value });
            setPerformanceConfig(performanceService.getConfig());
          },
          searchKeywords: ['virtualization', 'performance', 'flatlist', 'scroll', 'optimize', 'speed'],
        },
        {
          id: 'perf-lazy-loading',
          title: t('Lazy Load Old Messages', { _tags: tags }),
          description: t('Load old messages when scrolling up', { _tags: tags }),
          type: 'switch' as const,
          value: performanceConfig?.enableLazyLoading !== false,
          onValueChange: async (value: boolean) => {
            await performanceService.setConfig({ enableLazyLoading: value });
            setPerformanceConfig(performanceService.getConfig());
          },
          disabled: !performanceConfig?.enableVirtualization,
          searchKeywords: ['lazy', 'load', 'loading', 'old', 'messages', 'scroll', 'performance'],
        },
        {
          id: 'perf-render-optimization',
          title: t('Render Optimization', { _tags: tags }),
          description: t('Use React.memo and useMemo for optimized rendering', { _tags: tags }),
          type: 'switch' as const,
          value: performanceConfig?.renderOptimization !== false,
          onValueChange: async (value: boolean) => {
            await performanceService.setConfig({ renderOptimization: value });
            setPerformanceConfig(performanceService.getConfig());
          },
          searchKeywords: ['render', 'optimization', 'optimize', 'memo', 'performance', 'speed'],
        },
        {
          id: 'perf-message-cleanup',
          title: t('Automatic Message Cleanup', { _tags: tags }),
          description: t('Automatically remove old messages to save memory', { _tags: tags }),
          type: 'switch' as const,
          value: performanceConfig?.enableMessageCleanup !== false,
          onValueChange: async (value: boolean) => {
            await performanceService.setConfig({ enableMessageCleanup: value });
            setPerformanceConfig(performanceService.getConfig());
          },
          searchKeywords: ['cleanup', 'clean', 'remove', 'old', 'messages', 'memory', 'automatic'],
        },
        {
          id: 'perf-message-limit',
          title: t('Message Limit Per Channel', { _tags: tags }),
          description: `Keep max ${performanceConfig?.messageLimit || 1000} messages in memory`,
          type: 'input' as const,
          value: performanceConfig?.messageLimit?.toString() || '1000',
          keyboardType: 'numeric',
          onValueChange: async (value: string) => {
            const limit = parseInt(value, 10);
            if (!isNaN(limit) && limit > 0) {
              await performanceService.setConfig({ messageLimit: limit });
              setPerformanceConfig(performanceService.getConfig());
            }
          },
          disabled: !performanceConfig?.enableMessageCleanup,
          searchKeywords: ['message', 'limit', 'max', 'maximum', 'channel', 'memory', 'count'],
        },
        {
          id: 'perf-max-visible',
          title: t('Max Visible Messages', { _tags: tags }),
          description: `Render max ${performanceConfig?.maxVisibleMessages || 100} messages at once`,
          type: 'input' as const,
          value: performanceConfig?.maxVisibleMessages?.toString() || '100',
          keyboardType: 'numeric',
          onValueChange: async (value: string) => {
            const max = parseInt(value, 10);
            if (!isNaN(max) && max > 0) {
              await performanceService.setConfig({ maxVisibleMessages: max });
              setPerformanceConfig(performanceService.getConfig());
            }
          },
          disabled: !performanceConfig?.enableVirtualization,
          searchKeywords: ['max', 'maximum', 'visible', 'messages', 'render', 'display'],
        },
        {
          id: 'perf-load-chunk',
          title: t('Message Load Chunk Size', { _tags: tags }),
          description: `Load ${performanceConfig?.messageLoadChunk || 50} messages at a time`,
          type: 'input' as const,
          value: performanceConfig?.messageLoadChunk?.toString() || '50',
          keyboardType: 'numeric',
          onValueChange: async (value: string) => {
            const chunk = parseInt(value, 10);
            if (!isNaN(chunk) && chunk > 0) {
              await performanceService.setConfig({ messageLoadChunk: chunk });
              setPerformanceConfig(performanceService.getConfig());
            }
          },
          disabled: !performanceConfig?.enableVirtualization || !performanceConfig?.enableLazyLoading,
          searchKeywords: ['load', 'chunk', 'size', 'batch', 'messages', 'performance'],
        },
        {
          id: 'perf-image-lazy',
          title: t('Lazy Load Images', { _tags: tags }),
          description: t('Only load images when they become visible', { _tags: tags }),
          type: 'switch' as const,
          value: performanceConfig?.imageLazyLoad !== false,
          onValueChange: async (value: boolean) => {
            await performanceService.setConfig({ imageLazyLoad: value });
            setPerformanceConfig(performanceService.getConfig());
          },
          searchKeywords: ['lazy', 'load', 'images', 'photos', 'visible', 'performance'],
        },
        {
          id: 'perf-user-grouping',
          title: t('User List Grouping', { _tags: tags }),
          description: t('Group users by status (ops/voice/etc.)', { _tags: tags }),
          type: 'switch' as const,
          value: performanceConfig?.userListGrouping !== false,
          onValueChange: async (value: boolean) => {
            await performanceService.setConfig({ userListGrouping: value });
            setPerformanceConfig(performanceService.getConfig());
          },
          searchKeywords: ['user', 'list', 'group', 'grouping', 'ops', 'voice', 'performance'],
        },
        {
          id: 'perf-user-grouping-threshold',
          title: t('Auto-Disable Grouping Threshold', { _tags: tags }),
          description: `Disable grouping above ${performanceConfig?.userListAutoDisableGroupingThreshold || 1000} users`,
          type: 'input' as const,
          value: performanceConfig?.userListAutoDisableGroupingThreshold?.toString() || '1000',
          keyboardType: 'numeric',
          onValueChange: async (value: string) => {
            const threshold = parseInt(value, 10);
            if (!isNaN(threshold) && threshold > 0) {
              await performanceService.setConfig({ userListAutoDisableGroupingThreshold: threshold });
              setPerformanceConfig(performanceService.getConfig());
            }
          },
          disabled: performanceConfig?.userListGrouping === false,
          searchKeywords: ['user', 'list', 'group', 'threshold', 'auto', 'disable', 'performance'],
        },
        {
          id: 'perf-user-virtualization',
          title: t('User List Virtualization', { _tags: tags }),
          description: t('Use FlatList for large user lists (non-grouped)', { _tags: tags }),
          type: 'switch' as const,
          value: performanceConfig?.userListVirtualization !== false,
          onValueChange: async (value: boolean) => {
            await performanceService.setConfig({ userListVirtualization: value });
            setPerformanceConfig(performanceService.getConfig());
          },
          searchKeywords: ['user', 'list', 'virtualization', 'flatlist', 'performance'],
        },
        {
          id: 'perf-user-virtualization-threshold',
          title: t('Auto-Virtualize Threshold', { _tags: tags }),
          description: `Enable virtualization above ${performanceConfig?.userListAutoVirtualizeThreshold || 500} users`,
          type: 'input' as const,
          value: performanceConfig?.userListAutoVirtualizeThreshold?.toString() || '500',
          keyboardType: 'numeric',
          onValueChange: async (value: string) => {
            const threshold = parseInt(value, 10);
            if (!isNaN(threshold) && threshold > 0) {
              await performanceService.setConfig({ userListAutoVirtualizeThreshold: threshold });
              setPerformanceConfig(performanceService.getConfig());
            }
          },
          disabled: performanceConfig?.userListVirtualization === false,
          searchKeywords: ['user', 'list', 'virtualization', 'threshold', 'auto', 'performance'],
        },
      ],
    },
    {
      id: 'background-battery',
      title: t('Background & Battery', { _tags: tags }),
      data: [{
        id: 'background-battery-section',
        title: 'background-battery-section',
        type: 'custom' as const,
        searchKeywords: ['background', 'service', 'foreground', 'battery', 'optimization', 'doze', 'persistent'],
      }], // Placeholder - actual rendering handled by component
    },
    {
      id: 'scripting-ads',
      title: t('Scripting & Ads', { _tags: tags }),
      data: [
        {
          id: 'advanced-scripts',
          title: t('Scripts (Scripting Time & No-Ads)', { _tags: tags }),
          description: t('Manage IRC scripts and automation. Scripting time is also ad-free time.', { _tags: tags }),
          type: 'button' as const,
          onPress: () => setShowScripting(true),
          searchKeywords: ['scripts', 'scripting', 'automation', 'time', 'no-ads', 'ad-free', 'manage'],
        },
        {
          id: 'advanced-scripts-help',
          title: t('Scripting Help', { _tags: tags }),
          description: t('Learn how to write and use scripts', { _tags: tags }),
          type: 'button' as const,
          onPress: () => setShowScriptingHelp(true),
          searchKeywords: ['scripting', 'help', 'guide', 'tutorial', 'write', 'scripts'],
        },
        {
          id: 'watch-ad-button-premium',
          title: t('Show Watch Ad Button (Premium)', { _tags: tags }),
          description: (hasNoAds || hasScriptingPro || isSupporter)
            ? t('Enable watch ad button to support the project (you have premium plan)', { _tags: tags })
            : t('Always shown for normal users', { _tags: tags }),
          type: 'switch' as const,
          value: watchAdButtonEnabledForPremium,
          onValueChange: async (value: boolean | string) => {
            await setWatchAdButtonEnabledForPremium(value as boolean);
          },
          disabled: !(hasNoAds || hasScriptingPro || isSupporter),
          searchKeywords: ['watch', 'ad', 'button', 'premium', 'ads', 'advertising', 'support'],
        },
        {
          id: 'watch-ad-button',
          title: 'watch-ad-button',
          type: 'custom' as const,
          searchKeywords: ['watch', 'ad', 'reward', 'video', 'ads', 'time', 'scripting'],
        },
      ],
    },
    {
      id: 'privacy-legal',
      title: t('Privacy & Legal', { _tags: tags }),
      data: [{
        id: 'privacy-legal-section',
        title: 'privacy-legal-section',
        type: 'custom' as const,
        searchKeywords: ['privacy', 'legal', 'terms', 'policy', 'data', 'gdpr', 'license', 'copyright'],
      }], // Placeholder - actual rendering handled by component
    },
    ...(__DEV__
      ? [
          {
            id: 'development',
            title: t('Development', { _tags: tags }),
            data: [
              {
                id: 'console-logging',
                title: t('Enable Console Logging', { _tags: tags }),
                description: t('Toggle console.log output in development', { _tags: tags }),
                type: 'switch' as const,
                value: consoleEnabled,
                onValueChange: async (value: boolean) => {
                  setConsoleEnabled(value);
                  await consoleManager.setEnabled(value);
                },
                searchKeywords: ['console', 'logging', 'log', 'debug', 'development', 'dev'],
              },
            ],
          },
        ]
      : []),
    {
      id: 'about',
      title: aboutTitle,
      data: [{
        id: 'about-section',
        title: 'about-section',
        type: 'custom' as const,
        searchKeywords: ['about', 'version', 'info', 'credits', 'author', 'developer', 'contact', 'support'],
      }], // Placeholder - actual rendering handled by component
    },
    {
      id: 'help',
      title: helpTitle,
      data: [{
        id: 'help-section',
        title: 'help-section',
        type: 'custom' as const,
        searchKeywords: ['help', 'guide', 'tutorial', 'documentation', 'faq', 'troubleshooting', 'support'],
      }], // Help & Documentation section
    },
  ];

  const orderedSections = useMemo(() => {
    return orderSections(sections, isSupporter, hasNoAds, hasScriptingPro);
  }, [sections, isSupporter, hasNoAds, hasScriptingPro]);

  const filteredSections = useMemo(() => {
    return filterSettings(orderedSections, searchTerm);
  }, [orderedSections, searchTerm]);

  const renderSettingItem = (item: SettingItem, sectionTitle?: string) => {
    const itemIcon = (typeof item.icon === 'object' ? item.icon : undefined) || settingIcons[item.id];
    
    // Handle section components
    if (item.type === 'custom') {
      if (item.id === 'scripting-ads-section' && sectionTitle === scriptingAdsTitle) {
        return (
          <ScriptingAdsSection
            key={item.id}
            colors={colors}
            styles={styles}
            settingIcons={settingIcons}
            onShowScripting={() => setShowScripting(true)}
            onShowScriptingHelp={() => setShowScriptingHelp(true)}
          />
        );
      }
      if (item.id === 'security-quick-connect-section' && sectionTitle === t('Security', { _tags: tags })) {
        return (
          <SecurityQuickConnectSection
            key={item.id}
            colors={colors}
            styles={styles}
            settingIcons={settingIcons}
            networks={networks}
            networkLabel={networkLabel}
          />
        );
      }
      if (item.id === 'security-section' && sectionTitle === t('Security', { _tags: tags })) {
        return (
          <SecuritySection
            key={item.id}
            colors={colors}
            styles={styles}
            settingIcons={settingIcons}
            onShowKeyManagement={() => setShowKeyManagement(true)}
            onShowMigrationDialog={(networkId) => {
              setMigrationNetwork(networkId);
              setShowMigrationDialog(true);
            }}
          />
        );
      }
      if (item.id === 'privacy-legal-section' && sectionTitle === t('Privacy & Legal', { _tags: tags })) {
        return (
          <PrivacyLegalSection
            key={item.id}
            colors={colors}
            styles={styles}
            settingIcons={settingIcons}
            onShowDataPrivacy={() => setShowDataPrivacy(true)}
            onShowPrivacyAds={() => setShowPrivacyAds(true)}
          />
        );
      }
      if (item.id === 'about-section' && sectionTitle === aboutTitle) {
        return (
          <AboutSection
            key={item.id}
            colors={colors}
            styles={styles}
            settingIcons={settingIcons}
            onShowAbout={() => setShowAbout(true)}
            onShowCredits={() => setShowCredits(true)}
          />
        );
      }
      if (item.id === 'help-section' && sectionTitle === helpTitle) {
        return <HelpSection key={item.id} />;
      }
      if (item.id === 'appearance-section' && sectionTitle === t('Appearance', { _tags: tags })) {
        return (
          <AppearanceSection
            key={item.id}
            colors={colors}
            styles={styles}
            settingIcons={settingIcons}
            onShowThemeEditor={(theme) => {
              setEditingTheme(theme);
              setShowThemeEditor(true);
            }}
            languageLabels={languageLabels}
          />
        );
      }
      if (item.id === 'display-ui-section' && sectionTitle === t('Display & UI', { _tags: tags })) {
        return (
          <DisplayUISection
            key={item.id}
            colors={colors}
            styles={styles}
            settingIcons={settingIcons}
            showRawCommands={localShowRawCommands}
            onShowRawCommandsChange={onShowRawCommandsChange}
            rawCategoryVisibility={localRawCategoryVisibility}
            onRawCategoryVisibilityChange={onRawCategoryVisibilityChange}
            showEncryptionIndicators={showEncryptionIndicatorsSetting}
            onShowEncryptionIndicatorsChange={onShowEncryptionIndicatorsChange}
            showTypingIndicators={showTypingIndicatorsSetting}
            onShowTypingIndicatorsChange={onShowTypingIndicatorsChange}
          />
        );
      }
      if (item.id === 'message-history-section' && sectionTitle === t('Messages & History', { _tags: tags })) {
        return (
          <MessageHistorySection
            key={item.id}
            colors={colors}
            styles={styles}
            settingIcons={settingIcons}
          />
        );
      }
            if (item.id === 'notifications-section' && sectionTitle === t('Notifications', { _tags: tags })) {
              return (
                <NotificationsSection
                  key={item.id}
                  colors={colors}
                  styles={styles}
                  settingIcons={settingIcons}
                />
              );
            }
            if (item.id === 'away-section' && sectionTitle === t('Away', { _tags: tags })) {
              return (
                <AwaySection
                  key={item.id}
                  colors={colors}
                  styles={styles}
                  settingIcons={settingIcons}
                  onClose={onClose}
                />
              );
            }
            if (item.id === 'protection-section' && sectionTitle === t('Protection', { _tags: tags })) {
              return (
                <ProtectionSection
                  key={item.id}
                  colors={colors}
                  styles={styles}
                  settingIcons={settingIcons}
                />
              );
            }
            if (item.id === 'writing-section' && sectionTitle === t('Writing', { _tags: tags })) {
              return (
                <WritingSection
                  key={item.id}
                  colors={colors}
                  styles={styles}
                  settingIcons={settingIcons}
                />
              );
            }
            if (item.id === 'connection-network-section' && sectionTitle === connectionTitle) {
              return (
                <ConnectionNetworkSection
                  key={item.id}
                  colors={colors}
                  styles={styles}
                  settingIcons={settingIcons}
                  currentNetwork={currentNetwork}
                  onShowFirstRunSetup={() => setShowFirstRunSetup(true)}
                  onShowConnectionProfiles={() => setShowConnectionProfiles(true)}
                />
              );
            }
            if (item.id === 'background-battery-section' && sectionTitle === t('Background & Battery', { _tags: tags })) {
              return (
                <BackgroundBatterySection
                  key={item.id}
                  colors={colors}
                  styles={styles}
                  settingIcons={settingIcons}
                />
              );
            }
            if (item.id === 'highlighting-section' && sectionTitle === t('Highlighting', { _tags: tags })) {
              return (
                <HighlightingSection
                  key={item.id}
                  colors={colors}
                  styles={styles}
                  settingIcons={settingIcons}
                />
              );
            }
            if (item.id === 'security-section' && sectionTitle === t('Security', { _tags: tags })) {
              return (
                <SecuritySection
                  key={item.id}
                  colors={colors}
                  styles={styles}
                  settingIcons={settingIcons}
                  onShowKeyManagement={() => setShowKeyManagement(true)}
                  onShowMigrationDialog={() => setShowMigrationDialog(true)}
                />
              );
            }
            if (item.id === 'users-services-section' && sectionTitle === t('Users & Services', { _tags: tags })) {
              return (
                <UsersServicesSection
                  key={item.id}
                  colors={colors}
                  styles={styles}
                  settingIcons={settingIcons}
                  currentNetwork={currentNetwork}
                  onShowIgnoreList={onShowIgnoreList}
                  onShowBlacklist={onShowBlacklist}
                />
              );
            }
            if (item.id === 'commands-section' && sectionTitle === t('Commands', { _tags: tags })) {
              return (
                <CommandsSection
                  key={item.id}
                  colors={colors}
                  styles={styles}
                  settingIcons={settingIcons}
                />
              );
            }
            if (item.id === 'media-section' && sectionTitle === t('Media', { _tags: tags })) {
              return (
                <MediaSection
                  key={item.id}
                  colors={colors}
                  styles={styles}
                  settingIcons={settingIcons}
                />
              );
            }
      
      // Custom render function for special cases like watch-ad-button
      if (item.id === 'watch-ad-button' && showWatchAdButton) {
        return (
          <View key={item.id} style={styles.settingItem}>
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
    }

    return (
      <SettingItemComponent
        key={item.id}
        item={item}
        icon={itemIcon}
        colors={colors}
        styles={styles}
        onPress={(itemId) => {
          if (item.type === 'submenu') {
            setShowSubmenu(itemId);
          }
        }}
        onValueChange={(itemId, value) => {
          // Value change is handled by item.onValueChange in SettingItem component
        }}
      />
    );
  };

  const toggleSection = (sectionTitle: string) => {
    const newExpandedSections = toggleSectionExpansion(sectionTitle, expandedSections);
    setExpandedSections(newExpandedSections);
  };

  const displaySections = useMemo(() => {
    if (searchTerm.trim()) {
      return filteredSections;
    }
    return filteredSections.map(section => ({
      ...section,
      data: expandedSections.has(section.title) ? section.data : [],
    }));
  }, [filteredSections, expandedSections, searchTerm]);

  const pinModalTitle = pinModalMode === 'unlock'
    ? t('Enter PIN', { _tags: tags })
    : (pinModalMode === 'setup' ? t('Set PIN', { _tags: tags }) : t('Confirm PIN', { _tags: tags }));
  const pinModalDescription = pinModalMode === 'unlock'
    ? t('Enter your PIN to unlock passwords.', { _tags: tags })
    : (pinModalMode === 'setup'
      ? t('Create a 4+ digit PIN to protect passwords.', { _tags: tags })
      : t('Re-enter your PIN to confirm.', { _tags: tags }));
  const pinModalActionLabel = pinModalMode === 'unlock'
    ? t('Unlock', { _tags: tags })
    : (pinModalMode === 'setup' ? t('Next', { _tags: tags }) : t('Save', { _tags: tags }));
  // App lock modal now handled by SecuritySection component

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('Settings', { _tags: tags })}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>{t('Done', { _tags: tags })}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder={t('Search settings...', { _tags: tags })}
            placeholderTextColor="#888"
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
          {searchTerm.length > 0 && (
            <TouchableOpacity onPress={() => setSearchTerm('')}>
              <Text style={styles.clearSearch}>{t('Clear', { _tags: tags })}</Text>
            </TouchableOpacity>
          )}
        </View>

        <SectionList
          ref={sectionListRef as any}
          sections={displaySections as any}
          keyExtractor={(item) => item.id}
          renderItem={({ item, section }) => renderSettingItem(item, section.title)}
          renderSectionHeader={({ section: { id, title } }) => {
            const iconInfo = getSectionIcon(id);
            return (
              <SettingsSectionHeader
                title={title}
                icon={iconInfo}
                isExpanded={expandedSections.has(title)}
                onToggle={() => toggleSection(title)}
                colors={colors}
                styles={styles}
              />
            );
          }}
          style={styles.list}
          contentContainerStyle={styles.listContent}
        />

        {/* Submenu Modal */}
        <Modal
          visible={showSubmenu !== null}
          transparent
          animationType="slide"
          onRequestClose={() => setShowSubmenu(null)}>
          <View style={styles.submenuOverlay}>
            <View style={styles.submenuContainer}>
              <View style={styles.submenuHeader}>
                <Text style={styles.submenuTitle}>
                  {(orderedSections as any)
                    .flatMap((s: any) => s.data as SettingItem[])
                    .find((item: SettingItem) => item.id === showSubmenu)?.title || t('Options', { _tags: tags })}
                </Text>
                <TouchableOpacity onPress={() => setShowSubmenu(null)}>
                  <Text style={styles.closeButtonText}>{t('Close', { _tags: tags })}</Text>
                </TouchableOpacity>
              </View>
              <ScrollView>
                {(orderedSections as any)
                  .flatMap((s: any) => s.data as SettingItem[])
                  .find((item: SettingItem) => item.id === showSubmenu)
                  ?.submenuItems?.map((subItem: SettingItem) => {
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
                            value={subItem.value as boolean}
                            onValueChange={(value) => {
                              subItem.onValueChange?.(value);
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
                              style={[
                                styles.submenuInput,
                                subItem.disabled && styles.disabledInput,
                                { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border },
                              ]}
                              value={subItem.value as string}
                              onChangeText={(text) => subItem.onValueChange?.(text)}
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
                    return (
                      <TouchableOpacity
                        key={subItem.id}
                        style={styles.submenuItem}
                        onPress={() => {
                          subItem.onPress?.();
                          if (subItem.type !== 'switch' && subItem.type !== 'input') {
                            setShowSubmenu(null);
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
                  })}
              </ScrollView>
            </View>
          </View>
        </Modal>
        <Modal
          visible={pinModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => closePinModal(false)}>
          <View style={styles.submenuOverlay}>
            <View style={[styles.submenuContainer, { maxHeight: '60%' }]}>
              <View style={styles.submenuHeader}>
                <Text style={styles.submenuTitle}>{pinModalTitle}</Text>
                <TouchableOpacity onPress={() => closePinModal(false)}>
                  <Text style={styles.closeButtonText}>{t('Close', { _tags: tags })}</Text>
                </TouchableOpacity>
              </View>
              <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                <Text style={styles.submenuItemDescription}>{pinModalDescription}</Text>
                <TextInput
                  style={[
                    styles.submenuInput,
                    { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border },
                  ]}
                  value={pinEntry}
                  onChangeText={(text) => {
                    const sanitized = text.replace(/[^0-9]/g, '');
                    setPinEntry(sanitized);
                    if (pinError) setPinError('');
                  }}
                  placeholder={t('PIN', { _tags: tags })}
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                  secureTextEntry
                />
                {!!pinError && (
                  <Text style={[styles.submenuItemDescription, { color: colors.error }]}>{pinError}</Text>
                )}
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, padding: 16, paddingTop: 0 }}>
                <TouchableOpacity onPress={() => closePinModal(false)}>
                  <Text style={styles.closeButtonText}>{t('Cancel', { _tags: tags })}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handlePinSubmit}>
                  <Text style={[styles.closeButtonText, { color: colors.primary }]}>{pinModalActionLabel}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
        {/* App lock modal now handled by SecuritySection component */}
        <Modal
          visible={showBackupModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowBackupModal(false)}>
          <View style={styles.submenuOverlay}>
            <View style={[styles.submenuContainer, { maxHeight: '80%' }]}>
              <View style={styles.submenuHeader}>
                <Text style={styles.submenuTitle}>{t('Backup / Restore', { _tags: tags })}</Text>
                <TouchableOpacity onPress={() => setShowBackupModal(false)}>
                  <Text style={styles.closeButtonText}>{t('Close', { _tags: tags })}</Text>
                </TouchableOpacity>
              </View>
              <ScrollView>
                <Text style={styles.submenuItemDescription}>
                  {t('Copy this JSON to back up. To restore, paste backup JSON and tap Restore.', { _tags: tags })}
                </Text>
                <TextInput
                  style={[styles.submenuInput, { minHeight: 200, textAlignVertical: 'top', backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                  multiline
                  value={backupData}
                  onChangeText={setBackupData}
                  placeholder={t('Backup JSON appears here', { _tags: tags })}
                  placeholderTextColor={colors.textSecondary}
                />
              </ScrollView>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
                <TouchableOpacity onPress={() => setShowBackupModal(false)}>
                  <Text style={styles.closeButtonText}>{t('Cancel', { _tags: tags })}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleBackupCopyToClipboard}>
                  <Text style={[styles.closeButtonText, { color: colors.primary }]}>{t('Copy to Clipboard', { _tags: tags })}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleBackupSaveToFile}>
                  <Text style={[styles.closeButtonText, { color: colors.primary }]}>{t('Save to File', { _tags: tags })}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleBackupImport}>
                  <Text style={styles.closeButtonText}>{t('Restore', { _tags: tags })}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
        <Modal
          visible={showChannelNotifModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowChannelNotifModal(false)}>
          <View style={styles.submenuOverlay}>
            <View style={[styles.submenuContainer, { maxHeight: '80%' }]}>
              <View style={styles.submenuHeader}>
                <Text style={styles.submenuTitle}>{t('Per-Channel Notifications', { _tags: tags })}</Text>
                <TouchableOpacity onPress={() => setShowChannelNotifModal(false)}>
                  <Text style={styles.closeButtonText}>{t('Close', { _tags: tags })}</Text>
                </TouchableOpacity>
              </View>
              <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                <Text style={styles.submenuItemDescription}>
                  {t('Add a channel to override global notification settings.', { _tags: tags })}
                </Text>
                <TextInput
                  style={[
                    styles.submenuInput,
                    { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border },
                  ]}
                  placeholder={t('#channel', { _tags: tags })}
                  placeholderTextColor={colors.textSecondary}
                  value={newChannelNotif}
                  onChangeText={setNewChannelNotif}
                  autoCapitalize="none"
                />
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
                  <TouchableOpacity
                    onPress={async () => {
                      const chan = newChannelNotif.trim();
                      if (!chan) return;
                      await notificationService.updateChannelPreferences(chan, {
                        enabled: true,
                        notifyOnMentions: true,
                        notifyOnPrivateMessages: false,
                        notifyOnAllMessages: false,
                        doNotDisturb: false,
                      });
                      setNewChannelNotif('');
                      refreshChannelNotifList();
                    }}>
                    <Text style={styles.closeButtonText}>{t('Add', { _tags: tags })}</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <ScrollView>
                {channelNotifList.map(({ channel, prefs }) => (
                  <View key={channel} style={styles.submenuItem}>
                    <View style={styles.submenuItemContent}>
                      <Text style={styles.submenuItemText}>{channel}</Text>
                      <Text style={styles.submenuItemDescription}>
                        {prefs.notifyOnAllMessages
                          ? t('All messages', { _tags: tags })
                          : t('Mentions only', { _tags: tags })}
                        {prefs.doNotDisturb ? t(' • DND', { _tags: tags }) : ''}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={styles.submenuItemDescription}>{t('All', { _tags: tags })}</Text>
                        <Switch
                          value={prefs.notifyOnAllMessages}
                          onValueChange={async (v) => {
                            await notificationService.updateChannelPreferences(channel, { notifyOnAllMessages: v });
                            refreshChannelNotifList();
                          }}
                        />
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={styles.submenuItemDescription}>{t('Mentions', { _tags: tags })}</Text>
                        <Switch
                          value={prefs.notifyOnMentions}
                          onValueChange={async (v) => {
                            await notificationService.updateChannelPreferences(channel, { notifyOnMentions: v });
                            refreshChannelNotifList();
                          }}
                        />
                      </View>
                      <TouchableOpacity
                        onPress={async () => {
                          await notificationService.removeChannelPreferences(channel);
                          refreshChannelNotifList();
                        }}>
                        <Text style={[styles.identityDeleteText, { marginTop: 4 }]}>{t('Delete', { _tags: tags })}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
                {channelNotifList.length === 0 && (
                  <Text style={styles.identityEmpty}>{t('No channel overrides set.', { _tags: tags })}</Text>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
      <ThemeEditorScreen
        visible={showThemeEditor}
        theme={editingTheme}
        onClose={() => {
          setShowThemeEditor(false);
          setEditingTheme(undefined);
        }}
        onSave={() => {
          refreshThemes();
          setShowThemeEditor(false);
          setEditingTheme(undefined);
        }}
      />
      {showConnectionProfiles && (
        <ConnectionProfilesScreen
          visible={showConnectionProfiles}
          onClose={() => setShowConnectionProfiles(false)}
        />
      )}
      {showScripting && (
        <ScriptingScreen
          visible={showScripting}
          onClose={() => setShowScripting(false)}
          onShowPurchaseScreen={() => {
            setShowScripting(false);
            onShowPurchaseScreen?.();
          }}
        />
      )}
      {showScriptingHelp && (
        <Modal visible={showScriptingHelp} animationType="slide" onRequestClose={() => setShowScriptingHelp(false)}>
          <ScriptingHelpScreen visible={showScriptingHelp} onClose={() => setShowScriptingHelp(false)} />
        </Modal>
      )}
      <AboutScreen
        visible={showAbout}
        onClose={() => setShowAbout(false)}
      />
      <CreditsScreen
        visible={showCredits}
        onClose={() => setShowCredits(false)}
      />
      <PrivacyAdsScreen
        visible={showPrivacyAds}
        onClose={() => setShowPrivacyAds(false)}
      />
      <DataPrivacyScreen
        visible={showDataPrivacy}
        onClose={() => setShowDataPrivacy(false)}
      />
      <BackupScreen
        visible={showBackupScreen}
        onClose={() => setShowBackupScreen(false)}
      />
      <KeyManagementScreen
        visible={showKeyManagement}
        onClose={() => setShowKeyManagement(false)}
      />
      <ZncSubscriptionScreen
        visible={showZncSubscription}
        onClose={() => setShowZncSubscription(false)}
      />

      <Modal
        visible={showMigrationDialog}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMigrationDialog(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.migrationDialog}>
            <Text style={styles.migrationDialogTitle}>
              {t('Migrate Old Keys', { _tags: tags })}
            </Text>
            <Text style={styles.migrationDialogDescription}>
              {t('Select the network to migrate your old nick-only encryption keys to:', { _tags: tags })}
            </Text>

            <ScrollView style={styles.networkList}>
              {connectionManager.getAllConnections().map((conn) => (
                <TouchableOpacity
                  key={conn.networkId}
                  style={[
                    styles.networkItem,
                    migrationNetwork === conn.networkId && styles.networkItemSelected,
                  ]}
                  onPress={() => setMigrationNetwork(conn.networkId)}>
                  <Text
                    style={[
                      styles.networkItemText,
                      migrationNetwork === conn.networkId && styles.networkItemTextSelected,
                    ]}>
                    {conn.networkId}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.migrationDialogButtons}>
              <TouchableOpacity
                style={[styles.migrationDialogButton, styles.migrationDialogButtonCancel]}
                onPress={() => {
                  setShowMigrationDialog(false);
                  setMigrationNetwork('');
                }}>
                <Text style={styles.migrationDialogButtonText}>
                  {t('Cancel', { _tags: tags })}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.migrationDialogButton,
                  styles.migrationDialogButtonMigrate,
                  !migrationNetwork && styles.migrationDialogButtonDisabled,
                ]}
                onPress={handleMigration}
                disabled={!migrationNetwork}>
                <Text style={[
                  styles.migrationDialogButtonText,
                  styles.migrationDialogButtonTextMigrate,
                ]}>
                  {t('Migrate', { _tags: tags })}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* First Run Setup Modal */}
      {showFirstRunSetup && (
        <Modal
          visible={showFirstRunSetup}
          animationType="slide"
          onRequestClose={() => setShowFirstRunSetup(false)}>
          <FirstRunSetupScreen
            onComplete={async (networkConfig) => {
              console.log('First run setup completed from settings');
              setShowFirstRunSetup(false);
              onClose(); // Close settings screen
            }}
            onSkip={() => setShowFirstRunSetup(false)}
          />
        </Modal>
      )}
    </Modal>
  );
};

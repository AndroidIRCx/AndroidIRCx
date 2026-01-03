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
import { channelFavoritesService, ChannelFavorite } from '../services/ChannelFavoritesService';
import { autoRejoinService } from '../services/AutoRejoinService';
import { autoVoiceService, AutoVoiceConfig } from '../services/AutoVoiceService';
import { connectionProfilesService } from '../services/ConnectionProfilesService';
import { ConnectionProfilesScreen } from './ConnectionProfilesScreen';
import { settingsService, IRCNetworkConfig, DEFAULT_PART_MESSAGE, DEFAULT_QUIT_MESSAGE } from '../services/SettingsService';
import { AboutScreen } from './AboutScreen';
import { autoReconnectService, AutoReconnectConfig } from '../services/AutoReconnectService';
import { connectionQualityService, RateLimitConfig, FloodProtectionConfig, LagMonitoringConfig } from '../services/ConnectionQualityService';
import { bouncerService, BouncerConfig } from '../services/BouncerService';
import { layoutService, LayoutConfig, ViewMode, FontSize } from '../services/LayoutService';
import { commandService, CommandAlias, CommandHistoryEntry, CustomCommand } from '../services/CommandService';
import { performanceService, PerformanceConfig } from '../services/PerformanceService';
import { highlightService } from '../services/HighlightService';
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
import { KeyManagementScreen } from './KeyManagementScreen';
import { FirstRunSetupScreen } from './FirstRunSetupScreen';
import { PrivacyAdsScreen } from './PrivacyAdsScreen';
import { DataPrivacyScreen } from './DataPrivacyScreen';
import { userManagementService, UserNote, UserAlias } from '../services/UserManagementService';
import { RawMessageCategory, RAW_MESSAGE_CATEGORIES, getDefaultRawCategoryVisibility } from '../services/IRCService';
import { applyTransifexLocale, useT } from '../i18n/transifex';
import { SUPPORTED_LOCALES } from '../i18n/config';
import consoleManager from '../utils/consoleManager';

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
  onShowIgnoreList?: () => void;
  onShowPurchaseScreen?: () => void;
}

interface SettingItem {
  id: string;
  title: string;
  description?: string;
  type: 'switch' | 'button' | 'input' | 'submenu';
  value?: boolean | string;
  onPress?: () => void;
  onValueChange?: (value: boolean | string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'email-address';
  disabled?: boolean;
  submenuItems?: SettingItem[];
  secureTextEntry?: boolean;
  icon?: string;
}

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
  onShowIgnoreList,
  onShowPurchaseScreen,
}) => {
  const t = useT();
  const { theme, colors } = useTheme();
  const styles = useMemo(() => createStyles(colors, theme), [colors, theme]);
  const tags = 'screen:settings,file:SettingsScreen.tsx,feature:settings';
  const settingIcons = useMemo(
    () => ({
      'display-theme': { name: 'palette', solid: true },
      'app-language': { name: 'globe', solid: false },
      'connection-global-proxy': { name: 'network-wired', solid: false },
      'connection-auto-reconnect': { name: 'sync-alt', solid: false },
      'connection-quality': { name: 'signal', solid: false },
      'notifications-enabled': { name: 'bell', solid: false },
      'notifications-per-channel': { name: 'bullhorn', solid: false },
      'security-app-lock': { name: 'lock', solid: true },
      'security-manage-keys': { name: 'key', solid: true },
      'history-backup': { name: 'save', solid: false },
      'history-export': { name: 'file-export', solid: false },
      'identity-profiles': { name: 'user', solid: false },
      'about-app': { name: 'info-circle', solid: false },
    }),
    []
  );
  const aboutTitle = t('About', { _tags: tags });
  const premiumTitle = t('💎 Premium', { _tags: tags });
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
  const [notificationPrefs, setNotificationPrefs] = useState(notificationService.getPreferences());
  const [backgroundEnabled, setBackgroundEnabled] = useState(backgroundService.isBackgroundConnectionEnabled());
  const [batteryOptEnabledStatus, setBatteryOptEnabledStatus] = useState(false); // New state variable
  const [localShowRawCommands, setLocalShowRawCommands] = useState(showRawCommands);
  const [localRawCategoryVisibility, setLocalRawCategoryVisibility] = useState<Record<RawMessageCategory, boolean>>(getDefaultRawCategoryVisibility());
  const [historyStats, setHistoryStats] = useState<any>(null);
  const [exportFormat, setExportFormat] = useState<'json' | 'txt' | 'csv'>('json');
  const [showSubmenu, setShowSubmenu] = useState<string | null>(null);
  const [currentTheme, setCurrentTheme] = useState<Theme>(themeService.getCurrentTheme());
  const [availableThemes, setAvailableThemes] = useState<Theme[]>(themeService.getAvailableThemes());
  const [showThemeEditor, setShowThemeEditor] = useState(false);
  const [editingTheme, setEditingTheme] = useState<Theme | undefined>(undefined);
  const [autoRejoinEnabled, setAutoRejoinEnabled] = useState(false);
  const [autoVoiceConfig, setAutoVoiceConfig] = useState<AutoVoiceConfig | null>(null);
  const [showConnectionProfiles, setShowConnectionProfiles] = useState(false);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [allFavorites, setAllFavorites] = useState<ChannelFavorite[]>([]);
  const [networks, setNetworks] = useState<IRCNetworkConfig[]>([]);
  const [autoReconnectConfig, setAutoReconnectConfig] = useState<AutoReconnectConfig | null>(null);
  const [rateLimitConfig, setRateLimitConfig] = useState<RateLimitConfig | null>(null);
  const [floodProtectionConfig, setFloodProtectionConfig] = useState<FloodProtectionConfig | null>(null);
  const [lagMonitoringConfig, setLagMonitoringConfig] = useState<LagMonitoringConfig | null>(null);
  const [connectionStats, setConnectionStats] = useState<any>(null);
  const [bouncerConfig, setBouncerConfig] = useState<BouncerConfig | null>(null);
  const [bouncerInfo, setBouncerInfo] = useState<any>(null);
  const [layoutConfig, setLayoutConfig] = useState<LayoutConfig | null>(null);
  const [commandAliases, setCommandAliases] = useState<CommandAlias[]>([]);
  const [customCommands, setCustomCommands] = useState<CustomCommand[]>([]);
  const [commandHistory, setCommandHistory] = useState<CommandHistoryEntry[]>([]);
  const [newAliasName, setNewAliasName] = useState('');
  const [newAliasCommand, setNewAliasCommand] = useState('');
  const [newCmdName, setNewCmdName] = useState('');
  const [newCmdCommand, setNewCmdCommand] = useState('');
  const [performanceConfig, setPerformanceConfig] = useState<PerformanceConfig | null>(null);
  const [highlightWords, setHighlightWords] = useState<string[]>([]);
  const [newHighlightWord, setNewHighlightWord] = useState('');
  const [showAbout, setShowAbout] = useState(false);
  const [showPrivacyAds, setShowPrivacyAds] = useState(false);
  const [showDataPrivacy, setShowDataPrivacy] = useState(false);
  const [backupData, setBackupData] = useState('');
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showBackupScreen, setShowBackupScreen] = useState(false);
  const [showKeyManagement, setShowKeyManagement] = useState(false);
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
  const [autoConnectFavoriteServer, setAutoConnectFavoriteServer] = useState(false);
  const [showFirstRunSetup, setShowFirstRunSetup] = useState(false);
  const [tabSortAlphabetical, setTabSortAlphabetical] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [autoJoinFavoritesEnabled, setAutoJoinFavoritesEnabled] = useState(true);
  const [showEncryptionIndicatorsSetting, setShowEncryptionIndicatorsSetting] = useState(showEncryptionIndicators);
  const [appLanguage, setAppLanguage] = useState<string>('system');
  const [userNotes, setUserNotes] = useState<UserNote[]>([]);
  const [userAliases, setUserAliases] = useState<UserAlias[]>([]);
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
  const [allowQrVerification, setAllowQrVerification] = useState(true);
  const [allowFileExchange, setAllowFileExchange] = useState(true);
  const [allowNfcExchange, setAllowNfcExchange] = useState(true);
  const [appLockEnabled, setAppLockEnabled] = useState(false);
  const [appLockUseBiometric, setAppLockUseBiometric] = useState(false);
  const [appLockUsePin, setAppLockUsePin] = useState(false);
  const [appLockOnLaunch, setAppLockOnLaunch] = useState(true);
  const [appLockOnBackground, setAppLockOnBackground] = useState(true);
  const [appPinModalVisible, setAppPinModalVisible] = useState(false);
  const [isSupporter, setIsSupporter] = useState(false);
  const [appPinModalMode, setAppPinModalMode] = useState<'setup' | 'confirm'>('setup');
  const [appPinEntry, setAppPinEntry] = useState('');
  const [appPinSetupValue, setAppPinSetupValue] = useState('');
  const [appPinError, setAppPinError] = useState('');
  const appPinResolveRef = useRef<((ok: boolean) => void) | null>(null);
  const APP_PIN_STORAGE_KEY = '@AndroidIRCX:app-lock-pin';
  const [consoleEnabled, setConsoleEnabled] = useState(__DEV__ ? consoleManager.getEnabled() : false);

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


  const refreshChannelNotifList = useCallback(() => {
    setChannelNotifList(notificationService.listChannelPreferences());
  }, []);
  const [dccMinPort, setDccMinPort] = useState(5000);
  const [dccMaxPort, setDccMaxPort] = useState(6000);
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
  const [ircServices, setIrcServices] = useState<string[]>([]);
  const [newIrcService, setNewIrcService] = useState('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['About', 'Scripting & Ads']));
  const [lagCheckMethod, setLagCheckMethod] = useState<'ctcp' | 'server'>('server');
  const sectionListRef = useRef<SectionList>(null);
  const dccSubmenuItems = useMemo<SettingItem[]>(() => ([
    {
      id: 'dcc-min-port',
      title: t('Min Port', { _tags: tags }),
      type: 'input',
      value: dccMinPort.toString(),
      keyboardType: 'numeric',
      onValueChange: async (value: string) => {
        const v = parseInt(value, 10);
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
      onValueChange: async (value: string) => {
        const v = parseInt(value, 10);
        if (!isNaN(v)) {
          setDccMaxPort(v);
          await settingsService.setSetting('dccPortRange', { min: dccMinPort, max: v });
        }
      },
    },
  ]), [dccMinPort, dccMaxPort]);

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
      setCurrentTheme(themeService.getCurrentTheme());
    setAvailableThemes(themeService.getAvailableThemes());
    loadChannelSettings();
    
    // Load highlight words
    setHighlightWords(highlightService.getHighlightWords());
      const unsubscribeHighlights = highlightService.onHighlightWordsChange(() => {
        setHighlightWords(highlightService.getHighlightWords());
      });

      // Update statistics periodically
      const statsInterval = setInterval(() => {
        setConnectionStats(connectionQualityService.getStatistics());
        setBouncerInfo(bouncerService.getBouncerInfo());
      }, 1000);
      
      return () => {
        clearInterval(statsInterval);
        unsubscribeHighlights();
      };
    }
  }, [visible, showRawCommands, showEncryptionIndicators, currentNetwork, rawCategoryVisibility]);

  useEffect(() => {
    const unsubscribe = themeService.onThemeChange(theme => {
      setCurrentTheme(theme);
      setAvailableThemes(themeService.getAvailableThemes());
    });
    return unsubscribe;
  }, []);

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
          setNotificationPrefs({ ...currentPrefs, enabled: false });
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
    const updateSupporterStatus = () => {
      setIsSupporter(inAppPurchaseService.isSupporter());
    };
    updateSupporterStatus();
    const unsubscribe = inAppPurchaseService.addListener(updateSupporterStatus);
    return unsubscribe;
  }, []);

  const loadSettings = async () => {
    const biometryType = await biometricAuthService.getBiometryType();
    const biometrySupported = Boolean(biometryType);
    setBiometricAvailable(biometrySupported);
    const lockSetting = await settingsService.getSetting('biometricPasswordLock', false);
    const pinSetting = await settingsService.getSetting('pinPasswordLock', false);
    const storedPin = await secureStorageService.getSecret(PIN_STORAGE_KEY);
    const allowQr = await settingsService.getSetting('securityAllowQrVerification', true);
    const allowFile = await settingsService.getSetting('securityAllowFileExchange', true);
    const allowNfc = await settingsService.getSetting('securityAllowNfcExchange', true);
    const appLockSetting = await settingsService.getSetting('appLockEnabled', false);
    const appLockBioSetting = await settingsService.getSetting('appLockUseBiometric', false);
    const appLockPinSetting = await settingsService.getSetting('appLockUsePin', false);
    const appLockLaunchSetting = await settingsService.getSetting('appLockOnLaunch', true);
    const appLockBackgroundSetting = await settingsService.getSetting('appLockOnBackground', true);
    const storedAppPin = await secureStorageService.getSecret(APP_PIN_STORAGE_KEY);
    const biometricEnabled = lockSetting && biometrySupported;
    let pinEnabled = pinSetting && Boolean(storedPin);
    let appPinEnabled = appLockPinSetting && Boolean(storedAppPin);
    let appBioEnabled = appLockBioSetting && biometrySupported;
    let appLockEnabledNext = appLockSetting;

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
    if (appLockBioSetting && !biometrySupported) {
      await settingsService.setSetting('appLockUseBiometric', false);
      appBioEnabled = false;
    }
    if (appLockPinSetting && !storedAppPin) {
      await settingsService.setSetting('appLockUsePin', false);
      appPinEnabled = false;
    }
    if (!appBioEnabled && !appPinEnabled) {
      appLockEnabledNext = false;
      if (appLockSetting) {
        await settingsService.setSetting('appLockEnabled', false);
      }
    }
    setAllowQrVerification(allowQr);
    setAllowFileExchange(allowFile);
    setAllowNfcExchange(allowNfc);
    setAppLockEnabled(appLockEnabledNext);
    setAppLockUseBiometric(appBioEnabled);
    setAppLockUsePin(appPinEnabled);
    setAppLockOnLaunch(appLockLaunchSetting);
    setAppLockOnBackground(appLockBackgroundSetting);
    setNotificationPrefs(notificationService.getPreferences());
    setBackgroundEnabled(backgroundService.isBackgroundConnectionEnabled());
    setBatteryOptEnabledStatus(await backgroundService.isBatteryOptimizationEnabled()); // Load status
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
    setAppLanguage(await settingsService.getSetting('appLanguage', 'system'));
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
    setIrcServices(await settingsService.getSetting('ircServices', ['nickserv', 'chanserv', 'memoserv', 'operserv', 'hostserv', 'botserv']));
    setNoticeTarget(await settingsService.getSetting('noticeTarget', 'server'));
    setLagCheckMethod(await settingsService.getSetting('lagCheckMethod', 'server'));
    setAutoJoinFavoritesEnabled(await settingsService.getSetting('autoJoinFavorites', true));
    setUserNotes(userManagementService.getUserNotes(currentNetwork));
    setUserAliases(userManagementService.getUserAliases(currentNetwork));
  };

  const loadHistoryStats = async () => {
    if (currentNetwork) {
      const stats = await messageHistoryService.getStats(currentNetwork);
      setHistoryStats(stats);
    }
  };

  const loadChannelSettings = async () => {
    const networksList = await settingsService.loadNetworks();
    setNetworks(networksList);

    if (currentNetwork) {
      setAutoRejoinEnabled(autoRejoinService.isEnabled(currentNetwork));
      const config = autoVoiceService.getConfig(currentNetwork);
      setAutoVoiceConfig(config || null);
      let reconnectConfig = autoReconnectService.getConfig(currentNetwork);
      if (!reconnectConfig) {
        reconnectConfig = { enabled: true, maxAttempts: 10, initialDelay: 1000, maxDelay: 60000, backoffMultiplier: 2, rejoinChannels: true, smartReconnect: true };
        autoReconnectService.setConfig(currentNetwork, reconnectConfig);
      }
      setAutoReconnectConfig(reconnectConfig);
    }
    // Load connection quality settings (global, not per-network)
    setRateLimitConfig(connectionQualityService.getRateLimitConfig());
    setFloodProtectionConfig(connectionQualityService.getFloodProtectionConfig());
    setLagMonitoringConfig(connectionQualityService.getLagMonitoringConfig());
    setConnectionStats(connectionQualityService.getStatistics());
    // Load bouncer settings
    setBouncerConfig(bouncerService.getConfig());
    setBouncerInfo(bouncerService.getBouncerInfo());
    // Load layout settings
    setLayoutConfig(layoutService.getConfig());
    // Load command settings
    setCommandAliases(commandService.getAliases());
    setCustomCommands(commandService.getCustomCommands());
    setCommandHistory(commandService.getHistory(20)); // Last 20 commands
    // Load performance settings
    setPerformanceConfig(performanceService.getConfig());
    // Storage stats
    dataBackupService.getStorageStats().then(setStorageStats).catch(() => {});
    // Identities
    identityProfilesService.list().then(setIdentityProfiles).catch(() => {});
    // Channel favorites across networks
    refreshFavorites();
    // DCC
    const dccRange = await settingsService.getSetting('dccPortRange', { min: 5000, max: 6000 });
    setDccMinPort(dccRange.min || 5000);
    setDccMaxPort(dccRange.max || 6000);
  };

  const buildGlobalProxyConfig = (overrides?: Partial<{ enabled: boolean; type: string; host: string; port: string; username: string; password: string; }>) => {
    const enabled = overrides?.enabled ?? globalProxyEnabled;
    const type = overrides?.type ?? globalProxyType;
    const host = overrides?.host ?? globalProxyHost;
    const portStr = overrides?.port ?? globalProxyPort;
    const username = overrides?.username ?? globalProxyUsername;
    const password = overrides?.password ?? globalProxyPassword;
    return {
      enabled,
      type: (type || 'socks5') as any,
      host: host.trim() || undefined,
      port: portStr ? parseInt(portStr, 10) : undefined,
      username: username.trim() || undefined,
      password: password.trim() || undefined,
    };
  };

  const persistGlobalProxy = async (overrides?: Partial<{ enabled: boolean; type: string; host: string; port: string; username: string; password: string; }>) => {
    const cfg = buildGlobalProxyConfig(overrides);
    await settingsService.setSetting('globalProxy', cfg);
  };

  const handleNotificationChange = async (key: keyof typeof notificationPrefs, value: boolean) => {
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

    const updated = { ...notificationPrefs, [key]: value };
    await notificationService.updatePreferences(updated);
    setNotificationPrefs(updated);
  };

  const handleBackgroundConnectionChange = (value: boolean) => {
    backgroundService.setBackgroundConnectionEnabled(value);
    setBackgroundEnabled(value);
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

  const handleBatteryOptimization = async () => {
    await backgroundService.openBatteryOptimizationSettings();
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
  }, [APP_PIN_STORAGE_KEY, appPinEntry, appPinModalMode, appPinSetupValue, closeAppPinModal, t]);

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
      if (!biometricAvailable) {
        Alert.alert(
          t('Biometrics unavailable', { _tags: tags }),
          t('Enable a fingerprint/biometric on your device first.', { _tags: tags })
        );
        return;
      }
      const enabled = await biometricAuthService.enableLock('app');
      if (!enabled) {
        Alert.alert(
          t('Biometric setup failed', { _tags: tags }),
          t('Unable to enable biometric app lock.', { _tags: tags })
        );
        return;
      }
      await settingsService.setSetting('appLockUseBiometric', true);
      await settingsService.setSetting('appLockEnabled', true);
      setAppLockUseBiometric(true);
      setAppLockEnabled(true);
      return;
    }
    await biometricAuthService.disableLock('app');
    await settingsService.setSetting('appLockUseBiometric', false);
    setAppLockUseBiometric(false);
    if (!appLockUsePin) {
      await settingsService.setSetting('appLockEnabled', false);
      setAppLockEnabled(false);
    }
  };

  const handleAppLockPinToggle = async (value: boolean) => {
    if (value) {
      await requestAppPinSetup();
      return;
    }
    await secureStorageService.removeSecret(APP_PIN_STORAGE_KEY);
    await settingsService.setSetting('appLockUsePin', false);
    setAppLockUsePin(false);
    if (!appLockUseBiometric) {
      await settingsService.setSetting('appLockEnabled', false);
      setAppLockEnabled(false);
    }
  };

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

  // Icon mapping for section headers and items
  const getSectionIcon = (title: string): { name: string; solid?: boolean } | null => {
    const iconMap: Record<string, { name: string; solid?: boolean } | null> = {
      'Appearance': { name: 'palette', solid: true },
      'Display & UI': { name: 'desktop', solid: false },
      'Notifications': { name: 'bell', solid: true },
      'Background Service': { name: 'circle', solid: false },
      'Message History': { name: 'history', solid: false },
      'Connectivity': { name: 'wifi', solid: false },
      'Connection Quality': { name: 'signal', solid: false },
      'Connection Profiles': { name: 'network-wired', solid: false },
      'Auto-Reconnect': { name: 'sync', solid: false },
      'Bouncer': { name: 'server', solid: false },
      'Performance': { name: 'tachometer-alt', solid: false },
      'Backup & Restore': { name: 'database', solid: false },
      'Channels': { name: 'hashtag', solid: false },
      'DCC': { name: 'exchange-alt', solid: false },
      'Commands': { name: 'terminal', solid: false },
      'Highlights': { name: 'highlighter', solid: false },
      'Identity Profiles': { name: 'id-card', solid: true },
      'Security': { name: 'shield-alt', solid: true },
      'Encrypted Direct Messages': { name: 'lock', solid: true },
      'Privacy & Legal': { name: 'user-shield', solid: true },
      'Scripting': { name: 'code', solid: false },
      'Scripting & Ads': { name: 'code', solid: false },
      'User Management': { name: 'users', solid: false },
      'Advanced': { name: 'cogs', solid: false },
      'Development': { name: 'bug', solid: true },
      [premiumTitle]: null,
      [aboutTitle]: { name: 'info-circle', solid: true },
    };
    if (Object.prototype.hasOwnProperty.call(iconMap, title)) {
      return iconMap[title];
    }
    return { name: 'cog', solid: false };
  };

  const sections = [
    {
      title: premiumTitle,
      data: [
        {
          id: 'premium-upgrade',
          title: t('Upgrade to Premium', { _tags: tags }),
          description: t('Remove ads, unlimited scripting, and more', { _tags: tags }),
          type: 'button' as const,
          icon: { name: 'crown', solid: true },
          onPress: () => onShowPurchaseScreen?.(),
        },
      ],
    },
    {
      title: t('Appearance', { _tags: tags }),
      data: [
        {
          id: 'display-theme',
          title: t('Theme', { _tags: tags }),
          description: currentTheme.name,
          type: 'submenu' as const,
          submenuItems: [
            ...availableThemes.map(theme => ({
              id: `theme-${theme.id}`,
              title: theme.name,
              description: theme.isCustom
                ? t('Custom theme', { _tags: tags })
                : theme.id === 'dark'
                  ? t('Dark mode (default)', { _tags: tags })
                  : t('Light mode', { _tags: tags }),
              type: 'button' as const,
              onPress: async () => {
                await themeService.setTheme(theme.id);
                setCurrentTheme(theme);
              },
            })),
            {
              id: 'theme-new',
              title: t('+ Create New Theme', { _tags: tags }),
              type: 'button' as const,
              onPress: () => {
                setEditingTheme(undefined);
                setShowThemeEditor(true);
              },
            },
            ...availableThemes.filter(t => t.isCustom).map(theme => ({
              id: `theme-edit-${theme.id}`,
              title: t('Edit {name}', { name: theme.name, _tags: tags }),
              type: 'button' as const,
              onPress: () => {
                setEditingTheme(theme);
                setShowThemeEditor(true);
              },
            })),
            ...availableThemes.filter(t => t.isCustom).map(theme => ({
              id: `theme-delete-${theme.id}`,
              title: t('Delete {name}', { name: theme.name, _tags: tags }),
              type: 'button' as const,
              onPress: () => {
                Alert.alert(
                  t('Delete Theme', { _tags: tags }),
                  t('Are you sure you want to delete "{name}"?', { name: theme.name, _tags: tags }),
                  [
                    { text: t('Cancel', { _tags: tags }), style: 'cancel' },
                    {
                      text: t('Delete', { _tags: tags }),
                      style: 'destructive',
                      onPress: async () => {
                        await themeService.deleteCustomTheme(theme.id);
                        setAvailableThemes(themeService.getAvailableThemes());
                        setCurrentTheme(themeService.getCurrentTheme());
                      },
                    },
                  ]
                );
              },
            })),
          ],
        },
        {
          id: 'app-language',
          title: t('Language', { _tags: tags }),
          description:
            appLanguage === 'system'
              ? t('System Default', { _tags: tags })
              : languageLabels[appLanguage] || appLanguage,
          type: 'submenu' as const,
          submenuItems: [
            {
              id: 'language-system',
              title: t('System Default', { _tags: tags }),
              description: t('Use device language', { _tags: tags }),
              type: 'button' as const,
              onPress: async () => {
                await settingsService.setSetting('appLanguage', 'system');
                setAppLanguage('system');
                await applyTransifexLocale('system');
              },
            },
            ...SUPPORTED_LOCALES.map(locale => ({
              id: `language-${locale}`,
              title: languageLabels[locale] || locale,
              description: locale,
              type: 'button' as const,
              onPress: async () => {
                await settingsService.setSetting('appLanguage', locale);
                setAppLanguage(locale);
                await applyTransifexLocale(locale);
              },
            })),
          ],
        },
        {
          id: 'layout-tab-position',
          title: t('Tab Position', { _tags: tags }),
          description: t('Tabs at {position}', { position: layoutConfig?.tabPosition || 'top', _tags: tags }),
          type: 'button' as const,
          onPress: () => {
            Alert.alert(
              t('Tab Position', { _tags: tags }),
              t('Select tab position:', { _tags: tags }),
              [
                { text: t('Cancel', { _tags: tags }), style: 'cancel' },
                {
                  text: t('Top', { _tags: tags }),
                  onPress: async () => {
                    await layoutService.setTabPosition('top');
                    setLayoutConfig(layoutService.getConfig());
                  },
                },
                {
                  text: t('Bottom', { _tags: tags }),
                  onPress: async () => {
                    await layoutService.setTabPosition('bottom');
                    setLayoutConfig(layoutService.getConfig());
                  },
                },
                {
                  text: t('Left', { _tags: tags }),
                  onPress: async () => {
                    await layoutService.setTabPosition('left');
                    setLayoutConfig(layoutService.getConfig());
                  },
                },
                {
                  text: t('Right', { _tags: tags }),
                  onPress: async () => {
                    await layoutService.setTabPosition('right');
                    setLayoutConfig(layoutService.getConfig());
                  },
                },
              ]
            );
          },
        },
        {
          id: 'layout-userlist-position',
          title: t('User List Position', { _tags: tags }),
          description: t('User list at {position}', { position: layoutConfig?.userListPosition || 'right', _tags: tags }),
          type: 'button' as const,
          onPress: () => {
            Alert.alert(
              t('User List Position', { _tags: tags }),
              t('Select user list position:', { _tags: tags }),
              [
                { text: t('Cancel', { _tags: tags }), style: 'cancel' },
                {
                  text: t('Left', { _tags: tags }),
                  onPress: async () => {
                    await layoutService.setUserListPosition('left');
                    setLayoutConfig(layoutService.getConfig());
                  },
                },
                {
                  text: t('Right', { _tags: tags }),
                  onPress: async () => {
                    await layoutService.setUserListPosition('right');
                    setLayoutConfig(layoutService.getConfig());
                  },
                },
                {
                  text: t('Top', { _tags: tags }),
                  onPress: async () => {
                    await layoutService.setUserListPosition('top');
                    setLayoutConfig(layoutService.getConfig());
                  },
                },
                {
                  text: t('Bottom', { _tags: tags }),
                  onPress: async () => {
                    await layoutService.setUserListPosition('bottom');
                    setLayoutConfig(layoutService.getConfig());
                  },
                },
              ]
            );
          },
        },
        {
          id: 'layout-view-mode',
          title: t('View Mode', { _tags: tags }),
          description: t('Current: {mode}', { mode: layoutConfig?.viewMode || 'comfortable', _tags: tags }),
          type: 'button' as const,
          onPress: () => {
            Alert.alert(
              t('View Mode', { _tags: tags }),
              t('Select view mode:', { _tags: tags }),
              [
                { text: t('Cancel', { _tags: tags }), style: 'cancel' },
                {
                  text: t('Compact', { _tags: tags }),
                  onPress: async () => {
                    await layoutService.setViewMode('compact');
                    setLayoutConfig(layoutService.getConfig());
                  },
                },
                {
                  text: t('Comfortable', { _tags: tags }),
                  onPress: async () => {
                    await layoutService.setViewMode('comfortable');
                    setLayoutConfig(layoutService.getConfig());
                  },
                },
                {
                  text: t('Spacious', { _tags: tags }),
                  onPress: async () => {
                    await layoutService.setViewMode('spacious');
                    setLayoutConfig(layoutService.getConfig());
                  },
                },
              ]
            );
          },
        },
        {
          id: 'layout-font-size',
          title: t('Font Size', { _tags: tags }),
          description: t('Current: {size}', { size: layoutConfig?.fontSize || 'medium', _tags: tags }),
          type: 'button' as const,
          onPress: () => {
            Alert.alert(
              t('Font Size', { _tags: tags }),
              t('Select font size:', { _tags: tags }),
              [
                { text: t('Cancel', { _tags: tags }), style: 'cancel' },
                {
                  text: t('Small', { _tags: tags }),
                  onPress: async () => {
                    await layoutService.setFontSize('small');
                    setLayoutConfig(layoutService.getConfig());
                  },
                },
                {
                  text: t('Medium', { _tags: tags }),
                  onPress: async () => {
                    await layoutService.setFontSize('medium');
                    setLayoutConfig(layoutService.getConfig());
                  },
                },
                {
                  text: t('Large', { _tags: tags }),
                  onPress: async () => {
                    await layoutService.setFontSize('large');
                    setLayoutConfig(layoutService.getConfig());
                  },
                },
                {
                  text: t('Extra Large', { _tags: tags }),
                  onPress: async () => {
                    await layoutService.setFontSize('xlarge');
                    setLayoutConfig(layoutService.getConfig());
                  },
                },
              ]
            );
          },
        },
        {
          id: 'layout-message-spacing',
          title: t('Message Spacing', { _tags: tags }),
          description: `Spacing: ${layoutConfig?.messageSpacing || 4}px`,
          type: 'input' as const,
          value: layoutConfig?.messageSpacing?.toString() || '4',
          keyboardType: 'numeric',
          onValueChange: async (value: string) => {
            const spacing = parseInt(value, 10);
            if (!isNaN(spacing) && spacing >= 0 && spacing <= 20) {
              await layoutService.setMessageSpacing(spacing);
              setLayoutConfig(layoutService.getConfig());
            }
          },
        },
        {
          id: 'layout-message-padding',
          title: t('Message Padding', { _tags: tags }),
          description: `Padding: ${layoutConfig?.messagePadding || 8}px`,
          type: 'input' as const,
          value: layoutConfig?.messagePadding?.toString() || '8',
          keyboardType: 'numeric',
          onValueChange: async (value: string) => {
            const padding = parseInt(value, 10);
            if (!isNaN(padding) && padding >= 0 && padding <= 20) {
              await layoutService.setMessagePadding(padding);
              setLayoutConfig(layoutService.getConfig());
            }
          },
        },
        {
          id: 'layout-navigation-bar-offset',
          title: t('Navigation Bar Offset (Android)', { _tags: tags }),
          description: `Adjust for 3-button navigation: ${layoutConfig?.navigationBarOffset || 0}px`,
          type: 'input' as const,
          value: layoutConfig?.navigationBarOffset?.toString() || '0',
          keyboardType: 'numeric',
          onValueChange: async (value: string) => {
            const offset = parseInt(value, 10);
            if (!isNaN(offset) && offset >= 0 && offset <= 100) {
              await layoutService.setNavigationBarOffset(offset);
              setLayoutConfig(layoutService.getConfig());
            }
          },
        },
        {
          id: 'display-tab-sort',
          title: t('Sort Tabs Alphabetically', { _tags: tags }),
          description: tabSortAlphabetical ? 'Sorting tabs A→Z per network' : 'Keep tabs in join/open order',
          type: 'switch' as const,
          value: tabSortAlphabetical,
          onValueChange: async (value: boolean) => {
            setTabSortAlphabetical(value);
            await settingsService.setSetting('tabSortAlphabetical', value);
          },
        },
      ],
    },
    {
      title: t('Display & UI', { _tags: tags }),
      data: [
        {
          id: 'display-raw',
          title: t('Show Raw Commands', { _tags: tags }),
          description: t('Display raw IRC protocol messages', { _tags: tags }),
          type: 'switch' as const,
          value: localShowRawCommands,
          onValueChange: (value: boolean) => {
            setLocalShowRawCommands(value);
            if (value) {
              const normalized = {
                ...getDefaultRawCategoryVisibility(),
                ...localRawCategoryVisibility,
              };
              setLocalRawCategoryVisibility(normalized);
              onRawCategoryVisibilityChange?.(normalized);
            }
            onShowRawCommandsChange?.(value);
          },
        },
        {
          id: 'display-raw-categories',
          title: t('Raw Categories', { _tags: tags }),
          description: t('Choose which raw messages are shown', { _tags: tags }),
          type: 'submenu' as const,
          disabled: !localShowRawCommands,
          submenuItems: RAW_MESSAGE_CATEGORIES.map((category) => ({
            id: `raw-category-${category.id}`,
            title: category.title,
            description: category.description,
            type: 'switch' as const,
            value: localRawCategoryVisibility[category.id] !== false,
            onValueChange: (value: boolean) => {
              setLocalRawCategoryVisibility((prev) => {
                const updated = { ...prev, [category.id]: value };
                onRawCategoryVisibilityChange?.(updated);
                return updated;
              });
            },
          })),
        },
        {
          id: 'display-notices',
          title: t('Notice Routing', { _tags: tags }),
          description: (() => {
            switch (noticeTarget) {
              case 'active':
                return t('Show notices in the active tab', { _tags: tags });
              case 'notice':
                return t('Show notices in a Notices tab', { _tags: tags });
              case 'private':
                return t('Show notices in a private/query tab', { _tags: tags });
              default:
                return t('Show notices in the server tab', { _tags: tags });
            }
          })(),
          type: 'submenu' as const,
          submenuItems: [
            {
              id: 'notice-active',
              title: t('Active window', { _tags: tags }),
              type: 'button' as const,
              onPress: async () => {
                setNoticeTarget('active');
                await settingsService.setSetting('noticeTarget', 'active');
              },
            },
            {
              id: 'notice-server',
              title: t('Server tab', { _tags: tags }),
              type: 'button' as const,
              onPress: async () => {
                setNoticeTarget('server');
                await settingsService.setSetting('noticeTarget', 'server');
              },
            },
            {
              id: 'notice-tab',
              title: t('Notices tab', { _tags: tags }),
              type: 'button' as const,
              onPress: async () => {
                setNoticeTarget('notice');
                await settingsService.setSetting('noticeTarget', 'notice');
              },
            },
            {
              id: 'notice-private',
              title: t('Private/query tab', { _tags: tags }),
              type: 'button' as const,
              onPress: async () => {
                setNoticeTarget('private');
                await settingsService.setSetting('noticeTarget', 'private');
              },
            },
          ],
        },
        {
          id: 'display-timestamps',
          title: t('Show Timestamps', { _tags: tags }),
          description: t('Display message timestamps', { _tags: tags }),
          type: 'switch' as const,
          value: true,
          onValueChange: () => Alert.alert(
            t('Info', { _tags: tags }),
            t('Timestamp display setting coming soon', { _tags: tags })
          ),
        },
        {
          id: 'layout-timestamp-display',
          title: t('Timestamp Display', { _tags: tags }),
          description: t('Show timestamps: {mode}', { mode: layoutConfig?.timestampDisplay || 'grouped', _tags: tags }),
          type: 'button' as const,
          onPress: () => {
            Alert.alert(
              t('Timestamp Display', { _tags: tags }),
              t('Select when to show timestamps:', { _tags: tags }),
              [
                { text: t('Cancel', { _tags: tags }), style: 'cancel' },
                {
                  text: t('Always', { _tags: tags }),
                  onPress: async () => {
                    await layoutService.setTimestampDisplay('always');
                    setLayoutConfig(layoutService.getConfig());
                  },
                },
                {
                  text: t('Only for first message in a group', { _tags: tags }),
                  onPress: async () => {
                    await layoutService.setTimestampDisplay('grouped');
                    setLayoutConfig(layoutService.getConfig());
                  },
                },
                {
                  text: t('Never', { _tags: tags }),
                  onPress: async () => {
                    await layoutService.setTimestampDisplay('never');
                    setLayoutConfig(layoutService.getConfig());
                  },
                },
              ]
            );
          },
        },
        {
          id: 'layout-timestamp-format',
          title: t('Timestamp Format', { _tags: tags }),
          description: t('Format: {format}', { format: layoutConfig?.timestampFormat || '12h', _tags: tags }),
          type: 'button' as const,
          onPress: () => {
            Alert.alert(
              t('Timestamp Format', { _tags: tags }),
              t('Select format:', { _tags: tags }),
              [
                { text: t('Cancel', { _tags: tags }), style: 'cancel' },
                {
                  text: t('12-hour (AM/PM)', { _tags: tags }),
                  onPress: async () => {
                    await layoutService.setTimestampFormat('12h');
                    setLayoutConfig(layoutService.getConfig());
                  },
                },
                {
                  text: t('24-hour', { _tags: tags }),
                  onPress: async () => {
                    await layoutService.setTimestampFormat('24h');
                    setLayoutConfig(layoutService.getConfig());
                  },
                },
              ]
            );
          },
          disabled: layoutConfig?.timestampDisplay === 'never',
        },
        {
          id: 'display-encryption-icons',
          title: t('Show Encryption Indicators', { _tags: tags }),
          description: showEncryptionIndicatorsSetting
            ? t('Lock icons visible on tabs/messages', { _tags: tags })
            : t('Hide lock icons', { _tags: tags }),
          type: 'switch' as const,
          value: showEncryptionIndicatorsSetting,
          onValueChange: async (value: boolean) => {
            setShowEncryptionIndicatorsSetting(value);
            await settingsService.setSetting('showEncryptionIndicators', value);
            onShowEncryptionIndicatorsChange && onShowEncryptionIndicatorsChange(value);
          },
        },
      ],
    },
    {
      title: t('Messages', { _tags: tags }),
      data: [
        {
          id: 'messages-part',
          title: t('Part Message', { _tags: tags }),
          description: t('Message to send when leaving a channel.', { _tags: tags }),
          type: 'input' as const,
          value: partMessage,
          placeholder: DEFAULT_PART_MESSAGE,
          onValueChange: async (value: string) => {
            setPartMessage(value);
            await settingsService.setSetting('partMessage', value);
          },
        },
        {
          id: 'messages-quit',
          title: t('Quit Message', { _tags: tags }),
          description: t('Message to send when disconnecting.', { _tags: tags }),
          type: 'input' as const,
          value: quitMessage,
          placeholder: DEFAULT_QUIT_MESSAGE,
          onValueChange: async (value: string) => {
            setQuitMessage(value);
            await settingsService.setSetting('quitMessage', value);
          },
        },
        {
          id: 'messages-hide-join',
          title: t('Hide Join Messages', { _tags: tags }),
          description: t('Do not show join events in channels.', { _tags: tags }),
          type: 'switch' as const,
          value: hideJoinMessages,
          onValueChange: async (value: boolean) => {
            setHideJoinMessages(value);
            await settingsService.setSetting('hideJoinMessages', value);
          },
        },
        {
          id: 'messages-hide-part',
          title: t('Hide Part Messages', { _tags: tags }),
          description: t('Do not show part/leave events in channels.', { _tags: tags }),
          type: 'switch' as const,
          value: hidePartMessages,
          onValueChange: async (value: boolean) => {
            setHidePartMessages(value);
            await settingsService.setSetting('hidePartMessages', value);
          },
        },
        {
          id: 'messages-hide-quit',
          title: t('Hide Quit Messages', { _tags: tags }),
          description: t('Do not show quit events in channels.', { _tags: tags }),
          type: 'switch' as const,
          value: hideQuitMessages,
          onValueChange: async (value: boolean) => {
            setHideQuitMessages(value);
            await settingsService.setSetting('hideQuitMessages', value);
          },
        },
        {
          id: 'messages-hide-irc-listener',
          title: t('Hide IRCService Listener Messages', { _tags: tags }),
          description: t('Suppress "*** IRCService: Message listener registered..." raw logs.', { _tags: tags }),
          type: 'switch' as const,
          value: hideIrcServiceListenerMessages,
          onValueChange: async (value: boolean) => {
            setHideIrcServiceListenerMessages(value);
            await settingsService.setSetting('hideIrcServiceListenerMessages', value);
          },
        },
        {
          id: 'messages-close-private-enabled',
          title: t('Send Message on Query Close', { _tags: tags }),
          description: t('Send a message when you close a private message window.', { _tags: tags }),
          type: 'switch' as const,
          value: closePrivateMessage,
          onValueChange: async (value: boolean) => {
            setClosePrivateMessage(value);
            await settingsService.setSetting('closePrivateMessage', value);
          },
        },
        {
          id: 'messages-close-private-text',
          title: t('Query Close Message', { _tags: tags }),
          description: t('The message to send.', { _tags: tags }),
          type: 'input' as const,
          value: closePrivateMessageText,
          placeholder: t('Enter message...', { _tags: tags }),
          onValueChange: async (value: string) => {
            setClosePrivateMessageText(value);
            await settingsService.setSetting('closePrivateMessageText', value);
          },
          disabled: !closePrivateMessage,
        },
      ],
    },
    {
      title: t('Notifications', { _tags: tags }),
      data: [
        {
          id: 'notifications-enabled',
          title: t('Enable Notifications', { _tags: tags }),
          description: t('Receive notifications for messages', { _tags: tags }),
          type: 'switch' as const,
          value: notificationPrefs.enabled,
          onValueChange: (value: boolean) => handleNotificationChange('enabled', value),
        },
        {
          id: 'notifications-mentions',
          title: t('Notify on Mentions', { _tags: tags }),
          description: t('Get notified when someone mentions your nickname', { _tags: tags }),
          type: 'switch' as const,
          value: notificationPrefs.notifyOnMentions,
          onValueChange: (value: boolean) => handleNotificationChange('notifyOnMentions', value),
          disabled: !notificationPrefs.enabled,
        },
        {
          id: 'notifications-private',
          title: t('Notify on Private Messages', { _tags: tags }),
          description: t('Get notified for private messages', { _tags: tags }),
          type: 'switch' as const,
          value: notificationPrefs.notifyOnPrivateMessages,
          onValueChange: (value: boolean) => handleNotificationChange('notifyOnPrivateMessages', value),
          disabled: !notificationPrefs.enabled,
        },
        {
          id: 'notifications-all',
          title: t('Notify on All Messages', { _tags: tags }),
          description: t('Get notified for all channel messages', { _tags: tags }),
          type: 'switch' as const,
          value: notificationPrefs.notifyOnAllMessages,
          onValueChange: (value: boolean) => handleNotificationChange('notifyOnAllMessages', value),
          disabled: !notificationPrefs.enabled,
        },
        {
          id: 'notifications-dnd',
          title: t('Do Not Disturb', { _tags: tags }),
          description: t('Disable all notifications', { _tags: tags }),
          type: 'switch' as const,
          value: notificationPrefs.doNotDisturb,
          onValueChange: (value: boolean) => handleNotificationChange('doNotDisturb', value),
        },
        {
          id: 'notifications-per-channel',
          title: t('Per-Channel Settings', { _tags: tags }),
          description: t('Configure notifications for specific channels', { _tags: tags }),
          type: 'button' as const,
          onPress: () => {
            setChannelNotifList(notificationService.listChannelPreferences());
            setShowChannelNotifModal(true);
          },
        },
      ],
    },
    {
      title: t('Highlighting', { _tags: tags }),
      data: [
        {
          id: 'highlight-add',
          title: t('Add Highlight Word', { _tags: tags }),
          description: t('Messages containing these words will be highlighted.', { _tags: tags }),
          type: 'input' as const,
          value: newHighlightWord,
          placeholder: t('Enter a word to highlight...', { _tags: tags }),
          onValueChange: (value: string) => setNewHighlightWord(value),
          onPress: async () => {
            if (newHighlightWord.trim()) {
              await highlightService.addHighlightWord(newHighlightWord.trim());
              setNewHighlightWord('');
            }
          },
        },
        ...highlightWords.map(word => ({
          id: `highlight-word-${word}`,
          title: word,
          type: 'button' as const,
          onPress: () => {
            Alert.alert(
              t('Remove Highlight Word', { _tags: tags }),
              t('Are you sure you want to remove "{word}"?', { word, _tags: tags }),
              [
                { text: t('Cancel', { _tags: tags }), style: 'cancel' },
                {
                  text: t('Remove', { _tags: tags }),
                  style: 'destructive',
                  onPress: async () => {
                    await highlightService.removeHighlightWord(word);
                  },
                },
              ],
            );
          },
        })),
      ],
    },
    {
      title: connectionTitle,
      data: [
        {
          id: 'setup-wizard',
          title: t('Setup Wizard', { _tags: tags }),
          description: t('Quick setup for identity and network connection', { _tags: tags }),
          type: 'button' as const,
          onPress: () => {
            setShowFirstRunSetup(true);
          },
        },
        {
          id: 'connection-auto-connect-favorite',
          title: t('Auto-Connect to Favorite Server', { _tags: tags }),
          description: t('When opening a network, prefer the server marked as favorite.', { _tags: tags }),
          type: 'switch' as const,
          value: autoConnectFavoriteServer,
          onValueChange: async (value: boolean) => {
            setAutoConnectFavoriteServer(value);
            await settingsService.setSetting('autoConnectFavoriteServer', value);
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
          type: 'submenu' as const,
          submenuItems: [
            {
              id: 'auto-reconnect-enabled',
              title: t('Enable Auto-Reconnect', { _tags: tags }),
              type: 'switch' as const,
              value: autoReconnectConfig?.enabled || false,
              onValueChange: (value: boolean) => {
                if (currentNetwork) {
                  const config = autoReconnectService.getConfig(currentNetwork) || {
                    enabled: false,
                    maxAttempts: 10,
                    initialDelay: 1000,
                    maxDelay: 60000,
                    backoffMultiplier: 2,
                    rejoinChannels: true,
                    smartReconnect: true,
                    minReconnectInterval: 5000,
                  };
                  config.enabled = value;
                  autoReconnectService.setConfig(currentNetwork, config);
                  setAutoReconnectConfig(config);
                }
              },
            },
            {
              id: 'auto-reconnect-rejoin',
              title: t('Rejoin Channels After Reconnect', { _tags: tags }),
              description: t('Automatically rejoin channels you were in', { _tags: tags }),
              type: 'switch' as const,
              value: autoReconnectConfig?.rejoinChannels || false,
              onValueChange: (value: boolean) => {
                if (currentNetwork) {
                  const config = autoReconnectService.getConfig(currentNetwork) || {
                    enabled: false,
                    maxAttempts: 10,
                    initialDelay: 1000,
                    maxDelay: 60000,
                    backoffMultiplier: 2,
                    rejoinChannels: true,
                    smartReconnect: true,
                    minReconnectInterval: 5000,
                  };
                  config.rejoinChannels = value;
                  autoReconnectService.setConfig(currentNetwork, config);
                  setAutoReconnectConfig(config);
                }
              },
              disabled: !autoReconnectConfig?.enabled,
            },
            {
              id: 'auto-reconnect-smart',
              title: t('Smart Reconnection', { _tags: tags }),
              description: t('Avoid flood by spacing reconnection attempts', { _tags: tags }),
              type: 'switch' as const,
              value: autoReconnectConfig?.smartReconnect || false,
              onValueChange: (value: boolean) => {
                if (currentNetwork) {
                  const config = autoReconnectService.getConfig(currentNetwork) || {
                    enabled: false,
                    maxAttempts: 10,
                    initialDelay: 1000,
                    maxDelay: 60000,
                    backoffMultiplier: 2,
                    rejoinChannels: true,
                    smartReconnect: true,
                    minReconnectInterval: 5000,
                  };
                  config.smartReconnect = value;
                  autoReconnectService.setConfig(currentNetwork, config);
                  setAutoReconnectConfig(config);
                }
              },
              disabled: !autoReconnectConfig?.enabled,
            },
            {
              id: 'auto-reconnect-max-attempts',
              title: t('Max Reconnection Attempts', { _tags: tags }),
              description: autoReconnectConfig?.maxAttempts
                ? `${autoReconnectConfig.maxAttempts} attempts (0 = unlimited)`
                : 'Maximum reconnection attempts (0 = unlimited)',
              type: 'input' as const,
              value: autoReconnectConfig?.maxAttempts?.toString() || '10',
              keyboardType: 'numeric',
              onValueChange: (value: string) => {
                if (currentNetwork) {
                  const config = autoReconnectService.getConfig(currentNetwork) || {
                    enabled: false,
                    maxAttempts: 10,
                    initialDelay: 1000,
                    maxDelay: 60000,
                    backoffMultiplier: 2,
                    rejoinChannels: true,
                    smartReconnect: true,
                    minReconnectInterval: 5000,
                  };
                  const attempts = parseInt(value, 10);
                  config.maxAttempts = isNaN(attempts) ? 0 : attempts;
                  autoReconnectService.setConfig(currentNetwork, config);
                  setAutoReconnectConfig(config);
                }
              },
              disabled: !autoReconnectConfig?.enabled,
            },
            {
              id: 'auto-reconnect-initial-delay',
              title: t('Initial Delay (ms)', { _tags: tags }),
              description: `First reconnection delay: ${autoReconnectConfig?.initialDelay || 1000}ms`,
              type: 'input' as const,
              value: autoReconnectConfig?.initialDelay?.toString() || '1000',
              keyboardType: 'numeric',
              onValueChange: (value: string) => {
                if (currentNetwork) {
                  const config = autoReconnectService.getConfig(currentNetwork) || {
                    enabled: false,
                    maxAttempts: 10,
                    initialDelay: 1000,
                    maxDelay: 60000,
                    backoffMultiplier: 2,
                    rejoinChannels: true,
                    smartReconnect: true,
                    minReconnectInterval: 5000,
                  };
                  const delay = parseInt(value, 10);
                  config.initialDelay = isNaN(delay) ? 1000 : delay;
                  autoReconnectService.setConfig(currentNetwork, config);
                  setAutoReconnectConfig(config);
                }
              },
              disabled: !autoReconnectConfig?.enabled,
            },
            {
              id: 'auto-reconnect-max-delay',
              title: t('Max Delay (ms)', { _tags: tags }),
              description: `Maximum delay between attempts: ${autoReconnectConfig?.maxDelay || 60000}ms`,
              type: 'input' as const,
              value: autoReconnectConfig?.maxDelay?.toString() || '60000',
              keyboardType: 'numeric',
              onValueChange: (value: string) => {
                if (currentNetwork) {
                  const config = autoReconnectService.getConfig(currentNetwork) || {
                    enabled: false,
                    maxAttempts: 10,
                    initialDelay: 1000,
                    maxDelay: 60000,
                    backoffMultiplier: 2,
                    rejoinChannels: true,
                    smartReconnect: true,
                    minReconnectInterval: 5000,
                  };
                  const delay = parseInt(value, 10);
                  config.maxDelay = isNaN(delay) ? 60000 : delay;
                  autoReconnectService.setConfig(currentNetwork, config);
                  setAutoReconnectConfig(config);
                }
              },
              disabled: !autoReconnectConfig?.enabled,
            },
          ],
        },
        {
          id: 'connection-quality',
          title: t('Connection Quality', { _tags: tags }),
          description: connectionStats
            ? `Lag: ${connectionStats.currentLag}ms (${connectionStats.lagStatus}), ${connectionStats.messagesSent} sent, ${connectionStats.messagesReceived} received`
            : 'Rate limiting, flood protection, and lag monitoring',
          type: 'submenu' as const,
          submenuItems: [
            {
              id: 'quality-rate-limit',
              title: t('Rate Limiting', { _tags: tags }),
              description: rateLimitConfig?.enabled
                ? `${rateLimitConfig.messagesPerSecond} msg/s, burst: ${rateLimitConfig.burstLimit}`
                : 'Limit messages per second',
              type: 'submenu' as const,
              submenuItems: [
                {
                  id: 'rate-limit-enabled',
                  title: t('Enable Rate Limiting', { _tags: tags }),
                  type: 'switch' as const,
                  value: rateLimitConfig?.enabled || false,
                  onValueChange: async (value: boolean) => {
                    await connectionQualityService.setRateLimitConfig({ enabled: value });
                    setRateLimitConfig(connectionQualityService.getRateLimitConfig());
                  },
                },
                {
                  id: 'rate-limit-msg-per-sec',
                  title: t('Messages Per Second', { _tags: tags }),
                  description: `Max messages per second: ${rateLimitConfig?.messagesPerSecond || 2}`,
                  type: 'input' as const,
                  value: rateLimitConfig?.messagesPerSecond?.toString() || '2',
                  keyboardType: 'numeric',
                  onValueChange: async (value: string) => {
                    const msgPerSec = parseInt(value, 10);
                    if (!isNaN(msgPerSec) && msgPerSec > 0) {
                      await connectionQualityService.setRateLimitConfig({ messagesPerSecond: msgPerSec });
                      setRateLimitConfig(connectionQualityService.getRateLimitConfig());
                    }
                  },
                  disabled: !rateLimitConfig?.enabled,
                },
                {
                  id: 'rate-limit-burst',
                  title: t('Burst Limit', { _tags: tags }),
                  description: `Max messages in burst: ${rateLimitConfig?.burstLimit || 5}`,
                  type: 'input' as const,
                  value: rateLimitConfig?.burstLimit?.toString() || '5',
                  keyboardType: 'numeric',
                  onValueChange: async (value: string) => {
                    const burst = parseInt(value, 10);
                    if (!isNaN(burst) && burst > 0) {
                      await connectionQualityService.setRateLimitConfig({ burstLimit: burst });
                      setRateLimitConfig(connectionQualityService.getRateLimitConfig());
                    }
                  },
                  disabled: !rateLimitConfig?.enabled,
                },
              ],
            },
            {
              id: 'quality-flood-protection',
              title: t('Flood Protection', { _tags: tags }),
              description: floodProtectionConfig?.enabled
                ? `${floodProtectionConfig.maxMessagesPerWindow} msgs/${floodProtectionConfig.windowSize / 1000}s`
                : 'Protect against message flooding',
              type: 'submenu' as const,
              submenuItems: [
                {
                  id: 'flood-protection-enabled',
                  title: t('Enable Flood Protection', { _tags: tags }),
                  type: 'switch' as const,
                  value: floodProtectionConfig?.enabled || false,
                  onValueChange: async (value: boolean) => {
                    await connectionQualityService.setFloodProtectionConfig({ enabled: value });
                    setFloodProtectionConfig(connectionQualityService.getFloodProtectionConfig());
                  },
                },
                {
                  id: 'flood-protection-max-msgs',
                  title: t('Max Messages Per Window', { _tags: tags }),
                  description: `Max messages: ${floodProtectionConfig?.maxMessagesPerWindow || 10}`,
                  type: 'input' as const,
                  value: floodProtectionConfig?.maxMessagesPerWindow?.toString() || '10',
                  keyboardType: 'numeric',
                  onValueChange: async (value: string) => {
                    const maxMsgs = parseInt(value, 10);
                    if (!isNaN(maxMsgs) && maxMsgs > 0) {
                      await connectionQualityService.setFloodProtectionConfig({ maxMessagesPerWindow: maxMsgs });
                      setFloodProtectionConfig(connectionQualityService.getFloodProtectionConfig());
                    }
                  },
                  disabled: !floodProtectionConfig?.enabled,
                },
                {
                  id: 'flood-protection-window',
                  title: t('Window Size (ms)', { _tags: tags }),
                  description: `Window size: ${floodProtectionConfig?.windowSize || 5000}ms`,
                  type: 'input' as const,
                  value: floodProtectionConfig?.windowSize?.toString() || '5000',
                  keyboardType: 'numeric',
                  onValueChange: async (value: string) => {
                    const window = parseInt(value, 10);
                    if (!isNaN(window) && window > 0) {
                      await connectionQualityService.setFloodProtectionConfig({ windowSize: window });
                      setFloodProtectionConfig(connectionQualityService.getFloodProtectionConfig());
                    }
                  },
                  disabled: !floodProtectionConfig?.enabled,
                },
              ],
            },
            {
              id: 'quality-lag-monitoring',
              title: t('Lag Monitoring', { _tags: tags }),
              description: lagMonitoringConfig?.enabled
                ? `Ping every ${lagMonitoringConfig.pingInterval / 1000}s, warning: ${lagMonitoringConfig.warningThreshold}ms`
                : 'Monitor connection lag/ping',
              type: 'submenu' as const,
              submenuItems: [
                {
                  id: 'lag-monitoring-enabled',
                  title: t('Enable Lag Monitoring', { _tags: tags }),
                  type: 'switch' as const,
                  value: lagMonitoringConfig?.enabled || false,
                  onValueChange: async (value: boolean) => {
                    await connectionQualityService.setLagMonitoringConfig({ enabled: value });
                    setLagMonitoringConfig(connectionQualityService.getLagMonitoringConfig());
                  },
                },
                {
                  id: 'lag-monitoring-method',
                  title: t('Lag Check Method', { _tags: tags }),
                  description: `Using: ${lagCheckMethod === 'ctcp' ? 'CTCP Ping' : 'Server Ping'}`,
                  type: 'button' as const,
                  onPress: () => {
                    Alert.alert(
          t('Lag Check Method', { _tags: tags }),
          t('Select the method to check for lag:', { _tags: tags }),
                      [
                        { text: 'Cancel', style: 'cancel' },
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
                  type: 'input' as const,
                  value: lagMonitoringConfig?.pingInterval?.toString() || '30000',
                  keyboardType: 'numeric',
                  onValueChange: async (value: string) => {
                    const interval = parseInt(value, 10);
                    if (!isNaN(interval) && interval > 0) {
                      await connectionQualityService.setLagMonitoringConfig({ pingInterval: interval });
                      setLagMonitoringConfig(connectionQualityService.getLagMonitoringConfig());
                    }
                  },
                  disabled: !lagMonitoringConfig?.enabled,
                },
                {
                  id: 'lag-monitoring-warning',
                  title: t('Warning Threshold (ms)', { _tags: tags }),
                  description: `Warning at: ${lagMonitoringConfig?.warningThreshold || 1000}ms`,
                  type: 'input' as const,
                  value: lagMonitoringConfig?.warningThreshold?.toString() || '1000',
                  keyboardType: 'numeric',
                  onValueChange: async (value: string) => {
                    const threshold = parseInt(value, 10);
                    if (!isNaN(threshold) && threshold > 0) {
                      await connectionQualityService.setLagMonitoringConfig({ warningThreshold: threshold });
                      setLagMonitoringConfig(connectionQualityService.getLagMonitoringConfig());
                    }
                  },
                  disabled: !lagMonitoringConfig?.enabled,
                },
              ],
            },
            {
              id: 'quality-statistics',
              title: t('Connection Statistics', { _tags: tags }),
              description: connectionStats
                ? `Uptime: ${Math.floor((Date.now() - connectionStats.connectionStartTime) / 1000)}s, Avg ping: ${connectionStats.averagePing.toFixed(0)}ms`
                : 'View connection statistics',
              type: 'button' as const,
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
          type: 'button' as const,
          onPress: () => setShowConnectionProfiles(true),
        },
        {
          id: 'display-tab-sort',
          title: t('Sort Tabs Alphabetically', { _tags: tags }),
          description: tabSortAlphabetical ? 'Sorting tabs A→Z per network' : 'Keep tabs in join/open order',
          type: 'switch' as const,
          value: tabSortAlphabetical,
          onValueChange: async (value: boolean) => {
            setTabSortAlphabetical(value);
            await settingsService.setSetting('tabSortAlphabetical', value);
          },
        },
        {
          id: 'display-encryption-icons',
          title: t('Show Encryption Indicators', { _tags: tags }),
          description: showEncryptionIndicatorsSetting ? 'Lock icons visible on tabs/messages' : 'Hide lock icons',
          type: 'switch' as const,
          value: showEncryptionIndicatorsSetting,
          onValueChange: async (value: boolean) => {
            setShowEncryptionIndicatorsSetting(value);
            await settingsService.setSetting('showEncryptionIndicators', value);
            onShowEncryptionIndicatorsChange && onShowEncryptionIndicatorsChange(value);
          },
        },
        {
          id: 'connection-global-proxy',
          title: t('Global Proxy', { _tags: tags }),
          description: globalProxyEnabled ? `${globalProxyType.toUpperCase()} - ${globalProxyHost}:${globalProxyPort}` : 'Configure proxy for all connections',
          type: 'submenu' as const,
          submenuItems: [
            {
              id: 'proxy-enable',
              title: t('Enable Global Proxy', { _tags: tags }),
              description: t('Route all IRC connections through a proxy', { _tags: tags }),
              type: 'switch' as const,
              value: globalProxyEnabled,
              onValueChange: async (value: boolean) => {
                setGlobalProxyEnabled(value);
                await settingsService.setSetting('globalProxy', {
                  enabled: value,
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
              type: 'picker' as const,
              value: globalProxyType,
              options: [
                { label: 'SOCKS5', value: 'socks5' },
                { label: 'SOCKS4', value: 'socks4' },
                { label: 'HTTP', value: 'http' },
              ],
              onValueChange: async (value: string) => {
                setGlobalProxyType(value);
                await settingsService.setSetting('globalProxy', {
                  enabled: globalProxyEnabled,
                  type: value,
                  host: globalProxyHost,
                  port: globalProxyPort ? parseInt(globalProxyPort) : 0,
                  username: globalProxyUsername,
                  password: globalProxyPassword,
                });
              },
            },
            {
              id: 'proxy-host',
              title: t('Proxy Host', { _tags: tags }),
              description: t('Proxy server hostname or IP', { _tags: tags }),
              type: 'input' as const,
              value: globalProxyHost,
              placeholder: t('proxy.example.com', { _tags: tags }),
              onValueChange: async (value: string) => {
                setGlobalProxyHost(value);
                await settingsService.setSetting('globalProxy', {
                  enabled: globalProxyEnabled,
                  type: globalProxyType,
                  host: value,
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
              type: 'input' as const,
              value: globalProxyPort,
              placeholder: t('1080', { _tags: tags }),
              keyboardType: 'numeric' as const,
              onValueChange: async (value: string) => {
                setGlobalProxyPort(value);
                await settingsService.setSetting('globalProxy', {
                  enabled: globalProxyEnabled,
                  type: globalProxyType,
                  host: globalProxyHost,
                  port: value ? parseInt(value) : 0,
                  username: globalProxyUsername,
                  password: globalProxyPassword,
                });
              },
            },
            {
              id: 'proxy-username',
              title: t('Proxy Username (optional)', { _tags: tags }),
              description: t('Leave blank if no authentication required', { _tags: tags }),
              type: 'input' as const,
              value: globalProxyUsername,
              placeholder: t('username', { _tags: tags }),
              onValueChange: async (value: string) => {
                setGlobalProxyUsername(value);
                await settingsService.setSetting('globalProxy', {
                  enabled: globalProxyEnabled,
                  type: globalProxyType,
                  host: globalProxyHost,
                  port: globalProxyPort ? parseInt(globalProxyPort) : 0,
                  username: value,
                  password: globalProxyPassword,
                });
              },
            },
            {
              id: 'proxy-password',
              title: t('Proxy Password (optional)', { _tags: tags }),
              description: t('Leave blank if no authentication required', { _tags: tags }),
              type: 'password' as const,
              value: globalProxyPassword,
              placeholder: t('password', { _tags: tags }),
              onValueChange: async (value: string) => {
                setGlobalProxyPassword(value);
                await settingsService.setSetting('globalProxy', {
                  enabled: globalProxyEnabled,
                  type: globalProxyType,
                  host: globalProxyHost,
                  port: globalProxyPort ? parseInt(globalProxyPort) : 0,
                  username: globalProxyUsername,
                  password: value,
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
          type: 'switch' as const,
          value: biometricLockEnabled,
          onValueChange: handleBiometricLockToggle,
          disabled: !biometricAvailable,
        },
        {
          id: 'connection-pin-lock',
          title: t('PIN Lock for Passwords', { _tags: tags }),
          description: pinLockEnabled
            ? 'PIN required before showing/editing passwords'
            : 'Require a PIN before showing/editing passwords',
          type: 'switch' as const,
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
      ],
    },
    {
      title: t('Security', { _tags: tags }),
      data: [
        {
          id: 'security-manage-keys',
          title: t('Manage Encryption Keys', { _tags: tags }),
          description: 'View, delete, copy, and move encryption keys',
          type: 'button' as const,
          onPress: () => setShowKeyManagement(true),
        },
        {
          id: 'security-migrate-keys',
          title: t('Migrate Old Keys', { _tags: tags }),
          description: 'Move old nick-only keys to network-based storage',
          type: 'button' as const,
          onPress: () => setShowMigrationDialog(true),
        },
        {
          id: 'security-qr',
          title: t('Allow QR Verification', { _tags: tags }),
          description: allowQrVerification ? 'QR verification enabled' : 'QR verification disabled',
          type: 'switch' as const,
          value: allowQrVerification,
          onValueChange: async (value: boolean) => {
            setAllowQrVerification(value);
            await settingsService.setSetting('securityAllowQrVerification', value);
          },
        },
        {
          id: 'security-file',
          title: t('Allow File Key Exchange', { _tags: tags }),
          description: allowFileExchange ? 'File import/export enabled' : 'File import/export disabled',
          type: 'switch' as const,
          value: allowFileExchange,
          onValueChange: async (value: boolean) => {
            setAllowFileExchange(value);
            await settingsService.setSetting('securityAllowFileExchange', value);
          },
        },
        {
          id: 'security-nfc',
          title: t('Allow NFC Key Exchange', { _tags: tags }),
          description: allowNfcExchange ? 'NFC exchange enabled' : 'NFC exchange disabled',
          type: 'switch' as const,
          value: allowNfcExchange,
          onValueChange: async (value: boolean) => {
            setAllowNfcExchange(value);
            await settingsService.setSetting('securityAllowNfcExchange', value);
          },
        },
        {
          id: 'security-app-lock',
          title: t('App Lock', { _tags: tags }),
          description: appLockEnabled ? 'App lock enabled' : 'App lock disabled',
          type: 'switch' as const,
          value: appLockEnabled,
          onValueChange: handleAppLockToggle,
        },
        {
          id: 'security-app-lock-biometric',
          title: t('App Lock with Biometrics', { _tags: tags }),
          description: appLockUseBiometric ? 'Biometric unlock enabled' : 'Use fingerprint/biometric to unlock',
          type: 'switch' as const,
          value: appLockUseBiometric,
          onValueChange: handleAppLockBiometricToggle,
          disabled: !biometricAvailable,
        },
        {
          id: 'security-app-lock-pin',
          title: t('App Lock with PIN', { _tags: tags }),
          description: appLockUsePin
            ? t('PIN unlock enabled', { _tags: tags })
            : t('Use a PIN to unlock', { _tags: tags }),
          type: 'switch' as const,
          value: appLockUsePin,
          onValueChange: handleAppLockPinToggle,
        },
        {
          id: 'security-app-lock-launch',
          title: t('Lock on Launch', { _tags: tags }),
          description: appLockOnLaunch
            ? t('Locks when app is opened', { _tags: tags })
            : t('Does not lock on launch', { _tags: tags }),
          type: 'switch' as const,
          value: appLockOnLaunch,
          onValueChange: async (value: boolean) => {
            setAppLockOnLaunch(value);
            await settingsService.setSetting('appLockOnLaunch', value);
          },
        },
        {
          id: 'security-app-lock-background',
          title: t('Lock on Background', { _tags: tags }),
          description: appLockOnBackground
            ? t('Locks after app is backgrounded', { _tags: tags })
            : t('Does not lock on background', { _tags: tags }),
          type: 'switch' as const,
          value: appLockOnBackground,
          onValueChange: async (value: boolean) => {
            setAppLockOnBackground(value);
            await settingsService.setSetting('appLockOnBackground', value);
          },
        },
        {
          id: 'security-app-lock-now',
          title: t('Lock Now', { _tags: tags }),
          description: t('Immediately lock the app', { _tags: tags }),
          type: 'button' as const,
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
          disabled: !appLockEnabled,
        },
      ],
    },
    {
      title: t('Channels', { _tags: tags }),
      data: [
        {
          id: 'channel-favorites',
          title: t('Channel Favorites', { _tags: tags }),
          description: favoritesCount > 0
            ? (favoritesCount === 1
              ? t('{count} favorite across networks', { count: favoritesCount, _tags: tags })
              : t('{count} favorites across networks', { count: favoritesCount, _tags: tags }))
            : t('Manage favorite channels', { _tags: tags }),
          type: 'submenu' as const,
          submenuItems: [
            ...(allFavorites.length === 0
              ? [
                  {
                    id: 'favorites-empty',
                    title: t('No favorites yet', { _tags: tags }),
                    type: 'button' as const,
                    disabled: true,
                  } as SettingItem,
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
                            } as SettingItem,
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
                  } as SettingItem;
                })),
          ],
        },
        {
          id: 'channel-auto-join-favorites',
          title: t('Auto-Join Favorites on Connect', { _tags: tags }),
          description: t('Join favorited channels after connect/identify', { _tags: tags }),
          type: 'switch' as const,
          value: autoJoinFavoritesEnabled,
          onValueChange: async (value: boolean) => {
            setAutoJoinFavoritesEnabled(value);
            await settingsService.setSetting('autoJoinFavorites', value);
          },
        },
        {
          id: 'channel-auto-rejoin',
          title: t('Auto-Rejoin on Kick', { _tags: tags }),
          description: t('Automatically rejoin channel if kicked', { _tags: tags }),
          type: 'switch' as const,
          value: autoRejoinEnabled,
          onValueChange: (value: boolean) => {
            if (currentNetwork) {
              autoRejoinService.setEnabled(currentNetwork, value);
              setAutoRejoinEnabled(value);
            }
          },
          disabled: !currentNetwork,
        },
        {
          id: 'channel-auto-voice',
          title: t('Auto-Voice on Join', { _tags: tags }),
          description: autoVoiceConfig?.enabled
            ? `${autoVoiceConfig.forAll ? 'All users' : ''}${autoVoiceConfig.forOperators ? 'Operators' : ''}${autoVoiceConfig.forIRCOps ? 'IRC Ops' : ''}`
            : 'Automatically request voice when joining channels',
          type: 'submenu' as const,
          submenuItems: [
            {
              id: 'auto-voice-enabled',
              title: t('Enable Auto-Voice', { _tags: tags }),
              type: 'switch' as const,
              value: autoVoiceConfig?.enabled || false,
              onValueChange: (value: boolean) => {
                if (currentNetwork) {
                  const config = autoVoiceService.getConfig(currentNetwork) || {
                    enabled: false,
                    forOperators: false,
                    forIRCOps: false,
                    forAll: false,
                  };
                  config.enabled = value;
                  autoVoiceService.setConfig(currentNetwork, config);
                  setAutoVoiceConfig(config);
                }
              },
            },
            {
              id: 'auto-voice-all',
              title: t('For All Users', { _tags: tags }),
              type: 'switch' as const,
              value: autoVoiceConfig?.forAll || false,
              onValueChange: (value: boolean) => {
                if (currentNetwork) {
                  const config = autoVoiceService.getConfig(currentNetwork) || {
                    enabled: false,
                    forOperators: false,
                    forIRCOps: false,
                    forAll: false,
                  };
                  config.forAll = value;
                  autoVoiceService.setConfig(currentNetwork, config);
                  setAutoVoiceConfig(config);
                }
              },
              disabled: !autoVoiceConfig?.enabled,
            },
            {
              id: 'auto-voice-operators',
              title: t('For Operators/Halfops', { _tags: tags }),
              type: 'switch' as const,
              value: autoVoiceConfig?.forOperators || false,
              onValueChange: (value: boolean) => {
                if (currentNetwork) {
                  const config = autoVoiceService.getConfig(currentNetwork) || {
                    enabled: false,
                    forOperators: false,
                    forIRCOps: false,
                    forAll: false,
                  };
                  config.forOperators = value;
                  autoVoiceService.setConfig(currentNetwork, config);
                  setAutoVoiceConfig(config);
                }
              },
              disabled: !autoVoiceConfig?.enabled,
            },
            {
              id: 'auto-voice-ircops',
              title: t('For IRC Ops (Admin/Netadmin)', { _tags: tags }),
              type: 'switch' as const,
              value: autoVoiceConfig?.forIRCOps || false,
              onValueChange: (value: boolean) => {
                if (currentNetwork) {
                  const config = autoVoiceService.getConfig(currentNetwork) || {
                    enabled: false,
                    forOperators: false,
                    forIRCOps: false,
                    forAll: false,
                  };
                  config.forIRCOps = value;
                  autoVoiceService.setConfig(currentNetwork, config);
                  setAutoVoiceConfig(config);
                }
              },
              disabled: !autoVoiceConfig?.enabled,
            },
          ],
        },
        {
          id: 'connection-dcc',
          title: t('DCC Settings', { _tags: tags }),
          description: `Port range ${dccMinPort}-${dccMaxPort}`,
          type: 'submenu' as const,
          submenuItems: dccSubmenuItems,
        },
      ],
    },
    {
      title: t('Users & Services', { _tags: tags }),
      data: [
        {
          id: 'irc-services-add',
          title: t('Add Service Nickname', { _tags: tags }),
          description: t('Prevent sending "close query" messages to these nicks.', { _tags: tags }),
          type: 'input' as const,
          value: newIrcService,
          placeholder: t('Enter a service name (e.g., Q)', { _tags: tags }),
          onValueChange: (value: string) => setNewIrcService(value),
          onPress: async () => {
            if (newIrcService.trim()) {
              const updatedServices = [...ircServices, newIrcService.trim()];
              setIrcServices(updatedServices);
              await settingsService.setSetting('ircServices', updatedServices);
              setNewIrcService('');
            }
          },
        },
        ...ircServices.map(service => ({
          id: `irc-service-${service}`,
          title: service,
          type: 'button' as const,
          onPress: () => {
            Alert.alert(
              'Remove Service',
              `Are you sure you want to remove "${service}"?`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Remove',
                  style: 'destructive',
                  onPress: async () => {
                    const updatedServices = ircServices.filter(s => s !== service);
                    setIrcServices(updatedServices);
                    await settingsService.setSetting('ircServices', updatedServices);
                  },
                },
              ],
            );
          },
        })),
        {
          id: 'user-ignore',
          title: t('Ignore List', { _tags: tags }),
          description: t('Manage ignored users', { _tags: tags }),
          type: 'button' as const,
          onPress: () => {
            if (onShowIgnoreList) {
              onShowIgnoreList();
            } else {
              Alert.alert(
          t('Info', { _tags: tags }),
          t('Ignore list feature coming soon', { _tags: tags }));
            }
          },
        },
        {
          id: 'user-notes',
          title: t('User Notes', { _tags: tags }),
          description: userNotes.length > 0 ? `${userNotes.length} note${userNotes.length !== 1 ? 's' : ''}` : 'No notes yet',
          type: 'submenu' as const,
          submenuItems: userNotes.length === 0
            ? [
                {
                  id: 'user-notes-empty',
                  title: t('No notes saved', { _tags: tags }),
                  type: 'button' as const,
                  disabled: true,
                },
              ]
            : userNotes.map(note => ({
                id: `user-note-${note.network || 'global'}-${note.nick}`,
                title: `${note.nick} (${note.network || 'global'})`,
                description: note.note,
                type: 'button' as const,
                onPress: () => {
                  Alert.alert(
                    'User Note',
                    `${note.nick} @ ${note.network || 'global'}\n\n${note.note}`,
                    [
                      { text: 'Close', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: async () => {
                          await userManagementService.removeUserNote(note.nick, note.network || undefined);
                          setUserNotes(userManagementService.getUserNotes(currentNetwork));
                        },
                      },
                    ]
                  );
                },
              })),
        },
        {
          id: 'user-aliases',
          title: t('User Aliases', { _tags: tags }),
          description: userAliases.length > 0 ? `${userAliases.length} alias${userAliases.length !== 1 ? 'es' : ''}` : 'No aliases yet',
          type: 'submenu' as const,
          submenuItems: userAliases.length === 0
            ? [
                {
                  id: 'user-aliases-empty',
                  title: t('No aliases saved', { _tags: tags }),
                  type: 'button' as const,
                  disabled: true,
                },
              ]
            : userAliases.map(alias => ({
                id: `user-alias-${alias.network || 'global'}-${alias.nick}`,
                title: `${alias.alias} → ${alias.nick}`,
                description: alias.network ? `Network: ${alias.network}` : 'Global',
                type: 'button' as const,
                onPress: () => {
                  Alert.alert(
                    'User Alias',
                    `${alias.alias} → ${alias.nick}\nNetwork: ${alias.network || 'global'}`,
                    [
                      { text: 'Close', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: async () => {
                          await userManagementService.removeUserAlias(alias.nick, alias.network || undefined);
                          setUserAliases(userManagementService.getUserAliases(currentNetwork));
                        },
                      },
                    ]
                  );
                },
              })),
        },
      ],
    },
    {
      title: t('Commands', { _tags: tags }),
      data: [
        {
          id: 'commands-history',
          title: t('Command History', { _tags: tags }),
          description: `${commandHistory.length} commands in history`,
          type: 'submenu' as const,
          submenuItems: [
            ...commandHistory.map((entry) => ({
              id: `history-${entry.id}`,
              title: entry.command,
              description: `${new Date(entry.timestamp).toLocaleString()}${entry.channel ? ` · ${entry.channel}` : ''}`,
              type: 'button' as const,
              onPress: () => {
                Alert.alert(
                  'Delete Entry',
                  `Remove this command?\n\n${entry.command}`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: async () => {
                        await commandService.deleteHistoryEntry(entry.id);
                        setCommandHistory(commandService.getHistory(50));
                      },
                    },
                  ]
                );
              },
            })),
            {
              id: 'history-clear',
              title: t('Clear All History', { _tags: tags }),
              description: t('Delete every command entry', { _tags: tags }),
              type: 'button' as const,
              onPress: () => {
                Alert.alert(
          t('Clear Command History', { _tags: tags }),
          t('Are you sure you want to delete all command history?', { _tags: tags }),
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete All',
                      style: 'destructive',
                      onPress: async () => {
                        await commandService.clearHistory();
                        setCommandHistory([]);
                      },
                    },
                  ]
                );
              },
            },
          ],
        },
        {
          id: 'commands-aliases',
          title: t('Command Aliases', { _tags: tags }),
          description: `${commandAliases.length} aliases configured`,
          type: 'submenu' as const,
          submenuItems: [
            {
              id: 'alias-name-input',
              title: t('Alias Name (without /)', { _tags: tags }),
              type: 'input' as const,
              value: newAliasName,
              placeholder: t('e.g. j', { _tags: tags }),
              onValueChange: setNewAliasName,
            },
            {
              id: 'alias-command-input',
              title: t('Alias Command', { _tags: tags }),
              description: t('Example: /join {channel}', { _tags: tags }),
              type: 'input' as const,
              value: newAliasCommand,
              placeholder: t('e.g. /join {channel}', { _tags: tags }),
              onValueChange: setNewAliasCommand,
            },
            {
              id: 'alias-add',
              title: t('Add Alias', { _tags: tags }),
              description: t('Create or update alias', { _tags: tags }),
              type: 'button' as const,
              onPress: async () => {
                const aliasName = newAliasName.trim().replace(/^\//, '');
                const aliasCmd = newAliasCommand.trim();
                if (!aliasName || !aliasCmd) return;
                await commandService.addAlias({
                  alias: aliasName,
                  command: aliasCmd,
                  description: '',
                });
                setCommandAliases(commandService.getAliases());
                setNewAliasName('');
                setNewAliasCommand('');
              },
            },
            ...commandAliases.map(alias => ({
              id: `alias-${alias.alias}`,
              title: `/${alias.alias}`,
              description: `${alias.command} - ${alias.description || 'No description'}`,
              type: 'button' as const,
              onPress: () => {
                Alert.alert(
                  `Alias: /${alias.alias}`,
                  `Command: ${alias.command}\nDescription: ${alias.description || 'No description'}`,
                  [
                    { text: 'Delete', style: 'destructive', onPress: async () => {
                      await commandService.removeAlias(alias.alias);
                      setCommandAliases(commandService.getAliases());
                    }},
                    { text: 'OK' },
                  ]
                );
              },
            })),
          ],
        },
        {
          id: 'commands-custom',
          title: t('Custom Commands', { _tags: tags }),
          description: `${customCommands.length} custom commands`,
          type: 'submenu' as const,
          submenuItems: [
            {
              id: 'custom-name-input',
              title: t('Command Name (without /)', { _tags: tags }),
              type: 'input' as const,
              value: newCmdName,
              placeholder: t('e.g. greet', { _tags: tags }),
              onValueChange: setNewCmdName,
            },
            {
              id: 'custom-command-input',
              title: t('Command Template', { _tags: tags }),
              description: t('Use {param1}, {channel}, {nick} placeholders', { _tags: tags }),
              type: 'input' as const,
              value: newCmdCommand,
              placeholder: t('e.g. /msg {channel} Hello {param1}', { _tags: tags }),
              onValueChange: setNewCmdCommand,
            },
            {
              id: 'cmd-add',
              title: t('Add Custom Command', { _tags: tags }),
              description: t('Save template with placeholders', { _tags: tags }),
              type: 'button' as const,
              onPress: async () => {
                const cmdName = newCmdName.trim().replace(/^\//, '');
                const cmdString = newCmdCommand.trim();
                if (!cmdName || !cmdString) return;
                const paramMatches = cmdString.match(/\{(\w+)\}/g);
                const parameters = paramMatches
                  ? [...new Set(paramMatches.map(m => m.slice(1, -1)))]
                  : [];
                await commandService.addCustomCommand({
                  name: cmdName,
                  command: cmdString,
                  description: '',
                  parameters: parameters.length > 0 ? parameters : undefined,
                });
                setCustomCommands(commandService.getCustomCommands());
                setNewCmdName('');
                setNewCmdCommand('');
              },
            },
            ...customCommands.map(cmd => ({
              id: `cmd-${cmd.name}`,
              title: `/${cmd.name}`,
              description: `${cmd.command} - ${cmd.description || 'No description'}`,
              type: 'button' as const,
              onPress: () => {
                Alert.alert(
                  `Custom Command: /${cmd.name}`,
                  `Command: ${cmd.command}\nDescription: ${cmd.description || 'No description'}\nParameters: ${cmd.parameters?.join(', ') || 'None'}`,
                  [
                    { text: 'Delete', style: 'destructive', onPress: async () => {
                      await commandService.removeCustomCommand(cmd.name);
                      setCustomCommands(commandService.getCustomCommands());
                    }},
                    { text: 'OK' },
                  ]
                );
              },
            })),
          ],
        },
      ],
    },
    {
      title: t('Message History', { _tags: tags }),
      data: [
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
        },
        {
          id: 'history-export',
          title: t('Export History', { _tags: tags }),
          description: t('Export message history to file', { _tags: tags }),
          type: 'submenu' as const,
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
        },
        {
          id: 'history-storage',
          title: t('Storage Usage', { _tags: tags }),
          description: storageStats ? `${(storageStats.totalBytes / 1024 / 1024).toFixed(2)} MB used` : 'Loading...',
          type: 'button' as const,
          disabled: true,
        },
        {
          id: 'history-backup',
          title: t('Backup & Restore', { _tags: tags }),
          description: t('Backup or restore all app data', { _tags: tags }),
          type: 'button' as const,
          onPress: () => setShowBackupScreen(true),
        },
      ],
    },
    {
      title: t('IRC Bouncer', { _tags: tags }),
      data: [
        {
          id: 'bouncer-info',
          title: t('Bouncer Status', { _tags: tags }),
          description: bouncerInfo
            ? `Type: ${bouncerInfo.type}, Playback: ${bouncerInfo.playbackSupported ? 'Supported' : 'Not supported'}`
            : 'Not connected or not detected',
          type: 'button' as const,
          disabled: true,
        },
        {
          id: 'bouncer-config',
          title: t('Bouncer Settings', { _tags: tags }),
          description: bouncerConfig?.enabled
            ? `${bouncerConfig.type} mode, ${bouncerConfig.handlePlayback ? 'playback enabled' : 'playback disabled'}`
            : 'Configure bouncer support',
          type: 'submenu' as const,
          submenuItems: [
            {
              id: 'bouncer-enabled',
              title: t('Enable Bouncer Support', { _tags: tags }),
              type: 'switch' as const,
              value: bouncerConfig?.enabled || false,
              onValueChange: async (value: boolean) => {
                await bouncerService.setConfig({ enabled: value });
                setBouncerConfig(bouncerService.getConfig());
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
                        await bouncerService.setConfig({ type: 'auto' });
                        setBouncerConfig(bouncerService.getConfig());
                      },
                    },
                    {
                      text: 'ZNC',
                      onPress: async () => {
                        await bouncerService.setConfig({ type: 'znc' });
                        setBouncerConfig(bouncerService.getConfig());
                      },
                    },
                    {
                      text: 'BNC',
                      onPress: async () => {
                        await bouncerService.setConfig({ type: 'bnc' });
                        setBouncerConfig(bouncerService.getConfig());
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
                await bouncerService.setConfig({ handlePlayback: value });
                setBouncerConfig(bouncerService.getConfig());
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
                await bouncerService.setConfig({ markPlaybackMessages: value });
                setBouncerConfig(bouncerService.getConfig());
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
                await bouncerService.setConfig({ skipOldPlayback: value });
                setBouncerConfig(bouncerService.getConfig());
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
                  await bouncerService.setConfig({ playbackTimeout: timeout });
                  setBouncerConfig(bouncerService.getConfig());
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
                  await bouncerService.setConfig({ playbackAgeLimit: age });
                  setBouncerConfig(bouncerService.getConfig());
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
          ],
        },
      ],
    },
    {
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
        },
      ],
    },
    {
      title: t('Background & Battery', { _tags: tags }),
      data: [
        {
          id: 'background-keep-alive',
          title: t('Keep Connection Alive', { _tags: tags }),
          description: t('Maintain IRC connection in background', { _tags: tags }),
          type: 'switch' as const,
          value: backgroundEnabled,
          onValueChange: (value: boolean) => {
            setBackgroundEnabled(value);
            backgroundService.setBackgroundConnectionEnabled(value);
          },
        },
        {
          id: 'background-battery-status',
          title: t('Battery Optimization', { _tags: tags }),
          description: batteryOptEnabledStatus
            ? 'Battery optimization is enabled (may disconnect in background)'
            : 'Battery optimization is disabled (recommended for persistent connection)',
          type: 'button' as const,
          disabled: true,
        },
        {
          id: 'background-battery-settings',
          title: t('Open Battery Settings', { _tags: tags }),
          description: t('Configure battery optimization for this app', { _tags: tags }),
          type: 'button' as const,
          onPress: handleBatteryOptimization,
        },
      ],
    },
    {
      title: t('Scripting & Ads', { _tags: tags }),
      data: [
        {
          id: 'advanced-scripts',
          title: t('Scripts (Scripting Time & No-Ads)', { _tags: tags }),
          description: t('Manage IRC scripts and automation. Scripting time is also ad-free time.', { _tags: tags }),
          type: 'button' as const,
          onPress: () => setShowScripting(true),
        },
        {
          id: 'advanced-scripts-help',
          title: t('Scripting Help', { _tags: tags }),
          description: t('Learn how to write and use scripts', { _tags: tags }),
          type: 'button' as const,
          onPress: () => setShowScriptingHelp(true),
        },
      ],
    },
    {
      title: t('Advanced', { _tags: tags }),
      data: [
        {
          id: 'advanced-dcc',
          title: t('DCC Settings', { _tags: tags }),
          description: `Configure DCC (Ports ${dccMinPort}-${dccMaxPort})`,
          type: 'submenu' as const,
          submenuItems: dccSubmenuItems,
        },
      ],
    },
    {
      title: t('Privacy & Legal', { _tags: tags }),
      data: [
        {
          id: 'my-data-privacy',
          title: t('My Data & Privacy', { _tags: tags }),
          description: t('Export or delete your data (GDPR/CCPA rights)', { _tags: tags }),
          type: 'button' as const,
          onPress: () => setShowDataPrivacy(true),
        },
        {
          id: 'privacy-ads',
          title: t('Privacy & Ads', { _tags: tags }),
          description: t('Manage consent for personalized ads', { _tags: tags }),
          type: 'button' as const,
          onPress: () => setShowPrivacyAds(true),
        },
      ],
    },
    ...(__DEV__
      ? [
          {
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
              },
            ],
          },
        ]
      : []),
    {
      title: aboutTitle,
      data: [
        {
          id: 'about-app',
          title: t('About AndroidIRCX', { _tags: tags }),
          description: t('App information and credits', { _tags: tags }),
          type: 'button' as const,
          onPress: () => setShowAbout(true),
        },
      ],
    },
  ];

  const orderedSections = (() => {
    const premiumSection = sections.find(section => section.title === premiumTitle);
    const connectionSection = sections.find(section => section.title === connectionTitle);
    const remaining = sections.filter(
      section => section.title !== premiumTitle && section.title !== connectionTitle
    );
    if (isSupporter) {
      return [
        ...(connectionSection ? [connectionSection] : []),
        ...remaining,
        ...(premiumSection ? [premiumSection] : []),
      ];
    }
    return [
      ...(premiumSection ? [premiumSection] : []),
      ...(connectionSection ? [connectionSection] : []),
      ...remaining,
    ];
  })();

  const matches = useCallback((text: string | undefined, term: string) =>
    (text || '').toLowerCase().includes(term), []);

  const filteredSections = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return orderedSections;
    return orderedSections
      .map(section => {
        const data = section.data.filter(item => {
          const selfMatch = matches(item.title, term) || matches(item.description, term);
          const subMatch = item.submenuItems?.some(sub => matches(sub.title, term) || matches(sub.description, term));
          return selfMatch || subMatch;
        });
        return data.length > 0 ? { ...section, data } : null;
      })
      .filter(Boolean) as typeof sections;
  }, [orderedSections, searchTerm, matches]);

  const renderSettingItem = (item: SettingItem) => {
    const itemIcon = item.icon || settingIcons[item.id];
    switch (item.type) {
      case 'switch':
        return (
          <View style={styles.settingItem}>
            <View style={styles.settingContent}>
              <View style={styles.settingTitleRow}>
                {!!itemIcon && typeof itemIcon === 'object' && (
                  <Icon
                    name={itemIcon.name}
                    size={16}
                    color={item.disabled ? colors.textSecondary : colors.primary}
                    solid={itemIcon.solid}
                    style={{ marginRight: 8 }}
                  />
                )}
                <Text style={[styles.settingTitle, item.disabled && styles.disabledText]}>
                  {item.title}
                </Text>
              </View>
              {item.description && (
                <Text style={[styles.settingDescription, item.disabled && styles.disabledText]}>
                  {item.description}
                </Text>
              )}
            </View>
            <Switch
              value={item.value as boolean}
              onValueChange={item.onValueChange as (value: boolean) => void}
              disabled={item.disabled}
            />
          </View>
        );

      case 'input':
        return (
          <View style={[styles.settingItem, item.disabled && styles.disabledItem]}>
            <View style={styles.settingContent}>
              <View style={styles.settingTitleRow}>
                {!!itemIcon && typeof itemIcon === 'object' && (
                  <Icon
                    name={itemIcon.name}
                    size={16}
                    color={item.disabled ? colors.textSecondary : colors.primary}
                    solid={itemIcon.solid}
                    style={{ marginRight: 8 }}
                  />
                )}
                <Text style={[styles.settingTitle, item.disabled && styles.disabledText]}>
                  {item.title}
                </Text>
              </View>
              {item.description && (
                <Text style={[styles.settingDescription, item.disabled && styles.disabledText]}>
                  {item.description}
                </Text>
              )}
              <TextInput
                style={[
                  styles.input,
                  item.disabled && styles.disabledInput,
                  { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border },
                ]}
                value={item.value as string}
                onChangeText={(text) => item.onValueChange?.(text)}
                placeholder={item.placeholder}
                placeholderTextColor={colors.textSecondary}
                keyboardType={item.keyboardType || 'default'}
                editable={!item.disabled}
                returnKeyType={item.onPress ? 'done' : 'default'}
                blurOnSubmit={!!item.onPress}
                onSubmitEditing={() => {
                  if (!item.disabled && item.onPress) {
                    item.onPress();
                  }
                }}
              />
            </View>
          </View>
        );

      case 'button':
        return (
          <TouchableOpacity
            style={[styles.settingItem, item.disabled && styles.disabledItem]}
            onPress={item.onPress}
            disabled={item.disabled}>
            <View style={styles.settingContent}>
              <View style={styles.settingTitleRow}>
                {!!itemIcon && typeof itemIcon === 'object' && (
                  <Icon
                    name={itemIcon.name}
                    size={16}
                    color={item.disabled ? colors.textSecondary : colors.primary}
                    solid={itemIcon.solid}
                    style={{ marginRight: 8 }}
                  />
                )}
                <Text style={[styles.settingTitle, item.disabled && styles.disabledText]}>
                  {item.title}
                </Text>
              </View>
              {item.description && (
                <Text style={[styles.settingDescription, item.disabled && styles.disabledText]}>
                  {item.description}
                </Text>
              )}
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        );

      case 'submenu':
        return (
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => setShowSubmenu(item.id)}>
            <View style={styles.settingContent}>
              <View style={styles.settingTitleRow}>
                {!!itemIcon && typeof itemIcon === 'object' && (
                  <Icon
                    name={itemIcon.name}
                    size={16}
                    color={colors.primary}
                    solid={itemIcon.solid}
                    style={{ marginRight: 8 }}
                  />
                )}
                <Text style={styles.settingTitle}>{item.title}</Text>
              </View>
              {item.description && (
                <Text style={styles.settingDescription}>{item.description}</Text>
              )}
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        );

      default:
        return null;
    }
  };

  const toggleSection = (sectionTitle: string) => {
    // Keep "About" and "Scripting & Ads" sections always expanded
    if (sectionTitle === 'About' || sectionTitle === 'Scripting & Ads') {
      return;
    }
    const newExpandedSections = new Set(expandedSections);
    if (newExpandedSections.has(sectionTitle)) {
      newExpandedSections.delete(sectionTitle);
    } else {
      newExpandedSections.add(sectionTitle);
    }
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
  const appPinModalTitle = appPinModalMode === 'setup'
    ? t('Set App PIN', { _tags: tags })
    : t('Confirm App PIN', { _tags: tags });
  const appPinModalDescription = appPinModalMode === 'setup'
    ? t('Create a 4+ digit PIN to lock the app.', { _tags: tags })
    : t('Re-enter your PIN to confirm.', { _tags: tags });
  const appPinModalActionLabel = appPinModalMode === 'setup'
    ? t('Next', { _tags: tags })
    : t('Save', { _tags: tags });

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
          renderItem={({ item }) => renderSettingItem(item)}
          renderSectionHeader={({ section: { title } }) => {
            const iconInfo = getSectionIcon(title);
            return (
              <TouchableOpacity
                onPress={() => toggleSection(title)}
                style={styles.sectionHeader}
                disabled={title === aboutTitle}
              >
                <View style={styles.sectionTitleContainer}>
                  {iconInfo && (
                    <Icon
                      name={iconInfo.name}
                      size={18}
                      color={colors.primary}
                      solid={iconInfo.solid}
                      style={styles.sectionIcon}
                    />
                  )}
                  <Text style={styles.sectionTitle}>{title}</Text>
                </View>
                {title !== aboutTitle && (
                  <Text style={styles.sectionToggle}>{expandedSections.has(title) ? '-' : '+'}</Text>
                )}
              </TouchableOpacity>
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
        <Modal
          visible={appPinModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => closeAppPinModal(false)}>
          <View style={styles.submenuOverlay}>
            <View style={[styles.submenuContainer, { maxHeight: '60%' }]}>
              <View style={styles.submenuHeader}>
                <Text style={styles.submenuTitle}>{appPinModalTitle}</Text>
                <TouchableOpacity onPress={() => closeAppPinModal(false)}>
                  <Text style={styles.closeButtonText}>{t('Close', { _tags: tags })}</Text>
                </TouchableOpacity>
              </View>
              <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                <Text style={styles.submenuItemDescription}>{appPinModalDescription}</Text>
                <TextInput
                  style={[
                    styles.submenuInput,
                    { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border },
                  ]}
                  value={appPinEntry}
                  onChangeText={(text) => {
                    const sanitized = text.replace(/[^0-9]/g, '');
                    setAppPinEntry(sanitized);
                    if (appPinError) setAppPinError('');
                  }}
                  placeholder={t('PIN', { _tags: tags })}
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                  secureTextEntry
                />
                {!!appPinError && (
                  <Text style={[styles.submenuItemDescription, { color: colors.error }]}>{appPinError}</Text>
                )}
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, padding: 16, paddingTop: 0 }}>
                <TouchableOpacity onPress={() => closeAppPinModal(false)}>
                  <Text style={styles.closeButtonText}>{t('Cancel', { _tags: tags })}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleAppPinSubmit}>
                  <Text style={[styles.closeButtonText, { color: colors.primary }]}>{appPinModalActionLabel}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
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
        onSave={(theme) => {
          setCurrentTheme(theme);
          setAvailableThemes(themeService.getAvailableThemes());
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

const createStyles = (colors: any, theme: Theme) => {
  const isDark = theme.id === 'dark';
  const headerBg = colors.surface;
  const sectionBg = colors.surface;
  const sectionText = isDark ? colors.primary : colors.text;

  return StyleSheet.create({
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
    backgroundColor: headerBg,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  closeButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  closeButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '500',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 20,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: colors.surfaceVariant,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: colors.text,
  },
  clearSearch: {
    color: colors.primary,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: sectionBg,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionIcon: {
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: sectionText,
  },
  sectionToggle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: sectionText,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  disabledItem: {
    opacity: 0.5,
  },
  settingContent: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    color: colors.text,
    marginBottom: 4,
  },
  settingTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  settingDescription: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  disabledText: {
    opacity: 0.5,
  },
  chevron: {
    fontSize: 20,
    color: colors.textSecondary,
  },
  submenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  submenuContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
  },
  submenuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  submenuTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  submenuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  submenuItemContent: {
    flex: 1,
  },
  submenuItemText: {
    fontSize: 16,
    color: colors.text,
  },
  submenuItemDescription: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  submenuInput: {
    borderWidth: 1,
    borderRadius: 4,
    padding: 8,
    fontSize: 14,
    marginTop: 8,
    borderColor: colors.border,
    color: colors.text,
    backgroundColor: colors.surfaceVariant,
  },
  input: {
    borderWidth: 1,
    borderRadius: 4,
    padding: 8,
    fontSize: 14,
    marginTop: 8,
    borderColor: colors.border,
    color: colors.text,
    backgroundColor: colors.surfaceVariant,
  },
  disabledInput: {
    opacity: 0.5,
  },
  identityModal: {
    paddingBottom: 12,
  },
  identityModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  identityModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  identityModalSubtitle: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    color: colors.textSecondary,
  },
  identityList: {
    maxHeight: '60%',
  },
  identityItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  identityItemText: {
    fontSize: 16,
    color: colors.text,
  },
  identityItemSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  identityEmpty: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: colors.textSecondary,
  },
  identityDelete: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  identityDeleteText: {
    color: colors.error,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  migrationDialog: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 20,
    width: '85%',
    maxWidth: 400,
    maxHeight: '70%',
  },
  migrationDialogTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  migrationDialogDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  networkList: {
    maxHeight: 200,
    marginBottom: 16,
  },
  networkItem: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
    backgroundColor: colors.background,
  },
  networkItemSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  networkItemText: {
    fontSize: 16,
    color: colors.text,
  },
  networkItemTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  migrationDialogButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  migrationDialogButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  migrationDialogButtonCancel: {
    backgroundColor: colors.surfaceVariant,
  },
  migrationDialogButtonMigrate: {
    backgroundColor: colors.primary,
  },
  migrationDialogButtonDisabled: {
    opacity: 0.5,
  },
  migrationDialogButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  migrationDialogButtonTextMigrate: {
    color: '#FFFFFF',
  },
});
};

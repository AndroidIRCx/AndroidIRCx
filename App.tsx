/**
 * AndroidIRCX - IRC Client
 * @format
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StatusBar,
  StyleSheet,
  View,
  Alert,
  TextInput,
  Modal,
  Text,
  TouchableOpacity,
  BackHandler,
  Platform,
  AppState,
  LogBox,
} from 'react-native';

// ErrorUtils is available globally in React Native
declare const ErrorUtils: {
  getGlobalHandler: () => ((error: Error, isFatal?: boolean) => void) | null;
  setGlobalHandler: (handler: (error: Error, isFatal?: boolean) => void) => void;
};
import RNBootSplash from 'react-native-bootsplash';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import MobileAds from 'react-native-google-mobile-ads';
import { HeaderBar } from './src/components/HeaderBar';
import { keyboardShortcutService } from './src/services/KeyboardShortcutService';

import { ChannelTabs } from './src/components/ChannelTabs';
import { MessageArea } from './src/components/MessageArea';
import { MessageInput } from './src/components/MessageInput';
import { TypingIndicator } from './src/components/TypingIndicator';
import { UserList } from './src/components/UserList';
import { QueryEncryptionMenu } from './src/components/QueryEncryptionMenu';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ircService, IRCMessage, IRCConnectionConfig, ChannelUser, RawMessageCategory, getDefaultRawCategoryVisibility } from './src/services/IRCService';
import { settingsService, IRCNetworkConfig, IRCServerConfig, DEFAULT_SERVER, DEFAULT_PART_MESSAGE, DEFAULT_QUIT_MESSAGE } from './src/services/SettingsService';
import { backgroundService } from './src/services/BackgroundService';
import { notificationService } from './src/services/NotificationService';
import { connectionManager } from './src/services/ConnectionManager';
import { messageHistoryService } from './src/services/MessageHistoryService';
import { channelManagementService } from './src/services/ChannelManagementService';
import { userManagementService } from './src/services/UserManagementService';
import { messageReactionsService } from './src/services/MessageReactionsService';
import { channelFavoritesService } from './src/services/ChannelFavoritesService';
import { autoRejoinService } from './src/services/AutoRejoinService';
import { autoVoiceService } from './src/services/AutoVoiceService';
import { biometricAuthService } from './src/services/BiometricAuthService';
import { secureStorageService } from './src/services/SecureStorageService';
import { ChannelListScreen } from './src/screens/ChannelListScreen';
import { ChannelSettingsScreen } from './src/screens/ChannelSettingsScreen';
import { errorReportingService } from './src/services/ErrorReportingService';
import { connectionProfilesService } from './src/services/ConnectionProfilesService';
import { autoReconnectService } from './src/services/AutoReconnectService';
import { connectionQualityService } from './src/services/ConnectionQualityService';
import { bouncerService } from './src/services/BouncerService';
import { layoutService } from './src/services/LayoutService';
import { commandService } from './src/services/CommandService';
import { performanceService } from './src/services/PerformanceService';
import { logger } from './src/services/Logger';
import { scriptingService } from './src/services/ScriptingService';
import { adRewardService } from './src/services/AdRewardService';
import { NetworksListScreen } from './src/screens/NetworksListScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { IgnoreListScreen } from './src/screens/IgnoreListScreen';
import { FirstRunSetupScreen } from './src/screens/FirstRunSetupScreen';
import { WHOISDisplay } from './src/components/WHOISDisplay';
import { encryptedDMService } from './src/services/EncryptedDMService';
import { channelEncryptionService } from './src/services/ChannelEncryptionService';
import { channelEncryptionSettingsService } from './src/services/ChannelEncryptionSettingsService';
import { ChannelTab } from './src/types';
import { useTheme } from './src/hooks/useTheme';
import { themeService } from './src/services/ThemeService';
import { tabService } from './src/services/TabService';
import { userActivityService } from './src/services/UserActivityService';
import { channelNotesService, ChannelLogEntry } from './src/services/ChannelNotesService';
import { offlineQueueService } from './src/services/OfflineQueueService';
import { dccChatService } from './src/services/DCCChatService';
import { dccFileService } from './src/services/DCCFileService';
import { identityProfilesService, IdentityProfile } from './src/services/IdentityProfilesService';
import { getApp } from '@react-native-firebase/app';
import { initializeAppCheck, ReactNativeFirebaseAppCheckProvider } from '@react-native-firebase/app-check';
import { initTransifex, listenToLocaleChanges, TXProvider, tx, useT } from './src/i18n/transifex';

// Suppress noisy pooled synthetic event warnings that can appear in dev logging
LogBox.ignoreLogs(['This synthetic event is reused for performance reasons.']);

const serverTabId = (network: string) => `server::${network}`;
const channelTabId = (network: string, name: string) => `channel::${network}::${name}`;
const queryTabId = (network: string, name: string) => `query::${network}::${name}`;
const noticeTabId = (network: string) => `notice::${network}`;
const makeServerTab = (network: string): ChannelTab => ({
  id: serverTabId(network),
  name: network,
  type: 'server',
  networkId: network,
  messages: [],
});
const sortTabsGrouped = (tabs: ChannelTab[], sortAlphabetical: boolean = false): ChannelTab[] => {
  const networks: string[] = [];
  tabs.forEach(t => {
    if (!networks.includes(t.networkId)) {
      networks.push(t.networkId);
    }
  });
  const result: ChannelTab[] = [];
  networks.forEach(net => {
    const server = tabs.find(t => t.networkId === net && t.type === 'server');
    if (server) result.push(server);
    const others = tabs.filter(t => t.networkId === net && t.type !== 'server');
    if (sortAlphabetical) {
      others.sort((a, b) => a.name.localeCompare(b.name));
    }
    others.forEach(t => result.push(t));
  });
  return result;
};
function App() {
  // Global error handler to catch crashes
  useEffect(() => {
    // Initialize Firebase App Check using modular API
    const initAppCheck = async () => {
      try {
        const rnfbProvider = new ReactNativeFirebaseAppCheckProvider();
        rnfbProvider.configure({
          android: {
            provider: __DEV__ ? 'debug' : 'playIntegrity',
          },
          apple: {
            provider: __DEV__ ? 'debug' : 'appAttestWithDeviceCheckFallback',
          },
          web: {
            provider: 'reCaptchaV3',
            siteKey: 'none',
          },
        });
        await initializeAppCheck(getApp(), {
          provider: rnfbProvider,
          isTokenAutoRefreshEnabled: true,
        });
      } catch (error) {
        console.warn('App Check initialization failed:', error);
      }
    };
    initAppCheck();
    // Initialize AdMob
    console.log('🚀 Starting AdMob initialization...');
    MobileAds()
      .initialize()
      .then(async (adapterStatuses) => {
        console.log('✅ AdMob initialized successfully');
        console.log('Adapter statuses:', JSON.stringify(adapterStatuses, null, 2));

        // Check if adapters are ready
        const allReady = adapterStatuses.every((adapter: any) => adapter.state === 1);
        if (!allReady) {
          console.warn('⚠️ WARNING: Not all ad adapters are ready!');
          console.warn('This could be due to:');
          console.warn('  - New ad units (wait up to 24 hours)');
          console.warn('  - Network connectivity issues');
          console.warn('  - Google Play Services not updated');
          console.warn('  - Ad units not approved in AdMob console');
        } else {
          console.log('✅ All ad adapters ready!');
        }

        // Initialize AdRewardService after AdMob is ready
        console.log('🔄 Initializing AdRewardService...');
        await adRewardService.initialize();
        console.log('✅ AdRewardService initialized successfully');
      })
      .catch((error) => {
        console.error('❌ Failed to initialize AdMob:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
      });

    errorReportingService.initialize();
    if (typeof ErrorUtils !== 'undefined') {
      const originalHandler = ErrorUtils.getGlobalHandler();
      ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
        console.error('Global error handler:', error, 'isFatal:', isFatal);
        console.error('Error stack:', error.stack);
        errorReportingService.report(error, { fatal: isFatal !== false, source: 'globalErrorHandler' });
        // Try to hide bootsplash even on fatal error
        if (isFatal) {
          RNBootSplash.hide({ fade: false }).catch(() => { });
        }
        if (originalHandler) {
          originalHandler(error, isFatal);
        }
      });

      return () => {
        if (typeof ErrorUtils !== 'undefined' && originalHandler) {
          ErrorUtils.setGlobalHandler(originalHandler);
        }
      };
    }
  }, []);

  useEffect(() => {
    initTransifex().catch(() => {});
    const unsubscribe = listenToLocaleChanges();
    return () => unsubscribe();
  }, []);

  return (
    <TXProvider tx={tx}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor="#2196F3" />
        <AppContent />
      </SafeAreaProvider>
    </TXProvider>
  );
}

function AppContent() {
  const t = useT();
  const { colors } = useTheme();
  const safeAreaInsets = useSafeAreaInsets();
  const styles = createStyles(colors);
  const [isConnected, setIsConnected] = useState(false);
  const [networkName, setNetworkName] = useState('default');
  const [selectedNetworkName, setSelectedNetworkName] = useState<string | null>(null);
  const [showFirstRunSetup, setShowFirstRunSetup] = useState(false);
  const [isCheckingFirstRun, setIsCheckingFirstRun] = useState(true);
  const [ping, setPing] = useState<number | undefined>(undefined);
  const [tabs, setTabs] = useState<ChannelTab[]>([]);
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  // Typing indicator state: Map<channelId, Map<nick, {status, timestamp}>>
  const [typingUsers, setTypingUsers] = useState<Map<string, Map<string, { status: 'active' | 'paused' | 'done'; timestamp: number }>>>(new Map());
  const [appLockEnabled, setAppLockEnabled] = useState(false);
  const [appLockUseBiometric, setAppLockUseBiometric] = useState(false);
  const [appLockUsePin, setAppLockUsePin] = useState(false);
  const [appLockOnLaunch, setAppLockOnLaunch] = useState(true);
  const [appLockOnBackground, setAppLockOnBackground] = useState(true);
  const [appLocked, setAppLocked] = useState(false);
  const [appUnlockModalVisible, setAppUnlockModalVisible] = useState(false);
  const [appPinEntry, setAppPinEntry] = useState('');
  const [appPinError, setAppPinError] = useState('');
  const APP_PIN_STORAGE_KEY = '@AndroidIRCX:app-lock-pin';
  const appStateRef = useRef(AppState.currentState);

  // Fabric crash protection: track if component is mounted
  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Helper to safely set state only when mounted
  const safeSetState = useCallback((fn: () => void) => {
    if (isMountedRef.current) {
      fn();
    }
  }, []);

  const loadAppLockSettings = useCallback(async () => {
    const enabled = await settingsService.getSetting('appLockEnabled', false);
    const useBiometric = await settingsService.getSetting('appLockUseBiometric', false);
    const usePin = await settingsService.getSetting('appLockUsePin', false);
    const lockOnLaunch = await settingsService.getSetting('appLockOnLaunch', true);
    const lockOnBackground = await settingsService.getSetting('appLockOnBackground', true);
    const storedPin = await secureStorageService.getSecret(APP_PIN_STORAGE_KEY);
    const pinEnabled = usePin && Boolean(storedPin);
    safeSetState(() => {
      setAppLockEnabled(enabled && (useBiometric || pinEnabled));
      setAppLockUseBiometric(useBiometric);
      setAppLockUsePin(pinEnabled);
      setAppLockOnLaunch(lockOnLaunch);
      setAppLockOnBackground(lockOnBackground);
      if (enabled && lockOnLaunch) {
        setAppLocked(true);
        setAppUnlockModalVisible(true);
      }
    });
  }, [APP_PIN_STORAGE_KEY, safeSetState]);

  const attemptBiometricUnlock = useCallback(async () => {
    if (!appLockUseBiometric) return false;
    const result = await biometricAuthService.authenticate('Unlock AndroidIRCX', 'Authenticate to unlock the app', 'app');
    if (result.success) {
      safeSetState(() => {
        setAppLocked(false);
        setAppUnlockModalVisible(false);
        setAppPinEntry('');
        setAppPinError('');
      });
    }
    return result.success;
  }, [appLockUseBiometric, safeSetState]);

  const handleAppPinUnlock = useCallback(async () => {
    const stored = await secureStorageService.getSecret(APP_PIN_STORAGE_KEY);
    if (!stored) {
      setAppPinError('No PIN set.');
      return;
    }
    if (appPinEntry.trim() === stored) {
      safeSetState(() => {
        setAppLocked(false);
        setAppUnlockModalVisible(false);
        setAppPinEntry('');
        setAppPinError('');
      });
      return;
    }
    setAppPinError('Incorrect PIN.');
  }, [APP_PIN_STORAGE_KEY, appPinEntry, safeSetState]);

  useEffect(() => {
    loadAppLockSettings();
    const unsubEnabled = settingsService.onSettingChange('appLockEnabled', (v) => setAppLockEnabled(Boolean(v)));
    const unsubBio = settingsService.onSettingChange('appLockUseBiometric', (v) => setAppLockUseBiometric(Boolean(v)));
    const unsubPin = settingsService.onSettingChange('appLockUsePin', (v) => setAppLockUsePin(Boolean(v)));
    const unsubLaunch = settingsService.onSettingChange('appLockOnLaunch', (v) => setAppLockOnLaunch(Boolean(v)));
    const unsubBackground = settingsService.onSettingChange('appLockOnBackground', (v) => setAppLockOnBackground(Boolean(v)));
    const unsubLockNow = settingsService.onSettingChange('appLockNow', () => {
      if (!appLockEnabled) return;
      setAppLocked(true);
      setAppUnlockModalVisible(true);
    });
    return () => {
      unsubEnabled();
      unsubBio();
      unsubPin();
      unsubLaunch();
      unsubBackground();
      unsubLockNow();
    };
  }, [appLockEnabled, loadAppLockSettings]);

  useEffect(() => {
    if (!appLockEnabled) {
      setAppLocked(false);
      setAppUnlockModalVisible(false);
      return;
    }
    const subscription = AppState.addEventListener('change', (nextState) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;
      if (!appLockEnabled) return;
      if (appLockOnBackground && prevState === 'active' && nextState !== 'active') {
        setAppLocked(true);
        setAppUnlockModalVisible(true);
      }
      if (appLockOnLaunch && prevState !== 'active' && nextState === 'active') {
        setAppLocked(true);
        setAppUnlockModalVisible(true);
      }
    });
    return () => subscription.remove();
  }, [appLockEnabled, appLockOnBackground, appLockOnLaunch]);

  useEffect(() => {
    if (!appLocked) return;
    if (appLockUseBiometric) {
      attemptBiometricUnlock();
    }
  }, [appLocked, appLockUseBiometric, attemptBiometricUnlock]);

  useEffect(() => {
    if (appLockEnabled && appLockOnLaunch) {
      setAppLocked(true);
      setAppUnlockModalVisible(true);
    }
  }, [appLockEnabled, appLockOnLaunch]);

  // Reconcile tab encryption flags with stored keys and "always encrypt" settings
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const currentTabs = tabsRef.current;
      const updated = await Promise.all(
        currentTabs.map(async (tab) => {
          if (tab.type === 'channel') {
            const hasKey = await channelEncryptionService.hasChannelKey(tab.name, tab.networkId);
            const alwaysEncrypt = await channelEncryptionSettingsService.getAlwaysEncrypt(tab.name, tab.networkId);

            // Auto-enable sendEncrypted if "always encrypt" is on AND key exists
            const shouldSendEncrypted = alwaysEncrypt && hasKey;

            if (tab.isEncrypted !== hasKey || (!hasKey && tab.sendEncrypted) || (shouldSendEncrypted && !tab.sendEncrypted)) {
              return { ...tab, isEncrypted: hasKey, sendEncrypted: shouldSendEncrypted || (hasKey ? tab.sendEncrypted : false) };
            }
          } else if (tab.type === 'query') {
            const network = tab.networkId || '';
            const hasBundle = await encryptedDMService.isEncryptedForNetwork(network, tab.name);
            const alwaysEncrypt = await channelEncryptionSettingsService.getAlwaysEncrypt(tab.name, tab.networkId);

            // Auto-enable sendEncrypted if "always encrypt" is on AND bundle exists
            const shouldSendEncrypted = alwaysEncrypt && hasBundle;

            if (tab.isEncrypted !== hasBundle || (!hasBundle && tab.sendEncrypted) || (shouldSendEncrypted && !tab.sendEncrypted)) {
              return { ...tab, isEncrypted: hasBundle, sendEncrypted: shouldSendEncrypted || (hasBundle ? tab.sendEncrypted : false) };
            }
          }
          return tab;
        })
      );
      const changed = updated.some((t, idx) => t !== currentTabs[idx]);
      if (changed && !cancelled) {
        setTabs(updated);
      }
    };
    refresh();
    return () => {
      cancelled = true;
    };
  }, [tabs, isConnected]);

  // Listen for "always encrypt" setting changes and update tabs
  useEffect(() => {
    const unsubscribe = channelEncryptionSettingsService.onAlwaysEncryptChange(
      async (channel, network, value) => {
        // Get current tabs
        const currentTabs = tabsRef.current;

        // Update tabs that match the channel/network
        const updated = await Promise.all(
          currentTabs.map(async (tab) => {
            if ((tab.type === 'channel' || tab.type === 'query') &&
                tab.name.toLowerCase() === channel.toLowerCase() &&
                tab.networkId.toLowerCase() === network.toLowerCase()) {
              // Check if key/bundle exists
              const tabNetwork = tab.networkId || '';
              const hasKey = tab.type === 'channel'
                ? await channelEncryptionService.hasChannelKey(tab.name, tab.networkId)
                : await encryptedDMService.isEncryptedForNetwork(tabNetwork, tab.name);

              // Update sendEncrypted based on always encrypt setting and key existence
              const shouldSendEncrypted = value && hasKey;
              return { ...tab, sendEncrypted: shouldSendEncrypted };
            }
            return tab;
          })
        );

        // Check if anything changed
        const changed = updated.some((t, idx) => t !== currentTabs[idx]);
        if (changed) {
          setTabs(updated);
        }
      }
    );

    return () => unsubscribe();
  }, []);

  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(connectionManager.getActiveNetworkId());
  const [primaryNetworkId, setPrimaryNetworkId] = useState<string | null>(null);

  const [activeTabId, setActiveTabId] = useState('');
  const [_showRawCommands, _internalSetShowRawCommands] = useState(true); // Internal state
  const showRawCommands = _showRawCommands; // Expose as read-only for direct use
  const [rawCategoryVisibility, setRawCategoryVisibility] = useState<Record<RawMessageCategory, boolean>>(
    getDefaultRawCategoryVisibility()
  );
  const [hideJoinMessages, setHideJoinMessages] = useState(false);
  const [hidePartMessages, setHidePartMessages] = useState(false);
  const [hideQuitMessages, setHideQuitMessages] = useState(false);
  const [hideIrcServiceListenerMessages, setHideIrcServiceListenerMessages] = useState(false);
  const [autoSwitchPrivate, setAutoSwitchPrivate] = useState(false);
  const [showEncryptionIndicators, setShowEncryptionIndicators] = useState(true);
  const [autoConnectFavoriteServer, setAutoConnectFavoriteServer] = useState(false);
  const autoConnectFavoriteServerRef = useRef(false);
  const [tabSortAlphabetical, setTabSortAlphabetical] = useState(true);
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);

  const pendingAlertRef = useRef<{ title: string; message?: string; buttons?: any } | null>(null);
  const motdCompleteRef = useRef<Set<string>>(new Set());
  const autoConnectAttemptedRef = useRef<Set<string>>(new Set());

  const normalizeRawCategoryVisibility = useCallback(
    (visibility?: Record<RawMessageCategory, boolean>) => ({
      ...getDefaultRawCategoryVisibility(),
      ...(visibility || {}),
    }),
    []
  );

  const persistentSetShowRawCommands = useCallback(
    async (value: boolean) => {
      _internalSetShowRawCommands(value);
      await settingsService.setSetting('showRawCommands', value);
      if (value) {
        const normalized = normalizeRawCategoryVisibility(rawCategoryVisibility);
        setRawCategoryVisibility(normalized);
        await settingsService.setSetting('rawCategoryVisibility', normalized);
      }
    },
    [normalizeRawCategoryVisibility, rawCategoryVisibility]
  );

  const persistentSetRawCategoryVisibility = useCallback(
    async (value: Record<RawMessageCategory, boolean>) => {
      const normalized = normalizeRawCategoryVisibility(value);
      setRawCategoryVisibility(normalized);
      await settingsService.setSetting('rawCategoryVisibility', normalized);
    },
    [normalizeRawCategoryVisibility]
  );

  const persistentSetShowEncryptionIndicators = useCallback(async (value: boolean) => {
    setShowEncryptionIndicators(value);
    await settingsService.setSetting('showEncryptionIndicators', value);
  }, []);

  const safeAlert = useCallback((title: string, message?: string, buttons?: any) => {
    const payload = {
      title: String(title),
      message: message ? String(message) : undefined,
      buttons,
    };
    if (appStateRef.current === 'active') {
      Alert.alert(payload.title, payload.message, payload.buttons);
      return;
    }
    pendingAlertRef.current = payload;
  }, []);

  const handleLockButtonPress = useCallback(() => {
    if (!appLockEnabled) {
      safeAlert(
        t('App lock disabled', { _tags: 'screen:app,file:App.tsx,feature:lock' }),
        t('Enable app lock first.', { _tags: 'screen:app,file:App.tsx,feature:lock' })
      );
      return;
    }
    if (appLocked) {
      if (appLockUseBiometric) {
        attemptBiometricUnlock();
      } else {
        setAppUnlockModalVisible(true);
      }
      return;
    }
    setAppLocked(true);
    setAppUnlockModalVisible(true);
  }, [appLockEnabled, appLockUseBiometric, appLocked, attemptBiometricUnlock, safeAlert, t]);

  useEffect(() => {
  const subscription = AppState.addEventListener('change', (nextState) => {
      appStateRef.current = nextState;
      if (nextState === 'active' && pendingAlertRef.current) {
        const { title, message, buttons } = pendingAlertRef.current;
        pendingAlertRef.current = null;
        Alert.alert(title, message, buttons);
      }
    });
    return () => {
      subscription.remove();
    };
  }, []);

  // Load showRawCommands from settings on mount
  useEffect(() => {
    const loadSetting = async () => {
      const savedValue = await settingsService.getSetting('showRawCommands', true); // Default to true if not set
      _internalSetShowRawCommands(savedValue);
      const savedCategories = await settingsService.getSetting(
        'rawCategoryVisibility',
        getDefaultRawCategoryVisibility()
      );
      setRawCategoryVisibility(normalizeRawCategoryVisibility(savedCategories));
    };
    loadSetting();
    scriptingService.initialize();
  }, [normalizeRawCategoryVisibility]);
  useEffect(() => {
    const loadMessageVisibility = async () => {
      setHideJoinMessages(await settingsService.getSetting('hideJoinMessages', false));
      setHidePartMessages(await settingsService.getSetting('hidePartMessages', false));
      setHideQuitMessages(await settingsService.getSetting('hideQuitMessages', false));
      setHideIrcServiceListenerMessages(await settingsService.getSetting('hideIrcServiceListenerMessages', false));
      setAutoSwitchPrivate(await settingsService.getSetting('autoSwitchPrivate', false));
      setTabSortAlphabetical(await settingsService.getSetting('tabSortAlphabetical', false));
      setShowEncryptionIndicators(await settingsService.getSetting('showEncryptionIndicators', true));
      setAutoConnectFavoriteServer(await settingsService.getSetting('autoConnectFavoriteServer', false));
    };
    loadMessageVisibility();

    const unsubJoin = settingsService.onSettingChange('hideJoinMessages', (v: boolean) => setHideJoinMessages(Boolean(v)));
    const unsubPart = settingsService.onSettingChange('hidePartMessages', (v: boolean) => setHidePartMessages(Boolean(v)));
    const unsubQuit = settingsService.onSettingChange('hideQuitMessages', (v: boolean) => setHideQuitMessages(Boolean(v)));
    const unsubListenerHide = settingsService.onSettingChange(
      'hideIrcServiceListenerMessages',
      (v: boolean) => setHideIrcServiceListenerMessages(Boolean(v))
    );
    const unsubAutoFavorite = settingsService.onSettingChange(
      'autoConnectFavoriteServer',
      (v: boolean) => setAutoConnectFavoriteServer(Boolean(v))
    );
    return () => {
      unsubJoin && unsubJoin();
      unsubPart && unsubPart();
      unsubQuit && unsubQuit();
      unsubListenerHide && unsubListenerHide();
      unsubAutoFavorite && unsubAutoFavorite();
    };
  }, []);

  useEffect(() => {
    autoConnectFavoriteServerRef.current = autoConnectFavoriteServer;
  }, [autoConnectFavoriteServer]);

  const [channelUsers, setChannelUsers] = useState<Map<string, ChannelUser[]>>(new Map());
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [channelName, setChannelName] = useState('');
  const [showNetworksList, setShowNetworksList] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showIgnoreList, setShowIgnoreList] = useState(false);
  const [showWHOIS, setShowWHOIS] = useState(false);
  const [whoisNick, setWhoisNick] = useState<string>('');
  const [showQueryEncryptionMenu, setShowQueryEncryptionMenu] = useState(false);
  const [showChannelList, setShowChannelList] = useState(false);
  const [showUserList, setShowUserList] = useState(true);
  const [showChannelSettings, setShowChannelSettings] = useState(false); // New state for ChannelSettingsScreen
  const [channelSettingsTarget, setChannelSettingsTarget] = useState<string | null>(null); // New state for target channel
  const [channelSettingsNetwork, setChannelSettingsNetwork] = useState<string | null>(null); // New state for target network
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameTargetTabId, setRenameTargetTabId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [showTabOptionsModal, setShowTabOptionsModal] = useState(false);
  const [tabOptionsTitle, setTabOptionsTitle] = useState('');
  const [tabOptions, setTabOptions] = useState<{ text: string; onPress: () => void; style?: 'destructive' | 'cancel' }[]>([]);
  const [showChannelNoteModal, setShowChannelNoteModal] = useState(false);
  const [channelNoteTarget, setChannelNoteTarget] = useState<{ networkId: string; channel: string } | null>(null);
  const [channelNoteValue, setChannelNoteValue] = useState('');
  const [showChannelLogModal, setShowChannelLogModal] = useState(false);
  const [channelLogEntries, setChannelLogEntries] = useState<ChannelLogEntry[]>([]);
  const [prefillMessage, setPrefillMessage] = useState<string | null>(null);
  const [showDccTransfers, setShowDccTransfers] = useState(false);
  const [dccTransfers, setDccTransfers] = useState(dccFileService.list());
  const [showDccSendModal, setShowDccSendModal] = useState(false);
  const [dccSendTarget, setDccSendTarget] = useState<{ nick: string; networkId: string } | null>(null);
  const [dccSendPath, setDccSendPath] = useState('');

  // Get active tab with safe fallback (never create tabs with invalid networkIds)
  const getActiveTabSafe = () => {
    // First, try to find the active tab by ID
    const byId = tabs.find((tab) => tab.id === activeTabId);
    if (byId) return byId;

    // Try to find any server tab
    const serverTab = tabs.find(t => t.type === 'server');
    if (serverTab) return serverTab;

    // Try to get first available tab
    if (tabs[0]) return tabs[0];

    // Last resort: create temporary tab only if we have a valid network
    const validNetworkId = activeConnectionId || primaryNetworkId || (networkName !== 'Not connected' && networkName !== '' ? networkName : null);
    if (validNetworkId) {
      return makeServerTab(validNetworkId);
    }

    // Ultimate fallback: return a minimal safe tab (won't be saved)
    return { id: 'temp', name: 'IRC', type: 'server' as const, networkId: '', messages: [] };
  };

  const activeTab = getActiveTabSafe();
  const activeMessages = activeTab?.messages || [];
  const activeUsers = activeTab.type === 'channel'
    ? (channelUsers.get(activeTab.name) || [])
    : [];

  const appendServerMessage = useCallback((networkId: string, text: string) => {
    // Never create or update tabs for invalid network IDs
    if (!networkId || networkId === 'Not connected') {
      console.warn('⚠️ Prevented server message for invalid networkId:', networkId);
      return;
    }

    const serverId = serverTabId(networkId);
    const now = Date.now();
    const msg: IRCMessage = {
      id: `srv-${now}-${Math.random()}`,
      type: 'raw',
      text,
      timestamp: now,
      isRaw: true,
      network: networkId,
      rawCategory: 'connection',
    };
    setTabs(prev => {
      const existingServer = prev.find(t => t.id === serverId);
      if (existingServer) {
        const updated = prev.map(t => t.id === serverId ? { ...t, messages: [...t.messages, msg] } : t);
        return sortTabsGrouped(updated, tabSortAlphabetical);
      }
      const newServerTab = { ...makeServerTab(networkId), messages: [msg] };
      return sortTabsGrouped([...prev, newServerTab], tabSortAlphabetical);
    });
  }, [tabSortAlphabetical]);

  // Helper functions to get active services (either from ConnectionManager or singleton)
  const getActiveIRCService = useCallback(() => {
    const activeConnection = connectionManager.getActiveConnection();
    return activeConnection ? activeConnection.ircService : ircService;
  }, []);

  const getActiveUserManagementService = useCallback(() => {
    const activeConnection = connectionManager.getActiveConnection();
    return activeConnection ? activeConnection.userManagementService : userManagementService;
  }, []);

  const getActiveCommandService = useCallback(() => {
    const activeConnection = connectionManager.getActiveConnection();
    return activeConnection ? activeConnection.commandService : commandService;
  }, []);

  const getActiveConnectionQualityService = useCallback(() => {
    const activeConnection = connectionManager.getActiveConnection();
    return activeConnection ? activeConnection.connectionQualityService : connectionQualityService;
  }, []);

  const getActiveChannelManagementService = useCallback(() => {
    const activeConnection = connectionManager.getActiveConnection();
    return activeConnection ? activeConnection.channelManagementService : channelManagementService;
  }, []);

  const normalizeNetworkId = useCallback((id: string) => id.replace(/\s+\(\d+\)$/, ''), []);

  const getNetworkConfigForId = useCallback(async (networkId: string) => {
    if (!networkId) return null;
    const networks = await settingsService.loadNetworks();
    const normalized = normalizeNetworkId(networkId);
    return (
      networks.find(n => n.name === networkId || n.id === networkId) ||
      networks.find(n => n.name === normalized || n.id === normalized) ||
      null
    );
  }, [normalizeNetworkId]);

  // Initialize theme service on mount
  useEffect(() => {
    try {
      themeService.initialize();
    } catch (error) {
      console.error('Error initializing theme service:', error);
    }
  }, []);

  // Hide bootsplash when app is ready - delay until after all initialization
  useEffect(() => {
    const init = async () => {
      try {
        // Wait longer to ensure app is fully initialized and rendered
        await new Promise<void>(resolve => setTimeout(resolve, 500));
        await scriptingService.initialize();
        // Only hide if component is still mounted
        await RNBootSplash.hide({ fade: true });
      } catch (error) {
        console.error('Error hiding bootsplash:', error);
        // Try to hide without fade as fallback
        try {
          await new Promise<void>(resolve => setTimeout(resolve, 100));
          await RNBootSplash.hide({ fade: false });
        } catch (e) {
          console.error('Error hiding bootsplash (fallback):', e);
          // Last resort - try without any options
          try {
            await RNBootSplash.hide();
          } catch (finalError) {
            console.error('Error hiding bootsplash (final fallback):', finalError);
          }
        }
      }
    };
    // Delay initialization slightly to ensure React Native is ready
    const timeout = setTimeout(init, 100);
    return () => clearTimeout(timeout);
  }, []);

  // Initialize message reactions service on mount
  useEffect(() => {
    messageReactionsService.initialize();
  }, []);

  // Initialize channel favorites service on mount
  useEffect(() => {
    channelFavoritesService.initialize();
  }, []);

  // Initialize auto-rejoin and auto-voice services on mount
  useEffect(() => {
    autoRejoinService.initialize();
    autoVoiceService.initialize();
  }, []);

  // Initialize connection profiles service on mount
  useEffect(() => {
    connectionProfilesService.initialize();
  }, []);

  // Initialize auto-reconnect service on mount
  useEffect(() => {
    autoReconnectService.initialize();
  }, []);

  // Initialize connection quality service on mount
  useEffect(() => {
    // Services will be initialized per-connection via ConnectionManager
    // Keep singleton initialization for backward compatibility
    connectionQualityService.setIRCService(ircService);
    connectionQualityService.initialize();
  }, []);

  // Initialize bouncer service on mount
  useEffect(() => {
    bouncerService.initialize();
  }, []);

  // Initialize layout service on mount
  useEffect(() => {
    layoutService.initialize();
  }, []);

  // Initialize command service on mount
  useEffect(() => {
    // Services will be initialized per-connection via ConnectionManager
    // Keep singleton initialization for backward compatibility
    commandService.setIRCService(ircService);
    commandService.initialize();
  }, []);

  // Initialize performance service on mount
  useEffect(() => {
    performanceService.initialize();
  }, []);

  // Listen for layout config changes
  const [layoutConfig, setLayoutConfig] = useState(layoutService.getConfig());
  useEffect(() => {
    const unsubscribe = layoutService.onConfigChange((config) => {
      setLayoutConfig(config);
    });
    return unsubscribe;
  }, []);

  // Register keyboard shortcuts for navigation and tab switching
  useEffect(() => {
    const nextTab = () => {
      setActiveTabId(prev => {
        const currentTabs = tabsRef.current;
        const idx = currentTabs.findIndex(t => t.id === prev);
        const nextIdx = (idx + 1) % currentTabs.length;
        return currentTabs[nextIdx].id;
      });
    };
    const prevTab = () => {
      setActiveTabId(prev => {
        const currentTabs = tabsRef.current;
        const idx = currentTabs.findIndex(t => t.id === prev);
        const prevIdx = (idx - 1 + currentTabs.length) % currentTabs.length;
        return currentTabs[prevIdx].id;
      });
    };
    const openAdd = () => setShowChannelModal(true);
    const openSettings = () => setShowSettings(true);
    keyboardShortcutService.registerShortcut('Ctrl+Tab', nextTab);
    keyboardShortcutService.registerShortcut('Ctrl+Shift+Tab', prevTab);
    keyboardShortcutService.registerShortcut('Ctrl+N', openAdd);
    keyboardShortcutService.registerShortcut('Ctrl+S', openSettings);
    return () => {
      keyboardShortcutService.unregisterShortcut('Ctrl+Tab', nextTab);
      keyboardShortcutService.unregisterShortcut('Ctrl+Shift+Tab', prevTab);
      keyboardShortcutService.unregisterShortcut('Ctrl+N', openAdd);
      keyboardShortcutService.unregisterShortcut('Ctrl+S', openSettings);
    };
  }, []);

  // Initialize background service and notifications on mount
  useEffect(() => {
    const initBackgroundService = async () => {
      try {
        await notificationService.initialize();
      } catch (error) {
        console.error('Error initializing notification service:', error);
        // Continue even if notification setup fails
      }

      try {
        await backgroundService.initialize();
      } catch (error) {
        console.error('Error initializing background service:', error);
        // Continue without background service if it fails
      }
    };
    initBackgroundService();

    // Initialize channel management service
    try {
      channelManagementService.initialize();
    } catch (error) {
      console.error('Error initializing channel management service:', error);
    }

    // Initialize user management service
    try {
      // Services will be initialized per-connection via ConnectionManager
      // Keep singleton initialization for backward compatibility
      userManagementService.setIRCService(ircService);
      userManagementService.initialize();
    } catch (error) {
      console.error('Error initializing user management service:', error);
    }

    return () => {
      try {
        backgroundService.cleanup();
      } catch (error) {
        console.error('Error cleaning up background service:', error);
      }
    };
  }, []);

  // Check for first run and show setup if needed
  useEffect(() => {
    const checkFirstRun = async () => {
      try {
        const isFirstRun = await settingsService.isFirstRun();
        setShowFirstRunSetup(isFirstRun);
        setIsCheckingFirstRun(false);
      } catch (error) {
        console.error('Error checking first run:', error);
        setIsCheckingFirstRun(false);
      }
    };
    checkFirstRun();
  }, []);

  // Load default network name and initial tabs on mount (skip if first run)
  useEffect(() => {
    if (isCheckingFirstRun || showFirstRunSetup) {
      return; // Don't load data if we're showing first run setup
    }

    const loadInitialData = async () => {
      let initialNetworkName = 'default';
      try {
        const networks = await settingsService.loadNetworks();
        if (networks.length > 0) {
          const dbaseNetwork = networks.find(n => n.name === 'DBase');
          const networkToUse = dbaseNetwork || networks.find(n => n.servers && n.servers.length > 0) || networks[0];
          if (networkToUse && networkToUse.name) {
            initialNetworkName = networkToUse.name;
          }
        }
        setSelectedNetworkName(initialNetworkName);
        setNetworkName(initialNetworkName);
        setPrimaryNetworkId(prev => prev || initialNetworkName);

        // Clean up any old "Not connected" tabs from storage
        try {
          await AsyncStorage.removeItem('TABS_Not connected');
          console.log('✅ Cleaned up old "Not connected" tabs from storage');
        } catch (err) {
          console.warn('Failed to clean up "Not connected" tabs:', err);
        }

        // Load tabs for the network
        const loadedTabs = await tabService.getTabs(initialNetworkName);
        // Filter out any "Not connected" tabs from storage
        const tabsNormalized = loadedTabs
          .filter(tab => tab.networkId !== 'Not connected' && tab.name !== 'Not connected')
          .map(tab => ({
            ...tab,
            networkId: tab.networkId || initialNetworkName,
            id: tab.id.includes('::') ? tab.id : (tab.type === 'server' ? serverTabId(initialNetworkName) : tab.id),
          }));
        const ensuredServer = tabsNormalized.some(t => t.type === 'server') ? tabsNormalized : [makeServerTab(initialNetworkName), ...tabsNormalized];
        
        // Load message history for each tab
        const tabsWithHistory = await Promise.all(
          ensuredServer.map(async (tab) => {
            // Use 'server' for server tabs, tab.name for channels/queries
            const channelKey = tab.type === 'server' ? 'server' : tab.name;
            const history = await messageHistoryService.loadMessages(tab.networkId, channelKey);
            return { ...tab, messages: history };
          })
        );
        
        setTabs(tabsWithHistory);
        const initialServerId = serverTabId(initialNetworkName);
        setActiveTabId(initialServerId);

      } catch (error) {
        console.error('Error loading initial data:', error);
        // Set default tabs on error
        const fallback = makeServerTab('default');
        setTabs([fallback]);
        setPrimaryNetworkId(prev => prev || fallback.networkId);
        setActiveTabId(fallback.id);
      }
    };
    loadInitialData().finally(() => setInitialDataLoaded(true));
  }, [isCheckingFirstRun, showFirstRunSetup]);

  // Clean up invalid tabs from state
  useEffect(() => {
    const invalidTabs = tabs.filter(t =>
      t.name === 'Not connected' ||
      t.networkId === 'Not connected' ||
      t.networkId === '' ||
      !t.networkId
    );

    if (invalidTabs.length > 0) {
      console.log('🔴 WARNING: Found invalid tabs, removing:', invalidTabs.map(t => ({ id: t.id, name: t.name, networkId: t.networkId })));
      console.trace('Stack trace for invalid tab detection');

      // Remove invalid tabs immediately
      setTabs(prev => prev.filter(t =>
        t.name !== 'Not connected' &&
        t.networkId !== 'Not connected' &&
        t.networkId !== '' &&
        t.networkId
      ));
    }
  }, [tabs]);

  // Save tabs whenever they change
  useEffect(() => {
    const networks = Array.from(new Set(tabs.map(t => t.networkId)));
    networks.forEach(net => {
      // Skip saving for invalid network IDs
      if (!net || net === 'Not connected' || net === '') {
        return;
      }
      const netTabs = tabs.filter(t => t.networkId === net);
      if (net && netTabs.length > 0) {
        tabService.saveTabs(net, netTabs);
      }
    });
  }, [tabs]);

  // Ensure the server tab reflects the current network name for clarity
  useEffect(() => {
    if (networkName && networkName !== 'Not connected') {
      setTabs((prev) =>
        prev.map((tab) =>
          tab.type === 'server' && tab.networkId === networkName ? { ...tab, name: networkName } : tab
        )
      );
    }
  }, [networkName]);

  useEffect(() => {
    // Update user management service with current network
    if (networkName && networkName !== 'Not connected') {
      const activeUserMgmt = getActiveUserManagementService();
      activeUserMgmt.setNetwork(networkName);
    }
  }, [networkName, getActiveUserManagementService]);

  useEffect(() => {
    console.log('App: Setting up IRC listeners');

    const connectionTargets = connectionManager.getAllConnections();
    const listenerTargets = connectionTargets.length > 0
      ? connectionTargets.map(ctx => ({
        id: ctx.networkId,
        ircService: ctx.ircService,
        userManagementService: ctx.userManagementService,
        managed: true,
      }))
      : [{
        id: ircService.getNetworkName(),
        ircService,
        userManagementService,
        managed: false,
      }];

    // Sync initial connection state in case connect events happened before listeners attached
    const anyConnected = listenerTargets.some(t => t.ircService.getConnectionStatus());
    setIsConnected(anyConnected);
    const currentConnectionId = connectionManager.getActiveNetworkId();
    if (currentConnectionId) {
      setNetworkName(currentConnectionId);
    }

    const unsubscribers: Array<() => void> = [];

    listenerTargets.forEach(target => {
      const activeIRCService = target.ircService;
      const activeUserMgmt = target.userManagementService;

      // Listen for messages per connection
      const unsubscribeMessages = activeIRCService.onMessage(async (message: IRCMessage) => {
      //console.log(`App: Received message - Type: ${message.type}, Channel: ${message.channel || 'N/A'}, Text: ${message.text?.substring(0, 30) || 'N/A'}`);
      // Check if user is ignored (filter messages from ignored users)
      if (message.from && message.type === 'message') {
        const isIgnored = activeUserMgmt.isUserIgnored(
          message.from,
          undefined, // username not available in message
          undefined, // hostname not available in message
          message.network || activeIRCService.getNetworkName() || undefined
        );
        if (isIgnored) {
          return; // Skip ignored user messages
        }
      }

      const noticeTargetPref = await settingsService.getSetting('noticeTarget', 'server'); // 'active' | 'server' | 'private' | 'notice'
      const currentActiveTab = tabsRef.current.find(t => t.id === activeTabId);
      const isSameNetworkAsActive =
        !!(currentActiveTab && messageNetwork && currentActiveTab.networkId?.toLowerCase() === messageNetwork.toLowerCase());

      const messageNetwork = message.network || activeIRCService.getNetworkName();
      scriptingService.handleMessage(message);

      // Handle DCC CHAT invites (CTCP)
      const dccInvite = dccChatService.parseDccChatInvite(message.text);
      if (dccInvite && message.from) {
        const session = dccChatService.handleIncomingInvite(message.from, messageNetwork, dccInvite.host, dccInvite.port);
        safeAlert(
          'DCC Chat Request',
          `${message.from} wants to start a DCC chat. Accept?`,
          [
            { text: 'Decline', style: 'cancel', onPress: () => dccChatService.closeSession(session.id) },
            { text: 'Accept', onPress: () => dccChatService.acceptInvite(session.id, activeIRCService) },
          ]
        );
      }
      // Handle DCC SEND offers
      const dccSend = dccFileService.parseSendOffer(message.text);
      if (dccSend && message.from) {
        const transfer = dccFileService.handleOffer(message.from, messageNetwork, dccSend);
        safeAlert(
          'DCC SEND Offer',
          `${message.from} offers "${dccSend.filename}" (${dccSend.size || '?'} bytes). Accept?`,
          [
            { text: 'Decline', style: 'cancel', onPress: () => dccFileService.cancel(transfer.id) },
            {
              text: 'Accept',
              onPress: async () => {
                // Default download path
                const RNFS = require('react-native-fs');
                const path = `${RNFS.DocumentDirectoryPath}/${dccSend.filename}`;
                await dccFileService.accept(transfer.id, activeIRCService, path);
              },
            },
          ]
        );
      }

      // Track lightweight user activity
      switch (message.type) {
        case 'message':
        case 'notice':
          userActivityService.recordEvent(message.from, messageNetwork, message.type, {
            channel: message.channel,
            text: message.text,
          });
          if (message.channel) {
            channelNotesService.addLogEntry(messageNetwork, message.channel, {
              timestamp: message.timestamp,
              text: `${message.from || 'server'}: ${message.text}`,
            });
          }
          break;
        case 'join':
        case 'part':
          userActivityService.recordEvent(message.from, messageNetwork, message.type, {
            channel: message.channel,
            text: message.text,
          });
          if (message.channel) {
            channelNotesService.addLogEntry(messageNetwork, message.channel, {
              timestamp: message.timestamp,
              text: `${message.from || 'user'} ${message.type}ed ${message.channel}`,
            });
          }
          break;
        case 'quit':
        case 'nick':
        case 'monitor':
          userActivityService.recordEvent(message.from, messageNetwork, message.type, {
            text: message.text,
          });
          if (message.channel) {
            channelNotesService.addLogEntry(messageNetwork, message.channel, {
              timestamp: message.timestamp,
              text: `${message.from || 'user'} ${message.type}${message.text ? `: ${message.text}` : ''}`,
            });
          }
          break;
        default:
          break;
      }

      // Save message to history
      if (isConnected && messageNetwork && messageNetwork !== 'Not connected') {
        messageHistoryService.saveMessage(message, messageNetwork).catch(err => {
          console.error('Error saving message to history:', err);
        });
      }

      // If someone asks us for a channel key, prefill the share command and switch to that channel
      if (message.text) {
        const requestMatch = message.text.match(/Please share the channel key for (\S+) with \/chankey share (\S+)/i);
        if (requestMatch) {
          const [, requestedChannel, requesterNick] = requestMatch;
          const chanTabId = channelTabId(messageNetwork, requestedChannel);
          const targetTab = tabsRef.current.find(t => t.id === chanTabId);
          if (targetTab) {
            safeSetState(() => setActiveTabId(chanTabId));
            safeSetState(() => setNetworkName(messageNetwork));
          }
          safeSetState(() => setPrefillMessage(`/chankey share ${requesterNick}`));
        }
      }

      const currentNick = activeIRCService.getCurrentNick();
      // Re-route service replies (e.g., ChanServ) so they follow notice routing rules and don’t spawn new tabs
      const serviceSenders = new Set([
        'chanserv', 'nickserv', 'operserv', 'memoserv', 'authserv', 'hostserv', 'globop',
        'q', 'l', 'n', 'x', '*status', 'statserv', 'rootserv', 'uworld', 'global'
      ]);
      const fromLower = (message.from || '').toLowerCase();
      const channelLower = (message.channel || '').toLowerCase();
      const isService = serviceSenders.has(fromLower) || serviceSenders.has(channelLower);
      const isToCurrentNick = message.channel && channelLower === currentNick.toLowerCase();
      if (isService && (message.type === 'message' || message.type === 'notice') && (isToCurrentNick || !message.channel || serviceSenders.has(channelLower))) {
        message.type = 'notice';
        // Force channel to a stable service id so notice routing can work but does not create a query tab
        const serviceName = fromLower || channelLower || 'service';
        message.channel = undefined; // do not create a query tab
        message.from = message.from || serviceName;
      }
      const isRawOrServerMessage = message.isRaw || message.type === 'raw' || message.type === 'invite' || message.type === 'monitor' || (message.text && message.text.startsWith('***'));

      let targetTabId: string = serverTabId(messageNetwork);
      let targetTabType: ChannelTab['type'] = 'server';

      const isNotice = message.type === 'notice';
      const isChannelNotice = isNotice && message.channel && (message.channel.startsWith('#') || message.channel.startsWith('&'));
      const isDirectNotice = isNotice && !isChannelNotice;

      if (isDirectNotice) {
        if (noticeTargetPref === 'active' && currentActiveTab && isSameNetworkAsActive) {
          targetTabId = currentActiveTab.id;
          targetTabType = currentActiveTab.type;
        } else if (noticeTargetPref === 'notice') {
          targetTabId = noticeTabId(messageNetwork);
          targetTabType = 'channel';
        } else if (noticeTargetPref === 'private') {
          const queryName = (message.from === currentNick) ? (message.channel || message.from || '') : (message.from || message.channel || '');
          targetTabId = queryTabId(messageNetwork, queryName || 'notice');
          targetTabType = 'query';
        } else {
          targetTabId = serverTabId(messageNetwork);
          targetTabType = 'server';
        }
        // Avoid creating new tabs based on the notice target nick
        message.channel = undefined;
      } else if (!isRawOrServerMessage && message.channel) {
        const isChannel = message.channel.startsWith('#') || message.channel.startsWith('&');
        if (isChannel) {
          targetTabId = channelTabId(messageNetwork, message.channel);
          targetTabType = 'channel';
        } else {
          const queryName = (message.from === currentNick) ? message.channel : message.from || message.channel;
          targetTabId = queryTabId(messageNetwork, queryName);
          targetTabType = 'query';
        }
      }

      let newTabIsEncrypted = false;
      if (targetTabType === 'channel' && message.channel) {
        newTabIsEncrypted = await channelEncryptionService.hasChannelKey(message.channel, messageNetwork);
      } else if (targetTabType === 'query') {
        const qn = (message.from === currentNick ? message.channel || message.from || targetTabId : message.from || message.channel || targetTabId);
        newTabIsEncrypted = await encryptedDMService.isEncryptedForNetwork(messageNetwork, qn);
      }

      let joinHasKey: boolean | null = null;
      if (message.type === 'join' && message.from === currentNick && message.channel && targetTabType === 'channel') {
        joinHasKey = await channelEncryptionService.hasChannelKey(message.channel, messageNetwork);
      }
safeSetState(() => {
  setTabs(prevTabs => {
    let newTabs = [...prevTabs];

    const hasValidNetwork =
      messageNetwork &&
      messageNetwork !== 'Not connected' &&
      messageNetwork !== '';

    /* ----------------------------------------
     * Ensure required tabs exist
     * -------------------------------------- */

    if (hasValidNetwork) {
      const serverId = serverTabId(messageNetwork);

      if (!newTabs.some(t => t.id === serverId)) {
        newTabs.push(makeServerTab(messageNetwork));
      }

      if (
        targetTabId === noticeTabId(messageNetwork) &&
        !newTabs.some(t => t.id === targetTabId)
      ) {
        newTabs.push({
          id: targetTabId,
          name: 'Notices',
          type: 'channel',
          networkId: messageNetwork,
          messages: [],
        });
      }
    }

    /* ----------------------------------------
     * Resolve target tab
     * -------------------------------------- */

    const tabIndex = newTabs.findIndex(t => t.id === targetTabId);

    if (tabIndex === -1) {
      if (hasValidNetwork) {
        // Create missing tab
        const newTab: ChannelTab = {
          id: targetTabId,
          name:
            targetTabType === 'server'
              ? messageNetwork
              : (message.channel || message.from || targetTabId),
          type: targetTabType,
          networkId: messageNetwork,
          messages: [message],
          isEncrypted: newTabIsEncrypted,
          sendEncrypted: false,
        };

        newTabs.push(newTab);

        if (targetTabType !== 'server') {
          setActiveTabId(targetTabId);
          setNetworkName(messageNetwork);
        }
      }
      // else: invalid / init message → ignore silently
    } else {
      // Update existing tab
      const tabToUpdate = newTabs[tabIndex];
      const newMessages = [...tabToUpdate.messages, message];

      const perfConfig = performanceService.getConfig();
      const messagesFinal =
        perfConfig.enableMessageCleanup &&
        newMessages.length > perfConfig.cleanupThreshold
          ? newMessages.slice(-perfConfig.messageLimit)
          : newMessages;

      const shouldAutoSwitch =
        autoSwitchPrivate &&
        tabToUpdate.type === 'query' &&
        message.from !== currentNick;

      newTabs[tabIndex] = {
        ...tabToUpdate,
        messages: messagesFinal,
        hasActivity:
          tabToUpdate.id !== activeTabId
            ? true
            : tabToUpdate.hasActivity,
      };

      if (shouldAutoSwitch) {
        setActiveTabId(tabToUpdate.id);
        setNetworkName(tabToUpdate.networkId);
      }
    }

    /* ----------------------------------------
     * JOIN encryption post-processing
     * -------------------------------------- */

    if (
      joinHasKey !== null &&
      message.channel &&
      targetTabType === 'channel'
    ) {
      const idx = newTabs.findIndex(t => t.id === targetTabId);

      if (idx !== -1) {
        const existing = newTabs[idx];
        newTabs[idx] = {
          ...existing,
          isEncrypted: joinHasKey,
          sendEncrypted: joinHasKey
            ? existing.sendEncrypted
            : false,
        };
      }

      activeIRCService.addMessage({
        type: 'notice',
        channel: message.channel,
        text: joinHasKey
          ? `🔒 Channel key stored for ${message.channel}`
          : `🔓 No channel key stored for ${message.channel}`,
        timestamp: Date.now(),
      });
    }

    return sortTabsGrouped(newTabs, tabSortAlphabetical);
  });
});


    });

      // Listen for connection changes
      const unsubscribeConnection = activeIRCService.onConnectionChange((connected: boolean) => {
      const connections = connectionManager.getAllConnections();
      const anyConn = connections.length > 0
        ? connections.some(c => c.ircService.getConnectionStatus())
        : connected;
      safeSetState(() => setIsConnected(anyConn));
      const currentConnectionId = connectionManager.getActiveNetworkId();
      safeSetState(() => setActiveConnectionId(currentConnectionId));
      if (connected) {
        offlineQueueService.processQueue();
        // Keep using the logical network id for UI/tab grouping
        if (currentConnectionId) {
          safeSetState(() => setNetworkName(currentConnectionId));
        }
        if (currentConnectionId) {
          const serverId = serverTabId(currentConnectionId);
          safeSetState(() => {
            setTabs(prev => {
              const exists = prev.some(t => t.id === serverId);
          const updated = exists ? prev : sortTabsGrouped([...prev, makeServerTab(currentConnectionId)], tabSortAlphabetical);
              return updated;
            });
          });
          if (!activeTabId || !tabsRef.current.some(t => t.id === activeTabId)) {
            safeSetState(() => setActiveTabId(serverId));
          }
        }
        // Background service will handle keeping connection alive
      } else {
        // Keep current network name when disconnected - don't switch to "Not connected" tab
        // Clear user lists on disconnect
        safeSetState(() => setChannelUsers(new Map()));
        if (currentConnectionId) {
          userActivityService.clearNetwork(currentConnectionId);
        }
      }
    });

      const unsubscribeRegistered = activeIRCService.on('registered', async () => {
      const netId = connectionManager.getActiveNetworkId() || activeIRCService.getNetworkName();
      if (!netId || netId === 'Not connected') return;
      const netConfig = await settingsService.getNetwork(netId);
      if (!netConfig) return;
      // OPER (only if user provided oper password)
      if (netConfig.operPassword) {
        const operUser =
          netConfig.operUser?.trim() ||
          activeIRCService.getCurrentNick() ||
          netConfig.nick;
        activeIRCService.sendRaw(`OPER ${operUser} ${netConfig.operPassword}`);
      }
    });

      // Fallback NickServ IDENTIFY for singleton mode (ConnectionManager connections handle this internally)
      let unsubscribeMotd: (() => void) | undefined;
      if (!target.managed) {
        unsubscribeMotd = activeIRCService.on('motdEnd', async () => {
        const netId = connectionManager.getActiveNetworkId() || activeIRCService.getNetworkName();
        if (!netId || netId === 'Not connected') return;
        const netConfig = await settingsService.getNetwork(netId);
        if (!netConfig) return;
        if (netConfig.nickservPassword) {
          activeIRCService.sendRaw(`PRIVMSG NickServ :IDENTIFY ${netConfig.nickservPassword}`);
        }
        motdCompleteRef.current.add(netId);
        setMotdSignal(signal => signal + 1);
      });
      }
      const unsubscribeMotdAny = activeIRCService.on('motdEnd', () => {
      const netId = connectionManager.getActiveNetworkId() || activeIRCService.getNetworkName();
      if (netId && netId !== 'Not connected') {
        motdCompleteRef.current.add(netId);
        setMotdSignal(signal => signal + 1);
      }
    });

      // Listen for user list changes
      const unsubscribeUserList = activeIRCService.onUserListChange((channel: string, users: ChannelUser[]) => {
      safeSetState(() => {
        setChannelUsers((prev) => {
          const newMap = new Map(prev);
          newMap.set(channel, users);
          return newMap;
        });
      });
    });

      // Listen for encryption key exchanges to update tab encryption status
      const unsubscribeEncryption = encryptedDMService.onBundleStored((nick: string) => {
      safeSetState(() => {
        setTabs((prev) =>
          prev.map((tab) => {
            if (tab.type === 'query' && tab.name.toLowerCase() === nick.toLowerCase()) {
              return { ...tab, isEncrypted: true };
            }
            return tab;
          })
        );
      });
    });

      // Listen for incoming encryption key offers (require user acceptance)
      const unsubscribeKeyRequests = encryptedDMService.onKeyRequest((nick: string, _bundle, meta) => {
      const newFingerprint = encryptedDMService.formatFingerprintForDisplay(meta.newFingerprint);
      const existingFingerprint = meta.existingFingerprint
        ? encryptedDMService.formatFingerprintForDisplay(meta.existingFingerprint)
        : 'None';
      const isChange = meta.reason === 'change' || meta.reason === 'legacy';
      const title = isChange ? 'Encryption Key Change' : 'Encryption Key Offer';
      const message = isChange
        ? `WARNING: ${nick} sent a different encryption key.\n\nOld: ${existingFingerprint}\nNew: ${newFingerprint}\n\nOnly replace if you verified the change out-of-band.`
        : `${nick} wants to enable encrypted messaging.\n\nFingerprint: ${newFingerprint}\n\nVerify out-of-band before trusting.`;
      safeAlert(
        title,
        message,
        [
          {
            text: isChange ? 'Keep Existing' : 'Reject',
            style: 'cancel',
            onPress: async () => {
              const network = activeIRCService.getNetworkName();
              await encryptedDMService.rejectKeyOfferForNetwork(network, nick);
              activeIRCService.sendRaw(`PRIVMSG ${nick} :!enc-reject`);
            }
          },
          {
            text: isChange ? 'Replace Key' : 'Accept',
            onPress: async () => {
              try {
                const network = activeIRCService.getNetworkName();
                const ourBundle = await encryptedDMService.acceptKeyOfferForNetwork(network, nick, isChange);
                activeIRCService.sendRaw(`PRIVMSG ${nick} :!enc-accept ${JSON.stringify(ourBundle)}`);
                activeIRCService.addMessage({
                  type: 'notice',
                  text: `*** Encryption key ${isChange ? 'replaced' : 'accepted'} from ${nick}. Encrypted chat enabled.`,
                  timestamp: Date.now(),
                });
              } catch (e: any) {
                activeIRCService.addMessage({
                  type: 'error',
                  text: `*** Failed to accept key: ${e.message}`,
                  timestamp: Date.now(),
                });
              }
            }
          },
        ]
      );
      });

      // Listen for channel encryption key changes to update tab encryption status
      const unsubscribeChannelKeys = channelEncryptionService.onChannelKeyChange(async (channel: string, network: string) => {
      const hasKey = await channelEncryptionService.hasChannelKey(channel, network);
      const noticeText = hasKey
        ? `🔒 Channel key stored for ${channel}`
        : `🔓 Channel key removed for ${channel}`;
      const ircSvc = connectionManager.getConnection(network)?.ircService || ircService;
      ircSvc.addMessage({
        type: 'notice',
        channel,
        text: noticeText,
        timestamp: Date.now(),
      });
      safeSetState(() => {
        setTabs((prev) =>
          prev.map((tab) => {
            if (tab.type === 'channel' && tab.name.toLowerCase() === channel.toLowerCase() && tab.networkId === network) {
              return { ...tab, isEncrypted: hasKey, sendEncrypted: hasKey ? tab.sendEncrypted : false };
            }
            return tab;
          })
        );
      });
    });

      // Listen for typing indicators
      const unsubscribeTyping = activeIRCService.on('typing-indicator', (target: string, nick: string, status: 'active' | 'paused' | 'done') => {
      safeSetState(() => {
        setTypingUsers(prev => {
          const newMap = new Map(prev);
          const channelMap = newMap.get(target) || new Map();

          if (status === 'done' || status === 'paused') {
            // Remove user from typing list
            channelMap.delete(nick);
          } else if (status === 'active') {
            // Add/update user in typing list
            channelMap.set(nick, { status, timestamp: Date.now() });
          }

          if (channelMap.size > 0) {
            newMap.set(target, channelMap);
          } else {
            newMap.delete(target);
          }

          return newMap;
        });
      });
    });

        // Simulate ping (in real implementation, measure actual ping)
        const pingInterval = setInterval(() => {
          if (isConnected) {
            setPing(Math.random() * 100 + 50); // Simulated ping
          }
        }, 5000);

        unsubscribers.push(() => {
          unsubscribeMessages();
          unsubscribeConnection();
          unsubscribeUserList();
          unsubscribeEncryption();
          unsubscribeKeyRequests();
          unsubscribeChannelKeys();
          unsubscribeTyping();
          clearInterval(pingInterval);
          unsubscribeRegistered && unsubscribeRegistered();
          unsubscribeMotd && unsubscribeMotd();
          unsubscribeMotdAny && unsubscribeMotdAny();
        });
      });

    return () => {
      console.log('App: Cleaning up IRC listeners');
      unsubscribers.forEach(fn => fn());
    };
  }, [activeConnectionId]); // Re-run when active connection changes

  // Listen for DCC session updates/messages to manage tabs and UI
  useEffect(() => {
    const unsubSession = dccChatService.onSessionUpdate((session) => {
      if (session.status === 'connected') {
        const tabId = `dcc::${session.networkId}::${session.peerNick}`;
        safeSetState(() => {
          setTabs(prev => {
            const existing = prev.find(t => t.id === tabId);
            if (existing) {
              return prev.map(t => t.id === tabId ? { ...t, messages: session.messages, dccSessionId: session.id } : t);
            }
            const newTab: ChannelTab = {
              id: tabId,
              name: `DCC: ${session.peerNick}`,
              type: 'dcc',
              networkId: session.networkId,
              messages: session.messages,
              dccSessionId: session.id,
            };
            return sortTabsGrouped([...prev, newTab], tabSortAlphabetical);
          });
        });
        safeSetState(() => setActiveTabId(tabId));
        safeSetState(() => setNetworkName(session.networkId));
      } else if (session.status === 'closed' || session.status === 'failed') {
        // Keep tab for history; could remove if desired
      }
    });
    const unsubMsg = dccChatService.onMessage((sessionId, message, session) => {
      const tabId = `dcc::${session.networkId}::${session.peerNick}`;
      safeSetState(() => {
        setTabs(prev =>
          prev.map(t =>
            t.id === tabId
              ? { ...t, messages: [...t.messages, message] }
              : t
          )
        );
      });
    });
    return () => {
      unsubSession();
      unsubMsg();
    };
  }, []);

  // Auto-hide typing indicators after 5 seconds of inactivity
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const TYPING_TIMEOUT = 5000; // 5 seconds

      setTypingUsers(prev => {
        const newMap = new Map(prev);
        let hasChanges = false;

        newMap.forEach((channelMap, channel) => {
          const updatedChannelMap = new Map(channelMap);

          updatedChannelMap.forEach((data, nick) => {
            if (now - data.timestamp > TYPING_TIMEOUT) {
              updatedChannelMap.delete(nick);
              hasChanges = true;
            }
          });

          if (updatedChannelMap.size === 0) {
            newMap.delete(channel);
          } else {
            newMap.set(channel, updatedChannelMap);
          }
        });

        return hasChanges ? newMap : prev;
      });
    }, 2000); // Check every 2 seconds

    return () => clearInterval(interval);
  }, []);

  // Configure DCC port range from settings
  useEffect(() => {
    const loadDcc = async () => {
      const range = await settingsService.getSetting('dccPortRange', { min: 5000, max: 6000 });
      if (range?.min && range?.max) {
        dccFileService.setPortRange(range.min, range.max);
      }
    };
    loadDcc();
  }, []);

  // Listen for DCC file transfers to show alerts (basic notifications)
  useEffect(() => {
    const unsub = dccFileService.onTransferUpdate((transfer) => {
      if (transfer.status === 'completed') {
        safeAlert(
          t('DCC Transfer Complete', { _tags: 'screen:app,file:App.tsx,feature:dcc' }),
          t(
            '{filename} received ({bytes} bytes).',
            {
              filename: transfer.offer.filename,
              bytes: transfer.bytesReceived,
              _tags: 'screen:app,file:App.tsx,feature:dcc',
            }
          )
        );
      } else if (transfer.status === 'failed') {
        safeAlert(
          t('DCC Transfer Failed', { _tags: 'screen:app,file:App.tsx,feature:dcc' }),
          transfer.error || t('Transfer failed.', { _tags: 'screen:app,file:App.tsx,feature:dcc' })
        );
      }
      safeSetState(() => setDccTransfers(dccFileService.list()));
    });
    return () => unsub();
  }, [safeAlert, safeSetState, t]);

  const handleConnect = useCallback(async (network?: IRCNetworkConfig, serverId?: string, connectNetworkId?: string) => {
    let networkToUse = network;
    let serverToUse: IRCServerConfig | undefined;
    let identityProfile: IdentityProfile | undefined;

    // If no network provided, try to load default or show networks list
    if (!networkToUse) {
      const networks = await settingsService.loadNetworks();
      if (networks.length === 0) {
        // Create default network
        networkToUse = await settingsService.createDefaultNetwork();
        // Reload to get the created network
        const updatedNetworks = await settingsService.loadNetworks();
        networkToUse = updatedNetworks[0];
      } else {
        // Always prefer "DBase" network as default, then first network with servers
        networkToUse = networks.find(n => n.name === 'DBase' && n.servers && n.servers.length > 0) ||
          networks.find(n => n.name === 'DBase') ||
          networks.find(n => n.servers && n.servers.length > 0) ||
          networks[0];
      }
    }

    // Update selected network name
    if (networkToUse) {
      setSelectedNetworkName(networkToUse.name);
    }

    // Pull the identity profile (default to AndroidIRCX) and apply to the network
    if (networkToUse?.identityProfileId) {
      const profiles = await identityProfilesService.list();
      identityProfile = profiles.find(p => p.id === networkToUse!.identityProfileId);
    }
    if (!identityProfile) {
      identityProfile = await identityProfilesService.getDefaultProfile();
    }
    if (identityProfile && networkToUse) {
      networkToUse = {
        ...networkToUse,
        identityProfileId: identityProfile.id,
        nick: identityProfile.nick || networkToUse.nick || 'AndroidIRCX',
        altNick: identityProfile.altNick || networkToUse.altNick || 'AndroidIRCX_',
        realname: identityProfile.realname || networkToUse.realname || 'AndroidIRCX User',
        ident: identityProfile.ident || networkToUse.ident || 'androidircx',
        sasl: identityProfile.saslAccount
          ? { account: identityProfile.saslAccount, password: identityProfile.saslPassword || '' }
          : networkToUse.sasl,
        nickservPassword: identityProfile.nickservPassword || networkToUse.nickservPassword,
        operUser: identityProfile.operUser || networkToUse.operUser,
        operPassword: identityProfile.operPassword || networkToUse.operPassword,
      };
    }

    // Find server to use
    if (!networkToUse) {
      safeAlert(
        t('No Network', { _tags: 'screen:app,file:App.tsx,feature:network' }),
        t('No network available. Please configure a network first.', { _tags: 'screen:app,file:App.tsx,feature:network' }),
        [
          { text: t('Cancel', { _tags: 'screen:app,file:App.tsx,feature:network' }), style: 'cancel' },
          {
            text: t('Configure', { _tags: 'screen:app,file:App.tsx,feature:network' }),
            onPress: () => {
              setShowNetworksList(true);
            }
          },
        ]
      );
      return;
    }

    if (!networkToUse.servers || networkToUse.servers.length === 0) {
      const networkName = networkToUse.name || 'DBase';
      safeAlert(
        t('No Server Configured', { _tags: 'screen:app,file:App.tsx,feature:network' }),
        t(
          'No server configured for "{networkName}". Would you like to configure one?',
          { networkName, _tags: 'screen:app,file:App.tsx,feature:network' }
        ),
        [
          { text: t('Cancel', { _tags: 'screen:app,file:App.tsx,feature:network' }), style: 'cancel' },
          {
            text: t('Configure', { _tags: 'screen:app,file:App.tsx,feature:network' }),
            onPress: () => {
              setShowNetworksList(true);
            }
          },
        ]
      );
      return;
    }

    if (serverId) {
      serverToUse = networkToUse.servers.find(s => s.id === serverId);
    }
    if (!serverToUse && autoConnectFavoriteServerRef.current) {
      serverToUse = networkToUse.servers.find(s => s.favorite);
    }
    if (!serverToUse && networkToUse.defaultServerId) {
      serverToUse = networkToUse.servers.find(s => s.id === networkToUse.defaultServerId);
    }
    if (!serverToUse) {
      serverToUse = networkToUse.servers[0];
    }

    if (!serverToUse) {
      serverToUse = { ...DEFAULT_SERVER };
    }

    if (!serverToUse) {
      const networkName = networkToUse?.name || 'DBase';
      safeAlert(
        t('Error', { _tags: 'screen:app,file:App.tsx,feature:network' }),
        t('No server configured for "{networkName}"', {
          networkName,
          _tags: 'screen:app,file:App.tsx,feature:network',
        })
      );
      setShowNetworksList(true);
      return;
    }

    // Show immediate feedback that connection is in progress
    if (networkToUse?.name && serverToUse?.hostname) {
      appendServerMessage(networkToUse.name, `Connecting to ${serverToUse.hostname}:${serverToUse.port || ''}...`);
    }

    // Choose the target network id we want to reuse (prefer existing server tab id)
    let desiredId = connectNetworkId || networkToUse?.name || 'default';
    const existingServerTab = tabsRef.current.find(
      t => t.type === 'server' && (t.networkId === desiredId || t.networkId === networkToUse?.name)
    );
    if (existingServerTab) {
      desiredId = existingServerTab.networkId;
    }

    const globalProxy = await settingsService.getSetting('globalProxy', { enabled: false } as any);
    const proxyToUse = networkToUse.proxy || globalProxy || null;

    const config: IRCConnectionConfig = {
      host: (serverToUse.hostname || '').trim(),
      port: serverToUse.port,
      nick: networkToUse.nick,
      altNick: networkToUse.altNick,
      username: networkToUse.ident || networkToUse.nick,
      realname: networkToUse.realname,
      password: serverToUse.password,
      tls: serverToUse.ssl,
      rejectUnauthorized: serverToUse.rejectUnauthorized,
      proxy: proxyToUse,
      sasl: networkToUse.sasl,
    };

    try {
      const safeConfig = {
        ...config,
        password: config.password ? '[redacted]' : undefined,
        sasl: config.sasl
          ? { ...config.sasl, password: config.sasl.password ? '[redacted]' : '' }
          : undefined,
        proxy: config.proxy
          ? { ...config.proxy, password: config.proxy.password ? '[redacted]' : undefined }
          : config.proxy,
        clientKey: config.clientKey ? '[redacted]' : undefined,
      };
      console.log('App: Attempting to connect to IRC server using ConnectionManager...', safeConfig);
      // Use ConnectionManager for multi-server support
      const finalId = await connectionManager.connect(desiredId, networkToUse, config);
      console.log('App: Connection successful');
      scriptingService.handleConnect(finalId);
      setActiveConnectionId(finalId);
      setNetworkName(finalId);
      setPrimaryNetworkId(prev => prev || finalId);
      setIsConnected(true);
      // Load tabs for this network and merge
      const loadedTabs = await tabService.getTabs(finalId);
      const normalizedTabs = loadedTabs.map(tab => ({
        ...tab,
        networkId: tab.networkId || finalId,
        id: tab.id.includes('::') ? tab.id : (tab.type === 'server' ? serverTabId(finalId) : tab.id),
      }));
      const withServerTab = normalizedTabs.some(t => t.type === 'server') ? normalizedTabs : [makeServerTab(finalId), ...normalizedTabs];
      const tabsWithHistory = await Promise.all(
        withServerTab.map(async (tab) => {
          // Use 'server' for server tabs, tab.name for channels/queries
          const channelKey = tab.type === 'server' ? 'server' : tab.name;
          const history = await messageHistoryService.loadMessages(tab.networkId, channelKey);
          return { ...tab, messages: history };
        })
      );
      setTabs(prev => sortTabsGrouped([
        ...prev.filter(t => t.networkId !== finalId),
        ...tabsWithHistory,
      ]));
      setActiveTabId(serverTabId(finalId));

      // Save connection state for auto-reconnect
      if (networkToUse.name) {
        const channels: string[] = [];
        // Get channels from tabs
        tabs.forEach(tab => {
          if (tab.type === 'channel' && tab.name.startsWith('#')) {
            channels.push(tab.name);
          }
        });
        // Add auto-join channels
        if (networkToUse.autoJoinChannels) {
          networkToUse.autoJoinChannels.forEach(ch => {
            if (!channels.includes(ch)) {
              channels.push(ch);
            }
          });
        }
        await autoReconnectService.saveConnectionState(finalId, config, channels);
      }
      
    } catch (error: any) {
      logger.error('connect', `Connection failed: ${error?.message || String(error)}`);
      errorReportingService.report(error, { source: 'connect', fatal: false, extras: { host: serverToUse?.hostname, port: serverToUse?.port } });
      const hostInfo = serverToUse ? `${serverToUse.hostname}:${serverToUse.port}` : 'server';
      const message = error?.message || 'Failed to connect to IRC server';
      const buttons = [
        {
          text: 'Retry',
          onPress: () => handleConnect(networkToUse, serverToUse?.id),
        },
        {
          text: 'Open Networks',
          onPress: () => setShowNetworksList(true),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ];
      safeAlert(
        t('Connection failed', { _tags: 'screen:app,file:App.tsx,feature:connect' }),
        t(
          '{message}\n\nTried: {hostInfo}\nCheck host/port, SSL, and network reachability.',
          {
            message,
            hostInfo,
            _tags: 'screen:app,file:App.tsx,feature:connect',
          }
        ),
        buttons
      );
      if (networkToUse?.name) {
        appendServerMessage(networkToUse.name, `Connection failed: ${message}`);
      }
    }
  }, []);

  const handleFirstRunSetupComplete = useCallback(async (networkConfig: IRCNetworkConfig) => {
    console.log('First run setup completed, connecting to:', networkConfig.name);
    setShowFirstRunSetup(false);

    // Reload networks (the setup saved it already)
    const networks = await settingsService.loadNetworks();
    const savedNetwork = networks.find(n => n.name === networkConfig.name);

    if (savedNetwork) {
      // Connect to the network
      handleConnect(savedNetwork);
    }
  }, [handleConnect]);

  useEffect(() => {
    if (!autoConnectFavoriteServer) {
      autoConnectAttemptedRef.current.clear();
    }
  }, [autoConnectFavoriteServer]);

  useEffect(() => {
    if (!autoConnectFavoriteServer || !initialDataLoaded) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const networks = await settingsService.loadNetworks();
        if (cancelled || networks.length === 0) {
          return;
        }

        const startupTargets = networks.filter(n => n.connectOnStartup);
        const favoriteTargets = networks.filter(n => (n.servers || []).some(s => s.favorite));
        let targets = startupTargets.length > 0 ? startupTargets : favoriteTargets;

        if (targets.length === 0 && selectedNetworkName) {
          const selected = networks.find(n => n.name === selectedNetworkName);
          if (selected) {
            targets = [selected];
          }
        }

        if (targets.length === 0 && networks[0]) {
          targets = [networks[0]];
        }

        for (const target of targets) {
          if (!target?.name) continue;
          if (autoConnectAttemptedRef.current.has(target.name)) continue;
          if (connectionManager.hasConnection(target.name)) continue;
          autoConnectAttemptedRef.current.add(target.name);
          await handleConnect(target);
        }
      } catch (err) {
        console.error('Auto-connect favorite server failed', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [autoConnectFavoriteServer, initialDataLoaded, selectedNetworkName, handleConnect]);

  // State to track if auto-join has been attempted for the current connection
  const [autoJoinAttempted, setAutoJoinAttempted] = useState(false);
  const [autoJoinFavoritesEnabled, setAutoJoinFavoritesEnabled] = useState(true);
  const [motdSignal, setMotdSignal] = useState(0);

  useEffect(() => {
    settingsService.getSetting('autoJoinFavorites', true).then(value => setAutoJoinFavoritesEnabled(value !== false));
  }, []);

  useEffect(() => {
    setAutoJoinAttempted(false);
  }, [activeConnectionId]);

  // Effect to handle auto-joining channels after successful connection and registration
  useEffect(() => {
    const handleAutoJoin = async () => {
      const activeIRCService = getActiveIRCService();
      // Check if connected and registered, and auto-join hasn't been attempted yet for this connection
      const activeNetId = activeConnectionId || selectedNetworkName;
      if (isConnected && activeIRCService.isRegistered() && !autoJoinAttempted && activeNetId) {
        if (!motdCompleteRef.current.has(activeNetId)) {
          return; // wait for MOTD to complete to ensure NickServ/identity flows
        }
        setAutoJoinAttempted(true); // Mark as attempted

        const networkConfig = await settingsService.getNetwork(activeNetId);
        const favorites = autoJoinFavoritesEnabled
          ? channelFavoritesService.getFavorites(activeNetId) // join all favorites when enabled
          : [];
        const favoriteNames = favorites.map(f => f.name);
        const autoJoin = networkConfig?.autoJoinChannels || [];

        // If identity profile exists, assume NickServ identify done before we join (after MOTD)
        const channelsToJoin = Array.from(new Set([...favoriteNames, ...autoJoin]));
        channelsToJoin.forEach(channel => {
          const favorite = favorites.find(f => f.name === channel);
          activeIRCService.joinChannel(channel, favorite?.key);
        });
      }
    };

    handleAutoJoin();

    // Reset autoJoinAttempted when disconnected
    if (!isConnected) {
      setAutoJoinAttempted(false);
    }

  }, [isConnected, autoJoinAttempted, selectedNetworkName, activeConnectionId, getActiveIRCService, autoJoinFavoritesEnabled, motdSignal]);


  const handleTabPress = useCallback((tabId: string) => {
    setActiveTabId(tabId);
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      setNetworkName(tab.networkId);
      setActiveConnectionId(tab.networkId);
      connectionManager.setActiveConnection(tab.networkId);
      setTabs(prev => prev.map(t => t.id === tabId ? { ...t, hasActivity: false } : t));
    }
    // Fetch users for the channel if it's a channel tab
    if (tab && (tab.type === 'channel' || tab.type === 'dcc')) {
      const conn = connectionManager.getConnection(tab.networkId);
      const activeIRCService = conn?.ircService || getActiveIRCService();
      const users = activeIRCService.getChannelUsers(tab.name);
      if (users.length > 0) {
        setChannelUsers((prev) => {
          const newMap = new Map(prev);
          newMap.set(tab.name, users);
          return newMap;
        });
      } else {
        // Request user list if not available
        activeIRCService.requestChannelUsers(tab.name);
      }
    }
  }, [tabs, getActiveIRCService]);

  const handleSendMessage = useCallback(async (message: string) => {
    const activeIRCService = getActiveIRCService();
    const activeCommandService = getActiveCommandService();
    // Use the same safe tab lookup as activeTab derivation
    const activeTab = tabs.find((tab) => tab.id === activeTabId) || tabs.find(t => t.type === 'server') || tabs[0];

    // Don't send messages if no valid tab exists
    if (!activeTab) {
      console.warn('⚠️ Cannot send message: no valid tab available');
      return;
    }
    const isChannelTarget =
      activeTab.name.startsWith('#') ||
      activeTab.name.startsWith('&') ||
      activeTab.name.startsWith('+') ||
      activeTab.name.startsWith('!');
    const isPrivateTarget = activeTab.type === 'query' || (!isChannelTarget && activeTab.type !== 'server' && activeTab.type !== 'dcc');

    // Process command through command service (handles /quote, aliases, custom commands)
    const processedCommand = await activeCommandService.processCommand(message, activeTab.name);

    // If activeCommandService.processCommand returns null, it means it handled the command internally (e.g., /quote)
    // and no further processing is needed for this message.
    // If it returns a string, it means that string should be sent to the IRC service.
    // If it returns the original message (because it's not a command), it means it's a regular message to be sent.
    if (processedCommand === null && message.startsWith('/')) {
      return; // Command was handled internally (e.g., /quote, or some custom command that returns null)
    }

    // Use processed command or original message if it's not a command
    let commandToSend = (processedCommand !== null && processedCommand.startsWith('/')) ? processedCommand : message;

    // Run scripting on outgoing commands (aliases / automation)
    const scripted = scriptingService.processOutgoingCommand(commandToSend, { channel: activeTab.name, networkId: activeTab.networkId });
    if (scripted === null) {
      return; // Script cancelled send
    }
    commandToSend = scripted;


    if (activeTab.type === 'server') {
      // For server tab, still require connection
      if (!isConnected) {
        safeAlert(
          t('Not Connected', { _tags: 'screen:app,file:App.tsx,feature:connect' }),
          t('Please connect to a server first', { _tags: 'screen:app,file:App.tsx,feature:connect' })
        );
        return;
      }
      if (commandToSend.startsWith('/')) {
        activeIRCService.sendMessage(activeTab.name, commandToSend);
      } else {
        activeIRCService.sendCommand(commandToSend);
      }
      return;
    }

    if (activeTab.type === 'dcc') {
      if (activeTab.dccSessionId) {
        dccChatService.sendMessage(activeTab.dccSessionId, commandToSend);
        const dccMessage: IRCMessage = {
          id: `dcc-${Date.now()}`,
          type: 'message',
          from: 'You',
          text: commandToSend,
          timestamp: Date.now(),
          channel: activeTab.name,
          network: activeTab.networkId,
        };
        setTabs(prev =>
          prev.map(t =>
            t.id === activeTab.id
              ? {
                  ...t,
                  messages: [...t.messages, dccMessage],
                }
              : t
          )
        );
        // Save DCC message to history
        if (activeTab.networkId && activeTab.networkId !== 'Not connected') {
          messageHistoryService.saveMessage(dccMessage, activeTab.networkId).catch(err => {
            console.error('Error saving DCC message to history:', err);
          });
        }
      }
      return;
    }

    // Channel or query messages: queue if offline
    if (!isConnected) {
      offlineQueueService.addMessage(activeTab.networkId, activeTab.name, commandToSend);
      const pendingMessage: IRCMessage = {
        id: `pending-${Date.now()}-${Math.random()}`,
        type: 'message',
        channel: activeTab.name,
        from: 'You',
        text: commandToSend,
        timestamp: Date.now(),
        status: 'pending',
        network: activeTab.networkId,
      };
      setTabs(prev =>
        prev.map(tab =>
          tab.id === activeTab.id
            ? { ...tab, messages: [...tab.messages, pendingMessage] }
            : tab
        )
      );
      // Save pending message to history
      if (activeTab.networkId && activeTab.networkId !== 'Not connected') {
        messageHistoryService.saveMessage(pendingMessage, activeTab.networkId).catch(err => {
          console.error('Error saving pending message to history:', err);
        });
      }
      return;
    }

    const wantEncrypted = !!(activeTab.sendEncrypted && activeTab.isEncrypted);

    // Connected: send normally, but try encrypted path for private targets when toggle is on
    if (isPrivateTarget && wantEncrypted && !commandToSend.startsWith('/')) {
      const network = activeTab.networkId || activeIRCService.getNetworkName();
      const hasBundle = activeTab.isEncrypted || await encryptedDMService.isEncryptedForNetwork(network, activeTab.name);
      if (!hasBundle) {
        const errorMsg: IRCMessage = {
          id: `err-${Date.now()}-${Math.random()}`,
          type: 'error',
          channel: activeTab.name,
          text: `*** No DM key with ${activeTab.name}. Use /sharekey or /requestkey first.`,
          timestamp: Date.now(),
          network: activeTab.networkId,
        };
        setTabs(prev =>
          prev.map(tab =>
            tab.id === activeTab.id
              ? { ...tab, isEncrypted: false, messages: [...tab.messages, errorMsg] }
              : tab
          )
        );
        // Save error message to history
        if (activeTab.networkId && activeTab.networkId !== 'Not connected') {
          messageHistoryService.saveMessage(errorMsg, activeTab.networkId).catch(err => {
            console.error('Error saving error message to history:', err);
          });
        }
        return;
      }
      try {
        const network = activeTab.networkId || activeIRCService.getNetworkName();
        const payload = await encryptedDMService.encryptForNetwork(commandToSend, network, activeTab.name);
        activeIRCService.sendRaw(`PRIVMSG ${activeTab.name} :!enc-msg ${JSON.stringify(payload)}`);
        const sentMessage: IRCMessage = {
          id: `msg-${Date.now()}-${Math.random()}`,
          type: 'message',
          channel: activeTab.name,
          from: 'You',
          text: `🔒 ${commandToSend}`,
          timestamp: Date.now(),
          status: 'sent',
          network: activeTab.networkId,
        };
        setTabs(prev =>
          prev.map(tab =>
            tab.id === activeTab.id
              ? { ...tab, messages: [...tab.messages, sentMessage] }
              : tab
          )
        );
        // Save encrypted DM to history
        if (activeTab.networkId && activeTab.networkId !== 'Not connected') {
          messageHistoryService.saveMessage(sentMessage, activeTab.networkId).catch(err => {
            console.error('Error saving encrypted DM to history:', err);
          });
        }
        return;
      } catch (e) {
        const errorMsg: IRCMessage = {
          id: `err-${Date.now()}-${Math.random()}`,
          type: 'error',
          channel: activeTab.name,
          text: `Encrypted send failed (${(e as Error)?.message || 'missing key?'}). Use "Request Encryption Key" from the user menu.`,
          timestamp: Date.now(),
          network: activeTab.networkId,
        };
        setTabs(prev =>
          prev.map(tab =>
            tab.id === activeTab.id
              ? { ...tab, messages: [...tab.messages, errorMsg] }
              : tab
          )
        );
        // Save error message to history
        if (activeTab.networkId && activeTab.networkId !== 'Not connected') {
          messageHistoryService.saveMessage(errorMsg, activeTab.networkId).catch(err => {
            console.error('Error saving error message to history:', err);
          });
        }
        return; // do not fall back to plaintext
      }
    }

    // Try encrypted channel messages if toggle is on and channel has a key
    const isChannel = activeTab.name.startsWith('#') || activeTab.name.startsWith('&');
    if (isChannel && wantEncrypted && !commandToSend.startsWith('/')) {
      const hasKey = await channelEncryptionService.hasChannelKey(activeTab.name, activeTab.networkId);
      if (hasKey) {
        try {
          const payload = await channelEncryptionService.encryptMessage(commandToSend, activeTab.name, activeTab.networkId);
          activeIRCService.sendRaw(`PRIVMSG ${activeTab.name} :!chanenc-msg ${JSON.stringify(payload)}`);
          const sentMessage: IRCMessage = {
            id: `msg-${Date.now()}-${Math.random()}`,
            type: 'message',
            channel: activeTab.name,
            from: 'You',
            text: `🔒 ${commandToSend}`,
            timestamp: Date.now(),
            status: 'sent',
            network: activeTab.networkId,
          };
          setTabs(prev =>
            prev.map(tab =>
              tab.id === activeTab.id
                ? { ...tab, messages: [...tab.messages, sentMessage] }
                : tab
            )
          );
          // Save encrypted channel message to history
          if (activeTab.networkId && activeTab.networkId !== 'Not connected') {
            messageHistoryService.saveMessage(sentMessage, activeTab.networkId).catch(err => {
              console.error('Error saving encrypted channel message to history:', err);
            });
          }
          return;
        } catch (e) {
          const errorMsg: IRCMessage = {
            id: `err-${Date.now()}-${Math.random()}`,
            type: 'error',
            channel: activeTab.name,
            text: `*** Channel encryption failed: ${(e as Error)?.message || e}`,
            timestamp: Date.now(),
            network: activeTab.networkId,
          };
          setTabs(prev =>
            prev.map(tab =>
              tab.id === activeTab.id
                ? { ...tab, messages: [...tab.messages, errorMsg] }
                : tab
            )
          );
          // Save error message to history
          if (activeTab.networkId && activeTab.networkId !== 'Not connected') {
            messageHistoryService.saveMessage(errorMsg, activeTab.networkId).catch(err => {
              console.error('Error saving error message to history:', err);
            });
          }
          return;
        }
      } else {
        const errorMsg: IRCMessage = {
          id: `err-${Date.now()}-${Math.random()}`,
          type: 'error',
          channel: activeTab.name,
          text: `*** No channel key stored for ${activeTab.name}. Use /chankey generate/share first.`,
          timestamp: Date.now(),
          network: activeTab.networkId,
        };
        setTabs(prev =>
          prev.map(tab =>
            tab.id === activeTab.id
              ? { ...tab, messages: [...tab.messages, errorMsg] }
              : tab
          )
        );
        // Save error message to history
        if (activeTab.networkId && activeTab.networkId !== 'Not connected') {
          messageHistoryService.saveMessage(errorMsg, activeTab.networkId).catch(err => {
            console.error('Error saving error message to history:', err);
          });
        }
        return;
      }
    }

    activeIRCService.sendMessage(activeTab.name, commandToSend);
  }, [isConnected, activeTabId, tabs, getActiveIRCService, getActiveCommandService, t]);

  const handleJoinChannel = useCallback((channel?: string, key?: string) => {
    const channelToJoin = channel || channelName.trim();
    if (channelToJoin) {
      const activeIRCService = getActiveIRCService();
      activeIRCService.joinChannel(channelToJoin, key);
      setChannelName('');
      setShowChannelModal(false);
    }
  }, [channelName, getActiveIRCService]);

  const handleExit = useCallback(async () => {
    safeAlert(
      t('Exit Application', { _tags: 'screen:app,file:App.tsx,feature:exit' }),
      t('Are you sure you want to exit? This will disconnect from the server.', {
        _tags: 'screen:app,file:App.tsx,feature:exit',
      }),
      [
        { text: t('Cancel', { _tags: 'screen:app,file:App.tsx,feature:exit' }), style: 'cancel' },
        {
          text: t('Exit', { _tags: 'screen:app,file:App.tsx,feature:exit' }),
          style: 'destructive',
          onPress: async () => {
            try {
              // Disconnect gracefully if connected
              if (isConnected) {
                const activeIRCService = getActiveIRCService();
              const quitMessage = await settingsService.getSetting('quitMessage', DEFAULT_QUIT_MESSAGE);
                await activeIRCService.disconnect(quitMessage);
                // Wait a bit for disconnect to complete
                await new Promise<void>(resolve => setTimeout(resolve, 500));
              }
              // Cleanup services
              backgroundService.cleanup();
              // Exit the app
              if (Platform.OS === 'android') {
                BackHandler.exitApp();
              } else {
                // iOS doesn't support programmatic exit, but we can disconnect
                safeAlert(
                  t('Disconnected', { _tags: 'screen:app,file:App.tsx,feature:exit' }),
                  t('You can now close the app from the app switcher.', {
                    _tags: 'screen:app,file:App.tsx,feature:exit',
                  })
                );
              }
            } catch (error) {
              console.error('Error during exit:', error);
              // Still try to exit
              if (Platform.OS === 'android') {
                BackHandler.exitApp();
              }
            }
          },
        },
      ]
    );
  }, [isConnected, getActiveIRCService, t]);

  const handleDropdownPress = useCallback(() => {
    setShowOptionsMenu(true);
  }, []);

  const closeAllChannelsAndQueries = useCallback(async (networkId: string) => {
    const currentTabs = tabsRef.current;
    const toClose = currentTabs.filter(
      tab => tab.networkId === networkId && (tab.type === 'channel' || tab.type === 'query')
    );
    if (toClose.length === 0) return;

    const partMessage = await settingsService.getSetting('partMessage', DEFAULT_PART_MESSAGE);
    const conn = connectionManager.getConnection(networkId);
    const svc = conn?.ircService;
    toClose.forEach(tab => {
      if (tab.type === 'channel') {
        svc?.partChannel(tab.name, partMessage);
      }
    });

    const remaining = currentTabs.filter(
      tab => !(tab.networkId === networkId && (tab.type === 'channel' || tab.type === 'query'))
    );
    setTabs(sortTabsGrouped(remaining, tabSortAlphabetical));
    await tabService.saveTabs(networkId, remaining.filter(tab => tab.networkId === networkId));

    if (toClose.some(tab => tab.id === activeTabId)) {
      const serverTab = remaining.find(tab => tab.networkId === networkId && tab.type === 'server');
      if (serverTab) {
        setActiveTabId(serverTab.id);
        setNetworkName(serverTab.networkId);
      }
    }
  }, [activeTabId, tabSortAlphabetical]);

  // Remove handleAddPress as its logic is now merged into handleDropdownPress
  // const handleAddPress = useCallback(() => { /* ... (old code removed) ... */ }, [handleConnect, isConnected]);

  const handleTabLongPress = useCallback(async (tab: ChannelTab) => {
    const options: { text: string; onPress: () => void; style?: 'cancel' | 'destructive' }[] = [];
    let isBookmarked = false;

    if (tab.type === 'server') {
      const tabConnection = connectionManager.getConnection(tab.networkId);
      const isTabConnected = !!tabConnection?.ircService.getConnectionStatus();
      const isPrimaryServer = primaryNetworkId ? tab.networkId === primaryNetworkId : false;

      if (isTabConnected) {
        options.push({
          text: `Disconnect ${tab.networkId}`,
          onPress: () => {
            connectionManager.disconnect(tab.networkId);
            setActiveConnectionId(connectionManager.getActiveNetworkId());
          },
          style: 'destructive',
        });
      } else {
        options.push({
          text: `Connect ${tab.networkId}`,
          onPress: async () => {
            const networkConfig = await getNetworkConfigForId(tab.networkId);
            if (networkConfig) {
              await handleConnect(networkConfig, undefined, tab.networkId);
            } else {
              safeAlert(
                t('Network Not Found', { _tags: 'screen:app,file:App.tsx,feature:network' }),
                t(
                  'Cannot find saved configuration for "{networkId}". Please configure it first.',
                  {
                    networkId: tab.networkId,
                    _tags: 'screen:app,file:App.tsx,feature:network',
                  }
                )
              );
            }
          },
        });
      }

      options.push({
        text: 'Browse Channels',
        onPress: () => {
          setActiveTabId(tab.id);
          setShowChannelList(true);
        },
      });
      options.push({
        text: 'Close All Channels + PVTS',
        onPress: async () => {
          setShowTabOptionsModal(false);
          await closeAllChannelsAndQueries(tab.networkId);
        },
      });
      options.push({
        text: 'Connect Another Network',
        onPress: () => {
          setShowNetworksList(true);
        },
      });
      options.push({
        text: 'Rename Server Tab',
        onPress: () => {
          setRenameTargetTabId(tab.id);
          setRenameValue(tab.name);
          setShowRenameModal(true);
        },
      });
      if (!isPrimaryServer) {
        options.push({
          text: 'Close Server Tab',
          onPress: async () => {
            setShowTabOptionsModal(false);
            if (tabConnection) {
              await connectionManager.disconnect(tab.networkId);
            }
            await tabService.saveTabs(tab.networkId, []);
            setTabs(prev => {
              const updated = sortTabsGrouped(prev.filter(t => t.networkId !== tab.networkId), tabSortAlphabetical);
              if (!updated.some(t => t.id === activeTabId)) {
                const primaryServerId = primaryNetworkId ? serverTabId(primaryNetworkId) : '';
                const fallbackId =
                  (primaryServerId && updated.some(t => t.id === primaryServerId))
                    ? primaryServerId
                    : updated.find(t => t.type === 'server')?.id || updated[0]?.id || '';
                if (fallbackId) {
                  setActiveTabId(fallbackId);
                  const fallbackTab = updated.find(t => t.id === fallbackId);
                  if (fallbackTab) {
                    setNetworkName(fallbackTab.networkId);
                  }
                }
                // Don't set networkName to 'Not connected' - keep current network
              }
              return updated;
            });
            setActiveConnectionId(connectionManager.getActiveNetworkId());
          },
          style: 'destructive',
        });
      }
      options.push({
        text: 'Cancel',
        onPress: () => {},
        style: 'cancel',
      });
      setTabOptionsTitle(`Server: ${tab.networkId}`);
      setTabOptions(options);
      setShowTabOptionsModal(true);
      return;
    }

    // Option to leave channel or close query
    if (tab.type === 'channel') {
      try {
        isBookmarked = await channelNotesService.isBookmarked(tab.networkId, tab.name);
      } catch (err) {
        // Ignore bookmark lookup errors; default to false and still show menu
        isBookmarked = false;
      }
      options.push({
        text: 'Leave Channel',
        onPress: async () => {
          const activeIRCService = getActiveIRCService();
          const partMessage = await settingsService.getSetting('partMessage', DEFAULT_PART_MESSAGE);
          activeIRCService.partChannel(tab.name, partMessage);
          tabService.removeTab(tab.networkId, tab.id);
          setTabs(prev => prev.filter(t => t.id !== tab.id));
          if (activeTabId === tab.id) {
            setActiveTabId(serverTabId(tab.networkId)); // Switch to server tab if active tab is closed
          }
        },
        style: 'destructive',
      });
      const channelEncLabel = tab.sendEncrypted ? 'Send Plaintext (Unlock)' : 'Send Encrypted (Lock)';
      options.push({
        text: channelEncLabel,
        onPress: async () => {
          if (!tab.sendEncrypted) {
            const hasKey = await channelEncryptionService.hasChannelKey(tab.name, tab.networkId);
            if (!hasKey) {
              const svc = connectionManager.getConnection(tab.networkId)?.ircService || ircService;
              svc.addMessage({
                type: 'error',
                text: `*** No channel key stored for ${tab.name}. Generate with /chankey generate then share.`,
                timestamp: Date.now(),
              });
              return;
            }
          }
          const nextValue = !tab.sendEncrypted;
          setTabs(prev =>
            prev.map(t => t.id === tab.id ? { ...t, sendEncrypted: nextValue } : t)
          );
          const svc = connectionManager.getConnection(tab.networkId)?.ircService || ircService;
          svc.addMessage({
            type: 'notice',
            channel: tab.name,
            text: nextValue ? `*** Channel encryption enabled for ${tab.name}` : `*** Channel encryption disabled for ${tab.name}`,
            timestamp: Date.now(),
          });
          setShowTabOptionsModal(false);
        },
      });
    } else if (tab.type === 'query') {
      // Encryption options for DMs
      const alwaysEncryptEnabled = await channelEncryptionSettingsService.getAlwaysEncrypt(tab.name, tab.networkId);
      const network = tab.networkId || '';
      const hasBundle = await encryptedDMService.isEncryptedForNetwork(network, tab.name);

      options.push({
        text: `Always Encrypt: ${alwaysEncryptEnabled ? 'ON' : 'OFF'}`,
        onPress: async () => {
          const newValue = await channelEncryptionSettingsService.toggleAlwaysEncrypt(tab.name, tab.networkId);
          if (newValue && !hasBundle) {
            Alert.alert(
              'No Encryption Bundle',
              'Always-encrypt is now enabled, but no encryption bundle exists. Share your key with this user to enable encryption.',
              [{ text: 'OK' }]
            );
          }
          setShowTabOptionsModal(false);
        },
      });

      options.push({
        text: 'Close Query',
        onPress: async () => {
          const activeIRCService = getActiveIRCService();
          tabService.removeTab(tab.networkId, tab.id);
          setTabs(prev => prev.filter(t => t.id !== tab.id));
          if (activeTabId === tab.id) {
            setActiveTabId(serverTabId(tab.networkId)); // Switch to server tab if active tab is closed
          }

          const closePrivateMessage = await settingsService.getSetting('closePrivateMessage', true);
          if (closePrivateMessage) {
            const ircServices = await settingsService.getSetting('ircServices', ['nickserv', 'chanserv', 'memoserv', 'operserv', 'hostserv', 'botserv']);
            if (!ircServices.includes(tab.name.toLowerCase())) {
              const closePrivateMessageText = await settingsService.getSetting('closePrivateMessageText', 'Closing window');
              activeIRCService.sendRaw(`PRIVMSG ${tab.name} :${closePrivateMessageText}`);
            }
          }
        },
        style: 'destructive',
      });
      options.push({
        text: 'Share DM Key',
        onPress: async () => {
          try {
            const bundle = await encryptedDMService.exportBundle();
            const svc = connectionManager.getConnection(tab.networkId)?.ircService || ircService;
            svc.sendRaw(`PRIVMSG ${tab.name} :!enc-offer ${JSON.stringify(bundle)}`);
            svc.addMessage({
              type: 'notice',
              channel: tab.name,
              text: `*** Encryption key offer sent to ${tab.name}. Waiting for acceptance...`,
              timestamp: Date.now(),
            });
          } catch (e: any) {
            const svc = connectionManager.getConnection(tab.networkId)?.ircService || ircService;
            svc.addMessage({
              type: 'error',
              channel: tab.name,
              text: `*** Failed to share encryption key: ${e?.message || e}`,
              timestamp: Date.now(),
            });
          }
          setShowTabOptionsModal(false);
        },
      });
      options.push({
        text: 'Request DM Key',
        onPress: () => {
          const svc = connectionManager.getConnection(tab.networkId)?.ircService || ircService;
          svc.sendRaw(`PRIVMSG ${tab.name} :!enc-req`);
          svc.addMessage({
            type: 'notice',
            channel: tab.name,
            text: `*** Encryption key requested from ${tab.name}`,
            timestamp: Date.now(),
          });
          setShowTabOptionsModal(false);
        },
      });
      const queryEncLabel = tab.sendEncrypted ? 'Send Plaintext (Unlock)' : 'Send Encrypted (Lock)';
      options.push({
        text: queryEncLabel,
        onPress: async () => {
          if (!tab.sendEncrypted) {
            const network = tab.networkId || '';
            const hasBundle = await encryptedDMService.isEncryptedForNetwork(network, tab.name);
            if (!hasBundle) {
              const svc = connectionManager.getConnection(tab.networkId)?.ircService || ircService;
              svc.addMessage({
                type: 'error',
                text: `*** No DM key with ${tab.name}. Use /sharekey or /requestkey first.`,
                timestamp: Date.now(),
                });
                return;
              }
            }
            const nextValue = !tab.sendEncrypted;
            setTabs(prev =>
              prev.map(t => t.id === tab.id ? { ...t, sendEncrypted: nextValue } : t)
            );
            const svc = connectionManager.getConnection(tab.networkId)?.ircService || ircService;
            svc.addMessage({
              type: 'notice',
              channel: tab.name,
              text: nextValue ? `*** DM encryption enabled with ${tab.name}` : `*** DM encryption disabled with ${tab.name}`,
              timestamp: Date.now(),
            });
            setShowTabOptionsModal(false);
          },
        });
    options.push({
      text: 'WHOIS',
      onPress: () => {
        setWhoisNick(tab.name);
        setShowWHOIS(true);
        setShowTabOptionsModal(false);
      },
    });
    options.push({
      text: 'Start DCC Chat',
      onPress: () => {
        dccChatService.initiateChat(getActiveIRCService(), tab.name, tab.networkId);
        setShowTabOptionsModal(false);
      },
    });
    options.push({
      text: 'Offer DCC Send',
      onPress: () => {
        setDccSendTarget({ nick: tab.name, networkId: tab.networkId });
        setShowDccSendModal(true);
        setShowTabOptionsModal(false);
      },
    });
      options.push({
        text: 'WHOWAS',
        onPress: () => {
          const conn = connectionManager.getConnection(tab.networkId);
          (conn?.ircService || getActiveIRCService()).sendCommand(`WHOWAS ${tab.name}`);
          setShowTabOptionsModal(false);
        },
      });
      options.push({
        text: 'Ignore User',
        onPress: async () => {
          const svc = connectionManager.getConnection(tab.networkId)?.userManagementService || getActiveUserManagementService();
          await svc.ignoreUser(tab.name, undefined, tab.networkId);
          setShowTabOptionsModal(false);
        },
      });
    }

    // Option for Channel Settings
    if (tab.type === 'channel') {
      options.push({
        text: 'Generate Channel Key',
        onPress: async () => {
          try {
            await channelEncryptionService.generateChannelKey(tab.name, tab.networkId);
            const svc = connectionManager.getConnection(tab.networkId)?.ircService || ircService;
            svc.addMessage({
              type: 'notice',
              text: `*** Channel encryption key generated for ${tab.name}. Use /chankey share <nick> to share.`,
              timestamp: Date.now(),
            });
          } catch (e: any) {
            const svc = connectionManager.getConnection(tab.networkId)?.ircService || ircService;
            svc.addMessage({
              type: 'error',
              text: `*** Failed to generate channel key: ${e?.message || e}`,
              timestamp: Date.now(),
            });
          }
        },
      });
      options.push({
        text: 'Channel Settings',
        onPress: () => {
          setChannelSettingsTarget(tab.name);
          setChannelSettingsNetwork(tab.networkId);
          setShowChannelSettings(true);
        },
      });

      // Encryption options
      const alwaysEncryptEnabled = await channelEncryptionSettingsService.getAlwaysEncrypt(tab.name, tab.networkId);
      const hasEncKey = await channelEncryptionService.hasChannelKey(tab.name, tab.networkId);

      options.push({
        text: `Always Encrypt: ${alwaysEncryptEnabled ? 'ON' : 'OFF'}`,
        onPress: async () => {
          const newValue = await channelEncryptionSettingsService.toggleAlwaysEncrypt(tab.name, tab.networkId);
          if (newValue && !hasEncKey) {
            Alert.alert(
              'No Encryption Key',
              'Always-encrypt is now enabled, but no encryption key exists. Generate or request a key to enable encryption.',
              [{ text: 'OK' }]
            );
          }
          setShowTabOptionsModal(false);
        },
      });

      if (!hasEncKey) {
        options.push({
          text: 'Request Encryption Key',
          onPress: () => {
            setShowTabOptionsModal(false);
            Alert.prompt(
              'Request Key',
              'Enter the nickname to request the encryption key from:',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Request',
                  onPress: (nick?: string) => {
                    if (nick && nick.trim()) {
                      const svc = connectionManager.getConnection(tab.networkId)?.ircService || ircService;
                      svc.sendCommand(`/chankey request ${nick.trim()}`);
                      svc.addMessage({
                        id: `sys-${Date.now()}`,
                        from: '*',
                        channel: tab.name,
                        text: `Key request sent to ${nick.trim()}`,
                        timestamp: Date.now(),
                        type: 'notice',
                      });
                    }
                  },
                },
              ],
              'plain-text'
            );
          },
        });
      } else {
        options.push({
          text: 'Share Encryption Key',
          onPress: () => {
            setShowTabOptionsModal(false);
            Alert.prompt(
              'Share Key',
              'Enter the nickname to share the encryption key with:',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Share',
                  onPress: (nick?: string) => {
                    if (nick && nick.trim()) {
                      const svc = connectionManager.getConnection(tab.networkId)?.ircService || ircService;
                      svc.sendCommand(`/chankey share ${nick.trim()}`);
                      svc.addMessage({
                        id: `sys-${Date.now()}`,
                        from: '*',
                        channel: tab.name,
                        text: `Key shared with ${nick.trim()}`,
                        timestamp: Date.now(),
                        type: 'notice',
                      });
                    }
                  },
                },
              ],
              'plain-text'
            );
          },
        });
      }

      options.push({
        text: isBookmarked ? 'Remove Channel Bookmark' : 'Bookmark Channel',
        onPress: async () => {
          await channelNotesService.setBookmarked(tab.networkId, tab.name, !isBookmarked);
          setShowTabOptionsModal(false);
        },
      });
      options.push({
        text: 'Edit Channel Note',
        onPress: async () => {
          const note = await channelNotesService.getNote(tab.networkId, tab.name);
          setChannelNoteTarget({ networkId: tab.networkId, channel: tab.name });
          setChannelNoteValue(note);
          setShowChannelNoteModal(true);
        },
      });
      options.push({
        text: 'View Activity Log',
        onPress: async () => {
          const log = await channelNotesService.getLog(tab.networkId, tab.name);
          setChannelNoteTarget({ networkId: tab.networkId, channel: tab.name });
          setChannelLogEntries(log.slice().sort((a, b) => a.timestamp - b.timestamp));
          setShowChannelLogModal(true);
        },
      });
    }

    // Option to add/remove from favorites
    const isFav = await channelFavoritesService.isFavorite(tab.networkId, tab.name);
    if (isFav) {
      options.push({
        text: 'Remove from Favorites',
        onPress: async () => {
          await channelFavoritesService.removeFavorite(tab.networkId, tab.name);
          setShowTabOptionsModal(true);
        },
      });
    } else if (tab.type === 'channel') { // Only channels can be favorited
      options.push({
        text: 'Add to Favorites',
        onPress: async () => {
          await channelFavoritesService.addFavorite(tab.networkId, tab.name);
          setShowTabOptionsModal(true);
        },
      });
    }
    
    options.push({ text: 'Cancel', style: 'cancel', onPress: () => setShowTabOptionsModal(false) });

    setTabOptionsTitle(`${tab.type === 'channel' ? 'Channel' : 'Query'}: ${tab.name}`);
    setTabOptions(options);
    setShowTabOptionsModal(true);
  }, [
    activeTabId,
    getNetworkConfigForId,
    getActiveIRCService,
    getActiveUserManagementService,
    handleConnect,
    closeAllChannelsAndQueries,
    normalizeNetworkId,
    primaryNetworkId,
    safeAlert,
    setShowTabOptionsModal,
  ]);

  // Remove handleAddPress as its logic is now merged into handleDropdownPress
  // const handleAddPress = useCallback(() => { /* ... (old code removed) ... */ }, [handleConnect, isConnected]);

  const handleMenuPress = useCallback(() => {
    setShowSettings(true);
  }, []);

  const handleToggleUserList = useCallback(() => {
    setShowUserList(prev => !prev);
  }, []);

  // UI ready delay to prevent Fabric race condition
  const [uiReady, setUiReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setUiReady(true);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const showNicklistButton = activeTab.type === 'channel';
  const focusedNetworkId =
    activeTab?.networkId ||
    activeConnectionId ||
    (networkName !== 'Not connected' ? networkName : undefined) ||
    tabs.find(t => t.type === 'server')?.networkId;

  const renderUserList = (position: 'left' | 'right' | 'top' | 'bottom') => {
    if (activeTab.type !== 'channel' || !showUserList) {
      return null;
    }
    return (
      <UserList
        users={activeUsers}
        channelName={activeTab.name}
        network={activeTab?.networkId}
        position={position}
        onUserPress={async (user) => {
          // Open query window or perform action
          const queryId = queryTabId(activeTab.networkId, user.nick);
          const queryTab = tabs.find(t => t.id === queryId && t.type === 'query');
          if (queryTab) {
            setActiveTabId(queryTab.id);
          } else {
            // Create new query tab
            const network = activeTab.networkId || '';
            const isEncrypted = await encryptedDMService.isEncryptedForNetwork(network, user.nick);
            const newQueryTab: ChannelTab = {
              id: queryId,
              name: user.nick,
              type: 'query',
              networkId: activeTab.networkId,
              messages: [],
              isEncrypted,
            };
            setTabs((prev) => sortTabsGrouped([...prev, newQueryTab], tabSortAlphabetical));
            setActiveTabId(newQueryTab.id);
          }
        }}
        onWHOISPress={(nick) => {
          setWhoisNick(nick);
          setShowWHOIS(true);
        }}
      />
    );
  };

  // Wait for UI to be ready to prevent Fabric crashes
  if (!uiReady) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  return (
    <View style={[styles.container, { paddingTop: safeAreaInsets.top }]}>
      <HeaderBar
        networkName={isConnected ? networkName : (selectedNetworkName || networkName)}
        ping={ping}
        isConnected={isConnected}
        onDropdownPress={handleDropdownPress}
        onMenuPress={handleMenuPress}
        onConnectPress={() => handleConnect()}
        showNicklistButton={showNicklistButton}
        onToggleNicklist={handleToggleUserList}
        showLockButton={appLockEnabled}
        lockState={appLocked ? 'locked' : 'unlocked'}
        onLockPress={handleLockButtonPress}
        showEncryptionButton={activeTab.type === 'query'}
        onEncryptionPress={() => setShowQueryEncryptionMenu(true)}
      />
      {layoutConfig.tabPosition === 'top' && (
        <ChannelTabs
          tabs={tabs}
          activeTabId={activeTabId}
          onTabPress={handleTabPress}
          onTabLongPress={handleTabLongPress}
          showEncryptionIndicators={showEncryptionIndicators}
          position="top"
        />
      )}
      <View
        style={[
          styles.contentArea,
          (layoutConfig.tabPosition === 'left' || layoutConfig.tabPosition === 'right') && styles.contentAreaRow,
        ]}>
        {layoutConfig.tabPosition === 'left' && (
          <ChannelTabs
            tabs={tabs}
            activeTabId={activeTabId}
            onTabPress={handleTabPress}
            onTabLongPress={handleTabLongPress}
            showEncryptionIndicators={showEncryptionIndicators}
            position="left"
          />
        )}
        <View
          style={[
            styles.messageAndUser,
            (layoutConfig.userListPosition === 'left' || layoutConfig.userListPosition === 'right') && styles.messageAndUserRow,
            (layoutConfig.userListPosition === 'top' || layoutConfig.userListPosition === 'bottom') && styles.messageAndUserColumn,
          ]}>
          {layoutConfig.userListPosition === 'top' && renderUserList('top')}
          {layoutConfig.userListPosition === 'left' && renderUserList('left')}
          <View style={styles.messageAreaContainer}>
            <MessageArea
              messages={activeMessages}
              showRawCommands={showRawCommands}
              rawCategoryVisibility={rawCategoryVisibility}
              hideJoinMessages={hideJoinMessages}
              hidePartMessages={hidePartMessages}
              hideQuitMessages={hideQuitMessages}
              hideIrcServiceListenerMessages={hideIrcServiceListenerMessages}
              channel={activeTab.type === 'channel' ? activeTab.name : undefined}
              network={activeTab?.networkId}
              bottomInset={safeAreaInsets.bottom}
            />
          </View>
          {layoutConfig.userListPosition === 'right' && renderUserList('right')}
          {layoutConfig.userListPosition === 'bottom' && renderUserList('bottom')}
        </View>
        {layoutConfig.tabPosition === 'right' && (
          <ChannelTabs
            tabs={tabs}
            activeTabId={activeTabId}
            onTabPress={handleTabPress}
            onTabLongPress={handleTabLongPress}
            showEncryptionIndicators={showEncryptionIndicators}
            position="right"
          />
        )}
      </View>
      {layoutConfig.tabPosition === 'bottom' && (
        <ChannelTabs
          tabs={tabs}
          activeTabId={activeTabId}
          onTabPress={handleTabPress}
          onTabLongPress={handleTabLongPress}
          showEncryptionIndicators={showEncryptionIndicators}
          position="bottom"
        />
      )}
      {activeTab && typingUsers.has(activeTab.name) && (
        <TypingIndicator typingUsers={typingUsers.get(activeTab.name)!} />
      )}
      <MessageInput
        placeholder="Enter a message"
        onSubmit={handleSendMessage}
        disabled={!isConnected}
        prefilledMessage={prefillMessage || undefined}
        onPrefillUsed={() => setPrefillMessage(null)}
        bottomInset={safeAreaInsets.bottom}
        tabType={activeTab?.type}
        tabName={activeTab?.name}
      />

      {/* First Run Setup Modal */}
      {showFirstRunSetup && (
        <Modal
          visible={showFirstRunSetup}
          animationType="slide"
          onRequestClose={() => {
            // Allow dismissing after completion
            setShowFirstRunSetup(false);
          }}>
          <FirstRunSetupScreen
            onComplete={handleFirstRunSetupComplete}
            onSkip={() => {
              // User chose "Connect Later" - just close the modal
              setShowFirstRunSetup(false);
            }}
          />
        </Modal>
      )}

      {showOptionsMenu && (
        <Modal
          visible={showOptionsMenu}
          transparent
          animationType="fade"
          onRequestClose={() => setShowOptionsMenu(false)}>
          <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowOptionsMenu(false)}>
            <View style={styles.optionsMenu}>
              {isConnected ? (
                <>
                  <TouchableOpacity style={styles.optionItem} onPress={() => { setShowOptionsMenu(false); setShowChannelModal(true); }}>
                    <Text style={styles.optionText}>Join Channel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.optionItem}
                  onPress={() => {
                    setShowOptionsMenu(false);
                    setTabs(prev => sortTabsGrouped(prev.filter(t => !(focusedNetworkId && t.networkId === focusedNetworkId && t.type === 'channel')), tabSortAlphabetical));
                  }}>
                    <Text style={styles.optionText}>Close All Channels</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.optionItem}
                    onPress={() => {
                      setShowOptionsMenu(false);
                      setTabs(prev => sortTabsGrouped(prev.filter(t => !(focusedNetworkId && t.networkId === focusedNetworkId && t.type === 'query')), tabSortAlphabetical));
                    }}>
                    <Text style={styles.optionText}>Close All Privates</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.optionItem} onPress={() => {
                    setShowOptionsMenu(false);
                    if (focusedNetworkId) {
                      connectionManager.disconnect(focusedNetworkId);
                      setActiveConnectionId(connectionManager.getActiveNetworkId());
                    }
                  }}>
                    <Text style={[styles.optionText, styles.destructiveOption]}>Disconnect {networkName || ''}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.optionItem} onPress={() => { setShowOptionsMenu(false); setShowNetworksList(true); }}>
                    <Text style={styles.optionText}>Connect Another Network</Text>
                  </TouchableOpacity>
              <TouchableOpacity style={styles.optionItem} onPress={() => { setShowOptionsMenu(false); setShowChannelList(true); }}>
                <Text style={styles.optionText}>Browse Channels</Text>
              </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity style={styles.optionItem} onPress={() => { setShowOptionsMenu(false); handleConnect(); }}>
                    <Text style={styles.optionText}>Connect to Default</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.optionItem} onPress={() => { setShowOptionsMenu(false); setShowNetworksList(true); }}>
                    <Text style={styles.optionText}>Choose Network</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.optionItem}
                    onPress={() => {
                      setShowOptionsMenu(false);
                      setTabs(prev => sortTabsGrouped(prev.filter(t => !(focusedNetworkId && t.networkId === focusedNetworkId && t.type === 'channel'))));
                    }}>
                    <Text style={styles.optionText}>Close All Channels</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.optionItem}
                    onPress={() => {
                      setShowOptionsMenu(false);
                      setTabs(prev => sortTabsGrouped(prev.filter(t => !(focusedNetworkId && t.networkId === focusedNetworkId && t.type === 'query'))));
                    }}>
                    <Text style={styles.optionText}>Close All Privates</Text>
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity style={styles.optionItem} onPress={() => { setShowOptionsMenu(false); setShowDccTransfers(true); }}>
                <Text style={styles.optionText}>DCC Transfers</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.optionItem} onPress={() => { setShowOptionsMenu(false); persistentSetShowRawCommands(!showRawCommands); }}>
                <Text style={styles.optionText}>{showRawCommands ? 'Hide RAW' : 'Show RAW'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.optionItem} onPress={() => { setShowOptionsMenu(false); handleExit(); }}>
                <Text style={[styles.optionText, styles.destructiveOption]}>Exit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.optionItem} onPress={() => setShowOptionsMenu(false)}>
                <Text style={styles.optionText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
      <Modal
        visible={showChannelModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowChannelModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Join Channel</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter channel name (e.g., #android)"
              value={channelName}
              onChangeText={setChannelName}
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={() => handleJoinChannel()}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowChannelModal(false);
                  setChannelName('');
                }}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonJoin]}
                onPress={() => handleJoinChannel()}>
                <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>Join</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {showNetworksList && (
        <NetworksListScreen
          onSelectNetwork={(network, serverId) => handleConnect(network, serverId)}
          onClose={() => setShowNetworksList(false)}
        />
      )}
      {showSettings && (
        <SettingsScreen
          visible={showSettings}
          onClose={() => setShowSettings(false)}
          currentNetwork={activeTab?.networkId}
          showRawCommands={showRawCommands}
          onShowRawCommandsChange={persistentSetShowRawCommands}
          rawCategoryVisibility={rawCategoryVisibility}
          onRawCategoryVisibilityChange={persistentSetRawCategoryVisibility}
          showEncryptionIndicators={showEncryptionIndicators}
          onShowEncryptionIndicatorsChange={persistentSetShowEncryptionIndicators}
          onShowIgnoreList={() => setShowIgnoreList(true)}
        />
      )}
      {showIgnoreList && (
        <IgnoreListScreen
          visible={showIgnoreList}
          network={activeTab?.networkId}
          onClose={() => setShowIgnoreList(false)}
        />
      )}
      {showWHOIS && (
        <WHOISDisplay
          visible={showWHOIS}
          nick={whoisNick}
          network={activeTab?.networkId}
          onClose={() => {
            setShowWHOIS(false);
            setWhoisNick('');
          }}
        />
      )}
      {showQueryEncryptionMenu && activeTab.type === 'query' && (
        <QueryEncryptionMenu
          visible={showQueryEncryptionMenu}
          onClose={() => setShowQueryEncryptionMenu(false)}
          nick={activeTab.name}
          network={activeTab.networkId}
        />
      )}
      {showChannelList && (
        <ChannelListScreen
          visible={showChannelList}
          network={activeTab?.networkId}
          onClose={() => setShowChannelList(false)}
          onJoinChannel={handleJoinChannel}
        />
      )}
      {showChannelNoteModal && channelNoteTarget && (
        <Modal
          visible={showChannelNoteModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowChannelNoteModal(false)}>
          <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowChannelNoteModal(false)}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Channel Note ({channelNoteTarget.channel})</Text>
              <TextInput
                style={[styles.modalInput, { minHeight: 100, textAlignVertical: 'top' }]}
                multiline
                placeholder="Enter a note for this channel"
                value={channelNoteValue}
                onChangeText={setChannelNoteValue}
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => setShowChannelNoteModal(false)}>
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonJoin]}
                  onPress={async () => {
                    await channelNotesService.setNote(channelNoteTarget.networkId, channelNoteTarget.channel, channelNoteValue);
                    setShowChannelNoteModal(false);
                  }}>
                  <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
      {showChannelLogModal && (
        <Modal
          visible={showChannelLogModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowChannelLogModal(false)}>
          <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowChannelLogModal(false)}>
            <View style={[styles.modalContent, { maxHeight: '80%' }]}>
              <Text style={styles.modalTitle}>Channel Activity</Text>
              <View style={{ maxHeight: 300 }}>
                {channelLogEntries.length === 0 ? (
                  <Text style={styles.optionText}>No activity recorded</Text>
                ) : (
                  channelLogEntries.map((entry, idx) => (
                    <Text key={`log-${idx}`} style={styles.optionText}>
                      {new Date(entry.timestamp).toLocaleString()} - {entry.text}
                    </Text>
                  ))
                )}
              </View>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => setShowChannelLogModal(false)}>
                  <Text style={styles.modalButtonText}>Close</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonJoin]}
                  onPress={async () => {
                    if (channelNoteTarget) {
                      await channelNotesService.clearLog(channelNoteTarget.networkId, channelNoteTarget.channel);
                      setChannelLogEntries([]);
                    }
                  }}>
                  <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>Clear Log</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
      {showRenameModal && renameTargetTabId && (
        <Modal
          visible={showRenameModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowRenameModal(false)}>
          <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowRenameModal(false)}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Rename Server Tab</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Enter new name"
                value={renameValue}
                onChangeText={setRenameValue}
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={() => {
                  setTabs(prev => prev.map(t => t.id === renameTargetTabId ? { ...t, name: renameValue || t.name } : t));
                  setShowRenameModal(false);
                }}
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => setShowRenameModal(false)}>
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonJoin]}
                  onPress={() => {
                    setTabs(prev => prev.map(t => t.id === renameTargetTabId ? { ...t, name: renameValue || t.name } : t));
                    setShowRenameModal(false);
                  }}>
                  <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>Rename</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
      {showTabOptionsModal && (
        <Modal
          visible={showTabOptionsModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowTabOptionsModal(false)}>
          <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowTabOptionsModal(false)}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{tabOptionsTitle || 'Options'}</Text>
              {tabOptions.map((opt, idx) => (
                <TouchableOpacity
                  key={`${opt.text}-${idx}`}
                  style={[styles.modalButton, opt.style === 'destructive' && styles.modalButtonCancel]}
                  onPress={() => {
                    setShowTabOptionsModal(false);
                    opt.onPress && opt.onPress();
                  }}>
                  <Text
                    style={[
                      styles.modalButtonText,
                      opt.style === 'destructive' && styles.destructiveOption,
                    ]}>
                    {opt.text}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>
      )}
      {showChannelSettings && channelSettingsTarget && channelSettingsNetwork && (
        <ChannelSettingsScreen
          visible={showChannelSettings}
          channel={channelSettingsTarget}
          network={channelSettingsNetwork}
          onClose={() => setShowChannelSettings(false)}
        />
      )}
      {showDccTransfers && (
        <Modal
          visible={showDccTransfers}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDccTransfers(false)}>
          <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowDccTransfers(false)}>
            <View style={[styles.modalContent, { maxHeight: '80%' }]}>
              <Text style={styles.modalTitle}>DCC Transfers</Text>
              {dccTransfers.length === 0 ? (
                <Text style={styles.optionText}>No transfers</Text>
              ) : (
                dccTransfers.map(t => {
                  const percent = t.size ? Math.min(100, Math.floor((t.bytesReceived / t.size) * 100)) : undefined;
                  return (
                    <View key={t.id} style={{ marginBottom: 12 }}>
                      <Text style={styles.optionText}>{t.offer.filename} ({t.direction})</Text>
                      <Text style={styles.optionText}>Status: {t.status} {percent !== undefined ? `- ${percent}%` : ''}</Text>
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                        {t.status === 'pending' && t.direction === 'incoming' && (
                          <TouchableOpacity
                            onPress={async () => {
                              const RNFS = require('react-native-fs');
                              const path = `${RNFS.DocumentDirectoryPath}/${t.offer.filename}`;
                              await dccFileService.accept(t.id, getActiveIRCService(), path);
                            }}>
                            <Text style={styles.optionText}>Accept</Text>
                          </TouchableOpacity>
                        )}
                        {(t.status === 'failed' || t.status === 'cancelled') && t.filePath && (
                          <TouchableOpacity
                            onPress={async () => {
                              await dccFileService.accept(t.id, getActiveIRCService(), t.filePath || `${require('react-native-fs').DocumentDirectoryPath}/${t.offer.filename}`);
                            }}>
                            <Text style={styles.optionText}>Resume</Text>
                          </TouchableOpacity>
                        )}
                        {(t.status === 'downloading' || t.status === 'pending' || t.status === 'sending') && (
                          <TouchableOpacity onPress={() => dccFileService.cancel(t.id)}>
                            <Text style={[styles.optionText, styles.destructiveOption]}>Cancel</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </TouchableOpacity>
        </Modal>
      )}
      {showDccSendModal && dccSendTarget && (
        <Modal
          visible={showDccSendModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDccSendModal(false)}>
          <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowDccSendModal(false)}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Offer DCC Send to {dccSendTarget.nick}</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Enter file path on device"
                value={dccSendPath}
                onChangeText={setDccSendPath}
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => setShowDccSendModal(false)}>
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonJoin]}
                  onPress={async () => {
                    try {
                      await dccFileService.sendFile(getActiveIRCService(), dccSendTarget.nick, dccSendTarget.networkId, dccSendPath);
                      setShowDccSendModal(false);
                      setDccSendPath('');
                    } catch (e) {
                      safeAlert(
                        t('DCC Send Error', { _tags: 'screen:app,file:App.tsx,feature:dcc' }),
                        e instanceof Error
                          ? e.message
                          : t('Failed to send file', { _tags: 'screen:app,file:App.tsx,feature:dcc' })
                      );
                    }
                  }}>
                  <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>Send</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
      <Modal
        visible={appUnlockModalVisible && appLockEnabled}
        transparent
        animationType="fade"
        onRequestClose={() => {}}>
        <View style={styles.lockOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>App Locked</Text>
            {appLockUsePin && (
              <>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Enter PIN"
                  value={appPinEntry}
                  onChangeText={(text) => {
                    const sanitized = text.replace(/[^0-9]/g, '');
                    setAppPinEntry(sanitized);
                    if (appPinError) setAppPinError('');
                  }}
                  keyboardType="numeric"
                  secureTextEntry
                />
                {!!appPinError && (
                  <Text style={[styles.optionText, { color: colors.error }]}>
                    {appPinError}
                  </Text>
                )}
              </>
            )}
            <View style={styles.modalButtons}>
              {appLockUseBiometric && (
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonJoin]}
                  onPress={() => attemptBiometricUnlock()}>
                  <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>
                    Use Biometrics
                  </Text>
                </TouchableOpacity>
              )}
              {appLockUsePin && (
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonJoin]}
                  onPress={handleAppPinUnlock}>
                  <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>
                    Unlock
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

;const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentArea: {
    flex: 1,
    flexDirection: 'column',
  },
  contentAreaRow: {
    flexDirection: 'row',
  },
  messageAndUser: {
    flex: 1,
  },
  messageAndUserRow: {
    flexDirection: 'row',
  },
  messageAndUserColumn: {
    flexDirection: 'column',
  },
  messageAreaContainer: {
    flex: 1,
    flexDirection: 'row',
    position: 'relative',
    minWidth: 0,
  },
  userListToggle: {
    position: 'absolute',
    right: 0,
    top: '50%',
    transform: [{ translateY: -15 }],
    width: 30,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
    zIndex: 10,
  },
  userListToggleText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
    modalOverlay: {
      flex: 1,
      backgroundColor: colors.modalOverlay,
      justifyContent: 'center',
      alignItems: 'center',
    },
    lockOverlay: {
      flex: 1,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
  modalContent: {
    backgroundColor: colors.modalBackground,
    borderRadius: 8,
    padding: 20,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: colors.modalText,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    padding: 12,
    fontSize: 14,
    marginBottom: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 4,
  },
  modalButtonCancel: {
    backgroundColor: colors.buttonSecondary,
  },
  modalButtonJoin: {
    backgroundColor: colors.buttonPrimary,
  },
  modalButtonText: {
    fontSize: 14,
    color: colors.buttonSecondaryText,
  },
  modalButtonTextPrimary: {
    color: colors.buttonPrimaryText,
    fontWeight: '600',
  },
  optionsMenu: {
    backgroundColor: colors.modalBackground,
    borderRadius: 8,
    padding: 10,
    width: '80%',
    maxWidth: 300,
    alignSelf: 'center',
  },
  optionItem: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionText: {
    fontSize: 16,
    color: colors.modalText,
    textAlign: 'center',
  },
  destructiveOption: {
    color: colors.error,
  },
});

export default App;

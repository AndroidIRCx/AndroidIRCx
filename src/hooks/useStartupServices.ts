/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useEffect } from 'react';
import { BackHandler, DeviceEventEmitter, Platform } from 'react-native';
import RNBootSplash from 'react-native-bootsplash';
import { ircService } from '../services/IRCService';
import { backgroundService } from '../services/BackgroundService';
import { notificationService } from '../services/NotificationService';
import { connectionManager } from '../services/ConnectionManager';
import { ircForegroundService } from '../services/IRCForegroundService';
import { channelManagementService } from '../services/ChannelManagementService';
import { userManagementService } from '../services/UserManagementService';
import { messageReactionsService } from '../services/MessageReactionsService';
import { channelFavoritesService } from '../services/ChannelFavoritesService';
import { autoRejoinService } from '../services/AutoRejoinService';
import { autoVoiceService } from '../services/AutoVoiceService';
import { connectionProfilesService } from '../services/ConnectionProfilesService';
import { autoReconnectService } from '../services/AutoReconnectService';
import { connectionQualityService } from '../services/ConnectionQualityService';
import { bouncerService } from '../services/BouncerService';
import { layoutService } from '../services/LayoutService';
import { banService } from '../services/BanService';
import { commandService } from '../services/CommandService';
import { performanceService } from '../services/PerformanceService';
import { themeService } from '../services/ThemeService';
import { scriptingService } from '../services/ScriptingService';
import { messageHistoryBatching } from '../services/MessageHistoryBatching';
import { NEW_FEATURE_DEFAULTS, settingsService, DEFAULT_QUIT_MESSAGE } from '../services/SettingsService';
import { awayService } from '../services/AwayService';
import { protectionService } from '../services/ProtectionService';
import { presetImportService } from '../services/PresetImportService';

export const useStartupServices = () => {
  useEffect(() => {
    try {
      themeService.initialize();
    } catch (error) {
      console.error('Error initializing theme service:', error);
    }
  }, []);

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

  useEffect(() => {
    messageReactionsService.initialize();
  }, []);

  useEffect(() => {
    channelFavoritesService.initialize();
  }, []);

  useEffect(() => {
    autoRejoinService.initialize();
    autoVoiceService.initialize();
  }, []);

  useEffect(() => {
    connectionProfilesService.initialize();
  }, []);

  useEffect(() => {
    autoReconnectService.initialize();
  }, []);

  useEffect(() => {
    // Services will be initialized per-connection via ConnectionManager
    // Keep singleton initialization for backward compatibility
    connectionQualityService.setIRCService(ircService);
    connectionQualityService.initialize();
  }, []);

  useEffect(() => {
    bouncerService.initialize();
  }, []);

  useEffect(() => {
    layoutService.initialize();
  }, []);

  useEffect(() => {
    banService.initialize();
  }, []);

  useEffect(() => {
    // Services will be initialized per-connection via ConnectionManager
    // Keep singleton initialization for backward compatibility
    commandService.setIRCService(ircService);
    commandService.initialize();
  }, []);

  useEffect(() => {
    performanceService.initialize();
  }, []);

  useEffect(() => {
    awayService.initialize();
  }, []);

  useEffect(() => {
    const seedDefaults = async () => {
      try {
        const [
          spamPmKeywords,
          dccAcceptExts,
          dccRejectExts,
          dccDontSendExts,
        ] = await Promise.all([
          settingsService.getSetting('spamPmKeywords', NEW_FEATURE_DEFAULTS.spamPmKeywords),
          settingsService.getSetting('dccAcceptExts', NEW_FEATURE_DEFAULTS.dccAcceptExts),
          settingsService.getSetting('dccRejectExts', NEW_FEATURE_DEFAULTS.dccRejectExts),
          settingsService.getSetting('dccDontSendExts', NEW_FEATURE_DEFAULTS.dccDontSendExts),
        ]);

        const mergeUnique = (existing: string[], defaults: string[]) => {
          const seen = new Set(existing);
          const merged = [...existing];
          defaults.forEach((entry) => {
            if (!seen.has(entry)) {
              merged.push(entry);
              seen.add(entry);
            }
          });
          return merged;
        };

        const nextSpam = mergeUnique(spamPmKeywords || [], NEW_FEATURE_DEFAULTS.spamPmKeywords);
        if (nextSpam.length !== (spamPmKeywords || []).length) {
          await settingsService.setSetting('spamPmKeywords', nextSpam);
        }

        const nextAccept = mergeUnique(dccAcceptExts || [], NEW_FEATURE_DEFAULTS.dccAcceptExts);
        if (nextAccept.length !== (dccAcceptExts || []).length) {
          await settingsService.setSetting('dccAcceptExts', nextAccept);
        }

        const nextReject = mergeUnique(dccRejectExts || [], NEW_FEATURE_DEFAULTS.dccRejectExts);
        if (nextReject.length !== (dccRejectExts || []).length) {
          await settingsService.setSetting('dccRejectExts', nextReject);
        }

        const nextDontSend = mergeUnique(dccDontSendExts || [], NEW_FEATURE_DEFAULTS.dccDontSendExts);
        if (nextDontSend.length !== (dccDontSendExts || []).length) {
          await settingsService.setSetting('dccDontSendExts', nextDontSend);
        }
      } catch (error) {
        console.error('Error seeding default spam/DCC lists:', error);
      }
    };

    seedDefaults();
  }, []);

  useEffect(() => {
    protectionService.initialize();
  }, []);

  useEffect(() => {
    presetImportService.initialize();
  }, []);

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

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }
    const subscription = DeviceEventEmitter.addListener(
      'IRCForegroundServiceDisconnectQuit',
      async () => {
        try {
          const quitMessage = await settingsService.getSetting(
            'quitMessage',
            DEFAULT_QUIT_MESSAGE
          );
          connectionManager.disconnectAll(quitMessage);
          await messageHistoryBatching.flushSync().catch(err => {
            console.error('Error flushing message history on quit action:', err);
          });
          backgroundService.cleanup();
          await ircForegroundService.stop().catch(err => {
            console.error('Error stopping foreground service on quit action:', err);
          });
        } catch (error) {
          console.error('Error handling foreground disconnect action:', error);
        } finally {
          BackHandler.exitApp();
        }
      }
    );

    return () => subscription.remove();
  }, []);
};

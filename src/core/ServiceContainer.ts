/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * ServiceContainer
 *
 * Centralized service registry for dependency injection and easier testing.
 * All services are imported and re-exported from this single location.
 */

// Core IRC Services
import { ircService } from '../services/IRCService';
import { settingsService } from '../services/SettingsService';
import { backgroundService } from '../services/BackgroundService';
import { notificationService } from '../services/NotificationService';

// Message & History Services
import { messageHistoryService } from '../services/MessageHistoryService';
import { messageReactionsService } from '../services/MessageReactionsService';

// Channel Management Services
import { channelManagementService } from '../services/ChannelManagementService';
import { channelFavoritesService } from '../services/ChannelFavoritesService';
import { channelNotesService } from '../services/ChannelNotesService';

// User Management Services
import { userManagementService } from '../services/UserManagementService';
import { userActivityService } from '../services/UserActivityService';

// Connection Services
import { connectionManager } from '../services/ConnectionManager';
import { connectionProfilesService } from '../services/ConnectionProfilesService';
import { autoReconnectService } from '../services/AutoReconnectService';
import { connectionQualityService } from '../services/ConnectionQualityService';
import { bouncerService } from '../services/BouncerService';

// Security Services
import { biometricAuthService } from '../services/BiometricAuthService';
import { secureStorageService } from '../services/SecureStorageService';
import { encryptedDMService } from '../services/EncryptedDMService';
import { channelEncryptionService } from '../services/ChannelEncryptionService';
import { channelEncryptionSettingsService } from '../services/ChannelEncryptionSettingsService';

// Feature Services
import { autoRejoinService } from '../services/AutoRejoinService';
import { autoVoiceService } from '../services/AutoVoiceService';
import { offlineQueueService } from '../services/OfflineQueueService';
import { scriptingService } from '../services/ScriptingService';
import { identityProfilesService } from '../services/IdentityProfilesService';

// DCC Services
import { dccChatService } from '../services/DCCChatService';
import { dccFileService } from '../services/DCCFileService';

// Utility Services
import { layoutService } from '../services/LayoutService';
import { commandService } from '../services/CommandService';
import { performanceService } from '../services/PerformanceService';
import { errorReportingService } from '../services/ErrorReportingService';
import { keyboardShortcutService } from '../services/KeyboardShortcutService';
import { logger } from '../services/Logger';
import { themeService } from '../services/ThemeService';
import { tabService } from '../services/TabService';

// Monetization Services
import { adRewardService } from '../services/AdRewardService';
import { bannerAdService } from '../services/BannerAdService';
import { inAppPurchaseService } from '../services/InAppPurchaseService';
import { consentService } from '../services/ConsentService';

/**
 * ServiceContainer - Centralized service access
 *
 * Usage:
 *   import { services } from './core/ServiceContainer';
 *   services.irc.connect(config);
 *   services.settings.loadNetworks();
 */
export const services = {
  // Core IRC
  irc: ircService,
  settings: settingsService,
  background: backgroundService,
  notifications: notificationService,

  // Message & History
  messageHistory: messageHistoryService,
  messageReactions: messageReactionsService,

  // Channel Management
  channelManagement: channelManagementService,
  channelFavorites: channelFavoritesService,
  channelNotes: channelNotesService,

  // User Management
  userManagement: userManagementService,
  userActivity: userActivityService,

  // Connection
  connectionManager: connectionManager,
  connectionProfiles: connectionProfilesService,
  autoReconnect: autoReconnectService,
  connectionQuality: connectionQualityService,
  bouncer: bouncerService,

  // Security
  biometricAuth: biometricAuthService,
  secureStorage: secureStorageService,
  encryptedDM: encryptedDMService,
  channelEncryption: channelEncryptionService,
  channelEncryptionSettings: channelEncryptionSettingsService,

  // Features
  autoRejoin: autoRejoinService,
  autoVoice: autoVoiceService,
  offlineQueue: offlineQueueService,
  scripting: scriptingService,
  identityProfiles: identityProfilesService,

  // DCC
  dccChat: dccChatService,
  dccFile: dccFileService,

  // Utility
  layout: layoutService,
  command: commandService,
  performance: performanceService,
  errorReporting: errorReportingService,
  keyboardShortcut: keyboardShortcutService,
  logger: logger,
  theme: themeService,
  tab: tabService,

  // Monetization
  adReward: adRewardService,
  bannerAd: bannerAdService,
  inAppPurchase: inAppPurchaseService,
  consent: consentService,
} as const;

/**
 * Individual service exports for backward compatibility
 * These can be imported directly if needed:
 *   import { ircService, settingsService } from './core/ServiceContainer';
 */
export {
  // Core IRC
  ircService,
  settingsService,
  backgroundService,
  notificationService,

  // Message & History
  messageHistoryService,
  messageReactionsService,

  // Channel Management
  channelManagementService,
  channelFavoritesService,
  channelNotesService,

  // User Management
  userManagementService,
  userActivityService,

  // Connection
  connectionManager,
  connectionProfilesService,
  autoReconnectService,
  connectionQualityService,
  bouncerService,

  // Security
  biometricAuthService,
  secureStorageService,
  encryptedDMService,
  channelEncryptionService,
  channelEncryptionSettingsService,

  // Features
  autoRejoinService,
  autoVoiceService,
  offlineQueueService,
  scriptingService,
  identityProfilesService,

  // DCC
  dccChatService,
  dccFileService,

  // Utility
  layoutService,
  commandService,
  performanceService,
  errorReportingService,
  keyboardShortcutService,
  logger,
  themeService,
  tabService,

  // Monetization
  adRewardService,
  bannerAdService,
  inAppPurchaseService,
  consentService,
};

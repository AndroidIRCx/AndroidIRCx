/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Integration tests for SettingsScreen
 * Tests the overall functionality and component integration
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import * as settingsHelpers from '../../src/utils/settingsHelpers';

// Mocks are defined in jest.setup.ts
jest.mock('../../src/utils/settingsHelpers');
jest.mock('../../src/services/SettingsService', () => ({
  settingsService: {
    getSetting: jest.fn((key: string, defaultValue: any) => Promise.resolve(defaultValue)),
    setSetting: jest.fn().mockResolvedValue(undefined),
    getAllSettings: jest.fn().mockResolvedValue({}),
    getNetwork: jest.fn().mockResolvedValue(null),
    getAllNetworks: jest.fn().mockResolvedValue([]),
    saveNetwork: jest.fn().mockResolvedValue(undefined),
    deleteNetwork: jest.fn().mockResolvedValue(undefined),
    getZncConfig: jest.fn().mockResolvedValue({
      enabled: false,
      server: '',
      port: 6667,
      useSsl: false,
      username: '',
      password: '',
      subscriptionId: '',
      purchaseToken: '',
      zncUsername: '',
    }),
    saveZncConfig: jest.fn().mockResolvedValue(undefined),
    getBncConfig: jest.fn().mockResolvedValue({
      enabled: false,
      server: '',
      port: 6667,
      useSsl: false,
      username: '',
      password: '',
    }),
    saveBncConfig: jest.fn().mockResolvedValue(undefined),
    on: jest.fn().mockReturnValue(jest.fn()),
    off: jest.fn(),
    onSettingChange: jest.fn().mockReturnValue(jest.fn()),
  },
  DEFAULT_PART_MESSAGE: 'Leaving',
  DEFAULT_QUIT_MESSAGE: 'Quit',
  IRCNetworkConfig: class IRCNetworkConfig {},
}));
jest.mock('../../src/services/NotificationService', () => ({
  notificationService: {
    getPreferences: jest.fn(() => ({ enabled: false })),
    listChannelPreferences: jest.fn(() => []),
    checkPermission: jest.fn().mockResolvedValue(true),
    updatePreferences: jest.fn().mockResolvedValue(undefined),
    updateChannelPreferences: jest.fn().mockResolvedValue(undefined),
    removeChannelPreferences: jest.fn().mockResolvedValue(undefined),
    requestPermission: jest.fn().mockResolvedValue(true),
  },
}));
jest.mock('../../src/services/BackgroundService', () => ({
  backgroundService: {
    isBatteryOptimizationEnabled: jest.fn().mockResolvedValue(false),
    openBatteryOptimizationSettings: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../../src/services/MessageHistoryService', () => ({
  messageHistoryService: {
    getStats: jest.fn().mockResolvedValue({ totalMessages: 0, totalBytes: 0, perNetwork: {} }),
    exportHistory: jest.fn().mockResolvedValue({}),
    deleteNetworkMessages: jest.fn().mockResolvedValue(undefined),
    clearAll: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../../src/services/IRCService', () => ({
  ircService: {
    on: jest.fn().mockReturnValue(jest.fn()),
    sendRaw: jest.fn(),
    disconnect: jest.fn(),
    connect: jest.fn(),
    getConnectionStatus: jest.fn().mockReturnValue(false),
    addRawMessage: jest.fn(),
  },
  RAW_MESSAGE_CATEGORIES: [
    { id: 'connection', title: 'Connection', description: '' },
  ],
  getDefaultRawCategoryVisibility: () => ({ connection: true }),
}));
jest.mock('../../src/services/ThemeService', () => ({
  themeService: {
    getCurrentTheme: jest.fn().mockReturnValue({ id: 'light', name: 'Light', colors: {} }),
    onThemeChange: jest.fn().mockReturnValue(jest.fn()),
    getColors: jest.fn().mockReturnValue({}),
    getMessageFormat: jest.fn().mockReturnValue('{nick} has joined {channel}'),
    getAllThemes: jest.fn().mockReturnValue([]),
  },
}));
jest.mock('../../src/services/ConnectionProfilesService', () => ({
  connectionProfilesService: {
    list: jest.fn().mockResolvedValue([]),
  },
}));
jest.mock('../../src/services/BouncerService', () => ({
  bouncerService: {
    requestPlayback: jest.fn(),
  },
}));
jest.mock('../../src/services/LayoutService', () => ({
  layoutService: {
    getConfig: jest.fn().mockReturnValue({}),
    setConfig: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../../src/services/PerformanceService', () => ({
  performanceService: {
    getConfig: jest.fn().mockReturnValue({}),
    setConfig: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../../src/services/DataBackupService', () => ({
  dataBackupService: {
    getStorageStats: jest.fn().mockResolvedValue({ totalMessages: 0, totalBytes: 0 }),
    exportSettings: jest.fn().mockResolvedValue({}),
    exportAll: jest.fn().mockResolvedValue({}),
    importAll: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../../src/services/IdentityProfilesService', () => ({
  identityProfilesService: {
    list: jest.fn().mockResolvedValue([]),
  },
}));
jest.mock('../../src/services/BiometricAuthService', () => ({
  biometricAuthService: {
    getBiometryType: jest.fn().mockResolvedValue(null),
    authenticate: jest.fn().mockResolvedValue(true),
    enableLock: jest.fn().mockResolvedValue(true),
    disableLock: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../../src/services/SecureStorageService', () => ({
  secureStorageService: {
    getSecret: jest.fn().mockResolvedValue(null),
    setSecret: jest.fn().mockResolvedValue(undefined),
    removeSecret: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../../src/services/EncryptedDMService', () => ({
  encryptedDMService: {
    migrateOldKeysToNetwork: jest.fn().mockResolvedValue(0),
  },
}));
jest.mock('../../src/services/ConnectionManager', () => ({
  connectionManager: {
    getAllConnections: jest.fn().mockReturnValue([]),
    getActiveConnection: jest.fn().mockReturnValue(undefined),
    getActiveNetworkId: jest.fn().mockReturnValue(null),
    onConnectionCreated: jest.fn().mockReturnValue(jest.fn()),
  },
}));
jest.mock('../../src/services/InAppPurchaseService', () => ({
  inAppPurchaseService: {
    initialize: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../../src/services/AdRewardService', () => ({
  adRewardService: {
    initialize: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../../src/services/SubscriptionService', () => ({
  subscriptionService: {
    registerZncSubscription: jest.fn().mockResolvedValue({ success: false }),
    refreshAccountStatus: jest.fn().mockResolvedValue(undefined),
    restorePurchases: jest.fn().mockResolvedValue([]),
  },
}));

// Import SettingsScreen after mocks
const { SettingsScreen } = jest.requireActual('../../src/screens/SettingsScreen');

describe('SettingsScreen Integration', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock utility functions
    (settingsHelpers.getSectionIcon as jest.Mock).mockReturnValue({ name: 'cog', solid: false });
    (settingsHelpers.filterSettings as jest.Mock).mockImplementation((sections) => sections);
    (settingsHelpers.orderSections as jest.Mock).mockImplementation((sections) => sections);
    (settingsHelpers.toggleSectionExpansion as jest.Mock).mockImplementation(
      (title, expanded) => {
        const newSet = new Set(expanded);
        if (newSet.has(title)) {
          newSet.delete(title);
        } else {
          newSet.add(title);
        }
        return newSet;
      }
    );
  });

  it('should render settings screen with all sections', async () => {
    const { findByText } = render(
      <SettingsScreen visible={true} onClose={mockOnClose} />
    );

    expect(await findByText('Settings')).toBeTruthy();
  });

  it('should handle closing the settings screen', async () => {
    const { findByText } = render(
      <SettingsScreen visible={true} onClose={mockOnClose} />
    );

    const closeButton = await findByText('Done');
    fireEvent.press(closeButton);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should handle search functionality', async () => {
    const { findByPlaceholderText } = render(
      <SettingsScreen visible={true} onClose={mockOnClose} />
    );

    const searchInput = await findByPlaceholderText('Search settings...');
    fireEvent.changeText(searchInput, 'notification');
    expect(searchInput.props.value).toBe('notification');
  });

  it('should render all section components', async () => {
    const { findByText } = render(
      <SettingsScreen visible={true} onClose={mockOnClose} />
    );

    expect(await findByText('Appearance')).toBeTruthy();
    expect(await findByText('Messages & History')).toBeTruthy();
  });

  it('should handle search term clearing', async () => {
    const { findByPlaceholderText } = render(
      <SettingsScreen visible={true} onClose={mockOnClose} />
    );

    const searchInput = await findByPlaceholderText('Search settings...');
    fireEvent.changeText(searchInput, 'test search');
    fireEvent.changeText(searchInput, '');
    expect(searchInput.props.value).toBe('');
  });

  it('should handle section expansion toggle', async () => {
    const { findByText } = render(
      <SettingsScreen visible={true} onClose={mockOnClose} />
    );

    const sectionHeader = await findByText('Appearance');
    fireEvent.press(sectionHeader);
    expect(settingsHelpers.toggleSectionExpansion).toHaveBeenCalled();
  });

  it('should maintain state consistency', async () => {
    const { findByText } = render(
      <SettingsScreen visible={true} onClose={mockOnClose} />
    );

    expect(await findByText('Settings')).toBeTruthy();
  });
});

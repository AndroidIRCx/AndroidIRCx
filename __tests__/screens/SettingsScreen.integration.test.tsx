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
    getSetting: jest.fn().mockResolvedValue(null),
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
  },
  DEFAULT_PART_MESSAGE: 'Leaving',
  DEFAULT_QUIT_MESSAGE: 'Quit',
  IRCNetworkConfig: class IRCNetworkConfig {},
}));
jest.mock('../../src/services/NotificationService');
jest.mock('../../src/services/BackgroundService');
jest.mock('../../src/services/MessageHistoryService');
jest.mock('../../src/services/IRCService');
jest.mock('../../src/services/ThemeService');
jest.mock('../../src/services/ConnectionProfilesService');
jest.mock('../../src/services/BouncerService');
jest.mock('../../src/services/LayoutService');
jest.mock('../../src/services/PerformanceService');
jest.mock('../../src/services/DataBackupService');
jest.mock('../../src/services/IdentityProfilesService');
jest.mock('../../src/services/BiometricAuthService');
jest.mock('../../src/services/SecureStorageService');
jest.mock('../../src/services/EncryptedDMService');
jest.mock('../../src/services/ConnectionManager');
jest.mock('../../src/services/InAppPurchaseService');
jest.mock('../../src/services/AdRewardService');

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
    const { getByText } = render(
      <SettingsScreen visible={true} onClose={mockOnClose} />
    );

    await waitFor(() => {
      expect(getByText('Settings')).toBeTruthy();
    });
  });

  it('should handle closing the settings screen', async () => {
    const { getByTestId } = render(
      <SettingsScreen visible={true} onClose={mockOnClose} />
    );

    await waitFor(() => {
      const closeButton = getByTestId('settings-close-button');
      fireEvent.press(closeButton);
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('should handle search functionality', async () => {
    const { getByPlaceholderText } = render(
      <SettingsScreen visible={true} onClose={mockOnClose} />
    );

    await waitFor(() => {
      const searchInput = getByPlaceholderText('Search settings...');
      fireEvent.changeText(searchInput, 'notification');
      expect(searchInput.props.value).toBe('notification');
    });
  });

  it('should render all section components', async () => {
    const { getByTestId } = render(
      <SettingsScreen visible={true} onClose={mockOnClose} />
    );

    await waitFor(() => {
      // Check for presence of main settings container
      expect(getByTestId('settings-screen')).toBeTruthy();
    });
  });

  it('should handle search term clearing', async () => {
    const { getByPlaceholderText, getByText } = render(
      <SettingsScreen visible={true} onClose={mockOnClose} />
    );

    await waitFor(() => {
      const searchInput = getByPlaceholderText('Search settings...');
      fireEvent.changeText(searchInput, 'test search');
      
      // Clear the search
      fireEvent.changeText(searchInput, '');
      expect(searchInput.props.value).toBe('');
    });
  });

  it('should handle section expansion toggle', async () => {
    const { getByTestId } = render(
      <SettingsScreen visible={true} onClose={mockOnClose} />
    );

    await waitFor(() => {
      // Find and toggle a section
      const sectionHeader = getByTestId('settings-section-header');
      fireEvent.press(sectionHeader);
      
      // Verify toggle was called
      expect(settingsHelpers.toggleSectionExpansion).toHaveBeenCalled();
    });
  });

  it('should maintain state consistency', async () => {
    const { getByTestId } = render(
      <SettingsScreen visible={true} onClose={mockOnClose} />
    );

    await waitFor(() => {
      expect(getByTestId('settings-screen')).toBeTruthy();
    });
  });
});

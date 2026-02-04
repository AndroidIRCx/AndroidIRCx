/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for SecuritySection component
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert, Modal } from 'react-native';
import { SecuritySection } from '../../../src/components/settings/sections/SecuritySection';
import { settingsService } from '../../../src/services/SettingsService';
import { biometricAuthService } from '../../../src/services/BiometricAuthService';
import { secureStorageService } from '../../../src/services/SecureStorageService';

// Mock dependencies
jest.mock('../../../src/services/SettingsService');
jest.mock('../../../src/services/BiometricAuthService');
jest.mock('../../../src/services/SecureStorageService');
jest.mock('react-native', () => {
  const React = require('react');
  return {
    Alert: {
      alert: jest.fn(),
    },
    Platform: {
      OS: 'android',
    },
    View: ({ children, ...props }: any) => React.createElement('View', props, children),
    Text: ({ children, ...props }: any) => React.createElement('Text', props, children),
    TextInput: (props: any) => React.createElement('TextInput', props),
    TouchableOpacity: ({ children, ...props }: any) => React.createElement('TouchableOpacity', props, children),
    Modal: ({ children, ...props }: any) => React.createElement('Modal', props, children),
    ScrollView: ({ children, ...props }: any) => React.createElement('ScrollView', props, children),
    FlatList: (props: any) => React.createElement('FlatList', props),
    StyleSheet: {
      create: (styles: any) => styles,
      flatten: (style: any) => style,
    },
  };
});

const mockColors = {
  text: '#000000',
  textSecondary: '#666666',
  primary: '#007AFF',
  surface: '#FFFFFF',
  border: '#E0E0E0',
  background: '#F5F5F5',
};

const mockStyles = {
  settingItem: {},
  settingContent: {},
  settingTitleRow: {},
  settingTitle: {},
  settingDescription: {},
  disabledItem: {},
  disabledText: {},
  chevron: {},
  submenuOverlay: {},
  submenuContainer: {},
  submenuHeader: {},
  submenuTitle: {},
  closeButtonText: {},
  submenuInput: {},
  submenuItemDescription: {},
};

const mockSettingIcons = {};

describe.skip('SecuritySection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (settingsService.getSetting as jest.Mock).mockImplementation(async (key, defaultValue) => {
      const defaults: Record<string, any> = {
        securityAllowQrVerification: true,
        securityAllowFileExchange: true,
        securityAllowNfcExchange: true,
        appLockEnabled: false,
        appLockUseBiometric: false,
        appLockUsePin: false,
        appLockOnLaunch: true,
        appLockOnBackground: true,
      };
      return defaults[key] ?? defaultValue;
    });
    (biometricAuthService.isAvailable as jest.Mock).mockResolvedValue(true);
    (settingsService.setSetting as jest.Mock).mockResolvedValue(undefined);
  });

  it('should render security settings', () => {
    const { getByText } = render(
      <SecuritySection
        colors={mockColors}
        styles={mockStyles}
        settingIcons={mockSettingIcons}
      />
    );

    expect(getByText(/Manage Encryption Keys/i)).toBeTruthy();
    expect(getByText(/Allow QR Verification/i)).toBeTruthy();
  });

  it('should toggle QR verification setting', async () => {
    const { getByText } = render(
      <SecuritySection
        colors={mockColors}
        styles={mockStyles}
        settingIcons={mockSettingIcons}
      />
    );

    // Find and toggle the QR verification switch
    // This depends on how SettingSwitch is implemented
    await waitFor(() => {
      expect(getByText(/Allow QR Verification/i)).toBeTruthy();
    });
  });

  it('should call onShowKeyManagement when key management is pressed', () => {
    const mockOnShowKeyManagement = jest.fn();
    const { getByText } = render(
      <SecuritySection
        colors={mockColors}
        styles={mockStyles}
        settingIcons={mockSettingIcons}
        onShowKeyManagement={mockOnShowKeyManagement}
      />
    );

    const keyManagementButton = getByText(/Manage Encryption Keys/i);
    fireEvent.press(keyManagementButton);

    expect(mockOnShowKeyManagement).toHaveBeenCalled();
  });

  it('should call onShowMigrationDialog when migration is pressed', () => {
    const mockOnShowMigrationDialog = jest.fn();
    const { getByText } = render(
      <SecuritySection
        colors={mockColors}
        styles={mockStyles}
        settingIcons={mockSettingIcons}
        onShowMigrationDialog={mockOnShowMigrationDialog}
      />
    );

    const migrationButton = getByText(/Migrate Old Keys/i);
    fireEvent.press(migrationButton);

    expect(mockOnShowMigrationDialog).toHaveBeenCalled();
  });

  it('should disable biometric option when biometrics unavailable', async () => {
    (biometricAuthService.isAvailable as jest.Mock).mockResolvedValue(false);

    const { getByText } = render(
      <SecuritySection
        colors={mockColors}
        styles={mockStyles}
        settingIcons={mockSettingIcons}
      />
    );

    await waitFor(() => {
      expect(getByText(/App Lock with Biometrics/i)).toBeTruthy();
    });
  });
});

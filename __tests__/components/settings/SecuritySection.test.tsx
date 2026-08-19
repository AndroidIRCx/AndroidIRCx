/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for SecuritySection component
 */

import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { SecuritySection } from '../../../src/components/settings/sections/SecuritySection';

const mockCapturedItems = new Map<string, any>();
let settingsStore: Record<string, any> = {};
const mockSettingsGet = jest.fn(async (k: string, d: any) =>
  k in settingsStore ? settingsStore[k] : d,
);
const mockSettingsSet = jest.fn(async (k: string, v: any) => {
  settingsStore[k] = v;
});
const mockHasEnrolledBiometrics = jest.fn(async () => true);
const mockIsAvailable = jest.fn(async () => true);
const mockEnableLock = jest.fn(async () => true);
const mockDisableLock = jest.fn(async () => undefined);
const mockSetSecret = jest.fn(async () => undefined);
const mockRemoveSecret = jest.fn(async () => undefined);
const mockSetAllowScreenshots = jest.fn(async () => undefined);

jest.mock('../../../src/i18n/transifex', () => ({
  useT: () => (key: string) => key,
}));

jest.mock('../../../src/components/settings/SettingItem', () => {
  const ReactLocal = require('react');
  const { TouchableOpacity, Text } = require('react-native');
  return {
    SettingItem: ({ item }: any) => {
      mockCapturedItems.set(item.id, item);
      return ReactLocal.createElement(
        TouchableOpacity,
        {
          testID: `setting-${item.id}`,
          onPress: () => {
            item.onPress?.();
            if (item.type === 'switch') item.onValueChange?.(!item.value);
          },
        },
        ReactLocal.createElement(Text, null, item.title || item.id),
      );
    },
  };
});

jest.mock('../../../src/services/SettingsService', () => ({
  settingsService: {
    getSetting: (...args: any[]) => mockSettingsGet(...(args as [string, any])),
    setSetting: (...args: any[]) => mockSettingsSet(...(args as [string, any])),
  },
}));

jest.mock('../../../src/services/BiometricAuthService', () => ({
  biometricAuthService: {
    hasEnrolledBiometrics: (...args: any[]) =>
      mockHasEnrolledBiometrics(...args),
    isAvailable: (...args: any[]) => mockIsAvailable(...args),
    enableLock: (...args: any[]) => mockEnableLock(...args),
    disableLock: (...args: any[]) => mockDisableLock(...args),
  },
}));

jest.mock('../../../src/services/SecureStorageService', () => ({
  secureStorageService: {
    setSecret: (...args: any[]) => mockSetSecret(...args),
    removeSecret: (...args: any[]) => mockRemoveSecret(...args),
  },
}));

jest.mock('../../../src/services/ScreenshotProtectionService', () => ({
  screenshotProtectionService: {
    setAllowScreenshots: (...args: any[]) => mockSetAllowScreenshots(...args),
  },
}));

const mockColors = {
  text: '#000000',
  textSecondary: '#666666',
  primary: '#007AFF',
  onPrimary: '#FFFFFF',
  error: '#FF0000',
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

const renderSection = (props: Partial<Record<string, any>> = {}) =>
  render(
    <SecuritySection
      colors={mockColors}
      styles={mockStyles as any}
      settingIcons={mockSettingIcons}
      {...props}
    />,
  );

const waitForLoaded = () =>
  waitFor(() =>
    expect(mockCapturedItems.has('security-app-lock-now')).toBe(true),
  );

describe('SecuritySection', () => {
  beforeEach(() => {
    mockCapturedItems.clear();
    settingsStore = {};
    jest.clearAllMocks();
    mockSettingsGet.mockImplementation(async (k: string, d: any) =>
      k in settingsStore ? settingsStore[k] : d,
    );
    mockSettingsSet.mockImplementation(async (k: string, v: any) => {
      settingsStore[k] = v;
    });
    mockHasEnrolledBiometrics.mockResolvedValue(true);
    mockIsAvailable.mockResolvedValue(true);
    mockEnableLock.mockResolvedValue(true);
    mockDisableLock.mockResolvedValue(undefined);
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  });

  it('renders all security settings items', async () => {
    await renderSection();
    await waitForLoaded();
    expect(mockCapturedItems.has('security-manage-keys')).toBe(true);
    expect(mockCapturedItems.has('security-migrate-keys')).toBe(true);
    expect(mockCapturedItems.has('security-qr')).toBe(true);
    expect(mockCapturedItems.has('security-file')).toBe(true);
    expect(mockCapturedItems.has('security-nfc')).toBe(true);
    expect(mockCapturedItems.has('security-screenshots')).toBe(true);
    expect(mockCapturedItems.has('security-app-lock')).toBe(true);
    expect(mockCapturedItems.has('security-app-lock-biometric')).toBe(true);
    expect(mockCapturedItems.has('security-app-lock-pin')).toBe(true);
    expect(mockCapturedItems.has('security-app-lock-biometric-auto')).toBe(
      true,
    );
    expect(mockCapturedItems.has('security-app-lock-launch')).toBe(true);
    expect(mockCapturedItems.has('security-app-lock-background')).toBe(true);
  });

  it('invokes key-management and migration callbacks', async () => {
    const onShowKeyManagement = jest.fn();
    const onShowMigrationDialog = jest.fn();
    const { getByTestId } = await renderSection({
      onShowKeyManagement,
      onShowMigrationDialog,
    });
    await waitForLoaded();

    await fireEvent.press(getByTestId('setting-security-manage-keys'));
    await fireEvent.press(getByTestId('setting-security-migrate-keys'));

    expect(onShowKeyManagement).toHaveBeenCalled();
    expect(onShowMigrationDialog).toHaveBeenCalled();
  });

  it('tolerates missing key-management/migration callbacks', async () => {
    const { getByTestId } = await renderSection();
    await waitForLoaded();
    await fireEvent.press(getByTestId('setting-security-manage-keys'));
    await fireEvent.press(getByTestId('setting-security-migrate-keys'));
    // No throw = optional-chaining branches covered.
    expect(mockCapturedItems.has('security-manage-keys')).toBe(true);
  });

  it('persists the simple exchange/screenshot switches', async () => {
    await renderSection();
    await waitForLoaded();

    await act(async () => {
      await mockCapturedItems.get('security-qr').onValueChange(false);
      await mockCapturedItems.get('security-file').onValueChange(false);
      await mockCapturedItems.get('security-nfc').onValueChange(false);
      await mockCapturedItems.get('security-screenshots').onValueChange(true);
      await mockCapturedItems
        .get('security-app-lock-launch')
        .onValueChange(false);
      await mockCapturedItems
        .get('security-app-lock-background')
        .onValueChange(false);
    });

    expect(mockSettingsSet).toHaveBeenCalledWith(
      'securityAllowQrVerification',
      false,
    );
    expect(mockSettingsSet).toHaveBeenCalledWith(
      'securityAllowFileExchange',
      false,
    );
    expect(mockSettingsSet).toHaveBeenCalledWith(
      'securityAllowNfcExchange',
      false,
    );
    expect(mockSettingsSet).toHaveBeenCalledWith(
      'securityAllowScreenshots',
      true,
    );
    expect(mockSetAllowScreenshots).toHaveBeenCalledWith(true);
    expect(mockSettingsSet).toHaveBeenCalledWith('appLockOnLaunch', false);
    expect(mockSettingsSet).toHaveBeenCalledWith('appLockOnBackground', false);
  });

  it('disables the biometric switch when no biometrics are enrolled', async () => {
    mockHasEnrolledBiometrics.mockResolvedValue(false);
    await renderSection();
    await waitForLoaded();
    expect(mockCapturedItems.get('security-app-lock-biometric').disabled).toBe(
      true,
    );
  });

  it('loadSettings resets biometric flag when enrollment is missing', async () => {
    settingsStore = {
      appLockUseBiometric: true,
      appLockEnabled: true,
      appLockUsePin: false,
    };
    mockHasEnrolledBiometrics.mockResolvedValue(false);

    await renderSection();
    await waitForLoaded();

    expect(mockSettingsSet).toHaveBeenCalledWith('appLockUseBiometric', false);
    // With no usable method left, app lock is also disabled.
    expect(mockSettingsSet).toHaveBeenCalledWith('appLockEnabled', false);
    expect(mockCapturedItems.get('security-app-lock').value).toBe(false);
  });

  it('renders "both enabled" descriptions when biometric and PIN are on', async () => {
    settingsStore = {
      appLockUseBiometric: true,
      appLockUsePin: true,
      appLockEnabled: true,
      appLockAutoBiometricPrompt: true,
      appLockOnLaunch: false,
      appLockOnBackground: false,
    };
    await renderSection();
    await waitForLoaded();

    expect(mockCapturedItems.get('security-app-lock').value).toBe(true);
    expect(mockCapturedItems.get('security-app-lock-biometric').value).toBe(
      true,
    );
    expect(mockCapturedItems.get('security-app-lock-pin').value).toBe(true);
    expect(
      mockCapturedItems.get('security-app-lock-biometric-auto').value,
    ).toBe(true);
    // Toggle auto-prompt off to hit its onValueChange persistence.
    await act(async () => {
      await mockCapturedItems
        .get('security-app-lock-biometric-auto')
        .onValueChange(false);
    });
    expect(mockSettingsSet).toHaveBeenCalledWith(
      'appLockAutoBiometricPrompt',
      false,
    );
  });

  it('blocks enabling app lock with no method configured', async () => {
    await renderSection();
    await waitForLoaded();

    await act(async () => {
      mockCapturedItems.get('security-app-lock').onValueChange(true);
    });

    expect(Alert.alert).toHaveBeenCalled();
    expect(mockSettingsSet).not.toHaveBeenCalledWith('appLockEnabled', true);
  });

  it('enables and disables app lock when a method exists', async () => {
    settingsStore = { appLockUsePin: true, appLockEnabled: false };
    await renderSection();
    await waitForLoaded();

    await act(async () => {
      mockCapturedItems.get('security-app-lock').onValueChange(true);
    });
    expect(mockSettingsSet).toHaveBeenCalledWith('appLockEnabled', true);

    await act(async () => {
      mockCapturedItems.get('security-app-lock').onValueChange(false);
    });
    expect(mockSettingsSet).toHaveBeenCalledWith('appLockEnabled', false);
  });

  it('enables biometric lock when enrollment and setup succeed', async () => {
    await renderSection();
    await waitForLoaded();

    await act(async () => {
      mockCapturedItems.get('security-app-lock-biometric').onValueChange(true);
    });

    await waitFor(() => expect(mockEnableLock).toHaveBeenCalledWith('app'));
    expect(mockSettingsSet).toHaveBeenCalledWith('appLockUseBiometric', true);
    expect(mockSettingsSet).toHaveBeenCalledWith('appLockEnabled', true);
  });

  it('alerts when enabling biometric without enrollment', async () => {
    await renderSection();
    await waitForLoaded();
    mockHasEnrolledBiometrics.mockResolvedValue(false);

    await act(async () => {
      mockCapturedItems.get('security-app-lock-biometric').onValueChange(true);
    });

    await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
    expect(mockEnableLock).not.toHaveBeenCalled();
  });

  it('alerts when biometric enableLock fails', async () => {
    mockEnableLock.mockResolvedValue(false);
    await renderSection();
    await waitForLoaded();

    await act(async () => {
      mockCapturedItems.get('security-app-lock-biometric').onValueChange(true);
    });

    await waitFor(() => expect(mockEnableLock).toHaveBeenCalled());
    expect(Alert.alert).toHaveBeenCalled();
    expect(mockSettingsSet).not.toHaveBeenCalledWith(
      'appLockUseBiometric',
      true,
    );
  });

  it('disables biometric and keeps app lock when PIN remains', async () => {
    settingsStore = {
      appLockUseBiometric: true,
      appLockUsePin: true,
      appLockEnabled: true,
    };
    await renderSection();
    await waitForLoaded();

    await act(async () => {
      mockCapturedItems.get('security-app-lock-biometric').onValueChange(false);
    });

    await waitFor(() => expect(mockDisableLock).toHaveBeenCalledWith('app'));
    expect(mockSettingsSet).toHaveBeenCalledWith('appLockUseBiometric', false);
    expect(mockSettingsSet).not.toHaveBeenCalledWith('appLockEnabled', false);
  });

  it('disables biometric and app lock when PIN is absent', async () => {
    settingsStore = {
      appLockUseBiometric: true,
      appLockUsePin: false,
      appLockEnabled: true,
    };
    await renderSection();
    await waitForLoaded();

    await act(async () => {
      mockCapturedItems.get('security-app-lock-biometric').onValueChange(false);
    });

    await waitFor(() => expect(mockDisableLock).toHaveBeenCalledWith('app'));
    expect(mockSettingsSet).toHaveBeenCalledWith('appLockEnabled', false);
  });

  it('disables PIN and keeps app lock when biometric remains', async () => {
    settingsStore = {
      appLockUseBiometric: true,
      appLockUsePin: true,
      appLockEnabled: true,
    };
    await renderSection();
    await waitForLoaded();

    await act(async () => {
      mockCapturedItems.get('security-app-lock-pin').onValueChange(false);
    });

    await waitFor(() => expect(mockRemoveSecret).toHaveBeenCalled());
    expect(mockSettingsSet).toHaveBeenCalledWith('appLockUsePin', false);
    expect(mockSettingsSet).not.toHaveBeenCalledWith('appLockEnabled', false);
  });

  it('disables PIN and app lock when biometric is absent', async () => {
    settingsStore = {
      appLockUseBiometric: false,
      appLockUsePin: true,
      appLockEnabled: true,
    };
    await renderSection();
    await waitForLoaded();

    await act(async () => {
      mockCapturedItems.get('security-app-lock-pin').onValueChange(false);
    });

    await waitFor(() => expect(mockRemoveSecret).toHaveBeenCalled());
    expect(mockSettingsSet).toHaveBeenCalledWith('appLockEnabled', false);
  });

  it('sets a PIN through the setup/confirm modal flow', async () => {
    const view = await renderSection();
    await waitForLoaded();

    // Open the PIN setup modal.
    await act(async () => {
      mockCapturedItems.get('security-app-lock-pin').onValueChange(true);
    });

    // Setup mode: reject too-short PIN.
    const setupInput = view.getByPlaceholderText('Enter PIN');
    await act(async () => {
      fireEvent.changeText(setupInput, '12');
    });
    await act(async () => {
      fireEvent.press(view.getByText('Submit'));
    });
    expect(view.getByText('PIN must be at least 4 digits.')).toBeTruthy();

    // Provide a valid PIN -> advances to confirm mode.
    await act(async () => {
      fireEvent.changeText(view.getByPlaceholderText('Enter PIN'), '1234');
    });
    await act(async () => {
      fireEvent.press(view.getByText('Submit'));
    });

    // Confirm mode: mismatch resets back to setup with error.
    await act(async () => {
      fireEvent.changeText(view.getByPlaceholderText('Re-enter PIN'), '9999');
    });
    await act(async () => {
      fireEvent.press(view.getByText('Confirm'));
    });
    expect(view.getByText('PINs do not match.')).toBeTruthy();

    // Setup again, then confirm matching -> success.
    await act(async () => {
      fireEvent.changeText(view.getByPlaceholderText('Enter PIN'), '1234');
    });
    await act(async () => {
      fireEvent.press(view.getByText('Submit'));
    });
    await act(async () => {
      fireEvent.changeText(view.getByPlaceholderText('Re-enter PIN'), '1234');
    });
    await act(async () => {
      fireEvent.press(view.getByText('Confirm'));
    });

    await waitFor(() => expect(mockSetSecret).toHaveBeenCalled());
    expect(mockSettingsSet).toHaveBeenCalledWith('appLockUsePin', true);
    expect(mockSettingsSet).toHaveBeenCalledWith('appLockEnabled', true);
  });

  it('cancels the PIN modal without enabling PIN', async () => {
    const view = await renderSection();
    await waitForLoaded();

    await act(async () => {
      mockCapturedItems.get('security-app-lock-pin').onValueChange(true);
    });

    await act(async () => {
      fireEvent.press(view.getByText('Cancel'));
    });

    expect(mockSetSecret).not.toHaveBeenCalled();
    expect(mockSettingsSet).not.toHaveBeenCalledWith('appLockUsePin', true);
  });

  it('closes the PIN modal via onRequestClose (hardware back) and tolerates a second close', async () => {
    const view = await renderSection();
    await waitForLoaded();

    await act(async () => {
      mockCapturedItems.get('security-app-lock-pin').onValueChange(true);
    });

    const { Modal } = require('react-native');
    const modal = view.UNSAFE_getByType(Modal);
    await act(async () => {
      modal.props.onRequestClose();
    });
    // A redundant close (no pending resolver) must be a no-op.
    await act(async () => {
      modal.props.onRequestClose();
    });

    expect(mockSetSecret).not.toHaveBeenCalled();
  });

  it('swallows rejections from the app-lock toggle handler', async () => {
    settingsStore = { appLockUsePin: true, appLockEnabled: false };
    await renderSection();
    await waitForLoaded();

    mockSettingsSet.mockRejectedValueOnce(new Error('boom'));
    await act(async () => {
      mockCapturedItems.get('security-app-lock').onValueChange(true);
    });

    await waitFor(() =>
      expect(mockSettingsSet).toHaveBeenCalledWith('appLockEnabled', true),
    );
  });

  it('swallows rejections from the biometric toggle handler', async () => {
    await renderSection();
    await waitForLoaded();

    mockEnableLock.mockRejectedValueOnce(new Error('boom'));
    await act(async () => {
      mockCapturedItems.get('security-app-lock-biometric').onValueChange(true);
    });

    await waitFor(() => expect(mockEnableLock).toHaveBeenCalled());
  });

  it('swallows rejections from the PIN toggle handler', async () => {
    settingsStore = {
      appLockUsePin: true,
      appLockUseBiometric: false,
      appLockEnabled: true,
    };
    await renderSection();
    await waitForLoaded();

    mockRemoveSecret.mockRejectedValueOnce(new Error('boom'));
    await act(async () => {
      mockCapturedItems.get('security-app-lock-pin').onValueChange(false);
    });

    await waitFor(() => expect(mockRemoveSecret).toHaveBeenCalled());
  });

  it('locks now when app lock is enabled', async () => {
    settingsStore = {
      appLockUsePin: true,
      appLockEnabled: true,
    };
    await renderSection();
    await waitForLoaded();

    await act(async () => {
      await mockCapturedItems.get('security-app-lock-now').onPress();
    });

    expect(mockSettingsSet).toHaveBeenCalledWith(
      'appLockNow',
      expect.any(Number),
    );
  });

  it('alerts on lock-now when app lock is disabled', async () => {
    await renderSection();
    await waitForLoaded();

    await act(async () => {
      await mockCapturedItems.get('security-app-lock-now').onPress();
    });

    expect(Alert.alert).toHaveBeenCalled();
    expect(mockSettingsSet).not.toHaveBeenCalledWith(
      'appLockNow',
      expect.any(Number),
    );
  });
});

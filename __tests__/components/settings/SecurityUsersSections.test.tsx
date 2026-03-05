/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { SecurityQuickConnectSection } from '../../../src/components/settings/sections/SecurityQuickConnectSection';
import { SecuritySection } from '../../../src/components/settings/sections/SecuritySection';
import { UsersServicesSection } from '../../../src/components/settings/sections/UsersServicesSection';

const mockCapturedItems = new Map<string, any>();
const mockSettingsGet = jest.fn(async (_k: string, d: any) => d);
const mockSettingsSet = jest.fn(async () => undefined);
const mockHasEnrolledBiometrics = jest.fn(async () => true);
const mockEnableLock = jest.fn(async () => true);
const mockDisableLock = jest.fn(async () => undefined);
const mockSetSecret = jest.fn(async () => undefined);
const mockRemoveSecret = jest.fn(async () => undefined);
const mockGetUserNotes = jest.fn(() => []);
const mockGetUserAliases = jest.fn(() => []);

const mockSecurityHookState = {
  killSwitchEnabledOnHeader: false,
  killSwitchEnabledOnLockScreen: false,
  killSwitchShowWarnings: true,
  killSwitchCustomName: 'meow meow',
  killSwitchCustomIcon: 'cat',
  killSwitchCustomColor: '#ff0000',
  setKillSwitchEnabledOnHeader: jest.fn(async () => undefined),
  setKillSwitchEnabledOnLockScreen: jest.fn(async () => undefined),
  setKillSwitchShowWarnings: jest.fn(async () => undefined),
  setKillSwitchCustomName: jest.fn(async () => undefined),
  setKillSwitchCustomIcon: jest.fn(async () => undefined),
  setKillSwitchCustomColor: jest.fn(async () => undefined),
  quickConnectNetworkId: '',
  setQuickConnectNetworkId: jest.fn(async () => undefined),
};

jest.mock('../../../src/i18n/transifex', () => ({
  useT: () => (key: string) => key,
}));

jest.mock('../../../src/components/settings/SettingItem', () => {
  const React = require('react');
  const { TouchableOpacity, Text } = require('react-native');
  return {
    SettingItem: ({ item, onPress }: any) => {
      mockCapturedItems.set(item.id, item);
      return React.createElement(
        TouchableOpacity,
        {
          testID: `setting-${item.id}`,
          onPress: () => {
            item.onPress?.();
            if (item.type === 'submenu') onPress?.(item.id);
            if (item.type === 'switch') item.onValueChange?.(!item.value);
          },
        },
        React.createElement(Text, null, item.title || item.id)
      );
    },
  };
});

jest.mock('../../../src/hooks/useSettingsSecurity', () => ({
  useSettingsSecurity: () => mockSecurityHookState,
}));

jest.mock('../../../src/services/SettingsService', () => ({
  settingsService: {
    getSetting: (...args: any[]) => mockSettingsGet(...args),
    setSetting: (...args: any[]) => mockSettingsSet(...args),
  },
}));

jest.mock('../../../src/services/BiometricAuthService', () => ({
  biometricAuthService: {
    hasEnrolledBiometrics: (...args: any[]) => mockHasEnrolledBiometrics(...args),
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

jest.mock('../../../src/services/UserManagementService', () => ({
  userManagementService: {
    getUserNotes: (...args: any[]) => mockGetUserNotes(...args),
    getUserAliases: (...args: any[]) => mockGetUserAliases(...args),
    removeUserNote: jest.fn(async () => undefined),
    removeUserAlias: jest.fn(async () => undefined),
  },
}));

jest.mock('react-native-vector-icons/FontAwesome5', () => 'Icon');

const colors = {
  text: '#111',
  textSecondary: '#666',
  primary: '#0af',
  surface: '#fff',
  border: '#ddd',
  background: '#000',
};

const styles = {
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

describe('Security/Users sections', () => {
  beforeEach(() => {
    mockCapturedItems.clear();
    jest.clearAllMocks();
  });

  it('SecurityQuickConnectSection wires switch/input actions', async () => {
    render(<SecurityQuickConnectSection colors={colors} styles={styles as any} settingIcons={{}} />);
    await waitFor(() => expect(mockCapturedItems.has('kill-switch-header')).toBe(true));

    await mockCapturedItems.get('kill-switch-header').onValueChange(true);
    await mockCapturedItems.get('kill-switch-custom-name').onValueChange('panic');

    expect(mockSecurityHookState.setKillSwitchEnabledOnHeader).toHaveBeenCalledWith(true);
    expect(mockSecurityHookState.setKillSwitchCustomName).toHaveBeenCalledWith('panic');
  });

  it('SecuritySection invokes key management and setting updates', async () => {
    const onShowKeyManagement = jest.fn();
    render(
      <SecuritySection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
        onShowKeyManagement={onShowKeyManagement}
      />
    );
    await waitFor(() => expect(mockCapturedItems.has('security-manage-keys')).toBe(true));

    mockCapturedItems.get('security-manage-keys').onPress();
    await mockCapturedItems.get('security-qr').onValueChange(false);
    expect(onShowKeyManagement).toHaveBeenCalled();
    expect(mockSettingsSet).toHaveBeenCalledWith('securityAllowQrVerification', false);
  });

  it('SecuritySection shows alert when enabling biometric lock without enrollment', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    mockHasEnrolledBiometrics.mockResolvedValue(false);
    render(<SecuritySection colors={colors} styles={styles as any} settingIcons={{}} />);
    await waitFor(() => expect(mockCapturedItems.has('security-app-lock-biometric')).toBe(true));

    await mockCapturedItems.get('security-app-lock-biometric').onValueChange(true);
    expect(alertSpy).toHaveBeenCalled();
    expect(mockEnableLock).not.toHaveBeenCalled();
  });

  it('UsersServicesSection supports blacklist and add-service flow', async () => {
    const onShowBlacklist = jest.fn();
    render(
      <UsersServicesSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
        currentNetwork="net"
        onShowBlacklist={onShowBlacklist}
      />
    );

    await waitFor(() => expect(mockCapturedItems.has('irc-services-add')).toBe(true));
    await mockCapturedItems.get('irc-services-add').onValueChange('Q');
    await waitFor(() => expect(mockCapturedItems.get('irc-services-add')?.value).toBe('Q'));
    await mockCapturedItems.get('irc-services-add').onPress();
    mockCapturedItems.get('user-blacklist').onPress();

    expect(mockSettingsSet).toHaveBeenCalledWith('ircServices', expect.arrayContaining(['Q']));
    expect(onShowBlacklist).toHaveBeenCalled();
  });
});

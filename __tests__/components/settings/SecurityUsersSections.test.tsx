/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
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
const mockRemoveUserNote = jest.fn(async () => undefined);
const mockRemoveUserAlias = jest.fn(async () => undefined);

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
        React.createElement(Text, null, item.title || item.id),
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
    hasEnrolledBiometrics: (...args: any[]) =>
      mockHasEnrolledBiometrics(...args),
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
    removeUserNote: (...args: any[]) => mockRemoveUserNote(...args),
    removeUserAlias: (...args: any[]) => mockRemoveUserAlias(...args),
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
    mockSettingsGet.mockImplementation(async (_k: string, d: any) => d);
    mockHasEnrolledBiometrics.mockResolvedValue(true);
    mockEnableLock.mockResolvedValue(true);
    mockDisableLock.mockResolvedValue(undefined);
    mockGetUserNotes.mockReturnValue([]);
    mockGetUserAliases.mockReturnValue([]);
  });

  it('SecurityQuickConnectSection wires switch/input actions', async () => {
    render(
      <SecurityQuickConnectSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );
    await waitFor(() =>
      expect(mockCapturedItems.has('kill-switch-header')).toBe(true),
    );

    await mockCapturedItems.get('kill-switch-header').onValueChange(true);
    await mockCapturedItems
      .get('kill-switch-custom-name')
      .onValueChange('panic');

    expect(
      mockSecurityHookState.setKillSwitchEnabledOnHeader,
    ).toHaveBeenCalledWith(true);
    expect(mockSecurityHookState.setKillSwitchCustomName).toHaveBeenCalledWith(
      'panic',
    );
  });

  it('SecurityQuickConnectSection opens color picker and applies valid hex color', async () => {
    const { getByTestId, getByPlaceholderText, getByText, queryByText } =
      render(
        <SecurityQuickConnectSection
          colors={colors}
          styles={styles as any}
          settingIcons={{}}
        />,
      );
    await waitFor(() =>
      expect(mockCapturedItems.has('kill-switch-custom-color')).toBe(true),
    );

    await mockCapturedItems.get('kill-switch-lockscreen').onValueChange(true);
    await mockCapturedItems.get('kill-switch-warnings').onValueChange(false);
    await mockCapturedItems
      .get('kill-switch-custom-icon')
      .onValueChange('bolt');
    expect(
      mockSecurityHookState.setKillSwitchEnabledOnLockScreen,
    ).toHaveBeenCalledWith(true);
    expect(
      mockSecurityHookState.setKillSwitchShowWarnings,
    ).toHaveBeenCalledWith(false);
    expect(mockSecurityHookState.setKillSwitchCustomIcon).toHaveBeenCalledWith(
      'bolt',
    );

    fireEvent.press(getByTestId('setting-kill-switch-custom-color'));
    await waitFor(() => expect(getByText('Choose Color')).toBeTruthy());

    fireEvent.changeText(getByPlaceholderText('#ff0000'), '#123');
    expect(
      mockSecurityHookState.setKillSwitchCustomColor,
    ).not.toHaveBeenCalledWith('#123');

    fireEvent.changeText(getByPlaceholderText('#ff0000'), '#00ff00');
    expect(mockSecurityHookState.setKillSwitchCustomColor).toHaveBeenCalledWith(
      '#00ff00',
    );

    fireEvent.press(getByText('Done'));
    await waitFor(() => expect(queryByText('Choose Color')).toBeNull());
  });

  it('SecuritySection invokes key management and setting updates', async () => {
    const onShowKeyManagement = jest.fn();
    render(
      <SecuritySection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
        onShowKeyManagement={onShowKeyManagement}
      />,
    );
    await waitFor(() =>
      expect(mockCapturedItems.has('security-manage-keys')).toBe(true),
    );

    act(() => {
      mockCapturedItems.get('security-manage-keys').onPress();
    });
    await act(async () => {
      await mockCapturedItems.get('security-qr').onValueChange(false);
    });
    expect(onShowKeyManagement).toHaveBeenCalled();
    expect(mockSettingsSet).toHaveBeenCalledWith(
      'securityAllowQrVerification',
      false,
    );
  });

  it('SecuritySection shows alert when enabling biometric lock without enrollment', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    mockHasEnrolledBiometrics.mockResolvedValue(false);
    render(
      <SecuritySection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );
    await waitFor(() =>
      expect(mockCapturedItems.has('security-app-lock-biometric')).toBe(true),
    );

    await act(async () => {
      await mockCapturedItems
        .get('security-app-lock-biometric')
        .onValueChange(true);
    });
    expect(alertSpy).toHaveBeenCalled();
    expect(mockEnableLock).not.toHaveBeenCalled();
  });

  it('SecuritySection blocks app lock enable when no biometric or pin method exists', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    render(
      <SecuritySection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );
    await waitFor(() =>
      expect(mockCapturedItems.has('security-app-lock')).toBe(true),
    );

    await act(async () => {
      await mockCapturedItems.get('security-app-lock').onValueChange(true);
    });
    expect(alertSpy).toHaveBeenCalled();
    expect(mockSettingsSet).not.toHaveBeenCalledWith('appLockEnabled', true);
  });

  it('SecuritySection enables/disables biometric lock and updates app lock state', async () => {
    const { getByTestId } = render(
      <SecuritySection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );
    await waitFor(() =>
      expect(mockCapturedItems.has('security-app-lock-biometric')).toBe(true),
    );

    fireEvent.press(getByTestId('setting-security-app-lock-biometric'));
    await waitFor(() => expect(mockEnableLock).toHaveBeenCalledWith('app'));
    expect(mockEnableLock).toHaveBeenCalledWith('app');
    expect(mockSettingsSet).toHaveBeenCalledWith('appLockUseBiometric', true);
    expect(mockSettingsSet).toHaveBeenCalledWith('appLockEnabled', true);

    await act(async () => {
      await mockCapturedItems
        .get('security-app-lock-biometric')
        .onValueChange(false);
    });
    expect(mockDisableLock).toHaveBeenCalledWith('app');
    expect(mockSettingsSet).toHaveBeenCalledWith('appLockUseBiometric', false);
  });

  it('SecuritySection handles app-lock PIN setup and stores pin after confirm', async () => {
    const { getByPlaceholderText, getByText, getByTestId } = render(
      <SecuritySection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );
    await waitFor(() =>
      expect(mockCapturedItems.has('security-app-lock-pin')).toBe(true),
    );

    fireEvent.press(getByTestId('setting-security-app-lock-pin'));
    await waitFor(() => expect(getByPlaceholderText('Enter PIN')).toBeTruthy());

    fireEvent.changeText(getByPlaceholderText('Enter PIN'), '1234');
    fireEvent.press(getByText('Submit'));
    fireEvent.changeText(getByPlaceholderText('Re-enter PIN'), '1234');
    fireEvent.press(getByText('Confirm'));

    await waitFor(() =>
      expect(mockSetSecret).toHaveBeenCalledWith(
        '@AndroidIRCX:app-lock-pin',
        '1234',
      ),
    );
    expect(mockSetSecret).toHaveBeenCalledWith(
      '@AndroidIRCX:app-lock-pin',
      '1234',
    );
    expect(mockSettingsSet).toHaveBeenCalledWith('appLockUsePin', true);
    expect(mockSettingsSet).toHaveBeenCalledWith('appLockEnabled', true);
  });

  it('SecuritySection handles lock-now disabled and enabled flows', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    render(
      <SecuritySection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );
    await waitFor(() =>
      expect(mockCapturedItems.has('security-app-lock-now')).toBe(true),
    );

    await act(async () => {
      await mockCapturedItems.get('security-app-lock-now').onPress();
    });
    expect(alertSpy).toHaveBeenCalled();

    mockSettingsGet.mockImplementation(async (key: string, d: any) => {
      if (key === 'appLockEnabled') return true;
      if (key === 'appLockUsePin') return true;
      return d;
    });
    mockCapturedItems.clear();
    render(
      <SecuritySection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );
    await waitFor(() =>
      expect(mockCapturedItems.has('security-app-lock-now')).toBe(true),
    );
    await act(async () => {
      await mockCapturedItems.get('security-app-lock-now').onPress();
    });

    expect(mockSettingsSet).toHaveBeenCalledWith(
      'appLockNow',
      expect.any(Number),
    );
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
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('irc-services-add')).toBe(true),
    );
    await act(async () => {
      await mockCapturedItems.get('irc-services-add').onValueChange('Q');
    });
    await waitFor(() =>
      expect(mockCapturedItems.get('irc-services-add')?.value).toBe('Q'),
    );
    await act(async () => {
      await mockCapturedItems.get('irc-services-add').onPress();
    });
    act(() => {
      mockCapturedItems.get('user-blacklist').onPress();
    });

    expect(mockSettingsSet).toHaveBeenCalledWith(
      'ircServices',
      expect.arrayContaining(['Q']),
    );
    expect(onShowBlacklist).toHaveBeenCalled();
  });

  it('UsersServicesSection shows blacklist fallback alert and user-list callback', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const onShowUserLists = jest.fn();
    render(
      <UsersServicesSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
        currentNetwork="net"
        onShowUserLists={onShowUserLists}
      />,
    );
    await waitFor(() =>
      expect(mockCapturedItems.has('user-blacklist')).toBe(true),
    );

    act(() => {
      mockCapturedItems.get('user-blacklist').onPress();
      mockCapturedItems.get('user-lists').onPress();
    });

    expect(alertSpy).toHaveBeenCalled();
    expect(onShowUserLists).toHaveBeenCalled();
  });

  it('UsersServicesSection deletes note and alias from submenu actions', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    mockGetUserNotes.mockReturnValue([
      { nick: 'alice', network: 'net', note: 'memo' },
    ]);
    mockGetUserAliases.mockReturnValue([
      { nick: 'alice', alias: 'ali', network: 'net' },
    ]);
    const { getByTestId, getByText } = render(
      <UsersServicesSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
        currentNetwork="net"
      />,
    );
    await waitFor(() => expect(mockCapturedItems.has('user-notes')).toBe(true));

    fireEvent.press(getByTestId('setting-user-notes'));
    await waitFor(() => expect(getByText('alice (net)')).toBeTruthy());
    fireEvent.press(getByText('alice (net)'));
    const noteAlertButtons = alertSpy.mock.calls[
      alertSpy.mock.calls.length - 1
    ][2] as any[];
    await noteAlertButtons[1].onPress();
    expect(mockRemoveUserNote).toHaveBeenCalledWith('alice', 'net');

    fireEvent.press(getByTestId('setting-user-aliases'));
    await waitFor(() => expect(getByText('ali → alice')).toBeTruthy());
    fireEvent.press(getByText('ali → alice'));
    const aliasAlertButtons = alertSpy.mock.calls[
      alertSpy.mock.calls.length - 1
    ][2] as any[];
    await aliasAlertButtons[1].onPress();
    expect(mockRemoveUserAlias).toHaveBeenCalledWith('alice', 'net');
  });
});

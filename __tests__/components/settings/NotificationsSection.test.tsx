/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { NotificationsSection } from '../../../src/components/settings/sections/NotificationsSection';

const mockCapturedItems = new Map<string, any>();
const mockUpdateNotificationPrefs = jest.fn(async () => undefined);
const mockRefreshNotificationPrefs = jest.fn(async () => undefined);
const mockCheckPermission = jest.fn(async () => true);
const mockRequestPermission = jest.fn(async () => true);
const mockListChannelPreferences = jest.fn(() => []);
const mockUpdateChannelPreferences = jest.fn(async () => undefined);

jest.mock('../../../src/i18n/transifex', () => ({
  useT: () => (key: string) => key,
}));

jest.mock('../../../src/components/settings/SettingItem', () => {
  const React = require('react');
  const { TouchableOpacity, Text } = require('react-native');
  return {
    SettingItem: ({ item }: any) => {
      mockCapturedItems.set(item.id, item);
      return React.createElement(
        TouchableOpacity,
        { testID: `setting-${item.id}`, onPress: item.onPress || (() => item.onValueChange?.(!item.value)) },
        React.createElement(Text, null, item.title || item.id)
      );
    },
  };
});

jest.mock('../../../src/hooks/useSettingsNotifications', () => ({
  useSettingsNotifications: () => ({
    notificationPrefs: {
      enabled: false,
      notifyOnMentions: true,
      notifyOnPrivateMessages: true,
      notifyOnAllMessages: false,
      doNotDisturb: false,
    },
    updateNotificationPrefs: (...args: any[]) => mockUpdateNotificationPrefs(...args),
    refreshNotificationPrefs: (...args: any[]) => mockRefreshNotificationPrefs(...args),
  }),
}));

jest.mock('../../../src/services/NotificationService', () => ({
  notificationService: {
    checkPermission: (...args: any[]) => mockCheckPermission(...args),
    requestPermission: (...args: any[]) => mockRequestPermission(...args),
    listChannelPreferences: (...args: any[]) => mockListChannelPreferences(...args),
    updateChannelPreferences: (...args: any[]) => mockUpdateChannelPreferences(...args),
  },
}));

jest.mock('../../../src/screens/SoundSettingsScreen', () => ({
  SoundSettingsScreen: () => null,
}));

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
  submenuItem: {},
  submenuItemContent: {},
  submenuItemText: {},
  submenuItemDescription: {},
  submenuInput: {},
  identityDeleteText: {},
  identityEmpty: {},
};

describe('NotificationsSection', () => {
  beforeEach(() => {
    mockCapturedItems.clear();
    jest.clearAllMocks();
  });

  it('refreshes prefs on mount', async () => {
    render(<NotificationsSection colors={colors} styles={styles as any} settingIcons={{}} />);
    await waitFor(() => expect(mockRefreshNotificationPrefs).toHaveBeenCalled());
  });

  it('enables notifications after permission flow', async () => {
    mockCheckPermission.mockResolvedValueOnce(false);
    mockRequestPermission.mockResolvedValueOnce(true);

    render(<NotificationsSection colors={colors} styles={styles as any} settingIcons={{}} />);
    await waitFor(() => expect(mockCapturedItems.has('notifications-enabled')).toBe(true));

    await mockCapturedItems.get('notifications-enabled').onValueChange(true);
    expect(mockCheckPermission).toHaveBeenCalled();
    expect(mockRequestPermission).toHaveBeenCalled();
    expect(mockUpdateNotificationPrefs).toHaveBeenCalledWith({ enabled: true });
  });

  it('shows alert when permission remains denied', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    mockCheckPermission.mockResolvedValueOnce(false).mockResolvedValueOnce(false);
    mockRequestPermission.mockResolvedValueOnce(false);

    render(<NotificationsSection colors={colors} styles={styles as any} settingIcons={{}} />);
    await waitFor(() => expect(mockCapturedItems.has('notifications-enabled')).toBe(true));

    await mockCapturedItems.get('notifications-enabled').onValueChange(true);
    expect(alertSpy).toHaveBeenCalled();
    expect(mockUpdateNotificationPrefs).not.toHaveBeenCalledWith({ enabled: true });
  });
});

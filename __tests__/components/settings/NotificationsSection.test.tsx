/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { NotificationsSection } from '../../../src/components/settings/sections/NotificationsSection';

const mockCapturedItems = new Map<string, any>();
const mockUpdateNotificationPrefs = jest.fn(async () => undefined);
const mockRefreshNotificationPrefs = jest.fn(async () => undefined);
const mockCheckPermission = jest.fn(async () => true);
const mockRequestPermission = jest.fn(async () => true);
const mockListChannelPreferences = jest.fn(() => []);
const mockUpdateChannelPreferences = jest.fn(async () => undefined);
const mockRemoveChannelPreferences = jest.fn(async () => undefined);

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
    removeChannelPreferences: (...args: any[]) => mockRemoveChannelPreferences(...args),
  },
}));

jest.mock('../../../src/screens/SoundSettingsScreen', () => ({
  SoundSettingsScreen: ({ visible, onClose }: any) => {
    if (!visible) return null;
    const React = require('react');
    const { View, Text, TouchableOpacity } = require('react-native');
    return React.createElement(
      View,
      { testID: 'sound-settings' },
      React.createElement(Text, null, 'Sound Settings Open'),
      React.createElement(TouchableOpacity, { testID: 'sound-close', onPress: onClose }, React.createElement(Text, null, 'Close Sound'))
    );
  },
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
    mockCheckPermission.mockResolvedValue(true);
    mockRequestPermission.mockResolvedValue(true);
    mockListChannelPreferences.mockReturnValue([]);
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

  it('enables notifications directly when permission already granted', async () => {
    render(<NotificationsSection colors={colors} styles={styles as any} settingIcons={{}} />);
    await waitFor(() => expect(mockCapturedItems.has('notifications-enabled')).toBe(true));

    await mockCapturedItems.get('notifications-enabled').onValueChange(true);
    expect(mockRequestPermission).not.toHaveBeenCalled();
    expect(mockUpdateNotificationPrefs).toHaveBeenCalledWith({ enabled: true });
  });

  it('updates non-enabled notification toggles without permission flow', async () => {
    render(<NotificationsSection colors={colors} styles={styles as any} settingIcons={{}} />);
    await waitFor(() => expect(mockCapturedItems.has('notifications-dnd')).toBe(true));

    await mockCapturedItems.get('notifications-dnd').onValueChange(true);
    expect(mockCheckPermission).not.toHaveBeenCalled();
    expect(mockUpdateNotificationPrefs).toHaveBeenCalledWith({ doNotDisturb: true });
  });

  it('opens per-channel modal, adds channel override and deletes existing override', async () => {
    mockListChannelPreferences
      .mockReturnValueOnce([])
      .mockReturnValueOnce([{ channel: '#dev', prefs: { notifyOnAllMessages: true, notifyOnMentions: true, notifyOnPrivateMessages: false, enabled: true, doNotDisturb: false } }]);
    const { getByText, getByPlaceholderText, queryByText } = render(
      <NotificationsSection colors={colors} styles={styles as any} settingIcons={{}} />
    );
    await waitFor(() => expect(mockCapturedItems.has('notifications-per-channel')).toBe(true));

    mockCapturedItems.get('notifications-per-channel').onPress();
    await waitFor(() => expect(getByText('Per-Channel Notifications')).toBeTruthy());
    expect(getByText('No channel overrides set.')).toBeTruthy();

    fireEvent.changeText(getByPlaceholderText('#channel'), '#dev');
    fireEvent.press(getByText('Add'));
    await waitFor(() =>
      expect(mockUpdateChannelPreferences).toHaveBeenCalledWith('#dev', {
        enabled: true,
        notifyOnMentions: true,
        notifyOnPrivateMessages: false,
        notifyOnAllMessages: false,
        doNotDisturb: false,
      })
    );

    await waitFor(() => expect(getByText('#dev')).toBeTruthy());
    fireEvent.press(getByText('Delete'));
    expect(mockRemoveChannelPreferences).toHaveBeenCalledWith('#dev');

    fireEvent.press(getByText('Close'));
    await waitFor(() => expect(queryByText('Per-Channel Notifications')).toBeNull());
  });

  it('opens and closes sound settings screen', async () => {
    const { getByTestId, queryByTestId } = render(
      <NotificationsSection colors={colors} styles={styles as any} settingIcons={{}} />
    );
    await waitFor(() => expect(mockCapturedItems.has('notifications-sounds')).toBe(true));

    mockCapturedItems.get('notifications-sounds').onPress();
    await waitFor(() => expect(getByTestId('sound-settings')).toBeTruthy());

    fireEvent.press(getByTestId('sound-close'));
    await waitFor(() => expect(queryByTestId('sound-settings')).toBeNull());
  });
});

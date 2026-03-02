/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { DataPrivacyScreen } from '../../src/screens/DataPrivacyScreen';

jest.mock('../../src/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      text: '#111',
      textSecondary: '#666',
      border: '#ddd',
      primary: '#09f',
      error: '#f44',
      surface: '#eee',
      card: '#fafafa',
      success: '#0a0',
    },
  }),
}));

jest.mock('../../src/i18n/transifex', () => ({
  useT: () => (key: string, params?: Record<string, unknown>) => {
    if (!params) {
      return key;
    }

    return Object.entries(params).reduce(
      (result, [paramKey, value]) => result.replace(`{${paramKey}}`, String(value)),
      key
    );
  },
}));

jest.mock('../../src/services/DataPrivacyService', () => ({
  dataPrivacyService: {
    getDataCollectionSummary: jest.fn(),
    getCrashlyticsOptOut: jest.fn(),
    exportUserData: jest.fn(),
    shareExportedData: jest.fn(),
    deleteAllUserData: jest.fn(),
    setCrashlyticsOptOut: jest.fn(),
  },
}));

jest.mock('../../src/services/KillSwitchService', () => ({
  killSwitchService: {
    confirmAndActivate: jest.fn(),
  },
}));

jest.mock('react-native-vector-icons/FontAwesome5', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return function MockIcon(props: any) {
    return React.createElement(Text, props, props.name);
  };
});

const { dataPrivacyService: mockDataPrivacyService } = require('../../src/services/DataPrivacyService');
const { killSwitchService: mockKillSwitchService } = require('../../src/services/KillSwitchService');

describe('DataPrivacyScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());

    mockDataPrivacyService.getDataCollectionSummary.mockResolvedValue({
      messagesCount: 12,
      networksCount: 2,
      identityProfilesCount: 3,
      storageSize: '42 KB',
      crashlyticsEnabled: true,
      consentStatus: 'Accepted',
    });
    mockDataPrivacyService.getCrashlyticsOptOut.mockResolvedValue(false);
    mockDataPrivacyService.exportUserData.mockResolvedValue({
      success: true,
      filePath: '/tmp/export.json',
    });
    mockDataPrivacyService.shareExportedData.mockResolvedValue(true);
    mockDataPrivacyService.deleteAllUserData.mockResolvedValue({
      success: true,
      deletedItems: {
        messageHistory: true,
        settings: true,
        networks: true,
        identityProfiles: true,
        consent: true,
        cache: true,
      },
      errors: [],
    });
    mockDataPrivacyService.setCrashlyticsOptOut.mockResolvedValue(undefined);
  });

  it('does not render content when hidden', () => {
    const { queryByText } = render(<DataPrivacyScreen visible={false} onClose={jest.fn()} />);

    expect(queryByText('My Data & Privacy')).toBeNull();
  });

  it('loads and renders data summary when visible', async () => {
    const { findByText } = render(<DataPrivacyScreen visible onClose={jest.fn()} />);

    expect(await findByText('My Data & Privacy')).toBeTruthy();
    expect(await findByText('42 KB')).toBeTruthy();
    expect(await findByText('Accepted')).toBeTruthy();

    await waitFor(() => {
      expect(mockDataPrivacyService.getDataCollectionSummary).toHaveBeenCalledTimes(1);
      expect(mockDataPrivacyService.getCrashlyticsOptOut).toHaveBeenCalledTimes(1);
    });
  });

  it('closes from header button', async () => {
    const onClose = jest.fn();
    const { findByText } = render(<DataPrivacyScreen visible onClose={onClose} />);

    fireEvent.press(await findByText('Close'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('exports and shares data after confirmation', async () => {
    const { findByText } = render(<DataPrivacyScreen visible onClose={jest.fn()} />);

    fireEvent.press(await findByText('Export My Data'));

    const exportDialog = (Alert.alert as jest.Mock).mock.calls.find(
      call => call[0] === 'Export My Data'
    );
    expect(exportDialog).toBeTruthy();

    await act(async () => {
      await exportDialog[2][1].onPress();
    });

    await waitFor(() => {
      expect(mockDataPrivacyService.exportUserData).toHaveBeenCalledTimes(1);
    });

    const shareDialog = (Alert.alert as jest.Mock).mock.calls.find(
      call => call[0] === 'Export Successful'
    );
    expect(shareDialog).toBeTruthy();

    await act(async () => {
      await shareDialog[2][1].onPress();
    });

    expect(mockDataPrivacyService.shareExportedData).toHaveBeenCalledWith('/tmp/export.json');
  });

  it('shows exported file path when share is skipped', async () => {
    mockDataPrivacyService.shareExportedData.mockResolvedValueOnce(false);
    const { findByText } = render(<DataPrivacyScreen visible onClose={jest.fn()} />);

    fireEvent.press(await findByText('Export My Data'));

    const exportDialog = (Alert.alert as jest.Mock).mock.calls.find(
      call => call[0] === 'Export My Data'
    );

    await act(async () => {
      await exportDialog[2][1].onPress();
    });

    const shareDialog = (Alert.alert as jest.Mock).mock.calls.find(
      call => call[0] === 'Export Successful'
    );

    await act(async () => {
      await shareDialog[2][1].onPress();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Export Complete',
      'File saved to: /tmp/export.json'
    );
  });

  it('shows export failure message when export fails', async () => {
    mockDataPrivacyService.exportUserData.mockResolvedValueOnce({
      success: false,
      error: 'disk full',
    });

    const { findByText } = render(<DataPrivacyScreen visible onClose={jest.fn()} />);
    fireEvent.press(await findByText('Export My Data'));

    const exportDialog = (Alert.alert as jest.Mock).mock.calls.find(
      call => call[0] === 'Export My Data'
    );

    await act(async () => {
      await exportDialog[2][1].onPress();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Export Failed',
      'Failed to export data: disk full'
    );
  });

  it('handles successful full data deletion and closes after acknowledgement', async () => {
    const onClose = jest.fn();
    const { findByText } = render(<DataPrivacyScreen visible onClose={onClose} />);

    fireEvent.press(await findByText('Delete All My Data'));

    const firstConfirm = (Alert.alert as jest.Mock).mock.calls.find(
      call => call[0] === '⚠️ Delete All My Data'
    );
    expect(firstConfirm).toBeTruthy();

    await act(async () => {
      await firstConfirm[2][1].onPress();
    });

    const secondConfirm = (Alert.alert as jest.Mock).mock.calls.find(
      call => call[0] === 'Final Confirmation'
    );
    expect(secondConfirm).toBeTruthy();

    await act(async () => {
      await secondConfirm[2][1].onPress();
    });

    await waitFor(() => {
      expect(mockDataPrivacyService.deleteAllUserData).toHaveBeenCalledTimes(1);
    });

    const successDialog = (Alert.alert as jest.Mock).mock.calls.find(
      call => call[0] === 'Data Deleted'
    );
    expect(successDialog).toBeTruthy();

    act(() => {
      successDialog[2][0].onPress();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows partial deletion details when not everything is deleted', async () => {
    mockDataPrivacyService.deleteAllUserData.mockResolvedValueOnce({
      success: false,
      deletedItems: {
        messageHistory: true,
        settings: false,
        networks: true,
        identityProfiles: false,
        consent: false,
        cache: true,
      },
      errors: ['Settings: failed', 'Consent: failed'],
    });

    const { findByText } = render(<DataPrivacyScreen visible onClose={jest.fn()} />);
    fireEvent.press(await findByText('Delete All My Data'));

    const firstConfirm = (Alert.alert as jest.Mock).mock.calls.find(
      call => call[0] === '⚠️ Delete All My Data'
    );
    await act(async () => {
      await firstConfirm[2][1].onPress();
    });

    const secondConfirm = (Alert.alert as jest.Mock).mock.calls.find(
      call => call[0] === 'Final Confirmation'
    );
    await act(async () => {
      await secondConfirm[2][1].onPress();
    });

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Partial Deletion',
        expect.stringContaining('Some data could not be deleted.')
      );
    });
  });

  it('updates crash reporting preference from the switch', async () => {
    const { UNSAFE_getByType } = render(<DataPrivacyScreen visible onClose={jest.fn()} />);
    const switchNode = await waitFor(() => UNSAFE_getByType(require('react-native').Switch));

    await act(async () => {
      fireEvent(switchNode, 'valueChange', false);
    });

    expect(mockDataPrivacyService.setCrashlyticsOptOut).toHaveBeenCalledWith(true);
    expect(Alert.alert).toHaveBeenCalledWith(
      'Setting Updated',
      'Crash reporting has been disabled. New crashes will not be collected.'
    );
  });

  it('triggers kill switch confirmation action', async () => {
    const { findByText } = render(<DataPrivacyScreen visible onClose={jest.fn()} />);

    fireEvent.press(await findByText('🚨 KILL SWITCH 🚨'));

    expect(mockKillSwitchService.confirmAndActivate).toHaveBeenCalledTimes(1);
  });
});

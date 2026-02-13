/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for BackupScreen
 */

import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { BackupScreen } from '../../src/screens/BackupScreen';
import { dataBackupService } from '../../src/services/DataBackupService';
import RNFS from 'react-native-fs';
import { pick, errorCodes } from '@react-native-documents/picker';

jest.mock('../../src/hooks/useTheme', () => ({
  useTheme: jest.fn(() => ({
    colors: {
      background: '#000000',
      surface: '#111111',
      border: '#333333',
      text: '#ffffff',
      textSecondary: '#aaaaaa',
      primary: '#2196F3',
      onPrimary: '#ffffff',
      error: '#f44336',
      buttonPrimary: '#2196F3',
      buttonPrimaryText: '#ffffff',
      buttonSecondary: '#333333',
      buttonSecondaryText: '#ffffff',
    },
  })),
}));

jest.mock('../../src/i18n/transifex', () => ({
  useT: jest.fn(() => (key: string) => key),
}));

jest.mock('../../src/services/DataBackupService', () => ({
  dataBackupService: {
    getStorageStats: jest.fn().mockResolvedValue({ keyCount: 10, totalBytes: 2048 }),
    getAllKeys: jest.fn().mockResolvedValue(['a', 'b']),
    exportAll: jest.fn().mockResolvedValue('{"version":1,"data":{}}'),
    exportKeys: jest.fn().mockResolvedValue('{"version":1,"data":{}}'),
    checkForSensitiveData: jest.fn().mockReturnValue({ hasSensitive: false }),
    encryptBackup: jest.fn().mockResolvedValue('{"encrypted":true}'),
    isEncryptedBackup: jest.fn().mockReturnValue(false),
    decryptBackup: jest.fn().mockResolvedValue('{"version":1,"data":{}}'),
    importAll: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('BackupScreen', () => {
  const onClose = jest.fn();
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());

  beforeEach(() => {
    jest.clearAllMocks();
    (RNFS.readFile as jest.Mock).mockResolvedValue('{"version":1,"data":{"k":"v"}}');
    (pick as jest.Mock).mockResolvedValue([{ uri: 'file:///tmp/backup.json' }]);
  });

  afterAll(() => {
    alertSpy.mockRestore();
  });

  it('does not render when not visible', () => {
    const { queryByText } = render(<BackupScreen visible={false} onClose={onClose} />);
    expect(queryByText('Backup & Restore')).toBeNull();
  });

  it('renders header and storage section when visible', async () => {
    const { findByText } = render(<BackupScreen visible={true} onClose={onClose} />);
    expect(await findByText('Backup & Restore')).toBeTruthy();
    expect(await findByText('Storage Statistics')).toBeTruthy();
  });

  it('opens restore modal from Restore from Backup button', async () => {
    const { findByText } = render(<BackupScreen visible={true} onClose={onClose} />);
    fireEvent.press(await findByText('Restore from Backup'));
    expect(await findByText('Paste your backup JSON here to restore your data.')).toBeTruthy();
    expect(await findByText('Load from File')).toBeTruthy();
  });

  it('shows validation error when restoring with empty data', async () => {
    const { findByText } = render(<BackupScreen visible={true} onClose={onClose} />);
    fireEvent.press(await findByText('Restore from Backup'));
    fireEvent.press(await findByText('Restore'));
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Please paste backup data first');
  });

  it('loads backup JSON from file and fills input', async () => {
    const json = '{"version":1,"data":{"foo":"bar"}}';
    (RNFS.readFile as jest.Mock).mockResolvedValue(json);

    const { findByText, getByDisplayValue } = render(
      <BackupScreen visible={true} onClose={onClose} />
    );
    fireEvent.press(await findByText('Restore from Backup'));
    fireEvent.press(await findByText('Load from File'));

    await waitFor(() => {
      expect(RNFS.readFile).toHaveBeenCalledWith('/tmp/backup.json', 'utf8');
      expect(getByDisplayValue(json)).toBeTruthy();
    });
    expect(Alert.alert).toHaveBeenCalledWith('Success', 'Backup loaded from file');
  });

  it('shows error when selected file is invalid JSON', async () => {
    (RNFS.readFile as jest.Mock).mockResolvedValue('not-json');

    const { findByText } = render(<BackupScreen visible={true} onClose={onClose} />);
    fireEvent.press(await findByText('Restore from Backup'));
    fireEvent.press(await findByText('Load from File'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Selected file is not a valid JSON backup');
    });
  });

  it('shows error when selected file is empty', async () => {
    (RNFS.readFile as jest.Mock).mockResolvedValue('   ');

    const { findByText } = render(<BackupScreen visible={true} onClose={onClose} />);
    fireEvent.press(await findByText('Restore from Backup'));
    fireEvent.press(await findByText('Load from File'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Selected file is empty');
    });
  });

  it('does not show error when file picker is canceled', async () => {
    (pick as jest.Mock).mockRejectedValue({ code: errorCodes.OPERATION_CANCELED });

    const { findByText } = render(<BackupScreen visible={true} onClose={onClose} />);
    fireEvent.press(await findByText('Restore from Backup'));
    fireEvent.press(await findByText('Load from File'));

    await waitFor(() => {
      expect(Alert.alert).not.toHaveBeenCalledWith('Error', 'Failed to load backup file');
    });
  });

  it('shows decrypt prompt when backup is encrypted', async () => {
    (dataBackupService.isEncryptedBackup as jest.Mock).mockReturnValue(true);
    const encryptedJson = '{"encrypted":true,"salt":"x","iv":"y","ciphertext":"z"}';

    const { findByText, findByPlaceholderText } = render(
      <BackupScreen visible={true} onClose={onClose} />
    );
    fireEvent.press(await findByText('Restore from Backup'));
    fireEvent.changeText(await findByPlaceholderText('Backup JSON appears here...'), encryptedJson);
    fireEvent.press(await findByText('Restore'));

    expect(await findByText('Encrypted Backup')).toBeTruthy();
  });

  it('imports plain backup after confirmation', async () => {
    (dataBackupService.isEncryptedBackup as jest.Mock).mockReturnValue(false);
    const plainJson = '{"version":1,"timestamp":"2026-02-13T00:00:00.000Z","data":{"k":"v"}}';

    const { findByText, findByPlaceholderText } = render(
      <BackupScreen visible={true} onClose={onClose} />
    );
    fireEvent.press(await findByText('Restore from Backup'));
    fireEvent.changeText(await findByPlaceholderText('Backup JSON appears here...'), plainJson);
    fireEvent.press(await findByText('Restore'));

    const confirmCall = (Alert.alert as jest.Mock).mock.calls.find(
      call => call[0] === 'Confirm Restore'
    );
    expect(confirmCall).toBeTruthy();

    const buttons = confirmCall?.[2] as Array<{ text: string; onPress?: () => Promise<void> | void }>;
    const restoreButton = buttons?.find(button => button.text === 'Restore');
    expect(restoreButton).toBeTruthy();

    await act(async () => {
      await restoreButton?.onPress?.();
    });

    expect(dataBackupService.importAll).toHaveBeenCalledWith(plainJson);
  });
});

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
import Clipboard from '@react-native-clipboard/clipboard';
import { connectionManager } from '../../src/services/ConnectionManager';
import { messageHistoryBatching } from '../../src/services/MessageHistoryBatching';

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
  tx: {
    t: (key: string) => key,
  },
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

jest.mock('../../src/services/ConnectionManager', () => ({
  connectionManager: {
    disconnectAll: jest.fn(),
  },
}));

jest.mock('../../src/services/MessageHistoryBatching', () => ({
  messageHistoryBatching: {
    flushSync: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('BackupScreen', () => {
  const onClose = jest.fn();
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());

  beforeEach(() => {
    jest.clearAllMocks();
    (RNFS.readFile as jest.Mock).mockResolvedValue('{"version":1,"data":{"k":"v"}}');
    (RNFS as any).writeFile = jest.fn().mockResolvedValue(undefined);
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
    const { getByText } = render(<BackupScreen visible={true} onClose={onClose} />);
    expect(getByText('Backup & Restore')).toBeTruthy();
    expect(getByText('Storage Statistics')).toBeTruthy();
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
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Please paste backup data or load a backup file first');
  });

  it('loads backup JSON from file and shows loaded-file metadata card', async () => {
    const json = '{"version":1,"data":{"foo":"bar"}}';
    (RNFS.readFile as jest.Mock).mockResolvedValue(json);

    const { findByText, queryByDisplayValue } = render(
      <BackupScreen visible={true} onClose={onClose} />
    );
    fireEvent.press(await findByText('Restore from Backup'));
    fireEvent.press(await findByText('Load from File'));

    await waitFor(() => {
      expect(RNFS.readFile).toHaveBeenCalledWith('/tmp/backup.json', 'utf8');
      expect(queryByDisplayValue(json)).toBeNull();
      expect(Alert.alert).toHaveBeenCalledWith(
        'Backup Loaded',
        'Backup file loaded successfully. Please wait during restore and do not close the app.'
      );
    });
    expect(await findByText('Loaded Backup File')).toBeTruthy();
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

  it('shows alert when trying to generate backup with no options selected', async () => {
    const { findByText } = render(<BackupScreen visible={true} onClose={onClose} />);

    fireEvent.press(await findByText('Clear All'));
    fireEvent.press(await findByText('Generate Backup'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'No Options Selected',
        'Please select at least one backup option'
      );
    });
  });

  it('handles sensitive backup encryption flow and copy/save actions', async () => {
    (dataBackupService.checkForSensitiveData as jest.Mock).mockReturnValue({ hasSensitive: true });
    (dataBackupService.encryptBackup as jest.Mock).mockResolvedValue('{"encrypted":true}');

    const { findByText, findByPlaceholderText } = render(
      <BackupScreen visible={true} onClose={onClose} />
    );

    fireEvent.press(await findByText('Generate Backup'));
    expect(await findByText('Sensitive Data Detected')).toBeTruthy();

    fireEvent.changeText(
      await findByPlaceholderText('Enter encryption password (optional)'),
      'secret1'
    );
    fireEvent.press(await findByText('Encrypt & Export'));

    await waitFor(() => {
      expect(dataBackupService.encryptBackup).toHaveBeenCalled();
      expect(Alert.alert).toHaveBeenCalledWith(
        'Backup Encrypted',
        'Your backup has been encrypted. Keep your password safe - you will need it to restore this backup.'
      );
    });

    fireEvent.press(await findByText('Copy to Clipboard'));
    expect(Clipboard.setString).toHaveBeenCalledWith('{"encrypted":true}');

    fireEvent.press(await findByText('Save to File'));
    await waitFor(() => {
      expect((RNFS as any).writeFile).toHaveBeenCalled();
    });
  });

  it('switches loaded file restore mode back to manual paste', async () => {
    const { findByText, queryByText, findByPlaceholderText } = render(
      <BackupScreen visible={true} onClose={onClose} />
    );

    fireEvent.press(await findByText('Restore from Backup'));
    fireEvent.press(await findByText('Load from File'));

    expect(await findByText('Loaded Backup File')).toBeTruthy();
    fireEvent.press(await findByText('Switch to Manual JSON Paste'));

    expect(queryByText('Loaded Backup File')).toBeNull();
    expect(await findByPlaceholderText('Backup JSON appears here...')).toBeTruthy();
  });

  it('decrypts encrypted backup and restores it after confirmation', async () => {
    (dataBackupService.isEncryptedBackup as jest.Mock).mockReturnValue(true);
    (dataBackupService.decryptBackup as jest.Mock).mockResolvedValue('{"version":1,"data":{"z":"x"}}');

    const { findByText, findByPlaceholderText } = render(
      <BackupScreen visible={true} onClose={onClose} />
    );

    fireEvent.press(await findByText('Restore from Backup'));
    fireEvent.changeText(
      await findByPlaceholderText('Backup JSON appears here...'),
      '{"encrypted":true}'
    );
    fireEvent.press(await findByText('Restore'));
    fireEvent.changeText(await findByPlaceholderText('Enter decryption password'), 'secret1');
    fireEvent.press(await findByText('Decrypt & Restore'));

    await waitFor(() => {
      expect((Alert.alert as jest.Mock).mock.calls.some(call => call[0] === 'Confirm Restore')).toBe(true);
    });

    const confirmCall = (Alert.alert as jest.Mock).mock.calls.find(call => call[0] === 'Confirm Restore');
    const buttons = confirmCall?.[2] as Array<{ text: string; onPress?: () => Promise<void> | void }>;
    const restoreButton = buttons?.find(button => button.text === 'Restore');

    await act(async () => {
      await restoreButton?.onPress?.();
    });

    expect(dataBackupService.decryptBackup).toHaveBeenCalledWith('{"encrypted":true}', 'secret1');
    await waitFor(() => {
      expect(dataBackupService.importAll).toHaveBeenCalledWith('{"version":1,"data":{"z":"x"}}');
    });
  });

  it('runs restart flow after restore completes', async () => {
    const exitAppSpy = jest
      .spyOn(require('react-native').BackHandler, 'exitApp')
      .mockImplementation(jest.fn());
    const originalPlatform = require('react-native').Platform.OS;
    Object.defineProperty(require('react-native').Platform, 'OS', {
      configurable: true,
      value: 'android',
    });
    (dataBackupService.isEncryptedBackup as jest.Mock).mockReturnValue(false);

    try {
      const { findByText, findByPlaceholderText } = render(
        <BackupScreen visible={true} onClose={onClose} />
      );

      fireEvent.press(await findByText('Restore from Backup'));
      fireEvent.changeText(
        await findByPlaceholderText('Backup JSON appears here...'),
        '{"version":1,"data":{"k":"v"}}'
      );
      fireEvent.press(await findByText('Restore'));

      await waitFor(() => {
        expect((Alert.alert as jest.Mock).mock.calls.some(call => call[0] === 'Confirm Restore')).toBe(true);
      });

      const confirmCall = (Alert.alert as jest.Mock).mock.calls.find(call => call[0] === 'Confirm Restore');
      const buttons = confirmCall?.[2] as Array<{ text: string; onPress?: () => Promise<void> | void }>;
      const restoreButton = buttons?.find(button => button.text === 'Restore');

      await act(async () => {
        await restoreButton?.onPress?.();
      });

      expect(await findByText('Exit to Restart App')).toBeTruthy();
      fireEvent.press(await findByText('Exit to Restart App'));

      await waitFor(() => {
        expect(messageHistoryBatching.flushSync).toHaveBeenCalled();
        expect(connectionManager.disconnectAll).toHaveBeenCalledWith('Restarting after backup restore');
        expect(exitAppSpy).toHaveBeenCalled();
      });
    } finally {
      Object.defineProperty(require('react-native').Platform, 'OS', {
        configurable: true,
        value: originalPlatform,
      });
    }
  });

});

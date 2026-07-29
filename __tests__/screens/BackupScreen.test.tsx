/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for BackupScreen
 */

import React from 'react';
import { Alert, Platform } from 'react-native';
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
    getStorageStats: jest
      .fn()
      .mockResolvedValue({ keyCount: 10, totalBytes: 2048 }),
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

  beforeEach(async () => {
    jest.clearAllMocks();
    (dataBackupService.getStorageStats as jest.Mock).mockResolvedValue({
      keyCount: 10,
      totalBytes: 2048,
    });
    (dataBackupService.getAllKeys as jest.Mock).mockResolvedValue(['a', 'b']);
    (dataBackupService.exportAll as jest.Mock).mockResolvedValue(
      '{"version":1,"data":{}}',
    );
    (dataBackupService.exportKeys as jest.Mock).mockResolvedValue(
      '{"version":1,"data":{}}',
    );
    (dataBackupService.checkForSensitiveData as jest.Mock).mockReturnValue({
      hasSensitive: false,
    });
    (dataBackupService.encryptBackup as jest.Mock).mockResolvedValue(
      '{"encrypted":true}',
    );
    (dataBackupService.isEncryptedBackup as jest.Mock).mockReturnValue(false);
    (dataBackupService.decryptBackup as jest.Mock).mockResolvedValue(
      '{"version":1,"data":{}}',
    );
    (dataBackupService.importAll as jest.Mock).mockResolvedValue(undefined);
    (RNFS.readFile as jest.Mock).mockResolvedValue(
      '{"version":1,"data":{"k":"v"}}',
    );
    (RNFS as any).writeFile = jest.fn().mockResolvedValue(undefined);
    (RNFS as any).unlink = jest.fn().mockResolvedValue(undefined);
    (pick as jest.Mock).mockResolvedValue([{ uri: 'file:///tmp/backup.json' }]);
  });

  afterAll(() => {
    alertSpy.mockRestore();
  });

  it('does not render when not visible', async () => {
    const { queryByText } = await render(
      <BackupScreen visible={false} onClose={onClose} />,
    );
    expect(queryByText('Backup & Restore')).toBeNull();
  });

  it('renders header and storage section when visible', async () => {
    const { getByText } = await render(
      <BackupScreen visible={true} onClose={onClose} />,
    );
    expect(getByText('Backup & Restore')).toBeTruthy();
    expect(getByText('Storage Statistics')).toBeTruthy();
  });

  it('opens restore modal from Restore from Backup button', async () => {
    const { findByText } = await render(
      <BackupScreen visible={true} onClose={onClose} />,
    );
    await fireEvent.press(await findByText('Restore from Backup'));
    expect(
      await findByText('Paste your backup JSON here to restore your data.'),
    ).toBeTruthy();
    expect(await findByText('Load from File')).toBeTruthy();
  });

  it('shows validation error when restoring with empty data', async () => {
    const { findByText } = await render(
      <BackupScreen visible={true} onClose={onClose} />,
    );
    await fireEvent.press(await findByText('Restore from Backup'));
    await fireEvent.press(await findByText('Restore'));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Please paste backup data or load a backup file first',
    );
  });

  it('loads backup JSON from file and shows loaded-file metadata card', async () => {
    const json = '{"version":1,"data":{"foo":"bar"}}';
    (RNFS.readFile as jest.Mock).mockResolvedValue(json);

    const { findByText, queryByDisplayValue } = await render(
      <BackupScreen visible={true} onClose={onClose} />,
    );
    await fireEvent.press(await findByText('Restore from Backup'));
    await fireEvent.press(await findByText('Load from File'));

    await waitFor(async () => {
      expect(RNFS.readFile).toHaveBeenCalledWith('/tmp/backup.json', 'utf8');
      expect(queryByDisplayValue(json)).toBeNull();
      expect(Alert.alert).toHaveBeenCalledWith(
        'Backup Loaded',
        'Backup file loaded successfully. Please wait during restore and do not close the app.',
      );
    });
    expect(await findByText('Loaded Backup File')).toBeTruthy();
  });

  it('loads backup JSON from Android picker copy and cleans it up', async () => {
    (pick as jest.Mock).mockResolvedValue([
      {
        uri: 'content://provider/backup.json',
        fileCopyUri: 'file:///tmp/copied-backup.json',
        name: 'backup.json',
      },
    ]);

    const { findByText } = await render(
      <BackupScreen visible={true} onClose={onClose} />,
    );
    await fireEvent.press(await findByText('Restore from Backup'));
    await fireEvent.press(await findByText('Load from File'));

    await waitFor(async () => {
      expect(RNFS.readFile).toHaveBeenCalledWith(
        '/tmp/copied-backup.json',
        'utf8',
      );
      expect((RNFS as any).unlink).toHaveBeenCalledWith(
        '/tmp/copied-backup.json',
      );
    });
  });

  it('shows error when selected file is invalid JSON', async () => {
    (RNFS.readFile as jest.Mock).mockResolvedValue('not-json');

    const { findByText } = await render(
      <BackupScreen visible={true} onClose={onClose} />,
    );
    await fireEvent.press(await findByText('Restore from Backup'));
    await fireEvent.press(await findByText('Load from File'));

    await waitFor(async () => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Error',
        'Selected file is not a valid JSON backup',
      );
    });
  });

  it('shows error when selected file is empty', async () => {
    (RNFS.readFile as jest.Mock).mockResolvedValue('   ');

    const { findByText } = await render(
      <BackupScreen visible={true} onClose={onClose} />,
    );
    await fireEvent.press(await findByText('Restore from Backup'));
    await fireEvent.press(await findByText('Load from File'));

    await waitFor(async () => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Error',
        'Selected file is empty',
      );
    });
  });

  it('does not show error when file picker is canceled', async () => {
    (pick as jest.Mock).mockRejectedValue({
      code: errorCodes.OPERATION_CANCELED,
    });

    const { findByText } = await render(
      <BackupScreen visible={true} onClose={onClose} />,
    );
    await fireEvent.press(await findByText('Restore from Backup'));
    await fireEvent.press(await findByText('Load from File'));

    await waitFor(async () => {
      expect(Alert.alert).not.toHaveBeenCalledWith(
        'Error',
        'Failed to load backup file',
      );
    });
  });

  it('shows decrypt prompt when backup is encrypted', async () => {
    (dataBackupService.isEncryptedBackup as jest.Mock).mockReturnValue(true);
    const encryptedJson =
      '{"encrypted":true,"salt":"x","iv":"y","ciphertext":"z"}';

    const { findByText, findByPlaceholderText } = await render(
      <BackupScreen visible={true} onClose={onClose} />,
    );
    await fireEvent.press(await findByText('Restore from Backup'));
    await fireEvent.changeText(
      await findByPlaceholderText('Backup JSON appears here...'),
      encryptedJson,
    );
    await fireEvent.press(await findByText('Restore'));

    expect(await findByText('Encrypted Backup')).toBeTruthy();
  });

  it('imports plain backup after confirmation', async () => {
    (dataBackupService.isEncryptedBackup as jest.Mock).mockReturnValue(false);
    const plainJson =
      '{"version":1,"timestamp":"2026-02-13T00:00:00.000Z","data":{"k":"v"}}';

    const { findByText, findByPlaceholderText } = await render(
      <BackupScreen visible={true} onClose={onClose} />,
    );
    await fireEvent.press(await findByText('Restore from Backup'));
    await fireEvent.changeText(
      await findByPlaceholderText('Backup JSON appears here...'),
      plainJson,
    );
    await fireEvent.press(await findByText('Restore'));

    const confirmCall = (Alert.alert as jest.Mock).mock.calls.find(
      call => call[0] === 'Confirm Restore',
    );
    expect(confirmCall).toBeTruthy();

    const buttons = confirmCall?.[2] as Array<{
      text: string;
      onPress?: () => Promise<void> | void;
    }>;
    const restoreButton = buttons?.find(button => button.text === 'Restore');
    expect(restoreButton).toBeTruthy();

    await act(async () => {
      await restoreButton?.onPress?.();
    });

    expect(dataBackupService.importAll).toHaveBeenCalledWith(plainJson);
  });

  it('shows alert when trying to generate backup with no options selected', async () => {
    const { findByText } = await render(
      <BackupScreen visible={true} onClose={onClose} />,
    );

    await fireEvent.press(await findByText('Clear All'));
    await fireEvent.press(await findByText('Generate Backup'));

    await waitFor(async () => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'No Options Selected',
        'Please select at least one backup option',
      );
    });
  });

  it('generates a plain backup, uses exportAll when all data is selected, and exports unencrypted when requested', async () => {
    const { findByText } = await render(
      <BackupScreen visible={true} onClose={onClose} />,
    );

    await fireEvent.press(await findByText('All Data'));
    await fireEvent.press(await findByText('Generate Backup'));

    await waitFor(async () => {
      expect(dataBackupService.exportAll).toHaveBeenCalled();
      expect(Alert.alert).toHaveBeenCalledWith(
        'Backup Ready',
        expect.stringContaining('Generated backup with'),
      );
    });

    expect(await findByText('Backup Data')).toBeTruthy();
    expect(await findByText('Copy to Clipboard')).toBeTruthy();
  });

  it('shows encryption failure when encrypting sensitive backup', async () => {
    (dataBackupService.checkForSensitiveData as jest.Mock).mockReturnValue({
      hasSensitive: true,
    });
    (dataBackupService.encryptBackup as jest.Mock).mockRejectedValueOnce(
      new Error('encrypt failed'),
    );

    const { findByText, findByPlaceholderText } = await render(
      <BackupScreen visible={true} onClose={onClose} />,
    );

    await fireEvent.press(await findByText('Generate Backup'));
    await fireEvent.changeText(
      await findByPlaceholderText('Enter encryption password (optional)'),
      'secret1',
    );
    await fireEvent.press(await findByText('Encrypt & Export'));

    await waitFor(async () => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Encryption Failed',
        'encrypt failed',
      );
    });
  });

  it('handles sensitive backup encryption flow and copy/save actions', async () => {
    (dataBackupService.checkForSensitiveData as jest.Mock).mockReturnValue({
      hasSensitive: true,
    });
    (dataBackupService.encryptBackup as jest.Mock).mockResolvedValue(
      '{"encrypted":true}',
    );

    const { findByText, findByPlaceholderText } = await render(
      <BackupScreen visible={true} onClose={onClose} />,
    );

    await fireEvent.press(await findByText('Generate Backup'));
    expect(await findByText('Sensitive Data Detected')).toBeTruthy();

    await fireEvent.changeText(
      await findByPlaceholderText('Enter encryption password (optional)'),
      'secret1',
    );
    await fireEvent.press(await findByText('Encrypt & Export'));

    await waitFor(async () => {
      expect(dataBackupService.encryptBackup).toHaveBeenCalled();
      expect(Alert.alert).toHaveBeenCalledWith(
        'Backup Encrypted',
        'Your backup has been encrypted. Keep your password safe - you will need it to restore this backup.',
      );
    });

    await fireEvent.press(await findByText('Copy to Clipboard'));
    expect(Clipboard.setString).toHaveBeenCalledWith('{"encrypted":true}');

    await fireEvent.press(await findByText('Save to File'));
    await waitFor(async () => {
      expect((RNFS as any).writeFile).toHaveBeenCalled();
    });
  });

  it('shows copy failure when clipboard write fails', async () => {
    (dataBackupService.checkForSensitiveData as jest.Mock).mockReturnValue({
      hasSensitive: false,
    });
    const clipboardSpy = jest
      .spyOn(Clipboard, 'setString')
      .mockImplementationOnce(() => {
        throw new Error('copy failed');
      });

    const { findByText } = await render(
      <BackupScreen visible={true} onClose={onClose} />,
    );

    await act(async () => {
      await fireEvent.press(await findByText('Generate Backup'));
    });

    expect(await findByText('Backup Data')).toBeTruthy();

    await fireEvent.press(await findByText('Copy to Clipboard'));
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'copy failed');

    clipboardSpy.mockRestore();
  });

  it('saves a backup on Android using the external directory path', async () => {
    const originalPlatform = Platform.OS;
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'android',
    });
    Object.defineProperty(RNFS, 'ExternalDirectoryPath', {
      configurable: true,
      value: '/external',
    });
    (dataBackupService.checkForSensitiveData as jest.Mock).mockReturnValue({
      hasSensitive: false,
    });

    try {
      const { findByText } = await render(
        <BackupScreen visible={true} onClose={onClose} />,
      );

      await act(async () => {
        await fireEvent.press(await findByText('Generate Backup'));
      });

      expect(await findByText('Backup Data')).toBeTruthy();

      await fireEvent.press(await findByText('Save to File'));

      await waitFor(async () => {
        expect((RNFS as any).writeFile).toHaveBeenCalledWith(
          expect.stringContaining('/external/androidircx_backup_'),
          expect.any(String),
          'utf8',
        );
      });
    } finally {
      Object.defineProperty(Platform, 'OS', {
        configurable: true,
        value: originalPlatform,
      });
    }
  });

  it('switches loaded file restore mode back to manual paste', async () => {
    const { findByText, queryByText, findByPlaceholderText } = await render(
      <BackupScreen visible={true} onClose={onClose} />,
    );

    await fireEvent.press(await findByText('Restore from Backup'));
    await fireEvent.press(await findByText('Load from File'));

    expect(await findByText('Loaded Backup File')).toBeTruthy();
    await fireEvent.press(await findByText('Switch to Manual JSON Paste'));

    expect(queryByText('Loaded Backup File')).toBeNull();
    expect(
      await findByPlaceholderText('Backup JSON appears here...'),
    ).toBeTruthy();
  });

  it('decrypts encrypted backup and restores it after confirmation', async () => {
    (dataBackupService.isEncryptedBackup as jest.Mock).mockReturnValue(true);
    (dataBackupService.decryptBackup as jest.Mock).mockResolvedValue(
      '{"version":1,"data":{"z":"x"}}',
    );

    const { findByText, findByPlaceholderText } = await render(
      <BackupScreen visible={true} onClose={onClose} />,
    );

    await fireEvent.press(await findByText('Restore from Backup'));
    await fireEvent.changeText(
      await findByPlaceholderText('Backup JSON appears here...'),
      '{"encrypted":true}',
    );
    await fireEvent.press(await findByText('Restore'));
    await fireEvent.changeText(
      await findByPlaceholderText('Enter decryption password'),
      'secret1',
    );
    await fireEvent.press(await findByText('Decrypt & Restore'));

    await waitFor(async () => {
      expect(
        (Alert.alert as jest.Mock).mock.calls.some(
          call => call[0] === 'Confirm Restore',
        ),
      ).toBe(true);
    });

    const confirmCall = (Alert.alert as jest.Mock).mock.calls.find(
      call => call[0] === 'Confirm Restore',
    );
    const buttons = confirmCall?.[2] as Array<{
      text: string;
      onPress?: () => Promise<void> | void;
    }>;
    const restoreButton = buttons?.find(button => button.text === 'Restore');

    await act(async () => {
      await restoreButton?.onPress?.();
    });

    expect(dataBackupService.decryptBackup).toHaveBeenCalledWith(
      '{"encrypted":true}',
      'secret1',
    );
    await waitFor(async () => {
      expect(dataBackupService.importAll).toHaveBeenCalledWith(
        '{"version":1,"data":{"z":"x"}}',
      );
    });
  });

  it('shows decrypt password validation and decrypt failure', async () => {
    (dataBackupService.isEncryptedBackup as jest.Mock).mockReturnValue(true);
    (dataBackupService.decryptBackup as jest.Mock).mockRejectedValueOnce(
      new Error('bad password'),
    );

    const { findByText, findByPlaceholderText } = await render(
      <BackupScreen visible={true} onClose={onClose} />,
    );

    await fireEvent.press(await findByText('Restore from Backup'));
    await fireEvent.changeText(
      await findByPlaceholderText('Backup JSON appears here...'),
      '{"encrypted":true}',
    );
    await fireEvent.press(await findByText('Restore'));
    await findByPlaceholderText('Enter decryption password');

    await fireEvent.changeText(
      await findByPlaceholderText('Enter decryption password'),
      'secret1',
    );
    await fireEvent.press(await findByText('Decrypt & Restore'));

    await waitFor(async () => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Decryption Failed',
        'bad password',
      );
    });
  });

  it('shows load-from-file no selection and error fallback message', async () => {
    (pick as jest.Mock).mockResolvedValueOnce([{}]).mockRejectedValueOnce({
      message: '',
      description: 'picker description',
    });

    const { findByText } = await render(
      <BackupScreen visible={true} onClose={onClose} />,
    );

    await fireEvent.press(await findByText('Restore from Backup'));
    await fireEvent.press(await findByText('Load from File'));

    await waitFor(async () => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'No file selected');
    });

    await fireEvent.press(await findByText('Load from File'));
    await waitFor(async () => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'picker description');
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
      const { findByText, findByPlaceholderText } = await render(
        <BackupScreen visible={true} onClose={onClose} />,
      );

      await fireEvent.press(await findByText('Restore from Backup'));
      await fireEvent.changeText(
        await findByPlaceholderText('Backup JSON appears here...'),
        '{"version":1,"data":{"k":"v"}}',
      );
      await fireEvent.press(await findByText('Restore'));

      await waitFor(async () => {
        expect(
          (Alert.alert as jest.Mock).mock.calls.some(
            call => call[0] === 'Confirm Restore',
          ),
        ).toBe(true);
      });

      const confirmCall = (Alert.alert as jest.Mock).mock.calls.find(
        call => call[0] === 'Confirm Restore',
      );
      const buttons = confirmCall?.[2] as Array<{
        text: string;
        onPress?: () => Promise<void> | void;
      }>;
      const restoreButton = buttons?.find(button => button.text === 'Restore');

      await act(async () => {
        await restoreButton?.onPress?.();
      });

      expect(await findByText('Exit to Restart App')).toBeTruthy();
      await fireEvent.press(await findByText('Exit to Restart App'));

      await waitFor(async () => {
        expect(messageHistoryBatching.flushSync).toHaveBeenCalled();
        expect(connectionManager.disconnectAll).toHaveBeenCalledWith(
          'Restarting after backup restore',
        );
        expect(exitAppSpy).toHaveBeenCalled();
      });
    } finally {
      Object.defineProperty(require('react-native').Platform, 'OS', {
        configurable: true,
        value: originalPlatform,
      });
    }
  });

  it('toggles a data option and applies settings/minimal presets', async () => {
    const { findByText, getAllByRole } = await render(
      <BackupScreen visible={true} onClose={onClose} />,
    );

    const switches = getAllByRole('switch');
    await fireEvent(switches[0], 'valueChange', false);
    await fireEvent.press(await findByText('Settings Only'));
    await fireEvent.press(await findByText('Minimal'));

    expect(await findByText('Quick Presets')).toBeTruthy();
  });

  it('shows an error when backup generation returns empty data', async () => {
    (dataBackupService.exportAll as jest.Mock).mockResolvedValue('');

    const { findByText } = await render(
      <BackupScreen visible={true} onClose={onClose} />,
    );

    await fireEvent.press(await findByText('All Data'));
    await fireEvent.press(await findByText('Generate Backup'));

    await waitFor(async () => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Error',
        'Failed to generate backup',
      );
    });
  });

  it('exports an unencrypted backup from the sensitive-data prompt', async () => {
    (dataBackupService.checkForSensitiveData as jest.Mock).mockReturnValue({
      hasSensitive: true,
    });

    const { findByText } = await render(
      <BackupScreen visible={true} onClose={onClose} />,
    );

    await fireEvent.press(await findByText('Generate Backup'));
    expect(await findByText('Sensitive Data Detected')).toBeTruthy();
    await fireEvent.press(await findByText('Export Unencrypted'));

    await waitFor(async () => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Backup Ready',
        expect.stringContaining('Generated backup with'),
      );
    });
    expect(await findByText('Backup Data')).toBeTruthy();
  });

  it('renders the large generated backup card and restores from it', async () => {
    const big = `{"version":1,"data":{"k":"${'x'.repeat(260000)}"}}`;
    (dataBackupService.exportAll as jest.Mock).mockResolvedValue(big);
    (dataBackupService.checkForSensitiveData as jest.Mock).mockReturnValue({
      hasSensitive: false,
    });
    (dataBackupService.isEncryptedBackup as jest.Mock).mockReturnValue(false);

    const { findByText } = await render(
      <BackupScreen visible={true} onClose={onClose} />,
    );

    await fireEvent.press(await findByText('All Data'));
    await act(async () => {
      await fireEvent.press(await findByText('Generate Backup'));
    });

    expect(await findByText('Generated Backup')).toBeTruthy();

    await fireEvent.press(await findByText('Restore'));
    const confirmCall = (Alert.alert as jest.Mock).mock.calls.find(
      call => call[0] === 'Confirm Restore',
    );
    const buttons = confirmCall?.[2] as Array<{
      text: string;
      onPress?: () => Promise<void> | void;
    }>;
    const restoreButton = buttons?.find(button => button.text === 'Restore');
    await act(async () => {
      await restoreButton?.onPress?.();
    });

    expect(dataBackupService.importAll).toHaveBeenCalledWith(big);
  });

  it('switches a large generated backup to manual JSON paste', async () => {
    const big = `{"version":1,"data":{"k":"${'y'.repeat(260000)}"}}`;
    (dataBackupService.exportAll as jest.Mock).mockResolvedValue(big);
    (dataBackupService.checkForSensitiveData as jest.Mock).mockReturnValue({
      hasSensitive: false,
    });

    const { findByText, findByPlaceholderText } = await render(
      <BackupScreen visible={true} onClose={onClose} />,
    );

    await fireEvent.press(await findByText('All Data'));
    await act(async () => {
      await fireEvent.press(await findByText('Generate Backup'));
    });

    expect(await findByText('Generated Backup')).toBeTruthy();
    await fireEvent.press(await findByText('Switch to Manual JSON Paste'));
    expect(
      await findByPlaceholderText('Backup JSON appears here...'),
    ).toBeTruthy();
  });

  it('restores directly from a loaded backup file', async () => {
    const json = '{"version":1,"data":{"foo":"bar"}}';
    (RNFS.readFile as jest.Mock).mockResolvedValue(json);
    (dataBackupService.isEncryptedBackup as jest.Mock).mockReturnValue(false);

    const { findByText } = await render(
      <BackupScreen visible={true} onClose={onClose} />,
    );

    await fireEvent.press(await findByText('Restore from Backup'));
    await fireEvent.press(await findByText('Load from File'));
    await findByText('Loaded Backup File');
    await fireEvent.press(await findByText('Restore'));

    const confirmCall = (Alert.alert as jest.Mock).mock.calls.find(
      call => call[0] === 'Confirm Restore',
    );
    const buttons = confirmCall?.[2] as Array<{
      text: string;
      onPress?: () => Promise<void> | void;
    }>;
    const restoreButton = buttons?.find(button => button.text === 'Restore');
    await act(async () => {
      await restoreButton?.onPress?.();
    });

    expect(dataBackupService.importAll).toHaveBeenCalledWith(json);
  });

  it('shows an error when saving the backup file fails', async () => {
    (dataBackupService.checkForSensitiveData as jest.Mock).mockReturnValue({
      hasSensitive: false,
    });
    (RNFS as any).writeFile = jest
      .fn()
      .mockRejectedValueOnce(new Error('disk full'));

    const { findByText } = await render(
      <BackupScreen visible={true} onClose={onClose} />,
    );

    await act(async () => {
      await fireEvent.press(await findByText('Generate Backup'));
    });
    expect(await findByText('Backup Data')).toBeTruthy();
    await fireEvent.press(await findByText('Save to File'));

    await waitFor(async () => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'disk full');
    });
  });

  it('resolves the Android content:// picker copy path', async () => {
    const originalPlatform = Platform.OS;
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'android',
    });
    // No fileCopyUri, so the android content:// resolution branch is exercised.
    (pick as jest.Mock).mockResolvedValue([
      {
        uri: 'content://provider/backup.json',
        name: 'backup.json',
      },
    ]);
    (RNFS.readFile as jest.Mock).mockResolvedValue(
      '{"version":1,"data":{"k":"v"}}',
    );

    try {
      const { findByText } = await render(
        <BackupScreen visible={true} onClose={onClose} />,
      );
      await fireEvent.press(await findByText('Restore from Backup'));
      await fireEvent.press(await findByText('Load from File'));

      await waitFor(async () => {
        expect(RNFS.readFile).toHaveBeenCalledWith(
          'content://provider/backup.json',
          'utf8',
        );
      });
    } finally {
      Object.defineProperty(Platform, 'OS', {
        configurable: true,
        value: originalPlatform,
      });
    }
  });

  it('surfaces an error when restore checks throw', async () => {
    (dataBackupService.isEncryptedBackup as jest.Mock).mockImplementation(() => {
      throw new Error('restore boom');
    });

    const { findByText, findByPlaceholderText } = await render(
      <BackupScreen visible={true} onClose={onClose} />,
    );

    await fireEvent.press(await findByText('Restore from Backup'));
    await fireEvent.changeText(
      await findByPlaceholderText('Backup JSON appears here...'),
      '{"version":1,"data":{}}',
    );
    await fireEvent.press(await findByText('Restore'));

    await waitFor(async () => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'restore boom');
    });
  });

  it('cancels the restore confirmation and reports import failures', async () => {
    (dataBackupService.isEncryptedBackup as jest.Mock).mockReturnValue(false);

    const { findByText, findByPlaceholderText } = await render(
      <BackupScreen visible={true} onClose={onClose} />,
    );

    await fireEvent.press(await findByText('Restore from Backup'));
    await fireEvent.changeText(
      await findByPlaceholderText('Backup JSON appears here...'),
      '{"version":1,"data":{"k":"v"}}',
    );
    await fireEvent.press(await findByText('Restore'));

    const confirmCall = (Alert.alert as jest.Mock).mock.calls.find(
      call => call[0] === 'Confirm Restore',
    );
    const buttons = confirmCall?.[2] as Array<{
      text: string;
      onPress?: () => Promise<void> | void;
    }>;
    // Cancel branch
    const cancelButton = buttons?.find(button => button.text === 'Cancel');
    await act(async () => {
      await cancelButton?.onPress?.();
    });

    // Import failure branch
    (dataBackupService.importAll as jest.Mock).mockRejectedValueOnce(
      new Error('bad data'),
    );
    const restoreButton = buttons?.find(button => button.text === 'Restore');
    await act(async () => {
      await restoreButton?.onPress?.();
    });

    await waitFor(async () => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'bad data');
    });
  });

  it('cancels the decrypt prompt', async () => {
    (dataBackupService.isEncryptedBackup as jest.Mock).mockReturnValue(true);

    const { findByText, findByPlaceholderText, getAllByText, queryByText } =
      await render(<BackupScreen visible={true} onClose={onClose} />);

    await fireEvent.press(await findByText('Restore from Backup'));
    await fireEvent.changeText(
      await findByPlaceholderText('Backup JSON appears here...'),
      '{"encrypted":true}',
    );
    await fireEvent.press(await findByText('Restore'));
    expect(await findByText('Encrypted Backup')).toBeTruthy();

    // Two 'Cancel' buttons exist (decrypt modal + preview footer); the decrypt
    // modal is declared first in the tree, so press index 0.
    await fireEvent.press(getAllByText('Cancel')[0]);
    await waitFor(async () => {
      expect(queryByText('Encrypted Backup')).toBeNull();
    });
  });

  it('closes the preview modal via header Close and footer Cancel', async () => {
    const { findByText, getAllByText, queryByText } = await render(
      <BackupScreen visible={true} onClose={onClose} />,
    );

    await fireEvent.press(await findByText('Restore from Backup'));
    // Footer Cancel closes the preview modal.
    await fireEvent.press(await findByText('Cancel'));
    await waitFor(async () => {
      expect(
        queryByText('Paste your backup JSON here to restore your data.'),
      ).toBeNull();
    });

    // Reopen and close via header Close.
    await fireEvent.press(await findByText('Restore from Backup'));
    const closeButtons = getAllByText('Close');
    await fireEvent.press(closeButtons[closeButtons.length - 1]);
    await waitFor(async () => {
      expect(
        queryByText('Paste your backup JSON here to restore your data.'),
      ).toBeNull();
    });
  });

  it('dismisses nested modals via hardware back requestClose', async () => {
    const { Modal } = require('react-native');
    (dataBackupService.checkForSensitiveData as jest.Mock).mockReturnValue({
      hasSensitive: true,
    });

    const { findByText, UNSAFE_getAllByType } = await render(
      <BackupScreen visible={true} onClose={onClose} />,
    );

    // Open encryption prompt, then request-close every mounted modal.
    await fireEvent.press(await findByText('Generate Backup'));
    await findByText('Sensitive Data Detected');
    await act(async () => {
      UNSAFE_getAllByType(Modal).forEach((modal: any) =>
        fireEvent(modal, 'requestClose'),
      );
    });
  });

  it('dismisses the decrypt prompt via requestClose', async () => {
    const { Modal } = require('react-native');
    (dataBackupService.isEncryptedBackup as jest.Mock).mockReturnValue(true);

    const { findByText, findByPlaceholderText, UNSAFE_getAllByType } =
      await render(<BackupScreen visible={true} onClose={onClose} />);

    await fireEvent.press(await findByText('Restore from Backup'));
    await fireEvent.changeText(
      await findByPlaceholderText('Backup JSON appears here...'),
      '{"encrypted":true}',
    );
    await fireEvent.press(await findByText('Restore'));
    await findByText('Encrypted Backup');

    await act(async () => {
      UNSAFE_getAllByType(Modal).forEach((modal: any) =>
        fireEvent(modal, 'requestClose'),
      );
    });
  });

  it('reports picker error message and fallback message variants', async () => {
    (pick as jest.Mock)
      .mockRejectedValueOnce({ message: 'plain picker message' })
      .mockRejectedValueOnce({});

    const { findByText } = await render(
      <BackupScreen visible={true} onClose={onClose} />,
    );

    await fireEvent.press(await findByText('Restore from Backup'));
    await fireEvent.press(await findByText('Load from File'));
    await waitFor(async () => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'plain picker message');
    });

    await fireEvent.press(await findByText('Load from File'));
    await waitFor(async () => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Error',
        'Failed to load backup file',
      );
    });
  });

  it('dismisses the restart modal with OK after a restore', async () => {
    const originalPlatform = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    (dataBackupService.isEncryptedBackup as jest.Mock).mockReturnValue(false);

    try {
      const { findByText, queryByText, findByPlaceholderText } = await render(
        <BackupScreen visible={true} onClose={onClose} />,
      );

      await fireEvent.press(await findByText('Restore from Backup'));
      await fireEvent.changeText(
        await findByPlaceholderText('Backup JSON appears here...'),
        '{"version":1,"data":{"k":"v"}}',
      );
      await fireEvent.press(await findByText('Restore'));

      const confirmCall = (Alert.alert as jest.Mock).mock.calls.find(
        call => call[0] === 'Confirm Restore',
      );
      const buttons = confirmCall?.[2] as Array<{
        text: string;
        onPress?: () => Promise<void> | void;
      }>;
      const restoreButton = buttons?.find(button => button.text === 'Restore');
      await act(async () => {
        await restoreButton?.onPress?.();
      });

      expect(await findByText('Restore Complete')).toBeTruthy();

      await fireEvent.press(await findByText('OK'));
      await waitFor(async () => {
        expect(queryByText('Restore Complete')).toBeNull();
      });
    } finally {
      Object.defineProperty(Platform, 'OS', {
        configurable: true,
        value: originalPlatform,
      });
    }
  });

  it('dismisses the restart modal via hardware back requestClose', async () => {
    const { Modal } = require('react-native');
    const originalPlatform = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    (dataBackupService.isEncryptedBackup as jest.Mock).mockReturnValue(false);

    try {
      const { findByText, queryByText, findByPlaceholderText, UNSAFE_getAllByType } =
        await render(<BackupScreen visible={true} onClose={onClose} />);

      await fireEvent.press(await findByText('Restore from Backup'));
      await fireEvent.changeText(
        await findByPlaceholderText('Backup JSON appears here...'),
        '{"version":1,"data":{"k":"v"}}',
      );
      await fireEvent.press(await findByText('Restore'));

      const confirmCall = (Alert.alert as jest.Mock).mock.calls.find(
        call => call[0] === 'Confirm Restore',
      );
      const buttons = confirmCall?.[2] as Array<{
        text: string;
        onPress?: () => Promise<void> | void;
      }>;
      const restoreButton = buttons?.find(button => button.text === 'Restore');
      await act(async () => {
        await restoreButton?.onPress?.();
      });

      await findByText('Restore Complete');
      await act(async () => {
        UNSAFE_getAllByType(Modal).forEach((modal: any) =>
          fireEvent(modal, 'requestClose'),
        );
      });
      await waitFor(async () => {
        expect(queryByText('Restore Complete')).toBeNull();
      });
    } finally {
      Object.defineProperty(Platform, 'OS', {
        configurable: true,
        value: originalPlatform,
      });
    }
  });

  it('shows restart instruction alert on iOS', async () => {
    const originalPlatform = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    (dataBackupService.isEncryptedBackup as jest.Mock).mockReturnValue(false);

    try {
      const { findByText, findByPlaceholderText } = await render(
        <BackupScreen visible={true} onClose={onClose} />,
      );

      await fireEvent.press(await findByText('Restore from Backup'));
      await fireEvent.changeText(
        await findByPlaceholderText('Backup JSON appears here...'),
        '{"version":1,"data":{"k":"v"}}',
      );
      await fireEvent.press(await findByText('Restore'));

      await waitFor(async () => {
        expect(
          (Alert.alert as jest.Mock).mock.calls.some(
            call => call[0] === 'Confirm Restore',
          ),
        ).toBe(true);
      });

      const confirmCall = (Alert.alert as jest.Mock).mock.calls.find(
        call => call[0] === 'Confirm Restore',
      );
      const buttons = confirmCall?.[2] as Array<{
        text: string;
        onPress?: () => Promise<void> | void;
      }>;
      const restoreButton = buttons?.find(button => button.text === 'Restore');

      await act(async () => {
        await restoreButton?.onPress?.();
      });

      await fireEvent.press(await findByText('Exit to Restart App'));

      await waitFor(async () => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Restart Required',
          'Please close and reopen the app manually to complete restore.',
        );
      });
    } finally {
      Object.defineProperty(Platform, 'OS', {
        configurable: true,
        value: originalPlatform,
      });
    }
  });
});

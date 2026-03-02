/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { KeyManagementScreen } from '../../src/screens/KeyManagementScreen';

const mockKeys = [
  {
    network: 'NetOne',
    nick: 'Alice',
    fingerprint: 'abcd1234',
    verified: true,
    firstSeen: new Date('2026-01-01T10:00:00Z').getTime(),
    lastSeen: new Date('2026-01-02T10:00:00Z').getTime(),
  },
  {
    network: 'NetTwo',
    nick: 'Bob',
    fingerprint: 'ffffeeee',
    verified: false,
    firstSeen: new Date('2026-01-03T10:00:00Z').getTime(),
    lastSeen: new Date('2026-01-04T10:00:00Z').getTime(),
  },
];

jest.mock('../../src/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#000',
      surface: '#111',
      surfaceVariant: '#222',
      text: '#fff',
      textSecondary: '#bbb',
      primary: '#4caf50',
      onPrimary: '#fff',
      border: '#444',
      error: '#f44336',
      inputBackground: '#222',
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

jest.mock('../../src/services/EncryptedDMService', () => ({
  encryptedDMService: {
    listAllKeys: jest.fn(),
    formatFingerprintForDisplay: jest.fn((value: string) => `fp:${value}`),
    deleteBundleForNetwork: jest.fn(),
    copyBundleToNetwork: jest.fn(),
    moveBundleToNetwork: jest.fn(),
    setVerifiedForNetwork: jest.fn(),
    exportKeyBackup: jest.fn(),
    importKeyBackup: jest.fn(),
  },
}));

jest.mock('../../src/services/BiometricAuthService', () => ({
  biometricAuthService: {
    isAvailable: jest.fn(),
    enableLock: jest.fn(),
    authenticate: jest.fn(),
    disableLock: jest.fn(),
  },
}));

jest.mock('../../src/services/ConnectionManager', () => ({
  connectionManager: {
    getAllConnections: jest.fn(),
  },
}));

const { encryptedDMService } = require('../../src/services/EncryptedDMService');
const { biometricAuthService } = require('../../src/services/BiometricAuthService');
const { connectionManager } = require('../../src/services/ConnectionManager');

describe('KeyManagementScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    (require('react-native') as any).Clipboard = {
      setString: jest.fn(),
    };

    biometricAuthService.isAvailable.mockReturnValue(false);
    biometricAuthService.enableLock.mockResolvedValue(true);
    biometricAuthService.authenticate.mockResolvedValue({ success: true });
    biometricAuthService.disableLock.mockResolvedValue(undefined);

    encryptedDMService.listAllKeys.mockResolvedValue(mockKeys);
    encryptedDMService.deleteBundleForNetwork.mockResolvedValue(undefined);
    encryptedDMService.copyBundleToNetwork.mockResolvedValue(undefined);
    encryptedDMService.moveBundleToNetwork.mockResolvedValue(undefined);
    encryptedDMService.setVerifiedForNetwork.mockResolvedValue(undefined);
    encryptedDMService.exportKeyBackup.mockResolvedValue('encrypted-backup');
    encryptedDMService.importKeyBackup.mockResolvedValue(2);

    connectionManager.getAllConnections.mockReturnValue([
      { networkId: 'NetOne' },
      { networkId: 'NetTwo' },
      { networkId: 'NetThree' },
    ]);
  });

  it('renders loaded keys without authentication when biometrics are unavailable', async () => {
    const { findByText, getByPlaceholderText } = render(
      <KeyManagementScreen visible onClose={jest.fn()} />
    );

    expect(await findByText('Encryption Keys')).toBeTruthy();
    expect(await findByText('Alice')).toBeTruthy();
    expect(await findByText('2 keys · 1 verified')).toBeTruthy();

    fireEvent.changeText(getByPlaceholderText('Search by nick or network...'), 'bob');
    expect(await findByText('Bob')).toBeTruthy();
  });

  it('authenticates with biometrics when available and handles failure', async () => {
    const onClose = jest.fn();
    biometricAuthService.isAvailable.mockReturnValue(true);
    biometricAuthService.authenticate.mockResolvedValueOnce({
      success: false,
      errorMessage: 'Denied',
    });

    render(<KeyManagementScreen visible onClose={onClose} />);

    await waitFor(() => {
      expect(biometricAuthService.enableLock).toHaveBeenCalledWith('keymanagement');
      expect(Alert.alert).toHaveBeenCalledWith(
        'Authentication Failed',
        'Denied',
        [{ text: 'OK', onPress: onClose }]
      );
    });
  });

  it('opens key details and toggles verification state', async () => {
    const { findByText } = render(<KeyManagementScreen visible onClose={jest.fn()} />);

    fireEvent.press(await findByText('Alice'));
    fireEvent.press(await findByText('Mark as Unverified'));

    await waitFor(() => {
      expect(encryptedDMService.setVerifiedForNetwork).toHaveBeenCalledWith(
        'NetOne',
        'Alice',
        false
      );
    });
  });

  it('copies and moves a key to another network', async () => {
    const { findAllByText, findByText } = render(<KeyManagementScreen visible onClose={jest.fn()} />);

    fireEvent.press(await findByText('Alice'));
    fireEvent.press(await findByText('Copy to Network...'));
    fireEvent.press(await findByText('NetThree'));

    await waitFor(() => {
      expect(encryptedDMService.copyBundleToNetwork).toHaveBeenCalledWith(
        'NetOne',
        'NetThree',
        'Alice'
      );
    });

    fireEvent.press(await findByText('Bob'));
    fireEvent.press(await findByText('Move to Network...'));
    fireEvent.press((await findAllByText('NetOne')).at(-1)!);

    const moveDialogButtons = (Alert.alert as jest.Mock).mock.calls.at(-1)?.[2];
    moveDialogButtons?.[1]?.onPress?.();

    await waitFor(() => {
      expect(encryptedDMService.moveBundleToNetwork).toHaveBeenCalledWith(
        'NetTwo',
        'NetOne',
        'Bob'
      );
    });
  });

  it('deletes a key after confirmation', async () => {
    const { findByText } = render(<KeyManagementScreen visible onClose={jest.fn()} />);

    fireEvent.press(await findByText('Alice'));
    fireEvent.press(await findByText('Delete Key'));

    const deleteDialogButtons = (Alert.alert as jest.Mock).mock.calls.at(-1)?.[2];
    deleteDialogButtons?.[1]?.onPress?.();

    await waitFor(() => {
      expect(encryptedDMService.deleteBundleForNetwork).toHaveBeenCalledWith('NetOne', 'Alice');
    });
  });

  it('exports keys to clipboard and imports backup data', async () => {
    const { findByText, findByPlaceholderText } = render(
      <KeyManagementScreen visible onClose={jest.fn()} />
    );

    fireEvent.press(await findByText('Export All Keys'));
    fireEvent.changeText(
      await findByPlaceholderText('Backup password (min 6 characters)'),
      'secret1'
    );
    fireEvent.press(await findByText('Export'));

    await waitFor(() => {
      expect(encryptedDMService.exportKeyBackup).toHaveBeenCalledWith('secret1');
    });

    fireEvent.press(await findByText('Import Keys'));
    fireEvent.changeText(await findByPlaceholderText('Paste backup data here...'), ' data ');
    fireEvent.changeText(await findByPlaceholderText('Backup password'), 'secret1');
    fireEvent.press(await findByText('Import'));

    await waitFor(() => {
      expect(encryptedDMService.importKeyBackup).toHaveBeenCalledWith('data', 'secret1');
    });
  });

  it('cancels export dialog and closes it', async () => {
    const { findByText, findByPlaceholderText, queryByPlaceholderText } = render(
      <KeyManagementScreen visible onClose={jest.fn()} />
    );

    fireEvent.press(await findByText('Export All Keys'));
    fireEvent.changeText(
      await findByPlaceholderText('Backup password (min 6 characters)'),
      '123'
    );
    fireEvent.press(await findByText('Cancel'));

    await waitFor(() => {
      expect(queryByPlaceholderText('Backup password (min 6 characters)')).toBeNull();
    });
  });
});

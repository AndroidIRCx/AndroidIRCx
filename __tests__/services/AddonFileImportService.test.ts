/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import {
  AddonImportCancelledError,
  AddonImportFileError,
  pickAddonPackageBytes,
} from '../../src/services/scripting/AddonFileImportService';
import { keepLocalCopy, pick } from '@react-native-documents/picker';
import RNFS from 'react-native-fs';

const mockPick = pick as jest.MockedFunction<typeof pick>;
const mockKeepLocalCopy = keepLocalCopy as jest.MockedFunction<
  typeof keepLocalCopy
>;
const mockReadFile = RNFS.readFile as jest.MockedFunction<typeof RNFS.readFile>;

describe('AddonFileImportService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPick.mockResolvedValue([
      {
        uri: 'content://addon',
        name: 'safe.ircx-addon',
        size: 3,
      },
    ]);
    mockKeepLocalCopy.mockResolvedValue([
      { status: 'success', localUri: 'file:///cache/safe.ircx-addon' },
    ]);
    mockReadFile.mockResolvedValue('AQID');
  });

  it('copies the selected package and returns decoded bytes', async () => {
    await expect(pickAddonPackageBytes()).resolves.toEqual(
      new Uint8Array([1, 2, 3]),
    );
    expect(mockReadFile).toHaveBeenCalledWith(
      '/cache/safe.ircx-addon',
      'base64',
    );
  });

  it.each(['addon.zip', '../bad.ircx-addon', 'bad/one.ircx-addon'])(
    'rejects an unsafe or wrong filename: %s',
    async name => {
      mockPick.mockResolvedValue([{ uri: 'content://addon', name, size: 3 }]);
      await expect(pickAddonPackageBytes()).rejects.toBeInstanceOf(
        AddonImportFileError,
      );
      expect(mockKeepLocalCopy).not.toHaveBeenCalled();
    },
  );

  it('rejects oversized metadata before copying', async () => {
    mockPick.mockResolvedValue([
      { uri: 'content://addon', name: 'big.ircx-addon', size: 6 * 1024 * 1024 },
    ]);
    await expect(pickAddonPackageBytes()).rejects.toThrow('too large');
    expect(mockKeepLocalCopy).not.toHaveBeenCalled();
  });

  it('fails closed on copy and base64 errors', async () => {
    mockKeepLocalCopy.mockResolvedValue([
      { status: 'error', copyError: 'private provider detail' },
    ]);
    await expect(pickAddonPackageBytes()).rejects.toThrow(
      'Could not copy the selected package.',
    );

    mockKeepLocalCopy.mockResolvedValue([
      { status: 'success', localUri: 'file:///cache/safe.ircx-addon' },
    ]);
    mockReadFile.mockResolvedValue('not-base64');
    await expect(pickAddonPackageBytes()).rejects.toThrow(
      'Selected package could not be read.',
    );
  });

  it('distinguishes picker cancellation from failures', async () => {
    mockPick.mockRejectedValue({ code: 'OPERATION_CANCELED' });
    await expect(pickAddonPackageBytes()).rejects.toBeInstanceOf(
      AddonImportCancelledError,
    );
  });
});

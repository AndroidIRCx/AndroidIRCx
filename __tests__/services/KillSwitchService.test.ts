/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const mockDisconnectAll = jest.fn();
const mockClearAll = jest.fn();
const mockGetConnection = jest.fn();

jest.mock('../../src/services/ConnectionManager', () => ({
  connectionManager: {
    disconnectAll: (...args: any[]) => mockDisconnectAll(...args),
    clearAll: (...args: any[]) => mockClearAll(...args),
    getConnection: (...args: any[]) => mockGetConnection(...args),
  },
}));

const mockGetAllSecretKeys = jest.fn(async () => ['k1', 'k2']);
const mockRemoveSecret = jest.fn(async () => undefined);
jest.mock('../../src/services/SecureStorageService', () => ({
  secureStorageService: {
    getAllSecretKeys: (...args: any[]) => mockGetAllSecretKeys(...args),
    removeSecret: (...args: any[]) => mockRemoveSecret(...args),
  },
}));

const mockGetSetting = jest.fn(async () => 'bye');
jest.mock('../../src/services/SettingsService', () => ({
  settingsService: {
    getSetting: (...args: any[]) => mockGetSetting(...args),
  },
  DEFAULT_PART_MESSAGE: 'part',
}));

const mockSetTabs = jest.fn();
jest.mock('../../src/stores/tabStore', () => ({
  useTabStore: {
    getState: () => ({
      tabs: [
        { id: 'c1', type: 'channel', name: '#a', networkId: 'net1' },
        { id: 'q1', type: 'query', name: 'nick', networkId: 'net1' },
        { id: 's1', type: 'server', name: 'server', networkId: 'net1' },
      ],
      setTabs: (...args: any[]) => mockSetTabs(...args),
    }),
  },
}));

import RNFS from 'react-native-fs';
import { killSwitchService } from '../../src/services/KillSwitchService';

describe('KillSwitchService', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();

    (RNFS as any).exists = jest.fn(async () => true);
    (RNFS as any).readDir = jest.fn(async () => ([
      {
        name: 'AndroidIRCX-log.txt',
        path: '/mock/documents/AndroidIRCX-log.txt',
        isFile: () => true,
        isDirectory: () => false,
      },
    ]));
    (RNFS as any).unlink = jest.fn(async () => undefined);

    mockGetConnection.mockReturnValue({
      ircService: {
        isConnected: true,
        partChannel: jest.fn(),
      },
    });
  });

  it('activates kill switch and marks deletion phases', async () => {
    await AsyncStorage.setItem('@AndroidIRCX:test', '1');

    const result = await killSwitchService.activateKillSwitch();

    expect(result.deletedItems.connections).toBe(true);
    expect(result.deletedItems.secureStorage).toBe(true);
    expect(result.deletedItems.asyncStorage).toBe(true);
    expect(result.deletedItems.fileSystem).toBe(true);
    expect(mockDisconnectAll).toHaveBeenCalled();
    expect(mockClearAll).toHaveBeenCalled();
    expect(mockSetTabs).toHaveBeenCalled();
  });

  it('confirmAndActivate bypasses warnings when disabled', async () => {
    const spy = jest.spyOn(killSwitchService, 'activateKillSwitch').mockResolvedValueOnce({
      success: true,
      deletedItems: {
        asyncStorage: true,
        secureStorage: true,
        fileSystem: true,
        connections: true,
        logs: true,
      },
      errors: [],
    });

    const ok = await killSwitchService.confirmAndActivate(false);
    expect(ok).toBe(true);
    expect(spy).toHaveBeenCalled();
  });
});

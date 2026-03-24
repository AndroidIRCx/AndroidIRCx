/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, BackHandler, Platform } from 'react-native';

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
import { logger } from '../../src/services/Logger';

describe('KillSwitchService', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    (Platform as any).OS = 'ios';

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
        getConnectionStatus: () => true,
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

  it('records channel parting failures but continues', async () => {
    const partChannel = jest.fn(() => {
      throw new Error('part fail');
    });
    mockGetConnection.mockReturnValue({
      ircService: {
        getConnectionStatus: () => true,
        partChannel,
      },
    });

    const result = await killSwitchService.activateKillSwitch();

    expect(result.success).toBe(true);
    expect(partChannel).toHaveBeenCalled();
    expect(result.errors).toEqual([]);
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

  it('handles async storage and filesystem errors and marks failure', async () => {
    (RNFS as any).readDir = jest.fn(async () => {
      throw new Error('fs fail');
    });
    jest.spyOn(AsyncStorage, 'getAllKeys').mockRejectedValueOnce(new Error('storage fail'));

    const result = await killSwitchService.activateKillSwitch();

    expect(result.success).toBe(false);
    expect(result.errors.join(' ')).toContain('AsyncStorage');
  });

  it('records secure storage cleanup errors', async () => {
    mockGetAllSecretKeys.mockRejectedValueOnce(new Error('secure fail'));

    const result = await killSwitchService.activateKillSwitch();

    expect(result.errors.join(' ')).toContain('Secure storage');
    expect(result.deletedItems.secureStorage).toBe(false);
  });

  it('deletes directory entries in cache path', async () => {
    (RNFS as any).readDir = jest.fn(async () => ([
      {
        name: 'nested',
        path: '/mock/cache/nested',
        isFile: () => false,
        isDirectory: () => true,
      },
    ]));

    await killSwitchService.activateKillSwitch();

    expect((RNFS as any).unlink).toHaveBeenCalledWith('/mock/cache/nested');
  });

  it('records file system and log stage errors when stage setup throws', async () => {
    const warnSpy = jest.spyOn(logger, 'warn');
    let throwOnFs = true;
    let throwOnLogs = true;
    warnSpy.mockImplementation((scope: string, message: string) => {
      if (message.includes('[5/6]') && throwOnFs) {
        throwOnFs = false;
        throw new Error('fs stage boom');
      }
      if (message.includes('[6/6]') && throwOnLogs) {
        throwOnLogs = false;
        throw new Error('log stage boom');
      }
      return undefined as any;
    });

    const result = await killSwitchService.activateKillSwitch();

    expect(result.success).toBe(false);
    expect(result.errors.join(' | ')).toContain('File system');
    expect(result.errors.join(' | ')).toContain('Logs');
    warnSpy.mockRestore();
  });

  it('triggers android app exit timeout after successful activation', async () => {
    (Platform as any).OS = 'android';
    const exitSpy = jest.fn();
    (BackHandler as any).exitApp = exitSpy;
    const timeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation(((cb: any) => {
      cb();
      return 0 as any;
    }) as any);

    const result = await killSwitchService.activateKillSwitch();
    expect(typeof result.success).toBe('boolean');
    expect(exitSpy).toHaveBeenCalled();
    timeoutSpy.mockRestore();
  });

  it('returns failed result on critical top-level errors', async () => {
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementationOnce(() => {
      throw new Error('critical fail');
    });

    const result = await killSwitchService.activateKillSwitch();

    expect(result.success).toBe(false);
    expect(result.errors.join(' ')).toContain('Critical error');
    warnSpy.mockRestore();
  });

  it('continues when tab loading fails and records connection-stage error', async () => {
    const tabStore = require('../../src/stores/tabStore');
    const originalGetState = tabStore.useTabStore.getState;
    tabStore.useTabStore.getState = () => {
      throw new Error('boom');
    };

    const result = await killSwitchService.activateKillSwitch();

    expect(result.success).toBe(true);
    expect(result.errors.join(' ')).toContain('Connections');
    tabStore.useTabStore.getState = originalGetState;
  });

  it('confirmAndActivate resolves false when first dialog is cancelled', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(((_title: any, _msg: any, buttons: any[]) => {
      buttons[0].onPress();
    }) as any);

    const ok = await killSwitchService.confirmAndActivate(true);
    expect(ok).toBe(false);
    alertSpy.mockRestore();
  });

  it('confirmAndActivate supports final cancel and final confirm flow', async () => {
    const activateSpy = jest.spyOn(killSwitchService, 'activateKillSwitch').mockResolvedValue({
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

    let callIndex = 0;
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(((_title: any, _msg: any, buttons?: any[]) => {
      callIndex += 1;
      const list = buttons || [];
      if (callIndex === 1) {
        list[1]?.onPress?.();
        return;
      }
      if (callIndex === 2) {
        list[1]?.onPress?.();
        return;
      }
      list[0]?.onPress?.();
    }) as any);

    const ok = await killSwitchService.confirmAndActivate(true);
    expect(ok).toBe(true);
    expect(activateSpy).toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('confirmAndActivate resolves false when final confirmation is cancelled', async () => {
    let callIndex = 0;
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(((_title: any, _msg: any, buttons?: any[]) => {
      callIndex += 1;
      const list = buttons || [];
      if (callIndex === 1) {
        list[1]?.onPress?.();
        return;
      }
      list[0]?.onPress?.();
    }) as any);

    const ok = await killSwitchService.confirmAndActivate(true);
    expect(ok).toBe(false);
    alertSpy.mockRestore();
  });

});

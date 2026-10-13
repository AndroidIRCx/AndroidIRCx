/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * SecureStorageService with the Keychain available: hasSecret must answer
 * from its presence cache so hot paths do not hit the Keychain per message.
 */

const mockKeychainStore = new Map<string, string>();
const mockGetInternetCredentials = jest.fn(async (key: string) =>
  mockKeychainStore.has(key)
    ? { username: 'androidircx', password: mockKeychainStore.get(key) }
    : false,
);
const mockResetInternetCredentials = jest.fn(async (key: string) => {
  mockKeychainStore.delete(key);
});

jest.mock('react-native-keychain', () => ({
  setInternetCredentials: jest.fn(
    async (key: string, _user: string, value: string) => {
      mockKeychainStore.set(key, value);
    },
  ),
  getInternetCredentials: (key: string) => mockGetInternetCredentials(key),
  resetInternetCredentials: (key: string) => mockResetInternetCredentials(key),
}));

import { secureStorageService } from '../../src/services/SecureStorageService';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('SecureStorageService presence cache (Keychain)', () => {
  beforeEach(() => {
    (AsyncStorage as any).__reset();
    mockKeychainStore.clear();
    mockGetInternetCredentials.mockClear();
    mockResetInternetCredentials.mockClear();
  });

  it('reads the Keychain once per key, then answers from the cache', async () => {
    mockKeychainStore.set('absent-then-cached', 'x');
    expect(await secureStorageService.hasSecret('absent-then-cached')).toBe(
      true,
    );
    expect(await secureStorageService.hasSecret('absent-then-cached')).toBe(
      true,
    );
    expect(await secureStorageService.hasSecret('never-stored')).toBe(false);
    expect(await secureStorageService.hasSecret('never-stored')).toBe(false);
    expect(mockGetInternetCredentials).toHaveBeenCalledTimes(2);
  });

  it('stays correct across set and remove without reading again', async () => {
    expect(await secureStorageService.hasSecret('k')).toBe(false);
    await secureStorageService.setSecret('k', 'secret');
    expect(await secureStorageService.hasSecret('k')).toBe(true);
    await secureStorageService.removeSecret('k');
    expect(await secureStorageService.hasSecret('k')).toBe(false);
    expect(mockGetInternetCredentials).toHaveBeenCalledTimes(1);
  });

  it('forgets presence when removing fails, so the next check reads again', async () => {
    await secureStorageService.setSecret('stuck', 'secret');
    mockResetInternetCredentials.mockRejectedValueOnce(new Error('locked'));
    await secureStorageService.removeSecret('stuck');
    expect(await secureStorageService.hasSecret('stuck')).toBe(true);
    expect(mockGetInternetCredentials).toHaveBeenCalledTimes(1);
  });
});

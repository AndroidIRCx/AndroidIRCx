/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

describe('DataPrivacyService', () => {
  const mockStorage = new Map<string, string>();

  const mockSettingsService = {
    loadNetworks: jest.fn(async () => [{ id: 'net1' }]),
    deleteNetwork: jest.fn(async () => undefined),
  };

  const mockMessageHistoryService = {
    deleteNetworkMessages: jest.fn(async () => undefined),
    getMessages: jest.fn(async () => [{ id: 'm1' }]),
  };

  const mockIdentityProfilesService = {
    list: jest.fn(async () => [{ id: 'p1' }]),
    remove: jest.fn(async () => undefined),
  };

  const mockConsentService = {
    getConsentStatusText: jest.fn(() => 'Accepted'),
    resetConsent: jest.fn(async () => undefined),
  };

  const mockSetCrashlyticsCollectionEnabled = jest.fn(async () => undefined);
  const mockCrashlyticsInstance = { id: 'crash' };
  const mockShareOpen = jest.fn(async () => undefined);

  const setupModule = () => {
    jest.resetModules();

    jest.doMock('@react-native-async-storage/async-storage', () => ({
      __esModule: true,
      default: {
        getItem: jest.fn(async (key: string) =>
          mockStorage.has(key) ? mockStorage.get(key)! : null,
        ),
        setItem: jest.fn(async (key: string, value: string) => {
          mockStorage.set(key, value);
        }),
        getAllKeys: jest.fn(async () => Array.from(mockStorage.keys())),
        multiRemove: jest.fn(async (keys: string[]) => {
          keys.forEach(k => mockStorage.delete(k));
        }),
        removeMany: jest.fn(async (keys: string[]) => {
          keys.forEach(k => mockStorage.delete(k));
        }),
      },
    }));

    jest.doMock('react-native-fs', () => ({
      DocumentDirectoryPath: '/docs',
      CachesDirectoryPath: '/cache',
      writeFile: jest.fn(async () => undefined),
      exists: jest.fn(async () => true),
      readDir: jest.fn(async () => [{ path: '/cache/a.tmp', name: 'a.tmp' }]),
      unlink: jest.fn(async () => undefined),
    }));

    jest.doMock('react-native-share', () => ({
      __esModule: true,
      default: {
        open: (...args: any[]) => mockShareOpen(...args),
      },
    }));

    jest.doMock('@react-native-firebase/app', () => ({
      getApp: jest.fn(() => ({ name: 'app' })),
    }));

    jest.doMock('@react-native-firebase/crashlytics', () => ({
      getCrashlytics: jest.fn(() => mockCrashlyticsInstance),
      setCrashlyticsCollectionEnabled: (...args: any[]) =>
        mockSetCrashlyticsCollectionEnabled(...args),
    }));

    jest.doMock('../../src/services/SettingsService', () => ({
      settingsService: mockSettingsService,
    }));
    jest.doMock('../../src/services/MessageHistoryService', () => ({
      messageHistoryService: mockMessageHistoryService,
    }));
    jest.doMock('../../src/services/IdentityProfilesService', () => ({
      identityProfilesService: mockIdentityProfilesService,
    }));
    jest.doMock('../../src/services/ConsentService', () => ({
      consentService: mockConsentService,
    }));

    const serviceModule = require('../../src/services/DataPrivacyService');
    const rnfs = require('react-native-fs');

    return {
      dataPrivacyService: serviceModule.dataPrivacyService,
      RNFS: rnfs,
    };
  };

  beforeEach(() => {
    mockStorage.clear();
    jest.clearAllMocks();

    mockSettingsService.loadNetworks.mockResolvedValue([{ id: 'net1' }]);
    mockSettingsService.deleteNetwork.mockResolvedValue(undefined);
    mockMessageHistoryService.deleteNetworkMessages.mockResolvedValue(
      undefined,
    );
    mockMessageHistoryService.getMessages.mockResolvedValue([{ id: 'm1' }]);
    mockIdentityProfilesService.list.mockResolvedValue([{ id: 'p1' }]);
    mockIdentityProfilesService.remove.mockResolvedValue(undefined);
    mockConsentService.getConsentStatusText.mockReturnValue('Accepted');
    mockConsentService.resetConsent.mockResolvedValue(undefined);

    mockStorage.set('@AndroidIRCX:test', JSON.stringify({ a: 1 }));
    mockStorage.set('FIRST_RUN_COMPLETED', 'true');
  });

  it('exports user data to file', async () => {
    const { dataPrivacyService, RNFS } = setupModule();

    const result = await dataPrivacyService.exportUserData();
    expect(result.success).toBe(true);
    expect(result.filePath).toContain('/docs/AndroidIRCX_Export_');
    expect(RNFS.writeFile).toHaveBeenCalled();
  });

  it('shares exported data and handles user cancellation', async () => {
    const { dataPrivacyService } = setupModule();

    const ok = await dataPrivacyService.shareExportedData('/docs/export.json');
    expect(ok).toBe(true);
    expect(mockShareOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/docs/export.json',
        type: 'application/json',
      }),
    );

    mockShareOpen.mockRejectedValueOnce(new Error('User did not share'));
    const cancelled =
      await dataPrivacyService.shareExportedData('/docs/export.json');
    expect(cancelled).toBe(false);
  });

  it('deletes all user data and preserves essential key', async () => {
    const { dataPrivacyService, RNFS } = setupModule();

    mockSettingsService.loadNetworks.mockResolvedValue([
      { id: 'net1' },
      { id: 'net2' },
    ]);
    mockIdentityProfilesService.list.mockResolvedValue([
      { id: 'p1' },
      { id: 'p2' },
    ]);
    RNFS.readDir.mockResolvedValue([
      { path: '/cache/a.tmp', name: 'a.tmp' },
      { path: '/cache/b.tmp', name: 'b.tmp' },
    ]);

    const result = await dataPrivacyService.deleteAllUserData();

    expect(result.deletedItems.messageHistory).toBe(true);
    expect(result.deletedItems.networks).toBe(true);
    expect(result.deletedItems.identityProfiles).toBe(true);
    expect(result.deletedItems.settings).toBe(true);
    expect(result.deletedItems.cache).toBe(true);
    expect(mockSettingsService.deleteNetwork).toHaveBeenCalledTimes(2);
    expect(mockIdentityProfilesService.remove).toHaveBeenCalledTimes(2);
    expect(RNFS.unlink).toHaveBeenCalledTimes(2);
  });

  it('sets and reads crashlytics opt-out', async () => {
    const { dataPrivacyService } = setupModule();

    await dataPrivacyService.setCrashlyticsOptOut(true);
    expect(mockSetCrashlyticsCollectionEnabled).toHaveBeenCalledWith(
      mockCrashlyticsInstance,
      false,
    );
    expect(mockStorage.get('@AndroidIRCX:crashlytics_opt_out')).toBe('true');

    const optedOut = await dataPrivacyService.getCrashlyticsOptOut();
    expect(optedOut).toBe(true);
  });

  it('builds data collection summary and storage size', async () => {
    const { dataPrivacyService } = setupModule();

    mockStorage.set('@AndroidIRCX:a', '12345');
    mockStorage.set('@AndroidIRCX:b', '12345');

    const summary = await dataPrivacyService.getDataCollectionSummary();

    expect(summary.networksCount).toBe(1);
    expect(summary.identityProfilesCount).toBe(1);
    expect(summary.crashlyticsEnabled).toBe(true);
    expect(summary.storageSize).toContain('KB');
    expect(summary.consentStatus).toBe('Accepted');
  });
});

/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ZNC_PRODUCT_ID, ZNC_STORAGE_KEYS } from '../../src/types/znc';

const mockGetSetting = jest.fn(async () => false);

jest.mock('../../src/services/SettingsService', () => ({
  settingsService: {
    getSetting: (...args: any[]) => mockGetSetting(...args),
  },
}));

const mockSecure = {
  setSecret: jest.fn(async () => undefined),
  getSecret: jest.fn(async () => null),
  removeSecret: jest.fn(async () => undefined),
};

jest.mock('../../src/services/SecureStorageService', () => ({
  __esModule: true,
  secureStorageService: mockSecure,
}));

const { subscriptionService } = require('../../src/services/SubscriptionService');

describe('SubscriptionService', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    (subscriptionService as any).accounts = [];
    (subscriptionService as any).initialized = false;
    (global as any).fetch = jest.fn();
  });

  it('initializes and notifies listeners immediately', async () => {
    await AsyncStorage.setItem(ZNC_STORAGE_KEYS.ACCOUNTS, JSON.stringify([
      {
        id: 'a1', zncUsername: 'user1', zncPassword: 'pw1', status: 'active', provisioningStatus: 'ready',
        expiresAt: null, purchaseToken: 'tok1', subscriptionId: ZNC_PRODUCT_ID,
        assignedNetworkId: null, assignedServerId: null, createdAt: new Date().toISOString(), lastRefreshedAt: null,
      },
    ]));

    await subscriptionService.initialize();
    const listener = jest.fn();
    const off = subscriptionService.addListener(listener);

    expect(listener).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ id: 'a1' })]));
    off();
  });

  it('registers subscription, infers ready status, and supports assignment', async () => {
    (global as any).fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'acc-1',
        status: 'active',
        expires_at: null,
        znc_username: 'nick1',
        znc_password: 'secret',
        znc_status: null,
      }),
    });

    const account = await subscriptionService.registerZncSubscription({
      purchaseToken: 'ptok',
      subscriptionId: ZNC_PRODUCT_ID,
      zncUsername: 'nick1',
    });

    expect(account.id).toBe('acc-1');
    expect(account.provisioningStatus).toBe('ready');

    await subscriptionService.assignToNetwork('acc-1', 'net1', 'srv1');
    expect(subscriptionService.getAccount('acc-1')?.assignedNetworkId).toBe('net1');

    await subscriptionService.unassignFromNetwork('acc-1');
    expect(subscriptionService.getAccount('acc-1')?.assignedNetworkId).toBeNull();
  });

  it('refreshes status by expiration and checks username availability', async () => {
    (subscriptionService as any).accounts = [
      {
        id: 'a2', zncUsername: 'user2', zncPassword: 'pw2', status: 'active', provisioningStatus: 'ready',
        expiresAt: '2000-01-01T00:00:00.000Z', purchaseToken: 'tok2', subscriptionId: ZNC_PRODUCT_ID,
        assignedNetworkId: null, assignedServerId: null, createdAt: new Date().toISOString(), lastRefreshedAt: null,
      },
    ];

    const refreshed = await subscriptionService.refreshAccountStatus('a2');
    expect(refreshed?.status).toBe('expired');

    (global as any).fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ available: false }) });
    await expect(subscriptionService.checkUsernameAvailability('taken')).resolves.toBe(false);

    (global as any).fetch.mockRejectedValueOnce(new Error('net down'));
    await expect(subscriptionService.checkUsernameAvailability('fallback')).resolves.toBe(true);
  });

  it('restores purchases through batch response and generates server config', async () => {
    (global as any).fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        accounts: [
          {
            id: 'acc-r1',
            status: 'active',
            expires_at: null,
            znc_username: 'restored',
            znc_password: 'rpw',
            znc_status: 'ready',
          },
        ],
      }),
    });

    const result = await subscriptionService.restorePurchases(['token-r']);
    expect(result.restored).toBe(1);

    const account = subscriptionService.getAccount('acc-r1');
    expect(account).toBeDefined();

    const cfg = subscriptionService.generateServerConfig(account!, 'override');
    expect(cfg.password).toBe('restored:override');
    expect(cfg.connectionType).toBe('znc');
  });

  it('deletes local account and clears all data', async () => {
    (subscriptionService as any).accounts = [
      {
        id: 'a3', zncUsername: 'u3', zncPassword: 'p3', status: 'active', provisioningStatus: 'ready',
        expiresAt: null, purchaseToken: 'tok3', subscriptionId: ZNC_PRODUCT_ID,
        assignedNetworkId: null, assignedServerId: null, createdAt: new Date().toISOString(), lastRefreshedAt: null,
      },
    ];

    await subscriptionService.deleteLocalAccount('a3');
    expect(subscriptionService.getAccount('a3')).toBeUndefined();
    expect(mockSecure.removeSecret).toHaveBeenCalled();

    await subscriptionService.clearAllData();
    expect(subscriptionService.getAccounts()).toHaveLength(0);
  });
});

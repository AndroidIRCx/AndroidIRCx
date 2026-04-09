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

const {
  subscriptionService,
} = require('../../src/services/SubscriptionService');

describe('SubscriptionService', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    (subscriptionService as any).accounts = [];
    (subscriptionService as any).initialized = false;
    (global as any).fetch = jest.fn();
  });

  it('initializes and notifies listeners immediately', async () => {
    await AsyncStorage.setItem(
      ZNC_STORAGE_KEYS.ACCOUNTS,
      JSON.stringify([
        {
          id: 'a1',
          zncUsername: 'user1',
          zncPassword: 'pw1',
          status: 'active',
          provisioningStatus: 'ready',
          expiresAt: null,
          purchaseToken: 'tok1',
          subscriptionId: ZNC_PRODUCT_ID,
          assignedNetworkId: null,
          assignedServerId: null,
          createdAt: new Date().toISOString(),
          lastRefreshedAt: null,
        },
      ]),
    );

    await subscriptionService.initialize();
    const listener = jest.fn();
    const off = subscriptionService.addListener(listener);

    expect(listener).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'a1' })]),
    );
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
    expect(subscriptionService.getAccount('acc-1')?.assignedNetworkId).toBe(
      'net1',
    );

    await subscriptionService.unassignFromNetwork('acc-1');
    expect(
      subscriptionService.getAccount('acc-1')?.assignedNetworkId,
    ).toBeNull();
  });

  it('refreshes status by expiration and checks username availability', async () => {
    (subscriptionService as any).accounts = [
      {
        id: 'a2',
        zncUsername: 'user2',
        zncPassword: 'pw2',
        status: 'active',
        provisioningStatus: 'ready',
        expiresAt: '2000-01-01T00:00:00.000Z',
        purchaseToken: 'tok2',
        subscriptionId: ZNC_PRODUCT_ID,
        assignedNetworkId: null,
        assignedServerId: null,
        createdAt: new Date().toISOString(),
        lastRefreshedAt: null,
      },
    ];

    const refreshed = await subscriptionService.refreshAccountStatus('a2');
    expect(refreshed?.status).toBe('expired');

    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ available: false }),
    });
    await expect(
      subscriptionService.checkUsernameAvailability('taken'),
    ).resolves.toBe(false);

    (global as any).fetch.mockRejectedValueOnce(new Error('net down'));
    await expect(
      subscriptionService.checkUsernameAvailability('fallback'),
    ).resolves.toBe(true);
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
        id: 'a3',
        zncUsername: 'u3',
        zncPassword: 'p3',
        status: 'active',
        provisioningStatus: 'ready',
        expiresAt: null,
        purchaseToken: 'tok3',
        subscriptionId: ZNC_PRODUCT_ID,
        assignedNetworkId: null,
        assignedServerId: null,
        createdAt: new Date().toISOString(),
        lastRefreshedAt: null,
      },
    ];

    await subscriptionService.deleteLocalAccount('a3');
    expect(subscriptionService.getAccount('a3')).toBeUndefined();
    expect(mockSecure.removeSecret).toHaveBeenCalled();

    await subscriptionService.clearAllData();
    expect(subscriptionService.getAccounts()).toHaveLength(0);
  });

  it('covers metadata/password lookups and account helper queries', async () => {
    (subscriptionService as any).accounts = [
      {
        id: 'h1',
        zncUsername: 'Alice',
        zncPassword: 'pwA',
        status: 'active',
        provisioningStatus: 'ready',
        expiresAt: null,
        purchaseToken: 'tokA',
        subscriptionId: ZNC_PRODUCT_ID,
        assignedNetworkId: 'n1',
        assignedServerId: 's1',
        createdAt: new Date().toISOString(),
        lastRefreshedAt: null,
      },
      {
        id: 'h2',
        zncUsername: 'Bob',
        zncPassword: null,
        status: 'expired',
        provisioningStatus: 'provisioning',
        expiresAt: '2000-01-01T00:00:00.000Z',
        purchaseToken: '',
        subscriptionId: ZNC_PRODUCT_ID,
        assignedNetworkId: null,
        assignedServerId: null,
        createdAt: new Date().toISOString(),
        lastRefreshedAt: null,
      },
    ];

    const meta = subscriptionService.getAccountsMetadata(
      new Map([['n1', 'Net One']]),
    );
    expect(meta[0].assignedNetworkName).toBe('Net One');

    expect(subscriptionService.getAccountByUsername('alice')?.id).toBe('h1');
    expect(subscriptionService.getActiveAccountsCount()).toBe(1);
    expect(subscriptionService.hasActiveSubscription()).toBe(true);

    mockGetSetting.mockImplementation(
      async (k: string) => k === 'biometricPasswordLock',
    );
    mockSecure.getSecret.mockResolvedValueOnce('storedPw');
    await expect(subscriptionService.getAccountPassword('h2')).resolves.toBe(
      'storedPw',
    );

    mockGetSetting.mockResolvedValueOnce(false);
    await expect(subscriptionService.getAccountPassword('h1')).resolves.toBe(
      'pwA',
    );
  });

  it('covers initialize idempotency and load/save error branches', async () => {
    await AsyncStorage.setItem(ZNC_STORAGE_KEYS.ACCOUNTS, '{bad json');
    await subscriptionService.initialize();
    expect(subscriptionService.getAccounts()).toEqual([]);

    (subscriptionService as any).initialized = true;
    await subscriptionService.initialize();

    mockGetSetting.mockImplementation(
      async (k: string) => k === 'biometricPasswordLock',
    );
    const prepared = await (
      subscriptionService as any
    ).prepareAccountsForStorage(
      [
        {
          id: 'sec-1',
          zncUsername: 'sec',
          zncPassword: 'pw',
          status: 'active',
          provisioningStatus: 'ready',
          expiresAt: null,
          purchaseToken: 'pt',
          subscriptionId: ZNC_PRODUCT_ID,
          assignedNetworkId: null,
          assignedServerId: null,
          createdAt: new Date().toISOString(),
          lastRefreshedAt: null,
        },
      ],
      true,
    );
    expect(prepared[0].zncPassword).toBeNull();
    expect(mockSecure.setSecret).toHaveBeenCalled();
  });

  it('covers getPurchaseTokens for secure-storage and fallback branches', async () => {
    mockGetSetting.mockImplementation(
      async (k: string) => k === 'biometricPasswordLock',
    );
    await AsyncStorage.setItem(
      ZNC_STORAGE_KEYS.TOKENS,
      JSON.stringify([{ accountId: 'a1' }, { accountId: 'a2' }]),
    );
    mockSecure.getSecret
      .mockResolvedValueOnce('tok1')
      .mockResolvedValueOnce(null);
    await expect(subscriptionService.getPurchaseTokens()).resolves.toEqual([
      'tok1',
    ]);

    mockGetSetting.mockResolvedValueOnce(false);
    await AsyncStorage.setItem(
      ZNC_STORAGE_KEYS.TOKENS,
      JSON.stringify([{ token: 'plain1' }, { token: 'plain2' }]),
    );
    await expect(subscriptionService.getPurchaseTokens()).resolves.toEqual([
      'plain1',
      'plain2',
    ]);

    await AsyncStorage.removeItem(ZNC_STORAGE_KEYS.TOKENS);
    mockGetSetting.mockImplementation(async () => false);
    (subscriptionService as any).accounts = [
      {
        id: 'f1',
        zncUsername: 'u',
        zncPassword: null,
        status: 'active',
        provisioningStatus: 'ready',
        expiresAt: null,
        purchaseToken: 'fallback-tok',
        subscriptionId: ZNC_PRODUCT_ID,
        assignedNetworkId: null,
        assignedServerId: null,
        createdAt: new Date().toISOString(),
        lastRefreshedAt: null,
      },
    ];
    await expect(subscriptionService.getPurchaseTokens()).resolves.toEqual([
      'fallback-tok',
    ]);
  });

  it('covers refreshAllAccounts and assign/unassign error handling', async () => {
    (subscriptionService as any).accounts = [
      {
        id: 'r1',
        zncUsername: 'u1',
        zncPassword: null,
        status: 'expired',
        provisioningStatus: 'ready',
        expiresAt: '2999-01-01T00:00:00.000Z',
        purchaseToken: 't1',
        subscriptionId: ZNC_PRODUCT_ID,
        assignedNetworkId: null,
        assignedServerId: null,
        createdAt: new Date().toISOString(),
        lastRefreshedAt: null,
      },
      {
        id: 'r2',
        zncUsername: 'u2',
        zncPassword: null,
        status: 'active',
        provisioningStatus: 'ready',
        expiresAt: '2000-01-01T00:00:00.000Z',
        purchaseToken: 't2',
        subscriptionId: ZNC_PRODUCT_ID,
        assignedNetworkId: null,
        assignedServerId: null,
        createdAt: new Date().toISOString(),
        lastRefreshedAt: null,
      },
    ];

    await subscriptionService.refreshAllAccounts();
    expect(subscriptionService.getAccount('r1')?.status).toBe('active');
    expect(subscriptionService.getAccount('r2')?.status).toBe('expired');

    await expect(
      subscriptionService.assignToNetwork('missing', 'n', 's'),
    ).rejects.toThrow('Account not found');
    await expect(
      subscriptionService.unassignFromNetwork('missing'),
    ).rejects.toThrow('Account not found');
  });

  it('covers restorePurchases individual fallback flow and failures', async () => {
    (global as any).fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ accounts: [] }),
      }) // batch no results
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'i1',
          znc_username: 'ind1',
          znc_password: 'pw1',
          status: 'active',
          znc_status: 'ready',
          expires_at: null,
        }),
      })
      .mockRejectedValueOnce(new Error('token failed'));

    const out = await subscriptionService.restorePurchases([
      'tok-i1',
      'tok-bad',
    ]);
    expect(out.restored).toBe(1);
    expect(out.failed).toBe(1);
    expect(subscriptionService.getAccount('i1')).toBeDefined();
  });

  it('covers register/update and apiCall error parsing branches', async () => {
    // first create account
    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'upd-1',
        status: 'active',
        expires_at: null,
        znc_username: 'upd',
        znc_password: '',
        znc_status: null,
      }),
    });
    await subscriptionService.registerZncSubscription({
      purchaseToken: 'pt-1',
      subscriptionId: ZNC_PRODUCT_ID,
      zncUsername: 'upd',
    });

    // update same account keeps assignment
    await subscriptionService.assignToNetwork('upd-1', 'net-upd', 'srv-upd');
    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'upd-1',
        status: 'active',
        expires_at: null,
        znc_username: 'upd',
        znc_password: 'newpw',
        znc_status: 'ready',
      }),
    });
    const updated = await subscriptionService.registerZncSubscription({
      purchaseToken: 'pt-2',
      subscriptionId: ZNC_PRODUCT_ID,
      zncUsername: 'upd',
    });
    expect(updated.assignedNetworkId).toBe('net-upd');

    // structured error JSON
    (global as any).fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ error: 'structured-failure' }),
    });
    await expect(
      subscriptionService.checkUsernameAvailability('x'),
    ).resolves.toBe(true);

    // non-json error text
    (global as any).fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'raw-failure',
    });
    await expect(
      subscriptionService.checkUsernameAvailability('y'),
    ).resolves.toBe(true);

    // invalid JSON success payload -> apiCall returns {}
    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('bad-json');
      },
    });
    await expect(
      subscriptionService.checkUsernameAvailability('z'),
    ).resolves.toBeUndefined();
  });
});

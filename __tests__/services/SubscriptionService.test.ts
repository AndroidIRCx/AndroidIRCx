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

const mkAccount = (over: any = {}) => ({
  id: 'id',
  zncUsername: 'user',
  zncPassword: 'pw',
  status: 'active',
  provisioningStatus: 'ready',
  expiresAt: null,
  purchaseToken: 'tok',
  subscriptionId: ZNC_PRODUCT_ID,
  assignedNetworkId: null,
  assignedServerId: null,
  createdAt: new Date().toISOString(),
  lastRefreshedAt: null,
  ...over,
});

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

  it('handles secure storage failures in prepareAccountsForStorage', async () => {
    const svc = subscriptionService as any;

    // password setSecret fails -> password not cleared (line 88)
    mockSecure.setSecret.mockRejectedValueOnce(new Error('pw fail'));
    let out = await svc.prepareAccountsForStorage(
      [mkAccount({ id: 'p1' })],
      true,
    );
    expect(out[0].zncPassword).toBe('pw');

    // password ok, token setSecret fails -> token not cleared (line 103)
    mockSecure.setSecret
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('tok fail'));
    out = await svc.prepareAccountsForStorage([mkAccount({ id: 'p2' })], true);
    expect(out[0].purchaseToken).toBe('tok');

    // lockEnabled false + removeSecret fails -> warn (line 115)
    mockSecure.removeSecret.mockRejectedValueOnce(new Error('rm fail'));
    out = await svc.prepareAccountsForStorage([mkAccount({ id: 'p3' })], false);
    expect(out).toHaveLength(1);

    // outer catch -> account persisted without sensitive data (lines 124-134)
    let count = 0;
    const trap: any = mkAccount({ id: 'oc1', purchaseToken: 't' });
    Object.defineProperty(trap, 'zncPassword', {
      enumerable: true,
      configurable: true,
      get() {
        count++;
        if (count === 2) {
          throw new Error('trap');
        }
        return 'pw';
      },
    });
    out = await svc.prepareAccountsForStorage([trap], true);
    expect(out[0].zncPassword).toBeNull();
    expect(out[0].purchaseToken).toBe('');
  });

  it('handles empty storage and initialize failure', async () => {
    // empty storage -> loadAccounts "no accounts" branch (lines 205-206)
    mockGetSetting.mockImplementation(async () => false);
    await subscriptionService.initialize();
    expect(subscriptionService.getAccounts()).toEqual([]);

    // initialize failure -> isPasswordLockEnabled rejects (line 191)
    (subscriptionService as any).initialized = false;
    mockGetSetting.mockRejectedValue(new Error('settings down'));
    await subscriptionService.initialize();
    expect((subscriptionService as any).initialized).toBe(false);

    mockGetSetting.mockImplementation(async () => false);
  });

  it('handles storage read/write failures', async () => {
    const svc = subscriptionService as any;
    mockGetSetting.mockImplementation(async () => false);

    // loadAccounts: getItem throws on both attempts -> inner catch (line 218)
    const getSpy = jest
      .spyOn(AsyncStorage, 'getItem')
      .mockRejectedValue(new Error('io'));
    await svc.loadAccounts();
    expect(svc.accounts).toEqual([]);
    getSpy.mockRestore();

    // saveAccounts + savePurchaseTokens: setItem throws -> catch (lines 243, 280)
    svc.accounts = [mkAccount({ id: 'w1' })];
    const setSpy = jest
      .spyOn(AsyncStorage, 'setItem')
      .mockRejectedValue(new Error('io'));
    await svc.saveAccounts();
    await svc.savePurchaseTokens();
    setSpy.mockRestore();

    // savePurchaseTokens lockEnabled path writes token to secure storage (line 257)
    mockGetSetting.mockImplementation(
      async (k: string) => k === 'biometricPasswordLock',
    );
    svc.accounts = [mkAccount({ id: 'sp1', purchaseToken: 'ptok' })];
    await svc.savePurchaseTokens();
    expect(mockSecure.setSecret).toHaveBeenCalledWith(
      expect.stringContaining('sp1'),
      'ptok',
    );
    mockGetSetting.mockImplementation(async () => false);
  });

  it('handles getPurchaseTokens parse error and secure fallback', async () => {
    // malformed TOKENS json -> catch (line 315), fallback to account tokens
    mockGetSetting.mockImplementation(async () => false);
    const badGetSpy = jest
      .spyOn(AsyncStorage, 'getItem')
      .mockResolvedValue('{bad');
    (subscriptionService as any).accounts = [
      mkAccount({ id: 'g1', purchaseToken: 'acc-tok' }),
    ];
    await expect(subscriptionService.getPurchaseTokens()).resolves.toEqual([
      'acc-tok',
    ]);
    badGetSpy.mockRestore();

    // no TOKENS + lockEnabled -> secure storage fallback (lines 324-334)
    await AsyncStorage.removeItem(ZNC_STORAGE_KEYS.TOKENS);
    mockGetSetting.mockImplementation(
      async (k: string) => k === 'pinPasswordLock',
    );
    (subscriptionService as any).accounts = [
      mkAccount({ id: 'g2' }),
      mkAccount({ id: 'g3' }),
    ];
    mockSecure.getSecret
      .mockResolvedValueOnce('secure-tok')
      .mockResolvedValueOnce(null);
    await expect(subscriptionService.getPurchaseTokens()).resolves.toEqual([
      'secure-tok',
    ]);
    mockGetSetting.mockImplementation(async () => false);
  });

  it('catches listener errors during notify', async () => {
    mockGetSetting.mockImplementation(async () => false);
    let calls = 0;
    const off = subscriptionService.addListener(() => {
      calls++;
      if (calls > 1) {
        throw new Error('listener boom');
      }
    });
    // clearAllData triggers notifyListeners; the throw is caught (lines 352-355)
    await subscriptionService.clearAllData();
    expect(calls).toBe(2);
    off();
  });

  it('throws on register error and swallows save/token/notify failures', async () => {
    // response.error -> throw (line 462)
    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ error: 'nope' }),
    });
    await expect(
      subscriptionService.registerZncSubscription({
        purchaseToken: 'p',
        subscriptionId: ZNC_PRODUCT_ID,
        zncUsername: 'n',
      }),
    ).rejects.toThrow('nope');

    // save/token/notify all fail -> each caught (lines 517, 527, 537)
    mockGetSetting.mockImplementation(async () => false);
    (global as any).fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'reg-1',
        status: 'active',
        expires_at: null,
        znc_username: 'n2',
        znc_password: 'pw',
        znc_status: 'ready',
      }),
    });
    const svc = subscriptionService as any;
    const saveSpy = jest
      .spyOn(svc, 'saveAccounts')
      .mockRejectedValueOnce(new Error('save'));
    const tokSpy = jest
      .spyOn(svc, 'savePurchaseTokens')
      .mockRejectedValueOnce(new Error('tok'));
    const notifySpy = jest
      .spyOn(svc, 'notifyListeners')
      .mockImplementationOnce(() => {
        throw new Error('notify');
      });
    const acc = await subscriptionService.registerZncSubscription({
      purchaseToken: 'p2',
      subscriptionId: ZNC_PRODUCT_ID,
      zncUsername: 'n2',
    });
    expect(acc.id).toBe('reg-1');
    saveSpy.mockRestore();
    tokSpy.mockRestore();
    notifySpy.mockRestore();
  });

  it('covers refreshAccountStatus branches', async () => {
    mockGetSetting.mockImplementation(async () => false);
    const svc = subscriptionService as any;

    // account not found -> null (lines 554-555)
    await expect(
      subscriptionService.refreshAccountStatus('none'),
    ).resolves.toBeNull();

    // expired but not past expiry -> reset to active (lines 567, 569)
    svc.accounts = [
      mkAccount({
        id: 'rf1',
        status: 'expired',
        expiresAt: '2999-01-01T00:00:00.000Z',
      }),
    ];
    const r = await subscriptionService.refreshAccountStatus('rf1');
    expect(r?.status).toBe('active');

    // saveAccounts throws -> catch + rethrow (lines 582-583)
    svc.accounts = [mkAccount({ id: 'rf2', expiresAt: null })];
    const saveSpy = jest
      .spyOn(svc, 'saveAccounts')
      .mockRejectedValueOnce(new Error('save'));
    await expect(
      subscriptionService.refreshAccountStatus('rf2'),
    ).rejects.toThrow('save');
    saveSpy.mockRestore();
  });

  it('refreshAllAccounts catches per-account errors', async () => {
    mockGetSetting.mockImplementation(async () => false);
    const trap: any = mkAccount({ id: 'ra1' });
    Object.defineProperty(trap, 'expiresAt', {
      enumerable: true,
      configurable: true,
      get() {
        throw new Error('expiry boom');
      },
    });
    (subscriptionService as any).accounts = [trap];
    // per-account error is caught inside the loop (line 610)
    await expect(
      subscriptionService.refreshAllAccounts(),
    ).resolves.toBeUndefined();
  });

  it('restore batch updates existing account and handles per-account errors', async () => {
    mockGetSetting.mockImplementation(async () => false);
    (subscriptionService as any).accounts = [
      mkAccount({
        id: 'br1',
        assignedNetworkId: 'net-x',
        assignedServerId: 'srv-x',
      }),
    ];
    (global as any).fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        accounts: [
          {
            id: 'br1',
            status: 'active',
            expires_at: null,
            znc_username: 'updated',
            znc_password: 'np',
            znc_status: 'ready',
          },
          {
            id: 'br2',
            znc_username: 'x',
            status: 'active',
            get znc_password() {
              throw new Error('bad');
            },
          },
        ],
      }),
    });

    // existing index found + update (lines 655, 698); per-account catch (705-706)
    const res = await subscriptionService.restorePurchases(['t1']);
    expect(res.restored).toBe(1);
    expect(res.failed).toBe(1);
    expect(subscriptionService.getAccount('br1')?.assignedNetworkId).toBe(
      'net-x',
    );
  });

  it('restore falls back to individual when batch throws, updating by token', async () => {
    mockGetSetting.mockImplementation(async () => false);
    (subscriptionService as any).accounts = [
      mkAccount({
        id: 'old-id',
        purchaseToken: 'tok-i',
        assignedNetworkId: 'n-keep',
        assignedServerId: 's-keep',
      }),
    ];
    (global as any).fetch
      .mockRejectedValueOnce(new Error('batch down')) // batch throws -> lines 722-723
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'new-id',
          znc_username: 'ind',
          znc_password: 'pw',
          status: 'active',
          znc_status: 'ready',
          expires_at: null,
        }),
      });

    // individual existing index found by token + update (lines 742, 782)
    const res = await subscriptionService.restorePurchases(['tok-i']);
    expect(res.restored).toBe(1);
    expect(subscriptionService.getAccount('new-id')?.assignedNetworkId).toBe(
      'n-keep',
    );
  });

  it('apiCall enforces size/content-type limits and parses errors', async () => {
    const svc = subscriptionService as any;
    mockGetSetting.mockImplementation(async () => false);

    // content-length too large -> throw (line 971)
    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: {
        get: (h: string) =>
          h === 'content-length' ? String(1024 * 1024) : null,
      },
      json: async () => ({}),
    });
    await expect(svc.apiCall('/x', 'POST', {})).rejects.toThrow('too large');

    // !ok + small content-length + structured JSON error (lines 980, 983-984)
    (global as any).fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      headers: { get: (h: string) => (h === 'content-length' ? '40' : null) },
      text: async () => JSON.stringify({ error: 'structured' }),
    });
    await expect(svc.apiCall('/x', 'POST', {})).rejects.toThrow('structured');

    // !ok + small content-length + non-JSON body -> warn (line 990)
    (global as any).fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: { get: (h: string) => (h === 'content-length' ? '10' : null) },
      text: async () => 'plain text error',
    });
    await expect(svc.apiCall('/x', 'POST', {})).rejects.toThrow(
      'Request failed with status 500',
    );

    // ok but non-JSON content-type -> throw (line 1005)
    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: {
        get: (h: string) => (h === 'content-type' ? 'text/html' : null),
      },
      json: async () => ({}),
    });
    await expect(svc.apiCall('/x', 'GET')).rejects.toThrow('non-JSON response');
  });
});

/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const mockStorage = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) =>
      mockStorage.has(key) ? mockStorage.get(key)! : null,
    ),
    setItem: jest.fn(async (key: string, value: string) => {
      mockStorage.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      mockStorage.delete(key);
    }),
    getAllKeys: jest.fn(async () => Array.from(mockStorage.keys())),
    multiRemove: jest.fn(async (keys: string[]) => {
      keys.forEach(k => mockStorage.delete(k));
    }),
  },
}));

import {
  PRODUCT_PRO_UNLIMITED,
  PRODUCT_REMOVE_ADS,
  PRODUCT_SUPPORTER_PRO,
  inAppPurchaseService,
} from '../../src/services/InAppPurchaseService';

describe('InAppPurchaseService', () => {
  beforeEach(async () => {
    mockStorage.clear();
    jest.clearAllMocks();
    (inAppPurchaseService as any).initialized = false;
    await inAppPurchaseService.resetPurchases();
    (inAppPurchaseService as any).initialized = false;
  });

  it('initializes from storage and notifies listeners', async () => {
    mockStorage.set(
      '@AndroidIRCX:purchases',
      JSON.stringify({
        [PRODUCT_REMOVE_ADS]: true,
        [PRODUCT_PRO_UNLIMITED]: false,
        [PRODUCT_SUPPORTER_PRO]: false,
      }),
    );

    const listener = jest.fn();
    const unsubscribe = inAppPurchaseService.addListener(listener);

    await inAppPurchaseService.initialize();
    await inAppPurchaseService.initialize();

    expect(inAppPurchaseService.hasPurchased(PRODUCT_REMOVE_ADS)).toBe(true);
    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });

  it('processes purchases and stores purchase token', async () => {
    const ok = await inAppPurchaseService.processPurchase(
      PRODUCT_PRO_UNLIMITED,
      'token-123',
    );
    expect(ok).toBe(true);
    expect(inAppPurchaseService.hasUnlimitedScripting()).toBe(true);
    expect(inAppPurchaseService.getHighestTier()).toBe('pro_unlimited');

    const token = await inAppPurchaseService.getPurchaseToken(
      PRODUCT_PRO_UNLIMITED,
    );
    expect(token).toBe('token-123');

    const bad = await inAppPurchaseService.processPurchase(
      'invalid_product',
      'token',
    );
    expect(bad).toBe(false);
  });

  it('supports grant, revoke, reset and tier helpers', async () => {
    await inAppPurchaseService.grantPurchase(PRODUCT_REMOVE_ADS);
    expect(inAppPurchaseService.hasNoAds()).toBe(true);
    expect(inAppPurchaseService.getHighestTier()).toBe('remove_ads');

    await inAppPurchaseService.grantPurchase(PRODUCT_SUPPORTER_PRO);
    expect(inAppPurchaseService.isSupporter()).toBe(true);
    expect(inAppPurchaseService.hasUnlimitedScripting()).toBe(true);
    expect(inAppPurchaseService.getHighestTier()).toBe('supporter_pro');

    await inAppPurchaseService.revokePurchase(PRODUCT_SUPPORTER_PRO);
    expect(inAppPurchaseService.isSupporter()).toBe(false);

    await inAppPurchaseService.resetPurchases();
    expect(inAppPurchaseService.getHighestTier()).toBe('free');
    expect(inAppPurchaseService.hasNoAds()).toBe(false);
  });

  it('handles invalid grant/revoke and token read errors safely', async () => {
    await inAppPurchaseService.grantPurchase('bad-id');
    await inAppPurchaseService.revokePurchase('bad-id');
    const asyncStorage =
      require('@react-native-async-storage/async-storage').default;
    asyncStorage.getItem.mockRejectedValueOnce(new Error('read fail'));
    const token =
      await inAppPurchaseService.getPurchaseToken(PRODUCT_REMOVE_ADS);
    expect(token).toBeNull();
  });
});

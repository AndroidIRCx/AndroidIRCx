/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  DEFAULT_ZNC_SERVER,
  ZNC_STORAGE_KEYS,
  ZNC_PRODUCT_ID,
  ZNC_BASE_PLAN_ID,
  isZncAccountActive,
  isZncAccountReady,
  hasZncCredentials,
  formatZncExpiry,
  generateZncServerId,
  ZncAccount,
} from '../../src/types/znc';

const makeAccount = (overrides: Partial<ZncAccount> = {}): ZncAccount => ({
  id: 'acc-1',
  zncUsername: 'user1',
  zncPassword: 'pass1',
  status: 'active',
  provisioningStatus: 'ready',
  expiresAt: null,
  purchaseToken: 'token',
  subscriptionId: 'sub',
  assignedNetworkId: null,
  assignedServerId: null,
  createdAt: new Date().toISOString(),
  lastRefreshedAt: null,
  ...overrides,
});

describe('types/znc', () => {
  it('should expose default ZNC server settings', () => {
    expect(DEFAULT_ZNC_SERVER).toEqual({
      hostname: 'irc.androidircx.com',
      port: 16786,
      ssl: true,
      rejectUnauthorized: false,
      connectionType: 'znc',
    });
  });

  it('should expose storage and product constants', () => {
    expect(ZNC_STORAGE_KEYS.ACCOUNTS).toBe('@AndroidIRCX:zncAccounts');
    expect(ZNC_STORAGE_KEYS.TOKENS).toBe('@AndroidIRCX:zncPurchaseTokens');
    expect(ZNC_PRODUCT_ID).toBe('znc');
    expect(ZNC_BASE_PLAN_ID).toBe('znc-user');
  });

  it('should validate account active status', () => {
    expect(isZncAccountActive(makeAccount({ status: 'active' }))).toBe(true);
    expect(isZncAccountActive(makeAccount({ status: 'grace' }))).toBe(true);
    expect(isZncAccountActive(makeAccount({ status: 'expired' }))).toBe(false);
    expect(isZncAccountActive(makeAccount({ status: 'cancelled' }))).toBe(
      false,
    );
    expect(isZncAccountActive(makeAccount({ status: 'pending' }))).toBe(false);
  });

  it('should validate account readiness', () => {
    expect(
      isZncAccountReady(
        makeAccount({ status: 'active', provisioningStatus: 'ready' }),
      ),
    ).toBe(true);
    expect(
      isZncAccountReady(
        makeAccount({ status: 'grace', provisioningStatus: 'ready' }),
      ),
    ).toBe(true);
    expect(
      isZncAccountReady(
        makeAccount({ status: 'active', provisioningStatus: 'provisioning' }),
      ),
    ).toBe(false);
    expect(
      isZncAccountReady(
        makeAccount({ status: 'expired', provisioningStatus: 'ready' }),
      ),
    ).toBe(false);
  });

  it('should validate account credentials', () => {
    expect(
      hasZncCredentials(makeAccount({ zncUsername: 'u', zncPassword: 'p' })),
    ).toBe(true);
    expect(
      hasZncCredentials(makeAccount({ zncUsername: '', zncPassword: 'p' })),
    ).toBe(false);
    expect(
      hasZncCredentials(makeAccount({ zncUsername: 'u', zncPassword: null })),
    ).toBe(false);
  });

  it('should format expiry labels for key scenarios', () => {
    expect(formatZncExpiry(null)).toBe('Unknown');
    expect(
      formatZncExpiry(
        new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      ),
    ).toBe('Expired');
    expect(formatZncExpiry(new Date().toISOString())).toBe('Expires today');
    expect(
      formatZncExpiry(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()),
    ).toBe('Expires tomorrow');
    expect(
      formatZncExpiry(
        new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      ),
    ).toBe('Expires in 3 days');
  });

  it('should format far-future dates as locale date and invalid input as fallback', () => {
    const farFuture = formatZncExpiry(
      new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
    );
    expect(typeof farFuture).toBe('string');
    expect(farFuture).not.toBe('Expires in 20 days');

    // Current implementation returns "Invalid Date" for non-parsable string.
    expect(formatZncExpiry('not-a-date')).toBe('Invalid Date');
  });

  it('should return Invalid date when Date construction throws (catch branch)', () => {
    expect(formatZncExpiry(Symbol('bad-input') as unknown as string)).toBe(
      'Invalid date',
    );
  });

  it('should generate deterministic server IDs', () => {
    expect(generateZncServerId('abc123')).toBe('znc-abc123');
  });
});

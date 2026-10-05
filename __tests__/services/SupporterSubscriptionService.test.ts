/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const mockStorage: Record<string, string> = {};
const mockIap = {
  getAvailablePurchases: jest.fn(),
};
const mockLease = { release: jest.fn(async () => undefined) };

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => mockStorage[key] ?? null),
  setItem: jest.fn(async (key: string, value: string) => {
    mockStorage[key] = value;
  }),
}));

jest.mock('react-native-iap', () => ({
  getAvailablePurchases: (...args: any[]) =>
    mockIap.getAvailablePurchases(...args),
}));

jest.mock('../../src/services/IapConnectionService', () => ({
  iapConnectionService: { acquire: jest.fn(async () => mockLease) },
}));

jest.mock('../../src/services/PlayIntegrityRequestSecurity', () => ({
  createPlayIntegrityRequestSecurity: jest.fn(async () => null),
  withPlayIntegrityHeaders: (headers: any) => headers,
  withPlayIntegrityBody: (body: any) => body,
}));

jest.mock('../../src/services/Logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { inAppPurchaseService } from '../../src/services/InAppPurchaseService';
import {
  isSingleEmoji,
  SupporterApiError,
  supporterSubscriptionService,
} from '../../src/services/SupporterSubscriptionService';

const supporterPurchase = (overrides = {}) => ({
  productId: 'androidircx_monthly_supporter',
  purchaseToken: 'tok-1',
  purchaseState: 'purchased',
  currentPlanId: 'androidircx-monthly-supporter',
  ...overrides,
});

const respond = (status: number, body: unknown) =>
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });

describe('SupporterSubscriptionService', () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
    jest.clearAllMocks();
    supporterSubscriptionService.resetForTests();
    inAppPurchaseService.setSubscriptionSupporter(false);
    global.fetch = jest.fn();
  });

  it('is not active with no purchase token behind it (security pass 2026-10-05)', async () => {
    // What a crafted backup used to restore: Supporter for ever, unchecked.
    mockStorage['@AndroidIRCX:supporterSubscription'] = JSON.stringify({
      active: true,
      tier: 'big',
      purchaseToken: null,
    });

    await supporterSubscriptionService.initialize();

    expect(supporterSubscriptionService.isActive()).toBe(false);
  });

  describe('knowing an emoji when it sees one', () => {
    it.each(['❤️', '🦄', '👍🏽', '👨‍👩‍👧', '🇷🇸', '#️⃣', '⭐'])('accepts %s', e => {
      expect(isSingleEmoji(e)).toBe(true);
    });

    it.each([
      '',
      ' ',
      'a',
      '1',
      'ok',
      '❤️ love',
      '!!',
      '🦄🦄🦄🦄🦄🦄🦄🦄🦄🦄🦄',
    ])('refuses %p', e => {
      expect(isSingleEmoji(e)).toBe(false);
    });
  });

  describe('what the store says', () => {
    it('grants Supporter Pro benefits while the subscription is active', async () => {
      mockIap.getAvailablePurchases.mockResolvedValue([supporterPurchase()]);

      const state = await supporterSubscriptionService.refreshFromStore();

      expect(state).toMatchObject({
        active: true,
        tier: 'monthly',
        purchaseToken: 'tok-1',
      });
      expect(inAppPurchaseService.hasNoAds()).toBe(true);
      expect(inAppPurchaseService.hasUnlimitedScripting()).toBe(true);
      expect(inAppPurchaseService.isSupporter()).toBe(true);
      expect(inAppPurchaseService.getHighestTier()).toBe('supporter_pro');
      expect(mockLease.release).toHaveBeenCalled();
    });

    it('reads the big plan from the purchase', async () => {
      mockIap.getAvailablePurchases.mockResolvedValue([
        supporterPurchase({
          currentPlanId: 'androidircx-big-monthly-supporter',
        }),
      ]);

      expect((await supporterSubscriptionService.refreshFromStore()).tier).toBe(
        'big',
      );
    });

    it('takes the benefits away once the subscription has ended', async () => {
      mockIap.getAvailablePurchases.mockResolvedValueOnce([
        supporterPurchase(),
      ]);
      await supporterSubscriptionService.refreshFromStore();

      // Play stops reporting a subscription that has lapsed.
      mockIap.getAvailablePurchases.mockResolvedValueOnce([
        { productId: 'remove_ads', purchaseToken: 'x' },
      ]);
      const state = await supporterSubscriptionService.refreshFromStore();

      expect(state.active).toBe(false);
      expect(inAppPurchaseService.isSupporter()).toBe(false);
      // The token is kept, so the next start-up still checks.
      expect(state.purchaseToken).toBe('tok-1');
    });

    it('grants nothing for a payment that is still pending', async () => {
      mockIap.getAvailablePurchases.mockResolvedValue([
        supporterPurchase({ purchaseState: 'pending' }),
      ]);

      expect(
        (await supporterSubscriptionService.refreshFromStore()).active,
      ).toBe(false);
      await supporterSubscriptionService.applyPurchase(
        supporterPurchase({ purchaseState: 'pending' }) as any,
      );
      expect(supporterSubscriptionService.isActive()).toBe(false);
    });

    it('ignores purchases of other products', async () => {
      await supporterSubscriptionService.applyPurchase({
        productId: 'privacy_relay',
        purchaseToken: 'r',
      } as any);

      expect(supporterSubscriptionService.isActive()).toBe(false);
    });

    it('keeps the last known state when the store cannot be reached', async () => {
      mockIap.getAvailablePurchases.mockResolvedValueOnce([
        supporterPurchase(),
      ]);
      await supporterSubscriptionService.refreshFromStore();
      mockIap.getAvailablePurchases.mockRejectedValueOnce(new Error('offline'));

      await expect(
        supporterSubscriptionService.refreshFromStore(),
      ).rejects.toThrow('offline');
      expect(supporterSubscriptionService.isActive()).toBe(true);
      expect(mockLease.release).toHaveBeenCalledTimes(2);
    });

    it('remembers the subscription and re-checks it at start-up', async () => {
      await supporterSubscriptionService.applyPurchase(
        supporterPurchase() as any,
      );
      supporterSubscriptionService.resetForTests();
      mockIap.getAvailablePurchases.mockResolvedValue([]);

      await supporterSubscriptionService.initialize();

      expect(supporterSubscriptionService.isActive()).toBe(true);
      await new Promise(resolve => setImmediate(resolve));
      expect(mockIap.getAvailablePurchases).toHaveBeenCalled();
      expect(supporterSubscriptionService.isActive()).toBe(false);
    });

    it('does not touch the store at start-up for someone who never subscribed', async () => {
      await supporterSubscriptionService.initialize();

      expect(mockIap.getAvailablePurchases).not.toHaveBeenCalled();
    });

    it('survives a corrupt stored state', async () => {
      mockStorage['@AndroidIRCX:supporterSubscription'] = '{not json';

      await supporterSubscriptionService.initialize();

      expect(supporterSubscriptionService.getState().active).toBe(false);
    });
  });

  describe('the badge', () => {
    it('starts as a heart and can be any single emoji', async () => {
      expect(supporterSubscriptionService.getEmoji()).toBe('❤️');

      await supporterSubscriptionService.setEmoji('🦊');
      expect(supporterSubscriptionService.getEmoji()).toBe('🦊');

      supporterSubscriptionService.resetForTests();
      await supporterSubscriptionService.initialize();
      expect(supporterSubscriptionService.getEmoji()).toBe('🦊');
    });

    it('refuses text', async () => {
      await expect(supporterSubscriptionService.setEmoji('hi')).rejects.toThrow(
        'single emoji',
      );
      expect(supporterSubscriptionService.getEmoji()).toBe('❤️');
    });

    it('tells listeners about a change', async () => {
      await supporterSubscriptionService.initialize();
      const listener = jest.fn();
      const stop = supporterSubscriptionService.addListener(listener);
      await supporterSubscriptionService.setEmoji('⭐');
      stop();
      await supporterSubscriptionService.setEmoji('🦄');

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('the backend', () => {
    beforeEach(async () => {
      await supporterSubscriptionService.applyPurchase(
        supporterPurchase() as any,
      );
    });

    it('saves the profile with the badge and the purchase token', async () => {
      await supporterSubscriptionService.setEmoji('🦄');
      respond(200, {
        profile: {
          display_name: 'Ana',
          emoji: '🦄',
          message: null,
          is_public: true,
          hidden: false,
        },
      });

      const profile = await supporterSubscriptionService.saveProfile({
        displayName: ' Ana ',
        message: '  ',
        isPublic: true,
      });

      const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe('https://www.androidircx.com/api/supporters/profile');
      expect(JSON.parse(init.body)).toEqual({
        purchase_token: 'tok-1',
        display_name: 'Ana',
        emoji: '🦄',
        message: null,
        is_public: true,
      });
      expect(profile).toEqual({
        displayName: 'Ana',
        emoji: '🦄',
        message: null,
        isPublic: true,
        hidden: false,
      });
    });

    it('reports the reason the server gave', async () => {
      respond(422, { error: 'text_not_allowed', message: 'Nope.' });

      const error = await supporterSubscriptionService
        .saveProfile({ displayName: 'x', message: '', isPublic: true })
        .catch(e => e);

      expect(error).toBeInstanceOf(SupporterApiError);
      expect(error.code).toBe('text_not_allowed');
      expect(error.status).toBe(422);
    });

    it('falls back to the status when the body is not JSON', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error('html');
        },
      });

      await expect(supporterSubscriptionService.fetchProfile()).rejects.toThrow(
        'The server answered 500.',
      );
    });

    it('fetches its own profile', async () => {
      respond(200, { tier: 'big', profile: null });

      expect(await supporterSubscriptionService.fetchProfile()).toEqual({
        tier: 'big',
        profile: null,
      });
    });

    it('cannot talk about a profile without a subscription', async () => {
      supporterSubscriptionService.resetForTests();

      await expect(supporterSubscriptionService.fetchProfile()).rejects.toThrow(
        'No supporter subscription',
      );
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('reads the public list defensively', async () => {
      respond(200, {
        supporters: [
          {
            name: 'Big',
            emoji: '🌟',
            tier: 'big',
            message: 'Hi',
            since: '2026-10-02',
          },
          { name: null, emoji: 'not emoji', tier: 'weird', message: '' },
          null,
        ],
      });

      expect(await supporterSubscriptionService.fetchSupporters()).toEqual([
        {
          name: 'Big',
          emoji: '🌟',
          tier: 'big',
          message: 'Hi',
          since: '2026-10-02',
        },
        {
          name: null,
          emoji: null,
          tier: 'monthly',
          message: null,
          since: null,
        },
      ]);
      const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe('https://www.androidircx.com/api/supporters');
      expect(init.method).toBe('GET');
    });

    it('treats a list that is not a list as empty', async () => {
      respond(200, { supporters: 'nope' });

      expect(await supporterSubscriptionService.fetchSupporters()).toEqual([]);
    });
  });
});

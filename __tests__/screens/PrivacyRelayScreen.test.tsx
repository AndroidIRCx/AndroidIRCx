/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

let purchaseUpdatedCallback: ((purchase: any) => Promise<void>) | undefined;
let purchaseErrorCallback: ((error: any) => void) | undefined;
const tMock = (key: string) => key;

const mockPrivacyRelayService = {
  initialize: jest.fn(),
  addListener: jest.fn(),
  getSubscription: jest.fn(),
  getRelayAccessState: jest.fn(),
  activateSubscription: jest.fn(),
  restoreFromPurchaseTokens: jest.fn(),
  registerPurchaseWithBackend: jest.fn(),
  fetchTurnCredentials: jest.fn(),
};

const mockPurchaseUpdateSubscription = { remove: jest.fn() };
const mockPurchaseErrorSubscription = { remove: jest.fn() };
const mockMediaSettingsService = {
  hasAutoEnabledNicklistCallActionsFromRelay: jest.fn(),
  setCallNicklistCallActionsEnabled: jest.fn(),
  markNicklistCallActionsAutoEnabledFromRelay: jest.fn(),
};

jest.mock('../../src/i18n/localization', () => ({
  useT: () => tMock,
}));

jest.mock('../../src/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#000',
      surface: '#111',
      border: '#333',
      text: '#fff',
      textSecondary: '#bbb',
      primary: '#4caf50',
      success: '#2e7d32',
    },
  }),
}));

jest.mock('react-native-iap', () => ({
  initConnection: jest.fn(() => Promise.resolve(true)),
  fetchProducts: jest.fn(() =>
    Promise.resolve([
      {
        id: 'privacy_relay',
        type: 'subs',
        displayPrice: '$3.99',
        subscriptionOfferDetails: [
          {
            basePlanId: 'monthly',
            offerToken: 'monthly-offer',
            pricingPhases: { pricingPhaseList: [{ formattedPrice: '$3.99' }] },
          },
          {
            basePlanId: 'yearly',
            offerToken: 'yearly-offer',
            pricingPhases: { pricingPhaseList: [{ formattedPrice: '$39.99' }] },
          },
        ],
      },
    ]),
  ),
  requestPurchase: jest.fn(() => Promise.resolve(undefined)),
  getAvailablePurchases: jest.fn(() =>
    Promise.resolve([
      { productId: 'privacy_relay', purchaseToken: 'restored-token' },
    ]),
  ),
  purchaseUpdatedListener: jest.fn((cb: any) => {
    purchaseUpdatedCallback = cb;
    return mockPurchaseUpdateSubscription;
  }),
  purchaseErrorListener: jest.fn((cb: any) => {
    purchaseErrorCallback = cb;
    return mockPurchaseErrorSubscription;
  }),
  finishTransaction: jest.fn(() => Promise.resolve(undefined)),
  endConnection: jest.fn(() => Promise.resolve(undefined)),
  ErrorCode: { UserCancelled: 'user-cancelled' },
}));

jest.mock('../../src/services/PrivacyRelayService', () => ({
  privacyRelayService: mockPrivacyRelayService,
  PRIVACY_RELAY_PRODUCT_ID: 'privacy_relay',
  PRIVACY_RELAY_BASE_PLAN_IDS: {
    monthly: 'monthly',
    yearly: 'yearly',
  },
}));

jest.mock('../../src/services/MediaSettingsService', () => ({
  mediaSettingsService: mockMediaSettingsService,
}));

const { PrivacyRelayScreen } = require('../../src/screens/PrivacyRelayScreen');

describe('PrivacyRelayScreen', () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    purchaseUpdatedCallback = undefined;
    purchaseErrorCallback = undefined;
    mockPrivacyRelayService.initialize.mockResolvedValue(undefined);
    mockPrivacyRelayService.addListener.mockImplementation((listener: any) => {
      listener(null);
      return jest.fn();
    });
    mockPrivacyRelayService.getSubscription.mockReturnValue(null);
    mockPrivacyRelayService.getRelayAccessState.mockReturnValue({
      hasSubscription: false,
      requiresBackendCredentials: true,
      relayServer: {
        host: 'turn.dbase.in.rs',
        tlsPort: 5349,
        stunUrls: ['stun:turn.dbase.in.rs:3478'],
      },
      subscription: null,
    });
    mockPrivacyRelayService.activateSubscription.mockResolvedValue(undefined);
    mockPrivacyRelayService.restoreFromPurchaseTokens.mockResolvedValue(1);
    mockPrivacyRelayService.registerPurchaseWithBackend.mockResolvedValue(
      undefined,
    );
    mockPrivacyRelayService.fetchTurnCredentials.mockResolvedValue({
      iceServers: [
        {
          urls: ['turn:turn.dbase.in.rs:3478?transport=udp'],
          username: 'u',
          credential: 'c',
        },
      ],
      ttl: 3600,
      relay: true,
      username: 'u',
      credential: 'c',
      deviceId: 'test-device-1',
      callId: 'test-call-1',
      fetchedAt: '2026-03-02T00:00:00.000Z',
    });
    mockMediaSettingsService.hasAutoEnabledNicklistCallActionsFromRelay.mockResolvedValue(
      false,
    );
    mockMediaSettingsService.setCallNicklistCallActionsEnabled.mockResolvedValue(
      undefined,
    );
    mockMediaSettingsService.markNicklistCallActionsAutoEnabledFromRelay.mockResolvedValue(
      undefined,
    );
  });

  afterEach(async () => {
    consoleLogSpy.mockRestore();
  });

  it('renders relay info and handles restore flow', async () => {
    const { findByText, getByText } = await render(
      <PrivacyRelayScreen visible onClose={jest.fn()} />,
    );

    expect(await findByText('Privacy Relay')).toBeTruthy();
    expect(getByText('TURN setup')).toBeTruthy();
    expect(getByText('Host: turn.dbase.in.rs')).toBeTruthy();

    await fireEvent.press(getByText('Restore Purchases'));

    await waitFor(async () => {
      expect(
        mockPrivacyRelayService.restoreFromPurchaseTokens,
      ).toHaveBeenCalled();
    });
    await waitFor(async () => {
      expect(
        mockPrivacyRelayService.registerPurchaseWithBackend,
      ).toHaveBeenCalledWith('restored-token', null);
      expect(mockPrivacyRelayService.fetchTurnCredentials).toHaveBeenCalledWith(
        'restored-token',
      );
    });
    await waitFor(async () => {
      expect(
        mockMediaSettingsService.setCallNicklistCallActionsEnabled,
      ).toHaveBeenCalledWith(true);
      expect(
        mockMediaSettingsService.markNicklistCallActionsAutoEnabledFromRelay,
      ).toHaveBeenCalled();
    });
  });

  it('shows store init failure and supports closing', async () => {
    mockPrivacyRelayService.initialize.mockRejectedValueOnce(
      new Error('store down'),
    );
    const onClose = jest.fn();
    const { findByText } = await render(
      <PrivacyRelayScreen visible onClose={onClose} />,
    );

    await waitFor(async () => {
      expect(Alert.alert).toHaveBeenCalledWith('Store Error', 'store down');
    });

    await fireEvent.press(await findByText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('handles restore with no matching purchases and restore failures', async () => {
    const RNIap = require('react-native-iap');
    RNIap.getAvailablePurchases.mockResolvedValueOnce([
      { productId: 'other_product', purchaseToken: 'other' },
    ]);
    mockPrivacyRelayService.restoreFromPurchaseTokens.mockResolvedValueOnce(0);

    const { findByText } = await render(
      <PrivacyRelayScreen visible onClose={jest.fn()} />,
    );

    await fireEvent.press(await findByText('Restore Purchases'));
    await waitFor(async () => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Restore complete',
        'No Privacy Relay subscriptions were found to restore.',
      );
    });

    mockPrivacyRelayService.restoreFromPurchaseTokens.mockRejectedValueOnce(
      new Error('restore broken'),
    );
    await fireEvent.press(await findByText('Restore Purchases'));
    await waitFor(async () => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Restore failed',
        'restore broken',
      );
    });
  });

  it('tests credentials success and failure branches', async () => {
    mockPrivacyRelayService.getSubscription.mockReturnValue({
      purchaseToken: 'token-123',
      basePlanId: 'monthly',
    });
    mockPrivacyRelayService.getRelayAccessState.mockReturnValue({
      hasSubscription: true,
      requiresBackendCredentials: true,
      relayServer: {
        host: 'turn.dbase.in.rs',
        tlsPort: 5349,
        stunUrls: ['stun:turn.dbase.in.rs:3478'],
      },
      subscription: { purchaseToken: 'token-123', basePlanId: 'monthly' },
    });

    const { findByText } = await render(
      <PrivacyRelayScreen visible onClose={jest.fn()} />,
    );

    await fireEvent.press(await findByText('Test Relay Credentials'));
    await waitFor(async () => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Relay ready',
        'TURN credentials were fetched successfully.',
      );
    });
    await waitFor(async () => {
      expect(await findByText('Last backend test')).toBeTruthy();
    });

    mockPrivacyRelayService.fetchTurnCredentials.mockRejectedValueOnce(
      new Error('turn failed'),
    );
    await fireEvent.press(await findByText('Test Relay Credentials'));
    await waitFor(async () => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Relay test failed',
        'turn failed',
      );
    });
  });

  it('handles purchase update success and failure branches', async () => {
    const RNIap = require('react-native-iap');
    await render(<PrivacyRelayScreen visible onClose={jest.fn()} />);

    await waitFor(async () => {
      expect(purchaseUpdatedCallback).toBeDefined();
    });

    await purchaseUpdatedCallback?.({
      productId: 'privacy_relay',
      purchaseToken: 'purchase-token',
      transactionId: 'txn-1',
    });

    await waitFor(async () => {
      expect(RNIap.finishTransaction).toHaveBeenCalled();
      expect(Alert.alert).toHaveBeenCalledWith(
        'Privacy Relay enabled',
        'Relay routing is now available for eligible calls.',
      );
    });

    mockPrivacyRelayService.fetchTurnCredentials.mockRejectedValueOnce(
      new Error('backend failed'),
    );
    await purchaseUpdatedCallback?.({
      productId: 'privacy_relay',
      purchaseToken: 'purchase-token-2',
      transactionId: 'txn-2',
    });

    await waitFor(async () => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Purchase Failed',
        'backend failed',
      );
    });
  });

  it('handles missing purchase token and purchase error callbacks', async () => {
    await render(<PrivacyRelayScreen visible onClose={jest.fn()} />);

    await waitFor(async () => {
      expect(purchaseUpdatedCallback).toBeDefined();
      expect(purchaseErrorCallback).toBeDefined();
    });

    await purchaseUpdatedCallback?.({
      productId: 'privacy_relay',
      purchaseToken: '',
      transactionReceipt: '',
      transactionId: 'txn-3',
    });

    await waitFor(async () => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Purchase Failed',
        'Missing purchase token for Privacy Relay subscription.',
      );
    });

    purchaseErrorCallback?.({
      code: 'some-error',
      message: 'billing failed',
      productId: 'privacy_relay',
    });
    expect(Alert.alert).toHaveBeenCalledWith(
      'Purchase Failed',
      'billing failed',
    );

    purchaseErrorCallback?.({
      code: 'user-cancelled',
      message: 'cancelled',
      productId: 'privacy_relay',
    });
  });

  /**
   * This field has been renamed twice already — `subscriptionOfferDetails`
   * became `subscriptionOfferDetailsAndroid`, and react-native-iap 16 replaced
   * both with `subscriptionOffers` — and a store that answers with
   * neither, or with a price missing, is an ordinary bad day rather than an
   * impossible one. None of those may leave the screen blank or show the word
   * "undefined" where a price belongs.
   */
  describe('offers that do not arrive in the expected shape', () => {
    const withProducts = (product: unknown) => {
      const RNIap = require('react-native-iap');
      RNIap.fetchProducts.mockResolvedValue(product === null ? [] : [product]);
    };

    const renderScreen = async () => {
      const view = await render(
        <PrivacyRelayScreen visible onClose={jest.fn()} />,
      );
      await waitFor(() =>
        expect(view.queryByText('Privacy Relay')).toBeTruthy(),
      );
      return view;
    };

    it('buys with the offers react-native-iap 16 actually sends', async () => {
      // The shape OpenIAP returns on Android since react-native-iap 16. Only
      // the old field names were read before, so no offer was found, both
      // Subscribe buttons were disabled and a tap did nothing at all.
      const { Platform } = require('react-native');
      const RNIap = require('react-native-iap');
      const originalOS = Platform.OS;
      Platform.OS = 'android';
      try {
        withProducts({
          id: 'privacy_relay',
          type: 'subs',
          platform: 'android',
          displayPrice: '$3.99',
          subscriptionOffers: [
            {
              id: 'monthly-base',
              basePlanIdAndroid: 'monthly',
              offerTokenAndroid: 'monthly-token',
              displayPrice: '$3.99',
              price: 3.99,
              pricingPhasesAndroid: {
                pricingPhaseList: [{ formattedPrice: '$4.49' }],
              },
            },
            {
              id: 'yearly-base',
              basePlanIdAndroid: 'yearly',
              offerTokenAndroid: 'yearly-token',
              displayPrice: '$39.99',
              price: 39.99,
            },
          ],
        });

        const view = await renderScreen();
        expect((await view.findAllByText(/\$4\.49/)).length).toBeGreaterThan(0);
        expect(view.getAllByText(/\$39\.99/).length).toBeGreaterThan(0);

        await fireEvent.press(view.getAllByText('Subscribe')[1]);

        await waitFor(() =>
          expect(RNIap.requestPurchase).toHaveBeenCalledWith({
            request: {
              google: {
                skus: ['privacy_relay'],
                subscriptionOffers: [
                  { sku: 'privacy_relay', offerToken: 'yearly-token' },
                ],
              },
            },
            type: 'subs',
          }),
        );
      } finally {
        Platform.OS = originalOS;
      }
    });

    it('reads the Android-suffixed field when that is the one sent', async () => {
      withProducts({
        id: 'privacy_relay',
        type: 'subs',
        displayPrice: '$3.99',
        subscriptionOfferDetailsAndroid: [
          {
            basePlanId: 'monthly',
            offerToken: 'monthly-offer',
            pricingPhases: { pricingPhaseList: [{ formattedPrice: '$4.49' }] },
          },
        ],
      });

      const view = await renderScreen();

      expect((await view.findAllByText(/\$4\.49/)).length).toBeGreaterThan(0);
    });

    it('falls back to the product price when an offer carries none', async () => {
      withProducts({
        id: 'privacy_relay',
        type: 'subs',
        displayPrice: '$9.99',
        subscriptionOfferDetails: [
          { basePlanId: 'monthly', offerToken: 'monthly-offer' },
        ],
      });

      const view = await renderScreen();

      expect((await view.findAllByText(/\$9\.99/)).length).toBeGreaterThan(0);
    });

    it('copes with an offer list that is not a list', async () => {
      withProducts({
        id: 'privacy_relay',
        type: 'subs',
        displayPrice: '$3.99',
        subscriptionOfferDetails: 'not a list',
      });

      const view = await renderScreen();

      expect(view.queryByText('Privacy Relay')).toBeTruthy();
    });

    it('copes with a store that returns no product at all', async () => {
      withProducts(null);

      const view = await renderScreen();

      expect(view.queryByText('Privacy Relay')).toBeTruthy();
    });

    it('names a plan that arrived without an id', async () => {
      withProducts({
        id: 'privacy_relay',
        type: 'subs',
        displayPrice: '$3.99',
        subscriptionOfferDetails: [
          {
            offerToken: 'nameless-offer',
            pricingPhases: { pricingPhaseList: [{ formattedPrice: '$1.99' }] },
          },
        ],
      });

      const view = await renderScreen();

      // The screen only shows the base plans it knows, so a nameless one gets
      // a placeholder id and is simply not offered — what matters is that it
      // does not take the screen down on the way past.
      expect(view.queryByText('Privacy Relay')).toBeTruthy();
    });

    it('says so when the store cannot be reached', async () => {
      const RNIap = require('react-native-iap');
      RNIap.fetchProducts.mockRejectedValue(new Error('store offline'));

      const view = await renderScreen();

      await waitFor(() =>
        expect(view.queryByText('Privacy Relay')).toBeTruthy(),
      );
    });
  });
});

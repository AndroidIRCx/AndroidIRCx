/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { Alert, Platform } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

let mockPurchaseUpdated: ((purchase: any) => Promise<void>) | null = null;
let mockPurchaseError: ((error: any) => void) | null = null;
const mockState = {
  active: false,
  tier: null as null | 'monthly' | 'big',
  purchaseToken: null as null | string,
  checkedAt: null,
};

const mockService = {
  getState: jest.fn(() => ({ ...mockState })),
  getEmoji: jest.fn(() => '❤️'),
  setEmoji: jest.fn(async () => undefined),
  addListener: jest.fn(() => jest.fn()),
  refreshFromStore: jest.fn(async () => ({ ...mockState })),
  applyPurchase: jest.fn(async () => undefined),
  fetchProfile: jest.fn(async () => ({
    tier: 'monthly',
    profile: {
      displayName: 'Ana',
      emoji: '❤️',
      message: null,
      isPublic: true,
      hidden: false,
    },
  })),
  saveProfile: jest.fn(async () => ({
    displayName: 'Ana',
    emoji: '❤️',
    message: null,
    isPublic: true,
    hidden: false,
  })),
  fetchSupporters: jest.fn(async () => [] as any[]),
};

jest.mock('../../src/services/SupporterSubscriptionService', () => ({
  supporterSubscriptionService: mockService,
  isSingleEmoji: (value: string) => /^[←-⯿\uD83C-\uDBFF]/.test(value),
}));

const mockLease = {
  ensureIapConnection: jest.fn(async () => undefined),
  releaseIapConnection: jest.fn(),
};
jest.mock('../../src/hooks/useIapConnectionLease', () => ({
  useIapConnectionLease: () => mockLease,
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
      onPrimary: '#fff',
    },
  }),
}));

// Stable across renders, as the real hook is: a new function each render
// would re-run every effect that depends on it.
const mockT = (key: string) => key;
jest.mock('../../src/i18n/localization', () => ({
  useT: () => mockT,
}));

jest.mock('react-native-iap', () => ({
  fetchProducts: jest.fn(async () => [
    {
      id: 'androidircx_monthly_supporter',
      type: 'subs',
      subscriptionOffers: [
        {
          basePlanIdAndroid: 'androidircx-monthly-supporter',
          offerTokenAndroid: 'monthly-token',
          displayPrice: '963,69 RSD',
        },
        {
          basePlanIdAndroid: 'androidircx-big-monthly-supporter',
          offerTokenAndroid: 'big-token',
          displayPrice: '2.345,67 RSD',
        },
      ],
    },
  ]),
  requestPurchase: jest.fn(async () => undefined),
  finishTransaction: jest.fn(async () => undefined),
  purchaseUpdatedListener: jest.fn((cb: any) => {
    mockPurchaseUpdated = cb;
    return { remove: jest.fn() };
  }),
  purchaseErrorListener: jest.fn((cb: any) => {
    mockPurchaseError = cb;
    return { remove: jest.fn() };
  }),
  ErrorCode: { UserCancelled: 'user-cancelled' },
}));

const RNIap = require('react-native-iap');
const {
  SupportProjectScreen,
} = require('../../src/screens/SupportProjectScreen');

const setActive = (tier: 'monthly' | 'big') => {
  mockState.active = true;
  mockState.tier = tier;
  mockState.purchaseToken = 'old-token';
};

const renderScreen = async () => {
  const view = await render(
    <SupportProjectScreen visible onClose={jest.fn()} />,
  );
  await waitFor(() => expect(view.getAllByText(/963,69 RSD/).length).toBe(1));
  return view;
};

describe('SupportProjectScreen', () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    mockState.active = false;
    mockState.tier = null;
    mockState.purchaseToken = null;
    Platform.OS = 'android';
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  });

  afterEach(() => {
    Platform.OS = originalOS;
    jest.restoreAllMocks();
  });

  it('offers both plans at the prices Google Play sends', async () => {
    const view = await renderScreen();

    expect(view.getByText('2.345,67 RSD')).toBeTruthy();
    expect(view.getAllByText('Subscribe')).toHaveLength(2);
    // Nothing to edit before subscribing.
    expect(view.queryByText('Your badge')).toBeNull();
  });

  it('subscribes to the chosen plan with its offer token', async () => {
    const view = await renderScreen();

    await fireEvent.press(view.getAllByText('Subscribe')[1]);

    expect(RNIap.requestPurchase).toHaveBeenCalledWith({
      request: {
        google: {
          skus: ['androidircx_monthly_supporter'],
          subscriptionOffers: [
            { sku: 'androidircx_monthly_supporter', offerToken: 'big-token' },
          ],
        },
      },
      type: 'subs',
    });
  });

  it('switches plan by replacing the running subscription', async () => {
    setActive('monthly');
    const view = await renderScreen();

    expect(view.getByText('Active')).toBeTruthy();
    await fireEvent.press(view.getByText('Switch to this plan'));

    expect(RNIap.requestPurchase).toHaveBeenCalledWith({
      request: {
        google: {
          skus: ['androidircx_monthly_supporter'],
          subscriptionOffers: [
            { sku: 'androidircx_monthly_supporter', offerToken: 'big-token' },
          ],
          purchaseToken: 'old-token',
          subscriptionProductReplacementParams: {
            oldProductId: 'androidircx_monthly_supporter',
            replacementMode: 'deferred',
          },
        },
      },
      type: 'subs',
    });
  });

  it('acknowledges a completed purchase and says thank you', async () => {
    await renderScreen();
    const purchase = {
      productId: 'androidircx_monthly_supporter',
      purchaseToken: 'new',
      purchaseState: 'purchased',
    };

    await mockPurchaseUpdated!(purchase);

    expect(RNIap.finishTransaction).toHaveBeenCalledWith({
      purchase,
      isConsumable: false,
    });
    expect(mockService.applyPurchase).toHaveBeenCalledWith(purchase);
    expect(Alert.alert).toHaveBeenCalledWith('Thank you!', expect.any(String));
  });

  it('waits for a pending payment without granting anything', async () => {
    await renderScreen();

    await mockPurchaseUpdated!({
      productId: 'androidircx_monthly_supporter',
      purchaseState: 'pending',
    });

    expect(RNIap.finishTransaction).not.toHaveBeenCalled();
    expect(mockService.applyPurchase).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      'Payment pending',
      expect.any(String),
    );
  });

  it('ignores other products and a cancelled purchase sheet', async () => {
    await renderScreen();

    await mockPurchaseUpdated!({ productId: 'privacy_relay' });
    mockPurchaseError!({
      code: 'user-cancelled',
      productId: 'androidircx_monthly_supporter',
    });

    expect(RNIap.finishTransaction).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();

    mockPurchaseError!({ code: 'billing', message: 'Card declined' });
    expect(Alert.alert).toHaveBeenCalledWith(
      'Purchase Failed',
      'Card declined',
    );
  });

  it('lets an active supporter pick a badge', async () => {
    setActive('monthly');
    const view = await renderScreen();

    await fireEvent.press(view.getByLabelText('🦄'));
    expect(mockService.setEmoji).toHaveBeenCalledWith('🦄');

    await fireEvent.changeText(
      view.getByPlaceholderText('Or type any emoji'),
      'hi',
    );
    await fireEvent.press(view.getByText('Use'));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Not an emoji',
      'Pick a single emoji.',
    );
    expect(mockService.setEmoji).toHaveBeenCalledTimes(1);
  });

  it('saves the list entry, with a message only for big supporters', async () => {
    setActive('monthly');
    const view = await renderScreen();
    await waitFor(() => expect(view.getByDisplayValue('Ana')).toBeTruthy());

    expect(
      view.queryByPlaceholderText('A short message (optional)'),
    ).toBeNull();
    await fireEvent.changeText(view.getByDisplayValue('Ana'), 'Ana B');
    await fireEvent.press(view.getByText('Save my list entry'));

    expect(mockService.saveProfile).toHaveBeenCalledWith({
      displayName: 'Ana B',
      message: '',
      isPublic: true,
    });
    expect(Alert.alert).toHaveBeenCalledWith('Saved', expect.any(String));
  });

  it('explains a refused name', async () => {
    setActive('big');
    mockService.saveProfile.mockRejectedValueOnce(
      Object.assign(new Error('x'), { code: 'text_not_allowed' }),
    );
    const view = await renderScreen();
    await waitFor(() => expect(view.getByDisplayValue('Ana')).toBeTruthy());

    expect(
      view.getByPlaceholderText('A short message (optional)'),
    ).toBeTruthy();
    await fireEvent.press(view.getByText('Save my list entry'));

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        'Could not save',
        'That name or message cannot be shown on the supporters list.',
      ),
    );
  });

  it('shows the supporters, anonymous ones included, big ones marked', async () => {
    mockService.fetchSupporters.mockResolvedValueOnce([
      {
        name: 'Big',
        emoji: '🌟',
        tier: 'big',
        message: 'Keep going',
        since: null,
      },
      { name: null, emoji: '🦊', tier: 'monthly', message: null, since: null },
    ]);
    const view = await renderScreen();

    await fireEvent.press(view.getByText('See the supporters'));

    expect(await view.findByText('🌟 Big')).toBeTruthy();
    expect(view.getByText('Keep going')).toBeTruthy();
    expect(view.getByText('Anonymous')).toBeTruthy();

    await fireEvent.press(view.getByText('‹ Back'));
    expect(view.getByText('Why support AndroidIRCX')).toBeTruthy();
  });

  it('says so when the list cannot be loaded or is empty', async () => {
    mockService.fetchSupporters.mockRejectedValueOnce(new Error('down'));
    const view = await renderScreen();

    await fireEvent.press(view.getByText('See the supporters'));
    expect(
      await view.findByText('The supporters list could not be loaded.'),
    ).toBeTruthy();

    await fireEvent.press(view.getByText('‹ Back'));
    await fireEvent.press(view.getByText('See the supporters'));
    expect(
      await view.findByText('No supporters yet. You could be the first.'),
    ).toBeTruthy();
  });

  it('restores a subscription bought on another device', async () => {
    const view = await renderScreen();
    mockService.refreshFromStore.mockResolvedValueOnce({
      active: true,
      tier: 'monthly',
      purchaseToken: 't',
      checkedAt: 1,
    });

    await fireEvent.press(view.getByText('Restore Purchases'));

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        'Restore complete',
        'Your supporter subscription is active.',
      ),
    );
  });
});

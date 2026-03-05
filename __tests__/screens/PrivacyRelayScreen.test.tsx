/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

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

jest.mock('../../src/i18n/transifex', () => ({
  useT: () => (key: string) => key,
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
          { basePlanId: 'monthly', offerToken: 'monthly-offer', pricingPhases: { pricingPhaseList: [{ formattedPrice: '$3.99' }] } },
          { basePlanId: 'yearly', offerToken: 'yearly-offer', pricingPhases: { pricingPhaseList: [{ formattedPrice: '$39.99' }] } },
        ],
      },
    ])
  ),
  requestPurchase: jest.fn(() => Promise.resolve(undefined)),
  getAvailablePurchases: jest.fn(() => Promise.resolve([
    { productId: 'privacy_relay', purchaseToken: 'restored-token' },
  ])),
  purchaseUpdatedListener: jest.fn(() => mockPurchaseUpdateSubscription),
  purchaseErrorListener: jest.fn(() => mockPurchaseErrorSubscription),
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
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
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
    mockPrivacyRelayService.registerPurchaseWithBackend.mockResolvedValue(undefined);
    mockPrivacyRelayService.fetchTurnCredentials.mockResolvedValue({
      iceServers: [{ urls: ['turn:turn.dbase.in.rs:3478?transport=udp'], username: 'u', credential: 'c' }],
      ttl: 3600,
      relay: true,
      username: 'u',
      credential: 'c',
      deviceId: 'test-device-1',
      callId: 'test-call-1',
      fetchedAt: '2026-03-02T00:00:00.000Z',
    });
    mockMediaSettingsService.hasAutoEnabledNicklistCallActionsFromRelay.mockResolvedValue(false);
    mockMediaSettingsService.setCallNicklistCallActionsEnabled.mockResolvedValue(undefined);
    mockMediaSettingsService.markNicklistCallActionsAutoEnabledFromRelay.mockResolvedValue(undefined);
  });

  it('renders relay info and handles restore flow', async () => {
    const { findByText, getByText } = render(
      <PrivacyRelayScreen visible onClose={jest.fn()} />
    );

    expect(await findByText('Privacy Relay')).toBeTruthy();
    expect(getByText('TURN setup')).toBeTruthy();
    expect(getByText('Host: turn.dbase.in.rs')).toBeTruthy();

    fireEvent.press(getByText('Restore Purchases'));

    await waitFor(() => {
      expect(mockPrivacyRelayService.restoreFromPurchaseTokens).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(mockPrivacyRelayService.registerPurchaseWithBackend).toHaveBeenCalledWith('restored-token', null);
      expect(mockPrivacyRelayService.fetchTurnCredentials).toHaveBeenCalledWith('restored-token');
    });
    await waitFor(() => {
      expect(mockMediaSettingsService.setCallNicklistCallActionsEnabled).toHaveBeenCalledWith(true);
      expect(mockMediaSettingsService.markNicklistCallActionsAutoEnabledFromRelay).toHaveBeenCalled();
    });
  });
});

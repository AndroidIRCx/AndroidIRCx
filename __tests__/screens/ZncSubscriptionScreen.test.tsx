/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

const mockAccount = {
  id: 'acc1',
  status: 'active',
  provisioningStatus: 'ready',
  zncUsername: 'demo',
  assignedNetworkId: undefined,
  expiresAt: '2026-12-01T00:00:00Z',
};

const mockSubscriptionService = {
  addListener: jest.fn(),
  initialize: jest.fn(),
  getAccounts: jest.fn(),
  refreshAllAccounts: jest.fn(),
  getAccountByUsername: jest.fn(),
  checkUsernameAvailability: jest.fn(),
  registerZncSubscription: jest.fn(),
  restorePurchases: jest.fn(),
  getAccountPassword: jest.fn(),
  generateServerConfig: jest.fn(),
  assignToNetwork: jest.fn(),
  unassignFromNetwork: jest.fn(),
  refreshAccountStatus: jest.fn(),
  deleteLocalAccount: jest.fn(),
};

const mockSettingsService = {
  getSetting: jest.fn(),
  setSetting: jest.fn(),
  updateNetwork: jest.fn(),
  getNetwork: jest.fn(),
};

const mockBiometricAuthService = {
  getBiometryType: jest.fn(),
  authenticate: jest.fn(),
};

const mockSecureStorageService = {
  getSecret: jest.fn(),
};

const mockClipboard = {
  setString: jest.fn(),
};

const mockPurchaseUpdateSubscription = { remove: jest.fn() };
const mockPurchaseErrorSubscription = { remove: jest.fn() };

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
      error: '#f44336',
    },
  }),
}));

jest.mock('@react-native-clipboard/clipboard', () => mockClipboard);

jest.mock('react-native-vector-icons/FontAwesome5', () => {
  return ({ name }: any) => {
    const React = require('react');
    const { Text } = require('react-native');
    return <Text>{name}</Text>;
  };
});

jest.mock('react-native-iap', () => ({
  initConnection: jest.fn(() => Promise.resolve(true)),
  fetchProducts: jest.fn(() =>
    Promise.resolve([{ id: 'znc', type: 'subs', displayPrice: '$4.99/month', subscriptionOfferDetails: [{ offerToken: 'offer-token', basePlanId: 'base-plan' }] }])
  ),
  getAvailablePurchases: jest.fn(() => Promise.resolve([])),
  requestPurchase: jest.fn(() => Promise.resolve(undefined)),
  restorePurchases: jest.fn(() => Promise.resolve(undefined)),
  purchaseUpdatedListener: jest.fn(() => mockPurchaseUpdateSubscription),
  purchaseErrorListener: jest.fn(() => mockPurchaseErrorSubscription),
  finishTransaction: jest.fn(() => Promise.resolve(undefined)),
  endConnection: jest.fn(),
  ErrorCode: { UserCancelled: 'user-cancelled' },
}));

jest.mock('../../src/services/SubscriptionService', () => ({
  subscriptionService: mockSubscriptionService,
  ZNC_PRODUCT_ID: 'znc',
  ZNC_BASE_PLAN_ID: 'base-plan',
  isZncAccountActive: jest.fn(() => true),
  isZncAccountReady: jest.fn(() => true),
  formatZncExpiry: jest.fn(() => 'Dec 1, 2026'),
}));

jest.mock('../../src/services/SettingsService', () => ({
  settingsService: mockSettingsService,
}));

jest.mock('../../src/services/BiometricAuthService', () => ({
  biometricAuthService: mockBiometricAuthService,
}));

jest.mock('../../src/services/SecureStorageService', () => ({
  secureStorageService: mockSecureStorageService,
}));

jest.mock('../../src/components/modals/NetworkPickerModal', () => ({
  NetworkPickerModal: ({ visible, onSelectNetwork, onCreateNew, onClose }: any) => {
    if (!visible) {
      return null;
    }
    const React = require('react');
    const { Text } = require('react-native');
    return (
      <>
        <Text>Network Picker</Text>
        <Text onPress={() => onSelectNetwork({ id: 'net1', name: 'Libera', servers: [] })}>
          Pick Network
        </Text>
        <Text onPress={onCreateNew}>Create Network</Text>
        <Text onPress={onClose}>Close Picker</Text>
      </>
    );
  },
}));

const { ZncSubscriptionScreen } = require('../../src/screens/ZncSubscriptionScreen');

describe('ZncSubscriptionScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    mockSubscriptionService.addListener.mockImplementation((listener: any) => {
      listener([mockAccount]);
      return jest.fn();
    });
    mockSubscriptionService.initialize.mockResolvedValue(undefined);
    mockSubscriptionService.getAccounts.mockReturnValue([mockAccount]);
    mockSubscriptionService.refreshAllAccounts.mockResolvedValue(undefined);
    mockSubscriptionService.getAccountByUsername.mockReturnValue(null);
    mockSubscriptionService.checkUsernameAvailability.mockResolvedValue(true);
    mockSubscriptionService.registerZncSubscription.mockResolvedValue({
      ...mockAccount,
      assignedNetworkId: undefined,
    });
    mockSubscriptionService.restorePurchases.mockResolvedValue(1);
    mockSubscriptionService.getAccountPassword.mockResolvedValue('secret-pass');
    mockSubscriptionService.generateServerConfig.mockReturnValue({
      id: 'srv-znc',
      hostname: 'znc.example',
      port: 6697,
      ssl: true,
      password: 'secret-pass',
    });
    mockSubscriptionService.assignToNetwork.mockResolvedValue(undefined);
    mockSubscriptionService.unassignFromNetwork.mockResolvedValue(undefined);
    mockSubscriptionService.refreshAccountStatus.mockResolvedValue({
      ...mockAccount,
      assignedNetworkId: 'net1',
    });
    mockSubscriptionService.deleteLocalAccount.mockResolvedValue(undefined);
    mockSettingsService.getSetting.mockImplementation((key: string) => {
      if (key === 'biometricPasswordLock' || key === 'pinPasswordLock') return Promise.resolve(false);
      return Promise.resolve(false);
    });
    mockSettingsService.setSetting.mockResolvedValue(undefined);
    mockSettingsService.updateNetwork.mockResolvedValue(undefined);
    mockSettingsService.getNetwork.mockResolvedValue({
      id: 'net1',
      name: 'Libera',
      servers: [{ id: 'srv-znc', hostname: 'znc.example', port: 6697, ssl: true }],
    });
    mockBiometricAuthService.getBiometryType.mockResolvedValue(null);
    mockBiometricAuthService.authenticate.mockResolvedValue({ success: true });
    mockSecureStorageService.getSecret.mockResolvedValue(null);
    const RNIap = require('react-native-iap');
    RNIap.getAvailablePurchases.mockResolvedValue([
      { productId: 'znc', purchaseToken: 'purchase-token', transactionId: 'tx1' },
    ]);
  });

  it('renders accounts and handles credential actions', async () => {
    const { findByText, getByText } = render(
      <ZncSubscriptionScreen visible onClose={jest.fn()} />
    );

    expect(await findByText('ZNC Subscription')).toBeTruthy();
    expect(await findByText('demo')).toBeTruthy();
    expect(getByText('Dec 1, 2026')).toBeTruthy();

    fireEvent.press(getByText('Show'));
    await waitFor(() => {
      expect(mockSubscriptionService.getAccountPassword).toHaveBeenCalledWith('acc1');
    });
    let buttons = (Alert.alert as jest.Mock).mock.calls.at(-1)?.[2];
    await act(async () => {
      await buttons?.[0]?.onPress?.();
    });
    expect(mockClipboard.setString).toHaveBeenCalled();

    fireEvent.press(getByText('Copy'));
    await waitFor(() => {
      expect(mockClipboard.setString).toHaveBeenCalled();
    });
  });

  it('supports purchase, restore, network assignment, unlink, refresh, and delete', async () => {
    const onNavigateToNetworkSettings = jest.fn();
    const { findByText, findByPlaceholderText, getByText } = render(
      <ZncSubscriptionScreen
        visible
        onClose={jest.fn()}
        onNavigateToNetworkSettings={onNavigateToNetworkSettings}
      />
    );

    await findByText('Purchase ZNC Account');
    fireEvent.press(getByText('Purchase ZNC Account'));
    fireEvent.changeText(await findByPlaceholderText('Username'), 'newznc');
    fireEvent.press(getByText('Continue'));

    await waitFor(() => {
      expect(mockSubscriptionService.checkUsernameAvailability).toHaveBeenCalledWith('newznc');
    });

    fireEvent.press(getByText('Restore Purchases'));
    await waitFor(() => {
      expect(mockSubscriptionService.restorePurchases).toHaveBeenCalled();
    });

    fireEvent.press(getByText('Add to Network'));
    fireEvent.press(await findByText('Pick Network'));
    await waitFor(() => {
      expect(mockSettingsService.updateNetwork).toHaveBeenCalled();
      expect(mockSubscriptionService.assignToNetwork).toHaveBeenCalledWith(
        'acc1',
        'Libera',
        'srv-znc'
      );
    });

    mockSubscriptionService.getAccounts.mockReturnValue([{ ...mockAccount, assignedNetworkId: 'net1' }]);
    mockSubscriptionService.addListener.mockImplementationOnce((listener: any) => {
      listener([{ ...mockAccount, assignedNetworkId: 'net1' }]);
      return jest.fn();
    });
    const secondRender = render(<ZncSubscriptionScreen visible onClose={jest.fn()} />);
    fireEvent.press(await secondRender.findByText('Unlink'));
    let buttons = (Alert.alert as jest.Mock).mock.calls.at(-1)?.[2];
    await act(async () => {
      await buttons?.[1]?.onPress?.();
    });
    await waitFor(() => {
      expect(mockSubscriptionService.unassignFromNetwork).toHaveBeenCalledWith('acc1');
    });

    fireEvent.press((await secondRender.findAllByText('sync'))[0]);
    await waitFor(() => {
      expect(mockSubscriptionService.refreshAccountStatus).toHaveBeenCalledWith('acc1');
    });

    fireEvent.press(await secondRender.findByText('trash'));
    buttons = (Alert.alert as jest.Mock).mock.calls.at(-1)?.[2];
    await act(async () => {
      await buttons?.[1]?.onPress?.();
    });
    await waitFor(() => {
      expect(mockSubscriptionService.deleteLocalAccount).toHaveBeenCalledWith('acc1');
    });
  });
});

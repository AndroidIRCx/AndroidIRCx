/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { PurchaseScreen } from '../../src/screens/PurchaseScreen';

jest.mock('../../src/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      surface: '#eee',
      text: '#111',
      textSecondary: '#666',
      border: '#ddd',
      primary: '#09f',
      accent: '#f80',
      success: '#0a0',
      buttonPrimary: '#09f',
    },
  }),
}));

jest.mock('../../src/i18n/transifex', () => ({
  useT: () => (key: string) => key,
}));

jest.mock('../../src/services/InAppPurchaseService', () => ({
  PRODUCT_REMOVE_ADS: 'remove_ads',
  PRODUCT_PRO_UNLIMITED: 'pro_unlimited',
  PRODUCT_SUPPORTER_PRO: 'supporter_pro',
  PRODUCT_CATALOG: {
    remove_ads: {
      title: 'Remove Ads',
      description: 'No more ads',
      features: ['Ad-free'],
    },
    pro_unlimited: {
      title: 'Pro Unlimited',
      description: 'All features',
      features: ['Unlimited scripting'],
    },
    supporter_pro: {
      title: 'Supporter Pro',
      description: 'Support dev',
      features: ['Supporter badge'],
    },
  },
  inAppPurchaseService: {
    hasPurchased: jest.fn(),
    addListener: jest.fn(),
    processPurchase: jest.fn(),
  },
}));

jest.mock('react-native-iap', () => ({
  initConnection: jest.fn(),
  fetchProducts: jest.fn(),
  getAvailablePurchases: jest.fn(),
  requestPurchase: jest.fn(),
  purchaseUpdatedListener: jest.fn(),
  purchaseErrorListener: jest.fn(),
  finishTransaction: jest.fn(),
  endConnection: jest.fn(),
  flushFailedPurchasesCachedAsPendingAndroid: jest.fn(),
}));

const mockRNIap = require('react-native-iap');

describe('PurchaseScreen', () => {
  let purchaseUpdatedHandler: ((purchase: any) => Promise<void>) | undefined;
  let purchaseErrorHandler: ((error: any) => void) | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    const {
      inAppPurchaseService,
    } = require('../../src/services/InAppPurchaseService');

    mockRNIap.initConnection.mockResolvedValue(undefined);
    mockRNIap.fetchProducts.mockResolvedValue([
      { id: 'remove_ads', displayPrice: '$1.99', price: 1.99 },
      { id: 'pro_unlimited', displayPrice: '$4.99', price: 4.99 },
      { id: 'supporter_pro', displayPrice: '$9.99', price: 9.99 },
    ]);
    mockRNIap.getAvailablePurchases.mockResolvedValue([]);
    mockRNIap.requestPurchase.mockResolvedValue(undefined);
    mockRNIap.purchaseUpdatedListener.mockImplementation(
      (handler: (purchase: any) => Promise<void>) => {
        purchaseUpdatedHandler = handler;
        return { remove: jest.fn() };
      },
    );
    mockRNIap.purchaseErrorListener.mockImplementation(
      (handler: (error: any) => void) => {
        purchaseErrorHandler = handler;
        return { remove: jest.fn() };
      },
    );
    mockRNIap.endConnection.mockResolvedValue(undefined);
    mockRNIap.finishTransaction.mockResolvedValue(undefined);
    mockRNIap.flushFailedPurchasesCachedAsPendingAndroid.mockResolvedValue(
      undefined,
    );
    inAppPurchaseService.hasPurchased.mockReturnValue(false);
    inAppPurchaseService.addListener.mockReturnValue(jest.fn());
    inAppPurchaseService.processPurchase.mockResolvedValue(undefined);
  });

  it('does not render content when hidden', () => {
    const { queryByText } = render(
      <PurchaseScreen visible={false} onClose={jest.fn()} />,
    );

    expect(queryByText('AndroidIRCX Premium')).toBeNull();
  });

  it('loads products and renders purchase cards when visible', async () => {
    const { findByText } = render(
      <PurchaseScreen visible onClose={jest.fn()} />,
    );

    expect(await findByText('AndroidIRCX Premium')).toBeTruthy();
    expect(await findByText('Remove Ads')).toBeTruthy();
    expect(await findByText('Pro Unlimited')).toBeTruthy();
    expect(await findByText('Supporter Pro')).toBeTruthy();
    expect(mockRNIap.initConnection).toHaveBeenCalled();
    expect(mockRNIap.fetchProducts).toHaveBeenCalled();
  });

  it('calls onClose from header button', async () => {
    const onClose = jest.fn();
    const { findByText } = render(<PurchaseScreen visible onClose={onClose} />);

    fireEvent.press(await findByText('✕'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('restores purchases and shows success feedback', async () => {
    const {
      inAppPurchaseService,
    } = require('../../src/services/InAppPurchaseService');
    mockRNIap.getAvailablePurchases.mockResolvedValue([
      {
        productId: 'remove_ads',
        transactionReceipt: 'receipt-1',
        purchaseToken: 'token-1',
      },
    ]);

    const { findByText } = render(
      <PurchaseScreen visible onClose={jest.fn()} />,
    );

    fireEvent.press(await findByText('Restore purchases'));

    await waitFor(() => {
      expect(inAppPurchaseService.processPurchase).toHaveBeenCalledWith(
        'remove_ads',
        'token-1',
      );
    });
    expect(Alert.alert).toHaveBeenCalledWith(
      'Restore complete',
      'Your purchases have been restored.',
    );
  });

  it('shows error alert when iap initialization fails', async () => {
    mockRNIap.initConnection.mockRejectedValueOnce(new Error('iap failed'));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();

    render(<PurchaseScreen visible onClose={jest.fn()} />);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Error',
        'Failed to load products. Please try again later.',
      );
    });

    errorSpy.mockRestore();
  });

  it('requests purchase when tapping a product', async () => {
    const { findAllByText } = render(
      <PurchaseScreen visible onClose={jest.fn()} />,
    );

    const purchaseButtons = await findAllByText('Purchase');
    fireEvent.press(purchaseButtons[0]);

    await waitFor(() => {
      expect(mockRNIap.requestPurchase).toHaveBeenCalled();
    });
  });

  it('shows purchased state for already-owned products', async () => {
    const {
      inAppPurchaseService,
    } = require('../../src/services/InAppPurchaseService');
    inAppPurchaseService.hasPurchased.mockImplementation(
      (productId: string) => productId === 'remove_ads',
    );

    const { findByText, queryAllByText } = render(
      <PurchaseScreen visible onClose={jest.fn()} />,
    );

    expect(await findByText('✓ Purchased')).toBeTruthy();
    expect(queryAllByText('Purchase').length).toBeGreaterThan(0);
  });

  it('processes successful purchase updates', async () => {
    const {
      inAppPurchaseService,
    } = require('../../src/services/InAppPurchaseService');
    render(<PurchaseScreen visible onClose={jest.fn()} />);

    await waitFor(() => {
      expect(purchaseUpdatedHandler).toBeDefined();
    });

    await act(async () => {
      await purchaseUpdatedHandler?.({
        productId: 'remove_ads',
        transactionReceipt: 'receipt-123',
        purchaseToken: 'token-123',
      });
    });

    expect(mockRNIap.finishTransaction).toHaveBeenCalled();
    expect(inAppPurchaseService.processPurchase).toHaveBeenCalledWith(
      'remove_ads',
      'token-123',
    );
    expect(Alert.alert).toHaveBeenCalledWith(
      'Purchase Successful',
      'Thank you for your purchase!',
      [{ text: 'OK' }],
    );
  });

  it('shows purchase failed alert when finishing transaction fails', async () => {
    mockRNIap.finishTransaction.mockRejectedValueOnce(
      new Error('finish failed'),
    );
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();

    render(<PurchaseScreen visible onClose={jest.fn()} />);

    await waitFor(() => {
      expect(purchaseUpdatedHandler).toBeDefined();
    });

    await act(async () => {
      await purchaseUpdatedHandler?.({
        productId: 'remove_ads',
        transactionReceipt: 'receipt-123',
        purchaseToken: 'token-123',
      });
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Purchase Failed',
      'Please try again later.',
    );
    errorSpy.mockRestore();
  });

  it('ignores cancelled purchase errors from listener', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();
    render(<PurchaseScreen visible onClose={jest.fn()} />);

    await waitFor(() => {
      expect(purchaseErrorHandler).toBeDefined();
    });

    act(() => {
      purchaseErrorHandler?.({
        code: 'E_USER_CANCELLED',
        message: 'cancelled',
      });
    });

    expect(Alert.alert).not.toHaveBeenCalledWith(
      'Purchase Failed',
      'cancelled',
    );
    errorSpy.mockRestore();
  });

  it('handles restore purchase errors with feedback', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();
    mockRNIap.getAvailablePurchases.mockRejectedValue(
      new Error('restore failed'),
    );

    const { findByText } = render(
      <PurchaseScreen visible onClose={jest.fn()} />,
    );
    fireEvent.press(await findByText('Restore purchases'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Restore failed',
        'Please try again later.',
      );
    });
    errorSpy.mockRestore();
  });
});

/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from './Logger';

// Product IDs
export const PRODUCT_REMOVE_ADS = 'remove_ads';
export const PRODUCT_PRO_UNLIMITED = 'pro_unlimited';
export const PRODUCT_SUPPORTER_PRO = 'supporter_pro';

// Storage keys
const PURCHASES_STORAGE_KEY = '@AndroidIRCX:purchases';
const PURCHASE_TOKENS_KEY = '@AndroidIRCX:purchaseTokens';

// Product details for display
export interface ProductDetails {
  id: string;
  title: string;
  description: string;
  price: string;
  priceAmountMicros: number;
  priceCurrencyCode: string;
  features: string[];
}

export const PRODUCT_CATALOG: Record<
  string,
  Omit<ProductDetails, 'price' | 'priceAmountMicros' | 'priceCurrencyCode'>
> = {
  [PRODUCT_REMOVE_ADS]: {
    id: PRODUCT_REMOVE_ADS,
    title: 'Remove Ads',
    description: 'Remove all banner advertisements from the app',
    features: [
      'No banner ads',
      'Scripting time still limited',
      'One-time purchase',
    ],
  },
  [PRODUCT_PRO_UNLIMITED]: {
    id: PRODUCT_PRO_UNLIMITED,
    title: 'Pro: Unlimited Scripting',
    description: 'Remove ads and get unlimited scripting time',
    features: [
      'No banner ads',
      'Unlimited scripting time',
      'One-time purchase',
      'Lifetime access',
    ],
  },
  [PRODUCT_SUPPORTER_PRO]: {
    id: PRODUCT_SUPPORTER_PRO,
    title: 'Supporter Pro',
    description: 'All Pro features plus support open-source development',
    features: [
      'No banner ads',
      'Unlimited scripting time',
      'Supporter badge',
      'Support open-source development ❤️',
      'One-time purchase',
      'Lifetime access',
    ],
  },
};

interface PurchaseState {
  [PRODUCT_REMOVE_ADS]: boolean;
  [PRODUCT_PRO_UNLIMITED]: boolean;
  [PRODUCT_SUPPORTER_PRO]: boolean;
}

type PurchaseListener = (purchaseState: PurchaseState) => void;

class InAppPurchaseService {
  private purchases: PurchaseState = {
    [PRODUCT_REMOVE_ADS]: false,
    [PRODUCT_PRO_UNLIMITED]: false,
    [PRODUCT_SUPPORTER_PRO]: false,
  };
  private listeners: Set<PurchaseListener> = new Set();
  private initialized: boolean = false;

  async initialize() {
    if (this.initialized) {
      logger.info('iap', 'InAppPurchaseService already initialized');
      return;
    }

    logger.info('iap', 'Starting InAppPurchaseService initialization...');

    // Load purchases from storage
    await this.loadPurchases();
    this.notifyListeners();

    this.initialized = true;
    logger.info('iap', 'InAppPurchaseService initialized');
  }

  private async loadPurchases() {
    try {
      const raw = await AsyncStorage.getItem(PURCHASES_STORAGE_KEY);
      if (raw) {
        const stored: PurchaseState = JSON.parse(raw);
        this.purchases = {
          [PRODUCT_REMOVE_ADS]: stored[PRODUCT_REMOVE_ADS] || false,
          [PRODUCT_PRO_UNLIMITED]: stored[PRODUCT_PRO_UNLIMITED] || false,
          [PRODUCT_SUPPORTER_PRO]: stored[PRODUCT_SUPPORTER_PRO] || false,
        };
        logger.info(
          'iap',
          `Loaded purchases: ${JSON.stringify(this.purchases)}`,
        );
      }
    } catch (error) {
      logger.error('iap', `Failed to load purchases: ${String(error)}`);
    }
  }

  private async savePurchases() {
    try {
      await AsyncStorage.setItem(
        PURCHASES_STORAGE_KEY,
        JSON.stringify(this.purchases),
      );
      logger.info('iap', `Saved purchases: ${JSON.stringify(this.purchases)}`);
    } catch (error) {
      logger.error('iap', `Failed to save purchases: ${String(error)}`);
    }
  }

  /**
   * Check if user has purchased a specific product
   */
  hasPurchased(productId: string): boolean {
    return this.purchases[productId as keyof PurchaseState] || false;
  }

  /**
   * Check if user has no ads (any tier)
   * Hierarchy: remove_ads OR pro_unlimited OR supporter_pro
   */
  hasNoAds(): boolean {
    return (
      this.purchases[PRODUCT_REMOVE_ADS] ||
      this.purchases[PRODUCT_PRO_UNLIMITED] ||
      this.purchases[PRODUCT_SUPPORTER_PRO]
    );
  }

  /**
   * Check if user has unlimited scripting
   * Hierarchy: pro_unlimited OR supporter_pro
   */
  hasUnlimitedScripting(): boolean {
    return (
      this.purchases[PRODUCT_PRO_UNLIMITED] ||
      this.purchases[PRODUCT_SUPPORTER_PRO]
    );
  }

  /**
   * Check if user is a supporter
   * Only supporter_pro tier
   */
  isSupporter(): boolean {
    return this.purchases[PRODUCT_SUPPORTER_PRO];
  }

  /**
   * Get the user's highest tier
   */
  getHighestTier(): 'free' | 'remove_ads' | 'pro_unlimited' | 'supporter_pro' {
    if (this.purchases[PRODUCT_SUPPORTER_PRO]) return 'supporter_pro';
    if (this.purchases[PRODUCT_PRO_UNLIMITED]) return 'pro_unlimited';
    if (this.purchases[PRODUCT_REMOVE_ADS]) return 'remove_ads';
    return 'free';
  }

  /**
   * Manually grant a purchase (for testing or promotional purposes)
   */
  async grantPurchase(productId: string) {
    if (!(productId in this.purchases)) {
      logger.error('iap', `Invalid product ID: ${productId}`);
      return;
    }

    this.purchases[productId as keyof PurchaseState] = true;
    await this.savePurchases();
    this.notifyListeners();
    logger.info('iap', `Granted purchase: ${productId}`);
  }

  /**
   * Revoke a purchase (for testing purposes)
   */
  async revokePurchase(productId: string) {
    if (!(productId in this.purchases)) {
      logger.error('iap', `Invalid product ID: ${productId}`);
      return;
    }

    this.purchases[productId as keyof PurchaseState] = false;
    await this.savePurchases();
    this.notifyListeners();
    logger.info('iap', `Revoked purchase: ${productId}`);
  }

  /**
   * Reset all purchases (for testing)
   */
  async resetPurchases() {
    this.purchases = {
      [PRODUCT_REMOVE_ADS]: false,
      [PRODUCT_PRO_UNLIMITED]: false,
      [PRODUCT_SUPPORTER_PRO]: false,
    };
    await this.savePurchases();
    this.notifyListeners();
    logger.info('iap', 'Reset all purchases');
  }

  /**
   * Get all purchase states
   */
  getPurchases(): PurchaseState {
    return { ...this.purchases };
  }

  /**
   * Add a listener for purchase changes
   */
  addListener(listener: PurchaseListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    const purchaseState = this.getPurchases();
    this.listeners.forEach(listener => {
      try {
        listener(purchaseState);
      } catch (error) {
        logger.error('iap', `Listener error: ${String(error)}`);
      }
    });
  }

  /**
   * Process a purchase (to be called after successful payment)
   */
  async processPurchase(
    productId: string,
    purchaseToken: string,
  ): Promise<boolean> {
    try {
      logger.info('iap', `Processing purchase: ${productId}`);

      // Validate product ID
      if (!(productId in this.purchases)) {
        logger.error('iap', `Invalid product ID: ${productId}`);
        return false;
      }

      // Store the purchase
      this.purchases[productId as keyof PurchaseState] = true;
      await this.savePurchases();

      // Store purchase token for verification
      await this.storePurchaseToken(productId, purchaseToken);

      // Notify listeners
      this.notifyListeners();

      logger.info('iap', `Purchase processed successfully: ${productId}`);
      return true;
    } catch (error) {
      logger.error('iap', `Failed to process purchase: ${String(error)}`);
      return false;
    }
  }

  private async storePurchaseToken(productId: string, token: string) {
    try {
      const raw = await AsyncStorage.getItem(PURCHASE_TOKENS_KEY);
      const tokens = raw ? JSON.parse(raw) : {};
      tokens[productId] = token;
      await AsyncStorage.setItem(PURCHASE_TOKENS_KEY, JSON.stringify(tokens));
      logger.info('iap', `Stored purchase token for ${productId}`);
    } catch (error) {
      logger.error('iap', `Failed to store purchase token: ${String(error)}`);
    }
  }

  /**
   * Get purchase token for a product (for verification)
   */
  async getPurchaseToken(productId: string): Promise<string | null> {
    try {
      const raw = await AsyncStorage.getItem(PURCHASE_TOKENS_KEY);
      if (!raw) return null;
      const tokens = JSON.parse(raw);
      return tokens[productId] || null;
    } catch (error) {
      logger.error('iap', `Failed to get purchase token: ${String(error)}`);
      return null;
    }
  }
}

export const inAppPurchaseService = new InAppPurchaseService();

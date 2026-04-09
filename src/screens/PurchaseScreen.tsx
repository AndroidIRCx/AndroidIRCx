/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import {
  inAppPurchaseService,
  PRODUCT_REMOVE_ADS,
  PRODUCT_PRO_UNLIMITED,
  PRODUCT_SUPPORTER_PRO,
  PRODUCT_CATALOG,
} from '../services/InAppPurchaseService';
import { useT } from '../i18n/transifex';
import * as RNIap from 'react-native-iap';
import type { Product, Purchase, PurchaseError } from 'react-native-iap';

interface PurchaseScreenProps {
  visible: boolean;
  onClose: () => void;
}

type ProductListItem = {
  id: string;
  displayPrice?: string | null;
  price?: string | number | null;
};

const skuList = [
  PRODUCT_REMOVE_ADS,
  PRODUCT_PRO_UNLIMITED,
  PRODUCT_SUPPORTER_PRO,
];
const getPurchaseReceipt = (purchase: Purchase): string =>
  purchase.purchaseToken ||
  ((purchase as Purchase & { transactionReceipt?: string })
    .transactionReceipt ??
    '');

export const PurchaseScreen: React.FC<PurchaseScreenProps> = ({
  visible,
  onClose,
}) => {
  const t = useT();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const tRef = useRef(t);
  const [hasRemoveAds, setHasRemoveAds] = useState(false);
  const [hasProUnlimited, setHasProUnlimited] = useState(false);
  const [hasSupporterPro, setHasSupporterPro] = useState(false);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const translate = useCallback((key: string) => tRef.current(key), []);

  const withTimeout = async <T,>(
    promise: Promise<T>,
    timeoutMs: number,
    label: string,
  ): Promise<T> => {
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    const timeout = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error(`${label} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      return await Promise.race([promise, timeout]);
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  };

  // Initialize IAP and fetch products
  const restorePurchases = useCallback(
    async (showFeedback: boolean = false) => {
      try {
        setRestoring(true);
        console.log('Restoring purchases...');
        const purchases = await RNIap.getAvailablePurchases();
        console.log('Available purchases:', purchases);

        for (const purchase of purchases) {
          if (skuList.includes(purchase.productId)) {
            await inAppPurchaseService.processPurchase(
              purchase.productId,
              getPurchaseReceipt(purchase),
            );
          }
        }

        if (showFeedback) {
          Alert.alert(
            translate('Restore complete'),
            translate('Your purchases have been restored.'),
          );
        }
      } catch (error) {
        console.error('Error restoring purchases:', error);
        if (showFeedback) {
          Alert.alert(
            translate('Restore failed'),
            translate('Please try again later.'),
          );
        }
      } finally {
        setRestoring(false);
      }
    },
    [translate],
  );

  useEffect(() => {
    let purchaseUpdateSubscription: any;
    let purchaseErrorSubscription: any;

    const initIAP = async () => {
      try {
        // Initialize connection to Google Play
        await RNIap.initConnection();
        if (Platform.OS === 'android') {
          const flushPending = (RNIap as any)
            .flushFailedPurchasesCachedAsPendingAndroid;
          if (typeof flushPending === 'function') {
            await flushPending();
          }
        }
        console.log('IAP connection initialized');

        // Get products from Google Play
        const availableProducts =
          (await RNIap.fetchProducts({ skus: skuList, type: 'in-app' })) ?? [];
        const inAppProducts = availableProducts.filter(
          (product): product is Product => product.type === 'in-app',
        );
        console.log('Available products:', inAppProducts);
        setProducts(inAppProducts);
        setLoading(false);

        // Restore purchases on mount
        await restorePurchases();

        // Listen for purchase updates
        purchaseUpdateSubscription = RNIap.purchaseUpdatedListener(
          async (purchase: Purchase) => {
            console.log('Purchase updated:', purchase);
            const receipt = getPurchaseReceipt(purchase);
            const hasProof =
              Platform.OS === 'android' ? Boolean(receipt) : Boolean(receipt);

            if (hasProof) {
              setPurchasing(null);
              try {
                // Acknowledge the purchase
                await withTimeout(
                  RNIap.finishTransaction({ purchase, isConsumable: false }),
                  10000,
                  'finishTransaction',
                );

                // Process the purchase in our service
                await inAppPurchaseService.processPurchase(
                  purchase.productId,
                  receipt,
                );

                setPurchasing(null);
                Alert.alert(
                  translate('Purchase Successful'),
                  translate('Thank you for your purchase!'),
                  [{ text: 'OK' }],
                );
              } catch (error) {
                console.error('Error finishing transaction:', error);
                setPurchasing(null);
                Alert.alert(
                  translate('Purchase Failed'),
                  translate('Please try again later.'),
                );
              }
            } else {
              console.warn(
                'Purchase missing receipt/token, skipping processing',
              );
              setPurchasing(null);
            }
          },
        );

        // Listen for purchase errors
        purchaseErrorSubscription = RNIap.purchaseErrorListener(
          (error: PurchaseError) => {
            console.error('Purchase error:', error);
            setPurchasing(null);
            if (String(error.code) !== 'E_USER_CANCELLED') {
              Alert.alert(
                translate('Purchase Failed'),
                error.message || translate('Please try again later.'),
              );
            }
          },
        );
      } catch (error) {
        console.error('Error initializing IAP:', error);
        setLoading(false);
        Alert.alert(
          translate('Error'),
          translate('Failed to load products. Please try again later.'),
        );
      }
    };

    if (visible) {
      initIAP();
    }

    return () => {
      // Cleanup subscriptions
      if (purchaseUpdateSubscription) {
        purchaseUpdateSubscription.remove();
      }
      if (purchaseErrorSubscription) {
        purchaseErrorSubscription.remove();
      }
      RNIap.endConnection().catch(() => null);
    };
  }, [restorePurchases, translate, visible]);

  // Update purchase state
  useEffect(() => {
    const updatePurchaseState = () => {
      setHasRemoveAds(inAppPurchaseService.hasPurchased(PRODUCT_REMOVE_ADS));
      setHasProUnlimited(
        inAppPurchaseService.hasPurchased(PRODUCT_PRO_UNLIMITED),
      );
      setHasSupporterPro(
        inAppPurchaseService.hasPurchased(PRODUCT_SUPPORTER_PRO),
      );
    };

    updatePurchaseState();
    const unsubscribe = inAppPurchaseService.addListener(updatePurchaseState);
    return unsubscribe;
  }, []);

  const handlePurchase = async (productId: string) => {
    setPurchasing(productId);

    try {
      // Trigger Google Play Billing
      const request = Platform.select({
        ios: {
          request: {
            apple: {
              sku: productId,
              andDangerouslyFinishTransactionAutomatically: false,
            },
          },
          type: 'in-app' as const,
        },
        android: {
          request: {
            google: {
              skus: [productId],
            },
          },
          type: 'in-app' as const,
        },
        default: {
          request: {
            google: {
              skus: [productId],
            },
          },
          type: 'in-app' as const,
        },
      });

      if (!request) {
        throw new Error('Unsupported platform for purchases.');
      }

      await RNIap.requestPurchase(request);
      // The purchase will be handled by purchaseUpdatedListener
    } catch (error: any) {
      console.error('Purchase error:', error);
      setPurchasing(null);

      // Don't show error if user cancelled
      if (String(error.code) !== 'E_USER_CANCELLED') {
        Alert.alert(
          t('Purchase Failed'),
          error.message || t('Please try again later.'),
        );
      }
    }
  };

  const getProductPrice = (productId: string): string => {
    const product = products.find(p => p.id === productId);
    if (!product) {
      return '€?.??';
    }
    if (product.displayPrice) {
      return product.displayPrice;
    }
    if (product.price !== null && product.price !== undefined) {
      return String(product.price);
    }
    return '€?.??';
  };

  const renderProductCard = (
    productId: string,
    isPurchased: boolean,
    isRecommended: boolean = false,
  ) => {
    const product = PRODUCT_CATALOG[productId];
    const price = getProductPrice(productId);
    const isPurchasing = purchasing === productId;

    return (
      <View
        style={[styles.productCard, isRecommended && styles.recommendedCard]}
      >
        {isRecommended && (
          <View style={styles.recommendedBadge}>
            <Text style={styles.recommendedText}>RECOMMENDED</Text>
          </View>
        )}

        <View style={styles.productHeader}>
          <Text style={styles.productTitle}>{product.title}</Text>
          <Text style={styles.productPrice}>{price}</Text>
        </View>

        <Text style={styles.productDescription}>{product.description}</Text>

        <View style={styles.featuresContainer}>
          {product.features.map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <Text style={styles.featureIcon}>✓</Text>
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[
            styles.purchaseButton,
            isPurchased && styles.purchasedButton,
            isRecommended && !isPurchased && styles.recommendedButton,
          ]}
          onPress={() => !isPurchased && handlePurchase(productId)}
          disabled={isPurchased || isPurchasing}
        >
          {isPurchasing ? (
            <ActivityIndicator color={colors.buttonPrimaryText} />
          ) : (
            <Text style={styles.purchaseButtonText}>
              {isPurchased ? '✓ Purchased' : 'Purchase'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>AndroidIRCX Premium</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          <Text style={styles.subtitle}>
            Choose the plan that's right for you
          </Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>{t('Loading products...')}</Text>
            </View>
          ) : (
            <>
              {renderProductCard(PRODUCT_REMOVE_ADS, hasRemoveAds)}
              {renderProductCard(PRODUCT_PRO_UNLIMITED, hasProUnlimited, true)}
              {renderProductCard(PRODUCT_SUPPORTER_PRO, hasSupporterPro)}
            </>
          )}

          <TouchableOpacity
            style={[
              styles.restoreButton,
              (restoring || loading) && styles.restoreButtonDisabled,
            ]}
            onPress={() => restorePurchases(true)}
            disabled={restoring || loading}
          >
            {restoring ? (
              <ActivityIndicator color={colors.buttonPrimaryText} />
            ) : (
              <Text style={styles.restoreButtonText}>
                {t('Restore purchases')}
              </Text>
            )}
          </TouchableOpacity>

          <View style={styles.infoSection}>
            <Text style={styles.infoTitle}>Why Premium?</Text>
            <Text style={styles.infoText}>
              • One-time purchase, lifetime access{'\n'}• Support open-source
              development{'\n'}• No subscriptions or recurring fees{'\n'}• All
              features unlocked forever
            </Text>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Purchases are processed securely through Google Play.
            </Text>
            <Text style={styles.footerText}>
              You can restore purchases on any device with the same Google
              account.
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
    },
    closeButton: {
      padding: 8,
    },
    closeButtonText: {
      fontSize: 24,
      color: colors.text,
      fontWeight: '300',
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 20,
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      marginBottom: 24,
      textAlign: 'center',
    },
    productCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
      position: 'relative',
    },
    recommendedCard: {
      borderColor: colors.accent,
      borderWidth: 2,
    },
    recommendedBadge: {
      position: 'absolute',
      top: -12,
      right: 16,
      backgroundColor: colors.accent,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
    },
    recommendedText: {
      color: colors.onAccent,
      fontSize: 12,
      fontWeight: '600',
    },
    productHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    productTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    productPrice: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.accent,
    },
    productDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 16,
    },
    featuresContainer: {
      marginBottom: 16,
    },
    featureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    featureIcon: {
      fontSize: 16,
      color: colors.success,
      marginRight: 8,
      width: 20,
    },
    featureText: {
      fontSize: 14,
      color: colors.text,
      flex: 1,
    },
    purchaseButton: {
      backgroundColor: colors.buttonPrimary,
      paddingVertical: 14,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 48,
    },
    recommendedButton: {
      backgroundColor: colors.accent,
    },
    purchasedButton: {
      backgroundColor: colors.success,
    },
    purchaseButtonText: {
      color: colors.buttonPrimaryText,
      fontSize: 16,
      fontWeight: '600',
    },
    restoreButton: {
      backgroundColor: colors.buttonPrimary,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
      marginBottom: 8,
      minHeight: 44,
    },
    restoreButtonDisabled: {
      opacity: 0.7,
    },
    restoreButtonText: {
      color: colors.buttonPrimaryText,
      fontSize: 14,
      fontWeight: '600',
    },
    infoSection: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 20,
      marginTop: 8,
      marginBottom: 24,
    },
    infoTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    infoText: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 22,
    },
    footer: {
      paddingTop: 16,
      paddingBottom: 32,
    },
    footerText: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 8,
    },
    loadingContainer: {
      paddingVertical: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingText: {
      marginTop: 16,
      fontSize: 14,
      color: colors.textSecondary,
    },
  });

/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as RNIap from 'react-native-iap';
import type { ProductSubscription, Purchase, PurchaseError } from 'react-native-iap';
import { ErrorCode } from 'react-native-iap';
import { useTheme } from '../hooks/useTheme';
import { useT } from '../i18n/transifex';
import {
  privacyRelayService,
  PRIVACY_RELAY_BASE_PLAN_IDS,
  PRIVACY_RELAY_PRODUCT_ID,
} from '../services/PrivacyRelayService';
import { mediaSettingsService } from '../services/MediaSettingsService';
import type { PrivacyRelayTurnCredentials } from '../types/privacyRelay';

interface PrivacyRelayScreenProps {
  visible: boolean;
  onClose: () => void;
}

interface RelayOffer {
  basePlanId: string;
  offerToken: string | null;
  price: string;
}

const emptyOffers: RelayOffer[] = [];

export const PrivacyRelayScreen: React.FC<PrivacyRelayScreenProps> = ({
  visible,
  onClose,
}) => {
  const t = useT();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [subscription, setSubscription] = useState(privacyRelayService.getSubscription());
  const [product, setProduct] = useState<ProductSubscription | null>(null);
  const [offers, setOffers] = useState<RelayOffer[]>(emptyOffers);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(false);
  const [purchasingPlan, setPurchasingPlan] = useState<string | null>(null);
  const [syncingBackend, setSyncingBackend] = useState(false);
  const [lastCredentialFetch, setLastCredentialFetch] = useState<PrivacyRelayTurnCredentials | null>(null);
  const [backendStatus, setBackendStatus] = useState<string | null>(null);

  const relayState = privacyRelayService.getRelayAccessState();

  const extractOffers = useCallback((sub: ProductSubscription | null): RelayOffer[] => {
    if (!sub) {
      return emptyOffers;
    }

    const rawOffers =
      (sub as any).subscriptionOfferDetails ||
      (sub as any).subscriptionOfferDetailsAndroid ||
      [];

    if (!Array.isArray(rawOffers)) {
      return emptyOffers;
    }

    return rawOffers.map((offer: any) => ({
      basePlanId: offer.basePlanId || 'unknown',
      offerToken: offer.offerToken || null,
      price:
        offer.pricingPhases?.pricingPhaseList?.[0]?.formattedPrice ||
        sub.displayPrice ||
        t('Unavailable'),
    }));
  }, [t]);

  const syncSubscriptionState = useCallback(() => {
    setSubscription(privacyRelayService.getSubscription());
  }, []);

  const syncPurchaseWithBackend = useCallback(async (
    purchaseToken: string,
    basePlanId?: string | null
  ) => {
    console.log('[PrivacyRelayScreen] syncPurchaseWithBackend start', {
      hasPurchaseToken: Boolean(purchaseToken),
      basePlanId: basePlanId ?? null,
    });
    setSyncingBackend(true);
    setBackendStatus(t('Syncing subscription with backend...'));

    try {
      await privacyRelayService.registerPurchaseWithBackend(purchaseToken, basePlanId ?? null);
      setBackendStatus(t('Fetching TURN credentials from backend...'));
      const credentials = await privacyRelayService.fetchTurnCredentials(purchaseToken);
      console.log('[PrivacyRelayScreen] syncPurchaseWithBackend success', {
        ttl: credentials.ttl,
        username: credentials.username,
        callId: credentials.callId,
      });
      setLastCredentialFetch(credentials);
      setBackendStatus(
        t('TURN credentials loaded. TTL: {ttl}s', { ttl: String(credentials.ttl || 0) })
      );
      const alreadyAutoEnabled = await mediaSettingsService.hasAutoEnabledNicklistCallActionsFromRelay();
      if (!alreadyAutoEnabled) {
        await mediaSettingsService.setCallNicklistCallActionsEnabled(true);
        await mediaSettingsService.markNicklistCallActionsAutoEnabledFromRelay();
      }
      syncSubscriptionState();
      return credentials;
    } catch (error) {
      console.log(
        '[PrivacyRelayScreen] syncPurchaseWithBackend failed',
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    } finally {
      console.log('[PrivacyRelayScreen] syncPurchaseWithBackend finish');
      setSyncingBackend(false);
    }
  }, [syncSubscriptionState, t]);

  const initializeStore = useCallback(async () => {
    setLoading(true);
    try {
      await privacyRelayService.initialize();
      await RNIap.initConnection();
      const products = (await RNIap.fetchProducts({
        skus: [PRIVACY_RELAY_PRODUCT_ID],
        type: 'subs',
      })) ?? [];

      const relayProduct = products.find(
        (item): item is ProductSubscription =>
          item.id === PRIVACY_RELAY_PRODUCT_ID && item.type === 'subs'
      ) || null;

      setProduct(relayProduct);
      setOffers(extractOffers(relayProduct));
      syncSubscriptionState();
    } catch (error) {
      Alert.alert(
        t('Store Error'),
        error instanceof Error ? error.message : t('Failed to load Privacy Relay subscription.')
      );
    } finally {
      setLoading(false);
    }
  }, [extractOffers, syncSubscriptionState, t]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    let purchaseUpdateSubscription: { remove: () => void } | null = null;
    let purchaseErrorSubscription: { remove: () => void } | null = null;
    const unsubscribe = privacyRelayService.addListener(setSubscription);

    initializeStore();
    setLastCredentialFetch(null);
    setBackendStatus(null);

    purchaseUpdateSubscription = RNIap.purchaseUpdatedListener(
      async (purchase: Purchase) => {
        if (purchase.productId !== PRIVACY_RELAY_PRODUCT_ID) {
          return;
        }

        try {
          console.log('[PrivacyRelayScreen] purchaseUpdatedListener fired', {
            productId: purchase.productId,
            transactionId: (purchase as any).transactionId,
            hasPurchaseToken: Boolean(purchase.purchaseToken || purchase.transactionReceipt),
          });
          await RNIap.finishTransaction({ purchase, isConsumable: false });
          const purchaseToken = purchase.purchaseToken || purchase.transactionReceipt || '';
          if (!purchaseToken) {
            throw new Error('Missing purchase token for Privacy Relay subscription.');
          }

          await syncPurchaseWithBackend(purchaseToken, purchasingPlan);
          Alert.alert(
            t('Privacy Relay enabled'),
            t('Relay routing is now available for eligible calls.')
          );
        } catch (error) {
          console.log(
            '[PrivacyRelayScreen] purchaseUpdatedListener failed',
            error instanceof Error ? error.message : String(error)
          );
          Alert.alert(
            t('Purchase Failed'),
            error instanceof Error ? error.message : t('Failed to complete subscription.')
          );
        } finally {
          setPurchasingPlan(null);
        }
      }
    ) as unknown as { remove: () => void };

    purchaseErrorSubscription = RNIap.purchaseErrorListener(
      (error: PurchaseError) => {
        if (error.productId && error.productId !== PRIVACY_RELAY_PRODUCT_ID) {
          return;
        }
        console.log('[PrivacyRelayScreen] purchaseErrorListener', {
          code: error.code,
          message: error.message,
          productId: error.productId,
        });
        setPurchasingPlan(null);
        if (error.code !== ErrorCode.UserCancelled) {
          Alert.alert(
            t('Purchase Failed'),
            error.message || t('Unable to start subscription purchase.')
          );
        }
      }
    ) as unknown as { remove: () => void };

    return () => {
      unsubscribe();
      purchaseUpdateSubscription?.remove();
      purchaseErrorSubscription?.remove();
      RNIap.endConnection().catch(() => null);
    };
  }, [initializeStore, purchasingPlan, syncPurchaseWithBackend, t, visible]);

  const handlePurchase = useCallback(async (planId: string) => {
    const selectedOffer = offers.find(offer => offer.basePlanId === planId) || null;
    console.log('[PrivacyRelayScreen] handlePurchase', {
      planId,
      offerTokenPresent: Boolean(selectedOffer?.offerToken),
      platform: Platform.OS,
    });
    setPurchasingPlan(planId);

    try {
      let request: any;
      if (Platform.OS === 'ios') {
        request = {
          request: {
            apple: {
              sku: PRIVACY_RELAY_PRODUCT_ID,
            },
          },
          type: 'subs',
        };
      } else {
        if (!selectedOffer?.offerToken) {
          throw new Error('Missing Google Play offer token for this base plan.');
        }
        request = {
          request: {
            google: {
              skus: [PRIVACY_RELAY_PRODUCT_ID],
              subscriptionOffers: [
                {
                  sku: PRIVACY_RELAY_PRODUCT_ID,
                  offerToken: selectedOffer.offerToken,
                },
              ],
            },
          },
          type: 'subs',
        };
      }

      await RNIap.requestPurchase(request);
    } catch (error: any) {
      setPurchasingPlan(null);
      if (error?.code !== ErrorCode.UserCancelled) {
        Alert.alert(
          t('Purchase Failed'),
          error?.message || t('Unable to start subscription purchase.')
        );
      }
    }
  }, [offers, t]);

  const handleRestore = useCallback(async () => {
    console.log('[PrivacyRelayScreen] handleRestore start');
    setRestoring(true);
    setBackendStatus(t('Checking existing purchases...'));
    try {
      const purchases = await RNIap.getAvailablePurchases();
      const relayPurchases = purchases.filter(purchase => purchase.productId === PRIVACY_RELAY_PRODUCT_ID);
      console.log('[PrivacyRelayScreen] handleRestore purchases', {
        total: purchases.length,
        relay: relayPurchases.length,
      });
      const restoredPurchase = relayPurchases.find(
        purchase => Boolean(purchase.purchaseToken || purchase.transactionReceipt)
      );
      const restored = await privacyRelayService.restoreFromPurchaseTokens(
        relayPurchases.map(purchase => ({
          purchaseToken: purchase.purchaseToken || purchase.transactionReceipt || '',
          basePlanId: subscription?.basePlanId || null,
        }))
      );

      if (restoredPurchase) {
        await syncPurchaseWithBackend(
          restoredPurchase.purchaseToken || restoredPurchase.transactionReceipt || '',
          subscription?.basePlanId || null
        );
      }

      Alert.alert(
        t('Restore complete'),
        restored > 0
          ? t('Your Privacy Relay subscription was restored.')
          : t('No Privacy Relay subscriptions were found to restore.')
      );
    } catch (error) {
      Alert.alert(
        t('Restore failed'),
        error instanceof Error ? error.message : t('Unable to restore purchases.')
      );
      setBackendStatus(error instanceof Error ? error.message : t('Unable to restore purchases.'));
    } finally {
      console.log('[PrivacyRelayScreen] handleRestore finish');
      setRestoring(false);
    }
  }, [subscription?.basePlanId, syncPurchaseWithBackend, t]);

  const handleTestCredentials = useCallback(async () => {
    const purchaseToken = privacyRelayService.getSubscription()?.purchaseToken;
    if (!purchaseToken) {
      Alert.alert(t('No subscription'), t('Buy or restore Privacy Relay first.'));
      return;
    }

    try {
      console.log('[PrivacyRelayScreen] handleTestCredentials start');
      await syncPurchaseWithBackend(purchaseToken, privacyRelayService.getSubscription()?.basePlanId ?? null);
      Alert.alert(t('Relay ready'), t('TURN credentials were fetched successfully.'));
    } catch (error) {
      Alert.alert(
        t('Relay test failed'),
        error instanceof Error ? error.message : t('Unable to fetch TURN credentials.')
      );
    }
  }, [syncPurchaseWithBackend, t]);

  const renderPlanCard = (planId: string, fallbackTitle: string) => {
    const offer = offers.find(item => item.basePlanId === planId) || null;
    const isCurrent = subscription?.basePlanId === planId && relayState.hasSubscription;
    const isBusy = purchasingPlan === planId;

    return (
      <View key={planId} style={styles.planCard}>
        <View style={styles.planHeader}>
          <Text style={styles.planTitle}>{fallbackTitle}</Text>
          <Text style={styles.planPrice}>{offer?.price || product?.displayPrice || t('Unavailable')}</Text>
        </View>
        <Text style={styles.planDescription}>
          {planId === PRIVACY_RELAY_BASE_PLAN_IDS.monthly
            ? t('Monthly relay access using turn.dbase.in.rs')
            : t('Yearly relay access using turn.dbase.in.rs')}
        </Text>
          <TouchableOpacity
            style={[styles.primaryButton, isCurrent && styles.successButton]}
            onPress={() => !isCurrent && handlePurchase(planId)}
            disabled={isCurrent || isBusy || (!offer && Platform.OS === 'android')}
          >
          {isBusy ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.primaryButtonText}>
              {isCurrent ? t('Active') : t('Subscribe')}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('Privacy Relay')}</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeText}>{t('Close')}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.statusCard}>
            <Text style={styles.statusTitle}>
              {relayState.hasSubscription ? t('Subscription active') : t('Subscription inactive')}
            </Text>
            <Text style={styles.statusText}>
              {relayState.hasSubscription
                ? t('Relay routing can be offered for calls that need TURN fallback.')
                : t('Direct P2P remains default. TURN relay is only offered to subscribed users.')}
            </Text>
            {!!backendStatus && (
              <Text style={styles.backendStatusText}>{backendStatus}</Text>
            )}
            {syncingBackend && (
              <View style={styles.inlineLoader}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            )}
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>{t('TURN setup')}</Text>
            <Text style={styles.infoLine}>{`Host: ${relayState.relayServer.host}`}</Text>
            <Text style={styles.infoLine}>{`STUN: ${relayState.relayServer.stunUrls[0]}`}</Text>
            <Text style={styles.infoLine}>{`TURN TLS: turns:${relayState.relayServer.host}:${relayState.relayServer.tlsPort}?transport=tcp`}</Text>
            <Text style={styles.infoFootnote}>
              {t('Credentials are not embedded in the app. They must be issued by your backend per session.')}
            </Text>
          </View>

          {loading ? (
            <View style={styles.loadingBlock}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <>
              {renderPlanCard(PRIVACY_RELAY_BASE_PLAN_IDS.monthly, t('Monthly'))}
              {renderPlanCard(PRIVACY_RELAY_BASE_PLAN_IDS.yearly, t('Yearly'))}
            </>
          )}

          <TouchableOpacity
            style={[styles.secondaryButton, restoring && styles.disabledButton]}
            onPress={handleRestore}
            disabled={restoring || syncingBackend}
          >
            {restoring ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={styles.secondaryButtonText}>{t('Restore Purchases')}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, (syncingBackend || !subscription) && styles.disabledButton]}
            onPress={handleTestCredentials}
            disabled={syncingBackend || !subscription}
          >
            {syncingBackend ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={styles.secondaryButtonText}>{t('Test Relay Credentials')}</Text>
            )}
          </TouchableOpacity>

          {!!lastCredentialFetch && (
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>{t('Last backend test')}</Text>
              <Text style={styles.infoLine}>{`Username: ${lastCredentialFetch.username}`}</Text>
              <Text style={styles.infoLine}>{`TTL: ${lastCredentialFetch.ttl}s`}</Text>
              <Text style={styles.infoLine}>{`Call ID: ${lastCredentialFetch.callId}`}</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  closeText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    padding: 16,
    gap: 16,
  },
  statusCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
  },
  statusTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  statusText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  backendStatusText: {
    color: colors.primary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 12,
  },
  inlineLoader: {
    marginTop: 10,
    alignItems: 'flex-start',
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
  },
  infoTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  infoLine: {
    color: colors.text,
    fontSize: 14,
    marginBottom: 6,
  },
  infoFootnote: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  planCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  planTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  planPrice: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '700',
  },
  planDescription: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: 14,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    minHeight: 46,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successButton: {
    backgroundColor: colors.success || colors.primary,
  },
  primaryButtonText: {
    color: colors.onPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    minHeight: 46,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.7,
  },
  loadingBlock: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

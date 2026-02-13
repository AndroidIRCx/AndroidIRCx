/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * ZNC Subscription Screen
 *
 * Full screen for managing ZNC subscription accounts including:
 * - List of all ZNC accounts
 * - Purchase new accounts
 * - Restore purchases
 * - Add ZNC to network
 * - View credentials
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  FlatList,
  Alert,
  ActivityIndicator,
  TextInput,
  Platform,
  RefreshControl,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import Icon from 'react-native-vector-icons/FontAwesome5';
import * as RNIap from 'react-native-iap';
import type { ProductSubscription, PurchaseError, Purchase, SubscriptionPurchase } from 'react-native-iap';
import {
  subscriptionService,
  ZncAccount,
  ZNC_PRODUCT_ID,
  ZNC_BASE_PLAN_ID,
  isZncAccountActive,
  isZncAccountReady,
  formatZncExpiry,
} from '../services/SubscriptionService';
import { settingsService, IRCNetworkConfig, IRCServerConfig } from '../services/SettingsService';
import { biometricAuthService } from '../services/BiometricAuthService';
import { secureStorageService } from '../services/SecureStorageService';
import { NetworkPickerModal } from '../components/modals/NetworkPickerModal';
import { useTheme } from '../hooks/useTheme';
import { useT } from '../i18n/transifex';

interface ZncSubscriptionScreenProps {
  visible: boolean;
  onClose: () => void;
  onNavigateToNetworkSettings?: () => void;
}

export const ZncSubscriptionScreen: React.FC<ZncSubscriptionScreenProps> = ({
  visible,
  onClose,
  onNavigateToNetworkSettings,
}) => {
  const t = useT();
  const { colors } = useTheme();

  // Accounts state
  const [accounts, setAccounts] = useState<ZncAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // IAP state
  const [iapConnected, setIapConnected] = useState(false);
  const [subscription, setSubscription] = useState<ProductSubscription | null>(null);
  const [offerToken, setOfferToken] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [refreshingOffers, setRefreshingOffers] = useState(false);

  // Purchase flow state
  const [showUsernameInput, setShowUsernameInput] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [registering, setRegistering] = useState(false);

  // Network picker state
  const [showNetworkPicker, setShowNetworkPicker] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<ZncAccount | null>(null);

  // Restore state
  const [restoring, setRestoring] = useState(false);

  // Password lock state
  const [biometricLockEnabled, setBiometricLockEnabled] = useState(false);
  const [pinLockEnabled, setPinLockEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [passwordsUnlocked, setPasswordsUnlocked] = useState(true);
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pinEntry, setPinEntry] = useState('');
  const [pinError, setPinError] = useState('');
  const pinResolveRef = useRef<((ok: boolean) => void) | null>(null);
  const PIN_STORAGE_KEY = '@AndroidIRCX:pin-lock';

  // Refs for IAP listeners
  const purchaseUpdateSubscription = useRef<any>(null);
  const purchaseErrorSubscription = useRef<any>(null);
  const pendingUsernameRef = useRef<string>('');
  const pendingPurchaseTokenRef = useRef<string>(''); // For retry when username exists

  const loadPasswordLockState = useCallback(async () => {
    const biometryType = await biometricAuthService.getBiometryType();
    const available = Boolean(biometryType);
    setBiometricAvailable(available);

    const lockSetting = await settingsService.getSetting('biometricPasswordLock', false);
    const pinSetting = await settingsService.getSetting('pinPasswordLock', false);
    const storedPin = await secureStorageService.getSecret(PIN_STORAGE_KEY);

    const biometricEnabled = lockSetting && available;
    const pinEnabled = pinSetting && Boolean(storedPin);

    if (lockSetting && !available) {
      await settingsService.setSetting('biometricPasswordLock', false);
    }
    if (pinSetting && !storedPin) {
      await settingsService.setSetting('pinPasswordLock', false);
    }

    setBiometricLockEnabled(biometricEnabled);
    setPinLockEnabled(pinEnabled);
    setPasswordsUnlocked(!(biometricEnabled || pinEnabled));
  }, []);

  // Initialize IAP and load accounts
  useEffect(() => {
    if (visible) {
      initializeIap();
      loadPasswordLockState();
      loadAccounts();

      // Subscribe to account changes
      const unsubscribe = subscriptionService.addListener(setAccounts);

      return () => {
        unsubscribe();
        cleanupIap();
      };
    }
  }, [visible, loadPasswordLockState]);

  const closePinModal = useCallback((ok: boolean) => {
    setPinModalVisible(false);
    setPinEntry('');
    setPinError('');
    const resolve = pinResolveRef.current;
    pinResolveRef.current = null;
    if (resolve) resolve(ok);
  }, []);

  const requestPinUnlock = useCallback(() => {
    setPinEntry('');
    setPinError('');
    setPinModalVisible(true);
    return new Promise<boolean>((resolve) => {
      pinResolveRef.current = resolve;
    });
  }, []);

  const handlePinSubmit = useCallback(async () => {
    const trimmed = pinEntry.trim();
    const stored = await secureStorageService.getSecret(PIN_STORAGE_KEY);
    if (!stored) {
      setPinError(t('No PIN is set.'));
      return;
    }
    if (trimmed === stored) {
      setPasswordsUnlocked(true);
      closePinModal(true);
      return;
    }
    setPinError(t('Incorrect PIN.'));
  }, [closePinModal, pinEntry, t]);

  const unlockPasswords = useCallback(async (): Promise<boolean> => {
    const passwordLockActive = biometricLockEnabled || pinLockEnabled;
    if (!passwordLockActive) {
      setPasswordsUnlocked(true);
      return true;
    }
    if (passwordsUnlocked) {
      return true;
    }

    if (biometricLockEnabled && biometricAvailable) {
      const result = await biometricAuthService.authenticate(
        t('Unlock passwords'),
        t('Authenticate to view passwords')
      );
      if (result.success) {
        setPasswordsUnlocked(true);
        return true;
      }
      if (!pinLockEnabled) {
        Alert.alert(
          t('Authentication failed'),
          result.errorMessage || t('Unable to unlock passwords.')
        );
        return false;
      }
    }

    if (pinLockEnabled) {
      return await requestPinUnlock();
    }

    if (biometricLockEnabled && !biometricAvailable) {
      Alert.alert(
        t('Biometrics unavailable'),
        t('Enable a fingerprint/biometric on your device first.')
      );
      return false;
    }

    setPasswordsUnlocked(true);
    return true;
  }, [
    biometricAvailable,
    biometricLockEnabled,
    passwordsUnlocked,
    pinLockEnabled,
    requestPinUnlock,
    t,
  ]);

  // Additional effect to ensure subscription offers are loaded when screen becomes visible
  useEffect(() => {
    if (visible && iapConnected && subscription) {
      const loadSubscriptionOffers = async () => {
        try {
          // Wait a bit to ensure offer details are fully loaded
          await new Promise(resolve => setTimeout(resolve, 1500));

          // Try multiple possible property names for subscription offers on Android
          let offers = (subscription as any).subscriptionOfferDetails || [];
          if (!offers || offers.length === 0) {
            offers = (subscription as any).subscriptionOfferDetailsAndroid || [];
          }

          // Look for the specific base plan, or use the first available offer
          let offer = offers.find((o: any) => o.basePlanId === ZNC_BASE_PLAN_ID);
          if (!offer && offers.length > 0) {
            // Use the first offer as fallback if specific base plan not found
            offer = offers[0];
          }

          if (offer?.offerToken) {
            setOfferToken(offer.offerToken);
          } else if (offers.length > 0) {
            // If there are offers but no offerToken, try to get it from pricing phases
            for (const o of offers) {
              if (o.pricingPhases?.pricingPhaseList?.length > 0) {
                const firstPhase = o.pricingPhases.pricingPhaseList[0];
                if (firstPhase?.offerId) {
                  // Some implementations put the offer token in the offerId
                  setOfferToken(firstPhase.offerId);
                  break;
                }
              }
            }
          }
        } catch (error) {
          console.error('Error loading subscription offers:', error);
        }
      };

      loadSubscriptionOffers();
    }
  }, [visible, iapConnected, subscription]);

  const initializeIap = async () => {
    try {
      console.log('Initializing IAP connection...');
      const connectionResult = await RNIap.initConnection();
      console.log('IAP connection result:', connectionResult);
      setIapConnected(true);

      // Load subscription product using fetchProducts with type: 'subs'
      console.log(`Fetching products for SKU: ${ZNC_PRODUCT_ID}`);
      const products = await RNIap.fetchProducts({ skus: [ZNC_PRODUCT_ID], type: 'subs' });
      console.log('Available products:', products); // Debug logging

      // More detailed logging about what was returned
      if (products && products.length > 0) {
        console.log('Product details:');
        products.forEach((product, index) => {
          console.log(`Product ${index + 1}:`, {
            id: product.id,
            type: product.type,
            title: product.title,
            description: product.description,
            price: product.price,
            localizedPrice: product.localizedPrice
          });
        });
      } else {
        console.warn('No products returned from store');
        // Check if we can get available purchases as an alternative
        try {
          const availablePurchases = await RNIap.getAvailablePurchases();
          console.log('Available purchases (for debugging):', availablePurchases.length);
        } catch (purchasesErr) {
          console.warn('Could not fetch available purchases:', purchasesErr);
        }
      }

      const sub = products.find(
        (item): item is ProductSubscription => item.id === ZNC_PRODUCT_ID && item.type === 'subs'
      );

      if (sub) {
        console.log('Found subscription product:', sub);
        setSubscription(sub);

        // Get offer token for Android
        if (Platform.OS === 'android') {
          // Wait a bit to ensure offer details are fully loaded
          await new Promise(resolve => setTimeout(resolve, 1500));

          // Try multiple possible property names for subscription offers on Android
          let offers = (sub as any).subscriptionOfferDetails || [];
          if (!offers || offers.length === 0) {
            offers = (sub as any).subscriptionOfferDetailsAndroid || [];
          }
          if (!offers || offers.length === 0) {
            // Sometimes the offers are nested differently
            const rawDetails = (sub as any).oneTimePurchaseOfferDetailsAndroid;
            if (rawDetails?.recurrenceMode) {
              // If there's a one-time purchase offer, we might need to handle differently
              console.log('Found one-time purchase details instead of subscription offers:', rawDetails);
            }
            console.log('Checking for offers in different properties...');
          }

          console.log('Subscription offers:', offers); // Debug logging

          // Look for the specific base plan, or use the first available offer
          let offer = offers.find((o: any) => o.basePlanId === ZNC_BASE_PLAN_ID);
          if (!offer && offers.length > 0) {
            // Use the first offer as fallback if specific base plan not found
            offer = offers[0];
            console.log('Using fallback offer:', offer);
          }

          console.log('Selected offer:', offer); // Debug logging

          if (offer?.offerToken) {
            setOfferToken(offer.offerToken);
            console.log('Set offer token:', offer.offerToken); // Debug logging
          } else if (offers.length > 0) {
            // If there are offers but no offerToken, try to get it from pricing phases
            for (const o of offers) {
              if (o.pricingPhases?.pricingPhaseList?.length > 0) {
                const firstPhase = o.pricingPhases.pricingPhaseList[0];
                if (firstPhase?.offerId) {
                  // Some implementations put the offer token in the offerId
                  setOfferToken(firstPhase.offerId);
                  console.log('Set offer token from pricing phase:', firstPhase.offerId);
                  break;
                }
              }
            }
          }

          if (!offerToken) {
            console.warn('No offer token found, offers:', offers);
            // Show alert to user about the issue
//             Alert.alert(
//               t('Store Error'),
//               t('Subscription is not available at the moment. This may be due to store configuration in Google Play. The subscription might not have active pricing plans configured.')
//             );
          } else {
            console.log('Successfully set offer token:', offerToken);
          }
        }
      } else {
        console.error('ZNC subscription product not found in store');
        console.log('Available SKUs in response:', products.map(p => p.id));

        // Show alert to user about the missing product
        Alert.alert(
          t('Store Error'),
          t('ZNC subscription product (znc) is not available in the store. This may be because:\n• You\'re not in the test group\n• The app signing certificate doesn\'t match Play Console\n• The subscription is not published to your region\n• You need to join the beta/testing program')
        );
      }

      // Set up purchase listeners
      purchaseUpdateSubscription.current = RNIap.purchaseUpdatedListener(handlePurchaseUpdate);
      purchaseErrorSubscription.current = RNIap.purchaseErrorListener(handlePurchaseError);
    } catch (error) {
      console.error('Failed to initialize IAP:', error);
      Alert.alert(
        t('Store Error'),
        t('Failed to connect to the store. Please check your internet connection and try again.')
      );
    }
  };

  const cleanupIap = () => {
    purchaseUpdateSubscription.current?.remove();
    purchaseErrorSubscription.current?.remove();
    RNIap.endConnection();
    setIapConnected(false);
  };

  const loadAccounts = async () => {
    setLoading(true);
    try {
      await subscriptionService.initialize();
      setAccounts(subscriptionService.getAccounts());
    } catch (error) {
      console.error('Failed to load accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await subscriptionService.refreshAllAccounts();
      Alert.alert(t('Refreshed'), t('All account statuses updated.'));
    } catch (error: any) {
      console.error('Failed to refresh accounts:', error);
      Alert.alert(t('Error'), error.message || t('Failed to refresh accounts. Please check your connection.'));
    } finally {
      setRefreshing(false);
    }
  };

  const handlePurchaseUpdate = async (purchase: SubscriptionPurchase) => {
    if (purchase.productId !== ZNC_PRODUCT_ID) return;

    try {
      // Finish the transaction
      await RNIap.finishTransaction({ purchase, isConsumable: false });

      // Try multiple possible token fields depending on platform
      let token = purchase.purchaseToken || purchase.transactionReceipt;

      // On some platforms/versions, the token might be in different fields
      if (!token && (purchase as any).receipt) {
        token = (purchase as any).receipt;
      }
      if (!token && (purchase as any).data) {
        token = (purchase as any).data;
      }

      if (token && pendingUsernameRef.current) {
        // Register with backend
        await registerAccount(token, pendingUsernameRef.current);
      } else {
        console.error('No purchase token or username found:', { token: !!token, username: !!pendingUsernameRef.current }, purchase);
        throw new Error('Purchase token or username not available');
      }
    } catch (error) {
      console.error('Failed to process purchase:', error);
      Alert.alert(t('Error'), t('Failed to complete purchase. Please try again.'));
    } finally {
      // Always ensure states are reset to prevent stuck loading states
      setPurchasing(false);
      setRegistering(false);
      setShowUsernameInput(false);
      setNewUsername('');
      pendingUsernameRef.current = '';
    }
  };

  const handlePurchaseError = (error: PurchaseError) => {
    if (error.productId !== ZNC_PRODUCT_ID) return;

    // Always reset purchasing state to prevent stuck loading state
    setPurchasing(false);
    setRegistering(false);

    if (error.code !== 'E_USER_CANCELLED') {
      Alert.alert(t('Purchase Failed'), error.message || t('Unable to complete purchase.'));
    }
  };

  const registerAccount = async (purchaseToken: string, username: string) => {
    // Ensure we're in the registering state
    setRegistering(true);
    try {
      // Validate that we have both required parameters
      if (!purchaseToken || !username) {
        throw new Error('Missing required information for registration');
      }

      const account = await subscriptionService.registerZncSubscription({
        purchaseToken,
        subscriptionId: ZNC_PRODUCT_ID,
        zncUsername: username,
      });

      Alert.alert(
        t('Success'),
        t('Your ZNC account has been created successfully! Username: {username}', { username: account.zncUsername }),
        [
          {
            text: t('Add to Network'),
            onPress: () => {
              setSelectedAccount(account);
              setShowNetworkPicker(true);
            },
          },
          { text: t('Later'), style: 'cancel' },
        ]
      );
    } catch (error: any) {
      // Check for username already exists error
      const errorMessage = error.message || '';
      if (errorMessage.includes('znc_username_exists') || errorMessage.includes('already exists')) {
        Alert.alert(
          t('Username Taken'),
          t('This username already exists on our ZNC server. Please choose a different username.'),
          [
            {
              text: t('Try Again'),
              onPress: () => {
                // Re-open username input with the purchase token saved
                pendingUsernameRef.current = '';
                setNewUsername('');
                setShowUsernameInput(true);
                // Save the purchase token for retry
                pendingPurchaseTokenRef.current = purchaseToken;
              },
            },
            {
              text: t('Cancel'),
              style: 'cancel',
              onPress: () => {
                // Clear the pending token if user cancels
                pendingPurchaseTokenRef.current = '';
              },
            },
          ]
        );
      } else {
        Alert.alert(t('Registration Failed'), error.message || t('Unable to register ZNC account.'));
      }
    } finally {
      // Ensure registering state is always reset to prevent stuck loading
      setRegistering(false);
    }
  };

  const extractOfferToken = (sub: ProductSubscription | null): string | null => {
    if (!sub) {
      return null;
    }
    const offers =
      (sub as any).subscriptionOfferDetails ||
      (sub as any).subscriptionOfferDetailsAndroid ||
      [];
    if (!offers.length) {
      return null;
    }
    const selectedOffer = offers.find((o: any) => o.basePlanId === ZNC_BASE_PLAN_ID) || offers[0];
    if (selectedOffer?.offerToken) {
      return selectedOffer.offerToken as string;
    }
    if (selectedOffer?.pricingPhases?.pricingPhaseList?.length > 0) {
      const firstPhase = selectedOffer.pricingPhases.pricingPhaseList[0];
      if (firstPhase?.offerId) {
        return firstPhase.offerId as string;
      }
    }
    return null;
  };

  const resolveAndroidOfferToken = async (): Promise<string | null> => {
    const cached = offerToken || extractOfferToken(subscription);
    if (cached) {
      setOfferToken(cached);
      return cached;
    }

    try {
      setRefreshingOffers(true);
      const products = await RNIap.fetchProducts({ skus: [ZNC_PRODUCT_ID], type: 'subs' });
      const sub = products.find(
        (item): item is ProductSubscription => item.id === ZNC_PRODUCT_ID && item.type === 'subs'
      );
      const refreshedToken = extractOfferToken(sub || null);
      if (refreshedToken) {
        setOfferToken(refreshedToken);
      }
      return refreshedToken;
    } catch (error) {
      console.error('Failed to refresh subscription offers:', error);
      return null;
    } finally {
      setRefreshingOffers(false);
    }
  };

  const handlePurchaseNew = async () => {
    if (!iapConnected) {
      Alert.alert(t('Error'), t('Store not available. Please check your connection and try again.'));
      return;
    }

    if (!subscription) {
      Alert.alert(
        t('Error'),
        t('Subscription product is not available in the store. This may be due to store configuration or testing environment.')
      );
      return;
    }

    // For Android, require a resolved offer token before showing purchase confirmation.
    // Starting a subscription flow without a valid offer token can trigger Billing crashes on some devices.
    if (Platform.OS === 'android') {
      const resolvedToken = await resolveAndroidOfferToken();
      if (!resolvedToken) {
        Alert.alert(
          t('Store Error'),
          t('Subscription offer is not available right now. Please try again in a few moments.')
        );
        return;
      }
    }

    setShowUsernameInput(true);
  };

  const handleConfirmPurchase = async () => {
    // Only proceed if we're not already in a purchasing state
    // This prevents accidental double-taps or re-validation during purchase
    if (purchasing || registering) {
      return; // Ignore if already processing
    }

    const username = newUsername.trim();
    if (!username) {
      Alert.alert(t('Error'), t('Please enter a username.'));
      return;
    }

    // Validate username format
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      Alert.alert(t('Error'), t('Username can only contain letters, numbers, underscore and dash.'));
      return;
    }

    if (username.length < 3 || username.length > 20) {
      Alert.alert(t('Error'), t('Username must be between 3 and 20 characters.'));
      return;
    }

    // Check if username already exists locally
    const existing = subscriptionService.getAccountByUsername(username);
    if (existing) {
      Alert.alert(t('Error'), t('You already have an account with this username.'));
      return;
    }

    // Check if we're retrying with an existing purchase token (username was taken on server)
    if (pendingPurchaseTokenRef.current) {
      setShowUsernameInput(false);
      setNewUsername('');
      const token = pendingPurchaseTokenRef.current;
      pendingPurchaseTokenRef.current = ''; // Clear for next time
      await registerAccount(token, username);
      return;
    }

    // Check username availability on server BEFORE starting purchase
    setPurchasing(true);
    try {
      const isAvailable = await subscriptionService.checkUsernameAvailability(username);
      if (!isAvailable) {
        setPurchasing(false);
        Alert.alert(
          t('Username Taken'),
          t('This username already exists on our ZNC server. Please choose a different username.')
        );
        return;
      }
    } catch (error) {
      // If check fails, continue with purchase - registration will handle it
      console.warn('Username availability check failed, continuing with purchase:', error);
    }

    pendingUsernameRef.current = username;
    // Hide the username input modal to prevent it from appearing again during purchase
    setShowUsernameInput(false);

    try {

      // Prepare purchase request based on platform
      let request;
      if (Platform.OS === 'ios') {
        request = {
          request: {
            apple: {
              sku: ZNC_PRODUCT_ID,
            },
          },
          type: 'subs' as const,
        };
      } else { // Android
        const resolvedToken = await resolveAndroidOfferToken();
        if (!resolvedToken) {
          throw new Error('Missing subscription offer token.');
        }
        request = {
          request: {
            google: {
              skus: [ZNC_PRODUCT_ID],
              subscriptionOffers: [{
                sku: ZNC_PRODUCT_ID,
                offerToken: resolvedToken,
              }],
            },
          },
          type: 'subs' as const,
        };
      }

      if (!request) {
        throw new Error('Unsupported platform for subscriptions.');
      }

      await RNIap.requestPurchase(request);
    } catch (error: any) {
      setPurchasing(false);
      if (error.code !== 'E_USER_CANCELLED') {
        Alert.alert(t('Error'), error.message || t('Failed to start purchase.'));
      }
    }
  };

  const handleRestorePurchases = async () => {
    setRestoring(true);
    try {
      console.log('ZNC Restore: Fetching purchases from store...');
      
      // Try both getAvailablePurchases and getPurchaseHistory
      // getAvailablePurchases returns only active subscriptions
      // getPurchaseHistory returns all purchases including expired/cancelled ones
      let purchases: any[] = [];
      let purchaseHistory: any[] = [];
      
      try {
        purchases = await RNIap.getAvailablePurchases();
        console.log('ZNC Restore: Available purchases:', purchases.length);
      } catch (error) {
        console.warn('ZNC Restore: Failed to get available purchases:', error);
      }
      
      try {
        // getPurchaseHistory is available on Android and returns all purchases
        if (RNIap.getPurchaseHistory && typeof RNIap.getPurchaseHistory === 'function') {
          purchaseHistory = await RNIap.getPurchaseHistory();
          console.log('ZNC Restore: Purchase history:', purchaseHistory.length);
        }
      } catch (error) {
        console.warn('ZNC Restore: Failed to get purchase history:', error);
      }
      
      // Combine both lists, removing duplicates by transactionId
      const allPurchases = [...purchases];
      const existingTransactionIds = new Set(purchases.map(p => p.transactionId));
      purchaseHistory.forEach(p => {
        if (!existingTransactionIds.has(p.transactionId)) {
          allPurchases.push(p);
        }
      });
      
      console.log('ZNC Restore: Total unique purchases:', allPurchases.length);
      console.log('ZNC Restore: Product IDs:', allPurchases.map(p => p.productId));

      const zncPurchases = allPurchases.filter(p => p.productId === ZNC_PRODUCT_ID);
      console.log('ZNC Restore: ZNC purchases found:', zncPurchases.length);

      if (zncPurchases.length === 0) {
        // Log all available purchases for debugging
        console.log('ZNC Restore: No ZNC purchases. Available products:', JSON.stringify(allPurchases.map(p => ({
          productId: p.productId,
          transactionId: p.transactionId,
          purchaseStateAndroid: (p as any).purchaseStateAndroid,
        }))));
        Alert.alert(t('No Purchases'), t('No ZNC subscriptions found to restore.'));
        return;
      }

      // Extract tokens from purchases, trying multiple possible fields
      const tokens: string[] = [];
      for (const purchase of zncPurchases) {
        console.log('ZNC Restore: Processing purchase:', {
          productId: purchase.productId,
          transactionId: purchase.transactionId,
          hasPurchaseToken: !!purchase.purchaseToken,
          hasReceipt: !!purchase.transactionReceipt,
        });

        let token = purchase.purchaseToken || purchase.transactionReceipt;

        // Try alternative fields if primary ones are empty
        if (!token && (purchase as any).receipt) {
          token = (purchase as any).receipt;
        }
        if (!token && (purchase as any).data) {
          token = (purchase as any).data;
        }

        if (token) {
          tokens.push(token);
          console.log('ZNC Restore: Extracted token (first 50 chars):', token.substring(0, 50));
        } else {
          console.log('ZNC Restore: No token found for purchase:', purchase.transactionId);
        }
      }

      if (tokens.length === 0) {
        Alert.alert(t('No Purchases'), t('No valid subscriptions found to restore.'));
        return;
      }

      console.log('ZNC Restore: Calling restorePurchases with', tokens.length, 'tokens');
      const result = await subscriptionService.restorePurchases(tokens);
      console.log('ZNC Restore: Result:', result);

      if (result.restored > 0) {
        Alert.alert(
          t('Restored'),
          t('{count} subscription(s) restored successfully.', { count: result.restored })
        );
      } else {
        Alert.alert(t('No Purchases'), t('No valid subscriptions found to restore.'));
      }
    } catch (error: any) {
      console.error('ZNC Restore: Error:', error);
      Alert.alert(t('Error'), error.message || t('Failed to restore purchases.'));
    } finally {
      setRestoring(false);
    }
  };

  const getUnlockedPassword = useCallback(async (account: ZncAccount): Promise<string | null> => {
    const unlocked = await unlockPasswords();
    if (!unlocked) {
      return null;
    }
    return await subscriptionService.getAccountPassword(account.id);
  }, [unlockPasswords]);

  const handleAddToNetwork = async (account: ZncAccount) => {
    if (!account.zncUsername || !isZncAccountReady(account)) {
      Alert.alert(t('Error'), t('Account credentials not ready. Please refresh status first.'));
      return;
    }
    const password = await getUnlockedPassword(account);
    if (!password) {
      Alert.alert(t('Error'), t('Credentials not available.'));
      return;
    }
    setSelectedAccount({ ...account, zncPassword: password });
    setShowNetworkPicker(true);
  };

  const handleNetworkSelected = async (network: IRCNetworkConfig) => {
    if (!selectedAccount) return;

    setShowNetworkPicker(false);

    try {
      // Generate server config
      const password = await subscriptionService.getAccountPassword(selectedAccount.id);
      if (!password) {
        Alert.alert(t('Error'), t('Credentials not available.'));
        return;
      }
      const serverConfig = subscriptionService.generateServerConfig(selectedAccount, password);

      // Check if ZNC server already exists in this network
      const existingServer = network.servers?.find(
        s => s.id === serverConfig.id || (s.connectionType === 'znc' && s.username === serverConfig.username)
      );

      if (existingServer) {
        Alert.alert(
          t('Server Exists'),
          t('This ZNC account is already configured in {network}. Do you want to update it?', {
            network: network.name,
          }),
          [
            { text: t('Cancel'), style: 'cancel' },
            {
              text: t('Update'),
              onPress: () => updateServerInNetwork(network, serverConfig, existingServer.id),
            },
          ]
        );
        return;
      }

      // Add new server to network
      await addServerToNetwork(network, serverConfig);
    } catch (error: any) {
      Alert.alert(t('Error'), error.message || t('Failed to add ZNC to network.'));
    }
  };

  const addServerToNetwork = async (network: IRCNetworkConfig, serverConfig: any) => {
    try {
      const updatedServers = [...(network.servers || []), {
        id: serverConfig.id,
        hostname: serverConfig.hostname,
        port: serverConfig.port,
        displayName: serverConfig.displayName,
        ssl: serverConfig.ssl,
        rejectUnauthorized: serverConfig.rejectUnauthorized,
        username: serverConfig.username,
        password: serverConfig.password,
        connectionType: serverConfig.connectionType,
      }];

      await settingsService.updateNetwork(network.id, {
        ...network,
        servers: updatedServers,
      });

      // Update account assignment
      if (selectedAccount) {
        await subscriptionService.assignToNetwork(
          selectedAccount.id,
          network.name,
          serverConfig.id
        );
      }

      Alert.alert(
        t('Success'),
        t('ZNC server added to {network}. You can now connect using the ZNC server.', {
          network: network.name,
        })
      );
    } catch (error: any) {
      Alert.alert(t('Error'), error.message || t('Failed to save network configuration.'));
    }
  };

  const updateServerInNetwork = async (
    network: IRCNetworkConfig,
    serverConfig: any,
    existingServerId: string
  ) => {
    try {
      const updatedServers = (network.servers || []).map(s =>
        s.id === existingServerId
          ? {
              ...s,
              hostname: serverConfig.hostname,
              port: serverConfig.port,
              displayName: serverConfig.displayName,
              ssl: serverConfig.ssl,
              rejectUnauthorized: serverConfig.rejectUnauthorized,
              username: serverConfig.username,
              password: serverConfig.password,
              connectionType: serverConfig.connectionType,
            }
          : s
      );

      await settingsService.updateNetwork(network.id, {
        ...network,
        servers: updatedServers,
      });

      if (selectedAccount) {
        await subscriptionService.assignToNetwork(
          selectedAccount.id,
          network.name,
          existingServerId
        );
      }

      Alert.alert(t('Success'), t('ZNC server configuration updated.'));
    } catch (error: any) {
      Alert.alert(t('Error'), error.message || t('Failed to update network configuration.'));
    }
  };

  const handleCopyCredentials = async (account: ZncAccount) => {
    if (!account.zncUsername) {
      Alert.alert(t('Error'), t('Credentials not available.'));
      return;
    }

    const password = await getUnlockedPassword(account);
    if (!password) {
      Alert.alert(t('Error'), t('Credentials not available.'));
      return;
    }
    const text = `Username: ${account.zncUsername}\nPassword: ${password}`;
    Clipboard.setString(text);
    Alert.alert(t('Copied'), t('Credentials copied to clipboard.'));
  };

  const handleRefreshAccount = async (account: ZncAccount) => {
    try {
      const updatedAccount = await subscriptionService.refreshAccountStatus(account.id);
      if (updatedAccount) {
        Alert.alert(t('Refreshed'), t('Account status updated.'));
      } else {
        Alert.alert(t('Error'), t('Could not refresh account status. Account may not exist.'));
      }
    } catch (error: any) {
      console.error('Refresh account error:', error);
      Alert.alert(t('Error'), error.message || t('Failed to refresh account status. Please check your connection.'));
    }
  };

  const handleRemoveFromNetwork = async (account: ZncAccount) => {
    if (!account.assignedNetworkId) return;

    Alert.alert(
      t('Remove from Network'),
      t('Remove ZNC server from {network}? This will not cancel your subscription.', {
        network: account.assignedNetworkId,
      }),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Remove'),
          style: 'destructive',
          onPress: async () => {
            try {
              // Remove server from network
              const network = await settingsService.getNetwork(account.assignedNetworkId!);
              if (network && account.assignedServerId) {
                const updatedServers = (network.servers || []).filter(
                  s => s.id !== account.assignedServerId
                );
                await settingsService.updateNetwork(network.id, { ...network, servers: updatedServers });
              }

              // Unassign account
              await subscriptionService.unassignFromNetwork(account.id);
              Alert.alert(t('Removed'), t('ZNC server removed from network.'));
            } catch (error: any) {
              Alert.alert(t('Error'), error.message || t('Failed to remove from network.'));
            }
          },
        },
      ]
    );
  };

  const handleShowCredentials = async (account: ZncAccount) => {
    if (!account.zncUsername) {
      Alert.alert(t('Error'), t('Credentials not available.'));
      return;
    }

    const password = await getUnlockedPassword(account);
    const passwordText = password || t('Not available');
    Alert.alert(
      t('ZNC Credentials'),
      `${t('Username')}: ${account.zncUsername}\n${t('Password')}: ${passwordText}\n\n${t('Server')}: irc.androidircx.com\n${t('Port')}: 16786 (SSL)`,
      [
        {
          text: t('Copy'),
          onPress: () => {
            if (!password) return;
            const text = `Username: ${account.zncUsername}\nPassword: ${password}`;
            Clipboard.setString(text);
            Alert.alert(t('Copied'), t('Credentials copied to clipboard.'));
          },
        },
        { text: t('Close'), style: 'cancel' },
      ]
    );
  };

  const handleDeleteAccount = (account: ZncAccount) => {
    Alert.alert(
      t('Delete Account'),
      t('Delete this ZNC account from your local storage? This will NOT cancel your subscription - you can restore it later using "Restore Purchases".'),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              // If assigned to a network, remove from network first
              if (account.assignedNetworkId && account.assignedServerId) {
                const network = await settingsService.getNetwork(account.assignedNetworkId);
                if (network) {
                  const updatedServers = (network.servers || []).filter(
                    s => s.id !== account.assignedServerId
                  );
                  await settingsService.updateNetwork(network.id, { ...network, servers: updatedServers });
                }
              }

              // Delete the local account record
              await subscriptionService.deleteLocalAccount(account.id);
              Alert.alert(t('Deleted'), t('Account removed from local storage.'));
            } catch (error: any) {
              Alert.alert(t('Error'), error.message || t('Failed to delete account.'));
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return '#4CAF50';
      case 'grace':
        return '#FFA726';
      case 'expired':
      case 'cancelled':
        return '#FF5252';
      default:
        return colors.textSecondary;
    }
  };

  const getProvisioningLabel = (status: string) => {
    switch (status) {
      case 'ready':
        return t('Ready');
      case 'provisioning':
        return t('Setting up...');
      case 'error':
        return t('Error');
      case 'suspended':
        return t('Suspended');
      default:
        return status;
    }
  };

  const renderAccount = ({ item }: { item: ZncAccount }) => {
    // Don't render accounts with pending status to avoid confusion
    if (item.status === 'pending' && !item.zncUsername) {
      return null; // Don't render pending accounts without username
    }

    const statusColor = getStatusColor(item.status);
    const isActive = isZncAccountActive(item);
    const isReady = isZncAccountReady(item);
    const hasCredentials = Boolean(item.zncUsername) && isReady;

    return (
      <View style={[styles.accountCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {/* Header */}
        <View style={styles.accountHeader}>
          <View style={styles.accountTitleRow}>
            <Icon name="user-circle" size={20} color={colors.primary} />
            <Text style={[styles.accountUsername, { color: colors.text }]}>
              {item.zncUsername}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </Text>
          </View>
        </View>

        {/* Details */}
        <View style={styles.accountDetails}>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
              {t('Expires')}:
            </Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>
              {formatZncExpiry(item.expiresAt)}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
              {t('ZNC Status')}:
            </Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>
              {getProvisioningLabel(item.provisioningStatus)}
            </Text>
          </View>

          {item.assignedNetworkId && (
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                {t('Network')}:
              </Text>
              <Text style={[styles.detailValue, { color: colors.primary }]}>
                {item.assignedNetworkId}
              </Text>
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={styles.accountActions}>
          {/* Show credentials button - always visible if account has username */}
          {item.zncUsername && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.primary }]}
              onPress={() => handleShowCredentials(item)}
            >
              <Icon name="eye" size={14} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>{t('Show')}</Text>
            </TouchableOpacity>
          )}

          {/* Copy credentials - only when ready and has credentials */}
          {isReady && hasCredentials && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#2196F3' }]}
              onPress={() => handleCopyCredentials(item)}
            >
              <Icon name="copy" size={14} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>{t('Copy')}</Text>
            </TouchableOpacity>
          )}

          {/* Add to network - only for active accounts with credentials */}
          {isActive && hasCredentials && !item.assignedNetworkId && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#4CAF50' }]}
              onPress={() => handleAddToNetwork(item)}
            >
              <Icon name="plus" size={14} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>{t('Add to Network')}</Text>
            </TouchableOpacity>
          )}

          {/* Remove from network - when assigned */}
          {item.assignedNetworkId && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#FF9800' }]}
              onPress={() => handleRemoveFromNetwork(item)}
            >
              <Icon name="unlink" size={14} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>{t('Unlink')}</Text>
            </TouchableOpacity>
          )}

          {/* Refresh button */}
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}
            onPress={() => handleRefreshAccount(item)}
          >
            <Icon name="sync" size={14} color={colors.text} />
          </TouchableOpacity>

          {/* Delete button - always visible, especially useful for expired accounts */}
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.error || '#FF5252' }]}
            onPress={() => handleDeleteAccount(item)}
          >
            <Icon name="trash" size={14} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEmpty = () => {
    // Check if there are any accounts that should be displayed (not pending without username)
    const visibleAccounts = accounts.filter(account => !(account.status === 'pending' && !account.zncUsername));

    if (visibleAccounts.length > 0) {
      // If there are accounts but they're filtered out, don't show empty state
      return null;
    }

    return (
      <View style={styles.emptyContainer}>
        <Icon name="server" size={64} color={colors.textSecondary} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          {t('No ZNC Accounts')}
        </Text>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          {t('Purchase a ZNC subscription to get always-on IRC connectivity with message playback.')}
        </Text>
      </View>
    );
  };

  const displayPrice = subscription?.localizedPrice ||
    (subscription as any)?.subscriptionOfferDetails?.[0]?.pricingPhases?.pricingPhaseList?.[0]?.formattedPrice ||
    t('Monthly subscription');

  const styles = createStyles(colors);

  return (
    <>
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {t('ZNC Subscription')}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={[styles.closeButtonText, { color: colors.primary }]}>
                {t('Close')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                {t('Loading...')}
              </Text>
            </View>
          ) : (
            <FlatList
              data={accounts.filter(account => !(account.status === 'pending' && !account.zncUsername))}
              renderItem={renderAccount}
              keyExtractor={item => item.id}
              contentContainerStyle={accounts.filter(account => !(account.status === 'pending' && !account.zncUsername)).length === 0 ? styles.emptyList : styles.listContent}
              ListEmptyComponent={renderEmpty}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  colors={[colors.primary]}
                  tintColor={colors.primary}
                />
              }
            />
          )}

          {/* Footer Actions */}
          <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.purchaseButton, { backgroundColor: colors.primary }]}
              onPress={handlePurchaseNew}
              disabled={purchasing || refreshingOffers || !iapConnected}
            >
              {purchasing || refreshingOffers ? (
                <>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.purchaseButtonText}>
                    {purchasing ? t('Creating ZNC Account, Please Wait...') : t('Loading Offers...')}
                  </Text>
                </>
              ) : (
                <>
                  <Icon name="plus-circle" size={18} color="#FFFFFF" />
                  <Text style={styles.purchaseButtonText}>
                    {t('Purchase ZNC Account')}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.footerRow}>
              <TouchableOpacity
                style={styles.refreshButton}
                onPress={async () => {
                  // Re-initialize IAP to refresh product data
                  await initializeIap();
                  // Reload accounts
                  await loadAccounts();
                }}
              >
                <Icon name="sync" size={14} color={colors.primary} />
                <Text style={[styles.refreshButtonText, { color: colors.primary }]}>
                  {t('Refresh Store')}
                </Text>
              </TouchableOpacity>

              <Text style={[styles.priceText, { color: colors.textSecondary }]}>
                {displayPrice}
              </Text>

              <TouchableOpacity
                style={styles.restoreButton}
                onPress={handleRestorePurchases}
                disabled={restoring}
              >
                {restoring ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={[styles.restoreButtonText, { color: colors.primary }]}>
                    {t('Restore Purchases')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Username Input Modal */}
      <Modal
        visible={showUsernameInput}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUsernameInput(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.usernameModal, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {t('Choose ZNC Username')}
            </Text>
            <Text style={[styles.modalDescription, { color: colors.textSecondary }]}>
              {t('Enter a username for your ZNC account. This will be used to log in to ZNC.')}
            </Text>

            <TextInput
              style={[styles.usernameInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              value={newUsername}
              onChangeText={setNewUsername}
              placeholder={t('Username')}
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={20}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton, { borderColor: colors.border }]}
                onPress={() => {
                  setShowUsernameInput(false);
                  setNewUsername('');
                }}
              >
                <Text style={[styles.cancelButtonText, { color: colors.text }]}>
                  {t('Cancel')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton, { backgroundColor: colors.primary }]}
                onPress={handleConfirmPurchase}
                disabled={!newUsername.trim() || registering || purchasing}
              >
                {(registering || purchasing) ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmButtonText}>{t('Continue')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* PIN Unlock Modal */}
      <Modal
        visible={pinModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => closePinModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.usernameModal, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {t('Unlock passwords')}
            </Text>
            <Text style={[styles.modalDescription, { color: colors.textSecondary }]}>
              {t('Enter your PIN to unlock passwords.')}
            </Text>

            <TextInput
              style={[styles.usernameInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              value={pinEntry}
              onChangeText={(text) => {
                const sanitized = text.replace(/[^0-9]/g, '');
                setPinEntry(sanitized);
                if (pinError) setPinError('');
              }}
              placeholder={t('PIN')}
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
              secureTextEntry
              autoFocus
            />
            {!!pinError && (
              <Text style={[styles.modalDescription, { color: colors.error || '#FF5252' }]}>
                {pinError}
              </Text>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton, { borderColor: colors.border }]}
                onPress={() => closePinModal(false)}
              >
                <Text style={[styles.cancelButtonText, { color: colors.text }]}>
                  {t('Cancel')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton, { backgroundColor: colors.primary }]}
                onPress={handlePinSubmit}
                disabled={!pinEntry.trim()}
              >
                <Text style={styles.confirmButtonText}>{t('Confirm')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Network Picker */}
      <NetworkPickerModal
        visible={showNetworkPicker}
        onClose={() => {
          setShowNetworkPicker(false);
          setSelectedAccount(null);
        }}
        onSelectNetwork={handleNetworkSelected}
        onCreateNew={() => {
          setShowNetworkPicker(false);
          onNavigateToNetworkSettings?.();
        }}
        title={t('Add ZNC to Network')}
      />
    </>
  );
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: 'bold',
    },
    closeButton: {
      padding: 8,
    },
    closeButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 16,
      fontSize: 14,
    },
    listContent: {
      padding: 16,
    },
    emptyList: {
      flex: 1,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      marginTop: 16,
      marginBottom: 8,
    },
    emptyText: {
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 20,
    },
    accountCard: {
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
    },
    accountHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    accountTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    accountUsername: {
      fontSize: 18,
      fontWeight: 'bold',
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: 6,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '600',
    },
    accountDetails: {
      marginBottom: 12,
    },
    detailRow: {
      flexDirection: 'row',
      marginBottom: 4,
    },
    detailLabel: {
      fontSize: 13,
      width: 90,
    },
    detailValue: {
      fontSize: 13,
      flex: 1,
    },
    accountActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 6,
      gap: 6,
    },
    actionButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    footer: {
      padding: 16,
      borderTopWidth: 1,
    },
    purchaseButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: 8,
      gap: 8,
      marginBottom: 12,
    },
    purchaseButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    footerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    priceText: {
      fontSize: 13,
    },
    restoreButton: {
      padding: 8,
    },
    restoreButtonText: {
      fontSize: 14,
      fontWeight: '600',
    },
    refreshButton: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 8,
      gap: 4,
    },
    refreshButtonText: {
      fontSize: 14,
      fontWeight: '600',
    },
    // Username Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    usernameModal: {
      width: '100%',
      maxWidth: 400,
      borderRadius: 12,
      padding: 24,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      marginBottom: 8,
    },
    modalDescription: {
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 16,
    },
    usernameInput: {
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
      marginBottom: 16,
    },
    modalActions: {
      flexDirection: 'row',
      gap: 12,
    },
    modalButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelButton: {
      borderWidth: 1,
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    confirmButton: {},
    confirmButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
    },
  });

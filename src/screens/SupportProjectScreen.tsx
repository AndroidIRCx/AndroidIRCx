/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as RNIap from 'react-native-iap';
import type {
  ProductSubscription,
  Purchase,
  PurchaseError,
} from 'react-native-iap';
import { ErrorCode } from 'react-native-iap';
import { ModalSafeArea } from '../components/ModalSafeArea';
import { useTheme } from '../hooks/useTheme';
import { useT } from '../i18n/localization';
import { useIapConnectionLease } from '../hooks/useIapConnectionLease';
import {
  isSingleEmoji,
  supporterSubscriptionService,
} from '../services/SupporterSubscriptionService';
import {
  SUPPORTER_BASE_PLAN_IDS,
  SUPPORTER_PRODUCT_ID,
  SupporterListEntry,
  SupporterTier,
} from '../types/supporter';
import { findSubscriptionOffer } from '../utils/subscriptionOffers';

interface SupportProjectScreenProps {
  visible: boolean;
  onClose: () => void;
}

/** A starting set; any single emoji can be typed instead. */
export const SUPPORTER_EMOJI_CHOICES = [
  '❤️',
  '🧡',
  '💛',
  '💚',
  '💙',
  '💜',
  '🖤',
  '🤍',
  '⭐',
  '🌟',
  '🔥',
  '⚡',
  '🚀',
  '🦄',
  '🐧',
  '🦊',
  '🐱',
  '🐶',
  '🍀',
  '🌈',
  '☕',
  '🎧',
  '🎮',
  '👾',
  '💎',
  '👑',
  '🤖',
  '🛡️',
];

const NAME_MAX = 24;
const MESSAGE_MAX = 60;
const PACKAGE_NAME = 'com.androidircx';

export const SupportProjectScreen: React.FC<SupportProjectScreenProps> = ({
  visible,
  onClose,
}) => {
  const t = useT();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { ensureIapConnection, releaseIapConnection } = useIapConnectionLease();

  const [view, setView] = useState<'support' | 'list'>('support');
  const [state, setState] = useState(supporterSubscriptionService.getState());
  const [emoji, setEmojiState] = useState(
    supporterSubscriptionService.getEmoji(),
  );
  const [customEmoji, setCustomEmoji] = useState('');
  const [product, setProduct] = useState<ProductSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasingTier, setPurchasingTier] = useState<SupporterTier | null>(
    null,
  );
  const [restoring, setRestoring] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [message, setMessage] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [profileHidden, setProfileHidden] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileNote, setProfileNote] = useState<string | null>(null);

  const [supporters, setSupporters] = useState<SupporterListEntry[] | null>(
    null,
  );
  const [listError, setListError] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!supporterSubscriptionService.getState().purchaseToken) return;
    try {
      const { profile } = await supporterSubscriptionService.fetchProfile();
      if (profile) {
        setDisplayName(profile.displayName ?? '');
        setMessage(profile.message ?? '');
        setIsPublic(profile.isPublic);
        setProfileHidden(profile.hidden);
      }
      setProfileNote(null);
    } catch {
      setProfileNote(
        t('Your list entry could not be loaded. You can still save it.'),
      );
    }
  }, [t]);

  const initialize = useCallback(async () => {
    setLoading(true);
    try {
      await ensureIapConnection();
      const products =
        (await RNIap.fetchProducts({
          skus: [SUPPORTER_PRODUCT_ID],
          type: 'subs',
        })) ?? [];
      setProduct(
        (products.find(
          item => item.id === SUPPORTER_PRODUCT_ID && item.type === 'subs',
        ) as ProductSubscription | undefined) ?? null,
      );
      const refreshed = await supporterSubscriptionService
        .refreshFromStore()
        .catch(() => supporterSubscriptionService.getState());
      setState(refreshed);
      if (refreshed.active) await loadProfile();
    } catch (error) {
      Alert.alert(
        t('Store Error'),
        error instanceof Error
          ? error.message
          : t('Failed to load the supporter subscription.'),
      );
    } finally {
      setLoading(false);
    }
  }, [ensureIapConnection, loadProfile, t]);

  useEffect(() => {
    if (!visible) return;
    setView('support');
    const unsubscribe = supporterSubscriptionService.addListener(next => {
      setState(next);
      setEmojiState(supporterSubscriptionService.getEmoji());
    });
    initialize();

    const updated = RNIap.purchaseUpdatedListener(
      async (purchase: Purchase) => {
        if (purchase.productId !== SUPPORTER_PRODUCT_ID) return;
        try {
          if ((purchase as any).purchaseState === 'pending') {
            Alert.alert(
              t('Payment pending'),
              t(
                'Your support starts as soon as Google Play confirms the payment.',
              ),
            );
            return;
          }
          // Acknowledging is what keeps Google from refunding it in 3 days.
          await RNIap.finishTransaction({ purchase, isConsumable: false });
          await supporterSubscriptionService.applyPurchase(purchase);
          Alert.alert(
            t('Thank you!'),
            t(
              'Your support keeps AndroidIRCX going. Pick your badge and, if you like, add yourself to the supporters list.',
            ),
          );
          loadProfile();
        } catch (error) {
          Alert.alert(
            t('Purchase Failed'),
            error instanceof Error
              ? error.message
              : t('Failed to complete subscription.'),
          );
        } finally {
          setPurchasingTier(null);
        }
      },
    ) as unknown as { remove: () => void };

    const failed = RNIap.purchaseErrorListener((error: PurchaseError) => {
      if (error.productId && error.productId !== SUPPORTER_PRODUCT_ID) return;
      setPurchasingTier(null);
      if (error.code !== ErrorCode.UserCancelled) {
        Alert.alert(
          t('Purchase Failed'),
          error.message || t('Unable to start subscription purchase.'),
        );
      }
    }) as unknown as { remove: () => void };

    return () => {
      unsubscribe();
      updated?.remove();
      failed?.remove();
      releaseIapConnection();
    };
  }, [initialize, loadProfile, releaseIapConnection, t, visible]);

  const subscribe = useCallback(
    async (tier: SupporterTier) => {
      const basePlanId = SUPPORTER_BASE_PLAN_IDS[tier];
      const offer = findSubscriptionOffer(product, basePlanId);
      setPurchasingTier(tier);
      try {
        await ensureIapConnection();
        if (Platform.OS !== 'android') {
          await RNIap.requestPurchase({
            request: { apple: { sku: SUPPORTER_PRODUCT_ID } },
            type: 'subs',
          } as any);
          return;
        }
        if (!offer?.offerToken) {
          throw new Error(t('This plan is not available right now.'));
        }
        const current = supporterSubscriptionService.getState();
        const switching =
          current.active && !!current.purchaseToken && current.tier !== tier;
        await RNIap.requestPurchase({
          request: {
            google: {
              skus: [SUPPORTER_PRODUCT_ID],
              subscriptionOffers: [
                { sku: SUPPORTER_PRODUCT_ID, offerToken: offer.offerToken },
              ],
              // Switching plan replaces the running subscription; the new
              // price starts at the next billing date, as set in Play Console.
              ...(switching
                ? {
                    purchaseToken: current.purchaseToken,
                    subscriptionProductReplacementParams: {
                      oldProductId: SUPPORTER_PRODUCT_ID,
                      replacementMode: 'deferred',
                    },
                  }
                : {}),
            },
          },
          type: 'subs',
        } as any);
      } catch (error: any) {
        setPurchasingTier(null);
        if (error?.code !== ErrorCode.UserCancelled) {
          Alert.alert(
            t('Purchase Failed'),
            error?.message || t('Unable to start subscription purchase.'),
          );
        }
      }
    },
    [ensureIapConnection, product, t],
  );

  const restore = useCallback(async () => {
    setRestoring(true);
    try {
      const next = await supporterSubscriptionService.refreshFromStore();
      setState(next);
      if (next.active) await loadProfile();
      Alert.alert(
        t('Restore complete'),
        next.active
          ? t('Your supporter subscription is active.')
          : t('No supporter subscription was found on this Google account.'),
      );
    } catch (error) {
      Alert.alert(
        t('Restore failed'),
        error instanceof Error
          ? error.message
          : t('Unable to restore purchases.'),
      );
    } finally {
      setRestoring(false);
    }
  }, [loadProfile, t]);

  const chooseEmoji = useCallback(
    async (value: string) => {
      if (!isSingleEmoji(value)) {
        Alert.alert(t('Not an emoji'), t('Pick a single emoji.'));
        return;
      }
      await supporterSubscriptionService.setEmoji(value);
      setEmojiState(supporterSubscriptionService.getEmoji());
      setCustomEmoji('');
    },
    [t],
  );

  const saveProfile = useCallback(async () => {
    setSavingProfile(true);
    try {
      const profile = await supporterSubscriptionService.saveProfile({
        displayName,
        message,
        isPublic,
      });
      setProfileHidden(profile?.hidden ?? false);
      setProfileNote(null);
      Alert.alert(t('Saved'), t('Your supporters list entry is updated.'));
    } catch (error) {
      const code = (error as any)?.code;
      Alert.alert(
        t('Could not save'),
        code === 'text_not_allowed'
          ? t('That name or message cannot be shown on the supporters list.')
          : error instanceof Error
            ? error.message
            : t('Please try again later.'),
      );
    } finally {
      setSavingProfile(false);
    }
  }, [displayName, isPublic, message, t]);

  const openList = useCallback(async () => {
    setView('list');
    setListLoading(true);
    setListError(null);
    try {
      setSupporters(await supporterSubscriptionService.fetchSupporters());
    } catch {
      setListError(t('The supporters list could not be loaded.'));
    } finally {
      setListLoading(false);
    }
  }, [t]);

  const manageInPlay = useCallback(() => {
    Linking.openURL(
      `https://play.google.com/store/account/subscriptions?sku=${SUPPORTER_PRODUCT_ID}&package=${PACKAGE_NAME}`,
    ).catch(() => {});
  }, []);

  const renderPlan = (tier: SupporterTier) => {
    const offer = findSubscriptionOffer(product, SUPPORTER_BASE_PLAN_IDS[tier]);
    const isCurrent = state.active && state.tier === tier;
    const busy = purchasingTier === tier;
    const unavailable = !offer && Platform.OS === 'android';
    const buttonLabel = isCurrent
      ? t('Active')
      : state.active
        ? t('Switch to this plan')
        : t('Subscribe');

    return (
      <View key={tier} style={[styles.card, tier === 'big' && styles.bigCard]}>
        <View style={styles.planHeader}>
          <Text style={styles.planTitle}>
            {tier === 'big'
              ? t('🌟 Big Monthly Supporter')
              : t('Monthly Supporter')}
          </Text>
          <Text style={styles.planPrice}>
            {offer?.formattedPrice || t('Unavailable')}
          </Text>
        </View>
        <Text style={styles.planDescription}>
          {tier === 'big'
            ? t(
                'Everything below, plus a 🌟 and a place at the top of the supporters list, with a short message of your own.',
              )
            : t('Every supporter benefit below, billed monthly.')}
        </Text>
        <TouchableOpacity
          style={[
            styles.primaryButton,
            isCurrent && styles.successButton,
            (busy || unavailable) && styles.disabledButton,
          ]}
          onPress={() => !isCurrent && subscribe(tier)}
          disabled={isCurrent || busy || unavailable}
        >
          {busy ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.primaryButtonText}>{buttonLabel}</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const renderSupportView = () => (
    <>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('Why support AndroidIRCX')}</Text>
        <Text style={styles.body}>
          {t(
            'AndroidIRCX is free and is built by one person in their spare time. The server, the tools and the hours all cost money, and the ads cover only a small part of it.',
          )}
        </Text>
        <Text style={styles.body}>
          {t(
            'A monthly subscription is a way to keep supporting the project through Google Play. Both plans give the same benefits; the only difference is how much you would like to give. You can cancel at any time in Google Play.',
          )}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('What supporters get')}</Text>
        <Text style={styles.perk}>{t('• No ads')}</Text>
        <Text style={styles.perk}>
          {t('• Unlimited scripting and AI time')}
        </Text>
        <Text style={styles.perk}>
          {t('• Your own emoji badge instead of ❤️')}
        </Text>
        <Text style={styles.perk}>
          {t('• A place on the supporters list, if you want one')}
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingBlock}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <>
          {renderPlan('monthly')}
          {renderPlan('big')}
        </>
      )}

      {state.active && (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {t('Your badge')} <Text style={styles.currentEmoji}>{emoji}</Text>
            </Text>
            <View style={styles.emojiGrid}>
              {SUPPORTER_EMOJI_CHOICES.map(choice => (
                <TouchableOpacity
                  key={choice}
                  accessibilityLabel={choice}
                  style={[
                    styles.emojiCell,
                    choice === emoji && styles.emojiCellSelected,
                  ]}
                  onPress={() => chooseEmoji(choice)}
                >
                  <Text style={styles.emojiText}>{choice}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.flex]}
                value={customEmoji}
                placeholder={t('Or type any emoji')}
                placeholderTextColor={colors.textSecondary}
                onChangeText={setCustomEmoji}
                onSubmitEditing={() => chooseEmoji(customEmoji)}
              />
              <TouchableOpacity
                style={styles.inlineButton}
                onPress={() => chooseEmoji(customEmoji)}
              >
                <Text style={styles.secondaryButtonText}>{t('Use')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('The supporters list')}</Text>
            <View style={styles.row}>
              <Text style={[styles.body, styles.flex]}>
                {t('Show my name on the list')}
              </Text>
              <Switch value={isPublic} onValueChange={setIsPublic} />
            </View>
            <Text style={styles.footnote}>
              {isPublic
                ? t('Your name and badge are shown to everyone using the app.')
                : t('You are listed as Anonymous, with your badge.')}
            </Text>
            {isPublic && (
              <TextInput
                style={styles.input}
                value={displayName}
                maxLength={NAME_MAX}
                placeholder={t('Name to show')}
                placeholderTextColor={colors.textSecondary}
                onChangeText={setDisplayName}
              />
            )}
            {isPublic && state.tier === 'big' && (
              <TextInput
                style={styles.input}
                value={message}
                maxLength={MESSAGE_MAX}
                placeholder={t('A short message (optional)')}
                placeholderTextColor={colors.textSecondary}
                onChangeText={setMessage}
              />
            )}
            {profileHidden && (
              <Text style={styles.warning}>
                {t('Your entry is currently hidden from the list.')}
              </Text>
            )}
            {!!profileNote && (
              <Text style={styles.footnote}>{profileNote}</Text>
            )}
            <TouchableOpacity
              style={[
                styles.primaryButton,
                savingProfile && styles.disabledButton,
              ]}
              onPress={saveProfile}
              disabled={savingProfile}
            >
              {savingProfile ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {t('Save my list entry')}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}

      <TouchableOpacity style={styles.secondaryButton} onPress={openList}>
        <Text style={styles.secondaryButtonText}>
          {t('See the supporters')}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.secondaryButton, restoring && styles.disabledButton]}
        onPress={restore}
        disabled={restoring}
      >
        {restoring ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Text style={styles.secondaryButtonText}>
            {t('Restore Purchases')}
          </Text>
        )}
      </TouchableOpacity>
      {state.active && (
        <TouchableOpacity style={styles.secondaryButton} onPress={manageInPlay}>
          <Text style={styles.secondaryButtonText}>
            {t('Manage or cancel in Google Play')}
          </Text>
        </TouchableOpacity>
      )}
    </>
  );

  const renderListView = () => (
    <>
      <TouchableOpacity onPress={() => setView('support')}>
        <Text style={styles.closeText}>{t('‹ Back')}</Text>
      </TouchableOpacity>
      <Text style={styles.body}>
        {t('Thank you to everyone who keeps AndroidIRCX going.')}
      </Text>
      {listLoading && (
        <View style={styles.loadingBlock}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}
      {!!listError && <Text style={styles.warning}>{listError}</Text>}
      {!listLoading && !listError && supporters?.length === 0 && (
        <Text style={styles.footnote}>
          {t('No supporters yet. You could be the first.')}
        </Text>
      )}
      {(supporters ?? []).map((entry, index) => (
        <View
          key={`${entry.name ?? 'anon'}-${index}`}
          style={[styles.listRow, entry.tier === 'big' && styles.bigCard]}
        >
          <Text style={styles.listEmoji}>{entry.emoji ?? '❤️'}</Text>
          <View style={styles.flex}>
            <Text style={styles.listName}>
              {entry.tier === 'big' ? '🌟 ' : ''}
              {entry.name ?? t('Anonymous')}
            </Text>
            {!!entry.message && (
              <Text style={styles.footnote}>{entry.message}</Text>
            )}
          </View>
        </View>
      ))}
    </>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <ModalSafeArea style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {view === 'list' ? t('Supporters') : t('Support the project')}
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeText}>{t('Close')}</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          {view === 'list' ? renderListView() : renderSupportView()}
        </ScrollView>
      </ModalSafeArea>
    </Modal>
  );
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
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
    headerTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
    closeText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
    content: { padding: 16, gap: 12 },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 16,
      gap: 8,
    },
    bigCard: { borderColor: colors.primary, borderWidth: 2 },
    cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
    body: { color: colors.text, fontSize: 14, lineHeight: 20 },
    perk: { color: colors.text, fontSize: 14, lineHeight: 22 },
    footnote: { color: colors.textSecondary, fontSize: 13, lineHeight: 18 },
    warning: { color: colors.error || colors.text, fontSize: 13 },
    planHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    planTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '700',
      flex: 1,
      marginEnd: 8,
    },
    planPrice: { color: colors.primary, fontSize: 17, fontWeight: '700' },
    planDescription: { color: colors.textSecondary, fontSize: 14 },
    primaryButton: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      minHeight: 46,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 4,
    },
    successButton: { backgroundColor: colors.success || colors.primary },
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
    },
    secondaryButtonText: {
      color: colors.primary,
      fontSize: 15,
      fontWeight: '700',
    },
    disabledButton: { opacity: 0.6 },
    loadingBlock: {
      paddingVertical: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    currentEmoji: { fontSize: 18 },
    emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    emojiCell: {
      width: 44,
      height: 44,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceVariant || colors.background,
    },
    emojiCellSelected: { borderWidth: 2, borderColor: colors.primary },
    emojiText: { fontSize: 22 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    flex: { flex: 1 },
    input: {
      backgroundColor: colors.surfaceVariant || colors.background,
      color: colors.text,
      borderRadius: 6,
      paddingHorizontal: 10,
      paddingVertical: 9,
    },
    inlineButton: {
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 8,
      paddingHorizontal: 14,
      minHeight: 44,
      justifyContent: 'center',
    },
    listRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    listEmoji: { fontSize: 24 },
    listName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  });

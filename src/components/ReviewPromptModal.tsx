/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * ReviewPromptModal.tsx
 *
 * The "rate this app" questionnaire. Three choices:
 *   • Rate on Play Store  → opens the store listing, never asks again
 *   • Remind me later     → snoozes for a week
 *   • Don't ask again      → permanently opts out
 *
 * Rendered as a transparent centred modal (same look as the app's other
 * lightweight dialogs). It calls `reviewPromptService` to persist the choice
 * and then closes via `onClose`.
 */

import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { useTheme } from '../hooks/useTheme';
import { useT } from '../i18n/transifex';
import { reviewPromptService } from '../services/ReviewPromptService';

interface ReviewPromptModalProps {
  visible: boolean;
  onClose: () => void;
}

export const ReviewPromptModal: React.FC<ReviewPromptModalProps> = ({
  visible,
  onClose,
}) => {
  const { colors } = useTheme();
  const t = useT();
  const styles = createStyles(colors);

  const handleRate = async () => {
    onClose();
    await reviewPromptService.rateNow();
  };

  const handleRemindLater = async () => {
    onClose();
    await reviewPromptService.remindLater();
  };

  const handleDismissForever = async () => {
    onClose();
    await reviewPromptService.dismissForever();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={handleRemindLater}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.starsRow}>
            {[0, 1, 2, 3, 4].map(i => (
              <Icon
                key={i}
                name="star"
                solid
                size={26}
                color={colors.warning || colors.buttonPrimary || '#FFC107'}
                style={styles.star}
              />
            ))}
          </View>

          <Text style={styles.title}>{t('Enjoying AndroidIRCX?')}</Text>
          <Text style={styles.message}>
            {t(
              'A quick rating on the Play Store really helps other IRC users find the app. It only takes a few seconds.',
            )}
          </Text>

          <TouchableOpacity
            style={[styles.button, styles.buttonPrimary]}
            onPress={handleRate}
            accessibilityRole="button"
          >
            <Text style={[styles.buttonText, styles.buttonTextPrimary]}>
              {t('Rate on Play Store')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.buttonSecondary]}
            onPress={handleRemindLater}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>{t('Remind me later')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.buttonGhost}
            onPress={handleDismissForever}
            accessibilityRole="button"
          >
            <Text style={styles.buttonGhostText}>{t("Don't ask again")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.modalOverlay || 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    card: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: colors.modalBackground || colors.surface || '#FFFFFF',
      borderRadius: 12,
      padding: 24,
      alignItems: 'center',
    },
    starsRow: {
      flexDirection: 'row',
      marginBottom: 16,
    },
    star: {
      marginHorizontal: 3,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.modalText || colors.text || '#212121',
      textAlign: 'center',
      marginBottom: 10,
    },
    message: {
      fontSize: 15,
      lineHeight: 21,
      color: colors.textSecondary || '#757575',
      textAlign: 'center',
      marginBottom: 22,
    },
    button: {
      width: '100%',
      paddingVertical: 13,
      borderRadius: 8,
      alignItems: 'center',
      marginBottom: 10,
    },
    buttonPrimary: {
      backgroundColor: colors.buttonPrimary || '#2196F3',
    },
    buttonSecondary: {
      backgroundColor: colors.buttonSecondary || '#E0E0E0',
    },
    buttonText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.buttonSecondaryText || colors.text || '#212121',
    },
    buttonTextPrimary: {
      color: colors.buttonPrimaryText || '#FFFFFF',
    },
    buttonGhost: {
      paddingVertical: 10,
      alignItems: 'center',
    },
    buttonGhostText: {
      fontSize: 14,
      color: colors.textSecondary || '#9E9E9E',
    },
  });

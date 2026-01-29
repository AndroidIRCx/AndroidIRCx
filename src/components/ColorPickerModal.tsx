/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React, { useMemo } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useT } from '../i18n/transifex';
import { ColorPalettePicker } from './ColorPalettePicker';

interface ColorPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onInsert: (code: string) => void;
  title?: string;
  colors: {
    text: string;
    textSecondary: string;
    primary: string;
    surface: string;
    border: string;
    background: string;
  };
}

export const ColorPickerModal: React.FC<ColorPickerModalProps> = ({
  visible,
  onClose,
  onInsert,
  title,
  colors,
}) => {
  const t = useT();

  const styles = useMemo(() => StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    card: {
      width: '100%',
      maxWidth: 520,
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    title: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    close: {
      color: colors.textSecondary,
      fontWeight: '600',
    },
  }), [colors]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>{title || t('mIRC Colors')}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.close}>{t('Close')}</Text>
            </TouchableOpacity>
          </View>
          <ColorPalettePicker
            colors={colors}
            onInsert={onInsert}
            insertLabel={t('Insert')}
            clearLabel={t('Clear')}
          />
        </View>
      </View>
    </Modal>
  );
};

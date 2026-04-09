/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { Modal, TouchableOpacity, View, Text, TextInput } from 'react-native';

interface RenameModalProps {
  visible: boolean;
  onClose: () => void;
  value: string;
  onChangeValue: (value: string) => void;
  onRename: () => void;
  styles: any;
}

export const RenameModal: React.FC<RenameModalProps> = ({
  visible,
  onClose,
  value,
  onChangeValue,
  onRename,
  styles,
}) => {
  const handleRename = () => {
    onClose();
    onRename();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        onPress={onClose}
        activeOpacity={1}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Rename Server Tab</Text>
          <TextInput
            style={styles.modalInput}
            placeholder="Enter new name"
            value={value}
            onChangeText={onChangeValue}
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={handleRename}
          />
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonCancel]}
              onPress={onClose}
            >
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonJoin]}
              onPress={handleRename}
            >
              <Text
                style={[styles.modalButtonText, styles.modalButtonTextPrimary]}
              >
                Rename
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

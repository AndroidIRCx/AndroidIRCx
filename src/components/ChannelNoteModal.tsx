/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { Modal, TouchableOpacity, View, Text, TextInput } from 'react-native';

interface ChannelNoteModalProps {
  visible: boolean;
  onClose: () => void;
  channelName: string;
  value: string;
  onChangeValue: (value: string) => void;
  onSave: () => void;
  styles: any;
}

export const ChannelNoteModal: React.FC<ChannelNoteModalProps> = ({
  visible,
  onClose,
  channelName,
  value,
  onChangeValue,
  onSave,
  styles,
}) => {
  const handleSave = () => {
    onClose();
    onSave();
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
          <Text style={styles.modalTitle}>Channel Note ({channelName})</Text>
          <TextInput
            style={[
              styles.modalInput,
              { minHeight: 100, textAlignVertical: 'top' },
            ]}
            multiline
            placeholder="Enter a note for this channel"
            value={value}
            onChangeText={onChangeValue}
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
              onPress={handleSave}
            >
              <Text
                style={[styles.modalButtonText, styles.modalButtonTextPrimary]}
              >
                Save
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { Modal, TouchableOpacity, View, Text } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

interface TabOption {
  text: string;
  onPress: () => void;
  style?: 'destructive' | 'cancel';
  icon?: string;
}

interface TabOptionsModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: TabOption[];
  styles: any;
  colors?: {
    text?: string;
    destructive?: string;
  };
}

export const TabOptionsModal: React.FC<TabOptionsModalProps> = ({
  visible,
  onClose,
  title,
  options,
  styles,
  colors,
}) => {
  const handleOptionPress = (option: TabOption) => {
    onClose();
    option.onPress && option.onPress();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} onPress={onClose} activeOpacity={1}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{title || 'Options'}</Text>
          {options.map((opt, idx) => (
            <TouchableOpacity
              key={`${opt.text}-${idx}`}
              style={[styles.modalButton, opt.style === 'destructive' && styles.modalButtonCancel]}
              onPress={() => handleOptionPress(opt)}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {opt.icon && (
                  <Icon
                    name={opt.icon}
                    size={20}
                    color={opt.style === 'destructive' ? (colors?.destructive || '#EF5350') : (colors?.text || '#666')}
                    style={{ marginRight: 12 }}
                  />
                )}
                <Text
                  style={[
                    styles.modalButtonText,
                    opt.style === 'destructive' && styles.destructiveOption,
                  ]}>
                  {opt.text}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

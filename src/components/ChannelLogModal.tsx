/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { Modal, TouchableOpacity, View, Text } from 'react-native';
import { formatLocalDateTime } from '../utils/localeSafe';

interface LogEntry {
  timestamp: number;
  text: string;
}

interface ChannelLogModalProps {
  visible: boolean;
  onClose: () => void;
  logEntries: LogEntry[];
  onClearLog: () => void;
  styles: any;
}

export const ChannelLogModal: React.FC<ChannelLogModalProps> = ({
  visible,
  onClose,
  logEntries,
  onClearLog,
  styles,
}) => {
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
        <View style={[styles.modalContent, { maxHeight: '80%' }]}>
          <Text style={styles.modalTitle}>Channel Activity</Text>
          <View style={{ maxHeight: 300 }}>
            {logEntries.length === 0 ? (
              <Text style={styles.optionText}>No activity recorded</Text>
            ) : (
              logEntries.map((entry, idx) => (
                <Text key={`log-${idx}`} style={styles.optionText}>
                  {formatLocalDateTime(entry.timestamp)} - {entry.text}
                </Text>
              ))
            )}
          </View>
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonCancel]}
              onPress={onClose}
            >
              <Text style={styles.modalButtonText}>Close</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonJoin]}
              onPress={onClearLog}
            >
              <Text
                style={[styles.modalButtonText, styles.modalButtonTextPrimary]}
              >
                Clear Log
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

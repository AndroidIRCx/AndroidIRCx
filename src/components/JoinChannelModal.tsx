import React from 'react';
import { Modal, TouchableOpacity, View, Text, TextInput } from 'react-native';

interface JoinChannelModalProps {
  visible: boolean;
  onClose: () => void;
  channelName: string;
  onChangeChannelName: (name: string) => void;
  onJoin: (channel: string) => void;
  onCancel: () => void;
  styles: any;
}

export const JoinChannelModal: React.FC<JoinChannelModalProps> = ({
  visible,
  onClose,
  channelName,
  onChangeChannelName,
  onJoin,
  onCancel,
  styles,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Join Channel</Text>
          <TextInput
            style={styles.modalInput}
            placeholder="Enter channel name (e.g., #android)"
            value={channelName}
            onChangeText={onChangeChannelName}
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={() => {
              const trimmed = channelName.trim();
              if (trimmed) {
                onJoin(trimmed);
              }
            }}
          />
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonCancel]}
              onPress={onCancel}>
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonJoin]}
              onPress={() => {
                const trimmed = channelName.trim();
                if (trimmed) {
                  onJoin(trimmed);
                }
              }}
              disabled={!channelName.trim()}>
              <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>Join</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

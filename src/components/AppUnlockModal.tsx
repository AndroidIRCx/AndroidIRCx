import React from 'react';
import { Modal, TouchableOpacity, View, Text, TextInput } from 'react-native';

interface AppUnlockModalProps {
  visible: boolean;
  useBiometric: boolean;
  usePin: boolean;
  pinEntry: string;
  pinError: string;
  onChangePinEntry: (pin: string) => void;
  onClearPinError: () => void;
  onBiometricUnlock: () => void;
  onPinUnlock: () => void;
  colors: any;
  styles: any;
}

export const AppUnlockModal: React.FC<AppUnlockModalProps> = ({
  visible,
  useBiometric,
  usePin,
  pinEntry,
  pinError,
  onChangePinEntry,
  onClearPinError,
  onBiometricUnlock,
  onPinUnlock,
  colors,
  styles,
}) => {
  const handlePinChange = (text: string) => {
    const sanitized = text.replace(/[^0-9]/g, '');
    onChangePinEntry(sanitized);
    if (pinError) {
      onClearPinError();
    }
  };

  const handleBiometricPress = () => {
    // Clear any previous errors when attempting biometric unlock
    if (pinError) {
      onClearPinError();
    }
    onBiometricUnlock();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {}}>
      <View style={styles.lockOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>App Locked</Text>
          {usePin && (
            <TextInput
              style={styles.modalInput}
              placeholder="Enter PIN"
              value={pinEntry}
              onChangeText={handlePinChange}
              keyboardType="numeric"
              secureTextEntry
            />
          )}
          {/* Show error message for both PIN and biometric errors */}
          {!!pinError && (
            <Text style={[styles.optionText, { color: colors.error, marginTop: 8, marginBottom: 8 }]}>
              {pinError}
            </Text>
          )}
          <View style={styles.modalButtons}>
            {useBiometric && (
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonJoin]}
                onPress={handleBiometricPress}>
                <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>
                  Use Biometrics
                </Text>
              </TouchableOpacity>
            )}
            {usePin && (
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonJoin]}
                onPress={onPinUnlock}>
                <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>
                  Unlock
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

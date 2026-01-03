import React, { useState } from 'react';
import { Modal, TouchableOpacity, View, Text, TextInput, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';

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
  onKillSwitch?: () => void;
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
  onKillSwitch,
  colors,
  styles,
}) => {
  const [showKillSwitchConfirm, setShowKillSwitchConfirm] = useState(false);

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

  const handleKillSwitchPress = () => {
    // Directly trigger kill switch - it will verify PIN/biometric
    // No warnings shown on lock screen for faster emergency use
    onKillSwitch();
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
          
          {/* Kill Switch Button - only show if enabled */}
          {onKillSwitch && (
            <TouchableOpacity
              style={[styles.killSwitchButton, { borderColor: colors.error || '#f44336' }]}
              onPress={handleKillSwitchPress}>
              <Icon name="skull" size={16} color={colors.error || '#f44336'} solid style={{ marginRight: 8 }} />
              <Text style={[styles.killSwitchText, { color: colors.error || '#f44336' }]}>
                🚨 Kill Switch
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { BAN_MASK_TYPES, banService, PredefinedReason } from '../services/BanService';
import { settingsService, NEW_FEATURE_DEFAULTS } from '../services/SettingsService';

interface ThemeColors {
  background: string;
  text: string;
  accent: string;
  border: string;
  inputBackground: string;
}

interface KickBanModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (options: {
    reason: string;
    banType: number;
    kick: boolean;
    ban: boolean;
    unbanAfterSeconds?: number;
  }) => void;
  nick: string;
  userHost?: string;  // user@host for preview
  mode: 'kick' | 'ban' | 'kickban';
  colors: ThemeColors;
}

const KickBanModal: React.FC<KickBanModalProps> = ({
  visible,
  onClose,
  onConfirm,
  nick,
  userHost,
  mode,
  colors,
}) => {
  const [reason, setReason] = useState('');
  const [selectedBanType, setSelectedBanType] = useState<number>(2);
  
  // Load default ban type from settings when modal opens
  useEffect(() => {
    if (visible) {
      const loadDefaultBanType = async () => {
        const banType = await settingsService.getSetting('defaultBanType', NEW_FEATURE_DEFAULTS.defaultBanType);
        setSelectedBanType(banType);
      };
      loadDefaultBanType();
    }
  }, [visible]);
  const [showUnbanTimer, setShowUnbanTimer] = useState(false);
  const [unbanTimeValue, setUnbanTimeValue] = useState('');
  const [unbanTimeUnit, setUnbanTimeUnit] = useState<'seconds' | 'minutes' | 'hours'>('seconds');
  
  // Extract user and host from userHost if available
  const [user, host] = userHost ? userHost.split('@') : ['', ''];
  
  // Generate ban mask preview
  const banMaskPreview = user && host 
    ? banService.generateBanMask(nick, user, host, selectedBanType)
    : '';

  const predefinedReasons = banService.getPredefinedReasons();

  useEffect(() => {
    if (!visible) {
      // Reset form when modal closes
      setReason('');
      setShowUnbanTimer(false);
      setUnbanTimeValue('');
    }
  }, [visible]);

  const handleConfirm = () => {
    if (!reason.trim()) {
      Alert.alert('Error', 'Please enter a reason for the action.');
      return;
    }

    let unbanAfterSeconds: number | undefined;
    if (showUnbanTimer && unbanTimeValue) {
      const value = parseInt(unbanTimeValue, 10);
      if (isNaN(value) || value <= 0) {
        Alert.alert('Error', 'Please enter a valid time value.');
        return;
      }
      
      switch (unbanTimeUnit) {
        case 'seconds':
          unbanAfterSeconds = value;
          break;
        case 'minutes':
          unbanAfterSeconds = value * 60;
          break;
        case 'hours':
          unbanAfterSeconds = value * 3600;
          break;
      }
    }

    onConfirm({
      reason: reason.trim(),
      banType: selectedBanType,
      kick: mode === 'kick' || mode === 'kickban',
      ban: mode === 'ban' || mode === 'kickban',
      unbanAfterSeconds,
    });

    onClose();
  };

  const handlePredefinedReasonSelect = (reasonText: string) => {
    setReason(reasonText);
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={[styles.centeredView, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.modalView, { backgroundColor: colors.background }]}>
          <Text style={[styles.title, { color: colors.text }]}>
            {mode === 'kick' ? 'Kick' : mode === 'ban' ? 'Ban' : 'Kick/Ban'}: {nick}
          </Text>
          
          {userHost ? (
            <Text style={[styles.subtitle, { color: colors.text }]}>
              Host: {userHost}
            </Text>
          ) : (
            <Text style={[styles.subtitle, { color: colors.text, fontStyle: 'italic', opacity: 0.7 }]}>
              Fetching user info...
            </Text>
          )}

          {/* Reason Input */}
          <Text style={[styles.label, { color: colors.text }]}>Reason:</Text>
          <TextInput
            style={[styles.input, { 
              backgroundColor: colors.inputBackground, 
              color: colors.text,
              borderColor: colors.border,
            }]}
            value={reason}
            onChangeText={setReason}
            placeholder="Enter reason..."
            multiline
            numberOfLines={3}
          />

          {/* Quick Reasons */}
          <Text style={[styles.label, { color: colors.text, marginTop: 15 }]}>Quick Reasons:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickReasonsContainer}>
            {predefinedReasons.map((reasonItem) => (
              <TouchableOpacity
                key={reasonItem.id}
                style={[styles.quickReasonButton, { backgroundColor: colors.accent }]}
                onPress={() => handlePredefinedReasonSelect(reasonItem.text)}
              >
                <Text style={styles.quickReasonText}>{reasonItem.text}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Ban Type Selector */}
          <Text style={[styles.label, { color: colors.text, marginTop: 15 }]}>Ban Type:</Text>
          <View style={[styles.pickerContainer, { borderColor: colors.border }]}>
            <Picker
              selectedValue={selectedBanType}
              onValueChange={(itemValue) => setSelectedBanType(itemValue)}
              style={{ color: colors.text }}
            >
              {BAN_MASK_TYPES.map((type) => (
                <Picker.Item 
                  key={type.id} 
                  label={`${type.id} - ${type.description}`} 
                  value={type.id} 
                />
              ))}
            </Picker>
          </View>

          {/* Ban Mask Preview */}
          {banMaskPreview && (
            <>
              <Text style={[styles.label, { color: colors.text, marginTop: 15 }]}>Ban Mask Preview:</Text>
              <Text style={[styles.previewText, { color: colors.text }]}>{banMaskPreview}</Text>
            </>
          )}

          {/* Timed Unban */}
          <View style={styles.toggleContainer}>
            <Text style={[styles.label, { color: colors.text }]}>Remove ban after:</Text>
            <Switch
              value={showUnbanTimer}
              onValueChange={setShowUnbanTimer}
              trackColor={{ false: '#767577', true: colors.accent }}
              thumbColor={showUnbanTimer ? '#f4f3f4' : '#f4f3f4'}
            />
          </View>

          {showUnbanTimer && (
            <View style={styles.timeInputContainer}>
              <TextInput
                style={[styles.timeInput, { 
                  backgroundColor: colors.inputBackground, 
                  color: colors.text,
                  borderColor: colors.border,
                }]}
                value={unbanTimeValue}
                onChangeText={setUnbanTimeValue}
                placeholder="Time"
                keyboardType="numeric"
              />
              
              <View style={[styles.pickerContainer, { borderColor: colors.border, marginLeft: 10 }]}>
                <Picker
                  selectedValue={unbanTimeUnit}
                  onValueChange={(itemValue) => setUnbanTimeUnit(itemValue)}
                  style={{ color: colors.text }}
                >
                  <Picker.Item label="seconds" value="seconds" />
                  <Picker.Item label="minutes" value="minutes" />
                  <Picker.Item label="hours" value="hours" />
                </Picker>
              </View>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton, { backgroundColor: colors.inputBackground }]}
              onPress={onClose}
            >
              <Text style={[styles.buttonText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.confirmButton, { backgroundColor: colors.accent }]}
              onPress={handleConfirm}
            >
              <Text style={styles.buttonText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 22,
  },
  modalView: {
    margin: 20,
    width: '90%',
    maxHeight: '90%',
    borderRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 15,
    opacity: 0.7,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderRadius: 5,
    padding: 10,
    minHeight: 60,
  },
  quickReasonsContainer: {
    flexDirection: 'row',
    marginTop: 5,
  },
  quickReasonButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
    marginRight: 8,
  },
  quickReasonText: {
    color: 'white',
    fontSize: 12,
  },
  pickerContainer: {
    borderWidth: 1,
    borderRadius: 5,
    overflow: 'hidden',
  },
  previewText: {
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 5,
    fontFamily: 'monospace',
    fontSize: 12,
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 15,
  },
  timeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  timeInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 5,
    padding: 10,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
  },
  button: {
    padding: 10,
    borderRadius: 5,
    minWidth: 80,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    // Specific styles for cancel button
  },
  confirmButton: {
    // Specific styles for confirm button
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default KickBanModal;
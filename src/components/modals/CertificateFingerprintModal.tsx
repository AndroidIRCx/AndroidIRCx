/**
 * Certificate Fingerprint Modal
 *
 * Displays certificate fingerprint with options to:
 * - Copy fingerprint to clipboard
 * - Copy NickServ command
 * - Send fingerprint to IRC service (NickServ, CertFP, HostServ)
 * - View QR code (optional)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  Modal,
  StyleSheet,
  ScrollView,
  Alert,
  Switch,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import QRCode from 'react-native-qrcode-svg';
import { certificateManager } from '../../services/CertificateManagerService';
import { FingerprintFormat, IRCService } from '../../types/certificate';
import { useT } from '../../i18n/transifex';

interface CertificateFingerprintModalProps {
  visible: boolean;
  onClose: () => void;
  fingerprint: string;
  onSendToNickServ?: (command: string) => void;
  showQRCode?: boolean;
}

export const CertificateFingerprintModal: React.FC<CertificateFingerprintModalProps> = ({
  visible,
  onClose,
  fingerprint,
  onSendToNickServ,
  showQRCode = true,
}) => {
  const t = useT();
  const [useColons, setUseColons] = useState(true);
  const [selectedService, setSelectedService] = useState<IRCService>(IRCService.NICKSERV);

  const getFormattedFingerprint = () => {
    const format = useColons
      ? FingerprintFormat.COLON_SEPARATED_UPPER
      : FingerprintFormat.NO_COLON_UPPER;
    return certificateManager.formatFingerprint(fingerprint, format);
  };

  const handleCopyFingerprint = () => {
    const formatted = getFormattedFingerprint();
    Clipboard.setString(formatted);
    Alert.alert(t('Copied'), t('Fingerprint copied to clipboard'));
  };

  const handleCopyCommand = () => {
    const formatted = getFormattedFingerprint();
    const command = `/msg ${selectedService} CERT ADD ${formatted}`;
    Clipboard.setString(command);
    Alert.alert(t('Copied'), t('Command copied to clipboard'));
  };

  const handleSendToService = () => {
    const formatted = getFormattedFingerprint();
    const command = `/msg ${selectedService} CERT ADD ${formatted}`;

    if (onSendToNickServ) {
      onSendToNickServ(command);
      Alert.alert(
        t('Sent'),
        t('Fingerprint command sent to {{service}}', { service: selectedService })
      );
      onClose();
    } else {
      // Fallback to copy
      Clipboard.setString(command);
      Alert.alert(t('Copied'), t('Command copied to clipboard'));
    }
  };

  const ServiceButton = ({ service }: { service: IRCService }) => {
    const isSelected = selectedService === service;
    return (
      <Pressable
        onPress={() => setSelectedService(service)}
        style={({ pressed }) => [
          styles.serviceButton,
          isSelected && styles.serviceButtonSelected,
          pressed && styles.serviceButtonPressed,
        ]}
        android_ripple={{ color: 'rgba(255, 255, 255, 0.12)' }}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
      >
        <Text style={[styles.serviceButtonText, isSelected && styles.serviceButtonTextSelected]}>
          {service}
        </Text>
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{t('Certificate Fingerprint')}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            {/* Fingerprint Display */}
            <View style={styles.fingerprintContainer}>
              <View style={styles.fingerprintHeader}>
                <Text style={styles.fingerprintLabel}>SHA-256:</Text>
                <View style={styles.formatToggle}>
                  <Text style={styles.formatToggleLabel}>{t('Colons')}</Text>
                  <Switch
                    value={useColons}
                    onValueChange={setUseColons}
                    trackColor={{ false: '#3A3A3A', true: '#4A9EFF' }}
                    thumbColor={useColons ? '#FFFFFF' : '#B0B0B0'}
                  />
                </View>
              </View>

              <View style={styles.fingerprintBox}>
                <Text style={styles.fingerprintValue} selectable>
                  {getFormattedFingerprint()}
                </Text>
              </View>

              <TouchableOpacity style={styles.actionButton} onPress={handleCopyFingerprint}>
                <Text style={styles.actionButtonIcon}>📋</Text>
                <Text style={styles.actionButtonText}>{t('Copy Fingerprint')}</Text>
              </TouchableOpacity>
            </View>

            {/* QR Code */}
            {showQRCode && (
              <View style={styles.qrContainer}>
                <Text style={styles.sectionLabel}>{t('QR Code')}</Text>
                <View style={styles.qrBox}>
                  <QRCode
                    value={`certfp://${getFormattedFingerprint()}`}
                    size={200}
                    backgroundColor="#FFFFFF"
                    color="#000000"
                  />
                </View>
                <Text style={styles.qrHint}>
                  {t('Scan to quickly share your certificate fingerprint')}
                </Text>
              </View>
            )}

            {/* IRC Service Selection */}
            <View style={styles.serviceContainer}>
              <Text style={styles.sectionLabel}>{t('IRC Service')}</Text>
              <View style={styles.serviceButtons}>
                <ServiceButton service={IRCService.NICKSERV} />
                <ServiceButton service={IRCService.CERTFP} />
                <ServiceButton service={IRCService.HOSTSERV} />
              </View>
            </View>

            {/* Commands */}
            <View style={styles.commandContainer}>
              <Text style={styles.sectionLabel}>{t('Command')}</Text>
              <View style={styles.commandBox}>
                <Text style={styles.commandText} selectable>
                  /msg {selectedService} CERT ADD {getFormattedFingerprint()}
                </Text>
              </View>

              <TouchableOpacity style={styles.actionButton} onPress={handleCopyCommand}>
                <Text style={styles.actionButtonIcon}>📋</Text>
                <Text style={styles.actionButtonText}>{t('Copy Command')}</Text>
              </TouchableOpacity>

              {onSendToNickServ && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.sendButton]}
                  onPress={handleSendToService}>
                  <Text style={styles.actionButtonIcon}>📤</Text>
                  <Text style={styles.actionButtonText}>
                    {t('Send to {{service}}', { service: selectedService })}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Info */}
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>ℹ️ {t('How to use')}</Text>
              <Text style={styles.infoText}>
                {t(
                  '1. Copy the command above\n' +
                    '2. Send it to {{service}} on IRC\n' +
                    '3. Your certificate will be associated with your nickname\n' +
                    '4. You can now authenticate using SASL EXTERNAL',
                  { service: selectedService }
                )}
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '90%',
    maxWidth: 500,
    maxHeight: '85%',
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    backgroundColor: '#252525',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  closeButton: {
    padding: 8,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#B0B0B0',
    fontWeight: 'bold',
  },
  content: {
    padding: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A9EFF',
    marginBottom: 12,
  },
  fingerprintContainer: {
    marginBottom: 24,
  },
  fingerprintHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  fingerprintLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A9EFF',
  },
  formatToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  formatToggleLabel: {
    fontSize: 12,
    color: '#B0B0B0',
  },
  fingerprintBox: {
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#4A9EFF',
  },
  fingerprintValue: {
    fontSize: 13,
    color: '#FFFFFF',
    fontFamily: 'monospace',
    lineHeight: 20,
  },
  qrContainer: {
    marginBottom: 24,
    alignItems: 'center',
  },
  qrBox: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  qrHint: {
    fontSize: 12,
    color: '#808080',
    textAlign: 'center',
  },
  serviceContainer: {
    marginBottom: 24,
  },
  serviceButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  serviceButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#2A2A2A',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3A3A3A',
    alignItems: 'center',
    minWidth: 90,
  },
  serviceButtonPressed: {
    opacity: 0.85,
  },
  serviceButtonSelected: {
    backgroundColor: '#4A9EFF',
    borderColor: '#4A9EFF',
  },
  serviceButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#B0B0B0',
  },
  serviceButtonTextSelected: {
    color: '#FFFFFF',
  },
  commandContainer: {
    marginBottom: 24,
  },
  commandBox: {
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#3A3A3A',
  },
  commandText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2A3A4A',
    borderRadius: 8,
    paddingVertical: 12,
    marginBottom: 8,
    gap: 8,
  },
  sendButton: {
    backgroundColor: '#4CAF50',
  },
  actionButtonIcon: {
    fontSize: 18,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  infoBox: {
    backgroundColor: '#2A3A4A',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4A9EFF',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A9EFF',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#B0B0B0',
    lineHeight: 18,
  },
});

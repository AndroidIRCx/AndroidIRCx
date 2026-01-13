/**
 * Certificate Generator Modal
 *
 * UI for generating new RSA-2048 X.509 self-signed certificates
 * for IRC SASL EXTERNAL authentication.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { certificateManager } from '../../services/CertificateManagerService';
import { CertificateInfo, FingerprintFormat } from '../../types/certificate';
import { useT } from '../../i18n/transifex';

interface CertificateGeneratorModalProps {
  visible: boolean;
  onClose: () => void;
  onCertificateGenerated?: (cert: CertificateInfo) => void;
  defaultName?: string;
  defaultCommonName?: string;
}

export const CertificateGeneratorModal: React.FC<CertificateGeneratorModalProps> = ({
  visible,
  onClose,
  onCertificateGenerated,
  defaultName = 'IRC Certificate',
  defaultCommonName = '',
}) => {
  const t = useT();
  const [name, setName] = useState(defaultName);
  const [commonName, setCommonName] = useState(defaultCommonName);
  const [validityYears, setValidityYears] = useState('1');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCert, setGeneratedCert] = useState<CertificateInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    // Validate inputs
    if (!name.trim()) {
      Alert.alert(t('Error'), t('Certificate name is required'));
      return;
    }
    if (!commonName.trim()) {
      Alert.alert(t('Error'), t('Common Name (CN) is required'));
      return;
    }

    const years = parseInt(validityYears, 10);
    if (isNaN(years) || years < 1 || years > 10) {
      Alert.alert(t('Error'), t('Validity period must be between 1 and 10 years'));
      return;
    }

    setIsGenerating(true);
    setError(null);

    // Yield to allow UI to render the loading overlay before heavy work starts.
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

    try {
      const cert = await certificateManager.generateCertificate({
        name: name.trim(),
        commonName: commonName.trim(),
        validityYears: years,
      });

      setGeneratedCert(cert);
      onCertificateGenerated?.(cert);
    } catch (err: any) {
      setError(err.message || t('Failed to generate certificate'));
      Alert.alert(t('Error'), err.message || t('Failed to generate certificate'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyFingerprint = () => {
    if (generatedCert) {
      const formatted = certificateManager.formatFingerprint(
        generatedCert.fingerprint,
        FingerprintFormat.COLON_SEPARATED_UPPER
      );
      Clipboard.setString(formatted);
      Alert.alert(t('Copied'), t('Fingerprint copied to clipboard'));
    }
  };

  const handleDone = () => {
    setGeneratedCert(null);
    setName(defaultName);
    setCommonName(defaultCommonName);
    setValidityYears('1');
    setError(null);
    onClose();
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleDone}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {generatedCert ? t('Certificate Generated') : t('Generate Certificate')}
          </Text>
          <TouchableOpacity
            onPress={handleDone}
            style={[styles.closeButton, isGenerating && styles.closeButtonDisabled]}
            disabled={isGenerating}
          >
            <Text style={styles.closeButtonText}>
              {generatedCert ? t('Done') : t('Cancel')}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {!generatedCert ? (
            /* Generation Form */
            <View>
              <Text style={styles.description}>
                {t(
                  'Generate a new RSA-2048 self-signed certificate for IRC SASL EXTERNAL authentication.'
                )}
              </Text>

              {/* Certificate Name */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  {t('Certificate Name')} <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder={t('e.g., My IRC Certificate')}
                  placeholderTextColor="#9E9E9E"
                  editable={!isGenerating}
                />
                <Text style={styles.hint}>{t('A friendly name for this certificate')}</Text>
              </View>

              {/* Common Name (CN) */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  {t('Common Name (CN)')} <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  value={commonName}
                  onChangeText={setCommonName}
                  placeholder={t('e.g., nick@irc.network')}
                  placeholderTextColor="#9E9E9E"
                  autoCapitalize="none"
                  editable={!isGenerating}
                />
                <Text style={styles.hint}>
                  {t('Your nickname or email (used in certificate CN field)')}
                </Text>
              </View>

              {/* Validity Period */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('Validity Period (years)')}</Text>
                <TextInput
                  style={styles.input}
                  value={validityYears}
                  onChangeText={setValidityYears}
                  placeholder="1"
                  placeholderTextColor="#9E9E9E"
                  keyboardType="number-pad"
                  editable={!isGenerating}
                />
                <Text style={styles.hint}>{t('Certificate validity: 1-10 years')}</Text>
              </View>

              {/* Error Display */}
              {error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {/* Generate Button */}
              <TouchableOpacity
                style={[styles.button, styles.generateButton, isGenerating && styles.buttonDisabled]}
                onPress={handleGenerate}
                disabled={isGenerating}>
                {isGenerating ? (
                  <View style={styles.buttonContent}>
                    <ActivityIndicator color="#FFFFFF" size="small" />
                    <Text style={styles.buttonText}>{t('Generating...')}</Text>
                  </View>
                ) : (
                  <Text style={styles.buttonText}>{t('Generate Certificate')}</Text>
                )}
              </TouchableOpacity>

              {/* Info Box */}
              <View style={styles.infoBox}>
                <Text style={styles.infoTitle}>ℹ️ {t('What is this?')}</Text>
                <Text style={styles.infoText}>
                  {t(
                    'Client certificates allow you to authenticate to IRC servers using TLS certificates instead of passwords. This is more secure and supported by many modern IRC networks.'
                  )}
                </Text>
              </View>
            </View>
          ) : (
            /* Success Screen */
            <View>
              <View style={styles.successIcon}>
                <Text style={styles.successEmoji}>✅</Text>
              </View>

              <Text style={styles.successTitle}>{t('Certificate Generated Successfully!')}</Text>

              {/* Certificate Details */}
              <View style={styles.certDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('Name:')}</Text>
                  <Text style={styles.detailValue}>{generatedCert.name}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('Common Name:')}</Text>
                  <Text style={styles.detailValue}>{generatedCert.commonName}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('Valid From:')}</Text>
                  <Text style={styles.detailValue}>{formatDate(generatedCert.validFrom)}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('Valid To:')}</Text>
                  <Text style={styles.detailValue}>{formatDate(generatedCert.validTo)}</Text>
                </View>
              </View>

              {/* Fingerprint */}
              <View style={styles.fingerprintBox}>
                <Text style={styles.fingerprintLabel}>{t('SHA-256 Fingerprint:')}</Text>
                <Text style={styles.fingerprintValue}>
                  {certificateManager.formatFingerprint(
                    generatedCert.fingerprint,
                    FingerprintFormat.COLON_SEPARATED_UPPER
                  )}
                </Text>
                <TouchableOpacity style={styles.copyButton} onPress={handleCopyFingerprint}>
                  <Text style={styles.copyButtonText}>📋 {t('Copy Fingerprint')}</Text>
                </TouchableOpacity>
              </View>

              {/* Next Steps */}
              <View style={styles.infoBox}>
                <Text style={styles.infoTitle}>📝 {t('Next Steps:')}</Text>
                <Text style={styles.infoText}>
                  1. {t('Configure your IRC network to use this certificate')}{'\n'}
                  2. {t('Add the fingerprint to NickServ: /msg NickServ CERT ADD <fingerprint>')}
                  {'\n'}
                  3. {t('Connect to IRC server with SASL EXTERNAL enabled')}
                </Text>
              </View>
            </View>
          )}
        </ScrollView>
        {isGenerating && (
          <View style={styles.generatingOverlay}>
            <View style={styles.generatingCard}>
              <ActivityIndicator size="large" color="#4A9EFF" />
              <Text style={styles.generatingTitle}>{t('Generating certificate...')}</Text>
              <Text style={styles.generatingHint}>
                {t('This can take a few seconds on older phones.')}
              </Text>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E1E1E',
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
  },
  closeButtonDisabled: {
    opacity: 0.5,
  },
  closeButtonText: {
    fontSize: 16,
    color: '#4A9EFF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  description: {
    fontSize: 14,
    color: '#B0B0B0',
    marginBottom: 20,
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  required: {
    color: '#FF5252',
  },
  input: {
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#3A3A3A',
  },
  hint: {
    fontSize: 12,
    color: '#808080',
    marginTop: 4,
  },
  errorBox: {
    backgroundColor: '#3D1F1F',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FF5252',
  },
  errorText: {
    fontSize: 14,
    color: '#FF8A80',
  },
  button: {
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  generateButton: {
    backgroundColor: '#4A9EFF',
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    fontSize: 16,
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
  successIcon: {
    alignItems: 'center',
    marginVertical: 20,
  },
  successEmoji: {
    fontSize: 64,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
    textAlign: 'center',
    marginBottom: 24,
  },
  certDetails: {
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#B0B0B0',
    width: 120,
  },
  detailValue: {
    fontSize: 14,
    color: '#FFFFFF',
    flex: 1,
  },
  fingerprintBox: {
    backgroundColor: '#2A3A2A',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  fingerprintLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4CAF50',
    marginBottom: 8,
  },
  fingerprintValue: {
    fontSize: 12,
    color: '#FFFFFF',
    fontFamily: 'monospace',
    lineHeight: 18,
    marginBottom: 12,
  },
  copyButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
  },
  copyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  generatingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  generatingCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#252525',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  generatingTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  generatingHint: {
    marginTop: 8,
    fontSize: 13,
    color: '#B0B0B0',
    textAlign: 'center',
    lineHeight: 18,
  },
});

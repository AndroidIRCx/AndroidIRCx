/**
 * Certificate Selector Modal
 *
 * UI for selecting existing certificates or generating new ones.
 * Displays list of all generated certificates with validity status.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { certificateManager } from '../../services/CertificateManagerService';
import { CertificateMetadata, CertificateInfo } from '../../types/certificate';
import { CertificateGeneratorModal } from './CertificateGeneratorModal';
import { useT } from '../../i18n/transifex';

interface CertificateSelectorModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (cert: CertificateInfo) => void;
  defaultCommonName?: string;
}

export const CertificateSelectorModal: React.FC<CertificateSelectorModalProps> = ({
  visible,
  onClose,
  onSelect,
  defaultCommonName,
}) => {
  const t = useT();
  const [certificates, setCertificates] = useState<CertificateMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);

  useEffect(() => {
    if (visible) {
      loadCertificates();
    }
  }, [visible]);

  const loadCertificates = async () => {
    setLoading(true);
    try {
      const certs = await certificateManager.listCertificates();
      // Sort by creation date (newest first)
      certs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setCertificates(certs);
    } catch (error) {
      console.error('Failed to load certificates:', error);
      Alert.alert(t('Error'), t('Failed to load certificates'));
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (certMetadata: CertificateMetadata) => {
    // Validate certificate
    const validation = certificateManager.validateCertificate(certMetadata);
    if (validation.isExpired) {
      Alert.alert(
        t('Certificate Expired'),
        t('This certificate has expired. Please generate a new one.'),
        [{ text: t('OK') }]
      );
      return;
    }

    // Fetch full certificate with private key
    try {
      const fullCert = await certificateManager.getCertificate(certMetadata.id);
      if (!fullCert) {
        Alert.alert(t('Error'), t('Certificate not found'));
        return;
      }
      onSelect(fullCert);
      onClose();
    } catch (error) {
      console.error('Failed to get certificate:', error);
      Alert.alert(t('Error'), t('Failed to load certificate details'));
    }
  };

  const handleDelete = (cert: CertificateMetadata) => {
    Alert.alert(
      t('Delete Certificate'),
      t(
        'Are you sure you want to delete this certificate? This action cannot be undone. You will need to generate a new certificate and re-add it to IRC services.'
      ),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await certificateManager.deleteCertificate(cert.id);
              await loadCertificates();
              Alert.alert(t('Success'), t('Certificate deleted'));
            } catch (error) {
              console.error('Failed to delete certificate:', error);
              Alert.alert(t('Error'), t('Failed to delete certificate'));
            }
          },
        },
      ]
    );
  };

  const handleGenerateNew = () => {
    setShowGenerator(true);
  };

  const handleCertificateGenerated = () => {
    setShowGenerator(false);
    loadCertificates();
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusIndicator = (cert: CertificateMetadata) => {
    const validation = certificateManager.validateCertificate(cert);
    if (validation.isExpired) {
      return { color: '#FF5252', label: t('Expired') };
    }
    if (validation.daysUntilExpiry < 30) {
      return { color: '#FFA726', label: t('Expires Soon') };
    }
    return { color: '#4CAF50', label: t('Valid') };
  };

  const renderCertificate = ({ item }: { item: CertificateMetadata }) => {
    const status = getStatusIndicator(item);
    const shortFingerprint = `${item.fingerprint.substring(0, 16).toUpperCase()}...`;

    return (
      <View style={styles.certItem}>
        <TouchableOpacity
          style={styles.certContent}
          onPress={() => handleSelect(item)}
          activeOpacity={0.7}>
          <View style={styles.certHeader}>
            <Text style={styles.certName}>{item.name}</Text>
            <View style={[styles.statusBadge, { backgroundColor: status.color + '20' }]}>
              <View style={[styles.statusDot, { backgroundColor: status.color }]} />
              <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
            </View>
          </View>

          <Text style={styles.certCommonName}>CN: {item.commonName}</Text>

          <View style={styles.certMeta}>
            <Text style={styles.certMetaText}>
              🔑 {shortFingerprint}
            </Text>
          </View>

          <Text style={styles.certValidity}>
            {t('Valid:')} {formatDate(item.validFrom)} - {formatDate(item.validTo)}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDelete(item)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.deleteButtonText}>🗑️</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyEmoji}>🔐</Text>
      <Text style={styles.emptyTitle}>{t('No Certificates')}</Text>
      <Text style={styles.emptyText}>
        {t('You haven\'t generated any certificates yet. Generate one to get started.')}
      </Text>
      <TouchableOpacity style={styles.generateButton} onPress={handleGenerateNew}>
        <Text style={styles.generateButtonText}>➕ {t('Generate New Certificate')}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <>
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{t('Select Certificate')}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>{t('Cancel')}</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4A9EFF" />
              <Text style={styles.loadingText}>{t('Loading certificates...')}</Text>
            </View>
          ) : (
            <>
              {certificates.length > 0 && (
                <View style={styles.toolbar}>
                  <Text style={styles.toolbarText}>
                    {certificates.length} {certificates.length === 1 ? t('certificate') : t('certificates')}
                  </Text>
                  <TouchableOpacity onPress={handleGenerateNew} style={styles.toolbarButton}>
                    <Text style={styles.toolbarButtonText}>➕ {t('New')}</Text>
                  </TouchableOpacity>
                </View>
              )}

              <FlatList
                data={certificates}
                renderItem={renderCertificate}
                keyExtractor={item => item.id}
                contentContainerStyle={
                  certificates.length === 0 ? styles.emptyList : styles.listContent
                }
                ListEmptyComponent={renderEmpty}
              />
            </>
          )}
        </View>
      </Modal>

      {/* Generator Modal */}
      <CertificateGeneratorModal
        visible={showGenerator}
        onClose={() => setShowGenerator(false)}
        onCertificateGenerated={handleCertificateGenerated}
        defaultCommonName={defaultCommonName}
      />
    </>
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
  closeButtonText: {
    fontSize: 16,
    color: '#4A9EFF',
    fontWeight: '600',
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#252525',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  toolbarText: {
    fontSize: 14,
    color: '#B0B0B0',
  },
  toolbarButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#4A9EFF',
    borderRadius: 6,
  },
  toolbarButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#B0B0B0',
  },
  listContent: {
    padding: 16,
  },
  emptyList: {
    flex: 1,
  },
  certItem: {
    flexDirection: 'row',
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#3A3A3A',
  },
  certContent: {
    flex: 1,
    padding: 16,
  },
  certHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  certName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  certCommonName: {
    fontSize: 14,
    color: '#B0B0B0',
    marginBottom: 8,
  },
  certMeta: {
    marginBottom: 8,
  },
  certMetaText: {
    fontSize: 12,
    color: '#808080',
    fontFamily: 'monospace',
  },
  certValidity: {
    fontSize: 12,
    color: '#808080',
  },
  deleteButton: {
    width: 60,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#3A1F1F',
  },
  deleteButtonText: {
    fontSize: 24,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#B0B0B0',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  generateButton: {
    backgroundColor: '#4A9EFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

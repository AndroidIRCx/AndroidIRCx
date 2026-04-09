/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { useT } from '../i18n/transifex';
import { encryptedDMService, StoredKey } from '../services/EncryptedDMService';
import { biometricAuthService } from '../services/BiometricAuthService';
import { connectionManager } from '../services/ConnectionManager';

interface KeyManagementScreenProps {
  visible: boolean;
  onClose: () => void;
}

export const KeyManagementScreen: React.FC<KeyManagementScreenProps> = ({
  visible,
  onClose,
}) => {
  const t = useT();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  // State
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [keys, setKeys] = useState<StoredKey[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKey, setSelectedKey] = useState<StoredKey | null>(null);
  const [showKeyDetails, setShowKeyDetails] = useState(false);
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [availableNetworks, setAvailableNetworks] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [groupByNetwork, setGroupByNetwork] = useState(true);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [exportPassword, setExportPassword] = useState('');
  const [importPassword, setImportPassword] = useState('');
  const [importData, setImportData] = useState('');

  const loadKeys = useCallback(async () => {
    try {
      console.log('[KeyManagement] Loading keys from service...');
      const allKeys = await encryptedDMService.listAllKeys();
      console.log('[KeyManagement] Loaded keys:', allKeys.length, 'keys');
      setKeys(allKeys);

      console.log('[KeyManagement] Loading available networks...');
      const connections = connectionManager.getAllConnections();
      const networks = connections.map(conn => conn.networkId);
      console.log('[KeyManagement] Available networks:', networks);
      setAvailableNetworks(networks);
    } catch (error) {
      console.error('[KeyManagement] Failed to load keys:', error);
      const message =
        error instanceof Error ? error.message : t('Unknown error');
      Alert.alert(
        t('Error'),
        t('Failed to load encryption keys: {error}', { error: message }),
      );
    }
  }, [t]);

  const handleAuthentication = useCallback(async () => {
    setLoading(true);
    try {
      console.log('[KeyManagement] Starting authentication...');

      // Check if biometric/PIN lock is available
      const isAvailable = biometricAuthService.isAvailable();
      console.log('[KeyManagement] Biometric available:', isAvailable);

      if (!isAvailable) {
        console.log(
          '[KeyManagement] No biometric/PIN available, allowing access without auth',
        );
        // No authentication available, allow access
        setAuthenticated(true);
        await loadKeys();
        console.log('[KeyManagement] Keys loaded successfully (no auth)');
        setLoading(false);
        return;
      }

      // First, ensure we have credentials stored for authentication
      // This is required by react-native-keychain's getGenericPassword API
      console.log(
        '[KeyManagement] Enabling temporary lock for authentication...',
      );
      const lockEnabled =
        await biometricAuthService.enableLock('keymanagement');
      if (!lockEnabled) {
        console.warn(
          '[KeyManagement] Failed to enable lock, but continuing anyway...',
        );
      }

      const result = await biometricAuthService.authenticate(
        t('Access Encryption Keys'),
        t('Authenticate to view and manage your encryption keys'),
        'keymanagement', // Use dedicated scope for key management
      );

      console.log('[KeyManagement] Auth result:', result);

      if (result.success) {
        console.log('[KeyManagement] Auth succeeded, loading keys...');
        setAuthenticated(true);
        await loadKeys();
        console.log('[KeyManagement] Keys loaded successfully');
        setLoading(false);
      } else {
        console.log(
          '[KeyManagement] Auth failed:',
          result.errorMessage || result.errorKey,
        );
        setLoading(false);
        const errorMessage =
          result.errorMessage ||
          (result.errorKey
            ? t(result.errorKey)
            : t('You must authenticate to access encryption keys.'));
        Alert.alert(t('Authentication Failed'), errorMessage, [
          { text: t('OK'), onPress: onClose },
        ]);
      }
    } catch (error) {
      console.error('[KeyManagement] Auth error:', error);
      setLoading(false);
      Alert.alert(
        t('Authentication Error'),
        error instanceof Error
          ? error.message
          : t('Failed to authenticate. Please try again.'),
        [{ text: t('OK'), onPress: onClose }],
      );
    }
  }, [loadKeys, onClose, t]);

  // Biometric Authentication
  useEffect(() => {
    if (visible && !authenticated) {
      handleAuthentication();
    }
  }, [visible, authenticated, handleAuthentication]);

  // Reset authentication state when modal closes
  useEffect(() => {
    if (!visible) {
      setAuthenticated(false);
      setLoading(true);
    }
  }, [visible]);

  // Cleanup temporary auth credentials when screen closes
  useEffect(() => {
    return () => {
      biometricAuthService.disableLock('keymanagement').catch(() => {
        console.warn('[KeyManagement] Failed to cleanup auth lock');
      });
    };
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadKeys();
    setRefreshing(false);
  };

  // Filter keys based on search query
  const filteredKeys = keys.filter(
    key =>
      key.nick.toLowerCase().includes(searchQuery.toLowerCase()) ||
      key.network.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Group keys by network if enabled
  const groupedKeys = groupByNetwork
    ? filteredKeys.reduce(
        (acc, key) => {
          if (!acc[key.network]) {
            acc[key.network] = [];
          }
          acc[key.network].push(key);
          return acc;
        },
        {} as Record<string, StoredKey[]>,
      )
    : null;

  // Handle key actions
  const handleKeyPress = (key: StoredKey) => {
    setSelectedKey(key);
    setShowKeyDetails(true);
  };

  const handleDeleteKey = async (key: StoredKey) => {
    Alert.alert(
      t('Delete Encryption Key'),
      t(
        'Are you sure you want to delete the encryption key for {nick} on {network}?\n\nFingerprint: {fingerprint}\n\nThis cannot be undone.',
        {
          nick: key.nick,
          network: key.network,
          fingerprint: encryptedDMService.formatFingerprintForDisplay(
            key.fingerprint,
          ),
        },
      ),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await encryptedDMService.deleteBundleForNetwork(
                key.network,
                key.nick,
              );
              await loadKeys();
              setShowKeyDetails(false);
              Alert.alert(t('Success'), t('Key deleted successfully'));
            } catch {
              Alert.alert(t('Error'), t('Failed to delete key'));
            }
          },
        },
      ],
    );
  };

  const handleCopyKey = async (toNetwork: string) => {
    if (!selectedKey) return;

    try {
      await encryptedDMService.copyBundleToNetwork(
        selectedKey.network,
        toNetwork,
        selectedKey.nick,
      );
      await loadKeys();
      setShowCopyDialog(false);
      setShowKeyDetails(false);
      Alert.alert(
        t('Success'),
        t('Key copied to {network}', { network: toNetwork }),
      );
    } catch {
      Alert.alert(t('Error'), t('Failed to copy key'));
    }
  };

  const handleMoveKey = async (toNetwork: string) => {
    if (!selectedKey) return;

    Alert.alert(
      t('Move Key'),
      t(
        'This will move the key from {fromNetwork} to {toNetwork} and delete it from {fromNetwork}.\n\nContinue?',
        {
          fromNetwork: selectedKey.network,
          toNetwork,
        },
      ),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Move'),
          onPress: async () => {
            try {
              await encryptedDMService.moveBundleToNetwork(
                selectedKey.network,
                toNetwork,
                selectedKey.nick,
              );
              await loadKeys();
              setShowMoveDialog(false);
              setShowKeyDetails(false);
              Alert.alert(
                t('Success'),
                t('Key moved to {network}', { network: toNetwork }),
              );
            } catch {
              Alert.alert(t('Error'), t('Failed to move key'));
            }
          },
        },
      ],
    );
  };

  const handleToggleVerified = async () => {
    if (!selectedKey) return;

    try {
      const newVerified = !selectedKey.verified;
      await encryptedDMService.setVerifiedForNetwork(
        selectedKey.network,
        selectedKey.nick,
        newVerified,
      );
      await loadKeys();
      setSelectedKey({ ...selectedKey, verified: newVerified });
    } catch {
      Alert.alert(t('Error'), t('Failed to update verification status'));
    }
  };

  const handleExportKeys = async () => {
    if (!exportPassword || exportPassword.length < 6) {
      Alert.alert(t('Error'), t('Password must be at least 6 characters'));
      return;
    }

    try {
      setLoading(true);
      const backup = await encryptedDMService.exportKeyBackup(exportPassword);

      // Copy to clipboard
      const { Clipboard } = await import('react-native');
      await Clipboard.setString(backup);

      setShowExportDialog(false);
      setExportPassword('');
      Alert.alert(
        t('Success'),
        t(
          'Exported {count} key(s). The encrypted backup has been copied to your clipboard. Save it to a secure location.',
          { count: keys.length },
        ),
        [{ text: t('OK') }],
      );
    } catch (error) {
      Alert.alert(t('Error'), t('Failed to export keys: {error}', { error }));
    } finally {
      setLoading(false);
    }
  };

  const handleImportKeys = async () => {
    if (!importPassword || !importData) {
      Alert.alert(
        t('Error'),
        t('Please provide both backup data and password'),
      );
      return;
    }

    try {
      setLoading(true);
      const count = await encryptedDMService.importKeyBackup(
        importData.trim(),
        importPassword,
      );
      await loadKeys();

      setShowImportDialog(false);
      setImportPassword('');
      setImportData('');
      Alert.alert(
        t('Success'),
        t('Imported {count} key(s) successfully.', { count }),
        [{ text: t('OK') }],
      );
    } catch (error) {
      Alert.alert(t('Error'), t('Failed to import keys: {error}', { error }));
    } finally {
      setLoading(false);
    }
  };

  // Render key item
  const renderKeyItem = ({ item }: { item: StoredKey }) => (
    <TouchableOpacity
      style={styles.keyItem}
      onPress={() => handleKeyPress(item)}
    >
      <View style={styles.keyItemHeader}>
        <Text style={styles.keyNetwork}>{item.network}</Text>
        <Text style={styles.keyVerified}>{item.verified ? '✅' : '⚠️'}</Text>
      </View>
      <Text style={styles.keyNick}>{item.nick}</Text>
      <Text style={styles.keyFingerprint} numberOfLines={1}>
        {encryptedDMService.formatFingerprintForDisplay(item.fingerprint)}
      </Text>
      <Text style={styles.keyDate}>
        {t('Last seen: {date}', {
          date: new Date(item.lastSeen).toLocaleDateString(),
        })}
      </Text>
    </TouchableOpacity>
  );

  // Render grouped keys
  const renderGroupedKeys = () => {
    if (!groupedKeys) return null;

    return (
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {Object.entries(groupedKeys).map(([network, networkKeys]) => (
          <View key={network} style={styles.networkGroup}>
            <Text style={styles.networkGroupTitle}>{network}</Text>
            {networkKeys.map(key => (
              <View key={`${key.network}:${key.nick}`}>
                {renderKeyItem({ item: key })}
              </View>
            ))}
          </View>
        ))}
        {Object.keys(groupedKeys).length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              {t('No encryption keys found')}
            </Text>
            <Text style={styles.emptyStateSubtext}>
              {t('Exchange keys with users to enable encrypted messaging')}
            </Text>
          </View>
        )}
      </ScrollView>
    );
  };

  // Render authentication/loading screen
  if (!authenticated || loading) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>
              {loading ? t('Authenticating...') : t('Loading keys...')}
            </Text>
          </View>
        </View>
      </Modal>
    );
  }

  // Main render
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('Encryption Keys')}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>{t('Close')}</Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder={t('Search by nick or network...')}
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <TouchableOpacity
            onPress={() => setGroupByNetwork(!groupByNetwork)}
            style={styles.groupButton}
          >
            <Text style={styles.groupButtonText}>
              {groupByNetwork ? t('List View') : t('Group View')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.stats}>
          <Text style={styles.statsText}>
            {t('{count} key{suffix} · {verified} verified', {
              count: keys.length,
              suffix: keys.length !== 1 ? 's' : '',
              verified: keys.filter(k => k.verified).length,
            })}
          </Text>
        </View>

        {/* Action Toolbar */}
        <View style={styles.toolbar}>
          <TouchableOpacity
            onPress={() => setShowExportDialog(true)}
            style={styles.toolbarButton}
            disabled={keys.length === 0}
          >
            <Text
              style={[
                styles.toolbarButtonText,
                keys.length === 0 && styles.toolbarButtonDisabled,
              ]}
            >
              {t('Export All Keys')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowImportDialog(true)}
            style={styles.toolbarButton}
          >
            <Text style={styles.toolbarButtonText}>{t('Import Keys')}</Text>
          </TouchableOpacity>
        </View>

        {/* Key List */}
        {groupByNetwork ? (
          renderGroupedKeys()
        ) : (
          <FlatList
            data={filteredKeys}
            renderItem={renderKeyItem}
            keyExtractor={item => `${item.network}:${item.nick}`}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>
                  {t('No encryption keys found')}
                </Text>
                <Text style={styles.emptyStateSubtext}>
                  {t('Exchange keys with users to enable encrypted messaging')}
                </Text>
              </View>
            }
          />
        )}

        {/* Key Details Modal */}
        {selectedKey && (
          <Modal
            visible={showKeyDetails}
            transparent
            animationType="fade"
            onRequestClose={() => setShowKeyDetails(false)}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setShowKeyDetails(false)}
            >
              <View style={styles.detailsModal}>
                <Text style={styles.detailsTitle}>{t('Key Details')}</Text>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('Network:')}</Text>
                  <Text style={styles.detailValue}>{selectedKey.network}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('Nickname:')}</Text>
                  <Text style={styles.detailValue}>{selectedKey.nick}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('Fingerprint:')}</Text>
                  <Text style={styles.detailValueMono}>
                    {encryptedDMService.formatFingerprintForDisplay(
                      selectedKey.fingerprint,
                    )}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('Status:')}</Text>
                  <Text style={styles.detailValue}>
                    {selectedKey.verified ? 'Verified ✅' : 'Unverified ⚠️'}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('First Seen:')}</Text>
                  <Text style={styles.detailValue}>
                    {new Date(selectedKey.firstSeen).toLocaleString()}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('Last Seen:')}</Text>
                  <Text style={styles.detailValue}>
                    {new Date(selectedKey.lastSeen).toLocaleString()}
                  </Text>
                </View>

                <View style={styles.detailsDivider} />

                <TouchableOpacity
                  style={styles.detailButton}
                  onPress={handleToggleVerified}
                >
                  <Text style={styles.detailButtonText}>
                    {selectedKey.verified
                      ? t('Mark as Unverified')
                      : t('Mark as Verified')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.detailButton}
                  onPress={() => setShowCopyDialog(true)}
                >
                  <Text style={styles.detailButtonText}>
                    {t('Copy to Network...')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.detailButton}
                  onPress={() => setShowMoveDialog(true)}
                >
                  <Text style={styles.detailButtonText}>
                    {t('Move to Network...')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.detailButton, styles.deleteButton]}
                  onPress={() => handleDeleteKey(selectedKey)}
                >
                  <Text
                    style={[styles.detailButtonText, styles.deleteButtonText]}
                  >
                    {t('Delete Key')}
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>
        )}

        {/* Copy Dialog */}
        {selectedKey && (
          <Modal
            visible={showCopyDialog}
            transparent
            animationType="fade"
            onRequestClose={() => setShowCopyDialog(false)}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setShowCopyDialog(false)}
            >
              <View style={styles.dialogModal}>
                <Text style={styles.dialogTitle}>
                  {t('Copy Key to Network')}
                </Text>
                <Text style={styles.dialogSubtitle}>
                  {t('Copy key for {nick} to another network', {
                    nick: selectedKey.nick,
                  })}
                </Text>

                <ScrollView style={styles.networkList}>
                  {availableNetworks
                    .filter(net => net !== selectedKey.network)
                    .map(network => (
                      <TouchableOpacity
                        key={network}
                        style={styles.networkOption}
                        onPress={() => handleCopyKey(network)}
                      >
                        <Text style={styles.networkOptionText}>{network}</Text>
                      </TouchableOpacity>
                    ))}
                  {availableNetworks.filter(net => net !== selectedKey.network)
                    .length === 0 && (
                    <Text style={styles.noNetworksText}>
                      {t('No other networks available')}
                    </Text>
                  )}
                </ScrollView>

                <TouchableOpacity
                  style={styles.dialogCancelButton}
                  onPress={() => setShowCopyDialog(false)}
                >
                  <Text style={styles.dialogCancelText}>{t('Cancel')}</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>
        )}

        {/* Move Dialog */}
        {selectedKey && (
          <Modal
            visible={showMoveDialog}
            transparent
            animationType="fade"
            onRequestClose={() => setShowMoveDialog(false)}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setShowMoveDialog(false)}
            >
              <View style={styles.dialogModal}>
                <Text style={styles.dialogTitle}>
                  {t('Move Key to Network')}
                </Text>
                <Text style={styles.dialogSubtitle}>
                  {t(
                    'Move key for {nick} to another network (will delete from {network})',
                    { nick: selectedKey.nick, network: selectedKey.network },
                  )}
                </Text>

                <ScrollView style={styles.networkList}>
                  {availableNetworks
                    .filter(net => net !== selectedKey.network)
                    .map(network => (
                      <TouchableOpacity
                        key={network}
                        style={styles.networkOption}
                        onPress={() => handleMoveKey(network)}
                      >
                        <Text style={styles.networkOptionText}>{network}</Text>
                      </TouchableOpacity>
                    ))}
                  {availableNetworks.filter(net => net !== selectedKey.network)
                    .length === 0 && (
                    <Text style={styles.noNetworksText}>
                      {t('No other networks available')}
                    </Text>
                  )}
                </ScrollView>

                <TouchableOpacity
                  style={styles.dialogCancelButton}
                  onPress={() => setShowMoveDialog(false)}
                >
                  <Text style={styles.dialogCancelText}>{t('Cancel')}</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>
        )}

        {/* Export Dialog */}
        <Modal
          visible={showExportDialog}
          transparent
          animationType="fade"
          onRequestClose={() => setShowExportDialog(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowExportDialog(false)}
          >
            <View style={styles.dialogModal}>
              <Text style={styles.dialogTitle}>{t('Export All Keys')}</Text>
              <Text style={styles.dialogSubtitle}>
                {t(
                  'Create an encrypted backup of all {count} encryption key{suffix}.\nEnter a strong password to protect the backup.',
                  {
                    count: keys.length,
                    suffix: keys.length !== 1 ? 's' : '',
                  },
                )}
              </Text>

              <TextInput
                style={styles.passwordInput}
                placeholder={t('Backup password (min 6 characters)')}
                placeholderTextColor={colors.textSecondary}
                value={exportPassword}
                onChangeText={setExportPassword}
                secureTextEntry
                autoCapitalize="none"
              />

              <View style={styles.dialogButtons}>
                <TouchableOpacity
                  style={styles.dialogCancelButton}
                  onPress={() => {
                    setShowExportDialog(false);
                    setExportPassword('');
                  }}
                >
                  <Text style={styles.dialogCancelText}>{t('Cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.dialogConfirmButton,
                    (!exportPassword || exportPassword.length < 6) &&
                      styles.dialogButtonDisabled,
                  ]}
                  onPress={handleExportKeys}
                  disabled={!exportPassword || exportPassword.length < 6}
                >
                  <Text style={styles.dialogConfirmText}>{t('Export')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Import Dialog */}
        <Modal
          visible={showImportDialog}
          transparent
          animationType="fade"
          onRequestClose={() => setShowImportDialog(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowImportDialog(false)}
          >
            <View style={styles.dialogModal}>
              <Text style={styles.dialogTitle}>{t('Import Keys')}</Text>
              <Text style={styles.dialogSubtitle}>
                {t(
                  'Paste the encrypted backup data and enter the password used during export.',
                )}
              </Text>

              <TextInput
                style={styles.multilineInput}
                placeholder={t('Paste backup data here...')}
                placeholderTextColor={colors.textSecondary}
                value={importData}
                onChangeText={setImportData}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              <TextInput
                style={styles.passwordInput}
                placeholder={t('Backup password')}
                placeholderTextColor={colors.textSecondary}
                value={importPassword}
                onChangeText={setImportPassword}
                secureTextEntry
                autoCapitalize="none"
              />

              <View style={styles.dialogButtons}>
                <TouchableOpacity
                  style={styles.dialogCancelButton}
                  onPress={() => {
                    setShowImportDialog(false);
                    setImportPassword('');
                    setImportData('');
                  }}
                >
                  <Text style={styles.dialogCancelText}>{t('Cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.dialogConfirmButton,
                    (!importPassword || !importData) &&
                      styles.dialogButtonDisabled,
                  ]}
                  onPress={handleImportKeys}
                  disabled={!importPassword || !importData}
                >
                  <Text style={styles.dialogConfirmText}>{t('Import')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    </Modal>
  );
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 16,
      fontSize: 16,
      color: colors.text,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      backgroundColor: colors.primary,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.onPrimary,
    },
    closeButton: {
      padding: 8,
    },
    closeButtonText: {
      fontSize: 16,
      color: colors.onPrimary,
      fontWeight: '600',
    },
    searchContainer: {
      flexDirection: 'row',
      padding: 12,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 8,
      padding: 12,
      fontSize: 14,
      color: colors.text,
    },
    groupButton: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      padding: 12,
      justifyContent: 'center',
    },
    groupButtonText: {
      color: colors.onPrimary,
      fontSize: 12,
      fontWeight: '600',
    },
    stats: {
      padding: 12,
      paddingTop: 0,
    },
    statsText: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    keyItem: {
      backgroundColor: colors.surface,
      padding: 16,
      marginHorizontal: 12,
      marginBottom: 8,
      borderRadius: 8,
    },
    keyItemHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    keyNetwork: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
    },
    keyVerified: {
      fontSize: 16,
    },
    keyNick: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    keyFingerprint: {
      fontSize: 11,
      fontFamily: 'monospace',
      color: colors.textSecondary,
      marginBottom: 4,
    },
    keyDate: {
      fontSize: 11,
      color: colors.textSecondary,
    },
    networkGroup: {
      marginBottom: 16,
    },
    networkGroupTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.text,
      padding: 12,
      paddingBottom: 8,
      backgroundColor: colors.background,
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
    },
    emptyStateText: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    emptyStateSubtext: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    detailsModal: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 20,
      width: '90%',
      maxWidth: 400,
      maxHeight: '80%',
    },
    detailsTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 16,
    },
    detailRow: {
      marginBottom: 12,
    },
    detailLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    detailValue: {
      fontSize: 14,
      color: colors.text,
    },
    detailValueMono: {
      fontSize: 11,
      fontFamily: 'monospace',
      color: colors.text,
    },
    detailsDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 16,
    },
    detailButton: {
      padding: 14,
      backgroundColor: colors.primary,
      borderRadius: 8,
      marginBottom: 8,
    },
    detailButtonText: {
      fontSize: 14,
      color: colors.onPrimary,
      textAlign: 'center',
      fontWeight: '600',
    },
    deleteButton: {
      backgroundColor: '#F44336',
    },
    deleteButtonText: {
      color: '#FFFFFF',
    },
    dialogModal: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 20,
      width: '90%',
      maxWidth: 400,
      maxHeight: '60%',
    },
    dialogTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 8,
    },
    dialogSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 16,
    },
    networkList: {
      maxHeight: 300,
    },
    networkOption: {
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    networkOptionText: {
      fontSize: 16,
      color: colors.text,
    },
    noNetworksText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      padding: 16,
    },
    dialogCancelButton: {
      padding: 14,
      marginTop: 12,
    },
    dialogCancelText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      fontWeight: '600',
    },
    toolbar: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    toolbarButton: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      backgroundColor: colors.primary,
      borderRadius: 8,
      minWidth: 140,
    },
    toolbarButtonText: {
      fontSize: 14,
      color: '#FFFFFF',
      textAlign: 'center',
      fontWeight: '600',
    },
    toolbarButtonDisabled: {
      opacity: 0.5,
    },
    passwordInput: {
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 14,
      color: colors.text,
      marginBottom: 12,
    },
    multilineInput: {
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 14,
      color: colors.text,
      marginBottom: 12,
      minHeight: 100,
    },
    dialogButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 12,
    },
    dialogConfirmButton: {
      flex: 1,
      padding: 14,
      backgroundColor: colors.primary,
      borderRadius: 8,
      marginLeft: 8,
    },
    dialogConfirmText: {
      fontSize: 14,
      color: '#FFFFFF',
      textAlign: 'center',
      fontWeight: '600',
    },
    dialogButtonDisabled: {
      opacity: 0.5,
    },
  });

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

  // Biometric Authentication
  useEffect(() => {
    if (visible && !authenticated) {
      handleAuthentication();
    }
  }, [visible]);

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
      // Clean up the temporary keymanagement credentials when component unmounts
      biometricAuthService.disableLock('keymanagement').catch(err => {
        console.warn('[KeyManagement] Failed to cleanup auth lock:', err);
      });
    };
  }, []);

  const handleAuthentication = async () => {
    setLoading(true);
    try {
      console.log('[KeyManagement] Starting authentication...');

      // Check if biometric/PIN lock is available
      const isAvailable = biometricAuthService.isAvailable();
      console.log('[KeyManagement] Biometric available:', isAvailable);

      if (!isAvailable) {
        console.log('[KeyManagement] No biometric/PIN available, allowing access without auth');
        // No authentication available, allow access
        setAuthenticated(true);
        await loadKeys();
        console.log('[KeyManagement] Keys loaded successfully (no auth)');
        setLoading(false);
        return;
      }

      // First, ensure we have credentials stored for authentication
      // This is required by react-native-keychain's getGenericPassword API
      console.log('[KeyManagement] Enabling temporary lock for authentication...');
      const lockEnabled = await biometricAuthService.enableLock('keymanagement');
      if (!lockEnabled) {
        console.warn('[KeyManagement] Failed to enable lock, but continuing anyway...');
      }

      const result = await biometricAuthService.authenticate(
        'Access Encryption Keys',
        'Authenticate to view and manage your encryption keys',
        'keymanagement' // Use dedicated scope for key management
      );

      console.log('[KeyManagement] Auth result:', result);

      if (result.success) {
        console.log('[KeyManagement] Auth succeeded, loading keys...');
        setAuthenticated(true);
        await loadKeys();
        console.log('[KeyManagement] Keys loaded successfully');
        setLoading(false);
      } else {
        console.log('[KeyManagement] Auth failed:', result.error);
        setLoading(false);
        Alert.alert(
          'Authentication Failed',
          result.error || 'You must authenticate to access encryption keys.',
          [{ text: 'OK', onPress: onClose }]
        );
      }
    } catch (error) {
      console.error('[KeyManagement] Auth error:', error);
      setLoading(false);
      Alert.alert(
        'Authentication Error',
        error instanceof Error ? error.message : 'Failed to authenticate. Please try again.',
        [{ text: 'OK', onPress: onClose }]
      );
    }
  };

  // Load encryption keys
  const loadKeys = async () => {
    try {
      console.log('[KeyManagement] Loading keys from service...');
      const allKeys = await encryptedDMService.listAllKeys();
      console.log('[KeyManagement] Loaded keys:', allKeys.length, 'keys');
      setKeys(allKeys);

      // Get available networks from connection manager
      console.log('[KeyManagement] Loading available networks...');
      const connections = connectionManager.getAllConnections();
      const networks = connections.map(conn => conn.networkId);
      console.log('[KeyManagement] Available networks:', networks);
      setAvailableNetworks(networks);
    } catch (error) {
      console.error('[KeyManagement] Failed to load keys:', error);
      Alert.alert('Error', 'Failed to load encryption keys: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadKeys();
    setRefreshing(false);
  };

  // Filter keys based on search query
  const filteredKeys = keys.filter(
    key =>
      key.nick.toLowerCase().includes(searchQuery.toLowerCase()) ||
      key.network.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group keys by network if enabled
  const groupedKeys = groupByNetwork
    ? filteredKeys.reduce((acc, key) => {
        if (!acc[key.network]) {
          acc[key.network] = [];
        }
        acc[key.network].push(key);
        return acc;
      }, {} as Record<string, StoredKey[]>)
    : null;

  // Handle key actions
  const handleKeyPress = (key: StoredKey) => {
    setSelectedKey(key);
    setShowKeyDetails(true);
  };

  const handleDeleteKey = async (key: StoredKey) => {
    Alert.alert(
      'Delete Encryption Key',
      `Are you sure you want to delete the encryption key for ${key.nick} on ${key.network}?\n\nFingerprint: ${encryptedDMService.formatFingerprintForDisplay(key.fingerprint)}\n\nThis cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await encryptedDMService.deleteBundleForNetwork(key.network, key.nick);
              await loadKeys();
              setShowKeyDetails(false);
              Alert.alert('Success', 'Key deleted successfully');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete key');
            }
          },
        },
      ]
    );
  };

  const handleCopyKey = async (toNetwork: string) => {
    if (!selectedKey) return;

    try {
      await encryptedDMService.copyBundleToNetwork(
        selectedKey.network,
        toNetwork,
        selectedKey.nick
      );
      await loadKeys();
      setShowCopyDialog(false);
      setShowKeyDetails(false);
      Alert.alert('Success', `Key copied to ${toNetwork}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to copy key');
    }
  };

  const handleMoveKey = async (toNetwork: string) => {
    if (!selectedKey) return;

    Alert.alert(
      'Move Key',
      `This will move the key from ${selectedKey.network} to ${toNetwork} and delete it from ${selectedKey.network}.\n\nContinue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Move',
          onPress: async () => {
            try {
              await encryptedDMService.moveBundleToNetwork(
                selectedKey.network,
                toNetwork,
                selectedKey.nick
              );
              await loadKeys();
              setShowMoveDialog(false);
              setShowKeyDetails(false);
              Alert.alert('Success', `Key moved to ${toNetwork}`);
            } catch (error) {
              Alert.alert('Error', 'Failed to move key');
            }
          },
        },
      ]
    );
  };

  const handleToggleVerified = async () => {
    if (!selectedKey) return;

    try {
      const newVerified = !selectedKey.verified;
      await encryptedDMService.setVerifiedForNetwork(
        selectedKey.network,
        selectedKey.nick,
        newVerified
      );
      await loadKeys();
      setSelectedKey({ ...selectedKey, verified: newVerified });
    } catch (error) {
      Alert.alert('Error', 'Failed to update verification status');
    }
  };

  // Render key item
  const renderKeyItem = ({ item }: { item: StoredKey }) => (
    <TouchableOpacity style={styles.keyItem} onPress={() => handleKeyPress(item)}>
      <View style={styles.keyItemHeader}>
        <Text style={styles.keyNetwork}>{item.network}</Text>
        <Text style={styles.keyVerified}>{item.verified ? '✅' : '⚠️'}</Text>
      </View>
      <Text style={styles.keyNick}>{item.nick}</Text>
      <Text style={styles.keyFingerprint} numberOfLines={1}>
        {encryptedDMService.formatFingerprintForDisplay(item.fingerprint)}
      </Text>
      <Text style={styles.keyDate}>
        Last seen: {new Date(item.lastSeen).toLocaleDateString()}
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
        }>
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
            <Text style={styles.emptyStateText}>No encryption keys found</Text>
            <Text style={styles.emptyStateSubtext}>
              Exchange keys with users to enable encrypted messaging
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
              {loading ? 'Authenticating...' : 'Loading keys...'}
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
          <Text style={styles.headerTitle}>Encryption Keys</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by nick or network..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <TouchableOpacity
            onPress={() => setGroupByNetwork(!groupByNetwork)}
            style={styles.groupButton}>
            <Text style={styles.groupButtonText}>
              {groupByNetwork ? 'List View' : 'Group View'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.stats}>
          <Text style={styles.statsText}>
            {keys.length} key{keys.length !== 1 ? 's' : ''} • {' '}
            {keys.filter(k => k.verified).length} verified
          </Text>
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
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No encryption keys found</Text>
                <Text style={styles.emptyStateSubtext}>
                  Exchange keys with users to enable encrypted messaging
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
            onRequestClose={() => setShowKeyDetails(false)}>
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setShowKeyDetails(false)}>
              <View style={styles.detailsModal}>
                <Text style={styles.detailsTitle}>Key Details</Text>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Network:</Text>
                  <Text style={styles.detailValue}>{selectedKey.network}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Nickname:</Text>
                  <Text style={styles.detailValue}>{selectedKey.nick}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Fingerprint:</Text>
                  <Text style={styles.detailValueMono}>
                    {encryptedDMService.formatFingerprintForDisplay(selectedKey.fingerprint)}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status:</Text>
                  <Text style={styles.detailValue}>
                    {selectedKey.verified ? 'Verified ✅' : 'Unverified ⚠️'}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>First Seen:</Text>
                  <Text style={styles.detailValue}>
                    {new Date(selectedKey.firstSeen).toLocaleString()}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Last Seen:</Text>
                  <Text style={styles.detailValue}>
                    {new Date(selectedKey.lastSeen).toLocaleString()}
                  </Text>
                </View>

                <View style={styles.detailsDivider} />

                <TouchableOpacity
                  style={styles.detailButton}
                  onPress={handleToggleVerified}>
                  <Text style={styles.detailButtonText}>
                    {selectedKey.verified ? 'Mark as Unverified' : 'Mark as Verified'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.detailButton}
                  onPress={() => setShowCopyDialog(true)}>
                  <Text style={styles.detailButtonText}>Copy to Network...</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.detailButton}
                  onPress={() => setShowMoveDialog(true)}>
                  <Text style={styles.detailButtonText}>Move to Network...</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.detailButton, styles.deleteButton]}
                  onPress={() => handleDeleteKey(selectedKey)}>
                  <Text style={[styles.detailButtonText, styles.deleteButtonText]}>
                    Delete Key
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
            onRequestClose={() => setShowCopyDialog(false)}>
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setShowCopyDialog(false)}>
              <View style={styles.dialogModal}>
                <Text style={styles.dialogTitle}>Copy Key to Network</Text>
                <Text style={styles.dialogSubtitle}>
                  Copy key for {selectedKey.nick} to another network
                </Text>

                <ScrollView style={styles.networkList}>
                  {availableNetworks
                    .filter(net => net !== selectedKey.network)
                    .map(network => (
                      <TouchableOpacity
                        key={network}
                        style={styles.networkOption}
                        onPress={() => handleCopyKey(network)}>
                        <Text style={styles.networkOptionText}>{network}</Text>
                      </TouchableOpacity>
                    ))}
                  {availableNetworks.filter(net => net !== selectedKey.network).length === 0 && (
                    <Text style={styles.noNetworksText}>No other networks available</Text>
                  )}
                </ScrollView>

                <TouchableOpacity
                  style={styles.dialogCancelButton}
                  onPress={() => setShowCopyDialog(false)}>
                  <Text style={styles.dialogCancelText}>Cancel</Text>
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
            onRequestClose={() => setShowMoveDialog(false)}>
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setShowMoveDialog(false)}>
              <View style={styles.dialogModal}>
                <Text style={styles.dialogTitle}>Move Key to Network</Text>
                <Text style={styles.dialogSubtitle}>
                  Move key for {selectedKey.nick} to another network (will delete from {selectedKey.network})
                </Text>

                <ScrollView style={styles.networkList}>
                  {availableNetworks
                    .filter(net => net !== selectedKey.network)
                    .map(network => (
                      <TouchableOpacity
                        key={network}
                        style={styles.networkOption}
                        onPress={() => handleMoveKey(network)}>
                        <Text style={styles.networkOptionText}>{network}</Text>
                      </TouchableOpacity>
                    ))}
                  {availableNetworks.filter(net => net !== selectedKey.network).length === 0 && (
                    <Text style={styles.noNetworksText}>No other networks available</Text>
                  )}
                </ScrollView>

                <TouchableOpacity
                  style={styles.dialogCancelButton}
                  onPress={() => setShowMoveDialog(false)}>
                  <Text style={styles.dialogCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>
        )}
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
  });

/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { userManagementService, IgnoredUser } from '../services/UserManagementService';
import { connectionManager } from '../services/ConnectionManager';
import { useT } from '../i18n/transifex';
import { useTheme } from '../hooks/useTheme';

interface IgnoreListScreenProps {
  visible: boolean;
  network?: string;
  onClose: () => void;
}

export const IgnoreListScreen: React.FC<IgnoreListScreenProps> = ({
  visible,
  network,
  onClose,
}) => {
  const t = useT();
  const { colors } = useTheme();
  const [ignoredUsers, setIgnoredUsers] = useState<IgnoredUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<IgnoredUser[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMask, setNewMask] = useState('');
  const [newReason, setNewReason] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null);
  const [showNetworkPicker, setShowNetworkPicker] = useState(false);
  const [availableNetworks, setAvailableNetworks] = useState<string[]>([]);
  const styles = createStyles(colors);

  const loadAvailableNetworks = useCallback(() => {
    const networks = connectionManager
      .getAllConnections()
      .map(conn => conn.networkId)
      .filter((id): id is string => Boolean(id));
    setAvailableNetworks(networks);
  }, []);

  const filterUsers = useCallback(() => {
    let filtered = [...ignoredUsers];

    // Filter by network
    if (selectedNetwork) {
      filtered = filtered.filter(user => user.network === selectedNetwork);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        user =>
          user.mask.toLowerCase().includes(query) ||
          (user.reason && user.reason.toLowerCase().includes(query))
      );
    }

    setFilteredUsers(filtered);
  }, [ignoredUsers, searchQuery, selectedNetwork]);

  const getUserManagementService = useCallback(() => {
    // Use connection-specific service if available, otherwise fallback to singleton
    if (network) {
      const conn = connectionManager.getConnection(network);
      if (conn?.userManagementService) {
        return conn.userManagementService;
      }
    }
    return userManagementService;
  }, [network]);

  const loadIgnoredUsers = useCallback(() => {
    const svc = getUserManagementService();
    const ignored = svc.getIgnoredUsers(null); // Load all networks
    setIgnoredUsers(ignored);
  }, [getUserManagementService]);

  useEffect(() => {
    if (visible) {
      loadIgnoredUsers();
      loadAvailableNetworks();
    }
  }, [visible, network, loadIgnoredUsers, loadAvailableNetworks]);

  useEffect(() => {
    filterUsers();
  }, [filterUsers]);

  const handleAddIgnore = async () => {
    if (newMask.trim()) {
      const svc = getUserManagementService();
      await svc.ignoreUser(
        newMask.trim(),
        newReason.trim() || undefined,
        network
      );
      setNewMask('');
      setNewReason('');
      setShowAddModal(false);
      loadIgnoredUsers();
      Alert.alert(t('Success'), t('User added to ignore list'));
    }
  };

  const handleRemoveIgnore = async (mask: string, entryNetwork?: string) => {
    Alert.alert(
      t('Remove from Ignore List'),
      t('Remove {mask}?').replace('{mask}', mask),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Remove'),
          style: 'destructive',
          onPress: async () => {
            const svc = getUserManagementService();
            await svc.unignoreUser(mask, entryNetwork);
            loadIgnoredUsers();
            Alert.alert(t('Success'), t('User removed from ignore list'));
          },
        },
      ]
    );
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('Ignore List')}</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowAddModal(true)}>
              <Text style={styles.addButtonText}>{t('+ Add')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>{t('Close')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search and Filter Section */}
        <View style={styles.filterSection}>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('Search by mask or reason...')}
            placeholderTextColor={colors.inputPlaceholder}
          />
          <TouchableOpacity
            style={styles.networkFilterButton}
            onPress={() => setShowNetworkPicker(true)}>
            <Text style={styles.networkFilterButtonText}>
              {selectedNetwork ? selectedNetwork : t('All Networks')}
            </Text>
            <Text style={styles.networkFilterButtonArrow}>▼</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {filteredUsers.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {searchQuery || selectedNetwork
                  ? t('No matching ignored users')
                  : t('No ignored users')}
              </Text>
              <Text style={styles.emptySubtext}>
                {searchQuery || selectedNetwork
                  ? t('Try different filters')
                  : t('Add users to ignore their messages')}
              </Text>
            </View>
          ) : (
            filteredUsers.map((ignored, index) => (
              <View key={index} style={styles.ignoreItem}>
                <View style={styles.ignoreContent}>
                  <Text style={styles.ignoreMask}>{ignored.mask}</Text>
                  {ignored.network && (
                    <Text style={styles.ignoreNetwork}>
                      {t('Network: {network}').replace('{network}', ignored.network)}
                    </Text>
                  )}
                  {ignored.reason && (
                    <Text style={styles.ignoreReason}>{ignored.reason}</Text>
                  )}
                  <Text style={styles.ignoreDate}>
                    {t('Added {date}').replace('{date}', new Date(ignored.addedAt).toLocaleDateString())}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => handleRemoveIgnore(ignored.mask, ignored.network)}>
                  <Text style={styles.removeButtonText}>{t('Remove')}</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>

        {/* Add Ignore Modal */}
        <Modal
          visible={showAddModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowAddModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{t('Add to Ignore List')}</Text>
              <Text style={styles.modalDescription}>
                {t('Enter a mask to ignore. Examples:')}
                {'\n'}• {t('nick (ignore specific nick)')}
                {'\n'}• {t('*!*@host.com (ignore all from host)')}
                {'\n'}• {t('nick!*@* (ignore specific user)')}
              </Text>
              <TextInput
                style={styles.input}
                value={newMask}
                onChangeText={setNewMask}
                placeholder={t('nick or mask (e.g., *!*@host.com)')}
                placeholderTextColor={colors.inputPlaceholder}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={newReason}
                onChangeText={setNewReason}
                placeholder={t('Reason (optional)')}
                placeholderTextColor={colors.inputPlaceholder}
                multiline
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => {
                    setShowAddModal(false);
                    setNewMask('');
                    setNewReason('');
                  }}>
                  <Text style={styles.modalButtonText}>{t('Cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonPrimary]}
                  onPress={handleAddIgnore}>
                  <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>
                    {t('Add')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Network Picker Modal */}
        <Modal
          visible={showNetworkPicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowNetworkPicker(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{t('Filter by Network')}</Text>
              <ScrollView style={styles.networkPickerScroll}>
                <TouchableOpacity
                  style={styles.networkPickerItem}
                  onPress={() => {
                    setSelectedNetwork(null);
                    setShowNetworkPicker(false);
                  }}>
                  <Text
                    style={[
                      styles.networkPickerItemText,
                      !selectedNetwork && styles.networkPickerItemTextSelected,
                    ]}>
                    {t('All Networks')}
                  </Text>
                </TouchableOpacity>
                {availableNetworks.map((net, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.networkPickerItem}
                    onPress={() => {
                      setSelectedNetwork(net);
                      setShowNetworkPicker(false);
                    }}>
                    <Text
                      style={[
                        styles.networkPickerItemText,
                        selectedNetwork === net && styles.networkPickerItemTextSelected,
                      ]}>
                      {net}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity
                style={[styles.modalSingleButton, styles.modalButtonPrimary]}
                onPress={() => setShowNetworkPicker(false)}>
                <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>
                  {t('Close')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
};

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  addButton: {
    backgroundColor: colors.accent,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  addButtonText: {
    color: colors.onAccent,
    fontSize: 14,
    fontWeight: '500',
  },
  closeButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  closeButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '500',
  },
  filterSection: {
    padding: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  searchInput: {
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 4,
    padding: 10,
    fontSize: 14,
    color: colors.inputText,
  },
  networkFilterButton: {
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 4,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  networkFilterButtonText: {
    fontSize: 14,
    color: colors.text,
  },
  networkFilterButtonArrow: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  content: {
    flex: 1,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textDisabled,
    textAlign: 'center',
  },
  ignoreItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    backgroundColor: colors.background,
  },
  ignoreContent: {
    flex: 1,
    marginRight: 12,
  },
  ignoreMask: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  ignoreNetwork: {
    fontSize: 12,
    color: colors.primary,
    marginBottom: 4,
    fontWeight: '500',
  },
  ignoreReason: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  ignoreDate: {
    fontSize: 12,
    color: colors.textDisabled,
  },
  removeButton: {
    backgroundColor: colors.error,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  removeButtonText: {
    color: colors.onPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.modalOverlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.modalBackground,
    borderRadius: 8,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.modalText,
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 16,
    lineHeight: 18,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 4,
    padding: 12,
    fontSize: 14,
    color: colors.inputText,
    backgroundColor: colors.inputBackground,
    marginBottom: 12,
  },
  inputMultiline: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 4,
    alignItems: 'center',
  },
  modalSingleButton: {
    padding: 12,
    borderRadius: 4,
    alignItems: 'center',
    alignSelf: 'stretch',
    marginTop: 8,
  },
  modalButtonCancel: {
    backgroundColor: colors.buttonSecondary,
  },
  modalButtonPrimary: {
    backgroundColor: colors.buttonPrimary,
  },
  modalButtonText: {
    color: colors.buttonSecondaryText,
    fontSize: 14,
    fontWeight: '500',
  },
  modalButtonTextPrimary: {
    color: colors.buttonPrimaryText,
  },
  networkPickerScroll: {
    maxHeight: 300,
    marginVertical: 12,
  },
  networkPickerItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  networkPickerItemText: {
    fontSize: 16,
    color: colors.text,
  },
  networkPickerItemTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
});





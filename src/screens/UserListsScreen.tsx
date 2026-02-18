/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Switch,
} from 'react-native';
import {
  userManagementService,
  UserListEntry,
  UserListType,
  IgnoredUser,
} from '../services/UserManagementService';
import { connectionManager } from '../services/ConnectionManager';
import { useT } from '../i18n/transifex';
import { useUIStore } from '../stores/uiStore';

type ListTab = 'notify' | 'ignore' | 'autoop' | 'autovoice' | 'autohalfop' | 'other';

interface UserListsScreenProps {
  visible: boolean;
  network?: string;
  initialTab?: ListTab;
  onClose: () => void;
}

const TABS: Array<{ id: ListTab; label: string }> = [
  { id: 'notify', label: 'Notify' },
  { id: 'ignore', label: 'Ignore' },
  { id: 'autoop', label: 'Auto-OP' },
  { id: 'autovoice', label: 'Auto-Voice' },
  { id: 'autohalfop', label: 'Auto-HalfOp' },
  { id: 'other', label: 'Others' },
];

export const UserListsScreen: React.FC<UserListsScreenProps> = ({
  visible,
  network,
  initialTab = 'notify',
  onClose,
}) => {
  const t = useT();
  const [activeTab, setActiveTab] = useState<ListTab>(initialTab);
  const [entries, setEntries] = useState<UserListEntry[]>([]);
  const [ignoredUsers, setIgnoredUsers] = useState<IgnoredUser[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<(UserListEntry | IgnoredUser)[]>([]);
  
  // Form state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<UserListEntry | IgnoredUser | null>(null);
  const [newMask, setNewMask] = useState('');
  const [newChannels, setNewChannels] = useState('');
  const [newReason, setNewReason] = useState('');
  const [isProtected, setIsProtected] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null);
  const [showNetworkPicker, setShowNetworkPicker] = useState(false);
  const [availableNetworks, setAvailableNetworks] = useState<string[]>([]);
  const [showOnlineUserPicker, setShowOnlineUserPicker] = useState(false);
  const [channelUsers, setChannelUsers] = useState<Array<{ nick: string; user?: string; host?: string }>>([]);

  useEffect(() => {
    if (visible) {
      loadEntries();
      loadAvailableNetworks();
      checkPrefillFromContextMenu();
    }
  }, [visible, network, activeTab]);

  useEffect(() => {
    filterEntries();
  }, [entries, ignoredUsers, searchQuery, selectedNetwork, activeTab]);

  const checkPrefillFromContextMenu = () => {
    const uiState = useUIStore.getState();
    const target = uiState.userListTarget;
    
    if (target?.nick && target.listType === activeTab) {
      setEditingEntry(null);
      setNewMask(target.mask || target.nick);
      setNewChannels(target.channels?.join(',') || '');
      setNewReason('');
      setIsProtected(false);
      setShowAddModal(true);
      
      // Clear the target
      useUIStore.getState().setUserListTarget(null);
    }
  };

  const loadAvailableNetworks = () => {
    const networks = connectionManager
      .getAllConnections()
      .map(conn => conn?.config?.id)
      .filter((id): id is string => Boolean(id));
    setAvailableNetworks(networks);
  };

  const loadChannelUsers = () => {
    const conn = network ? connectionManager.getConnection(network) : null;
    const users: Array<{ nick: string; user?: string; host?: string }> = [];
    
    if (conn?.ircService) {
      const allChannelUsers = conn.ircService.getChannels().flatMap(channel => {
        const channelUsers = conn.ircService.getChannelUsers(channel);
        return channelUsers.map(u => ({ 
          nick: u.nick, 
          user: u.ident, 
          host: u.host,
          channel 
        }));
      });
      
      // Deduplicate by nick
      const seen = new Set<string>();
      for (const user of allChannelUsers) {
        if (!seen.has(user.nick.toLowerCase())) {
          seen.add(user.nick.toLowerCase());
          users.push(user);
        }
      }
    }
    
    setChannelUsers(users);
  };

  const getUserManagementService = () => {
    if (network) {
      const conn = connectionManager.getConnection(network);
      if (conn?.userManagementService) {
        return conn.userManagementService;
      }
    }
    return userManagementService;
  };

  const loadEntries = () => {
    const svc = getUserManagementService();
    
    if (activeTab === 'ignore') {
      const ignored = svc.getIgnoredUsers(null);
      setIgnoredUsers(ignored);
    } else {
      const listType = activeTab as UserListType;
      const userListEntries = svc.getUserListEntries(listType);
      setEntries(userListEntries);
    }
  };

  const filterEntries = () => {
    let filtered: (UserListEntry | IgnoredUser)[] = [];
    
    if (activeTab === 'ignore') {
      filtered = [...ignoredUsers];
    } else {
      filtered = [...entries];
    }

    if (selectedNetwork) {
      filtered = filtered.filter(entry => entry.network === selectedNetwork);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        entry =>
          entry.mask.toLowerCase().includes(query) ||
          (entry.reason && entry.reason.toLowerCase().includes(query))
      );
    }

    setFilteredEntries(filtered);
  };

  const handleAddEntry = async () => {
    const trimmedMask = newMask.trim();
    if (!trimmedMask) return;

    const svc = getUserManagementService();
    const targetNetwork = editingEntry?.network ?? network ?? undefined;
    const channels = newChannels.trim() ? newChannels.split(',').map(c => c.trim()).filter(Boolean) : undefined;

    try {
      if (activeTab === 'ignore') {
        if (editingEntry && 'mask' in editingEntry) {
          await svc.unignoreUser(editingEntry.mask, editingEntry.network);
        }
        await svc.ignoreUser(trimmedMask, newReason.trim() || undefined, targetNetwork);
        // Update protected flag if needed (ignore doesn't have protected in current implementation)
      } else {
        const listType = activeTab as UserListType;
        if (editingEntry && 'mask' in editingEntry) {
          await svc.removeUserListEntry(listType, editingEntry.mask, editingEntry.network);
        }
        await svc.addUserListEntry(listType, trimmedMask, {
          network: targetNetwork,
          channels,
          protected: isProtected,
          reason: newReason.trim() || undefined,
        });
      }

      setNewMask('');
      setNewChannels('');
      setNewReason('');
      setIsProtected(false);
      setShowAddModal(false);
      setEditingEntry(null);
      loadEntries();
      Alert.alert(
        t('Success'),
        editingEntry ? t('Entry updated') : t('Entry added')
      );
    } catch (error) {
      Alert.alert(t('Error'), t('Failed to save entry'));
    }
  };

  const handleRemoveEntry = async (entry: UserListEntry | IgnoredUser) => {
    Alert.alert(
      t('Remove Entry'),
      t('Remove {mask}?').replace('{mask}', entry.mask),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Remove'),
          style: 'destructive',
          onPress: async () => {
            const svc = getUserManagementService();
            try {
              if (activeTab === 'ignore') {
                await svc.unignoreUser(entry.mask, entry.network);
              } else {
                await svc.removeUserListEntry(activeTab as UserListType, entry.mask, entry.network);
              }
              loadEntries();
              Alert.alert(t('Success'), t('Entry removed'));
            } catch (error) {
              Alert.alert(t('Error'), t('Failed to remove entry'));
            }
          },
        },
      ]
    );
  };

  const handleEditEntry = (entry: UserListEntry | IgnoredUser) => {
    setEditingEntry(entry);
    setNewMask(entry.mask);
    setNewReason(entry.reason || '');
    
    if ('channels' in entry) {
      setNewChannels(entry.channels?.join(',') || '');
      setIsProtected(entry.protected || false);
    } else {
      setNewChannels('');
      setIsProtected(entry.protected || false);
    }
    
    setShowAddModal(true);
  };

  const handleSelectOnlineUser = (user: { nick: string; user?: string; host?: string }) => {
    const mask = user.host ? `${user.nick}!${user.user || '*'}@${user.host}` : user.nick;
    setNewMask(mask);
    setShowOnlineUserPicker(false);
  };

  const openOnlineUserPicker = () => {
    loadChannelUsers();
    setShowOnlineUserPicker(true);
  };

  const getTabLabel = (tabId: ListTab) => {
    const tab = TABS.find(t => t.id === tabId);
    return tab ? tab.label : tabId;
  };

  const renderEntry = (entry: UserListEntry | IgnoredUser, index: number) => {
    const isUserListEntry = 'channels' in entry;
    
    return (
      <View key={index} style={styles.entryItem}>
        <View style={styles.entryContent}>
          <Text style={styles.entryMask}>{entry.mask}</Text>
          {entry.network && (
            <Text style={styles.entryNetwork}>
              {t('Network: {network}').replace('{network}', entry.network)}
            </Text>
          )}
          {isUserListEntry && (entry as UserListEntry).channels && (entry as UserListEntry).channels!.length > 0 && (
            <Text style={styles.entryChannels}>
              {t('Channels: {channels}').replace('{channels}', (entry as UserListEntry).channels!.join(', '))}
            </Text>
          )}
          {entry.protected && (
            <Text style={styles.entryProtected}>🛡️ {t('Protected')}</Text>
          )}
          {entry.reason && (
            <Text style={styles.entryReason}>{entry.reason}</Text>
          )}
          <Text style={styles.entryDate}>
            {t('Added {date}').replace('{date}', new Date(entry.addedAt).toLocaleDateString())}
          </Text>
        </View>
        <View style={styles.entryActions}>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => handleEditEntry(entry)}>
            <Text style={styles.editButtonText}>{t('Edit')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => handleRemoveEntry(entry)}>
            <Text style={styles.removeButtonText}>{t('Remove')}</Text>
          </TouchableOpacity>
        </View>
      </View>
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
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('User Lists')}</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => {
                setEditingEntry(null);
                setNewMask('');
                setNewChannels('');
                setNewReason('');
                setIsProtected(false);
                setShowAddModal(true);
              }}>
              <Text style={styles.addButtonText}>{t('+ Add')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>{t('Close')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tabs */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.tabContainer}
          contentContainerStyle={styles.tabContent}>
          {TABS.map(tab => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, activeTab === tab.id && styles.tabActive]}
              onPress={() => setActiveTab(tab.id)}>
              <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Filter Section */}
        <View style={styles.filterSection}>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('Search by mask or reason...')}
            placeholderTextColor="#9E9E9E"
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

        {/* Content */}
        <ScrollView style={styles.content}>
          {filteredEntries.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {searchQuery || selectedNetwork
                  ? t('No matching entries')
                  : t('No entries in {tab}').replace('{tab}', getTabLabel(activeTab))}
              </Text>
              <Text style={styles.emptySubtext}>
                {t('Add users to manage them in this list')}
              </Text>
            </View>
          ) : (
            filteredEntries.map((entry, index) => renderEntry(entry, index))
          )}
        </ScrollView>

        {/* Add/Edit Modal */}
        <Modal
          visible={showAddModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowAddModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                {editingEntry ? t('Edit Entry') : t('Add Entry')}
              </Text>
              <Text style={styles.modalDescription}>
                {t('Enter a mask to match. Examples:')}
                {'\n'}• {t('nick (match a nick)')}
                {'\n'}• {t('*!*@host.com (match a host)')}
                {'\n'}• {t('nick!user@host (full mask)')}
              </Text>
              
              <Text style={styles.inputLabel}>{t('Mask:')}</Text>
              <TextInput
                style={styles.input}
                value={newMask}
                onChangeText={setNewMask}
                placeholder={t('nick or mask')}
                autoCapitalize="none"
                autoCorrect={false}
              />
              
              {activeTab !== 'ignore' && (
                <>
                  <Text style={styles.inputLabel}>{t('Channels:')}</Text>
                  <TextInput
                    style={styles.input}
                    value={newChannels}
                    onChangeText={setNewChannels}
                    placeholder={t('comma-separated, empty for all')}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </>
              )}
              
              <Text style={styles.inputLabel}>{t('Reason:')}</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={newReason}
                onChangeText={setNewReason}
                placeholder={t('optional note')}
                multiline
              />
              
              <View style={styles.switchContainer}>
                <Text style={styles.switchLabel}>{t('Protected (exempt from protections)')}</Text>
                <Switch
                  value={isProtected}
                  onValueChange={setIsProtected}
                  trackColor={{ false: '#E0E0E0', true: '#90CAF9' }}
                  thumbColor={isProtected ? '#2196F3' : '#FFFFFF'}
                />
              </View>
              
              <TouchableOpacity
                style={styles.onlineUserButton}
                onPress={openOnlineUserPicker}>
                <Text style={styles.onlineUserButtonText}>
                  {t('Select from Online Users')}
                </Text>
              </TouchableOpacity>
              
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => {
                    setShowAddModal(false);
                    setEditingEntry(null);
                    setNewMask('');
                    setNewChannels('');
                    setNewReason('');
                    setIsProtected(false);
                  }}>
                  <Text style={styles.modalButtonText}>{t('Cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonPrimary]}
                  onPress={handleAddEntry}>
                  <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>
                    {editingEntry ? t('Save') : t('Add')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Online User Picker Modal */}
        <Modal
          visible={showOnlineUserPicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowOnlineUserPicker(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, styles.onlineUserModal]}>
              <Text style={styles.modalTitle}>{t('Select Online User')}</Text>
              <ScrollView style={styles.onlineUserList}>
                {channelUsers.length === 0 ? (
                  <Text style={styles.emptyText}>{t('No online users found')}</Text>
                ) : (
                  channelUsers.map((user, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.onlineUserItem}
                      onPress={() => handleSelectOnlineUser(user)}>
                      <Text style={styles.onlineUserNick}>{user.nick}</Text>
                      {user.host && (
                        <Text style={styles.onlineUserHost}>
                          {user.user}@{user.host}
                        </Text>
                      )}
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
              <TouchableOpacity
                style={[styles.modalSingleButton, styles.modalButtonPrimary]}
                onPress={() => setShowOnlineUserPicker(false)}>
                <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>
                  {t('Cancel')}
                </Text>
              </TouchableOpacity>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#F5F5F5',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#212121',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  addButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  closeButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  closeButtonText: {
    color: '#2196F3',
    fontSize: 16,
    fontWeight: '500',
  },
  tabContainer: {
    maxHeight: 50,
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tabContent: {
    flexDirection: 'row',
    paddingHorizontal: 8,
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 4,
    borderRadius: 4,
  },
  tabActive: {
    backgroundColor: '#E3F2FD',
  },
  tabText: {
    fontSize: 14,
    color: '#616161',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#1976D2',
  },
  filterSection: {
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    gap: 8,
  },
  searchInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 4,
    padding: 10,
    fontSize: 14,
    color: '#212121',
  },
  networkFilterButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 4,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  networkFilterButtonText: {
    fontSize: 14,
    color: '#212121',
  },
  networkFilterButtonArrow: {
    fontSize: 12,
    color: '#757575',
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
    color: '#757575',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9E9E9E',
    textAlign: 'center',
  },
  entryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  entryContent: {
    flex: 1,
    marginRight: 12,
  },
  entryMask: {
    fontSize: 16,
    color: '#212121',
    fontWeight: '500',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  entryNetwork: {
    fontSize: 12,
    color: '#2196F3',
    marginBottom: 4,
    fontWeight: '500',
  },
  entryChannels: {
    fontSize: 12,
    color: '#757575',
    marginBottom: 4,
  },
  entryProtected: {
    fontSize: 12,
    color: '#4CAF50',
    marginBottom: 4,
    fontWeight: '500',
  },
  entryReason: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 4,
  },
  entryDate: {
    fontSize: 12,
    color: '#9E9E9E',
  },
  entryActions: {
    gap: 8,
    alignItems: 'flex-end',
  },
  editButton: {
    backgroundColor: '#E3F2FD',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  editButtonText: {
    color: '#1976D2',
    fontSize: 14,
    fontWeight: '500',
  },
  removeButton: {
    backgroundColor: '#F44336',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  removeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 20,
    width: '90%',
    maxWidth: 420,
    maxHeight: '80%',
  },
  onlineUserModal: {
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 12,
    color: '#757575',
    marginBottom: 16,
    lineHeight: 18,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 4,
    padding: 12,
    fontSize: 14,
    color: '#212121',
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#424242',
    marginBottom: 4,
    marginTop: 8,
  },
  inputMultiline: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 8,
  },
  switchLabel: {
    fontSize: 14,
    color: '#212121',
  },
  onlineUserButton: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 4,
    alignItems: 'center',
    marginBottom: 16,
  },
  onlineUserButtonText: {
    color: '#1976D2',
    fontSize: 14,
    fontWeight: '500',
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
    backgroundColor: '#9E9E9E',
  },
  modalButtonPrimary: {
    backgroundColor: '#2196F3',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  modalButtonTextPrimary: {
    color: '#FFFFFF',
  },
  networkPickerScroll: {
    maxHeight: 300,
    marginVertical: 12,
  },
  networkPickerItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  networkPickerItemText: {
    fontSize: 16,
    color: '#212121',
  },
  networkPickerItemTextSelected: {
    color: '#2196F3',
    fontWeight: '600',
  },
  onlineUserList: {
    maxHeight: 300,
    marginVertical: 12,
  },
  onlineUserItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  onlineUserNick: {
    fontSize: 16,
    color: '#212121',
    fontWeight: '500',
  },
  onlineUserHost: {
    fontSize: 12,
    color: '#757575',
    marginTop: 2,
  },
});

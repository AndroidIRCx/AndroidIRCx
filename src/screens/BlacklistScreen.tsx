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
} from 'react-native';
import {
  userManagementService,
  BlacklistEntry,
  BlacklistActionType,
} from '../services/UserManagementService';
import { connectionManager } from '../services/ConnectionManager';
import { settingsService } from '../services/SettingsService';
import { useT } from '../i18n/transifex';

interface BlacklistScreenProps {
  visible: boolean;
  network?: string;
  onClose: () => void;
}

const ACTION_OPTIONS: Array<{ id: BlacklistActionType; labelKey: string }> = [
  { id: 'ignore', labelKey: 'Ignore (local)' },
  { id: 'ban', labelKey: 'Ban' },
  { id: 'kick_ban', labelKey: 'Kick + Ban' },
  { id: 'kill', labelKey: 'Kill' },
  { id: 'os_kill', labelKey: 'OperServ Kill' },
  { id: 'akill', labelKey: 'AKILL' },
  { id: 'gline', labelKey: 'GLINE' },
  { id: 'shun', labelKey: 'SHUN' },
  { id: 'custom', labelKey: 'Custom Command' },
];

const DEFAULT_TEMPLATES = {
  akill: 'PRIVMSG OperServ :AKILL ADD +{duration} {usermask} {reason}',
  gline: 'GLINE {hostmask} {duration} :{reason}',
  shun: 'SHUN {hostmask} {duration} :{reason}',
};

type BlacklistTemplates = Record<string, Partial<typeof DEFAULT_TEMPLATES>>;

export const BlacklistScreen: React.FC<BlacklistScreenProps> = ({
  visible,
  network,
  onClose,
}) => {
  const t = useT();
  const [blacklistEntries, setBlacklistEntries] = useState<BlacklistEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<BlacklistEntry[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<BlacklistEntry | null>(null);
  const [newMask, setNewMask] = useState('');
  const [newReason, setNewReason] = useState('');
  const [newDuration, setNewDuration] = useState('0');
  const [newAction, setNewAction] = useState<BlacklistActionType>('ban');
  const [newCommand, setNewCommand] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null);
  const [showNetworkPicker, setShowNetworkPicker] = useState(false);
  const [showActionPicker, setShowActionPicker] = useState(false);
  const [availableNetworks, setAvailableNetworks] = useState<string[]>([]);
  const [templates, setTemplates] = useState<BlacklistTemplates>({});
  const [templateNetwork, setTemplateNetwork] = useState<string>('global');

  useEffect(() => {
    if (visible) {
      loadBlacklistEntries();
      loadAvailableNetworks();
      loadTemplates();
    }
  }, [visible, network]);

  useEffect(() => {
    filterEntries();
  }, [blacklistEntries, searchQuery, selectedNetwork]);

  const loadAvailableNetworks = () => {
    const networks = connectionManager
      .getAllConnections()
      .map(conn => conn?.config?.id)
      .filter((id): id is string => Boolean(id));
    setAvailableNetworks(networks);
  };

  const loadTemplates = async () => {
    const stored = await settingsService.getSetting('blacklistTemplates', {});
    setTemplates(stored || {});
  };

  const filterEntries = () => {
    let filtered = [...blacklistEntries];

    if (selectedNetwork) {
      filtered = filtered.filter(entry => entry.network === selectedNetwork);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        entry =>
          entry.mask.toLowerCase().includes(query) ||
          (entry.reason && entry.reason.toLowerCase().includes(query)) ||
          (entry.commandTemplate && entry.commandTemplate.toLowerCase().includes(query))
      );
    }

    setFilteredEntries(filtered);
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

  const loadBlacklistEntries = () => {
    const svc = getUserManagementService();
    const entries = svc.getBlacklistEntries();
    setBlacklistEntries(entries);
  };

  const getTemplatesForNetwork = (netId?: string | null) => {
    const key = netId || 'global';
    return {
      ...DEFAULT_TEMPLATES,
      ...(templates['global'] || {}),
      ...(templates[key] || {}),
    };
  };

  const getStoredTemplatesForNetwork = (netId?: string | null) => {
    const key = netId || 'global';
    return templates[key] || {};
  };

  const resolveTemplateForAction = (action: BlacklistActionType) => {
    if (!['akill', 'gline', 'shun'].includes(action)) {
      return '';
    }
    const netKey = network || 'global';
    const activeTemplates = getTemplatesForNetwork(netKey);
    return (activeTemplates as any)[action] || '';
  };

  const handleSaveBlacklist = async () => {
    const trimmedMask = newMask.trim();
    if (!trimmedMask) return;
    if (newAction === 'custom' && !newCommand.trim()) {
      Alert.alert(t('Missing Command'), t('Custom command is required for this action.'));
      return;
    }
    const targetNetwork = editingEntry?.network ?? network;
    const templateCommand =
      newAction === 'custom' ? newCommand.trim() : resolveTemplateForAction(newAction);
    const svc = getUserManagementService();
    if (editingEntry && editingEntry.mask !== trimmedMask) {
      await svc.removeBlacklistEntry(editingEntry.mask, editingEntry.network);
    }
    await svc.addBlacklistEntry(
      trimmedMask,
      newAction,
      newReason.trim() || undefined,
      targetNetwork,
      templateCommand || undefined,
      newDuration.trim() || '0'
    );
    setNewMask('');
    setNewReason('');
    setNewDuration('0');
    setNewAction('ban');
    setNewCommand('');
    setShowAddModal(false);
    setEditingEntry(null);
    loadBlacklistEntries();
    Alert.alert(
      t('Success'),
      editingEntry ? t('Blacklist entry updated') : t('User added to blacklist')
    );
  };

  const handleRemoveBlacklist = async (entry: BlacklistEntry) => {
    Alert.alert(
      t('Remove from Blacklist'),
      t('Remove {mask}?').replace('{mask}', entry.mask),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Remove'),
          style: 'destructive',
          onPress: async () => {
            const svc = getUserManagementService();
            await svc.removeBlacklistEntry(entry.mask, entry.network);
            loadBlacklistEntries();
            Alert.alert(t('Success'), t('User removed from blacklist'));
          },
        },
      ]
    );
  };

  const getActionLabel = (action: BlacklistActionType) => {
    const option = ACTION_OPTIONS.find(item => item.id === action);
    return option ? t(option.labelKey) : action;
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
          <Text style={styles.headerTitle}>{t('Blacklist')}</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.templatesButton}
              onPress={() => setShowTemplatesModal(true)}>
              <Text style={styles.templatesButtonText}>{t('Templates')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => {
                setEditingEntry(null);
                setNewMask('');
                setNewReason('');
                setNewDuration('0');
                setNewAction('ban');
                setNewCommand('');
                setShowAddModal(true);
              }}>
              <Text style={styles.addButtonText}>{t('+ Add')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>{t('Close')}</Text>
            </TouchableOpacity>
          </View>
        </View>

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

        <ScrollView style={styles.content}>
          {filteredEntries.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {searchQuery || selectedNetwork
                  ? t('No matching blacklist entries')
                  : t('No blacklist entries')}
              </Text>
              <Text style={styles.emptySubtext}>
                {searchQuery || selectedNetwork
                  ? t('Try different filters')
                  : t('Add users to auto-run actions on join')}
              </Text>
            </View>
          ) : (
            filteredEntries.map((entry, index) => (
              <View key={index} style={styles.entryItem}>
                <View style={styles.entryContent}>
                  <Text style={styles.entryMask}>{entry.mask}</Text>
                  <Text style={styles.entryAction}>{getActionLabel(entry.action)}</Text>
                  {entry.network && (
                    <Text style={styles.entryNetwork}>
                      {t('Network: {network}').replace('{network}', entry.network)}
                    </Text>
                  )}
                  {entry.reason && (
                    <Text style={styles.entryReason}>{entry.reason}</Text>
                  )}
                  {entry.commandTemplate && (
                    <Text style={styles.entryCommand}>{entry.commandTemplate}</Text>
                  )}
                  <Text style={styles.entryDate}>
                    {t('Added {date}').replace('{date}', new Date(entry.addedAt).toLocaleDateString())}
                  </Text>
                </View>
                <View style={styles.entryActions}>
                  <TouchableOpacity
                    style={styles.editButton}
                    onPress={() => {
                      setEditingEntry(entry);
                      setNewMask(entry.mask);
                      setNewReason(entry.reason || '');
                      setNewDuration(entry.duration || '0');
                      setNewAction(entry.action);
                      setNewCommand(entry.commandTemplate || '');
                      setShowAddModal(true);
                    }}>
                    <Text style={styles.editButtonText}>{t('Edit')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => handleRemoveBlacklist(entry)}>
                    <Text style={styles.removeButtonText}>{t('Remove')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>

        <Modal
          visible={showAddModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowAddModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                {editingEntry ? t('Edit Blacklist Entry') : t('Add to Blacklist')}
              </Text>
              <Text style={styles.modalDescription}>
                {t('Enter a mask to match. Examples:')}
                {'\n'}• {t('nick (match a nick)')}
                {'\n'}• {t('*!*@host.com (match a host)')}
                {'\n'}• {t('*!*@*.tor-exit.* (wildcards allowed)')}
              </Text>
              <TextInput
                style={styles.input}
                value={newMask}
                onChangeText={setNewMask}
                placeholder={t('nick or mask (e.g., *!*@host.com)')}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.actionPickerButton}
                onPress={() => setShowActionPicker(true)}>
                <Text style={styles.actionPickerButtonText}>{getActionLabel(newAction)}</Text>
                <Text style={styles.networkFilterButtonArrow}>▼</Text>
              </TouchableOpacity>
              {newAction === 'custom' && (
                <TextInput
                  style={styles.input}
                  value={newCommand}
                  onChangeText={setNewCommand}
                  placeholder={t('Command template (use {mask}, {usermask}, {hostmask}, {nick}, {user}, {host}, {reason}, {duration})')}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              )}
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={newReason}
                onChangeText={setNewReason}
                placeholder={t('Reason (optional)')}
                multiline
              />
              {['akill', 'gline', 'shun'].includes(newAction) && (
                <TextInput
                  style={styles.input}
                  value={newDuration}
                  onChangeText={setNewDuration}
                  placeholder={t('Duration (e.g., 1d, 7d, 1h, 0 for permanent)')}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              )}
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => {
                    setShowAddModal(false);
                    setNewMask('');
                    setNewReason('');
                    setNewDuration('0');
                    setNewAction('ban');
                    setNewCommand('');
                    setEditingEntry(null);
                  }}>
                  <Text style={styles.modalButtonText}>{t('Cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonPrimary]}
                  onPress={handleSaveBlacklist}>
                  <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>
                    {editingEntry ? t('Save') : t('Add')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={showActionPicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowActionPicker(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{t('Select Action')}</Text>
              <ScrollView style={styles.networkPickerScroll}>
                {ACTION_OPTIONS.map(option => (
                  <TouchableOpacity
                    key={option.id}
                    style={styles.networkPickerItem}
                    onPress={() => {
                      setNewAction(option.id);
                      if (option.id !== 'custom') {
                        setNewCommand('');
                      }
                      setShowActionPicker(false);
                    }}>
                    <Text
                      style={[
                        styles.networkPickerItemText,
                        newAction === option.id && styles.networkPickerItemTextSelected,
                      ]}>
                      {t(option.labelKey)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity
                style={[styles.modalSingleButton, styles.modalButtonPrimary]}
                onPress={() => setShowActionPicker(false)}>
                <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>
                  {t('Close')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal
          visible={showTemplatesModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowTemplatesModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{t('Blacklist Templates')}</Text>
              <Text style={styles.modalDescription}>
                {t('Set default commands for AKILL/GLINE/SHUN. Use {mask}, {usermask}, {hostmask}, {reason}.')}
              </Text>
              <TouchableOpacity
                style={styles.networkFilterButton}
                onPress={() => setShowNetworkPicker(true)}>
                <Text style={styles.networkFilterButtonText}>
                  {templateNetwork === 'global' ? t('All Networks') : templateNetwork}
                </Text>
                <Text style={styles.networkFilterButtonArrow}>▼</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                value={getStoredTemplatesForNetwork(templateNetwork).akill || ''}
                onChangeText={(value) => {
                  setTemplates(prev => ({
                    ...prev,
                    [templateNetwork]: { ...(prev[templateNetwork] || {}), akill: value },
                  }));
                }}
                placeholder={getTemplatesForNetwork(templateNetwork).akill || t('AKILL template')}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TextInput
                style={styles.input}
                value={getStoredTemplatesForNetwork(templateNetwork).gline || ''}
                onChangeText={(value) => {
                  setTemplates(prev => ({
                    ...prev,
                    [templateNetwork]: { ...(prev[templateNetwork] || {}), gline: value },
                  }));
                }}
                placeholder={getTemplatesForNetwork(templateNetwork).gline || t('GLINE template')}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TextInput
                style={styles.input}
                value={getStoredTemplatesForNetwork(templateNetwork).shun || ''}
                onChangeText={(value) => {
                  setTemplates(prev => ({
                    ...prev,
                    [templateNetwork]: { ...(prev[templateNetwork] || {}), shun: value },
                  }));
                }}
                placeholder={getTemplatesForNetwork(templateNetwork).shun || t('SHUN template')}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => setShowTemplatesModal(false)}>
                  <Text style={styles.modalButtonText}>{t('Close')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonPrimary]}
                  onPress={async () => {
                    await settingsService.setSetting('blacklistTemplates', templates);
                    setShowTemplatesModal(false);
                  }}>
                  <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>
                    {t('Save')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

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
                    if (showTemplatesModal) {
                      setTemplateNetwork('global');
                    } else {
                      setSelectedNetwork(null);
                    }
                    setShowNetworkPicker(false);
                  }}>
                  <Text
                    style={[
                      styles.networkPickerItemText,
                      showTemplatesModal
                        ? templateNetwork === 'global' && styles.networkPickerItemTextSelected
                        : !selectedNetwork && styles.networkPickerItemTextSelected,
                    ]}>
                    {t('All Networks')}
                  </Text>
                </TouchableOpacity>
                {availableNetworks.map((net, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.networkPickerItem}
                    onPress={() => {
                      if (showTemplatesModal) {
                        setTemplateNetwork(net);
                      } else {
                        setSelectedNetwork(net);
                      }
                      setShowNetworkPicker(false);
                    }}>
                    <Text
                      style={[
                        styles.networkPickerItemText,
                        (showTemplatesModal ? templateNetwork === net : selectedNetwork === net) &&
                          styles.networkPickerItemTextSelected,
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
  entryAction: {
    fontSize: 12,
    color: '#F57C00',
    marginBottom: 4,
    fontWeight: '600',
  },
  entryNetwork: {
    fontSize: 12,
    color: '#2196F3',
    marginBottom: 4,
    fontWeight: '500',
  },
  entryReason: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 4,
  },
  entryCommand: {
    fontSize: 12,
    color: '#616161',
    marginBottom: 4,
    fontFamily: 'monospace',
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
  inputMultiline: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  actionPickerButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 4,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionPickerButtonText: {
    fontSize: 14,
    color: '#212121',
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
});

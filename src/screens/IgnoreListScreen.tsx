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
import { userManagementService, IgnoredUser } from '../services/UserManagementService';

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
  const [ignoredUsers, setIgnoredUsers] = useState<IgnoredUser[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMask, setNewMask] = useState('');
  const [newReason, setNewReason] = useState('');

  useEffect(() => {
    if (visible) {
      loadIgnoredUsers();
    }
  }, [visible, network]);

  const loadIgnoredUsers = () => {
    const ignored = userManagementService.getIgnoredUsers(network);
    setIgnoredUsers(ignored);
  };

  const handleAddIgnore = async () => {
    if (newMask.trim()) {
      await userManagementService.ignoreUser(
        newMask.trim(),
        newReason.trim() || undefined,
        network
      );
      setNewMask('');
      setNewReason('');
      setShowAddModal(false);
      loadIgnoredUsers();
      Alert.alert('Success', 'User added to ignore list');
    }
  };

  const handleRemoveIgnore = async (mask: string) => {
    Alert.alert(
      'Remove from Ignore List',
      `Remove ${mask}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await userManagementService.unignoreUser(mask, network);
            loadIgnoredUsers();
            Alert.alert('Success', 'User removed from ignore list');
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
          <Text style={styles.headerTitle}>Ignore List</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowAddModal(true)}>
              <Text style={styles.addButtonText}>+ Add</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.content}>
          {ignoredUsers.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No ignored users</Text>
              <Text style={styles.emptySubtext}>
                Add users to ignore their messages
              </Text>
            </View>
          ) : (
            ignoredUsers.map((ignored, index) => (
              <View key={index} style={styles.ignoreItem}>
                <View style={styles.ignoreContent}>
                  <Text style={styles.ignoreMask}>{ignored.mask}</Text>
                  {ignored.reason && (
                    <Text style={styles.ignoreReason}>{ignored.reason}</Text>
                  )}
                  <Text style={styles.ignoreDate}>
                    Added {new Date(ignored.addedAt).toLocaleDateString()}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => handleRemoveIgnore(ignored.mask)}>
                  <Text style={styles.removeButtonText}>Remove</Text>
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
              <Text style={styles.modalTitle}>Add to Ignore List</Text>
              <Text style={styles.modalDescription}>
                Enter a mask to ignore. Examples:
                {'\n'}• nick (ignore specific nick)
                {'\n'}• *!*@host.com (ignore all from host)
                {'\n'}• nick!*@* (ignore specific user)
              </Text>
              <TextInput
                style={styles.input}
                value={newMask}
                onChangeText={setNewMask}
                placeholder="nick or mask (e.g., *!*@host.com)"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={newReason}
                onChangeText={setNewReason}
                placeholder="Reason (optional)"
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
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonPrimary]}
                  onPress={handleAddIgnore}>
                  <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>
                    Add
                  </Text>
                </TouchableOpacity>
              </View>
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
  ignoreItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  ignoreContent: {
    flex: 1,
    marginRight: 12,
  },
  ignoreMask: {
    fontSize: 16,
    color: '#212121',
    fontWeight: '500',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  ignoreReason: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 4,
  },
  ignoreDate: {
    fontSize: 12,
    color: '#9E9E9E',
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
    maxWidth: 400,
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
});


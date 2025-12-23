import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  Modal,
} from 'react-native';
import { IRCNetworkConfig, IRCServerConfig, settingsService } from '../services/SettingsService';
import { NetworkSettingsScreen } from './NetworkSettingsScreen';
import { ServerSettingsScreen } from './ServerSettingsScreen';

interface NetworksListScreenProps {
  onSelectNetwork: (network: IRCNetworkConfig, serverId?: string) => void;
  onClose: () => void;
}

export const NetworksListScreen: React.FC<NetworksListScreenProps> = ({
  onSelectNetwork,
  onClose,
}) => {
  const [networks, setNetworks] = useState<IRCNetworkConfig[]>([]);
  const [showNetworkSettings, setShowNetworkSettings] = useState(false);
  const [showServerSettings, setShowServerSettings] = useState(false);
  const [editingNetworkId, setEditingNetworkId] = useState<string | undefined>();
  const [editingServerId, setEditingServerId] = useState<string | undefined>();
  const [selectedNetworkId, setSelectedNetworkId] = useState<string | undefined>();

  useEffect(() => {
    loadNetworks();
  }, []);

  const loadNetworks = async () => {
    const loaded = await settingsService.loadNetworks();
    if (loaded.length === 0) {
      // Create default network
      await settingsService.createDefaultNetwork();
      const updated = await settingsService.loadNetworks();
      setNetworks(updated);
    } else {
      setNetworks(loaded);
    }
  };

  const handleAddNetwork = () => {
    setEditingNetworkId(undefined);
    setShowNetworkSettings(true);
  };

  const handleEditNetwork = (network: IRCNetworkConfig) => {
    setEditingNetworkId(network.id);
    setShowNetworkSettings(true);
  };

  const handleAddServer = (networkId: string) => {
    setSelectedNetworkId(networkId);
    setEditingServerId(undefined);
    setShowServerSettings(true);
  };

  const handleEditServer = (networkId: string, serverId: string) => {
    setSelectedNetworkId(networkId);
    setEditingServerId(serverId);
    setShowServerSettings(true);
  };

  const handleSaveNetwork = async (network: IRCNetworkConfig) => {
    try {
      if (editingNetworkId) {
        await settingsService.updateNetwork(editingNetworkId, network);
      } else {
        await settingsService.addNetwork(network);
      }
      await loadNetworks();
      setShowNetworkSettings(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to save network');
    }
  };

  const handleSaveServer = async (server: IRCServerConfig) => {
    if (!selectedNetworkId) return;
    
    try {
      if (editingServerId) {
        await settingsService.updateServerInNetwork(selectedNetworkId, editingServerId, server);
      } else {
        await settingsService.addServerToNetwork(selectedNetworkId, server);
      }
      await loadNetworks();
      setShowServerSettings(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to save server');
    }
  };

  const handleDeleteNetwork = (network: IRCNetworkConfig) => {
    Alert.alert(
      'Delete Network',
      `Are you sure you want to delete "${network.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await settingsService.deleteNetwork(network.id);
            await loadNetworks();
          },
        },
      ]
    );
  };

  const handleConnect = (network: IRCNetworkConfig, serverId?: string) => {
    onSelectNetwork(network, serverId);
    onClose();
  };

  return (
    <>
      {/* Networks List Modal */}
      <Modal
        visible={!showNetworkSettings && !showServerSettings}
        animationType="slide"
        onRequestClose={onClose}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Networks</Text>
            <TouchableOpacity onPress={handleAddNetwork} style={styles.addButton}>
              <Text style={styles.addText}>+</Text>
            </TouchableOpacity>
          </View>

          <FlatList
        data={networks}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.networkItem}>
            <TouchableOpacity
              style={styles.networkHeader}
              onPress={() => handleConnect(item)}>
              <View style={styles.networkInfo}>
                <Text style={styles.networkName}>{item.name}</Text>
                <Text style={styles.networkDetails}>
                  {item.nick} • {item.servers?.length || 0} server{(item.servers?.length || 0) !== 1 ? 's' : ''}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => handleEditNetwork(item)}
                style={styles.editButton}>
                <Text style={styles.editText}>Edit</Text>
              </TouchableOpacity>
            </TouchableOpacity>

            <View style={styles.serversList}>
              {item.servers && item.servers.map((server) => (
                <TouchableOpacity
                  key={server.id}
                  style={styles.serverItem}
                  onPress={() => handleConnect(item, server.id)}>
                  <View style={styles.serverInfo}>
                    <Text style={styles.serverName}>
                      {server.favorite ? '★ ' : ''}
                      {server.name || server.hostname}
                    </Text>
                    <Text style={styles.serverDetails}>
                      {server.hostname}:{server.port} {server.ssl ? '(SSL)' : ''}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleEditServer(item.id, server.id)}
                    style={styles.serverEditButton}>
                    <Text style={styles.editText}>Edit</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.addServerButton}
                onPress={() => handleAddServer(item.id)}>
                <Text style={styles.addServerText}>+ Add Server</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
          />
        </View>
      </Modal>

      {/* Network Settings Modal */}
      {showNetworkSettings && (
        <NetworkSettingsScreen
          networkId={editingNetworkId}
          onSave={handleSaveNetwork}
          onCancel={() => setShowNetworkSettings(false)}
        />
      )}

      {/* Server Settings Modal */}
      {showServerSettings && selectedNetworkId && (
        <ServerSettingsScreen
          networkId={selectedNetworkId}
          serverId={editingServerId}
          onSave={handleSaveServer}
          onCancel={() => setShowServerSettings(false)}
        />
      )}
    </>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#2196F3',
    borderBottomWidth: 1,
    borderBottomColor: '#1976D2',
  },
  closeButton: {
    padding: 8,
  },
  closeText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  addButton: {
    padding: 8,
  },
  addText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  networkItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  networkHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  networkInfo: {
    flex: 1,
  },
  networkName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 4,
  },
  networkDetails: {
    fontSize: 14,
    color: '#757575',
  },
  editButton: {
    padding: 8,
  },
  editText: {
    color: '#2196F3',
    fontSize: 14,
  },
  serversList: {
    paddingLeft: 16,
    paddingRight: 16,
    paddingBottom: 16,
  },
  serverItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingLeft: 16,
    borderLeftWidth: 2,
    borderLeftColor: '#E0E0E0',
  },
  serverInfo: {
    flex: 1,
  },
  serverName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#212121',
    marginBottom: 2,
  },
  serverDetails: {
    fontSize: 12,
    color: '#9E9E9E',
  },
  serverEditButton: {
    padding: 8,
  },
  addServerButton: {
    paddingVertical: 12,
    paddingLeft: 16,
  },
  addServerText: {
    color: '#2196F3',
    fontSize: 14,
  },
});

/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { IRCNetworkConfig, IRCServerConfig, settingsService } from '../services/SettingsService';
import { NetworkSettingsScreen } from './NetworkSettingsScreen';
import { ServerSettingsScreen } from './ServerSettingsScreen';
import { ConnectionProfilesScreen } from './ConnectionProfilesScreen';
import { useT } from '../i18n/transifex';
import { useTheme } from '../hooks/useTheme';

interface NetworksListScreenProps {
  onSelectNetwork: (network: IRCNetworkConfig, serverId?: string) => void;
  onClose: () => void;
}

export const NetworksListScreen: React.FC<NetworksListScreenProps> = ({
  onSelectNetwork,
  onClose,
}) => {
  const t = useT();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [networks, setNetworks] = useState<IRCNetworkConfig[]>([]);
  const [showNetworkSettings, setShowNetworkSettings] = useState(false);
  const [showServerSettings, setShowServerSettings] = useState(false);
  const [showConnectionProfiles, setShowConnectionProfiles] = useState(false);
  const [editingNetworkId, setEditingNetworkId] = useState<string | undefined>();
  const [editingServerId, setEditingServerId] = useState<string | undefined>();
  const [selectedNetworkId, setSelectedNetworkId] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadNetworks();
  }, []);

  const loadNetworks = async () => {
    setIsLoading(true);
    try {
      const loaded = await settingsService.loadNetworks();
      setNetworks(loaded);
    } finally {
      setIsLoading(false);
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
      Alert.alert(t('Error'), t('Failed to save network'));
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
      Alert.alert(t('Error'), t('Failed to save server'));
    }
  };

  const handleDeleteNetwork = (network: IRCNetworkConfig) => {
    Alert.alert(
      t('Delete Network'),
      t('Are you sure you want to delete "{networkName}"?').replace('{networkName}', network.name),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Delete'),
          style: 'destructive',
          onPress: async () => {
            await settingsService.deleteNetwork(network.id);
            await loadNetworks();
          },
        },
      ]
    );
  };

  const handleDeleteServer = (network: IRCNetworkConfig, server: IRCServerConfig) => {
    if (network.servers.length <= 1) {
      Alert.alert(
        t('Cannot Delete Server'),
        t('Each network must have at least one server.')
      );
      return;
    }
    const serverLabel = server.name || server.hostname;
    Alert.alert(
      t('Delete Server'),
      t('Are you sure you want to delete "{serverName}"?').replace('{serverName}', serverLabel),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Delete'),
          style: 'destructive',
          onPress: async () => {
            await settingsService.deleteServerFromNetwork(network.id, server.id);
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
              <Text style={styles.closeText}>{t('Close')}</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{t('Networks')}</Text>
            <TouchableOpacity onPress={handleAddNetwork} style={styles.addButton}>
              <Text style={styles.addText}>{t('+')}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.topActions}>
            <TouchableOpacity
              style={styles.topActionButton}
              onPress={() => setShowConnectionProfiles(true)}>
              <Text style={styles.topActionText}>{t('Identity Profiles')}</Text>
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary || '#2196F3'} />
              <Text style={styles.loadingText}>{t('Loading...', { _tags: 'screen:networks-list,file:NetworksListScreen.tsx,feature:networks' })}</Text>
            </View>
          ) : (
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
                        {item.nick} • {item.servers?.length || 0} {(item.servers?.length || 0) !== 1 ? t('servers') : t('server')}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleEditNetwork(item)}
                      style={styles.editButton}>
                      <Text style={styles.editText}>{t('Edit')}</Text>
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
                            {server.hostname}:{server.port} {server.ssl ? t('(SSL)') : ''}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => handleDeleteServer(item, server)}
                          style={[
                            styles.serverDeleteButton,
                            item.servers.length <= 1 && styles.serverDeleteButtonDisabled,
                          ]}
                          disabled={item.servers.length <= 1}>
                          <Text style={styles.deleteText}>{t('Delete')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleEditServer(item.id, server.id)}
                          style={styles.serverEditButton}>
                          <Text style={styles.editText}>{t('Edit')}</Text>
                        </TouchableOpacity>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                      style={styles.addServerButton}
                      onPress={() => handleAddServer(item.id)}>
                      <Text style={styles.addServerText}>{t('+ Add Server')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            />
          )}
        </View>
      </Modal>

      {/* Network Settings Modal */}
      {showNetworkSettings && (
        <NetworkSettingsScreen
          networkId={editingNetworkId}
          onSave={handleSaveNetwork}
          onCancel={() => setShowNetworkSettings(false)}
          onShowIdentityProfiles={() => setShowConnectionProfiles(true)}
        />
      )}

      {/* Connection/Identity Profiles Modal */}
      {showConnectionProfiles && (
        <ConnectionProfilesScreen
          visible={showConnectionProfiles}
          onClose={() => setShowConnectionProfiles(false)}
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

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background || '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.primary || '#2196F3',
    borderBottomWidth: 1,
    borderBottomColor: colors.border || '#1976D2',
  },
  closeButton: {
    padding: 8,
  },
  closeText: {
    color: colors.onPrimary || '#FFFFFF',
    fontSize: 16,
  },
  title: {
    color: colors.onPrimary || '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  addButton: {
    padding: 8,
  },
  addText: {
    color: colors.onPrimary || '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  topActions: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border || '#E0E0E0',
    backgroundColor: colors.surface || '#F7F7F7',
  },
  topActionButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.background || '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border || '#E0E0E0',
    alignSelf: 'flex-start',
  },
  topActionText: {
    color: colors.primary || '#2196F3',
    fontSize: 14,
    fontWeight: '600',
  },
  networkItem: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border || '#E0E0E0',
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
    color: colors.text || '#212121',
    marginBottom: 4,
  },
  networkDetails: {
    fontSize: 14,
    color: colors.textSecondary || '#757575',
  },
  editButton: {
    padding: 8,
  },
  editText: {
    color: colors.primary || '#2196F3',
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
    borderLeftColor: colors.border || '#E0E0E0',
  },
  serverInfo: {
    flex: 1,
  },
  serverName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text || '#212121',
    marginBottom: 2,
  },
  serverDetails: {
    fontSize: 12,
    color: colors.textSecondary || '#9E9E9E',
  },
  serverEditButton: {
    padding: 8,
  },
  serverDeleteButton: {
    padding: 8,
    marginRight: 4,
  },
  serverDeleteButtonDisabled: {
    opacity: 0.5,
  },
  deleteText: {
    color: colors.error || '#E53935',
    fontSize: 14,
  },
  addServerButton: {
    paddingVertical: 12,
    paddingLeft: 16,
  },
  addServerText: {
    color: colors.primary || '#2196F3',
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  loadingText: {
    color: colors.textSecondary || '#757575',
    fontSize: 14,
  },
});

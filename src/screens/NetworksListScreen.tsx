/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  Modal,
  ActivityIndicator,
  ScrollView,
  Linking,
} from 'react-native';
import {
  IRCNetworkConfig,
  IRCServerConfig,
  settingsService,
} from '../services/SettingsService';
import { NetworkSettingsScreen } from './NetworkSettingsScreen';
import { ServerSettingsScreen } from './ServerSettingsScreen';
import { ConnectionProfilesScreen } from './ConnectionProfilesScreen';
import { useT } from '../i18n/transifex';
import { useTheme } from '../hooks/useTheme';
import { ircDatabaseImportService } from '../services/IrcDatabaseImportService';

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
  const [showIrcDatabaseModal, setShowIrcDatabaseModal] = useState(false);
  const [editingNetworkId, setEditingNetworkId] = useState<
    string | undefined
  >();
  const [editingServerId, setEditingServerId] = useState<string | undefined>();
  const [selectedNetworkId, setSelectedNetworkId] = useState<
    string | undefined
  >();
  const [isLoading, setIsLoading] = useState(false);
  const [isImportingFromIrcDatabase, setIsImportingFromIrcDatabase] =
    useState(false);
  const isImportingRef = useRef(false);

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
    } catch {
      Alert.alert(t('Error'), t('Failed to save network'));
    }
  };

  const handleSaveServer = async (server: IRCServerConfig) => {
    if (!selectedNetworkId) return;

    try {
      if (editingServerId) {
        await settingsService.updateServerInNetwork(
          selectedNetworkId,
          editingServerId,
          server,
        );
      } else {
        await settingsService.addServerToNetwork(selectedNetworkId, server);
      }
      await loadNetworks();
      setShowServerSettings(false);
    } catch {
      Alert.alert(t('Error'), t('Failed to save server'));
    }
  };

  const handleDeleteServer = (
    network: IRCNetworkConfig,
    server: IRCServerConfig,
  ) => {
    if (network.servers.length <= 1) {
      Alert.alert(
        t('Cannot Delete Server'),
        t('Each network must have at least one server.'),
      );
      return;
    }
    const serverLabel = server.name || server.hostname;
    Alert.alert(
      t('Delete Server'),
      t('Are you sure you want to delete "{serverName}"?').replace(
        '{serverName}',
        serverLabel,
      ),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Delete'),
          style: 'destructive',
          onPress: async () => {
            await settingsService.deleteServerFromNetwork(
              network.id,
              server.id,
            );
            await loadNetworks();
          },
        },
      ],
    );
  };

  const handleConnect = (network: IRCNetworkConfig, serverId?: string) => {
    onSelectNetwork(network, serverId);
    onClose();
  };

  const handleImportFromIrcDatabase = async () => {
    if (isImportingRef.current) {
      return;
    }
    isImportingRef.current = true;
    setIsImportingFromIrcDatabase(true);
    try {
      const summary = await ircDatabaseImportService.importFromIrcDatabase();
      await loadNetworks();

      setShowIrcDatabaseModal(false);
      const totalApplied = summary.importedNetworks + summary.mergedNetworks;
      if (totalApplied === 0 && summary.failedPersistNetworks === 0) {
        Alert.alert(
          t('No new networks imported'),
          t(
            'No new networks were imported from IRC Database. Existing entries are unchanged.',
          ),
        );
        return;
      }

      if (summary.failedPersistNetworks > 0) {
        Alert.alert(
          t('Import partially completed'),
          t(
            'Imported: {importedNetworks} networks ({importedServers} servers). Merged: {mergedNetworks} networks (+{mergedServers} servers). Failed to save: {failed}. Skipped unchanged: {skipped}.',
          )
            .replace('{importedNetworks}', String(summary.importedNetworks))
            .replace('{importedServers}', String(summary.importedServers))
            .replace('{mergedNetworks}', String(summary.mergedNetworks))
            .replace('{mergedServers}', String(summary.mergedServers))
            .replace('{failed}', String(summary.failedPersistNetworks))
            .replace('{skipped}', String(summary.skippedExistingNetworks)),
        );
        return;
      }

      Alert.alert(
        t('Import completed'),
        t(
          'Imported: {importedNetworks} networks ({importedServers} servers). Merged: {mergedNetworks} networks (+{mergedServers} servers). Skipped unchanged: {skipped}.',
        )
          .replace('{importedNetworks}', String(summary.importedNetworks))
          .replace('{importedServers}', String(summary.importedServers))
          .replace('{mergedNetworks}', String(summary.mergedNetworks))
          .replace('{mergedServers}', String(summary.mergedServers))
          .replace('{skipped}', String(summary.skippedExistingNetworks)),
      );
    } catch (error: any) {
      const errorMessage = error?.message
        ? String(error.message)
        : t('Unknown error');
      Alert.alert(
        t('Import failed'),
        t('Unable to load data from IRC Database: {error}').replace(
          '{error}',
          errorMessage,
        ),
      );
    } finally {
      setIsImportingFromIrcDatabase(false);
      isImportingRef.current = false;
    }
  };

  const openExternalUrl = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(t('Error'), t('Unable to open link'));
    }
  };

  return (
    <>
      {/* Networks List Modal */}
      <Modal
        visible={!showNetworkSettings && !showServerSettings}
        animationType="slide"
        onRequestClose={onClose}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>{t('Close')}</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{t('Networks')}</Text>
            <TouchableOpacity
              onPress={handleAddNetwork}
              style={styles.addButton}
            >
              <Text style={styles.addText}>{t('+')}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.topActions}>
            <TouchableOpacity
              style={styles.topActionButton}
              onPress={() => setShowConnectionProfiles(true)}
            >
              <Text style={styles.topActionText}>{t('Identity Profiles')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.topActionButton}
              onPress={() => setShowIrcDatabaseModal(true)}
            >
              <Text style={styles.topActionText}>
                {t('Reload from IRC Database')}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.apiInfoBanner}>
            <Text style={styles.apiInfoTitle}>{t('Choose Network')}</Text>
            <Text style={styles.apiInfoText}>
              {t(
                'You can add your own networks here, or reload the approved network list from the IRC Database API. Existing networks are kept; missing servers are added.',
              )}
            </Text>
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator
                size="large"
                color={colors.primary || '#2196F3'}
              />
              <Text style={styles.loadingText}>
                {t('Loading...', {
                  _tags:
                    'screen:networks-list,file:NetworksListScreen.tsx,feature:networks',
                })}
              </Text>
            </View>
          ) : (
            <FlatList
              data={networks}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <View style={styles.networkItem}>
                  <TouchableOpacity
                    style={styles.networkHeader}
                    onPress={() => handleConnect(item)}
                  >
                    <View style={styles.networkInfo}>
                      <Text style={styles.networkName}>{item.name}</Text>
                      <Text style={styles.networkDetails}>
                        {item.nick} • {item.servers?.length || 0}{' '}
                        {(item.servers?.length || 0) !== 1
                          ? t('servers')
                          : t('server')}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleEditNetwork(item)}
                      style={styles.editButton}
                    >
                      <Text style={styles.editText}>{t('Edit')}</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>

                  <View style={styles.serversList}>
                    {item.servers &&
                      item.servers.map(server => (
                        <TouchableOpacity
                          key={server.id}
                          style={styles.serverItem}
                          onPress={() => handleConnect(item, server.id)}
                        >
                          <View style={styles.serverInfo}>
                            <Text style={styles.serverName}>
                              {server.favorite ? '★ ' : ''}
                              {server.name || server.hostname}
                            </Text>
                            <Text style={styles.serverDetails}>
                              {server.hostname}:{server.port}{' '}
                              {server.ssl ? t('(SSL)') : ''}
                            </Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => handleDeleteServer(item, server)}
                            style={[
                              styles.serverDeleteButton,
                              item.servers.length <= 1 &&
                                styles.serverDeleteButtonDisabled,
                            ]}
                            disabled={item.servers.length <= 1}
                          >
                            <Text style={styles.deleteText}>{t('Delete')}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleEditServer(item.id, server.id)}
                            style={styles.serverEditButton}
                          >
                            <Text style={styles.editText}>{t('Edit')}</Text>
                          </TouchableOpacity>
                        </TouchableOpacity>
                      ))}
                    <TouchableOpacity
                      style={styles.addServerButton}
                      onPress={() => handleAddServer(item.id)}
                    >
                      <Text style={styles.addServerText}>
                        {t('+ Add Server')}
                      </Text>
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

      <Modal
        visible={showIrcDatabaseModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() =>
          !isImportingFromIrcDatabase && setShowIrcDatabaseModal(false)
        }
      >
        <View style={styles.ircDatabaseOverlay}>
          <View style={styles.ircDatabaseCard}>
            <ScrollView
              style={styles.ircDatabaseScroll}
              contentContainerStyle={styles.ircDatabaseScrollContent}
            >
              <Text style={styles.ircDatabaseTitle}>
                {t('Reload Networks from IRC Database')}
              </Text>
              <Text style={styles.ircDatabaseBody}>
                {t(
                  'IRC Database contains networks that explicitly opted in to be publicly discoverable in IRC clients.',
                )}
              </Text>
              <Text style={styles.ircDatabaseBody}>
                {t(
                  'Reload means update: matching networks are skipped, and only missing servers are added to existing networks.',
                )}
              </Text>
              <Text style={styles.ircDatabaseBody}>
                {t(
                  'AndroidIRCX reloads approved presets from IRC Database. Imported entries are added to your local Networks list. Your default DBase setup remains unchanged.',
                )}
              </Text>

              <View style={styles.ircDatabaseFooter}>
                <Text style={styles.ircDatabaseFooterTitle}>
                  {t(
                    'If your network is not listed and you want inclusion in AndroidIRCX:',
                  )}
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    openExternalUrl('https://irc.dbase.in.rs/register')
                  }
                >
                  <Text style={styles.ircDatabaseFooterLine}>
                    https://irc.dbase.in.rs/register
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() =>
                    openExternalUrl(
                      'https://irc.dbase.in.rs/irc/submit-network',
                    )
                  }
                >
                  <Text style={styles.ircDatabaseFooterLine}>
                    https://irc.dbase.in.rs/irc/submit-network
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() =>
                    openExternalUrl('https://irc.dbase.in.rs/irc/submit-server')
                  }
                >
                  <Text style={styles.ircDatabaseFooterLine}>
                    https://irc.dbase.in.rs/irc/submit-server
                  </Text>
                </TouchableOpacity>
                <Text style={styles.ircDatabaseFooterText}>
                  {t('By submitting your network, you accept:')}
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    openExternalUrl('https://irc.dbase.in.rs/privacy-policy')
                  }
                >
                  <Text style={styles.ircDatabaseFooterLine}>
                    https://irc.dbase.in.rs/privacy-policy
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() =>
                    openExternalUrl('https://irc.dbase.in.rs/terms-of-service')
                  }
                >
                  <Text style={styles.ircDatabaseFooterLine}>
                    https://irc.dbase.in.rs/terms-of-service
                  </Text>
                </TouchableOpacity>
                <Text style={styles.ircDatabaseFooterText}>
                  {t(
                    'Submission means your network permits IRCDBase bot discovery actions such as /list, /lusers, and joining the most active channel.',
                  )}
                </Text>
                <Text style={styles.ircDatabaseFooterText}>
                  {t(
                    'Nickname collection via /names is optional and can be disabled in your IRC Database network settings.',
                  )}
                </Text>
              </View>
            </ScrollView>

            <View style={styles.ircDatabaseActions}>
              <TouchableOpacity
                style={[
                  styles.ircDatabaseButton,
                  styles.ircDatabaseSecondaryButton,
                ]}
                onPress={() => setShowIrcDatabaseModal(false)}
                disabled={isImportingFromIrcDatabase}
              >
                <Text style={styles.ircDatabaseSecondaryButtonText}>
                  {t('Cancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.ircDatabaseButton,
                  styles.ircDatabasePrimaryButton,
                  isImportingFromIrcDatabase &&
                    styles.ircDatabaseButtonDisabled,
                ]}
                onPress={handleImportFromIrcDatabase}
                disabled={isImportingFromIrcDatabase}
              >
                {isImportingFromIrcDatabase ? (
                  <ActivityIndicator
                    size="small"
                    color={colors.onPrimary || '#FFFFFF'}
                  />
                ) : (
                  <Text style={styles.ircDatabasePrimaryButtonText}>
                    {t('Update from IRC Database')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const createStyles = (colors: any) =>
  StyleSheet.create({
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
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 8,
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
    apiInfoBanner: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.surface || '#F7F7F7',
      borderBottomWidth: 1,
      borderBottomColor: colors.border || '#E0E0E0',
    },
    apiInfoTitle: {
      color: colors.text || '#212121',
      fontSize: 14,
      fontWeight: '700',
      marginBottom: 4,
    },
    apiInfoText: {
      color: colors.textSecondary || '#757575',
      fontSize: 13,
      lineHeight: 18,
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
    ircDatabaseOverlay: {
      flex: 1,
      backgroundColor: colors.modalOverlay,
      padding: 16,
      justifyContent: 'center',
    },
    ircDatabaseCard: {
      backgroundColor: colors.background || '#FFFFFF',
      borderRadius: 12,
      padding: 16,
      maxHeight: '90%',
    },
    ircDatabaseScroll: {
      maxHeight: 420,
    },
    ircDatabaseScrollContent: {
      paddingBottom: 4,
    },
    ircDatabaseTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text || '#212121',
      marginBottom: 12,
    },
    ircDatabaseBody: {
      color: colors.text || '#212121',
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 8,
    },
    ircDatabaseFooter: {
      marginTop: 8,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border || '#E0E0E0',
    },
    ircDatabaseFooterTitle: {
      color: colors.text || '#212121',
      fontSize: 13,
      fontWeight: '600',
      marginBottom: 6,
    },
    ircDatabaseFooterLine: {
      color: colors.primary || '#2196F3',
      fontSize: 12,
      marginBottom: 2,
    },
    ircDatabaseFooterText: {
      color: colors.textSecondary || '#757575',
      fontSize: 12,
      lineHeight: 18,
      marginTop: 6,
    },
    ircDatabaseActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 8,
      marginTop: 14,
    },
    ircDatabaseButton: {
      borderRadius: 8,
      paddingVertical: 10,
      paddingHorizontal: 12,
      minWidth: 120,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ircDatabasePrimaryButton: {
      backgroundColor: colors.primary || '#2196F3',
    },
    ircDatabaseSecondaryButton: {
      borderWidth: 1,
      borderColor: colors.border || '#E0E0E0',
      backgroundColor: colors.surface || '#F5F5F5',
    },
    ircDatabasePrimaryButtonText: {
      color: colors.onPrimary || '#FFFFFF',
      fontSize: 13,
      fontWeight: '600',
    },
    ircDatabaseSecondaryButtonText: {
      color: colors.text || '#212121',
      fontSize: 13,
      fontWeight: '600',
    },
    ircDatabaseButtonDisabled: {
      opacity: 0.7,
    },
  });

/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Modal,
  Alert,
  ScrollView,
  TextInput,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { settingsService, IRCNetworkConfig, IRCServerConfig } from '../services/SettingsService';
import { identityProfilesService, IdentityProfile } from '../services/IdentityProfilesService';
import { NetworkSettingsScreen } from './NetworkSettingsScreen';
import { ServerSettingsScreen } from './ServerSettingsScreen';
import { useT } from '../i18n/transifex';
import { Picker } from '@react-native-picker/picker';

interface ConnectionProfilesScreenProps {
  visible: boolean;
  onClose: () => void;
}

export const ConnectionProfilesScreen: React.FC<ConnectionProfilesScreenProps> = ({
  visible,
  onClose,
}) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const t = useT();
  const tags = 'screen:connection-profiles,file:ConnectionProfilesScreen.tsx,feature:connection-profiles';
  const [networks, setNetworks] = useState<IRCNetworkConfig[]>([]);
  const [identityProfiles, setIdentityProfiles] = useState<IdentityProfile[]>([]);
  const [expandedNetworkId, setExpandedNetworkId] = useState<string | null>(null);
  const [editingNetworkId, setEditingNetworkId] = useState<string | null>(null);
  const [showNetworkEditor, setShowNetworkEditor] = useState(false);
  const [editingServerId, setEditingServerId] = useState<string | null>(null);
  const [editingServerNetworkId, setEditingServerNetworkId] = useState<string | null>(null);
  const [showServerEditor, setShowServerEditor] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [selectedNetworkForIdentity, setSelectedNetworkForIdentity] = useState<string | null>(null);
  const [editProfileName, setEditProfileName] = useState('');
  const [editProfileNick, setEditProfileNick] = useState('');
  const [editProfileAltNick, setEditProfileAltNick] = useState('');
  const [editProfileRealname, setEditProfileRealname] = useState('');
  const [editProfileIdent, setEditProfileIdent] = useState('');
  const [editProfileSaslAccount, setEditProfileSaslAccount] = useState('');
  const [editProfileSaslPassword, setEditProfileSaslPassword] = useState('');
  const [editProfileSaslMechanism, setEditProfileSaslMechanism] = useState<'PLAIN' | 'SCRAM-SHA-256' | 'SCRAM-SHA-256-PLUS'>('PLAIN');
  const [editProfileNickservPassword, setEditProfileNickservPassword] = useState('');
  const [editProfileOperUser, setEditProfileOperUser] = useState('');
  const [editProfileOperPassword, setEditProfileOperPassword] = useState('');
  const [editProfileOnConnectCommands, setEditProfileOnConnectCommands] = useState('');
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);

  useEffect(() => {
    if (visible) {
      loadData();
    }
  }, [visible]);

  const loadData = async () => {
    try {
      const [loadedNetworks, loadedProfiles] = await Promise.all([
        settingsService.getAllNetworks(),
        identityProfilesService.list(),
      ]);
      setNetworks(loadedNetworks);
      setIdentityProfiles(loadedProfiles);
    } catch (error) {
      console.error('Failed to load data:', error);
      Alert.alert(
        t('Error', { _tags: tags }),
        t('Failed to load networks and profiles', { _tags: tags })
      );
    }
  };

  const handleConnectionTypeChange = async (networkId: string, connectionType: 'irc' | 'znc' | 'bnc') => {
    try {
      await settingsService.updateNetworkProfile(networkId, connectionType, undefined);
      await loadData();
    } catch (error) {
      console.error('Failed to update connection type:', error);
      Alert.alert(
        t('Error', { _tags: tags }),
        t('Failed to update connection type', { _tags: tags })
      );
    }
  };

  const handleIdentityProfileChange = async (networkId: string, identityProfileId: string) => {
    try {
      await settingsService.updateNetworkProfile(networkId, undefined, identityProfileId);
      await loadData();
    } catch (error) {
      console.error('Failed to update identity profile:', error);
      Alert.alert(
        t('Error', { _tags: tags }),
        t('Failed to update identity profile', { _tags: tags })
      );
    }
  };

  const handleNetworkSave = async (updatedNetwork: IRCNetworkConfig) => {
    try {
      if (editingNetworkId) {
        const partialUpdate: Partial<IRCNetworkConfig> = {
          name: updatedNetwork.name,
          nick: updatedNetwork.nick,
          altNick: updatedNetwork.altNick,
          realname: updatedNetwork.realname,
          ident: updatedNetwork.ident,
          autoJoinChannels: updatedNetwork.autoJoinChannels,
          sasl: updatedNetwork.sasl,
          proxy: updatedNetwork.proxy,
          clientCert: updatedNetwork.clientCert,
          clientKey: updatedNetwork.clientKey,
        };
        await settingsService.updateNetwork(editingNetworkId, partialUpdate);
      } else {
        await settingsService.addNetwork(updatedNetwork);
      }
      await loadData();
    } catch (error) {
      console.error('Failed to save network changes:', error);
      Alert.alert(
        t('Error', { _tags: tags }),
        t('Failed to save network changes', { _tags: tags })
      );
    } finally {
      setShowNetworkEditor(false);
      setEditingNetworkId(null);
    }
  };

  const handleServerSave = async (updatedServer: IRCServerConfig) => {
    if (!editingServerNetworkId) return;
    try {
      if (editingServerId) {
        await settingsService.updateServerInNetwork(
          editingServerNetworkId,
          updatedServer.id,
          updatedServer,
        );
      } else {
        await settingsService.addServerToNetwork(editingServerNetworkId, updatedServer);
      }
      await loadData();
    } catch (error) {
      console.error('Failed to save server changes:', error);
      Alert.alert(
        t('Error', { _tags: tags }),
        t('Failed to save server changes', { _tags: tags })
      );
    } finally {
      setShowServerEditor(false);
      setEditingServerId(null);
      setEditingServerNetworkId(null);
    }
  };

  const handleDeleteNetwork = (network: IRCNetworkConfig) => {
    Alert.alert(
      t('Delete Network', { _tags: tags }),
      t('Are you sure you want to delete "{networkName}"? This cannot be undone.', { networkName: network.name, _tags: tags }),
      [
        { text: t('Cancel', { _tags: tags }), style: 'cancel' },
        {
          text: t('Delete', { _tags: tags }),
          style: 'destructive',
          onPress: async () => {
            try {
              await settingsService.deleteNetwork(network.id);
              setExpandedNetworkId(prev => (prev === network.id ? null : prev));
              await loadData();
            } catch (error) {
              console.error('Failed to delete network:', error);
              Alert.alert(
                t('Error', { _tags: tags }),
                t('Failed to delete network', { _tags: tags })
              );
            }
          },
        },
      ]
    );
  };

  const handleDeleteServer = (network: IRCNetworkConfig, server: IRCServerConfig) => {
    if (network.servers.length <= 1) {
      Alert.alert(
        t('Cannot Delete Server', { _tags: tags }),
        t('Each network must have at least one server.', { _tags: tags })
      );
      return;
    }
    const serverLabel = server.name || server.hostname;
    Alert.alert(
      t('Delete Server', { _tags: tags }),
      t('Are you sure you want to delete "{serverName}"?', { serverName: serverLabel, _tags: tags }),
      [
        { text: t('Cancel', { _tags: tags }), style: 'cancel' },
        {
          text: t('Delete', { _tags: tags }),
          style: 'destructive',
          onPress: async () => {
            try {
              await settingsService.deleteServerFromNetwork(network.id, server.id);
              await loadData();
            } catch (error) {
              console.error('Failed to delete server:', error);
              Alert.alert(
                t('Error', { _tags: tags }),
                t('Failed to delete server', { _tags: tags })
              );
            }
          },
        },
      ]
    );
  };

  const openIdentityProfileModal = (profile?: IdentityProfile, networkId?: string) => {
    setEditingProfileId(profile?.id || null);
    setSelectedNetworkForIdentity(networkId || null);
    setEditProfileName(profile?.name || '');
    setEditProfileNick(profile?.nick || '');
    setEditProfileAltNick(profile?.altNick || '');
    setEditProfileRealname(profile?.realname || '');
    setEditProfileIdent(profile?.ident || '');
    setEditProfileSaslAccount(profile?.saslAccount || '');
    setEditProfileSaslPassword(profile?.saslPassword || '');
    setEditProfileSaslMechanism(profile?.saslMechanism || 'PLAIN');
    setEditProfileNickservPassword(profile?.nickservPassword || '');
    setEditProfileOperUser(profile?.operUser || '');
    setEditProfileOperPassword(profile?.operPassword || '');
    setEditProfileOnConnectCommands((profile?.onConnectCommands || []).join('\n'));
    setShowEditProfileModal(true);
  };

  const toggleNetworkExpanded = (networkId: string) => {
    setExpandedNetworkId(expandedNetworkId === networkId ? null : networkId);
  };

  const renderNetworkItem = ({ item }: { item: IRCNetworkConfig }) => {
    const isExpanded = expandedNetworkId === item.id;
    const currentIdentityProfile = identityProfiles.find(p => p.id === item.identityProfileId);
    const connectionTypes: Array<'irc' | 'znc' | 'bnc'> = ['irc', 'znc', 'bnc'];

    return (
      <View style={styles.networkCard}>
        <TouchableOpacity
          style={styles.networkHeader}
          onPress={() => toggleNetworkExpanded(item.id)}>
            <View style={styles.networkHeaderContent}>
            <Text style={styles.networkName}>{item.name}</Text>
            <Text style={styles.networkServers}>
              {item.servers.length}{' '}
              {item.servers.length === 1
                ? t('server', { _tags: tags })
                : t('servers', { _tags: tags })}
            </Text>
          </View>
          <Text style={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</Text>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.networkDetails}>
            <TouchableOpacity
              style={[styles.editButton, { backgroundColor: colors.primary }]}
              onPress={() => {
                setEditingNetworkId(item.id);
                setShowNetworkEditor(true);
              }}>
              <Text style={[styles.editButtonText, { color: colors.onPrimary }]}>
                {t('Edit Network Settings', { _tags: tags })}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.deleteButton, { backgroundColor: colors.error }]}
              onPress={() => handleDeleteNetwork(item)}>
              <Text style={[styles.deleteButtonText, { color: colors.onPrimary }]}>
                {t('Delete Network', { _tags: tags })}
              </Text>
            </TouchableOpacity>

            <View style={styles.pickerSection}>
              <Text style={styles.pickerLabel}>{t('Connection Type', { _tags: tags })}</Text>
              <View style={styles.buttonGroup}>
                {connectionTypes.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.optionButton,
                      (item.connectionType || 'irc') === type && styles.optionButtonActive,
                      { borderColor: colors.border, backgroundColor: (item.connectionType || 'irc') === type ? colors.primary : colors.surface }
                    ]}
                    onPress={() => handleConnectionTypeChange(item.id, type)}>
                    <Text style={[
                      styles.optionButtonText,
                      { color: (item.connectionType || 'irc') === type ? colors.onPrimary : colors.text }
                    ]}>
                      {type.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.pickerSection}>
              <Text style={styles.pickerLabel}>{t('Identity Profile', { _tags: tags })}</Text>
              <View style={styles.identityHeaderRow}>
                <TouchableOpacity
                  style={[styles.addProfileButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => openIdentityProfileModal(undefined, item.id)}>
                <Text style={[styles.addProfileButtonText, { color: colors.text }]}>
                  {t('+ Add / Edit Identity', { _tags: tags })}
                </Text>
                </TouchableOpacity>
              </View>
              <ScrollView
                style={styles.profileList}
                horizontal={false}
                nestedScrollEnabled
                showsVerticalScrollIndicator={true}>
                {identityProfiles.map((profile) => (
                  <View
                    key={profile.id}
                    style={[
                      styles.profileButton,
                      item.identityProfileId === profile.id && styles.profileButtonActive,
                      { borderColor: colors.border, backgroundColor: item.identityProfileId === profile.id ? colors.primary : colors.surface }
                    ]}>
                    <TouchableOpacity
                      style={{ flex: 1 }}
                      onPress={() => handleIdentityProfileChange(item.id, profile.id)}>
                      <Text style={[
                        styles.profileButtonText,
                        { color: item.identityProfileId === profile.id ? colors.onPrimary : colors.text }
                      ]}>
                        {profile.name}
                      </Text>
                    </TouchableOpacity>
                    {item.identityProfileId === profile.id && (
                      <Text style={[styles.checkMark, { color: colors.onPrimary }]}>✓</Text>
                    )}
                    <TouchableOpacity
                      style={[styles.editProfileIconButton, { backgroundColor: colors.primary }]}
                      onPress={() => openIdentityProfileModal(profile, item.id)}>
                      <Text style={[styles.editProfileIconButtonText, { color: colors.onPrimary }]}>
                        {t('Edit', { _tags: tags })}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>

            <View style={styles.serversSection}>
              <Text style={styles.serversSectionTitle}>{t('Servers', { _tags: tags })}</Text>
              <TouchableOpacity
                style={[styles.addServerButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => {
                  setEditingServerId(null);
                  setEditingServerNetworkId(item.id);
                  setShowServerEditor(true);
                }}>
                <Text style={[styles.addServerButtonText, { color: colors.text }]}>
                  {t('+ Add Server', { _tags: tags })}
                </Text>
              </TouchableOpacity>
              {item.servers.map((server, index) => (
                <View key={server.id} style={styles.serverItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.serverName}>
                      {server.name || server.hostname}
                    </Text>
                    <Text style={styles.serverDetails}>
                      {server.hostname}:{server.port} {server.ssl ? '(SSL)' : ''}
                    </Text>
                  </View>
                  {server.favorite && (
                    <Text style={styles.favoriteIndicator}>★</Text>
                  )}
                  <TouchableOpacity
                    style={[
                      styles.deleteServerButton,
                      { backgroundColor: colors.error },
                      item.servers.length <= 1 && styles.deleteServerButtonDisabled,
                    ]}
                    onPress={() => handleDeleteServer(item, server)}
                    disabled={item.servers.length <= 1}>
                    <Text style={[styles.deleteServerButtonText, { color: colors.onPrimary }]}>
                      {t('Delete', { _tags: tags })}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.editServerButton, { backgroundColor: colors.primary }]}
                    onPress={() => {
                      setEditingServerId(server.id);
                      setEditingServerNetworkId(item.id);
                      setShowServerEditor(true);
                    }}>
                    <Text style={[styles.editServerButtonText, { color: colors.onPrimary }]}>
                      {t('Edit', { _tags: tags })}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            <View style={styles.infoSection}>
              <Text style={styles.infoLabel}>
                {t('Nick: {nick}', { nick: item.nick, _tags: tags })}
              </Text>
              {item.altNick && (
                <Text style={styles.infoLabel}>
                  {t('Alt Nick: {altNick}', { altNick: item.altNick, _tags: tags })}
                </Text>
              )}
              <Text style={styles.infoLabel}>
                {t('Real Name: {name}', { name: item.realname, _tags: tags })}
              </Text>
              {currentIdentityProfile && (
                <Text style={styles.infoLabel}>
                  {t('Current Profile: {name}', { name: currentIdentityProfile.name, _tags: tags })}
                </Text>
              )}
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.primary }]}>
          <TouchableOpacity onPress={onClose} style={styles.cancelButton}>
            <Text style={[styles.cancelText, { color: colors.onPrimary }]}>
              {t('Close', { _tags: tags })}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.onPrimary }]}>
            {t('Connection Profiles', { _tags: tags })}
          </Text>
          <TouchableOpacity
            onPress={() => {
              setEditingNetworkId(null);
              setShowNetworkEditor(true);
            }}
            style={styles.addButton}
          >
            <Text style={[styles.addButtonText, { color: colors.onPrimary }]}>
              {t('Add', { _tags: tags })}
            </Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={networks}
          renderItem={renderNetworkItem}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          nestedScrollEnabled
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {t('No networks configured yet. Add a network to get started!', { _tags: tags })}
              </Text>
            </View>
          }
        />

        {showNetworkEditor && (
          <NetworkSettingsScreen
            networkId={editingNetworkId || undefined}
            onSave={handleNetworkSave}
            onCancel={() => {
              setShowNetworkEditor(false);
              setEditingNetworkId(null);
            }}
          />
        )}

        {editingServerNetworkId && showServerEditor && (
          <ServerSettingsScreen
            networkId={editingServerNetworkId}
            serverId={editingServerId || undefined}
            onSave={handleServerSave}
            onCancel={() => {
              setShowServerEditor(false);
              setEditingServerId(null);
              setEditingServerNetworkId(null);
            }}
          />
        )}

        <Modal
          visible={showEditProfileModal}
          transparent
          animationType="slide"
          onRequestClose={() => {
            setShowEditProfileModal(false);
            setEditingProfileId(null);
            setSelectedNetworkForIdentity(null);
          }}>
          <View style={styles.modalOverlay}>
            <View style={[styles.editProfileModal, { backgroundColor: colors.background }]}>
              <ScrollView>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {t('Edit Identity Profile', { _tags: tags })}
                </Text>

                <Text style={[styles.inputLabel, { color: colors.text }]}>
                  {t('Profile Name', { _tags: tags })}
                </Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                  value={editProfileName}
                  onChangeText={setEditProfileName}
                  placeholder={t('Profile Name', { _tags: tags })}
                  placeholderTextColor={colors.textSecondary}
                />

                <Text style={[styles.inputLabel, { color: colors.text }]}>
                  {t('Nick', { _tags: tags })}
                </Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                  value={editProfileNick}
                  onChangeText={setEditProfileNick}
                  placeholder={t('Nick', { _tags: tags })}
                  placeholderTextColor={colors.textSecondary}
                />

                <Text style={[styles.inputLabel, { color: colors.text }]}>
                  {t('Alt Nick', { _tags: tags })}
                </Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                  value={editProfileAltNick}
                  onChangeText={setEditProfileAltNick}
                  placeholder={t('Alt Nick', { _tags: tags })}
                  placeholderTextColor={colors.textSecondary}
                />

                <Text style={[styles.inputLabel, { color: colors.text }]}>
                  {t('Real Name', { _tags: tags })}
                </Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                  value={editProfileRealname}
                  onChangeText={setEditProfileRealname}
                  placeholder={t('Real Name', { _tags: tags })}
                  placeholderTextColor={colors.textSecondary}
                />

                <Text style={[styles.inputLabel, { color: colors.text }]}>
                  {t('Ident/Username', { _tags: tags })}
                </Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                  value={editProfileIdent}
                  onChangeText={setEditProfileIdent}
                  placeholder={t('Ident/Username', { _tags: tags })}
                  placeholderTextColor={colors.textSecondary}
                />

                <Text style={[styles.inputLabel, { color: colors.text }]}>
                  {t('SASL Mechanism', { _tags: tags })}
                </Text>
                <View style={[styles.pickerContainer, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                  <Picker
                    selectedValue={editProfileSaslMechanism}
                    onValueChange={(value) => setEditProfileSaslMechanism(value)}
                    style={{ color: colors.text }}
                  >
                    <Picker.Item label={t('PLAIN', { _tags: tags })} value="PLAIN" />
                    <Picker.Item label={t('SCRAM-SHA-256', { _tags: tags })} value="SCRAM-SHA-256" />
                    <Picker.Item label={t('SCRAM-SHA-256-PLUS (coming soon)', { _tags: tags })} value="SCRAM-SHA-256-PLUS" />
                  </Picker>
                </View>

                <Text style={[styles.inputLabel, { color: colors.text }]}>
                  {t('SASL Account', { _tags: tags })}
                </Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                  value={editProfileSaslAccount}
                  onChangeText={setEditProfileSaslAccount}
                  placeholder={t('SASL Account', { _tags: tags })}
                  placeholderTextColor={colors.textSecondary}
                />

                <Text style={[styles.inputLabel, { color: colors.text }]}>
                  {t('SASL Password', { _tags: tags })}
                </Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                  value={editProfileSaslPassword}
                  onChangeText={setEditProfileSaslPassword}
                  placeholder={t('SASL Password', { _tags: tags })}
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry
                />

                <Text style={[styles.inputLabel, { color: colors.text }]}>
                  {t('NickServ Password', { _tags: tags })}
                </Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                  value={editProfileNickservPassword}
                  onChangeText={setEditProfileNickservPassword}
                  placeholder={t('NickServ Password', { _tags: tags })}
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry
                />

                <Text style={[styles.inputLabel, { color: colors.text }]}>
                  {t('Oper Username', { _tags: tags })}
                </Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                  value={editProfileOperUser}
                  onChangeText={setEditProfileOperUser}
                  placeholder={t('Defaults to nick', { _tags: tags })}
                  placeholderTextColor={colors.textSecondary}
                />

                <Text style={[styles.inputLabel, { color: colors.text }]}>
                  {t('Oper Password', { _tags: tags })}
                </Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                  value={editProfileOperPassword}
                  onChangeText={setEditProfileOperPassword}
                  placeholder={t('Oper Password', { _tags: tags })}
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry
                />

                <Text style={[styles.inputLabel, { color: colors.text }]}>
                  {t('On-Connect Commands (one per line, runs after MOTD)', { _tags: tags })}
                </Text>
                <TextInput
                  style={[styles.modalInputMultiline, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                  value={editProfileOnConnectCommands}
                  onChangeText={setEditProfileOnConnectCommands}
                  placeholder={t('Example on-connect commands', { _tags: tags })}
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  numberOfLines={4}
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, { backgroundColor: colors.buttonSecondary }]}
                    onPress={() => {
                      setShowEditProfileModal(false);
                      setEditingProfileId(null);
                      setSelectedNetworkForIdentity(null);
                    }}>
                    <Text style={[styles.modalButtonText, { color: colors.buttonSecondaryText }]}>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, { backgroundColor: colors.buttonPrimary }]}
                    onPress={async () => {
                      if (!editProfileName.trim() || !editProfileNick.trim()) {
                        Alert.alert(
                          t('Error', { _tags: tags }),
                          t('Profile name and nick are required', { _tags: tags })
                        );
                        return;
                      }

                      const payload = {
                        name: editProfileName.trim(),
                        nick: editProfileNick.trim(),
                        altNick: editProfileAltNick.trim() || undefined,
                        realname: editProfileRealname.trim() || undefined,
                        ident: editProfileIdent.trim() || undefined,
                        saslAccount: editProfileSaslAccount.trim() || undefined,
                        saslPassword: editProfileSaslPassword || undefined,
                        saslMechanism: editProfileSaslMechanism,
                        nickservPassword: editProfileNickservPassword || undefined,
                        operUser: editProfileOperUser.trim() || undefined,
                        operPassword: editProfileOperPassword || undefined,
                        onConnectCommands: editProfileOnConnectCommands
                          .split(String.fromCharCode(10))
                          .map(cmd => cmd.trim())
                          .filter(cmd => cmd.length > 0),
                      };

                      try {
                        let savedProfile: IdentityProfile | null = null;
                        if (editingProfileId) {
                          await identityProfilesService.update(editingProfileId, payload);
                          const profiles = await identityProfilesService.list();
                          setIdentityProfiles(profiles);
                          savedProfile = profiles.find(p => p.id === editingProfileId) || null;
                        } else {
                          savedProfile = await identityProfilesService.add(payload);
                          const profiles = await identityProfilesService.list();
                          setIdentityProfiles(profiles);
                        }

                        if (savedProfile && selectedNetworkForIdentity) {
                          await handleIdentityProfileChange(selectedNetworkForIdentity, savedProfile.id);
                        }
                      } catch (error) {
                        console.error('Failed to save identity profile:', error);
                        Alert.alert(
                          t('Error', { _tags: tags }),
                          t('Failed to save identity profile', { _tags: tags })
                        );
                      } finally {
                        setShowEditProfileModal(false);
                        setEditingProfileId(null);
                        setSelectedNetworkForIdentity(null);
                      }
                    }}>
                    <Text style={[styles.modalButtonText, { color: colors.buttonPrimaryText }]}>
                      Save
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  cancelButton: {
    padding: 8,
  },
  cancelText: {
    fontSize: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 60,
  },
  addButton: {
    padding: 8,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 12,
  },
  networkCard: {
    marginBottom: 12,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  networkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.surface,
  },
  networkHeaderContent: {
    flex: 1,
  },
  networkName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  networkServers: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  expandIcon: {
    fontSize: 16,
    color: colors.textSecondary,
    marginLeft: 12,
  },
  networkDetails: {
    padding: 16,
    paddingTop: 0,
    backgroundColor: colors.background,
  },
  pickerSection: {
    marginBottom: 16,
  },
  pickerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  optionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
  },
  optionButtonActive: {
    borderWidth: 2,
  },
  optionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  profileList: {
    maxHeight: 200,
  },
  identityHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  addProfileButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  addProfileButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  profileButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 8,
  },
  profileButtonActive: {
    borderWidth: 2,
  },
  profileButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  checkMark: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  serversSection: {
    marginBottom: 16,
  },
  serversSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  serverItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: colors.surface,
    borderRadius: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  serverName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  serverDetails: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  favoriteIndicator: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600',
  },
  infoSection: {
    padding: 12,
    backgroundColor: colors.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  editButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  editServerButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    marginLeft: 8,
  },
  editServerButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  deleteServerButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    marginLeft: 8,
  },
  deleteServerButtonDisabled: {
    opacity: 0.5,
  },
  deleteServerButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  editProfileIconButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  editProfileIconButtonText: {
    fontSize: 11,
    fontWeight: '600',
  },
  addServerButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 8,
  },
  addServerButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editProfileModal: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginBottom: 8,
  },
  modalInputMultiline: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginBottom: 8,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 8,
    overflow: 'hidden',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});


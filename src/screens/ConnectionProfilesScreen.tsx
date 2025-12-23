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
      Alert.alert('Error', 'Failed to load networks and profiles');
    }
  };

  const handleConnectionTypeChange = async (networkId: string, connectionType: 'irc' | 'znc' | 'bnc') => {
    try {
      await settingsService.updateNetworkProfile(networkId, connectionType, undefined);
      await loadData();
    } catch (error) {
      console.error('Failed to update connection type:', error);
      Alert.alert('Error', 'Failed to update connection type');
    }
  };

  const handleIdentityProfileChange = async (networkId: string, identityProfileId: string) => {
    try {
      await settingsService.updateNetworkProfile(networkId, undefined, identityProfileId);
      await loadData();
    } catch (error) {
      console.error('Failed to update identity profile:', error);
      Alert.alert('Error', 'Failed to update identity profile');
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
      Alert.alert('Error', 'Failed to save network changes');
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
      Alert.alert('Error', 'Failed to save server changes');
    } finally {
      setShowServerEditor(false);
      setEditingServerId(null);
      setEditingServerNetworkId(null);
    }
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
              {item.servers.length} server{item.servers.length !== 1 ? 's' : ''}
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
                Edit Network Settings
              </Text>
            </TouchableOpacity>

            <View style={styles.pickerSection}>
              <Text style={styles.pickerLabel}>Connection Type</Text>
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
              <Text style={styles.pickerLabel}>Identity Profile</Text>
              <View style={styles.identityHeaderRow}>
                <TouchableOpacity
                  style={[styles.addProfileButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => openIdentityProfileModal(undefined, item.id)}>
                  <Text style={[styles.addProfileButtonText, { color: colors.text }]}>
                    + Add / Edit Identity
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
                        Edit
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>

            <View style={styles.serversSection}>
              <Text style={styles.serversSectionTitle}>Servers</Text>
              <TouchableOpacity
                style={[styles.addServerButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => {
                  setEditingServerId(null);
                  setEditingServerNetworkId(item.id);
                  setShowServerEditor(true);
                }}>
                <Text style={[styles.addServerButtonText, { color: colors.text }]}>+ Add Server</Text>
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
                    style={[styles.editServerButton, { backgroundColor: colors.primary }]}
                    onPress={() => {
                      setEditingServerId(server.id);
                      setEditingServerNetworkId(item.id);
                      setShowServerEditor(true);
                    }}>
                    <Text style={[styles.editServerButtonText, { color: colors.onPrimary }]}>
                      Edit
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            <View style={styles.infoSection}>
              <Text style={styles.infoLabel}>Nick: {item.nick}</Text>
              {item.altNick && <Text style={styles.infoLabel}>Alt Nick: {item.altNick}</Text>}
              <Text style={styles.infoLabel}>Real Name: {item.realname}</Text>
              {currentIdentityProfile && (
                <Text style={styles.infoLabel}>Current Profile: {currentIdentityProfile.name}</Text>
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
            <Text style={[styles.cancelText, { color: colors.onPrimary }]}>Close</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.onPrimary }]}>Connection Profiles</Text>
          <TouchableOpacity
            onPress={() => {
              setEditingNetworkId(null);
              setShowNetworkEditor(true);
            }}
            style={styles.addButton}
          >
            <Text style={[styles.addButtonText, { color: colors.onPrimary }]}>Add</Text>
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
                No networks configured yet. Add a network to get started!
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
                <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Identity Profile</Text>

                <Text style={[styles.inputLabel, { color: colors.text }]}>Profile Name</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                  value={editProfileName}
                  onChangeText={setEditProfileName}
                  placeholder="Profile Name"
                  placeholderTextColor={colors.textSecondary}
                />

                <Text style={[styles.inputLabel, { color: colors.text }]}>Nick</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                  value={editProfileNick}
                  onChangeText={setEditProfileNick}
                  placeholder="Nick"
                  placeholderTextColor={colors.textSecondary}
                />

                <Text style={[styles.inputLabel, { color: colors.text }]}>Alt Nick</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                  value={editProfileAltNick}
                  onChangeText={setEditProfileAltNick}
                  placeholder="Alt Nick"
                  placeholderTextColor={colors.textSecondary}
                />

                <Text style={[styles.inputLabel, { color: colors.text }]}>Real Name</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                  value={editProfileRealname}
                  onChangeText={setEditProfileRealname}
                  placeholder="Real Name"
                  placeholderTextColor={colors.textSecondary}
                />

                <Text style={[styles.inputLabel, { color: colors.text }]}>Ident/Username</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                  value={editProfileIdent}
                  onChangeText={setEditProfileIdent}
                  placeholder="Ident"
                  placeholderTextColor={colors.textSecondary}
                />

                <Text style={[styles.inputLabel, { color: colors.text }]}>SASL Account</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                  value={editProfileSaslAccount}
                  onChangeText={setEditProfileSaslAccount}
                  placeholder="SASL Account"
                  placeholderTextColor={colors.textSecondary}
                />

                <Text style={[styles.inputLabel, { color: colors.text }]}>SASL Password</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                  value={editProfileSaslPassword}
                  onChangeText={setEditProfileSaslPassword}
                  placeholder="SASL Password"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry
                />

                <Text style={[styles.inputLabel, { color: colors.text }]}>NickServ Password</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                  value={editProfileNickservPassword}
                  onChangeText={setEditProfileNickservPassword}
                  placeholder="NickServ Password"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry
                />

                <Text style={[styles.inputLabel, { color: colors.text }]}>Oper Username</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                  value={editProfileOperUser}
                  onChangeText={setEditProfileOperUser}
                  placeholder="Defaults to nick"
                  placeholderTextColor={colors.textSecondary}
                />

                <Text style={[styles.inputLabel, { color: colors.text }]}>Oper Password</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                  value={editProfileOperPassword}
                  onChangeText={setEditProfileOperPassword}
                  placeholder="Oper password"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry
                />

                <Text style={[styles.inputLabel, { color: colors.text }]}>On-Connect Commands (one per line, runs after MOTD)</Text>
                <TextInput
                  style={[styles.modalInputMultiline, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                  value={editProfileOnConnectCommands}
                  onChangeText={setEditProfileOnConnectCommands}
                  placeholder="/mode +x\n/msg NickServ IDENTIFY password"
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
                        Alert.alert('Error', 'Profile name and nick are required');
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
                        nickservPassword: editProfileNickservPassword || undefined,
                        operUser: editProfileOperUser.trim() || undefined,
                        operPassword: editProfileOperPassword || undefined,
                        onConnectCommands: editProfileOnConnectCommands
                          .split('\n')
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
                        Alert.alert('Error', 'Failed to save identity profile');
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


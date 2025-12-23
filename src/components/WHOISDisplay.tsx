import React, { useState, useEffect, useRef } from 'react';
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
import { userManagementService as singletonUserManagementService, WHOISInfo } from '../services/UserManagementService';
import { ircService } from '../services/IRCService';
import { connectionManager } from '../services/ConnectionManager';
import { userActivityService, UserActivity } from '../services/UserActivityService';
import { formatIRCTextAsComponent } from '../utils/IRCFormatter';

interface WHOISDisplayProps {
  visible: boolean;
  nick: string;
  network?: string;
  onClose: () => void;
}

export const WHOISDisplay: React.FC<WHOISDisplayProps> = ({
  visible,
  nick,
  network,
  onClose,
}) => {
  const [whoisInfo, setWhoisInfo] = useState<WHOISInfo | undefined>();
  const [loading, setLoading] = useState(false);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [showAliasInput, setShowAliasInput] = useState(false);
  const [aliasText, setAliasText] = useState('');
  const [userService, setUserService] = useState(singletonUserManagementService);
  const [activity, setActivity] = useState<UserActivity | undefined>();
  const visibleRef = useRef(visible);

  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  useEffect(() => {
    const connection = network
      ? connectionManager.getConnection(network)
      : connectionManager.getActiveConnection();
    const svc = connection?.userManagementService || singletonUserManagementService;
    setUserService(svc);
  }, [network]);

  useEffect(() => {
    if (visible && nick) {
      loadWHOIS();
      loadUserData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, nick, userService]);

  const loadWHOIS = async () => {
    const irc = (network
      ? connectionManager.getConnection(network)?.ircService
      : connectionManager.getActiveConnection()?.ircService) || ircService;
    if (!irc.getConnectionStatus() || !irc.isRegistered()) {
      Alert.alert('WHOIS Error', 'Not connected or not registered yet.');
      return;
    }
    setLoading(true);
    const info = userService.getWHOIS(nick, network);
    if (info && info.realname) { // Check for a basic field to determine if data is "full" enough initially
      setWhoisInfo(info);
      setLoading(false);
    } else {
      // Always request fresh WHOIS data when opened, even if partial data exists
      try {
        const fullInfo = await userService.requestWHOIS(nick, network);
        setWhoisInfo(fullInfo);
      } catch (error) {
        if (!visibleRef.current) return;
        //console.error('WHOIS request failed or timed out:', error);
        const fallbackInfo = userService.getWHOIS(nick, network);
        setWhoisInfo(fallbackInfo);
        if (!fallbackInfo || !fallbackInfo.realname) {
          //Alert.alert('WHOIS Error', error.message || 'Failed to retrieve full WHOIS information.');
        }
      } finally {
        if (visibleRef.current) setLoading(false);
      }
    }
  };

  const loadUserData = () => {
    const note = userService.getUserNote(nick, network);
    const alias = userService.getUserAlias(nick, network);
    const act = userActivityService.getActivity(nick, network);
    setNoteText(note || '');
    setAliasText(alias || '');
    setActivity(act);
  };

  // requestWHOIS function is no longer needed as its logic is now within loadWHOIS and userManagementService.requestWHOIS
  // const requestWHOIS = () => {
  //   setLoading(true);
  //   userManagementService.requestWHOIS(nick, network);
  //   
  //   // Listen for WHOIS updates
  //   const unsubscribe = userManagementService.onWHOISUpdate((info) => {
  //     if (info.nick === nick) {
  //       setWhoisInfo(info);
  //       setLoading(false);
  //       unsubscribe();
  //     }
  //   });
  //
  //   // Timeout after 5 seconds
  //   setTimeout(() => {
  //     setLoading(false);
  //     unsubscribe();
  //   }, 5000);
  // };

  const handleSaveNote = async () => {
    if (noteText.trim()) {
      await userService.addUserNote(nick, noteText.trim(), network);
      Alert.alert('Success', 'Note saved');
      setShowNoteInput(false);
    } else {
      await userService.removeUserNote(nick, network);
      Alert.alert('Success', 'Note removed');
      setShowNoteInput(false);
    }
  };

  const handleSaveAlias = async () => {
    if (aliasText.trim()) {
      await userService.addUserAlias(nick, aliasText.trim(), network);
      Alert.alert('Success', 'Alias saved');
      setShowAliasInput(false);
    } else {
      await userService.removeUserAlias(nick, network);
      Alert.alert('Success', 'Alias removed');
      setShowAliasInput(false);
    }
  };

  const handleIgnore = async () => {
    Alert.alert(
      'Ignore User',
      `Ignore ${nick}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Ignore',
          style: 'destructive',
          onPress: async () => {
            await userService.ignoreUser(nick, undefined, network);
            Alert.alert('Success', `${nick} has been ignored`);
            onClose();
          },
        },
      ]
    );
  };

  const handleUnignore = async () => {
    await userService.unignoreUser(nick, network);
    Alert.alert('Success', `${nick} is no longer ignored`);
  };

  const isIgnored = userService.isUserIgnored(nick, undefined, undefined, network);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>WHOIS: {nick}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {loading && !whoisInfo && (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading WHOIS information...</Text>
            </View>
          )}

          {whoisInfo && (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>User Information</Text>
                {whoisInfo.realname && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Real Name:</Text>
                    <Text style={styles.infoValue}>
                      {formatIRCTextAsComponent(whoisInfo.realname, styles.infoValue)}
                    </Text>
                  </View>
                )}
                {whoisInfo.username && whoisInfo.hostname && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Host:</Text>
                    <Text style={styles.infoValue}>
                      {whoisInfo.username}@{whoisInfo.hostname}
                    </Text>
                  </View>
                )}
                {whoisInfo.account && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Account:</Text>
                    <Text style={styles.infoValue}>{whoisInfo.account}</Text>
                  </View>
                )}
              </View>

              {whoisInfo.server && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Server</Text>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Server:</Text>
                    <Text style={styles.infoValue}>{whoisInfo.server}</Text>
                  </View>
                  {whoisInfo.serverInfo && (
                    <Text style={styles.infoValue}>
                      {formatIRCTextAsComponent(whoisInfo.serverInfo, styles.infoValue)}
                    </Text>
                  )}
                </View>
              )}

              {whoisInfo.away && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Status</Text>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Away:</Text>
                    <Text style={styles.infoValue}>
                      {whoisInfo.awayMessage
                        ? formatIRCTextAsComponent(whoisInfo.awayMessage, styles.infoValue)
                        : 'User is away'
                      }
                    </Text>
                  </View>
                </View>
              )}

              {whoisInfo.idle !== undefined && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Activity</Text>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Idle:</Text>
                    <Text style={styles.infoValue}>
                      {Math.floor(whoisInfo.idle / 60)} minutes
                    </Text>
                  </View>
                  {whoisInfo.signon && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Signed on:</Text>
                      <Text style={styles.infoValue}>
                        {new Date(whoisInfo.signon).toLocaleString()}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {whoisInfo.channels && whoisInfo.channels.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Channels</Text>
                  <Text style={styles.infoValue}>
                    {whoisInfo.channels.join(', ')}
                  </Text>
                </View>
              )}
            </>
          )}

          {!whoisInfo && !loading && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No WHOIS information available</Text>
              <TouchableOpacity style={styles.button} onPress={loadWHOIS}>
                <Text style={styles.buttonText}>Request WHOIS</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* User Notes */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>User Note</Text>
            {!showNoteInput ? (
              <>
                {noteText ? (
                  <Text style={styles.noteText}>{noteText}</Text>
                ) : (
                  <Text style={styles.emptyText}>No note</Text>
                )}
                <TouchableOpacity
                  style={styles.button}
                  onPress={() => setShowNoteInput(true)}>
                  <Text style={styles.buttonText}>
                    {noteText ? 'Edit Note' : 'Add Note'}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TextInput
                  style={styles.input}
                  value={noteText}
                  onChangeText={setNoteText}
                  placeholder="Enter note about this user"
                  multiline
                />
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={[styles.button, styles.buttonSecondary]}
                    onPress={() => {
                      setShowNoteInput(false);
                      loadUserData();
                    }}>
                    <Text style={styles.buttonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.button} onPress={handleSaveNote}>
                    <Text style={styles.buttonText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>

          {/* Activity */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Activity</Text>
            {activity ? (
              <>
                <Text style={styles.listItemText}>
                  {`Last action: ${activity.lastAction}${activity.channel ? ` (${activity.channel})` : ''}`}
                </Text>
                <Text style={styles.listItemText}>
                  {`Last seen: ${new Date(activity.lastSeenAt).toLocaleString()}`}
                </Text>
                {activity.text ? (
                  <Text style={styles.listItemText} numberOfLines={2}>
                    {'Context: '}
                    {formatIRCTextAsComponent(activity.text, styles.listItemText)}
                  </Text>
                ) : null}
              </>
            ) : (
              <Text style={styles.emptyText}>No recent activity tracked</Text>
            )}
          </View>

          {/* User Alias */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>User Alias</Text>
            {!showAliasInput ? (
              <>
                {aliasText ? (
                  <Text style={styles.aliasText}>{aliasText}</Text>
                ) : (
                  <Text style={styles.emptyText}>No alias</Text>
                )}
                <TouchableOpacity
                  style={styles.button}
                  onPress={() => setShowAliasInput(true)}>
                  <Text style={styles.buttonText}>
                    {aliasText ? 'Edit Alias' : 'Add Alias'}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TextInput
                  style={styles.input}
                  value={aliasText}
                  onChangeText={setAliasText}
                  placeholder="Enter alias for this user"
                />
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={[styles.button, styles.buttonSecondary]}
                    onPress={() => {
                      setShowAliasInput(false);
                      loadUserData();
                    }}>
                    <Text style={styles.buttonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.button} onPress={handleSaveAlias}>
                    <Text style={styles.buttonText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>

          {/* Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Actions</Text>
            {isIgnored ? (
              <TouchableOpacity style={styles.button} onPress={handleUnignore}>
                <Text style={styles.buttonText}>Unignore User</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.button, styles.buttonDanger]}
                onPress={handleIgnore}>
                <Text style={[styles.buttonText, styles.buttonTextWhite]}>
                  Ignore User
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.button}
              onPress={() => userService.requestWHOWAS(nick, network)}>
              <Text style={styles.buttonText}>WHOWAS (History)</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
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
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    color: '#757575',
    fontSize: 14,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  infoLabel: {
    fontSize: 14,
    color: '#757575',
    fontWeight: '500',
    marginRight: 8,
    minWidth: 80,
  },
  infoValue: {
    fontSize: 14,
    color: '#212121',
    flex: 1,
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: '#9E9E9E',
    fontSize: 14,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 4,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonSecondary: {
    backgroundColor: '#9E9E9E',
  },
  buttonDanger: {
    backgroundColor: '#F44336',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  buttonTextWhite: {
    color: '#FFFFFF',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 4,
    padding: 12,
    fontSize: 14,
    color: '#212121',
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  noteText: {
    fontSize: 14,
    color: '#212121',
    marginBottom: 8,
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 4,
  },
  aliasText: {
    fontSize: 14,
    color: '#212121',
    marginBottom: 8,
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 4,
    fontStyle: 'italic',
  },
  listItemText: {
    fontSize: 14,
    color: '#212121',
    marginBottom: 6,
  },
});


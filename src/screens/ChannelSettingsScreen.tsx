import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  Modal,
} from 'react-native';
import { channelManagementService, ChannelInfo } from '../services/ChannelManagementService';
import { ircService } from '../services/IRCService';
import { channelEncryptionService } from '../services/ChannelEncryptionService';
import { channelEncryptionSettingsService } from '../services/ChannelEncryptionSettingsService';

interface ChannelSettingsScreenProps {
  channel: string;
  network: string;
  visible: boolean;
  onClose: () => void;
}

export const ChannelSettingsScreen: React.FC<ChannelSettingsScreenProps> = ({
  channel,
  network,
  visible,
  onClose,
}) => {
  const [channelInfo, setChannelInfo] = useState<ChannelInfo | undefined>();
  const [topic, setTopic] = useState('');
  const [key, setKey] = useState('');
  const [limit, setLimit] = useState('');
  const [banMask, setBanMask] = useState('');
  const [exceptionMask, setExceptionMask] = useState('');

  // Encryption settings state
  const [alwaysEncrypt, setAlwaysEncrypt] = useState(false);
  const [hasEncryptionKey, setHasEncryptionKey] = useState(false);

  useEffect(() => {
    if (!visible || !channel || !network) return;

    // Load current channel info
    const info = channelManagementService.getChannelInfo(channel);
    setChannelInfo(info);
    setTopic(info?.topic || '');
    setKey(info?.modes.key || '');
    setLimit(info?.modes.limit?.toString() || '');

    // Load encryption settings
    const loadEncryptionSettings = async () => {
      const alwaysEncryptSetting = await channelEncryptionSettingsService.getAlwaysEncrypt(channel, network);
      const hasKey = await channelEncryptionService.hasChannelKey(channel, network);
      setAlwaysEncrypt(alwaysEncryptSetting);
      setHasEncryptionKey(hasKey);
    };
    loadEncryptionSettings();

    // Request current channel modes
    ircService.sendCommand(`MODE ${channel}`);
    ircService.sendCommand(`TOPIC ${channel}`);

    // Listen for channel info changes
    const unsubscribe = channelManagementService.onChannelInfoChange((ch, info) => {
      if (ch === channel) {
        setChannelInfo(info);
        setTopic(info.topic || '');
        setKey(info.modes.key || '');
        setLimit(info.modes.limit?.toString() || '');
      }
    });

    return () => {
      unsubscribe();
    };
  }, [visible, channel, network]);

  const handleSetTopic = () => {
    if (topic.trim()) {
      channelManagementService.setTopic(channel, topic.trim());
      Alert.alert('Success', 'Topic updated');
    }
  };

  const handleSetKey = () => {
    if (key.trim()) {
      channelManagementService.setKey(channel, key.trim());
      Alert.alert('Success', 'Channel key set');
      setKey('');
    } else {
      channelManagementService.removeKey(channel);
      Alert.alert('Success', 'Channel key removed');
    }
  };

  const handleSetLimit = () => {
    const limitNum = parseInt(limit, 10);
    if (limitNum > 0) {
      channelManagementService.setLimit(channel, limitNum);
      Alert.alert('Success', `Channel limit set to ${limitNum}`);
    } else if (limit === '') {
      channelManagementService.removeLimit(channel);
      Alert.alert('Success', 'Channel limit removed');
    } else {
      Alert.alert('Error', 'Invalid limit value');
    }
  };

  const handleAddBan = () => {
    if (banMask.trim()) {
      channelManagementService.addBan(channel, banMask.trim());
      Alert.alert('Success', 'Ban added');
      setBanMask('');
      // Request updated ban list
      channelManagementService.requestBanList(channel);
    }
  };

  const handleRemoveBan = (mask: string) => {
    channelManagementService.removeBan(channel, mask);
    Alert.alert('Success', 'Ban removed');
    channelManagementService.requestBanList(channel);
  };

  const handleAddException = () => {
    if (exceptionMask.trim()) {
      channelManagementService.addException(channel, exceptionMask.trim());
      Alert.alert('Success', 'Exception added');
      setExceptionMask('');
      channelManagementService.requestExceptionList(channel);
    }
  };

  const handleRemoveException = (mask: string) => {
    channelManagementService.removeException(channel, mask);
    Alert.alert('Success', 'Exception removed');
    channelManagementService.requestExceptionList(channel);
  };

  const toggleMode = (mode: string, param?: string) => {
    const current = channelInfo?.modes;
    let modeString = '';
    
    switch (mode) {
      case 'i':
        modeString = current?.inviteOnly ? '-i' : '+i';
        break;
      case 't':
        modeString = current?.topicProtected ? '-t' : '+t';
        break;
      case 'n':
        modeString = current?.noExternalMessages ? '-n' : '+n';
        break;
      case 'm':
        modeString = current?.moderated ? '-m' : '+m';
        break;
      case 'p':
        modeString = current?.private ? '-p' : '+p';
        break;
      case 's':
        modeString = current?.secret ? '-s' : '+s';
        break;
    }
    
    if (modeString) {
      channelManagementService.setChannelMode(channel, modeString, param);
    }
  };

  // Encryption handlers
  const handleToggleAlwaysEncrypt = async () => {
    try {
      const newValue = !alwaysEncrypt;
      await channelEncryptionSettingsService.setAlwaysEncrypt(channel, network, newValue);
      setAlwaysEncrypt(newValue);

      if (newValue && !hasEncryptionKey) {
        Alert.alert(
          'No Encryption Key',
          'Always-encrypt is now enabled, but no encryption key exists. Generate or request a key to enable encryption.',
          [{ text: 'OK' }]
        );
      } else if (newValue) {
        Alert.alert('Success', `Always-encrypt enabled for ${channel}`);
      } else {
        Alert.alert('Success', `Always-encrypt disabled for ${channel}`);
      }
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to toggle always-encrypt');
    }
  };

  const handleGenerateKey = async () => {
    try {
      ircService.sendCommand(`/chankey generate`);
      // Refresh key status after a short delay
      setTimeout(async () => {
        const hasKey = await channelEncryptionService.hasChannelKey(channel, network);
        setHasEncryptionKey(hasKey);
      }, 500);
      Alert.alert('Success', 'Encryption key generated. You can now share it with other users.');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to generate key');
    }
  };

  const handleRequestKey = () => {
    Alert.prompt(
      'Request Key',
      'Enter the nickname to request the encryption key from:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request',
          onPress: (nick) => {
            if (nick && nick.trim()) {
              ircService.sendCommand(`/chankey request ${nick.trim()}`);
              Alert.alert('Success', `Key request sent to ${nick.trim()}`);
            }
          },
        },
      ],
      'plain-text'
    );
  };

  const handleShareKey = () => {
    Alert.prompt(
      'Share Key',
      'Enter the nickname to share the encryption key with:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Share',
          onPress: (nick) => {
            if (nick && nick.trim()) {
              ircService.sendCommand(`/chankey share ${nick.trim()}`);
              Alert.alert('Success', `Key shared with ${nick.trim()}`);
            }
          },
        },
      ],
      'plain-text'
    );
  };

  const handleRemoveKey = () => {
    Alert.alert(
      'Remove Encryption Key',
      'Are you sure you want to remove the encryption key? You will not be able to decrypt messages until you get the key again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            ircService.sendCommand(`/chankey remove`);
            setTimeout(async () => {
              const hasKey = await channelEncryptionService.hasChannelKey(channel, network);
              setHasEncryptionKey(hasKey);
            }, 500);
            Alert.alert('Success', 'Encryption key removed');
          },
        },
      ]
    );
  };

  if (!visible || !channel) return null;

  const modes = channelInfo?.modes || {};

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Channel Settings</Text>
          <Text style={styles.channelName}>{channel}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {/* Topic Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Topic</Text>
            <TextInput
              style={styles.input}
              value={topic}
              onChangeText={setTopic}
              placeholder="Channel topic"
              multiline
            />
            <TouchableOpacity style={styles.button} onPress={handleSetTopic}>
              <Text style={styles.buttonText}>Set Topic</Text>
            </TouchableOpacity>
            {channelInfo?.topicSetBy && (
              <Text style={styles.metaText}>
                Set by {channelInfo.topicSetBy}
                {channelInfo.topicSetAt && 
                  ` on ${new Date(channelInfo.topicSetAt).toLocaleString()}`}
              </Text>
            )}
          </View>

          {/* Channel Modes */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Channel Modes</Text>
            <Text style={styles.modeString}>
              {channelManagementService.getModeString(channel) || 'No modes set'}
            </Text>
            
            <View style={styles.modeRow}>
              <Text style={styles.modeLabel}>Invite Only (i)</Text>
              <Switch
                value={modes.inviteOnly || false}
                onValueChange={() => toggleMode('i')}
              />
            </View>

            <View style={styles.modeRow}>
              <Text style={styles.modeLabel}>Topic Protected (t)</Text>
              <Switch
                value={modes.topicProtected || false}
                onValueChange={() => toggleMode('t')}
              />
            </View>

            <View style={styles.modeRow}>
              <Text style={styles.modeLabel}>No External Messages (n)</Text>
              <Switch
                value={modes.noExternalMessages || false}
                onValueChange={() => toggleMode('n')}
              />
            </View>

            <View style={styles.modeRow}>
              <Text style={styles.modeLabel}>Moderated (m)</Text>
              <Switch
                value={modes.moderated || false}
                onValueChange={() => toggleMode('m')}
              />
            </View>

            <View style={styles.modeRow}>
              <Text style={styles.modeLabel}>Private (p)</Text>
              <Switch
                value={modes.private || false}
                onValueChange={() => toggleMode('p')}
              />
            </View>

            <View style={styles.modeRow}>
              <Text style={styles.modeLabel}>Secret (s)</Text>
              <Switch
                value={modes.secret || false}
                onValueChange={() => toggleMode('s')}
              />
            </View>
          </View>

          {/* Channel Key */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Channel Key (Password)</Text>
            <TextInput
              style={styles.input}
              value={key}
              onChangeText={setKey}
              placeholder="Channel key (leave empty to remove)"
              secureTextEntry
            />
            <TouchableOpacity style={styles.button} onPress={handleSetKey}>
              <Text style={styles.buttonText}>
                {key.trim() ? 'Set Key' : 'Remove Key'}
              </Text>
            </TouchableOpacity>
            {modes.key && (
              <Text style={styles.metaText}>Key is currently set</Text>
            )}
          </View>

          {/* Encryption Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Encryption Settings</Text>

            <View style={styles.modeRow}>
              <Text style={styles.modeLabel}>Always Encrypt Messages</Text>
              <Switch
                value={alwaysEncrypt}
                onValueChange={handleToggleAlwaysEncrypt}
              />
            </View>

            <View style={styles.statusContainer}>
              {hasEncryptionKey ? (
                <Text style={styles.statusSuccess}>✓ Encryption key exists</Text>
              ) : (
                <Text style={styles.statusWarning}>⚠ No encryption key</Text>
              )}
            </View>

            {!hasEncryptionKey ? (
              <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.button} onPress={handleGenerateKey}>
                  <Text style={styles.buttonText}>Generate Key</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.button} onPress={handleRequestKey}>
                  <Text style={styles.buttonText}>Request Key from...</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.button} onPress={handleShareKey}>
                  <Text style={styles.buttonText}>Share Key with...</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.button, styles.buttonDanger]} onPress={handleRemoveKey}>
                  <Text style={styles.buttonText}>Remove Key</Text>
                </TouchableOpacity>
              </View>
            )}

            <Text style={styles.metaText}>
              {alwaysEncrypt
                ? 'Messages will be encrypted automatically when a key is available.'
                : 'Enable to automatically encrypt all messages to this channel.'}
            </Text>
          </View>

          {/* Channel Limit */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>User Limit</Text>
            <TextInput
              style={styles.input}
              value={limit}
              onChangeText={setLimit}
              placeholder="Maximum users (leave empty to remove)"
              keyboardType="numeric"
            />
            <TouchableOpacity style={styles.button} onPress={handleSetLimit}>
              <Text style={styles.buttonText}>
                {limit.trim() ? 'Set Limit' : 'Remove Limit'}
              </Text>
            </TouchableOpacity>
            {modes.limit && (
              <Text style={styles.metaText}>Current limit: {modes.limit} users</Text>
            )}
          </View>

          {/* Ban List */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ban List</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, styles.inputFlex]}
                value={banMask}
                onChangeText={setBanMask}
                placeholder="Ban mask (e.g., *!*@host.com)"
              />
              <TouchableOpacity style={styles.addButton} onPress={handleAddBan}>
                <Text style={styles.addButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.button}
              onPress={() => channelManagementService.requestBanList(channel)}>
              <Text style={styles.buttonText}>Refresh Ban List</Text>
            </TouchableOpacity>
            {modes.banList && modes.banList.length > 0 ? (
              <View style={styles.listContainer}>
                {modes.banList.map((mask, index) => (
                  <View key={index} style={styles.listItem}>
                    <Text style={styles.listItemText}>{mask}</Text>
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => handleRemoveBan(mask)}>
                      <Text style={styles.removeButtonText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyText}>No bans</Text>
            )}
          </View>

          {/* Exception List */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Exception List</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, styles.inputFlex]}
                value={exceptionMask}
                onChangeText={setExceptionMask}
                placeholder="Exception mask"
              />
              <TouchableOpacity style={styles.addButton} onPress={handleAddException}>
                <Text style={styles.addButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.button}
              onPress={() => channelManagementService.requestExceptionList(channel)}>
              <Text style={styles.buttonText}>Refresh Exception List</Text>
            </TouchableOpacity>
            {modes.exceptionList && modes.exceptionList.length > 0 ? (
              <View style={styles.listContainer}>
                {modes.exceptionList.map((mask, index) => (
                  <View key={index} style={styles.listItem}>
                    <Text style={styles.listItemText}>{mask}</Text>
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => handleRemoveException(mask)}>
                      <Text style={styles.removeButtonText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyText}>No exceptions</Text>
            )}
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
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#F5F5F5',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 4,
  },
  channelName: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 8,
  },
  closeButton: {
    alignSelf: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  closeButtonText: {
    color: '#2196F3',
    fontSize: 16,
    fontWeight: '500',
  },
  content: {
    flex: 1,
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
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 4,
    padding: 12,
    fontSize: 14,
    color: '#212121',
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  inputFlex: {
    flex: 1,
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 4,
    alignItems: 'center',
    marginBottom: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  addButton: {
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  modeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  modeLabel: {
    fontSize: 14,
    color: '#212121',
  },
  modeString: {
    fontSize: 12,
    color: '#757575',
    fontFamily: 'monospace',
    marginBottom: 12,
    padding: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#757575',
    fontStyle: 'italic',
  },
  listContainer: {
    marginTop: 8,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 4,
    marginBottom: 8,
  },
  listItemText: {
    flex: 1,
    fontSize: 14,
    color: '#212121',
    fontFamily: 'monospace',
  },
  removeButton: {
    padding: 6,
    paddingHorizontal: 12,
    backgroundColor: '#F44336',
    borderRadius: 4,
  },
  removeButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  emptyText: {
    fontSize: 12,
    color: '#9E9E9E',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  buttonDanger: {
    backgroundColor: '#F44336',
  },
  statusContainer: {
    paddingVertical: 8,
    marginBottom: 8,
  },
  statusSuccess: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
  },
  statusWarning: {
    fontSize: 14,
    color: '#FF9800',
    fontWeight: '500',
  },
});


/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
*/

import React, { useState, useEffect, useMemo } from 'react';
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
import { ChannelInfo, ChannelManagementService } from '../services/ChannelManagementService';
import { IRCService } from '../services/IRCService';
import { connectionManager } from '../services/ConnectionManager';
import { channelEncryptionService } from '../services/ChannelEncryptionService';
import { channelEncryptionSettingsService } from '../services/ChannelEncryptionSettingsService';
import { useT } from '../i18n/transifex';
import { getChannelModeDescription } from '../utils/modeDescriptions';

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
  const t = useT();
  const [channelInfo, setChannelInfo] = useState<ChannelInfo | undefined>();
  const [topic, setTopic] = useState('');
  const [key, setKey] = useState('');
  const [limit, setLimit] = useState('');
  const [banMask, setBanMask] = useState('');
  const [exceptionMask, setExceptionMask] = useState('');
  const [inviteMask, setInviteMask] = useState('');
  // Track raw mode string for modes not represented by toggles
  const [rawModeString, setRawModeString] = useState('');

  // Encryption settings state
  const [alwaysEncrypt, setAlwaysEncrypt] = useState(false);
  const [hasEncryptionKey, setHasEncryptionKey] = useState(false);

  // Get the correct services for this network from ConnectionManager
  const { channelManagementService, ircService } = useMemo(() => {
    const context = connectionManager.getConnection(network);
    if (context) {
      return {
        channelManagementService: context.channelManagementService,
        ircService: context.ircService,
      };
    }
    // Fallback to singletons if connection not found (shouldn't happen in normal use)
    console.warn(`ChannelSettingsScreen: No connection found for network "${network}", using fallback`);
    const { channelManagementService: fallbackCMS } = require('../services/ChannelManagementService');
    const { ircService: fallbackIRC } = require('../services/IRCService');
    return {
      channelManagementService: fallbackCMS as ChannelManagementService,
      ircService: fallbackIRC as IRCService,
    };
  }, [network]);

  useEffect(() => {
    if (!visible || !channel || !network || !channelManagementService || !ircService) return;

    // Load current channel info
    const info = channelManagementService.getChannelInfo(channel);
    setChannelInfo(info);
    setTopic(info?.topic || '');
    setKey(info?.modes.key || '');
    setLimit(info?.modes.limit?.toString() || '');
    setRawModeString(channelManagementService.getModeString(channel) || '');

    // Load encryption settings
    const loadEncryptionSettings = async () => {
      const alwaysEncryptSetting = await channelEncryptionSettingsService.getAlwaysEncrypt(channel, network);
      const hasKey = await channelEncryptionService.hasChannelKey(channel, network);
      setAlwaysEncrypt(alwaysEncryptSetting);
      setHasEncryptionKey(hasKey);
    };
    loadEncryptionSettings();

    // Request current channel modes and topic
    ircService.sendCommand(`MODE ${channel}`);
    ircService.sendCommand(`TOPIC ${channel}`);

    // Request channel lists (bans, exceptions, invites)
    channelManagementService.requestBanList(channel);
    channelManagementService.requestExceptionList(channel);
    channelManagementService.requestInviteList(channel);

    // Listen for channel info changes
    const unsubscribe = channelManagementService.onChannelInfoChange((ch, info) => {
      if (ch === channel) {
        setChannelInfo(info);
        setTopic(info.topic || '');
        setKey(info.modes.key || '');
        setLimit(info.modes.limit?.toString() || '');
        setRawModeString(channelManagementService.getModeString(channel) || '');
      }
    });

    return () => {
      unsubscribe();
    };
  }, [visible, channel, network, channelManagementService, ircService]);

  const handleSetTopic = () => {
    if (topic.trim()) {
      channelManagementService.setTopic(channel, topic.trim());
      Alert.alert(t('Success'), t('Topic updated'));
    }
  };

  const handleSetKey = () => {
    if (key.trim()) {
      channelManagementService.setKey(channel, key.trim());
      Alert.alert(t('Success'), t('Channel key set'));
      setKey('');
    } else {
      channelManagementService.removeKey(channel);
      Alert.alert(t('Success'), t('Channel key removed'));
    }
  };

  const handleSetLimit = () => {
    const limitNum = parseInt(limit, 10);
    if (limitNum > 0) {
      channelManagementService.setLimit(channel, limitNum);
      Alert.alert(t('Success'), t('Channel limit set to {limitNum}').replace('{limitNum}', limitNum.toString()));
    } else if (limit === '') {
      channelManagementService.removeLimit(channel);
      // Clear the input immediately to avoid showing a stale number
      // when the limit has been removed.
      setLimit('');
      // Request updated modes so UI reflects server state ASAP.
      ircService.sendCommand(`MODE ${channel}`);
      Alert.alert(t('Success'), t('Channel limit removed'));
    } else {
      Alert.alert(t('Error'), t('Invalid limit value'));
    }
  };

  const handleAddBan = () => {
    if (banMask.trim()) {
      channelManagementService.addBan(channel, banMask.trim());
      Alert.alert(t('Success'), t('Ban added'));
      setBanMask('');
      // Request updated ban list
      channelManagementService.requestBanList(channel);
    }
  };

  const handleRemoveBan = (mask: string) => {
    channelManagementService.removeBan(channel, mask);
    Alert.alert(t('Success'), t('Ban removed'));
    channelManagementService.requestBanList(channel);
  };

  const handleAddException = () => {
    if (exceptionMask.trim()) {
      channelManagementService.addException(channel, exceptionMask.trim());
      Alert.alert(t('Success'), t('Exception added'));
      setExceptionMask('');
      channelManagementService.requestExceptionList(channel);
    }
  };

  const handleRemoveException = (mask: string) => {
    channelManagementService.removeException(channel, mask);
    Alert.alert(t('Success'), t('Exception removed'));
    channelManagementService.requestExceptionList(channel);
  };

  const handleAddInvite = () => {
    if (inviteMask.trim()) {
      channelManagementService.addInvite(channel, inviteMask.trim());
      Alert.alert(t('Success'), t('Invite exception added'));
      setInviteMask('');
      channelManagementService.requestInviteList(channel);
    }
  };

  const handleRemoveInvite = (mask: string) => {
    channelManagementService.removeInvite(channel, mask);
    Alert.alert(t('Success'), t('Invite exception removed'));
    channelManagementService.requestInviteList(channel);
  };

  const toggleMode = (mode: string, param?: string) => {
    const current = channelInfo?.modes;
    let modeStr = '';

    switch (mode) {
      case 'i':
        modeStr = current?.inviteOnly ? '-i' : '+i';
        break;
      case 't':
        modeStr = current?.topicProtected ? '-t' : '+t';
        break;
      case 'n':
        modeStr = current?.noExternalMessages ? '-n' : '+n';
        break;
      case 'm':
        modeStr = current?.moderated ? '-m' : '+m';
        break;
      case 'p':
        modeStr = current?.private ? '-p' : '+p';
        break;
      case 's':
        modeStr = current?.secret ? '-s' : '+s';
        break;
    }

    if (modeStr) {
      channelManagementService.setChannelMode(channel, modeStr, param);
      // Request updated modes after a short delay to confirm the change
      setTimeout(() => {
        ircService.sendCommand(`MODE ${channel}`);
      }, 500);
    }
  };

  const refreshModes = () => {
    ircService.sendCommand(`MODE ${channel}`);
  };

  // Encryption handlers
  const handleToggleAlwaysEncrypt = async () => {
    try {
      const newValue = !alwaysEncrypt;
      await channelEncryptionSettingsService.setAlwaysEncrypt(channel, network, newValue);
      setAlwaysEncrypt(newValue);

      if (newValue && !hasEncryptionKey) {
        Alert.alert(
          t('No Encryption Key'),
          t('Always-encrypt is now enabled, but no encryption key exists. Generate or request a key to enable encryption.'),
          [{ text: t('OK') }]
        );
      } else if (newValue) {
        Alert.alert(t('Success'), t('Always-encrypt enabled for {channel}').replace('{channel}', channel));
      } else {
        Alert.alert(t('Success'), t('Always-encrypt disabled for {channel}').replace('{channel}', channel));
      }
    } catch (error) {
      Alert.alert(t('Error'), error instanceof Error ? error.message : t('Failed to toggle always-encrypt'));
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
      Alert.alert(t('Success'), t('Encryption key generated. You can now share it with other users.'));
    } catch (error) {
      Alert.alert(t('Error'), error instanceof Error ? error.message : t('Failed to generate key'));
    }
  };

  const handleRequestKey = () => {
    Alert.prompt(
      t('Request Key'),
      t('Enter the nickname to request the encryption key from:'),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Request'),
          onPress: (nick: string | undefined) => {
            if (nick && nick.trim()) {
              ircService.sendCommand(`/chankey request ${nick.trim()}`);
              Alert.alert(t('Success'), t('Key request sent to {nick}').replace('{nick}', nick.trim()));
            }
          },
        },
      ],
      'plain-text'
    );
  };

  const handleShareKey = () => {
    Alert.prompt(
      t('Share Key'),
      t('Enter the nickname to share the encryption key with:'),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Share'),
          onPress: (nick: string | undefined) => {
            if (nick && nick.trim()) {
              ircService.sendCommand(`/chankey share ${nick.trim()}`);
              Alert.alert(t('Success'), t('Key shared with {nick}').replace('{nick}', nick.trim()));
            }
          },
        },
      ],
      'plain-text'
    );
  };

  const handleRemoveKey = () => {
    Alert.alert(
      t('Remove Encryption Key'),
      t('Are you sure you want to remove the encryption key? You will not be able to decrypt messages until you get the key again.'),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Remove'),
          style: 'destructive',
          onPress: async () => {
            ircService.sendCommand(`/chankey remove`);
            setTimeout(async () => {
              const hasKey = await channelEncryptionService.hasChannelKey(channel, network);
              setHasEncryptionKey(hasKey);
            }, 500);
            Alert.alert(t('Success'), t('Encryption key removed'));
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
          <Text style={styles.headerTitle}>{t('Channel Settings')}</Text>
          <Text style={styles.channelName}>{channel}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>{t('Close')}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {/* Topic Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('Topic')}</Text>
            <TextInput
              style={styles.input}
              value={topic}
              onChangeText={setTopic}
              placeholder={t('Channel topic')}
              multiline
            />
            <TouchableOpacity style={styles.button} onPress={handleSetTopic}>
              <Text style={styles.buttonText}>{t('Set Topic')}</Text>
            </TouchableOpacity>
            {channelInfo?.topicSetBy && (
              <Text style={styles.metaText}>
                {t('Set by {topicSetBy}').replace('{topicSetBy}', channelInfo.topicSetBy)}
                {channelInfo.topicSetAt &&
                  ` ${t('on {date}').replace('{date}', new Date(channelInfo.topicSetAt).toLocaleString())}`}
              </Text>
            )}
          </View>

          {/* Channel Modes */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>{t('Channel Modes')}</Text>
              <TouchableOpacity style={styles.refreshButton} onPress={refreshModes}>
                <Text style={styles.refreshButtonText}>{t('Refresh')}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modeString}>
              {rawModeString || t('No modes set')}
            </Text>
            <Text style={styles.metaText}>
              {t('These are all current channel modes. Use switches below to toggle common modes.')}
            </Text>

            <View style={styles.modeRow}>
              <View style={styles.modeLabelContainer}>
                <Text style={styles.modeLabel}>{t('Invite Only (i)')}</Text>
                {getChannelModeDescription('i') && (
                  <Text style={styles.modeDescription}>
                    {getChannelModeDescription('i')?.description}
                  </Text>
                )}
              </View>
              <Switch
                value={modes.inviteOnly || false}
                onValueChange={() => toggleMode('i')}
              />
            </View>

            <View style={styles.modeRow}>
              <View style={styles.modeLabelContainer}>
                <Text style={styles.modeLabel}>{t('Topic Protected (t)')}</Text>
                {getChannelModeDescription('t') && (
                  <Text style={styles.modeDescription}>
                    {getChannelModeDescription('t')?.description}
                  </Text>
                )}
              </View>
              <Switch
                value={modes.topicProtected || false}
                onValueChange={() => toggleMode('t')}
              />
            </View>

            <View style={styles.modeRow}>
              <View style={styles.modeLabelContainer}>
                <Text style={styles.modeLabel}>{t('No External Messages (n)')}</Text>
                {getChannelModeDescription('n') && (
                  <Text style={styles.modeDescription}>
                    {getChannelModeDescription('n')?.description}
                  </Text>
                )}
              </View>
              <Switch
                value={modes.noExternalMessages || false}
                onValueChange={() => toggleMode('n')}
              />
            </View>

            <View style={styles.modeRow}>
              <View style={styles.modeLabelContainer}>
                <Text style={styles.modeLabel}>{t('Moderated (m)')}</Text>
                {getChannelModeDescription('m') && (
                  <Text style={styles.modeDescription}>
                    {getChannelModeDescription('m')?.description}
                  </Text>
                )}
              </View>
              <Switch
                value={modes.moderated || false}
                onValueChange={() => toggleMode('m')}
              />
            </View>

            <View style={styles.modeRow}>
              <View style={styles.modeLabelContainer}>
                <Text style={styles.modeLabel}>{t('Private (p)')}</Text>
                {getChannelModeDescription('p') && (
                  <Text style={styles.modeDescription}>
                    {getChannelModeDescription('p')?.description}
                  </Text>
                )}
              </View>
              <Switch
                value={modes.private || false}
                onValueChange={() => toggleMode('p')}
              />
            </View>

            <View style={styles.modeRow}>
              <View style={styles.modeLabelContainer}>
                <Text style={styles.modeLabel}>{t('Secret (s)')}</Text>
                {getChannelModeDescription('s') && (
                  <Text style={styles.modeDescription}>
                    {getChannelModeDescription('s')?.description}
                  </Text>
                )}
              </View>
              <Switch
                value={modes.secret || false}
                onValueChange={() => toggleMode('s')}
              />
            </View>
          </View>

          {/* Channel Key */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('Channel Key (Password)')}</Text>
              {getChannelModeDescription('k') && (
                <Text style={styles.sectionDescription}>
                  {getChannelModeDescription('k')?.description}
                </Text>
              )}
            </View>
            <TextInput
              style={styles.input}
              value={key}
              onChangeText={setKey}
              placeholder={t('Channel key (leave empty to remove)')}
              secureTextEntry
            />
            <TouchableOpacity style={styles.button} onPress={handleSetKey}>
              <Text style={styles.buttonText}>
                {key.trim() ? t('Set Key') : t('Remove Key')}
              </Text>
            </TouchableOpacity>
            {modes.key && (
              <Text style={styles.metaText}>{t('Key is currently set')}</Text>
            )}
          </View>

          {/* Encryption Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('Encryption Settings')}</Text>

            <View style={styles.modeRow}>
              <Text style={styles.modeLabel}>{t('Always Encrypt Messages')}</Text>
              <Switch
                value={alwaysEncrypt}
                onValueChange={handleToggleAlwaysEncrypt}
              />
            </View>

            <View style={styles.statusContainer}>
              {hasEncryptionKey ? (
                <Text style={styles.statusSuccess}>{t('✓ Encryption key exists')}</Text>
              ) : (
                <Text style={styles.statusWarning}>{t('⚠ No encryption key')}</Text>
              )}
            </View>

            {!hasEncryptionKey ? (
              <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.button} onPress={handleGenerateKey}>
                  <Text style={styles.buttonText}>{t('Generate Key')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.button} onPress={handleRequestKey}>
                  <Text style={styles.buttonText}>{t('Request Key from...')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.button} onPress={handleShareKey}>
                  <Text style={styles.buttonText}>{t('Share Key with...')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.button, styles.buttonDanger]} onPress={handleRemoveKey}>
                  <Text style={styles.buttonText}>{t('Remove Key')}</Text>
                </TouchableOpacity>
              </View>
            )}

            <Text style={styles.metaText}>
              {alwaysEncrypt
                ? t('Messages will be encrypted automatically when a key is available.')
                : t('Enable to automatically encrypt all messages to this channel.')}
            </Text>
          </View>

          {/* Channel Limit */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('User Limit')}</Text>
              {getChannelModeDescription('l') && (
                <Text style={styles.sectionDescription}>
                  {getChannelModeDescription('l')?.description}
                </Text>
              )}
            </View>
            <TextInput
              style={styles.input}
              value={limit}
              onChangeText={setLimit}
              placeholder={t('Maximum users (leave empty to remove)')}
              keyboardType="numeric"
            />
            <TouchableOpacity style={styles.button} onPress={handleSetLimit}>
              <Text style={styles.buttonText}>
                {limit.trim() ? t('Set Limit') : t('Remove Limit')}
              </Text>
            </TouchableOpacity>
            {modes.limit && (
              <Text style={styles.metaText}>{t('Current limit: {limit} users').replace('{limit}', modes.limit.toString())}</Text>
            )}
          </View>

          {/* Ban List */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('Ban List')}</Text>
              {getChannelModeDescription('b') && (
                <Text style={styles.sectionDescription}>
                  {getChannelModeDescription('b')?.description}
                </Text>
              )}
            </View>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, styles.inputFlex]}
                value={banMask}
                onChangeText={setBanMask}
                placeholder={t('Ban mask (e.g., *!*@host.com)')}
              />
              <TouchableOpacity style={styles.addButton} onPress={handleAddBan}>
                <Text style={styles.addButtonText}>{t('Add')}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.button}
              onPress={() => channelManagementService.requestBanList(channel)}>
              <Text style={styles.buttonText}>{t('Refresh Ban List')}</Text>
            </TouchableOpacity>
            {modes.banList && modes.banList.length > 0 ? (
              <View style={styles.listContainer}>
                {modes.banList.map((mask, index) => (
                  <View key={index} style={styles.listItem}>
                    <Text style={styles.listItemText}>{mask}</Text>
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => handleRemoveBan(mask)}>
                      <Text style={styles.removeButtonText}>{t('Remove')}</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyText}>{t('No bans')}</Text>
            )}
          </View>

          {/* Exception List */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('Exception List')}</Text>
              {getChannelModeDescription('e') && (
                <Text style={styles.sectionDescription}>
                  {getChannelModeDescription('e')?.description}
                </Text>
              )}
            </View>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, styles.inputFlex]}
                value={exceptionMask}
                onChangeText={setExceptionMask}
                placeholder={t('Exception mask')}
              />
              <TouchableOpacity style={styles.addButton} onPress={handleAddException}>
                <Text style={styles.addButtonText}>{t('Add')}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.button}
              onPress={() => channelManagementService.requestExceptionList(channel)}>
              <Text style={styles.buttonText}>{t('Refresh Exception List')}</Text>
            </TouchableOpacity>
            {modes.exceptionList && modes.exceptionList.length > 0 ? (
              <View style={styles.listContainer}>
                {modes.exceptionList.map((mask, index) => (
                  <View key={index} style={styles.listItem}>
                    <Text style={styles.listItemText}>{mask}</Text>
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => handleRemoveException(mask)}>
                      <Text style={styles.removeButtonText}>{t('Remove')}</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyText}>{t('No exceptions')}</Text>
            )}
          </View>

          {/* Invite Exception List */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('Invite Exception List')}</Text>
              {getChannelModeDescription('I') && (
                <Text style={styles.sectionDescription}>
                  {getChannelModeDescription('I')?.description}
                </Text>
              )}
            </View>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, styles.inputFlex]}
                value={inviteMask}
                onChangeText={setInviteMask}
                placeholder={t('Invite mask (e.g., *!*@trusted.host)')}
              />
              <TouchableOpacity style={styles.addButton} onPress={handleAddInvite}>
                <Text style={styles.addButtonText}>{t('Add')}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.button}
              onPress={() => channelManagementService.requestInviteList(channel)}>
              <Text style={styles.buttonText}>{t('Refresh Invite List')}</Text>
            </TouchableOpacity>
            {modes.inviteList && modes.inviteList.length > 0 ? (
              <View style={styles.listContainer}>
                {modes.inviteList.map((mask, index) => (
                  <View key={index} style={styles.listItem}>
                    <Text style={styles.listItemText}>{mask}</Text>
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => handleRemoveInvite(mask)}>
                      <Text style={styles.removeButtonText}>{t('Remove')}</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyText}>{t('No invite exceptions')}</Text>
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
    marginBottom: 4,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  refreshButton: {
    backgroundColor: '#E0E0E0',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  refreshButtonText: {
    color: '#424242',
    fontSize: 12,
    fontWeight: '500',
  },
  sectionDescription: {
    fontSize: 12,
    color: '#757575',
    fontStyle: 'italic',
    marginTop: 4,
  },
  modeLabelContainer: {
    flex: 1,
    marginRight: 12,
  },
  modeDescription: {
    fontSize: 11,
    color: '#9E9E9E',
    fontStyle: 'italic',
    marginTop: 2,
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


/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

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
import {
  userManagementService as singletonUserManagementService,
  WHOISInfo,
} from '../services/UserManagementService';
import { ircService } from '../services/IRCService';
import { connectionManager } from '../services/ConnectionManager';
import {
  userActivityService,
  UserActivity,
} from '../services/UserActivityService';
import { formatIRCTextAsComponent } from '../utils/IRCFormatter';
import { useT } from '../i18n/transifex';
import { useTheme } from '../hooks/useTheme';
import { ThemeColors } from '../services/ThemeService';

interface WHOISDisplayProps {
  visible: boolean;
  nick: string;
  network?: string;
  onClose: () => void;
  onChannelPress?: (channel: string) => void;
  onNickPress?: (nick: string) => void;
}

export const WHOISDisplay: React.FC<WHOISDisplayProps> = ({
  visible,
  nick,
  network,
  onClose,
  onChannelPress,
  onNickPress,
}) => {
  const t = useT();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [whoisInfo, setWhoisInfo] = useState<WHOISInfo | undefined>();
  const [loading, setLoading] = useState(false);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [showAliasInput, setShowAliasInput] = useState(false);
  const [aliasText, setAliasText] = useState('');
  const [userService, setUserService] = useState(
    singletonUserManagementService,
  );
  const [activity, setActivity] = useState<UserActivity | undefined>();
  const visibleRef = useRef(visible);

  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  useEffect(() => {
    const connection = network
      ? connectionManager.getConnection(network)
      : connectionManager.getActiveConnection();
    const svc =
      connection?.userManagementService || singletonUserManagementService;
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
    const irc =
      (network
        ? connectionManager.getConnection(network)?.ircService
        : connectionManager.getActiveConnection()?.ircService) || ircService;
    if (!irc.getConnectionStatus() || !irc.isRegistered()) {
      Alert.alert(t('WHOIS Error'), t('Not connected or not registered yet.'));
      return;
    }
    setLoading(true);

    // Show cached data immediately as placeholder (if available)
    const cachedInfo = userService.getWHOIS(nick, network);
    if (cachedInfo && cachedInfo.realname) {
      setWhoisInfo(cachedInfo);
    }

    // Always request fresh WHOIS data to ensure we have the latest info
    try {
      const freshInfo = await userService.requestWHOIS(nick, network);
      if (visibleRef.current) {
        setWhoisInfo(freshInfo);
      }
    } catch {
      if (!visibleRef.current) return;
      // If request failed and we don't have cached data, try to get whatever is in cache
      if (!cachedInfo || !cachedInfo.realname) {
        const fallbackInfo = userService.getWHOIS(nick, network);
        setWhoisInfo(fallbackInfo);
      }
      // Keep showing cached data if request failed but we had cached data
    } finally {
      if (visibleRef.current) setLoading(false);
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
      Alert.alert(t('Success'), t('Note saved'));
      setShowNoteInput(false);
    } else {
      await userService.removeUserNote(nick, network);
      Alert.alert(t('Success'), t('Note removed'));
      setShowNoteInput(false);
    }
  };

  const handleSaveAlias = async () => {
    if (aliasText.trim()) {
      await userService.addUserAlias(nick, aliasText.trim(), network);
      Alert.alert(t('Success'), t('Alias saved'));
      setShowAliasInput(false);
    } else {
      await userService.removeUserAlias(nick, network);
      Alert.alert(t('Success'), t('Alias removed'));
      setShowAliasInput(false);
    }
  };

  const handleIgnore = async () => {
    Alert.alert(t('Ignore User'), t('Ignore {nick}?', { nick }), [
      { text: t('Cancel'), style: 'cancel' },
      {
        text: t('Ignore'),
        style: 'destructive',
        onPress: async () => {
          await userService.ignoreUser(nick, undefined, network);
          Alert.alert(t('Success'), t('{nick} has been ignored', { nick }));
          onClose();
        },
      },
    ]);
  };

  const handleUnignore = async () => {
    await userService.unignoreUser(nick, network);
    Alert.alert(t('Success'), t('{nick} is no longer ignored', { nick }));
  };

  const isIgnored = userService.isUserIgnored(
    nick,
    undefined,
    undefined,
    network,
  );
  const currentNick = (
    (network
      ? connectionManager.getConnection(network)?.ircService
      : connectionManager.getActiveConnection()?.ircService) || ircService
  ).getCurrentNick();
  const isSelfWhois =
    !!currentNick && nick.toLowerCase() === currentNick.toLowerCase();

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          {onNickPress ? (
            <TouchableOpacity
              onPress={() => onNickPress(nick)}
              activeOpacity={0.7}
            >
              <Text style={styles.headerTitle}>
                {t('WHOIS: {nick}', { nick })}
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.headerTitle}>
              {t('WHOIS: {nick}', { nick })}
            </Text>
          )}
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>{t('Close')}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {loading && !whoisInfo && (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>
                {t('Loading WHOIS information...')}
              </Text>
            </View>
          )}

          {whoisInfo && (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('User Information')}</Text>
                {whoisInfo.realname && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>{t('Real Name:')}</Text>
                    <Text style={styles.infoValue}>
                      {formatIRCTextAsComponent(
                        whoisInfo.realname,
                        styles.infoValue,
                      )}
                    </Text>
                  </View>
                )}
                {whoisInfo.username && whoisInfo.hostname && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>{t('Host:')}</Text>
                    <Text style={styles.infoValue}>
                      {whoisInfo.username}@{whoisInfo.hostname}
                    </Text>
                  </View>
                )}
                {whoisInfo.account && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>{t('Account:')}</Text>
                    <Text style={styles.infoValue}>{whoisInfo.account}</Text>
                  </View>
                )}
                {whoisInfo.modes && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>{t('Modes:')}</Text>
                    <Text style={styles.infoValue}>{whoisInfo.modes}</Text>
                  </View>
                )}
                {whoisInfo.connectingFrom && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>
                      {t('Connecting from:')}
                    </Text>
                    <Text style={styles.infoValue}>
                      {whoisInfo.connectingFrom}
                    </Text>
                  </View>
                )}
              </View>

              {/* Privileges / Status */}
              {(whoisInfo.isOper ||
                whoisInfo.isAdmin ||
                whoisInfo.isServicesAdmin ||
                whoisInfo.isHelpOp ||
                whoisInfo.isRegistered ||
                whoisInfo.isBot ||
                whoisInfo.specialStatus) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>{t('Privileges')}</Text>
                  {whoisInfo.isOper && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>{t('IRC Operator:')}</Text>
                      <Text
                        style={[styles.infoValue, { color: colors.accent }]}
                      >
                        {t('Yes')}
                      </Text>
                    </View>
                  )}
                  {whoisInfo.isAdmin && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>{t('Admin:')}</Text>
                      <Text
                        style={[styles.infoValue, { color: colors.secondary }]}
                      >
                        {t('Yes')}
                      </Text>
                    </View>
                  )}
                  {whoisInfo.isServicesAdmin && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>
                        {t('Services Admin:')}
                      </Text>
                      <Text
                        style={[
                          styles.infoValue,
                          { color: colors.primaryDark },
                        ]}
                      >
                        {t('Yes')}
                      </Text>
                    </View>
                  )}
                  {whoisInfo.isHelpOp && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>
                        {t('Help Operator:')}
                      </Text>
                      <Text style={[styles.infoValue, { color: colors.info }]}>
                        {t('Yes')}
                      </Text>
                    </View>
                  )}
                  {whoisInfo.isRegistered && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>{t('Registered:')}</Text>
                      <Text
                        style={[styles.infoValue, { color: colors.success }]}
                      >
                        {t('Yes')}
                      </Text>
                    </View>
                  )}
                  {whoisInfo.isBot && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>{t('Bot:')}</Text>
                      <Text
                        style={[styles.infoValue, { color: colors.warning }]}
                      >
                        {t('Yes')}
                      </Text>
                    </View>
                  )}
                  {whoisInfo.specialStatus && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>{t('Special:')}</Text>
                      <Text style={styles.infoValue}>
                        {whoisInfo.specialStatus}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {whoisInfo.server && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>{t('Server')}</Text>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>{t('Server:')}</Text>
                    <Text style={styles.infoValue}>{whoisInfo.server}</Text>
                  </View>
                  {whoisInfo.serverInfo && (
                    <Text style={styles.infoValue}>
                      {formatIRCTextAsComponent(
                        whoisInfo.serverInfo,
                        styles.infoValue,
                      )}
                    </Text>
                  )}
                </View>
              )}

              {whoisInfo.away && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>{t('Status')}</Text>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>{t('Away:')}</Text>
                    <Text style={styles.infoValue}>
                      {whoisInfo.awayMessage
                        ? formatIRCTextAsComponent(
                            whoisInfo.awayMessage,
                            styles.infoValue,
                          )
                        : t('User is away')}
                    </Text>
                  </View>
                </View>
              )}

              {whoisInfo.secure && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>{t('Security')}</Text>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>{t('Connection:')}</Text>
                    <Text style={[styles.infoValue, { color: colors.success }]}>
                      {whoisInfo.secureMessage || t('Secure (SSL/TLS)')}
                    </Text>
                  </View>
                </View>
              )}

              {whoisInfo.idle !== undefined && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>
                    {t('Connection Activity')}
                  </Text>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>{t('Idle:')}</Text>
                    <Text style={styles.infoValue}>
                      {t('{minutes} minutes', {
                        minutes: Math.floor(whoisInfo.idle / 60),
                      })}
                    </Text>
                  </View>
                  {whoisInfo.signon && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>{t('Signed on:')}</Text>
                      <Text style={styles.infoValue}>
                        {new Date(whoisInfo.signon).toLocaleString()}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {whoisInfo.idle === undefined && !isSelfWhois && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>
                    {t('Connection Activity')}
                  </Text>
                  <Text style={styles.emptyText}>
                    {t(
                      'Idle time was not provided by this server for this user',
                    )}
                  </Text>
                </View>
              )}

              {whoisInfo.channels && whoisInfo.channels.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>{t('Channels')}</Text>
                  <View style={styles.channelsContainer}>
                    {whoisInfo.channels.map((channel, index) => {
                      // Extract channel name without ALL prefixes (~, &, @, %, +)
                      const cleanChannel = channel.replace(/^[~&@%+]+/, '');
                      const prefix = channel.match(/^[~&@%+]+/)?.[0] || '';
                      return (
                        <React.Fragment key={channel}>
                          {index > 0 && (
                            <Text style={styles.channelSeparator}>, </Text>
                          )}
                          {onChannelPress ? (
                            <TouchableOpacity
                              onPress={() => onChannelPress(cleanChannel)}
                              activeOpacity={0.7}
                            >
                              <Text style={styles.channelText}>
                                {prefix && (
                                  <Text style={styles.channelPrefix}>
                                    {prefix}
                                  </Text>
                                )}
                                {cleanChannel}
                              </Text>
                            </TouchableOpacity>
                          ) : (
                            <Text style={styles.channelText}>
                              {prefix && (
                                <Text style={styles.channelPrefix}>
                                  {prefix}
                                </Text>
                              )}
                              {cleanChannel}
                            </Text>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </View>
                </View>
              )}
            </>
          )}

          {!whoisInfo && !loading && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {t('No WHOIS information available')}
              </Text>
              <TouchableOpacity style={styles.button} onPress={loadWHOIS}>
                <Text style={styles.buttonText}>{t('Request WHOIS')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* User Notes */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('User Note')}</Text>
            {!showNoteInput ? (
              <>
                {noteText ? (
                  <Text style={styles.noteText}>{noteText}</Text>
                ) : (
                  <Text style={styles.emptyText}>{t('No note')}</Text>
                )}
                <TouchableOpacity
                  style={styles.button}
                  onPress={() => setShowNoteInput(true)}
                >
                  <Text style={styles.buttonText}>
                    {noteText ? t('Edit Note') : t('Add Note')}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TextInput
                  style={styles.input}
                  value={noteText}
                  onChangeText={setNoteText}
                  placeholder={t('Enter note about this user')}
                  placeholderTextColor={colors.textSecondary}
                  multiline
                />
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={[styles.button, styles.buttonSecondary]}
                    onPress={() => {
                      setShowNoteInput(false);
                      loadUserData();
                    }}
                  >
                    <Text style={styles.buttonText}>{t('Cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.button}
                    onPress={handleSaveNote}
                  >
                    <Text style={styles.buttonText}>{t('Save')}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>

          {/* User Activity Tracking */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('User Activity')}</Text>
            {activity ? (
              <>
                <Text style={styles.listItemText}>
                  {t('Last action: {action}{channel}', {
                    action: activity.lastAction,
                    channel: activity.channel ? ` (${activity.channel})` : '',
                  })}
                </Text>
                <Text style={styles.listItemText}>
                  {t('Last seen: {time}', {
                    time: new Date(activity.lastSeenAt).toLocaleString(),
                  })}
                </Text>
                {activity.text ? (
                  <Text style={styles.listItemText} numberOfLines={2}>
                    {t('Context: ')}
                    {formatIRCTextAsComponent(
                      activity.text,
                      styles.listItemText,
                    )}
                  </Text>
                ) : null}
              </>
            ) : (
              <Text style={styles.emptyText}>
                {t('No recent activity tracked')}
              </Text>
            )}
          </View>

          {/* User Alias */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('User Alias')}</Text>
            {!showAliasInput ? (
              <>
                {aliasText ? (
                  <Text style={styles.aliasText}>{aliasText}</Text>
                ) : (
                  <Text style={styles.emptyText}>{t('No alias')}</Text>
                )}
                <TouchableOpacity
                  style={styles.button}
                  onPress={() => setShowAliasInput(true)}
                >
                  <Text style={styles.buttonText}>
                    {aliasText ? t('Edit Alias') : t('Add Alias')}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TextInput
                  style={styles.input}
                  value={aliasText}
                  onChangeText={setAliasText}
                  placeholder={t('Enter alias for this user')}
                  placeholderTextColor={colors.textSecondary}
                />
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={[styles.button, styles.buttonSecondary]}
                    onPress={() => {
                      setShowAliasInput(false);
                      loadUserData();
                    }}
                  >
                    <Text style={styles.buttonText}>{t('Cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.button}
                    onPress={handleSaveAlias}
                  >
                    <Text style={styles.buttonText}>{t('Save')}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>

          {/* Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('Actions')}</Text>
            {isIgnored ? (
              <TouchableOpacity style={styles.button} onPress={handleUnignore}>
                <Text style={styles.buttonText}>{t('Unignore User')}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.button, styles.buttonDanger]}
                onPress={handleIgnore}
              >
                <Text style={[styles.buttonText, styles.buttonTextWhite]}>
                  {t('Ignore User')}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.button}
              onPress={() => {
                // Get the IRC service for the specific network
                const irc =
                  (network
                    ? connectionManager.getConnection(network)?.ircService
                    : connectionManager.getActiveConnection()?.ircService) ||
                  ircService;
                if (irc && irc.getConnectionStatus()) {
                  irc.sendCommand(`WHOWAS ${nick}`);
                } else {
                  Alert.alert(t('Error'), t('Not connected to server.'));
                }
              }}
            >
              <Text style={styles.buttonText}>{t('WHOWAS (History)')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.surface,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surfaceVariant,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    closeButton: {
      paddingVertical: 4,
      paddingHorizontal: 8,
    },
    closeButtonText: {
      color: colors.primary,
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
      color: colors.textSecondary,
      fontSize: 14,
    },
    section: {
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    infoRow: {
      flexDirection: 'row',
      marginBottom: 8,
      flexWrap: 'wrap',
    },
    infoLabel: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: '500',
      marginRight: 8,
      minWidth: 80,
    },
    infoValue: {
      fontSize: 14,
      color: colors.text,
      flex: 1,
    },
    emptyContainer: {
      padding: 20,
      alignItems: 'center',
    },
    emptyText: {
      color: colors.textSecondary,
      fontSize: 14,
      fontStyle: 'italic',
      marginBottom: 12,
    },
    button: {
      backgroundColor: colors.primary,
      padding: 12,
      borderRadius: 4,
      alignItems: 'center',
      marginTop: 8,
    },
    buttonSecondary: {
      backgroundColor: colors.buttonSecondary,
    },
    buttonDanger: {
      backgroundColor: colors.error,
    },
    buttonText: {
      color: colors.onPrimary,
      fontSize: 14,
      fontWeight: '500',
    },
    buttonTextWhite: {
      color: colors.onPrimary,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 8,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 4,
      padding: 12,
      fontSize: 14,
      color: colors.text,
      backgroundColor: colors.inputBackground,
      marginBottom: 8,
      minHeight: 80,
      textAlignVertical: 'top',
    },
    noteText: {
      fontSize: 14,
      color: colors.text,
      marginBottom: 8,
      padding: 12,
      backgroundColor: colors.surfaceVariant,
      borderRadius: 4,
    },
    aliasText: {
      fontSize: 14,
      color: colors.text,
      marginBottom: 8,
      padding: 12,
      backgroundColor: colors.surfaceVariant,
      borderRadius: 4,
      fontStyle: 'italic',
    },
    listItemText: {
      fontSize: 14,
      color: colors.text,
      marginBottom: 6,
    },
    channelsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
    },
    channelSeparator: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    channelText: {
      fontSize: 14,
      color: colors.primary,
      textDecorationLine: 'underline',
    },
    channelPrefix: {
      color: colors.textSecondary,
      textDecorationLine: 'none',
    },
  });

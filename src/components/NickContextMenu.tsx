/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { useT } from '../i18n/transifex';
import { ircService, ChannelUser } from '../services/IRCService';
import { userManagementService } from '../services/UserManagementService';
import { banService } from '../services/BanService';
import { serviceCommandProvider } from '../services/ServiceCommandProvider';
import { ServiceCommand } from '../interfaces/ServiceTypes';
import { settingsService, NEW_FEATURE_DEFAULTS } from '../services/SettingsService';
import { useUIStore } from '../stores/uiStore';
import KickBanModal from './KickBanModal';

interface NickContextMenuProps {
  visible: boolean;
  nick?: string | null;
  onClose: () => void;
  onAction: (action: string) => void;
  actionMessage?: string;
  colors: {
    text: string;
    textSecondary: string;
    primary: string;
    surface: string;
    border: string;
    background: string;
  };
  connection?: { ircService?: any } | null;
  network?: string;
  channel?: string;
  activeNick?: string;
  allowQrVerification?: boolean;
  allowFileExchange?: boolean;
  allowNfcExchange?: boolean;
  isServerOper?: boolean;
  ignoreActionId?: string;
}

export const NickContextMenu: React.FC<NickContextMenuProps> = ({
  visible,
  nick,
  onClose,
  onAction,
  actionMessage = '',
  colors,
  connection,
  network,
  channel,
  activeNick,
  allowQrVerification = true,
  allowFileExchange = true,
  allowNfcExchange = true,
  isServerOper = false,
  ignoreActionId = 'ignore_toggle',
}) => {
  const t = useT();
  const activeIrc: any = connection?.ircService || ircService;
  const isMonitoring = nick && typeof activeIrc?.isMonitoring === 'function' ? activeIrc.isMonitoring(nick) : false;
  const canMonitor = Boolean(activeIrc?.capEnabledSet && activeIrc.capEnabledSet.has && activeIrc.capEnabledSet.has('monitor'));
  const isIgnored = nick ? userManagementService.isUserIgnored(nick, undefined, undefined, network) : false;
  const [showE2EGroup, setShowE2EGroup] = useState(false);
  const [showCTCPGroup, setShowCTCPGroup] = useState(false);
  const [showServiceGroup, setShowServiceGroup] = useState(false);
  const [serviceCommands, setServiceCommands] = useState<Array<{command: ServiceCommand; serviceNick: string}>>([]);
  const [showOpsGroup, setShowOpsGroup] = useState(false);
  const [showUserListGroup, setShowUserListGroup] = useState(false);
  const [showKickBanModal, setShowKickBanModal] = useState(false);
  const [kickBanMode, setKickBanMode] = useState<'kick' | 'ban' | 'kickban'>('kickban');
  const [userHostInfo, setUserHostInfo] = useState<{user: string; host: string} | null>(null);
  const [confirmBeforeKickBan, setConfirmBeforeKickBan] = useState<boolean>(true);
  const [defaultBanType, setDefaultBanType] = useState<number>(2);
  const [defaultKickReason, setDefaultKickReason] = useState<string>('Goodbye');
  const [showKillReasonModal, setShowKillReasonModal] = useState(false);
  const [killReason, setKillReason] = useState('');

  useEffect(() => {
    if (!visible) {
      setShowE2EGroup(false);
      setShowCTCPGroup(false);
      setShowOpsGroup(false);
      setShowUserListGroup(false);
      setShowKickBanModal(false);
      setShowKillReasonModal(false);
      setKillReason('');
      setUserHostInfo(null);
      setShowServiceGroup(false);
    }
  }, [visible, nick]);

  // Load service commands when menu opens
  useEffect(() => {
    if (visible && network) {
      const commands = serviceCommandProvider.getCommands(network);
      // Filter commands that can be used on a nick (like INFO, STATUS, etc.)
      const nickCommands = commands.filter(({ command }) => {
        const params = command.parameters;
        return params.some(p => 
          p.type === 'nick' || 
          p.name.toLowerCase().includes('nick') ||
          p.name.toLowerCase().includes('user')
        );
      }).slice(0, 8); // Limit to 8 most relevant commands
      setServiceCommands(nickCommands.map(({ command, serviceNick }) => ({ command, serviceNick })));
    }
  }, [visible, network]);

  // Load kick/ban settings when menu opens
  useEffect(() => {
    if (visible) {
      const loadSettings = async () => {
        const confirm = await settingsService.getSetting('confirmBeforeKickBan', NEW_FEATURE_DEFAULTS.confirmBeforeKickBan);
        const banType = await settingsService.getSetting('defaultBanType', NEW_FEATURE_DEFAULTS.defaultBanType);
        const reasons = await settingsService.getSetting('predefinedKickReasons', NEW_FEATURE_DEFAULTS.predefinedKickReasons);
        setConfirmBeforeKickBan(confirm);
        setDefaultBanType(banType);
        setDefaultKickReason(reasons[0] || 'Goodbye');
      };
      loadSettings();
    }
  }, [visible]);

  // Send silent WHO when menu opens to get user@host info
  useEffect(() => {
    if (visible && nick && activeIrc?.sendSilentWho) {
      // Only fetch if we don't already have info for this nick
      if (!userHostInfo) {
        activeIrc.sendSilentWho(nick, (user: string, host: string) => {
          setUserHostInfo({ user, host });
        });
      }
    }
  }, [visible, nick, activeIrc, userHostInfo]);

  const channelUsers = useMemo(() => {
    if (!channel || typeof activeIrc.getChannelUsers !== 'function') return [];
    return activeIrc.getChannelUsers(channel) as ChannelUser[];
  }, [activeIrc, channel]);

  const normalizedNick = nick ? nick.toLowerCase() : '';
  const normalizedActive = activeNick ? activeNick.toLowerCase() : '';
  const targetUser = normalizedNick
    ? channelUsers.find(user => user.nick.toLowerCase() === normalizedNick)
    : undefined;
  const currentUser = normalizedActive
    ? channelUsers.find(user => user.nick.toLowerCase() === normalizedActive)
    : undefined;
  const isCurrentUserHalfOp = currentUser?.modes.some(mode => ['h', 'o', 'a', 'q'].includes(mode)) || false;
  const isCurrentUserOp = currentUser?.modes.some(mode => ['o', 'a', 'q'].includes(mode)) || false;
  const canKickBan = isCurrentUserHalfOp || isCurrentUserOp;

  // Execute kick/ban directly without modal
  const executeKickBanDirect = (mode: 'kick' | 'ban' | 'kickban', withReason: boolean = false) => {
    if (!channel || !nick) return;
    
    const user = userHostInfo?.user || targetUser?.nick || '';
    const host = userHostInfo?.host || targetUser?.host || '';
    const banMask = user && host 
      ? banService.generateBanMask(nick, user, host, defaultBanType)
      : `${nick}!*@*`;
    
    const reason = withReason ? '' : defaultKickReason;
    
    // Apply ban first (if requested)
    if (mode === 'ban' || mode === 'kickban') {
      const banCmd = `MODE ${channel} +b ${banMask}`;
      console.log('📤 Direct ban:', banCmd);
      activeIrc.sendRaw(banCmd);
    }
    
    // Then kick (if requested)  
    if (mode === 'kick' || mode === 'kickban') {
      const kickReason = reason.trim() || 'Goodbye';
      const kickCmd = `KICK ${channel} ${nick} :${kickReason}`;
      console.log('📤 Direct kick:', kickCmd);
      activeIrc.sendRaw(kickCmd);
    }
  };

  // Handle kick/ban button press
  const handleKickBanPress = (mode: 'kick' | 'ban' | 'kickban', withReason: boolean = false) => {
    if (confirmBeforeKickBan || withReason) {
      // Show modal for confirmation or custom reason
      setKickBanMode(mode);
      setShowKickBanModal(true);
    } else {
      // Execute directly with defaults
      executeKickBanDirect(mode, false);
      onClose();
    }
  };

  const handleKillPress = () => {
    setKillReason('');
    setShowKillReasonModal(true);
  };

  const styles = useMemo(() => StyleSheet.create({
    contextOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
    },
    contextBox: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      maxHeight: '80%',
    },
    contextHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    contextHeaderText: {
      flex: 1,
      marginRight: 12,
    },
    contextBanner: {
      marginHorizontal: 12,
      marginTop: 10,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 8,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    contextBannerText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },
    contextTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '700',
    },
    contextSubtitle: {
      color: colors.textSecondary,
      fontSize: 12,
      marginTop: 2,
    },
    contextCopyButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 6,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    contextCopyText: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '600',
    },
    contextScroll: {
      maxHeight: 420,
    },
    contextScrollContent: {
      padding: 12,
    },
    contextGroupTitle: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '600',
      textTransform: 'uppercase',
      marginBottom: 6,
    },
    contextDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 10,
    },
    contextItem: {
      paddingVertical: 8,
    },
    contextText: {
      color: colors.text,
      fontSize: 14,
    },
    contextItemWithIcon: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    contextIcon: {
      width: 16,
    },
    contextSubGroup: {
      paddingLeft: 12,
    },
    contextDanger: {
      color: '#EF5350',
    },
    contextWarning: {
      color: '#FB8C00',
    },
    contextMuted: {
      color: colors.textSecondary,
    },
    contextFooter: {
      padding: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      alignItems: 'flex-end',
    },
    contextFooterButton: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 6,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    contextCancel: {
      color: colors.textSecondary,
      fontWeight: '600',
    },
  }), [colors]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.contextOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.contextBox}>
          <View style={styles.contextHeaderRow}>
            <View style={styles.contextHeaderText}>
              <Text style={styles.contextTitle}>{nick}</Text>
              {userHostInfo ? (
                <Text style={styles.contextSubtitle}>{userHostInfo.user}@{userHostInfo.host}</Text>
              ) : targetUser?.account && targetUser.account !== '*' ? (
                <Text style={styles.contextSubtitle}>{t('Account: {account}').replace('{account}', targetUser.account)}</Text>
              ) : null}
            </View>
            <TouchableOpacity style={styles.contextCopyButton} onPress={() => onAction('copy')}>
              <Icon name="copy" size={12} color={colors.primary} />
              <Text style={styles.contextCopyText}>{t('Copy nickname')}</Text>
            </TouchableOpacity>
          </View>
          {!!actionMessage && (
            <View style={styles.contextBanner}>
              <Text style={styles.contextBannerText}>{actionMessage}</Text>
            </View>
          )}
          <ScrollView style={styles.contextScroll} contentContainerStyle={styles.contextScrollContent}>
            <Text style={styles.contextGroupTitle}>{t('Quick Actions')}</Text>
            <TouchableOpacity style={styles.contextItem} onPress={() => onAction('whois')}>
              <View style={styles.contextItemWithIcon}>
                <Icon name="info-circle" size={14} color={colors.text} style={styles.contextIcon} />
                <Text style={styles.contextText}>{t('WHOIS')}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.contextItem} onPress={() => onAction('query')}>
              <View style={styles.contextItemWithIcon}>
                <Icon name="comments" size={14} color={colors.text} style={styles.contextIcon} />
                <Text style={styles.contextText}>{t('Open Query')}</Text>
              </View>
            </TouchableOpacity>
            {canMonitor && (
              <TouchableOpacity style={styles.contextItem} onPress={() => onAction('monitor_toggle')}>
                <View style={styles.contextItemWithIcon}>
                  <Icon name="eye" size={14} color={colors.text} style={styles.contextIcon} />
                  <Text style={styles.contextText}>{isMonitoring ? t('Unmonitor Nick') : t('Monitor Nick')}</Text>
                </View>
              </TouchableOpacity>
            )}

            <View style={styles.contextDivider} />
            <TouchableOpacity style={styles.contextItem} onPress={() => setShowUserListGroup(prev => !prev)}>
              <View style={styles.contextItemWithIcon}>
                <Icon name="users" size={14} color={colors.text} style={styles.contextIcon} />
                <Text style={styles.contextText}>
                  {showUserListGroup ? t('User list v') : t('User list >')}
                </Text>
              </View>
            </TouchableOpacity>
            {showUserListGroup && (
              <View style={styles.contextSubGroup}>
                <TouchableOpacity style={styles.contextItem} onPress={() => onAction(ignoreActionId)}>
                  <View style={styles.contextItemWithIcon}>
                    <Icon name={isIgnored ? "undo" : "ban"} size={14} color={colors.text} style={styles.contextIcon} />
                    <Text style={styles.contextText}>{isIgnored ? t('Unignore User') : t('Ignore User')}</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.contextItem} onPress={() => onAction('blacklist')}>
                  <View style={styles.contextItemWithIcon}>
                    <Icon name="list-alt" size={14} color={colors.text} style={styles.contextIcon} />
                    <Text style={styles.contextText}>{t('Add to Blacklist')}</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.contextItem} onPress={() => {
                  useUIStore.getState().setShowBlacklist(true);
                  useUIStore.getState().setBlacklistTarget({
                    type: 'nick',
                    networkId: network || '',
                    nick: nick ?? '',
                  });
                }}>
                  <View style={styles.contextItemWithIcon}>
                    <Icon name="user-slash" size={14} color={colors.text} style={styles.contextIcon} />
                    <Text style={styles.contextText}>{t('Blacklist Nick')}</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.contextItem} onPress={() => {
                  useUIStore.getState().setUserListsInitialTab('notify');
                  useUIStore.getState().setUserListTarget({
                    listType: 'notify',
                    networkId: network || '',
                    nick: nick ?? '',
                    mask: userHostInfo?.user && userHostInfo?.host ? `${nick}!${userHostInfo.user}@${userHostInfo.host}` : (nick ?? ''),
                    channels: channel ? [channel] : undefined,
                  });
                  useUIStore.getState().setShowUserLists(true);
                  onClose();
                }}>
                  <View style={styles.contextItemWithIcon}>
                    <Icon name="bell" size={14} color={colors.text} style={styles.contextIcon} />
                    <Text style={styles.contextText}>{t('Add to Notify')}</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.contextItem} onPress={() => {
                  useUIStore.getState().setUserListsInitialTab('autoop');
                  useUIStore.getState().setUserListTarget({
                    listType: 'autoop',
                    networkId: network || '',
                    nick: nick ?? '',
                    mask: userHostInfo?.user && userHostInfo?.host ? `${nick}!${userHostInfo.user}@${userHostInfo.host}` : (nick ?? ''),
                    channels: channel ? [channel] : undefined,
                  });
                  useUIStore.getState().setShowUserLists(true);
                  onClose();
                }}>
                  <View style={styles.contextItemWithIcon}>
                    <Icon name="user-shield" size={14} color={colors.text} style={styles.contextIcon} />
                    <Text style={styles.contextText}>{t('Add to AutoOp')}</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.contextItem} onPress={() => {
                  useUIStore.getState().setUserListsInitialTab('autovoice');
                  useUIStore.getState().setUserListTarget({
                    listType: 'autovoice',
                    networkId: network || '',
                    nick: nick ?? '',
                    mask: userHostInfo?.user && userHostInfo?.host ? `${nick}!${userHostInfo.user}@${userHostInfo.host}` : (nick ?? ''),
                    channels: channel ? [channel] : undefined,
                  });
                  useUIStore.getState().setShowUserLists(true);
                  onClose();
                }}>
                  <View style={styles.contextItemWithIcon}>
                    <Icon name="microphone" size={14} color={colors.text} style={styles.contextIcon} />
                    <Text style={styles.contextText}>{t('Add to AutoVoice')}</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.contextItem} onPress={() => {
                  useUIStore.getState().setUserListsInitialTab('other');
                  useUIStore.getState().setUserListTarget({
                    listType: 'other',
                    networkId: network || '',
                    nick: nick ?? '',
                    mask: userHostInfo?.user && userHostInfo?.host ? `${nick}!${userHostInfo.user}@${userHostInfo.host}` : (nick ?? ''),
                    channels: channel ? [channel] : undefined,
                  });
                  useUIStore.getState().setShowUserLists(true);
                  onClose();
                }}>
                  <View style={styles.contextItemWithIcon}>
                    <Icon name="shield-alt" size={14} color={colors.text} style={styles.contextIcon} />
                    <Text style={styles.contextText}>{t('Add to Protected')}</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.contextItem} onPress={() => onAction('add_note')}>
                  <View style={styles.contextItemWithIcon}>
                    <Icon name="sticky-note" size={14} color={colors.text} style={styles.contextIcon} />
                    <Text style={styles.contextText}>
                      {userManagementService.getUserNote(nick || '', network) ? t('Edit Note') : t('Add Note')}
                    </Text>
                  </View>
                </TouchableOpacity>
                {isServerOper && (
                  <TouchableOpacity style={styles.contextItem} onPress={handleKillPress}>
                    <View style={styles.contextItemWithIcon}>
                      <Icon name="skull" size={14} color="#EF5350" style={styles.contextIcon} />
                      <Text style={[styles.contextText, styles.contextDanger]}>{t('KILL (with reason)')}</Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <View style={styles.contextDivider} />
            <TouchableOpacity style={styles.contextItem} onPress={() => setShowE2EGroup(prev => !prev)}>
              <View style={styles.contextItemWithIcon}>
                <Icon name="lock" size={14} color={colors.text} style={styles.contextIcon} />
                <Text style={styles.contextText}>
                  {showE2EGroup ? t('E2E Encryption v') : t('E2E Encryption >')}
                </Text>
              </View>
            </TouchableOpacity>
            {showE2EGroup && (
              <View style={styles.contextSubGroup}>
                <TouchableOpacity style={styles.contextItem} onPress={() => onAction('enc_share')}>
                  <View style={styles.contextItemWithIcon}>
                    <Icon name="key" size={14} color={colors.text} style={styles.contextIcon} />
                    <Text style={styles.contextText}>{t('Share DM Key')}</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.contextItem} onPress={() => onAction('enc_request')}>
                  <View style={styles.contextItemWithIcon}>
                    <Icon name="sync" size={14} color={colors.text} style={styles.contextIcon} />
                    <Text style={styles.contextText}>{t('Request DM Key (36s)')}</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.contextItem} onPress={() => onAction('enc_verify')}>
                  <View style={styles.contextItemWithIcon}>
                    <Icon name="check-circle" size={14} color={colors.text} style={styles.contextIcon} />
                    <Text style={styles.contextText}>{t('Verify DM Key')}</Text>
                  </View>
                </TouchableOpacity>
                {allowQrVerification && (
                  <>
                    <TouchableOpacity style={styles.contextItem} onPress={() => onAction('enc_qr_show_bundle')}>
                      <View style={styles.contextItemWithIcon}>
                        <Icon name="qrcode" size={14} color={colors.text} style={styles.contextIcon} />
                        <Text style={styles.contextText}>{t('Share Key Bundle QR')}</Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.contextItem} onPress={() => onAction('enc_qr_show_fingerprint')}>
                      <View style={styles.contextItemWithIcon}>
                        <Icon name="fingerprint" size={14} color={colors.text} style={styles.contextIcon} />
                        <Text style={styles.contextText}>{t('Show Fingerprint QR (Verify)')}</Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.contextItem} onPress={() => onAction('enc_qr_scan')}>
                      <View style={styles.contextItemWithIcon}>
                        <Icon name="camera" size={14} color={colors.text} style={styles.contextIcon} />
                        <Text style={styles.contextText}>{t('Scan QR Code')}</Text>
                      </View>
                    </TouchableOpacity>
                  </>
                )}
                {allowFileExchange && (
                  <>
                    <TouchableOpacity style={styles.contextItem} onPress={() => onAction('enc_share_file')}>
                      <View style={styles.contextItemWithIcon}>
                        <Icon name="file-export" size={14} color={colors.text} style={styles.contextIcon} />
                        <Text style={styles.contextText}>{t('Share Key File')}</Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.contextItem} onPress={() => onAction('enc_import_file')}>
                      <View style={styles.contextItemWithIcon}>
                        <Icon name="file-import" size={14} color={colors.text} style={styles.contextIcon} />
                        <Text style={styles.contextText}>{t('Import Key File')}</Text>
                      </View>
                    </TouchableOpacity>
                  </>
                )}
                {allowNfcExchange && (
                  <>
                    <TouchableOpacity style={styles.contextItem} onPress={() => onAction('enc_share_nfc')}>
                      <View style={styles.contextItemWithIcon}>
                        <Icon name="wifi" size={14} color={colors.text} style={styles.contextIcon} />
                        <Text style={styles.contextText}>{t('Share via NFC')}</Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.contextItem} onPress={() => onAction('enc_receive_nfc')}>
                      <View style={styles.contextItemWithIcon}>
                        <Icon name="wifi" size={14} color={colors.text} style={styles.contextIcon} />
                        <Text style={styles.contextText}>{t('Receive via NFC')}</Text>
                      </View>
                    </TouchableOpacity>
                  </>
                )}
                {channel && (
                  <>
                    <TouchableOpacity style={styles.contextItem} onPress={() => onAction('chan_share')}>
                      <View style={styles.contextItemWithIcon}>
                        <Icon name="key" size={14} color={colors.text} style={styles.contextIcon} />
                        <Text style={styles.contextText}>{t('Share Channel Key')}</Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.contextItem} onPress={() => onAction('chan_request')}>
                      <View style={styles.contextItemWithIcon}>
                        <Icon name="sync" size={14} color={colors.text} style={styles.contextIcon} />
                        <Text style={styles.contextText}>{t('Request Channel Key')}</Text>
                      </View>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}

            {(isCurrentUserOp || isCurrentUserHalfOp) && (
              <>
                <View style={styles.contextDivider} />
                <TouchableOpacity style={styles.contextItem} onPress={() => setShowOpsGroup(prev => !prev)}>
                  <View style={styles.contextItemWithIcon}>
                    <Icon name="user-shield" size={14} color={colors.text} style={styles.contextIcon} />
                    <Text style={styles.contextText}>
                      {showOpsGroup ? t('Operator Controls v') : t('Operator Controls >')}
                    </Text>
                  </View>
                </TouchableOpacity>
                {showOpsGroup && (
                  <View style={styles.contextSubGroup}>
                    {isCurrentUserHalfOp && (
                      <>
                        {targetUser?.modes.includes('v') ? (
                          <TouchableOpacity style={styles.contextItem} onPress={() => onAction('take_voice')}>
                            <View style={styles.contextItemWithIcon}>
                              <Icon name="microphone-slash" size={14} color={colors.text} style={styles.contextIcon} />
                              <Text style={styles.contextText}>{t('Take Voice')}</Text>
                            </View>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity style={styles.contextItem} onPress={() => onAction('give_voice')}>
                            <View style={styles.contextItemWithIcon}>
                              <Icon name="microphone" size={14} color={colors.text} style={styles.contextIcon} />
                              <Text style={styles.contextText}>{t('Give Voice')}</Text>
                            </View>
                          </TouchableOpacity>
                        )}
                      </>
                    )}
                    {isCurrentUserOp && (
                      <>
                        {targetUser?.modes.includes('h') ? (
                          <TouchableOpacity style={styles.contextItem} onPress={() => onAction('take_halfop')}>
                            <View style={styles.contextItemWithIcon}>
                              <Icon name="user-minus" size={14} color={colors.text} style={styles.contextIcon} />
                              <Text style={styles.contextText}>{t('Take Half-Op')}</Text>
                            </View>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity style={styles.contextItem} onPress={() => onAction('give_halfop')}>
                            <View style={styles.contextItemWithIcon}>
                              <Icon name="user-plus" size={14} color={colors.text} style={styles.contextIcon} />
                              <Text style={styles.contextText}>{t('Give Half-Op')}</Text>
                            </View>
                          </TouchableOpacity>
                        )}
                        {targetUser?.modes.includes('o') ? (
                          <TouchableOpacity style={styles.contextItem} onPress={() => onAction('take_op')}>
                            <View style={styles.contextItemWithIcon}>
                              <Icon name="user-times" size={14} color={colors.text} style={styles.contextIcon} />
                              <Text style={styles.contextText}>{t('Take Op')}</Text>
                            </View>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity style={styles.contextItem} onPress={() => onAction('give_op')}>
                            <View style={styles.contextItemWithIcon}>
                              <Icon name="user-check" size={14} color={colors.text} style={styles.contextIcon} />
                              <Text style={styles.contextText}>{t('Give Op')}</Text>
                            </View>
                          </TouchableOpacity>
                        )}
                      </>
                    )}
                    {canKickBan && (
                      <>
                        <TouchableOpacity style={styles.contextItem} onPress={() => handleKickBanPress('kick', false)}>
                          <View style={styles.contextItemWithIcon}>
                            <Icon name="sign-out-alt" size={14} color="#FB8C00" style={styles.contextIcon} />
                            <Text style={[styles.contextText, styles.contextWarning]}>{t('Kick')}</Text>
                          </View>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.contextItem} onPress={() => handleKickBanPress('kick', true)}>
                          <View style={styles.contextItemWithIcon}>
                            <Icon name="sign-out-alt" size={14} color="#FB8C00" style={styles.contextIcon} />
                            <Text style={[styles.contextText, styles.contextWarning]}>{t('Kick (with message)')}</Text>
                          </View>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.contextItem} onPress={() => handleKickBanPress('ban', false)}>
                          <View style={styles.contextItemWithIcon}>
                            <Icon name="ban" size={14} color="#EF5350" style={styles.contextIcon} />
                            <Text style={[styles.contextText, styles.contextDanger]}>{t('Ban')}</Text>
                          </View>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.contextItem} onPress={() => handleKickBanPress('kickban', false)}>
                          <View style={styles.contextItemWithIcon}>
                            <Icon name="times-circle" size={14} color="#EF5350" style={styles.contextIcon} />
                            <Text style={[styles.contextText, styles.contextDanger]}>{t('Kick + Ban')}</Text>
                          </View>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.contextItem} onPress={() => handleKickBanPress('kickban', true)}>
                          <View style={styles.contextItemWithIcon}>
                            <Icon name="times-circle" size={14} color="#EF5350" style={styles.contextIcon} />
                            <Text style={[styles.contextText, styles.contextDanger]}>{t('Kick + Ban (with message)')}</Text>
                          </View>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                )}
              </>
            )}

            {/* IRC Service Commands */}
            {serviceCommands.length > 0 && (
              <>
                <View style={styles.contextDivider} />
                <TouchableOpacity style={styles.contextItem} onPress={() => setShowServiceGroup(prev => !prev)}>
                  <View style={styles.contextItemWithIcon}>
                    <Icon name="server" size={14} color={colors.text} style={styles.contextIcon} />
                    <Text style={styles.contextText}>
                      {showServiceGroup ? t('IRC Services v') : t('IRC Services >')}
                    </Text>
                  </View>
                </TouchableOpacity>
                {showServiceGroup && (
                  <View style={styles.contextSubGroup}>
                    {serviceCommands.map(({ command, serviceNick }) => (
                      <TouchableOpacity 
                        key={`${serviceNick}-${command.name}`} 
                        style={styles.contextItem} 
                        onPress={() => {
                          const cmdText = `/${serviceNick} ${command.name} ${nick}`;
                          activeIrc.sendRaw(`PRIVMSG ${serviceNick} :${command.name} ${nick}`);
                          onClose();
                        }}>
                        <View style={styles.contextItemWithIcon}>
                          <Icon name="chevron-right" size={14} color={colors.textSecondary} style={styles.contextIcon} />
                          <Text style={styles.contextText}>{serviceNick} {command.name}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity style={styles.contextItem} onPress={() => onAction('show_all_commands')}>
                      <View style={styles.contextItemWithIcon}>
                        <Icon name="dots-horizontal" size={14} color={colors.primary} style={styles.contextIcon} />
                        <Text style={[styles.contextText, { color: colors.primary }]}>{t('Show All Commands...')}</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}

            <View style={styles.contextDivider} />
            <TouchableOpacity style={styles.contextItem} onPress={() => setShowCTCPGroup(prev => !prev)}>
              <View style={styles.contextItemWithIcon}>
                <Icon name="comment-alt" size={14} color={colors.text} style={styles.contextIcon} />
                <Text style={styles.contextText}>
                  {showCTCPGroup ? t('CTCP + DCC v') : t('CTCP + DCC >')}
                </Text>
              </View>
            </TouchableOpacity>
            {showCTCPGroup && (
              <View style={styles.contextSubGroup}>
                <TouchableOpacity style={styles.contextItem} onPress={() => onAction('ctcp_ping')}>
                  <View style={styles.contextItemWithIcon}>
                    <Icon name="ping-pong" size={14} color={colors.text} style={styles.contextIcon} />
                    <Text style={styles.contextText}>{t('CTCP PING')}</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.contextItem} onPress={() => onAction('ctcp_version')}>
                  <View style={styles.contextItemWithIcon}>
                    <Icon name="tag" size={14} color={colors.text} style={styles.contextIcon} />
                    <Text style={styles.contextText}>{t('CTCP VERSION')}</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.contextItem} onPress={() => onAction('ctcp_time')}>
                  <View style={styles.contextItemWithIcon}>
                    <Icon name="clock" size={14} color={colors.text} style={styles.contextIcon} />
                    <Text style={styles.contextText}>{t('CTCP TIME')}</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.contextItem} onPress={() => onAction('dcc_chat')}>
                  <View style={styles.contextItemWithIcon}>
                    <Icon name="comments" size={14} color={colors.text} style={styles.contextIcon} />
                    <Text style={styles.contextText}>{t('Start DCC Chat')}</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.contextItem} onPress={() => onAction('dcc_send')}>
                  <View style={styles.contextItemWithIcon}>
                    <Icon name="paper-plane" size={14} color={colors.text} style={styles.contextIcon} />
                    <Text style={styles.contextText}>{t('Offer DCC Send')}</Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
          <View style={styles.contextFooter}>
            <TouchableOpacity style={styles.contextFooterButton} onPress={onClose}>
              <Text style={styles.contextCancel}>{t('Close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>

        <KickBanModal
          visible={showKickBanModal}
          onClose={() => setShowKickBanModal(false)}
        onConfirm={(options) => {
          console.log('🔥 KickBanModal onConfirm called:', options);
          // Execute kick/ban directly
          if (!channel || !nick) {
            console.log('❌ No channel or nick');
            return;
          }
          
          const user = userHostInfo?.user || targetUser?.nick || '';
          const host = userHostInfo?.host || targetUser?.host || '';
          const banMask = user && host 
            ? banService.generateBanMask(nick, user, host, options.banType)
            : `${nick}!*@*`;
          
          // Apply ban first (if requested)
          if (options.ban) {
            const banCmd = `MODE ${channel} +b ${banMask}`;
            console.log('📤 Sending ban:', banCmd);
            activeIrc.sendRaw(banCmd);
          }
          
          // Then kick (if requested)  
          if (options.kick) {
            const kickReason = options.reason?.trim() || 'Goodbye';
            const kickCmd = `KICK ${channel} ${nick} :${kickReason}`;
            console.log('📤 Sending kick:', kickCmd);
            activeIrc.sendRaw(kickCmd);
          }
          
          // Schedule unban if requested
          if (options.ban && options.unbanAfterSeconds && options.unbanAfterSeconds > 0) {
            setTimeout(() => {
              activeIrc.sendRaw(`MODE ${channel} -b ${banMask}`);
            }, options.unbanAfterSeconds * 1000);
          }
          
          setShowKickBanModal(false);
        }}
        nick={nick || ''}
        userHost={userHostInfo ? `${userHostInfo.user}@${userHostInfo.host}` : (targetUser?.host ? `${targetUser.nick}@${targetUser.host}` : undefined)}
        mode={kickBanMode}
        colors={{
          background: colors.surface,
          text: colors.text,
          accent: colors.primary,
          border: colors.border,
          inputBackground: colors.background,
          }}
        />
        <Modal
          visible={showKillReasonModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowKillReasonModal(false)}
        >
          <TouchableOpacity style={styles.contextOverlay} activeOpacity={1} onPress={() => setShowKillReasonModal(false)}>
            <View style={styles.contextBox}>
              <View style={styles.contextHeaderRow}>
                <View style={styles.contextHeaderText}>
                  <Text style={styles.contextTitle}>{t('KILL {nick}').replace('{nick}', nick || '')}</Text>
                  <Text style={styles.contextSubtitle}>{t('Enter reason')}</Text>
                </View>
              </View>
              <View style={{ padding: 12 }}>
                <TextInput
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    color: colors.text,
                    backgroundColor: colors.background,
                  }}
                  placeholder={t('Enter reason')}
                  placeholderTextColor={colors.textSecondary}
                  value={killReason}
                  onChangeText={setKillReason}
                  autoFocus
                />
              </View>
              <View style={[styles.contextFooter, { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }]}>
                <TouchableOpacity style={styles.contextFooterButton} onPress={() => setShowKillReasonModal(false)}>
                  <Text style={styles.contextCancel}>{t('Cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.contextFooterButton, { backgroundColor: colors.primary, borderColor: colors.primary }]}
                  onPress={() => {
                    const trimmed = killReason.trim();
                    if (!trimmed) {
                      Alert.alert(t('Error'), t('Reason is required'));
                      return;
                    }
                    if (nick) {
                      activeIrc.sendCommand(`KILL ${nick} :${trimmed}`);
                    }
                    setShowKillReasonModal(false);
                    onClose();
                  }}
                >
                  <Text style={{ color: colors.onPrimary || '#fff', fontWeight: '600' }}>{t('Send')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      </Modal>
    );
  };

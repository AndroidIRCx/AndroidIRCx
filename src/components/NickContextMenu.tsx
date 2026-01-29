/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { useT } from '../i18n/transifex';
import { ircService, ChannelUser } from '../services/IRCService';
import { userManagementService } from '../services/UserManagementService';

interface NickContextMenuProps {
  visible: boolean;
  nick?: string | null;
  onClose: () => void;
  onAction: (action: string) => void;
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
  const [showOpsGroup, setShowOpsGroup] = useState(false);
  const [showUserListGroup, setShowUserListGroup] = useState(false);

  useEffect(() => {
    if (!visible) {
      setShowE2EGroup(false);
      setShowCTCPGroup(false);
      setShowOpsGroup(false);
      setShowUserListGroup(false);
    }
  }, [visible, nick]);

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
              {targetUser?.account && targetUser.account !== '*' && (
                <Text style={styles.contextSubtitle}>{t('Account: {account}').replace('{account}', targetUser.account)}</Text>
              )}
            </View>
            <TouchableOpacity style={styles.contextCopyButton} onPress={() => onAction('copy')}>
              <Icon name="copy" size={12} color={colors.primary} />
              <Text style={styles.contextCopyText}>{t('Copy nickname')}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.contextScroll} contentContainerStyle={styles.contextScrollContent}>
            <Text style={styles.contextGroupTitle}>{t('Quick Actions')}</Text>
            <TouchableOpacity style={styles.contextItem} onPress={() => onAction('whois')}>
              <Text style={styles.contextText}>{t('WHOIS')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.contextItem} onPress={() => onAction('query')}>
              <Text style={styles.contextText}>{t('Open Query')}</Text>
            </TouchableOpacity>
            {canMonitor && (
              <TouchableOpacity style={styles.contextItem} onPress={() => onAction('monitor_toggle')}>
                <Text style={styles.contextText}>{isMonitoring ? t('Unmonitor Nick') : t('Monitor Nick')}</Text>
              </TouchableOpacity>
            )}

            <View style={styles.contextDivider} />
            <TouchableOpacity style={styles.contextItem} onPress={() => setShowUserListGroup(prev => !prev)}>
              <Text style={styles.contextText}>
                {showUserListGroup ? t('User list v') : t('User list >')}
              </Text>
            </TouchableOpacity>
            {showUserListGroup && (
              <View style={styles.contextSubGroup}>
                <TouchableOpacity style={styles.contextItem} onPress={() => onAction(ignoreActionId)}>
                  <Text style={styles.contextText}>{isIgnored ? t('Unignore User') : t('Ignore User')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.contextItem} onPress={() => onAction('blacklist')}>
                  <Text style={styles.contextText}>{t('Add to Blacklist')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.contextItem} onPress={() => onAction('add_note')}>
                  <Text style={styles.contextText}>
                    {userManagementService.getUserNote(nick || '', network) ? t('Edit Note') : t('Add Note')}
                  </Text>
                </TouchableOpacity>
                {isServerOper && (
                  <TouchableOpacity style={styles.contextItem} onPress={() => onAction('kill')}>
                    <Text style={[styles.contextText, styles.contextDanger]}>{t('KILL (with reason)')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <View style={styles.contextDivider} />
            <TouchableOpacity style={styles.contextItem} onPress={() => setShowE2EGroup(prev => !prev)}>
              <Text style={styles.contextText}>
                {showE2EGroup ? t('E2E Encryption v') : t('E2E Encryption >')}
              </Text>
            </TouchableOpacity>
            {showE2EGroup && (
              <View style={styles.contextSubGroup}>
                <TouchableOpacity style={styles.contextItem} onPress={() => onAction('enc_share')}>
                  <Text style={styles.contextText}>{t('Share DM Key')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.contextItem} onPress={() => onAction('enc_request')}>
                  <Text style={styles.contextText}>{t('Request DM Key (36s)')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.contextItem} onPress={() => onAction('enc_verify')}>
                  <Text style={styles.contextText}>{t('Verify DM Key')}</Text>
                </TouchableOpacity>
                {allowQrVerification && (
                  <>
                    <TouchableOpacity style={styles.contextItem} onPress={() => onAction('enc_qr_show_bundle')}>
                      <Text style={styles.contextText}>{t('Share Key Bundle QR')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.contextItem} onPress={() => onAction('enc_qr_show_fingerprint')}>
                      <Text style={styles.contextText}>{t('Show Fingerprint QR (Verify)')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.contextItem} onPress={() => onAction('enc_qr_scan')}>
                      <Text style={styles.contextText}>{t('Scan QR Code')}</Text>
                    </TouchableOpacity>
                  </>
                )}
                {allowFileExchange && (
                  <>
                    <TouchableOpacity style={styles.contextItem} onPress={() => onAction('enc_share_file')}>
                      <Text style={styles.contextText}>{t('Share Key File')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.contextItem} onPress={() => onAction('enc_import_file')}>
                      <Text style={styles.contextText}>{t('Import Key File')}</Text>
                    </TouchableOpacity>
                  </>
                )}
                {allowNfcExchange && (
                  <>
                    <TouchableOpacity style={styles.contextItem} onPress={() => onAction('enc_share_nfc')}>
                      <Text style={styles.contextText}>{t('Share via NFC')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.contextItem} onPress={() => onAction('enc_receive_nfc')}>
                      <Text style={styles.contextText}>{t('Receive via NFC')}</Text>
                    </TouchableOpacity>
                  </>
                )}
                {channel && (
                  <>
                    <TouchableOpacity style={styles.contextItem} onPress={() => onAction('chan_share')}>
                      <Text style={styles.contextText}>{t('Share Channel Key')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.contextItem} onPress={() => onAction('chan_request')}>
                      <Text style={styles.contextText}>{t('Request Channel Key')}</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}

            {(isCurrentUserOp || isCurrentUserHalfOp) && (
              <>
                <View style={styles.contextDivider} />
                <TouchableOpacity style={styles.contextItem} onPress={() => setShowOpsGroup(prev => !prev)}>
                  <Text style={styles.contextText}>
                    {showOpsGroup ? t('Operator Controls v') : t('Operator Controls >')}
                  </Text>
                </TouchableOpacity>
                {showOpsGroup && (
                  <View style={styles.contextSubGroup}>
                    {isCurrentUserHalfOp && (
                      <>
                        {targetUser?.modes.includes('v') ? (
                          <TouchableOpacity style={styles.contextItem} onPress={() => onAction('take_voice')}>
                            <Text style={styles.contextText}>{t('Take Voice')}</Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity style={styles.contextItem} onPress={() => onAction('give_voice')}>
                            <Text style={styles.contextText}>{t('Give Voice')}</Text>
                          </TouchableOpacity>
                        )}
                      </>
                    )}
                    {isCurrentUserOp && (
                      <>
                        {targetUser?.modes.includes('h') ? (
                          <TouchableOpacity style={styles.contextItem} onPress={() => onAction('take_halfop')}>
                            <Text style={styles.contextText}>{t('Take Half-Op')}</Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity style={styles.contextItem} onPress={() => onAction('give_halfop')}>
                            <Text style={styles.contextText}>{t('Give Half-Op')}</Text>
                          </TouchableOpacity>
                        )}
                        {targetUser?.modes.includes('o') ? (
                          <TouchableOpacity style={styles.contextItem} onPress={() => onAction('take_op')}>
                            <Text style={styles.contextText}>{t('Take Op')}</Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity style={styles.contextItem} onPress={() => onAction('give_op')}>
                            <Text style={styles.contextText}>{t('Give Op')}</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity style={styles.contextItem} onPress={() => onAction('kick')}>
                          <Text style={[styles.contextText, styles.contextWarning]}>{t('Kick')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.contextItem} onPress={() => onAction('kick_message')}>
                          <Text style={[styles.contextText, styles.contextWarning]}>{t('Kick (with message)')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.contextItem} onPress={() => onAction('ban')}>
                          <Text style={[styles.contextText, styles.contextDanger]}>{t('Ban')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.contextItem} onPress={() => onAction('kick_ban')}>
                          <Text style={[styles.contextText, styles.contextDanger]}>{t('Kick + Ban')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.contextItem} onPress={() => onAction('kick_ban_message')}>
                          <Text style={[styles.contextText, styles.contextDanger]}>{t('Kick + Ban (with message)')}</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                )}
              </>
            )}

            <View style={styles.contextDivider} />
            <TouchableOpacity style={styles.contextItem} onPress={() => setShowCTCPGroup(prev => !prev)}>
              <Text style={styles.contextText}>
                {showCTCPGroup ? t('CTCP + DCC v') : t('CTCP + DCC >')}
              </Text>
            </TouchableOpacity>
            {showCTCPGroup && (
              <View style={styles.contextSubGroup}>
                <TouchableOpacity style={styles.contextItem} onPress={() => onAction('ctcp_ping')}>
                  <Text style={styles.contextText}>{t('CTCP PING')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.contextItem} onPress={() => onAction('ctcp_version')}>
                  <Text style={styles.contextText}>{t('CTCP VERSION')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.contextItem} onPress={() => onAction('ctcp_time')}>
                  <Text style={styles.contextText}>{t('CTCP TIME')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.contextItem} onPress={() => onAction('dcc_chat')}>
                  <Text style={styles.contextText}>{t('Start DCC Chat')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.contextItem} onPress={() => onAction('dcc_send')}>
                  <Text style={styles.contextText}>{t('Offer DCC Send')}</Text>
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
    </Modal>
  );
};

/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React, { useEffect, useMemo } from 'react';
import { Modal, TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { useT } from '../i18n/transifex';
import { useTheme } from '../hooks/useTheme';
import { useUIStore } from '../stores/uiStore';
import { connectionManager } from '../services/ConnectionManager';
import { sortTabsGrouped } from '../utils/tabUtils';
import { ChannelTab } from '../types';

interface OptionsMenuProps {
  visible: boolean;
  onClose: () => void;
  isConnected: boolean;
  networkName: string;
  focusedNetworkId: string | null;
  showRawCommands: boolean;
  setTabs: (updater: (prev: ChannelTab[]) => ChannelTab[]) => void;
  tabSortAlphabetical: boolean;
  handleConnect: () => void;
  handleExit: () => void;
  persistentSetShowRawCommands: (value: boolean) => void;
  setActiveConnectionId: (id: string | null) => void;
  styles: any;
}

export const OptionsMenu: React.FC<OptionsMenuProps> = ({
  visible,
  onClose,
  isConnected,
  networkName,
  focusedNetworkId,
  showRawCommands,
  setTabs,
  tabSortAlphabetical,
  handleConnect,
  handleExit,
  persistentSetShowRawCommands,
  setActiveConnectionId,
  styles,
}) => {
  const t = useT();
  const { colors } = useTheme();
  const uiStore = useUIStore.getState();
  const iconColor = styles?.optionText?.color || colors.text || '#000000';
  const destructiveColor = styles?.destructiveOption?.color || colors.error || '#EF5350';
  const localStyles = useMemo(() => StyleSheet.create({
    menuBox: {
      backgroundColor: styles?.optionsMenu?.backgroundColor || colors.surface || '#FFFFFF',
      borderRadius: 12,
      elevation: 24,
      width: 300,
      maxWidth: '92%',
      padding: 6,
      overflow: 'hidden',
      zIndex: 1000,
      borderWidth: 1,
      borderColor: colors.border || '#2A2A2A',
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 8,
    },
    optionGroupDivider: {
      height: 1,
      backgroundColor: colors.border || '#2A2A2A',
      marginVertical: 4,
      opacity: 0.6,
    },
    optionText: {
      color: styles?.optionText?.color || colors.text || '#FFFFFF',
      fontSize: 14,
      fontWeight: '500',
    },
    optionTextDanger: {
      color: destructiveColor,
    },
  }), [colors, destructiveColor, styles]);

  const handleJoinChannel = () => {
    onClose();
    uiStore.setShowChannelModal(true);
  };

  const handleCloseAllChannels = () => {
    onClose();
    setTabs(prev => sortTabsGrouped(
      prev.filter(t => !(focusedNetworkId && t.networkId === focusedNetworkId && t.type === 'channel')),
      tabSortAlphabetical
    ));
  };

  const handleCloseAllPrivates = () => {
    onClose();
    setTabs(prev => sortTabsGrouped(
      prev.filter(t => !(focusedNetworkId && t.networkId === focusedNetworkId && t.type === 'query')),
      tabSortAlphabetical
    ));
  };

  const handleDisconnect = () => {
    onClose();
    if (focusedNetworkId) {
      connectionManager.disconnect(focusedNetworkId);
      setActiveConnectionId(connectionManager.getActiveNetworkId());
    }
  };

  const handleConnectAnother = () => {
    onClose();
    uiStore.setShowNetworksList(true);
  };

  const handleBrowseChannels = () => {
    onClose();
    uiStore.setShowChannelList(true);
  };

  const handleConnectDefault = () => {
    onClose();
    handleConnect();
  };

  const handleDccTransfers = () => {
    onClose();
    uiStore.setShowDccTransfers(true);
  };

  const handleToggleRaw = () => {
    onClose();
    persistentSetShowRawCommands(!showRawCommands);
  };

  const handleExitApp = () => {
    onClose();
    handleExit();
  };

  // Debug logging
  useEffect(() => {
    console.log('🔍 OptionsMenu: visible prop =', visible, 'styles =', !!styles);
    if (visible) {
      console.log('🔍 OptionsMenu: Modal should be visible now!');
      console.log('🔍 OptionsMenu: styles.optionsMenu =', styles?.optionsMenu);
    }
  }, [visible, styles]);

  // Always render Modal to ensure proper mounting on Android
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent={false}
      hardwareAccelerated={true}>
      <View 
        style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          justifyContent: 'center',
          alignItems: 'center',
        }}
        pointerEvents="box-none">
        <TouchableOpacity 
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
          activeOpacity={1}
          onPress={onClose}
        />
        <View 
          style={localStyles.menuBox}
          pointerEvents="box-none">
          <View pointerEvents="auto">
            {isConnected ? (
              <>
                <TouchableOpacity style={styles?.optionItem} onPress={handleJoinChannel}>
                  <View style={localStyles.optionRow}>
                    <Icon name="hashtag" size={14} color={iconColor} />
                    <Text style={localStyles.optionText}>{t('Join Channel')}</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles?.optionItem} onPress={handleCloseAllChannels}>
                  <View style={localStyles.optionRow}>
                    <Icon name="times-circle" size={14} color={iconColor} />
                    <Text style={localStyles.optionText}>{t('Close All Channels')}</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles?.optionItem} onPress={handleCloseAllPrivates}>
                  <View style={localStyles.optionRow}>
                    <Icon name="comment-slash" size={14} color={iconColor} />
                    <Text style={localStyles.optionText}>{t('Close All Privates')}</Text>
                  </View>
                </TouchableOpacity>
                <View style={localStyles.optionGroupDivider} />
                <TouchableOpacity style={styles?.optionItem} onPress={handleDisconnect}>
                  <View style={localStyles.optionRow}>
                    <Icon name="power-off" size={14} color={destructiveColor} />
                    <Text style={[localStyles.optionText, localStyles.optionTextDanger]}>
                      {networkName ? t('Disconnect {network}', { network: networkName }) : t('Disconnect')}
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles?.optionItem} onPress={handleConnectAnother}>
                  <View style={localStyles.optionRow}>
                    <Icon name="network-wired" size={14} color={iconColor} />
                    <Text style={localStyles.optionText}>{t('Connect Another Network')}</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles?.optionItem} onPress={handleBrowseChannels}>
                  <View style={localStyles.optionRow}>
                    <Icon name="list" size={14} color={iconColor} />
                    <Text style={localStyles.optionText}>{t('Browse Channels')}</Text>
                  </View>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity style={styles?.optionItem} onPress={handleConnectDefault}>
                  <View style={localStyles.optionRow}>
                    <Icon name="plug" size={14} color={iconColor} />
                    <Text style={localStyles.optionText}>{t('Connect to Default')}</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles?.optionItem} onPress={handleConnectAnother}>
                  <View style={localStyles.optionRow}>
                    <Icon name="network-wired" size={14} color={iconColor} />
                    <Text style={localStyles.optionText}>{t('Choose Network')}</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles?.optionItem} onPress={handleCloseAllChannels}>
                  <View style={localStyles.optionRow}>
                    <Icon name="times-circle" size={14} color={iconColor} />
                    <Text style={localStyles.optionText}>{t('Close All Channels')}</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles?.optionItem} onPress={handleCloseAllPrivates}>
                  <View style={localStyles.optionRow}>
                    <Icon name="comment-slash" size={14} color={iconColor} />
                    <Text style={localStyles.optionText}>{t('Close All Privates')}</Text>
                  </View>
                </TouchableOpacity>
              </>
            )}
            <View style={localStyles.optionGroupDivider} />
            <TouchableOpacity style={styles?.optionItem} onPress={handleDccTransfers}>
              <View style={localStyles.optionRow}>
                <Icon name="exchange-alt" size={14} color={iconColor} />
                <Text style={localStyles.optionText}>{t('DCC Transfers')}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles?.optionItem} onPress={handleToggleRaw}>
              <View style={localStyles.optionRow}>
                <Icon name="terminal" size={14} color={iconColor} />
                <Text style={localStyles.optionText}>{showRawCommands ? t('Hide RAW') : t('Show RAW')}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles?.optionItem} onPress={handleExitApp}>
              <View style={localStyles.optionRow}>
                <Icon name="door-open" size={14} color={destructiveColor} />
                <Text style={[localStyles.optionText, localStyles.optionTextDanger]}>{t('Exit')}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles?.optionItem} onPress={onClose}>
              <View style={localStyles.optionRow}>
                <Icon name="times" size={14} color={iconColor} />
                <Text style={localStyles.optionText}>{t('Cancel')}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

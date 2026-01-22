import React, { useEffect } from 'react';
import { Modal, TouchableOpacity, View, Text } from 'react-native';
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
  const uiStore = useUIStore.getState();

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
          style={{
            backgroundColor: styles?.optionsMenu?.backgroundColor || '#FFFFFF',
            borderRadius: 8,
            elevation: 24,
            width: 280,
            maxWidth: '90%',
            padding: 0,
            overflow: 'hidden',
            zIndex: 1000,
          }}
          pointerEvents="box-none">
          <View pointerEvents="auto">
            {isConnected ? (
              <>
                <TouchableOpacity style={styles?.optionItem} onPress={handleJoinChannel}>
                  <Text style={styles?.optionText}>Join Channel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles?.optionItem} onPress={handleCloseAllChannels}>
                  <Text style={styles?.optionText}>Close All Channels</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles?.optionItem} onPress={handleCloseAllPrivates}>
                  <Text style={styles?.optionText}>Close All Privates</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles?.optionItem} onPress={handleDisconnect}>
                  <Text style={[styles?.optionText, styles?.destructiveOption]}>
                    {`Disconnect ${networkName || ''}`}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles?.optionItem} onPress={handleConnectAnother}>
                  <Text style={styles?.optionText}>Connect Another Network</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles?.optionItem} onPress={handleBrowseChannels}>
                  <Text style={styles?.optionText}>Browse Channels</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity style={styles?.optionItem} onPress={handleConnectDefault}>
                  <Text style={styles?.optionText}>Connect to Default</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles?.optionItem} onPress={handleConnectAnother}>
                  <Text style={styles?.optionText}>Choose Network</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles?.optionItem} onPress={handleCloseAllChannels}>
                  <Text style={styles?.optionText}>Close All Channels</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles?.optionItem} onPress={handleCloseAllPrivates}>
                  <Text style={styles?.optionText}>Close All Privates</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity style={styles?.optionItem} onPress={handleDccTransfers}>
              <Text style={styles?.optionText}>DCC Transfers</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles?.optionItem} onPress={handleToggleRaw}>
              <Text style={styles?.optionText}>{showRawCommands ? 'Hide RAW' : 'Show RAW'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles?.optionItem} onPress={handleExitApp}>
              <Text style={[styles?.optionText, styles?.destructiveOption]}>Exit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles?.optionItem} onPress={onClose}>
              <Text style={styles?.optionText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  Alert,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Camera, useCameraDevice, useCameraPermission, useCodeScanner } from 'react-native-vision-camera';
import Share from 'react-native-share';
import RNFS from 'react-native-fs';
import DocumentPicker from 'react-native-document-picker';
import NfcManager, { Ndef, NfcTech } from 'react-native-nfc-manager';
import { ChannelUser } from '../services/IRCService';
import { ircService } from '../services/IRCService';
import { userManagementService } from '../services/UserManagementService';
import { connectionManager } from '../services/ConnectionManager';
import { dccChatService } from '../services/DCCChatService';
import { useTheme } from '../hooks/useTheme';
import { encryptedDMService } from '../services/EncryptedDMService';
import { channelEncryptionService } from '../services/ChannelEncryptionService';
import { settingsService } from '../services/SettingsService';
import Clipboard from '@react-native-clipboard/clipboard';

export const copyNickToClipboard = (nick: string): string => {
  Clipboard.setString(nick);
  return `Copied ${nick}`;
};

interface UserListProps {
  users: ChannelUser[];
  channelName?: string;
  network?: string;
  onUserPress?: (user: ChannelUser) => void;
  onWHOISPress?: (nick: string) => void;
  position?: 'left' | 'right' | 'top' | 'bottom';
}

export const UserList: React.FC<UserListProps> = ({ 
  users, 
  channelName,
  network,
  onUserPress,
  onWHOISPress,
  position = 'right',
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<ChannelUser | null>(null);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [showE2EGroup, setShowE2EGroup] = useState(false);
  const [showCTCPGroup, setShowCTCPGroup] = useState(false);
  const [showOpsGroup, setShowOpsGroup] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [allowQrVerification, setAllowQrVerification] = useState(true);
  const [allowFileExchange, setAllowFileExchange] = useState(true);
  const [allowNfcExchange, setAllowNfcExchange] = useState(true);
  const [showKeyQr, setShowKeyQr] = useState(false);
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [showKeyScan, setShowKeyScan] = useState(false);
  const [scanError, setScanError] = useState('');
  const device = useCameraDevice('back');
  const { hasPermission: hasCameraPermission, requestPermission: requestCameraPermission } = useCameraPermission();
  const scanHandledRef = useRef(false);
  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: (codes) => {
      if (!showKeyScan || scanHandledRef.current) return;
      const code = codes[0]?.value || codes[0]?.rawValue;
      if (!code) return;
      scanHandledRef.current = true;
      setShowKeyScan(false);
      setScanError('');
      handleExternalPayload(code);
    },
  });

  useEffect(() => {
    if (!actionMessage) return;
    const timer = setTimeout(() => setActionMessage(''), 1500);
    return () => clearTimeout(timer);
  }, [actionMessage]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const qr = await settingsService.getSetting('securityAllowQrVerification', true);
      const file = await settingsService.getSetting('securityAllowFileExchange', true);
      const nfc = await settingsService.getSetting('securityAllowNfcExchange', true);
      if (mounted) {
        setAllowQrVerification(qr);
        setAllowFileExchange(file);
        setAllowNfcExchange(nfc);
      }
    };
    load();
    const unsubQr = settingsService.onSettingChange('securityAllowQrVerification', (v) => setAllowQrVerification(Boolean(v)));
    const unsubFile = settingsService.onSettingChange('securityAllowFileExchange', (v) => setAllowFileExchange(Boolean(v)));
    const unsubNfc = settingsService.onSettingChange('securityAllowNfcExchange', (v) => setAllowNfcExchange(Boolean(v)));
    return () => {
      mounted = false;
      unsubQr();
      unsubFile();
      unsubNfc();
    };
  }, []);


  // Get mode prefix for display
  const getNickPrefix = (modes?: string[]): string => {
    if (!modes || modes.length === 0) return '';
    // Priority: owner > admin > op > halfop > voice
    if (modes.includes('q')) return '~'; // owner
    if (modes.includes('a')) return '&'; // admin
    if (modes.includes('o')) return '@'; // op
    if (modes.includes('h')) return '%'; // halfop
    if (modes.includes('v')) return '+'; // voice
    return '';
  };

  // Get mode color
const getModeColor = (modes?: string[], colors?: any): string => {
    if (!modes || modes.length === 0) return colors?.text || '#212121';
    if (modes.includes('q')) return colors?.owner || '#9C27B0'; // owner - purple
    if (modes.includes('a')) return colors?.admin || '#F44336'; // admin - red
    if (modes.includes('o')) return colors?.op || '#FF9800'; // op - orange
    if (modes.includes('h')) return colors?.halfop || '#2196F3'; // halfop - blue
    if (modes.includes('v')) return colors?.voice || '#4CAF50'; // voice - green
    return colors?.text || '#212121'; // regular user
  };

  // Sort users: by mode priority, then alphabetically
  const sortedUsers = useMemo(() => {
    const modePriority: { [key: string]: number } = {
      'q': 0, 'a': 1, 'o': 2, 'h': 3, 'v': 4
    };
    
    return [...users].sort((a, b) => {
      // First sort by highest mode priority
      const aHighestMode = a.modes.length > 0 
        ? Math.min(...a.modes.map(m => modePriority[m] ?? 99))
        : 99;
      const bHighestMode = b.modes.length > 0
        ? Math.min(...b.modes.map(m => modePriority[m] ?? 99))
        : 99;
      
      if (aHighestMode !== bHighestMode) {
        return aHighestMode - bHighestMode;
      }
      
      // Then sort alphabetically (case-insensitive)
      return a.nick.toLowerCase().localeCompare(b.nick.toLowerCase());
    });
  }, [users]);

  // Filter users based on search query
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return sortedUsers;
    
    const query = searchQuery.toLowerCase();
    return sortedUsers.filter(user => 
      user.nick.toLowerCase().includes(query) ||
      (user.account && user.account.toLowerCase().includes(query))
    );
  }, [sortedUsers, searchQuery]);

  const activeIrc = (network ? connectionManager.getConnection(network)?.ircService : null) || ircService;

  const handleExternalPayload = useCallback(async (raw: string) => {
    if (!selectedUser) {
      setActionMessage('Select a user first');
      return;
    }
    try {
      const payload = encryptedDMService.parseExternalPayload(raw);
      const targetNick = selectedUser.nick;
      if (payload.nick && payload.nick.toLowerCase() !== targetNick.toLowerCase()) {
        Alert.alert(
          'Mismatched Nick',
          `This payload is for ${payload.nick}, but you selected ${targetNick}.`,
          [{ text: 'OK', style: 'cancel' }]
        );
        return;
      }

      if (payload.type === 'encdm-fingerprint') {
        const currentFp = await encryptedDMService.getBundleFingerprint(targetNick);
        if (!currentFp) {
          Alert.alert('No Key', `No DM key stored for ${targetNick}.`);
          return;
        }
        const currentDisplay = encryptedDMService.formatFingerprintForDisplay(currentFp);
        const incomingDisplay = encryptedDMService.formatFingerprintForDisplay(payload.fingerprint);
        const matches = currentFp === payload.fingerprint;
        Alert.alert(
          'Fingerprint Check',
          `Stored: ${currentDisplay}\nScanned: ${incomingDisplay}\n\n${matches ? 'Match ✅' : 'Mismatch ⚠️'}`,
          matches
            ? [
                {
                  text: 'Mark Verified',
                  onPress: async () => {
                    await encryptedDMService.setVerified(targetNick, true);
                    setActionMessage(`Key verified for ${targetNick}`);
                  },
                },
                { text: 'Close', style: 'cancel' },
              ]
            : [{ text: 'Close', style: 'cancel' }]
        );
        return;
      }

      encryptedDMService.verifyBundle(payload.bundle);
      const existingFp = await encryptedDMService.getBundleFingerprint(targetNick);
      const newDisplay = encryptedDMService.formatFingerprintForDisplay(payload.fingerprint);
      const oldDisplay = existingFp
        ? encryptedDMService.formatFingerprintForDisplay(existingFp)
        : 'None';
      const isChange = Boolean(existingFp && existingFp !== payload.fingerprint);
      Alert.alert(
        isChange ? 'Replace DM Key' : 'Import DM Key',
        isChange
          ? `Existing: ${oldDisplay}\nNew: ${newDisplay}\n\nOnly replace if verified out-of-band.`
          : `Fingerprint: ${newDisplay}\n\nAccept this key for ${targetNick}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: isChange ? 'Replace' : 'Accept',
            onPress: async () => {
              await encryptedDMService.acceptExternalBundle(targetNick, payload.bundle, isChange);
              setActionMessage(`Key ${isChange ? 'replaced' : 'imported'} for ${targetNick}`);
            },
          },
        ]
      );
    } catch (e) {
      setActionMessage('Invalid key payload');
    }
  }, [selectedUser]);

  // Check if current user is an operator in the channel
  const isCurrentUserOp = (): boolean => {
    const currentNick = activeIrc.getCurrentNick();
    const currentUser = users.find(u => u.nick === currentNick);
    if (!currentUser) return false;
    // Check if user has op, admin, or owner status
    return currentUser.modes.some(m => ['o', 'a', 'q', 'h'].includes(m));
  };

  // Check if current user has halfop or higher
  const isCurrentUserHalfOp = (): boolean => {
    const currentNick = activeIrc.getCurrentNick();
    const currentUser = users.find(u => u.nick === currentNick);
    if (!currentUser) return false;
    // Check if user has halfop or higher status
    return currentUser.modes.some(m => ['h', 'o', 'a', 'q'].includes(m));
  };

  const handleUserLongPress = (user: ChannelUser) => {
    setSelectedUser(user);
    setShowContextMenu(true);
  };

  const handleContextMenuAction = async (action: string) => {
    if (!selectedUser || !channelName) return;
    
    // Keep menu open; show feedback inline
    switch (action) {
      case 'whois':
        if (onWHOISPress) {
          onWHOISPress(selectedUser.nick);
        } else {
          activeIrc.sendCommand(`WHOIS ${selectedUser.nick}`);
          setActionMessage(`WHOIS requested for ${selectedUser.nick}`);
        }
        break;
      case 'query':
        // This would open a query window - handled by parent
        if (onUserPress) {
          onUserPress(selectedUser);
        }
        break;
      case 'enc_share':
        try {
          const bundle = await encryptedDMService.exportBundle();
          activeIrc.sendRaw(`PRIVMSG ${selectedUser.nick} :!enc-offer ${JSON.stringify(bundle)}`);
          setActionMessage(`Enc key offer sent to ${selectedUser.nick}`);
        } catch (e) {
          setActionMessage('Failed to share key');
        }
        break;
      case 'enc_request':
        activeIrc.sendRaw(`PRIVMSG ${selectedUser.nick} :!enc-req`);
        setActionMessage(`Requested key from ${selectedUser.nick}`);
        encryptedDMService
          .awaitBundleForNick(selectedUser.nick, 36000)
          .then(() => setActionMessage(`Key saved for ${selectedUser.nick}`))
          .catch(() => setActionMessage('Key not received (timeout)'));
        break;
      case 'enc_qr_show':
        try {
          const selfNick = activeIrc.getCurrentNick();
          const payload = await encryptedDMService.exportFingerprintPayload(selfNick);
          setQrPayload(payload);
          setShowKeyQr(true);
        } catch (e) {
          setActionMessage('Failed to generate QR');
        }
        break;
      case 'enc_qr_scan':
        try {
          const permission = hasCameraPermission || (await requestCameraPermission()) === 'authorized';
          if (!permission) {
            setActionMessage('Camera permission denied');
            break;
          }
          scanHandledRef.current = false;
          setShowKeyScan(true);
          setScanError('');
        } catch (e) {
          setActionMessage('Failed to open camera');
        }
        break;
      case 'enc_share_file':
        try {
          const selfNick = activeIrc.getCurrentNick();
          const payload = await encryptedDMService.exportBundlePayload(selfNick);
          const filename = `androidircx-key-${selfNick}.json`;
          const path = `${RNFS.DocumentDirectoryPath}/${filename}`;
          await RNFS.writeFile(path, payload, 'utf8');
          await Share.open({ url: `file://${path}`, type: 'application/json' });
          setActionMessage('Key file shared');
        } catch (e) {
          setActionMessage('Failed to share key file');
        }
        break;
      case 'enc_import_file':
        try {
          const picker = await DocumentPicker.pickSingle({
            type: [DocumentPicker.types.allFiles],
            copyTo: 'cachesDirectory',
          });
          const uri = picker.fileCopyUri || picker.uri;
          const path = uri.startsWith('file://') ? uri.replace('file://', '') : uri;
          const contents = await RNFS.readFile(path, 'utf8');
          await handleExternalPayload(contents);
        } catch (e: any) {
          if (!DocumentPicker.isCancel(e)) {
            setActionMessage('Failed to import key file');
          }
        }
        break;
      case 'enc_share_nfc':
        try {
          const supported = await NfcManager.isSupported();
          if (!supported) {
            setActionMessage('NFC not supported');
            break;
          }
          const selfNick = activeIrc.getCurrentNick();
          const payload = await encryptedDMService.exportBundlePayload(selfNick);
          await NfcManager.start();
          await NfcManager.requestTechnology(NfcTech.Ndef);
          const bytes = Ndef.encodeMessage([Ndef.textRecord(payload)]);
          if (bytes) {
            await NfcManager.writeNdefMessage(bytes);
          }
          setActionMessage('NFC key ready, tap devices');
        } catch (e) {
          setActionMessage('Failed to share via NFC');
        } finally {
          try { await NfcManager.cancelTechnologyRequest(); } catch {}
        }
        break;
      case 'enc_receive_nfc':
        try {
          const supported = await NfcManager.isSupported();
          if (!supported) {
            setActionMessage('NFC not supported');
            break;
          }
          await NfcManager.start();
          await NfcManager.requestTechnology(NfcTech.Ndef);
          const tag = await NfcManager.getTag();
          const ndefMessage = tag?.ndefMessage?.[0];
          const payload = ndefMessage ? Ndef.text.decodePayload(ndefMessage.payload) : null;
          if (!payload) {
            setActionMessage('No NFC payload');
            break;
          }
          await handleExternalPayload(payload);
        } catch (e) {
          setActionMessage('Failed to read NFC');
        } finally {
          try { await NfcManager.cancelTechnologyRequest(); } catch {}
        }
        break;
      case 'enc_verify':
        try {
          const status = await encryptedDMService.getVerificationStatus(selectedUser.nick);
          if (!status.fingerprint) {
            setActionMessage(`No DM key for ${selectedUser.nick}`);
            break;
          }
          const selfFp = encryptedDMService.formatFingerprintForDisplay(await encryptedDMService.getSelfFingerprint());
          const peerFp = encryptedDMService.formatFingerprintForDisplay(status.fingerprint);
          const verifiedLabel = status.verified ? 'Verified' : 'Mark Verified';
          Alert.alert(
            'Verify DM Key',
            `Compare fingerprints out-of-band:\n\nYou: ${selfFp}\n${selectedUser.nick}: ${peerFp}`,
            [
              {
                text: verifiedLabel,
                onPress: async () => {
                  if (!status.verified) {
                    await encryptedDMService.setVerified(selectedUser.nick, true);
                    setActionMessage(`Key marked verified for ${selectedUser.nick}`);
                  }
                },
              },
              {
                text: 'Copy Fingerprints',
                onPress: () => {
                  Clipboard.setString(`You: ${selfFp}\n${selectedUser.nick}: ${peerFp}`);
                  setActionMessage('Fingerprints copied');
                },
              },
              { text: 'Close', style: 'cancel' },
            ]
          );
        } catch (e) {
          setActionMessage('Failed to load fingerprints');
        }
        break;
      case 'chan_share':
        try {
          const keyData = await channelEncryptionService.exportChannelKey(channelName, network || activeIrc.getNetworkName());
          activeIrc.sendRaw(`PRIVMSG ${selectedUser.nick} :!chanenc-key ${keyData}`);
          setActionMessage(`Shared channel key with ${selectedUser.nick}`);
        } catch (e: any) {
          setActionMessage(e?.message || 'Failed to share channel key');
        }
        break;
      case 'chan_request':
        try {
          const requester = activeIrc.getCurrentNick();
          activeIrc.sendRaw(
            `PRIVMSG ${selectedUser.nick} :Please share the channel key for ${channelName} with /chankey share ${requester}`
          );
          setActionMessage(`Requested channel key for ${channelName} from ${selectedUser.nick}`);
        } catch (e: any) {
          setActionMessage(e?.message || 'Failed to request channel key');
        }
        break;
      case 'copy':
        setActionMessage(copyNickToClipboard(selectedUser.nick));
        break;
      case 'ctcp_ping':
        activeIrc.sendCTCPRequest(selectedUser.nick, 'PING', Date.now().toString());
        setActionMessage(`CTCP PING sent to ${selectedUser.nick}`);
        break;
      case 'ctcp_version':
        activeIrc.sendCTCPRequest(selectedUser.nick, 'VERSION');
        setActionMessage(`CTCP VERSION requested from ${selectedUser.nick}`);
        break;
      case 'ctcp_time':
        activeIrc.sendCTCPRequest(selectedUser.nick, 'TIME');
        setActionMessage(`CTCP TIME requested from ${selectedUser.nick}`);
        break;
      case 'dcc_chat':
        dccChatService.initiateChat(activeIrc, selectedUser.nick, network || activeIrc.getNetworkName());
        setActionMessage(`DCC CHAT offer sent to ${selectedUser.nick}`);
        break;
      case 'dcc_send':
        activeIrc.sendRaw(`PRIVMSG ${selectedUser.nick} :\x01DCC SEND\x01`);
        setActionMessage(`DCC SEND offer initiated to ${selectedUser.nick}`);
        break;
      case 'ignore':
        const isIgnored = userManagementService.isUserIgnored(
          selectedUser.nick,
          undefined,
          selectedUser.host,
          network
        );
        if (isIgnored) {
          userManagementService.unignoreUser(selectedUser.nick, network);
          setActionMessage(`${selectedUser.nick} unignored`);
        } else {
          const mask = selectedUser.host
            ? `${selectedUser.nick}!*@${selectedUser.host}`
            : selectedUser.nick;
          userManagementService.ignoreUser(mask, undefined, network);
          setActionMessage(`${selectedUser.nick} ignored`);
        }
        break;
      case 'monitor_toggle':
        if (activeIrc.isMonitoring(selectedUser.nick)) {
          activeIrc.unmonitorNick(selectedUser.nick);
          setActionMessage(`Stopped monitoring ${selectedUser.nick}`);
        } else {
          activeIrc.monitorNick(selectedUser.nick);
          setActionMessage(`Monitoring ${selectedUser.nick}`);
        }
        break;

      // Operator controls
      case 'give_voice':
        activeIrc.sendCommand(`MODE ${channelName} +v ${selectedUser.nick}`);
        setActionMessage(`Gave voice to ${selectedUser.nick}`);
        break;
      case 'take_voice':
        activeIrc.sendCommand(`MODE ${channelName} -v ${selectedUser.nick}`);
        setActionMessage(`Took voice from ${selectedUser.nick}`);
        break;
      case 'give_halfop':
        activeIrc.sendCommand(`MODE ${channelName} +h ${selectedUser.nick}`);
        setActionMessage(`Gave half-op to ${selectedUser.nick}`);
        break;
      case 'take_halfop':
        activeIrc.sendCommand(`MODE ${channelName} -h ${selectedUser.nick}`);
        setActionMessage(`Took half-op from ${selectedUser.nick}`);
        break;
      case 'give_op':
        activeIrc.sendCommand(`MODE ${channelName} +o ${selectedUser.nick}`);
        setActionMessage(`Gave op to ${selectedUser.nick}`);
        break;
      case 'take_op':
        activeIrc.sendCommand(`MODE ${channelName} -o ${selectedUser.nick}`);
        setActionMessage(`Took op from ${selectedUser.nick}`);
        break;
      case 'kick':
        activeIrc.sendCommand(`KICK ${channelName} ${selectedUser.nick}`);
        setActionMessage(`Kicked ${selectedUser.nick} from ${channelName}`);
        break;
      case 'kick_message':
        activeIrc.sendCommand(`KICK ${channelName} ${selectedUser.nick} :Kicked`);
        setActionMessage(`Kicked ${selectedUser.nick} from ${channelName}`);
        break;
      case 'ban':
        const banMask = selectedUser.host ? `*!*@${selectedUser.host}` : `${selectedUser.nick}!*@*`;
        activeIrc.sendCommand(`MODE ${channelName} +b ${banMask}`);
        setActionMessage(`Banned ${banMask}`);
        break;
      case 'kick_ban':
        const kbMask = selectedUser.host ? `*!*@${selectedUser.host}` : `${selectedUser.nick}!*@*`;
        activeIrc.sendCommand(`MODE ${channelName} +b ${kbMask}`);
        activeIrc.sendCommand(`KICK ${channelName} ${selectedUser.nick}`);
        setActionMessage(`Kicked + banned ${selectedUser.nick}`);
        break;
      case 'kick_ban_message':
        const kbmMask = selectedUser.host ? `*!*@${selectedUser.host}` : `${selectedUser.nick}!*@*`;
        activeIrc.sendCommand(`MODE ${channelName} +b ${kbmMask}`);
        activeIrc.sendCommand(`KICK ${channelName} ${selectedUser.nick} :Kicked`);
        setActionMessage(`Kicked + banned ${selectedUser.nick}`);
        break;
      default:
        break;
    }

    // keep menu open; reset feedback after a moment
    if (actionMessage) {
      setTimeout(() => setActionMessage(''), 1500);
    }
  };

  if (!channelName) {
    return null;
  }

  return (
    <View
      style={[
        styles.container,
        position === 'left' && styles.containerLeft,
        position === 'right' && styles.containerRight,
        position === 'top' && styles.containerTop,
        position === 'bottom' && styles.containerBottom,
      ]}>
      <View style={styles.header}>
        <Text style={styles.headerText}>
          {users.length} {users.length === 1 ? 'user' : 'users'}
        </Text>
      </View>
      
      {/* Search/Filter Input */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search users..."
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => setSearchQuery('')}>
            <Text style={styles.clearButtonText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* User List */}
      <ScrollView 
        style={styles.scrollView}
        keyboardShouldPersistTaps="handled">
        {filteredUsers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {searchQuery ? 'No users found' : 'No users'}
            </Text>
          </View>
        ) : (
          filteredUsers.map((user, index) => {
            const prefix = getNickPrefix(user.modes);
            const color = getModeColor(user.modes, colors);
            
            return (
              <TouchableOpacity
                key={`${user.nick}-${index}`}
                style={styles.userItem}
                onLongPress={() => handleUserLongPress(user)}
                onPress={() => {
                  if (onUserPress) {
                    onUserPress(user);
                  }
                }}
                activeOpacity={0.7}>
                <Text style={[styles.userNick, { color }]}>
                  {prefix}{user.nick}
                </Text>
                {user.account && user.account !== '*' && (
                  <Text style={styles.userAccount}> ({user.account})</Text>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Context Menu Modal */}
      <Modal
        visible={showContextMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowContextMenu(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowContextMenu(false)}>
          <View style={styles.contextMenu}>
            {selectedUser && (
              <ScrollView
                style={styles.contextMenuScroll}
                contentContainerStyle={styles.contextMenuContent}
                showsVerticalScrollIndicator>
                <View style={styles.contextMenuHeader}>
                  <Text style={styles.contextMenuTitle}>
                    {getNickPrefix(selectedUser.modes)}{selectedUser.nick}
                  </Text>
                  {selectedUser.account && selectedUser.account !== '*' && (
                    <Text style={styles.contextMenuSubtitle}>
                      Account: {selectedUser.account}
                    </Text>
                  )}
                </View>
                <View style={styles.contextMenuDivider} />

                <View style={styles.contextMenuGroupHeader}>
                  <Text style={styles.contextMenuGroupTitle}>Quick Actions</Text>
                </View>
                <TouchableOpacity
                  style={styles.contextMenuItem}
                  onPress={() => handleContextMenuAction('whois')}>
                  <Text style={styles.contextMenuText}>WHOIS</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.contextMenuItem}
                  onPress={() => handleContextMenuAction('query')}>
                  <Text style={styles.contextMenuText}>Open Query</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.contextMenuItem}
                  onPress={() => handleContextMenuAction('copy')}>
                  <Text style={styles.contextMenuText}>Copy Nickname</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.contextMenuItem}
                  onPress={() => handleContextMenuAction('ignore')}>
                  <Text style={styles.contextMenuText}>
                    {userManagementService.isUserIgnored(
                      selectedUser.nick,
                      undefined,
                      selectedUser.host,
                      network
                    )
                      ? 'Unignore User'
                      : 'Ignore User'}
                  </Text>
                </TouchableOpacity>
                {activeIrc.capEnabledSet && activeIrc.capEnabledSet.has('monitor') && (
                  <TouchableOpacity
                    style={styles.contextMenuItem}
                    onPress={() => handleContextMenuAction('monitor_toggle')}>
                    <Text style={styles.contextMenuText}>
                      {activeIrc.isMonitoring(selectedUser.nick)
                        ? 'Unmonitor Nick'
                        : 'Monitor Nick'}
                    </Text>
                  </TouchableOpacity>
                )}
                <View style={styles.contextMenuDivider} />

                <View style={styles.contextMenuGroupHeader}>
                  <Text style={styles.contextMenuGroupTitle}>Encryption</Text>
                </View>
                <TouchableOpacity
                  style={styles.contextMenuItem}
                  onPress={() => setShowE2EGroup(prev => !prev)}>
                  <Text style={styles.contextMenuText}>
                    {showE2EGroup ? 'E2E Encryption v' : 'E2E Encryption >'}
                  </Text>
                </TouchableOpacity>
                {showE2EGroup && (
                  <View style={styles.subGroup}>
                    <TouchableOpacity
                      style={styles.contextMenuItem}
                      onPress={() => handleContextMenuAction('enc_share')}>
                      <Text style={styles.contextMenuText}>Share DM Key</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.contextMenuItem}
                      onPress={() => handleContextMenuAction('enc_request')}>
                      <Text style={styles.contextMenuText}>Request DM Key (36s)</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.contextMenuItem}
                      onPress={() => handleContextMenuAction('enc_verify')}>
                      <Text style={styles.contextMenuText}>Verify DM Key</Text>
                    </TouchableOpacity>
                    {allowQrVerification && (
                      <>
                        <TouchableOpacity
                          style={styles.contextMenuItem}
                          onPress={() => handleContextMenuAction('enc_qr_show')}>
                          <Text style={styles.contextMenuText}>Show Fingerprint QR</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.contextMenuItem}
                          onPress={() => handleContextMenuAction('enc_qr_scan')}>
                          <Text style={styles.contextMenuText}>Scan Fingerprint QR</Text>
                        </TouchableOpacity>
                      </>
                    )}
                    {allowFileExchange && (
                      <>
                        <TouchableOpacity
                          style={styles.contextMenuItem}
                          onPress={() => handleContextMenuAction('enc_share_file')}>
                          <Text style={styles.contextMenuText}>Share Key File</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.contextMenuItem}
                          onPress={() => handleContextMenuAction('enc_import_file')}>
                          <Text style={styles.contextMenuText}>Import Key File</Text>
                        </TouchableOpacity>
                      </>
                    )}
                    {allowNfcExchange && (
                      <>
                        <TouchableOpacity
                          style={styles.contextMenuItem}
                          onPress={() => handleContextMenuAction('enc_share_nfc')}>
                          <Text style={styles.contextMenuText}>Share via NFC</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.contextMenuItem}
                          onPress={() => handleContextMenuAction('enc_receive_nfc')}>
                          <Text style={styles.contextMenuText}>Receive via NFC</Text>
                        </TouchableOpacity>
                      </>
                    )}
                    {channelName && (
                      <>
                        <TouchableOpacity
                          style={styles.contextMenuItem}
                          onPress={() => handleContextMenuAction('chan_share')}>
                          <Text style={styles.contextMenuText}>Share Channel Key</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.contextMenuItem}
                          onPress={() => handleContextMenuAction('chan_request')}>
                          <Text style={styles.contextMenuText}>Request Channel Key</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                )}
                <View style={styles.contextMenuDivider} />

                <View style={styles.contextMenuGroupHeader}>
                  <Text style={styles.contextMenuGroupTitle}>CTCP</Text>
                </View>
                <TouchableOpacity
                  style={styles.contextMenuItem}
                  onPress={() => setShowCTCPGroup(prev => !prev)}>
                  <Text style={styles.contextMenuText}>
                    {showCTCPGroup ? 'CTCP v' : 'CTCP >'}
                  </Text>
                </TouchableOpacity>
                {showCTCPGroup && (
                  <View style={styles.subGroup}>
                    <TouchableOpacity
                      style={styles.contextMenuItem}
                      onPress={() => handleContextMenuAction('ctcp_ping')}>
                      <Text style={styles.contextMenuText}>CTCP PING</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.contextMenuItem}
                      onPress={() => handleContextMenuAction('ctcp_version')}>
                      <Text style={styles.contextMenuText}>CTCP VERSION</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.contextMenuItem}
                      onPress={() => handleContextMenuAction('ctcp_time')}>
                      <Text style={styles.contextMenuText}>CTCP TIME</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <View style={styles.contextMenuDivider} />

                <View style={styles.contextMenuGroupHeader}>
                  <Text style={styles.contextMenuGroupTitle}>DCC</Text>
                </View>
                <TouchableOpacity
                  style={styles.contextMenuItem}
                  onPress={() => handleContextMenuAction('dcc_chat')}>
                  <Text style={styles.contextMenuText}>Start DCC Chat</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.contextMenuItem}
                  onPress={() => handleContextMenuAction('dcc_send')}>
                  <Text style={styles.contextMenuText}>Offer DCC Send</Text>
                </TouchableOpacity>

                {(isCurrentUserOp() || isCurrentUserHalfOp()) && (
                  <>
                    <View style={styles.contextMenuDivider} />
                    <View style={styles.contextMenuGroupHeader}>
                      <Text style={styles.contextMenuGroupTitle}>Operator Controls</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.contextMenuItem}
                      onPress={() => setShowOpsGroup(prev => !prev)}>
                      <Text style={[styles.contextMenuSubtitle, { fontWeight: '600' }]}>
                        {showOpsGroup ? 'Operator Controls v' : 'Operator Controls >'}
                      </Text>
                    </TouchableOpacity>

                    {showOpsGroup && (
                      <View style={styles.subGroup}>
                        {isCurrentUserHalfOp() && (
                          <>
                            {selectedUser.modes.includes('v') ? (
                              <TouchableOpacity
                                style={styles.contextMenuItem}
                                onPress={() => handleContextMenuAction('take_voice')}>
                                <Text style={styles.contextMenuText}>Take Voice</Text>
                              </TouchableOpacity>
                            ) : (
                              <TouchableOpacity
                                style={styles.contextMenuItem}
                                onPress={() => handleContextMenuAction('give_voice')}>
                                <Text style={styles.contextMenuText}>Give Voice</Text>
                              </TouchableOpacity>
                            )}
                          </>
                        )}

                        {isCurrentUserOp() && (
                          <>
                            {selectedUser.modes.includes('h') ? (
                              <TouchableOpacity
                                style={styles.contextMenuItem}
                                onPress={() => handleContextMenuAction('take_halfop')}>
                                <Text style={styles.contextMenuText}>Take Half-Op</Text>
                              </TouchableOpacity>
                            ) : (
                              <TouchableOpacity
                                style={styles.contextMenuItem}
                                onPress={() => handleContextMenuAction('give_halfop')}>
                                <Text style={styles.contextMenuText}>Give Half-Op</Text>
                              </TouchableOpacity>
                            )}

                            {selectedUser.modes.includes('o') ? (
                              <TouchableOpacity
                                style={styles.contextMenuItem}
                                onPress={() => handleContextMenuAction('take_op')}>
                                <Text style={styles.contextMenuText}>Take Op</Text>
                              </TouchableOpacity>
                            ) : (
                              <TouchableOpacity
                                style={styles.contextMenuItem}
                                onPress={() => handleContextMenuAction('give_op')}>
                                <Text style={styles.contextMenuText}>Give Op</Text>
                              </TouchableOpacity>
                            )}

                            <TouchableOpacity
                              style={styles.contextMenuItem}
                              onPress={() => handleContextMenuAction('kick')}>
                              <Text style={[styles.contextMenuText, styles.contextMenuWarning]}>
                                Kick
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.contextMenuItem}
                              onPress={() => handleContextMenuAction('kick_message')}>
                              <Text style={[styles.contextMenuText, styles.contextMenuWarning]}>
                                Kick (with message)
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.contextMenuItem}
                              onPress={() => handleContextMenuAction('ban')}>
                              <Text style={[styles.contextMenuText, styles.contextMenuDanger]}>
                                Ban
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.contextMenuItem}
                              onPress={() => handleContextMenuAction('kick_ban')}>
                              <Text style={[styles.contextMenuText, styles.contextMenuDanger]}>
                                Kick + Ban
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.contextMenuItem}
                              onPress={() => handleContextMenuAction('kick_ban_message')}>
                              <Text style={[styles.contextMenuText, styles.contextMenuDanger]}>
                                Kick + Ban (with message)
                              </Text>
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                    )}
                  </>
                )}

                <View style={styles.contextMenuDivider} />
                {actionMessage ? (
                  <View style={styles.feedbackContainer}>
                    <Text style={styles.feedbackText}>{actionMessage}</Text>
                  </View>
                ) : null}
                <TouchableOpacity
                  style={styles.contextMenuItem}
                  onPress={() => setShowContextMenu(false)}>
                  <Text style={[styles.contextMenuText, styles.contextMenuCancel]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
      <Modal
        visible={showKeyQr}
        transparent
        animationType="fade"
        onRequestClose={() => setShowKeyQr(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowKeyQr(false)}>
          <View style={styles.contextMenu}>
            <View style={styles.contextMenuHeader}>
              <Text style={styles.contextMenuTitle}>Fingerprint QR</Text>
              <Text style={styles.contextMenuSubtitle}>Scan to verify out-of-band</Text>
            </View>
            <View style={{ alignItems: 'center', padding: 16 }}>
              {qrPayload ? <QRCode value={qrPayload} size={220} /> : null}
            </View>
            <TouchableOpacity
              style={styles.contextMenuItem}
              onPress={() => {
                if (qrPayload) Clipboard.setString(qrPayload);
                setActionMessage('QR payload copied');
              }}>
              <Text style={styles.contextMenuText}>Copy Payload</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
      <Modal
        visible={showKeyScan}
        transparent
        animationType="fade"
        onRequestClose={() => setShowKeyScan(false)}>
        <View style={styles.scanContainer}>
          {device && hasCameraPermission ? (
            <Camera
              style={StyleSheet.absoluteFill}
              device={device}
              isActive={showKeyScan}
              codeScanner={codeScanner}
            />
          ) : (
            <View style={styles.scanFallback}>
              <Text style={styles.contextMenuText}>
                {scanError || 'Camera unavailable'}
              </Text>
            </View>
          )}
          <View style={styles.scanOverlay}>
            <Text style={styles.scanText}>Scan a fingerprint QR</Text>
            <TouchableOpacity
              style={styles.scanClose}
              onPress={() => setShowKeyScan(false)}>
              <Text style={styles.contextMenuText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const createStyles = (colors: any = {}) => StyleSheet.create({
  container: {
    width: 150,
    backgroundColor: colors.surface || '#FFFFFF',
  },
  containerLeft: {
    borderRightWidth: 1,
    borderRightColor: colors.border || '#E0E0E0',
  },
  containerRight: {
    borderLeftWidth: 1,
    borderLeftColor: colors.border || '#E0E0E0',
  },
  containerTop: {
    width: '100%',
    height: 160,
    borderBottomWidth: 1,
    borderBottomColor: colors.border || '#E0E0E0',
  },
  containerBottom: {
    width: '100%',
    height: 160,
    borderTopWidth: 1,
    borderTopColor: colors.border || '#E0E0E0',
  },
  header: {
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border || '#E0E0E0',
    backgroundColor: colors.surfaceVariant || '#F5F5F5',
  },
  headerText: {
    fontSize: 12,
    color: colors.textSecondary || '#757575',
    fontWeight: '500',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border || '#E0E0E0',
    backgroundColor: colors.surfaceVariant || '#FAFAFA',
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.surface || '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border || '#E0E0E0',
    borderRadius: 4,
    color: colors.text || '#212121',
  },
  clearButton: {
    marginLeft: 4,
    padding: 4,
  },
  clearButtonText: {
    fontSize: 14,
    color: colors.textSecondary || '#757575',
  },
  scrollView: {
    flex: 1,
  },
  userItem: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
  },
  userNick: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.text || '#212121',
  },
  userAccount: {
    fontSize: 11,
    color: colors.textSecondary || '#9E9E9E',
    fontStyle: 'italic',
  },
  emptyContainer: {
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 12,
    color: colors.textSecondary || '#9E9E9E',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  scanOverlay: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 12,
  },
  scanText: {
    color: '#fff',
    fontWeight: '600',
  },
  scanClose: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 6,
  },
  scanFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contextMenu: {
    backgroundColor: colors.surface || '#FFFFFF',
    borderRadius: 8,
    minWidth: 240,
    maxWidth: 360,
    width: '90%',
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    overflow: 'hidden',
  },
  contextMenuScroll: {
    maxHeight: '85%',
  },
  contextMenuContent: {
    paddingBottom: 8,
  },
  contextMenuHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border || '#E0E0E0',
  },
  contextMenuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text || '#212121',
    marginBottom: 4,
  },
  contextMenuSubtitle: {
    fontSize: 12,
    color: colors.textSecondary || '#757575',
  },
  contextMenuGroupHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    backgroundColor: colors.surfaceVariant || '#F5F5F5',
  },
  contextMenuGroupTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary || '#757575',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  contextMenuDivider: {
    height: 1,
    backgroundColor: colors.border || '#E0E0E0',
  },
  contextMenuItem: {
    padding: 16,
  },
  contextMenuText: {
    fontSize: 14,
    color: colors.text,
  },
  contextMenuCancel: {
    color: colors.textSecondary,
    textAlign: 'center',
  },
  contextMenuWarning: {
    color: '#FF9800', // Orange for warnings (kick)
  },
  contextMenuDanger: {
    color: '#F44336', // Red for dangerous actions (ban, kick+ban)
  },
  subGroup: {
    paddingLeft: 12,
  },
  feedbackContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  feedbackText: {
    fontSize: 12,
    color: '#616161',
    textAlign: 'center',
  },
});

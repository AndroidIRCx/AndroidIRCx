import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
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
import { pick, types, errorCodes, isErrorWithCode } from '@react-native-documents/picker';
import NfcManager, { Ndef, NfcTech } from 'react-native-nfc-manager';
import { ChannelUser } from '../services/IRCService';
import { ircService } from '../services/IRCService';
import { userManagementService } from '../services/UserManagementService';
import { connectionManager } from '../services/ConnectionManager';
import { dccChatService } from '../services/DCCChatService';
import { useTheme } from '../hooks/useTheme';
import { useT } from '../i18n/transifex';
import { encryptedDMService } from '../services/EncryptedDMService';
import { channelEncryptionService } from '../services/ChannelEncryptionService';
import { settingsService } from '../services/SettingsService';
import { performanceService, PerformanceConfig } from '../services/PerformanceService';
import Clipboard from '@react-native-clipboard/clipboard';
import { getUserModeDescription } from '../utils/modeDescriptions';
import { useUIStore } from '../stores/uiStore';

// Note: This function cannot use useT() as it's exported outside the component
// The translation will be handled where it's called
export const copyNickToClipboard = (nick: string, t?: (key: string) => string): string => {
  Clipboard.setString(nick);
  const template = 'Copied {nick}';
  const translated = t ? t(template) : template;
  return translated.replace('{nick}', nick);
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
  const t = useT();
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
  const [qrType, setQrType] = useState<'bundle' | 'fingerprint'>('bundle');
  const [showKeyScan, setShowKeyScan] = useState(false);
  const [scanError, setScanError] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [performanceConfig, setPerformanceConfig] = useState<PerformanceConfig>(
    () => performanceService.getConfig()
  );
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

  useEffect(() => {
    setPerformanceConfig(performanceService.getConfig());
    const unsubscribe = performanceService.onConfigChange(setPerformanceConfig);
    return unsubscribe;
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

  const groupingEnabled = performanceConfig.userListGrouping !== false;
  const groupingThreshold = performanceConfig.userListAutoDisableGroupingThreshold || 1000;
  const groupingActive = groupingEnabled && users.length <= groupingThreshold;
  const virtualizationEnabled = performanceConfig.userListVirtualization !== false;
  const virtualizationThreshold = performanceConfig.userListAutoVirtualizeThreshold || 500;

  // Group users by their highest mode
  const groupedUsers = useMemo(() => {
    const modePriority: { [key: string]: number } = {
      'q': 0, 'a': 1, 'o': 2, 'h': 3, 'v': 4
    };
    
    const groups: { [key: string]: ChannelUser[] } = {
      'q': [],
      'a': [],
      'o': [],
      'h': [],
      'v': [],
      'none': [],
    };
    
    users.forEach(user => {
      if (user.modes.length === 0) {
        groups.none.push(user);
        return;
      }
      
      // Find highest priority mode
      const highestMode = user.modes.reduce((prev, current) => {
        const prevPriority = modePriority[prev] ?? 99;
        const currentPriority = modePriority[current] ?? 99;
        return currentPriority < prevPriority ? current : prev;
      });
      
      if (highestMode && groups[highestMode]) {
        groups[highestMode].push(user);
      } else {
        groups.none.push(user);
      }
    });
    
    // Sort each group alphabetically
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => 
        a.nick.toLowerCase().localeCompare(b.nick.toLowerCase())
      );
    });
    
    return groups;
  }, [users]);

  const sortedUsers = useMemo(() => {
    // Sort by mode priority first, then alphabetically
    const modePriority: { [key: string]: number } = {
      'q': 0, // owner
      'a': 1, // admin
      'o': 2, // operator
      'h': 3, // halfop
      'v': 4, // voice
    };

    return [...users].sort((a, b) => {
      // Get highest priority mode for each user
      const getHighestPriority = (modes: string[]): number => {
        if (modes.length === 0) return 99; // No modes
        return Math.min(...modes.map(m => modePriority[m] ?? 99));
      };

      const aPriority = getHighestPriority(a.modes);
      const bPriority = getHighestPriority(b.modes);

      // First sort by mode priority
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }

      // Then sort alphabetically by nick
      return a.nick.toLowerCase().localeCompare(b.nick.toLowerCase());
    });
  }, [users]);

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return sortedUsers;
    const query = searchQuery.toLowerCase();
    return sortedUsers.filter(user =>
      user.nick.toLowerCase().includes(query) ||
      (user.account && user.account.toLowerCase().includes(query))
    );
  }, [sortedUsers, searchQuery]);

  const virtualizationActive = !groupingActive
    && virtualizationEnabled
    && filteredUsers.length >= virtualizationThreshold;

  // Filter users based on search query
  const filteredGroupedUsers = useMemo(() => {
    if (!searchQuery.trim()) return groupedUsers;
    
    const query = searchQuery.toLowerCase();
    const filtered: { [key: string]: ChannelUser[] } = {
      'q': [],
      'a': [],
      'o': [],
      'h': [],
      'v': [],
      'none': [],
    };
    
    Object.keys(groupedUsers).forEach(key => {
      filtered[key] = groupedUsers[key].filter(user => 
        user.nick.toLowerCase().includes(query) ||
        (user.account && user.account.toLowerCase().includes(query))
      );
    });
    
    return filtered;
  }, [groupedUsers, searchQuery]);
  
  // Check if there are any users after filtering
  const hasFilteredUsers = useMemo(() => {
    if (!groupingActive) {
      return filteredUsers.length > 0;
    }
    return Object.values(filteredGroupedUsers).some(group => group.length > 0);
  }, [filteredGroupedUsers, filteredUsers.length, groupingActive]);

  const activeIrc = (network ? connectionManager.getConnection(network)?.ircService : null) || ircService;

  // Always use network-aware storage. Get network from IRC service if not provided as prop.
  const getNetworkForStorage = useCallback((): string => {
    const result = network || activeIrc.getNetworkName() || 'default';
    console.log('[UserList] getNetworkForStorage - network prop:', network, 'activeIrc.getNetworkName():', activeIrc.getNetworkName(), 'result:', result);
    return result;
  }, [network, activeIrc]);

  const handleExternalPayload = useCallback(async (raw: string) => {
    if (!selectedUser) {
      setActionMessage(t('Select a user first'));
      return;
    }
    try {
      const payload = encryptedDMService.parseExternalPayload(raw);
      const targetNick = selectedUser.nick;
      if (payload.nick && payload.nick.toLowerCase() !== targetNick.toLowerCase()) {
        Alert.alert(
          t('Mismatched Nick'),
          t('This payload is for {payloadNick}, but you selected {targetNick}.')
            .replace('{payloadNick}', payload.nick)
            .replace('{targetNick}', targetNick),
          [{ text: t('OK'), style: 'cancel' }]
        );
        return;
      }

      if (payload.type === 'encdm-fingerprint') {
        const storageNetwork = getNetworkForStorage();
        const currentFp = await encryptedDMService.getBundleFingerprintForNetwork(storageNetwork, targetNick);
        if (!currentFp) {
          Alert.alert(t('No Key'), t('No DM key stored for {nick}.').replace('{nick}', targetNick));
          return;
        }
        const currentDisplay = encryptedDMService.formatFingerprintForDisplay(currentFp);
        const incomingDisplay = encryptedDMService.formatFingerprintForDisplay(payload.fingerprint);
        const matches = currentFp === payload.fingerprint;
        Alert.alert(
          t('Fingerprint Check'),
          t('Stored: {stored}\nScanned: {scanned}\n\n{result}')
            .replace('{stored}', currentDisplay)
            .replace('{scanned}', incomingDisplay)
            .replace('{result}', matches ? t('Match ✅') : t('Mismatch ⚠️')),
          matches
            ? [
                {
                  text: t('Mark Verified'),
                  onPress: async () => {
                    await encryptedDMService.setVerifiedForNetwork(storageNetwork, targetNick, true);
                    setActionMessage(t('Key verified for {nick}').replace('{nick}', targetNick));
                  },
                },
                { text: t('Close'), style: 'cancel' },
              ]
            : [{ text: t('Close'), style: 'cancel' }]
        );
        return;
      }

      encryptedDMService.verifyBundle(payload.bundle);
      const storageNetwork = getNetworkForStorage();
      const existingFp = await encryptedDMService.getBundleFingerprintForNetwork(storageNetwork, targetNick);
      const newDisplay = encryptedDMService.formatFingerprintForDisplay(payload.fingerprint);
      const oldDisplay = existingFp
        ? encryptedDMService.formatFingerprintForDisplay(existingFp)
        : t('None');
      const isChange = Boolean(existingFp && existingFp !== payload.fingerprint);
      Alert.alert(
        isChange ? t('Replace DM Key') : t('Import DM Key'),
        isChange
          ? t('Existing: {old}\nNew: {new}\n\nOnly replace if verified out-of-band.')
              .replace('{old}', oldDisplay)
              .replace('{new}', newDisplay)
          : t('Fingerprint: {fp}\n\nAccept this key for {nick}?')
              .replace('{fp}', newDisplay)
              .replace('{nick}', targetNick),
        [
          { text: t('Cancel'), style: 'cancel' },
          {
            text: isChange ? t('Replace') : t('Accept'),
            onPress: async () => {
              // Always use network-aware storage
              await encryptedDMService.acceptExternalBundleForNetwork(storageNetwork, targetNick, payload.bundle, isChange);
              setActionMessage(t('Key {action} for {nick}')
                .replace('{action}', isChange ? t('replaced') : t('imported'))
                .replace('{nick}', targetNick));

              // Prompt to share key back for bidirectional encryption (offline only)
              setTimeout(() => {
                Alert.alert(
                  t('Share Your Key?'),
                  t('You imported {nick}\'s key offline. For encrypted chat to work both ways, {nick} also needs your key.\n\n💡 Show your QR code for them to scan (no server messages)')
                    .replace(/{nick}/g, targetNick),
                  [
                    { text: t('Later'), style: 'cancel' },
                    {
                      text: t('Show QR Code'),
                      onPress: async () => {
                        try {
                          const selfNick = activeIrc.getCurrentNick();
                          const sharePayload = await encryptedDMService.exportBundlePayload(selfNick);
                          setQrPayload(sharePayload);
                          setQrType('bundle');
                          setShowKeyQr(true);
                        } catch (e) {
                          setActionMessage(t('Failed to generate QR'));
                        }
                      },
                    },
                  ]
                );
              }, 500);
            },
          },
        ]
      );
    } catch (e) {
      setActionMessage(t('Invalid key payload'));
    }
  }, [selectedUser, t, getNetworkForStorage, activeIrc]);

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

  // Toggle group collapse/expand
  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupKey)) {
        newSet.delete(groupKey);
      } else {
        newSet.add(groupKey);
      }
      return newSet;
    });
  };

  const handleUserLongPress = useCallback((user: ChannelUser) => {
    setSelectedUser(user);
    setShowContextMenu(true);
  }, []);

  const handleContextMenuAction = async (action: string) => {
    if (!selectedUser || !channelName) return;
    
    // Keep menu open; show feedback inline
    switch (action) {
      case 'whois':
        if (onWHOISPress) {
          onWHOISPress(selectedUser.nick);
        } else {
          activeIrc.sendCommand(`WHOIS ${selectedUser.nick}`);
          setActionMessage(t('WHOIS requested for {nick}').replace('{nick}', selectedUser.nick));
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
          setActionMessage(t('Enc key offer sent to {nick}').replace('{nick}', selectedUser.nick));
        } catch (e) {
          setActionMessage(t('Failed to share key'));
        }
        break;
      case 'enc_request':
        activeIrc.sendRaw(`PRIVMSG ${selectedUser.nick} :!enc-req`);
        setActionMessage(t('Requested key from {nick}').replace('{nick}', selectedUser.nick));
        encryptedDMService
          .awaitBundleForNick(selectedUser.nick, 36000)
          .then(() => setActionMessage(t('Key saved for {nick}').replace('{nick}', selectedUser.nick)))
          .catch(() => setActionMessage(t('Key not received (timeout)')));
        break;
      case 'enc_qr_show_fingerprint':
        try {
          const selfNick = activeIrc.getCurrentNick();
          const payload = await encryptedDMService.exportFingerprintPayload(selfNick);
          setQrPayload(payload);
          setQrType('fingerprint');
          setShowKeyQr(true);
        } catch (e) {
          setActionMessage(t('Failed to generate QR'));
        }
        break;
      case 'enc_qr_show_bundle':
        try {
          const selfNick = activeIrc.getCurrentNick();
          const payload = await encryptedDMService.exportBundlePayload(selfNick);
          setQrPayload(payload);
          setQrType('bundle');
          setShowKeyQr(true);
        } catch (e) {
          setActionMessage(t('Failed to generate QR'));
        }
        break;
      case 'enc_qr_scan':
        try {
          const permission = hasCameraPermission || (await requestCameraPermission()) === 'authorized';
          if (!permission) {
            setActionMessage(t('Camera permission denied'));
            break;
          }
          scanHandledRef.current = false;
          setShowKeyScan(true);
          setScanError('');
        } catch (e) {
          setActionMessage(t('Failed to open camera'));
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
          setActionMessage(t('Key file shared'));
        } catch (e) {
          setActionMessage(t('Failed to share key file'));
        }
        break;
      case 'enc_import_file':
        try {
          const result = await pick({
            type: [types.allFiles],
            mode: 'import',
          });
          if (result.length === 0) return;
          const picker = result[0];
          const uri = picker.fileCopyUri || picker.uri;
          const path = uri.startsWith('file://') ? uri.replace('file://', '') : uri;
          const contents = await RNFS.readFile(path, 'utf8');
          await handleExternalPayload(contents);
        } catch (e: any) {
          if (isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED) {
            // User cancelled, ignore
          } else {
            setActionMessage(t('Failed to import key file'));
          }
        }
        break;
      case 'enc_share_nfc':
        try {
          const supported = await NfcManager.isSupported();
          if (!supported) {
            setActionMessage(t('NFC not supported'));
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
          setActionMessage(t('NFC key ready, tap devices'));
        } catch (e) {
          setActionMessage(t('Failed to share via NFC'));
        } finally {
          try { await NfcManager.cancelTechnologyRequest(); } catch {}
        }
        break;
      case 'enc_receive_nfc':
        try {
          const supported = await NfcManager.isSupported();
          if (!supported) {
            setActionMessage(t('NFC not supported'));
            break;
          }
          await NfcManager.start();
          await NfcManager.requestTechnology(NfcTech.Ndef);
          const tag = await NfcManager.getTag();
          const ndefMessage = tag?.ndefMessage?.[0];
          const payload = ndefMessage ? Ndef.text.decodePayload(ndefMessage.payload) : null;
          if (!payload) {
            setActionMessage(t('No NFC payload'));
            break;
          }
          await handleExternalPayload(payload);
        } catch (e) {
          setActionMessage(t('Failed to read NFC'));
        } finally {
          try { await NfcManager.cancelTechnologyRequest(); } catch {}
        }
        break;
      case 'enc_verify':
        try {
          const status = network
            ? await encryptedDMService.getVerificationStatusForNetwork(network, selectedUser.nick)
            : await encryptedDMService.getVerificationStatus(selectedUser.nick);
          if (!status.fingerprint) {
            setActionMessage(t('No DM key for {nick}').replace('{nick}', selectedUser.nick));
            break;
          }
          const selfFp = encryptedDMService.formatFingerprintForDisplay(await encryptedDMService.getSelfFingerprint());
          const peerFp = encryptedDMService.formatFingerprintForDisplay(status.fingerprint);
          const verifiedLabel = status.verified ? t('Verified') : t('Mark Verified');
          Alert.alert(
            t('Verify DM Key'),
            t('Compare fingerprints out-of-band:\n\nYou: {self}\n{nick}: {peer}')
              .replace('{self}', selfFp)
              .replace('{nick}', selectedUser.nick)
              .replace('{peer}', peerFp),
            [
              {
                text: verifiedLabel,
                onPress: async () => {
                  if (!status.verified) {
                    const storageNetwork = getNetworkForStorage();
                    await encryptedDMService.setVerifiedForNetwork(storageNetwork, selectedUser.nick, true);
                    setActionMessage(t('Key marked verified for {nick}').replace('{nick}', selectedUser.nick));
                  }
                },
              },
              {
                text: t('Copy Fingerprints'),
                onPress: () => {
                  Clipboard.setString(`You: ${selfFp}\n${selectedUser.nick}: ${peerFp}`);
                  setActionMessage(t('Fingerprints copied'));
                },
              },
              { text: t('Close'), style: 'cancel' },
            ]
          );
        } catch (e) {
          setActionMessage(t('Failed to load fingerprints'));
        }
        break;
      case 'chan_share':
        try {
          const keyData = await channelEncryptionService.exportChannelKey(channelName, network || activeIrc.getNetworkName());
          activeIrc.sendRaw(`PRIVMSG ${selectedUser.nick} :!chanenc-key ${keyData}`);
          setActionMessage(t('Shared channel key with {nick}').replace('{nick}', selectedUser.nick));
        } catch (e: any) {
          setActionMessage(e?.message || t('Failed to share channel key'));
        }
        break;
      case 'chan_request':
        try {
          const requester = activeIrc.getCurrentNick();
          activeIrc.sendRaw(
            `PRIVMSG ${selectedUser.nick} :Please share the channel key for ${channelName} with /chankey share ${requester}`
          );
          setActionMessage(
            t('Requested channel key for {channel} from {nick}')
              .replace('{channel}', channelName)
              .replace('{nick}', selectedUser.nick)
          );
        } catch (e: any) {
          setActionMessage(e?.message || t('Failed to request channel key'));
        }
        break;
      case 'copy':
        setActionMessage(copyNickToClipboard(selectedUser.nick, t));
        break;
      case 'ctcp_ping':
        activeIrc.sendCTCPRequest(selectedUser.nick, 'PING', Date.now().toString());
        setActionMessage(t('CTCP PING sent to {nick}').replace('{nick}', selectedUser.nick));
        break;
      case 'ctcp_version':
        activeIrc.sendCTCPRequest(selectedUser.nick, 'VERSION');
        setActionMessage(t('CTCP VERSION requested from {nick}').replace('{nick}', selectedUser.nick));
        break;
      case 'ctcp_time':
        activeIrc.sendCTCPRequest(selectedUser.nick, 'TIME');
        setActionMessage(t('CTCP TIME requested from {nick}').replace('{nick}', selectedUser.nick));
        break;
      case 'dcc_chat':
        dccChatService.initiateChat(activeIrc, selectedUser.nick, network || activeIrc.getNetworkName());
        setActionMessage(t('DCC CHAT offer sent to {nick}').replace('{nick}', selectedUser.nick));
        break;
      case 'dcc_send':
        // Open the DCC send modal with file picker
        useUIStore.getState().setDccSendTarget({ nick: selectedUser.nick, networkId: network || '' });
        useUIStore.getState().setShowDccSendModal(true);
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
          setActionMessage(t('{nick} unignored').replace('{nick}', selectedUser.nick));
        } else {
          const mask = selectedUser.host
            ? `${selectedUser.nick}!*@${selectedUser.host}`
            : selectedUser.nick;
          userManagementService.ignoreUser(mask, undefined, network);
          setActionMessage(t('{nick} ignored').replace('{nick}', selectedUser.nick));
        }
        break;
      case 'monitor_toggle':
        if (activeIrc.isMonitoring(selectedUser.nick)) {
          activeIrc.unmonitorNick(selectedUser.nick);
          setActionMessage(t('Stopped monitoring {nick}').replace('{nick}', selectedUser.nick));
        } else {
          activeIrc.monitorNick(selectedUser.nick);
          setActionMessage(t('Monitoring {nick}').replace('{nick}', selectedUser.nick));
        }
        break;

      // Operator controls
      case 'give_voice':
        activeIrc.sendCommand(`MODE ${channelName} +v ${selectedUser.nick}`);
        setActionMessage(t('Gave voice to {nick}').replace('{nick}', selectedUser.nick));
        break;
      case 'take_voice':
        activeIrc.sendCommand(`MODE ${channelName} -v ${selectedUser.nick}`);
        setActionMessage(t('Took voice from {nick}').replace('{nick}', selectedUser.nick));
        break;
      case 'give_halfop':
        activeIrc.sendCommand(`MODE ${channelName} +h ${selectedUser.nick}`);
        setActionMessage(t('Gave half-op to {nick}').replace('{nick}', selectedUser.nick));
        break;
      case 'take_halfop':
        activeIrc.sendCommand(`MODE ${channelName} -h ${selectedUser.nick}`);
        setActionMessage(t('Took half-op from {nick}').replace('{nick}', selectedUser.nick));
        break;
      case 'give_op':
        activeIrc.sendCommand(`MODE ${channelName} +o ${selectedUser.nick}`);
        setActionMessage(t('Gave op to {nick}').replace('{nick}', selectedUser.nick));
        break;
      case 'take_op':
        activeIrc.sendCommand(`MODE ${channelName} -o ${selectedUser.nick}`);
        setActionMessage(t('Took op from {nick}').replace('{nick}', selectedUser.nick));
        break;
      case 'kick':
        activeIrc.sendCommand(`KICK ${channelName} ${selectedUser.nick}`);
        setActionMessage(
          t('Kicked {nick} from {channel}')
            .replace('{nick}', selectedUser.nick)
            .replace('{channel}', channelName)
        );
        break;
      case 'kick_message':
        activeIrc.sendCommand(`KICK ${channelName} ${selectedUser.nick} :Kicked`);
        setActionMessage(
          t('Kicked {nick} from {channel}')
            .replace('{nick}', selectedUser.nick)
            .replace('{channel}', channelName)
        );
        break;
      case 'ban':
        const banMask = selectedUser.host ? `*!*@${selectedUser.host}` : `${selectedUser.nick}!*@*`;
        activeIrc.sendCommand(`MODE ${channelName} +b ${banMask}`);
        setActionMessage(t('Banned {mask}').replace('{mask}', banMask));
        break;
      case 'kick_ban':
        const kbMask = selectedUser.host ? `*!*@${selectedUser.host}` : `${selectedUser.nick}!*@*`;
        activeIrc.sendCommand(`MODE ${channelName} +b ${kbMask}`);
        activeIrc.sendCommand(`KICK ${channelName} ${selectedUser.nick}`);
        setActionMessage(t('Kicked + banned {nick}').replace('{nick}', selectedUser.nick));
        break;
      case 'kick_ban_message':
        const kbmMask = selectedUser.host ? `*!*@${selectedUser.host}` : `${selectedUser.nick}!*@*`;
        activeIrc.sendCommand(`MODE ${channelName} +b ${kbmMask}`);
        activeIrc.sendCommand(`KICK ${channelName} ${selectedUser.nick} :Kicked`);
        setActionMessage(t('Kicked + banned {nick}').replace('{nick}', selectedUser.nick));
        break;
      default:
        break;
    }

    // keep menu open; reset feedback after a moment
    if (actionMessage) {
      setTimeout(() => setActionMessage(''), 1500);
    }
  };

  const renderUserRow = useCallback((user: ChannelUser, key?: string) => {
    const prefix = getNickPrefix(user.modes);
    const color = getModeColor(user.modes, colors);
    return (
      <TouchableOpacity
        key={key}
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
  }, [colors, handleUserLongPress, onUserPress, styles.userAccount, styles.userItem, styles.userNick]);

  const emptyState = (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>
        {searchQuery ? t('No users found') : t('No users')}
      </Text>
    </View>
  );

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
          {users.length} {users.length === 1 ? t('user') : t('users')}
        </Text>
      </View>
      
      {/* Search/Filter Input */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder={t('Search users...')}
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
      {groupingActive ? (
        <ScrollView
          style={styles.scrollView}
          keyboardShouldPersistTaps="handled">
          {!hasFilteredUsers ? (
            emptyState
          ) : (
            <>
              {/* Owner */}
              {filteredGroupedUsers.q.length > 0 && (
                <View>
                  <TouchableOpacity
                    style={styles.modeGroupHeader}
                    onPress={() => toggleGroup('q')}
                    activeOpacity={0.7}>
                    <Text style={[styles.modeGroupTitle, { color: getModeColor(['q'], colors) }]}>
                      {collapsedGroups.has('q') ? '▶ ' : '▼ '}{getUserModeDescription('q')?.name || 'Owner'} ({filteredGroupedUsers.q.length})
                    </Text>
                  </TouchableOpacity>
                  {!collapsedGroups.has('q') && filteredGroupedUsers.q.map((user, index) => (
                    renderUserRow(user, `q-${user.nick}-${index}`)
                  ))}
                </View>
              )}

              {/* Admin */}
              {filteredGroupedUsers.a.length > 0 && (
                <View>
                  <TouchableOpacity
                    style={styles.modeGroupHeader}
                    onPress={() => toggleGroup('a')}
                    activeOpacity={0.7}>
                    <Text style={[styles.modeGroupTitle, { color: getModeColor(['a'], colors) }]}>
                      {collapsedGroups.has('a') ? '▶ ' : '▼ '}{getUserModeDescription('a')?.name || 'Admin'} ({filteredGroupedUsers.a.length})
                    </Text>
                  </TouchableOpacity>
                  {!collapsedGroups.has('a') && filteredGroupedUsers.a.map((user, index) => (
                    renderUserRow(user, `a-${user.nick}-${index}`)
                  ))}
                </View>
              )}

              {/* Operator */}
              {filteredGroupedUsers.o.length > 0 && (
                <View>
                  <TouchableOpacity
                    style={styles.modeGroupHeader}
                    onPress={() => toggleGroup('o')}
                    activeOpacity={0.7}>
                    <Text style={[styles.modeGroupTitle, { color: getModeColor(['o'], colors) }]}>
                      {collapsedGroups.has('o') ? '▶ ' : '▼ '}{getUserModeDescription('o')?.name || 'Operator'} ({filteredGroupedUsers.o.length})
                    </Text>
                  </TouchableOpacity>
                  {!collapsedGroups.has('o') && filteredGroupedUsers.o.map((user, index) => (
                    renderUserRow(user, `o-${user.nick}-${index}`)
                  ))}
                </View>
              )}

              {/* Half-Operator */}
              {filteredGroupedUsers.h.length > 0 && (
                <View>
                  <TouchableOpacity
                    style={styles.modeGroupHeader}
                    onPress={() => toggleGroup('h')}
                    activeOpacity={0.7}>
                    <Text style={[styles.modeGroupTitle, { color: getModeColor(['h'], colors) }]}>
                      {collapsedGroups.has('h') ? '▶ ' : '▼ '}{getUserModeDescription('h')?.name || 'Half-Operator'} ({filteredGroupedUsers.h.length})
                    </Text>
                  </TouchableOpacity>
                  {!collapsedGroups.has('h') && filteredGroupedUsers.h.map((user, index) => (
                    renderUserRow(user, `h-${user.nick}-${index}`)
                  ))}
                </View>
              )}

              {/* Voice */}
              {filteredGroupedUsers.v.length > 0 && (
                <View>
                  <TouchableOpacity
                    style={styles.modeGroupHeader}
                    onPress={() => toggleGroup('v')}
                    activeOpacity={0.7}>
                    <Text style={[styles.modeGroupTitle, { color: getModeColor(['v'], colors) }]}>
                      {collapsedGroups.has('v') ? '▶ ' : '▼ '}{getUserModeDescription('v')?.name || 'Voice'} ({filteredGroupedUsers.v.length})
                    </Text>
                  </TouchableOpacity>
                  {!collapsedGroups.has('v') && filteredGroupedUsers.v.map((user, index) => (
                    renderUserRow(user, `v-${user.nick}-${index}`)
                  ))}
                </View>
              )}

              {/* Regular Users (no mode) */}
              {filteredGroupedUsers.none.length > 0 && (
                <View>
                  <TouchableOpacity
                    style={styles.modeGroupHeader}
                    onPress={() => toggleGroup('none')}
                    activeOpacity={0.7}>
                    <Text style={styles.modeGroupTitle}>
                      {collapsedGroups.has('none') ? '▶ ' : '▼ '}{t('Users')} ({filteredGroupedUsers.none.length})
                    </Text>
                  </TouchableOpacity>
                  {!collapsedGroups.has('none') && filteredGroupedUsers.none.map((user, index) => (
                    renderUserRow(user, `none-${user.nick}-${index}`)
                  ))}
                </View>
              )}
            </>
          )}
        </ScrollView>
      ) : virtualizationActive ? (
        <FlatList
          style={styles.scrollView}
          data={filteredUsers}
          renderItem={({ item }) => renderUserRow(item)}
          keyExtractor={(item, index) => `${item.nick}-${index}`}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={emptyState}
        />
      ) : (
        <ScrollView
          style={styles.scrollView}
          keyboardShouldPersistTaps="handled">
          {!hasFilteredUsers ? (
            emptyState
          ) : (
            filteredUsers.map((user, index) => renderUserRow(user, `user-${user.nick}-${index}`))
          )}
        </ScrollView>
      )}

      {/* Context Menu Modal */}
      <Modal
        visible={showContextMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowContextMenu(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowContextMenu(false)}
          />
          <View 
            style={styles.contextMenu}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}>
            {selectedUser && (
              <ScrollView
                style={styles.contextMenuScroll}
                contentContainerStyle={styles.contextMenuContent}
                showsVerticalScrollIndicator
                onStartShouldSetResponder={() => true}
                onMoveShouldSetResponder={() => true}>
                <View style={styles.contextMenuHeader}>
                  <Text style={styles.contextMenuTitle}>
                    {getNickPrefix(selectedUser.modes)}{selectedUser.nick}
                  </Text>
                  {selectedUser.account && selectedUser.account !== '*' && (
                    <Text style={styles.contextMenuSubtitle}>
                      {t('Account: {account}').replace('{account}', selectedUser.account)}
                    </Text>
                  )}
                </View>
                <View style={styles.contextMenuDivider} />

                <View style={styles.contextMenuGroupHeader}>
                  <Text style={styles.contextMenuGroupTitle}>{t('Quick Actions')}</Text>
                </View>
                <TouchableOpacity
                  style={styles.contextMenuItem}
                  onPress={() => handleContextMenuAction('whois')}>
                  <Text style={styles.contextMenuText}>{t('WHOIS')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.contextMenuItem}
                  onPress={() => handleContextMenuAction('query')}>
                  <Text style={styles.contextMenuText}>{t('Open Query')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.contextMenuItem}
                  onPress={() => handleContextMenuAction('copy')}>
                  <Text style={styles.contextMenuText}>{t('Copy Nickname')}</Text>
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
                      ? t('Unignore User')
                      : t('Ignore User')}
                  </Text>
                </TouchableOpacity>
                {activeIrc.capEnabledSet && activeIrc.capEnabledSet.has('monitor') && (
                  <TouchableOpacity
                    style={styles.contextMenuItem}
                    onPress={() => handleContextMenuAction('monitor_toggle')}>
                    <Text style={styles.contextMenuText}>
                      {activeIrc.isMonitoring(selectedUser.nick)
                        ? t('Unmonitor Nick')
                        : t('Monitor Nick')}
                    </Text>
                  </TouchableOpacity>
                )}
                <View style={styles.contextMenuDivider} />

                <View style={styles.contextMenuGroupHeader}>
                  <Text style={styles.contextMenuGroupTitle}>{t('Encryption')}</Text>
                </View>
                <TouchableOpacity
                  style={styles.contextMenuItem}
                  onPress={() => setShowE2EGroup(prev => !prev)}>
                  <Text style={styles.contextMenuText}>
                    {showE2EGroup ? t('E2E Encryption v') : t('E2E Encryption >')}
                  </Text>
                </TouchableOpacity>
                {showE2EGroup && (
                  <View style={styles.subGroup}>
                    <TouchableOpacity
                      style={styles.contextMenuItem}
                      onPress={() => handleContextMenuAction('enc_share')}>
                      <Text style={styles.contextMenuText}>{t('Share DM Key')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.contextMenuItem}
                      onPress={() => handleContextMenuAction('enc_request')}>
                      <Text style={styles.contextMenuText}>{t('Request DM Key (36s)')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.contextMenuItem}
                      onPress={() => handleContextMenuAction('enc_verify')}>
                      <Text style={styles.contextMenuText}>{t('Verify DM Key')}</Text>
                    </TouchableOpacity>
                    {allowQrVerification && (
                      <>
                        <TouchableOpacity
                          style={styles.contextMenuItem}
                          onPress={() => handleContextMenuAction('enc_qr_show_bundle')}>
                          <Text style={styles.contextMenuText}>{t('Share Key Bundle QR')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.contextMenuItem}
                          onPress={() => handleContextMenuAction('enc_qr_show_fingerprint')}>
                          <Text style={styles.contextMenuText}>{t('Show Fingerprint QR (Verify)')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.contextMenuItem}
                          onPress={() => handleContextMenuAction('enc_qr_scan')}>
                          <Text style={styles.contextMenuText}>{t('Scan QR Code')}</Text>
                        </TouchableOpacity>
                      </>
                    )}
                    {allowFileExchange && (
                      <>
                        <TouchableOpacity
                          style={styles.contextMenuItem}
                          onPress={() => handleContextMenuAction('enc_share_file')}>
                          <Text style={styles.contextMenuText}>{t('Share Key File')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.contextMenuItem}
                          onPress={() => handleContextMenuAction('enc_import_file')}>
                          <Text style={styles.contextMenuText}>{t('Import Key File')}</Text>
                        </TouchableOpacity>
                      </>
                    )}
                    {allowNfcExchange && (
                      <>
                        <TouchableOpacity
                          style={styles.contextMenuItem}
                          onPress={() => handleContextMenuAction('enc_share_nfc')}>
                          <Text style={styles.contextMenuText}>{t('Share via NFC')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.contextMenuItem}
                          onPress={() => handleContextMenuAction('enc_receive_nfc')}>
                          <Text style={styles.contextMenuText}>{t('Receive via NFC')}</Text>
                        </TouchableOpacity>
                      </>
                    )}
                    {channelName && (
                      <>
                        <TouchableOpacity
                          style={styles.contextMenuItem}
                          onPress={() => handleContextMenuAction('chan_share')}>
                          <Text style={styles.contextMenuText}>{t('Share Channel Key')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.contextMenuItem}
                          onPress={() => handleContextMenuAction('chan_request')}>
                          <Text style={styles.contextMenuText}>{t('Request Channel Key')}</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                )}
                <View style={styles.contextMenuDivider} />

                <View style={styles.contextMenuGroupHeader}>
                  <Text style={styles.contextMenuGroupTitle}>{t('CTCP')}</Text>
                </View>
                <TouchableOpacity
                  style={styles.contextMenuItem}
                  onPress={() => setShowCTCPGroup(prev => !prev)}>
                  <Text style={styles.contextMenuText}>
                    {showCTCPGroup ? t('CTCP v') : t('CTCP >')}
                  </Text>
                </TouchableOpacity>
                {showCTCPGroup && (
                  <View style={styles.subGroup}>
                    <TouchableOpacity
                      style={styles.contextMenuItem}
                      onPress={() => handleContextMenuAction('ctcp_ping')}>
                      <Text style={styles.contextMenuText}>{t('CTCP PING')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.contextMenuItem}
                      onPress={() => handleContextMenuAction('ctcp_version')}>
                      <Text style={styles.contextMenuText}>{t('CTCP VERSION')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.contextMenuItem}
                      onPress={() => handleContextMenuAction('ctcp_time')}>
                      <Text style={styles.contextMenuText}>{t('CTCP TIME')}</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <View style={styles.contextMenuDivider} />

                <View style={styles.contextMenuGroupHeader}>
                  <Text style={styles.contextMenuGroupTitle}>{t('DCC')}</Text>
                </View>
                <TouchableOpacity
                  style={styles.contextMenuItem}
                  onPress={() => handleContextMenuAction('dcc_chat')}>
                  <Text style={styles.contextMenuText}>{t('Start DCC Chat')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.contextMenuItem}
                  onPress={() => handleContextMenuAction('dcc_send')}>
                  <Text style={styles.contextMenuText}>{t('Offer DCC Send')}</Text>
                </TouchableOpacity>

                {(isCurrentUserOp() || isCurrentUserHalfOp()) && (
                  <>
                    <View style={styles.contextMenuDivider} />
                    <View style={styles.contextMenuGroupHeader}>
                      <Text style={styles.contextMenuGroupTitle}>{t('Operator Controls')}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.contextMenuItem}
                      onPress={() => setShowOpsGroup(prev => !prev)}>
                      <Text style={[styles.contextMenuSubtitle, { fontWeight: '600' }]}>
                        {showOpsGroup ? t('Operator Controls v') : t('Operator Controls >')}
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
                                <Text style={styles.contextMenuText}>{t('Take Voice')}</Text>
                              </TouchableOpacity>
                            ) : (
                              <TouchableOpacity
                                style={styles.contextMenuItem}
                                onPress={() => handleContextMenuAction('give_voice')}>
                                <Text style={styles.contextMenuText}>{t('Give Voice')}</Text>
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
                                <Text style={styles.contextMenuText}>{t('Take Half-Op')}</Text>
                              </TouchableOpacity>
                            ) : (
                              <TouchableOpacity
                                style={styles.contextMenuItem}
                                onPress={() => handleContextMenuAction('give_halfop')}>
                                <Text style={styles.contextMenuText}>{t('Give Half-Op')}</Text>
                              </TouchableOpacity>
                            )}

                            {selectedUser.modes.includes('o') ? (
                              <TouchableOpacity
                                style={styles.contextMenuItem}
                                onPress={() => handleContextMenuAction('take_op')}>
                                <Text style={styles.contextMenuText}>{t('Take Op')}</Text>
                              </TouchableOpacity>
                            ) : (
                              <TouchableOpacity
                                style={styles.contextMenuItem}
                                onPress={() => handleContextMenuAction('give_op')}>
                                <Text style={styles.contextMenuText}>{t('Give Op')}</Text>
                              </TouchableOpacity>
                            )}

                            <TouchableOpacity
                              style={styles.contextMenuItem}
                              onPress={() => handleContextMenuAction('kick')}>
                              <Text style={[styles.contextMenuText, styles.contextMenuWarning]}>
                                {t('Kick')}
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.contextMenuItem}
                              onPress={() => handleContextMenuAction('kick_message')}>
                              <Text style={[styles.contextMenuText, styles.contextMenuWarning]}>
                                {t('Kick (with message)')}
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.contextMenuItem}
                              onPress={() => handleContextMenuAction('ban')}>
                              <Text style={[styles.contextMenuText, styles.contextMenuDanger]}>
                                {t('Ban')}
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.contextMenuItem}
                              onPress={() => handleContextMenuAction('kick_ban')}>
                              <Text style={[styles.contextMenuText, styles.contextMenuDanger]}>
                                {t('Kick + Ban')}
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.contextMenuItem}
                              onPress={() => handleContextMenuAction('kick_ban_message')}>
                              <Text style={[styles.contextMenuText, styles.contextMenuDanger]}>
                                {t('Kick + Ban (with message)')}
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
                    {t('Cancel')}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
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
          <View style={styles.qrModal}>
            <View style={styles.qrModalHeader}>
              <Text style={styles.qrModalTitle}>
                {qrType === 'bundle' ? t('Share Key Bundle') : t('Fingerprint QR')}
              </Text>
              <Text style={styles.qrModalSubtitle}>
                {qrType === 'bundle'
                  ? t('Scan to import encryption key')
                  : t('Scan to verify out-of-band')}
              </Text>
            </View>
            <View style={styles.qrCodeContainer}>
              {qrPayload ? (
                <QRCode
                  value={qrPayload}
                  size={260}
                  backgroundColor="#FFFFFF"
                  color="#000000"
                  ecl="H"
                />
              ) : null}
            </View>
            <TouchableOpacity
              style={styles.qrModalButton}
              onPress={() => {
                if (qrPayload) Clipboard.setString(qrPayload);
                setActionMessage(t('QR payload copied'));
              }}>
              <Text style={styles.qrModalButtonText}>{t('Copy Payload')}</Text>
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
                {scanError || t('Camera unavailable')}
              </Text>
            </View>
          )}
          <View style={styles.scanOverlay}>
            <Text style={styles.scanText}>{t('Scan a fingerprint QR')}</Text>
            <TouchableOpacity
              style={styles.scanClose}
              onPress={() => setShowKeyScan(false)}>
              <Text style={styles.contextMenuText}>{t('Close')}</Text>
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
  modeGroupHeader: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.surfaceVariant || '#F5F5F5',
    borderBottomWidth: 1,
    borderBottomColor: colors.border || '#E0E0E0',
    borderTopWidth: 1,
    borderTopColor: colors.border || '#E0E0E0',
  },
  modeGroupTitle: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: colors.textSecondary || '#757575',
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
  qrModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    minWidth: 300,
    maxWidth: 360,
    width: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
  },
  qrModalHeader: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  qrModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 6,
    textAlign: 'center',
  },
  qrModalSubtitle: {
    fontSize: 13,
    color: '#757575',
    textAlign: 'center',
  },
  qrCodeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#FFFFFF',
  },
  qrModalButton: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  qrModalButtonText: {
    fontSize: 15,
    color: '#2196F3',
    textAlign: 'center',
    fontWeight: '500',
  },
});

/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

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
import { FlashList } from '@shopify/flash-list';
import QRCode from 'react-native-qrcode-svg';
import { Camera, useCameraDevice, useCameraPermission, useCodeScanner } from 'react-native-vision-camera';
import Share from 'react-native-share';
import RNFS from 'react-native-fs';
import { pick, types, errorCodes, isErrorWithCode } from '@react-native-documents/picker';
import NfcManager, { Ndef, NfcTech } from 'react-native-nfc-manager';
import { ChannelUser } from '../services/IRCService';
import { ircService } from '../services/IRCService';
import { userManagementService, BlacklistActionType } from '../services/UserManagementService';
import { banService } from '../services/BanService';
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
import { NickContextMenu } from './NickContextMenu';
import { useDebounce } from '../hooks/useDebounce';

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
  panelSizePx?: number;
  nickFontSizePx?: number;
}

export const UserList: React.FC<UserListProps> = ({
  users,
  channelName,
  network,
  onUserPress,
  onWHOISPress,
  position = 'right',
  panelSizePx = 150,
  nickFontSizePx = 13,
}) => {
  const t = useT();
  const { colors } = useTheme();
  const styles = useMemo(
    () => createStyles(colors, panelSizePx, nickFontSizePx),
    [colors, panelSizePx, nickFontSizePx]
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<ChannelUser | null>(null);
  const [showContextMenu, setShowContextMenu] = useState(false);
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
  const [showBlacklistModal, setShowBlacklistModal] = useState(false);
  const [showBlacklistActionPicker, setShowBlacklistActionPicker] = useState(false);
  const [blacklistAction, setBlacklistAction] = useState<BlacklistActionType>('ban');
  // Only the setter is used (we don't read the current choice in this component).
  const blacklistMaskChoiceState = useState<string>('nick');
  const setBlacklistMaskChoice = blacklistMaskChoiceState[1];
  const [showBlacklistMaskPicker, setShowBlacklistMaskPicker] = useState(false);
  const [selectedBanMaskTypeId, setSelectedBanMaskTypeId] = useState<number | null>(null);
  const [blacklistReason, setBlacklistReason] = useState('');
  const [blacklistCustomCommand, setBlacklistCustomCommand] = useState('');
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [isServerOper, setIsServerOper] = useState(false);
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

  const blacklistActionOptions: Array<{ id: BlacklistActionType; label: string }> = useMemo(() => ([
    { id: 'ignore', label: t('Ignore (local)') },
    { id: 'ban', label: t('Ban') },
    { id: 'kick_ban', label: t('Kick + Ban') },
    { id: 'kill', label: t('Kill') },
    { id: 'os_kill', label: t('OperServ Kill') },
    { id: 'akill', label: t('AKILL') },
    { id: 'gline', label: t('GLINE') },
    { id: 'shun', label: t('SHUN') },
    { id: 'custom', label: t('Custom Command') },
  ]), [t]);

  const getBlacklistBanMaskOptions = useCallback((user: ChannelUser) => {
    // Use ident from user object (from userhost-in-names) or fallback to '*'
    const ident = user?.ident || '*';
    const host = user?.host || '*';
    return banService.getBanMaskTypes().map(type => ({
      id: type.id,
      label: `(${type.id}) ${type.pattern}`,
      mask: banService.generateBanMask(user.nick, ident, host, type.id),
      description: type.description,
    }));
  }, []);

  const getBlacklistTemplate = useCallback(async (action: BlacklistActionType, net?: string) => {
    if (!['akill', 'gline', 'shun'].includes(action)) {
      return '';
    }
    const stored = await settingsService.getSetting('blacklistTemplates', {});
    const base = {
      akill: 'PRIVMSG OperServ :AKILL ADD {usermask} {reason}',
      gline: 'GLINE {hostmask} :{reason}',
      shun: 'SHUN {hostmask} :{reason}',
    };
    const global = stored?.global || {};
    const local = net && stored?.[net] ? stored[net] : {};
    return (local?.[action] || global?.[action] || base[action] || '') as string;
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

  // Get mode color from theme
const getModeColor = (modes?: string[], colors?: any): string => {
    if (!modes || modes.length === 0) return colors?.userNormal || colors?.text || '#212121';
    if (modes.includes('q')) return colors?.userOwner || '#9C27B0'; // ~ owner - purple
    if (modes.includes('a')) return colors?.userAdmin || '#F44336'; // & admin - red
    if (modes.includes('o')) return colors?.userOp || '#FF9800'; // @ op - orange
    if (modes.includes('h')) return colors?.userHalfop || '#2196F3'; // % halfop - blue
    if (modes.includes('v')) return colors?.userVoice || '#4CAF50'; // + voice - green
    return colors?.userNormal || colors?.text || '#212121'; // regular user
  };

  // Debounced search query
  const searchDebounceMs = performanceConfig.userListSearchDebounceMs ?? 300;
  const debouncedSearchQuery = useDebounce(searchQuery, searchDebounceMs);

  // Chunk loading state
  const [displayedUserCount, setDisplayedUserCount] = useState(
    performanceConfig.userListInitialRenderCount ?? 50
  );

  // User list type from config
  const userListType = performanceConfig.userListType ?? 'flashlist';

  // Threshold for skip sort
  const skipSortThreshold = performanceConfig.userListSkipSortThreshold ?? 1000;
  const shouldSkipSort = users.length > skipSortThreshold;

  // Grouping logic
  const groupingEnabled = performanceConfig.userListGrouping !== false;
  const groupingThreshold = performanceConfig.userListAutoDisableGroupingThreshold || 1000;
  
  // Grouping is active only for 'grouped' type, or auto-disabled for large lists
  const groupingActive = userListType === 'grouped' || 
    (userListType !== 'simple' && groupingEnabled && users.length <= groupingThreshold);

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
    // Skip sort for large lists if enabled
    if (shouldSkipSort) {
      return users;
    }

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
  }, [users, shouldSkipSort]);

  const filteredUsers = useMemo(() => {
    if (!debouncedSearchQuery.trim()) return sortedUsers;
    const query = debouncedSearchQuery.toLowerCase();
    return sortedUsers.filter(user =>
      user.nick.toLowerCase().includes(query) ||
      (user.account && user.account.toLowerCase().includes(query))
    );
  }, [sortedUsers, debouncedSearchQuery]);

  // Chunk loading logic
  const chunkedUsers = useMemo(() => {
    if (!performanceConfig.userListEnableChunkLoading) {
      return filteredUsers;
    }
    return filteredUsers.slice(0, displayedUserCount);
  }, [filteredUsers, displayedUserCount, performanceConfig.userListEnableChunkLoading]);

  const handleLoadMore = useCallback(() => {
    if (!performanceConfig.userListEnableChunkLoading) return;
    const chunkSize = performanceConfig.userListChunkSize ?? 100;
    setDisplayedUserCount(prev => Math.min(prev + chunkSize, filteredUsers.length));
  }, [filteredUsers.length, performanceConfig.userListEnableChunkLoading, performanceConfig.userListChunkSize]);

  // Reset chunk on channel/search change
  useEffect(() => {
    setDisplayedUserCount(performanceConfig.userListInitialRenderCount ?? 50);
  }, [channelName, debouncedSearchQuery, performanceConfig.userListInitialRenderCount]);

  // Filter users based on debounced search query
  const filteredGroupedUsers = useMemo(() => {
    if (!debouncedSearchQuery.trim()) return groupedUsers;
    
    const query = debouncedSearchQuery.toLowerCase();
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
  }, [groupedUsers, debouncedSearchQuery]);
  
  // Check if there are any users after filtering
  const hasFilteredUsers = useMemo(() => {
    if (!groupingActive) {
      return chunkedUsers.length > 0;
    }
    return Object.values(filteredGroupedUsers).some(group => group.length > 0);
  }, [filteredGroupedUsers, chunkedUsers.length, groupingActive]);

  const activeIrc = (network ? connectionManager.getConnection(network)?.ircService : null) || ircService;
  useEffect(() => {
    const oper = typeof (activeIrc as any).isServerOper === 'function' ? (activeIrc as any).isServerOper() : false;
    setIsServerOper(oper);
  }, [activeIrc]);

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
    const currentNick = activeIrc.getCurrentNick?.();
    if (currentNick) {
      // Use silent mode to avoid flooding server tab
      if (activeIrc.sendSilentMode) {
        activeIrc.sendSilentMode(currentNick);
      } else {
        // Fallback for older versions
        activeIrc.sendCommand?.(`MODE ${currentNick}`);
      }
      setTimeout(() => {
        const oper = typeof (activeIrc as any).isServerOper === 'function' ? (activeIrc as any).isServerOper() : false;
        setIsServerOper(oper);
      }, 300);
    }
    setShowContextMenu(true);
  }, [activeIrc]);

  const handleContextMenuAction = async (action: string) => {
    if (!selectedUser || !channelName) return;
    
    // Keep menu open; show feedback inline
    switch (action) {
      case 'whois':
        // Check if modal mode is enabled
        const whoisMode = useUIStore.getState().whoisDisplayMode;
        if (whoisMode === 'modal') {
          useUIStore.getState().setWhoisNick(selectedUser.nick);
          useUIStore.getState().setShowWHOIS(true);
        } else if (onWHOISPress) {
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
          activeIrc.addMessage({
            type: 'system',
            channel: selectedUser.nick,
            text: t('*** Encryption key offer sent to {nick}. Waiting for acceptance...', { nick: selectedUser.nick }),
            timestamp: Date.now(),
          });
          setActionMessage(t('Enc key offer sent to {nick}').replace('{nick}', selectedUser.nick));
        } catch (e) {
          setActionMessage(t('Failed to share key'));
        }
        break;
      case 'enc_request':
        activeIrc.sendRaw(`PRIVMSG ${selectedUser.nick} :!enc-req`);
        activeIrc.addMessage({
          type: 'system',
          channel: selectedUser.nick,
          text: t('*** Encryption key requested from {nick}', { nick: selectedUser.nick }),
          timestamp: Date.now(),
        });
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
          const path = `${RNFS.CachesDirectoryPath}/${filename}`;
          try {
            await RNFS.writeFile(path, payload, 'utf8');
            await Share.open({ url: `file://${path}`, type: 'application/json' });
            setActionMessage(t('Key file shared'));
          } finally {
            try {
              if (await RNFS.exists(path)) {
                await RNFS.unlink(path);
              }
            } catch {
              // Ignore cleanup errors
            }
          }
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
          const shouldCleanupCopy = Boolean(picker.fileCopyUri);
          try {
            const contents = await RNFS.readFile(path, 'utf8');
            await handleExternalPayload(contents);
          } finally {
            if (shouldCleanupCopy) {
              try {
                await RNFS.unlink(path);
              } catch {
                // Ignore cleanup errors
              }
            }
          }
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
          const noticeService = (network || activeIrc.getNetworkName())
            ? connectionManager.getConnection(network || activeIrc.getNetworkName())?.ircService || activeIrc
            : activeIrc;
          noticeService.addMessage({
            type: 'notice',
            from: selectedUser.nick,
            text: t('*** Channel key for {channel} shared with {nick}', { channel: channelName, nick: selectedUser.nick }),
            timestamp: Date.now(),
          });
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
      case 'blacklist':
        setBlacklistAction('ban');
        setBlacklistReason('');
        setBlacklistCustomCommand('');
        setBlacklistMaskChoice(selectedUser.host ? 'host' : 'nick');
        setSelectedBanMaskTypeId(2);
        setShowBlacklistModal(true);
        break;
      case 'kill': {
        const targetNick = selectedUser.nick;
        Alert.prompt(
          t('KILL {nick}').replace('{nick}', targetNick),
          t('Enter reason'),
          [
            { text: t('Cancel'), style: 'cancel' },
            {
              text: t('Send'),
              onPress: (reason?: string) => {
                const trimmed = (reason || '').trim();
                if (!trimmed) {
                  Alert.alert(t('Error'), t('Reason is required'));
                  return;
                }
                activeIrc.sendCommand(`KILL ${targetNick} :${trimmed}`);
                setActionMessage(t('KILL sent to {nick}').replace('{nick}', targetNick));
              },
            },
          ],
          'plain-text'
        );
        break;
      }
      case 'add_note': {
        const existingNote = userManagementService.getUserNote(selectedUser.nick, network);
        setNoteText(existingNote || '');
        setShowNoteModal(true);
        break;
      }
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

  const contextConnection = network ? connectionManager.getConnection(network) : null;

  // IMPORTANT: Use the per-connection UserManagementService when available so UI and enforcement
  // are consistent (and Settings -> Blacklist shows the same data immediately).
  const getUserManagementServiceForNetwork = useCallback(() => {
    if (network) {
      const conn = connectionManager.getConnection(network);
      if (conn?.userManagementService) {
        return conn.userManagementService;
      }
    }
    return userManagementService;
  }, [network]);

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
      {userListType === 'grouped' ? (
        // Grouped ScrollView with collapse/expand
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
      ) : userListType === 'flashlist' ? (
        // FlashList - fastest virtualized list
        <FlashList
          style={styles.scrollView}
          data={chunkedUsers}
          renderItem={({ item }) => renderUserRow(item)}
          keyExtractor={(item, index) => `${item.nick}-${index}`}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={emptyState}
          estimatedItemSize={40}
          initialNumToRender={performanceConfig.userListInitialRenderCount ?? 20}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          removeClippedSubviews={true}
        />
      ) : userListType === 'flatlist' ? (
        // FlatList - virtualized fallback
        <FlatList
          style={styles.scrollView}
          data={chunkedUsers}
          renderItem={({ item }) => renderUserRow(item)}
          keyExtractor={(item, index) => `${item.nick}-${index}`}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={emptyState}
          initialNumToRender={performanceConfig.userListInitialRenderCount ?? 20}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          removeClippedSubviews={true}
        />
      ) : (
        // Simple ScrollView
        <ScrollView
          style={styles.scrollView}
          keyboardShouldPersistTaps="handled">
          {!hasFilteredUsers ? (
            emptyState
          ) : (
            chunkedUsers.map((user, index) => renderUserRow(user, `user-${user.nick}-${index}`))
          )}
        </ScrollView>
      )}

      {/* Context Menu Modal */}
      <NickContextMenu
        visible={showContextMenu}
        nick={selectedUser?.nick}
        onClose={() => setShowContextMenu(false)}
        onAction={handleContextMenuAction}
        actionMessage={actionMessage}
        colors={colors}
        connection={contextConnection}
        network={network}
        channel={channelName}
        activeNick={activeIrc.getCurrentNick()}
        allowQrVerification={allowQrVerification}
        allowFileExchange={allowFileExchange}
        allowNfcExchange={allowNfcExchange}
        isServerOper={isServerOper}
        ignoreActionId="ignore"
      />

      <Modal
        visible={showNoteModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNoteModal(false)}>
        <View style={styles.blacklistOverlay}>
          <View style={styles.noteModal}>
            <Text style={styles.blacklistTitle}>{t('User Note')}</Text>
            <TextInput
              style={[styles.noteInput, styles.blacklistInputMultiline]}
              value={noteText}
              onChangeText={setNoteText}
              placeholder={t('Enter note about this user')}
              multiline
              textAlignVertical="top"
            />
            <View style={styles.blacklistButtons}>
              <TouchableOpacity
                style={[styles.blacklistButton, styles.blacklistButtonCancel]}
                onPress={() => setShowNoteModal(false)}>
                <Text style={styles.blacklistButtonText}>{t('Cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.blacklistButton, styles.blacklistButtonPrimary]}
                onPress={async () => {
                  if (!selectedUser) return;
                  if (noteText.trim()) {
                    await getUserManagementServiceForNetwork().addUserNote(selectedUser.nick, noteText.trim(), network);
                  } else {
                    await getUserManagementServiceForNetwork().removeUserNote(selectedUser.nick, network);
                  }
                  setShowNoteModal(false);
                }}>
                <Text style={[styles.blacklistButtonText, styles.blacklistButtonTextPrimary]}>
                  {t('Save')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showBlacklistModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBlacklistModal(false)}>
        <View style={styles.blacklistOverlay}>
          <View style={styles.blacklistModal}>
            <Text style={styles.blacklistTitle}>{t('Add to Blacklist')}</Text>
            {selectedUser && (
              <>
                <Text style={styles.blacklistLabel}>{t('Mask')}</Text>
                <TouchableOpacity
                  style={styles.blacklistPicker}
                  onPress={() => setShowBlacklistMaskPicker(true)}>
                  <Text style={styles.blacklistPickerText}>
                    {getBlacklistBanMaskOptions(selectedUser)
                      .find(opt => opt.id === selectedBanMaskTypeId)?.label || t('Ban mask type (0-11)')}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.blacklistLabel}>{t('Action')}</Text>
                <TouchableOpacity
                  style={styles.blacklistPicker}
                  onPress={() => setShowBlacklistActionPicker(true)}>
                  <Text style={styles.blacklistPickerText}>
                    {blacklistActionOptions.find(opt => opt.id === blacklistAction)?.label || blacklistAction}
                  </Text>
                </TouchableOpacity>
                {blacklistAction === 'custom' && (
                  <TextInput
                    style={styles.blacklistInput}
                    value={blacklistCustomCommand}
                    onChangeText={setBlacklistCustomCommand}
                    placeholder={t('Command template (use {mask}, {usermask}, {hostmask}, {nick})')}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                )}
                <TextInput
                  style={[styles.blacklistInput, styles.blacklistInputMultiline]}
                  value={blacklistReason}
                  onChangeText={setBlacklistReason}
                  placeholder={t('Reason (optional)')}
                  multiline
                />
                <View style={styles.blacklistButtons}>
                  <TouchableOpacity
                    style={[styles.blacklistButton, styles.blacklistButtonCancel]}
                    onPress={() => setShowBlacklistModal(false)}>
                    <Text style={styles.blacklistButtonText}>{t('Cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.blacklistButton, styles.blacklistButtonPrimary]}
                    onPress={async () => {
                      if (!selectedUser) return;
                      const banMaskOptions = getBlacklistBanMaskOptions(selectedUser);
                      const choice = banMaskOptions.find(opt => opt.id === selectedBanMaskTypeId) || banMaskOptions[0];
                      const templateCommand = blacklistAction === 'custom'
                        ? blacklistCustomCommand.trim()
                        : await getBlacklistTemplate(blacklistAction, network);
                      await getUserManagementServiceForNetwork().addBlacklistEntry(
                        choice.mask,
                        blacklistAction,
                        blacklistReason.trim() || undefined,
                        network,
                        templateCommand || undefined
                      );
                      setShowBlacklistModal(false);
                      setActionMessage(t('Added {nick} to blacklist').replace('{nick}', selectedUser.nick));
                    }}>
                    <Text style={[styles.blacklistButtonText, styles.blacklistButtonTextPrimary]}>
                      {t('Add')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={showBlacklistMaskPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBlacklistMaskPicker(false)}>
        <View style={styles.blacklistOverlay}>
          <View style={styles.blacklistModal}>
            <Text style={styles.blacklistTitle}>{t('Select Ban Mask Type')}</Text>
            <ScrollView style={styles.blacklistOptionsScroll}>
              {selectedUser && getBlacklistBanMaskOptions(selectedUser).map(option => (
                <TouchableOpacity
                  key={`banmask-${option.id}`}
                  style={styles.blacklistOption}
                  onPress={() => {
                    setSelectedBanMaskTypeId(option.id);
                    setBlacklistMaskChoice(`banmask_${option.id}`);
                    setShowBlacklistMaskPicker(false);
                  }}>
                  <Text style={[
                    styles.blacklistOptionText,
                    selectedBanMaskTypeId === option.id && styles.blacklistOptionTextSelected,
                  ]}>
                    {option.label} {option.mask}
                  </Text>
                  <Text style={styles.blacklistOptionSubtext}>{option.description}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.blacklistButton, styles.blacklistButtonPrimary]}
              onPress={() => setShowBlacklistMaskPicker(false)}>
              <Text style={[styles.blacklistButtonText, styles.blacklistButtonTextPrimary]}>
                {t('Close')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showBlacklistActionPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBlacklistActionPicker(false)}>
        <View style={styles.blacklistOverlay}>
          <View style={styles.blacklistModal}>
            <Text style={styles.blacklistTitle}>{t('Select Action')}</Text>
            <ScrollView style={styles.blacklistPickerScroll}>
              {blacklistActionOptions.map(option => (
                <TouchableOpacity
                  key={option.id}
                  style={styles.blacklistOption}
                  onPress={() => {
                    setBlacklistAction(option.id);
                    if (option.id !== 'custom') {
                      setBlacklistCustomCommand('');
                    }
                    setShowBlacklistActionPicker(false);
                  }}>
                  <Text style={[
                    styles.blacklistOptionText,
                    blacklistAction === option.id && styles.blacklistOptionTextSelected,
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.blacklistButton, styles.blacklistButtonPrimary]}
              onPress={() => setShowBlacklistActionPicker(false)}>
              <Text style={[styles.blacklistButtonText, styles.blacklistButtonTextPrimary]}>
                {t('Close')}
              </Text>
            </TouchableOpacity>
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

const createStyles = (colors: any = {}, panelSizePx: number = 150, nickFontSizePx: number = 13) => {
  const accountFontSizePx = Math.max(9, nickFontSizePx - 2);
  return StyleSheet.create({
    container: {
      width: panelSizePx,
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
      height: panelSizePx,
      borderBottomWidth: 1,
      borderBottomColor: colors.border || '#E0E0E0',
    },
    containerBottom: {
      width: '100%',
      height: panelSizePx,
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
      fontSize: nickFontSizePx,
      fontWeight: '400',
      color: colors.text || '#212121',
    },
    userAccount: {
      fontSize: accountFontSizePx,
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
  contextMenuHeaderRow: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border || '#E0E0E0',
  },
  contextMenuHeaderText: {
    flex: 1,
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
  contextMenuCopyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border || '#E0E0E0',
    backgroundColor: colors.surface || '#FFFFFF',
  },
  contextMenuCopyText: {
    fontSize: 12,
    color: colors.primary || '#2196F3',
    fontWeight: '600',
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
  contextMenuFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.border || '#E0E0E0',
    paddingVertical: 8,
  },
  contextMenuFooterButton: {
    paddingVertical: 10,
    alignItems: 'center',
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
  contextMenuSubHeader: {
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 16,
  },
  contextMenuSubTitle: {
    fontSize: 11,
    color: colors.textSecondary || '#757575',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
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
  blacklistOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  blacklistModal: {
    backgroundColor: colors.surface || '#FFFFFF',
    borderRadius: 10,
    padding: 16,
    width: '90%',
    maxWidth: 400,
  },
  noteModal: {
    backgroundColor: colors.surface || '#FFFFFF',
    borderRadius: 10,
    padding: 16,
    width: '90%',
    maxWidth: 400,
  },
  blacklistTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text || '#212121',
    marginBottom: 12,
  },
  blacklistLabel: {
    fontSize: 12,
    color: colors.textSecondary || '#757575',
    marginTop: 8,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  blacklistOption: {
    paddingVertical: 8,
  },
  blacklistOptionText: {
    fontSize: 13,
    color: colors.text || '#212121',
  },
  blacklistOptionTextSelected: {
    color: colors.primary || '#2196F3',
    fontWeight: '600',
  },
  blacklistOptionSubtext: {
    fontSize: 12,
    color: colors.textSecondary || colors.text || '#666666',
    marginTop: 2,
  },
  blacklistOptionsScroll: {
    maxHeight: 260,
    marginBottom: 12,
  },
  blacklistPicker: {
    borderWidth: 1,
    borderColor: colors.border || '#E0E0E0',
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
    backgroundColor: colors.surfaceVariant || colors.messageBackground || '#F5F5F5',
    minHeight: 44,
    justifyContent: 'center',
  },
  blacklistPickerText: {
    fontSize: 14,
    color: colors.text || '#212121',
    fontWeight: '500',
  },
  blacklistInput: {
    borderWidth: 1,
    borderColor: colors.border || '#E0E0E0',
    borderRadius: 6,
    padding: 10,
    fontSize: 14,
    color: colors.text || '#212121',
    backgroundColor: colors.surface || '#FFFFFF',
    marginBottom: 10,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: colors.border || '#E0E0E0',
    borderRadius: 6,
    padding: 10,
    fontSize: 14,
    color: colors.text || '#212121',
    backgroundColor: colors.surface || '#FFFFFF',
    marginBottom: 10,
  },
  blacklistInputMultiline: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
  blacklistButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 8,
  },
  blacklistButton: {
    flex: 1,
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  blacklistButtonCancel: {
    backgroundColor: colors.border || '#E0E0E0',
  },
  blacklistButtonPrimary: {
    backgroundColor: colors.primary || '#2196F3',
  },
  blacklistButtonText: {
    fontSize: 14,
    color: colors.text || '#212121',
  },
  blacklistButtonTextPrimary: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  blacklistPickerScroll: {
    maxHeight: 260,
    marginBottom: 8,
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
};

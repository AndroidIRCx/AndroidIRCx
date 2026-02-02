/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * useTabContextMenu Hook
 *
 * Handles tab context menu (long press) logic:
 * - Server tab options (connect/disconnect, browse channels, rename, close)
 * - Channel tab options (leave, encryption, settings, bookmarks, notes, favorites)
 * - Query tab options (close, DM encryption, WHOIS, DCC, ignore)
 */

import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { Alert } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { IRCNetworkConfig, settingsService, DEFAULT_PART_MESSAGE } from '../services/SettingsService';
import { connectionManager } from '../services/ConnectionManager';
import { tabService } from '../services/TabService';
import { channelNotesService } from '../services/ChannelNotesService';
import { channelFavoritesService } from '../services/ChannelFavoritesService';
import { channelEncryptionService } from '../services/ChannelEncryptionService';
import { channelEncryptionSettingsService } from '../services/ChannelEncryptionSettingsService';
import { encryptedDMService } from '../services/EncryptedDMService';
import { dccChatService } from '../services/DCCChatService';
import { useUIStore } from '../stores/uiStore';
import { serverTabId, sortTabsGrouped } from '../utils/tabUtils';
import type { ChannelTab } from '../types';
import { certificateManager } from '../services/CertificateManagerService';
import { FingerprintFormat } from '../types/certificate';

interface UseTabContextMenuParams {
  activeTabId: string | null;
  getNetworkConfigForId: (networkId: string) => Promise<IRCNetworkConfig | null>;
  getActiveIRCService: () => any;
  getActiveUserManagementService: () => any;
  handleConnect: (network?: IRCNetworkConfig, serverId?: string, connectNetworkId?: string) => Promise<void>;
  closeAllChannelsAndQueries: (networkId: string) => Promise<void>;
  normalizeNetworkId: (networkId: string) => string;
  primaryNetworkId: string | null;
  safeAlert: typeof Alert.alert;
  t: (key: string, options?: any) => string;
  setTabs: Dispatch<SetStateAction<ChannelTab[]>>;
  setActiveTabId: (id: string) => void;
  setNetworkName: (name: string) => void;
  setActiveConnectionId: (id: string | null) => void;
  tabSortAlphabetical: boolean;
  ircService: any;
}

/**
 * Hook that handles tab context menu (long press) operations
 * - Server tab: connect/disconnect, browse, rename, close
 * - Channel tab: leave, encryption, settings, bookmarks, favorites
 * - Query tab: close, DM encryption, WHOIS, DCC, ignore
 */
export const useTabContextMenu = (params: UseTabContextMenuParams) => {
  const {
    activeTabId,
    getNetworkConfigForId,
    getActiveIRCService,
    getActiveUserManagementService,
    handleConnect,
    closeAllChannelsAndQueries,
    normalizeNetworkId,
    primaryNetworkId,
    safeAlert,
    t,
    setTabs,
    setActiveTabId,
    setNetworkName,
    setActiveConnectionId,
    tabSortAlphabetical,
    ircService,
  } = params;

  const handleTabLongPress = useCallback(async (tab: ChannelTab) => {
    const options: { text: string; onPress: () => void; style?: 'cancel' | 'destructive' }[] = [];
    let isBookmarked = false;

    if (tab.type === 'server') {
      const tabConnection = connectionManager.getConnection(tab.networkId);
      const isTabConnected = !!tabConnection?.ircService.getConnectionStatus();
      const isPrimaryServer = primaryNetworkId ? tab.networkId === primaryNetworkId : false;
      const svc = tabConnection?.ircService || ircService;
      const currentNick = svc?.getCurrentNick?.() || '';
      if (isTabConnected && currentNick) {
        svc.sendCommand?.(`MODE ${currentNick}`);
      }
      const isServerOper = typeof svc?.isServerOper === 'function' ? svc.isServerOper() : false;

      if (isTabConnected) {
        options.push({
          text: `Disconnect ${tab.networkId}`,
          onPress: () => {
            connectionManager.disconnect(tab.networkId);
            setActiveConnectionId(connectionManager.getActiveNetworkId());
          },
          style: 'destructive',
        });

        // Certificate options (only when connected)
        const networkConfig = await getNetworkConfigForId(tab.networkId);
        if (networkConfig?.clientCert) {
          options.push({
            text: t('View Certificate Fingerprint'),
            onPress: async () => {
              try {
                const fingerprint = certificateManager.extractFingerprintFromPem(networkConfig.clientCert!);
                const formatted = certificateManager.formatFingerprint(
                  fingerprint,
                  FingerprintFormat.COLON_SEPARATED_UPPER
                );
                safeAlert(
                  t('Certificate Fingerprint'),
                  `SHA-256:\n${formatted}\n\nTo add to NickServ:\n/msg NickServ CERT ADD ${formatted}`,
                  [
                    {
                      text: t('Copy Fingerprint'),
                      onPress: () => {
                        Clipboard.setString(formatted);
                        safeAlert(t('Copied'), t('Fingerprint copied to clipboard'));
                      },
                    },
                    {
                      text: t('Copy Command'),
                      onPress: () => {
                        Clipboard.setString(`/msg NickServ CERT ADD ${formatted}`);
                        safeAlert(t('Copied'), t('Command copied to clipboard'));
                      },
                    },
                    { text: t('Close'), style: 'cancel' },
                  ]
                );
              } catch (error) {
                console.error('Failed to extract fingerprint:', error);
                safeAlert(t('Error'), t('Failed to extract certificate fingerprint'));
              }
            },
          });

          options.push({
            text: t('Share Cert with NickServ'),
            onPress: async () => {
              try {
                const fingerprint = certificateManager.extractFingerprintFromPem(networkConfig.clientCert!);
                const formatted = certificateManager.formatFingerprint(
                  fingerprint,
                  FingerprintFormat.COLON_SEPARATED_UPPER
                );
                // Send PRIVMSG directly; "/msg" is a client-side alias and not a server command.
                const tabConnection = connectionManager.getConnection(tab.networkId);
                if (tabConnection?.ircService) {
                  tabConnection.ircService.sendRaw(`PRIVMSG NickServ :CERT ADD ${formatted}`);
                  safeAlert(t('Sent'), t('Certificate fingerprint sent to NickServ'));
                } else {
                  safeAlert(t('Error'), t('Not connected to IRC server'));
                }
              } catch (error) {
                console.error('Failed to send fingerprint:', error);
                safeAlert(t('Error'), t('Failed to send certificate fingerprint'));
              }
            },
          });
        }
      } else {
        options.push({
          text: `Connect ${tab.networkId}`,
          onPress: async () => {
            const networkConfig = await getNetworkConfigForId(tab.networkId);
            if (networkConfig) {
              await handleConnect(networkConfig, undefined, tab.networkId);
            } else {
              safeAlert(
                t('Network Not Found', { _tags: 'screen:app,file:App.tsx,feature:network' }),
                t(
                  'Cannot find saved configuration for "{networkId}". Please configure it first.',
                  {
                    networkId: tab.networkId,
                    _tags: 'screen:app,file:App.tsx,feature:network',
                  }
                )
              );
            }
          },
        });
      }

      options.push({
        text: 'Browse Channels',
        onPress: () => {
          setActiveTabId(tab.id);
          useUIStore.getState().setShowChannelList(true);
        },
      });
      options.push({
        text: 'Close All Channels + PVTS',
        onPress: async () => {
          useUIStore.getState().setShowTabOptionsModal(false);
          await closeAllChannelsAndQueries(tab.networkId);
        },
      });
      options.push({
        text: 'Connect Another Network',
        onPress: () => {
          useUIStore.getState().setShowNetworksList(true);
        },
      });
      options.push({
        text: 'Rename Server Tab',
        onPress: () => {
          useUIStore.getState().setRenameTargetTabId(tab.id);
          useUIStore.getState().setRenameValue(tab.name);
          useUIStore.getState().setShowRenameModal(true);
        },
      });
      if (isServerOper) {
        options.push({
          text: 'IRCop Commands',
          onPress: () => {
            const ircopOptions = [
              { text: 'ADMIN', onPress: () => svc.sendCommand('ADMIN') },
              { text: 'INFO', onPress: () => svc.sendCommand('INFO') },
              { text: 'VERSION', onPress: () => svc.sendCommand('VERSION') },
              { text: 'TIME', onPress: () => svc.sendCommand('TIME') },
              { text: 'MOTD', onPress: () => svc.sendCommand('MOTD') },
              { text: 'LUSERS', onPress: () => svc.sendCommand('LUSERS') },
              { text: 'LINKS', onPress: () => svc.sendCommand('LINKS') },
              {
                text: 'STATS',
                onPress: () => {
                  useUIStore.getState().setShowTabOptionsModal(false);
                  Alert.prompt(
                    'STATS',
                    'Enter STATS query (optional)',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Send',
                        onPress: (query?: string) => {
                          const trimmed = (query || '').trim();
                          svc.sendCommand(trimmed ? `STATS ${trimmed}` : 'STATS');
                        },
                      },
                    ],
                    'plain-text'
                  );
                },
              },
              { text: 'TRACE', onPress: () => svc.sendCommand('TRACE') },
              {
                text: 'REHASH',
                onPress: () => safeAlert('REHASH', 'Rehash server configuration?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Rehash', onPress: () => svc.sendCommand('REHASH') },
                ]),
              },
              {
                text: 'RESTART',
                onPress: () => safeAlert('RESTART', 'Restart IRC server?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Restart', onPress: () => svc.sendCommand('RESTART') },
                ]),
              },
              {
                text: 'DIE',
                onPress: () => safeAlert('DIE', 'Shut down IRC server?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Shutdown', onPress: () => svc.sendCommand('DIE') },
                ]),
              },
              {
                text: 'WALLOP',
                onPress: () => {
                  Alert.prompt(
                    'WALLOP',
                    'Enter WALLOP message',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Send',
                        onPress: (message?: string) => {
                          const trimmed = (message || '').trim();
                          if (!trimmed) return;
                          svc.sendCommand(`WALLOP :${trimmed}`);
                        },
                      },
                    ],
                    'plain-text'
                  );
                },
              },
              { text: 'Cancel', style: 'cancel', onPress: () => {} },
            ];
            useUIStore.getState().setTabOptionsTitle(`IRCop: ${tab.networkId}`);
            useUIStore.getState().setTabOptions(ircopOptions);
            useUIStore.getState().setShowTabOptionsModal(true);
          },
        });
      }
      if (!isPrimaryServer) {
        options.push({
          text: 'Close Server Tab',
          onPress: async () => {
            useUIStore.getState().setShowTabOptionsModal(false);
            if (tabConnection) {
              await connectionManager.disconnect(tab.networkId);
            }
            await tabService.saveTabs(tab.networkId, []);
            setTabs(prev => {
              const updated = sortTabsGrouped(prev.filter(t => t.networkId !== tab.networkId), tabSortAlphabetical);
              if (!updated.some(t => t.id === activeTabId)) {
                const primaryServerId = primaryNetworkId ? serverTabId(primaryNetworkId) : '';
                const fallbackId =
                  (primaryServerId && updated.some(t => t.id === primaryServerId))
                    ? primaryServerId
                    : updated.find(t => t.type === 'server')?.id || updated[0]?.id || '';
                if (fallbackId) {
                  setActiveTabId(fallbackId);
                  const fallbackTab = updated.find(t => t.id === fallbackId);
                  if (fallbackTab) {
                    setNetworkName(fallbackTab.networkId);
                  }
                }
                // Don't set networkName to 'Not connected' - keep current network
              }
              return updated;
            });
            setActiveConnectionId(connectionManager.getActiveNetworkId());
          },
          style: 'destructive',
        });
      }
      options.push({
        text: 'Cancel',
        onPress: () => {},
        style: 'cancel',
      });
      useUIStore.getState().setTabOptionsTitle(`Server: ${tab.networkId}`);
      useUIStore.getState().setTabOptions(options);
      useUIStore.getState().setShowTabOptionsModal(true);
      return;
    }

    // Option to leave channel or close query
    if (tab.type === 'channel') {
      try {
        isBookmarked = await channelNotesService.isBookmarked(tab.networkId, tab.name);
      } catch (err) {
        // Ignore bookmark lookup errors; default to false and still show menu
        isBookmarked = false;
      }
      options.push({
        text: 'Leave Channel',
        onPress: async () => {
          const activeIRCService = getActiveIRCService();
          const partMessage = await settingsService.getSetting('partMessage', DEFAULT_PART_MESSAGE);
          activeIRCService.partChannel(tab.name, partMessage);
          tabService.removeTab(tab.networkId, tab.id);
          setTabs(prev => prev.filter(t => t.id !== tab.id));
          if (activeTabId === tab.id) {
            setActiveTabId(serverTabId(tab.networkId)); // Switch to server tab if active tab is closed
          }
        },
        style: 'destructive',
      });
      const channelEncLabel = tab.sendEncrypted ? 'Send Plaintext (Unlock)' : 'Send Encrypted (Lock)';
      options.push({
        text: channelEncLabel,
        onPress: async () => {
          if (!tab.sendEncrypted) {
            const hasKey = await channelEncryptionService.hasChannelKey(tab.name, tab.networkId);
            if (!hasKey) {
              const svc = connectionManager.getConnection(tab.networkId)?.ircService || ircService;
              svc.addMessage({
                type: 'error',
                text: `*** No channel key stored for ${tab.name}. Generate with /chankey generate then share.`,
                timestamp: Date.now(),
              });
              return;
            }
          }
          const nextValue = !tab.sendEncrypted;
          setTabs(prev =>
            prev.map(t => t.id === tab.id ? { ...t, sendEncrypted: nextValue } : t)
          );
          const svc = connectionManager.getConnection(tab.networkId)?.ircService || ircService;
          svc.addMessage({
            type: 'notice',
            channel: tab.name,
            text: nextValue ? `*** Channel encryption enabled for ${tab.name}` : `*** Channel encryption disabled for ${tab.name}`,
            timestamp: Date.now(),
          });
          useUIStore.getState().setShowTabOptionsModal(false);
        },
      });
    } else if (tab.type === 'query') {
      // Encryption options for DMs
      const alwaysEncryptEnabled = await channelEncryptionSettingsService.getAlwaysEncrypt(tab.name, tab.networkId);
      const network = tab.networkId || '';
      const hasBundle = await encryptedDMService.isEncryptedForNetwork(network, tab.name);

      options.push({
        text: `Always Encrypt: ${alwaysEncryptEnabled ? 'ON' : 'OFF'}`,
        onPress: async () => {
          const newValue = await channelEncryptionSettingsService.toggleAlwaysEncrypt(tab.name, tab.networkId);
          if (newValue && !hasBundle) {
            Alert.alert(
              t('No Encryption Bundle'),
              t('Always-encrypt is now enabled, but no encryption bundle exists. Share your key with this user to enable encryption.'),
              [{ text: t('OK') }]
            );
          }
          useUIStore.getState().setShowTabOptionsModal(false);
        },
      });

      options.push({
        text: 'Close Query',
        onPress: async () => {
          const activeIRCService = getActiveIRCService();
          tabService.removeTab(tab.networkId, tab.id);
          setTabs(prev => prev.filter(t => t.id !== tab.id));
          if (activeTabId === tab.id) {
            setActiveTabId(serverTabId(tab.networkId)); // Switch to server tab if active tab is closed
          }

          const closePrivateMessage = await settingsService.getSetting('closePrivateMessage', false);
          if (closePrivateMessage) {
            const ircServices = await settingsService.getSetting('ircServices', ['nickserv', 'chanserv', 'memoserv', 'operserv', 'hostserv', 'botserv']);
            if (!ircServices.includes(tab.name.toLowerCase())) {
              const closePrivateMessageText = await settingsService.getSetting('closePrivateMessageText', 'Closing window');
              activeIRCService.sendRaw(`PRIVMSG ${tab.name} :${closePrivateMessageText}`);
            }
          }
        },
        style: 'destructive',
      });
      options.push({
        text: 'Share DM Key',
        onPress: async () => {
          try {
            const bundle = await encryptedDMService.exportBundle();
            const svc = connectionManager.getConnection(tab.networkId)?.ircService || ircService;
            svc.sendRaw(`PRIVMSG ${tab.name} :!enc-offer ${JSON.stringify(bundle)}`);
            svc.addMessage({
              type: 'notice',
              channel: tab.name,
              text: `*** Encryption key offer sent to ${tab.name}. Waiting for acceptance...`,
              timestamp: Date.now(),
            });
          } catch (e: any) {
            const svc = connectionManager.getConnection(tab.networkId)?.ircService || ircService;
            svc.addMessage({
              type: 'error',
              channel: tab.name,
              text: `*** Failed to share encryption key: ${e?.message || e}`,
              timestamp: Date.now(),
            });
          }
          useUIStore.getState().setShowTabOptionsModal(false);
        },
      });
      options.push({
        text: 'Request DM Key',
        onPress: () => {
          const svc = connectionManager.getConnection(tab.networkId)?.ircService || ircService;
          svc.sendRaw(`PRIVMSG ${tab.name} :!enc-req`);
          svc.addMessage({
            type: 'notice',
            channel: tab.name,
            text: `*** Encryption key requested from ${tab.name}`,
            timestamp: Date.now(),
          });
          useUIStore.getState().setShowTabOptionsModal(false);
        },
      });
      const queryEncLabel = tab.sendEncrypted ? 'Send Plaintext (Unlock)' : 'Send Encrypted (Lock)';
      options.push({
        text: queryEncLabel,
        onPress: async () => {
          if (!tab.sendEncrypted) {
            const network = tab.networkId || '';
            const hasBundle = await encryptedDMService.isEncryptedForNetwork(network, tab.name);
            if (!hasBundle) {
              const svc = connectionManager.getConnection(tab.networkId)?.ircService || ircService;
              svc.addMessage({
                type: 'error',
                text: `*** No DM key with ${tab.name}. Use /sharekey or /requestkey first.`,
                timestamp: Date.now(),
              });
              return;
            }
          }
          const nextValue = !tab.sendEncrypted;
          setTabs(prev =>
            prev.map(t => t.id === tab.id ? { ...t, sendEncrypted: nextValue } : t)
          );
          const svc = connectionManager.getConnection(tab.networkId)?.ircService || ircService;
          svc.addMessage({
            type: 'notice',
            channel: tab.name,
            text: nextValue ? `*** DM encryption enabled with ${tab.name}` : `*** DM encryption disabled with ${tab.name}`,
            timestamp: Date.now(),
          });
          useUIStore.getState().setShowTabOptionsModal(false);
        },
      });
      options.push({
        text: 'WHOIS',
        onPress: () => {
          useUIStore.getState().setWhoisNick(tab.name);
          useUIStore.getState().setShowWHOIS(true);
          useUIStore.getState().setShowTabOptionsModal(false);
        },
      });
      options.push({
        text: 'Start DCC Chat',
        onPress: () => {
          dccChatService.initiateChat(getActiveIRCService(), tab.name, tab.networkId);
          useUIStore.getState().setShowTabOptionsModal(false);
        },
      });
      options.push({
        text: 'Offer DCC Send',
        onPress: () => {
          useUIStore.getState().setDccSendTarget({ nick: tab.name, networkId: tab.networkId });
          useUIStore.getState().setShowDccSendModal(true);
          useUIStore.getState().setShowTabOptionsModal(false);
        },
      });
      options.push({
        text: 'WHOWAS',
        onPress: () => {
          const conn = connectionManager.getConnection(tab.networkId);
          (conn?.ircService || getActiveIRCService()).sendCommand(`WHOWAS ${tab.name}`);
          useUIStore.getState().setShowTabOptionsModal(false);
        },
      });
      options.push({
        text: 'Ignore User',
        onPress: async () => {
          const svc = connectionManager.getConnection(tab.networkId)?.userManagementService || getActiveUserManagementService();
          await svc.ignoreUser(tab.name, undefined, tab.networkId);
          useUIStore.getState().setShowTabOptionsModal(false);
        },
      });

      // Add blacklist option for queries
      options.push({
        text: 'Blacklist',
        onPress: () => {
          useUIStore.getState().setShowBlacklist(true);
          useUIStore.getState().setBlacklistTarget({
            type: 'query',
            networkId: tab.networkId,
            nick: tab.name,
          });
        },
      });
    }

    // Option for Channel Settings
    if (tab.type === 'channel') {
      options.push({
        text: 'Generate Channel Key',
        onPress: async () => {
          try {
            await channelEncryptionService.generateChannelKey(tab.name, tab.networkId);
            const svc = connectionManager.getConnection(tab.networkId)?.ircService || ircService;
            svc.addMessage({
              type: 'notice',
              text: `*** Channel encryption key generated for ${tab.name}. Use /chankey share <nick> to share.`,
              timestamp: Date.now(),
            });
          } catch (e: any) {
            const svc = connectionManager.getConnection(tab.networkId)?.ircService || ircService;
            svc.addMessage({
              type: 'error',
              text: `*** Failed to generate channel key: ${e?.message || e}`,
              timestamp: Date.now(),
            });
          }
        },
      });
      options.push({
        text: 'Channel Settings',
        onPress: () => {
          useUIStore.getState().setChannelSettingsTarget(tab.name);
          useUIStore.getState().setChannelSettingsNetwork(tab.networkId);
          useUIStore.getState().setShowChannelSettings(true);
        },
      });

      // Encryption options
      const alwaysEncryptEnabled = await channelEncryptionSettingsService.getAlwaysEncrypt(tab.name, tab.networkId);
      const hasEncKey = await channelEncryptionService.hasChannelKey(tab.name, tab.networkId);

      options.push({
        text: `Always Encrypt: ${alwaysEncryptEnabled ? 'ON' : 'OFF'}`,
        onPress: async () => {
          const newValue = await channelEncryptionSettingsService.toggleAlwaysEncrypt(tab.name, tab.networkId);
          if (newValue && !hasEncKey) {
            Alert.alert(
              'No Encryption Key',
              'Always-encrypt is now enabled, but no encryption key exists. Generate or request a key to enable encryption.',
              [{ text: 'OK' }]
            );
          }
          useUIStore.getState().setShowTabOptionsModal(false);
        },
      });

      if (!hasEncKey) {
        options.push({
          text: 'Request Encryption Key',
          onPress: () => {
            useUIStore.getState().setShowTabOptionsModal(false);
            Alert.prompt(
              'Request Key',
              'Enter the nickname to request the encryption key from:',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Request',
                  onPress: (nick?: string) => {
                    if (nick && nick.trim()) {
                      const svc = connectionManager.getConnection(tab.networkId)?.ircService || ircService;
                      svc.sendCommand(`/chankey request ${nick.trim()}`);
                      svc.addMessage({
                        id: `sys-${Date.now()}`,
                        from: '*',
                        channel: tab.name,
                        text: `Key request sent to ${nick.trim()}`,
                        timestamp: Date.now(),
                        type: 'notice',
                      });
                    }
                  },
                },
              ],
              'plain-text'
            );
          },
        });
      } else {
        options.push({
          text: 'Share Encryption Key',
          onPress: () => {
            useUIStore.getState().setShowTabOptionsModal(false);
            Alert.prompt(
              'Share Key',
              'Enter the nickname to share the encryption key with:',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Share',
                  onPress: (nick?: string) => {
                    if (nick && nick.trim()) {
                      const svc = connectionManager.getConnection(tab.networkId)?.ircService || ircService;
                      svc.sendCommand(`/chankey share ${nick.trim()}`);
                      svc.addMessage({
                        id: `sys-${Date.now()}`,
                        from: '*',
                        channel: tab.name,
                        text: `Key shared with ${nick.trim()}`,
                        timestamp: Date.now(),
                        type: 'notice',
                      });
                    }
                  },
                },
              ],
              'plain-text'
            );
          },
        });
      }

      options.push({
        text: isBookmarked ? 'Remove Channel Bookmark' : 'Bookmark Channel',
        onPress: async () => {
          await channelNotesService.setBookmarked(tab.networkId, tab.name, !isBookmarked);
          useUIStore.getState().setShowTabOptionsModal(false);
        },
      });
      options.push({
        text: 'Edit Channel Note',
        onPress: async () => {
          const note = await channelNotesService.getNote(tab.networkId, tab.name);
          useUIStore.getState().setChannelNoteTarget({ networkId: tab.networkId, channel: tab.name });
          useUIStore.getState().setChannelNoteValue(note);
          useUIStore.getState().setShowChannelNoteModal(true);
        },
      });
      options.push({
        text: 'View Activity Log',
        onPress: async () => {
          const log = await channelNotesService.getLog(tab.networkId, tab.name);
          useUIStore.getState().setChannelNoteTarget({ networkId: tab.networkId, channel: tab.name });
          useUIStore.getState().setChannelLogEntries(log.slice().sort((a, b) => a.timestamp - b.timestamp));
          useUIStore.getState().setShowChannelLogModal(true);
        },
      });

      // Add blacklist option
      options.push({
        text: 'Blacklist',
        onPress: () => {
          useUIStore.getState().setShowBlacklist(true);
          useUIStore.getState().setBlacklistTarget({
            type: 'channel',
            networkId: tab.networkId,
            channel: tab.name,
          });
        },
      });
    }

    // Option to add/remove from favorites
    // Normalize network ID to base network name to ensure favorites are stored per base network
    // "DBase (1)" -> "DBase", "DBase (2)" -> "DBase", "DBase" -> "DBase"
    const baseNetworkId = normalizeNetworkId(tab.networkId);
    const isFav = await channelFavoritesService.isFavorite(baseNetworkId, tab.name);
    if (isFav) {
      options.push({
        text: 'Remove from Favorites',
        onPress: async () => {
          await channelFavoritesService.removeFavorite(baseNetworkId, tab.name);
          useUIStore.getState().setShowTabOptionsModal(true);
        },
      });
    } else if (tab.type === 'channel') { // Only channels can be favorited
      options.push({
        text: 'Add to Favorites',
        onPress: async () => {
          await channelFavoritesService.addFavorite(baseNetworkId, tab.name);
          useUIStore.getState().setShowTabOptionsModal(true);
        },
      });
    }

    options.push({ text: 'Cancel', style: 'cancel', onPress: () => useUIStore.getState().setShowTabOptionsModal(false) });

    useUIStore.getState().setTabOptionsTitle(`${tab.type === 'channel' ? 'Channel' : 'Query'}: ${tab.name}`);
    useUIStore.getState().setTabOptions(options);
    useUIStore.getState().setShowTabOptionsModal(true);
  }, [
    activeTabId,
    getNetworkConfigForId,
    getActiveIRCService,
    getActiveUserManagementService,
    handleConnect,
    closeAllChannelsAndQueries,
    normalizeNetworkId,
    primaryNetworkId,
    safeAlert,
    t,
    setTabs,
    setActiveTabId,
    setNetworkName,
    setActiveConnectionId,
    tabSortAlphabetical,
    ircService,
  ]);

  return { handleTabLongPress };
};

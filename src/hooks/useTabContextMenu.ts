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
import { serviceCommandProvider } from '../services/ServiceCommandProvider';

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
      const svc = tabConnection?.ircService || ircService;
      const currentNick = svc?.getCurrentNick?.() || '';
      if (isTabConnected && currentNick) {
        // Use silent mode to avoid flooding server tab
        if (svc.sendSilentMode) {
          svc.sendSilentMode(currentNick);
        } else {
          // Fallback for older versions
          svc.sendCommand?.(`MODE ${currentNick}`);
        }
      }
      const isServerOper = typeof svc?.isServerOper === 'function' ? svc.isServerOper() : false;

      if (isTabConnected) {
        options.push({
          text: t('Disconnect {network}', { network: tab.networkId }),
          icon: 'lan-disconnect',
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
            icon: 'certificate',
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
            icon: 'share-variant',
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
          text: t('Connect {network}', { network: tab.networkId }),
          icon: 'lan-connect',
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
        text: t('Browse Channels'),
        icon: 'forum-outline',
        onPress: () => {
          setActiveTabId(tab.id);
          useUIStore.getState().setShowChannelList(true);
        },
      });
      options.push({
        text: t('Close All Channels + PVTS'),
        icon: 'close-box-multiple',
        onPress: async () => {
          useUIStore.getState().setShowTabOptionsModal(false);
          await closeAllChannelsAndQueries(tab.networkId);
        },
      });
      options.push({
        text: t('Connect Another Network'),
        icon: 'plus-network',
        onPress: () => {
          useUIStore.getState().setShowNetworksList(true);
        },
      });
      options.push({
        text: t('Rename Server Tab'),
        icon: 'rename-box',
        onPress: () => {
          useUIStore.getState().setRenameTargetTabId(tab.id);
          useUIStore.getState().setRenameValue(tab.name);
          useUIStore.getState().setShowRenameModal(true);
        },
      });
      if (isServerOper) {
        options.push({
          text: t('IRCop Commands'),
          icon: 'shield-account',
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
      // Allow closing server tabs that don't have a favorite/default server
      const networkConfig = (await settingsService.loadNetworks()).find(n => n.name === tab.networkId || n.id === tab.networkId);
      const hasFavoriteServer = networkConfig?.servers?.some(s => s.favorite) || !!networkConfig?.defaultServerId;
      if (!hasFavoriteServer) {
        options.push({
          text: t('Close Server Tab'),
          icon: 'close-circle',
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
        text: t('Leave Channel'),
        icon: 'exit-to-app',
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
      const channelEncLabel = tab.sendEncrypted ? t('Send Plaintext (Unlock)') : t('Send Encrypted (Lock)');
      options.push({
        text: channelEncLabel,
        icon: tab.sendEncrypted ? 'lock-open' : 'lock',
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
        text: t('Always Encrypt: {status}', { status: alwaysEncryptEnabled ? 'ON' : 'OFF' }),
        icon: 'shield-lock',
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
        text: t('Close Query'),
        icon: 'close-circle',
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
        text: t('Share DM Key'),
        icon: 'key-variant',
        onPress: async () => {
          try {
            const bundle = await encryptedDMService.exportBundle();
            const svc = connectionManager.getConnection(tab.networkId)?.ircService || ircService;
            svc.sendRaw(`PRIVMSG ${tab.name} :!enc-offer ${JSON.stringify(bundle)}`);
            svc.addMessage({
              type: 'system',
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
        text: t('Request DM Key'),
        icon: 'key-plus',
        onPress: () => {
          const svc = connectionManager.getConnection(tab.networkId)?.ircService || ircService;
          svc.sendRaw(`PRIVMSG ${tab.name} :!enc-req`);
          svc.addMessage({
            type: 'system',
            channel: tab.name,
            text: `*** Encryption key requested from ${tab.name}`,
            timestamp: Date.now(),
          });
          useUIStore.getState().setShowTabOptionsModal(false);
        },
      });
      const queryEncLabel = tab.sendEncrypted ? t('Send Plaintext (Unlock)') : t('Send Encrypted (Lock)');
      options.push({
        text: queryEncLabel,
        icon: tab.sendEncrypted ? 'lock-open' : 'lock',
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
        text: t('WHOIS'),
        icon: 'account-search',
        onPress: () => {
          useUIStore.getState().setWhoisNick(tab.name);
          useUIStore.getState().setShowWHOIS(true);
          useUIStore.getState().setShowTabOptionsModal(false);
        },
      });
      options.push({
        text: t('Start DCC Chat'),
        icon: 'chat',
        onPress: () => {
          dccChatService.initiateChat(getActiveIRCService(), tab.name, tab.networkId);
          useUIStore.getState().setShowTabOptionsModal(false);
        },
      });
      options.push({
        text: t('Offer DCC Send'),
        icon: 'file-send',
        onPress: () => {
          useUIStore.getState().setDccSendTarget({ nick: tab.name, networkId: tab.networkId });
          useUIStore.getState().setShowDccSendModal(true);
          useUIStore.getState().setShowTabOptionsModal(false);
        },
      });
      options.push({
        text: t('WHOWAS'),
        icon: 'history',
        onPress: () => {
          const conn = connectionManager.getConnection(tab.networkId);
          (conn?.ircService || getActiveIRCService()).sendCommand(`WHOWAS ${tab.name}`);
          useUIStore.getState().setShowTabOptionsModal(false);
        },
      });
      options.push({
        text: t('Ignore User'),
        icon: 'account-off',
        onPress: async () => {
          const svc = connectionManager.getConnection(tab.networkId)?.userManagementService || getActiveUserManagementService();
          await svc.ignoreUser(tab.name, undefined, tab.networkId);
          useUIStore.getState().setShowTabOptionsModal(false);
        },
      });

      // Add blacklist option for queries
      options.push({
        text: t('Blacklist'),
        icon: 'block-helper',
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
        text: t('Generate Channel Key'),
        icon: 'key-plus',
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
        text: t('Channel Settings'),
        icon: 'cog',
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
        text: t('Always Encrypt: {status}', { status: alwaysEncryptEnabled ? 'ON' : 'OFF' }),
        icon: 'shield-lock',
        onPress: async () => {
          const newValue = await channelEncryptionSettingsService.toggleAlwaysEncrypt(tab.name, tab.networkId);
          if (newValue && !hasEncKey) {
            Alert.alert(
              t('No Encryption Key'),
              t('Always-encrypt is now enabled, but no encryption key exists. Generate or request a key to enable encryption.'),
              [{ text: t('OK') }]
            );
          }
          useUIStore.getState().setShowTabOptionsModal(false);
        },
      });

      if (!hasEncKey) {
        options.push({
          text: t('Request Encryption Key'),
          icon: 'key-arrow-right',
          onPress: () => {
            useUIStore.getState().setShowTabOptionsModal(false);
            Alert.prompt(
              t('Request Key'),
              t('Enter the nickname to request the encryption key from:'),
              [
                { text: t('Cancel'), style: 'cancel' },
                {
                  text: t('Request'),
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
          text: t('Share Encryption Key'),
          icon: 'key-variant',
          onPress: () => {
            useUIStore.getState().setShowTabOptionsModal(false);
            Alert.prompt(
              t('Share Key'),
              t('Enter the nickname to share the encryption key with:'),
              [
                { text: t('Cancel'), style: 'cancel' },
                {
                  text: t('Share'),
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
        text: isBookmarked ? t('Remove Channel Bookmark') : t('Bookmark Channel'),
        icon: isBookmarked ? 'bookmark-off' : 'bookmark',
        onPress: async () => {
          await channelNotesService.setBookmarked(tab.networkId, tab.name, !isBookmarked);
          useUIStore.getState().setShowTabOptionsModal(false);
        },
      });
      options.push({
        text: t('Edit Channel Note'),
        icon: 'note-edit',
        onPress: async () => {
          const note = await channelNotesService.getNote(tab.networkId, tab.name);
          useUIStore.getState().setChannelNoteTarget({ networkId: tab.networkId, channel: tab.name });
          useUIStore.getState().setChannelNoteValue(note);
          useUIStore.getState().setShowChannelNoteModal(true);
        },
      });
      options.push({
        text: t('View Activity Log'),
        icon: 'history',
        onPress: async () => {
          const log = await channelNotesService.getLog(tab.networkId, tab.name);
          useUIStore.getState().setChannelNoteTarget({ networkId: tab.networkId, channel: tab.name });
          useUIStore.getState().setChannelLogEntries(log.slice().sort((a, b) => a.timestamp - b.timestamp));
          useUIStore.getState().setShowChannelLogModal(true);
        },
      });

      // Add blacklist option
      options.push({
        text: t('Blacklist'),
        icon: 'block-helper',
        onPress: () => {
          useUIStore.getState().setShowBlacklist(true);
          useUIStore.getState().setBlacklistTarget({
            type: 'channel',
            networkId: tab.networkId,
            channel: tab.name,
          });
        },
      });

      // IRC Services (ChanServ) commands
      const channelServiceCommands = serviceCommandProvider.getServiceCommands(tab.networkId, 'chanserv');
      if (channelServiceCommands.length > 0) {
        options.push({
          text: t('IRC Services') + ' >',
          icon: 'server',
          onPress: () => {
            const chanserv = channelServiceCommands[0]?.service || 'ChanServ';
            const serviceOptions = [
              {
                text: t('OP (Give Op)'),
                icon: 'shield-account',
                onPress: () => {
                  const svc = connectionManager.getConnection(tab.networkId)?.ircService || ircService;
                  svc.sendRaw(`PRIVMSG ${chanserv} :OP ${tab.name}`);
                  useUIStore.getState().setShowTabOptionsModal(false);
                },
              },
              {
                text: t('DEOP (Remove Op)'),
                icon: 'shield-off',
                onPress: () => {
                  const svc = connectionManager.getConnection(tab.networkId)?.ircService || ircService;
                  svc.sendRaw(`PRIVMSG ${chanserv} :DEOP ${tab.name}`);
                  useUIStore.getState().setShowTabOptionsModal(false);
                },
              },
              {
                text: t('VOICE (Give Voice)'),
                icon: 'microphone',
                onPress: () => {
                  const svc = connectionManager.getConnection(tab.networkId)?.ircService || ircService;
                  svc.sendRaw(`PRIVMSG ${chanserv} :VOICE ${tab.name}`);
                  useUIStore.getState().setShowTabOptionsModal(false);
                },
              },
              {
                text: t('DEVOICE (Remove Voice)'),
                icon: 'microphone-off',
                onPress: () => {
                  const svc = connectionManager.getConnection(tab.networkId)?.ircService || ircService;
                  svc.sendRaw(`PRIVMSG ${chanserv} :DEVOICE ${tab.name}`);
                  useUIStore.getState().setShowTabOptionsModal(false);
                },
              },
              {
                text: t('KICK (Remove User)'),
                icon: 'account-remove',
                onPress: () => {
                  Alert.prompt(
                    t('Kick User'),
                    t('Enter nickname to kick:'),
                    [
                      { text: t('Cancel'), style: 'cancel' },
                      {
                        text: t('Kick'),
                        onPress: (nick?: string) => {
                          if (nick?.trim()) {
                            const svc = connectionManager.getConnection(tab.networkId)?.ircService || ircService;
                            svc.sendRaw(`PRIVMSG ${chanserv} :KICK ${tab.name} ${nick.trim()}`);
                          }
                        },
                      },
                    ],
                    'plain-text'
                  );
                },
              },
              {
                text: t('BAN (Ban User)'),
                icon: 'cancel',
                onPress: () => {
                  Alert.prompt(
                    t('Ban User'),
                    t('Enter nickname or mask to ban:'),
                    [
                      { text: t('Cancel'), style: 'cancel' },
                      {
                        text: t('Ban'),
                        onPress: (mask?: string) => {
                          if (mask?.trim()) {
                            const svc = connectionManager.getConnection(tab.networkId)?.ircService || ircService;
                            svc.sendRaw(`PRIVMSG ${chanserv} :BAN ${tab.name} ${mask.trim()}`);
                          }
                        },
                      },
                    ],
                    'plain-text'
                  );
                },
              },
              {
                text: t('UNBAN (Remove Ban)'),
                icon: 'account-check',
                onPress: () => {
                  Alert.prompt(
                    t('Unban User'),
                    t('Enter nickname or mask to unban:'),
                    [
                      { text: t('Cancel'), style: 'cancel' },
                      {
                        text: t('Unban'),
                        onPress: (mask?: string) => {
                          if (mask?.trim()) {
                            const svc = connectionManager.getConnection(tab.networkId)?.ircService || ircService;
                            svc.sendRaw(`PRIVMSG ${chanserv} :UNBAN ${tab.name} ${mask.trim()}`);
                          }
                        },
                      },
                    ],
                    'plain-text'
                  );
                },
              },
              {
                text: t('TOPIC (Set Topic)'),
                icon: 'text',
                onPress: () => {
                  Alert.prompt(
                    t('Set Topic'),
                    t('Enter new topic:'),
                    [
                      { text: t('Cancel'), style: 'cancel' },
                      {
                        text: t('Set'),
                        onPress: (topic?: string) => {
                          if (topic !== undefined) {
                            const svc = connectionManager.getConnection(tab.networkId)?.ircService || ircService;
                            svc.sendRaw(`PRIVMSG ${chanserv} :TOPIC ${tab.name} ${topic}`);
                          }
                        },
                      },
                    ],
                    'plain-text'
                  );
                },
              },
              {
                text: t('INFO (Channel Info)'),
                icon: 'information',
                onPress: () => {
                  const svc = connectionManager.getConnection(tab.networkId)?.ircService || ircService;
                  svc.sendRaw(`PRIVMSG ${chanserv} :INFO ${tab.name}`);
                  useUIStore.getState().setShowTabOptionsModal(false);
                },
              },
              {
                text: t('AKICK (Auto-kick List)'),
                icon: 'format-list-bulleted',
                onPress: () => {
                  const svc = connectionManager.getConnection(tab.networkId)?.ircService || ircService;
                  svc.sendRaw(`PRIVMSG ${chanserv} :AKICK ${tab.name} LIST`);
                  useUIStore.getState().setShowTabOptionsModal(false);
                },
              },
              { text: t('Cancel'), style: 'cancel', onPress: () => {} },
            ];
            useUIStore.getState().setTabOptionsTitle(t('IRC Services: {channel}', { channel: tab.name }));
            useUIStore.getState().setTabOptions(serviceOptions);
            useUIStore.getState().setShowTabOptionsModal(true);
          },
        });
      }
    }

    // Option to add/remove from favorites
    // Normalize network ID to base network name to ensure favorites are stored per base network
    // "DBase (1)" -> "DBase", "DBase (2)" -> "DBase", "DBase" -> "DBase"
    const baseNetworkId = normalizeNetworkId(tab.networkId);
    const isFav = await channelFavoritesService.isFavorite(baseNetworkId, tab.name);
    if (isFav) {
      options.push({
        text: t('Remove from Favorites'),
        icon: 'star-off',
        onPress: async () => {
          await channelFavoritesService.removeFavorite(baseNetworkId, tab.name);
          useUIStore.getState().setShowTabOptionsModal(true);
        },
      });
    } else if (tab.type === 'channel') { // Only channels can be favorited
      options.push({
        text: t('Add to Favorites'),
        icon: 'star',
        onPress: async () => {
          await channelFavoritesService.addFavorite(baseNetworkId, tab.name);
          useUIStore.getState().setShowTabOptionsModal(true);
        },
      });
    }

    options.push({ text: t('Cancel'), style: 'cancel', onPress: () => useUIStore.getState().setShowTabOptionsModal(false) });

    useUIStore.getState().setTabOptionsTitle(tab.type === 'channel' ? t('Channel: {name}', { name: tab.name }) : t('Query: {name}', { name: tab.name }));
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

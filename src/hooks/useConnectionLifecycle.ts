import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { IRCMessage, ChannelUser } from '../services/IRCService';
import { connectionManager } from '../services/ConnectionManager';
import { ircService } from '../services/IRCService';
import { userManagementService } from '../services/UserManagementService';
import { settingsService } from '../services/SettingsService';
import { encryptedDMService } from '../services/EncryptedDMService';
import { channelEncryptionService } from '../services/ChannelEncryptionService';
import { offlineQueueService } from '../services/OfflineQueueService';
import { userActivityService } from '../services/UserActivityService';
import { scriptingService } from '../services/ScriptingService';
import { dccChatService } from '../services/DCCChatService';
import { dccFileService } from '../services/DCCFileService';
import { soundService } from '../services/SoundService';
import { SoundEventType } from '../types/sound';
import { useTabStore } from '../stores/tabStore';
import { tabService } from '../services/TabService';
import { messageHistoryService } from '../services/MessageHistoryService';
import { serverTabId, channelTabId, queryTabId, noticeTabId, makeServerTab, sortTabsGrouped } from '../utils/tabUtils';
import { useT } from '../i18n/transifex';
import type { ChannelTab } from '../types';

interface UseConnectionLifecycleParams {
  processBatchedMessages: () => void;
  safeSetState: (fn: () => void) => void;
  safeAlert: typeof Alert.alert;
  setIsConnected: (connected: boolean) => void;
  setActiveConnectionId: (id: string | null) => void;
  setNetworkName: (name: string) => void;
  setTabs: React.Dispatch<React.SetStateAction<any[]>>;
  setActiveTabId: (id: string) => void;
  setChannelUsers: React.Dispatch<React.SetStateAction<Map<string, ChannelUser[]>>>;
  setPing: (ping: number) => void;
  setTypingUser: (network: string, target: string, nick: string, data: { status: 'active' | 'paused' | 'done'; timestamp: number }) => void;
  setMotdSignal: React.Dispatch<React.SetStateAction<number>>;
  networkName: string;
  activeTabId: string | null;
  tabsRef: React.RefObject<any[]>;
  tabSortAlphabetical: boolean;
  isConnected: boolean;
  messageBatchTimeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  pendingMessagesRef: React.MutableRefObject<Array<{message: IRCMessage, context: any}>>;
  motdCompleteRef: React.MutableRefObject<Set<string>>;
  isMountedRef: React.MutableRefObject<boolean>;
}

/**
 * Hook that manages IRC connection lifecycle and event listeners
 * Handles message routing, connection state, encryption, typing indicators, etc.
 */
export const useConnectionLifecycle = (params: UseConnectionLifecycleParams) => {
  const {
    processBatchedMessages,
    safeSetState,
    safeAlert,
    setIsConnected,
    setActiveConnectionId,
    setNetworkName,
    setTabs,
    setActiveTabId,
    setChannelUsers,
    setPing,
    setTypingUser,
    setMotdSignal,
    networkName,
    activeTabId,
    tabsRef,
    tabSortAlphabetical,
    isConnected,
    messageBatchTimeoutRef,
    pendingMessagesRef,
    motdCompleteRef,
    isMountedRef,
  } = params;

  const t = useT();
  const latestRef = useRef({
    processBatchedMessages,
    safeSetState,
    safeAlert,
    setIsConnected,
    setActiveConnectionId,
    setNetworkName,
    setTabs,
    setActiveTabId,
    setChannelUsers,
    setPing,
    setTypingUser,
    setMotdSignal,
    networkName,
    activeTabId,
    tabsRef,
    tabSortAlphabetical,
    isConnected,
    messageBatchTimeoutRef,
    pendingMessagesRef,
    motdCompleteRef,
    t,
  });

  useEffect(() => {
    latestRef.current = {
      processBatchedMessages,
      safeSetState,
      safeAlert,
      setIsConnected,
      setActiveConnectionId,
      setNetworkName,
      setTabs,
      setActiveTabId,
      setChannelUsers,
      setPing,
      setTypingUser,
      setMotdSignal,
      networkName,
      activeTabId,
      tabsRef,
      tabSortAlphabetical,
      isConnected,
      messageBatchTimeoutRef,
      pendingMessagesRef,
      motdCompleteRef,
      t,
    };
  }, [
    processBatchedMessages,
    safeSetState,
    safeAlert,
    setIsConnected,
    setActiveConnectionId,
    setNetworkName,
    setTabs,
    setActiveTabId,
    setChannelUsers,
    setPing,
    setTypingUser,
    setMotdSignal,
    networkName,
    activeTabId,
    tabsRef,
    tabSortAlphabetical,
    isConnected,
    messageBatchTimeoutRef,
    pendingMessagesRef,
    motdCompleteRef,
    t,
  ]);

  // Re-run when isConnected changes OR when we need to check for new connections
  // We use a timestamp to force re-check when ConnectionManager creates a new connection
  const [connectionCheckTimestamp, setConnectionCheckTimestamp] = useState(Date.now());

  // Track connection changes - re-run when isConnected changes OR networkName changes
  // This ensures listeners are re-attached after auto-reconnect
  // Note: Removed 1-second polling interval that was causing render loop
  const prevNetworkRef = useRef(networkName);
  useEffect(() => {
    // Update timestamp when isConnected becomes true or network changes
    if (isConnected || networkName !== prevNetworkRef.current) {
      if (networkName !== prevNetworkRef.current) {
        console.log(`useConnectionLifecycle: Network changed from ${prevNetworkRef.current} to ${networkName}, re-setting up listeners`);
        prevNetworkRef.current = networkName;
      }
      setConnectionCheckTimestamp(Date.now());
    }
  }, [isConnected, networkName]);

  // Listen for connection-created events from ConnectionManager
  // This handles the case where auto-reconnect creates a new IRCService instance
  // and we need to re-attach all event listeners to the new instance
  useEffect(() => {
    console.log('useConnectionLifecycle: Setting up connection-created listener');
    const cleanup = connectionManager.onConnectionCreated((networkId: string) => {
      console.log(`useConnectionLifecycle: Received connection-created event for ${networkId}, forcing listener re-setup`);
      setConnectionCheckTimestamp(Date.now());
    });

    return () => {
      console.log('useConnectionLifecycle: Cleaning up connection-created listener');
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (__DEV__) {
      console.log('App: Setting up IRC listeners (isConnected:', isConnected, ')');
    }

    const connectionTargets = connectionManager.getAllConnections();
    if (__DEV__) {
      console.log('📡 ConnectionManager has', connectionTargets.length, 'connections');
    }

    const listenerTargets = connectionTargets.length > 0
      ? connectionTargets.map(ctx => ({
        id: ctx.networkId,
        ircService: ctx.ircService,
        userManagementService: ctx.userManagementService,
        managed: true,
      }))
      : [{
        id: ircService.getNetworkName(),
        ircService,
        userManagementService,
        managed: false,
      }];

    if (__DEV__) {
      console.log('📡 Setting up listeners for', listenerTargets.length, 'targets:', listenerTargets.map(t => t.id));
    }

    // Sync initial connection state in case connect events happened before listeners attached
    const anyConnected = listenerTargets.some(t => t.ircService.getConnectionStatus());
    latestRef.current.setIsConnected(anyConnected);
    const currentConnectionId = connectionManager.getActiveNetworkId();
    if (currentConnectionId) {
      latestRef.current.setNetworkName(currentConnectionId);
    }

    const unsubscribers: Array<() => void> = [];

    listenerTargets.forEach(target => {
      const activeIRCService = target.ircService;
      const activeUserMgmt = target.userManagementService;
      const targetNetworkId = target.id;

      // Listen for messages per connection
      const unsubscribeMessages = activeIRCService.onMessage(async (message: IRCMessage) => {
        const latest = latestRef.current;
        // Check if user is ignored (filter messages from ignored users)
        if (message.from && message.type === 'message') {
          const isIgnored = activeUserMgmt.isUserIgnored(
            message.from,
            undefined, // username not available in message
            undefined, // hostname not available in message
            message.network || activeIRCService.getNetworkName() || undefined
          );
          if (isIgnored) {
            return; // Skip ignored user messages
          }
        }

        const noticeTargetPref = await settingsService.getSetting('noticeTarget', 'server'); // 'active' | 'server' | 'private' | 'notice'
        const messageNetwork = message.network || activeIRCService.getNetworkName();
        const currentActiveTab = latest.tabsRef.current.find(t => t.id === latest.activeTabId);
        const isSameNetworkAsActive =
          !!(currentActiveTab && messageNetwork && currentActiveTab.networkId?.toLowerCase() === messageNetwork.toLowerCase());
        const currentNick = activeIRCService.getCurrentNick?.() || '';
        const normalizedChannel = (message.channel || '').trim();
        const isChannelTarget = (target: string) =>
          target.startsWith('#') || target.startsWith('&') || target.startsWith('+') || target.startsWith('!');
        const isServerNoticeTarget =
          normalizedChannel === '*' ||
          (!!currentNick && normalizedChannel.toLowerCase() === currentNick.toLowerCase());
        const isServerNoticeOrigin =
          !message.from ||
          (messageNetwork && message.from.toLowerCase() === messageNetwork.toLowerCase()) ||
          message.from.includes('.');
        const forceServerNotice = isServerNoticeTarget && isServerNoticeOrigin;
        scriptingService.handleMessage(message);

        if (message.typing && message.from) {
          const typingTarget =
            currentNick && normalizedChannel && normalizedChannel.toLowerCase() === currentNick.toLowerCase()
              ? message.from
              : normalizedChannel;
          if (typingTarget) {
            latest.safeSetState(() => {
              latest.setTypingUser(targetNetworkId, typingTarget, message.from!, {
                status: message.typing!,
                timestamp: Date.now(),
              });
            });
          }
        }

        // Handle DCC CHAT invites (CTCP)
        const dccInvite = dccChatService.parseDccChatInvite(message.text);
        if (dccInvite && message.from) {
          const session = dccChatService.handleIncomingInvite(message.from, messageNetwork, dccInvite.host, dccInvite.port);
          latest.safeAlert(
            latest.t('DCC Chat Request'),
            latest.t('{from} wants to start a DCC chat. Accept?').replace('{from}', message.from),
            [
              { text: latest.t('Decline'), style: 'cancel', onPress: () => dccChatService.closeSession(session.id) },
              { text: latest.t('Accept'), onPress: () => dccChatService.acceptInvite(session.id, activeIRCService) },
            ]
          );
        }
        // Handle DCC SEND offers
        const dccSend = dccFileService.parseSendOffer(message.text);
        if (dccSend && message.from) {
          const transfer = dccFileService.handleOffer(message.from, messageNetwork, dccSend);
          latest.safeAlert(
            latest.t('DCC SEND Offer'),
            latest.t('{from} offers "{filename}" ({size} bytes). Accept?')
              .replace('{from}', message.from)
              .replace('{filename}', dccSend.filename)
              .replace('{size}', (dccSend.size || '?').toString()),
            [
              { text: latest.t('Decline'), style: 'cancel', onPress: () => dccFileService.cancel(transfer.id) },
              {
                text: latest.t('Accept'),
                onPress: () => {
                  // The accept flow is handled elsewhere (user needs to choose download path)
                  // Just log that user accepted the offer
                  activeIRCService.addMessage({
                    type: 'notice',
                    text: `*** DCC SEND offer from ${message.from}: ${dccSend.filename} - Use DCC Transfers menu to accept`,
                    timestamp: Date.now(),
                  });
                },
              },
            ]
          );
        }

        const hasValidNetwork = !!(messageNetwork && messageNetwork !== 'Not connected');
        let targetTabId = hasValidNetwork ? serverTabId(messageNetwork) : latest.activeTabId || '';
        let targetTabType: ChannelTab['type'] = 'server';
        let newTabIsEncrypted = false;

        if (message.type === 'raw' || message.isRaw) {
          // Raw/system messages should stay on the server tab
          // EXCEPT: connection messages (disconnect, etc.) should follow notice routing if server tab doesn't exist
          // This prevents recreating a closed server tab when user manually closes it
          if (message.rawCategory === 'connection' && hasValidNetwork) {
            const serverTab = latest.tabsRef.current?.find((t: ChannelTab) => t.id === serverTabId(messageNetwork));
            if (!serverTab) {
              // Server tab doesn't exist (user closed it), follow notice routing instead
              if (!forceServerNotice && noticeTargetPref === 'active' && currentActiveTab && isSameNetworkAsActive) {
                targetTabId = currentActiveTab.id;
                targetTabType = currentActiveTab.type;
              } else if (!forceServerNotice && noticeTargetPref === 'notice') {
                targetTabId = noticeTabId(messageNetwork);
                targetTabType = 'channel';
              } else if (!forceServerNotice && noticeTargetPref === 'private' && currentActiveTab) {
                // For private routing, use the current active tab if it's a query, otherwise fallback to notice tab
                if (currentActiveTab.type === 'query') {
                  targetTabId = currentActiveTab.id;
                  targetTabType = 'query';
                } else {
                  targetTabId = noticeTabId(messageNetwork);
                  targetTabType = 'channel';
                }
              }
              // If noticeTargetPref is 'server' or no valid routing found, stay on default server tab (will be created)
            }
          }
        } else if (message.type === 'notice') {
          if (!forceServerNotice && noticeTargetPref === 'active' && currentActiveTab && isSameNetworkAsActive) {
            targetTabId = currentActiveTab.id;
            targetTabType = currentActiveTab.type;
          } else if (!forceServerNotice && noticeTargetPref === 'notice' && hasValidNetwork) {
            targetTabId = noticeTabId(messageNetwork);
            targetTabType = 'channel';
          } else if (!forceServerNotice && noticeTargetPref === 'private' && message.from && hasValidNetwork) {
            targetTabId = queryTabId(messageNetwork, message.from);
            targetTabType = 'query';
            newTabIsEncrypted = await encryptedDMService.isEncryptedForNetwork(messageNetwork, message.from);
          }
        } else if (message.type === 'nick' && !message.channel) {
          // Nick change messages without a channel should follow notice routing
          // This handles cases where the user changes nick but isn't in any channels
          // or when the nick change is a server-wide notice
          if (!forceServerNotice && noticeTargetPref === 'active' && currentActiveTab && isSameNetworkAsActive) {
            targetTabId = currentActiveTab.id;
            targetTabType = currentActiveTab.type;
          } else if (!forceServerNotice && noticeTargetPref === 'notice' && hasValidNetwork) {
            targetTabId = noticeTabId(messageNetwork);
            targetTabType = 'channel';
          } else if (!forceServerNotice && noticeTargetPref === 'private' && message.from && hasValidNetwork) {
            // For private routing, use the old nick (message.from) to find the query tab
            targetTabId = queryTabId(messageNetwork, message.from);
            targetTabType = 'query';
            newTabIsEncrypted = await encryptedDMService.isEncryptedForNetwork(messageNetwork, message.from);
          }
          // If noticeTargetPref is 'server', it will stay on server tab (default)
        } else if (message.channel && hasValidNetwork) {
          const isWildcardTarget = normalizedChannel === '*';
          const isSelfTarget =
            !!currentNick && normalizedChannel.toLowerCase() === currentNick.toLowerCase();
          const isServerOrigin = !!message.from && message.from.includes('.');
          if (isWildcardTarget || (isSelfTarget && isServerOrigin)) {
            // keep server tab for server-originated non-channel targets
          } else if (isChannelTarget(normalizedChannel)) {
            targetTabId = channelTabId(messageNetwork, message.channel);
            targetTabType = 'channel';
            newTabIsEncrypted = await channelEncryptionService.hasChannelKey(message.channel, messageNetwork);
          } else if (message.from) {
            // For private messages (query), use channel (recipient) for tab ID
            // This ensures both local echo (from=currentNick) and incoming messages (from=sagovornik)
            // are routed to the same tab identified by the other party's nick
            targetTabId = queryTabId(messageNetwork, message.channel);
            targetTabType = 'query';
            newTabIsEncrypted = await encryptedDMService.isEncryptedForNetwork(messageNetwork, message.channel);
          }
        } else if (message.from && hasValidNetwork) {
          // Fallback: if no channel specified, use message.from
          targetTabId = queryTabId(messageNetwork, message.from);
          targetTabType = 'query';
          newTabIsEncrypted = await encryptedDMService.isEncryptedForNetwork(messageNetwork, message.from);
        }

        // Play notification sounds for relevant events
        // Only for incoming messages, not local echo (from !== currentNick)
        const isLocalEcho = message.from?.toLowerCase() === currentNick.toLowerCase();
        if (!isLocalEcho && message.type === 'message' && message.text) {
          // Private message sound
          if (targetTabType === 'query' && message.from) {
            soundService.playSound(SoundEventType.PRIVATE_MESSAGE);
          }
          // Mention sound - check if current nick is mentioned in the message
          else if (targetTabType === 'channel' && currentNick) {
            const mentionPattern = new RegExp(`\\b${currentNick.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
            if (mentionPattern.test(message.text)) {
              soundService.playSound(SoundEventType.MENTION);
            }
          }
        }
        // Notice sound
        if (message.type === 'notice' && !isLocalEcho) {
          soundService.playSound(SoundEventType.NOTICE);
        }
        // CTCP sound (for DCC and other CTCP requests)
        if (message.type === 'ctcp' && !isLocalEcho) {
          soundService.playSound(SoundEventType.CTCP);
        }
        // Join sound
        if (message.type === 'join' && !isLocalEcho) {
          soundService.playSound(SoundEventType.JOIN);
        }
        // Kick sound - play if user was kicked (message.text contains kicked user)
        if (message.type === 'mode' && message.text?.includes('kicked')) {
          soundService.playSound(SoundEventType.KICK);
        }

        // Add message to pending batch
        latest.pendingMessagesRef.current.push({
          message,
          context: {
            targetTabId,
            targetTabType,
            messageNetwork,
            newTabIsEncrypted,
            hasValidNetwork,
          },
        });

        if (__DEV__) {
//           console.log('📨 Message queued for batch:', {
//             type: message.type,
//             text: message.text?.substring(0, 50),
//             queueLength: latest.pendingMessagesRef.current.length,
//             targetTab: targetTabId,
//           });
        }

        // Clear existing timeout and set new one
        if (latest.messageBatchTimeoutRef.current) {
          clearTimeout(latest.messageBatchTimeoutRef.current);
        }

        latest.messageBatchTimeoutRef.current = setTimeout(() => {
          if (__DEV__) {
            console.log('⏰ Batch timeout triggered, processing', latest.pendingMessagesRef.current.length, 'messages');
          }
          latest.safeSetState(() => {
            latest.processBatchedMessages();
          });
        }, 16);
      });

      // Listen for connection changes
      const unsubscribeConnection = activeIRCService.onConnectionChange((connected: boolean) => {
        const latest = latestRef.current;
        const connections = connectionManager.getAllConnections();
        const anyConn = connections.length > 0
          ? connections.some(c => c.ircService.getConnectionStatus())
          : connected;
        latest.safeSetState(() => latest.setIsConnected(anyConn));
        const currentConnectionId = connectionManager.getActiveNetworkId();
        latest.safeSetState(() => latest.setActiveConnectionId(currentConnectionId));
        if (connected) {
          offlineQueueService.processQueue();
          // Keep using the logical network id for UI/tab grouping
          if (currentConnectionId) {
            latest.safeSetState(() => latest.setNetworkName(currentConnectionId));
          }
          if (currentConnectionId) {
            const serverId = serverTabId(currentConnectionId);
            // Load tabs from storage if they don't exist (e.g., after reconnect)
            const existingTabs = latest.tabsRef.current.filter(t => t.networkId === currentConnectionId);
            if (existingTabs.length === 0) {
              // No tabs for this network, load from storage
              (async () => {
                try {
                  const loadedTabs = await tabService.getTabs(currentConnectionId);
                  const normalizedTabs = loadedTabs
                    .filter(tab => tab.networkId !== 'Not connected' && tab.name !== 'Not connected')
                    .map(tab => ({
                      ...tab,
                      networkId: tab.networkId || currentConnectionId,
                      id: tab.id.includes('::') ? tab.id : (tab.type === 'server' ? serverTabId(currentConnectionId) : tab.id),
                    }));
                  const withServerTab = normalizedTabs.some(t => t.type === 'server') 
                    ? normalizedTabs 
                    : [makeServerTab(currentConnectionId), ...normalizedTabs];
                  
                  // Load server tab history
                  const initialServerTabId = serverTabId(currentConnectionId);
                  let serverTabHistory: IRCMessage[] = [];
                  const serverTab = withServerTab.find(t => t.id === initialServerTabId);
                  if (serverTab) {
                    try {
                      serverTabHistory = await messageHistoryService.loadMessages(currentConnectionId, 'server');
                    } catch (err) {
                      console.error('Error loading server tab history on reconnect:', err);
                    }
                  }
                  
                  const tabsWithHistory = withServerTab.map(tab => {
                    if (tab.id === initialServerTabId) {
                      return { ...tab, messages: serverTabHistory };
                    }
                    return { ...tab, messages: [] };
                  });
                  
                  latest.safeSetState(() => {
                    latest.setTabs(prev => sortTabsGrouped([
                      ...prev.filter(t => t.networkId !== currentConnectionId),
                      ...tabsWithHistory,
                    ], latest.tabSortAlphabetical));
                    if (!latest.activeTabId || !latest.tabsRef.current.some(t => t.id === latest.activeTabId)) {
                      latest.setActiveTabId(initialServerTabId);
                    }
                  });
                } catch (error) {
                  console.error('Error loading tabs on reconnect:', error);
                  // Fallback: just add server tab
                  latest.safeSetState(() => {
                    latest.setTabs(prev => {
                      const exists = prev.some(t => t.id === serverId);
                      const updated = exists
                        ? prev
                        : sortTabsGrouped([...prev, makeServerTab(currentConnectionId)], latest.tabSortAlphabetical);
                      return updated;
                    });
                    if (!latest.activeTabId || !latest.tabsRef.current.some(t => t.id === latest.activeTabId)) {
                      latest.setActiveTabId(serverId);
                    }
                  });
                }
              })();
            } else {
              // Tabs already exist (reconnect after disconnect/kill)
              console.log(`useConnectionLifecycle: Reconnected to ${currentConnectionId}, tabs already exist`);
              latest.safeSetState(() => {
                latest.setTabs(prev => {
                  const exists = prev.some(t => t.id === serverId);
                  const updated = exists
                    ? prev
                    : sortTabsGrouped([...prev, makeServerTab(currentConnectionId)], latest.tabSortAlphabetical);
                  return updated;
                });
              });
              // Add reconnection message to server tab
              const reconnectMessage: IRCMessage = {
                type: 'system',
                text: latest.t('*** Reconnected to {network}').replace('{network}', currentConnectionId),
                timestamp: Date.now(),
                channel: 'server',
                network: currentConnectionId,
              };
              latest.pendingMessagesRef.current.push({
                message: reconnectMessage,
                context: { targetTab: serverId }
              });
              latest.processBatchedMessages();

              // Switch to server tab if current active tab is invalid
              if (!latest.activeTabId || !latest.tabsRef.current.some(t => t.id === latest.activeTabId)) {
                latest.safeSetState(() => latest.setActiveTabId(serverId));
              }
            }
          }
          // Background service will handle keeping connection alive
        } else {
          // Keep current network name when disconnected - don't switch to "Not connected" tab
          // Clear user lists on disconnect
          latest.safeSetState(() => latest.setChannelUsers(new Map()));
          if (currentConnectionId) {
            userActivityService.clearNetwork(currentConnectionId);
            scriptingService.handleDisconnect(currentConnectionId, 'Disconnected');
          }
          // Play disconnect sound
          soundService.playSound(SoundEventType.DISCONNECT);
        }
      });

      const unsubscribeRegistered = activeIRCService.on('registered', async () => {
        const netId = connectionManager.getActiveNetworkId() || activeIRCService.getNetworkName();
        if (!netId || netId === 'Not connected') return;

        // Play login sound
        soundService.playSound(SoundEventType.LOGIN);

        const netConfig = await settingsService.getNetwork(netId);
        if (!netConfig) return;
        // OPER (only if user provided oper password)
        if (netConfig.operPassword) {
          const operUser =
            netConfig.operUser?.trim() ||
            activeIRCService.getCurrentNick() ||
            netConfig.nick;
          activeIRCService.sendRaw(`OPER ${operUser} ${netConfig.operPassword}`);
        }
      });

      // Fallback NickServ IDENTIFY for singleton mode (ConnectionManager connections handle this internally)
      let unsubscribeMotd: (() => void) | undefined;
      if (!target.managed) {
        unsubscribeMotd = activeIRCService.on('motdEnd', async () => {
          const latest = latestRef.current;
          const netId = connectionManager.getActiveNetworkId() || activeIRCService.getNetworkName();
          if (!netId || netId === 'Not connected') return;
          const netConfig = await settingsService.getNetwork(netId);
          if (!netConfig) return;
          if (netConfig.nickservPassword) {
            activeIRCService.sendRaw(`PRIVMSG NickServ :IDENTIFY ${netConfig.nickservPassword}`);
          }
          latest.motdCompleteRef.current.add(netId);
          latest.setMotdSignal(signal => signal + 1);
        });
      }
      const unsubscribeMotdAny = activeIRCService.on('motdEnd', () => {
        const latest = latestRef.current;
        const netId = connectionManager.getActiveNetworkId() || activeIRCService.getNetworkName();
        if (netId && netId !== 'Not connected') {
          latest.motdCompleteRef.current.add(netId);
          latest.setMotdSignal(signal => signal + 1);
        }
      });

      // Listen for user list changes
      const unsubscribeUserList = activeIRCService.onUserListChange((channel: string, users: ChannelUser[]) => {
        const latest = latestRef.current;
        latest.safeSetState(() => {
          latest.setChannelUsers((prev) => {
            const newMap = new Map(prev);
            newMap.set(channel, users);
            return newMap;
          });
        });
      });

      // Listen for encryption key exchanges to update tab encryption status
      const unsubscribeEncryption = encryptedDMService.onBundleStored((nick: string) => {
        const latest = latestRef.current;
        latest.safeSetState(() => {
          latest.setTabs((prev) =>
            prev.map((tab) => {
              if (tab.type === 'query' && tab.name.toLowerCase() === nick.toLowerCase()) {
                return { ...tab, isEncrypted: true };
              }
              return tab;
            })
          );
        });
      });

      // Listen for incoming encryption key offers (require user acceptance)
      const unsubscribeKeyRequests = encryptedDMService.onKeyRequest((nick: string, _bundle, meta) => {
        const latest = latestRef.current;
        const newFingerprint = encryptedDMService.formatFingerprintForDisplay(meta.newFingerprint);
        const existingFingerprint = meta.existingFingerprint
          ? encryptedDMService.formatFingerprintForDisplay(meta.existingFingerprint)
          : 'None';
        const isChange = meta.reason === 'change' || meta.reason === 'legacy';
        const title = isChange ? 'Encryption Key Change' : 'Encryption Key Offer';
        const message = isChange
          ? `WARNING: ${nick} sent a different encryption key.\n\nOld: ${existingFingerprint}\nNew: ${newFingerprint}\n\nOnly replace if you verified the change out-of-band.`
          : `${nick} wants to enable encrypted messaging.\n\nFingerprint: ${newFingerprint}\n\nVerify out-of-band before trusting.`;
        latest.safeAlert(
          title,
          message,
          [
            {
              text: isChange ? 'Keep Existing' : 'Reject',
              style: 'cancel',
              onPress: async () => {
                const network = activeIRCService.getNetworkName();
                await encryptedDMService.rejectKeyOfferForNetwork(network, nick);
                activeIRCService.sendRaw(`PRIVMSG ${nick} :!enc-reject`);
              }
            },
            {
              text: isChange ? 'Replace Key' : 'Accept',
              onPress: async () => {
                try {
                  const network = activeIRCService.getNetworkName();
                  const ourBundle = await encryptedDMService.acceptKeyOfferForNetwork(network, nick, isChange);
                  activeIRCService.sendRaw(`PRIVMSG ${nick} :!enc-accept ${JSON.stringify(ourBundle)}`);
                  activeIRCService.addMessage({
                    type: 'notice',
                    text: `*** Encryption key ${isChange ? 'replaced' : 'accepted'} from ${nick}. Encrypted chat enabled.`,
                    timestamp: Date.now(),
                  });
                } catch (e: any) {
                  activeIRCService.addMessage({
                    type: 'error',
                    text: `*** Failed to accept key: ${e.message}`,
                    timestamp: Date.now(),
                  });
                }
              }
            },
          ]
        );
      });

      // Listen for channel encryption key changes to update tab encryption status
      const unsubscribeChannelKeys = channelEncryptionService.onChannelKeyChange(async (channel: string, network: string) => {
        const hasKey = await channelEncryptionService.hasChannelKey(channel, network);
        const noticeText = hasKey
          ? `🔒 Channel key stored for ${channel}`
          : `🔓 Channel key removed for ${channel}`;
        const ircSvc = connectionManager.getConnection(network)?.ircService || ircService;
        ircSvc.addMessage({
          type: 'notice',
          channel,
          text: noticeText,
          timestamp: Date.now(),
        });
        const latest = latestRef.current;
        latest.safeSetState(() => {
          latest.setTabs((prev) =>
            prev.map((tab) => {
              if (tab.type === 'channel' && tab.name.toLowerCase() === channel.toLowerCase() && tab.networkId === network) {
                return { ...tab, isEncrypted: hasKey, sendEncrypted: hasKey ? tab.sendEncrypted : false };
              }
              return tab;
            })
          );
        });
      });

      // Listen for typing indicators
      const unsubscribeTyping = activeIRCService.on('typing-indicator', (target: string, nick: string, status: 'active' | 'paused' | 'done') => {
        const latest = latestRef.current;
        const currentNick = activeIRCService.getCurrentNick?.() || '';
        const resolvedTarget =
          currentNick && target && target.toLowerCase() === currentNick.toLowerCase()
            ? nick
            : target;
        latest.safeSetState(() => {
          // Use message store to update typing status
          latest.setTypingUser(targetNetworkId, resolvedTarget, nick, { status, timestamp: Date.now() });
        });
      });

      // Simulate ping (in real implementation, measure actual ping)
      const pingInterval = setInterval(() => {
        const latest = latestRef.current;
        if (latest.isConnected) {
          latest.setPing(Math.random() * 100 + 50); // Simulated ping
        }
      }, 5000);

      unsubscribers.push(() => {
        unsubscribeMessages();
        unsubscribeConnection();
        unsubscribeUserList();
        unsubscribeEncryption();
        unsubscribeKeyRequests();
        unsubscribeChannelKeys();
        unsubscribeTyping();
        clearInterval(pingInterval);
        unsubscribeRegistered && unsubscribeRegistered();
        unsubscribeMotd && unsubscribeMotd();
        unsubscribeMotdAny && unsubscribeMotdAny();
      });
    });

    return () => {
      if (__DEV__) {
        console.log('App: Cleaning up IRC listeners');
      }
      unsubscribers.forEach(fn => fn());

      // Clean up message batch timeout
      if (latestRef.current.messageBatchTimeoutRef.current) {
        clearTimeout(latestRef.current.messageBatchTimeoutRef.current);
        latestRef.current.messageBatchTimeoutRef.current = null;
      }

      // Process any remaining batched messages
      if (latestRef.current.pendingMessagesRef.current.length > 0) {
        latestRef.current.processBatchedMessages();
      }
    };
  }, [isConnected, connectionCheckTimestamp]); // Re-setup listeners when connection state changes or new connections detected!
};

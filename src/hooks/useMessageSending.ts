import { useCallback } from 'react';
import { Alert } from 'react-native';
import { IRCMessage } from '../services/IRCService';
import { scriptingService } from '../services/ScriptingService';
import { dccChatService } from '../services/DCCChatService';
import { dccFileService } from '../services/DCCFileService';
import { offlineQueueService } from '../services/OfflineQueueService';
import { encryptedDMService } from '../services/EncryptedDMService';
import { channelEncryptionService } from '../services/ChannelEncryptionService';
import { messageHistoryService } from '../services/MessageHistoryService';
import { useTabStore } from '../stores/tabStore';

interface UseMessageSendingParams {
  isConnected: boolean;
  activeTabId: string | null;
  getActiveIRCService: () => any;
  getActiveCommandService: () => any;
  setTabs: React.Dispatch<React.SetStateAction<any[]>>;
  safeAlert: typeof Alert.alert;
  t: (key: string, options?: any) => string;
}

/**
 * Hook that handles all message sending logic
 * - Command processing and aliases
 * - Scripting integration
 * - Server/DCC/channel/query messages
 * - Offline queueing
 * - Encrypted DM and channel messages
 */
export const useMessageSending = (params: UseMessageSendingParams) => {
  const {
    isConnected,
    activeTabId,
    getActiveIRCService,
    getActiveCommandService,
    setTabs,
    safeAlert,
    t,
  } = params;

  const handleSendMessage = useCallback(async (message: string) => {
    const activeIRCService = getActiveIRCService();
    const activeCommandService = getActiveCommandService();
    // Use direct store access to avoid infinite loop
    const currentTabs = useTabStore.getState().tabs;
    const activeTab = currentTabs.find((tab) => tab.id === activeTabId) || currentTabs.find(t => t.type === 'server') || currentTabs[0];

    // Don't send messages if no valid tab exists
    if (!activeTab) {
      console.warn('⚠️ Cannot send message: no valid tab available');
      return;
    }
    const isChannelTarget =
      activeTab.name.startsWith('#') ||
      activeTab.name.startsWith('&') ||
      activeTab.name.startsWith('+') ||
      activeTab.name.startsWith('!');
    const isPrivateTarget = activeTab.type === 'query' || (!isChannelTarget && activeTab.type !== 'server' && activeTab.type !== 'dcc');

    // Process command through command service (handles /quote, aliases, custom commands)
    const processedCommand = await activeCommandService.processCommand(message, activeTab.name);

    // If activeCommandService.processCommand returns null, it means it handled the command internally (e.g., /quote)
    // and no further processing is needed for this message.
    // If it returns a string, it means that string should be sent to the IRC service.
    // If it returns the original message (because it's not a command), it means it's a regular message to be sent.
    if (processedCommand === null && message.startsWith('/')) {
      return; // Command was handled internally (e.g., /quote, or some custom command that returns null)
    }

    // Use processed command or original message if it's not a command
    let commandToSend = (processedCommand !== null && processedCommand.startsWith('/')) ? processedCommand : message;

    // Run scripting on outgoing commands (aliases / automation)
    const scripted = scriptingService.processOutgoingCommand(commandToSend, { channel: activeTab.name, networkId: activeTab.networkId });
    if (scripted === null) {
      return; // Script cancelled send
    }
    commandToSend = scripted;

    const reportCommandError = (text: string) => {
      activeIRCService?.addMessage({ type: 'error', text, timestamp: Date.now() });
    };

    const normalizedCommand = commandToSend.trim();
    if (normalizedCommand.startsWith('/')) {
      const parts = normalizedCommand.split(/\s+/);
      const baseCommand = parts[0].toLowerCase();

      if (baseCommand === '/ctcp') {
        const isQueryTarget = activeTab.type === 'query' ? activeTab.name : null;
        if (parts.length < 3 && !isQueryTarget) {
          reportCommandError(t('Usage: /ctcp <nick> <command> [args]'));
          return;
        }
        const ctcpTarget = parts.length >= 3 ? parts[1] : isQueryTarget!;
        const ctcpCommand = parts.length >= 3 ? parts[2] : parts[1];
        const ctcpArgs = parts.slice(parts.length >= 3 ? 3 : 2).join(' ');
        if (!isConnected) {
          safeAlert(
            t('Not Connected', { _tags: 'screen:app,file:App.tsx,feature:connect' }),
            t('Please connect to a server first', { _tags: 'screen:app,file:App.tsx,feature:connect' })
          );
          return;
        }
        activeIRCService.sendCTCPRequest(ctcpTarget, ctcpCommand.toUpperCase(), ctcpArgs || undefined);
        return;
      }

      if (baseCommand === '/xdcc') {
        const isQueryTarget = activeTab.type === 'query' ? activeTab.name : null;
        if (parts.length < 3 && !isQueryTarget) {
          reportCommandError(t('Usage: /xdcc <bot> <command> [args]'));
          return;
        }
        const xdccTarget = parts.length >= 3 ? parts[1] : isQueryTarget!;
        const xdccCommand = parts.length >= 3 ? parts[2] : parts[1];
        const xdccArgs = parts.slice(parts.length >= 3 ? 3 : 2).join(' ');
        if (!isConnected) {
          safeAlert(
            t('Not Connected', { _tags: 'screen:app,file:App.tsx,feature:connect' }),
            t('Please connect to a server first', { _tags: 'screen:app,file:App.tsx,feature:connect' })
          );
          return;
        }
        const payload = `XDCC ${xdccCommand.toUpperCase()}${xdccArgs ? ` ${xdccArgs}` : ''}`;
        activeIRCService.sendRaw(`PRIVMSG ${xdccTarget} :${payload}`);
        return;
      }

      if (baseCommand === '/dcc') {
        if (!isConnected) {
          safeAlert(
            t('Not Connected', { _tags: 'screen:app,file:App.tsx,feature:connect' }),
            t('Please connect to a server first', { _tags: 'screen:app,file:App.tsx,feature:connect' })
          );
          return;
        }
        if (parts.length < 2) {
          reportCommandError(t('Usage: /dcc <chat|send> <nick> [path] [port]'));
          return;
        }
        const subcommand = parts[1].toLowerCase();
        if (subcommand === 'chat') {
          if (parts.length < 3) {
            reportCommandError(t('Usage: /dcc <chat|send> <nick> [path] [port]'));
            return;
          }
          const peerNick = parts[2];
          const networkId = activeTab.networkId || activeIRCService.getNetworkName();
          await dccChatService.initiateChat(activeIRCService, peerNick, networkId);
          return;
        }
        if (subcommand === 'send') {
          const raw = normalizedCommand.replace(/^\/dcc\s+send\s+/i, '');
          const firstSpace = raw.indexOf(' ');
          if (firstSpace === -1) {
            reportCommandError(t('Usage: /dcc <chat|send> <nick> [path] [port]'));
            return;
          }
          const peerNick = raw.slice(0, firstSpace).trim();
          let pathAndPort = raw.slice(firstSpace + 1).trim();
          if (!peerNick || !pathAndPort) {
            reportCommandError(t('Usage: /dcc <chat|send> <nick> [path] [port]'));
            return;
          }
          let port: number | undefined;
          let filePath = pathAndPort;
          if (pathAndPort.startsWith('"')) {
            const closingIndex = pathAndPort.lastIndexOf('"');
            if (closingIndex > 0) {
              filePath = pathAndPort.slice(1, closingIndex);
              const remainder = pathAndPort.slice(closingIndex + 1).trim();
              if (remainder) {
                const maybePort = parseInt(remainder, 10);
                if (!Number.isNaN(maybePort)) {
                  port = maybePort;
                }
              }
            }
          } else {
            const portMatch = pathAndPort.match(/\s+(\d{1,5})$/);
            if (portMatch) {
              port = parseInt(portMatch[1], 10);
              pathAndPort = pathAndPort.slice(0, portMatch.index).trim();
            }
            filePath = pathAndPort;
          }
          if (!filePath) {
            reportCommandError(t('Usage: /dcc <chat|send> <nick> [path] [port]'));
            return;
          }
          const networkId = activeTab.networkId || activeIRCService.getNetworkName();
          try {
            await dccFileService.sendFile(activeIRCService, peerNick, networkId, filePath, port);
            activeIRCService.addMessage({
              type: 'notice',
              text: t('DCC SEND offer initiated to {nick}', { nick: peerNick }),
              timestamp: Date.now(),
            });
          } catch (error: any) {
            activeIRCService.addMessage({
              type: 'error',
              text: `${t('DCC Send Error')}: ${error?.message || error}`,
              timestamp: Date.now(),
            });
          }
          return;
        }
        reportCommandError(t('Usage: /dcc <chat|send> <nick> [path] [port]'));
        return;
      }
    }

    if (activeTab.type === 'server') {
      // For server tab, still require connection
      if (!isConnected) {
        safeAlert(
          t('Not Connected', { _tags: 'screen:app,file:App.tsx,feature:connect' }),
          t('Please connect to a server first', { _tags: 'screen:app,file:App.tsx,feature:connect' })
        );
        return;
      }
      if (commandToSend.startsWith('/')) {
        activeIRCService.sendMessage(activeTab.name, commandToSend);
      } else {
        activeIRCService.sendCommand(commandToSend);
      }
      return;
    }

    if (activeTab.type === 'dcc') {
      if (activeTab.dccSessionId) {
        dccChatService.sendMessage(activeTab.dccSessionId, commandToSend);
        const dccMessage: IRCMessage = {
          id: `dcc-${Date.now()}`,
          type: 'message',
          from: 'You',
          text: commandToSend,
          timestamp: Date.now(),
          channel: activeTab.name,
          network: activeTab.networkId,
        };
        setTabs(prev =>
          prev.map(t =>
            t.id === activeTab.id
              ? {
                  ...t,
                  messages: [...t.messages, dccMessage],
                }
              : t
          )
        );
        // Save DCC message to history
        if (activeTab.networkId && activeTab.networkId !== 'Not connected') {
          messageHistoryService.saveMessage(dccMessage, activeTab.networkId).catch(err => {
            console.error('Error saving DCC message to history:', err);
          });
        }
      }
      return;
    }

    // Channel or query messages: queue if offline
    if (!isConnected) {
      offlineQueueService.addMessage(activeTab.networkId, activeTab.name, commandToSend);
      const pendingMessage: IRCMessage = {
        id: `pending-${Date.now()}-${Math.random()}`,
        type: 'message',
        channel: activeTab.name,
        from: 'You',
        text: commandToSend,
        timestamp: Date.now(),
        status: 'pending',
        network: activeTab.networkId,
      };
      setTabs(prev =>
        prev.map(tab =>
          tab.id === activeTab.id
            ? { ...tab, messages: [...tab.messages, pendingMessage] }
            : tab
        )
      );
      // Save pending message to history
      if (activeTab.networkId && activeTab.networkId !== 'Not connected') {
        messageHistoryService.saveMessage(pendingMessage, activeTab.networkId).catch(err => {
          console.error('Error saving pending message to history:', err);
        });
      }
      return;
    }

    const wantEncrypted = !!(activeTab.sendEncrypted && activeTab.isEncrypted);

    // Connected: send normally, but try encrypted path for private targets when toggle is on
    if (isPrivateTarget && wantEncrypted && !commandToSend.startsWith('/')) {
      const network = activeTab.networkId || activeIRCService.getNetworkName();
      const hasBundle = activeTab.isEncrypted || await encryptedDMService.isEncryptedForNetwork(network, activeTab.name);
      if (!hasBundle) {
        const errorMsg: IRCMessage = {
          id: `err-${Date.now()}-${Math.random()}`,
          type: 'error',
          channel: activeTab.name,
          text: `*** No DM key with ${activeTab.name}. Use /sharekey or /requestkey first.`,
          timestamp: Date.now(),
          network: activeTab.networkId,
        };
        setTabs(prev =>
          prev.map(tab =>
            tab.id === activeTab.id
              ? { ...tab, isEncrypted: false, messages: [...tab.messages, errorMsg] }
              : tab
          )
        );
        // Save error message to history
        if (activeTab.networkId && activeTab.networkId !== 'Not connected') {
          messageHistoryService.saveMessage(errorMsg, activeTab.networkId).catch(err => {
            console.error('Error saving error message to history:', err);
          });
        }
        return;
      }
      try {
        const network = activeTab.networkId || activeIRCService.getNetworkName();
        const payload = await encryptedDMService.encryptForNetwork(commandToSend, network, activeTab.name);
        activeIRCService.sendRaw(`PRIVMSG ${activeTab.name} :!enc-msg ${JSON.stringify(payload)}`);
        const sentMessage: IRCMessage = {
          id: `msg-${Date.now()}-${Math.random()}`,
          type: 'message',
          channel: activeTab.name,
          from: 'You',
          text: `🔒 ${commandToSend}`,
          timestamp: Date.now(),
          status: 'sent',
          network: activeTab.networkId,
        };
        setTabs(prev =>
          prev.map(tab =>
            tab.id === activeTab.id
              ? { ...tab, messages: [...tab.messages, sentMessage] }
              : tab
          )
        );
        // Save encrypted DM to history
        if (activeTab.networkId && activeTab.networkId !== 'Not connected') {
          messageHistoryService.saveMessage(sentMessage, activeTab.networkId).catch(err => {
            console.error('Error saving encrypted DM to history:', err);
          });
        }
        return;
      } catch (e) {
        const errorMsg: IRCMessage = {
          id: `err-${Date.now()}-${Math.random()}`,
          type: 'error',
          channel: activeTab.name,
          text: `Encrypted send failed (${(e as Error)?.message || 'missing key?'}). Use "Request Encryption Key" from the user menu.`,
          timestamp: Date.now(),
          network: activeTab.networkId,
        };
        setTabs(prev =>
          prev.map(tab =>
            tab.id === activeTab.id
              ? { ...tab, messages: [...tab.messages, errorMsg] }
              : tab
          )
        );
        // Save error message to history
        if (activeTab.networkId && activeTab.networkId !== 'Not connected') {
          messageHistoryService.saveMessage(errorMsg, activeTab.networkId).catch(err => {
            console.error('Error saving error message to history:', err);
          });
        }
        return; // do not fall back to plaintext
      }
    }

    // Try encrypted channel messages if toggle is on and channel has a key
    const isChannel = activeTab.name.startsWith('#') || activeTab.name.startsWith('&');
    if (isChannel && wantEncrypted && !commandToSend.startsWith('/')) {
      const hasKey = await channelEncryptionService.hasChannelKey(activeTab.name, activeTab.networkId);
      if (hasKey) {
        try {
          const payload = await channelEncryptionService.encryptMessage(commandToSend, activeTab.name, activeTab.networkId);
          activeIRCService.sendRaw(`PRIVMSG ${activeTab.name} :!chanenc-msg ${JSON.stringify(payload)}`);
          const sentMessage: IRCMessage = {
            id: `msg-${Date.now()}-${Math.random()}`,
            type: 'message',
            channel: activeTab.name,
            from: 'You',
            text: `🔒 ${commandToSend}`,
            timestamp: Date.now(),
            status: 'sent',
            network: activeTab.networkId,
          };
          setTabs(prev =>
            prev.map(tab =>
              tab.id === activeTab.id
                ? { ...tab, messages: [...tab.messages, sentMessage] }
                : tab
            )
          );
          // Save encrypted channel message to history
          if (activeTab.networkId && activeTab.networkId !== 'Not connected') {
            messageHistoryService.saveMessage(sentMessage, activeTab.networkId).catch(err => {
              console.error('Error saving encrypted channel message to history:', err);
            });
          }
          return;
        } catch (e) {
          const errorMsg: IRCMessage = {
            id: `err-${Date.now()}-${Math.random()}`,
            type: 'error',
            channel: activeTab.name,
            text: `*** Channel encryption failed: ${(e as Error)?.message || e}`,
            timestamp: Date.now(),
            network: activeTab.networkId,
          };
          setTabs(prev =>
            prev.map(tab =>
              tab.id === activeTab.id
                ? { ...tab, messages: [...tab.messages, errorMsg] }
                : tab
            )
          );
          // Save error message to history
          if (activeTab.networkId && activeTab.networkId !== 'Not connected') {
            messageHistoryService.saveMessage(errorMsg, activeTab.networkId).catch(err => {
              console.error('Error saving error message to history:', err);
            });
          }
          return;
        }
      } else {
        const errorMsg: IRCMessage = {
          id: `err-${Date.now()}-${Math.random()}`,
          type: 'error',
          channel: activeTab.name,
          text: `*** No channel key stored for ${activeTab.name}. Use /chankey generate/share first.`,
          timestamp: Date.now(),
          network: activeTab.networkId,
        };
        setTabs(prev =>
          prev.map(tab =>
            tab.id === activeTab.id
              ? { ...tab, messages: [...tab.messages, errorMsg] }
              : tab
          )
        );
        // Save error message to history
        if (activeTab.networkId && activeTab.networkId !== 'Not connected') {
          messageHistoryService.saveMessage(errorMsg, activeTab.networkId).catch(err => {
            console.error('Error saving error message to history:', err);
          });
        }
        return;
      }
    }

    activeIRCService.sendMessage(activeTab.name, commandToSend);
  }, [isConnected, activeTabId, getActiveIRCService, getActiveCommandService, setTabs, safeAlert, t]);

  return { handleSendMessage };
};

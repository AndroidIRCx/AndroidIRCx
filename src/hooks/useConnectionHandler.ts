import { useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { IRCNetworkConfig, IRCServerConfig, DEFAULT_SERVER, settingsService } from '../services/SettingsService';
import { IRCConnectionConfig, IRCMessage } from '../services/IRCService';
import { identityProfilesService, IdentityProfile } from '../services/IdentityProfilesService';
import { connectionManager } from '../services/ConnectionManager';
import { scriptingService } from '../services/ScriptingService';
import { tabService } from '../services/TabService';
import { messageHistoryService } from '../services/MessageHistoryService';
import { autoReconnectService } from '../services/AutoReconnectService';
import { logger } from '../services/Logger';
import { errorReportingService } from '../services/ErrorReportingService';
import { useUIStore } from '../stores/uiStore';
import { serverTabId, makeServerTab, sortTabsGrouped } from '../utils/tabUtils';

interface UseConnectionHandlerParams {
  setSelectedNetworkName: (name: string) => void;
  setActiveConnectionId: (id: string | null) => void;
  setNetworkName: (name: string) => void;
  setPrimaryNetworkId: (id: string | null) => void;
  setIsConnected: (connected: boolean) => void;
  setTabs: React.Dispatch<React.SetStateAction<any[]>>;
  setActiveTabId: (id: string) => void;
  appendServerMessage: (networkId: string, text: string) => void;
  safeAlert: typeof Alert.alert;
  t: (key: string, options?: any) => string;
  tabsRef: React.RefObject<any[]>;
  primaryNetworkId: string | null;
  autoConnectFavoriteServerRef: React.MutableRefObject<boolean>;
}

/**
 * Hook that handles IRC server connection
 * - Network and server selection
 * - Identity profile application
 * - Connection configuration
 * - Tab loading and merging
 * - Auto-reconnect state saving
 * - Error handling with retry
 */
export const useConnectionHandler = (params: UseConnectionHandlerParams) => {
  const {
    setSelectedNetworkName,
    setActiveConnectionId,
    setNetworkName,
    setPrimaryNetworkId,
    setIsConnected,
    setTabs,
    setActiveTabId,
    appendServerMessage,
    safeAlert,
    t,
    tabsRef,
    primaryNetworkId,
    autoConnectFavoriteServerRef,
  } = params;

  const handleConnect = useCallback(async (network?: IRCNetworkConfig, serverId?: string, connectNetworkId?: string) => {
    let networkToUse = network;
    let serverToUse: IRCServerConfig | undefined;
    let identityProfile: IdentityProfile | undefined;

    // If no network provided, try to load default or show networks list
    if (!networkToUse) {
      const networks = await settingsService.loadNetworks();
      if (networks.length === 0) {
        // Create default network
        networkToUse = await settingsService.createDefaultNetwork();
        // Reload to get the created network
        const updatedNetworks = await settingsService.loadNetworks();
        networkToUse = updatedNetworks[0];
      } else {
        // Check if user configured a quick connect network
        const quickConnectNetworkId = await settingsService.getSetting<string | null>('quickConnectNetworkId', null);
        if (quickConnectNetworkId) {
          networkToUse = networks.find(n => n.id === quickConnectNetworkId);
        }
        
        // Fallback: prefer "DBase" network as default, then first network with servers
        if (!networkToUse) {
          networkToUse = networks.find(n => n.name === 'DBase' && n.servers && n.servers.length > 0) ||
            networks.find(n => n.name === 'DBase') ||
            networks.find(n => n.servers && n.servers.length > 0) ||
            networks[0];
        }
      }
    }

    // Update selected network name
    if (networkToUse) {
      setSelectedNetworkName(networkToUse.name);
    }

    // Pull the identity profile (default to AndroidIRCX) and apply to the network
    if (networkToUse?.identityProfileId) {
      const profiles = await identityProfilesService.list();
      identityProfile = profiles.find(p => p.id === networkToUse!.identityProfileId);
    }
    if (!identityProfile) {
      identityProfile = await identityProfilesService.getDefaultProfile();
    }
    if (identityProfile && networkToUse) {
      networkToUse = {
        ...networkToUse,
        identityProfileId: identityProfile.id,
        nick: identityProfile.nick || networkToUse.nick || 'AndroidIRCX',
        altNick: identityProfile.altNick || networkToUse.altNick || 'AndroidIRCX_',
        realname: identityProfile.realname || networkToUse.realname || 'AndroidIRCX User',
        ident: identityProfile.ident || networkToUse.ident || 'androidircx',
        sasl: identityProfile.saslAccount
          ? { account: identityProfile.saslAccount, password: identityProfile.saslPassword || '' }
          : networkToUse.sasl,
        nickservPassword: identityProfile.nickservPassword || networkToUse.nickservPassword,
        operUser: identityProfile.operUser || networkToUse.operUser,
        operPassword: identityProfile.operPassword || networkToUse.operPassword,
      };
    }

    // Find server to use
    if (!networkToUse) {
      safeAlert(
        t('No Network', { _tags: 'screen:app,file:App.tsx,feature:network' }),
        t('No network available. Please configure a network first.', { _tags: 'screen:app,file:App.tsx,feature:network' }),
        [
          { text: t('Cancel', { _tags: 'screen:app,file:App.tsx,feature:network' }), style: 'cancel' },
          {
            text: t('Configure', { _tags: 'screen:app,file:App.tsx,feature:network' }),
            onPress: () => {
              useUIStore.getState().setShowNetworksList(true);
            }
          },
        ]
      );
      return;
    }

    if (!networkToUse.servers || networkToUse.servers.length === 0) {
      const networkName = networkToUse.name || 'DBase';
      safeAlert(
        t('No Server Configured', { _tags: 'screen:app,file:App.tsx,feature:network' }),
        t(
          'No server configured for "{networkName}". Would you like to configure one?',
          { networkName, _tags: 'screen:app,file:App.tsx,feature:network' }
        ),
        [
          { text: t('Cancel', { _tags: 'screen:app,file:App.tsx,feature:network' }), style: 'cancel' },
          {
            text: t('Configure', { _tags: 'screen:app,file:App.tsx,feature:network' }),
            onPress: () => {
              useUIStore.getState().setShowNetworksList(true);
            }
          },
        ]
      );
      return;
    }

    if (serverId) {
      serverToUse = networkToUse.servers.find(s => s.id === serverId);
    }
    if (!serverToUse && autoConnectFavoriteServerRef.current) {
      serverToUse = networkToUse.servers.find(s => s.favorite);
    }
    if (!serverToUse && networkToUse.defaultServerId) {
      serverToUse = networkToUse.servers.find(s => s.id === networkToUse.defaultServerId);
    }
    if (!serverToUse) {
      serverToUse = networkToUse.servers[0];
    }

    if (!serverToUse) {
      serverToUse = { ...DEFAULT_SERVER };
    }

    if (!serverToUse) {
      const networkName = networkToUse?.name || 'DBase';
      safeAlert(
        t('Error', { _tags: 'screen:app,file:App.tsx,feature:network' }),
        t('No server configured for "{networkName}"', {
          networkName,
          _tags: 'screen:app,file:App.tsx,feature:network',
        })
      );
      useUIStore.getState().setShowNetworksList(true);
      return;
    }

    // Show immediate feedback that connection is in progress
    if (networkToUse?.name && serverToUse?.hostname) {
      appendServerMessage(networkToUse.name, `Connecting to ${serverToUse.hostname}:${serverToUse.port || ''}...`);
    }

    // Choose the target network id we want to reuse (prefer existing server tab id)
    let desiredId = connectNetworkId || networkToUse?.name || 'default';
    const existingServerTab = tabsRef.current.find(
      t => t.type === 'server' && (t.networkId === desiredId || t.networkId === networkToUse?.name)
    );
    if (existingServerTab) {
      desiredId = existingServerTab.networkId;
    }

    const globalProxy = await settingsService.getSetting('globalProxy', { enabled: false } as any);
    const proxyToUse = networkToUse.proxy || globalProxy || null;

    const config: IRCConnectionConfig = {
      host: (serverToUse.hostname || '').trim(),
      port: serverToUse.port,
      nick: networkToUse.nick,
      altNick: networkToUse.altNick,
      username: networkToUse.ident || networkToUse.nick,
      realname: networkToUse.realname,
      password: serverToUse.password,
      tls: serverToUse.ssl,
      rejectUnauthorized: serverToUse.rejectUnauthorized,
      proxy: proxyToUse,
      sasl: networkToUse.sasl,
    };

    try {
      const safeConfig = {
        ...config,
        password: config.password ? '[redacted]' : undefined,
        sasl: config.sasl
          ? { ...config.sasl, password: config.sasl.password ? '[redacted]' : '' }
          : undefined,
        proxy: config.proxy
          ? { ...config.proxy, password: config.proxy.password ? '[redacted]' : undefined }
          : config.proxy,
        clientKey: config.clientKey ? '[redacted]' : undefined,
      };
      console.log('App: Attempting to connect to IRC server using ConnectionManager...', safeConfig);
      // Use ConnectionManager for multi-server support
      const finalId = await connectionManager.connect(desiredId, networkToUse, config);
      console.log('App: Connection successful');
      scriptingService.handleConnect(finalId);
      setActiveConnectionId(finalId);
      setNetworkName(finalId);
      if (!primaryNetworkId) {
        setPrimaryNetworkId(finalId);
      }
      setIsConnected(true);
      // Load tabs for this network and merge
      const loadedTabs = await tabService.getTabs(finalId);
      const normalizedTabs = loadedTabs.map(tab => ({
        ...tab,
        networkId: tab.networkId || finalId,
        id: tab.id.includes('::') ? tab.id : (tab.type === 'server' ? serverTabId(finalId) : tab.id),
      }));
      const withServerTab = normalizedTabs.some(t => t.type === 'server') ? normalizedTabs : [makeServerTab(finalId), ...normalizedTabs];
      const initialServerTabId = serverTabId(finalId);
      
      // Load history for server tab BEFORE creating tabs
      // This ensures history is loaded before new messages arrive, preventing history from being cleared
      let serverTabHistory: IRCMessage[] = [];
      const serverTab = withServerTab.find(t => t.id === initialServerTabId);
      if (serverTab) {
        try {
          serverTabHistory = await messageHistoryService.loadMessages(finalId, 'server');
        } catch (err) {
          console.error('Error loading server tab history on connect:', err);
          // Continue without history if loading fails
        }
      }
      
      // Progressive loading: Set tabs with server tab history loaded, others without history
      // Message history for other tabs will be lazy-loaded when tabs are switched to
      const tabsWithHistory = withServerTab.map(tab => {
        if (tab.id === initialServerTabId) {
          // Server tab gets loaded history
          return { ...tab, messages: serverTabHistory };
        }
        // Other tabs start with empty messages - will be loaded on demand
        return { ...tab, messages: [] };
      });
      
      setTabs(prev => sortTabsGrouped([
        ...prev.filter(t => t.networkId !== finalId),
        ...tabsWithHistory,
      ], false));
      setActiveTabId(initialServerTabId);

      // Save connection state and enable auto-reconnect for this network
      if (networkToUse.name) {
        const channels: string[] = [];
        // Get channels from tabs
        tabsRef.current.forEach(tab => {
          if (tab.type === 'channel' && tab.name.startsWith('#')) {
            channels.push(tab.name);
          }
        });
        // Add auto-join channels
        if (networkToUse.autoJoinChannels) {
          networkToUse.autoJoinChannels.forEach(ch => {
            if (!channels.includes(ch)) {
              channels.push(ch);
            }
          });
        }
        await autoReconnectService.saveConnectionState(finalId, config, channels, networkToUse);

        // Enable auto-reconnect for this network if not already configured
        // This ensures all connections have auto-reconnect enabled by default
        const existingConfig = autoReconnectService.getConfig(finalId);
        if (!existingConfig) {
          await autoReconnectService.setConfig(finalId, {
            enabled: true,
            maxAttempts: 10,
            initialDelay: 1000,
            maxDelay: 60000,
            backoffMultiplier: 2,
            rejoinChannels: true,
            smartReconnect: true,
            minReconnectInterval: 5000,
          });
        }
      }

    } catch (error: any) {
      logger.error('connect', `Connection failed: ${error?.message || String(error)}`);
      errorReportingService.report(error, { source: 'connect', fatal: false, extras: { host: serverToUse?.hostname, port: serverToUse?.port } });
      const hostInfo = serverToUse ? `${serverToUse.hostname}:${serverToUse.port}` : 'server';
      const message = error?.message || 'Failed to connect to IRC server';
      const buttons = [
        {
          text: 'Retry',
          onPress: () => handleConnect(networkToUse, serverToUse?.id),
        },
        {
          text: 'Open Networks',
          onPress: () => useUIStore.getState().setShowNetworksList(true),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ];
      safeAlert(
        t('Connection failed', { _tags: 'screen:app,file:App.tsx,feature:connect' }),
        t(
          '{message}\n\nTried: {hostInfo}\nCheck host/port, SSL, and network reachability.',
          {
            message,
            hostInfo,
            _tags: 'screen:app,file:App.tsx,feature:connect',
          }
        ),
        buttons as any
      );
      if (networkToUse?.name) {
        appendServerMessage(networkToUse.name, `Connection failed: ${message}`);
      }
    }
  }, [
    setSelectedNetworkName,
    setActiveConnectionId,
    setNetworkName,
    setPrimaryNetworkId,
    setIsConnected,
    setTabs,
    setActiveTabId,
    appendServerMessage,
    safeAlert,
    t,
    tabsRef,
    primaryNetworkId,
    autoConnectFavoriteServerRef,
  ]);

  return { handleConnect };
};

/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useEffect, useRef, useCallback } from 'react';
import { Alert, Linking } from 'react-native';
import { parseIRCUrl, findMatchingNetwork, createTempNetworkFromUrl, getUrlDisplayName } from '../utils/ircUrlParser';
import { connectionManager } from '../services/ConnectionManager';
import { identityProfilesService } from '../services/IdentityProfilesService';
import { IRCNetworkConfig, settingsService } from '../services/SettingsService';
import { logger } from '../services/Logger';
import type { ChannelTab } from '../types';

interface UseDeepLinkHandlerParams {
  handleConnect: (network?: IRCNetworkConfig, serverId?: string, connectNetworkId?: string) => Promise<void>;
  handleJoinChannel: (channel?: string, key?: string) => void;
  isAppLocked: boolean;
  isFirstRunComplete: boolean;
  activeConnectionId: string | null;
  tabs: ChannelTab[];
  safeAlert: typeof Alert.alert;
  t: (key: string, options?: any) => string;
}

/**
 * Hook for handling IRC deep links (irc:// and ircs:// URLs)
 *
 * Supports format: irc[s]://[nick[:password]@]server[:port][/channel[,needkey]]
 *
 * Features:
 * - Listens for deep links when app launches or is already running
 * - Parses IRC URLs and extracts connection parameters
 * - Matches against saved networks or creates temporary configs
 * - Smart connection reuse: if already connected, just joins channel
 * - Queues URLs if app is locked or first run not complete
 * - Shows security warnings if password is in URL
 * - Handles all error cases with user-friendly alerts
 */
export const useDeepLinkHandler = (params: UseDeepLinkHandlerParams) => {
  const {
    handleConnect,
    handleJoinChannel,
    isAppLocked,
    isFirstRunComplete,
    activeConnectionId,
    tabs,
    safeAlert,
    t,
  } = params;

  // Queue for URLs received while app is locked or during first run
  const pendingUrlRef = useRef<string | null>(null);
  const isProcessingRef = useRef(false);
  const lastProcessedUrlRef = useRef<string | null>(null);
  // Track setTimeout IDs for cleanup to prevent memory leaks
  const timeoutIdsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const lastProcessedTimeRef = useRef<number>(0);

  /**
   * Process a deep link URL
   */
  const processDeepLink = useCallback(async (url: string) => {
    if (!url) return;

    logger.info('deeplink', `Processing IRC URL: ${url}`);

    // Parse the URL
    const parsed = parseIRCUrl(url);

    if (!parsed.isValid) {
      safeAlert(
        t('Invalid IRC URL'),
        t('The IRC URL format is invalid: {error}\n\nExpected: irc://server/channel', {
          error: parsed.error || 'Unknown error',
        }),
        [{ text: t('OK'), style: 'cancel' }]
      );
      logger.error('deeplink', `Invalid IRC URL: ${parsed.error}`);
      return;
    }

    const displayName = getUrlDisplayName(parsed);
    logger.info('deeplink', `Parsed URL: ${displayName}`);

    // Security warning if password is in URL
    if (parsed.password) {
      safeAlert(
        t('Security Warning'),
        t('This URL contains a password which is visible in plain text. This is insecure.\n\nServer: {server}\n\nContinue anyway?', {
          server: displayName,
        }),
        [
          { text: t('Cancel'), style: 'cancel' },
          {
            text: t('Continue'),
            onPress: () => {
              // Continue processing after warning
              processDeepLinkAfterWarning(parsed);
            },
          },
        ]
      );
      return;
    }

    // Process without warning
    await processDeepLinkAfterWarning(parsed);
  }, [handleConnect, handleJoinChannel, activeConnectionId, tabs, safeAlert, t]);

  /**
   * Process deep link after security warnings (if any)
   */
  const processDeepLinkAfterWarning = useCallback(async (parsed: ReturnType<typeof parseIRCUrl>) => {
    if (!parsed.isValid) return;

    try {
      // Check if we're already connected to this server
      // We check by matching the actual server hostname:port, not just networkId
      const allConnections = connectionManager.getAllConnections();
      let existingConnection: { networkId: string; ircService: any } | null = null;

      // First, try to match by networkId (for cases where networkId is the server hostname)
      for (const context of allConnections) {
        const normalizedNetworkId = context.networkId.toLowerCase().replace(/\s*\(\d+\)$/, ''); // Remove (2), (3) suffixes
        if (normalizedNetworkId === parsed.server.toLowerCase()) {
          const isConnected = context.ircService.getConnectionStatus();
          if (isConnected) {
            existingConnection = { networkId: context.networkId, ircService: context.ircService };
            break;
          }
        }
      }

      // If not found, check by matching against saved networks' servers
      // This handles cases where networkId is a network name (like "DBase") but we're connecting to irc.dbase.in.rs
      if (!existingConnection) {
        const networks = await settingsService.loadNetworks();
        const parsedServerLower = parsed.server.toLowerCase();
        
        for (const context of allConnections) {
          const isConnected = context.ircService.getConnectionStatus();
          if (!isConnected) continue;

          // Find the network config for this connection
          const network = networks.find(n => n.name === context.networkId || n.id === context.networkId);
          if (network && network.servers) {
            // Check if any server in this network matches the parsed URL
            for (const srv of network.servers) {
              if (srv.hostname.toLowerCase() === parsedServerLower && srv.port === parsed.port) {
                existingConnection = { networkId: context.networkId, ircService: context.ircService };
                break;
              }
            }
          }
          if (existingConnection) break;
        }
      }

      // If already connected and channel specified, just join the channel
      if (existingConnection && parsed.channel) {
        logger.info('deeplink', `Already connected to ${parsed.server}, joining channel ${parsed.channel}`);

        // Switch to this connection's server tab first
        const serverTab = tabs.find(t => t.type === 'server' && t.networkId === existingConnection!.networkId);
        if (serverTab) {
          // Tab will be switched when channel is joined
        }

        // Join the channel
        handleJoinChannel(parsed.channel, parsed.channelKey);
        return;
      }

      // If already connected but no channel, just switch to server tab
      if (existingConnection && !parsed.channel) {
        logger.info('deeplink', `Already connected to ${parsed.server}`);
        const serverTab = tabs.find(t => t.type === 'server' && t.networkId === existingConnection!.networkId);
        if (serverTab) {
          // Could switch to server tab here if needed
          safeAlert(
            t('Already Connected'),
            t('Already connected to {server}', { server: parsed.server }),
            [{ text: t('OK') }]
          );
        }
        return;
      }

      // Not connected yet - try to match a saved network or create temporary
      const matchedNetwork = await findMatchingNetwork(parsed);

      let networkToUse: IRCNetworkConfig;
      let shouldShowTempWarning = false;

      if (matchedNetwork) {
        logger.info('deeplink', `Found matching network: ${matchedNetwork.name}`);

        // Use matched network, but override with URL parameters if provided
        networkToUse = {
          ...matchedNetwork,
          // Override identity fields if provided in URL query params
          nick: parsed.nick || matchedNetwork.nick,
          altNick: parsed.altNick || matchedNetwork.altNick,
          realname: parsed.realname || matchedNetwork.realname,
          ident: parsed.ident || matchedNetwork.ident,
          // Add channel to auto-join if specified
          autoJoinChannels: parsed.channel
            ? [...(matchedNetwork.autoJoinChannels || []), parsed.channel]
            : matchedNetwork.autoJoinChannels,
        };
      } else {
        // No matching network - create temporary config
        logger.info('deeplink', `No matching network, creating temporary config for ${parsed.server}`);

        const profiles = await identityProfilesService.list();
        networkToUse = createTempNetworkFromUrl(parsed, profiles[0]);
        shouldShowTempWarning = true;
      }

      // Find the matching server from the network
      const serverToUse = networkToUse.servers.find(
        s => s.hostname.toLowerCase() === parsed.server.toLowerCase() && s.port === parsed.port
      ) || networkToUse.servers[0];

      // Double-check if we're already connected to this server:port before connecting
      // This prevents race conditions where a connection was established between the initial check and now
      const allConnectionsNow = connectionManager.getAllConnections();
      const networksForCheck = await settingsService.loadNetworks();
      for (const context of allConnectionsNow) {
        const isConnected = context.ircService.getConnectionStatus();
        if (!isConnected) continue;

        // Check if this connection matches the server we're trying to connect to
        const network = networksForCheck.find(n => n.name === context.networkId || n.id === context.networkId);
        if (network && network.servers) {
          for (const srv of network.servers) {
            if (srv.hostname.toLowerCase() === parsed.server.toLowerCase() && srv.port === parsed.port) {
              logger.info('deeplink', `Already connected to ${parsed.server}:${parsed.port}, joining channel if specified`);
              if (parsed.channel) {
                handleJoinChannel(parsed.channel, parsed.channelKey);
              }
              return; // Already connected, don't create duplicate
            }
          }
        }
      }

      // Show confirmation for temporary networks
      if (shouldShowTempWarning) {
        safeAlert(
          t('Connect to IRC Server'),
          t('Connecting to {server}:{port}\n\nThis will create a temporary connection.{channel}\n\nContinue?', {
            server: parsed.server,
            port: parsed.port.toString(),
            channel: parsed.channel ? `\nChannel: ${parsed.channel}` : '',
          }),
          [
            { text: t('Cancel'), style: 'cancel' },
            {
              text: t('Connect'),
              onPress: async () => {
                try {
                  await handleConnect(networkToUse, serverToUse?.id);

                  // If channel specified, it will auto-join via autoJoinChannels
                  if (parsed.channel && parsed.channelKey) {
                    // If channel has a key, we need to join it manually after connection
                    // The auto-join might not include the key
                    const timeoutId = setTimeout(() => {
                      timeoutIdsRef.current.delete(timeoutId);
                      handleJoinChannel(parsed.channel!, parsed.channelKey);
                    }, 2000); // Wait 2s for connection to complete
                    timeoutIdsRef.current.add(timeoutId);
                  }
                } catch (error: any) {
                  logger.error('deeplink', `Connection failed: ${error?.message || String(error)}`);
                }
              },
            },
          ]
        );
      } else {
        // Saved network - connect immediately
        try {
          await handleConnect(networkToUse, serverToUse?.id);

          // If channel specified with key, join manually
          if (parsed.channel && parsed.channelKey) {
            const timeoutId = setTimeout(() => {
              timeoutIdsRef.current.delete(timeoutId);
              handleJoinChannel(parsed.channel!, parsed.channelKey);
            }, 2000);
            timeoutIdsRef.current.add(timeoutId);
          }
        } catch (error: any) {
          logger.error('deeplink', `Connection failed: ${error?.message || String(error)}`);
        }
      }

    } catch (error: any) {
      logger.error('deeplink', `Error processing deep link: ${error?.message || String(error)}`);
      safeAlert(
        t('Error'),
        t('Failed to process IRC URL: {error}', {
          error: error?.message || 'Unknown error',
        }),
        [{ text: t('OK'), style: 'cancel' }]
      );
    }
  }, [handleConnect, handleJoinChannel, tabs, safeAlert, t]);

  /**
   * Handle incoming URL with queueing for locked/first-run states
   */
  const handleUrl = useCallback(async (url: string | null) => {
    if (!url) return;

    // Prevent processing the same URL multiple times in quick succession (within 2 seconds)
    const now = Date.now();
    if (url === lastProcessedUrlRef.current && (now - lastProcessedTimeRef.current) < 2000) {
      logger.info('deeplink', `Ignoring duplicate URL received within 2 seconds: ${url}`);
      return;
    }

    // Queue if app is locked or first run not complete
    if (isAppLocked || !isFirstRunComplete) {
      logger.info('deeplink', 'App locked or first run not complete, queuing URL');
      pendingUrlRef.current = url;
      return;
    }

    // Prevent concurrent processing
    if (isProcessingRef.current) {
      logger.info('deeplink', 'Already processing a URL, queuing');
      pendingUrlRef.current = url;
      return;
    }

    isProcessingRef.current = true;
    lastProcessedUrlRef.current = url;
    lastProcessedTimeRef.current = now;
    try {
      await processDeepLink(url);
    } finally {
      isProcessingRef.current = false;
    }
  }, [isAppLocked, isFirstRunComplete, processDeepLink]);

  /**
   * Process queued URL when app becomes ready
   */
  useEffect(() => {
    if (!isAppLocked && isFirstRunComplete && pendingUrlRef.current && !isProcessingRef.current) {
      const url = pendingUrlRef.current;
      pendingUrlRef.current = null;

      logger.info('deeplink', 'Processing queued URL');
      handleUrl(url);
    }
  }, [isAppLocked, isFirstRunComplete, handleUrl]);

  /**
   * Listen for deep links
   */
  useEffect(() => {
    // Get initial URL (when app is launched via deep link)
    Linking.getInitialURL()
      .then((url) => {
        if (url) {
          logger.info('deeplink', `App launched with URL: ${url}`);
          handleUrl(url);
        }
      })
      .catch((error) => {
        logger.error('deeplink', `Error getting initial URL: ${error?.message || String(error)}`);
      });

    // Listen for URLs when app is already running
    const subscription = Linking.addEventListener('url', (event) => {
      logger.info('deeplink', `Received URL: ${event.url}`);
      handleUrl(event.url);
    });

    return () => {
      subscription.remove();
      // Clean up any pending timeouts to prevent memory leaks
      timeoutIdsRef.current.forEach(timeoutId => {
        clearTimeout(timeoutId);
      });
      timeoutIdsRef.current.clear();
    };
  }, [handleUrl]);
};

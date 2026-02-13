/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IRCNetworkConfig, settingsService } from '../services/SettingsService';
import { identityProfilesService, IdentityProfile } from '../services/IdentityProfilesService';

/**
 * Parsed IRC URL structure
 * Supports format: irc[s]://[nick[:password]@]server[:port][/channel[,needkey]][?nick=X&altNick=Y&realname=Z&ident=W]
 */
export interface ParsedIRCUrl {
  protocol: 'irc' | 'ircs';
  nick?: string;
  altNick?: string;
  realname?: string;
  ident?: string;
  password?: string;
  server: string;
  port: number;
  channel?: string;
  channelKey?: string;
  ssl: boolean;
  isValid: boolean;
  error?: string;
}

/**
 * Quick check if a string is an IRC URL
 */
export function isIRCUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim().toLowerCase();
  return trimmed.startsWith('irc://') || trimmed.startsWith('ircs://');
}

/**
 * Parse an IRC URL into its components
 *
 * Supported formats:
 * - irc://irc.example.com/channel
 * - ircs://irc.example.com:6697/channel
 * - irc://nick@irc.example.com/channel
 * - irc://nick:password@irc.example.com:6667/channel,key
 * - irc://[::1]:6667/channel (IPv6)
 * - ircs://irc.example.com:6697/channel?nick=MyNick&altNick=MyAltNick&realname=MyName&ident=myident
 *
 * Query parameters:
 * - ?nick=X - Override nickname (takes precedence over nick@ in URL)
 * - ?altNick=X or ?alt_nick=X - Set alternate nickname
 * - ?realname=X or ?real_name=X - Set real name
 * - ?ident=X - Set ident/username
 *
 * @param url The IRC URL to parse
 * @returns ParsedIRCUrl object with isValid flag
 */
export function parseIRCUrl(url: string): ParsedIRCUrl {
  // Default invalid result
  const invalidResult = (error: string): ParsedIRCUrl => ({
    protocol: 'irc',
    server: '',
    port: 6667,
    ssl: false,
    isValid: false,
    error,
  });

  if (!url || typeof url !== 'string') {
    return invalidResult('URL is empty or invalid');
  }

  const trimmed = url.trim();

  // Check protocol
  const ircMatch = trimmed.match(/^(irc|ircs):\/\//i);
  if (!ircMatch) {
    return invalidResult('Invalid IRC URL format. Expected: irc:// or ircs://');
  }

  const protocol = ircMatch[1].toLowerCase() as 'irc' | 'ircs';
  const ssl = protocol === 'ircs';
  const defaultPort = ssl ? 6697 : 6667;

  // Remove protocol
  let remaining = trimmed.substring(ircMatch[0].length);

  // Extract query parameters (everything after ?)
  let queryParams: Record<string, string> = {};
  const queryIndex = remaining.indexOf('?');
  if (queryIndex !== -1) {
    const queryString = remaining.substring(queryIndex + 1);
    remaining = remaining.substring(0, queryIndex);

    // Parse query string
    const params = new URLSearchParams(queryString);
    params.forEach((value, key) => {
      queryParams[key.toLowerCase()] = decodeURIComponent(value);
    });
  }

  // Extract channel and key (everything after first /)
  let channel: string | undefined;
  let channelKey: string | undefined;
  const slashIndex = remaining.indexOf('/');
  if (slashIndex !== -1) {
    const channelPart = remaining.substring(slashIndex + 1);
    remaining = remaining.substring(0, slashIndex);

    if (channelPart) {
      // Split channel and key (format: channel,key)
      const parts = channelPart.split(',');
      channel = decodeURIComponent(parts[0].trim());

      // Ensure channel starts with # if it doesn't already
      if (channel && !channel.startsWith('#')) {
        channel = '#' + channel;
      }

      if (parts.length > 1) {
        channelKey = decodeURIComponent(parts[1].trim());
      }
    }
  }

  // Extract auth (nick[:password]@) if present
  let nick: string | undefined;
  let password: string | undefined;
  const atIndex = remaining.lastIndexOf('@');
  if (atIndex !== -1) {
    const authPart = remaining.substring(0, atIndex);
    remaining = remaining.substring(atIndex + 1);

    const colonIndex = authPart.indexOf(':');
    if (colonIndex !== -1) {
      nick = decodeURIComponent(authPart.substring(0, colonIndex).trim());
      password = decodeURIComponent(authPart.substring(colonIndex + 1).trim());
    } else {
      nick = decodeURIComponent(authPart.trim());
    }
  }

  // Extract server and port
  let server: string;
  let port = defaultPort;

  // Handle IPv6 addresses: [::1] or [2001:db8::1]
  if (remaining.startsWith('[')) {
    const closeBracket = remaining.indexOf(']');
    if (closeBracket === -1) {
      return invalidResult('Invalid IPv6 address format. Missing closing bracket.');
    }

    server = remaining.substring(1, closeBracket);
    remaining = remaining.substring(closeBracket + 1);

    // Check for port after IPv6 address
    if (remaining.startsWith(':')) {
      const portStr = remaining.substring(1);
      const portNum = parseInt(portStr, 10);
      if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
        return invalidResult(`Invalid port: ${portStr}. Must be 1-65535.`);
      }
      port = portNum;
    }
  } else {
    // Regular hostname or IPv4
    const colonIndex = remaining.lastIndexOf(':');
    if (colonIndex !== -1) {
      server = remaining.substring(0, colonIndex).trim();
      const portStr = remaining.substring(colonIndex + 1).trim();
      const portNum = parseInt(portStr, 10);
      if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
        return invalidResult(`Invalid port: ${portStr}. Must be 1-65535.`);
      }
      port = portNum;
    } else {
      server = remaining.trim();
    }
  }

  // Validate server
  if (!server) {
    return invalidResult('Server hostname is missing');
  }

  // Extract query parameters (nick, altNick, realname, ident)
  // Query params override URL auth nick if both are present
  const queryNick = queryParams['nick'];
  const queryAltNick = queryParams['altnick'] || queryParams['alt_nick'];
  const queryRealname = queryParams['realname'] || queryParams['real_name'];
  const queryIdent = queryParams['ident'];

  // Success!
  return {
    protocol,
    nick: queryNick || nick, // Query param takes precedence
    altNick: queryAltNick,
    realname: queryRealname,
    ident: queryIdent,
    password,
    server,
    port,
    channel,
    channelKey,
    ssl,
    isValid: true,
  };
}

/**
 * Find a matching network configuration from saved networks
 *
 * Matching priority:
 * 1. Exact match (hostname + port)
 * 2. Hostname match (ignore port)
 * 3. Network name match
 *
 * @param parsedUrl Parsed IRC URL
 * @returns Matching network config or null
 */
export async function findMatchingNetwork(
  parsedUrl: ParsedIRCUrl
): Promise<IRCNetworkConfig | null> {
  if (!parsedUrl.isValid) {
    return null;
  }

  const networks = await settingsService.loadNetworks();
  if (networks.length === 0) {
    return null;
  }

  const { server, port } = parsedUrl;
  const serverLower = server.toLowerCase();

  // Priority 1: Exact match (hostname + port)
  for (const network of networks) {
    if (!network.servers || network.servers.length === 0) continue;

    for (const srv of network.servers) {
      if (srv.hostname.toLowerCase() === serverLower && srv.port === port) {
        return network;
      }
    }
  }

  // Priority 2: Hostname match (ignore port)
  for (const network of networks) {
    if (!network.servers || network.servers.length === 0) continue;

    for (const srv of network.servers) {
      if (srv.hostname.toLowerCase() === serverLower) {
        return network;
      }
    }
  }

  // Priority 3: Network name match
  for (const network of networks) {
    if (network.name.toLowerCase() === serverLower) {
      return network;
    }
  }

  return null;
}

/**
 * Create a temporary network configuration from parsed IRC URL
 *
 * @param parsedUrl Parsed IRC URL
 * @param defaultProfile Default identity profile to use
 * @returns Temporary network configuration
 */
export function createTempNetworkFromUrl(
  parsedUrl: ParsedIRCUrl,
  defaultProfile?: IdentityProfile
): IRCNetworkConfig {
  const timestamp = Date.now();
  const networkId = `temp_${timestamp}_${parsedUrl.server}`;

  // Build network config
  // Query params and URL auth take precedence over default profile
  const network: IRCNetworkConfig = {
    id: networkId,
    name: parsedUrl.server,
    nick: parsedUrl.nick || defaultProfile?.nick || 'AndroidIRCX',
    altNick: parsedUrl.altNick || defaultProfile?.altNick || 'AndroidIRCX_',
    realname: parsedUrl.realname || defaultProfile?.realname || 'AndroidIRCX User',
    ident: parsedUrl.ident || defaultProfile?.ident || 'androidircx',
    servers: [
      {
        id: `${networkId}_server`,
        hostname: parsedUrl.server,
        port: parsedUrl.port,
        ssl: parsedUrl.ssl,
        rejectUnauthorized: true,
        password: parsedUrl.password, // Server password if provided in URL
        name: `${parsedUrl.server}:${parsedUrl.port}`,
      },
    ],
    autoJoinChannels: parsedUrl.channel ? [parsedUrl.channel] : [],
    identityProfileId: defaultProfile?.id,
  };

  return network;
}

/**
 * Get a display name for a parsed IRC URL (for user-facing messages)
 */
export function getUrlDisplayName(parsedUrl: ParsedIRCUrl): string {
  if (!parsedUrl.isValid) return 'invalid URL';

  const parts: string[] = [];
  parts.push(parsedUrl.server);

  if (parsedUrl.port !== (parsedUrl.ssl ? 6697 : 6667)) {
    parts.push(`:${parsedUrl.port}`);
  }

  if (parsedUrl.channel) {
    parts.push(` / ${parsedUrl.channel}`);
  }

  return parts.join('');
}

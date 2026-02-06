/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import TcpSocket, { TLSSocket } from 'react-native-tcp-socket';
import { encryptedDMService } from './EncryptedDMService';
import { channelEncryptionService } from './ChannelEncryptionService';
import { DEFAULT_PART_MESSAGE, DEFAULT_QUIT_MESSAGE, ProxyConfig } from './SettingsService';
import { ircForegroundService } from './IRCForegroundService';
import { userManagementService, BlacklistEntry } from './UserManagementService';
import { protectionService } from './ProtectionService';
import { useTabStore } from '../stores/tabStore';
import { tx } from '../i18n/transifex';
import { APP_VERSION } from '../config/appVersion';
import { decodeIfBase64Like } from '../utils/Base64Utils';
import { IRCNumericHandlers } from './irc/IRCNumericHandlers';
import { IRCCommandHandlers } from './irc/IRCCommandHandlers';
import { CAPHandlers } from './irc/cap/CAPHandlers';

// Re-export ChannelTab from types for backward compatibility
export { ChannelTab } from '../types';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

// All other service imports are removed to break circular dependencies.
// The functionality will be restored by using an event-based approach.

export interface IRCConnectionConfig {
  host: string;
  port: number;
  nick: string;
  altNick?: string;
  username?: string;
  realname?: string;
  password?: string;
  tls?: boolean;
  rejectUnauthorized?: boolean;
  clientCert?: string;
  clientKey?: string;
  proxy?: ProxyConfig | null;
  sasl?: {
    account: string;
    password: string;
    force?: boolean;  // Force SASL even if server doesn't advertise capability
  };
}

export type RawMessageCategory =
  | 'connection'
  | 'trafficIn'
  | 'trafficOut'
  | 'server'
  | 'auth'
  | 'channel'
  | 'user'
  | 'debug';

export const RAW_MESSAGE_CATEGORIES: { id: RawMessageCategory; title: string; description: string }[] = [
  {
    id: 'connection',
    title: t('Connection'),
    description: t('Connect/disconnect, proxy, and registration flow messages.'),
  },
  {
    id: 'trafficIn',
    title: t('Incoming traffic'),
    description: t('Raw lines received from the server.'),
  },
  {
    id: 'trafficOut',
    title: t('Outgoing traffic'),
    description: t('Raw lines sent to the server.'),
  },
  {
    id: 'server',
    title: t('Server notices'),
    description: t('MOTD, account/away, and other server-emitted events.'),
  },
  {
    id: 'channel',
    title: t('Channel notices'),
    description: t('Channel modes, lists, topics, and per-channel system notices.'),
  },
  {
    id: 'user',
    title: t('User notices'),
    description: t('User account status, oper, and presence state changes.'),
  },
  {
    id: 'auth',
    title: t('Auth & identity'),
    description: t('SASL/authentication and nickname negotiation events.'),
  },
  {
    id: 'debug',
    title: t('Debug'),
    description: t('Verbose internal logging and diagnostics.'),
  },
];

export const getDefaultRawCategoryVisibility = (): Record<RawMessageCategory, boolean> =>
  ({
    connection: true,
    server: true,
    channel: false, // Hide channel-level raw by default; enable via settings if desired
    user: true,
    auth: true,
    debug: true,
    trafficIn: false, // Hide full incoming traffic by default to avoid channel message duplication
    trafficOut: false, // Hide outgoing traffic by default
  });

export interface IRCMessage {
  id: string;
  type: 'message' | 'notice' | 'raw' | 'join' | 'part' | 'quit' | 'kick' | 'nick' | 'mode' | 'topic' | 'error' | 'invite' | 'monitor' | 'ctcp' | 'system';
  channel?: string;
  from?: string;
  oldNick?: string;
  newNick?: string;
  text: string;
  timestamp: number;
  isRaw?: boolean;
  rawCategory?: RawMessageCategory;
  status?: 'pending' | 'sent';
  network?: string;
  isGrouped?: boolean;
  account?: string; // IRCv3.2 account-tag: account name of message sender
  msgid?: string; // IRCv3.3 message-ids: unique message identifier for replies/reactions
  channelContext?: string; // draft/channel-context: which channel this PM relates to
  replyTo?: string; // draft/reply: msgid of message being replied to
  reactions?: string; // draft/react: reactions to message (format: msgid;emoji)
  typing?: 'active' | 'paused' | 'done'; // +typing: typing indicator status
  username?: string;
  hostname?: string;
  target?: string;
  mode?: string;
  topic?: string;
  reason?: string;
  numeric?: string;
  command?: string;
  isScrollback?: boolean; // Message loaded from local scrollback history
  isPlayback?: boolean; // Message from bouncer playback buffer
  batchTag?: string; // IRCv3.2 batch tag - indicates message is part of a batch
  whoisData?: {
    // Structured WHOIS data for clickable rendering
    nick?: string;
    channels?: string[];
  };
}

export interface ChannelUser {
  nick: string;
  modes: string[]; // Channel-specific modes: o (op), v (voice), h (halfop), a (admin), q (owner)
  account?: string; // Account name if available
  host?: string; // Hostname if available (from userhost-in-names)
}

interface ChannelTopicInfo {
  topic?: string;
  setBy?: string;
  setAt?: number;
  modes?: string;
}

export class IRCService {
  private socket: any = null;
  private config: IRCConnectionConfig | null = null;
  private isConnected: boolean = false;
  private networkId: string = '';
  private messageListeners: ((message: IRCMessage) => void)[] = [];
  private connectionListeners: ((connected: boolean) => void)[] = [];
  private eventListeners: Map<string, Function[]> = new Map();
  private buffer: string = '';
  private registered: boolean = false;
  private currentNick: string = '';
  private altNick: string = '';
  private selfUserModes: Set<string> = new Set();
  private nickChangeAttempts: number = 0;
  private verboseLogging: boolean = false;
  private isLoggingRaw: boolean = false;
  private numericHandlers: IRCNumericHandlers | null = null;
  private commandHandlers: IRCCommandHandlers | null = null;
  private capHandlers: CAPHandlers | null = null;
  
  // CAP negotiation state
  private capNegotiating: boolean = false;
  private capEnabled: boolean = false;
  private capAvailable: Set<string> = new Set();
  private capRequested: Set<string> = new Set();
  private capEnabledSet: Set<string> = new Set();
  private capLSReceived: boolean = false;
  private capLSVersion: number = 300; // Default to 302 (multi-line) support
  private monitoredNicks: Set<string> = new Set();
  private manualDisconnect: boolean = false;

  // UserManagementService instance (set by ConnectionManager, fallback to global singleton)
  private _userManagementService: typeof userManagementService | null = null;

  // Auto-reconnect with exponential backoff
  private autoReconnectEnabled: boolean = true;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private readonly MAX_RECONNECT_DELAY = 300000; // 5 minutes max
  private readonly INITIAL_RECONNECT_DELAY = 2000; // Start with 2 seconds

  // IRCv3 features
  private serverTime: boolean = false;
  private accountNotify: boolean = false;
  private extendedJoin: boolean = false;
  private userhostInNames: boolean = false;
  private awayNotify: boolean = false;
  private chghost: boolean = false;
  private messageTags: boolean = false;

  // Batch tracking (IRCv3.2)
  private activeBatches: Map<string, {
    type: string;
    params: string[];
    messages: IRCMessage[];
    startTime: number;
  }> = new Map();

  // Clone detection state
  private cloneDetectionActive: boolean = false;
  private cloneDetectionQueue: string[] = [];
  private cloneDetectionResults: Map<string, string[]> = new Map(); // host -> nicks[]
  private cloneDetectionCallback: ((results: Map<string, string[]>) => void) | null = null;
  private cloneDetectionBatchSize: number = 100; // Process 100 users at a time
  private cloneDetectionDelay: number = 100; // ms between batches

  // Labeled-response tracking (IRCv3.2)
  private pendingLabels: Map<string, {
    command: string;
    timestamp: number;
    callback?: (response: any) => void;
  }> = new Map();
  private labelCounter: number = 0;
  private readonly LABEL_TIMEOUT = 30000; // 30 seconds

  // Message deduplication tracking (IRCv3.3 message-ids)
  private seenMessageIds: Set<string> = new Set();
  private readonly MAX_MSGID_CACHE = 1000; // Keep last 1000 message IDs

  // Multiline message tracking (draft/multiline)
  private multilineBuffers: Map<string, {
    from: string;
    parts: string[];
    timestamp: number;
  }> = new Map();
  private readonly MULTILINE_TIMEOUT = 5000; // 5 seconds timeout for multiline assembly

  // SASL state
  private saslAuthenticating: boolean = false;

  // User list tracking
  private channelUsers: Map<string, Map<string, ChannelUser>> = new Map(); // channel -> nick -> user
  private userListListeners: ((channel: string, users: ChannelUser[]) => void)[] = [];
  private namesBuffer: Map<string, Set<string>> = new Map(); // channel -> set of nicks being built
  private channelTopics: Map<string, ChannelTopicInfo> = new Map(); // channel -> topic info
  private pendingChannelIntro: Set<string> = new Set();
  private pendingMessages: IRCMessage[] = []; // buffer messages until UI listeners attach
  private pendingConnectionStates: boolean[] = []; // buffer connection state events
  private lastWhowasTarget: string | null = null;
  private lastWhowasAt: number = 0;
  private silentWhoNicks: Set<string> = new Set(); // Nicks for which we want silent WHO (no display)
  private silentWhoCallbacks: Map<string, ((user: string, host: string) => void)> = new Map(); // Callbacks for silent WHO responses
  private silentModeNicks: Set<string> = new Set(); // Nicks for which we want silent MODE (no display)

  public on(event: string, listener: Function) {
    if (!this.eventListeners.has(event)) {
        this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
    return () => {
      const listeners = this.eventListeners.get(event);
      if (listeners) {
        const index = listeners.indexOf(listener);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    };
  }

  public emit(event: string, ...args: any[]) {
      if (this.eventListeners.has(event)) {
      this.eventListeners.get(event)!.forEach(listener => {
              try {
                listener(...args);
              } catch (e) {
                console.error(`Error in IRCService event listener for ${event}:`, e);
              }
          });
      }
  }

  private logRaw(...args: any[]): void {
    const text = args
      .map(arg => {
        if (typeof arg === 'string') return arg;
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      })
      .join(' ');
    if (__DEV__) {
      console.log(...args);
    }
    if (this.isLoggingRaw) return;
    this.isLoggingRaw = true;
    try {
      this.addRawMessage(text.startsWith('***') ? text : `*** ${text}`, 'debug');
    } finally {
      this.isLoggingRaw = false;
    }
  }

  private runBlacklistAction(
    entry: BlacklistEntry,
    context: {
      nick: string;
      username?: string;
      hostname?: string;
      channel?: string;
      network?: string;
      reasonOverride?: string;
    }
  ): void {
    if (!context.nick || context.nick === this.currentNick) {
      return;
    }
    const network = context.network || this.getNetworkName();
    const reason = context.reasonOverride || entry.reason || t('Blacklisted');
    const duration = entry.duration || '0'; // default to permanent
    const resolvedMask = this.getUserManagementService().resolveBlacklistMask(
      entry,
      context.nick,
      context.username,
      context.hostname
    );
    const toUserMask = (mask: string): string => {
      if (mask.includes('@')) {
        let user: string;
        let host: string;
        if (mask.includes('!')) {
          const afterBang = mask.split('!')[1] || '';
          const [maskUser, maskHost] = afterBang.split('@');
          user = maskUser || '*';
          host = maskHost || '*';
        } else {
          const [maskUser, maskHost] = mask.split('@');
          user = maskUser || '*';
          host = maskHost || '*';
        }
        if (user === '*' && context.username) {
          user = context.username;
        }
        if (host === '*' && context.hostname) {
          host = context.hostname;
        }
        return `${user}@${host}`;
      }
      if (context.hostname) {
        return `${context.username || '*'}@${context.hostname}`;
      }
      return `${context.username || '*'}@*`;
    };
    const toHostMask = (mask: string): string => {
      let user = '*';
      let host = '*';
      if (mask.includes('@')) {
        if (mask.includes('!')) {
          const afterBang = mask.split('!')[1] || '';
          const [maskUser, maskHost] = afterBang.split('@');
          user = maskUser || '*';
          host = maskHost || '*';
        } else {
          const [maskUser, maskHost] = mask.split('@');
          user = maskUser || '*';
          host = maskHost || '*';
        }
      }
      // If host is still a wildcard and we have actual hostname, use it
      if (host === '*' && context.hostname) {
        host = context.hostname;
      }
      return `${user}@${host}`;
    };
    const userMask = toUserMask(resolvedMask);
    const hostMask = toHostMask(resolvedMask);
    const actionMask =
      entry.action === 'akill'
        ? userMask
        : (entry.action === 'gline' || entry.action === 'shun')
          ? hostMask
          : resolvedMask;
    const formatTemplate = (template: string): string => {
      const normalized = template.trim().replace(/^\//, '');
      return normalized
        .replace(/\{mask\}/g, actionMask)
        .replace(/\{usermask\}/g, userMask)
        .replace(/\{hostmask\}/g, hostMask)
        .replace(/\{nick\}/g, context.nick)
        .replace(/\{user\}/g, context.username || '')
        .replace(/\{host\}/g, context.hostname || '')
        .replace(/\{channel\}/g, context.channel || '')
        .replace(/\{reason\}/g, reason)
        .replace(/\{duration\}/g, duration)
        .replace(/\{network\}/g, network || '');
    };

    if (entry.commandTemplate && ['akill', 'gline', 'shun'].includes(entry.action)) {
      this.sendCommand(formatTemplate(entry.commandTemplate));
      return;
    }

    // Check if we have a valid channel (starts with # or &)
    const isValidChannel = context.channel && /^[#&]/.test(context.channel);

    switch (entry.action) {
      case 'ignore':
        this.getUserManagementService().ignoreUser(resolvedMask, reason, network);
        break;
      case 'ban':
        if (isValidChannel) {
          this.sendCommand(`MODE ${context.channel} +b ${resolvedMask}`);
        }
        break;
      case 'kick_ban':
        if (isValidChannel) {
          this.sendCommand(`MODE ${context.channel} +b ${resolvedMask}`);
          this.sendCommand(`KICK ${context.channel} ${context.nick} :${reason}`);
        }
        break;
      case 'kill':
        this.sendCommand(`KILL ${context.nick} :${reason}`);
        break;
      case 'os_kill':
        this.sendCommand(`PRIVMSG OperServ :KILL ${context.nick} ${reason}`);
        break;
      case 'akill':
        this.sendCommand(`PRIVMSG OperServ :AKILL ADD +${duration} ${userMask} ${reason}`);
        break;
      case 'gline':
        this.sendCommand(`GLINE ${hostMask} ${duration} :${reason}`);
        break;
      case 'shun':
        this.sendCommand(`SHUN ${hostMask} ${duration} :${reason}`);
        break;
      case 'custom':
        if (entry.commandTemplate) {
          this.sendCommand(formatTemplate(entry.commandTemplate));
        }
        break;
      default:
        break;
    }
  }

  private extractMaskFromNotice(text: string): { nick: string; username?: string; hostname?: string } | null {
    if (!text) return null;
    const sanitized = text
      .replace(/\x03(\d{1,2}(,\d{1,2})?)?/g, '')
      .replace(/[\x02\x0f\x1f\x16\x1d]/g, '');
    const connectMatch = sanitized.match(/client connecting:\s*([A-Za-z0-9\-\[\]\\`^{}_|\.\~]+)!([^@\s]+)@([^\s]+)/i);
    if (connectMatch) {
      return {
        nick: connectMatch[1],
        username: connectMatch[2],
        hostname: connectMatch[3].replace(/[)\],]+$/, ''),
      };
    }
    const connectParenMatch = sanitized.match(/client connecting:\s*([A-Za-z0-9\-\[\]\\`^{}_|\.\~]+)\s*\(([^@\s]+)@([^\s\)]+)\)/i);
    if (connectParenMatch) {
      return {
        nick: connectParenMatch[1],
        username: connectParenMatch[2],
        hostname: connectParenMatch[3].replace(/[)\],]+$/, ''),
      };
    }
    const maskMatch = sanitized.match(/([A-Za-z0-9\-\[\]\\`^{}_|\.\~]+)!([^@\s]+)@([^\s]+)/);
    if (maskMatch) {
      return {
        nick: maskMatch[1],
        username: maskMatch[2],
        hostname: maskMatch[3].replace(/[)\],]+$/, ''),
      };
    }
    const parenMatch = sanitized.match(/([A-Za-z0-9\-\[\]\\`^{}_|\.\~]+)\s*\(([^@\s]+)@([^\s\)]+)\)/);
    if (parenMatch) {
      return {
        nick: parenMatch[1],
        username: parenMatch[2],
        hostname: parenMatch[3].replace(/[)\],]+$/, ''),
      };
    }
    return null;
  }

  connect(config: IRCConnectionConfig): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        let resolved = false;
        const resolveOnce = () => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      };

      // Reset manual disconnect flag for new attempts
      this.manualDisconnect = false;

        // If no network id set by ConnectionManager, fall back to host for identification
        if (!this.networkId) {
          this.networkId = config.host;
        }

        this.emit('pre-connect', config);

        this.logRaw('IRCService: Starting connection to', config.host, ':', config.port, 'TLS:', config.tls);
        
        this.config = config;
        this.registered = false;
        this.buffer = '';
        
        this.capNegotiating = false;
        this.capEnabled = false;
        this.capAvailable.clear();
        this.capRequested.clear();
        this.capEnabledSet.clear();
        this.capLSReceived = false;
        this.capLSVersion = 300;
        this.userhostInNames = false;
        this.extendedJoin = false;

        const proxy =
          config.proxy && config.proxy.enabled === false
            ? null
            : config.proxy || null;

        const tlsOptions: any = {
          host: config.host,
          port: config.port,
          // Socket timeout to prevent hanging connections that can cause native crashes
          timeout: 30000, // 30 seconds read/write timeout
        };

        if (config.tls) {
          tlsOptions.tlsCheckValidity = config.rejectUnauthorized !== false;
          if (config.clientCert && config.clientKey) {
            tlsOptions.cert = config.clientCert;
            tlsOptions.key = config.clientKey;
          }
          this.logRaw('IRCService: TLS enabled, tlsCheckValidity:', tlsOptions.tlsCheckValidity);
        }

        const startConnection = () => {
          this.logRaw('IRCService: Starting connection and CAP negotiation...');
          this.startCAPNegotiation();
        };

        const sendRegistration = () => {
          this.logRaw('IRCService: Sending IRC registration commands...');
          
          if (config.password) {
            this.sendRaw(`PASS ${config.password}`);
          }

          this.currentNick = config.nick;
          this.altNick = config.altNick || `${config.nick}_`;
          this.nickChangeAttempts = 0;
          this.sendRaw(`NICK ${config.nick}`);
          const username = config.username || config.nick;
          const realname = config.realname || config.nick;
          this.sendRaw(`USER ${username} 0 * :${realname}`);
          this.logRaw('IRCService: Sent NICK and USER commands');
        };

        (this as any)._sendRegistration = sendRegistration;

        this.logRaw('IRCService: Creating socket connection...');
        const attachCoreListeners = () => {
          if (!this.socket) {
            this.logRaw('IRCService: Cannot attach listeners - socket is null');
            return;
          }

          this.socket.on('data', (data: any) => {
            const dataStr = typeof data === 'string' ? data : data.toString();
            this.buffer += dataStr;
            this.processBuffer();
          });

          this.socket.on('error', (error: any) => {
            const errorMessage = error?.message || error?.toString() || t('Unknown connection error');
            const errorCode = error?.code || 'NO_CODE';
            if (!this.manualDisconnect) {
              console.error('IRC Connection Error:', {
                message: errorMessage,
                code: errorCode,
                error: error,
                stack: error?.stack,
              });
              this.addRawMessage(
                t('*** Socket error [{code}]: {message}', {
                  code: errorCode,
                  message: errorMessage,
                }),
                'connection'
              );
            }
            
            if (!this.manualDisconnect) {
              if (!this.isConnected) {
                this.addMessage({
                  type: 'error',
                  text: t('Connection error [{code}]: {message}', { code: errorCode, message: errorMessage }),
                  timestamp: Date.now(),
                });
                this.disconnect();
                reject(new Error(t('{message} (Code: {code})', { message: errorMessage, code: errorCode })));
              } else {
                this.addMessage({
                  type: 'error',
                  text: t('Socket error: {message}', { message: errorMessage }),
                  timestamp: Date.now(),
                });
              }
            }
          });

          // Handle socket timeout - this helps prevent native crashes from hung connections
          this.socket.on('timeout', () => {
            this.logRaw('IRCService: Socket timeout detected');
            // Send a PING to check if connection is still alive
            if (this.isConnected && this.registered) {
              this.sendRaw(`PING :timeout-check-${Date.now()}`);
            }
          });

          this.socket.on('close', () => {
            if (this.manualDisconnect) {
              this.manualDisconnect = false;
              this.isConnected = false;
              this.registered = false;
              this.emitConnection(false);
              return;
            }
            // Emit connection change even if isConnected is false (e.g., after KILL)
            // This ensures AutoReconnectService is notified of disconnection
            if (this.isConnected) {
              this.addRawMessage(t('*** Connection closed by server'), 'connection');
            }
            this.isConnected = false;
            this.registered = false;
            this.socket = null;
            this.emitConnection(false);

            // AutoReconnectService will handle reconnection via connectionChange event
            // IRCService's scheduleReconnect() is kept for backward compatibility but
            // AutoReconnectService takes precedence in multi-network scenarios
          });
        };

        const markConnected = (tls: boolean) => {
          this.isConnected = true;
          // Reset reconnection counter on successful connection
          this.reconnectAttempts = 0;
          if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
          }
          this.emitConnection(true);
          this.addRawMessage(
            t('*** Connected to {host}:{port}{tls}', {
              host: config.host,
              port: config.port,
              tls: tls ? t(' (TLS)') : '',
            }),
            'connection'
          );
          if (tls) {
            this.logRaw('IRCService: TLS handshake completed');
            this.addRawMessage(t('*** TLS handshake completed'), 'connection');
          } else {
            this.logRaw('IRCService: Socket connected successfully');
          }
          startConnection();
          resolveOnce();
        };

        if (proxy) {
          const proxyHost = proxy.host || (proxy.type === 'tor' ? '127.0.0.1' : undefined);
          const proxyPort = proxy.port || (proxy.type === 'tor' ? 9050 : undefined);
          if (!proxyHost || !proxyPort) {
            throw new Error(t('Proxy host/port not set'));
          }
          this.logRaw(
            `IRCService: Connecting via proxy type=${proxy.type || 'socks5'} host=${proxyHost} port=${proxyPort}`
          );
          this.socket = TcpSocket.createConnection({ host: proxyHost, port: proxyPort }, async () => {
            try {
              await this.establishProxyTunnel(proxy, config);
              if (config.tls) {
                this.logRaw('IRCService: Upgrading proxy connection to TLS...');
                this.socket = new TLSSocket(this.socket, tlsOptions);
                // Wait for TLS handshake to complete before attaching IRC listeners
                const handleTLSError = (err: any) => {
                  const msg = err?.message || String(err);
                  this.addRawMessage(
                    t('*** TLS error over proxy: {message}', { message: msg }),
                    'connection'
                  );
                  this.disconnect();
                  reject(new Error(t('TLS handshake failed: {message}', { message: msg })));
                };
                this.socket.once('secureConnect', () => {
                  this.logRaw('IRCService: TLS handshake completed over proxy connection');
                  this.socket.removeListener('error', handleTLSError);
                  attachCoreListeners();
                  markConnected(true);
                });
                this.socket.once('error', handleTLSError);
              } else {
                attachCoreListeners();
                markConnected(false);
              }
            } catch (err: any) {
              const msg = err?.message || String(err);
              this.addRawMessage(t('*** Proxy error: {message}', { message: msg }), 'connection');
              this.disconnect();
              reject(err);
            }
          });
        } else if (config.tls) {
          this.socket = TcpSocket.connectTLS(tlsOptions, () => {
            attachCoreListeners();
            markConnected(true);
          });
          
        } else {
          this.socket = TcpSocket.createConnection(tlsOptions, () => {
            attachCoreListeners();
            markConnected(false);
          });
        }

        const connectionTimeout = setTimeout(() => {
          if (!this.isConnected) {
            this.disconnect();
            reject(new Error(t('Connection timeout')));
          }
        }, 10000);

        this.socket.once('connect', () => {
          clearTimeout(connectionTimeout);
        });

        const capTimeout = setTimeout(() => {
          if (this.capNegotiating) {
            this.logRaw('IRCService: CAP negotiation timeout, ending negotiation and sending registration');
            this.capNegotiating = false;
            this.sendRaw('CAP END');
            const registrationFn = (this as any)._sendRegistration;
            if (registrationFn && typeof registrationFn === 'function') {
              registrationFn();
            }
          }
        }, 5000);
        
        (this as any)._capTimeout = capTimeout;
        
        const registrationTimeout = setTimeout(() => {
          if (!this.registered) {
            this.addRawMessage(t('*** Waiting for server registration...'), 'connection');
          }
        }, 10000);
        
        const checkRegistration = () => {
          if (this.registered) {
            clearTimeout(registrationTimeout);
          }
        };
        
        const registrationCheckInterval = setInterval(checkRegistration, 1000);
        
        setTimeout(() => {
          clearInterval(registrationCheckInterval);
        }, 15000);

      } catch (error: any) {
        const errorMessage = error?.message || error?.toString() || t('Failed to create connection');
        console.error('IRC Service Error:', error);
        reject(new Error(errorMessage));
      }
    });
  }

  private readFromSocketUntil(socket: any, predicate: (buf: Buffer) => boolean, timeoutMs: number = 5000): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      let buffer = Buffer.alloc(0);
      const cleanup = () => {
        socket.removeListener('data', onData);
        socket.removeListener('error', onError);
        clearTimeout(timer);
      };
      const onData = (chunk: any) => {
        buffer = Buffer.concat([buffer, Buffer.from(chunk)]);
        if (predicate(buffer)) {
          cleanup();
          resolve(buffer);
        }
      };
      const onError = (err: any) => {
        cleanup();
        reject(err);
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(t('Proxy read timeout')));
      }, timeoutMs);
      socket.on('data', onData);
      socket.on('error', onError);
    });
  }

  private async establishProxyTunnel(proxy: ProxyConfig, config: IRCConnectionConfig): Promise<void> {
    if (!proxy) return;
    if (proxy.type === 'http') {
      return this.establishHttpTunnel(proxy, config);
    }
    // SOCKS5 (default) and Tor use the same handshake (Tor typically on localhost:9050/9150)
    return this.establishSocks5Tunnel(proxy, config);
  }

  private async establishHttpTunnel(proxy: ProxyConfig, config: IRCConnectionConfig): Promise<void> {
    const auth =
      proxy.username && proxy.password
        ? `Proxy-Authorization: Basic ${Buffer.from(`${proxy.username}:${proxy.password}`).toString('base64')}\r\n`
        : '';
    const connectReq = `CONNECT ${config.host}:${config.port} HTTP/1.1\r\nHost: ${config.host}:${config.port}\r\n${auth}\r\n`;
    this.logRaw(`IRCService: HTTP proxy CONNECT -> ${config.host}:${config.port}`);
    this.socket.write(connectReq);
    const responseBuffer = await this.readFromSocketUntil(this.socket, (buf) => buf.includes(Buffer.from('\r\n\r\n')));
    const response = responseBuffer.toString('utf8');
    const statusLine = response.split('\r\n')[0] || '';
    if (!statusLine.includes('200')) {
      throw new Error(t('HTTP proxy CONNECT failed: {status}', { status: statusLine.trim() }));
    }
    this.logRaw(`IRCService: HTTP proxy CONNECT tunnel established (${statusLine.trim()})`);
  }

  private async establishSocks5Tunnel(proxy: ProxyConfig, config: IRCConnectionConfig): Promise<void> {
    const hostBuf = Buffer.from(config.host, 'utf8');
    const portBuf = Buffer.alloc(2);
    portBuf.writeUInt16BE(config.port, 0);

    const wantAuth = !!(proxy.username && proxy.password);
    const methods = wantAuth ? [0x00, 0x02] : [0x00];
    const greeting = Buffer.from([0x05, methods.length, ...methods]);
    this.logRaw(
      `IRCService: SOCKS5 greeting (auth=${wantAuth ? 'username/password' : 'none'}) to ${config.host}:${config.port}`
    );
    this.socket.write(greeting);
    const methodResp = await this.readFromSocketUntil(this.socket, (buf) => buf.length >= 2);
    if (methodResp[0] !== 0x05) {
      throw new Error(t('SOCKS5 proxy: invalid version'));
    }
    const method = methodResp[1];
    if (method === 0x02 && wantAuth) {
      const u = Buffer.from(String(proxy.username));
      const p = Buffer.from(String(proxy.password));
      const authReq = Buffer.concat([Buffer.from([0x01, u.length]), u, Buffer.from([p.length]), p]);
      this.socket.write(authReq);
      const authResp = await this.readFromSocketUntil(this.socket, (buf) => buf.length >= 2);
      if (authResp[1] !== 0x00) {
        throw new Error(t('SOCKS5 proxy: authentication failed'));
      }
      this.logRaw('IRCService: SOCKS5 authentication succeeded');
    } else if (method === 0xff) {
      throw new Error(t('SOCKS5 proxy: no acceptable auth method'));
    }

    const request = Buffer.concat([Buffer.from([0x05, 0x01, 0x00, 0x03, hostBuf.length]), hostBuf, portBuf]);
    this.socket.write(request);

    const replyHead = await this.readFromSocketUntil(this.socket, (buf) => buf.length >= 5);
    if (replyHead[1] !== 0x00) {
      throw new Error(t('SOCKS5 proxy: connect failed (code {code})', { code: replyHead[1] }));
    }
    const atyp = replyHead[3];
    let addrLen = 0;
    if (atyp === 0x01) addrLen = 4;
    else if (atyp === 0x03) addrLen = replyHead[4];
    else if (atyp === 0x04) addrLen = 16;
    const need = 4 + (atyp === 0x03 ? 1 : 0) + addrLen + 2;
    if (replyHead.length < need) {
      await this.readFromSocketUntil(this.socket, (buf) => buf.length >= need);
    }
    this.logRaw('IRCService: SOCKS5 tunnel established');
  }

  private processBuffer(): void {
    // Support both CRLF and LF line endings from servers/proxies
    const lines = this.buffer.split(/\r?\n/);
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) {
        this.addWireMessage('in', trimmed);
        this.handleIRCMessage(line);
      } else {
        // Show blank lines for troubleshooting proxy/http responses
        this.addWireMessage('in', t('(empty line)'));
      }
    }
  }

  private handleIRCMessage(line: string): void {
    if (this.verboseLogging) {
      this.logRaw(`IRCService: << ${line.substring(0, 200)}`);
    }
    let tags: Map<string, string> = new Map();
    let messageLine = line;
    
    if (line.startsWith('@')) {
      const tagEnd = line.indexOf(' ');
      if (tagEnd > 0) {
        const tagString = line.substring(1, tagEnd);
        messageLine = line.substring(tagEnd + 1);
        
        tagString.split(';').forEach(tagPair => {
          const [key, value] = tagPair.split('=');
          if (key) {
            tags.set(key, value || '');
          }
        });
      }
    }

    let messageTimestamp = Date.now();
    if (tags.has('time') && this.serverTime) {
      const timeValue = tags.get('time');
      if (timeValue) {
        try {
          const parsedTime = new Date(timeValue).getTime();
          if (!isNaN(parsedTime)) {
            messageTimestamp = parsedTime;
            const dotIndex = timeValue.lastIndexOf('.');
            const zIndex = timeValue.lastIndexOf('Z');
            if (dotIndex !== -1 && zIndex !== -1 && zIndex > dotIndex) {
                const fractional = timeValue.substring(dotIndex + 1, zIndex);
                if (fractional.length > 3) {
                    const ms = parseFloat(`0.${fractional}`) * 1000;
                    const baseTime = Date.parse(timeValue.substring(0, dotIndex) + 'Z');
                    if (!isNaN(baseTime) && !isNaN(ms)) {
                        messageTimestamp = baseTime + ms;
                    }
                }
            }
          }
        } catch (e) {
          console.error('Error parsing server-time:', e);
        }
      }
    }

    // Extract batch tag (IRCv3.2)
    const batchTag = tags.get('batch') || undefined;

    // Extract label tag for labeled-response (IRCv3.2)
    const labelTag = tags.get('label') || undefined;

    // Extract account tag for account-tag (IRCv3.2)
    const accountTag = tags.get('account') || undefined;

    // Extract msgid tag for message-ids (IRCv3.3)
    const msgidTag = tags.get('msgid') || undefined;

    // Message deduplication: skip if we've already seen this msgid
    if (msgidTag && this.seenMessageIds.has(msgidTag)) {
      this.logRaw(`IRCService: Skipping duplicate message with msgid: ${msgidTag}`);
      return;
    }

    // Track this msgid to prevent duplicates
    if (msgidTag) {
      this.seenMessageIds.add(msgidTag);
      // Prevent unbounded growth - keep only the last MAX_MSGID_CACHE entries
      if (this.seenMessageIds.size > this.MAX_MSGID_CACHE) {
        const firstId = this.seenMessageIds.values().next().value;
        this.seenMessageIds.delete(firstId);
      }
    }

    // Extract client-only tags (draft)
    const channelContextTag = tags.get('+draft/channel-context') || undefined;
    const replyTag = tags.get('+draft/reply') || tags.get('+reply') || undefined;
    const reactTag = tags.get('+draft/react') || tags.get('+react') || undefined;
    const typingTag = tags.get('typing') || tags.get('draft/typing') || tags.get('+typing') || undefined;

    // Extract multiline concat tag (draft/multiline)
    const multilineConcatTag = tags.get('draft/multiline-concat') || undefined;

    const parts = messageLine.split(' ');
    if (parts.length === 0) return;

    if (parts[0] === 'PING') {
      const server = parts[1] || '';
      this.sendRaw(`PONG ${server}`);
      return;
    }

    let prefix = '';
    let command = '';
    let params: string[] = [];
    let startIdx = 0;

    if (parts[0].startsWith(':')) {
      prefix = parts[0].substring(1);
      command = parts[1] || '';
      startIdx = 2;
    } else {
      command = parts[0];
      startIdx = 1;
    }
    
    params = [];
    let trailingParamFound = false;
    for (let j = startIdx; j < parts.length; j++) {
      if (!trailingParamFound && parts[j].startsWith(':')) {
        trailingParamFound = true;
        const trailingParam = parts.slice(j).join(' ').substring(1);
        params.push(trailingParam);
        break;
      }
      if (!trailingParamFound) {
        params.push(parts[j]);
      }
    }

    const numeric = parseInt(command, 10);
    if (!isNaN(numeric)) {
      this.handleNumericReply(numeric, prefix, params, messageTimestamp);
      return;
    }

    if (!this.commandHandlers) {
      this.commandHandlers = new IRCCommandHandlers(this as any);
    }
    if (this.commandHandlers.handle(command, prefix, params, messageTimestamp, {
      batchTag,
      accountTag,
      msgidTag,
      channelContextTag,
      replyTag,
      reactTag,
      typingTag,
    })) {
      return;
    }

    switch (command) {

      case 'AUTHENTICATE':
        if (params.length > 0) {
          if (params[0] === '+') {
            this.logRaw('IRCService: Server ready for SASL authentication data');
            this.sendSASLCredentials();
          } else if (params[0] && params[0] !== '+') {
            this.logRaw('IRCService: SASL authentication error:', params[0]);
            this.saslAuthenticating = false;
          }
        }
        return;
      case 'PRIVMSG':
        const target = params[0] || '';
        const fromNick = this.extractNick(prefix);
        let msgText = params[1] || '';

        // Strip ZNC playback timestamps to allow proper decryption
        // ZNC adds timestamps like: [HH:MM:SS] text [HH:MM:SS]
        msgText = msgText.replace(/^\[\d{2}:\d{2}:\d{2}\]\s*/, ''); // Remove leading timestamp
        msgText = msgText.replace(/\s*\[\d{2}:\d{2}:\d{2}\]$/, ''); // Remove trailing timestamp

        if (!target || target === '*' || target.trim() === '') {
          return;
        }
        
        const isChannel = target.startsWith('#') || target.startsWith('&') || target.startsWith('+') || target.startsWith('!');
        
        if (!isChannel && fromNick === this.currentNick && target === this.currentNick) {
          return;
        }
        
        // Check if user is ignored (after CTCP handling, before regular message processing)
        const network = this.getNetworkName();
        const prefixParts = prefix.split('!');
        const username = prefixParts[1]?.split('@')[0];
        const hostname = prefixParts[1]?.split('@')[1];
        if (this.getUserManagementService().isUserIgnored(fromNick, username, hostname, network)) {
          // User is ignored, skip this message
          return;
        }

        const ctcp = this.parseCTCP(msgText);
        const protectionContext = this.getProtectionTabContext(target, fromNick, isChannel);
        const protectionDecision = protectionService.evaluateIncomingMessage({
          type: 'message',
          channel: isChannel ? target : fromNick,
          from: fromNick,
          text: msgText,
          timestamp: messageTimestamp,
          network,
          username,
          hostname,
        }, {
          isActiveTab: protectionContext.isActiveTab,
          isQueryOpen: protectionContext.isQueryOpen,
          isChannel,
          isCtcp: ctcp.isCTCP,
        });
        if (protectionDecision) {
          this.handleProtectionBlock(protectionDecision.kind, fromNick, username, hostname, isChannel ? target : null);
          return;
        }

        if (ctcp.isCTCP && ctcp.command) {
          this.handleCTCPRequest(fromNick, target, ctcp.command, ctcp.args);
          return;
        }
        
        // For query messages, determine the correct channel identifier:
        // - If it's our message (fromNick === currentNick), use target (recipient's tab)
        // - If it's from someone else, use fromNick (sender's tab)
        // This ensures both local echo and server echo go to the same tab
        const channelIdentifier = isChannel 
          ? target 
          : (fromNick.toLowerCase() === this.currentNick.toLowerCase() ? target : fromNick);

        // Handle old protocol for backward compatibility
        if (msgText.startsWith('!enc-key ')) {
          const network = this.getNetworkName();
          encryptedDMService.handleIncomingBundleForNetwork(network, fromNick, msgText.substring('!enc-key '.length));
          return;
        }

        // New negotiation protocol: key offer (requires acceptance)
        if (msgText.startsWith('!enc-offer ')) {
          const network = this.getNetworkName();
          encryptedDMService.handleKeyOfferForNetwork(network, fromNick, msgText.substring('!enc-offer '.length));
          return;
        }

        // Handle key acceptance (they accepted and sent their key)
        if (msgText.startsWith('!enc-accept ')) {
          const network = this.getNetworkName();
          encryptedDMService.handleKeyAcceptanceForNetwork(network, fromNick, msgText.substring('!enc-accept '.length))
            .then(result => {
              if (result.status === 'stored') {
                this.addMessage({
                  type: 'notice',
                  text: t('*** {nick} accepted your encryption key. Encrypted chat enabled.', { nick: fromNick }),
                  timestamp: Date.now(),
                });
              } else if (result.status === 'pending') {
                this.addMessage({
                  type: 'notice',
                  text: t('*** {nick} sent a different encryption key. Review and accept the new key to continue encrypted chat.', { nick: fromNick }),
                  timestamp: Date.now(),
                });
              }
            })
            .catch(e => console.warn('EncryptedDMService: failed to handle acceptance', e));
          return;
        }

        // Handle key rejection
        if (msgText === '!enc-reject') {
          this.addMessage({
            type: 'notice',
            text: t('*** {nick} rejected your encryption key offer.', { nick: fromNick }),
            timestamp: Date.now(),
          });
          return;
        }

        // Handle key request (auto-send offer)
        if (msgText === '!enc-req') {
          encryptedDMService
            .exportBundle()
            .then(bundle => this.sendRaw(`PRIVMSG ${fromNick} :!enc-offer ${JSON.stringify(bundle)}`))
            .catch(e => console.warn('EncryptedDMService: failed to respond to enc-req', e));
          return;
        }

        // Handle encrypted channel messages
        if (msgText.startsWith('!chanenc-msg ')) {
          if (!isChannel) {
            return; // Ignore channel encryption in DMs
          }
          let payload: any = null;
          try {
            payload = JSON.parse(msgText.substring('!chanenc-msg '.length));
          } catch (e) {
            this.addMessage({
              type: 'error',
              channel: channelIdentifier,
              from: fromNick,
              text: t('🔒 Invalid channel encryption payload'),
              timestamp: messageTimestamp,
            });
            return;
          }

          channelEncryptionService
            .decryptMessage(payload, target, this.getNetworkName())
            .then(plaintext => {
              this.addMessage({
                type: 'message',
                channel: channelIdentifier,
                from: fromNick,
                text: t('🔒 {message}', { message: plaintext }),
                timestamp: messageTimestamp,
              });
            })
            .catch(e => {
              this.addMessage({
                type: 'message',
                channel: channelIdentifier,
                from: fromNick,
                text: t('🔒 {message}', {
                  message: e.message === 'no channel key'
                    ? t('Missing channel key. Use /chankey request <nick> to get it.')
                    : t('Decryption failed. If this was sent from v1.6.3+, please update to v1.6.3 or newer.'),
                }),
                timestamp: messageTimestamp,
              });
            });
          return;
        }

        // Handle encrypted channel key sharing (via DM)
        if (msgText.startsWith('!chanenc-key ')) {
          const keyData = msgText.substring('!chanenc-key '.length);
          channelEncryptionService.importChannelKey(keyData, this.getNetworkName())
            .then(imported => {
              this.addMessage({
                type: 'notice',
                text: t('*** Received channel key for {channel} from {nick}', { channel: imported.channel, nick: fromNick }),
                timestamp: Date.now(),
              });
            })
            .catch(e => {
              this.addMessage({
                type: 'error',
                text: t('*** Failed to import channel key: {message}', { message: e }),
                timestamp: Date.now(),
              });
            });
          return;
        }

        // Handle DM encrypted messages
        if (msgText.startsWith('!enc-msg ')) {
          let payload: any = null;
          try {
            payload = JSON.parse(msgText.substring('!enc-msg '.length));
          } catch (e) {
            this.addMessage({
              type: 'error',
              channel: channelIdentifier,
              from: fromNick,
              text: t('Invalid encrypted payload'),
              timestamp: messageTimestamp,
            });
            return;
          }

          const network = this.getNetworkName();
          encryptedDMService
            .decryptForNetwork(payload, network, fromNick)
            .then(plaintext => {
              this.addMessage({
                type: 'message',
                channel: channelIdentifier,
                from: fromNick,
                text: t('🔒 {message}', { message: plaintext }),
                timestamp: messageTimestamp,
              });
            })
            .catch(() => {
              this.addMessage({
                type: 'error',
                channel: channelIdentifier,
                text: t('Encrypted message from {nick} could not be decrypted. If they are on v1.6.3+, please update to v1.6.3 or newer.', { nick: fromNick }),
                timestamp: messageTimestamp,
              });
            });
          return;
        }

        // Handle multiline messages (draft/multiline)
        const finalText = this.handleMultilineMessage(
          fromNick,
          channelIdentifier,
          msgText,
          multilineConcatTag,
          {
            timestamp: messageTimestamp,
            account: accountTag,
            msgid: msgidTag,
            channelContext: channelContextTag,
            replyTo: replyTag,
          }
        );

        // Only add message if multiline assembly is complete
        if (finalText !== null) {
          this.addMessage({
            type: 'message',
            channel: channelIdentifier,
            from: fromNick,
            text: finalText,
            timestamp: messageTimestamp,
            account: accountTag, // IRCv3.2 account-tag
            msgid: msgidTag, // IRCv3.3 message-ids
            channelContext: channelContextTag, // draft/channel-context
            replyTo: replyTag, // draft/reply
            reactions: reactTag, // draft/react
            typing: typingTag as 'active' | 'paused' | 'done' | undefined, // +typing
            username,
            hostname,
            target,
            command: 'PRIVMSG',
          }, batchTag); // Pass batchTag for IRCv3 batch support (chathistory)
        }
        break;


      default:
        const fullMessage = `${prefix ? `:${prefix} ` : ''}${command} ${params.join(' ')}`;
        this.addMessage({
          type: 'raw',
          text: t('*** RAW Command: {message}', { message: fullMessage }),
          timestamp: messageTimestamp,
          isRaw: true,
          rawCategory: 'server',
        });
        break;
    }

    // Handle labeled-response (IRCv3.2) - match responses to commands
    if (labelTag) {
      this.handleLabeledResponse(labelTag, { command, params, prefix, timestamp: messageTimestamp, tags });
    }
  }

  private handleNumericReply(numeric: number, prefix: string, params: string[], timestamp: number = Date.now()): void {
    this.emit('numeric', numeric, prefix, params, timestamp);
    
    // Try extracted handlers first (modular architecture)
    if (!this.numericHandlers) {
      this.numericHandlers = new IRCNumericHandlers(this as any);
    }
    if (this.numericHandlers.handle(numeric, prefix, params, timestamp)) {
      return; // Handler found and executed
    }
    
    // Fallback to a generic display for numerics not yet mapped
    const rawText = params.slice(1).join(' ').replace(/^:/, '');
    const displayText = rawText || t('Server response');
    this.addMessage({
      type: 'raw',
      text: t('[{numeric}] {message}', { numeric, message: displayText }),
      timestamp: timestamp,
      isRaw: true,
      rawCategory: 'server'
    });
  }

  private startCAPNegotiation(): void {
    this.capNegotiating = true;
    this.logRaw('IRCService: Starting CAP negotiation');
    this.sendRaw('CAP LS 302');
  }

  private base64Encode(str: string): string {
    const bytes: number[] = [];
    for (let i = 0; i < str.length; i++) {
      bytes.push(str.charCodeAt(i));
    }
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let output = '';
    for (let i = 0; i < bytes.length; i += 3) {
      const byte1 = bytes[i] || 0;
      const byte2 = bytes[i + 1] || 0;
      const byte3 = bytes[i + 2] || 0;
      const bitmap = (byte1 << 16) | (byte2 << 8) | byte3;
      output += chars.charAt(bitmap >> 18 & 0x3F) +
                chars.charAt(bitmap >> 12 & 0x3F) +
                (i + 1 < bytes.length ? chars.charAt(bitmap >> 6 & 0x3F) : '=') +
                (i + 2 < bytes.length ? chars.charAt(bitmap & 0x3F) : '=');
    }
    return output;
  }

  private startSASL(): void {
    const forceSASL = this.config?.sasl?.force === true;
    if (!this.capEnabledSet.has('sasl') && !forceSASL) {
      this.logRaw('IRCService: SASL not enabled on server');
      return;
    }

    if (this.config?.clientCert && this.config?.clientKey) {
      this.logRaw('IRCService: Starting SASL EXTERNAL authentication with cert');
      this.saslAuthenticating = true;
      this.sendRaw('AUTHENTICATE EXTERNAL');
      return;
    }

    if (!this.config?.sasl) {
      this.logRaw('IRCService: No SASL config available');
      return;
    }
    
    if (!this.config.sasl.account || !this.config.sasl.password) {
      this.logRaw('IRCService: SASL account or password missing');
      return;
    }
    
    this.logRaw(`IRCService: Starting SASL PLAIN authentication for account: ${this.config.sasl.account}`);
    this.saslAuthenticating = true;
    this.sendRaw('AUTHENTICATE PLAIN');
  }

  private sendSASLCredentials(): void {
    if (!this.config?.sasl || !this.saslAuthenticating) return;
    
    const { account, password } = this.config.sasl;
    const authString = `${account}\0${account}\0${password}`;
    const authBase64 = this.base64Encode(authString);
    
    if (authBase64.length > 400) {
      const chunks = authBase64.match(/.{1,400}/g) || [];
      chunks.forEach(chunk => {
        this.sendRaw(`AUTHENTICATE ${chunk}`);
      });
    } else {
      this.sendRaw(`AUTHENTICATE ${authBase64}`);
    }
  }

  private handleCAPCommand(params: string[]): void {
    if (!this.capHandlers) {
      this.capHandlers = new CAPHandlers({
        capAvailable: this.capAvailable,
        capEnabledSet: this.capEnabledSet,
        capRequested: this.capRequested,
        config: this.config,
        getCapLSReceived: () => this.capLSReceived,
        setCapLSReceived: (value: boolean) => { this.capLSReceived = value; },
        setUserhostInNames: (value: boolean) => { this.userhostInNames = value; },
        setExtendedJoin: (value: boolean) => { this.extendedJoin = value; },
        getSaslAuthenticating: () => this.saslAuthenticating,
        emit: this.emit.bind(this),
        logRaw: this.logRaw.bind(this),
        requestCapabilities: this.requestCapabilities.bind(this),
        endCAPNegotiation: this.endCAPNegotiation.bind(this),
        startSASL: this.startSASL.bind(this),
      });
    }

    this.capHandlers.handleCAPCommand(params);
  }

  private handleServerError(errorText: string): void {
    const isKillError =
      errorText.toLowerCase().includes('killed') ||
      errorText.toLowerCase().includes('kill');

    if (isKillError) {
      this.logRaw(`IRCService: KILL-related ERROR received: ${errorText}, disconnecting and triggering auto-reconnect`);
      this.isConnected = false;
      this.registered = false;
      if (this.socket) {
        try {
          this.socket.destroy();
        } catch (error: any) {
          this.logRaw(`IRCService: Socket destroy error during ERROR/KILL (ignored): ${error?.message || error}`);
        }
        this.socket = null;
      }
      this.emitConnection(false);
    } else {
      this.disconnect(errorText);
    }
  }

  private handleKillDisconnect(reason: string): void {
    const currentNick = this.getCurrentNick();
    this.logRaw(`IRCService: KILL received for ${currentNick}, disconnecting and triggering auto-reconnect`);
    this.isConnected = false;
    this.registered = false;
    if (this.socket) {
      try {
        this.socket.destroy();
      } catch (error: any) {
        this.logRaw(`IRCService: Socket destroy error during KILL (ignored): ${error?.message || error}`);
      }
      this.socket = null;
    }
    this.emitConnection(false);
  }

  private parseSTSPolicyValue(value: string): { [key: string]: string } {
    const policy: { [key: string]: string } = {};
    value.split(',').forEach(part => {
      const [key, val] = part.split('=');
      if (key && val) {
        policy[key] = val;
      }
    });
    return policy;
  }

  private requestCapabilities(): void {
    const allCapsWeWant = [
      'server-time', 'account-notify', 'extended-join', 'userhost-in-names',
      'away-notify', 'chghost', 'message-tags', 'typing', 'draft/typing', 'batch', 'labeled-response',
      'echo-message', 'multi-prefix', 'invite-notify', 'monitor', 'extended-monitor',
      'cap-notify', 'account-tag', 'setname', 'standard-replies', 'message-ids',
      'bot', 'utf8only', 'chathistory', 'draft/chathistory', 'draft/multiline', 'draft/read-marker',
      'draft/message-redaction', 'sts'
    ];
    const capsToRequest: string[] = allCapsWeWant.filter(cap => this.capAvailable.has(cap));
    
    // Check SASL availability and add to requested caps
    const hasSaslConfig = !!this.config?.sasl?.account && !!this.config?.sasl?.password;
    const hasCert = !!(this.config?.clientCert && this.config?.clientKey);
    const saslAvailable = this.capAvailable.has('sasl');
    const forceSASL = this.config?.sasl?.force === true;
    
    // Allow SASL if: (1) server advertises it, OR (2) user forces it
    const shouldUseSASL = (hasSaslConfig || hasCert) && (saslAvailable || forceSASL);
    
    if (shouldUseSASL) {
      capsToRequest.push('sasl');
      if (forceSASL && !saslAvailable) {
        this.logRaw('IRCService: Force-enabling SASL (server does not advertise capability)');
      }
    } else if (hasSaslConfig && !saslAvailable && !forceSASL) {
      this.logRaw('IRCService: Server does not advertise SASL. NickServ identify will be used after connection');
    }
    
    if (capsToRequest.length > 0) {
      capsToRequest.forEach(cap => this.capRequested.add(cap));
      this.sendRaw(`CAP REQ :${capsToRequest.join(' ')}`);
      this.logRaw(`IRCService: Requesting capabilities: ${capsToRequest.join(' ')}`);
    } else {
      this.endCAPNegotiation();
    }
  }

  private endCAPNegotiation(): void {
    if (!this.capNegotiating) return;
    
    this.logRaw('IRCService: Ending CAP negotiation');
    this.capNegotiating = false;
    this.capEnabled = this.capEnabledSet.size > 0;
    
    const capTimeout = (this as any)._capTimeout;
    if (capTimeout) {
      clearTimeout(capTimeout);
      (this as any)._capTimeout = null;
    }
    
    this.sendRaw('CAP END');
    
    const sendRegistration = (this as any)._sendRegistration;
    if (sendRegistration && typeof sendRegistration === 'function') {
      setTimeout(() => sendRegistration(), 50);
    }
  }

  getCurrentNick(): string {
    return this.currentNick;
  }

  getSelfUserModes(): string[] {
    return Array.from(this.selfUserModes.values());
  }

  isServerOper(): boolean {
    return this.selfUserModes.has('o');
  }

  private buildProtectionMask(nick: string, username?: string, hostname?: string): string {
    const user = username || '*';
    const host = hostname || '*';
    return `${nick}!${user}@${host}`;
  }

  private buildSilenceMask(nick: string, hostname?: string): string {
    if (hostname) {
      return `*!*@${hostname}`;
    }
    return nick;
  }

  private getProtectionTabContext(target: string, fromNick: string, isChannel: boolean): { isActiveTab: boolean; isQueryOpen: boolean } {
    const tabs = useTabStore.getState().tabs;
    const activeTab = useTabStore.getState().getActiveTab();
    const networkId = this.getNetworkName();
    const tabMatchesTarget = activeTab
      ? activeTab.networkId === networkId &&
        (isChannel
          ? activeTab.type === 'channel' && activeTab.name.toLowerCase() === target.toLowerCase()
          : activeTab.type === 'query' && activeTab.name.toLowerCase() === fromNick.toLowerCase())
      : false;
    const isQueryOpen = tabs.some(
      t => t.networkId === networkId && t.type === 'query' && t.name.toLowerCase() === fromNick.toLowerCase(),
    );
    return { isActiveTab: tabMatchesTarget, isQueryOpen };
  }

  private handleProtectionBlock(
    decisionKind: string,
    fromNick: string,
    username: string | undefined,
    hostname: string | undefined,
    channel: string | null,
  ): void {
    const network = this.getNetworkName();
    const ignoreMask = this.buildProtectionMask(fromNick, username, hostname);
    const hostMask = this.buildSilenceMask(fromNick, hostname);
    if (!this.getUserManagementService().isUserIgnored(fromNick, username, hostname, network)) {
      this.getUserManagementService().ignoreUser(ignoreMask, `Auto protection: ${decisionKind}`, network).catch(err => {
        this.logRaw(`IRCService: Failed to auto-ignore ${ignoreMask}: ${err?.message || err}`);
      });
    }

    const actionConfig = protectionService.getActionConfig();
    if (actionConfig.protEnforceSilence) {
      const silenceMask = this.buildSilenceMask(fromNick, hostname);
      this.sendRaw(`SILENCE +${silenceMask}`);
    }

    if (!this.isServerOper() || actionConfig.protIrcopAction === 'none') {
      return;
    }

    const reason = actionConfig.protIrcopReason || `Auto protection: ${decisionKind}`;
    switch (actionConfig.protIrcopAction) {
      case 'ban':
        if (channel) {
          this.sendCommand(`MODE ${channel} +b ${hostMask}`);
          this.sendCommand(`KICK ${channel} ${fromNick} :${reason}`);
        }
        break;
      case 'kill':
        this.sendCommand(`KILL ${fromNick} :${reason}`);
        break;
      case 'kline':
        if (actionConfig.protIrcopDuration) {
          this.sendCommand(`KLINE ${actionConfig.protIrcopDuration} ${hostMask} :${reason}`);
        } else {
          this.sendCommand(`KLINE ${hostMask} :${reason}`);
        }
        break;
      case 'gline':
        if (actionConfig.protIrcopDuration) {
          this.sendCommand(`GLINE ${hostMask} ${actionConfig.protIrcopDuration} :${reason}`);
        } else {
          this.sendCommand(`GLINE ${hostMask} :${reason}`);
        }
        break;
      default:
        break;
    }
  }

  isRegistered(): boolean {
    return this.registered;
  }

  private extractNick(prefix: string): string {
    if (!prefix) return '';
    const exclamation = prefix.indexOf('!');
    return exclamation !== -1 ? prefix.substring(0, exclamation) : prefix;
  }

  private parseUserWithPrefixes(userStr: string): ChannelUser | null {
    if (!userStr || !userStr.trim()) return null;
    const prefixes = ['~', '&', '@', '%', '+'];
    const prefixMap: { [key: string]: string } = { '~': 'q', '&': 'a', '@': 'o', '%': 'h', '+': 'v' };
    let nick = userStr;
    const modes: string[] = [];
    
    while (nick.length > 0 && prefixes.includes(nick[0])) {
      const prefix = nick[0];
      const mode = prefixMap[prefix];
      if (mode && !modes.includes(mode)) modes.push(mode);
      nick = nick.substring(1);
    }
    
    let account: string | undefined, host: string | undefined;
    if (this.userhostInNames) {
      const exclamation = nick.indexOf('!');
      const at = nick.indexOf('@');
      if (exclamation !== -1 && at !== -1) {
        const parsedNick = nick.substring(0, exclamation);
        host = nick.substring(at + 1);
        nick = parsedNick;
        // Note: we don't set account here - account comes from extended-join or account-notify
      }
    }
    
    if (!nick || !nick.trim()) return null;
    
    return { nick: nick.trim(), modes, account, host };
  }

  private updateChannelUserList(channel: string): void {
    const usersMap = this.channelUsers.get(channel);
    if (usersMap) this.emitUserListChange(channel, Array.from(usersMap.values()));
  }

  private buildRoleLine(label: string, count: number, total: number): string {
    const barLength = 30;
    const percentage = total > 0 ? ((count / total) * 100) : 0;
    const visualLength = count > 0 && total > 0 ? Math.max(1, Math.round((count / total) * barLength)) : 0;
    const bar = visualLength > 0 ? 'l'.repeat(visualLength) : '';
    const paddedLabel = label.padEnd(2, ' ');
    return `  |-------[ +${paddedLabel}: ${bar} ${count} (${percentage.toFixed(1)}%)`;
  }

  private getChannelUserCounts(channel: string) {
    const usersMap = this.channelUsers.get(channel);
    let total = 0, ops = 0, voice = 0, halfop = 0, admin = 0, owner = 0;
    if (usersMap) {
      total = usersMap.size;
      usersMap.forEach(user => {
        if (user.modes.includes('o')) ops++;
        if (user.modes.includes('v')) voice++;
        if (user.modes.includes('h')) halfop++;
        if (user.modes.includes('a')) admin++;
        if (user.modes.includes('q')) owner++;
      });
    }
    return { total, ops, voice, halfop, admin, owner };
  }

  private maybeEmitChannelIntro(channel: string, timestamp: number): void {
    if (!this.pendingChannelIntro.has(channel)) return;

    const topicInfo = this.channelTopics.get(channel);
    if (!topicInfo || !topicInfo.topic) return; // Wait until we have the topic to show intro

    const { total } = this.getChannelUserCounts(channel);
    const setBy = topicInfo.setBy || t('unknown');
    const setAtDisplay = topicInfo.setAt
      ? new Date((topicInfo.setAt || 0) * 1000).toString()
      : t('unknown');
    const modesDisplay = topicInfo.modes || t('unknown');

    const lines = [
      t('Topic: {topic}', { topic: topicInfo.topic }),
    ];

    this.addMessage({
      type: 'topic',
      channel,
      text: lines.join('\n'),
      timestamp,
    });

    this.pendingChannelIntro.delete(channel);
  }

  private emitUserListChange(channel: string, users: ChannelUser[]): void {
    this.userListListeners.forEach(cb => cb(channel, users));
  }

  private updateSelfUserModes(modeString: string): void {
    if (!modeString) return;
    let adding = true;
    for (const char of modeString) {
      if (char === '+') { adding = true; continue; }
      if (char === '-') { adding = false; continue; }
      if (adding) {
        this.selfUserModes.add(char);
      } else {
        this.selfUserModes.delete(char);
      }
    }
  }

  private handleChannelModeChange(channel: string, modeParams: string[]): void {
    if (modeParams.length === 0) return;
    
    const usersMap = this.channelUsers.get(channel);
    if (!usersMap) return;
    const antiDeop = protectionService.getAntiDeopConfig();
    
    const modeString = modeParams[0] || '';
    let paramIndex = 1;
    let adding = true;
    
    for (let i = 0; i < modeString.length; i++) {
      const char = modeString[i];
      if (char === '+') { adding = true; continue; }
      if (char === '-') { adding = false; continue; }
      
      const userModes = ['o', 'v', 'h', 'a', 'q'];
      if (userModes.includes(char) && paramIndex < modeParams.length) {
        const targetNick = modeParams[paramIndex++];
        if (targetNick) {
          const user = usersMap.get(targetNick.toLowerCase());
          if (user) {
            if (adding) {
              if (!user.modes.includes(char)) user.modes.push(char);
            } else {
              user.modes = user.modes.filter(m => m !== char);
            }
            const modePriority: { [key: string]: number } = { 'q': 0, 'a': 1, 'o': 2, 'h': 3, 'v': 4 };
            user.modes.sort((a, b) => (modePriority[a] ?? 99) - (modePriority[b] ?? 99));
          }
          if (!adding && char === 'o' && antiDeop.protAntiDeopEnabled && targetNick.toLowerCase() === this.currentNick.toLowerCase()) {
            if (antiDeop.protAntiDeopUseChanserv) {
              this.sendRaw(`PRIVMSG ChanServ :OP ${channel} ${this.currentNick}`);
            } else {
              this.sendCommand(`MODE ${channel} +o ${this.currentNick}`);
            }
          }
        }
      }
    }
    this.updateChannelUserList(channel);
  }

  getChannelUsers(channel: string): ChannelUser[] {
    const usersMap = this.channelUsers.get(channel);
    return usersMap ? Array.from(usersMap.values()) : [];
  }

  onUserListChange(callback: (channel: string, users: ChannelUser[]) => void): () => void {
    this.userListListeners.push(callback);
    return () => this.userListListeners = this.userListListeners.filter(cb => cb !== callback);
  }

  public sendRaw(message: string): void {
    if (this.socket && this.isConnected) {
      try {
        this.socket.write(message + '\r\n');
        this.addWireMessage('out', message);
        this.emit('send-raw', message);
      } catch (error: any) {
        // Socket may have been closed during write
        this.logRaw(`IRCService: Unable to send message (socket closed): ${error?.message || error}`);
        // Mark as disconnected to prevent further write attempts
        this.isConnected = false;
      }
    }
  }

  /**
   * Send a silent WHO command - the command and its response won't be displayed in the UI.
   * Useful for fetching user information without spamming the server tab.
   * @param nick The nick to query
   * @param callback Optional callback that receives (username, hostname) when response arrives
   */
  public sendSilentWho(nick: string, callback?: ((user: string, host: string) => void)): void {
    if (this.socket && this.isConnected) {
      // Mark this nick as silent WHO target
      this.silentWhoNicks.add(nick.toLowerCase());
      
      // Store callback if provided
      if (callback) {
        this.silentWhoCallbacks.set(nick.toLowerCase(), callback);
      }
      
      // Send WHO without adding to wire messages (silent)
      try {
        this.socket.write(`WHO ${nick}\r\n`);
        // Don't call addWireMessage - this keeps it silent
        this.emit('send-raw', `WHO ${nick}`);
      } catch (error: any) {
        this.logRaw(`IRCService: Unable to send silent WHO (socket closed): ${error?.message || error}`);
        this.silentWhoNicks.delete(nick.toLowerCase());
        this.silentWhoCallbacks.delete(nick.toLowerCase());
      }
    }
  }

  /**
   * Send a silent MODE command to get user modes - the response won't be displayed in the UI.
   * Useful for checking if user is an oper without spamming the server tab.
   * @param nick The nick to query
   */
  public sendSilentMode(nick: string): void {
    if (this.socket && this.isConnected) {
      // Mark this nick as silent MODE target
      this.silentModeNicks.add(nick.toLowerCase());
      
      // Send MODE without adding to wire messages (silent)
      try {
        this.socket.write(`MODE ${nick}\r\n`);
        // Don't call addWireMessage - this keeps it silent
        this.emit('send-raw', `MODE ${nick}`);
      } catch (error: any) {
        this.logRaw(`IRCService: Unable to send silent MODE (socket closed): ${error?.message || error}`);
        this.silentModeNicks.delete(nick.toLowerCase());
      }
    }
  }

  /**
   * Detect clones in a channel by grouping users by their hostname.
   * Uses existing user data from NAMES list (requires userhost-in-names capability).
   * Processes users in batches to avoid blocking the UI on large channels.
   * @param channel The channel to check for clones
   * @returns Promise that resolves with a map of host -> nicks[] for clones only
   */
  public async detectClones(channel: string): Promise<Map<string, string[]>> {
    const users = this.channelUsers.get(channel);
    if (!users || users.size === 0) {
      return new Map();
    }

    const userArray = Array.from(users.values());
    const hostMap = new Map<string, string[]>();
    
    // Process users in batches to avoid blocking UI
    for (let i = 0; i < userArray.length; i += this.cloneDetectionBatchSize) {
      const batch = userArray.slice(i, i + this.cloneDetectionBatchSize);
      
      // Process this batch
      batch.forEach(user => {
        if (user.host) {
          const existing = hostMap.get(user.host) || [];
          existing.push(user.nick);
          hostMap.set(user.host, existing);
        }
      });

      // Yield to event loop between batches
      if (i + this.cloneDetectionBatchSize < userArray.length) {
        await new Promise(resolve => setTimeout(resolve, this.cloneDetectionDelay));
      }
    }

    // Filter to only include hosts with multiple nicks (clones)
    const clones = new Map<string, string[]>();
    hostMap.forEach((nicks, host) => {
      if (nicks.length > 1) {
        clones.set(host, nicks);
      }
    });

    return clones;
  }

  /**
   * Check if clone detection is currently active
   */
  public isCloneDetectionActive(): boolean {
    return this.cloneDetectionActive;
  }

  disconnect(message?: string): void {
    this.manualDisconnect = true;
    if (this.socket) {
      const socketRef = this.socket;

      if (this.isConnected) {
        try {
          this.sendRaw(`QUIT :${message || DEFAULT_QUIT_MESSAGE}`);
        } catch (error: any) {
          // sendRaw already handles errors, but catch here for extra safety
          this.logRaw(`IRCService: Unable to send QUIT during disconnect: ${error?.message || error}`);
        }
      }

      // Remove all listeners first to prevent callbacks during destruction
      // This helps prevent native crashes from race conditions
      try {
        socketRef.removeAllListeners();
      } catch (error: any) {
        this.logRaw(`IRCService: Error removing listeners: ${error?.message || error}`);
      }

      // Try graceful close with end() before destroy()
      // This gives the socket a chance to flush and close cleanly
      try {
        socketRef.end();
      } catch (error: any) {
        // Socket may not support end() or already closed
        this.logRaw(`IRCService: Socket end() error (ignored): ${error?.message || error}`);
      }

      // Use a small delay before destroy to allow graceful shutdown
      // This helps prevent native crashes from abrupt socket termination
      setTimeout(() => {
        try {
          socketRef.destroy();
        } catch (error: any) {
          // Socket may have already been destroyed
          this.logRaw(`IRCService: Socket destroy error (ignored): ${error?.message || error}`);
        }
      }, 100);

      this.socket = null;
      this.isConnected = false;
      this.registered = false;
      this.emitConnection(false);
      this.addRawMessage(t('*** Disconnected from server'), 'connection');
    }
    this.channelUsers.clear();
    this.namesBuffer.clear();
    this.channelUsers.forEach((_, channel) => this.emit('clear-channel', channel));
    this.selfUserModes.clear();
    this.cleanupLabels(); // Clean up pending labeled-response commands
    this.seenMessageIds.clear(); // Clear message ID cache for deduplication
  }

  /**
   * Enable or disable automatic reconnection
   */
  setAutoReconnect(enabled: boolean): void {
    this.autoReconnectEnabled = enabled;
    if (!enabled && this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
      this.reconnectAttempts = 0;
    }
  }

  /**
   * Get current auto-reconnect status
   */
  isAutoReconnectEnabled(): boolean {
    return this.autoReconnectEnabled;
  }

  /**
   * Cancel any pending reconnection attempt
   */
  cancelReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
      this.reconnectAttempts = 0;
      this.addRawMessage(t('*** Auto-reconnect cancelled'), 'connection');
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (!this.autoReconnectEnabled || !this.config) {
      return;
    }

    // Cancel any existing timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    // Calculate delay with exponential backoff: delay = initial * 2^attempts
    // Capped at MAX_RECONNECT_DELAY
    const delay = Math.min(
      this.INITIAL_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts),
      this.MAX_RECONNECT_DELAY
    );

    this.reconnectAttempts++;
    const seconds = Math.round(delay / 1000);
    this.addRawMessage(
      t('*** Reconnecting in {seconds} second{suffix} (attempt {attempt})...', {
        seconds,
        suffix: seconds !== 1 ? 's' : '',
        attempt: this.reconnectAttempts,
      }),
      'connection'
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.addRawMessage(t('*** Attempting to reconnect...'), 'connection');

      // Attempt to reconnect using the saved config
      this.connect(this.config!)
        .then(() => {
          // Reset reconnect counter on successful connection
          this.reconnectAttempts = 0;
          this.addRawMessage(t('*** Reconnected successfully'), 'connection');
        })
        .catch((error: any) => {
          this.addRawMessage(
            t('*** Reconnection failed: {message}', { message: error?.message || error }),
            'connection'
          );
          // Will trigger another reconnect attempt via the error handler
        });
    }, delay);
  }

  joinChannel(channel: string, key?: string): void {
    if (this.isConnected) {
      const channelName = channel.startsWith('#') ? channel : `#${channel}`;
      this.sendRaw(key ? `JOIN ${channelName} ${key}` : `JOIN ${channelName}`);
    }
  }

  requestChannelUsers(channel: string): void {
    if (this.isConnected && channel) this.sendRaw(`NAMES ${channel}`);
  }
  
  /**
   * Parse /server command with mIRC-compatible parameters
   * Supports: -demntsar switches, -l/-lname (SASL login), -i (identity), -jn (join channel), -sar (server management)
   */
  private parseServerCommand(args: string[]): any {
    const result: any = {
      switches: {
        disconnectOnly: false, // -d
        ssl: false, // -e
        newWindow: false, // -m
        newWindowNoConnect: false, // -n
        starttls: false, // -t
      },
      management: {
        sort: false, // -s
        add: false, // -a
        remove: false, // -r
      },
      address: '',
      port: null as number | null,
      password: '',
      login: {
        method: '',
        password: '',
        username: '',
      },
      identity: {
        nick: '',
        altNick: '',
        email: '',
        name: '',
      },
      joinChannels: [] as Array<{ channel: string; password: string }>,
      managementOptions: {
        description: '',
        group: '',
        port: null as number | null,
        password: '',
      },
    };

    let i = 0;
    const len = args.length;

    // Parse switches (-demntsar)
    while (i < len && args[i].startsWith('-')) {
      const switchStr = args[i].substring(1);
      for (const char of switchStr) {
        switch (char) {
          case 'd': result.switches.disconnectOnly = true; break;
          case 'e': result.switches.ssl = true; break;
          case 'm': result.switches.newWindow = true; break;
          case 'n': result.switches.newWindowNoConnect = true; break;
          case 't': result.switches.starttls = true; break;
          case 's': result.management.sort = true; break;
          case 'a': result.management.add = true; break;
          case 'r': result.management.remove = true; break;
        }
      }
      i++;
    }

    // If management mode (-sar), parse management options
    if (result.management.sort || result.management.add || result.management.remove) {
      while (i < len) {
        if (args[i] === '-d' && i + 1 < len) {
          result.managementOptions.description = args[++i];
        } else if (args[i] === '-p' && i + 1 < len) {
          result.managementOptions.port = parseInt(args[++i], 10) || null;
        } else if (args[i] === '-g' && i + 1 < len) {
          result.managementOptions.group = args[++i];
        } else if (args[i] === '-w' && i + 1 < len) {
          result.managementOptions.password = args[++i];
        } else if (!result.address && !args[i].startsWith('-')) {
          result.address = args[i];
        }
        i++;
      }
      return result;
    }

    // Parse main address/group (can be number for Nth server, group name, or address)
    if (i < len && !args[i].startsWith('-')) {
      result.address = args[i++];
      // Check if it's a number (Nth server)
      const numMatch = result.address.match(/^\d+$/);
      if (numMatch) {
        result.serverIndex = parseInt(result.address, 10);
        result.address = '';
      }
    }

    // Parse port (if next arg is a number and not a switch)
    if (i < len && !args[i].startsWith('-')) {
      const portMatch = args[i].match(/^(\+|\*)?(\d+)$/);
      if (portMatch) {
        result.port = parseInt(portMatch[2], 10);
        if (portMatch[1] === '+') result.switches.ssl = true;
        if (portMatch[1] === '*') result.switches.starttls = true;
        i++;
      }
    }

    // Parse password (if next arg is not a switch)
    if (i < len && !args[i].startsWith('-')) {
      result.password = args[i++];
    }

    // Parse optional parameters
    while (i < len) {
      if (args[i] === '-l' && i + 2 < len) {
        result.login.method = args[++i];
        result.login.password = args[++i];
        i++;
      } else if (args[i] === '-lname' && i + 1 < len) {
        result.login.username = args[++i];
        i++;
      } else if (args[i] === '-i' && i + 1 < len) {
        result.identity.nick = args[++i];
        if (i + 1 < len && !args[i + 1].startsWith('-')) {
          result.identity.altNick = args[++i];
        }
        if (i + 1 < len && !args[i + 1].startsWith('-')) {
          result.identity.email = args[++i];
        }
        if (i + 1 < len && !args[i + 1].startsWith('-')) {
          result.identity.name = args[++i];
        }
        i++;
      } else if ((args[i] === '-jn' || args[i] === '-j') && i + 1 < len) {
        const channelPart = args[++i];
        let password = '';
        if (i + 1 < len && !args[i + 1].startsWith('-') && !args[i + 1].startsWith('#')) {
          password = args[++i];
        }
        const channelMatch = channelPart.match(/^([#&!+][^\s]+)$/);
        if (channelMatch) {
          result.joinChannels.push({
            channel: channelMatch[1],
            password,
          });
        }
        i++;
      } else {
        i++; // Skip unknown parameter
      }
    }

    return result;
  }

  private parseCTCP(message: string): { isCTCP: boolean; command?: string; args?: string } {
    if (!message || !message.startsWith('\x01') || !message.endsWith('\x01')) return { isCTCP: false };
    const content = message.slice(1, -1);
    const spaceIndex = content.indexOf(' ');
    if (spaceIndex === -1) return { isCTCP: true, command: content.toUpperCase() };
    return { isCTCP: true, command: content.substring(0, spaceIndex).toUpperCase(), args: content.substring(spaceIndex + 1) };
  }

  private encodeCTCP(command: string, args?: string): string {
    return `\x01${args ? `${command} ${args}` : command}\x01`;
  }

  private handleCTCPRequest(from: string, target: string, command: string, args?: string): void {
    switch (command) {
      case 'VERSION':
        this.sendCTCPResponse(from, 'VERSION', `AndroidIRCX ${APP_VERSION} React Native :https://github.com/AndroidIRCX`);
        break;
      case 'TIME':
        this.sendCTCPResponse(from, 'TIME', new Date().toISOString());
        break;
      case 'PING':
        this.sendCTCPResponse(from, 'PING', args || Date.now().toString());
        break;
      case 'ACTION':
        // ACTION messages are display-only, don't echo them back
        break;
      case 'DCC':
        // DCC requests (SEND, CHAT, etc.) - emit as message for DCC handlers
        // Reconstruct the CTCP format that dccFileService.parseSendOffer expects
        this.addMessage({
          type: 'ctcp',
          from,
          text: `\x01DCC ${args || ''}\x01`,
          channel: target,
          timestamp: Date.now(),
        });
        break;
      // DCC-related CTCP commands - emit for DCC handlers
      case 'SLOTS':
      case 'XDCC':
      case 'TDCC':
      case 'RDCC':
        // SLOTS: File sharing slot availability (e.g., "SLOTS 5 open")
        // XDCC/TDCC/RDCC: Extended DCC file sharing protocols
        this.addMessage({
          type: 'ctcp',
          from,
          text: `\x01${command} ${args || ''}\x01`,
          channel: target,
          timestamp: Date.now(),
        });
        break;
      // Standard CTCP queries - respond appropriately
      case 'CLIENTINFO':
        this.sendCTCPResponse(from, 'CLIENTINFO', 'ACTION DCC PING TIME VERSION CLIENTINFO USERINFO SOURCE FINGER');
        break;
      case 'USERINFO':
        this.sendCTCPResponse(from, 'USERINFO', this.config?.realname || 'AndroidIRCX User');
        break;
      case 'SOURCE':
        this.sendCTCPResponse(from, 'SOURCE', 'https://github.com/AndroidIRCX');
        break;
      case 'FINGER':
        this.sendCTCPResponse(from, 'FINGER', `${this.currentNick} - AndroidIRCX`);
        break;
      default:
        // For any other CTCP command, emit as message so UI can display it
        this.addMessage({
          type: 'ctcp',
          from,
          text: `\x01${command} ${args || ''}\x01`,
          channel: target,
          timestamp: Date.now(),
        });
        this.logRaw(`CTCP ${command} from ${from}: ${args || '(no args)'}`);
    }
  }

  private sendCTCPResponse(target: string, command: string, args?: string): void {
    if (this.isConnected) this.sendRaw(`NOTICE ${target} :${this.encodeCTCP(command, args)}`);
  }

  sendCTCPRequest(target: string, command: string, args?: string): void {
    if (this.isConnected) this.sendRaw(`PRIVMSG ${target} :${this.encodeCTCP(command, args)}`);
  }

  monitorNick(nick: string): void {
    if (this.isConnected && this.capEnabledSet.has('monitor')) {
      this.sendRaw(`MONITOR + ${nick}`);
      this.monitoredNicks.add(nick);
    }
  }

  unmonitorNick(nick: string): void {
    if (this.isConnected && this.capEnabledSet.has('monitor')) {
      this.sendRaw(`MONITOR - ${nick}`);
      this.monitoredNicks.delete(nick);
    }
  }

  isMonitoring(nick: string): boolean {
    return this.monitoredNicks.has(nick);
  }

  /**
   * Handle multiline message assembly (draft/multiline)
   */
  private handleMultilineMessage(
    from: string,
    target: string,
    text: string,
    concatTag: string | undefined,
    otherTags: {
      timestamp: number;
      account?: string;
      msgid?: string;
      channelContext?: string;
      replyTo?: string;
    }
  ): string | null {
    // If no concat tag, it's a regular single-line message
    if (!concatTag) {
      return text;
    }

    const bufferKey = `${from}:${target}`;

    // Clean up old buffers (timeout)
    const now = Date.now();
    this.multilineBuffers.forEach((buffer, key) => {
      if (now - buffer.timestamp > this.MULTILINE_TIMEOUT) {
        this.multilineBuffers.delete(key);
      }
    });

    // Get or create buffer for this sender/target pair
    let buffer = this.multilineBuffers.get(bufferKey);
    if (!buffer) {
      buffer = { from, parts: [], timestamp: now };
      this.multilineBuffers.set(bufferKey, buffer);
    }

    // Add this part to the buffer
    buffer.parts.push(text);
    buffer.timestamp = now;

    // Check if this is the last part (empty concat tag means last part)
    const isLastPart = concatTag === '';

    if (isLastPart) {
      // Combine all parts with newlines
      const fullMessage = buffer.parts.join('\n');
      this.multilineBuffers.delete(bufferKey);
      return fullMessage;
    }

    // Not the last part, return null to indicate we're still buffering
    return null;
  }

  /**
   * Handle start of BATCH (IRCv3.2)
   */
  private handleBatchStart(refTag: string, type: string, params: string[], timestamp: number): void {
    this.activeBatches.set(refTag, {
      type,
      params,
      messages: [],
      startTime: timestamp,
    });
  }

  /**
   * Handle end of BATCH (IRCv3.2)
   */
  private handleBatchEnd(refTag: string, timestamp: number): void {
    const batch = this.activeBatches.get(refTag);
    if (!batch) {
      return;
    }

    // Process completed batch based on type
    this.processBatch(refTag, batch, timestamp);

    // Remove batch from active batches
    this.activeBatches.delete(refTag);
  }

  /**
   * Process completed batch based on type
   */
  private processBatch(
    refTag: string,
    batch: { type: string; params: string[]; messages: IRCMessage[]; startTime: number },
    timestamp: number
  ): void {
    const { type, params, messages } = batch;

    switch (type) {
      case 'netsplit': {
        // Netsplit: group quit messages
        const serverNames = params.join(' ');
        this.addMessage({
          type: 'raw',
          text: t('*** Netsplit detected: {servers} ({count} users quit)', {
            servers: serverNames,
            count: messages.length,
          }),
          timestamp,
          isRaw: true,
          rawCategory: 'server',
        });
        break;
      }

      case 'netjoin': {
        // Netjoin: group join messages after netsplit recovery
        const serverNames = params.join(' ');
        this.addMessage({
          type: 'raw',
          text: t('*** Netjoin: {servers} ({count} users rejoined)', {
            servers: serverNames,
            count: messages.length,
          }),
          timestamp,
          isRaw: true,
          rawCategory: 'server',
        });
        break;
      }

      case 'chathistory': {
        // Chat history loaded silently - messages are already in the channel
        break;
      }

      case 'cap-notify': {
        // Capability notification batch
        this.addRawMessage(
          t('*** Capability changes ({count} updates)', { count: messages.length }),
          'server'
        );
        break;
      }

      default: {
        // Unknown batch type: log for debugging
        this.addRawMessage(
          t('*** BATCH END: {type} ({ref}) - {count} messages', {
            type,
            ref: refTag,
            count: messages.length,
          }),
          'server'
        );
        break;
      }
    }

    // Emit batch completion event
    this.emit('batch-end', refTag, type, messages);
  }

  /**
   * Associate message with active batch if batch tag is present
   */
  private addMessageToBatch(message: IRCMessage, batchTag?: string): void {
    if (!batchTag) return;

    const batch = this.activeBatches.get(batchTag);
    if (batch) {
      batch.messages.push(message);
    }
  }

  /**
   * Generate unique label for labeled-response (IRCv3.2)
   */
  private generateLabel(): string {
    this.labelCounter++;
    const timestamp = Date.now();
    return `androidircx-${timestamp}-${this.labelCounter}`;
  }

  /**
   * Send command with label for tracking response
   */
  sendRawWithLabel(command: string, callback?: (response: any) => void): string {
    if (!this.capEnabledSet.has('labeled-response')) {
      // Fallback: send without label if capability not enabled
      this.sendRaw(command);
      return '';
    }

    const label = this.generateLabel();
    this.pendingLabels.set(label, {
      command,
      timestamp: Date.now(),
      callback,
    });

    // Set timeout to cleanup stale labels
    setTimeout(() => {
      if (this.pendingLabels.has(label)) {
        this.logRaw(`IRCService: Label timeout for ${label} (command: ${command})`);
        this.pendingLabels.delete(label);
        if (callback) {
          callback({ error: 'timeout', label, command });
        }
      }
    }, this.LABEL_TIMEOUT);

    // Send command with label tag
    this.sendRaw(`@label=${label} ${command}`);
    this.logRaw(`IRCService: Sent labeled command: ${command} (label: ${label})`);
    return label;
  }

  /**
   * Handle response with label tag
   */
  private handleLabeledResponse(label: string, response: any): void {
    const pending = this.pendingLabels.get(label);
    if (!pending) {
      this.logRaw(`IRCService: Received response for unknown label: ${label}`);
      return;
    }

    this.logRaw(`IRCService: Matched labeled response: ${label} (command: ${pending.command})`);

    // Call callback if provided
    if (pending.callback) {
      pending.callback(response);
    }

    // Emit event for labeled response
    this.emit('labeled-response', label, pending.command, response);

    // Remove from pending labels
    this.pendingLabels.delete(label);
  }

  /**
   * Clean up all pending labels (on disconnect)
   */
  private cleanupLabels(): void {
    const count = this.pendingLabels.size;
    if (count > 0) {
      this.logRaw(`IRCService: Cleaning up ${count} pending labels`);
      this.pendingLabels.forEach((pending, label) => {
        if (pending.callback) {
          pending.callback({ error: 'disconnected', label, command: pending.command });
        }
      });
      this.pendingLabels.clear();
    }
  }

  partChannel(channel: string, message?: string): void {
    if (this.isConnected) {
      const partMessage = message && message.trim() ? message : DEFAULT_PART_MESSAGE;
      this.sendRaw(partMessage ? `PART ${channel} :${partMessage}` : `PART ${channel}`);
    }
  }

  setRealname(newRealname: string): void {
    // IRCv3.2 setname capability - change realname without reconnecting
    if (this.isConnected && this.capEnabledSet.has('setname')) {
      this.sendRaw(`SETNAME :${newRealname}`);
    } else if (!this.capEnabledSet.has('setname')) {
      this.addMessage({
        type: 'error',
        text: t('SETNAME command is not supported by this server'),
        timestamp: Date.now(),
      });
    }
  }

  toggleBotMode(enable: boolean): void {
    // IRCv3 bot capability - mark user as a bot with +B mode
    if (this.isConnected && this.capEnabledSet.has('bot')) {
      const mode = enable ? '+B' : '-B';
      this.sendRaw(`MODE ${this.currentNick} ${mode}`);
    } else if (!this.capEnabledSet.has('bot')) {
      this.addMessage({
        type: 'error',
        text: t('BOT mode is not supported by this server'),
        timestamp: Date.now(),
      });
    }
  }

  requestChatHistory(target: string, limit: number = 100, before?: string): void {
    // IRCv3 chathistory capability - request message history
    const hasChatHistory = this.capEnabledSet.has('chathistory') || this.capEnabledSet.has('draft/chathistory');
    if (this.isConnected && hasChatHistory) {
      // CHATHISTORY LATEST <target> <timestamp|msgid|*> <limit>
      const reference = before || '*';
      this.sendRaw(`CHATHISTORY LATEST ${target} ${reference} ${limit}`);
      this.logRaw(`IRCService: Requesting chat history for ${target} (limit: ${limit})`);
    } else if (!hasChatHistory) {
      this.addMessage({
        type: 'error',
        text: t('CHATHISTORY is not supported by this server'),
        timestamp: Date.now(),
      });
    }
  }

  sendReadMarker(target: string, timestamp?: number): void {
    // IRCv3 draft/read-marker capability - mark messages as read
    if (this.isConnected && this.capEnabledSet.has('draft/read-marker')) {
      const ts = timestamp || Date.now();
      // MARKREAD <target> timestamp=<timestamp>
      this.sendRaw(`MARKREAD ${target} timestamp=${ts}`);
      this.logRaw(`IRCService: Sent read marker for ${target} at ${ts}`);
      this.emit('read-marker-sent', target, ts);
    }
  }

  redactMessage(target: string, msgid: string): void {
    // IRCv3 draft/message-redaction capability - delete/redact a message
    if (this.isConnected && this.capEnabledSet.has('draft/message-redaction')) {
      // REDACT <target> <msgid>
      this.sendRaw(`REDACT ${target} ${msgid}`);
      this.logRaw(`IRCService: Sent redaction for message ${msgid} in ${target}`);
      this.emit('message-redacted-sent', target, msgid);
    } else if (!this.capEnabledSet.has('draft/message-redaction')) {
      this.addMessage({
        type: 'error',
        text: t('MESSAGE-REDACTION is not supported by this server'),
        timestamp: Date.now(),
      });
    }
  }

  sendMessageWithTags(target: string, message: string, options?: {
    channelContext?: string;
    replyTo?: string;
    typing?: 'active' | 'paused' | 'done';
  }): void {
    // Send message with client-only tags
    if (this.isConnected) {
      const normalizedMessage = message.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      if (!normalizedMessage.startsWith('/') && normalizedMessage.includes('\n')) {
        this.sendMultilineMessage(target, normalizedMessage);
        return;
      }
      const tags: string[] = [];

      if (options?.channelContext) {
        tags.push(`+draft/channel-context=${options.channelContext}`);
      }
      if (options?.replyTo) {
        tags.push(`+draft/reply=${options.replyTo}`);
      }
      if (options?.typing) {
        tags.push(`+typing=${options.typing}`);
      }

      const tagString = tags.length > 0 ? `@${tags.join(';')} ` : '';
      this.sendRaw(`${tagString}PRIVMSG ${target} :${normalizedMessage}`);

      // Echo message locally
      this.addMessage({
        type: 'message',
        channel: target,
        from: this.currentNick,
        text: normalizedMessage,
        timestamp: Date.now(),
        status: 'sent',
        channelContext: options?.channelContext,
        replyTo: options?.replyTo,
        typing: options?.typing,
      });
    }
  }

  sendReaction(target: string, msgid: string, emoji: string): void {
    // Send reaction using client-only tag
    if (this.isConnected && msgid) {
      this.sendRaw(`@+draft/react=${msgid};${emoji} TAGMSG ${target}`);
      this.logRaw(`IRCService: Sent reaction ${emoji} to message ${msgid} in ${target}`);
      this.emit('reaction-sent', target, msgid, emoji);
    }
  }

  sendMultilineMessage(target: string, message: string): void {
    // Send multiline message using draft/multiline capability
    if (this.isConnected && this.capEnabledSet.has('draft/multiline')) {
      const lines = message.split('\n');

      if (lines.length === 1) {
        // Single line, send normally
        this.sendRaw(`PRIVMSG ${target} :${message}`);
        // Echo the message locally
        this.addMessage({
          type: 'message',
          channel: target,
          from: this.currentNick,
          text: message,
          timestamp: Date.now(),
          status: 'sent',
        });
        return;
      }

      // Send each line with concat tag
      lines.forEach((line, index) => {
        const isLast = index === lines.length - 1;
        const concatTag = isLast ? '' : 'concat'; // Empty string for last part
        this.sendRaw(`@draft/multiline-concat=${concatTag} PRIVMSG ${target} :${line}`);
      });

      // Echo the full message locally
      this.addMessage({
        type: 'message',
        channel: target,
        from: this.currentNick,
        text: message,
        timestamp: Date.now(),
        status: 'sent',
      });
    } else {
      // Fallback: send as multiple separate messages
      const lines = message.split('\n');
      lines.forEach(line => {
        if (line.trim()) {
          this.sendRaw(`PRIVMSG ${target} :${line}`);
        }
      });
      // Echo the full multiline message locally (even in fallback mode)
      this.addMessage({
        type: 'message',
        channel: target,
        from: this.currentNick,
        text: message,
        timestamp: Date.now(),
        status: 'sent',
      });
    }
  }

  sendMessage(target: string, message: string, fromQueue: boolean = false): void {
    if (!this.isConnected && !fromQueue) {
      this.emit('queue-message', this.getNetworkName(), target, message);
      this.addMessage({ type: 'message', channel: target, from: this.currentNick, text: message, timestamp: Date.now(), status: 'pending' });
      return;
    }

    const normalizedMessage = message.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    if (!normalizedMessage.startsWith('/') && normalizedMessage.includes('\n')) {
      this.sendMultilineMessage(target, normalizedMessage);
      return;
    }
    
    if (normalizedMessage.startsWith('/')) {
      const commandText = normalizedMessage.substring(1).trim();
      const parts = commandText.split(' ');
      const command = parts[0].toUpperCase();
      const args = parts.slice(1);
      
      switch (command) {
        case 'JOIN': if (args.length > 0) this.joinChannel(args[0], args[1]); break;
        case 'PART': {
          if (args.length === 0) {
            const isChannelTarget =
              target.startsWith('#') || target.startsWith('&') || target.startsWith('+') || target.startsWith('!');
            if (!isChannelTarget) {
              this.addMessage({ type: 'error', text: t('Usage: /part <channel> [message]'), timestamp: Date.now() });
              break;
            }
          }
          this.partChannel(args.length > 0 ? args[0] : target, args.slice(1).join(' '));
          break;
        }
        case 'NICK': if (args.length > 0) this.sendRaw(`NICK ${args[0]}`); break;
        case 'SETNAME': if (args.length > 0) this.setRealname(args.join(' ')); break;
        case 'BOT': {
          const enable = args.length === 0 || args[0].toLowerCase() !== 'off';
          this.toggleBotMode(enable);
          break;
        }
        case 'QUIT':
          this.emit('intentional-quit', this.getNetworkName());
          this.sendRaw(`QUIT :${args.join(' ') || DEFAULT_QUIT_MESSAGE}`);
          break;
        case 'WHOIS': if (args.length > 0) this.sendCommand(`WHOIS ${args.join(' ')}`); break;
        case 'WHOWAS':
          if (args.length > 0) {
            const targetNick = args[0];
            this.lastWhowasTarget = targetNick || null;
            this.lastWhowasAt = Date.now();
            if (args.length === 1 && /[\[\]]/.test(targetNick)) {
              this.sendCommand(`WHOWAS :${targetNick}`);
            } else {
              this.sendCommand(`WHOWAS ${args.join(' ')}`);
            }
          }
          break;
        case 'MSG': case 'QUERY':
          if (args.length >= 2) {
            const msgTarget = args[0];
            const msgText = args.slice(1).join(' ');
            this.sendRaw(`PRIVMSG ${msgTarget} :${msgText}`);
            this.addMessage({ type: 'message', channel: msgTarget, from: this.currentNick, text: msgText, timestamp: Date.now(), status: 'sent' });
          } else {
            this.addMessage({ type: 'error', text: t('Usage: /{command} <nick|channel> <message>', { command }), timestamp: Date.now() });
          }
          break;
        case 'ME': case 'ACTION':
          if (args.length > 0) {
            const actionText = args.join(' ');
            this.sendRaw(`PRIVMSG ${target} :${this.encodeCTCP('ACTION', actionText)}`);
            this.addMessage({ type: 'message', channel: target, from: this.currentNick, text: `\x01ACTION ${actionText}\x01`, timestamp: Date.now(), status: 'sent' });
          }
          break;
        case 'MODE': if (args.length > 0) this.sendCommand(`MODE ${args.join(' ')}`); break;
        case 'TOPIC':
          const topicChannel = (target.startsWith('#') || target.startsWith('&')) ? target : args[0];
          const topicText = args.length > 1 ? args.slice(1).join(' ') : (args.length === 1 && !target.startsWith('#') ? args[0] : '');
          this.sendCommand(topicText ? `TOPIC ${topicChannel} :${topicText}` : `TOPIC ${topicChannel}`);
          break;
        case 'KICK':
          if (args.length >= 1) {
            const kickChannel = (target.startsWith('#') || target.startsWith('&')) ? target : args[0];
            const kickUser = args.length > 1 ? args[1] : args[0];
            const kickReason = args.slice(2).join(' ');
            this.sendCommand(`KICK ${kickChannel} ${kickUser}${kickReason ? ` :${kickReason}` : ''}`);
          }
          break;
        case 'SHAREKEY': case 'SENDKEY':
          if (args.length > 0) {
            const keyTarget = args[0];
            encryptedDMService.exportBundle().then(bundle => {
              this.sendRaw(`PRIVMSG ${keyTarget} :!enc-offer ${JSON.stringify(bundle)}`);
              this.addMessage({ type: 'notice', text: t('*** Encryption key offer sent to {nick}. Waiting for acceptance...', { nick: keyTarget }), timestamp: Date.now() });
            }).catch(e => {
              this.addMessage({ type: 'error', text: t('*** Failed to share encryption key: {message}', { message: e.message }), timestamp: Date.now() });
            });
          } else {
            this.addMessage({ type: 'error', text: t('Usage: /sharekey <nick>'), timestamp: Date.now() });
          }
          break;
        case 'REQUESTKEY':
          if (args.length > 0) {
            const reqTarget = args[0];
            this.sendRaw(`PRIVMSG ${reqTarget} :!enc-req`);
            this.addMessage({ type: 'notice', text: t('*** Encryption key requested from {nick}', { nick: reqTarget }), timestamp: Date.now() });
          } else {
            this.addMessage({ type: 'error', text: t('Usage: /requestkey <nick>'), timestamp: Date.now() });
          }
          break;
        case 'ENCMSG':
          if (args.length >= 2) {
            const encTarget = args[0];
            const encPlaintext = args.slice(1).join(' ');
            const network = this.getNetworkName();
            encryptedDMService.encryptForNetwork(encPlaintext, network, encTarget).then(payload => {
              this.sendRaw(`PRIVMSG ${encTarget} :!enc-msg ${JSON.stringify(payload)}`);
              this.addMessage({ type: 'message', channel: encTarget, from: this.currentNick, text: t('🔒 {message}', { message: encPlaintext }), timestamp: Date.now(), status: 'sent' });
            }).catch(e => {
              this.addMessage({ type: 'error', text: t('*** Encrypted send failed ({message}). Use "Request Encryption Key" from the user menu.', { message: e.message }), timestamp: Date.now() });
            });
          } else {
            this.addMessage({ type: 'error', text: t('Usage: /encmsg <nick> <message>'), timestamp: Date.now() });
          }
          break;
        case 'ENC':
        case 'ENCRYPT':
          this.addMessage({ type: 'notice', text: t('DM encryption:'), timestamp: Date.now() });
          this.addMessage({ type: 'notice', text: t('/sharekey <nick>          Offer your DM key'), timestamp: Date.now() });
          this.addMessage({ type: 'notice', text: t('/requestkey <nick>        Request DM key'), timestamp: Date.now() });
          this.addMessage({ type: 'notice', text: t('/encmsg <nick> <message>  Send encrypted DM'), timestamp: Date.now() });
          this.addMessage({ type: 'notice', text: t('Tips: keys must be exchanged first; use /requestkey if not paired.'), timestamp: Date.now() });
          break;
        case 'CHANKEY':
          if (args.length === 0) {
            this.addMessage({ type: 'error', text: t('Usage: /chankey <generate|share|request|remove|send|help> [args]'), timestamp: Date.now() });
            break;
          }
          const chankeyAction = args[0].toLowerCase();
          switch (chankeyAction) {
            case 'help':
              this.addMessage({ type: 'notice', text: t('Channel encryption:'), timestamp: Date.now() });
              this.addMessage({ type: 'notice', text: t('/chankey generate          Create key for current channel'), timestamp: Date.now() });
              this.addMessage({ type: 'notice', text: t('/chankey share <nick>     Send key to a user (in channel)'), timestamp: Date.now() });
              this.addMessage({ type: 'notice', text: t('/chankey request <nick>   Ask a user for the channel key'), timestamp: Date.now() });
              this.addMessage({ type: 'notice', text: t('/chankey send <msg>       Send encrypted message to channel'), timestamp: Date.now() });
              this.addMessage({ type: 'notice', text: t('/chankey remove           Delete stored key for channel'), timestamp: Date.now() });
              break;
            case 'generate':
              if (!target.startsWith('#') && !target.startsWith('&')) {
                this.addMessage({ type: 'error', text: t('*** Channel key can only be generated in a channel'), timestamp: Date.now() });
                break;
              }
              channelEncryptionService.generateChannelKey(target, this.getNetworkName()).then(() => {
                this.addMessage({ type: 'notice', text: t('*** Channel encryption key generated for {channel}. Use /chankey share <nick> to share with others.', { channel: target }), timestamp: Date.now() });
              }).catch(e => {
                this.addMessage({ type: 'error', text: t('*** Failed to generate channel key: {message}', { message: e.message }), timestamp: Date.now() });
              });
              break;
            case 'send':
              if (args.length < 2) {
                this.addMessage({ type: 'error', text: t('Usage: /chankey send <message>'), timestamp: Date.now() });
                break;
              }
              if (!target.startsWith('#') && !target.startsWith('&')) {
                this.addMessage({ type: 'error', text: t('*** Channel key send must be used from a channel'), timestamp: Date.now() });
                break;
              }
              const encText = args.slice(1).join(' ');
              channelEncryptionService
                .encryptMessage(encText, target, this.getNetworkName())
                .then(payload => {
                  this.sendRaw(`PRIVMSG ${target} :!chanenc-msg ${JSON.stringify(payload)}`);
                  this.addMessage({
                    type: 'message',
                    channel: target,
                    from: this.currentNick,
                    text: t('🔒 {message}', { message: encText }),
                    timestamp: Date.now(),
                    status: 'sent',
                  });
                })
                .catch(e => {
                  this.addMessage({
                    type: 'error',
                    text: t('*** Channel encryption send failed: {message}', {
                      message: e.message === 'no channel key'
                        ? t('Missing channel key. Use /chankey generate and share first.')
                        : e.message,
                    }),
                    timestamp: Date.now(),
                  });
                });
              break;
            case 'share':
              if (args.length < 2) {
                this.addMessage({ type: 'error', text: t('Usage: /chankey share <nick>'), timestamp: Date.now() });
                break;
              }
              if (!target.startsWith('#') && !target.startsWith('&')) {
                this.addMessage({ type: 'error', text: t('*** Channel key can only be shared from a channel'), timestamp: Date.now() });
                break;
              }
              const shareTarget = args[1];
              channelEncryptionService.exportChannelKey(target, this.getNetworkName()).then(keyData => {
                this.sendRaw(`PRIVMSG ${shareTarget} :!chanenc-key ${keyData}`);
                this.addMessage({ type: 'notice', text: t('*** Channel key for {channel} shared with {nick}', { channel: target, nick: shareTarget }), timestamp: Date.now() });
              }).catch(e => {
                this.addMessage({ type: 'error', text: t('*** Failed to share channel key: {message}. Generate a key first with /chankey generate', { message: e.message }), timestamp: Date.now() });
              });
              break;
            case 'request':
              if (args.length < 2) {
                this.addMessage({ type: 'error', text: t('Usage: /chankey request <nick>'), timestamp: Date.now() });
                break;
              }
              if (!target.startsWith('#') && !target.startsWith('&')) {
                this.addMessage({ type: 'error', text: t('*** Channel key request must be done from a channel'), timestamp: Date.now() });
                break;
              }
              const requestTarget = args[1];
              this.sendRaw(`PRIVMSG ${requestTarget} :${t('Please share the channel key for {channel} with /chankey share {nick}', { channel: target, nick: this.currentNick })}`);
              this.addMessage({ type: 'notice', text: t('*** Channel key requested from {nick} for {channel}', { nick: requestTarget, channel: target }), timestamp: Date.now() });
              break;
            case 'remove':
              if (!target.startsWith('#') && !target.startsWith('&')) {
                this.addMessage({ type: 'error', text: t('*** Channel key can only be removed from a channel'), timestamp: Date.now() });
                break;
              }
              channelEncryptionService.removeChannelKey(target, this.getNetworkName()).then(() => {
                this.addMessage({ type: 'notice', text: t('*** Channel encryption key removed for {channel}', { channel: target }), timestamp: Date.now() });
              }).catch(e => {
                this.addMessage({ type: 'error', text: t('*** Failed to remove channel key: {message}', { message: e.message }), timestamp: Date.now() });
              });
              break;
            default:
              this.addMessage({ type: 'error', text: t('Usage: /chankey <generate|share|request|remove|send|help> [args]'), timestamp: Date.now() });
          }
          break;
        case 'AWAY':
          // /away [message] - Set away message (empty message removes away status)
          const awayMessage = args.join(' ');
          if (awayMessage) {
            this.sendRaw(`AWAY :${awayMessage}`);
            this.addMessage({ type: 'notice', text: t('*** You are now away: {message}', { message: awayMessage }), timestamp: Date.now() });
          } else {
            this.sendRaw('AWAY');
            this.addMessage({ type: 'notice', text: t('*** You are no longer away'), timestamp: Date.now() });
          }
          break;
        case 'BACK':
          // /back - Remove away status (alias for /away)
          this.sendRaw('AWAY');
          this.addMessage({ type: 'notice', text: t('*** You are no longer away'), timestamp: Date.now() });
          break;
        case 'INVITE':
          // /invite <nick> [channel] - Invite user to channel
          if (args.length >= 1) {
            const inviteNick = args[0];
            const inviteChannel = args.length > 1 ? args[1] : (target.startsWith('#') || target.startsWith('&') ? target : '');
            if (inviteChannel) {
              this.sendCommand(`INVITE ${inviteNick} ${inviteChannel}`);
              this.addMessage({ type: 'notice', text: t('*** Invited {nick} to {channel}', { nick: inviteNick, channel: inviteChannel }), timestamp: Date.now() });
            } else {
              this.addMessage({ type: 'error', text: t('Usage: /invite <nick> [channel]'), timestamp: Date.now() });
            }
          } else {
            this.addMessage({ type: 'error', text: t('Usage: /invite <nick> [channel]'), timestamp: Date.now() });
          }
          break;
        case 'LIST':
          // /list [options] - List channels on server
          const listArgs = args.length > 0 ? args.join(' ') : '';
          this.sendCommand(listArgs ? `LIST ${listArgs}` : 'LIST');
          this.addMessage({ type: 'notice', text: t('*** Requesting channel list...'), timestamp: Date.now() });
          break;
        case 'NAMES':
          // /names [channel] - List users in channel
          const namesChannel = args.length > 0 ? args[0] : (target.startsWith('#') || target.startsWith('&') ? target : '');
          if (namesChannel) {
            this.sendCommand(`NAMES ${namesChannel}`);
          } else {
            this.addMessage({ type: 'error', text: t('Usage: /names [channel]'), timestamp: Date.now() });
          }
          break;
        case 'WHO':
          // /who [mask] - Query user information
          const whoMask = args.length > 0 ? args.join(' ') : '';
          this.sendCommand(whoMask ? `WHO ${whoMask}` : 'WHO');
          break;
        case 'BAN':
          // /ban <nick> [channel] - Ban user from channel
          if (args.length >= 1) {
            const banNick = args[0];
            const banChannel = args.length > 1 ? args[1] : (target.startsWith('#') || target.startsWith('&') ? target : '');
            if (banChannel) {
              // Try to get user's hostmask for ban, or use nick
              this.sendCommand(`MODE ${banChannel} +b ${banNick}!*@*`);
              this.addMessage({ type: 'notice', text: t('*** Banning {nick} from {channel}', { nick: banNick, channel: banChannel }), timestamp: Date.now() });
            } else {
              this.addMessage({ type: 'error', text: t('Usage: /ban <nick> [channel]'), timestamp: Date.now() });
            }
          } else {
            this.addMessage({ type: 'error', text: t('Usage: /ban <nick> [channel]'), timestamp: Date.now() });
          }
          break;
        case 'UNBAN':
          // /unban <nick|mask> [channel] - Unban user from channel
          if (args.length >= 1) {
            const unbanMask = args[0];
            const unbanChannel = args.length > 1 ? args[1] : (target.startsWith('#') || target.startsWith('&') ? target : '');
            if (unbanChannel) {
              this.sendCommand(`MODE ${unbanChannel} -b ${unbanMask}`);
              this.addMessage({ type: 'notice', text: t('*** Unbanning {mask} from {channel}', { mask: unbanMask, channel: unbanChannel }), timestamp: Date.now() });
            } else {
              this.addMessage({ type: 'error', text: t('Usage: /unban <nick|mask> [channel]'), timestamp: Date.now() });
            }
          } else {
            this.addMessage({ type: 'error', text: t('Usage: /unban <nick|mask> [channel]'), timestamp: Date.now() });
          }
          break;
        case 'KICKBAN':
          // /kickban <nick> [channel] [reason] - Kick and ban user
          if (args.length >= 1) {
            const kbNick = args[0];
            const kbChannel = args.length > 1 && (args[1].startsWith('#') || args[1].startsWith('&')) ? args[1] : (target.startsWith('#') || target.startsWith('&') ? target : args[1] || '');
            const kbReason = args.length > 2 ? args.slice(2).join(' ') : (args.length === 2 && !kbChannel.startsWith('#') && !kbChannel.startsWith('&') ? args[1] : '');
            if (kbChannel && (kbChannel.startsWith('#') || kbChannel.startsWith('&'))) {
              // Ban first, then kick
              this.sendCommand(`MODE ${kbChannel} +b ${kbNick}!*@*`);
              this.sendCommand(`KICK ${kbChannel} ${kbNick}${kbReason ? ` :${kbReason}` : ''}`);
              this.addMessage({ type: 'notice', text: t('*** Kicking and banning {nick} from {channel}', { nick: kbNick, channel: kbChannel }), timestamp: Date.now() });
            } else {
              this.addMessage({ type: 'error', text: t('Usage: /kickban <nick> [channel] [reason]'), timestamp: Date.now() });
            }
          } else {
            this.addMessage({ type: 'error', text: t('Usage: /kickban <nick> [channel] [reason]'), timestamp: Date.now() });
          }
          break;
        case 'NOTICE':
          // /notice <target> <message> - Send notice message
          if (args.length >= 2) {
            const noticeTarget = args[0];
            const noticeText = args.slice(1).join(' ');
            this.sendRaw(`NOTICE ${noticeTarget} :${noticeText}`);
            this.addMessage({ type: 'notice', channel: noticeTarget, from: this.currentNick, text: noticeText, timestamp: Date.now(), status: 'sent' });
          } else {
            this.addMessage({ type: 'error', text: t('Usage: /notice <target> <message>'), timestamp: Date.now() });
          }
          break;
        case 'IGNORE':
          // /ignore <nick|mask> [reason] - Ignore user messages
          if (args.length >= 1) {
            const ignoreMask = args[0];
            const ignoreReason = args.length > 1 ? args.slice(1).join(' ') : undefined;
            const network = this.getNetworkName();
            this.getUserManagementService().ignoreUser(ignoreMask, ignoreReason, network).then(() => {
              this.addMessage({ type: 'notice', text: t('*** Now ignoring {mask}', { mask: ignoreMask }), timestamp: Date.now() });
            }).catch((e: Error) => {
              this.addMessage({ type: 'error', text: t('*** Failed to ignore user: {message}', { message: e.message }), timestamp: Date.now() });
            });
          } else {
            this.addMessage({ type: 'error', text: t('Usage: /ignore <nick|mask> [reason]'), timestamp: Date.now() });
          }
          break;
        case 'UNIGNORE':
          // /unignore <nick|mask> - Stop ignoring user
          if (args.length >= 1) {
            const unignoreMask = args[0];
            const network = this.getNetworkName();
            this.getUserManagementService().unignoreUser(unignoreMask, network).then(() => {
              this.addMessage({ type: 'notice', text: t('*** No longer ignoring {mask}', { mask: unignoreMask }), timestamp: Date.now() });
            }).catch((e: Error) => {
              this.addMessage({ type: 'error', text: t('*** Failed to unignore user: {message}', { message: e.message }), timestamp: Date.now() });
            });
          } else {
            this.addMessage({ type: 'error', text: t('Usage: /unignore <nick|mask>'), timestamp: Date.now() });
          }
          break;
        case 'CLEAR':
          // /clear - Clear current tab messages
          this.emit('clear-tab', target, this.getNetworkName());
          this.addMessage({ type: 'notice', text: t('*** Messages cleared'), timestamp: Date.now() });
          break;
        case 'CLOSE':
          // /close - Close current tab
          this.emit('close-tab', target, this.getNetworkName());
          break;
        case 'ECHO':
          // /echo <message> - Display local message (useful for scripts/aliases)
          if (args.length > 0) {
            const echoText = args.join(' ');
            this.addMessage({ type: 'notice', text: echoText, timestamp: Date.now() });
          } else {
            this.addMessage({ type: 'error', text: t('Usage: /echo <message>'), timestamp: Date.now() });
          }
          break;
        case 'AMSG':
          // /amsg <message> - Send message to all open channels
          if (args.length > 0) {
            const amsgText = args.join(' ');
            this.emit('amsg', amsgText, this.getNetworkName());
            this.addMessage({ type: 'notice', text: t('*** Sending message to all channels...'), timestamp: Date.now() });
          } else {
            this.addMessage({ type: 'error', text: t('Usage: /amsg <message>'), timestamp: Date.now() });
          }
          break;
        case 'AME':
          // /ame <action> - Send action to all open channels
          if (args.length > 0) {
            const ameText = args.join(' ');
            this.emit('ame', ameText, this.getNetworkName());
            this.addMessage({ type: 'notice', text: t('*** Sending action to all channels...'), timestamp: Date.now() });
          } else {
            this.addMessage({ type: 'error', text: t('Usage: /ame <action>'), timestamp: Date.now() });
          }
          break;
        case 'ANOTICE':
          // /anotice <message> - Send notice to all open channels
          if (args.length > 0) {
            const anoticeText = args.join(' ');
            this.emit('anotice', anoticeText, this.getNetworkName());
            this.addMessage({ type: 'notice', text: t('*** Sending notice to all channels...'), timestamp: Date.now() });
          } else {
            this.addMessage({ type: 'error', text: t('Usage: /anotice <message>'), timestamp: Date.now() });
          }
          break;
        case 'LUSERS':
          // /lusers - Get user statistics
          this.sendCommand('LUSERS');
          break;
        case 'VERSION':
          // /version [server] - Get server version
          const versionTarget = args.length > 0 ? args[0] : '';
          this.sendCommand(versionTarget ? `VERSION ${versionTarget}` : 'VERSION');
          break;
        case 'TIME':
          // /time [server] - Get server time
          const timeTarget = args.length > 0 ? args[0] : '';
          this.sendCommand(timeTarget ? `TIME ${timeTarget}` : 'TIME');
          break;
        case 'CLONES':
        case 'DETECTCLONES':
        case 'CLONESDETECT':
          // /clones [channel] - Detect clones (users with same host) in channel
          // /detectclones [channel] - Alias
          // /clonesdetect [channel] - Alias
          {
            const targetChannel = args.length > 0 ? args[0] : target;
            if (!targetChannel || (!targetChannel.startsWith('#') && !targetChannel.startsWith('&'))) {
              this.addMessage({
                type: 'error',
                text: t('Usage: /clones <channel> - Must be used in a channel or specify a channel'),
                timestamp: Date.now(),
              });
            } else {
              this.detectClones(targetChannel).then(clones => {
                if (clones.size === 0) {
                  this.addMessage({
                    type: 'notice',
                    text: t('*** No clones detected in {channel}', { channel: targetChannel }),
                    timestamp: Date.now(),
                  });
                } else {
                  this.addMessage({
                    type: 'notice',
                    text: t('*** Clones detected in {channel}:', { channel: targetChannel }),
                    timestamp: Date.now(),
                  });
                  clones.forEach((nicks, host) => {
                    this.addMessage({
                      type: 'notice',
                      text: t('***   {host}: {nicks}', { host, nicks: nicks.join(', ') }),
                      timestamp: Date.now(),
                    });
                  });
                }
              }).catch(error => {
                this.addMessage({
                  type: 'error',
                  text: t('*** Error detecting clones: {error}', { error: error?.message || String(error) }),
                  timestamp: Date.now(),
                });
              });
            }
          }
          break;
        case 'ADMIN':
          // /admin [server] - Get server administrator info
          const adminTarget = args.length > 0 ? args[0] : '';
          this.sendCommand(adminTarget ? `ADMIN ${adminTarget}` : 'ADMIN');
          break;
        case 'LINKS':
          // /links [mask] - List server links
          const linksMask = args.length > 0 ? args.join(' ') : '';
          this.sendCommand(linksMask ? `LINKS ${linksMask}` : 'LINKS');
          break;
        case 'STATS':
          // /stats [query] [server] - Get server statistics
          const statsQuery = args.length > 0 ? args[0] : '';
          const statsServer = args.length > 1 ? args[1] : '';
          if (statsQuery && statsServer) {
            this.sendCommand(`STATS ${statsQuery} ${statsServer}`);
          } else if (statsQuery) {
            this.sendCommand(`STATS ${statsQuery}`);
          } else {
            this.sendCommand('STATS');
          }
          break;
        case 'ISON':
          // /ison <nick1> [nick2] ... - Check if nicks are online
          if (args.length > 0) {
            this.sendCommand(`ISON ${args.join(' ')}`);
          } else {
            this.addMessage({ type: 'error', text: t('Usage: /ison <nick1> [nick2] ...'), timestamp: Date.now() });
          }
          break;
        case 'MOTD':
          // /motd - Get message of the day
          const motdTarget = args.length > 0 ? args[0] : '';
          this.sendCommand(motdTarget ? `MOTD ${motdTarget}` : 'MOTD');
          break;
        case 'PING':
          // /ping [server] - Ping server (explicit command)
          const pingTarget = args.length > 0 ? args[0] : '';
          this.sendCommand(pingTarget ? `PING ${pingTarget}` : 'PING');
          break;
        case 'TRACE':
          // /trace [target] - Trace route to server
          const traceTarget = args.length > 0 ? args[0] : '';
          this.sendCommand(traceTarget ? `TRACE ${traceTarget}` : 'TRACE');
          break;
        case 'SQUERY':
          // /squery <service> <message> - Query IRC services
          if (args.length >= 2) {
            const service = args[0];
            const serviceMessage = args.slice(1).join(' ');
            this.sendRaw(`PRIVMSG ${service} :${serviceMessage}`);
            this.addMessage({ type: 'notice', channel: service, from: this.currentNick, text: serviceMessage, timestamp: Date.now(), status: 'sent' });
          } else {
            this.addMessage({ type: 'error', text: t('Usage: /squery <service> <message>'), timestamp: Date.now() });
          }
          break;
        case 'RECONNECT':
          // /reconnect - Reconnect to current server
          this.emit('reconnect', this.getNetworkName());
          this.addMessage({ type: 'notice', text: t('*** Reconnecting to server...'), timestamp: Date.now() });
          break;
        case 'SERVER': {
          // /server [-m] [-e] [-t] <address> [port] [password] [-l method pass] [-lname name] [-i nick anick email name] [-jn #channel pass] [-sar]
          try {
            const serverArgs = this.parseServerCommand(args);
            this.emit('server-command', serverArgs);
          } catch (error: any) {
            this.addMessage({ 
              type: 'error', 
              text: error.message || t('Invalid /server command syntax'), 
              timestamp: Date.now() 
            });
          }
          break;
        }
        case 'DISCONNECT':
          // /disconnect - Disconnect from server (alias for /quit)
          this.emit('intentional-quit', this.getNetworkName());
          this.sendRaw(`QUIT :${args.join(' ') || DEFAULT_QUIT_MESSAGE}`);
          break;
        case 'ANICK':
          // /anick <nickname> - Set alternate nickname
          if (args.length > 0) {
            // Store alternate nick (could be saved to settings)
            this.addMessage({ type: 'notice', text: t('*** Alternate nickname set to: {nick}', { nick: args[0] }), timestamp: Date.now() });
            // Note: Actual alternate nick handling would be in connection logic
          } else {
            this.addMessage({ type: 'error', text: t('Usage: /anick <nickname>'), timestamp: Date.now() });
          }
          break;
        case 'AJINVITE':
          // /ajinvite [on|off] - Auto-join on invite toggle
          const ajinviteState = args.length > 0 ? args[0].toLowerCase() : 'toggle';
          this.emit('ajinvite-toggle', { state: ajinviteState, network: this.getNetworkName() });
          const isOn = ajinviteState === 'on' || (ajinviteState === 'toggle' && true); // Would check actual state
          this.addMessage({ type: 'notice', text: t('*** Auto-join on invite: {state}', { state: isOn ? 'ON' : 'OFF' }), timestamp: Date.now() });
          break;
        case 'BEEP':
          // /beep [number] [delay] - Play beep sound
          const beepCount = args.length > 0 ? parseInt(args[0], 10) || 1 : 1;
          const beepDelay = args.length > 1 ? parseInt(args[1], 10) || 0 : 0;
          this.emit('beep', { count: beepCount, delay: beepDelay });
          this.addMessage({ type: 'notice', text: t('*** Beep!'), timestamp: Date.now() });
          break;
        case 'CNOTICE':
          // /cnotice <nick> <channel> <message> - Channel notice (bypass flood limits)
          if (args.length >= 3) {
            const cnoticeNick = args[0];
            const cnoticeChannel = args[1];
            const cnoticeMessage = args.slice(2).join(' ');
            this.sendRaw(`CNOTICE ${cnoticeNick} ${cnoticeChannel} :${cnoticeMessage}`);
            this.addMessage({ type: 'notice', channel: cnoticeChannel, from: this.currentNick, text: `-> ${cnoticeNick}: ${cnoticeMessage}`, timestamp: Date.now(), status: 'sent' });
          } else {
            this.addMessage({ type: 'error', text: t('Usage: /cnotice <nick> <channel> <message>'), timestamp: Date.now() });
          }
          break;
        case 'CPRIVMSG':
          // /cprivmsg <nick> <channel> <message> - Channel privmsg (bypass flood limits)
          if (args.length >= 3) {
            const cprivmsgNick = args[0];
            const cprivmsgChannel = args[1];
            const cprivmsgMessage = args.slice(2).join(' ');
            this.sendRaw(`CPRIVMSG ${cprivmsgNick} ${cprivmsgChannel} :${cprivmsgMessage}`);
            this.addMessage({ type: 'message', channel: cprivmsgChannel, from: this.currentNick, text: `-> ${cprivmsgNick}: ${cprivmsgMessage}`, timestamp: Date.now(), status: 'sent' });
          } else {
            this.addMessage({ type: 'error', text: t('Usage: /cprivmsg <nick> <channel> <message>'), timestamp: Date.now() });
          }
          break;
        case 'HELP':
          // /help [command] - Show help for command
          if (args.length > 0) {
            const helpCommand = args[0].toLowerCase();
            this.emit('help', helpCommand);
            this.addMessage({ type: 'notice', text: t('*** Help for /{command} - Use Settings > Help for full documentation', { command: helpCommand }), timestamp: Date.now() });
          } else {
            this.addMessage({ type: 'notice', text: t('*** IRC Commands Help'), timestamp: Date.now() });
            this.addMessage({ type: 'notice', text: t('*** Use /help <command> for specific command help'), timestamp: Date.now() });
            this.addMessage({ type: 'notice', text: t('*** Or go to Settings > Help for full documentation'), timestamp: Date.now() });
          }
          break;
        case 'RAW':
          // /raw <command> - Send raw IRC command (alias for /quote)
          if (args.length > 0) {
            const rawCommand = args.join(' ');
            this.sendRaw(rawCommand);
          } else {
            this.addMessage({ type: 'error', text: t('Usage: /raw <command>'), timestamp: Date.now() });
          }
          break;
        case 'DNS':
          // /dns <hostname> - DNS lookup
          if (args.length > 0) {
            const hostname = args[0];
            this.emit('dns-lookup', hostname);
            this.addMessage({ type: 'notice', text: t('*** Looking up DNS for {hostname}...', { hostname }), timestamp: Date.now() });
          } else {
            this.addMessage({ type: 'error', text: t('Usage: /dns <hostname>'), timestamp: Date.now() });
          }
          break;
        case 'TIMER':
          // /timer <name> <delay> <repetitions> <command> - Execute command after delay
          if (args.length >= 4) {
            const timerName = args[0];
            const timerDelay = parseInt(args[1], 10);
            const timerRepetitions = parseInt(args[2], 10);
            const timerCommand = args.slice(3).join(' ');
            if (!isNaN(timerDelay) && !isNaN(timerRepetitions) && timerDelay > 0) {
              this.emit('timer', { name: timerName, delay: timerDelay, repetitions: timerRepetitions, command: timerCommand });
              this.addMessage({ type: 'notice', text: t('*** Timer "{name}" set: {delay}ms, {repetitions} repetitions', { name: timerName, delay: timerDelay, repetitions: timerRepetitions }), timestamp: Date.now() });
            } else {
              this.addMessage({ type: 'error', text: t('Usage: /timer <name> <delay> <repetitions> <command>'), timestamp: Date.now() });
            }
          } else {
            this.addMessage({ type: 'error', text: t('Usage: /timer <name> <delay> <repetitions> <command>'), timestamp: Date.now() });
          }
          break;
        case 'WINDOW':
          // /window [-a] <name> - Window/tab management commands
          if (args.length > 0) {
            const windowAction = args[0];
            if (windowAction === '-a') {
              // Activate window
              const windowName = args.length > 1 ? args[1] : '';
              if (windowName) {
                this.emit('window-activate', windowName);
              } else {
                this.addMessage({ type: 'error', text: t('Usage: /window -a <name>'), timestamp: Date.now() });
              }
            } else {
              // Open/create window
              this.emit('window-open', windowAction);
            }
          } else {
            this.addMessage({ type: 'error', text: t('Usage: /window [-a] <name>'), timestamp: Date.now() });
          }
          break;
        case 'FILTER':
          // /filter [-g] <text> - Filter messages
          if (args.length > 0) {
            const filterGlobal = args[0] === '-g';
            const filterText = filterGlobal ? args.slice(1).join(' ') : args.join(' ');
            if (filterText) {
              this.emit('filter', { text: filterText, global: filterGlobal, network: this.getNetworkName() });
              this.addMessage({ type: 'notice', text: t('*** Filtering messages containing: {text}', { text: filterText }), timestamp: Date.now() });
            } else {
              this.addMessage({ type: 'error', text: t('Usage: /filter [-g] <text>'), timestamp: Date.now() });
            }
          } else {
            this.addMessage({ type: 'error', text: t('Usage: /filter [-g] <text>'), timestamp: Date.now() });
          }
          break;
        case 'WALLOPS':
          // /wallops <message> - Send wallops message (IRCop)
          if (args.length > 0) {
            const wallopsMessage = args.join(' ');
            this.sendCommand(`WALLOPS :${wallopsMessage}`);
          } else {
            this.addMessage({ type: 'error', text: t('Usage: /wallops <message>'), timestamp: Date.now() });
          }
          break;
        case 'LOCOPS':
          // /locops <message> - Send local ops message (IRCop)
          if (args.length > 0) {
            const locopsMessage = args.join(' ');
            this.sendCommand(`LOCOPS :${locopsMessage}`);
          } else {
            this.addMessage({ type: 'error', text: t('Usage: /locops <message>'), timestamp: Date.now() });
          }
          break;
        case 'GLOBOPS':
          // /globops <message> - Send global ops message (IRCop)
          if (args.length > 0) {
            const globopsMessage = args.join(' ');
            this.sendCommand(`GLOBOPS :${globopsMessage}`);
          } else {
            this.addMessage({ type: 'error', text: t('Usage: /globops <message>'), timestamp: Date.now() });
          }
          break;
        case 'ADCHAT':
          // /adchat <message> - Admin chat (IRCop)
          if (args.length > 0) {
            const adchatMessage = args.join(' ');
            this.sendCommand(`ADCHAT :${adchatMessage}`);
          } else {
            this.addMessage({ type: 'error', text: t('Usage: /adchat <message>'), timestamp: Date.now() });
          }
          break;
        case 'CHAT':
          // /chat <service> <message> - Chat with services
          if (args.length >= 2) {
            const chatService = args[0];
            const chatMessage = args.slice(1).join(' ');
            this.sendRaw(`PRIVMSG ${chatService} :${chatMessage}`);
            this.addMessage({ type: 'notice', channel: chatService, from: this.currentNick, text: chatMessage, timestamp: Date.now(), status: 'sent' });
          } else {
            this.addMessage({ type: 'error', text: t('Usage: /chat <service> <message>'), timestamp: Date.now() });
          }
          break;
        case 'INFO':
          // /info [server] - Get server information
          const infoTarget = args.length > 0 ? args[0] : '';
          this.sendCommand(infoTarget ? `INFO ${infoTarget}` : 'INFO');
          break;
        case 'KNOCK':
          // /knock <channel> [message] - Request invite to invitation-only channel
          if (args.length >= 1) {
            const knockChannel = args[0];
            const knockMessage = args.length > 1 ? args.slice(1).join(' ') : '';
            this.sendCommand(knockMessage ? `KNOCK ${knockChannel} :${knockMessage}` : `KNOCK ${knockChannel}`);
            this.addMessage({ type: 'notice', text: t('*** Knock sent to {channel}', { channel: knockChannel }), timestamp: Date.now() });
          } else {
            this.addMessage({ type: 'error', text: t('Usage: /knock <channel> [message]'), timestamp: Date.now() });
          }
          break;
        case 'RULES':
          // /rules [server] - Get server rules
          const rulesTarget = args.length > 0 ? args[0] : '';
          this.sendCommand(rulesTarget ? `RULES ${rulesTarget}` : 'RULES');
          break;
        case 'SERVLIST':
          // /servlist [mask] [type] - List IRC services
          const servlistMask = args.length > 0 ? args[0] : '';
          const servlistType = args.length > 1 ? args[1] : '';
          if (servlistMask && servlistType) {
            this.sendCommand(`SERVLIST ${servlistMask} ${servlistType}`);
          } else if (servlistMask) {
            this.sendCommand(`SERVLIST ${servlistMask}`);
          } else {
            this.sendCommand('SERVLIST');
          }
          break;
        case 'USERHOST':
          // /userhost <nick1> [nick2] ... - Get user host information
          if (args.length > 0) {
            this.sendCommand(`USERHOST ${args.join(' ')}`);
          } else {
            this.addMessage({ type: 'error', text: t('Usage: /userhost <nick1> [nick2] ...'), timestamp: Date.now() });
          }
          break;
        case 'USERIP':
          // /userip <nick> - Get user IP address
          if (args.length > 0) {
            this.sendCommand(`USERIP ${args[0]}`);
          } else {
            this.addMessage({ type: 'error', text: t('Usage: /userip <nick>'), timestamp: Date.now() });
          }
          break;
        case 'USERS':
          // /users - Get user list (deprecated, rarely used)
          const usersTarget = args.length > 0 ? args[0] : '';
          this.sendCommand(usersTarget ? `USERS ${usersTarget}` : 'USERS');
          break;
        case 'WATCH':
          // /watch +nick1 -nick2 ... - Monitor users (legacy protocol)
          if (args.length > 0) {
            this.sendCommand(`WATCH ${args.join(' ')}`);
          } else {
            this.addMessage({ type: 'error', text: t('Usage: /watch +nick1 -nick2 ...'), timestamp: Date.now() });
          }
          break;
        case 'OPER':
          // /oper <nick> <password> - IRCop login
          if (args.length >= 2) {
            const operNick = args[0];
            const operPassword = args[1];
            this.sendCommand(`OPER ${operNick} ${operPassword}`);
            this.addMessage({ type: 'notice', text: t('*** Attempting IRCop login...'), timestamp: Date.now() });
          } else {
            this.addMessage({ type: 'error', text: t('Usage: /oper <nick> <password>'), timestamp: Date.now() });
          }
          break;
        case 'REHASH':
          // /rehash - IRCop rehash server
          this.sendCommand('REHASH');
          this.addMessage({ type: 'notice', text: t('*** Requesting server rehash...'), timestamp: Date.now() });
          break;
        case 'SQUIT':
          // /squit <server> [message] - IRCop disconnect server
          if (args.length >= 1) {
            const squitServer = args[0];
            const squitMessage = args.length > 1 ? args.slice(1).join(' ') : '';
            this.sendCommand(squitMessage ? `SQUIT ${squitServer} :${squitMessage}` : `SQUIT ${squitServer}`);
            this.addMessage({ type: 'notice', text: t('*** Requesting server disconnect: {server}', { server: squitServer }), timestamp: Date.now() });
          } else {
            this.addMessage({ type: 'error', text: t('Usage: /squit <server> [message]'), timestamp: Date.now() });
          }
          break;
        case 'KILL':
          // /kill <nick> <reason> - IRCop kill user
          if (args.length >= 2) {
            const killNick = args[0];
            const killReason = args.slice(1).join(' ');
            this.sendCommand(`KILL ${killNick} :${killReason}`);
            this.addMessage({ type: 'notice', text: t('*** Killing user: {nick}', { nick: killNick }), timestamp: Date.now() });
          } else {
            this.addMessage({ type: 'error', text: t('Usage: /kill <nick> <reason>'), timestamp: Date.now() });
          }
          break;
        case 'CONNECT':
          // /connect <server> <port> [remote] - IRCop connect servers
          if (args.length >= 2) {
            const connectServer = args[0];
            const connectPort = args[1];
            const connectRemote = args.length > 2 ? args[2] : '';
            if (connectRemote) {
              this.sendCommand(`CONNECT ${connectServer} ${connectPort} ${connectRemote}`);
            } else {
              this.sendCommand(`CONNECT ${connectServer} ${connectPort}`);
            }
            this.addMessage({ type: 'notice', text: t('*** Requesting server connection: {server}:{port}', { server: connectServer, port: connectPort }), timestamp: Date.now() });
          } else {
            this.addMessage({ type: 'error', text: t('Usage: /connect <server> <port> [remote]'), timestamp: Date.now() });
          }
          break;
        case 'DIE':
          // /die - IRCop shutdown server
          this.sendCommand('DIE');
          this.addMessage({ type: 'notice', text: t('*** Requesting server shutdown...'), timestamp: Date.now() });
          break;
        default: this.sendCommand(commandText); break;
      }
      return;
    }
    
    this.sendRaw(`PRIVMSG ${target} :${normalizedMessage}`);
    this.addMessage({ type: 'message', channel: target, from: this.currentNick, text: normalizedMessage, timestamp: Date.now(), status: 'sent' });
  }

  sendCommand(command: string): void {
    if (this.isConnected) this.sendRaw(command);
  }

  getChannels(): string[] {
    return Array.from(this.channelUsers.keys());
  }

  getNetworkName(): string {
    return this.networkId || this.config?.host || '';
  }

  setNetworkId(id: string): void {
    this.networkId = id || '';
  }

  setUserManagementService(svc: typeof userManagementService): void {
    this._userManagementService = svc;
  }

  getUserManagementService(): typeof userManagementService {
    return this._userManagementService || userManagementService;
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  getLocalAddress(): string | undefined {
    const socket = this.socket as any;
    const direct = socket?.localAddress;
    if (typeof direct === 'string' && direct.length > 0) {
      return direct;
    }
    if (typeof socket?.address === 'function') {
      try {
        const info = socket.address();
        const addr = info && typeof info === 'object' ? info.address : undefined;
        if (typeof addr === 'string' && addr.length > 0) {
          return addr;
        }
      } catch {
        // ignore address errors
      }
    }
    return undefined;
  }

  onMessage(callback: (message: IRCMessage) => void): () => void {
    this.messageListeners.push(callback);
    this.logRaw(`IRCService: Message listener registered. Total listeners: ${this.messageListeners.length}`);
    // Flush any buffered messages to all listeners so early events (e.g. proxy/tls) are visible
    if (this.pendingMessages.length > 0) {
      const backlog = [...this.pendingMessages];
      this.pendingMessages = [];
      backlog.forEach(msg => {
        this.messageListeners.forEach(cb => cb(msg));
      });
    }
    return () => this.messageListeners = this.messageListeners.filter(cb => cb !== callback);
  }

  onConnectionChange(callback: (connected: boolean) => void): () => void {
    this.connectionListeners.push(callback);
    // Flush buffered connection state transitions so UI catches up
    if (this.pendingConnectionStates.length > 0) {
      const backlog = [...this.pendingConnectionStates];
      this.pendingConnectionStates = [];
      backlog.forEach(state => {
        this.connectionListeners.forEach(cb => cb(state));
      });
    }
    return () => this.connectionListeners = this.connectionListeners.filter(cb => cb !== callback);
  }

  addMessage(message: Omit<IRCMessage, 'id' | 'network'> & { status?: 'pending' | 'sent' }, batchTag?: string): void {
    const fullMessage: IRCMessage = { 
      ...message, 
      id: `${Date.now()}-${Math.random()}`, 
      network: this.getNetworkName(),
      batchTag 
    };

    // Add to batch if batch tag is present
    if (batchTag) {
      this.addMessageToBatch(fullMessage, batchTag);
    }

    this.emitMessage(fullMessage);
  }

  addRawMessage(text: string, category: RawMessageCategory = 'debug', timestamp: number = Date.now()): void {
    this.addMessage({ type: 'raw', text, timestamp, isRaw: true, rawCategory: category });
  }

  private addWireMessage(direction: 'in' | 'out', line: string, timestamp: number = Date.now()): void {
    const arrow = direction === 'in' ? '<--' : '-->';
    this.addRawMessage(
      t('*** {arrow} {line}', { arrow, line }),
      direction === 'in' ? 'trafficIn' : 'trafficOut',
      timestamp
    );
  }

  private emitMessage(message: IRCMessage): void {
    if (this.messageListeners.length === 0) {
      // Buffer early messages until at least one listener is attached (keep last 100 to avoid unbounded growth)
      this.pendingMessages.push(message);
      if (this.pendingMessages.length > 100) {
        this.pendingMessages.splice(0, this.pendingMessages.length - 100);
      }
      return;
    }
    this.messageListeners.forEach(cb => cb(message));
  }

  private emitConnection(connected: boolean): void {
    if (this.connectionListeners.length === 0) {
      // Buffer until listeners attach; keep bounded
      this.pendingConnectionStates.push(connected);
      if (this.pendingConnectionStates.length > 20) {
        this.pendingConnectionStates.splice(0, this.pendingConnectionStates.length - 20);
      }
      return;
    }
    this.connectionListeners.forEach(cb => cb(connected));

    // Start/stop foreground service for background operation (Android only)
    const buildForegroundNotification = () => {
      let connectedNames: string[] = [];
      let connectedCount = 0;
      try {
        const { connectionManager } = require('./ConnectionManager');
        const connections = connectionManager?.getAllConnections?.() || [];
        const activeConnections = connections.filter(
          (ctx: any) => ctx?.ircService?.getConnectionStatus?.()
        );
        connectedNames = activeConnections
          .map((ctx: any) => ctx.networkId)
          .filter(Boolean);
        connectedCount = activeConnections.length;
      } catch {
        // Ignore if ConnectionManager is unavailable (singleton mode)
      }

      if (!connectedCount && connected) {
        connectedCount = 1;
        const name = this.getNetworkName();
        if (name) {
          connectedNames = [name];
        }
      }

      const fallbackName = this.getNetworkName() || t('IRC server');
      const title = t('IRC Connected');
      if (connectedCount === 0) {
        return { title, text: '', networkName: fallbackName, connectedCount };
      }
      if (connectedCount <= 1) {
        const name = connectedNames[0] || fallbackName;
        return { title, text: t('Connected to {networkName}', { networkName: name }), networkName: name, connectedCount };
      }

      const uniqueNames = Array.from(new Set(connectedNames)).filter(Boolean);
      let namesSummary = '';
      if (uniqueNames.length > 0) {
        const trimmed = uniqueNames.slice(0, 3);
        namesSummary = trimmed.join(', ');
        if (uniqueNames.length > 3) {
          namesSummary = `${namesSummary} +${uniqueNames.length - 3}`;
        }
      }
      const suffix = namesSummary ? ` (${namesSummary})` : '';
      return {
        title,
        text: t('Connected to {count} servers{suffix}', { count: connectedCount, suffix }),
        networkName: uniqueNames[0] || fallbackName,
        connectedCount,
      };
    };

    if (connected) {
      const { title, text, networkName } = buildForegroundNotification();
      if (ircForegroundService.isServiceRunning()) {
        ircForegroundService.updateNotification(title, text).catch(err => {
          this.logRaw(`IRCService: Failed to update foreground service: ${err.message || err}`);
        });
      } else {
        ircForegroundService.start(networkName, title, text).catch(err => {
          this.logRaw(`IRCService: Failed to start foreground service: ${err.message || err}`);
        });
      }
    } else {
      const { title, text, connectedCount } = buildForegroundNotification();
      if (connectedCount > 0) {
        ircForegroundService.updateNotification(title, text).catch(err => {
          this.logRaw(`IRCService: Failed to update foreground service: ${err.message || err}`);
        });
      } else {
        ircForegroundService.stop().catch(err => {
          this.logRaw(`IRCService: Failed to stop foreground service: ${err.message || err}`);
        });
      }
    }
  }

  /**
   * Check if a specific IRCv3 capability is enabled on this connection.
   * @param capability The capability name to check (e.g., 'typing', 'draft/typing', 'monitor')
   * @returns true if the capability is enabled, false otherwise
   */
  hasCapability(capability: string): boolean {
    return this.capEnabledSet.has(capability);
  }

  /**
   * Check if typing indicators are supported by this server.
   * Checks for both 'typing' and 'draft/typing' capabilities.
   * @returns true if either typing capability is enabled
   */
  hasTypingCapability(): boolean {
    return this.capEnabledSet.has('typing') || this.capEnabledSet.has('draft/typing');
  }

  /**
   * Send a typing indicator if the server supports it.
   * @param target The channel or nick to send the typing indicator to
   * @param status The typing status: 'active', 'paused', or 'done'
   * @returns true if the indicator was sent, false if not supported
   */
  sendTypingIndicator(target: string, status: 'active' | 'paused' | 'done'): boolean {
    if (!this.isConnected || !this.hasTypingCapability()) {
      return false;
    }
    this.sendRaw(`@+typing=${status} TAGMSG ${target}`);
    return true;
  }

  /**
   * Check if SASL capability is available on this server
   */
  isSaslAvailable(): boolean {
    return this.capAvailable.has('sasl') || this.capEnabledSet.has('sasl');
  }

  /**
   * Check if SASL authentication is currently in progress
   */
  isSaslAuthenticating(): boolean {
    return this.saslAuthenticating;
  }

  /**
   * Check if SASL EXTERNAL (certificate-based) is being used
   */
  isSaslExternal(): boolean {
    return !!(this.config?.clientCert && this.config?.clientKey);
  }

  /**
   * Check if SASL PLAIN (account/password) is being used
   */
  isSaslPlain(): boolean {
    return !!(this.config?.sasl?.account && this.config?.sasl?.password && !this.config?.clientCert);
  }

  /**
   * Get SASL account name if configured
   */
  getSaslAccount(): string | undefined {
    return this.config?.sasl?.account;
  }
}

export const ircService = new IRCService();

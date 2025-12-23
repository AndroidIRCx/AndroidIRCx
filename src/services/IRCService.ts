import TcpSocket, { TLSSocket } from 'react-native-tcp-socket';
import { encryptedDMService } from './EncryptedDMService';
import { channelEncryptionService } from './ChannelEncryptionService';
import { DEFAULT_PART_MESSAGE, DEFAULT_QUIT_MESSAGE, ProxyConfig } from './SettingsService';

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
    title: 'Connection',
    description: 'Connect/disconnect, proxy, and registration flow messages.',
  },
  {
    id: 'trafficIn',
    title: 'Incoming traffic',
    description: 'Raw lines received from the server.',
  },
  {
    id: 'trafficOut',
    title: 'Outgoing traffic',
    description: 'Raw lines sent to the server.',
  },
  {
    id: 'server',
    title: 'Server notices',
    description: 'MOTD, account/away, and other server-emitted events.',
  },
  {
    id: 'channel',
    title: 'Channel notices',
    description: 'Channel modes, lists, topics, and per-channel system notices.',
  },
  {
    id: 'user',
    title: 'User notices',
    description: 'User account status, oper, and presence state changes.',
  },
  {
    id: 'auth',
    title: 'Auth & identity',
    description: 'SASL/authentication and nickname negotiation events.',
  },
  {
    id: 'debug',
    title: 'Debug',
    description: 'Verbose internal logging and diagnostics.',
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
  type: 'message' | 'notice' | 'raw' | 'join' | 'part' | 'quit' | 'nick' | 'mode' | 'topic' | 'error' | 'invite' | 'monitor';
  channel?: string;
  from?: string;
  text: string;
  timestamp: number;
  isRaw?: boolean;
  rawCategory?: RawMessageCategory;
  status?: 'pending' | 'sent';
  network?: string;
  isGrouped?: boolean;
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
  private nickChangeAttempts: number = 0;
  private verboseLogging: boolean = false;
  private isLoggingRaw: boolean = false;
  
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
  
  // IRCv3 features
  private serverTime: boolean = false;
  private accountNotify: boolean = false;
  private extendedJoin: boolean = false;
  private userhostInNames: boolean = false;
  private awayNotify: boolean = false;
  private chghost: boolean = false;
  private messageTags: boolean = false;
  
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
    console.log(...args);
    if (this.isLoggingRaw) return;
    this.isLoggingRaw = true;
    try {
      this.addRawMessage(text.startsWith('***') ? text : `*** ${text}`, 'debug');
    } finally {
      this.isLoggingRaw = false;
    }
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

        const proxy =
          config.proxy && config.proxy.enabled === false
            ? null
            : config.proxy || null;

        const tlsOptions: any = {
          host: config.host,
          port: config.port,
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
            const errorMessage = error?.message || error?.toString() || 'Unknown connection error';
            const errorCode = error?.code || 'NO_CODE';
            if (!this.manualDisconnect) {
              console.error('IRC Connection Error:', {
                message: errorMessage,
                code: errorCode,
                error: error,
                stack: error?.stack,
              });
              this.addRawMessage(`*** Socket error [${errorCode}]: ${errorMessage}`, 'connection');
            }
            
            if (!this.manualDisconnect) {
              if (!this.isConnected) {
                this.addMessage({
                  type: 'error',
                  text: `Connection error [${errorCode}]: ${errorMessage}`,
                  timestamp: Date.now(),
                });
                this.disconnect();
                reject(new Error(`${errorMessage} (Code: ${errorCode})`));
              } else {
                this.addMessage({
                  type: 'error',
                  text: `Socket error: ${errorMessage}`,
                  timestamp: Date.now(),
                });
              }
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
            if (this.isConnected) {
              this.addRawMessage('*** Connection closed by server', 'connection');
              this.disconnect();
            }
          });
        };

        const markConnected = (tls: boolean) => {
          this.isConnected = true;
          this.emitConnection(true);
          this.addRawMessage(`*** Connected to ${config.host}:${config.port}${tls ? ' (TLS)' : ''}`, 'connection');
          if (tls) {
            this.logRaw('IRCService: TLS handshake completed');
            this.addRawMessage('*** TLS handshake completed', 'connection');
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
            throw new Error('Proxy host/port not set');
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
                  this.addRawMessage(`*** TLS error over proxy: ${msg}`, 'connection');
                  this.disconnect();
                  reject(new Error(`TLS handshake failed: ${msg}`));
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
              this.addRawMessage(`*** Proxy error: ${msg}`, 'connection');
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
            reject(new Error('Connection timeout'));
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
            this.addRawMessage('*** Waiting for server registration...', 'connection');
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
        const errorMessage = error?.message || error?.toString() || 'Failed to create connection';
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
        reject(new Error('Proxy read timeout'));
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
      throw new Error(`HTTP proxy CONNECT failed: ${statusLine.trim()}`);
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
      throw new Error('SOCKS5 proxy: invalid version');
    }
    const method = methodResp[1];
    if (method === 0x02 && wantAuth) {
      const u = Buffer.from(String(proxy.username));
      const p = Buffer.from(String(proxy.password));
      const authReq = Buffer.concat([Buffer.from([0x01, u.length]), u, Buffer.from([p.length]), p]);
      this.socket.write(authReq);
      const authResp = await this.readFromSocketUntil(this.socket, (buf) => buf.length >= 2);
      if (authResp[1] !== 0x00) {
        throw new Error('SOCKS5 proxy: authentication failed');
      }
      this.logRaw('IRCService: SOCKS5 authentication succeeded');
    } else if (method === 0xff) {
      throw new Error('SOCKS5 proxy: no acceptable auth method');
    }

    const request = Buffer.concat([Buffer.from([0x05, 0x01, 0x00, 0x03, hostBuf.length]), hostBuf, portBuf]);
    this.socket.write(request);

    const replyHead = await this.readFromSocketUntil(this.socket, (buf) => buf.length >= 5);
    if (replyHead[1] !== 0x00) {
      throw new Error(`SOCKS5 proxy: connect failed (code ${replyHead[1]})`);
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
        this.addWireMessage('in', '(empty line)');
      }
    }
  }

  private handleIRCMessage(line: string): void {
    if (this.verboseLogging) {
      this.logRaw(`IRCService: << ${line.substring(0, 150)}`);
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

    switch (command) {
      case 'ERROR': {
        const errorText = params.join(' ') || 'Connection closed by server';
        this.addMessage({
          type: 'error',
          text: errorText,
          timestamp: messageTimestamp,
        });
        this.addRawMessage(`*** Server error: ${errorText}`, 'server');
        this.disconnect(errorText);
        return;
      }
      case 'PONG':
        if (params.length > 1 && params[1]) {
            const token = params[1];
            try {
                const timestamp = parseInt(token, 10);
                if (!isNaN(timestamp)) {
                    this.emit('pong', timestamp);
                }
            } catch (e) {}
        }
        return;
      case 'CAP':
        this.handleCAPCommand(params);
        return;
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
      case 'INVITE':
        const invitedNick = params[0] || '';
        const invitedChannel = params[1] || '';
        const inviter = this.extractNick(prefix);
        this.addMessage({
          type: 'invite',
          from: inviter,
          channel: invitedChannel,
          text: `${inviter} invited you to join ${invitedChannel}`,
          timestamp: messageTimestamp,
        });
        return;
      case 'PRIVMSG':
        const target = params[0] || '';
        const fromNick = this.extractNick(prefix);
        const msgText = params[1] || '';
        
        if (!target || target === '*' || target.trim() === '') {
          return;
        }
        
        const ctcp = this.parseCTCP(msgText);
        if (ctcp.isCTCP && ctcp.command) {
          this.handleCTCPRequest(fromNick, target, ctcp.command, ctcp.args);
          return;
        }
        
        const isChannel = target.startsWith('#') || target.startsWith('&') || target.startsWith('+') || target.startsWith('!');
        
        if (!isChannel && fromNick === this.currentNick && target === this.currentNick) {
          return;
        }
        
        const channelIdentifier = isChannel ? target : fromNick;

        // Handle old protocol for backward compatibility
        if (msgText.startsWith('!enc-key ')) {
          encryptedDMService.handleIncomingBundle(fromNick, msgText.substring('!enc-key '.length));
          return;
        }

        // New negotiation protocol: key offer (requires acceptance)
        if (msgText.startsWith('!enc-offer ')) {
          encryptedDMService.handleKeyOffer(fromNick, msgText.substring('!enc-offer '.length));
          return;
        }

        // Handle key acceptance (they accepted and sent their key)
        if (msgText.startsWith('!enc-accept ')) {
          encryptedDMService.handleKeyAcceptance(fromNick, msgText.substring('!enc-accept '.length))
            .then(result => {
              if (result.status === 'stored') {
                this.addMessage({
                  type: 'notice',
                  text: `*** ${fromNick} accepted your encryption key. Encrypted chat enabled.`,
                  timestamp: Date.now(),
                });
              } else if (result.status === 'pending') {
                this.addMessage({
                  type: 'notice',
                  text: `*** ${fromNick} sent a different encryption key. Review and accept the new key to continue encrypted chat.`,
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
            text: `*** ${fromNick} rejected your encryption key offer.`,
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
              text: '🔒 Invalid channel encryption payload',
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
                text: `🔒 ${plaintext}`,
                timestamp: messageTimestamp,
              });
            })
            .catch(e => {
              this.addMessage({
                type: 'message',
                channel: channelIdentifier,
                from: fromNick,
                text: `🔒 ${e.message === 'no channel key' ? 'Missing channel key. Use /chankey request <nick> to get it.' : 'Decryption failed'}`,
                timestamp: messageTimestamp,
              });
            });
          return;
        }

        // Handle encrypted channel key sharing (via DM)
        if (msgText.startsWith('!chanenc-key ')) {
          const keyData = msgText.substring('!chanenc-key '.length);
          channelEncryptionService.importChannelKey(keyData)
            .then(imported => {
              this.addMessage({
                type: 'notice',
                text: `*** Received channel key for ${imported.channel} from ${fromNick}`,
                timestamp: Date.now(),
              });
            })
            .catch(e => {
              this.addMessage({
                type: 'error',
                text: `*** Failed to import channel key: ${e}`,
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
              text: 'Invalid encrypted payload',
              timestamp: messageTimestamp,
            });
            return;
          }

          encryptedDMService
            .decrypt(payload, fromNick)
            .then(plaintext => {
              this.addMessage({
                type: 'message',
                channel: channelIdentifier,
                from: fromNick,
                text: `🔒 ${plaintext}`,
                timestamp: messageTimestamp,
              });
            })
            .catch(() => {
              this.addMessage({
                type: 'error',
                channel: channelIdentifier,
                text: `Encrypted message from ${fromNick} could not be decrypted`,
                timestamp: messageTimestamp,
              });
            });
          return;
        }
        
        this.addMessage({
          type: 'message',
          channel: channelIdentifier,
          from: fromNick,
          text: msgText,
          timestamp: messageTimestamp,
        });
        break;

      case 'NOTICE':
        const noticeTarget = params[0] || '';
        const noticeFrom = this.extractNick(prefix);
        const noticeText = params[1] || '';
        
        const noticeCTCP = this.parseCTCP(noticeText);
        let displayText = noticeText;

        if (noticeCTCP.isCTCP && noticeCTCP.command) {
          // Handle CTCP responses - process internally and display to user
          if (noticeCTCP.command === 'PING' && noticeCTCP.args) {
            try {
              const sentTime = parseInt(noticeCTCP.args, 10);
              const latency = Date.now() - sentTime;
              this.logRaw(`CTCP PING response from ${noticeFrom}: ${latency}ms`);
              this.emit('pong', sentTime);
              displayText = `CTCP PING reply: ${latency}ms`;
            } catch (e) {
              displayText = `CTCP PING reply from ${noticeFrom}`;
            }
          } else {
            // Other CTCP responses (VERSION, TIME, etc.)
            displayText = `CTCP ${noticeCTCP.command} reply${noticeCTCP.args ? ': ' + noticeCTCP.args : ''}`;
          }
        }

        this.addMessage({
          type: 'notice',
          channel: noticeTarget,
          from: noticeFrom,
          text: displayText,
          timestamp: messageTimestamp,
        });
        break;

      case 'JOIN':
        const channel = params[0] || '';
        const nick = this.extractNick(prefix);
        
        let joinText = `${nick} joined ${channel}`;
        let account: string | undefined;
        if (this.extendedJoin && params.length >= 2) {
          account = params[1];
          if (account && account !== '*') {
            joinText = `${nick} (${account}) joined ${channel}`;
          } else {
            account = undefined;
          }
        }
        
        if (channel && nick) {
          let usersMap = this.channelUsers.get(channel);
          if (!usersMap) {
            usersMap = new Map();
            this.channelUsers.set(channel, usersMap);
          }
          
          const existingUser = usersMap.get(nick.toLowerCase());
          if (existingUser) {
            if (account) existingUser.account = account;
          } else {
            usersMap.set(nick.toLowerCase(), {
              nick,
              modes: [],
              account,
            });
            this.updateChannelUserList(channel);
          }
        }
        
        if (nick === this.currentNick) {
          this.emit('joinedChannel', channel);
          this.pendingChannelIntro.add(channel);
        }
        
        this.addMessage({
          type: 'join',
          channel: channel,
          from: nick,
          text: joinText,
          timestamp: messageTimestamp,
        });
        break;

      case 'PART':
        const partChannel = params[0] || '';
        const partNick = this.extractNick(prefix);
        const partMessage = params[1] || '';
        
        if (partChannel && partNick) {
          const usersMap = this.channelUsers.get(partChannel);
          if (usersMap) {
            usersMap.delete(partNick.toLowerCase());
            this.updateChannelUserList(partChannel);
          }
        }
        
        this.addMessage({
          type: 'part',
          channel: partChannel,
          from: partNick,
          text: `${partNick} left ${partChannel}${partMessage ? ': ' + partMessage : ''}`,
          timestamp: messageTimestamp,
        });
        if (partNick === this.currentNick && partChannel) {
          this.emit('part', partChannel, partNick);
        }
        break;

      case 'QUIT':
        const quitNick = this.extractNick(prefix);
        const quitMessage = params[0] || '';
        const quitChannels: string[] = [];
        
        if (quitNick) {
          this.channelUsers.forEach((usersMap, channelName) => {
            if (usersMap.has(quitNick.toLowerCase())) {
              quitChannels.push(channelName);
              usersMap.delete(quitNick.toLowerCase());
              this.updateChannelUserList(channelName);
            }
          });
        }

        const quitDisplay = quitNick || 'User';
        const quitText = `${quitDisplay} quit${quitMessage ? ': ' + quitMessage : ''}`;
        if (quitChannels.length > 0) {
          quitChannels.forEach(channelName => {
            this.addMessage({
              type: 'quit',
              channel: channelName,
              from: quitNick,
              text: quitText,
              timestamp: messageTimestamp,
            });
          });
        } else {
          this.addMessage({
            type: 'quit',
            from: quitNick,
            text: quitText,
            timestamp: messageTimestamp,
          });
        }
        break;

      case 'TOPIC':
        const topicChannel = params[0] || '';
        const topic = params[1] || '';
        const setBy = this.extractNick(prefix);
        if (topicChannel) {
          const existing = this.channelTopics.get(topicChannel) || {};
          this.channelTopics.set(topicChannel, { ...existing, topic, setBy, setAt: Math.floor(messageTimestamp / 1000) });
          this.maybeEmitChannelIntro(topicChannel, messageTimestamp);
        }
        this.emit('topic', topicChannel, topic, setBy);
        this.addMessage({
          type: 'topic',
          channel: topicChannel,
          from: setBy,
          text: `Topic: ${topic}`,
          timestamp: messageTimestamp,
        });
        break;

      case 'NICK':
        const oldNick = this.extractNick(prefix);
        const newNick = params[0] || '';
        if (oldNick === this.currentNick) {
          this.currentNick = newNick;
        }
        const affectedChannels: string[] = [];
        
        if (oldNick && newNick) {
          this.channelUsers.forEach((usersMap, channelName) => {
            const oldUser = usersMap.get(oldNick.toLowerCase());
            if (oldUser) {
              affectedChannels.push(channelName);
              usersMap.delete(oldNick.toLowerCase());
              oldUser.nick = newNick;
              usersMap.set(newNick.toLowerCase(), oldUser);
              this.updateChannelUserList(channelName);
            }
          });
        }
        const nickText = `${oldNick || 'Someone'} is now known as ${newNick}`;
        if (affectedChannels.length > 0) {
          affectedChannels.forEach(channelName => {
            this.addMessage({
              type: 'nick',
              channel: channelName,
              from: oldNick,
              text: nickText,
              timestamp: messageTimestamp,
            });
          });
        } else {
          this.addMessage({
            type: 'nick',
            from: oldNick,
            text: nickText,
            timestamp: messageTimestamp,
          });
        }
        break;

      case 'KICK':
        const kickChannel = params[0] || '';
        const kickTarget = params[1] || '';
        const kickReason = params[2] || '';
        const kickBy = this.extractNick(prefix);
        
        if (kickTarget === this.currentNick) {
          this.emit('kick', kickChannel);
        }
        
        if (kickChannel && kickTarget) {
          const usersMap = this.channelUsers.get(kickChannel);
          if (usersMap) {
            usersMap.delete(kickTarget.toLowerCase());
            this.updateChannelUserList(kickChannel);
          }
        }
        
        this.addMessage({
          type: 'mode',
          channel: kickChannel,
          from: kickBy,
          text: `${kickBy} kicked ${kickTarget} from ${kickChannel}${kickReason ? ': ' + kickReason : ''}`,
          timestamp: messageTimestamp,
        });
        break;

      case 'MODE':
        const modeChannel = params[0] || '';
        const modeParams = params.slice(1);
        const modeString = modeParams[0] || '';
        const modeParamValues = modeParams.slice(1);
        
        if (modeChannel && (modeChannel.startsWith('#') || modeChannel.startsWith('&') || 
            modeChannel.startsWith('+') || modeChannel.startsWith('!'))) {
          this.handleChannelModeChange(modeChannel, modeParams);
          this.emit('channelMode', modeChannel, modeString, modeParamValues);
          const existing = this.channelTopics.get(modeChannel) || {};
          const combinedModes = modeParams.join(' ').trim();
          if (combinedModes) {
            this.channelTopics.set(modeChannel, { ...existing, modes: combinedModes.startsWith('+') ? combinedModes : `+${combinedModes}` });
            this.maybeEmitChannelIntro(modeChannel, messageTimestamp);
          }
        }
        
        const isUserModeChange = !modeChannel || 
          (!modeChannel.startsWith('#') && !modeChannel.startsWith('&') && 
           !modeChannel.startsWith('+') && !modeChannel.startsWith('!') &&
           (modeChannel === this.currentNick || !modeChannel));
        
        this.addMessage({
          type: isUserModeChange ? 'raw' : 'mode',
          channel: isUserModeChange ? undefined : modeChannel,
          from: this.extractNick(prefix),
          text: `Mode ${modeChannel} ${modeParams.join(' ')}`,
          timestamp: messageTimestamp,
          isRaw: isUserModeChange,
          rawCategory: isUserModeChange ? 'server' : undefined,
        });
        break;

      case 'ACCOUNT':
        const accountNick = this.extractNick(prefix);
        const accountName = params[0] || '';
        if (accountName === '*') {
          this.addMessage({ type: 'raw', text: `*** ${accountNick} logged out`, timestamp: messageTimestamp, isRaw: true, rawCategory: 'user' });
        } else {
          this.addMessage({ type: 'raw', text: `*** ${accountNick} logged in as ${accountName}`, timestamp: messageTimestamp, isRaw: true, rawCategory: 'user' });
        }
        this.emit('account', accountNick, accountName);
        break;

      case 'AWAY':
        const awayNick = this.extractNick(prefix);
        const awayMessage = params[0] || '';
        if (awayMessage) {
          this.addMessage({ type: 'raw', text: `*** ${awayNick} is now away: ${awayMessage}`, timestamp: messageTimestamp, isRaw: true, rawCategory: 'user' });
        } else {
          this.addMessage({ type: 'raw', text: `*** ${awayNick} is no longer away`, timestamp: messageTimestamp, isRaw: true, rawCategory: 'user' });
        }
        break;

      case 'CHGHOST':
        const chghostNick = this.extractNick(prefix);
        const newHost = params[1] || '';
        this.addMessage({ type: 'raw', text: `*** ${chghostNick} changed host to ${newHost}`, timestamp: messageTimestamp, isRaw: true, rawCategory: 'server' });
        this.emit('chghost', chghostNick, newHost);
        break;

      default:
        const fullMessage = `${prefix ? `:${prefix} ` : ''}${command} ${params.join(' ')}`;
        this.addMessage({
          type: 'raw',
          text: `*** RAW Command: ${fullMessage}`,
          timestamp: messageTimestamp,
          isRaw: true,
          rawCategory: 'server',
        });
        break;
    }
  }

  private handleNumericReply(numeric: number, prefix: string, params: string[], timestamp: number = Date.now()): void {
    this.emit('numeric', numeric, prefix, params, timestamp);
    switch (numeric) {
      case 1:
        this.registered = true;
        if (params.length > 0) {
          const welcomeNick = params[0];
          if (welcomeNick) this.currentNick = welcomeNick;
        }
        this.addMessage({ type: 'raw', text: `*** Welcome to the ${params[0] || 'IRC'} Network`, timestamp: timestamp, isRaw: true, rawCategory: 'server' });
        this.emit('registered');
        break;

      case 2: {
        // RPL_YOURHOST: :server 002 nick :Your host is servername, running version
        const hostInfo = params.slice(1).join(' ').replace(/^:/, '') || '';
        this.addMessage({
          type: 'raw',
          text: `*** ${hostInfo}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'server'
        });
        break;
      }

      case 3: {
        // RPL_CREATED: :server 003 nick :This server was created date
        const createdInfo = params.slice(1).join(' ').replace(/^:/, '') || '';
        this.addMessage({
          type: 'raw',
          text: `*** ${createdInfo}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'server'
        });
        break;
      }

      case 4: {
        // RPL_MYINFO: :server 004 nick servername version usermodes channelmodes
        const serverName = params[1] || '';
        const version = params[2] || '';
        const userModes = params[3] || '';
        const channelModes = params[4] || '';
        this.addMessage({
          type: 'raw',
          text: `*** Server: ${serverName} | Version: ${version} | User modes: ${userModes} | Channel modes: ${channelModes}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'server'
        });
        break;
      }

      case 5: {
        // RPL_ISUPPORT: :server 005 nick TOKEN1 TOKEN2=value :are supported by this server
        // This is critical - tells us server capabilities like CHANMODES, PREFIX, CHANTYPES, NETWORK, etc.
        const tokens = params.slice(1, -1); // All params except nick (first) and trailing message (last)
        const supportText = tokens.join(' ');
        this.addMessage({
          type: 'raw',
          text: `*** Server supports: ${supportText}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'server'
        });

        // Parse and store important capabilities for potential future use
        tokens.forEach(token => {
          if (token.includes('=')) {
            const [key, value] = token.split('=', 2);
            this.logRaw(`IRCService: Server capability ${key}=${value}`);
          } else {
            this.logRaw(`IRCService: Server capability ${token}`);
          }
        });
        break;
      }

      // Server stats and info numerics
      case 211:
      case 212:
      case 213:
      case 214:
      case 215:
      case 216:
      case 217:
      case 218: {
        // Various RPL_STATS* responses - Generic handler
        const statsData = params.slice(1).join(' ').replace(/^:/, '') || '';
        this.addMessage({
          type: 'raw',
          text: `*** [${numeric}] ${statsData}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'server'
        });
        break;
      }

      case 219: {
        // RPL_ENDOFSTATS: :server 219 yournick query :End of STATS report
        const query = params[1] || '';
        const message = params.slice(2).join(' ').replace(/^:/, '') || 'End of STATS report';
        this.addMessage({
          type: 'raw',
          text: `*** ${query}: ${message}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'server'
        });
        break;
      }

      case 241:
      case 243:
      case 244: {
        // RPL_STATSLLINE, RPL_STATSOLINE, RPL_STATSHLINE - Generic handler
        const statsData = params.slice(1).join(' ').replace(/^:/, '') || '';
        this.addMessage({
          type: 'raw',
          text: `*** [${numeric}] ${statsData}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'server'
        });
        break;
      }

      case 242: {
        // RPL_STATSUPTIME: :server 242 yournick :Server Up X days Y:Z:W
        const uptime = params.slice(1).join(' ').replace(/^:/, '') || '';
        this.addMessage({
          type: 'raw',
          text: `*** ${uptime}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'server'
        });
        break;
      }

      case 351: {
        // RPL_VERSION: :server 351 yournick version.flags server :comments
        const version = params[1] || '';
        const server = params[2] || '';
        const comments = params.slice(3).join(' ').replace(/^:/, '') || '';
        this.addMessage({
          type: 'raw',
          text: `*** Version: ${version} on ${server} ${comments}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'server'
        });
        break;
      }

      case 371: {
        // RPL_INFO: :server 371 yournick :info text
        const info = params.slice(1).join(' ').replace(/^:/, '') || '';
        this.addMessage({
          type: 'raw',
          text: `*** ${info}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'server'
        });
        break;
      }

      case 374: {
        // RPL_ENDOFINFO: :server 374 yournick :End of INFO
        const message = params.slice(1).join(' ').replace(/^:/, '') || 'End of INFO';
        this.addMessage({
          type: 'raw',
          text: `*** ${message}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'server'
        });
        break;
      }

      case 381: {
        // RPL_YOUREOPER: :server 381 yournick :You are now an IRC operator
        const message = params.slice(1).join(' ').replace(/^:/, '') || 'You are now an IRC operator';
        this.addMessage({
          type: 'raw',
          text: `*** ${message}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'server'
        });
        break;
      }

      case 382: {
        // RPL_REHASHING: :server 382 yournick config :Rehashing
        const config = params[1] || '';
        const message = params.slice(2).join(' ').replace(/^:/, '') || 'Rehashing';
        this.addMessage({
          type: 'raw',
          text: `*** ${config}: ${message}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'server'
        });
        break;
      }

      case 383: {
        // RPL_YOURESERVICE: :server 383 yournick :You are service
        const message = params.slice(1).join(' ').replace(/^:/, '') || 'You are service';
        this.addMessage({
          type: 'raw',
          text: `*** ${message}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'server'
        });
        break;
      }

      case 391: {
        // RPL_TIME: :server 391 yournick server :time string
        const server = params[1] || '';
        const timeStr = params.slice(2).join(' ').replace(/^:/, '') || '';
        this.addMessage({
          type: 'raw',
          text: `*** Time on ${server}: ${timeStr}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'server'
        });
        break;
      }

      // LUSERS stats numerics
      case 251: {
        // RPL_LUSERCLIENT: :server 251 yournick :There are X users and Y invisible on Z servers
        const message = params.slice(1).join(' ').replace(/^:/, '') || '';
        this.addMessage({
          type: 'raw',
          text: `*** ${message}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'server'
        });
        break;
      }

      case 252: {
        // RPL_LUSEROP: :server 252 yournick X :operator(s) online
        const count = params[1] || '0';
        const message = params.slice(2).join(' ').replace(/^:/, '') || 'operator(s) online';
        this.addMessage({
          type: 'raw',
          text: `*** ${count} ${message}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'server'
        });
        break;
      }

      case 253: {
        // RPL_LUSERUNKNOWN: :server 253 yournick X :unknown connection(s)
        const count = params[1] || '0';
        const message = params.slice(2).join(' ').replace(/^:/, '') || 'unknown connection(s)';
        this.addMessage({
          type: 'raw',
          text: `*** ${count} ${message}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'server'
        });
        break;
      }

      case 254: {
        // RPL_LUSERCHANNELS: :server 254 yournick X :channels formed
        const count = params[1] || '0';
        const message = params.slice(2).join(' ').replace(/^:/, '') || 'channels formed';
        this.addMessage({
          type: 'raw',
          text: `*** ${count} ${message}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'server'
        });
        break;
      }

      case 255: {
        // RPL_LUSERME: :server 255 yournick :I have X clients and Y servers
        const message = params.slice(1).join(' ').replace(/^:/, '') || '';
        this.addMessage({
          type: 'raw',
          text: `*** ${message}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'server'
        });
        break;
      }

      case 256: {
        // RPL_ADMINME: :server 256 yournick :Administrative info
        const message = params.slice(1).join(' ').replace(/^:/, '') || 'Administrative info';
        this.addMessage({
          type: 'raw',
          text: `*** ${message}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'server'
        });
        break;
      }

      case 257: {
        // RPL_ADMINLOC1: :server 257 yournick :Location
        const location = params.slice(1).join(' ').replace(/^:/, '') || '';
        this.addMessage({
          type: 'raw',
          text: `*** ${location}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'server'
        });
        break;
      }

      case 258: {
        // RPL_ADMINLOC2: :server 258 yournick :Location details
        const location = params.slice(1).join(' ').replace(/^:/, '') || '';
        this.addMessage({
          type: 'raw',
          text: `*** ${location}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'server'
        });
        break;
      }

      case 259: {
        // RPL_ADMINEMAIL: :server 259 yournick :Email
        const email = params.slice(1).join(' ').replace(/^:/, '') || '';
        this.addMessage({
          type: 'raw',
          text: `*** ${email}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'server'
        });
        break;
      }

      case 265: {
        // RPL_LOCALUSERS: :server 265 yournick current max :Current local users X, max Y
        const current = params[1] || '';
        const max = params[2] || '';
        const message = params.slice(3).join(' ').replace(/^:/, '') || `Current local users ${current}, max ${max}`;
        this.addMessage({
          type: 'raw',
          text: `*** ${message}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'server'
        });
        break;
      }

      case 266: {
        // RPL_GLOBALUSERS: :server 266 yournick current max :Current global users X, max Y
        const current = params[1] || '';
        const max = params[2] || '';
        const message = params.slice(3).join(' ').replace(/^:/, '') || `Current global users ${current}, max ${max}`;
        this.addMessage({
          type: 'raw',
          text: `*** ${message}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'server'
        });
        break;
      }

      case 375:
        this.addMessage({ type: 'raw', text: `*** - ${params[1]} Message of the Day -`, timestamp: timestamp, isRaw: true, rawCategory: 'server' });
        break;

      case 372:
        this.addMessage({ type: 'raw', text: `*** ${params[1]}`, timestamp: timestamp, isRaw: true, rawCategory: 'server' });
        break;

      case 376:
        this.addMessage({ type: 'raw', text: `*** End of /MOTD command.`, timestamp: timestamp, isRaw: true, rawCategory: 'server' });
        this.emit('motdEnd');
        break;

      case 422:
        this.addMessage({ type: 'raw', text: `*** No Message of the Day.`, timestamp: timestamp, isRaw: true, rawCategory: 'server' });
        this.emit('motdEnd');
        break;

      case 331: {
        // No topic set
        const channel = params[1] || '';
        if (channel) {
          const existing = this.channelTopics.get(channel) || {};
          this.channelTopics.set(channel, { ...existing, topic: 'No topic is set.' });
          this.maybeEmitChannelIntro(channel, timestamp);
        }
        break;
      }

      case 332: {
        // Channel topic
        const channel = params[1] || '';
        const topic = params.slice(2).join(' ') || '';
        if (channel) {
          const existing = this.channelTopics.get(channel) || {};
          this.channelTopics.set(channel, { ...existing, topic });
          this.maybeEmitChannelIntro(channel, timestamp);
        }
        break;
      }

      case 333: {
        // Topic metadata: who set and when
        const channel = params[1] || '';
        const setBy = params[2] || '';
        const setAtRaw = params[3];
        const setAt = setAtRaw ? parseInt(setAtRaw, 10) : undefined;
        if (channel) {
          const existing = this.channelTopics.get(channel) || {};
          this.channelTopics.set(channel, { ...existing, setBy, setAt: isNaN(setAt || NaN) ? existing.setAt : setAt });
          this.maybeEmitChannelIntro(channel, timestamp);
        }
        break;
      }

      case 324: {
        // Channel modes
        const channel = params[1] || '';
        const modes = params.slice(2).join(' ').trim();
        if (channel && modes) {
          const existing = this.channelTopics.get(channel) || {};
          const normalized = modes.startsWith('+') ? modes : `+${modes}`;
          this.channelTopics.set(channel, { ...existing, modes: normalized });
          this.maybeEmitChannelIntro(channel, timestamp);
        }
        break;
      }

      // Additional channel info numerics
      case 329: {
        // RPL_CREATIONTIME: :server 329 yournick channel creation_time
        const channel = params[1] || '';
        const createdAtRaw = params[2] || '';
        const createdAt = createdAtRaw ? parseInt(createdAtRaw, 10) : 0;
        const createdDate = createdAt > 0 ? new Date(createdAt * 1000).toLocaleString() : 'unknown';
        this.addMessage({
          type: 'raw',
          text: `*** ${channel} was created on ${createdDate}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'channel'
        });
        break;
      }

      case 341: {
        // RPL_INVITING: :server 341 yournick nick channel
        const invitedNick = params[1] || '';
        const channel = params[2] || '';
        this.addMessage({
          type: 'raw',
          text: `*** You have invited ${invitedNick} to ${channel}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'channel'
        });
        break;
      }

      case 346: {
        // RPL_INVITELIST: :server 346 yournick channel invitemask
        const channel = params[1] || '';
        const inviteMask = params[2] || '';
        this.addMessage({
          type: 'raw',
          text: `*** ${channel} invite list: ${inviteMask}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'channel'
        });
        break;
      }

      case 347: {
        // RPL_ENDOFINVITELIST: :server 347 yournick channel :End of channel invite list
        const channel = params[1] || '';
        this.addMessage({
          type: 'raw',
          text: `*** End of ${channel} invite list`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'channel'
        });
        break;
      }

      case 348: {
        // RPL_EXCEPTLIST: :server 348 yournick channel exceptmask
        const channel = params[1] || '';
        const exceptMask = params[2] || '';
        const setBy = params[3] || '';
        const setTime = params[4] ? parseInt(params[4], 10) : 0;
        const setDate = setTime > 0 ? new Date(setTime * 1000).toLocaleString() : '';
        const byInfo = setBy ? ` by ${setBy}` : '';
        const timeInfo = setDate ? ` on ${setDate}` : '';
        this.addMessage({
          type: 'raw',
          text: `*** ${channel} exception list: ${exceptMask}${byInfo}${timeInfo}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'channel'
        });
        break;
      }

      case 349: {
        // RPL_ENDOFEXCEPTLIST: :server 349 yournick channel :End of channel exception list
        const channel = params[1] || '';
        this.addMessage({
          type: 'raw',
          text: `*** End of ${channel} exception list`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'channel'
        });
        break;
      }

      case 367: {
        // RPL_BANLIST: :server 367 yournick channel banmask
        const channel = params[1] || '';
        const banMask = params[2] || '';
        const setBanner = params[3] || '';
        const setTime = params[4] ? parseInt(params[4], 10) : 0;
        const setDate = setTime > 0 ? new Date(setTime * 1000).toLocaleString() : '';
        const byInfo = setBanner ? ` by ${setBanner}` : '';
        const timeInfo = setDate ? ` on ${setDate}` : '';
        this.addMessage({
          type: 'raw',
          text: `*** ${channel} ban list: ${banMask}${byInfo}${timeInfo}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'channel'
        });
        break;
      }

      case 368: {
        // RPL_ENDOFBANLIST: :server 368 yournick channel :End of channel ban list
        const channel = params[1] || '';
        this.addMessage({
          type: 'raw',
          text: `*** End of ${channel} ban list`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'channel'
        });
        break;
      }

      // LIST command numerics
      case 321: {
        // RPL_LISTSTART: :server 321 yournick Channel :Users  Name
        this.addMessage({
          type: 'raw',
          text: `*** Channel list:`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'server'
        });
        break;
      }

      case 322: {
        // RPL_LIST: :server 322 yournick channel users :topic
        const channel = params[1] || '';
        const users = params[2] || '0';
        const topic = params.slice(3).join(' ').replace(/^:/, '') || '';
        this.addMessage({
          type: 'raw',
          text: `*** ${channel} (${users} users): ${topic}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'server'
        });
        break;
      }

      case 323: {
        // RPL_LISTEND: :server 323 yournick :End of LIST
        this.addMessage({
          type: 'raw',
          text: `*** End of channel list`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'server'
        });
        break;
      }

      case 353: {
        const namesChannel = params[2] || '';
        const namesList = params.slice(3).join(' ').replace(/^:/, '');
        
        if (namesChannel && namesList) {
          if (!this.namesBuffer.has(namesChannel)) {
            this.namesBuffer.set(namesChannel, new Set());
          }
          const users = namesList.split(/\s+/).filter(u => u.trim());
          users.forEach(userStr => {
            if (userStr.trim()) {
              this.namesBuffer.get(namesChannel)?.add(userStr);
            }
          });
        }
        break;
      }

      case 366: {
        const endChannel = params[1] || '';
        if (endChannel && this.namesBuffer.has(endChannel)) {
          const userSet = this.namesBuffer.get(endChannel)!;
          const usersMap = new Map<string, ChannelUser>();
          
          userSet.forEach(userStr => {
            const parsed = this.parseUserWithPrefixes(userStr);
            if (parsed) {
              usersMap.set(parsed.nick.toLowerCase(), parsed);
            }
          });
          
          this.channelUsers.set(endChannel, usersMap);
          this.namesBuffer.delete(endChannel);
          this.emitUserListChange(endChannel, Array.from(usersMap.values()));
          this.maybeEmitChannelIntro(endChannel, timestamp);
        }
        break;
      }

      // WHO command responses
      case 352: {
        // RPL_WHOREPLY: :server 352 yournick channel username host server nick flags :hopcount realname
        const whoChannel = params[1] || '';
        const whoUser = params[2] || '';
        const whoHost = params[3] || '';
        const whoServer = params[4] || '';
        const whoNick = params[5] || '';
        const whoFlags = params[6] || '';
        const whoRealParts = params.slice(7).join(' ').replace(/^:/, '').split(' ', 2);
        const whoHops = whoRealParts[0] || '0';
        const whoReal = whoRealParts.slice(1).join(' ') || '';

        const awayStatus = whoFlags.includes('G') ? ' (away)' : '';
        const opStatus = whoFlags.includes('*') ? ' (IRCop)' : '';

        this.addMessage({
          type: 'raw',
          text: `*** WHO ${whoChannel}: ${whoNick} (${whoUser}@${whoHost}) [${whoServer}]${awayStatus}${opStatus} - ${whoReal}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'server'
        });
        break;
      }

      case 315: {
        // RPL_ENDOFWHO: :server 315 yournick channel :End of WHO list
        const whoChannel = params[1] || '';
        this.addMessage({
          type: 'raw',
          text: `*** End of WHO list for ${whoChannel}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'server'
        });
        break;
      }

      // Common error numerics
      case 401: {
        // ERR_NOSUCHNICK: :server 401 yournick nickname :No such nick/channel
        const target = params[1] || '';
        const errorMsg = params.slice(2).join(' ').replace(/^:/, '') || 'No such nick/channel';
        this.addMessage({
          type: 'error',
          text: `${target}: ${errorMsg}`,
          timestamp: timestamp
        });
        if (target && this.lastWhowasTarget === target && Date.now() - this.lastWhowasAt < 5000) {
          this.addMessage({
            type: 'notice',
            text: `*** WHOWAS has no history for ${target}. If they are online, try /whois ${target}.`,
            timestamp: timestamp
          });
        }
        break;
      }

      case 403: {
        // ERR_NOSUCHCHANNEL: :server 403 yournick channel :No such channel
        const channel = params[1] || '';
        const errorMsg = params.slice(2).join(' ').replace(/^:/, '') || 'No such channel';
        this.addMessage({
          type: 'error',
          text: `${channel}: ${errorMsg}`,
          timestamp: timestamp
        });
        break;
      }

      case 404: {
        // ERR_CANNOTSENDTOCHAN: :server 404 yournick channel :Cannot send to channel
        const channel = params[1] || '';
        const errorMsg = params.slice(2).join(' ').replace(/^:/, '') || 'Cannot send to channel';
        this.addMessage({
          type: 'error',
          text: `${channel}: ${errorMsg}`,
          timestamp: timestamp
        });
        break;
      }

      case 421: {
        // ERR_UNKNOWNCOMMAND: :server 421 yournick command :Unknown command
        const command = params[1] || '';
        const errorMsg = params.slice(2).join(' ').replace(/^:/, '') || 'Unknown command';
        this.addMessage({
          type: 'error',
          text: `${command}: ${errorMsg}`,
          timestamp: timestamp
        });
        break;
      }

      case 432: {
        // ERR_ERRONEUSNICKNAME: :server 432 yournick nickname :Erroneous nickname
        const badNick = params[1] || '';
        const errorMsg = params.slice(2).join(' ').replace(/^:/, '') || 'Erroneous nickname';
        this.addMessage({
          type: 'error',
          text: `${badNick}: ${errorMsg}`,
          timestamp: timestamp
        });
        break;
      }

      case 433: {
        const requestedNick = params[1] || this.currentNick;
        this.addMessage({
          type: 'error',
          text: `Nickname is already in use: ${requestedNick}`,
          timestamp: timestamp,
        });
        
        if (this.altNick && this.nickChangeAttempts < 3) {
          this.nickChangeAttempts++;
          this.logRaw(`IRCService: Trying altnick: ${this.altNick}`);
          this.sendRaw(`NICK ${this.altNick}`);
          this.currentNick = this.altNick;
          this.addRawMessage(`*** Trying alternative nickname: ${this.altNick}`, 'auth');
        } else {
          const randomSuffix = Math.floor(Math.random() * 1000);
          const fallbackNick = `${this.currentNick}${randomSuffix}`;
          this.logRaw(`IRCService: Trying fallback nick: ${fallbackNick}`);
          this.sendRaw(`NICK ${fallbackNick}`);
          this.currentNick = fallbackNick;
          this.addRawMessage(`*** Trying fallback nickname: ${fallbackNick}`, 'auth');
        }
        break;
      }

      case 464:
        this.addMessage({
          type: 'error',
          text: 'Password incorrect',
          timestamp: timestamp,
        });
        break;

      case 465:
      case 484: {
        const reason = params.slice(1).join(' ') || 'Connection blocked or banned';
        this.addMessage({ type: 'error', text: reason, timestamp });
        this.addRawMessage(`*** Connection blocked: ${reason}`, 'connection');
        this.disconnect(reason);
        break;
      }

      // Channel error numerics
      case 441: {
        // ERR_USERNOTINCHANNEL: :server 441 yournick nick channel :They aren't on that channel
        const nick = params[1] || '';
        const channel = params[2] || '';
        const errorMsg = params.slice(3).join(' ').replace(/^:/, '') || "They aren't on that channel";
        this.addMessage({
          type: 'error',
          text: `${nick} ${channel}: ${errorMsg}`,
          timestamp: timestamp
        });
        break;
      }

      case 442: {
        // ERR_NOTONCHANNEL: :server 442 yournick channel :You're not on that channel
        const channel = params[1] || '';
        const errorMsg = params.slice(2).join(' ').replace(/^:/, '') || "You're not on that channel";
        this.addMessage({
          type: 'error',
          text: `${channel}: ${errorMsg}`,
          timestamp: timestamp
        });
        break;
      }

      case 461: {
        // ERR_NEEDMOREPARAMS: :server 461 yournick command :Not enough parameters
        const command = params[1] || '';
        const errorMsg = params.slice(2).join(' ').replace(/^:/, '') || 'Not enough parameters';
        this.addMessage({
          type: 'error',
          text: `${command}: ${errorMsg}`,
          timestamp: timestamp
        });
        break;
      }

      case 471: {
        // ERR_CHANNELISFULL: :server 471 yournick channel :Cannot join channel (+l)
        const channel = params[1] || '';
        const errorMsg = params.slice(2).join(' ').replace(/^:/, '') || 'Cannot join channel (channel is full)';
        this.addMessage({
          type: 'error',
          text: `${channel}: ${errorMsg}`,
          timestamp: timestamp
        });
        break;
      }

      case 472: {
        // ERR_UNKNOWNMODE: :server 472 yournick char :is unknown mode char to me
        const modeChar = params[1] || '';
        const errorMsg = params.slice(2).join(' ').replace(/^:/, '') || 'is unknown mode char';
        this.addMessage({
          type: 'error',
          text: `${modeChar}: ${errorMsg}`,
          timestamp: timestamp
        });
        break;
      }

      case 473: {
        // ERR_INVITEONLYCHAN: :server 473 yournick channel :Cannot join channel (+i)
        const channel = params[1] || '';
        const errorMsg = params.slice(2).join(' ').replace(/^:/, '') || 'Cannot join channel (invite only)';
        this.addMessage({
          type: 'error',
          text: `${channel}: ${errorMsg}`,
          timestamp: timestamp
        });
        break;
      }

      case 474: {
        // ERR_BANNEDFROMCHAN: :server 474 yournick channel :Cannot join channel (+b)
        const channel = params[1] || '';
        const errorMsg = params.slice(2).join(' ').replace(/^:/, '') || 'Cannot join channel (you are banned)';
        this.addMessage({
          type: 'error',
          text: `${channel}: ${errorMsg}`,
          timestamp: timestamp
        });
        break;
      }

      case 475: {
        // ERR_BADCHANNELKEY: :server 475 yournick channel :Cannot join channel (+k)
        const channel = params[1] || '';
        const errorMsg = params.slice(2).join(' ').replace(/^:/, '') || 'Cannot join channel (bad key)';
        this.addMessage({
          type: 'error',
          text: `${channel}: ${errorMsg}`,
          timestamp: timestamp
        });
        break;
      }

      case 476: {
        // ERR_BADCHANMASK: :server 476 yournick channel :Bad Channel Mask
        const channel = params[1] || '';
        const errorMsg = params.slice(2).join(' ').replace(/^:/, '') || 'Bad channel mask';
        this.addMessage({
          type: 'error',
          text: `${channel}: ${errorMsg}`,
          timestamp: timestamp
        });
        break;
      }

      case 477: {
        // ERR_NOCHANMODES: :server 477 yournick channel :Channel doesn't support modes
        const channel = params[1] || '';
        const errorMsg = params.slice(2).join(' ').replace(/^:/, '') || "Channel doesn't support modes";
        this.addMessage({
          type: 'error',
          text: `${channel}: ${errorMsg}`,
          timestamp: timestamp
        });
        break;
      }

      case 478: {
        // ERR_BANLISTFULL: :server 478 yournick channel char :Channel ban/ignore list is full
        const channel = params[1] || '';
        const errorMsg = params.slice(2).join(' ').replace(/^:/, '') || 'Channel ban list is full';
        this.addMessage({
          type: 'error',
          text: `${channel}: ${errorMsg}`,
          timestamp: timestamp
        });
        break;
      }

      case 482: {
        // ERR_CHANOPRIVSNEEDED: :server 482 yournick channel :You're not channel operator
        const channel = params[1] || '';
        const errorMsg = params.slice(2).join(' ').replace(/^:/, '') || "You're not channel operator";
        this.addMessage({
          type: 'error',
          text: `${channel}: ${errorMsg}`,
          timestamp: timestamp
        });
        break;
      }

      // Additional error numerics
      case 405: {
        // ERR_TOOMANYCHANNELS: :server 405 yournick channel :You have joined too many channels
        const channel = params[1] || '';
        const errorMsg = params.slice(2).join(' ').replace(/^:/, '') || 'You have joined too many channels';
        this.addMessage({
          type: 'error',
          text: `${channel}: ${errorMsg}`,
          timestamp: timestamp
        });
        break;
      }

      case 406: {
        // ERR_WASNOSUCHNICK: :server 406 yournick nick :There was no such nickname
        const nick = params[1] || '';
        const errorMsg = params.slice(2).join(' ').replace(/^:/, '') || 'There was no such nickname';
        this.addMessage({
          type: 'error',
          text: `${nick}: ${errorMsg}`,
          timestamp: timestamp
        });
        break;
      }

      case 407: {
        // ERR_TOOMANYTARGETS: :server 407 yournick target :Too many targets
        const target = params[1] || '';
        const errorMsg = params.slice(2).join(' ').replace(/^:/, '') || 'Too many targets';
        this.addMessage({
          type: 'error',
          text: `${target}: ${errorMsg}`,
          timestamp: timestamp
        });
        break;
      }

      case 411: {
        // ERR_NORECIPIENT: :server 411 yournick :No recipient given
        const errorMsg = params.slice(1).join(' ').replace(/^:/, '') || 'No recipient given';
        this.addMessage({
          type: 'error',
          text: errorMsg,
          timestamp: timestamp
        });
        break;
      }

      case 412: {
        // ERR_NOTEXTTOSEND: :server 412 yournick :No text to send
        const errorMsg = params.slice(1).join(' ').replace(/^:/, '') || 'No text to send';
        this.addMessage({
          type: 'error',
          text: errorMsg,
          timestamp: timestamp
        });
        break;
      }

      case 413: {
        // ERR_NOTOPLEVEL: :server 413 yournick mask :No toplevel domain specified
        const mask = params[1] || '';
        const errorMsg = params.slice(2).join(' ').replace(/^:/, '') || 'No toplevel domain specified';
        this.addMessage({
          type: 'error',
          text: `${mask}: ${errorMsg}`,
          timestamp: timestamp
        });
        break;
      }

      case 414: {
        // ERR_WILDTOPLEVEL: :server 414 yournick mask :Wildcard in toplevel domain
        const mask = params[1] || '';
        const errorMsg = params.slice(2).join(' ').replace(/^:/, '') || 'Wildcard in toplevel domain';
        this.addMessage({
          type: 'error',
          text: `${mask}: ${errorMsg}`,
          timestamp: timestamp
        });
        break;
      }

      case 415: {
        // ERR_BADMASK: :server 415 yournick mask :Bad server/host mask
        const mask = params[1] || '';
        const errorMsg = params.slice(2).join(' ').replace(/^:/, '') || 'Bad server/host mask';
        this.addMessage({
          type: 'error',
          text: `${mask}: ${errorMsg}`,
          timestamp: timestamp
        });
        break;
      }

      case 423: {
        // ERR_NOADMININFO: :server 423 yournick server :No administrative info available
        const server = params[1] || '';
        const errorMsg = params.slice(2).join(' ').replace(/^:/, '') || 'No administrative info available';
        this.addMessage({
          type: 'error',
          text: `${server}: ${errorMsg}`,
          timestamp: timestamp
        });
        break;
      }

      case 431: {
        // ERR_NONICKNAMEGIVEN: :server 431 yournick :No nickname given
        const errorMsg = params.slice(1).join(' ').replace(/^:/, '') || 'No nickname given';
        this.addMessage({
          type: 'error',
          text: errorMsg,
          timestamp: timestamp
        });
        break;
      }

      case 436: {
        // ERR_NICKCOLLISION: :server 436 yournick nickname :Nickname collision KILL
        const nick = params[1] || '';
        const errorMsg = params.slice(2).join(' ').replace(/^:/, '') || 'Nickname collision';
        this.addMessage({
          type: 'error',
          text: `${nick}: ${errorMsg}`,
          timestamp: timestamp
        });
        break;
      }

      case 437: {
        // ERR_UNAVAILRESOURCE: :server 437 yournick nick/channel :Nick/channel is temporarily unavailable
        const resource = params[1] || '';
        const errorMsg = params.slice(2).join(' ').replace(/^:/, '') || 'Resource temporarily unavailable';
        this.addMessage({
          type: 'error',
          text: `${resource}: ${errorMsg}`,
          timestamp: timestamp
        });
        break;
      }

      case 443: {
        // ERR_USERONCHANNEL: :server 443 yournick nick channel :is already on channel
        const nick = params[1] || '';
        const channel = params[2] || '';
        const errorMsg = params.slice(3).join(' ').replace(/^:/, '') || 'is already on channel';
        this.addMessage({
          type: 'error',
          text: `${nick} ${channel}: ${errorMsg}`,
          timestamp: timestamp
        });
        break;
      }

      case 451: {
        // ERR_NOTREGISTERED: :server 451 yournick :You have not registered
        const errorMsg = params.slice(1).join(' ').replace(/^:/, '') || 'You have not registered';
        this.addMessage({
          type: 'error',
          text: errorMsg,
          timestamp: timestamp
        });
        break;
      }

      case 462: {
        // ERR_ALREADYREGISTRED: :server 462 yournick :You may not reregister
        const errorMsg = params.slice(1).join(' ').replace(/^:/, '') || 'You may not reregister';
        this.addMessage({
          type: 'error',
          text: errorMsg,
          timestamp: timestamp
        });
        break;
      }

      case 463: {
        // ERR_NOPERMFORHOST: :server 463 yournick :Your host isn't among the privileged
        const errorMsg = params.slice(1).join(' ').replace(/^:/, '') || "Your host isn't among the privileged";
        this.addMessage({
          type: 'error',
          text: errorMsg,
          timestamp: timestamp
        });
        break;
      }

      case 466: {
        // ERR_YOUWILLBEBANNED: :server 466 yournick :You will be banned
        const errorMsg = params.slice(1).join(' ').replace(/^:/, '') || 'You will be banned';
        this.addMessage({
          type: 'error',
          text: errorMsg,
          timestamp: timestamp
        });
        break;
      }

      case 467: {
        // ERR_KEYSET: :server 467 yournick channel :Channel key already set
        const channel = params[1] || '';
        const errorMsg = params.slice(2).join(' ').replace(/^:/, '') || 'Channel key already set';
        this.addMessage({
          type: 'error',
          text: `${channel}: ${errorMsg}`,
          timestamp: timestamp
        });
        break;
      }

      case 481: {
        // ERR_NOPRIVILEGES: :server 481 yournick :Permission Denied- You're not an IRC operator
        const errorMsg = params.slice(1).join(' ').replace(/^:/, '') || "Permission denied - You're not an IRC operator";
        this.addMessage({
          type: 'error',
          text: errorMsg,
          timestamp: timestamp
        });
        break;
      }

      case 483: {
        // ERR_CANTKILLSERVER: :server 483 yournick :You can't kill a server!
        const errorMsg = params.slice(1).join(' ').replace(/^:/, '') || "You can't kill a server!";
        this.addMessage({
          type: 'error',
          text: errorMsg,
          timestamp: timestamp
        });
        break;
      }

      case 491: {
        // ERR_NOOPERHOST: :server 491 yournick :No O-lines for your host
        const errorMsg = params.slice(1).join(' ').replace(/^:/, '') || 'No O-lines for your host';
        this.addMessage({
          type: 'error',
          text: errorMsg,
          timestamp: timestamp
        });
        break;
      }

      case 501: {
        // ERR_UMODEUNKNOWNFLAG: :server 501 yournick :Unknown MODE flag
        const errorMsg = params.slice(1).join(' ').replace(/^:/, '') || 'Unknown MODE flag';
        this.addMessage({
          type: 'error',
          text: errorMsg,
          timestamp: timestamp
        });
        break;
      }

      case 502: {
        // ERR_USERSDONTMATCH: :server 502 yournick :Can't change mode for other users
        const errorMsg = params.slice(1).join(' ').replace(/^:/, '') || "Can't change mode for other users";
        this.addMessage({
          type: 'error',
          text: errorMsg,
          timestamp: timestamp
        });
        break;
      }

      case 903:
        this.saslAuthenticating = false;
        this.addMessage({ type: 'raw', text: '*** SASL authentication successful', timestamp: timestamp, isRaw: true, rawCategory: 'auth' });
        this.endCAPNegotiation();
        break;

      case 904:
        this.saslAuthenticating = false;
        this.addMessage({ type: 'error', text: 'SASL authentication failed', timestamp: timestamp });
        this.endCAPNegotiation();
        break;

      // Extended SASL numerics
      case 900: {
        // RPL_LOGGEDIN: :server 900 yournick nick!user@host account :You are now logged in as username
        const accountInfo = params[1] || '';
        const account = params[2] || '';
        const message = params.slice(3).join(' ').replace(/^:/, '') || `You are now logged in as ${account}`;
        this.addMessage({
          type: 'raw',
          text: `*** ${message}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'auth'
        });
        break;
      }

      case 901: {
        // RPL_LOGGEDOUT: :server 901 yournick nick!user@host :You are now logged out
        const message = params.slice(2).join(' ').replace(/^:/, '') || 'You are now logged out';
        this.addMessage({
          type: 'raw',
          text: `*** ${message}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'auth'
        });
        break;
      }

      case 902: {
        // ERR_NICKLOCKED: :server 902 yournick :You must use a nick assigned to you
        const errorMsg = params.slice(1).join(' ').replace(/^:/, '') || 'You must use a nick assigned to you';
        this.addMessage({
          type: 'error',
          text: errorMsg,
          timestamp: timestamp
        });
        break;
      }

      case 905: {
        // ERR_SASLTOOLONG: :server 905 yournick :SASL message too long
        const errorMsg = params.slice(1).join(' ').replace(/^:/, '') || 'SASL message too long';
        this.addMessage({
          type: 'error',
          text: errorMsg,
          timestamp: timestamp
        });
        break;
      }

      case 906: {
        // ERR_SASLABORTED: :server 906 yournick :SASL authentication aborted
        const errorMsg = params.slice(1).join(' ').replace(/^:/, '') || 'SASL authentication aborted';
        this.addMessage({
          type: 'error',
          text: errorMsg,
          timestamp: timestamp
        });
        this.saslAuthenticating = false;
        this.endCAPNegotiation();
        break;
      }

      case 907: {
        // ERR_SASLALREADY: :server 907 yournick :You have already authenticated
        const errorMsg = params.slice(1).join(' ').replace(/^:/, '') || 'You have already authenticated';
        this.addMessage({
          type: 'error',
          text: errorMsg,
          timestamp: timestamp
        });
        break;
      }

      case 908: {
        // RPL_SASLMECHS: :server 908 yournick mechanisms :are available SASL mechanisms
        const mechanisms = params[1] || '';
        const message = params.slice(2).join(' ').replace(/^:/, '') || 'are available SASL mechanisms';
        this.addMessage({
          type: 'raw',
          text: `*** ${mechanisms} ${message}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'auth'
        });
        break;
      }

      // WATCH/MONITOR numerics
      case 600: {
        // RPL_LOGON: :server 600 yournick nick user host * :logged online
        const watchNick = params[1] || '';
        const watchUser = params[2] || '';
        const watchHost = params[3] || '';
        const message = params.slice(5).join(' ').replace(/^:/, '') || 'logged online';
        this.addMessage({
          type: 'raw',
          text: `*** ${watchNick} (${watchUser}@${watchHost}) ${message}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'user'
        });
        break;
      }

      case 601: {
        // RPL_LOGOFF: :server 601 yournick nick user host * :logged offline
        const watchNick = params[1] || '';
        const watchUser = params[2] || '';
        const watchHost = params[3] || '';
        const message = params.slice(5).join(' ').replace(/^:/, '') || 'logged offline';
        this.addMessage({
          type: 'raw',
          text: `*** ${watchNick} (${watchUser}@${watchHost}) ${message}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'user'
        });
        break;
      }

      case 602: {
        // RPL_WATCHOFF: :server 602 yournick nick user host * :stopped watching
        const watchNick = params[1] || '';
        this.addMessage({
          type: 'raw',
          text: `*** Stopped watching ${watchNick}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'user'
        });
        break;
      }

      case 603: {
        // RPL_WATCHSTAT: :server 603 yournick :You have X and are on Y WATCH entries
        const stats = params.slice(1).join(' ').replace(/^:/, '') || '';
        this.addMessage({
          type: 'raw',
          text: `*** ${stats}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'user'
        });
        break;
      }

      case 604: {
        // RPL_NOWON: :server 604 yournick nick user host * :is online
        const watchNick = params[1] || '';
        const watchUser = params[2] || '';
        const watchHost = params[3] || '';
        const message = params.slice(5).join(' ').replace(/^:/, '') || 'is online';
        this.addMessage({
          type: 'raw',
          text: `*** ${watchNick} (${watchUser}@${watchHost}) ${message}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'user'
        });
        break;
      }

      case 605: {
        // RPL_NOWOFF: :server 605 yournick nick user host * :is offline
        const watchNick = params[1] || '';
        const watchUser = params[2] || '';
        const watchHost = params[3] || '';
        const message = params.slice(5).join(' ').replace(/^:/, '') || 'is offline';
        this.addMessage({
          type: 'raw',
          text: `*** ${watchNick} (${watchUser}@${watchHost}) ${message}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'user'
        });
        break;
      }

      case 606: {
        // RPL_WATCHLIST: :server 606 yournick :nick1 nick2 nick3
        const watchList = params.slice(1).join(' ').replace(/^:/, '') || '';
        this.addMessage({
          type: 'raw',
          text: `*** WATCH list: ${watchList}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'user'
        });
        break;
      }

      case 607: {
        // RPL_ENDOFWATCHLIST: :server 607 yournick :End of WATCH list
        const message = params.slice(1).join(' ').replace(/^:/, '') || 'End of WATCH list';
        this.addMessage({
          type: 'raw',
          text: `*** ${message}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'user'
        });
        break;
      }

      case 608: {
        // RPL_WATCHCLEAR: :server 608 yournick :WATCH list cleared
        const message = params.slice(1).join(' ').replace(/^:/, '') || 'WATCH list cleared';
        this.addMessage({
          type: 'raw',
          text: `*** ${message}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'user'
        });
        break;
      }

      case 730: {
        // RPL_MONONLINE: :server 730 yournick :nick!user@host,nick2!user@host
        const onlineList = params.slice(1).join(' ').replace(/^:/, '') || '';
        this.addMessage({
          type: 'raw',
          text: `*** MONITOR online: ${onlineList}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'server'
        });
        break;
      }

      case 731: {
        // RPL_MONOFFLINE: :server 731 yournick :nick,nick2,nick3
        const offlineList = params.slice(1).join(' ').replace(/^:/, '') || '';
        this.addMessage({
          type: 'raw',
          text: `*** MONITOR offline: ${offlineList}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'server'
        });
        break;
      }

      case 732: {
        // RPL_MONLIST: :server 732 yournick :nick1,nick2,nick3
        const monList = params.slice(1).join(' ').replace(/^:/, '') || '';
        this.addMessage({
          type: 'raw',
          text: `*** MONITOR list: ${monList}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'server'
        });
        break;
      }

      case 733: {
        // RPL_ENDOFMONLIST: :server 733 yournick :End of MONITOR list
        const message = params.slice(1).join(' ').replace(/^:/, '') || 'End of MONITOR list';
        this.addMessage({
          type: 'raw',
          text: `*** ${message}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'server'
        });
        break;
      }

      case 734: {
        // RPL_MONLISTFULL: :server 734 yournick limit nicks :Monitor list is full
        const limit = params[1] || '';
        const nicks = params[2] || '';
        const message = params.slice(3).join(' ').replace(/^:/, '') || 'Monitor list is full';
        this.addMessage({
          type: 'error',
          text: `${message} (limit: ${limit}, tried: ${nicks})`,
          timestamp: timestamp
        });
        break;
      }

      // Security/extended numerics
      case 670: {
        // RPL_STARTTLS: :server 670 yournick :STARTTLS successful
        const message = params.slice(1).join(' ').replace(/^:/, '') || 'STARTTLS successful';
        this.addMessage({
          type: 'raw',
          text: `*** ${message}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'server'
        });
        break;
      }

      case 691: {
        // ERR_STARTTLS: :server 691 yournick :STARTTLS failed
        const errorMsg = params.slice(1).join(' ').replace(/^:/, '') || 'STARTTLS failed';
        this.addMessage({
          type: 'error',
          text: errorMsg,
          timestamp: timestamp
        });
        break;
      }

      case 690:
      case 692:
      case 693:
      case 694:
      case 695:
      case 696:
      case 697:
      case 698:
      case 699: {
        // Language/encoding and other extended numerics - Generic handler
        const extData = params.slice(1).join(' ').replace(/^:/, '') || '';
        this.addMessage({
          type: 'raw',
          text: `*** [${numeric}] ${extData}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'server'
        });
        break;
      }

      // Away status numerics
      case 301: {
        // RPL_AWAY: :server 301 yournick theirnick :away message
        const awayNick = params[1] || '';
        const awayMsg = params.slice(2).join(' ').replace(/^:/, '') || 'is away';
        this.addMessage({
          type: 'raw',
          text: `*** ${awayNick} is away: ${awayMsg}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'server'
        });
        break;
      }

      case 305: {
        // RPL_UNAWAY: :server 305 yournick :You are no longer marked as being away
        const message = params.slice(1).join(' ').replace(/^:/, '') || 'You are no longer marked as being away';
        this.addMessage({
          type: 'raw',
          text: `*** ${message}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'server'
        });
        break;
      }

      case 306: {
        // RPL_NOWAWAY: :server 306 yournick :You have been marked as being away
        const message = params.slice(1).join(' ').replace(/^:/, '') || 'You have been marked as being away';
        this.addMessage({
          type: 'raw',
          text: `*** ${message}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'server'
        });
        break;
      }

      // User info numerics
      case 302: {
        // RPL_USERHOST: :server 302 yournick :nick=+user@host nick2=-user@host
        const userhostData = params.slice(1).join(' ').replace(/^:/, '') || '';
        this.addMessage({
          type: 'raw',
          text: `*** USERHOST: ${userhostData}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'server'
        });
        break;
      }

      case 303: {
        // RPL_ISON: :server 303 yournick :nick1 nick2 nick3
        const onlineNicks = params.slice(1).join(' ').replace(/^:/, '') || '';
        this.addMessage({
          type: 'raw',
          text: `*** Online: ${onlineNicks}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'server'
        });
        break;
      }

      // WHOIS response handlers
      case 311: {
        // RPL_WHOISUSER: :server 311 yournick theirnick username host * :realname
        const whoisNick = params[1] || '';
        const whoisUser = params[2] || '';
        const whoisHost = params[3] || '';
        const whoisReal = params.slice(5).join(' ').replace(/^:/, '') || '';
        this.addMessage({
          type: 'raw',
          text: `*** ${whoisNick} is ${whoisUser}@${whoisHost} * ${whoisReal}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'server'
        });
        break;
      }

      case 317: {
        // RPL_WHOISIDLE: :server 317 yournick theirnick idle_seconds signon_time :seconds idle, signon time
        const whoisNick = params[1] || '';
        const idleSeconds = parseInt(params[2] || '0', 10);
        const signonTime = parseInt(params[3] || '0', 10);
        const idleMinutes = Math.floor(idleSeconds / 60);
        const idleHours = Math.floor(idleMinutes / 60);
        const remainingMinutes = idleMinutes % 60;

        let idleText = '';
        if (idleHours > 0) {
          idleText = `${idleHours} hours, ${remainingMinutes} minutes`;
        } else if (idleMinutes > 0) {
          idleText = `${idleMinutes} minutes`;
        } else {
          idleText = `${idleSeconds} seconds`;
        }

        const signonDate = signonTime > 0 ? new Date(signonTime * 1000).toLocaleString() : 'unknown';
        this.addMessage({
          type: 'raw',
          text: `*** ${whoisNick} has been idle ${idleText}, signed on ${signonDate}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'server'
        });
        break;
      }

      case 318: {
        // RPL_ENDOFWHOIS: :server 318 yournick theirnick :End of WHOIS
        const whoisNick = params[1] || '';
        this.addMessage({
          type: 'raw',
          text: `*** End of WHOIS for ${whoisNick}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'server'
        });
        break;
      }

      case 319: {
        // RPL_WHOISCHANNELS: :server 319 yournick theirnick :@#channel1 +#channel2 #channel3
        const whoisNick = params[1] || '';
        const channels = params.slice(2).join(' ').replace(/^:/, '') || '';
        this.addMessage({
          type: 'raw',
          text: `*** ${whoisNick} is on channels: ${channels}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'server'
        });
        break;
      }

      // Additional WHOIS numerics
      case 307: {
        // RPL_WHOISREGNICK: :server 307 yournick theirnick :has identified for this nick
        const whoisNick = params[1] || '';
        const message = params.slice(2).join(' ').replace(/^:/, '') || 'has identified for this nick';
        this.addMessage({
          type: 'raw',
          text: `*** ${whoisNick} ${message}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'server'
        });
        break;
      }

      case 310: {
        // RPL_WHOISHELP: :server 310 yournick theirnick :is available for help
        const whoisNick = params[1] || '';
        const message = params.slice(2).join(' ').replace(/^:/, '') || 'is available for help';
        this.addMessage({
          type: 'raw',
          text: `*** ${whoisNick} ${message}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'server'
        });
        break;
      }

      case 313: {
        // RPL_WHOISOPERATOR: :server 313 yournick theirnick :is an IRC operator
        const whoisNick = params[1] || '';
        const message = params.slice(2).join(' ').replace(/^:/, '') || 'is an IRC operator';
        this.addMessage({
          type: 'raw',
          text: `*** ${whoisNick} ${message}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'user'
        });
        if (whoisNick && whoisNick === this.currentNick) {
          this.addRawMessage('*** You are now an IRC operator. Quick aliases: /oper /kill /gline /rehash /locops /wallops', 'user');
        }
        break;
      }

      case 335: {
        // RPL_WHOISBOT: :server 335 yournick theirnick :is a bot
        const whoisNick = params[1] || '';
        const message = params.slice(2).join(' ').replace(/^:/, '') || 'is a bot';
        this.addMessage({
          type: 'raw',
          text: `*** ${whoisNick} ${message}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'server'
        });
        break;
      }

      case 378: {
        // RPL_WHOISHOST: :server 378 yournick theirnick :is connecting from *@host 1.2.3.4
        const whoisNick = params[1] || '';
        const hostInfo = params.slice(2).join(' ').replace(/^:/, '') || '';
        this.addMessage({
          type: 'raw',
          text: `*** ${whoisNick} ${hostInfo}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'server'
        });
        break;
      }

      case 671: {
        // RPL_WHOISSECURE: :server 671 yournick theirnick :is using a secure connection
        const whoisNick = params[1] || '';
        const message = params.slice(2).join(' ').replace(/^:/, '') || 'is using a secure connection';
        this.addMessage({
          type: 'raw',
          text: `*** ${whoisNick} ${message}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'server'
        });
        break;
      }

      // WHOWAS response handlers
      case 314: {
        // RPL_WHOWASUSER: :server 314 yournick theirnick username host * :realname
        const whowasNick = params[1] || '';
        const whowasUser = params[2] || '';
        const whowasHost = params[3] || '';
        const whowasReal = params.slice(5).join(' ').replace(/^:/, '') || '';
        this.addMessage({
          type: 'raw',
          text: `*** ${whowasNick} was ${whowasUser}@${whowasHost} * ${whowasReal}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'server'
        });
        break;
      }

      case 312: {
        // RPL_WHOISSERVER: :server 312 yournick theirnick server.name :server info
        const targetNick = params[1] || '';
        const serverName = params[2] || '';
        const serverInfo = params.slice(3).join(' ').replace(/^:/, '') || '';
        this.addMessage({
          type: 'raw',
          text: `*** ${targetNick} using ${serverName} ${serverInfo}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'server'
        });
        break;
      }

      case 330: {
        // RPL_WHOISACCOUNT: :server 330 yournick theirnick accountname :is logged in as
        const targetNick = params[1] || '';
        const accountName = params[2] || '';
        this.addMessage({
          type: 'raw',
          text: `*** ${targetNick} is logged in as ${accountName}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'user'
        });
        break;
      }

      case 338: {
        // RPL_WHOISACTUALLY: :server 338 yournick theirnick actualhost :actually using host
        const targetNick = params[1] || '';
        const actualHost = params[2] || '';
        this.addMessage({
          type: 'raw',
          text: `*** ${targetNick} is actually using host ${actualHost}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'server'
        });
        break;
      }

      case 369: {
        // RPL_ENDOFWHOWAS: :server 369 yournick theirnick :End of WHOWAS
        const whowasNick = params[1] || '';
        this.addMessage({
          type: 'raw',
          text: `*** End of WHOWAS for ${whowasNick}`,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'server'
        });
        break;
      }

      default: {
        // Improved numeric response formatting
        const targetParam = params[0] || '';
        const shouldSkipTarget = targetParam &&
          this.currentNick &&
          targetParam.toLowerCase() === this.currentNick.toLowerCase();

        const payloadParts = shouldSkipTarget ? params.slice(1) : params;
        const cleanedParts = payloadParts.map(part => part.replace(/^:/, '')).filter(part => part.length > 0);
        let displayText = cleanedParts.join(' ').trim();

        if (!displayText) {
          displayText = params.map(part => part.replace(/^:/, '')).filter(part => part.length > 0).join(' ').trim();
        }

        if (!displayText) {
          displayText = `Server response`;
        }

        // Add numeric code prefix for context
        const formattedText = `[${numeric}] ${displayText}`;

        this.addMessage({
          type: 'raw',
          text: formattedText,
          timestamp: timestamp,
          isRaw: true,
          rawCategory: 'server'
        });
        break;
      }
    }
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
    if (!this.capEnabledSet.has('sasl')) return;

    if (this.config?.clientCert && this.config?.clientKey) {
      this.logRaw('IRCService: Starting SASL EXTERNAL authentication');
      this.saslAuthenticating = true;
      this.sendRaw('AUTHENTICATE EXTERNAL');
      return;
    }

    if (!this.config?.sasl) return;
    
    this.logRaw('IRCService: Starting SASL PLAIN authentication');
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
    const subcommand = params[0]?.toUpperCase();
    
    switch (subcommand) {
      case 'LS':
        let capabilities = '';
        let isLastLine = false;
        
        if (params.length >= 2) {
          if (params[1] === '*') {
            capabilities = params.slice(2).join(' ').replace(/^:/, '');
          } else {
            isLastLine = true;
            capabilities = params.slice(1).join(' ').replace(/^:/, '');
          }
        }
        
        const capList = capabilities.split(/\s+/).filter(c => c && c !== '*');
        
        capList.forEach(cap => {
          const [name, value] = cap.split('=');
          if (name) {
            this.capAvailable.add(name);
            this.logRaw(`IRCService: CAP available: ${name}${value ? '='+value : ''}`);
          }
        });
        
        if (isLastLine) {
          this.capLSReceived = true;
          this.emit('capabilities', Array.from(this.capAvailable));
          this.requestCapabilities();
        }
        break;
        
      case 'ACK':
        const ackCapsString = params.slice(1).join(' ').replace(/^:/, '');
        const ackCaps = ackCapsString.split(/\s+/).filter(c => c);
        
        ackCaps.forEach(cap => {
          const [capName, capValue] = cap.split('=');
          if (capName) {
            this.capEnabledSet.add(capName);
            this.logRaw(`IRCService: CAP enabled: ${capName}`);
            if (capName === 'sts' && capValue && this.config) {
              this.emit('sts-policy', this.config.host, capValue);
            }
          }
        });
        
        if (this.config?.sasl && this.capEnabledSet.has('sasl') && !this.saslAuthenticating) {
          setTimeout(() => this.startSASL(), 50);
          return;
        }
        
        this.endCAPNegotiation();
        break;
        
      case 'NAK':
        const nakCaps = params.slice(1).join(' ').replace(/^:/, '').split(/\s+/).filter(c => c);
        nakCaps.forEach(cap => {
          this.logRaw(`IRCService: CAP rejected: ${cap}`);
          this.capRequested.delete(cap);
        });
        
        this.endCAPNegotiation();
        break;
    }
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
    const capsToRequest: string[] = [
      'server-time', 'account-notify', 'extended-join', 'userhost-in-names',
      'away-notify', 'chghost', 'message-tags', 'batch', 'labeled-response',
      'echo-message', 'multi-prefix', 'invite-notify', 'monitor', 'sts'
    ].filter(cap => this.capAvailable.has(cap));
    
    if ((this.config?.sasl || (this.config?.clientCert && this.config?.clientKey)) && this.capAvailable.has('sasl')) {
      capsToRequest.push('sasl');
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
        const user = nick.substring(exclamation + 1, at);
        host = nick.substring(at + 1);
        nick = parsedNick;
        if (user && user !== '*') account = user;
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
    const setBy = topicInfo.setBy || 'unknown';
    const setAtDisplay = topicInfo.setAt ? new Date((topicInfo.setAt || 0) * 1000).toString() : 'unknown';
    const modesDisplay = topicInfo.modes || 'unknown';

    const lines = [
      `Topic: ${topicInfo.topic}`,
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

  private handleChannelModeChange(channel: string, modeParams: string[]): void {
    if (modeParams.length === 0) return;
    
    const usersMap = this.channelUsers.get(channel);
    if (!usersMap) return;
    
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
      this.socket.write(message + '\r\n');
      this.addWireMessage('out', message);
      this.emit('send-raw', message);
    }
  }

  disconnect(message?: string): void {
    this.manualDisconnect = true;
    if (this.socket) {
      if (this.isConnected) {
        this.sendRaw(`QUIT :${message || DEFAULT_QUIT_MESSAGE}`);
      }
      try {
        this.socket.destroy();
      } catch (error: any) {
        // Socket may have already been destroyed
        this.logRaw(`IRCService: Socket destroy error (ignored): ${error?.message || error}`);
      }
      this.socket = null;
      this.isConnected = false;
      this.registered = false;
      this.emitConnection(false);
      this.addRawMessage('*** Disconnected from server', 'connection');
    }
    this.channelUsers.clear();
    this.namesBuffer.clear();
    this.channelUsers.forEach((_, channel) => this.emit('clear-channel', channel));
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
        this.sendCTCPResponse(from, 'VERSION', 'AndroidIRCX 1.0 React Native :https://github.com/AndroidIRCX');
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
      default:
        this.logRaw(`Unknown CTCP command: ${command} from ${from}`);
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

  partChannel(channel: string, message?: string): void {
    if (this.isConnected) {
      const partMessage = message && message.trim() ? message : DEFAULT_PART_MESSAGE;
      this.sendRaw(partMessage ? `PART ${channel} :${partMessage}` : `PART ${channel}`);
    }
  }

  sendMessage(target: string, message: string, fromQueue: boolean = false): void {
    if (!this.isConnected && !fromQueue) {
      this.emit('queue-message', this.getNetworkName(), target, message);
      this.addMessage({ type: 'message', channel: target, from: this.currentNick, text: message, timestamp: Date.now(), status: 'pending' });
      return;
    }
    
    if (message.startsWith('/')) {
      const commandText = message.substring(1).trim();
      const parts = commandText.split(' ');
      const command = parts[0].toUpperCase();
      const args = parts.slice(1);
      
      switch (command) {
        case 'JOIN': if (args.length > 0) this.joinChannel(args[0], args[1]); break;
        case 'PART': this.partChannel(args.length > 0 ? args[0] : target, args.slice(1).join(' ')); break;
        case 'NICK': if (args.length > 0) this.sendRaw(`NICK ${args[0]}`); break;
        case 'QUIT': this.sendRaw(`QUIT :${args.join(' ') || DEFAULT_QUIT_MESSAGE}`); break;
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
            this.addMessage({ type: 'error', text: `Usage: /${command} <nick|channel> <message>`, timestamp: Date.now() });
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
              this.addMessage({ type: 'notice', text: `*** Encryption key offer sent to ${keyTarget}. Waiting for acceptance...`, timestamp: Date.now() });
            }).catch(e => {
              this.addMessage({ type: 'error', text: `*** Failed to share encryption key: ${e.message}`, timestamp: Date.now() });
            });
          } else {
            this.addMessage({ type: 'error', text: 'Usage: /sharekey <nick>', timestamp: Date.now() });
          }
          break;
        case 'REQUESTKEY':
          if (args.length > 0) {
            const reqTarget = args[0];
            this.sendRaw(`PRIVMSG ${reqTarget} :!enc-req`);
            this.addMessage({ type: 'notice', text: `*** Encryption key requested from ${reqTarget}`, timestamp: Date.now() });
          } else {
            this.addMessage({ type: 'error', text: 'Usage: /requestkey <nick>', timestamp: Date.now() });
          }
          break;
        case 'ENCMSG':
          if (args.length >= 2) {
            const encTarget = args[0];
            const encPlaintext = args.slice(1).join(' ');
            encryptedDMService.encrypt(encPlaintext, encTarget).then(payload => {
              this.sendRaw(`PRIVMSG ${encTarget} :!enc-msg ${JSON.stringify(payload)}`);
              this.addMessage({ type: 'message', channel: encTarget, from: this.currentNick, text: `🔒 ${encPlaintext}`, timestamp: Date.now(), status: 'sent' });
            }).catch(e => {
              this.addMessage({ type: 'error', text: `*** Encrypted send failed (${e.message}). Use "Request Encryption Key" from the user menu.`, timestamp: Date.now() });
            });
          } else {
            this.addMessage({ type: 'error', text: 'Usage: /encmsg <nick> <message>', timestamp: Date.now() });
          }
          break;
        case 'ENC':
        case 'ENCRYPT':
          this.addMessage({ type: 'notice', text: 'DM encryption:', timestamp: Date.now() });
          this.addMessage({ type: 'notice', text: '/sharekey <nick>          Offer your DM key', timestamp: Date.now() });
          this.addMessage({ type: 'notice', text: '/requestkey <nick>        Request DM key', timestamp: Date.now() });
          this.addMessage({ type: 'notice', text: '/encmsg <nick> <message>  Send encrypted DM', timestamp: Date.now() });
          this.addMessage({ type: 'notice', text: 'Tips: keys must be exchanged first; use /requestkey if not paired.', timestamp: Date.now() });
          break;
        case 'CHANKEY':
          if (args.length === 0) {
            this.addMessage({ type: 'error', text: 'Usage: /chankey <generate|share|request|remove|send|help> [args]', timestamp: Date.now() });
            break;
          }
          const chankeyAction = args[0].toLowerCase();
          switch (chankeyAction) {
            case 'help':
              this.addMessage({ type: 'notice', text: 'Channel encryption:', timestamp: Date.now() });
              this.addMessage({ type: 'notice', text: '/chankey generate          Create key for current channel', timestamp: Date.now() });
              this.addMessage({ type: 'notice', text: '/chankey share <nick>     Send key to a user (in channel)', timestamp: Date.now() });
              this.addMessage({ type: 'notice', text: '/chankey request <nick>   Ask a user for the channel key', timestamp: Date.now() });
              this.addMessage({ type: 'notice', text: '/chankey send <msg>       Send encrypted message to channel', timestamp: Date.now() });
              this.addMessage({ type: 'notice', text: '/chankey remove           Delete stored key for channel', timestamp: Date.now() });
              break;
            case 'generate':
              if (!target.startsWith('#') && !target.startsWith('&')) {
                this.addMessage({ type: 'error', text: '*** Channel key can only be generated in a channel', timestamp: Date.now() });
                break;
              }
              channelEncryptionService.generateChannelKey(target, this.getNetworkName()).then(() => {
                this.addMessage({ type: 'notice', text: `*** Channel encryption key generated for ${target}. Use /chankey share <nick> to share with others.`, timestamp: Date.now() });
              }).catch(e => {
                this.addMessage({ type: 'error', text: `*** Failed to generate channel key: ${e.message}`, timestamp: Date.now() });
              });
              break;
            case 'send':
              if (args.length < 2) {
                this.addMessage({ type: 'error', text: 'Usage: /chankey send <message>', timestamp: Date.now() });
                break;
              }
              if (!target.startsWith('#') && !target.startsWith('&')) {
                this.addMessage({ type: 'error', text: '*** Channel key send must be used from a channel', timestamp: Date.now() });
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
                    text: `🔒 ${encText}`,
                    timestamp: Date.now(),
                    status: 'sent',
                  });
                })
                .catch(e => {
                  this.addMessage({
                    type: 'error',
                    text: `*** Channel encryption send failed: ${e.message === 'no channel key' ? 'Missing channel key. Use /chankey generate and share first.' : e.message}`,
                    timestamp: Date.now(),
                  });
                });
              break;
            case 'share':
              if (args.length < 2) {
                this.addMessage({ type: 'error', text: 'Usage: /chankey share <nick>', timestamp: Date.now() });
                break;
              }
              if (!target.startsWith('#') && !target.startsWith('&')) {
                this.addMessage({ type: 'error', text: '*** Channel key can only be shared from a channel', timestamp: Date.now() });
                break;
              }
              const shareTarget = args[1];
              channelEncryptionService.exportChannelKey(target, this.getNetworkName()).then(keyData => {
                this.sendRaw(`PRIVMSG ${shareTarget} :!chanenc-key ${keyData}`);
                this.addMessage({ type: 'notice', text: `*** Channel key for ${target} shared with ${shareTarget}`, timestamp: Date.now() });
              }).catch(e => {
                this.addMessage({ type: 'error', text: `*** Failed to share channel key: ${e.message}. Generate a key first with /chankey generate`, timestamp: Date.now() });
              });
              break;
            case 'request':
              if (args.length < 2) {
                this.addMessage({ type: 'error', text: 'Usage: /chankey request <nick>', timestamp: Date.now() });
                break;
              }
              if (!target.startsWith('#') && !target.startsWith('&')) {
                this.addMessage({ type: 'error', text: '*** Channel key request must be done from a channel', timestamp: Date.now() });
                break;
              }
              const requestTarget = args[1];
              this.sendRaw(`PRIVMSG ${requestTarget} :Please share the channel key for ${target} with /chankey share ${this.currentNick}`);
              this.addMessage({ type: 'notice', text: `*** Channel key requested from ${requestTarget} for ${target}`, timestamp: Date.now() });
              break;
            case 'remove':
              if (!target.startsWith('#') && !target.startsWith('&')) {
                this.addMessage({ type: 'error', text: '*** Channel key can only be removed from a channel', timestamp: Date.now() });
                break;
              }
              channelEncryptionService.removeChannelKey(target, this.getNetworkName()).then(() => {
                this.addMessage({ type: 'notice', text: `*** Channel encryption key removed for ${target}`, timestamp: Date.now() });
              }).catch(e => {
                this.addMessage({ type: 'error', text: `*** Failed to remove channel key: ${e.message}`, timestamp: Date.now() });
              });
              break;
            default:
              this.addMessage({ type: 'error', text: 'Usage: /chankey <generate|share|request|remove|send|help> [args]', timestamp: Date.now() });
          }
          break;
        default: this.sendCommand(commandText); break;
      }
      return;
    }
    
    this.sendRaw(`PRIVMSG ${target} :${message}`);
    this.addMessage({ type: 'message', channel: target, from: this.currentNick, text: message, timestamp: Date.now(), status: 'sent' });
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

  getConnectionStatus(): boolean {
    return this.isConnected;
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

  private addMessage(message: Omit<IRCMessage, 'id' | 'network'> & { status?: 'pending' | 'sent' }): void {
    const fullMessage: IRCMessage = { ...message, id: `${Date.now()}-${Math.random()}`, network: this.getNetworkName() };
    if (this.verboseLogging) {
      this.logRaw(`IRCService: Adding message - Type: ${fullMessage.type}, Channel: ${fullMessage.channel || 'N/A'}, Text: ${fullMessage.text?.substring(0, 50) || 'N/A'}`);
    }
    this.emitMessage(fullMessage);
  }

  addRawMessage(text: string, category: RawMessageCategory = 'debug', timestamp: number = Date.now()): void {
    this.addMessage({ type: 'raw', text, timestamp, isRaw: true, rawCategory: category });
  }

  private addWireMessage(direction: 'in' | 'out', line: string, timestamp: number = Date.now()): void {
    const arrow = direction === 'in' ? '<--' : '-->';
    this.addRawMessage(`*** ${arrow} ${line}`, direction === 'in' ? 'trafficIn' : 'trafficOut', timestamp);
  }

  private emitMessage(message: IRCMessage): void {
    if (this.verboseLogging) {
      this.logRaw(`IRCService: Emitting message to ${this.messageListeners.length} listeners`);
    }
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
  }
}

export const ircService = new IRCService();

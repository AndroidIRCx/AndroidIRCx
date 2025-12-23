import TcpSocket, { Server, Socket } from 'react-native-tcp-socket';
import { IRCMessage } from './IRCService';

type DCCSessionStatus = 'pending' | 'offering' | 'connecting' | 'connected' | 'closed' | 'failed';
type DCCDirection = 'incoming' | 'outgoing';

export interface DCCChatSession {
  id: string;
  networkId: string;
  peerNick: string;
  direction: DCCDirection;
  host: string;
  port: number;
  status: DCCSessionStatus;
  messages: IRCMessage[];
}

type SessionCallback = (session: DCCChatSession) => void;
type MessageCallback = (sessionId: string, message: IRCMessage, session: DCCChatSession) => void;

class DCCChatService {
  private sessions: Map<string, DCCChatSession> = new Map();
  private sockets: Map<string, Socket> = new Map();
  private servers: Map<string, Server> = new Map();
  private sessionListeners: SessionCallback[] = [];
  private messageListeners: MessageCallback[] = [];

  onSessionUpdate(callback: SessionCallback): () => void {
    this.sessionListeners.push(callback);
    return () => {
      this.sessionListeners = this.sessionListeners.filter(cb => cb !== callback);
    };
  }

  onMessage(callback: MessageCallback): () => void {
    this.messageListeners.push(callback);
    return () => {
      this.messageListeners = this.messageListeners.filter(cb => cb !== callback);
    };
  }

  private emitSession(session: DCCChatSession) {
    this.sessionListeners.forEach(cb => cb(session));
  }

  private emitMessage(sessionId: string, message: IRCMessage) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    this.messageListeners.forEach(cb => cb(sessionId, message, session));
  }

  parseDccChatInvite(text: string | undefined): { host: string; port: number } | null {
    if (!text || !text.startsWith('\x01DCC ')) return null;
    const cleaned = text.replace(/\x01/g, '').trim(); // remove CTCP markers
    const parts = cleaned.split(/\s+/);
    // Format: DCC CHAT chat <ip> <port>
    if (parts.length >= 5 && parts[0] === 'DCC' && parts[1] === 'CHAT') {
      const host = this.intToIp(parts[3]) || parts[3];
      const port = parseInt(parts[4], 10);
      if (!isNaN(port)) {
        return { host, port };
      }
    }
    return null;
  }

  private intToIp(ip: string): string {
    const n = parseInt(ip, 10);
    if (isNaN(n)) return ip;
    return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
  }

  handleIncomingInvite(peerNick: string, networkId: string, host: string, port: number): DCCChatSession {
    const session: DCCChatSession = {
      id: `dcc-${Date.now()}-${Math.random()}`,
      networkId,
      peerNick,
      direction: 'incoming',
      host,
      port,
      status: 'pending',
      messages: [],
    };
    this.sessions.set(session.id, session);
    this.emitSession(session);
    return session;
  }

  async acceptInvite(sessionId: string, irc: { sendRaw: (cmd: string) => void; getCurrentNick: () => string }): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.status = 'connecting';
    this.emitSession(session);

    const socket = TcpSocket.createConnection({ host: session.host, port: session.port }, () => {
      session.status = 'connected';
      this.sessions.set(sessionId, session);
      this.emitSession(session);
      // announce connection in log
      this.appendMessage(sessionId, {
        id: `${Date.now()}-${Math.random()}`,
        type: 'message',
        from: session.peerNick,
        text: '*** DCC CHAT connected',
        timestamp: Date.now(),
        channel: session.peerNick,
        network: session.networkId,
      });
    });

    this.attachSocketHandlers(sessionId, socket);
    this.sockets.set(sessionId, socket);
  }

  async initiateChat(
    irc: { sendRaw: (cmd: string) => void; getCurrentNick: () => string },
    peerNick: string,
    networkId: string
  ): Promise<DCCChatSession> {
    const session: DCCChatSession = {
      id: `dcc-${Date.now()}-${Math.random()}`,
      networkId,
      peerNick,
      direction: 'outgoing',
      host: '0.0.0.0',
      port: 0,
      status: 'offering',
      messages: [],
    };
    this.sessions.set(session.id, session);
    this.emitSession(session);

    const server = TcpSocket.createServer(socket => {
      session.status = 'connected';
      this.sessions.set(session.id, session);
      this.emitSession(session);
      this.sockets.set(session.id, socket);
      this.attachSocketHandlers(session.id, socket);
      this.appendMessage(session.id, {
        id: `${Date.now()}-${Math.random()}`,
        type: 'message',
        from: session.peerNick,
        text: '*** DCC CHAT connected',
        timestamp: Date.now(),
        channel: session.peerNick,
        network: session.networkId,
      });
    });

    server.listen({ port: 0, host: '0.0.0.0' }, () => {
      const addr = server.address();
      if (typeof addr === 'object' && addr) {
        session.port = addr.port || 0;
        session.host = addr.address || '0.0.0.0';
        // Send CTCP DCC CHAT offer (host as integer if possible)
        const hostInt = this.ipToInt(session.host);
        const payload = hostInt ? `${hostInt}` : session.host;
        const ctcp = `\x01DCC CHAT chat ${payload} ${session.port}\x01`;
        irc.sendRaw(`PRIVMSG ${peerNick} :${ctcp}`);
      }
      this.sessions.set(session.id, session);
      this.emitSession(session);
    });

    this.servers.set(session.id, server);
    return session;
  }

  sendMessage(sessionId: string, text: string): void {
    const socket = this.sockets.get(sessionId);
    const session = this.sessions.get(sessionId);
    if (!socket || !session || session.status !== 'connected') return;
    socket.write(text + '\n', 'utf8');
    this.appendMessage(sessionId, {
      id: `${Date.now()}-${Math.random()}`,
      type: 'message',
      from: 'You',
      text,
      timestamp: Date.now(),
      channel: session.peerNick,
      network: session.networkId,
    });
  }

  closeSession(sessionId: string) {
    const socket = this.sockets.get(sessionId);
    if (socket) {
      socket.destroy();
    }
    const server = this.servers.get(sessionId);
    if (server) {
      server.close();
    }
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'closed';
      this.sessions.set(sessionId, session);
      this.emitSession(session);
    }
    this.sockets.delete(sessionId);
    this.servers.delete(sessionId);
  }

  private attachSocketHandlers(sessionId: string, socket: Socket) {
    socket.on('data', (data: any) => {
      const session = this.sessions.get(sessionId);
      const text = data.toString('utf8').trim();
      if (!session || !text) return;
      this.appendMessage(sessionId, {
        id: `${Date.now()}-${Math.random()}`,
        type: 'message',
        from: session.peerNick,
        text,
        timestamp: Date.now(),
        channel: session.peerNick,
        network: session.networkId,
      });
    });
    socket.on('error', () => {
      const session = this.sessions.get(sessionId);
      if (session) {
        session.status = 'failed';
        this.sessions.set(sessionId, session);
        this.emitSession(session);
      }
    });
    socket.on('close', () => {
      const session = this.sessions.get(sessionId);
      if (session) {
        session.status = 'closed';
        this.sessions.set(sessionId, session);
        this.emitSession(session);
      }
      this.sockets.delete(sessionId);
    });
  }

  private appendMessage(sessionId: string, message: IRCMessage) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.messages = [...session.messages, message];
    this.sessions.set(sessionId, session);
    this.emitMessage(sessionId, message, session);
  }

  private ipToInt(ip: string): number | null {
    const parts = ip.split('.').map(p => parseInt(p, 10));
    if (parts.length !== 4 || parts.some(isNaN)) return null;
    return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
  }
}

export const dccChatService = new DCCChatService();

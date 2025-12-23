import TcpSocket, { Socket, Server } from 'react-native-tcp-socket';
import { Platform } from 'react-native';
import type { IRCService } from './IRCService';

type TransferStatus = 'pending' | 'downloading' | 'completed' | 'failed' | 'cancelled' | 'sending';

export interface DCCSendOffer {
  filename: string;
  host: string;
  port: number;
  size?: number;
  token?: string;
}

export interface DCCFileTransfer {
  id: string;
  networkId: string;
  peerNick: string;
  offer: DCCSendOffer;
  status: TransferStatus;
  bytesReceived: number;
  size?: number;
  error?: string;
  direction: 'incoming' | 'outgoing';
  filePath?: string;
}

type TransferListener = (transfer: DCCFileTransfer) => void;

class DCCFileService {
  private transfers: Map<string, DCCFileTransfer> = new Map();
  private sockets: Map<string, Socket> = new Map();
  private sendServers: Map<string, Server> = new Map();
  private listeners: TransferListener[] = [];
  private defaultPortRange: { min: number; max: number } = { min: 5000, max: 65535 };

  onTransferUpdate(cb: TransferListener): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter(l => l !== cb);
    };
  }

  setPortRange(min: number, max: number) {
    this.defaultPortRange = { min, max };
  }

  private emit(transfer: DCCFileTransfer) {
    this.listeners.forEach(l => l(transfer));
  }

  parseSendOffer(text: string | undefined): DCCSendOffer | null {
    if (!text || !text.startsWith('\x01DCC ')) return null;
    const cleaned = text.replace(/\x01/g, '').trim();
    // Format: DCC SEND <filename> <ip> <port> <size> [token]
    const match = cleaned.match(/^DCC\s+SEND\s+(.+?)\s+(\S+)\s+(\d+)\s+(\d+)?(?:\s+(\S+))?/);
    if (!match) return null;
    const [, filename, ip, portStr, sizeStr, token] = match;
    const port = parseInt(portStr, 10);
    const size = sizeStr ? parseInt(sizeStr, 10) : undefined;
    if (isNaN(port)) return null;
    return {
      filename: filename.replace(/"/g, ''),
      host: this.intToIp(ip) || ip,
      port,
      size: size && !isNaN(size) ? size : undefined,
      token,
    };
  }

  handleOffer(peerNick: string, networkId: string, offer: DCCSendOffer): DCCFileTransfer {
    const transfer: DCCFileTransfer = {
      id: `dccfile-${Date.now()}-${Math.random()}`,
      networkId,
      peerNick,
      offer,
      status: 'pending',
      bytesReceived: 0,
      size: offer.size,
      direction: 'incoming',
    };
    this.transfers.set(transfer.id, transfer);
    this.emit(transfer);
    return transfer;
  }

  async accept(transferId: string, irc: IRCService, downloadPath: string) {
    const transfer = this.transfers.get(transferId);
    if (!transfer) return;
    transfer.status = 'downloading';
    transfer.filePath = downloadPath;
    this.transfers.set(transferId, transfer);
    this.emit(transfer);

    // Resume support: if file exists and size > 0, request resume
    let startOffset = 0;
    try {
      const RNFS = require('react-native-fs');
      const stat = await RNFS.stat(downloadPath);
      startOffset = stat.size || 0;
      if (startOffset > 0 && transfer.offer.size && startOffset < transfer.offer.size) {
        irc.sendRaw(`PRIVMSG ${transfer.peerNick} :\x01DCC RESUME ${transfer.offer.filename} ${transfer.offer.port} ${startOffset}\x01`);
      }
    } catch (_) {
      // ignore if file doesn't exist
    }

    const socket = TcpSocket.createConnection({ host: transfer.offer.host, port: transfer.offer.port }, async () => {
      // If resume requested, sender should respond with ACCEPT; we still start reading
    });
    this.sockets.set(transferId, socket);

    socket.on('data', async (data: any) => {
      const t = this.transfers.get(transferId);
      if (!t) return;
      try {
        const RNFS = require('react-native-fs');
        await RNFS.appendFile(downloadPath, data.toString('base64'), 'base64');
      } catch (e) {
        // fallthrough; still count bytes
      }
      t.bytesReceived += data.length;
      this.transfers.set(transferId, t);
      this.emit(t);
      // Send ACK (bytes received) per DCC spec
      const ack = Buffer.alloc(4);
      ack.writeUInt32BE(t.bytesReceived, 0);
      socket.write(ack);
    });

    socket.on('error', (err: any) => {
      const t = this.transfers.get(transferId);
      if (!t) return;
      t.status = 'failed';
      t.error = err?.message || 'Transfer failed';
      this.transfers.set(transferId, t);
      this.emit(t);
      this.sockets.delete(transferId);
    });

    socket.on('close', () => {
      const t = this.transfers.get(transferId);
      if (!t) return;
      if (t.status !== 'failed' && t.status !== 'cancelled') {
        t.status = 'completed';
      }
      this.transfers.set(transferId, t);
      this.emit(t);
      this.sockets.delete(transferId);
    });
  }

  cancel(transferId: string) {
    const socket = this.sockets.get(transferId);
    if (socket) {
      socket.destroy();
    }
    const transfer = this.transfers.get(transferId);
    if (transfer) {
      transfer.status = 'cancelled';
      this.transfers.set(transferId, transfer);
      this.emit(transfer);
    }
    this.sockets.delete(transferId);
  }

  list(): DCCFileTransfer[] {
    return Array.from(this.transfers.values());
  }

  // Outgoing DCC SEND
  async sendFile(irc: IRCService, peerNick: string, networkId: string, filePath: string, port?: number) {
    const RNFS = require('react-native-fs');
    const stat = await RNFS.stat(filePath);
    const filename = filePath.split(/[\\/]/).pop() || 'file';
    const size = stat.size;

    const transfer: DCCFileTransfer = {
      id: `dccfile-${Date.now()}-${Math.random()}`,
      networkId,
      peerNick,
      offer: { filename, host: '0.0.0.0', port: port || 0, size },
      status: 'sending',
      bytesReceived: 0,
      size,
      direction: 'outgoing',
      filePath,
    };
    this.transfers.set(transfer.id, transfer);
    this.emit(transfer);

    const chosenPort = port || this.defaultPortRange.min + Math.floor(Math.random() * (this.defaultPortRange.max - this.defaultPortRange.min));
    const server = TcpSocket.createServer(async socket => {
      // Stream file
      const chunkSize = 32 * 1024;
      let offset = 0;
      try {
        while (offset < size) {
          const chunk = await RNFS.read(filePath, Math.min(chunkSize, size - offset), offset, 'base64');
          const buf = Buffer.from(chunk, 'base64');
          socket.write(buf);
          offset += buf.length;
          transfer.bytesReceived = offset;
          this.transfers.set(transfer.id, transfer);
          this.emit(transfer);
          await new Promise(res => setTimeout(res, 1));
        }
        transfer.status = 'completed';
        this.transfers.set(transfer.id, transfer);
        this.emit(transfer);
      } catch (e: any) {
        transfer.status = 'failed';
        transfer.error = e?.message || 'Send failed';
        this.transfers.set(transfer.id, transfer);
        this.emit(transfer);
      } finally {
        socket.destroy();
        server.close();
        this.sendServers.delete(transfer.id);
      }
    });

    server.listen({ port: chosenPort, host: '0.0.0.0' }, () => {
      const addr = server.address();
      if (typeof addr === 'object' && addr) {
        const hostInt = this.ipToInt(addr.address || '0.0.0.0') || 0;
        const payload = hostInt ? `${hostInt}` : addr.address;
        const ctcp = `\x01DCC SEND "${filename}" ${payload} ${addr.port} ${size}\x01`;
        irc.sendRaw(`PRIVMSG ${peerNick} :${ctcp}`);
      }
    });

    this.sendServers.set(transfer.id, server);
    return transfer;
  }

  private intToIp(ip: string): string {
    const n = parseInt(ip, 10);
    if (isNaN(n)) return ip;
    return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
  }

  private ipToInt(ip: string): number | null {
    const parts = ip.split('.').map(p => parseInt(p, 10));
    if (parts.length !== 4 || parts.some(isNaN)) return null;
    return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
  }
}

export const dccFileService = new DCCFileService();

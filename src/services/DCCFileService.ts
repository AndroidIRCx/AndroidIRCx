/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import TcpSocket, { Socket, Server } from 'react-native-tcp-socket';
import type { IRCService } from './IRCService';
import { tx } from '../i18n/transifex';
import { settingsService } from './SettingsService';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

/**
 * Check if an IP address is a private/local address (RFC1918, localhost, link-local)
 * This includes:
 * - 10.0.0.0/8 (Class A private)
 * - 172.16.0.0/12 (Class B private)
 * - 192.168.0.0/16 (Class C private)
 * - 127.0.0.0/8 (localhost)
 * - 169.254.0.0/16 (link-local)
 * - 0.0.0.0 (unspecified)
 */
function isPrivateOrLocalIp(ip: string): boolean {
  // Handle hostname localhost
  if (ip.toLowerCase() === 'localhost') return true;

  // Parse IPv4
  const parts = ip.split('.').map(p => parseInt(p, 10));
  if (parts.length !== 4 || parts.some(isNaN)) return false; // Not a valid IPv4

  const [a, b] = parts;

  // 10.0.0.0/8
  if (a === 10) return true;

  // 172.16.0.0/12 (172.16.x.x - 172.31.x.x)
  if (a === 172 && b >= 16 && b <= 31) return true;

  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;

  // 127.0.0.0/8 (localhost)
  if (a === 127) return true;

  // 169.254.0.0/16 (link-local)
  if (a === 169 && b === 254) return true;

  // 0.0.0.0 (unspecified)
  if (a === 0 && b === 0) return true;

  return false;
}

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
    if (!match) {
      console.log('[DCCFileService] parseSendOffer no match:', { cleaned });
      return null;
    }
    const [, filename, ip, portStr, sizeStr, token] = match;
    const port = parseInt(portStr, 10);
    const size = sizeStr ? parseInt(sizeStr, 10) : undefined;
    if (isNaN(port)) return null;
    console.log('[DCCFileService] parseSendOffer matched:', {
      filename,
      ip,
      port,
      size,
      token,
    });
    const host = /^\d+$/.test(ip) ? this.intToIp(ip) : ip;
    return {
      filename: filename.replace(/"/g, ''),
      host,
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

    // Security check: Block private/local IP addresses if setting is enabled
    const blockPrivateIp = await settingsService.getSetting('dccBlockPrivateIp', true);
    if (blockPrivateIp && isPrivateOrLocalIp(transfer.offer.host)) {
      console.warn('[DCCFileService] Blocked connection to private/local IP:', transfer.offer.host);
      transfer.status = 'failed';
      transfer.error = t('Connection blocked: Private/local IP address ({host}). This could be an SSRF attack. You can disable this protection in Settings > Connection > DCC if you trust this connection.', { host: transfer.offer.host });
      this.transfers.set(transferId, transfer);
      this.emit(transfer);
      return;
    }

    console.log('[DCCFileService] accept transfer:', {
      id: transferId,
      host: transfer.offer.host,
      port: transfer.offer.port,
      filename: transfer.offer.filename,
      size: transfer.offer.size,
      path: downloadPath,
    });
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
      console.log('[DCCFileService] socket connected:', { id: transferId, host: transfer.offer.host, port: transfer.offer.port });
      // If resume requested, sender should respond with ACCEPT; we still start reading
    });
    this.sockets.set(transferId, socket);

    socket.on('data', async (data: any) => {
      const transferState = this.transfers.get(transferId);
      if (!transferState) return;
      try {
        const RNFS = require('react-native-fs');
        await RNFS.appendFile(downloadPath, data.toString('base64'), 'base64');
      } catch (e) {
        // fallthrough; still count bytes
      }
      transferState.bytesReceived += data.length;
      this.transfers.set(transferId, transferState);
      this.emit(transferState);
      // Send ACK (bytes received) per DCC spec
      const ack = Buffer.alloc(4);
      ack.writeUInt32BE(transferState.bytesReceived, 0);
      socket.write(ack);
    });

    socket.on('error', (err: any) => {
      const transferState = this.transfers.get(transferId);
      if (!transferState) return;
      console.error('[DCCFileService] socket error:', { id: transferId, error: err?.message || err });
      transferState.status = 'failed';
      transferState.error = err?.message || t('Transfer failed');
      this.transfers.set(transferId, transferState);
      this.emit(transferState);
      this.sockets.delete(transferId);
    });

    socket.on('close', (hadError?: boolean) => {
      const transferState = this.transfers.get(transferId);
      if (!transferState) return;
      console.log('[DCCFileService] socket closed:', { id: transferId, hadError: !!hadError });
      if (transferState.status !== 'failed' && transferState.status !== 'cancelled') {
        transferState.status = 'completed';
      }
      this.transfers.set(transferId, transferState);
      this.emit(transferState);
      this.sockets.delete(transferId);
    });
  }

  async getDefaultDownloadPath(filename: string): Promise<string> {
    const RNFS = require('react-native-fs');
    const folderSetting = await settingsService.getSetting('dccDownloadFolder', '');
    const baseFolder = folderSetting && typeof folderSetting === 'string'
      ? folderSetting.trim()
      : '';
    const safeName = this.sanitizeFilename(filename || 'download');
    const targetBase = baseFolder || RNFS.DocumentDirectoryPath;
    return `${targetBase}/${safeName}`;
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

      // Clean up cached file for outgoing transfers
      if (transfer.direction === 'outgoing' && transfer.filePath) {
        this.cleanupCachedFile(transfer.filePath);
      }
    }
    this.sockets.delete(transferId);

    // Close server for outgoing transfers
    const server = this.sendServers.get(transferId);
    if (server) {
      server.close();
      this.sendServers.delete(transferId);
    }
  }

  list(): DCCFileTransfer[] {
    return Array.from(this.transfers.values());
  }

  // Outgoing DCC SEND
  async sendFile(irc: IRCService, peerNick: string, networkId: string, filePath: string, port?: number) {
    const RNFS = require('react-native-fs');

    console.log('[DCCFileService] sendFile called with path:', filePath);

    // Validate file path
    if (!filePath) {
      throw new Error(t('No file path provided'));
    }

    // URL decode the path in case it wasn't decoded properly
    let decodedPath = filePath;
    try {
      decodedPath = decodeURIComponent(filePath);
    } catch (e) {
      // Use original if decode fails
    }
    console.log('[DCCFileService] Decoded path:', decodedPath);

    // Check if path is a content:// URI (not supported by RNFS directly)
    if (decodedPath.startsWith('content://')) {
      throw new Error(t('Invalid file path. Please select the file again.'));
    }

    // Check if file exists with proper error handling
    let exists = false;
    try {
      exists = await RNFS.exists(decodedPath);
    } catch (existsError: any) {
      console.error('[DCCFileService] RNFS.exists error:', existsError);
      throw new Error(t('Cannot check file: {error}').replace('{error}', existsError?.message || 'Unknown error'));
    }

    if (!exists) {
      console.error('[DCCFileService] File does not exist:', decodedPath);
      throw new Error(t('File not found: {path}').replace('{path}', decodedPath.split('/').pop() || decodedPath));
    }

    let stat;
    try {
      stat = await RNFS.stat(decodedPath);
    } catch (statError: any) {
      console.error('[DCCFileService] RNFS.stat error:', statError);
      throw new Error(t('Cannot read file info: {error}').replace('{error}', statError?.message || 'Unknown error'));
    }

    const filename = decodedPath.split(/[\\/]/).pop() || 'file';
    const size = stat.size;
    // Use decoded path for the rest of the operations
    filePath = decodedPath;

    console.log('[DCCFileService] File info - name:', filename, 'size:', size);

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
    const rawHostOverride = await settingsService.getSetting('dccHostOverride', '');
    const dccHostOverride = typeof rawHostOverride === 'string' ? rawHostOverride.trim() : '';
    if (dccHostOverride && /\s/.test(dccHostOverride)) {
      console.warn('[DCCFileService] Ignoring DCC host override with whitespace:', dccHostOverride);
    }
    const normalizedOverride = dccHostOverride && !/\s/.test(dccHostOverride) ? dccHostOverride : '';
    console.log('[DCCFileService] Starting send server:', {
      id: transfer.id,
      peerNick,
      networkId,
      chosenPort,
      hostOverride: normalizedOverride || undefined,
    });
    const server = TcpSocket.createServer(async socket => {
      console.log('[DCCFileService] Send socket connected:', { id: transfer.id });
      // Stream file
      const chunkSize = 32 * 1024;
      let offset = 0;
      const maxKbps = await settingsService.getSetting('dccSendMaxKbps', 0);
      const maxBytesPerSec = maxKbps > 0 ? maxKbps * 1024 : 0;
      try {
        while (offset < size) {
          const chunk = await RNFS.read(filePath, Math.min(chunkSize, size - offset), offset, 'base64');
          const buf = Buffer.from(chunk, 'base64');
          socket.write(buf);
          offset += buf.length;
          transfer.bytesReceived = offset;
          this.transfers.set(transfer.id, transfer);
          this.emit(transfer);
          if (maxBytesPerSec > 0) {
            const delayMs = Math.max(Math.ceil((buf.length / maxBytesPerSec) * 1000), 1);
            await new Promise(res => setTimeout(res, delayMs));
          } else {
            await new Promise(res => setTimeout(res, 1));
          }
        }
        transfer.status = 'completed';
        this.transfers.set(transfer.id, transfer);
        this.emit(transfer);
      } catch (e: any) {
        console.error('[DCCFileService] Send socket error:', { id: transfer.id, error: e?.message || e });
        transfer.status = 'failed';
        transfer.error = e?.message || t('Send failed');
        this.transfers.set(transfer.id, transfer);
        this.emit(transfer);
      } finally {
        socket.destroy();
        server.close();
        this.sendServers.delete(transfer.id);

        // Clean up cached file if it was copied from document picker
        this.cleanupCachedFile(filePath);
      }
    });

    server.listen({ port: chosenPort, host: '0.0.0.0' }, () => {
      const addr = server.address();
      if (typeof addr === 'object' && addr) {
        let hostAddress = normalizedOverride || addr.address || '0.0.0.0';
        const needsFallback = !normalizedOverride && (hostAddress === '0.0.0.0' || hostAddress === '::' || hostAddress === '::1');
        const localAddr = typeof irc.getLocalAddress === 'function' ? irc.getLocalAddress() : undefined;
        if (needsFallback && localAddr) {
          if (localAddr && localAddr.includes('.') && this.ipToInt(localAddr)) {
            hostAddress = localAddr;
          }
        }
        const hostInt = this.ipToInt(hostAddress) || 0;
        const payload = hostInt ? `${hostInt}` : hostAddress;
        console.log('[DCCFileService] Sending DCC SEND:', {
          id: transfer.id,
          peerNick,
          hostAddress,
          payload,
          hostOverride: normalizedOverride || undefined,
          localAddr,
          port: addr.port,
          size,
        });
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

  private sanitizeFilename(name: string): string {
    return name.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'download';
  }

  /**
   * Clean up copied file after DCC transfer completes.
   * Only deletes files that are in the app's directories (cache or documents).
   */
  private async cleanupCachedFile(filePath: string): Promise<void> {
    try {
      const RNFS = require('react-native-fs');

      // Only delete if the file is in app's directories
      // This prevents accidental deletion of user's original files
      const isInAppDir = filePath && (
        filePath.includes(RNFS.CachesDirectoryPath) ||
        filePath.includes(RNFS.DocumentDirectoryPath) ||
        filePath.includes('/cache/') ||
        filePath.includes('/Cache/') ||
        filePath.includes('/files/')
      );

      if (isInAppDir) {
        const exists = await RNFS.exists(filePath);
        if (exists) {
          await RNFS.unlink(filePath);
          console.log('[DCCFileService] Cleaned up copied file:', filePath);
        }
      }
    } catch (error) {
      // Silently ignore cleanup errors - not critical
      console.warn('[DCCFileService] Failed to clean up copied file:', error);
    }
  }
}

export const dccFileService = new DCCFileService();

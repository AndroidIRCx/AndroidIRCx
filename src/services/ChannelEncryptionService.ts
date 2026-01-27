/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import sodium from 'react-native-libsodium';
import { TextEncoder, TextDecoder } from 'text-encoding';
import { secureStorageService } from './SecureStorageService';

type ChannelKey = {
  v: 1;
  channel: string;
  network: string;
  key: string; // base64 symmetric key
  createdAt: number;
};

type EncryptedChannelMsg = {
  v: 1;
  nonce: string;
  cipher: string;
};

const CHANNEL_KEY_PREFIX = 'chanenc:key:';

class ChannelEncryptionService {
  private ready: Promise<void> = sodium.ready;
  private textEncoder = new TextEncoder();
  private textDecoder = new TextDecoder();
  private keyListeners: Array<(channel: string, network: string) => void> = [];

  private async ensureReady() {
    await this.ready;
  }

  private toB64(bytes: Uint8Array) {
    // Keep default variant for backward compatibility with stored keys
    return sodium.to_base64(bytes);
  }

  private fromB64(b64: string) {
    // Keep default variant for backward compatibility with stored keys
    return sodium.from_base64(b64);
  }

  private fromString(str: string): Uint8Array {
    return this.textEncoder.encode(str);
  }

  private toString(bytes: Uint8Array): string {
    return this.textDecoder.decode(bytes);
  }

  private canonicalizeNetwork(network: string): string {
    const normalized = (network || '').trim();
    if (!normalized) return normalized;
    return normalized.replace(/ \(\d+\)$/, '');
  }

  private buildMessageAAD(channel: string, network: string): string {
    const canonicalNetwork = this.canonicalizeNetwork(network);
    return `chanmsg:${canonicalNetwork}:${channel}`;
  }

  private getStorageKey(channel: string, network: string): string {
    const canonicalNetwork = this.canonicalizeNetwork(network);
    return `${CHANNEL_KEY_PREFIX}${canonicalNetwork.toLowerCase()}:${channel.toLowerCase()}`;
  }

  // Generate a new symmetric key for a channel
  async generateChannelKey(channel: string, network: string): Promise<ChannelKey> {
    await this.ensureReady();
    const key = sodium.randombytes_buf(32); // 256-bit symmetric key
    const canonicalNetwork = this.canonicalizeNetwork(network);
    const channelKey: ChannelKey = {
      v: 1,
      channel,
      network: canonicalNetwork,
      key: this.toB64(key),
      createdAt: Date.now(),
    };
    await this.storeChannelKey(channelKey);
    return channelKey;
  }

  // Store a channel key
  async storeChannelKey(channelKey: ChannelKey): Promise<void> {
    channelKey.network = this.canonicalizeNetwork(channelKey.network);
    const storageKey = this.getStorageKey(channelKey.channel, channelKey.network);
    await secureStorageService.setSecret(storageKey, JSON.stringify(channelKey));
    // Notify listeners
    this.keyListeners.forEach(listener => listener(channelKey.channel, channelKey.network));
  }

  // Get channel key
  async getChannelKey(channel: string, network: string): Promise<ChannelKey | null> {
    const storageKey = this.getStorageKey(channel, network);
    const stored = await secureStorageService.getSecret(storageKey);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as ChannelKey;
    parsed.network = this.canonicalizeNetwork(parsed.network);
    return parsed;
  }

  // Check if channel has encryption key
  async hasChannelKey(channel: string, network: string): Promise<boolean> {
    const key = await this.getChannelKey(channel, network);
    return key !== null;
  }

  // Remove channel key
  async removeChannelKey(channel: string, network: string): Promise<void> {
    const canonicalNetwork = this.canonicalizeNetwork(network);
    const storageKey = this.getStorageKey(channel, canonicalNetwork);
    await secureStorageService.removeSecret(storageKey);
    this.keyListeners.forEach(listener => listener(channel, canonicalNetwork));
  }

  // Encrypt a message for a channel
  async encryptMessage(plaintext: string, channel: string, network: string): Promise<EncryptedChannelMsg> {
    await this.ensureReady();
    const channelKey = await this.getChannelKey(channel, network);
    if (!channelKey) throw new Error('no channel key');

    const key = this.fromB64(channelKey.key);
    const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
    const aad = this.buildMessageAAD(channel, network);
    const cipher = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
      this.fromString(plaintext),
      aad,
      null,
      nonce,
      key,
    );

    return {
      v: 1,
      nonce: this.toB64(nonce),
      cipher: this.toB64(cipher),
    };
  }

  // Decrypt a channel message
  async decryptMessage(msg: EncryptedChannelMsg, channel: string, network: string): Promise<string> {
    await this.ensureReady();
    if (msg.v !== 1) throw new Error('version');

    const channelKey = await this.getChannelKey(channel, network);
    if (!channelKey) throw new Error('no channel key');

    const key = this.fromB64(channelKey.key);
    const aad = this.buildMessageAAD(channel, network);
    let plain: Uint8Array;
    try {
      plain = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
        null,
        this.fromB64(msg.cipher),
        aad,
        this.fromB64(msg.nonce),
        key,
      );
    } catch (error) {
      plain = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
        null,
        this.fromB64(msg.cipher),
        '',
        this.fromB64(msg.nonce),
        key,
      );
    }

    return this.toString(plain);
  }

  // Export channel key for sharing (as JSON string)
  async exportChannelKey(channel: string, network: string): Promise<string> {
    const channelKey = await this.getChannelKey(channel, network);
    if (!channelKey) throw new Error('no channel key');
    return JSON.stringify(channelKey);
  }

  // Import a channel key from JSON
  async importChannelKey(keyData: string, networkOverride?: string): Promise<ChannelKey> {
    const channelKey = JSON.parse(keyData) as ChannelKey;
    if (channelKey.v !== 1) throw new Error('invalid version');
    // IMPORTANT: network names are client-local labels. When importing a key
    // received via DM, we should bind it to the current local network rather
    // than the sender's network label from the payload.
    const effectiveNetwork = networkOverride ?? channelKey.network;
    channelKey.network = this.canonicalizeNetwork(effectiveNetwork);
    await this.storeChannelKey(channelKey);
    return channelKey;
  }

  // Listen for channel key changes
  onChannelKeyChange(callback: (channel: string, network: string) => void): () => void {
    this.keyListeners.push(callback);
    return () => {
      const index = this.keyListeners.indexOf(callback);
      if (index > -1) {
        this.keyListeners.splice(index, 1);
      }
    };
  }
}

export const channelEncryptionService = new ChannelEncryptionService();

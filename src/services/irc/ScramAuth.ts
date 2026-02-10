/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * SCRAM-SHA-256 and SCRAM-SHA-256-PLUS authentication implementation
 * Based on RFC 7677 and RFC 5802
 * 
 * NOTE: SCRAM-SHA-256 is fully functional.
 * SCRAM-SHA-256-PLUS (channel binding) requires TLS Exported Keying Material
 * which is not currently available in react-native-tcp-socket.
 * This will be implemented when the underlying TLS library supports it.
 */

import sodium from 'react-native-libsodium';

// Text encoder for string/bytes conversion
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/**
 * Convert string to Uint8Array
 */
function stringToBytes(str: string): Uint8Array {
  return textEncoder.encode(str);
}

/**
 * Convert Uint8Array to string
 */
function bytesToString(bytes: Uint8Array): string {
  return textDecoder.decode(bytes);
}

/**
 * HMAC-SHA-256 implementation using libsodium's crypto_auth (which is HMAC-SHA-512/256)
 * We need to implement HMAC-SHA-256 specifically for SCRAM
 */
async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  // libsodium's crypto_auth is HMAC-SHA-512/256, not HMAC-SHA-256
  // We need to implement HMAC-SHA-256 manually
  await sodium.ready;
  
  // HMAC: H(K XOR opad || H(K XOR ipad || message))
  const blockSize = 64; // SHA-256 block size
  
  // If key is longer than block size, hash it
  let keyBlock = key;
  if (key.length > blockSize) {
    keyBlock = sodium.crypto_hash_sha256(key);
  }
  
  // Pad key to block size
  const paddedKey = new Uint8Array(blockSize);
  paddedKey.set(keyBlock);
  
  // Create ipad and opad
  const ipad = new Uint8Array(blockSize);
  const opad = new Uint8Array(blockSize);
  
  for (let i = 0; i < blockSize; i++) {
    ipad[i] = paddedKey[i] ^ 0x36;
    opad[i] = paddedKey[i] ^ 0x5c;
  }
  
  // Inner hash: H(ipad || message)
  const innerData = new Uint8Array(ipad.length + data.length);
  innerData.set(ipad);
  innerData.set(data, ipad.length);
  const innerHash = sodium.crypto_hash_sha256(innerData);
  
  // Outer hash: H(opad || innerHash)
  const outerData = new Uint8Array(opad.length + innerHash.length);
  outerData.set(opad);
  outerData.set(innerHash, opad.length);
  
  return sodium.crypto_hash_sha256(outerData);
}

/**
 * PBKDF2 with HMAC-SHA-256
 * Implements RFC 2898 PKCS#5 v2.0
 */
async function pbkdf2Sha256(
  password: Uint8Array,
  salt: Uint8Array,
  iterations: number,
  keyLength: number
): Promise<Uint8Array> {
  await sodium.ready;
  
  const result = new Uint8Array(keyLength);
  let currentBlock = new Uint8Array(0);
  
  const numBlocks = Math.ceil(keyLength / 32); // SHA-256 output is 32 bytes
  
  for (let i = 1; i <= numBlocks; i++) {
    // Create block: salt || INT_32_BE(i)
    const blockSalt = new Uint8Array(salt.length + 4);
    blockSalt.set(salt);
    // Write 32-bit big-endian integer
    blockSalt[salt.length] = (i >>> 24) & 0xff;
    blockSalt[salt.length + 1] = (i >>> 16) & 0xff;
    blockSalt[salt.length + 2] = (i >>> 8) & 0xff;
    blockSalt[salt.length + 3] = i & 0xff;
    
    // U_1 = HMAC(password, salt || INT_32_BE(i))
    let u = await hmacSha256(password, blockSalt);
    let blockResult = new Uint8Array(u);
    
    // U_2 through U_c
    for (let j = 1; j < iterations; j++) {
      u = await hmacSha256(password, u);
      // XOR with previous result
      for (let k = 0; k < 32; k++) {
        blockResult[k] ^= u[k];
      }
    }
    
    currentBlock = new Uint8Array([...currentBlock, ...blockResult]);
  }
  
  // Copy only the required key length
  result.set(currentBlock.slice(0, keyLength));
  return result;
}

/**
 * Generate random bytes for nonce
 */
function randomBytes(length: number): Uint8Array {
  return sodium.randombytes_buf(length);
}

/**
 * Base64 encoding (standard, not URL-safe)
 */
function base64Encode(bytes: Uint8Array): string {
  return sodium.to_base64(bytes, sodium.base64_variants.ORIGINAL);
}

/**
 * Base64 decoding (standard, not URL-safe)
 */
function base64Decode(str: string): Uint8Array {
  return sodium.from_base64(str, sodium.base64_variants.ORIGINAL);
}

/**
 * XOR two byte arrays
 */
function xorBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const result = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i] ^ b[i];
  }
  return result;
}

/**
 * SCRAM authentication state
 */
export interface ScramState {
  mechanism: 'SCRAM-SHA-256' | 'SCRAM-SHA-256-PLUS';
  clientNonce: string;
  serverNonce: string;
  salt: Uint8Array;
  iterations: number;
  gs2Header: string;
  clientFirstMessageBare: string;
  serverFirstMessage: string;
  authMessage: string;
}

/**
 * Initialize SCRAM authentication
 */
export async function scramInit(
  mechanism: 'SCRAM-SHA-256' | 'SCRAM-SHA-256-PLUS',
  tlsExportedKeyingMaterial?: Uint8Array
): Promise<ScramState> {
  await sodium.ready;
  
  // Generate client nonce (24 random bytes = 32 base64 chars)
  const clientNonceBytes = randomBytes(24);
  const clientNonce = base64Encode(clientNonceBytes);
  
  // Build GS2 header
  let gs2Header: string;
  if (mechanism === 'SCRAM-SHA-256-PLUS' && tlsExportedKeyingMaterial) {
    // Channel binding with TLS exported keying material
    const cbData = base64Encode(tlsExportedKeyingMaterial);
    gs2Header = `p=tls-unique,,${cbData}`;
  } else {
    // No channel binding
    gs2Header = 'n,,';
  }
  
  return {
    mechanism,
    clientNonce,
    serverNonce: '',
    salt: new Uint8Array(0),
    iterations: 0,
    gs2Header,
    clientFirstMessageBare: '',
    serverFirstMessage: '',
    authMessage: '',
  };
}

/**
 * Build client-first-message
 */
export function buildClientFirstMessage(
  state: ScramState,
  username: string
): { message: string; state: ScramState } {
  // Escape special characters in username
  const escapedUsername = username
    .replace(/=/g, '=3D')
    .replace(/,/g, '=2C');
  
  // client-first-message-bare
  const clientFirstMessageBare = `n=${escapedUsername},r=${state.clientNonce}`;
  
  // client-first-message = gs2-header client-first-message-bare
  const gs2HeaderBytes = stringToBytes(state.gs2Header);
  const message = base64Encode(
    new Uint8Array([...gs2HeaderBytes, ...stringToBytes(clientFirstMessageBare)])
  );
  
  return {
    message,
    state: {
      ...state,
      clientFirstMessageBare,
    },
  };
}

/**
 * Parse server-first-message
 */
export function parseServerFirstMessage(
  state: ScramState,
  serverFirstMessageB64: string
): { success: boolean; error?: string; state?: ScramState } {
  try {
    const serverFirstMessage = bytesToString(base64Decode(serverFirstMessageB64));
    
    // Parse attributes
    const attrs: Record<string, string> = {};
    for (const part of serverFirstMessage.split(',')) {
      const match = part.match(/^([a-z])=(.*)$/);
      if (match) {
        attrs[match[1]] = match[2];
      }
    }
    
    // Validate nonce starts with client nonce
    const serverNonce = attrs['r'] || '';
    if (!serverNonce.startsWith(state.clientNonce)) {
      return { success: false, error: 'Server nonce does not start with client nonce' };
    }
    
    // Parse salt
    const salt = base64Decode(attrs['s'] || '');
    
    // Parse iteration count
    const iterations = parseInt(attrs['i'] || '0', 10);
    if (iterations < 4096) {
      return { success: false, error: 'Iteration count too low' };
    }
    
    return {
      success: true,
      state: {
        ...state,
        serverNonce,
        salt,
        iterations,
        serverFirstMessage,
      },
    };
  } catch (e) {
    return { success: false, error: `Failed to parse server-first-message: ${e}` };
  }
}

/**
 * Build client-final-message
 */
export async function buildClientFinalMessage(
  state: ScramState,
  password: string
): Promise<{ message: string; state: ScramState }> {
  await sodium.ready;
  
  // client-final-message-without-proof
  const channelBinding = base64Encode(stringToBytes(state.gs2Header));
  const clientFinalMessageWithoutProof = `c=${channelBinding},r=${state.serverNonce}`;
  
  // Calculate AuthMessage
  const authMessage = `${state.clientFirstMessageBare},${state.serverFirstMessage},${clientFinalMessageWithoutProof}`;
  
  // Calculate SaltedPassword
  const passwordBytes = stringToBytes(password);
  const saltedPassword = await pbkdf2Sha256(passwordBytes, state.salt, state.iterations, 32);
  
  // Calculate ClientKey
  const clientKey = await hmacSha256(saltedPassword, stringToBytes('Client Key'));
  
  // Calculate StoredKey
  const storedKey = sodium.crypto_hash_sha256(clientKey);
  
  // Calculate ClientSignature
  const clientSignature = await hmacSha256(storedKey, stringToBytes(authMessage));
  
  // Calculate ClientProof
  const clientProof = xorBytes(clientKey, clientSignature);
  
  // Build proof
  const proof = base64Encode(clientProof);
  const clientFinalMessage = `${clientFinalMessageWithoutProof},p=${proof}`;
  
  return {
    message: base64Encode(stringToBytes(clientFinalMessage)),
    state: {
      ...state,
      authMessage,
    },
  };
}

/**
 * Verify server-final-message
 */
export function verifyServerFinalMessage(
  state: ScramState,
  serverFinalMessageB64: string,
  expectedServerSignature: Uint8Array
): { success: boolean; error?: string } {
  try {
    const serverFinalMessage = bytesToString(base64Decode(serverFinalMessageB64));
    
    // Check for error
    if (serverFinalMessage.startsWith('e=')) {
      const errorMsg = serverFinalMessage.substring(2);
      return { success: false, error: `Server error: ${errorMsg}` };
    }
    
    // Parse verification signature
    const match = serverFinalMessage.match(/^v=(.+)$/);
    if (!match) {
      return { success: false, error: 'Invalid server-final-message format' };
    }
    
    const serverSignature = base64Decode(match[1]);
    
    // Compare signatures
    if (serverSignature.length !== expectedServerSignature.length) {
      return { success: false, error: 'Server signature mismatch' };
    }
    
    for (let i = 0; i < serverSignature.length; i++) {
      if (serverSignature[i] !== expectedServerSignature[i]) {
        return { success: false, error: 'Server signature mismatch' };
      }
    }
    
    return { success: true };
  } catch (e) {
    return { success: false, error: `Failed to verify server-final-message: ${e}` };
  }
}

/**
 * SCRAM authentication service
 */
export class ScramAuthService {
  private state: ScramState | null = null;
  private serverSignature: Uint8Array | null = null;
  
  /**
   * Initialize SCRAM authentication
   */
  async init(
    mechanism: 'SCRAM-SHA-256' | 'SCRAM-SHA-256-PLUS',
    tlsExportedKeyingMaterial?: Uint8Array
  ): Promise<string> {
    this.state = await scramInit(mechanism, tlsExportedKeyingMaterial);
    return mechanism;
  }
  
  /**
   * Get current mechanism
   */
  getMechanism(): string | null {
    return this.state?.mechanism || null;
  }
  
  /**
   * Build client-first-message
   */
  buildClientFirst(username: string): string {
    if (!this.state) {
      throw new Error('SCRAM not initialized');
    }
    const { message, state } = buildClientFirstMessage(this.state, username);
    this.state = state;
    return message;
  }
  
  /**
   * Process server-first-message
   */
  processServerFirst(serverFirstMessageB64: string): { success: boolean; error?: string } {
    if (!this.state) {
      return { success: false, error: 'SCRAM not initialized' };
    }
    const result = parseServerFirstMessage(this.state, serverFirstMessageB64);
    if (result.success && result.state) {
      this.state = result.state;
    }
    return result;
  }
  
  /**
   * Build client-final-message
   */
  async buildClientFinal(password: string): Promise<string> {
    if (!this.state) {
      throw new Error('SCRAM not initialized');
    }
    const { message, state } = await buildClientFinalMessage(this.state, password);
    this.state = state;
    
    // Store server signature for later verification
    await this.calculateServerSignature(password);
    
    return message;
  }
  
  /**
   * Calculate server signature for verification
   */
  private async calculateServerSignature(password: string): Promise<void> {
    if (!this.state) {
      throw new Error('SCRAM not initialized');
    }
    
    await sodium.ready;
    
    // Recalculate SaltedPassword
    const passwordBytes = stringToBytes(password);
    const saltedPassword = await pbkdf2Sha256(passwordBytes, this.state.salt, this.state.iterations, 32);
    
    // Calculate ServerKey
    const serverKey = await hmacSha256(saltedPassword, stringToBytes('Server Key'));
    
    // Calculate ServerSignature
    this.serverSignature = await hmacSha256(serverKey, stringToBytes(this.state.authMessage));
  }
  
  /**
   * Verify server-final-message
   */
  verifyServerFinal(serverFinalMessageB64: string): { success: boolean; error?: string } {
    if (!this.state || !this.serverSignature) {
      return { success: false, error: 'SCRAM not initialized or client-final not sent' };
    }
    return verifyServerFinalMessage(this.state, serverFinalMessageB64, this.serverSignature);
  }
  
  /**
   * Reset state
   */
  reset(): void {
    this.state = null;
    this.serverSignature = null;
  }
}

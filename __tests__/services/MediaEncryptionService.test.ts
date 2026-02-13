/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

jest.mock('react-native-libsodium', () => ({
  __esModule: true,
  default: {
    ready: Promise.resolve(),
    to_base64: jest.fn((bytes: Uint8Array) => Buffer.from(bytes).toString('base64')),
    from_base64: jest.fn((b64: string) => new Uint8Array(Buffer.from(b64, 'base64'))),
    randombytes_buf: jest.fn(() => new Uint8Array(24).fill(7)),
    crypto_aead_xchacha20poly1305_ietf_NPUBBYTES: 24,
    crypto_aead_xchacha20poly1305_ietf_encrypt: jest.fn((data: Uint8Array) => data),
    crypto_aead_xchacha20poly1305_ietf_decrypt: jest.fn((_n: any, data: Uint8Array) => data),
  },
}));

jest.mock('react-native-fs', () => ({
  CachesDirectoryPath: '/mock/cache',
  exists: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn().mockResolvedValue(undefined),
  stat: jest.fn().mockResolvedValue({ size: 3 }),
}));

jest.mock('../../src/services/EncryptedDMService', () => ({
  encryptedDMService: {
    isEncryptedForNetwork: jest.fn(),
    getMessageKeyForNetwork: jest.fn().mockResolvedValue(new Uint8Array(32).fill(1)),
  },
}));

jest.mock('../../src/services/ChannelEncryptionService', () => ({
  channelEncryptionService: {
    hasChannelKey: jest.fn(),
    getChannelKey: jest.fn(),
  },
}));

import RNFS from 'react-native-fs';
import sodium from 'react-native-libsodium';
import { mediaEncryptionService } from '../../src/services/MediaEncryptionService';
import { encryptedDMService } from '../../src/services/EncryptedDMService';
import { channelEncryptionService } from '../../src/services/ChannelEncryptionService';

const mockRNFS = RNFS as unknown as {
  exists: jest.Mock;
  readFile: jest.Mock;
  writeFile: jest.Mock;
  stat: jest.Mock;
};

const mockDM = encryptedDMService as unknown as {
  isEncryptedForNetwork: jest.Mock;
  getMessageKeyForNetwork: jest.Mock;
};

const mockChannel = channelEncryptionService as unknown as {
  hasChannelKey: jest.Mock;
  getChannelKey: jest.Mock;
};

const mockSodium = (sodium as unknown as { default?: any }).default || (sodium as any);

describe('MediaEncryptionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRNFS.exists.mockResolvedValue(true);
    mockRNFS.readFile.mockResolvedValue('QUJD');
    mockRNFS.writeFile.mockResolvedValue(undefined);
    mockChannel.hasChannelKey.mockResolvedValue(false);
    mockDM.isEncryptedForNetwork.mockResolvedValue(false);
    mockChannel.getChannelKey.mockResolvedValue({ key: Buffer.from(new Uint8Array(32).fill(9)).toString('base64') });
    mockDM.getMessageKeyForNetwork.mockResolvedValue(new Uint8Array(32).fill(1));
    mockSodium.crypto_aead_xchacha20poly1305_ietf_encrypt.mockImplementation((d: Uint8Array) => d);
    mockSodium.crypto_aead_xchacha20poly1305_ietf_decrypt.mockImplementation((_n: any, d: Uint8Array) => d);
  });

  it('returns false from hasEncryptionKey when tabId is missing', async () => {
    const result = await mediaEncryptionService.hasEncryptionKey('net', '');
    expect(result).toBe(false);
  });

  it('checks channel encryption key for channel tabs', async () => {
    mockChannel.hasChannelKey.mockResolvedValue(true);

    const result = await mediaEncryptionService.hasEncryptionKey(
      'freenode (2)',
      'channel::freenode::#android'
    );

    expect(result).toBe(true);
    expect(mockChannel.hasChannelKey).toHaveBeenCalledWith('#android', 'freenode (2)');
  });

  it('checks dm encryption for query tabs', async () => {
    mockDM.isEncryptedForNetwork.mockResolvedValue(true);

    const result = await mediaEncryptionService.hasEncryptionKey(
      'libera',
      'query::libera::Alice'
    );

    expect(result).toBe(true);
    expect(mockDM.isEncryptedForNetwork).toHaveBeenCalledWith('libera', 'Alice');
  });

  it('returns false for invalid tab format', async () => {
    const result = await mediaEncryptionService.hasEncryptionKey('net', 'invalid-tab-id');
    expect(result).toBe(false);
  });

  it('returns false for unknown tab type in hasEncryptionKey', async () => {
    const result = await mediaEncryptionService.hasEncryptionKey('net', 'server::net::main');
    expect(result).toBe(false);
  });

  it('returns false when hasEncryptionKey throws internally', async () => {
    mockChannel.hasChannelKey.mockRejectedValueOnce(new Error('lookup failed'));
    const result = await mediaEncryptionService.hasEncryptionKey('net', 'channel::net::#chan');
    expect(result).toBe(false);
  });

  it('returns structured encryption info for channel tab', async () => {
    mockChannel.hasChannelKey.mockResolvedValue(true);

    const info = await mediaEncryptionService.getEncryptionInfo(
      'net',
      'channel::net::#secure'
    );

    expect(info).toEqual({
      hasEncryption: true,
      type: 'channel',
      identifier: '#secure',
    });
  });

  it('returns hasEncryption false when no key exists', async () => {
    mockDM.isEncryptedForNetwork.mockResolvedValue(false);

    const info = await mediaEncryptionService.getEncryptionInfo('net', 'query::net::Bob');

    expect(info).toEqual({ hasEncryption: false });
  });

  it('returns encryption error when source file does not exist', async () => {
    mockRNFS.exists.mockResolvedValue(false);

    const result = await mediaEncryptionService.encryptMediaFile(
      '/does/not/exist.jpg',
      'net',
      'channel::net::#test'
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('File does not exist');
  });

  it('returns decryption error when encrypted file does not exist', async () => {
    mockRNFS.exists.mockResolvedValue(false);

    const result = await mediaEncryptionService.decryptMediaFile(
      '/does/not/exist.enc',
      'net',
      'query::net::Alice'
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Encrypted file does not exist');
  });

  it('encrypts media successfully for channel tab', async () => {
    mockRNFS.exists.mockResolvedValue(true);
    mockRNFS.readFile.mockResolvedValue('QUJD');

    const result = await mediaEncryptionService.encryptMediaFile(
      '/tmp/a.jpg',
      'net',
      'channel::net::#chan',
      'm1'
    );

    expect(result.success).toBe(true);
    expect(result.encryptedUri).toContain('/mock/cache/encrypted_');
    expect(result.nonce).toBeDefined();
    expect(mockRNFS.writeFile).toHaveBeenCalled();
  });

  it('encrypts media successfully for query tab', async () => {
    const result = await mediaEncryptionService.encryptMediaFile(
      '/tmp/a.jpg',
      'net',
      'query::net::Alice',
      'm2'
    );

    expect(result.success).toBe(true);
    expect(mockDM.getMessageKeyForNetwork).toHaveBeenCalledWith('net', 'Alice');
  });

  it('returns error when file is empty on encrypt', async () => {
    mockRNFS.readFile.mockResolvedValueOnce('');
    const result = await mediaEncryptionService.encryptMediaFile(
      '/tmp/a.jpg',
      'net',
      'query::net::Alice'
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('File is empty');
  });

  it('returns cannot access content uri when preflight read fails', async () => {
    mockRNFS.readFile.mockRejectedValueOnce(new Error('no content access'));
    const result = await mediaEncryptionService.encryptMediaFile(
      'content://media/1',
      'net',
      'query::net::Alice'
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('cannot be accessed');
  });

  it('encrypts content uri when preflight and full reads succeed', async () => {
    mockRNFS.readFile
      .mockResolvedValueOnce('QQ==')
      .mockResolvedValueOnce('QUJD');

    const result = await mediaEncryptionService.encryptMediaFile(
      'content://media/ok',
      'net',
      'query::net::Alice'
    );

    expect(result.success).toBe(true);
    expect(result.encryptedUri).toContain('/mock/cache/encrypted_');
  });

  it('returns cannot read file when RNFS.readFile throws', async () => {
    mockRNFS.readFile.mockRejectedValueOnce(new Error('read boom'));

    const result = await mediaEncryptionService.encryptMediaFile(
      '/tmp/a.jpg',
      'net',
      'query::net::Alice'
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Cannot read file');
  });

  it('returns invalid format when base64 content is padding-only', async () => {
    mockRNFS.readFile.mockResolvedValueOnce('====');
    const result = await mediaEncryptionService.encryptMediaFile(
      '/tmp/a.jpg',
      'net',
      'query::net::Alice'
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid file format');
  });

  it('returns error for invalid tab format on encrypt', async () => {
    const result = await mediaEncryptionService.encryptMediaFile(
      '/tmp/a.jpg',
      'net',
      'broken-tab'
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid tab ID format');
  });

  it('returns error for unsupported tab type on encrypt', async () => {
    const result = await mediaEncryptionService.encryptMediaFile(
      '/tmp/a.jpg',
      'net',
      'server::net::main'
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unsupported tab type');
  });

  it('returns error when channel key is missing during encrypt', async () => {
    mockChannel.getChannelKey.mockResolvedValueOnce(null);
    const result = await mediaEncryptionService.encryptMediaFile(
      '/tmp/a.jpg',
      'net',
      'channel::net::#chan'
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('No channel encryption key found');
  });

  it('decrypts media successfully for channel tab', async () => {
    const nonce = new Uint8Array(24).fill(7);
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0x11, 0x22]);
    const all = Buffer.concat([Buffer.from(nonce), Buffer.from(jpegBytes)]).toString('base64');
    mockRNFS.readFile
      .mockResolvedValueOnce(all)
      .mockResolvedValueOnce(Buffer.from(jpegBytes).toString('base64'));

    const result = await mediaEncryptionService.decryptMediaFile(
      '/tmp/encrypted.bin',
      'net',
      'channel::net::#chan',
      'm1'
    );

    expect(result.success).toBe(true);
    expect(result.mimeType).toBe('image/jpeg');
    expect(result.decryptedUri).toContain('/mock/cache/decrypted_');
  });

  it('decrypts media successfully for query tab', async () => {
    const nonce = new Uint8Array(24).fill(7);
    const mp3Bytes = new Uint8Array([0x49, 0x44, 0x33, 0x10]);
    const all = Buffer.concat([Buffer.from(nonce), Buffer.from(mp3Bytes)]).toString('base64');
    mockRNFS.readFile.mockResolvedValueOnce(all);

    const result = await mediaEncryptionService.decryptMediaFile(
      '/tmp/encrypted.bin',
      'net',
      'query::net::Alice',
      'm3'
    );

    expect(result.success).toBe(true);
    expect(result.mimeType).toBe('audio/mpeg');
    expect(mockDM.getMessageKeyForNetwork).toHaveBeenCalledWith('net', 'Alice');
  });

  it('returns error when encrypted file payload is too short', async () => {
    mockRNFS.readFile.mockResolvedValueOnce(Buffer.from([1, 2, 3]).toString('base64'));
    const result = await mediaEncryptionService.decryptMediaFile(
      '/tmp/encrypted.bin',
      'net',
      'channel::net::#chan'
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('File too short');
  });

  it('returns error for invalid tab format on decrypt', async () => {
    const nonce = new Uint8Array(24).fill(7);
    const bytes = new Uint8Array([1, 2, 3]);
    mockRNFS.readFile.mockResolvedValueOnce(
      Buffer.concat([Buffer.from(nonce), Buffer.from(bytes)]).toString('base64')
    );
    const result = await mediaEncryptionService.decryptMediaFile(
      '/tmp/encrypted.bin',
      'net',
      'invalid'
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid tab ID format');
  });

  it('returns error for unsupported tab type on decrypt', async () => {
    const nonce = new Uint8Array(24).fill(7);
    const bytes = new Uint8Array([1, 2, 3]);
    mockRNFS.readFile.mockResolvedValueOnce(
      Buffer.concat([Buffer.from(nonce), Buffer.from(bytes)]).toString('base64')
    );
    const result = await mediaEncryptionService.decryptMediaFile(
      '/tmp/encrypted.bin',
      'net',
      'server::net::main'
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unsupported tab type');
  });

  it('falls back to empty AAD in decrypt chain when needed', async () => {
    const nonce = new Uint8Array(24).fill(7);
    const bytes = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
    mockRNFS.readFile.mockResolvedValueOnce(
      Buffer.concat([Buffer.from(nonce), Buffer.from(bytes)]).toString('base64')
    );
    mockSodium.crypto_aead_xchacha20poly1305_ietf_decrypt
      .mockImplementationOnce(() => {
        throw new Error('aad fail');
      })
      .mockImplementationOnce(() => {
        throw new Error('aad2 fail');
      })
      .mockImplementation((_n: any, d: Uint8Array) => d);

    const result = await mediaEncryptionService.decryptMediaFile(
      '/tmp/encrypted.bin',
      'net',
      'channel::net::#chan',
      'm5'
    );

    expect(result.success).toBe(true);
  });

  it('covers private base64/network/AAD helpers', () => {
    const svc = mediaEncryptionService as any;
    const input = new Uint8Array([1, 2, 3, 4]);
    const b64 = svc.toB64File(input);
    const roundtrip = svc.fromB64File(b64);

    expect(Array.from(roundtrip)).toEqual([1, 2, 3, 4]);
    expect(svc.canonicalizeNetwork(' libera (2) ')).toBe('libera');
    expect(svc.buildMediaAAD('channel', 'libera (3)', '#chan')).toBe('media:channel:libera:#chan');
    expect(svc.buildMediaAAD('query', 'net', 'Alice', 'm9')).toBe('media:query:net:Alice:m9');
  });

  it('covers mime detection and extension mapping helpers', () => {
    const svc = mediaEncryptionService as any;
    expect(svc.detectMimeType(new Uint8Array([0xff, 0xd8, 0xff, 0x00]))).toBe('image/jpeg');
    expect(svc.detectMimeType(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe('image/png');
    expect(svc.detectMimeType(new Uint8Array([0x47, 0x49, 0x46, 0x38]))).toBe('image/gif');
    expect(
      svc.detectMimeType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))
    ).toBe('image/webp');
    expect(svc.detectMimeType(new Uint8Array([0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70]))).toBe('video/mp4');
    expect(svc.detectMimeType(new Uint8Array([0xff, 0xfb, 0x00, 0x00]))).toBe('audio/mpeg');
    expect(svc.detectMimeType(new Uint8Array([1, 2]))).toBe('application/octet-stream');
    expect(svc.getExtensionFromMimeType('image/png')).toBe('.png');
    expect(svc.getExtensionFromMimeType('application/x-unknown')).toBe('.bin');
  });

  it('returns error when file base64 is invalid on encrypt', async () => {
    mockRNFS.readFile.mockResolvedValueOnce('not@base64$');

    const result = await mediaEncryptionService.encryptMediaFile(
      '/tmp/a.jpg',
      'net',
      'query::net::Alice'
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('not valid base64');
  });

  it('returns error when no tabId is provided on encrypt', async () => {
    const result = await mediaEncryptionService.encryptMediaFile('/tmp/a.jpg', 'net', '');
    expect(result).toEqual({ success: false, error: 'No tabId provided for encryption' });
  });

  it('returns error when cache directory is missing during encrypt', async () => {
    mockRNFS.exists
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    const result = await mediaEncryptionService.encryptMediaFile(
      '/tmp/a.jpg',
      'net',
      'query::net::Alice'
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Cache directory does not exist');
  });

  it('returns error when encrypted file write fails', async () => {
    mockRNFS.writeFile.mockRejectedValueOnce(new Error('write failed'));
    const result = await mediaEncryptionService.encryptMediaFile(
      '/tmp/a.jpg',
      'net',
      'query::net::Alice'
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to save encrypted file');
  });

  it('returns error when encrypted file write rejects with string', async () => {
    mockRNFS.writeFile.mockRejectedValueOnce('write failed string');
    const result = await mediaEncryptionService.encryptMediaFile(
      '/tmp/a.jpg',
      'net',
      'query::net::Alice'
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('write failed string');
  });

  it('returns error when encrypted file write rejects with broken toString object', async () => {
    mockRNFS.writeFile.mockRejectedValueOnce({
      toString: () => {
        throw new Error('toString failed');
      },
    });
    const result = await mediaEncryptionService.encryptMediaFile(
      '/tmp/a.jpg',
      'net',
      'query::net::Alice'
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown write error');
  });

  it('returns error when encrypted file is not created after write', async () => {
    mockRNFS.exists
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    const result = await mediaEncryptionService.encryptMediaFile(
      '/tmp/a.jpg',
      'net',
      'query::net::Alice'
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('File was not created');
  });

  it('returns decryption error when no tabId is provided', async () => {
    const nonce = new Uint8Array(24).fill(7);
    const bytes = new Uint8Array([1, 2, 3, 4]);
    mockRNFS.readFile.mockResolvedValueOnce(
      Buffer.concat([Buffer.from(nonce), Buffer.from(bytes)]).toString('base64')
    );

    const result = await mediaEncryptionService.decryptMediaFile('/tmp/encrypted.bin', 'net', '');
    expect(result).toEqual({ success: false, error: 'No tabId provided for decryption' });
  });

  it('returns error when cache directory is missing during decrypt', async () => {
    const nonce = new Uint8Array(24).fill(7);
    const bytes = new Uint8Array([1, 2, 3, 4]);
    mockRNFS.readFile.mockResolvedValueOnce(
      Buffer.concat([Buffer.from(nonce), Buffer.from(bytes)]).toString('base64')
    );
    mockRNFS.exists
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    const result = await mediaEncryptionService.decryptMediaFile(
      '/tmp/encrypted.bin',
      'net',
      'query::net::Alice'
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('Cache directory does not exist');
  });

  it('returns decryption error when write of decrypted file fails', async () => {
    const nonce = new Uint8Array(24).fill(7);
    const bytes = new Uint8Array([1, 2, 3, 4]);
    mockRNFS.readFile.mockResolvedValueOnce(
      Buffer.concat([Buffer.from(nonce), Buffer.from(bytes)]).toString('base64')
    );
    mockRNFS.writeFile.mockRejectedValueOnce(new Error('dec write failed'));

    const result = await mediaEncryptionService.decryptMediaFile(
      '/tmp/encrypted.bin',
      'net',
      'query::net::Alice'
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to save decrypted file');
  });

  it('returns decryption error when decrypted file is not created after write', async () => {
    const nonce = new Uint8Array(24).fill(7);
    const bytes = new Uint8Array([1, 2, 3, 4]);
    mockRNFS.readFile.mockResolvedValueOnce(
      Buffer.concat([Buffer.from(nonce), Buffer.from(bytes)]).toString('base64')
    );
    mockRNFS.exists
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    const result = await mediaEncryptionService.decryptMediaFile(
      '/tmp/encrypted.bin',
      'net',
      'query::net::Alice'
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('File was not created');
  });

  it('uses original file:// uri fallback when normalized path does not exist', async () => {
    mockRNFS.exists
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);

    await mediaEncryptionService.encryptMediaFile(
      'file:///tmp/a.jpg',
      'net',
      'query::net::Alice'
    );

    expect(mockRNFS.readFile).toHaveBeenCalledWith('/tmp/a.jpg', 'base64');
  });

  it('returns conversion failed when cleaned base64 decodes to empty bytes', async () => {
    mockRNFS.readFile.mockResolvedValueOnce('   ');
    const result = await mediaEncryptionService.encryptMediaFile(
      '/tmp/a.jpg',
      'net',
      'query::net::Alice'
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('File conversion failed');
  });

  it('returns invalid format when base64 decode throws', async () => {
    const fromSpy = jest.spyOn(Buffer, 'from').mockImplementationOnce(() => {
      throw new Error('decode fail');
    });
    mockRNFS.readFile.mockResolvedValueOnce('QUJD');

    const result = await mediaEncryptionService.encryptMediaFile(
      '/tmp/a.jpg',
      'net',
      'query::net::Alice'
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('decode fail');
    fromSpy.mockRestore();
  });

  it('returns encrypted data empty error when nonce and encrypted payload are empty', async () => {
    mockSodium.randombytes_buf.mockReturnValueOnce(new Uint8Array([]));
    mockSodium.crypto_aead_xchacha20poly1305_ietf_encrypt.mockReturnValueOnce(new Uint8Array([]));

    const result = await mediaEncryptionService.encryptMediaFile(
      '/tmp/a.jpg',
      'net',
      'query::net::Alice'
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Encrypted data is empty');
  });

  it('handles encrypted write verification error when exists throws string', async () => {
    mockRNFS.exists
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce('exists failed');

    const result = await mediaEncryptionService.encryptMediaFile(
      '/tmp/a.jpg',
      'net',
      'query::net::Alice'
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('exists failed');
  });

  it('handles encrypted write verification error when exists throws toString object', async () => {
    mockRNFS.exists
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce({
        toString: () => 'exists object fail',
      });

    const result = await mediaEncryptionService.encryptMediaFile(
      '/tmp/a.jpg',
      'net',
      'query::net::Alice'
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('exists object fail');
  });

  it('returns top-level encryption error from string throw', async () => {
    mockRNFS.exists.mockRejectedValueOnce('hard fail');

    const result = await mediaEncryptionService.encryptMediaFile(
      '/tmp/a.jpg',
      'net',
      'query::net::Alice'
    );

    expect(result).toEqual({ success: false, error: 'hard fail' });
  });

  it('returns top-level encryption error from toString object throw', async () => {
    mockRNFS.exists.mockRejectedValueOnce({ toString: () => 'obj fail' });

    const result = await mediaEncryptionService.encryptMediaFile(
      '/tmp/a.jpg',
      'net',
      'query::net::Alice'
    );

    expect(result).toEqual({ success: false, error: 'obj fail' });
  });

  it('parses multipart payload during decrypt', async () => {
    const nonce = new Uint8Array(24).fill(7);
    const body = Buffer.concat([Buffer.from(nonce), Buffer.from([0xff, 0xd8, 0xff, 0x00])]);
    const multipart = Buffer.concat([
      Buffer.from('--*****\r\nContent-Disposition: form-data; name="file"; filename="x"\r\n\r\n'),
      body,
      Buffer.from('\r\n--*****--\r\n'),
    ]);
    mockRNFS.readFile.mockResolvedValueOnce(multipart.toString('base64'));

    const result = await mediaEncryptionService.decryptMediaFile(
      '/tmp/encrypted.bin',
      'net',
      'query::net::Alice'
    );

    expect(result.success).toBe(true);
    expect(result.mimeType).toBe('image/jpeg');
  });

  it('decrypts successfully when encrypted file base64 needs padding', async () => {
    const nonce = new Uint8Array(24).fill(7);
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const unpadded = Buffer.concat([Buffer.from(nonce), Buffer.from(bytes)])
      .toString('base64')
      .replace(/=+$/, '');
    mockRNFS.readFile.mockResolvedValueOnce(unpadded);

    const result = await mediaEncryptionService.decryptMediaFile(
      '/tmp/encrypted.bin',
      'net',
      'query::net::Alice'
    );

    expect(result.success).toBe(true);
  });

  it('returns decryption error when channel key is missing on decrypt', async () => {
    const nonce = new Uint8Array(24).fill(7);
    const bytes = new Uint8Array([1, 2, 3, 4]);
    mockRNFS.readFile.mockResolvedValueOnce(
      Buffer.concat([Buffer.from(nonce), Buffer.from(bytes)]).toString('base64')
    );
    mockChannel.getChannelKey.mockResolvedValueOnce(null);

    const result = await mediaEncryptionService.decryptMediaFile(
      '/tmp/encrypted.bin',
      'net',
      'channel::net::#chan'
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('No channel encryption key found');
  });

  it('uses second decrypt attempt for channel when first AAD fails', async () => {
    const nonce = new Uint8Array(24).fill(7);
    const bytes = new Uint8Array([9, 8, 7, 6]);
    mockRNFS.readFile.mockResolvedValueOnce(
      Buffer.concat([Buffer.from(nonce), Buffer.from(bytes)]).toString('base64')
    );
    mockSodium.crypto_aead_xchacha20poly1305_ietf_decrypt
      .mockImplementationOnce(() => {
        throw new Error('first aad failed');
      })
      .mockImplementationOnce((_n: any, d: Uint8Array) => d);

    const result = await mediaEncryptionService.decryptMediaFile(
      '/tmp/encrypted.bin',
      'net',
      'channel::net::#chan',
      'm-fallback'
    );

    expect(result.success).toBe(true);
  });

  it('uses second decrypt attempt for DM when first AAD fails', async () => {
    const nonce = new Uint8Array(24).fill(7);
    const bytes = new Uint8Array([9, 8, 7, 6]);
    mockRNFS.readFile.mockResolvedValueOnce(
      Buffer.concat([Buffer.from(nonce), Buffer.from(bytes)]).toString('base64')
    );
    mockSodium.crypto_aead_xchacha20poly1305_ietf_decrypt
      .mockImplementationOnce(() => {
        throw new Error('aad with media id failed');
      })
      .mockImplementationOnce((_n: any, d: Uint8Array) => d);

    const result = await mediaEncryptionService.decryptMediaFile(
      '/tmp/encrypted.bin',
      'net',
      'query::net::Alice',
      'm-dm'
    );

    expect(result.success).toBe(true);
  });

  it('uses third decrypt attempt for DM when first two AAD attempts fail', async () => {
    const nonce = new Uint8Array(24).fill(7);
    const bytes = new Uint8Array([9, 8, 7, 6]);
    mockRNFS.readFile.mockResolvedValueOnce(
      Buffer.concat([Buffer.from(nonce), Buffer.from(bytes)]).toString('base64')
    );
    mockSodium.crypto_aead_xchacha20poly1305_ietf_decrypt
      .mockImplementationOnce(() => {
        throw new Error('aad1 failed');
      })
      .mockImplementationOnce(() => {
        throw new Error('aad2 failed');
      })
      .mockImplementationOnce((_n: any, d: Uint8Array) => d);

    const result = await mediaEncryptionService.decryptMediaFile(
      '/tmp/encrypted.bin',
      'net',
      'query::net::Alice',
      'm-dm2'
    );

    expect(result.success).toBe(true);
  });

  it('returns decryption error when decrypted payload is empty', async () => {
    const nonce = new Uint8Array(24).fill(7);
    const bytes = new Uint8Array([1, 2, 3, 4]);
    mockRNFS.readFile.mockResolvedValueOnce(
      Buffer.concat([Buffer.from(nonce), Buffer.from(bytes)]).toString('base64')
    );
    mockSodium.crypto_aead_xchacha20poly1305_ietf_decrypt.mockImplementationOnce(
      () => new Uint8Array([])
    );

    const result = await mediaEncryptionService.decryptMediaFile(
      '/tmp/encrypted.bin',
      'net',
      'query::net::Alice'
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Decrypted data is empty');
  });

  it('handles decrypted write rejection with string error', async () => {
    const nonce = new Uint8Array(24).fill(7);
    const bytes = new Uint8Array([1, 2, 3, 4]);
    mockRNFS.readFile.mockResolvedValueOnce(
      Buffer.concat([Buffer.from(nonce), Buffer.from(bytes)]).toString('base64')
    );
    mockRNFS.writeFile.mockRejectedValueOnce('write string fail');

    const result = await mediaEncryptionService.decryptMediaFile(
      '/tmp/encrypted.bin',
      'net',
      'query::net::Alice'
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('write string fail');
  });

  it('handles decrypted write rejection with broken toString object', async () => {
    const nonce = new Uint8Array(24).fill(7);
    const bytes = new Uint8Array([1, 2, 3, 4]);
    mockRNFS.readFile.mockResolvedValueOnce(
      Buffer.concat([Buffer.from(nonce), Buffer.from(bytes)]).toString('base64')
    );
    mockRNFS.writeFile.mockRejectedValueOnce({
      toString: () => {
        throw new Error('bad toString');
      },
    });

    const result = await mediaEncryptionService.decryptMediaFile(
      '/tmp/encrypted.bin',
      'net',
      'query::net::Alice'
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown write error');
  });

  it('handles decrypted write synchronous throw path', async () => {
    const nonce = new Uint8Array(24).fill(7);
    const bytes = new Uint8Array([1, 2, 3, 4]);
    mockRNFS.readFile.mockResolvedValueOnce(
      Buffer.concat([Buffer.from(nonce), Buffer.from(bytes)]).toString('base64')
    );
    mockRNFS.writeFile.mockImplementationOnce(() => {
      throw new Error('sync write boom');
    });

    const result = await mediaEncryptionService.decryptMediaFile(
      '/tmp/encrypted.bin',
      'net',
      'query::net::Alice'
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Synchronous error');
  });

  it('handles decrypted file exists check string throw', async () => {
    const nonce = new Uint8Array(24).fill(7);
    const bytes = new Uint8Array([1, 2, 3, 4]);
    mockRNFS.readFile.mockResolvedValueOnce(
      Buffer.concat([Buffer.from(nonce), Buffer.from(bytes)]).toString('base64')
    );
    mockRNFS.exists
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce('exists decrypt fail');

    const result = await mediaEncryptionService.decryptMediaFile(
      '/tmp/encrypted.bin',
      'net',
      'query::net::Alice'
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('exists decrypt fail');
  });

  it('handles decrypted file exists check toString object throw', async () => {
    const nonce = new Uint8Array(24).fill(7);
    const bytes = new Uint8Array([1, 2, 3, 4]);
    mockRNFS.readFile.mockResolvedValueOnce(
      Buffer.concat([Buffer.from(nonce), Buffer.from(bytes)]).toString('base64')
    );
    mockRNFS.exists
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce({
        toString: () => 'exists decrypt obj fail',
      });

    const result = await mediaEncryptionService.decryptMediaFile(
      '/tmp/encrypted.bin',
      'net',
      'query::net::Alice'
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('exists decrypt obj fail');
  });

  it('returns top-level decryption error from string throw', async () => {
    mockRNFS.exists.mockRejectedValueOnce('decrypt hard fail');
    const result = await mediaEncryptionService.decryptMediaFile(
      '/tmp/encrypted.bin',
      'net',
      'query::net::Alice'
    );
    expect(result).toEqual({ success: false, error: 'decrypt hard fail' });
  });

  it('returns top-level decryption error from toString object throw', async () => {
    mockRNFS.exists.mockRejectedValueOnce({ toString: () => 'decrypt obj fail' });
    const result = await mediaEncryptionService.decryptMediaFile(
      '/tmp/encrypted.bin',
      'net',
      'query::net::Alice'
    );
    expect(result).toEqual({ success: false, error: 'decrypt obj fail' });
  });

  it('returns false encryption info on malformed tab when has key says true', async () => {
    jest.spyOn(mediaEncryptionService, 'hasEncryptionKey').mockResolvedValueOnce(true);
    const info = await mediaEncryptionService.getEncryptionInfo('net', 'broken');
    expect(info).toEqual({ hasEncryption: false });
  });

  it('returns false encryption info when tabId is empty even if has key says true', async () => {
    jest.spyOn(mediaEncryptionService, 'hasEncryptionKey').mockResolvedValueOnce(true);
    const info = await mediaEncryptionService.getEncryptionInfo('net', '');
    expect(info).toEqual({ hasEncryption: false });
  });

  it('returns false encryption info when hasEncryptionKey throws', async () => {
    jest.spyOn(mediaEncryptionService, 'hasEncryptionKey').mockRejectedValueOnce(new Error('info fail'));
    const info = await mediaEncryptionService.getEncryptionInfo('net', 'query::net::Alice');
    expect(info).toEqual({ hasEncryption: false });
  });
});

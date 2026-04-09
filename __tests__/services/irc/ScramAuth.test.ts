/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

jest.mock('react-native-libsodium', () => {
  const crypto = require('crypto');

  const toBytes = (input: Uint8Array | number[] | Buffer): Uint8Array => {
    if (input instanceof Uint8Array) return input;
    if (Buffer.isBuffer(input)) return new Uint8Array(input);
    return new Uint8Array(input);
  };

  const api = {
    ready: Promise.resolve(),
    base64_variants: { ORIGINAL: 'ORIGINAL' },
    randombytes_buf: (length: number) =>
      new Uint8Array(Array.from({ length }, (_, i) => (i + 1) & 0xff)),
    crypto_hash_sha256: (data: Uint8Array | number[] | Buffer) => {
      const digest = crypto
        .createHash('sha256')
        .update(Buffer.from(toBytes(data)))
        .digest();
      return new Uint8Array(digest);
    },
    crypto_generichash: (
      outLen: number,
      _key: string,
      data: Uint8Array | number[] | Buffer,
    ) => {
      const digest = crypto
        .createHash('sha256')
        .update(Buffer.from(toBytes(data)))
        .digest();
      return new Uint8Array(digest.slice(0, outLen));
    },
    to_base64: (bytes: Uint8Array | number[] | Buffer) =>
      Buffer.from(toBytes(bytes)).toString('base64'),
    from_base64: (str: string) => new Uint8Array(Buffer.from(str, 'base64')),
  };

  return {
    __esModule: true,
    default: api,
  };
});

import {
  ScramAuthService,
  buildClientFinalMessage,
  buildClientFirstMessage,
  parseServerFirstMessage,
  scramInit,
  verifyServerFinalMessage,
  type ScramState,
} from '../../../src/services/irc/ScramAuth';

const toB64 = (text: string): string =>
  Buffer.from(text, 'utf8').toString('base64');
const fromB64 = (text: string): string =>
  Buffer.from(text, 'base64').toString('utf8');

describe('ScramAuth', () => {
  it('initializes SCRAM states for plain and plus mechanisms', async () => {
    const normal = await scramInit('SCRAM-SHA-256');
    expect(normal.mechanism).toBe('SCRAM-SHA-256');
    expect(normal.gs2Header).toBe('n,,');
    expect(normal.clientNonce).toBeTruthy();

    const plus = await scramInit(
      'SCRAM-SHA-256-PLUS',
      new Uint8Array([1, 2, 3]),
    );
    expect(plus.mechanism).toBe('SCRAM-SHA-256-PLUS');
    expect(plus.gs2Header.startsWith('p=tls-unique,,')).toBe(true);
  });

  it('builds client-first message and escapes username', async () => {
    const state = await scramInit('SCRAM-SHA-256');
    const { message, state: nextState } = buildClientFirstMessage(
      state,
      'user,=name',
    );

    const decoded = fromB64(message);
    expect(decoded.startsWith('n,,')).toBe(true);
    expect(decoded).toContain('n=user=2C=3Dname');
    expect(nextState.clientFirstMessageBare).toContain('n=user=2C=3Dname');
  });

  it('parses server-first message success and validation failures', async () => {
    const base = await scramInit('SCRAM-SHA-256');
    const goodPayload = `r=${base.clientNonce}SERVER,s=${Buffer.from('salt').toString('base64')},i=4096`;

    const ok = parseServerFirstMessage(base, toB64(goodPayload));
    expect(ok.success).toBe(true);
    expect(ok.state?.iterations).toBe(4096);
    expect(ok.state?.serverNonce).toBe(`${base.clientNonce}SERVER`);

    const badNonce = parseServerFirstMessage(
      base,
      toB64(`r=wrongnonce,s=${Buffer.from('salt').toString('base64')},i=4096`),
    );
    expect(badNonce.success).toBe(false);
    expect(badNonce.error).toContain('nonce');

    const lowIter = parseServerFirstMessage(
      base,
      toB64(
        `r=${base.clientNonce}SERVER,s=${Buffer.from('salt').toString('base64')},i=10`,
      ),
    );
    expect(lowIter.success).toBe(false);
    expect(lowIter.error).toContain('Iteration count too low');
  });

  it('builds client-final message with proof', async () => {
    const state: ScramState = {
      mechanism: 'SCRAM-SHA-256',
      clientNonce: 'abc',
      serverNonce: 'abcserver',
      salt: new Uint8Array([1, 2, 3, 4]),
      iterations: 4096,
      gs2Header: 'n,,',
      clientFirstMessageBare: 'n=user,r=abc',
      serverFirstMessage: 'r=abcserver,s=AQIDBA==,i=4096',
      authMessage: '',
    };

    const { message, state: nextState } = await buildClientFinalMessage(
      state,
      'password123',
    );
    const decoded = fromB64(message);

    expect(decoded).toContain('c=biws');
    expect(decoded).toContain('r=abcserver');
    expect(decoded).toContain(',p=');
    expect(nextState.authMessage).toContain('n=user,r=abc');
  });

  it('verifies server-final message success and error branches', () => {
    const state: ScramState = {
      mechanism: 'SCRAM-SHA-256',
      clientNonce: 'abc',
      serverNonce: 'abcserver',
      salt: new Uint8Array([1, 2, 3, 4]),
      iterations: 4096,
      gs2Header: 'n,,',
      clientFirstMessageBare: 'n=user,r=abc',
      serverFirstMessage: 'r=abcserver,s=AQIDBA==,i=4096',
      authMessage: 'msg',
    };

    const sig = new Uint8Array([10, 20, 30]);
    const ok = verifyServerFinalMessage(
      state,
      toB64(`v=${Buffer.from(sig).toString('base64')}`),
      sig,
    );
    expect(ok.success).toBe(true);

    const mismatch = verifyServerFinalMessage(
      state,
      toB64(`v=${Buffer.from([10, 20, 31]).toString('base64')}`),
      sig,
    );
    expect(mismatch.success).toBe(false);
    expect(mismatch.error).toContain('mismatch');

    const serverErr = verifyServerFinalMessage(
      state,
      toB64('e=invalid-proof'),
      sig,
    );
    expect(serverErr.success).toBe(false);
    expect(serverErr.error).toContain('Server error');

    const malformed = verifyServerFinalMessage(state, toB64('oops'), sig);
    expect(malformed.success).toBe(false);
    expect(malformed.error).toContain('format');
  });

  it('supports ScramAuthService lifecycle and guards', async () => {
    const service = new ScramAuthService();

    expect(service.getMechanism()).toBeNull();
    expect(service.processServerFirst('anything')).toEqual({
      success: false,
      error: 'SCRAM not initialized',
    });
    expect(service.verifyServerFinal('anything')).toEqual({
      success: false,
      error: 'SCRAM not initialized or client-final not sent',
    });

    await service.init('SCRAM-SHA-256');
    expect(service.getMechanism()).toBe('SCRAM-SHA-256');

    const clientFirst = service.buildClientFirst('user');
    expect(clientFirst).toBeTruthy();

    const state = (service as any).state as ScramState;
    const serverFirst = `r=${state.clientNonce}SERVER,s=${Buffer.from('salt').toString('base64')},i=4096`;
    const parsed = service.processServerFirst(toB64(serverFirst));
    expect(parsed.success).toBe(true);

    const clientFinal = await service.buildClientFinal('password123');
    expect(clientFinal).toBeTruthy();

    const manualSig = new Uint8Array([1, 2, 3]);
    (service as any).serverSignature = manualSig;
    const verify = service.verifyServerFinal(
      toB64(`v=${Buffer.from(manualSig).toString('base64')}`),
    );
    expect(verify.success).toBe(true);

    service.reset();
    expect(service.getMechanism()).toBeNull();
  });

  it('throws when client steps are called before init', async () => {
    const service = new ScramAuthService();
    expect(() => service.buildClientFirst('user')).toThrow(
      'SCRAM not initialized',
    );
    await expect(service.buildClientFinal('pw')).rejects.toThrow(
      'SCRAM not initialized',
    );
  });
});

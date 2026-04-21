/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Platform } from 'react-native';
import { Buffer } from 'buffer';
import { logger } from './Logger';
import { playIntegrityService } from './PlayIntegrityService';

export interface PlayIntegrityRequestSecurity {
  integrityToken: string;
  requestHash: string;
  issuedAtEpochSeconds: number;
}

let warnedMissingCryptoApi = false;

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  const cryptoApi = (globalThis as any)?.crypto;
  if (cryptoApi?.getRandomValues) {
    cryptoApi.getRandomValues(bytes);
    return bytes;
  }

  if (!warnedMissingCryptoApi) {
    warnedMissingCryptoApi = true;
    logger.warn(
      'play-integrity',
      'crypto.getRandomValues is unavailable; falling back to Math.random for request hash generation.',
    );
  }

  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Math.floor(Math.random() * 256);
  }

  return bytes;
}

function generateNonceBase64(): string {
  const bytes = randomBytes(18);
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/[=]+$/g, '');
}

export async function createPlayIntegrityRequestSecurity(
  tag: string,
): Promise<PlayIntegrityRequestSecurity | null> {
  if (Platform?.OS !== 'android') {
    return null;
  }

  const requestHash = generateNonceBase64();
  const issuedAtEpochSeconds = Math.floor(Date.now() / 1000);
  const tokenResult =
    await playIntegrityService.requestIntegrityToken(requestHash);

  if (!tokenResult.token) {
    logger.warn(
      'play-integrity',
      `${tag}: token unavailable (${tokenResult.error || 'unknown error'})`,
    );
    return null;
  }

  return {
    integrityToken: tokenResult.token,
    requestHash,
    issuedAtEpochSeconds,
  };
}

export function withPlayIntegrityHeaders(
  headers: Record<string, string>,
  security: PlayIntegrityRequestSecurity | null,
): Record<string, string> {
  if (!security) {
    return headers;
  }

  return {
    ...headers,
    'X-Play-Integrity-Token': security.integrityToken,
    'X-Play-Integrity-Request-Hash': security.requestHash,
    'X-Play-Integrity-Issued-At': security.issuedAtEpochSeconds.toString(),
  };
}

export function withPlayIntegrityBody(
  body: Record<string, unknown>,
  security: PlayIntegrityRequestSecurity | null,
): Record<string, unknown> {
  if (!security) {
    return body;
  }

  return {
    ...body,
    request_security: {
      integrity_token: security.integrityToken,
      request_hash: security.requestHash,
      issued_at: security.issuedAtEpochSeconds,
    },
  };
}

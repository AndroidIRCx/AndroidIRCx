/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Buffer } from 'buffer';
import type { WebRTCCallSignal } from '../types/webrtcCall';

const SIGNAL_PREFIX = '!webrtc ';
const SIGNAL_CHUNK_PREFIX = '!webrtc-chunk ';
const SIGNAL_CHUNK_SIZE = 220;

export interface WebRTCCallSignalChunk {
  id: string;
  sessionId: string;
  index: number;
  total: number;
  data: string;
}

export interface WebRTCCallChunkBuffer {
  total: number;
  parts: Map<number, string>;
}

export const callSignalCodec = {
  encode(signal: WebRTCCallSignal): string {
    return `${SIGNAL_PREFIX}${JSON.stringify(signal)}`;
  },

  decode(raw: string): WebRTCCallSignal | null {
    if (!raw.startsWith(SIGNAL_PREFIX)) {
      return null;
    }

    try {
      return JSON.parse(raw.slice(SIGNAL_PREFIX.length)) as WebRTCCallSignal;
    } catch {
      return null;
    }
  },

  encodeChunked(signal: WebRTCCallSignal, transferId: string): string[] {
    const encodedPayload = Buffer.from(JSON.stringify(signal), 'utf8').toString('base64');
    const total = Math.max(1, Math.ceil(encodedPayload.length / SIGNAL_CHUNK_SIZE));
    const chunks: string[] = [];

    for (let index = 0; index < total; index += 1) {
      const data = encodedPayload.slice(index * SIGNAL_CHUNK_SIZE, (index + 1) * SIGNAL_CHUNK_SIZE);
      const chunk: WebRTCCallSignalChunk = {
        id: transferId,
        sessionId: signal.sessionId,
        index,
        total,
        data,
      };
      chunks.push(`${SIGNAL_CHUNK_PREFIX}${JSON.stringify(chunk)}`);
    }

    return chunks;
  },

  decodeChunk(raw: string): WebRTCCallSignalChunk | null {
    if (!raw.startsWith(SIGNAL_CHUNK_PREFIX)) {
      return null;
    }

    try {
      return JSON.parse(raw.slice(SIGNAL_CHUNK_PREFIX.length)) as WebRTCCallSignalChunk;
    } catch {
      return null;
    }
  },

  appendChunk(buffer: WebRTCCallChunkBuffer | undefined, chunk: WebRTCCallSignalChunk): WebRTCCallChunkBuffer {
    const next = buffer || { total: chunk.total, parts: new Map<number, string>() };
    next.total = chunk.total;
    next.parts.set(chunk.index, chunk.data);
    return next;
  },

  tryAssemble(buffer: WebRTCCallChunkBuffer): WebRTCCallSignal | null {
    if (buffer.parts.size < buffer.total) {
      return null;
    }

    const ordered: string[] = [];
    for (let index = 0; index < buffer.total; index += 1) {
      const part = buffer.parts.get(index);
      if (!part) {
        return null;
      }
      ordered.push(part);
    }

    try {
      const json = Buffer.from(ordered.join(''), 'base64').toString('utf8');
      return JSON.parse(json) as WebRTCCallSignal;
    } catch {
      return null;
    }
  },
};

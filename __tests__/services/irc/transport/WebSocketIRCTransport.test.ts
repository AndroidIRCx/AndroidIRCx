/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { createIRCWebSocket } from '../../../../src/services/irc/transport/WebSocketIRCTransport';

describe('WebSocketIRCTransport', () => {
  const originalWebSocket = (globalThis as { WebSocket?: unknown }).WebSocket;

  afterEach(() => {
    (globalThis as { WebSocket?: unknown }).WebSocket = originalWebSocket;
  });

  it('creates a WebSocket with default subprotocols', () => {
    const calls: Array<{ url: string; subprotocols: unknown }> = [];
    class FakeWebSocket {
      url: string;
      subprotocols: unknown;
      constructor(url: string, subprotocols: unknown) {
        this.url = url;
        this.subprotocols = subprotocols;
        calls.push({ url, subprotocols });
      }
    }
    (globalThis as { WebSocket?: unknown }).WebSocket = FakeWebSocket;

    const ws = createIRCWebSocket('wss://irc.example.net');

    expect(ws).toBeInstanceOf(FakeWebSocket);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('wss://irc.example.net');
    expect(calls[0].subprotocols).toEqual([
      'binary.ircv3.net',
      'text.ircv3.net',
    ]);
  });

  it('creates a WebSocket with custom subprotocols', () => {
    const calls: Array<{ url: string; subprotocols: unknown }> = [];
    class FakeWebSocket {
      constructor(url: string, subprotocols: unknown) {
        calls.push({ url, subprotocols });
      }
    }
    (globalThis as { WebSocket?: unknown }).WebSocket = FakeWebSocket;

    createIRCWebSocket('wss://irc.example.net', ['text.ircv3.net']);

    expect(calls[0].subprotocols).toEqual(['text.ircv3.net']);
  });

  it('throws when WebSocket is not available in the runtime', () => {
    (globalThis as { WebSocket?: unknown }).WebSocket = undefined;

    expect(() => createIRCWebSocket('wss://irc.example.net')).toThrow(
      'WebSocket transport is not available in this runtime',
    );
  });
});

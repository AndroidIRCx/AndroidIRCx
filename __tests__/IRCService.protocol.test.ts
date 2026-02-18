/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * IRC Protocol Handlers Unit Test Suite
 *
 * Direct unit tests for:
 * - CTCPHandlers (parseCTCP, encodeCTCP, handleCTCPRequest)
 * - MultilineHandler (multiline message assembly)
 * - CAPHandlers (CAP LS, ACK, NAK, NEW, DEL)
 */

import { parseCTCP, encodeCTCP, handleCTCPRequest } from '../src/services/irc/protocol/CTCPHandlers';
import { MultilineHandler } from '../src/services/irc/protocol/MultilineHandler';
import { CAPHandlers } from '../src/services/irc/cap/CAPHandlers';

// ========================================
// CTCP HANDLERS
// ========================================
describe('CTCPHandlers', () => {
  describe('parseCTCP', () => {
    it('parses CTCP command with args', () => {
      const result = parseCTCP('\x01VERSION mIRC v7.69\x01');
      expect(result).toEqual({ isCTCP: true, command: 'VERSION', args: 'mIRC v7.69' });
    });

    it('parses CTCP command without args', () => {
      const result = parseCTCP('\x01VERSION\x01');
      expect(result).toEqual({ isCTCP: true, command: 'VERSION' });
    });

    it('uppercases command', () => {
      const result = parseCTCP('\x01version\x01');
      expect(result).toEqual({ isCTCP: true, command: 'VERSION' });
    });

    it('returns false for non-CTCP messages', () => {
      expect(parseCTCP('Hello world')).toEqual({ isCTCP: false });
      expect(parseCTCP('')).toEqual({ isCTCP: false });
      expect(parseCTCP('\x01only start')).toEqual({ isCTCP: false });
    });

    it('parses ACTION messages', () => {
      const result = parseCTCP('\x01ACTION waves\x01');
      expect(result).toEqual({ isCTCP: true, command: 'ACTION', args: 'waves' });
    });

    it('parses PING with timestamp', () => {
      const result = parseCTCP('\x01PING 1234567890\x01');
      expect(result).toEqual({ isCTCP: true, command: 'PING', args: '1234567890' });
    });
  });

  describe('encodeCTCP', () => {
    it('encodes command with args', () => {
      expect(encodeCTCP('VERSION', 'AndroidIRCX')).toBe('\x01VERSION AndroidIRCX\x01');
    });

    it('encodes command without args', () => {
      expect(encodeCTCP('VERSION')).toBe('\x01VERSION\x01');
    });

    it('encodes PING with timestamp', () => {
      expect(encodeCTCP('PING', '123')).toBe('\x01PING 123\x01');
    });
  });

  describe('handleCTCPRequest', () => {
    function createCTCPCtx() {
      const sent: string[] = [];
      const messages: any[] = [];
      return {
        ctx: {
          sendRaw: jest.fn((cmd: string) => sent.push(cmd)),
          addMessage: jest.fn((msg: any) => messages.push(msg)),
          logRaw: jest.fn(),
          getCurrentNick: jest.fn(() => 'tester'),
          getRealname: jest.fn(() => 'Test User'),
          isConnected: jest.fn(() => true),
          getCtcpVersionMessage: jest.fn().mockResolvedValue('https://github.com/AndroidIRCX'),
        },
        sent,
        messages,
      };
    }

    it('responds to VERSION with app info', async () => {
      const { ctx, sent } = createCTCPCtx();
      await handleCTCPRequest(ctx, 'alice', '#chan', 'VERSION');

      expect(sent).toHaveLength(1);
      expect(sent[0]).toContain('NOTICE alice');
      expect(sent[0]).toContain('AndroidIRCX');
    });

    it('responds to TIME with ISO date', async () => {
      const { ctx, sent } = createCTCPCtx();
      await handleCTCPRequest(ctx, 'bob', '#chan', 'TIME');

      expect(sent[0]).toContain('NOTICE bob');
      expect(sent[0]).toMatch(/\d{4}-\d{2}-\d{2}/);
    });

    it('responds to PING by echoing args', async () => {
      const { ctx, sent } = createCTCPCtx();
      await handleCTCPRequest(ctx, 'carol', '#chan', 'PING', '12345');

      expect(sent[0]).toContain('NOTICE carol');
      expect(sent[0]).toContain('12345');
    });

    it('does not respond to ACTION', async () => {
      const { ctx, sent } = createCTCPCtx();
      await handleCTCPRequest(ctx, 'dan', '#chan', 'ACTION', 'waves');

      expect(sent).toHaveLength(0);
    });

    it('responds to CLIENTINFO', async () => {
      const { ctx, sent } = createCTCPCtx();
      await handleCTCPRequest(ctx, 'eve', '#chan', 'CLIENTINFO');

      expect(sent[0]).toContain('ACTION');
      expect(sent[0]).toContain('VERSION');
      expect(sent[0]).toContain('PING');
    });

    it('responds to USERINFO with realname', async () => {
      const { ctx, sent } = createCTCPCtx();
      await handleCTCPRequest(ctx, 'frank', '#chan', 'USERINFO');

      expect(sent[0]).toContain('Test User');
    });

    it('responds to SOURCE with github URL', async () => {
      const { ctx, sent } = createCTCPCtx();
      await handleCTCPRequest(ctx, 'grace', '#chan', 'SOURCE');

      expect(sent[0]).toContain('github');
    });

    it('responds to FINGER with nick', async () => {
      const { ctx, sent } = createCTCPCtx();
      await handleCTCPRequest(ctx, 'hank', '#chan', 'FINGER');

      expect(sent[0]).toContain('tester');
    });

    it('shows DCC request as ctcp message', async () => {
      const { ctx, messages } = createCTCPCtx();
      await handleCTCPRequest(ctx, 'ivan', '#chan', 'DCC', 'SEND file.txt');

      expect(messages[0].type).toBe('ctcp');
      expect(messages[0].text).toContain('DCC');
    });

    it('does not send response when disconnected', async () => {
      const { ctx, sent } = createCTCPCtx();
      ctx.isConnected.mockReturnValue(false);

      await handleCTCPRequest(ctx, 'joe', '#chan', 'VERSION');

      expect(sent).toHaveLength(0);
    });

    it('logs unknown CTCP commands', async () => {
      const { ctx, messages } = createCTCPCtx();
      await handleCTCPRequest(ctx, 'kate', '#chan', 'UNKNOWN_CMD', 'data');

      expect(messages[0].type).toBe('ctcp');
      expect(ctx.logRaw).toHaveBeenCalled();
    });
  });
});

// ========================================
// MULTILINE HANDLER
// ========================================
describe('MultilineHandler', () => {
  let handler: MultilineHandler;

  beforeEach(() => {
    handler = new MultilineHandler();
  });

  it('returns text directly for single-line (no concat tag)', () => {
    const result = handler.handleMultilineMessage(
      'alice', '#chan', 'Hello', undefined,
      { timestamp: Date.now() },
    );
    expect(result).toBe('Hello');
  });

  it('buffers parts when concat tag is non-empty', () => {
    const result = handler.handleMultilineMessage(
      'alice', '#chan', 'Line 1', 'draft/multiline-concat',
      { timestamp: Date.now() },
    );
    expect(result).toBeNull();
  });

  it('buffers multiple parts with non-empty concat tag', () => {
    const r1 = handler.handleMultilineMessage(
      'alice', '#chan', 'Line 1', 'draft/multiline-concat',
      { timestamp: Date.now() },
    );
    const r2 = handler.handleMultilineMessage(
      'alice', '#chan', 'Line 2', 'draft/multiline-concat',
      { timestamp: Date.now() },
    );

    expect(r1).toBeNull();
    expect(r2).toBeNull();
  });

  it('keeps separate buffers per sender/target pair', () => {
    const rA = handler.handleMultilineMessage(
      'alice', '#chan1', 'A1', 'concat',
      { timestamp: Date.now() },
    );
    const rB = handler.handleMultilineMessage(
      'bob', '#chan1', 'B1', 'concat',
      { timestamp: Date.now() },
    );

    // Both should be buffering
    expect(rA).toBeNull();
    expect(rB).toBeNull();
  });

  it('returns last line directly when concat tag is undefined (single-line or final)', () => {
    // The final message in a multiline batch has no concat tag
    // so it returns the text directly via the !concatTag check
    const result = handler.handleMultilineMessage(
      'alice', '#chan', 'Final line', undefined,
      { timestamp: Date.now() },
    );

    expect(result).toBe('Final line');
  });

  it('treats empty string concat as falsy - returns text directly', () => {
    // Empty string is falsy in JS, so '' goes through !concatTag branch
    const result = handler.handleMultilineMessage(
      'alice', '#chan', 'Text', '',
      { timestamp: Date.now() },
    );

    expect(result).toBe('Text');
  });
});

// ========================================
// CAP HANDLERS
// ========================================
describe('CAPHandlers', () => {
  function createCAPCtx(overrides?: Record<string, any>) {
    return {
      capAvailable: new Set<string>(),
      capEnabledSet: new Set<string>(),
      capRequested: new Set<string>(),
      config: null as any,
      getCapLSReceived: jest.fn(() => false),
      setCapLSReceived: jest.fn(),
      setUserhostInNames: jest.fn(),
      setExtendedJoin: jest.fn(),
      getSaslAuthenticating: jest.fn(() => false),
      emit: jest.fn(),
      logRaw: jest.fn(),
      sendRaw: jest.fn(),
      requestCapabilities: jest.fn(),
      endCAPNegotiation: jest.fn(),
      startSASL: jest.fn(),
      ...overrides,
    };
  }

  describe('CAP LS', () => {
    it('parses single-line CAP LS', () => {
      const ctx = createCAPCtx();
      const handler = new CAPHandlers(ctx);

      handler.handleCAPCommand(['LS', ':server-time multi-prefix']);

      expect(ctx.capAvailable.has('server-time')).toBe(true);
      expect(ctx.capAvailable.has('multi-prefix')).toBe(true);
      expect(ctx.setCapLSReceived).toHaveBeenCalledWith(true);
      expect(ctx.requestCapabilities).toHaveBeenCalled();
    });

    it('parses multi-line CAP LS (with *)', () => {
      const ctx = createCAPCtx();
      const handler = new CAPHandlers(ctx);

      handler.handleCAPCommand(['LS', '*', ':server-time multi-prefix']);
      expect(ctx.requestCapabilities).not.toHaveBeenCalled();

      handler.handleCAPCommand(['LS', ':away-notify sasl']);
      expect(ctx.capAvailable.has('server-time')).toBe(true);
      expect(ctx.capAvailable.has('away-notify')).toBe(true);
      expect(ctx.capAvailable.has('sasl')).toBe(true);
      expect(ctx.requestCapabilities).toHaveBeenCalled();
    });

    it('parses capabilities with values (key=value)', () => {
      const ctx = createCAPCtx();
      const handler = new CAPHandlers(ctx);

      handler.handleCAPCommand(['LS', ':sasl=PLAIN,SCRAM-SHA-256 sts=port=6697']);

      expect(ctx.capAvailable.has('sasl')).toBe(true);
      expect(ctx.capAvailable.has('sts')).toBe(true);
    });

    it('emits capabilities event', () => {
      const ctx = createCAPCtx();
      const handler = new CAPHandlers(ctx);

      handler.handleCAPCommand(['LS', ':server-time']);

      expect(ctx.emit).toHaveBeenCalledWith('capabilities', expect.any(Array));
    });
  });

  describe('CAP ACK', () => {
    it('enables acknowledged capabilities', () => {
      const ctx = createCAPCtx();
      const handler = new CAPHandlers(ctx);

      handler.handleCAPCommand(['ACK', ':server-time multi-prefix']);

      expect(ctx.capEnabledSet.has('server-time')).toBe(true);
      expect(ctx.capEnabledSet.has('multi-prefix')).toBe(true);
      expect(ctx.endCAPNegotiation).toHaveBeenCalled();
    });

    it('sets userhostInNames flag on ACK', () => {
      const ctx = createCAPCtx();
      const handler = new CAPHandlers(ctx);

      handler.handleCAPCommand(['ACK', ':userhost-in-names']);

      expect(ctx.setUserhostInNames).toHaveBeenCalledWith(true);
    });

    it('sets extendedJoin flag on ACK', () => {
      const ctx = createCAPCtx();
      const handler = new CAPHandlers(ctx);

      handler.handleCAPCommand(['ACK', ':extended-join']);

      expect(ctx.setExtendedJoin).toHaveBeenCalledWith(true);
    });

    it('starts SASL when sasl is ACKed and config has credentials', () => {
      jest.useFakeTimers();
      const ctx = createCAPCtx({
        config: { sasl: { account: 'user', password: 'pass' } },
      });
      const handler = new CAPHandlers(ctx);

      handler.handleCAPCommand(['ACK', ':sasl']);

      expect(ctx.capEnabledSet.has('sasl')).toBe(true);
      expect(ctx.endCAPNegotiation).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);
      expect(ctx.startSASL).toHaveBeenCalled();
      jest.useRealTimers();
    });

    it('emits sts-policy on sts ACK with value', () => {
      const ctx = createCAPCtx({
        config: { host: 'irc.example.com' },
      });
      const handler = new CAPHandlers(ctx);

      // STS ACK with simple key=value (split at first = gives capName=sts, capValue=duration...)
      handler.handleCAPCommand(['ACK', ':sts=duration']);

      expect(ctx.emit).toHaveBeenCalledWith('sts-policy', 'irc.example.com', 'duration');
    });
  });

  describe('CAP NAK', () => {
    it('removes rejected capabilities from requested set', () => {
      const ctx = createCAPCtx();
      ctx.capRequested.add('message-tags');
      const handler = new CAPHandlers(ctx);

      handler.handleCAPCommand(['NAK', ':message-tags']);

      expect(ctx.capRequested.has('message-tags')).toBe(false);
      expect(ctx.endCAPNegotiation).toHaveBeenCalled();
    });
  });

  describe('CAP NEW', () => {
    it('adds new capabilities to available set', () => {
      const ctx = createCAPCtx();
      const handler = new CAPHandlers(ctx);

      handler.handleCAPCommand(['NEW', ':away-notify typing']);

      expect(ctx.capAvailable.has('away-notify')).toBe(true);
      expect(ctx.capAvailable.has('typing')).toBe(true);
      expect(ctx.emit).toHaveBeenCalledWith('capabilities', expect.any(Array));
    });

    it('triggers SASL re-auth when sasl appears in NEW and creds exist', () => {
      const ctx = createCAPCtx({
        config: { sasl: { account: 'user', password: 'pass' } },
      });
      const handler = new CAPHandlers(ctx);

      handler.handleCAPCommand(['NEW', ':sasl']);

      expect(ctx.sendRaw).toHaveBeenCalledWith('CAP REQ :sasl');
      expect(ctx.capRequested.has('sasl')).toBe(true);
    });

    it('does NOT trigger re-auth when no creds', () => {
      const ctx = createCAPCtx({ config: {} });
      const handler = new CAPHandlers(ctx);

      handler.handleCAPCommand(['NEW', ':sasl']);

      expect(ctx.sendRaw).not.toHaveBeenCalledWith(expect.stringContaining('CAP REQ'));
    });

    it('does NOT trigger re-auth when already authenticating', () => {
      const ctx = createCAPCtx({
        config: { sasl: { account: 'user', password: 'pass' } },
        getSaslAuthenticating: jest.fn(() => true),
      });
      const handler = new CAPHandlers(ctx);

      handler.handleCAPCommand(['NEW', ':sasl']);

      expect(ctx.sendRaw).not.toHaveBeenCalled();
    });
  });

  describe('CAP DEL', () => {
    it('removes capabilities from available and enabled sets', () => {
      const ctx = createCAPCtx();
      ctx.capAvailable.add('away-notify');
      ctx.capEnabledSet.add('away-notify');
      const handler = new CAPHandlers(ctx);

      handler.handleCAPCommand(['DEL', ':away-notify']);

      expect(ctx.capAvailable.has('away-notify')).toBe(false);
      expect(ctx.capEnabledSet.has('away-notify')).toBe(false);
    });

    it('emits updated capabilities', () => {
      const ctx = createCAPCtx();
      ctx.capAvailable.add('typing');
      const handler = new CAPHandlers(ctx);

      handler.handleCAPCommand(['DEL', ':typing']);

      expect(ctx.emit).toHaveBeenCalledWith('capabilities', expect.any(Array));
    });
  });

  describe('CAP with * prefix (client prefix)', () => {
    it('handles CAP * LS correctly', () => {
      const ctx = createCAPCtx();
      const handler = new CAPHandlers(ctx);

      handler.handleCAPCommand(['*', 'LS', ':server-time batch']);

      expect(ctx.capAvailable.has('server-time')).toBe(true);
      expect(ctx.capAvailable.has('batch')).toBe(true);
    });

    it('handles CAP * ACK correctly', () => {
      const ctx = createCAPCtx();
      const handler = new CAPHandlers(ctx);

      handler.handleCAPCommand(['*', 'ACK', ':server-time']);

      expect(ctx.capEnabledSet.has('server-time')).toBe(true);
    });
  });
});

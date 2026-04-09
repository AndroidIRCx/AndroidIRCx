/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  CAPHandlers,
  type CAPHandlerContext,
} from '../../../../src/services/irc/cap/CAPHandlers';

describe('CAPHandlers', () => {
  let ctx: CAPHandlerContext;
  let handlers: CAPHandlers;

  beforeEach(() => {
    jest.useFakeTimers();
    ctx = {
      capAvailable: new Set<string>(),
      capEnabledSet: new Set<string>(),
      capRequested: new Set<string>(),
      config: {
        host: 'irc.example.org',
        sasl: { account: 'alice', password: 'secret' },
      },
      getCapLSReceived: jest.fn().mockReturnValue(false),
      setCapLSReceived: jest.fn(),
      setUserhostInNames: jest.fn(),
      setExtendedJoin: jest.fn(),
      getSaslAuthenticating: jest.fn().mockReturnValue(false),
      emit: jest.fn(),
      logRaw: jest.fn(),
      sendRaw: jest.fn(),
      requestCapabilities: jest.fn(),
      endCAPNegotiation: jest.fn(),
      startSASL: jest.fn(),
    };
    handlers = new CAPHandlers(ctx);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('collects CAP LS values and requests capabilities on the last line', () => {
    handlers.handleCAPCommand(['LS', ':multi-prefix sasl=PLAIN']);

    expect(ctx.capAvailable.has('multi-prefix')).toBe(true);
    expect(ctx.capAvailable.has('sasl')).toBe(true);
    expect(ctx.setCapLSReceived).toHaveBeenCalledWith(true);
    expect(ctx.emit).toHaveBeenCalledWith(
      'capabilities',
      expect.arrayContaining(['multi-prefix', 'sasl']),
    );
    expect(ctx.requestCapabilities).toHaveBeenCalled();
  });

  it('parses star-prefixed multiline CAP LS without finalizing early', () => {
    handlers.handleCAPCommand(['*', 'LS', '*', ':batch echo-message']);

    expect(ctx.capAvailable.has('batch')).toBe(true);
    expect(ctx.capAvailable.has('echo-message')).toBe(true);
    expect(ctx.setCapLSReceived).not.toHaveBeenCalled();
    expect(ctx.requestCapabilities).not.toHaveBeenCalled();
  });

  it('handles CAP ACK and schedules SASL start when sasl is enabled', () => {
    handlers.handleCAPCommand([
      'ACK',
      ':sasl userhost-in-names extended-join sts=duration=60',
    ]);

    expect(ctx.capEnabledSet.has('sasl')).toBe(true);
    expect(ctx.setUserhostInNames).toHaveBeenCalledWith(true);
    expect(ctx.setExtendedJoin).toHaveBeenCalledWith(true);
    expect(ctx.emit).toHaveBeenCalledWith(
      'sts-policy',
      'irc.example.org',
      'duration',
    );

    jest.advanceTimersByTime(51);
    expect(ctx.startSASL).toHaveBeenCalled();
    expect(ctx.endCAPNegotiation).not.toHaveBeenCalled();
  });

  it('ends CAP negotiation on ACK when SASL is not needed', () => {
    ctx.config = { host: 'irc.example.org' };

    handlers.handleCAPCommand(['ACK', ':echo-message']);

    expect(ctx.endCAPNegotiation).toHaveBeenCalled();
    expect(ctx.startSASL).not.toHaveBeenCalled();
  });

  it('supports forced SASL even when the server did not ack sasl', () => {
    ctx.config = { host: 'irc.example.org', sasl: { force: true } };

    handlers.handleCAPCommand(['ACK', ':echo-message']);

    jest.advanceTimersByTime(51);
    expect(ctx.startSASL).toHaveBeenCalled();
  });

  it('handles CAP NAK by removing rejected caps and ending negotiation', () => {
    ctx.capRequested.add('sasl');
    ctx.capRequested.add('multi-prefix');

    handlers.handleCAPCommand(['NAK', ':sasl']);

    expect(ctx.capRequested.has('sasl')).toBe(false);
    expect(ctx.capRequested.has('multi-prefix')).toBe(true);
    expect(ctx.endCAPNegotiation).toHaveBeenCalled();
  });

  it('handles CAP NEW and requests sasl again when credentials exist', () => {
    handlers.handleCAPCommand(['NEW', ':sasl draft/chathistory']);

    expect(ctx.capAvailable.has('sasl')).toBe(true);
    expect(ctx.capRequested.has('sasl')).toBe(true);
    expect(ctx.sendRaw).toHaveBeenCalledWith('CAP REQ :sasl');
    expect(ctx.emit).toHaveBeenCalledWith(
      'capabilities',
      expect.arrayContaining(['sasl', 'draft/chathistory']),
    );
  });

  it('handles CAP DEL by removing available and enabled capabilities', () => {
    ctx.capAvailable.add('sasl');
    ctx.capAvailable.add('multi-prefix');
    ctx.capEnabledSet.add('sasl');

    handlers.handleCAPCommand(['DEL', ':sasl']);

    expect(ctx.capAvailable.has('sasl')).toBe(false);
    expect(ctx.capAvailable.has('multi-prefix')).toBe(true);
    expect(ctx.capEnabledSet.has('sasl')).toBe(false);
    expect(ctx.emit).toHaveBeenCalledWith('capabilities', ['multi-prefix']);
  });
});

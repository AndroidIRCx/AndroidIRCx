/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  authenticateCommandHandlers,
  handleAUTHENTICATE,
} from '../../../../src/services/irc/commands/AuthenticateCommandHandlers';

describe('AuthenticateCommandHandlers', () => {
  const createCtx = () => ({
    logRaw: jest.fn(),
    sendSASLCredentials: jest.fn(),
    setSaslAuthenticating: jest.fn(),
    getSaslMechanism: jest.fn(),
    getSaslState: jest.fn(),
    handleScramServerFirst: jest.fn(),
    handleScramServerFinal: jest.fn(),
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('ignores empty params', () => {
    const ctx = createCtx();
    handleAUTHENTICATE(ctx as any, 'server', [], Date.now());
    expect(ctx.logRaw).not.toHaveBeenCalled();
    expect(ctx.sendSASLCredentials).not.toHaveBeenCalled();
  });

  it('handles server ready marker (+)', () => {
    const ctx = createCtx();
    handleAUTHENTICATE(ctx as any, 'server', ['+'], Date.now());
    expect(ctx.logRaw).toHaveBeenCalledWith(
      'IRCService: Server ready for SASL authentication data',
    );
    expect(ctx.sendSASLCredentials).toHaveBeenCalledTimes(1);
  });

  it('handles abort marker (*)', () => {
    const ctx = createCtx();
    handleAUTHENTICATE(ctx as any, 'server', ['*'], Date.now());
    expect(ctx.logRaw).toHaveBeenCalledWith(
      'IRCService: SASL authentication aborted by server',
    );
    expect(ctx.setSaslAuthenticating).toHaveBeenCalledWith(false);
  });

  it('routes SCRAM server-first message', () => {
    const ctx = createCtx();
    ctx.getSaslMechanism.mockReturnValue('SCRAM-SHA-256');
    ctx.getSaslState.mockReturnValue('client-first-sent');

    handleAUTHENTICATE(ctx as any, 'server', ['sf-message'], Date.now());

    expect(ctx.logRaw).toHaveBeenCalledWith(
      'IRCService: Received SCRAM server-first-message',
    );
    expect(ctx.handleScramServerFirst).toHaveBeenCalledWith('sf-message');
    expect(ctx.handleScramServerFinal).not.toHaveBeenCalled();
  });

  it('routes SCRAM server-final message', () => {
    const ctx = createCtx();
    ctx.getSaslMechanism.mockReturnValue('SCRAM-SHA-256-PLUS');
    ctx.getSaslState.mockReturnValue('client-final-sent');

    handleAUTHENTICATE(ctx as any, 'server', ['sf-final'], Date.now());

    expect(ctx.logRaw).toHaveBeenCalledWith(
      'IRCService: Received SCRAM server-final-message',
    );
    expect(ctx.handleScramServerFinal).toHaveBeenCalledWith('sf-final');
  });

  it('logs unexpected SCRAM state', () => {
    const ctx = createCtx();
    ctx.getSaslMechanism.mockReturnValue('SCRAM-SHA-256');
    ctx.getSaslState.mockReturnValue('idle');

    handleAUTHENTICATE(ctx as any, 'server', ['weird'], Date.now());

    expect(ctx.logRaw).toHaveBeenCalledWith(
      'IRCService: Unexpected SCRAM message in state idle: weird',
    );
    expect(ctx.setSaslAuthenticating).not.toHaveBeenCalled();
  });

  it('handles non-SCRAM error response', () => {
    const ctx = createCtx();
    ctx.getSaslMechanism.mockReturnValue('PLAIN');

    handleAUTHENTICATE(
      ctx as any,
      'server',
      ['AUTHENTICATION_FAILED'],
      Date.now(),
    );

    expect(ctx.logRaw).toHaveBeenCalledWith(
      'IRCService: SASL authentication error: AUTHENTICATION_FAILED',
    );
    expect(ctx.setSaslAuthenticating).toHaveBeenCalledWith(false);
  });

  it('registers AUTHENTICATE handler', () => {
    expect(authenticateCommandHandlers.get('AUTHENTICATE')).toBe(
      handleAUTHENTICATE,
    );
  });
});

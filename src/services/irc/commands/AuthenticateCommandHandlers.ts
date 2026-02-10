/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * AUTHENTICATE command handler for SASL authentication.
 * Supports PLAIN, EXTERNAL, SCRAM-SHA-256, and SCRAM-SHA-256-PLUS mechanisms.
 */

import type { CommandHandler, CommandHandlerRegistry } from '../commandTypes';

/** AUTHENTICATE - SASL authentication exchange */
export const handleAUTHENTICATE: CommandHandler = (ctx, prefix, params) => {
  if (params.length === 0) {
    return;
  }

  const param = params[0];

  if (param === '+') {
    // Server is ready for authentication data
    ctx.logRaw('IRCService: Server ready for SASL authentication data');
    ctx.sendSASLCredentials();
  } else if (param === '*') {
    // Authentication aborted by server
    ctx.logRaw('IRCService: SASL authentication aborted by server');
    ctx.setSaslAuthenticating(false);
  } else if (param && param !== '+') {
    // Check if we're using SCRAM mechanism
    const mechanism = ctx.getSaslMechanism?.();
    const saslState = ctx.getSaslState?.();
    
    if ((mechanism === 'SCRAM-SHA-256' || mechanism === 'SCRAM-SHA-256-PLUS') && saslState) {
      // Handle SCRAM multi-step authentication
      if (saslState === 'client-first-sent') {
        // This is server-first-message
        ctx.logRaw('IRCService: Received SCRAM server-first-message');
        ctx.handleScramServerFirst?.(param);
      } else if (saslState === 'client-final-sent') {
        // This is server-final-message
        ctx.logRaw('IRCService: Received SCRAM server-final-message');
        ctx.handleScramServerFinal?.(param);
      } else {
        ctx.logRaw(`IRCService: Unexpected SCRAM message in state ${saslState}: ${param}`);
      }
    } else {
      // For PLAIN/EXTERNAL, any non-+ response is an error
      ctx.logRaw('IRCService: SASL authentication error: ' + param);
      ctx.setSaslAuthenticating(false);
    }
  }
};

export const authenticateCommandHandlers: CommandHandlerRegistry = new Map([
  ['AUTHENTICATE', handleAUTHENTICATE],
]);

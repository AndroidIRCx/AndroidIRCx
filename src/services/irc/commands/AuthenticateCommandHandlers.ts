/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * AUTHENTICATE command handler for SASL authentication.
 */

import type { CommandHandler, CommandHandlerRegistry } from '../commandTypes';

/** AUTHENTICATE - SASL authentication exchange */
export const handleAUTHENTICATE: CommandHandler = (ctx, prefix, params) => {
  if (params.length > 0) {
    if (params[0] === '+') {
      ctx.logRaw('IRCService: Server ready for SASL authentication data');
      ctx.sendSASLCredentials();
    } else if (params[0] && params[0] !== '+') {
      ctx.logRaw('IRCService: SASL authentication error: ' + params[0]);
      ctx.setSaslAuthenticating(false);
    }
  }
};

export const authenticateCommandHandlers: CommandHandlerRegistry = new Map([
  ['AUTHENTICATE', handleAUTHENTICATE],
]);

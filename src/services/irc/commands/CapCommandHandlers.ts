/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * CAP command handler.
 */

import type { CommandHandler, CommandHandlerRegistry } from '../commandTypes';

export const handleCAP: CommandHandler = (ctx, prefix, params) => {
  ctx.handleCAPCommand(params);
};

export const capCommandHandlers: CommandHandlerRegistry = new Map([
  ['CAP', handleCAP],
]);

/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * BATCH command handlers.
 */

import type { CommandHandler, CommandHandlerRegistry } from '../commandTypes';

export const handleBATCH: CommandHandler = (ctx, prefix, params, timestamp) => {
  if (params.length === 0) return;
  const batchId = params[0];

  if (batchId.startsWith('+')) {
    const refTag = batchId.substring(1);
    const batchType = params[1] || '';
    const batchParams = params.slice(2);
    ctx.handleBatchStart(refTag, batchType, batchParams, timestamp);
  } else if (batchId.startsWith('-')) {
    const refTag = batchId.substring(1);
    ctx.handleBatchEnd(refTag, timestamp);
  }
};

export const batchCommandHandlers: CommandHandlerRegistry = new Map([
  ['BATCH', handleBATCH],
]);

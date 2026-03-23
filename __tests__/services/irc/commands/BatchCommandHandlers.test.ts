/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  batchCommandHandlers,
  handleBATCH,
} from '../../../../src/services/irc/commands/BatchCommandHandlers';

describe('BatchCommandHandlers', () => {
  let ctx: {
    handleBatchStart: jest.Mock;
    handleBatchEnd: jest.Mock;
  };

  beforeEach(() => {
    ctx = {
      handleBatchStart: jest.fn(),
      handleBatchEnd: jest.fn(),
    };
  });

  it('registers the BATCH handler in the command registry', () => {
    expect(batchCommandHandlers.get('BATCH')).toBe(handleBATCH);
    expect(batchCommandHandlers.size).toBe(1);
  });

  it('ignores commands without params', () => {
    handleBATCH(ctx as any, 'server', [], 1234);

    expect(ctx.handleBatchStart).not.toHaveBeenCalled();
    expect(ctx.handleBatchEnd).not.toHaveBeenCalled();
  });

  it('starts a batch when the id has a plus prefix', () => {
    handleBATCH(ctx as any, 'server', ['+abc', 'draft/chathistory', 'target', '123'], 1234);

    expect(ctx.handleBatchStart).toHaveBeenCalledWith(
      'abc',
      'draft/chathistory',
      ['target', '123'],
      1234
    );
    expect(ctx.handleBatchEnd).not.toHaveBeenCalled();
  });

  it('uses an empty string as the batch type when none is provided', () => {
    handleBATCH(ctx as any, 'server', ['+abc'], 1234);

    expect(ctx.handleBatchStart).toHaveBeenCalledWith('abc', '', [], 1234);
  });

  it('ends a batch when the id has a minus prefix', () => {
    handleBATCH(ctx as any, 'server', ['-abc'], 5678);

    expect(ctx.handleBatchEnd).toHaveBeenCalledWith('abc', 5678);
    expect(ctx.handleBatchStart).not.toHaveBeenCalled();
  });

  it('ignores params that are not batch start or end markers', () => {
    handleBATCH(ctx as any, 'server', ['abc', 'draft/chathistory'], 9999);

    expect(ctx.handleBatchStart).not.toHaveBeenCalled();
    expect(ctx.handleBatchEnd).not.toHaveBeenCalled();
  });
});

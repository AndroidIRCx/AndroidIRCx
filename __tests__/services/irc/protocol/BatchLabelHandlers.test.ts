/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for BatchLabelHandlers - Wave 3 coverage target
 */

import {
  BatchLabelManager,
  BatchLabelContext,
} from '../../../../src/services/irc/protocol/BatchLabelHandlers';

jest.mock('../../../../src/i18n/transifex', () => ({
  tx: {
    t: (key: string, params?: Record<string, unknown>) => {
      let result = key;
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          result = result.replace(`{${k}}`, String(v));
        });
      }
      return result;
    },
  },
}));

describe('BatchLabelManager', () => {
  const createMockContext = (): BatchLabelContext => ({
    addMessage: jest.fn(),
    addRawMessage: jest.fn(),
    emit: jest.fn(),
    logRaw: jest.fn(),
    sendRaw: jest.fn(),
    hasCapability: jest.fn().mockReturnValue(true),
  });

  let ctx: BatchLabelContext;
  let manager: BatchLabelManager;

  beforeEach(() => {
    jest.clearAllMocks();
    ctx = createMockContext();
    manager = new BatchLabelManager(ctx);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('handleBatchStart', () => {
    it('should start a new batch', () => {
      manager.handleBatchStart(
        'batch-1',
        'netsplit',
        ['server1', 'server2'],
        Date.now(),
      );

      const batches = manager.getActiveBatches();
      expect(batches.has('batch-1')).toBe(true);
      expect(batches.get('batch-1')).toMatchObject({
        type: 'netsplit',
        params: ['server1', 'server2'],
        messages: [],
      });
    });
  });

  describe('handleBatchEnd', () => {
    it('should process netsplit batch', () => {
      const timestamp = Date.now();
      manager.handleBatchStart(
        'batch-1',
        'netsplit',
        ['server1', 'server2'],
        timestamp,
      );
      manager.addMessageToBatch(
        { type: 'quit', text: 'user1 quit' } as any,
        'batch-1',
      );
      manager.addMessageToBatch(
        { type: 'quit', text: 'user2 quit' } as any,
        'batch-1',
      );

      manager.handleBatchEnd('batch-1', timestamp);

      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'raw',
          text: expect.stringContaining('Netsplit'),
        }),
      );
      expect(ctx.emit).toHaveBeenCalledWith(
        'batch-end',
        'batch-1',
        'netsplit',
        expect.any(Array),
      );
    });

    it('should process netjoin batch', () => {
      const timestamp = Date.now();
      manager.handleBatchStart(
        'batch-1',
        'netjoin',
        ['server1', 'server2'],
        timestamp,
      );
      manager.addMessageToBatch(
        { type: 'join', text: 'user1 joined' } as any,
        'batch-1',
      );

      manager.handleBatchEnd('batch-1', timestamp);

      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'raw',
          text: expect.stringContaining('Netjoin'),
        }),
      );
    });

    it('should process chathistory batch', () => {
      const timestamp = Date.now();
      manager.handleBatchStart('batch-1', 'chathistory', ['param1'], timestamp);
      manager.addMessageToBatch(
        { type: 'message', text: 'msg1' } as any,
        'batch-1',
      );

      manager.handleBatchEnd('batch-1', timestamp);

      expect(ctx.emit).toHaveBeenCalledWith('chathistory-end', {
        refTag: 'batch-1',
        messages: 1,
        params: ['param1'],
      });
    });

    it('should process history batch (event-playback)', () => {
      const timestamp = Date.now();
      manager.handleBatchStart('batch-1', 'history', ['param1'], timestamp);

      manager.handleBatchEnd('batch-1', timestamp);

      expect(ctx.emit).toHaveBeenCalledWith('event-playback', {
        refTag: 'batch-1',
        messages: 0,
        params: ['param1'],
      });
    });

    it('should process znc.in/playback batch', () => {
      const timestamp = Date.now();
      manager.handleBatchStart(
        'batch-1',
        'znc.in/playback',
        ['param1'],
        timestamp,
      );

      manager.handleBatchEnd('batch-1', timestamp);

      expect(ctx.emit).toHaveBeenCalledWith('bouncer-playback', {
        refTag: 'batch-1',
        messages: 0,
        params: ['param1'],
      });
    });

    it('should process cap-notify batch', () => {
      const timestamp = Date.now();
      manager.handleBatchStart('batch-1', 'cap-notify', [], timestamp);
      manager.addMessageToBatch(
        { type: 'cap', text: 'cap changed' } as any,
        'batch-1',
      );

      manager.handleBatchEnd('batch-1', timestamp);

      expect(ctx.addRawMessage).toHaveBeenCalledWith(
        expect.stringContaining('Capability'),
        'server',
      );
    });

    it('should process unknown batch type', () => {
      const timestamp = Date.now();
      manager.handleBatchStart(
        'batch-1',
        'unknown-type',
        ['param1'],
        timestamp,
      );

      manager.handleBatchEnd('batch-1', timestamp);

      expect(ctx.addRawMessage).toHaveBeenCalledWith(
        expect.stringContaining('BATCH END'),
        'server',
      );
    });

    it('should handle end of non-existent batch gracefully', () => {
      expect(() =>
        manager.handleBatchEnd('non-existent', Date.now()),
      ).not.toThrow();
    });
  });

  describe('addMessageToBatch', () => {
    it('should add message to existing batch', () => {
      const timestamp = Date.now();
      manager.handleBatchStart('batch-1', 'netsplit', [], timestamp);

      const message = { type: 'quit', text: 'user quit' } as any;
      manager.addMessageToBatch(message, 'batch-1');

      const batches = manager.getActiveBatches();
      expect(batches.get('batch-1')?.messages).toContain(message);
    });

    it('should not add message if batch does not exist', () => {
      const message = { type: 'quit', text: 'user quit' } as any;

      expect(() =>
        manager.addMessageToBatch(message, 'non-existent'),
      ).not.toThrow();
    });

    it('should not add message if batchTag is undefined', () => {
      const timestamp = Date.now();
      manager.handleBatchStart('batch-1', 'netsplit', [], timestamp);

      const message = { type: 'quit', text: 'user quit' } as any;
      manager.addMessageToBatch(message, undefined);

      const batches = manager.getActiveBatches();
      expect(batches.get('batch-1')?.messages).toHaveLength(0);
    });
  });

  describe('sendRawWithLabel', () => {
    it('should send labeled command when capability available', () => {
      const label = manager.sendRawWithLabel('PRIVMSG #general :Hello');

      expect(label).toMatch(/^androidircx-\d+-1$/);
      expect(ctx.sendRaw).toHaveBeenCalledWith(
        expect.stringMatching(
          /@label=androidircx-\d+-1 PRIVMSG #general :Hello/,
        ),
      );
    });

    it('should send without label when capability not available', () => {
      ctx.hasCapability.mockReturnValue(false);

      const label = manager.sendRawWithLabel('PRIVMSG #general :Hello');

      expect(label).toBe('');
      expect(ctx.sendRaw).toHaveBeenCalledWith('PRIVMSG #general :Hello');
    });

    it('should increment label counter for each label', () => {
      const label1 = manager.sendRawWithLabel('COMMAND1');
      const label2 = manager.sendRawWithLabel('COMMAND2');

      expect(label1).toContain('-1');
      expect(label2).toContain('-2');
    });

    it('should timeout pending label after 30 seconds', () => {
      const callback = jest.fn();
      manager.sendRawWithLabel('PRIVMSG #general :Hello', callback);

      jest.advanceTimersByTime(30001);

      expect(callback).toHaveBeenCalledWith({
        error: 'timeout',
        label: expect.any(String),
        command: 'PRIVMSG #general :Hello',
      });
    });

    it('should not timeout if label is resolved', () => {
      const callback = jest.fn();
      const label = manager.sendRawWithLabel(
        'PRIVMSG #general :Hello',
        callback,
      );

      // Resolve the label
      manager.handleLabeledResponse(label, { success: true });

      jest.advanceTimersByTime(30001);

      expect(callback).not.toHaveBeenCalledWith(
        expect.objectContaining({ error: 'timeout' }),
      );
    });
  });

  describe('handleLabeledResponse', () => {
    it('should handle valid labeled response', () => {
      const callback = jest.fn();
      const label = manager.sendRawWithLabel('WHOIS User1', callback);

      const response = { nick: 'User1', user: 'username', host: 'host' };
      manager.handleLabeledResponse(label, response);

      expect(callback).toHaveBeenCalledWith(response);
      expect(ctx.emit).toHaveBeenCalledWith(
        'labeled-response',
        label,
        'WHOIS User1',
        response,
      );
    });

    it('should handle response without callback', () => {
      const label = manager.sendRawWithLabel('WHOIS User1');

      manager.handleLabeledResponse(label, { success: true });

      expect(ctx.emit).toHaveBeenCalledWith(
        'labeled-response',
        label,
        'WHOIS User1',
        { success: true },
      );
    });

    it('should log unknown label', () => {
      manager.handleLabeledResponse('unknown-label', { success: true });

      expect(ctx.logRaw).toHaveBeenCalledWith(
        expect.stringContaining('unknown label'),
      );
    });
  });

  describe('cleanupLabels', () => {
    it('should cleanup all pending labels', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      manager.sendRawWithLabel('COMMAND1', callback1);
      manager.sendRawWithLabel('COMMAND2', callback2);

      manager.cleanupLabels();

      expect(callback1).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'disconnected' }),
      );
      expect(callback2).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'disconnected' }),
      );
    });

    it('should log number of cleaned up labels', () => {
      manager.sendRawWithLabel('COMMAND1');
      manager.sendRawWithLabel('COMMAND2');

      manager.cleanupLabels();

      expect(ctx.logRaw).toHaveBeenCalledWith(
        expect.stringContaining('Cleaning up 2 pending labels'),
      );
    });

    it('should not log if no pending labels', () => {
      manager.cleanupLabels();

      expect(ctx.logRaw).not.toHaveBeenCalled();
    });
  });

  describe('getActiveBatches', () => {
    it('should return active batches map', () => {
      const timestamp = Date.now();
      manager.handleBatchStart('batch-1', 'netsplit', [], timestamp);

      const batches = manager.getActiveBatches();

      expect(batches.size).toBe(1);
      expect(batches.has('batch-1')).toBe(true);
    });
  });
});

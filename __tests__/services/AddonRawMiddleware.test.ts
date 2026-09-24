/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import {
  AddonRawMiddleware,
  RECONNECT_LOOP_LIMIT,
} from '../../src/services/scripting/AddonRawMiddleware';

const manifest = {
  id: 'raw.addon',
  name: 'Raw',
  author: 'Test',
  version: '1.0.0',
  description: 'Test',
  license: 'MIT',
  apiVersion: 1,
  minAppVersion: '1.10.0',
  entry: 'index.js',
  permissions: ['irc.raw.modify'],
} as any;

interface Harness {
  middleware: AddonRawMiddleware;
  invoke: jest.Mock;
  requireGrant: jest.Mock;
  disable: jest.Mock;
  recordFailure: jest.Mock;
  record: jest.Mock;
}

function harness(deadlineMs = 50): Harness {
  const invoke = jest.fn(async () => ({}) as { resultJson?: string });
  const requireGrant = jest.fn();
  const disable = jest.fn(async () => undefined);
  const recordFailure = jest.fn(async () => false);
  const record = jest.fn(async () => undefined);
  const middleware = new AddonRawMiddleware(
    {
      initialize: jest.fn(async () => undefined),
      get: jest.fn(() => ({ manifest })),
    } as any,
    { initialize: jest.fn(async () => undefined), requireGrant } as any,
    { invoke } as any,
    { disable, recordFailure } as any,
    { initialize: jest.fn(async () => undefined), record } as any,
    deadlineMs,
  );
  return { middleware, invoke, requireGrant, disable, recordFailure, record };
}

const replies = (value: unknown) => async () => ({
  resultJson: JSON.stringify(value),
});

describe('AddonRawMiddleware', () => {
  describe('registration', () => {
    it('requires irc.raw.modify, not irc.read', async () => {
      const h = harness();
      await h.middleware.register('raw.addon', 'onRawOut', 'out');
      expect(h.requireGrant).toHaveBeenCalledWith(
        'raw.addon',
        manifest.permissions,
        'irc.raw.modify',
      );
    });

    it('refuses an unsafe hook name and an addon that is not installed', async () => {
      const h = harness();
      await expect(
        h.middleware.register('raw.addon', 'not a hook', 'out'),
      ).rejects.toThrow(/invalid/i);

      const missing = new AddonRawMiddleware(
        {
          initialize: jest.fn(async () => undefined),
          get: jest.fn(() => undefined),
        } as any,
        {
          initialize: jest.fn(async () => undefined),
          requireGrant: jest.fn(),
        } as any,
        { invoke: jest.fn() } as any,
        { disable: jest.fn(), recordFailure: jest.fn() } as any,
        {
          initialize: jest.fn(async () => undefined),
          record: jest.fn(),
        } as any,
      );
      await expect(
        missing.register('raw.addon', 'onRawOut', 'out'),
      ).rejects.toThrow(/not installed/i);
    });

    it('reports no outgoing modifiers until one registers', async () => {
      const h = harness();
      expect(h.middleware.hasOutgoingModifiers()).toBe(false);
      await h.middleware.register('raw.addon', 'onRawIn', 'in');
      // An inbound hook cannot modify, so it must not force the async path.
      expect(h.middleware.hasOutgoingModifiers()).toBe(false);
      await h.middleware.register('raw.addon', 'onRawOut', 'out');
      expect(h.middleware.hasOutgoingModifiers()).toBe(true);
    });

    it('unregisters through the returned handle', async () => {
      const h = harness();
      const remove = await h.middleware.register(
        'raw.addon',
        'onRawOut',
        'out',
      );
      remove();
      expect(h.middleware.hasOutgoingModifiers()).toBe(false);
    });
  });

  describe('outgoing traffic', () => {
    it('passes a line through untouched when nothing is registered', async () => {
      const h = harness();
      expect(await h.middleware.filterOutgoing('PRIVMSG #a :hi')).toEqual({
        line: 'PRIVMSG #a :hi',
        outcome: 'unchanged',
      });
      expect(h.invoke).not.toHaveBeenCalled();
    });

    it('lets an addon rewrite an ordinary line', async () => {
      const h = harness();
      h.invoke.mockImplementation(replies({ line: 'PRIVMSG #a :rewritten' }));
      await h.middleware.register('raw.addon', 'onRawOut', 'out');

      expect(await h.middleware.filterOutgoing('PRIVMSG #a :hi')).toEqual({
        line: 'PRIVMSG #a :rewritten',
        outcome: 'unchanged',
      });
      expect(h.middleware.getDiagnostics('raw.addon').counters.modified).toBe(
        1,
      );
    });

    it('lets an addon drop a line', async () => {
      const h = harness();
      h.invoke.mockImplementation(replies({ drop: true }));
      await h.middleware.register('raw.addon', 'onRawOut', 'out');

      expect(await h.middleware.filterOutgoing('PRIVMSG #a :hi')).toEqual({
        line: null,
        outcome: 'dropped',
      });
    });

    it.each([
      'PING :x',
      'CAP END',
      'AUTHENTICATE PLAIN',
      'ERROR :x',
      'PASS hunter2',
    ])('never shows %s to an addon', async line => {
      const h = harness();
      await h.middleware.register('raw.addon', 'onRawOut', 'out');
      expect((await h.middleware.filterOutgoing(line)).line).toBe(line);
      expect(h.invoke).not.toHaveBeenCalled();
    });

    it('refuses a replacement that turns an ordinary line into a CAP line', async () => {
      const h = harness();
      h.invoke.mockImplementation(replies({ line: 'CAP END' }));
      await h.middleware.register('raw.addon', 'onRawOut', 'out');

      // The protection is on the output as well as the input, or expert mode
      // would be a way to manufacture transport-critical traffic.
      expect((await h.middleware.filterOutgoing('PRIVMSG #a :hi')).line).toBe(
        'PRIVMSG #a :hi',
      );
      expect(
        h.middleware.getDiagnostics('raw.addon').counters.protectedLines,
      ).toBe(1);
    });

    it('falls back to the original when a replacement smuggles a second command', async () => {
      const h = harness();
      h.invoke.mockImplementation(replies({ line: 'PRIVMSG #a :hi\r\nQUIT' }));
      await h.middleware.register('raw.addon', 'onRawOut', 'out');

      expect((await h.middleware.filterOutgoing('PRIVMSG #a :hi')).line).toBe(
        'PRIVMSG #a :hi',
      );
      expect(h.middleware.getDiagnostics('raw.addon').counters.rejected).toBe(
        1,
      );
    });

    it('keeps the original line when the addon exceeds its deadline', async () => {
      const h = harness(20);
      h.invoke.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 200)),
      );
      await h.middleware.register('raw.addon', 'onRawOut', 'out');

      expect((await h.middleware.filterOutgoing('PRIVMSG #a :hi')).line).toBe(
        'PRIVMSG #a :hi',
      );
      expect(h.middleware.getDiagnostics('raw.addon').counters.timedOut).toBe(
        1,
      );
      expect(h.recordFailure).toHaveBeenCalledWith('raw.addon');
    });

    it('keeps the original line when the addon throws', async () => {
      const h = harness();
      h.invoke.mockRejectedValue(new Error('boom'));
      await h.middleware.register('raw.addon', 'onRawOut', 'out');

      expect((await h.middleware.filterOutgoing('PRIVMSG #a :hi')).line).toBe(
        'PRIVMSG #a :hi',
      );
      expect(h.middleware.getDiagnostics('raw.addon').counters.failed).toBe(1);
    });

    it.each([
      ['a malformed result', 'not json'],
      ['a non-object result', '42'],
      ['a result with no line', '{"other":true}'],
    ])('ignores %s', async (_label, resultJson) => {
      const h = harness();
      h.invoke.mockResolvedValue({ resultJson });
      await h.middleware.register('raw.addon', 'onRawOut', 'out');

      expect((await h.middleware.filterOutgoing('PRIVMSG #a :hi')).line).toBe(
        'PRIVMSG #a :hi',
      );
    });

    it('skips an addon whose grant was revoked and keeps going', async () => {
      const h = harness();
      await h.middleware.register('raw.addon', 'onRawOut', 'out');
      // Revoked after registration: the grant is re-checked on every line, so
      // a revoke takes effect without the addon being reinstalled.
      h.requireGrant.mockImplementation(() => {
        throw new Error('denied');
      });

      expect((await h.middleware.filterOutgoing('PRIVMSG #a :hi')).line).toBe(
        'PRIVMSG #a :hi',
      );
      expect(h.invoke).not.toHaveBeenCalled();
    });

    it('sends each addon the current line, in registration order', async () => {
      const h = harness();
      const seen: string[] = [];
      h.invoke.mockImplementation(async (_id: string, request: any) => {
        const payload = JSON.parse(request.payloadJson);
        seen.push(`${request.hook}:${payload.line}`);
        return { resultJson: JSON.stringify({ line: `${payload.line}!` }) };
      });
      await h.middleware.register('raw.addon', 'first', 'out');
      await h.middleware.register('raw.addon', 'second', 'out');

      expect((await h.middleware.filterOutgoing('PRIVMSG #a :hi')).line).toBe(
        'PRIVMSG #a :hi!!',
      );
      expect(seen).toEqual(['first:PRIVMSG #a :hi', 'second:PRIVMSG #a :hi!']);
    });

    it('truncates an over-long line it produced rather than dropping it', async () => {
      const h = harness();
      const long = `PRIVMSG #a :${'x'.repeat(600)}`;
      h.invoke.mockImplementation(replies({ line: long }));
      await h.middleware.register('raw.addon', 'onRawOut', 'out');

      const decision = await h.middleware.filterOutgoing('PRIVMSG #a :hi');
      expect(decision.outcome).toBe('truncated');
      expect((decision.line as string).length).toBeLessThan(long.length);
    });

    it('stops consulting addons while suspended', async () => {
      const h = harness();
      h.invoke.mockImplementation(replies({ line: 'PRIVMSG #a :rewritten' }));
      await h.middleware.register('raw.addon', 'onRawOut', 'out');
      h.middleware.suspend();

      expect((await h.middleware.filterOutgoing('PRIVMSG #a :hi')).line).toBe(
        'PRIVMSG #a :hi',
      );
      expect(h.invoke).not.toHaveBeenCalled();

      h.middleware.resume();
      expect((await h.middleware.filterOutgoing('PRIVMSG #a :hi')).line).toBe(
        'PRIVMSG #a :rewritten',
      );
    });
  });

  describe('incoming traffic', () => {
    it('shows the line to an inbound hook', async () => {
      const h = harness();
      await h.middleware.register('raw.addon', 'onRawIn', 'in');
      await h.middleware.observeIncoming(':server 001 me :hi');

      expect(h.invoke).toHaveBeenCalledWith('raw.addon', {
        hook: 'onRawIn',
        payloadJson: JSON.stringify({
          line: ':server 001 me :hi',
          direction: 'in',
          command: '001',
        }),
      });
    });

    it('records once that an inbound replacement was ignored', async () => {
      const h = harness();
      h.invoke.mockImplementation(replies({ line: 'rewritten' }));
      await h.middleware.register('raw.addon', 'onRawIn', 'in');

      await h.middleware.observeIncoming(':server 001 me :hi');
      await h.middleware.observeIncoming(':server 002 me :hi');

      // Reported, not silently swallowed - an author who expects inbound
      // rewriting must find out rather than debug nothing happening.
      const ignored = h.record.mock.calls.filter(
        ([entry]: any[]) => entry.action === 'raw.in.result-ignored',
      );
      expect(ignored).toHaveLength(1);
    });

    it('does nothing when no inbound hook is registered', async () => {
      const h = harness();
      await h.middleware.register('raw.addon', 'onRawOut', 'out');
      await h.middleware.observeIncoming(':server 001 me :hi');
      expect(h.invoke).not.toHaveBeenCalled();
    });
  });

  describe('reconnect loop recovery', () => {
    it('disables the last raw modifier after repeated disconnects', async () => {
      const h = harness();
      await h.middleware.register('raw.addon', 'first', 'out');
      await h.middleware.register('raw.addon', 'second', 'out');

      for (let index = 0; index < RECONNECT_LOOP_LIMIT - 1; index += 1)
        expect(await h.middleware.noteDisconnected()).toBeUndefined();

      expect(await h.middleware.noteDisconnected()).toBe('raw.addon');
      expect(h.disable).toHaveBeenCalledWith('raw.addon');
      expect(h.middleware.hasOutgoingModifiers()).toBe(false);
      expect(h.middleware.isSuspended()).toBe(true);
    });

    it('ignores disconnects when no modifier is active', async () => {
      const h = harness();
      for (let index = 0; index <= RECONNECT_LOOP_LIMIT; index += 1)
        expect(await h.middleware.noteDisconnected()).toBeUndefined();
      expect(h.disable).not.toHaveBeenCalled();
    });

    it('clears the tally when a connection registers successfully', async () => {
      const h = harness();
      await h.middleware.register('raw.addon', 'onRawOut', 'out');
      await h.middleware.noteDisconnected();
      await h.middleware.noteDisconnected();
      h.middleware.noteConnected();

      expect(await h.middleware.noteDisconnected()).toBeUndefined();
      expect(h.disable).not.toHaveBeenCalled();
    });
  });

  describe('diagnostics', () => {
    it('fingerprints a change without keeping the line', async () => {
      const h = harness();
      h.invoke.mockImplementation(replies({ line: 'PRIVMSG #a :rewritten' }));
      await h.middleware.register('raw.addon', 'onRawOut', 'out');
      await h.middleware.filterOutgoing('PRIVMSG #a :hi');

      const [entry] = h.middleware.getDiagnostics('raw.addon').recent;
      expect(entry.originalHash).toMatch(/^[0-9a-f]{8}$/);
      expect(entry.resultHash).toMatch(/^[0-9a-f]{8}$/);
      expect(entry.originalHash).not.toBe(entry.resultHash);
      expect(JSON.stringify(entry)).not.toContain('rewritten');
      expect(JSON.stringify(entry)).not.toContain('#a');
    });

    it('records no fingerprint at all for a credential-bearing command', async () => {
      const h = harness();
      await h.middleware.register('raw.addon', 'onRawOut', 'out');
      await h.middleware.filterOutgoing('PASS hunter2');

      const entry = h.middleware
        .getDiagnostics()
        .recent.find(candidate => candidate.command === 'PASS');
      // A digest of a password is still worth attacking and nothing needs it.
      expect(entry?.originalHash).toBeUndefined();
      expect(entry?.resultHash).toBeUndefined();
    });

    it('totals counters across addons and filters by addon', async () => {
      const h = harness();
      h.invoke.mockImplementation(replies({ drop: true }));
      await h.middleware.register('raw.addon', 'onRawOut', 'out');
      await h.middleware.filterOutgoing('PRIVMSG #a :hi');

      expect(h.middleware.getDiagnostics('raw.addon').counters.dropped).toBe(1);
      expect(h.middleware.getDiagnostics().counters.dropped).toBe(1);
      expect(h.middleware.getDiagnostics('other').counters.dropped).toBe(0);
    });
  });
});

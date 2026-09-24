/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import {
  AddonSignalBus,
  MAX_DEPTH,
  MAX_HANDLERS_PER_ADDON,
  MAX_PAYLOAD_BYTES,
  MAX_SIGNALS_PER_SECOND,
} from '../../src/services/scripting/AddonSignalBus';

const A = 'addon.a';
const B = 'addon.b';

describe('AddonSignalBus', () => {
  let bus: AddonSignalBus;

  beforeEach(() => {
    bus = new AddonSignalBus();
  });

  describe('delivery', () => {
    it('broadcasts to other add-ons listening for the name', () => {
      const heard = jest.fn();
      bus.on(B, 'ping', heard);

      expect(bus.send(A, 'ping', { n: 1 })).toEqual({ delivered: 1 });
      expect(heard).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'ping',
          payload: { n: 1 },
          from: A,
          scope: 'broadcast',
          depth: 1,
        }),
      );
    });

    it('does not deliver a broadcast back to its sender', () => {
      const own = jest.fn();
      bus.on(A, 'ping', own);
      // Handling your own broadcast is the first half of every loop.
      expect(bus.send(A, 'ping', null)).toEqual({ delivered: 0 });
      expect(own).not.toHaveBeenCalled();
    });

    it('addresses one addon when a target is given', () => {
      const toB = jest.fn();
      const toC = jest.fn();
      bus.on(B, 'ping', toB);
      bus.on('addon.c', 'ping', toC);

      expect(bus.send(A, 'ping', null, B)).toEqual({ delivered: 1 });
      expect(toB).toHaveBeenCalledWith(
        expect.objectContaining({ scope: 'addon' }),
      );
      expect(toC).not.toHaveBeenCalled();
    });

    it('delivers a self-addressed signal with the self scope', () => {
      const own = jest.fn();
      bus.on(A, 'ping', own);
      expect(bus.send(A, 'ping', null, A)).toEqual({ delivered: 1 });
      expect(own).toHaveBeenCalledWith(
        expect.objectContaining({ scope: 'self' }),
      );
    });

    it('ignores a different signal name', () => {
      const heard = jest.fn();
      bus.on(B, 'ping', heard);
      expect(bus.send(A, 'pong', null)).toEqual({ delivered: 0 });
    });

    it('delivers in registration order and survives a throwing handler', () => {
      const order: string[] = [];
      bus.on(B, 'x', () => {
        order.push('first');
        throw new Error('boom');
      });
      bus.on('addon.c', 'x', () => order.push('second'));

      // One addon throwing must not stop the others being told.
      expect(bus.send(A, 'x', null)).toEqual({ delivered: 1 });
      expect(order).toEqual(['first', 'second']);
    });

    it('unregisters through the returned handle and on clear', () => {
      const heard = jest.fn();
      const off = bus.on(B, 'ping', heard);
      off();
      expect(bus.send(A, 'ping', null).delivered).toBe(0);

      bus.on(B, 'ping', heard);
      bus.clear(B);
      expect(bus.send(A, 'ping', null).delivered).toBe(0);
      expect(bus.handlerCount()).toBe(0);
    });
  });

  describe('payload isolation', () => {
    it('gives each receiver its own copy', () => {
      const payload = { list: [1, 2] };
      let received: any;
      bus.on(B, 'x', signal => {
        received = signal.payload;
        (signal.payload as any).list.push(3);
      });

      bus.send(A, 'x', payload);
      // The sender keeps no reference into what the receiver then does.
      expect(payload.list).toEqual([1, 2]);
      expect(received.list).toEqual([1, 2, 3]);
    });

    it('refuses a payload that cannot be serialized or is too large', () => {
      const cyclic: any = {};
      cyclic.self = cyclic;
      expect(bus.send(A, 'x', cyclic)).toEqual({
        delivered: 0,
        failed: 'not-serializable',
      });
      expect(bus.send(A, 'x', () => {})).toEqual({
        delivered: 0,
        failed: 'not-serializable',
      });
      expect(bus.send(A, 'x', 'y'.repeat(MAX_PAYLOAD_BYTES + 10))).toEqual({
        delivered: 0,
        failed: 'payload-too-large',
      });
    });
  });

  describe('loops and limits', () => {
    it('stops a chain that keeps answering itself', () => {
      let depthReached = 0;
      // B answers A, and A answers back: without a depth bound this never ends
      // and looks exactly like the app hanging.
      bus.on(B, 'ping', signal => {
        depthReached = Math.max(depthReached, signal.depth);
        bus.send(B, 'pong', null);
      });
      bus.on(A, 'pong', () => {
        bus.send(A, 'ping', null);
      });

      bus.send(A, 'ping', null);
      expect(depthReached).toBeGreaterThan(1);
      expect(depthReached).toBeLessThanOrEqual(MAX_DEPTH);
    });

    it('reports depth-exceeded rather than throwing', () => {
      const failures: string[] = [];
      let deepest = 0;
      // Answers itself forever; the bound is the only thing that stops it.
      bus.on(B, 'deep', signal => {
        deepest = Math.max(deepest, signal.depth);
        const result = bus.send(B, 'deep', null, B);
        if (result.failed) failures.push(result.failed);
      });

      bus.send(A, 'deep', null, B);

      expect(failures).toContain('depth-exceeded');
      expect(deepest).toBe(MAX_DEPTH);
    });

    it('rate-limits sends within one second', () => {
      const now = Date.now();
      bus.on(B, 'x', () => {});
      for (let index = 0; index < MAX_SIGNALS_PER_SECOND; index += 1)
        expect(bus.send(A, 'x', null, undefined, now).failed).toBeUndefined();

      expect(bus.send(A, 'x', null, undefined, now).failed).toBe(
        'rate-limited',
      );
      // The window rolls forward.
      expect(
        bus.send(A, 'x', null, undefined, now + 1001).failed,
      ).toBeUndefined();
    });

    it('refuses an invalid signal name and bounds handlers per addon', () => {
      expect(bus.send(A, 'bad name', null)).toEqual({
        delivered: 0,
        failed: 'bad-name',
      });
      expect(() => bus.on(A, 'bad name', jest.fn())).toThrow(/invalid/i);

      for (let index = 0; index < MAX_HANDLERS_PER_ADDON; index += 1)
        bus.on(A, `s${index}`, jest.fn());
      expect(() => bus.on(A, 'overflow', jest.fn())).toThrow(/limit/i);
    });
  });
});

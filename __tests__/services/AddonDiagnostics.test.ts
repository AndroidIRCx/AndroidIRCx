/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import {
  AddonDiagnostics,
  MAX_RECENT_ERRORS,
  RATE_WINDOW_MS,
} from '../../src/services/scripting/AddonDiagnostics';

const ADDON = 'diag.addon';

describe('AddonDiagnostics', () => {
  let diagnostics: AddonDiagnostics;

  beforeEach(() => {
    diagnostics = new AddonDiagnostics();
  });

  describe('counters', () => {
    it('starts at zero for an addon that has done nothing', () => {
      const health = diagnostics.health(ADDON);
      expect(health.counters.events).toBe(0);
      expect(health.recentErrors).toEqual([]);
      expect(health.lastActiveAt).toBeUndefined();
    });

    it('counts each kind separately', () => {
      diagnostics.count(ADDON, 'events', 3);
      diagnostics.count(ADDON, 'ircSends');
      diagnostics.count(ADDON, 'networkCalls', 2);
      diagnostics.count(ADDON, 'timeouts');

      const counters = diagnostics.health(ADDON).counters;
      expect(counters).toMatchObject({
        events: 3,
        ircSends: 1,
        networkCalls: 2,
        timeouts: 1,
        fileWrites: 0,
      });
    });

    it('keeps one addon separate from another', () => {
      diagnostics.count(ADDON, 'events');
      expect(diagnostics.health('other.addon').counters.events).toBe(0);
      expect(diagnostics.all()).toHaveLength(2);
    });

    it('records the last time the addon did anything', () => {
      diagnostics.count(ADDON, 'events', 1, 5000);
      expect(diagnostics.health(ADDON).lastActiveAt).toBe(5000);
    });
  });

  describe('execution time', () => {
    it('totals time and remembers the slowest single hook', () => {
      diagnostics.recordExecution(ADDON, 10);
      diagnostics.recordExecution(ADDON, 250);
      diagnostics.recordExecution(ADDON, 5);

      const counters = diagnostics.health(ADDON).counters;
      expect(counters.executionMs).toBe(265);
      // The slowest single hook is what a freeze report needs.
      expect(counters.slowestMs).toBe(250);
    });

    it('ignores a nonsense duration', () => {
      diagnostics.recordExecution(ADDON, -5);
      diagnostics.recordExecution(ADDON, NaN);
      expect(diagnostics.health(ADDON).counters.executionMs).toBe(0);
    });
  });

  describe('errors', () => {
    it('records the message and the hook', () => {
      diagnostics.recordError(ADDON, 'onMessage', new Error('boom'), 1000);

      expect(diagnostics.health(ADDON).recentErrors).toEqual([
        { at: 1000, hook: 'onMessage', message: 'boom' },
      ]);
      expect(diagnostics.health(ADDON).counters.errors).toBe(1);
    });

    it('never keeps a stack trace', () => {
      const error = new Error('boom');
      error.stack = 'Error: boom\n    at /data/user/0/com.androidircx/x.js:1:1';
      diagnostics.recordError(ADDON, 'onMessage', error);

      // This text ends up in an export the user may send to somebody, and a
      // stack carries absolute file paths.
      const serialized = JSON.stringify(diagnostics.health(ADDON));
      expect(serialized).not.toContain('com.androidircx');
      expect(serialized).not.toContain('at /');
    });

    it('handles a thrown value that is not an Error', () => {
      diagnostics.recordError(ADDON, 'onMessage', 'just a string');
      diagnostics.recordError(ADDON, 'onMessage', undefined);
      const errors = diagnostics.health(ADDON).recentErrors;
      expect(errors[0].message).toBe('just a string');
      expect(errors[1].message).toBe('unknown error');
    });

    it('keeps only the most recent errors', () => {
      for (let index = 0; index < MAX_RECENT_ERRORS + 5; index += 1)
        diagnostics.recordError(ADDON, 'h', new Error(`e${index}`));

      const errors = diagnostics.health(ADDON).recentErrors;
      expect(errors).toHaveLength(MAX_RECENT_ERRORS);
      expect(errors[errors.length - 1].message).toBe(
        `e${MAX_RECENT_ERRORS + 4}`,
      );
      // The total count is not capped, only the stored detail.
      expect(diagnostics.health(ADDON).counters.errors).toBe(
        MAX_RECENT_ERRORS + 5,
      );
    });

    it('caps a very long message and hook name', () => {
      diagnostics.recordError(
        ADDON,
        'h'.repeat(200),
        new Error('m'.repeat(500)),
      );
      const [error] = diagnostics.health(ADDON).recentErrors;
      expect(error.hook.length).toBeLessThanOrEqual(80);
      expect(error.message.length).toBeLessThanOrEqual(200);
    });
  });

  describe('event rate', () => {
    it('reports events inside the rolling window only', () => {
      const now = Date.now();
      diagnostics.count(ADDON, 'events', 1, now - RATE_WINDOW_MS - 1000);
      diagnostics.count(ADDON, 'events', 1, now);
      diagnostics.count(ADDON, 'events', 1, now);

      // A runaway addon has to be visible while it is happening.
      expect(diagnostics.health(ADDON, now).eventsPerMinute).toBe(2);
      expect(diagnostics.health(ADDON).counters.events).toBe(3);
    });
  });

  describe('storage', () => {
    it('records a reported size and ignores nonsense', () => {
      diagnostics.setStorageBytes(ADDON, 4096);
      expect(diagnostics.health(ADDON).counters.storageBytes).toBe(4096);
      diagnostics.setStorageBytes(ADDON, -1);
      expect(diagnostics.health(ADDON).counters.storageBytes).toBe(4096);
    });
  });

  describe('export', () => {
    it('produces a report with counters, errors and the package hash', () => {
      diagnostics.count(ADDON, 'events', 2);
      diagnostics.recordError(ADDON, 'onMessage', new Error('boom'));

      const report = JSON.parse(diagnostics.export(ADDON, 'abc123'));
      expect(report).toMatchObject({
        format: 'androidircx.addon-diagnostics',
        addonId: ADDON,
        packageChecksum: 'abc123',
        counters: expect.objectContaining({ events: 2 }),
        errors: [expect.objectContaining({ message: 'boom' })],
      });
    });

    it('carries nothing that could identify a person or a place', () => {
      diagnostics.count(ADDON, 'ircSends', 5);
      diagnostics.recordError(ADDON, 'onMessage', new Error('failed'));
      const report = diagnostics.export(ADDON);

      // No channel name, nick, hostmask, URL, path or message text passes
      // through this class at all, so the export cannot leak one.
      for (const leak of ['#', '!', '@', 'http', '/data/', 'content://'])
        expect(report).not.toContain(leak);
    });
  });

  describe('clearing', () => {
    it('forgets one addon and leaves the rest', () => {
      diagnostics.count(ADDON, 'events');
      diagnostics.count('other.addon', 'events');

      diagnostics.clear(ADDON);
      expect(diagnostics.health(ADDON).counters.events).toBe(0);
      expect(diagnostics.health('other.addon').counters.events).toBe(1);
    });
  });
});

/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import {
  checkConformance,
  detectApiUsage,
  formatConformanceReport,
} from '../../src/services/scripting/AddonConformance';
import type { AddonManifest } from '../../src/services/scripting/AddonManifest';

const manifest = (over: Partial<AddonManifest> = {}): AddonManifest =>
  ({
    id: 'rs.androidircx.demo',
    name: 'Demo',
    author: 'Test',
    version: '1.0.0',
    description: 'Test addon.',
    license: 'GPL-3.0-or-later',
    apiVersion: 1,
    minAppVersion: '1.10.0',
    entry: 'main.js',
    permissions: [],
    ...over,
  }) as AddonManifest;

describe('AddonConformance', () => {
  describe('detectApiUsage', () => {
    it('finds api members and hooks', () => {
      const usage = detectApiUsage(`
        module.exports = {
          onMessage: msg => api.sendMessage(msg.channel, 'hi'),
          onJoin(channel) { api.log(channel); },
        };
      `);
      expect(usage.members).toEqual(['log', 'sendMessage']);
      expect(usage.hooks).toEqual(['onJoin', 'onMessage']);
      expect(usage.dynamic).toBe(false);
    });

    it('tolerates whitespace around the dot', () => {
      expect(detectApiUsage('api . sendMessage()').members).toEqual([
        'sendMessage',
      ]);
    });

    it('notices dynamic indexing', () => {
      expect(detectApiUsage("api['send' + 'Message']()").dynamic).toBe(true);
    });

    it('returns nothing for empty or non-string input', () => {
      expect(detectApiUsage('').members).toEqual([]);
      expect(detectApiUsage(undefined as any).hooks).toEqual([]);
    });
  });

  describe('checkConformance', () => {
    it('passes an addon that declares exactly what it uses', () => {
      const report = checkConformance(
        manifest({ permissions: ['irc.read', 'irc.send'] }),
        [
          'module.exports = { onMessage: m => api.sendMessage(m.channel, "hi") };',
        ],
      );

      expect(report.ok).toBe(true);
      expect(report.findings).toEqual([]);
      expect(report.detected).toEqual(['irc.read', 'irc.send']);
    });

    it('reports an undeclared capability as an error', () => {
      const report = checkConformance(manifest({ permissions: ['irc.read'] }), [
        'module.exports = { onMessage: m => api.sendMessage(m.channel, "hi") };',
      ]);

      // At runtime this is a denial the author did not expect, usually in
      // front of a user.
      expect(report.ok).toBe(false);
      expect(report.findings[0]).toMatchObject({
        severity: 'error',
        code: 'undeclared-capability',
        capability: 'irc.send',
      });
    });

    it('reports an unused capability as a warning, not an error', () => {
      const report = checkConformance(
        manifest({ permissions: ['irc.read', 'irc.moderate'] }),
        ['module.exports = { onMessage: () => {} };'],
      );

      // It still works; but every extra line in the install dialog makes the
      // ones that matter easier to skip.
      expect(report.ok).toBe(true);
      expect(report.findings).toEqual([
        expect.objectContaining({
          severity: 'warning',
          code: 'unused-capability',
          capability: 'irc.moderate',
        }),
      ]);
    });

    it('does not call a capability unused when a group declares it', () => {
      const report = checkConformance(
        manifest({
          permissions: ['irc.read', 'irc.send'],
          groups: [
            {
              id: 'reply',
              name: 'Reply',
              description: 'd',
              permissions: ['irc.send'],
            },
          ],
        }),
        ['module.exports = { onMessage: () => {} };'],
      );

      expect(
        report.findings.filter(f => f.capability === 'irc.send'),
      ).toHaveLength(0);
    });

    it('detects capabilities the hooks alone imply', () => {
      const report = checkConformance(manifest({ permissions: [] }), [
        'module.exports = { onRaw: line => {} };',
      ]);
      expect(report.detected).toContain('irc.raw.observe');
      expect(report.ok).toBe(false);
    });

    it('reports an asset the code reads but the manifest omits', () => {
      const report = checkConformance(
        manifest({ permissions: [], assets: ['data/one.txt'] }),
        ['api.asset.readText("data/two.txt");'],
      );

      expect(report.findings).toContainEqual(
        expect.objectContaining({ code: 'undeclared-asset' }),
      );
      expect(report.ok).toBe(false);
    });

    it('warns about a group that asks to start on but needs permissions', () => {
      const report = checkConformance(
        manifest({
          permissions: ['irc.send'],
          groups: [
            {
              id: 'reply',
              name: 'Reply',
              description: 'd',
              permissions: ['irc.send'],
              enabledByDefault: true,
            },
          ],
        }),
        ['api.sendMessage("#a", "x");'],
      );

      expect(report.findings).toContainEqual(
        expect.objectContaining({ code: 'risky-default' }),
      );
    });

    it('says plainly that it cannot see through dynamic access', () => {
      const report = checkConformance(manifest({ permissions: [] }), [
        "api['send' + 'Message']('#a', 'x');",
      ]);

      // So the author knows the answer is incomplete rather than clean.
      expect(report.findings).toContainEqual(
        expect.objectContaining({
          code: 'dynamic-api-access',
          severity: 'info',
        }),
      );
      // Info alone does not fail the check.
      expect(report.ok).toBe(true);
    });

    it('checks every source file, not only the first', () => {
      const report = checkConformance(manifest({ permissions: ['irc.read'] }), [
        'module.exports = { onMessage: () => {} };',
        'api.kick("#a", "fred");',
      ]);
      expect(report.detected).toContain('irc.moderate');
    });

    it('handles an addon with no sources at all', () => {
      const report = checkConformance(manifest({ permissions: [] }), []);
      expect(report.ok).toBe(true);
      expect(report.detected).toEqual([]);
    });
  });

  describe('formatConformanceReport', () => {
    it('says so when there is nothing to report', () => {
      expect(
        formatConformanceReport({ ok: true, findings: [], detected: [] }),
      ).toMatch(/No problems found/);
    });

    it('puts errors before warnings before info', () => {
      const text = formatConformanceReport({
        ok: false,
        detected: [],
        findings: [
          { severity: 'info', code: 'dynamic-api-access', message: 'i' },
          { severity: 'warning', code: 'unused-capability', message: 'w' },
          { severity: 'error', code: 'undeclared-capability', message: 'e' },
        ],
      });
      expect(text.split('\n').map(line => line.split(':')[0])).toEqual([
        'ERROR',
        'WARNING',
        'INFO',
      ]);
    });
  });
});

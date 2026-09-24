/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */
/* eslint-disable no-new-func -- Driving a shipped example against a stub api means compiling it the same way ScriptingService does. */

import { scriptingService } from '../../src/services/ScriptingService';

/**
 * Every example the app ships is a thing users read to learn the API, so a
 * broken one teaches a broken habit. These tests cover the whole set rather
 * than a sample: a new example that does not compile, or that quietly starts
 * enabled, fails here.
 */
describe('built-in example scripts', () => {
  const builtIns = scriptingService.getBuiltInScripts();

  const compile = (script: any) =>
    (scriptingService as any).compile({ ...script, enabled: true });

  it('ships a useful number of examples', () => {
    expect(builtIns.length).toBeGreaterThan(20);
  });

  it('gives every example an id, a name and a description', () => {
    for (const script of builtIns) {
      expect(script.id).toMatch(/^builtin-[a-z0-9-]+$/);
      expect(script.name?.length).toBeGreaterThan(0);
      expect(script.description?.length).toBeGreaterThan(0);
      expect(script.builtIn).toBe(true);
    }
  });

  it('uses each id exactly once', () => {
    const ids = builtIns.map(script => script.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('starts every example disabled', () => {
    // An example that starts on is an example acting on a user who never
    // chose it - which for the ones that send or moderate is the whole risk.
    for (const script of builtIns) expect(script.enabled).toBe(false);
  });

  it('compiles every example into something that actually does anything', () => {
    // Three shapes are legitimate: exporting hooks, registering a command at
    // load time, or adding a menu item. A script with none of them compiled to
    // nothing and would sit in the list doing exactly that.
    const inert = builtIns
      .map(script => ({
        id: script.id,
        hooks: Object.keys(compile(script).hooks ?? {}),
        registers: /api\s*\.\s*(registerCommand|addMenuItem)/.test(script.code),
      }))
      .filter(entry => entry.hooks.length === 0 && !entry.registers);
    expect(inert).toEqual([]);
  });

  describe('auto-op', () => {
    const autoOp = () =>
      builtIns.find(script => script.id === 'builtin-autoop')!;

    it('decides on the account, never on the nick alone', () => {
      const code = autoOp().code;
      // A nick is free to take the moment its owner disconnects, so an
      // auto-op keyed on one hands operator status to whoever gets there
      // first.
      expect(code).toMatch(/api\.users\.get/);
      expect(code).toMatch(/who\.account/);
      expect(code).toMatch(/certfp/);
    });

    it('does nothing for someone the app knows nothing about', () => {
      const hooks = compile(autoOp()).hooks!;
      const sendCommand = jest.fn();

      // Rebuilt against a stub api so the hook can be driven directly.
      const factory = new Function(
        'api',
        `const module={exports:{}};const exports=module.exports;${autoOp().code};return module.exports;`,
      );
      const api = {
        userNick: 'me',
        sendCommand,
        store: { table: () => ({ get: () => undefined, set: jest.fn() }) },
        users: { get: () => undefined },
        echo: jest.fn(),
      };
      factory(api).onJoin('#a', 'stranger', { network: 'net1' });

      expect(sendCommand).not.toHaveBeenCalled();
      expect(hooks.onJoin).toBeDefined();
    });

    it('does nothing for a user the server says is logged out', () => {
      const factory = new Function(
        'api',
        `const module={exports:{}};const exports=module.exports;${autoOp().code};return module.exports;`,
      );
      const sendCommand = jest.fn();
      const api = {
        userNick: 'me',
        sendCommand,
        store: { table: () => ({ get: () => true, set: jest.fn() }) },
        // A null account is the server saying "logged out", which is exactly
        // when it must not act.
        users: { get: () => ({ account: null, certfp: undefined }) },
        echo: jest.fn(),
      };
      factory(api).onJoin('#a', 'fred', { network: 'net1' });
      expect(sendCommand).not.toHaveBeenCalled();
    });

    it('ops someone whose account is on the list', () => {
      const factory = new Function(
        'api',
        `const module={exports:{}};const exports=module.exports;${autoOp().code};return module.exports;`,
      );
      const sendCommand = jest.fn();
      const api = {
        userNick: 'me',
        sendCommand,
        store: {
          table: () => ({
            get: (key: string) => key === 'account:fredacct',
            set: jest.fn(),
          }),
        },
        users: { get: () => ({ account: 'fredacct' }) },
        echo: jest.fn(),
      };
      factory(api).onJoin('#a', 'fred', { network: 'net1' });

      expect(sendCommand).toHaveBeenCalledWith('MODE #a +o fred', 'net1');
    });
  });

  describe('auto-voice', () => {
    it('voices only someone logged in to an account', () => {
      const script = builtIns.find(s => s.id === 'builtin-autovoice')!;
      const factory = new Function(
        'api',
        `const module={exports:{}};const exports=module.exports;${script.code};return module.exports;`,
      );
      const sendCommand = jest.fn();
      const makeApi = (account: unknown) => ({
        userNick: 'me',
        sendCommand,
        users: { get: () => ({ account }) },
      });

      factory(makeApi(null)).onJoin('#a', 'fred', { network: 'net1' });
      factory(makeApi(undefined)).onJoin('#a', 'fred', { network: 'net1' });
      expect(sendCommand).not.toHaveBeenCalled();

      factory(makeApi('fredacct')).onJoin('#a', 'fred', { network: 'net1' });
      expect(sendCommand).toHaveBeenCalledWith('MODE #a +v fred', 'net1');
    });
  });

  describe('new API examples', () => {
    it('ships an address-list lookup that sends no server request', () => {
      const script = builtIns.find(s => s.id === 'builtin-who-is-this')!;
      // A script that fires a WHOIS per message is how a client gets
      // throttled; the example exists to show the cache answers it.
      expect(script.code).toMatch(/api\.users\.get/);
      expect(script.code).not.toMatch(/sendCommand|sendRaw|WHOIS/);
    });

    it('ships a workspace example that uses only relative paths', () => {
      const script = builtIns.find(s => s.id === 'builtin-channel-notes')!;
      expect(script.code).toMatch(/api\.files\.(read|write)/);
      expect(script.code).toMatch(/api\.parse\.lines/);
      // No traversal and no absolute path in the file names it builds. The
      // slashes in '/note' are IRC commands, not paths.
      expect(script.code).not.toMatch(/\.\.\//);
      expect(script.code).not.toMatch(/files\.(read|write)\(\s*['"]\//);
    });
  });
});

describe('listScriptCommands', () => {
  const compile = (script: any) =>
    (scriptingService as any).compile({ ...script, enabled: true });

  beforeEach(() => {
    (scriptingService as any).scriptCommands.clear();
  });

  it('reports a registered command with its description', () => {
    compile({
      id: 'demo',
      name: 'Demo',
      code: "api.registerCommand('greet', () => {}, 'Says hello');",
    });

    expect(scriptingService.listScriptCommands()).toEqual([
      expect.objectContaining({
        name: 'greet',
        description: 'Says hello',
        scriptId: 'demo',
      }),
    ]);
  });

  it('reports a command that gave no description', () => {
    compile({
      id: 'demo',
      name: 'Demo',
      code: "api.registerCommand('greet', () => {});",
    });
    expect(
      scriptingService.listScriptCommands()[0].description,
    ).toBeUndefined();
  });

  it('normalises a leading slash and rejects a name with whitespace', () => {
    compile({
      id: 'demo',
      name: 'Demo',
      code: "api.registerCommand('/greet', () => {}); api.registerCommand('two words', () => {});",
    });

    expect(scriptingService.listScriptCommands().map(c => c.name)).toEqual([
      'greet',
    ]);
  });

  it('caps a very long description', () => {
    compile({
      id: 'demo',
      name: 'Demo',
      code: `api.registerCommand('greet', () => {}, '${'x'.repeat(200)}');`,
    });
    expect(
      scriptingService.listScriptCommands()[0].description!.length,
    ).toBeLessThanOrEqual(80);
  });
});

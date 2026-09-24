/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { scriptingService } from '../../src/services/ScriptingService';
import { addonTableStore } from '../../src/services/scripting/AddonTableStore';
import { addonSignalBus } from '../../src/services/scripting/AddonSignalBus';
import { API_ENTRIES, HOOK_ENTRIES } from '../../src/config/scriptVocabulary';

/**
 * A working in-memory filesystem, only for this file. The shared mock in
 * jest.setup deliberately reports `exists: false` for everything, which is what
 * other suites rely on, so it is left alone.
 */
jest.mock('react-native-fs', () => {
  const files = new Map<string, string>();
  const dirs = new Set<string>();
  return {
    DocumentDirectoryPath: '/tmp',
    exists: jest.fn(async (p: string) => files.has(p) || dirs.has(p)),
    mkdir: jest.fn(async (p: string) => {
      dirs.add(p);
    }),
    readFile: jest.fn(async (p: string) => {
      if (!files.has(p)) throw new Error('ENOENT');
      return files.get(p);
    }),
    writeFile: jest.fn(async (p: string, c: string) => {
      files.set(p, c);
    }),
    unlink: jest.fn(async (p: string) => {
      files.delete(p);
      dirs.delete(p);
    }),
    moveFile: jest.fn(async (from: string, to: string) => {
      if (!files.has(from)) throw new Error('ENOENT');
      files.set(to, files.get(from)!);
      files.delete(from);
    }),
    readDir: jest.fn(async (p: string) => {
      const prefix = `${p}/`;
      const seen = new Map<string, { size: number; dir: boolean }>();
      for (const [file, contents] of files) {
        if (!file.startsWith(prefix)) continue;
        const [head, ...tail] = file.slice(prefix.length).split('/');
        if (tail.length === 0)
          seen.set(head, { size: contents.length, dir: false });
        else if (!seen.has(head)) seen.set(head, { size: 0, dir: true });
      }
      return [...seen].map(([name, info]) => ({
        name,
        path: `${prefix}${name}`,
        size: info.size,
        mtime: new Date(0),
        isDirectory: () => info.dir,
        isFile: () => !info.dir,
      }));
    }),
  };
});

/**
 * L5 is only worth anything if a script can reach it. Same guard as the L3
 * knowledge API: built, exposed, documented, and tested for all three.
 */
describe('ScriptingService storage and signals API', () => {
  const api = (id = 'store-test') =>
    (scriptingService as any).makeApi({
      id,
      name: 'Store',
      code: '',
      enabled: true,
    });

  beforeEach(async () => {
    (AsyncStorage as any).__reset?.();
    // api.log is the observation channel here, and addLog is gated on this.
    (scriptingService as any).settings.loggingEnabled = true;
    (scriptingService as any).log = [];
    addonTableStore.resetForTests();
    addonSignalBus.resetForTests();
    for (const script of [...(scriptingService as any).scripts])
      await scriptingService.remove(script.id);
  });

  describe('api.store', () => {
    it('stores and reads through a table handle', async () => {
      const table = api().store.table('prefs');
      expect((await table.set('theme', 'dark')).ok).toBe(true);

      expect(table.get('theme')).toBe('dark');
      expect(table.has('theme')).toBe(true);
      expect(table.keys()).toEqual(['theme']);
    });

    it('scopes a table to the script that asked for it', async () => {
      await api('script-a').store.table('shared').set('k', 'mine');
      // Guessing another script's table name gets you your own empty table.
      expect(api('script-b').store.table('shared').get('k')).toBeUndefined();
    });

    it('reports a quota reason instead of throwing', async () => {
      const table = api().store.table('t');
      const result = await table.set('x'.repeat(500), 'v');
      expect(result).toEqual({ ok: false, reason: 'key-too-long' });
    });

    it('offers the atomic helpers and query', async () => {
      const table = api().store.table('t');
      expect((await table.increment('n', 5)).value).toBe(5);
      expect((await table.compareAndSet('n', 5, 9)).ok).toBe(true);
      await table.batch([{ op: 'set', key: 'a', value: 1 }]);

      expect(table.query({ prefix: 'a' }).map((e: any) => e.key)).toEqual([
        'a',
      ]);
      expect(api().store.tables()).toContain('t');
      expect(api().store.usedBytes()).toBeGreaterThan(0);

      await table.delete('a');
      expect(table.has('a')).toBe(false);
      await table.drop();
      expect(api().store.tables()).not.toContain('t');
    });

    it('refuses a table with no name', () => {
      expect(() => api().store.table('')).toThrow(/name/i);
    });
  });

  describe('api.signal and onSignal', () => {
    it('delivers a broadcast to other scripts but not the sender', async () => {
      const seen = () =>
        scriptingService
          .getLogs()
          .filter(entry => entry.level === 'info')
          .map(entry => entry.message);
      await scriptingService.add({
        id: 'receiver',
        name: 'Receiver',
        enabled: true,
        code: 'module.exports = { onSignal: s => api.log(s.from + ":" + s.name + ":" + s.scope + ":" + s.payload.n) };',
      });
      await scriptingService.add({
        id: 'sender',
        name: 'Sender',
        enabled: true,
        code: 'module.exports = { onSignal: () => api.log("SENDER SHOULD NOT SEE THIS") };',
      });

      const result = api('sender').signal('ping', { n: 1 });

      // A script handling its own broadcast is the first half of every loop.
      expect(seen()).toEqual(['sender:ping:broadcast:1']);
      expect(result.delivered).toBe(1);
    });

    it('delivers only to the addressed script when a target is given', async () => {
      const seen = () =>
        scriptingService
          .getLogs()
          .filter(entry => entry.level === 'info')
          .map(entry => entry.message);
      const receiver = (id: string) => ({
        id,
        name: id,
        enabled: true,
        code: `module.exports = { onSignal: s => api.log("${id}:" + s.scope) };`,
      });
      await scriptingService.add(receiver('a') as any);
      await scriptingService.add(receiver('b') as any);

      api('sender').signal('ping', null, 'a');

      expect(seen()).toEqual(['a:addon']);
    });

    it('keeps going when a receiving script throws', async () => {
      const seen = () =>
        scriptingService
          .getLogs()
          .filter(entry => entry.level === 'info')
          .map(entry => entry.message);
      await scriptingService.add({
        id: 'bad',
        name: 'Bad',
        enabled: true,
        code: 'module.exports = { onSignal: () => { throw new Error("boom"); } };',
      });
      await scriptingService.add({
        id: 'good',
        name: 'Good',
        enabled: true,
        code: 'module.exports = { onSignal: () => api.log("good") };',
      });

      expect(() => api('sender').signal('ping', null)).not.toThrow();
      expect(seen()).toEqual(['good']);
    });

    it('reports a payload the bus refuses, and delivers nothing', async () => {
      const seen = () =>
        scriptingService
          .getLogs()
          .filter(entry => entry.level === 'info')
          .map(entry => entry.message);
      await scriptingService.add({
        id: 'receiver',
        name: 'Receiver',
        enabled: true,
        code: 'module.exports = { onSignal: () => api.log("x") };',
      });

      const cyclic: any = {};
      cyclic.self = cyclic;
      const result = api('sender').signal('ping', cyclic);

      expect(result.failed).toBe('not-serializable');
      expect(seen()).toEqual([]);
    });

    it('stops receiving once the script is removed', async () => {
      const seen = () =>
        scriptingService
          .getLogs()
          .filter(entry => entry.level === 'info')
          .map(entry => entry.message);
      await scriptingService.add({
        id: 'receiver',
        name: 'Receiver',
        enabled: true,
        code: 'module.exports = { onSignal: () => api.log("x") };',
      });
      await scriptingService.remove('receiver');

      api('sender').signal('ping', null);
      expect(seen()).toEqual([]);
    });
  });

  describe('api.files and api.parse', () => {
    it('reaches the workspace through the script api', async () => {
      const files = api('fs-test').files;
      expect((await files.write('notes.txt', 'hello')).ok).toBe(true);
      expect((await files.read('notes.txt')).value).toBe('hello');
      expect((await files.list()).value.map((e: any) => e.path)).toContain(
        'notes.txt',
      );
      expect(await files.usedBytes()).toBeGreaterThan(0);
    });

    it('refuses to leave the workspace, through the api as well', async () => {
      const files = api('fs-test').files;
      expect((await files.read('../../etc/passwd')).reason).toBe('traversal');
      expect((await files.write('/etc/passwd', 'x')).reason).toBe('absolute');
    });

    it('offers parsers that never throw', () => {
      const { parse, format } = api();
      expect(parse.lines('a\nb')).toEqual(['a', 'b']);
      expect(parse.csv('"a,b",c')).toEqual([['a,b', 'c']]);
      expect(parse.ini('[s]\nk=v')).toEqual({ s: { k: 'v' } });
      expect(parse.json('{oops}').ok).toBe(false);

      expect(format.csv([['a,b']])).toBe('"a,b"');
      expect(format.lines(['a'])).toBe('a\n');
      expect(format.ini({ s: { k: 'v' } })).toContain('[s]');
    });
  });

  it('documents every new member and the new hook', () => {
    const api_ = new Set(API_ENTRIES.map(entry => entry.name));
    for (const name of [
      'store.table',
      'store.tables',
      'store.usedBytes',
      'secrets.set',
      'secrets.get',
      'signal',
      'files.read',
      'files.write',
      'files.list',
      'parse.lines',
      'parse.json',
      'parse.csv',
      'parse.ini',
      'format.lines',
      'format.csv',
      'format.ini',
      'secrets.keys',
    ])
      expect(api_).toContain(name);

    expect(HOOK_ENTRIES.map(entry => entry.name)).toContain('onSignal');
  });
});

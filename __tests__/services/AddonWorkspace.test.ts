/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import {
  AddonWorkspace,
  MAX_FILE_BYTES,
  MAX_WORKSPACE_BYTES,
} from '../../src/services/scripting/AddonWorkspace';

const ADDON = 'ws.addon';
const BASE = '/base/addon-workspaces';
const ROOT = `${BASE}/${ADDON}`;

/** An in-memory filesystem, so the tests exercise the real path handling. */
function fakeFs() {
  const files = new Map<string, string>();
  const dirs = new Set<string>([BASE, ROOT]);

  const fs = {
    files,
    dirs,
    exists: jest.fn(async (path: string) => files.has(path) || dirs.has(path)),
    mkdir: jest.fn(async (path: string) => {
      const parts = path.split('/');
      for (let index = 1; index <= parts.length; index += 1)
        dirs.add(parts.slice(0, index).join('/'));
    }),
    readFile: jest.fn(async (path: string) => {
      if (!files.has(path)) throw new Error('ENOENT');
      return files.get(path)!;
    }),
    writeFile: jest.fn(async (path: string, contents: string) => {
      files.set(path, contents);
    }),
    unlink: jest.fn(async (path: string) => {
      if (!files.delete(path) && !dirs.delete(path)) throw new Error('ENOENT');
    }),
    moveFile: jest.fn(async (from: string, to: string) => {
      if (!files.has(from)) throw new Error('ENOENT');
      files.set(to, files.get(from)!);
      files.delete(from);
    }),
    readDir: jest.fn(async (path: string) => {
      const prefix = `${path}/`;
      const seen = new Map<string, { size: number; isDir: boolean }>();
      for (const [file, contents] of files) {
        if (!file.startsWith(prefix)) continue;
        const rest = file.slice(prefix.length);
        const [head, ...tail] = rest.split('/');
        if (tail.length === 0)
          seen.set(head, { size: contents.length, isDir: false });
        else if (!seen.has(head)) seen.set(head, { size: 0, isDir: true });
      }
      return [...seen].map(([name, info]) => ({
        name,
        path: `${prefix}${name}`,
        size: info.size,
        mtime: new Date(1000),
        isDirectory: () => info.isDir,
        isFile: () => !info.isDir,
      }));
    }),
  };
  return fs;
}

describe('AddonWorkspace', () => {
  let fs: ReturnType<typeof fakeFs>;
  let workspace: AddonWorkspace;

  beforeEach(() => {
    fs = fakeFs();
    workspace = new AddonWorkspace(fs as any, BASE);
  });

  describe('reading and writing', () => {
    it('round-trips a file', async () => {
      expect(await workspace.writeText(ADDON, 'notes.txt', 'hello')).toEqual({
        ok: true,
      });
      expect(await workspace.readText(ADDON, 'notes.txt')).toEqual({
        ok: true,
        value: 'hello',
      });
    });

    it('writes inside the addon root and nowhere else', async () => {
      await workspace.writeText(ADDON, 'logs/a.txt', 'x');
      expect([...fs.files.keys()]).toEqual([`${ROOT}/logs/a.txt`]);
    });

    it('reports a missing file rather than throwing', async () => {
      expect(await workspace.readText(ADDON, 'nope.txt')).toEqual({
        ok: false,
        reason: 'not-found',
      });
    });

    it('keeps the previous file when a write fails partway', async () => {
      await workspace.writeText(ADDON, 'config.json', '{"good":true}');
      fs.moveFile.mockRejectedValueOnce(new Error('disk full'));

      const result = await workspace.writeText(ADDON, 'config.json', 'new');

      // A half-written config an addon fails to parse on every start is the
      // worst outcome available here.
      expect(result).toEqual({ ok: false, reason: 'io-error' });
      expect(await workspace.readText(ADDON, 'config.json')).toEqual({
        ok: true,
        value: '{"good":true}',
      });
    });

    it('cleans up its temporary file after a failed write', async () => {
      fs.moveFile.mockRejectedValueOnce(new Error('disk full'));
      await workspace.writeText(ADDON, 'a.txt', 'x');
      expect([...fs.files.keys()].filter(k => k.includes('.tmp-'))).toEqual([]);
    });

    it('creates missing parent directories', async () => {
      await workspace.writeText(ADDON, 'deep/nested/file.txt', 'x');
      expect(fs.mkdir).toHaveBeenCalled();
      expect(fs.files.has(`${ROOT}/deep/nested/file.txt`)).toBe(true);
    });
  });

  describe('escaping the workspace', () => {
    it.each([
      ['traversal', '../../etc/passwd'],
      ['an absolute path', '/etc/passwd'],
      ['a backslash', 'a\\..\\b'],
      ['a NUL', 'a\0b'],
    ])('refuses %s on read, write, remove and rename', async (_label, path) => {
      expect((await workspace.readText(ADDON, path)).ok).toBe(false);
      expect((await workspace.writeText(ADDON, path, 'x')).ok).toBe(false);
      expect((await workspace.remove(ADDON, path)).ok).toBe(false);
      expect((await workspace.rename(ADDON, 'a.txt', path)).ok).toBe(false);
      // Nothing reached the filesystem at all.
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('checks both names on a rename', async () => {
      await workspace.writeText(ADDON, 'a.txt', 'x');
      expect((await workspace.rename(ADDON, '../a.txt', 'b.txt')).reason).toBe(
        'traversal',
      );
      expect((await workspace.rename(ADDON, 'a.txt', '../b.txt')).reason).toBe(
        'traversal',
      );
      expect(fs.files.has(`${ROOT}/a.txt`)).toBe(true);
    });

    it('keeps one addon out of another workspace', async () => {
      await workspace.writeText(ADDON, 'secret.txt', 'mine');
      expect((await workspace.readText('other.addon', 'secret.txt')).ok).toBe(
        false,
      );
    });
  });

  describe('listing, stat and rename', () => {
    beforeEach(async () => {
      await workspace.writeText(ADDON, 'a.txt', 'aaa');
      await workspace.writeText(ADDON, 'logs/b.txt', 'bb');
    });

    it('lists the root and a subdirectory with relative paths', async () => {
      const root = await workspace.list(ADDON);
      expect(root.value!.map(entry => entry.path).sort()).toEqual([
        'a.txt',
        'logs',
      ]);

      const logs = await workspace.list(ADDON, 'logs');
      expect(logs.value!.map(entry => entry.path)).toEqual(['logs/b.txt']);
    });

    it('returns an empty listing for a workspace that does not exist yet', async () => {
      expect(await workspace.list('brand.new')).toEqual({
        ok: true,
        value: [],
      });
    });

    it('hides temporary files from an interrupted write', async () => {
      fs.files.set(`${ROOT}/x.txt.tmp-123`, 'partial');
      const listing = await workspace.list(ADDON);
      expect(listing.value!.some(entry => entry.path.includes('.tmp-'))).toBe(
        false,
      );
    });

    it('stats one file and reports a missing one', async () => {
      const stat = await workspace.stat(ADDON, 'a.txt');
      expect(stat.value).toMatchObject({
        path: 'a.txt',
        size: 3,
        isDirectory: false,
      });
      expect((await workspace.stat(ADDON, 'nope.txt')).reason).toBe(
        'not-found',
      );
    });

    it('renames a file and reports a missing source', async () => {
      expect(await workspace.rename(ADDON, 'a.txt', 'renamed.txt')).toEqual({
        ok: true,
      });
      expect((await workspace.readText(ADDON, 'renamed.txt')).value).toBe(
        'aaa',
      );
      expect((await workspace.rename(ADDON, 'gone.txt', 'x.txt')).reason).toBe(
        'not-found',
      );
    });

    it('removes a file and reports a missing one', async () => {
      expect(await workspace.remove(ADDON, 'a.txt')).toEqual({ ok: true });
      expect((await workspace.remove(ADDON, 'a.txt')).reason).toBe('not-found');
    });
  });

  describe('quotas', () => {
    it('refuses a file larger than the per-file cap', async () => {
      const result = await workspace.writeText(
        ADDON,
        'big.txt',
        'x'.repeat(MAX_FILE_BYTES + 1),
      );
      expect(result).toEqual({ ok: false, reason: 'too-large' });
    });

    it('refuses a write that would exceed the workspace quota', async () => {
      const chunk = 'x'.repeat(MAX_FILE_BYTES);
      for (let index = 0; index * MAX_FILE_BYTES < MAX_WORKSPACE_BYTES; index++)
        await workspace.writeText(ADDON, `f${index}.txt`, chunk);

      expect(await workspace.writeText(ADDON, 'over.txt', chunk)).toEqual({
        ok: false,
        reason: 'workspace-full',
      });
    });

    it('lets an existing file be replaced without being charged twice', async () => {
      const chunk = 'x'.repeat(MAX_FILE_BYTES);
      for (let index = 0; index * MAX_FILE_BYTES < MAX_WORKSPACE_BYTES; index++)
        await workspace.writeText(ADDON, `f${index}.txt`, chunk);

      // A full workspace must not become permanently unwritable for updates.
      expect((await workspace.writeText(ADDON, 'f0.txt', chunk)).ok).toBe(true);
    });

    it('counts nested directories towards the total', async () => {
      await workspace.writeText(ADDON, 'a.txt', 'aaa');
      await workspace.writeText(ADDON, 'deep/b.txt', 'bb');
      expect(await workspace.usedBytes(ADDON)).toBe(5);
    });
  });

  describe('uninstall', () => {
    it('removes the whole workspace', async () => {
      await workspace.writeText(ADDON, 'a.txt', 'x');
      await workspace.clearAddon(ADDON);
      expect(fs.unlink).toHaveBeenCalledWith(ROOT);
    });

    it('does not throw when there is nothing to remove', async () => {
      await expect(
        workspace.clearAddon('never.existed'),
      ).resolves.toBeUndefined();
    });
  });
});

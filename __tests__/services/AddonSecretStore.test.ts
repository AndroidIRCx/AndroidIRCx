/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import {
  AddonSecretStore,
  ADDON_SECRET_PREFIX,
  isAddonSecretKey,
  MAX_SECRET_CHARS,
  MAX_SECRET_KEYS_PER_ADDON,
} from '../../src/services/scripting/AddonSecretStore';

const ADDON = 'rs.androidircx.demo';

function harness() {
  const vault = new Map<string, string>();
  const secure = {
    setSecret: jest.fn(async (key: string, value?: string | null) => {
      if (value == null) vault.delete(key);
      else vault.set(key, value);
    }),
    getSecret: jest.fn(async (key: string) => vault.get(key) ?? null),
    removeSecret: jest.fn(async (key: string) => {
      vault.delete(key);
    }),
    getAllSecretKeys: jest.fn(async () => [...vault.keys()]),
  };
  return { store: new AddonSecretStore(secure), vault, secure };
}

describe('AddonSecretStore', () => {
  describe('storing and reading', () => {
    it('round-trips a secret for its owner', async () => {
      const h = harness();
      await h.store.set(ADDON, 'token', 'hunter2');
      expect(await h.store.get(ADDON, 'token')).toBe('hunter2');
      expect(await h.store.has(ADDON, 'token')).toBe(true);
    });

    it('does not hand one addon another addon secret', async () => {
      const h = harness();
      await h.store.set(ADDON, 'token', 'hunter2');
      expect(await h.store.get('other.addon', 'token')).toBeNull();
      expect(await h.store.keys('other.addon')).toEqual([]);
    });

    it('keeps namespaces unambiguous when addon ids contain dots', async () => {
      const h = harness();
      // Addon `a` with key `b.c` must not address addon `a.b` key `c`.
      await h.store.set('a.b', 'c', 'theirs');
      expect(await h.store.get('a', 'b.c')).toBeNull();
      expect(await h.store.get('a.b', 'c')).toBe('theirs');
    });

    it('deletes one secret and all of them', async () => {
      const h = harness();
      await h.store.set(ADDON, 'a', '1');
      await h.store.set(ADDON, 'b', '2');

      await h.store.delete(ADDON, 'a');
      expect(await h.store.keys(ADDON)).toEqual(['b']);

      expect(await h.store.deleteAll(ADDON)).toBe(1);
      expect(await h.store.keys(ADDON)).toEqual([]);
    });
  });

  describe('what may be listed', () => {
    it('lists key names and never values', async () => {
      const h = harness();
      await h.store.set(ADDON, 'token', 'hunter2');

      const metadata = await h.store.metadata(ADDON);
      expect(metadata).toEqual([{ key: 'token', exists: true }]);
      // Not even a length: a length leaks the shape of the secret.
      expect(JSON.stringify(metadata)).not.toContain('hunter2');
      expect(JSON.stringify(metadata)).not.toMatch(/length|size|7/);
    });
  });

  describe('validation', () => {
    it('refuses an unsafe addon id or key', async () => {
      const h = harness();
      await expect(h.store.set('bad id', 'k', 'v')).rejects.toThrow(/id/i);
      await expect(h.store.set(ADDON, 'has/slash', 'v')).rejects.toThrow(
        /key/i,
      );
      await expect(h.store.set(ADDON, '', 'v')).rejects.toThrow(/key/i);
      await expect(h.store.keys('bad id')).rejects.toThrow(/id/i);
    });

    it('refuses an empty or oversized value', async () => {
      const h = harness();
      await expect(h.store.set(ADDON, 'k', '')).rejects.toThrow(/non-empty/i);
      await expect(
        h.store.set(ADDON, 'k', 'x'.repeat(MAX_SECRET_CHARS + 1)),
      ).rejects.toThrow(/too large/i);
    });

    it('bounds how many secrets one addon may hold, but allows replacement', async () => {
      const h = harness();
      for (let index = 0; index < MAX_SECRET_KEYS_PER_ADDON; index += 1)
        await h.store.set(ADDON, `k${index}`, 'v');

      await expect(h.store.set(ADDON, 'overflow', 'v')).rejects.toThrow(
        /limit/i,
      );
      await expect(h.store.set(ADDON, 'k0', 'new')).resolves.toBeUndefined();
    });
  });

  describe('backup exclusion', () => {
    it('recognises an addon secret key by its prefix', async () => {
      const h = harness();
      await h.store.set(ADDON, 'token', 'hunter2');

      const [storedKey] = [...h.vault.keys()];
      expect(storedKey.startsWith(ADDON_SECRET_PREFIX)).toBe(true);
      expect(isAddonSecretKey(storedKey)).toBe(true);
      expect(isAddonSecretKey('network:example:saslPassword')).toBe(false);
      expect(isAddonSecretKey(undefined as any)).toBe(false);
    });
  });
});

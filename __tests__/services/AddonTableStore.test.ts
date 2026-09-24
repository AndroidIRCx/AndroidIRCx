/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AddonTableStore,
  MAX_ADDON_BYTES,
  MAX_KEY_CHARS,
  MAX_TABLES_PER_ADDON,
  MAX_VALUE_BYTES,
} from '../../src/services/scripting/AddonTableStore';

const ADDON = 'table.addon';

describe('AddonTableStore', () => {
  let store: AddonTableStore;

  beforeEach(() => {
    (AsyncStorage as any).__reset?.();
    store = new AddonTableStore();
  });

  describe('basic operations', () => {
    it('stores and reads values of every JSON shape', async () => {
      await store.set(ADDON, 't', 'string', 'hello');
      await store.set(ADDON, 't', 'number', 42);
      await store.set(ADDON, 't', 'bool', true);
      await store.set(ADDON, 't', 'null', null);
      await store.set(ADDON, 't', 'object', { a: [1, 2] });

      expect(store.get(ADDON, 't', 'string')).toBe('hello');
      expect(store.get(ADDON, 't', 'number')).toBe(42);
      expect(store.get(ADDON, 't', 'bool')).toBe(true);
      expect(store.get(ADDON, 't', 'null')).toBeNull();
      expect(store.get(ADDON, 't', 'object')).toEqual({ a: [1, 2] });
    });

    it('reports presence and deletes', async () => {
      await store.set(ADDON, 't', 'k', 'v');
      expect(store.has(ADDON, 't', 'k')).toBe(true);
      expect(await store.delete(ADDON, 't', 'k')).toBe(true);
      expect(store.has(ADDON, 't', 'k')).toBe(false);
      expect(await store.delete(ADDON, 't', 'k')).toBe(false);
    });

    it('keeps one addon out of another addon tables', async () => {
      await store.set(ADDON, 't', 'k', 'mine');
      await store.set('other.addon', 't', 'k', 'theirs');
      // mIRC hash tables are global; guessing a table name must not work here.
      expect(store.get(ADDON, 't', 'k')).toBe('mine');
      expect(store.get('other.addon', 't', 'k')).toBe('theirs');
    });

    it('drops a table and clears an addon', async () => {
      await store.set(ADDON, 'a', 'k', 1);
      await store.set(ADDON, 'b', 'k', 1);
      await store.dropTable(ADDON, 'a');
      expect(store.tableNames(ADDON)).toEqual(['b']);

      await store.clearAddon(ADDON);
      expect(store.tableNames(ADDON)).toEqual([]);
    });
  });

  describe('atomic operations', () => {
    it('increments without a read-modify-write race', async () => {
      // Two handlers counting the same thing would otherwise lose increments.
      await Promise.all([
        store.increment(ADDON, 't', 'count'),
        store.increment(ADDON, 't', 'count'),
        store.increment(ADDON, 't', 'count'),
      ]);
      expect(store.get(ADDON, 't', 'count')).toBe(3);
    });

    it('increments by a given amount and starts from zero', async () => {
      expect((await store.increment(ADDON, 't', 'k', 5)).value).toBe(5);
      expect((await store.increment(ADDON, 't', 'k', -2)).value).toBe(3);
    });

    it('treats a non-numeric existing value as zero', async () => {
      await store.set(ADDON, 't', 'k', 'not a number');
      expect((await store.increment(ADDON, 't', 'k')).value).toBe(1);
    });

    it('compare-and-set succeeds on a match and refuses otherwise', async () => {
      await store.set(ADDON, 't', 'k', 'one');
      expect(
        (await store.compareAndSet(ADDON, 't', 'k', 'one', 'two')).ok,
      ).toBe(true);
      expect(store.get(ADDON, 't', 'k')).toBe('two');

      const stale = await store.compareAndSet(ADDON, 't', 'k', 'one', 'three');
      expect(stale).toEqual({ ok: false, reason: 'mismatch' });
      expect(store.get(ADDON, 't', 'k')).toBe('two');
    });

    it('compare-and-set treats a missing key as null', async () => {
      expect((await store.compareAndSet(ADDON, 't', 'new', null, 'v')).ok).toBe(
        true,
      );
    });
  });

  describe('batches', () => {
    it('applies sets and deletes together', async () => {
      await store.set(ADDON, 't', 'gone', 'x');
      await store.batch(ADDON, 't', [
        { op: 'set', key: 'a', value: 1 },
        { op: 'set', key: 'b', value: 2 },
        { op: 'delete', key: 'gone' },
      ]);

      expect(store.get(ADDON, 't', 'a')).toBe(1);
      expect(store.get(ADDON, 't', 'b')).toBe(2);
      expect(store.has(ADDON, 't', 'gone')).toBe(false);
    });

    it('applies nothing when any operation would breach a limit', async () => {
      const result = await store.batch(ADDON, 't', [
        { op: 'set', key: 'ok', value: 1 },
        { op: 'set', key: 'x'.repeat(MAX_KEY_CHARS + 1), value: 1 },
      ]);

      // A half-applied batch leaves the table in a state nobody asked for.
      expect(result).toEqual({ ok: false, reason: 'key-too-long' });
      expect(store.has(ADDON, 't', 'ok')).toBe(false);
    });
  });

  describe('quotas', () => {
    it('refuses an over-long key and an over-large value with a reason', async () => {
      expect(
        await store.set(ADDON, 't', 'x'.repeat(MAX_KEY_CHARS + 1), 1),
      ).toEqual({ ok: false, reason: 'key-too-long' });
      expect(await store.set(ADDON, 't', '', 1)).toEqual({
        ok: false,
        reason: 'key-too-long',
      });
      expect(
        await store.set(ADDON, 't', 'k', 'x'.repeat(MAX_VALUE_BYTES + 10)),
      ).toEqual({ ok: false, reason: 'value-too-large' });
    });

    it('refuses a value that cannot be serialized', async () => {
      const cyclic: any = {};
      cyclic.self = cyclic;
      expect(await store.set(ADDON, 't', 'k', cyclic)).toEqual({
        ok: false,
        reason: 'not-serializable',
      });
    });

    it('bounds how many tables one addon may create', async () => {
      for (let index = 0; index < MAX_TABLES_PER_ADDON; index += 1)
        await store.set(ADDON, `t${index}`, 'k', 1);
      expect(await store.set(ADDON, 'one-too-many', 'k', 1)).toEqual({
        ok: false,
        reason: 'too-many-tables',
      });
      // Writing to a table that already exists still works.
      expect((await store.set(ADDON, 't0', 'k2', 1)).ok).toBe(true);
    });

    it('enforces the total byte quota and lets a replacement through', async () => {
      const chunk = 'x'.repeat(MAX_VALUE_BYTES - 100);
      let written = 0;
      while (store.usedBytes(ADDON) + chunk.length < MAX_ADDON_BYTES) {
        const result = await store.set(ADDON, 't', `k${written++}`, chunk);
        if (!result.ok) break;
      }
      const overflow = await store.set(ADDON, 't', 'overflow', chunk);
      expect(overflow).toEqual({ ok: false, reason: 'addon-quota' });

      // Replacing an existing key must not be charged twice, or a full store
      // becomes permanently unwritable even for an update.
      expect((await store.set(ADDON, 't', 'k0', chunk)).ok).toBe(true);
    });
  });

  describe('TTL', () => {
    it('hides an expired entry on read even before a sweep', async () => {
      await store.set(ADDON, 't', 'k', 'v', 50);
      expect(store.get(ADDON, 't', 'k')).toBe('v');

      jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 1000);
      expect(store.get(ADDON, 't', 'k')).toBeUndefined();
      expect(store.has(ADDON, 't', 'k')).toBe(false);
      expect(store.query(ADDON, 't')).toEqual([]);
      jest.restoreAllMocks();
    });

    it('prunes expired entries and leaves live ones', async () => {
      await store.set(ADDON, 't', 'dies', 'v', 50);
      await store.set(ADDON, 't', 'lives', 'v');

      jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 1000);
      expect(await store.prune(ADDON)).toBe(1);
      jest.restoreAllMocks();

      expect(store.has(ADDON, 't', 'lives')).toBe(true);
      expect(await store.prune('nobody')).toBe(0);
    });

    it('treats a zero or negative TTL as no expiry', async () => {
      await store.set(ADDON, 't', 'k', 'v', 0);
      expect(store.get(ADDON, 't', 'k')).toBe('v');
    });
  });

  describe('queries', () => {
    beforeEach(async () => {
      await store.set(ADDON, 't', 'user:b', 2);
      await store.set(ADDON, 't', 'user:a', 1);
      await store.set(ADDON, 't', 'other', 3);
    });

    it('filters by prefix and sorts by key', () => {
      expect(
        store.query(ADDON, 't', { prefix: 'user:' }).map(e => e.key),
      ).toEqual(['user:a', 'user:b']);
    });

    it('sorts by update time and can reverse', () => {
      const byTime = store.query(ADDON, 't', { sortBy: 'updatedAt' });
      expect(byTime[0].key).toBe('user:b');
      expect(store.query(ADDON, 't', { descending: true })[0].key).toBe(
        'user:b',
      );
    });

    it('bounds the result count', () => {
      expect(store.query(ADDON, 't', { limit: 1 })).toHaveLength(1);
      expect(store.query(ADDON, 't', { limit: 0 })).toHaveLength(1);
      expect(store.query(ADDON, 't', { limit: 99999 })).toHaveLength(3);
    });

    it('lists keys', () => {
      expect(store.keys(ADDON, 't').sort()).toEqual([
        'other',
        'user:a',
        'user:b',
      ]);
    });
  });

  describe('migration', () => {
    it('runs a migration and records the new version', async () => {
      await store.set(ADDON, 'old', 'k', 'v');

      const result = await store.migrate(ADDON, 2, tables => ({
        fresh: (tables.old ?? []).map(entry => ({
          ...entry,
          value: `${entry.value}!`,
        })),
      }));

      expect(result.ok).toBe(true);
      expect(store.schemaVersion(ADDON)).toBe(2);
      expect(store.get(ADDON, 'fresh', 'k')).toBe('v!');
      expect(store.tableNames(ADDON)).toEqual(['fresh']);
    });

    it('keeps nothing when the migration throws', async () => {
      await store.set(ADDON, 'old', 'k', 'v');
      const result = await store.migrate(ADDON, 2, () => {
        throw new Error('bad migration');
      });

      // Half-converted data is how an addon becomes permanently broken.
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/bad migration/);
      expect(store.schemaVersion(ADDON)).toBe(0);
      expect(store.get(ADDON, 'old', 'k')).toBe('v');
    });

    it('does not re-run a migration already applied', async () => {
      await store.migrate(ADDON, 2, tables => tables);
      const again = jest.fn(tables => tables);
      await store.migrate(ADDON, 2, again);
      expect(again).not.toHaveBeenCalled();
    });
  });

  describe('persistence', () => {
    it('survives a reload', async () => {
      await store.set(ADDON, 't', 'k', { nested: true });
      await store.migrate(ADDON, 3, tables => tables);

      const reloaded = new AddonTableStore();
      await reloaded.load(ADDON);

      expect(reloaded.get(ADDON, 't', 'k')).toEqual({ nested: true });
      expect(reloaded.schemaVersion(ADDON)).toBe(3);
    });

    it('starts empty rather than blocking when stored data is corrupt', async () => {
      await AsyncStorage.setItem(
        '@AndroidIRCX:addonTable:v1:' + ADDON,
        'not json',
      );
      const reloaded = new AddonTableStore();
      await reloaded.load(ADDON);

      // The alternative is an addon that can never run again because one
      // write was interrupted.
      expect(reloaded.tableNames(ADDON)).toEqual([]);
    });

    it('loads only once', async () => {
      const spy = jest.spyOn(AsyncStorage, 'getItem');
      await store.load(ADDON);
      await store.load(ADDON);
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
});

describe('quota accounting stays honest (M3.2)', () => {
  let store: AddonTableStore;

  beforeEach(() => {
    (AsyncStorage as any).__reset?.();
    store = new AddonTableStore();
  });

  /** What usedBytes would say if it walked everything, the slow way. */
  const trueTotal = (addonId: string): number => {
    let total = 0;
    for (const table of (store as any).byAddon.get(addonId)?.tables.values() ??
      [])
      for (const entry of (table as Map<string, any>).values())
        total += entry.key.length + JSON.stringify(entry.value).length;
    return total;
  };

  it('matches a full recount after a mixture of operations', async () => {
    // The total is carried rather than recomputed, so the risk it trades for
    // speed is drift. This is the test that would catch it.
    await store.set(ADDON, 'a', 'one', 'hello');
    await store.set(ADDON, 'a', 'two', { nested: [1, 2, 3] });
    await store.set(ADDON, 'b', 'three', 42);

    await store.set(ADDON, 'a', 'one', 'replaced with something longer');
    await store.delete(ADDON, 'b', 'three');
    await store.increment(ADDON, 'a', 'counter', 5);
    await store.batch(ADDON, 'a', [
      { op: 'set', key: 'four', value: 'x'.repeat(100) },
      { op: 'delete', key: 'two' },
    ]);

    expect(store.usedBytes(ADDON)).toBe(trueTotal(ADDON));
  });

  it('matches after dropping a table', async () => {
    await store.set(ADDON, 'keep', 'k', 'v');
    await store.set(ADDON, 'drop', 'k', 'x'.repeat(200));
    await store.dropTable(ADDON, 'drop');

    expect(store.usedBytes(ADDON)).toBe(trueTotal(ADDON));
  });

  it('matches after pruning expired entries', async () => {
    const now = Date.now();
    await store.set(ADDON, 't', 'lives', 'v');
    await store.set(ADDON, 't', 'dies', 'x'.repeat(200), 50);

    jest.spyOn(Date, 'now').mockReturnValue(now + 1000);
    await store.prune(ADDON);
    jest.restoreAllMocks();

    expect(store.usedBytes(ADDON)).toBe(trueTotal(ADDON));
  });

  it('matches after a migration rebuilds the tables', async () => {
    await store.set(ADDON, 'old', 'k', 'short');
    await store.migrate(ADDON, 2, tables => ({
      fresh: (tables.old ?? []).map(entry => ({
        ...entry,
        value: 'much longer value than before',
      })),
    }));

    expect(store.usedBytes(ADDON)).toBe(trueTotal(ADDON));
  });

  it('matches after reloading from storage', async () => {
    await store.set(ADDON, 't', 'k', { some: 'value' });
    const reloaded = new AddonTableStore();
    await reloaded.load(ADDON);

    expect(reloaded.usedBytes(ADDON)).toBeGreaterThan(0);
    expect(reloaded.usedBytes(ADDON)).toBe(store.usedBytes(ADDON));
  });

  it('does not walk every entry on every write', async () => {
    // A full store used to re-stringify megabytes per `set`, so an addon that
    // filled its quota made its own next thousand writes crawl.
    const spy = jest.spyOn(JSON, 'stringify');
    for (let index = 0; index < 50; index += 1)
      await store.set(ADDON, 't', `k${index}`, 'x'.repeat(500));

    const perWrite = spy.mock.calls.length / 50;
    spy.mockRestore();
    // A handful per write, not one per stored entry.
    expect(perWrite).toBeLessThan(10);
  });
});

/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AddonTableStore } from '../../src/services/scripting/AddonTableStore';
import {
  AddonDataTransfer,
  EXPORT_FORMAT,
  EXPORT_FORMAT_VERSION,
  MAX_IMPORT_BYTES,
} from '../../src/services/scripting/AddonDataTransfer';

const ADDON = 'transfer.addon';

describe('AddonDataTransfer', () => {
  let tables: AddonTableStore;
  let transfer: AddonDataTransfer;

  beforeEach(() => {
    (AsyncStorage as any).__reset?.();
    tables = new AddonTableStore();
    transfer = new AddonDataTransfer(tables);
  });

  const fileFrom = (payload: unknown) => JSON.stringify(payload);

  describe('export', () => {
    it('carries tables, the schema version and no secrets', async () => {
      await tables.set(ADDON, 'prefs', 'theme', 'dark');
      await tables.migrate(ADDON, 4, t => t);

      const result = transfer.export(ADDON);

      expect(result.format).toBe(EXPORT_FORMAT);
      expect(result.formatVersion).toBe(EXPORT_FORMAT_VERSION);
      expect(result.addonId).toBe(ADDON);
      expect(result.schemaVersion).toBe(4);
      expect(result.tables.prefs[0]).toMatchObject({
        key: 'theme',
        value: 'dark',
      });
      // The export walks tables only; the secret store is not even imported
      // here, so this cannot start including secrets by accident.
      expect(JSON.stringify(result)).not.toMatch(/secret/i);
    });

    it('exports an addon with nothing stored', () => {
      expect(transfer.export('empty.addon').tables).toEqual({});
    });
  });

  describe('preview', () => {
    it('describes what an import would bring without importing it', async () => {
      await tables.set(ADDON, 'prefs', 'a', 1);
      await tables.set(ADDON, 'prefs', 'b', 2);
      await tables.set(ADDON, 'other', 'c', 3);
      const file = fileFrom(transfer.export(ADDON));

      const fresh = new AddonDataTransfer(new AddonTableStore());
      const preview = fresh.preview(file, ADDON);

      expect(preview.ok).toBe(true);
      expect(preview.tables).toEqual({ prefs: 2, other: 1 });
      expect(preview.totalEntries).toBe(3);
      expect(preview.foreign).toBe(false);
    });

    it('flags an export that came from a different addon without refusing it', async () => {
      await tables.set(ADDON, 'prefs', 'a', 1);
      const file = fileFrom(transfer.export(ADDON));

      // Moving data between two versions of the same addon under different ids
      // is a real thing people do - but they should be told.
      expect(transfer.preview(file, 'someone.else').foreign).toBe(true);
    });

    it.each([
      ['an empty file', ''],
      ['invalid JSON', 'not json'],
      ['an array', '[]'],
      ['a file that is not an export', '{"hello":true}'],
    ])('refuses %s with a readable reason', (_label, raw) => {
      const preview = transfer.preview(raw, ADDON);
      expect(preview.ok).toBe(false);
      expect(preview.errors.length).toBeGreaterThan(0);
      expect(preview.errors.join()).toMatch(/[a-z]/);
    });

    it('refuses a file written by a newer app', () => {
      const preview = transfer.preview(
        fileFrom({
          format: EXPORT_FORMAT,
          formatVersion: EXPORT_FORMAT_VERSION + 1,
          addonId: ADDON,
          tables: {},
        }),
        ADDON,
      );
      // Forward-compatible would mean guessing what a newer field means.
      expect(preview.ok).toBe(false);
      expect(preview.errors.join()).toMatch(/newer version/i);
    });

    it('refuses a file that is too large to be sensible', () => {
      const preview = transfer.preview('x'.repeat(MAX_IMPORT_BYTES + 1), ADDON);
      expect(preview.errors.join()).toMatch(/too large/i);
    });

    it('reports a malformed table rather than importing part of it', () => {
      const preview = transfer.preview(
        fileFrom({
          format: EXPORT_FORMAT,
          formatVersion: EXPORT_FORMAT_VERSION,
          addonId: ADDON,
          tables: { good: [], bad: 'not an array' },
        }),
        ADDON,
      );
      expect(preview.ok).toBe(false);
      expect(preview.errors.join()).toMatch(/malformed/i);
    });
  });

  describe('apply', () => {
    it('imports entries alongside what is already there', async () => {
      await tables.set(ADDON, 'prefs', 'existing', 'keep');
      const file = fileFrom({
        format: EXPORT_FORMAT,
        formatVersion: EXPORT_FORMAT_VERSION,
        addonId: ADDON,
        schemaVersion: 1,
        tables: { prefs: [{ key: 'new', value: 'added', updatedAt: 1 }] },
      });

      expect(await transfer.apply(ADDON, file)).toEqual({
        ok: true,
        imported: 1,
      });
      expect(tables.get(ADDON, 'prefs', 'existing')).toBe('keep');
      expect(tables.get(ADDON, 'prefs', 'new')).toBe('added');
    });

    it('replaces everything when asked to', async () => {
      await tables.set(ADDON, 'prefs', 'existing', 'gone');
      const file = fileFrom({
        format: EXPORT_FORMAT,
        formatVersion: EXPORT_FORMAT_VERSION,
        addonId: ADDON,
        tables: { prefs: [{ key: 'new', value: 'added', updatedAt: 1 }] },
      });

      await transfer.apply(ADDON, file, { replace: true });
      expect(tables.has(ADDON, 'prefs', 'existing')).toBe(false);
      expect(tables.get(ADDON, 'prefs', 'new')).toBe('added');
    });

    it('rolls back completely when a write is refused partway', async () => {
      await tables.set(ADDON, 'prefs', 'original', 'intact');
      const file = fileFrom({
        format: EXPORT_FORMAT,
        formatVersion: EXPORT_FORMAT_VERSION,
        addonId: ADDON,
        tables: {
          prefs: [
            { key: 'fine', value: 'ok', updatedAt: 1 },
            { key: 'x'.repeat(500), value: 'too long a key', updatedAt: 1 },
          ],
        },
      });

      const result = await transfer.apply(ADDON, file);

      // Half the old data and half the file's is worse than either.
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/Nothing was changed/);
      expect(tables.get(ADDON, 'prefs', 'original')).toBe('intact');
      expect(tables.has(ADDON, 'prefs', 'fine')).toBe(false);
    });

    it('refuses to apply a file that does not preview cleanly', async () => {
      const result = await transfer.apply(ADDON, 'not json');
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/JSON/);
    });

    it('round-trips through export and import', async () => {
      await tables.set(ADDON, 'prefs', 'theme', 'dark');
      await tables.set(ADDON, 'counts', 'messages', 42);
      const file = fileFrom(transfer.export(ADDON));

      const freshTables = new AddonTableStore();
      const fresh = new AddonDataTransfer(freshTables);
      expect((await fresh.apply(ADDON, file)).imported).toBe(2);

      expect(freshTables.get(ADDON, 'prefs', 'theme')).toBe('dark');
      expect(freshTables.get(ADDON, 'counts', 'messages')).toBe(42);
    });
  });
});

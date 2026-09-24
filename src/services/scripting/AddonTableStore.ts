/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * mIRC's hash tables, with the parts that make them safe on a phone.
 *
 * mIRC hash tables are global, unbounded and shared between scripts, which is
 * fine on a desktop with one owner and fatal in a store app: one addon could
 * fill the device, or read another addon's data by guessing a table name.
 * Here every table belongs to exactly one addon, everything is bounded, and a
 * quota error is a value the caller can act on rather than an exception thrown
 * from somewhere unrelated.
 */

const STORAGE_PREFIX = '@AndroidIRCX:addonTable:v1:';

export const MAX_KEY_CHARS = 200;
export const MAX_VALUE_BYTES = 64 * 1024;
export const MAX_TABLE_ENTRIES = 5000;
/** Total across every table one addon owns. */
export const MAX_ADDON_BYTES = 2 * 1024 * 1024;
export const MAX_TABLES_PER_ADDON = 20;
export const MAX_QUERY_RESULTS = 500;

export type TableValue = string | number | boolean | null | TableJson;
type TableJson = { [key: string]: TableValue } | TableValue[];

export interface TableEntry {
  key: string;
  value: TableValue;
  /** Absolute epoch milliseconds, or undefined when the entry does not expire. */
  expiresAt?: number;
  updatedAt: number;
}

export type QuotaReason =
  | 'key-too-long'
  | 'value-too-large'
  | 'table-full'
  | 'addon-quota'
  | 'too-many-tables'
  | 'not-serializable';

export interface WriteResult {
  ok: boolean;
  reason?: QuotaReason;
}

export interface QueryOptions {
  /** Key prefix to match. */
  prefix?: string;
  limit?: number;
  /** Sort by key, or by when the entry was last written. */
  sortBy?: 'key' | 'updatedAt';
  descending?: boolean;
}

export interface BatchOperation {
  op: 'set' | 'delete';
  key: string;
  value?: TableValue;
  ttlMs?: number;
}

interface AddonTables {
  tables: Map<string, Map<string, TableEntry>>;
  /** Data schema version the addon last migrated to. */
  schemaVersion: number;
  /**
   * Running total of stored bytes.
   *
   * Kept rather than recomputed because the quota is checked on **every**
   * write: walking every table and re-stringifying every value made a full
   * store cost megabytes of work per `set`, so an addon that filled its quota
   * made its own next thousand writes crawl. Recomputed only where it is both
   * cheap and rare - on load, after a migration, and after a prune.
   */
  bytes: number;
}

export class AddonTableStore {
  private byAddon = new Map<string, AddonTables>();
  private loaded = new Set<string>();

  async load(addonId: string): Promise<void> {
    if (this.loaded.has(addonId)) return;
    this.loaded.add(addonId);
    try {
      const raw = await AsyncStorage.getItem(STORAGE_PREFIX + addonId);
      if (raw) this.restore(addonId, JSON.parse(raw) as unknown);
    } catch {
      // Unreadable data starts empty rather than blocking the addon. The
      // alternative is an addon that can never run again because one write
      // was interrupted.
      this.byAddon.delete(addonId);
    }
  }

  // ────────────────────────────────────────────────────────────── writes ──

  async set(
    addonId: string,
    table: string,
    key: string,
    value: TableValue,
    ttlMs?: number,
  ): Promise<WriteResult> {
    const check = this.checkWritable(addonId, table, key, value);
    if (!check.ok) return check;

    const owner = this.owner(addonId);
    const entries = this.tableOf(addonId, table);
    const previous = entries.get(key);
    if (previous) owner.bytes -= this.costOf(previous);
    const entry: TableEntry = {
      key,
      value,
      expiresAt: ttlMs && ttlMs > 0 ? Date.now() + ttlMs : undefined,
      updatedAt: Date.now(),
    };
    entries.set(key, entry);
    owner.bytes += this.costOf(entry);
    await this.persist(addonId);
    return { ok: true };
  }

  /**
   * Add to a number in one step.
   *
   * Read-modify-write from a script is not atomic across an await, so two
   * handlers counting the same thing lose increments. This does the whole
   * thing synchronously before persisting.
   */
  async increment(
    addonId: string,
    table: string,
    key: string,
    by = 1,
  ): Promise<{ ok: boolean; value?: number; reason?: QuotaReason }> {
    const entries = this.tableOf(addonId, table);
    const current = this.live(entries, key);
    const base = typeof current?.value === 'number' ? current.value : 0;
    const next = base + (Number.isFinite(by) ? by : 0);
    const result = await this.set(addonId, table, key, next);
    return result.ok ? { ok: true, value: next } : result;
  }

  /** Write only if the stored value still matches what the caller last saw. */
  async compareAndSet(
    addonId: string,
    table: string,
    key: string,
    expected: TableValue,
    value: TableValue,
  ): Promise<{ ok: boolean; reason?: QuotaReason | 'mismatch' }> {
    const entries = this.tableOf(addonId, table);
    const current = this.live(entries, key)?.value ?? null;
    if (JSON.stringify(current) !== JSON.stringify(expected ?? null))
      return { ok: false, reason: 'mismatch' };
    return this.set(addonId, table, key, value);
  }

  /**
   * Several writes, applied together or not at all.
   *
   * Validated first, then applied: a batch that would exceed quota halfway
   * must not leave the table in a state the addon never asked for.
   */
  async batch(
    addonId: string,
    table: string,
    operations: readonly BatchOperation[],
  ): Promise<WriteResult> {
    for (const operation of operations) {
      if (operation.op !== 'set') continue;
      const check = this.checkWritable(
        addonId,
        table,
        operation.key,
        operation.value ?? null,
      );
      if (!check.ok) return check;
    }

    const owner = this.owner(addonId);
    const entries = this.tableOf(addonId, table);
    for (const operation of operations) {
      const previous = entries.get(operation.key);
      if (previous) owner.bytes -= this.costOf(previous);
      if (operation.op === 'delete') {
        entries.delete(operation.key);
        continue;
      }
      const entry: TableEntry = {
        key: operation.key,
        value: operation.value ?? null,
        expiresAt:
          operation.ttlMs && operation.ttlMs > 0
            ? Date.now() + operation.ttlMs
            : undefined,
        updatedAt: Date.now(),
      };
      entries.set(operation.key, entry);
      owner.bytes += this.costOf(entry);
    }
    await this.persist(addonId);
    return { ok: true };
  }

  async delete(addonId: string, table: string, key: string): Promise<boolean> {
    const entries = this.tableOf(addonId, table);
    const existing = entries.get(key);
    const removed = entries.delete(key);
    if (removed) {
      if (existing) this.owner(addonId).bytes -= this.costOf(existing);
      await this.persist(addonId);
    }
    return removed;
  }

  async dropTable(addonId: string, table: string): Promise<void> {
    const owner = this.byAddon.get(addonId);
    if (!owner) return;
    const entries = owner.tables.get(table);
    if (!owner.tables.delete(table)) return;
    for (const entry of entries?.values() ?? [])
      owner.bytes -= this.costOf(entry);
    await this.persist(addonId);
  }

  async clearAddon(addonId: string): Promise<void> {
    this.byAddon.delete(addonId);
    this.loaded.delete(addonId);
    try {
      await AsyncStorage.removeItem(STORAGE_PREFIX + addonId);
    } catch {
      // Nothing useful to do; the in-memory copy is already gone.
    }
  }

  // ─────────────────────────────────────────────────────────────── reads ──

  get(addonId: string, table: string, key: string): TableValue | undefined {
    return this.live(this.tableOf(addonId, table), key)?.value;
  }

  has(addonId: string, table: string, key: string): boolean {
    return this.live(this.tableOf(addonId, table), key) !== undefined;
  }

  keys(addonId: string, table: string): string[] {
    return this.query(addonId, table, { limit: MAX_QUERY_RESULTS }).map(
      entry => entry.key,
    );
  }

  query(
    addonId: string,
    table: string,
    options: QueryOptions = {},
  ): TableEntry[] {
    const entries = this.tableOf(addonId, table);
    const now = Date.now();
    const matched: TableEntry[] = [];
    for (const entry of entries.values()) {
      if (entry.expiresAt !== undefined && entry.expiresAt <= now) continue;
      if (options.prefix && !entry.key.startsWith(options.prefix)) continue;
      matched.push({ ...entry });
    }

    const sortBy = options.sortBy ?? 'key';
    matched.sort((left, right) =>
      sortBy === 'key'
        ? left.key.localeCompare(right.key)
        : left.updatedAt - right.updatedAt,
    );
    if (options.descending) matched.reverse();

    const limit = Math.min(
      Math.max(1, options.limit ?? MAX_QUERY_RESULTS),
      MAX_QUERY_RESULTS,
    );
    return matched.slice(0, limit);
  }

  tableNames(addonId: string): string[] {
    return [...(this.byAddon.get(addonId)?.tables.keys() ?? [])];
  }

  usedBytes(addonId: string): number {
    return this.byAddon.get(addonId)?.bytes ?? 0;
  }

  /** The slow, correct answer. Used where it is cheap and rare. */
  private recomputeBytes(owner: AddonTables): void {
    let total = 0;
    for (const table of owner.tables.values())
      for (const entry of table.values())
        total += entry.key.length + sizeOf(entry.value);
    owner.bytes = total;
  }

  /** What one entry costs against the quota. */
  private costOf(entry: TableEntry): number {
    return entry.key.length + sizeOf(entry.value);
  }

  // ─────────────────────────────────────────────────────────── migration ──

  schemaVersion(addonId: string): number {
    return this.byAddon.get(addonId)?.schemaVersion ?? 0;
  }

  /**
   * Run an addon's own migration between data schema versions.
   *
   * The migration runs against a copy. If it throws, nothing is kept: a failed
   * migration leaving half-converted data is how an addon becomes permanently
   * broken with no way back.
   */
  async migrate(
    addonId: string,
    toVersion: number,
    migrate: (
      tables: Record<string, TableEntry[]>,
    ) => Record<string, TableEntry[]>,
  ): Promise<{ ok: boolean; error?: string }> {
    const owner = this.owner(addonId);
    if (owner.schemaVersion >= toVersion) return { ok: true };

    const snapshot: Record<string, TableEntry[]> = {};
    for (const [name, table] of owner.tables)
      snapshot[name] = [...table.values()].map(entry => ({ ...entry }));

    let migrated: Record<string, TableEntry[]>;
    try {
      migrated = migrate(snapshot);
      if (!migrated || typeof migrated !== 'object')
        throw new Error('migration returned no tables');
    } catch (error) {
      return { ok: false, error: String((error as Error)?.message ?? error) };
    }

    const rebuilt = new Map<string, Map<string, TableEntry>>();
    for (const [name, entries] of Object.entries(migrated)) {
      if (!Array.isArray(entries)) continue;
      const table = new Map<string, TableEntry>();
      for (const entry of entries)
        if (entry?.key) table.set(entry.key, { ...entry });
      rebuilt.set(name, table);
    }

    owner.tables = rebuilt;
    owner.schemaVersion = toVersion;
    this.recomputeBytes(owner);
    await this.persist(addonId);
    return { ok: true };
  }

  /** Drop expired entries. Returns how many went. */
  async prune(addonId: string): Promise<number> {
    const owner = this.byAddon.get(addonId);
    if (!owner) return 0;
    const now = Date.now();
    let removed = 0;
    for (const table of owner.tables.values())
      for (const [key, entry] of [...table])
        if (entry.expiresAt !== undefined && entry.expiresAt <= now) {
          table.delete(key);
          removed += 1;
        }
    if (removed) {
      this.recomputeBytes(owner);
      await this.persist(addonId);
    }
    return removed;
  }

  resetForTests(): void {
    this.byAddon.clear();
    this.loaded.clear();
  }

  // ───────────────────────────────────────────────────────────── internal ──

  private checkWritable(
    addonId: string,
    table: string,
    key: string,
    value: TableValue,
  ): WriteResult {
    if (
      typeof key !== 'string' ||
      key.length === 0 ||
      key.length > MAX_KEY_CHARS
    )
      return { ok: false, reason: 'key-too-long' };

    let size: number;
    try {
      size = sizeOf(value);
    } catch {
      // A cyclic object, a function or a BigInt: not storable, and saying so
      // beats persisting something the addon cannot read back.
      return { ok: false, reason: 'not-serializable' };
    }
    if (size > MAX_VALUE_BYTES) return { ok: false, reason: 'value-too-large' };

    const owner = this.owner(addonId);
    if (!owner.tables.has(table) && owner.tables.size >= MAX_TABLES_PER_ADDON)
      return { ok: false, reason: 'too-many-tables' };

    const entries = owner.tables.get(table);
    const replacing = entries?.has(key) ?? false;
    if (!replacing && (entries?.size ?? 0) >= MAX_TABLE_ENTRIES)
      return { ok: false, reason: 'table-full' };

    const existing = replacing
      ? key.length + sizeOf(entries!.get(key)!.value)
      : 0;
    if (
      this.usedBytes(addonId) - existing + key.length + size >
      MAX_ADDON_BYTES
    )
      return { ok: false, reason: 'addon-quota' };

    return { ok: true };
  }

  private live(
    entries: Map<string, TableEntry>,
    key: string,
  ): TableEntry | undefined {
    const entry = entries.get(key);
    if (!entry) return undefined;
    // Expiry is evaluated on read as well as by prune, so a TTL is honoured
    // even when nothing has swept yet.
    if (entry.expiresAt !== undefined && entry.expiresAt <= Date.now())
      return undefined;
    return entry;
  }

  private tableOf(addonId: string, table: string): Map<string, TableEntry> {
    const owner = this.owner(addonId);
    let entries = owner.tables.get(table);
    if (!entries) {
      entries = new Map();
      owner.tables.set(table, entries);
    }
    return entries;
  }

  private owner(addonId: string): AddonTables {
    let owner = this.byAddon.get(addonId);
    if (!owner) {
      owner = { tables: new Map(), schemaVersion: 0, bytes: 0 };
      this.byAddon.set(addonId, owner);
    }
    return owner;
  }

  private restore(addonId: string, value: unknown): void {
    if (!value || typeof value !== 'object') return;
    const stored = value as {
      schemaVersion?: unknown;
      tables?: Record<string, TableEntry[]>;
    };
    const owner = this.owner(addonId);
    owner.schemaVersion = Number.isSafeInteger(stored.schemaVersion)
      ? (stored.schemaVersion as number)
      : 0;
    for (const [name, entries] of Object.entries(stored.tables ?? {})) {
      if (!Array.isArray(entries)) continue;
      const table = new Map<string, TableEntry>();
      for (const entry of entries)
        if (entry && typeof entry.key === 'string')
          table.set(entry.key, {
            key: entry.key,
            value: entry.value ?? null,
            expiresAt:
              typeof entry.expiresAt === 'number' ? entry.expiresAt : undefined,
            updatedAt:
              typeof entry.updatedAt === 'number'
                ? entry.updatedAt
                : Date.now(),
          });
      owner.tables.set(name, table);
    }
    this.recomputeBytes(owner);
  }

  private async persist(addonId: string): Promise<void> {
    const owner = this.byAddon.get(addonId);
    if (!owner) return;
    const tables: Record<string, TableEntry[]> = {};
    for (const [name, table] of owner.tables)
      tables[name] = [...table.values()];
    try {
      await AsyncStorage.setItem(
        STORAGE_PREFIX + addonId,
        JSON.stringify({ schemaVersion: owner.schemaVersion, tables }),
      );
    } catch {
      // The in-memory table stays correct for this session. Failing the write
      // here would make an addon think its data vanished when it has not.
    }
  }
}

function sizeOf(value: TableValue): number {
  const json = JSON.stringify(value);
  if (json === undefined) throw new Error('not serializable');
  return json.length;
}

export const addonTableStore = new AddonTableStore();

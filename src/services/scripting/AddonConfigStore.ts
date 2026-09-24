/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@AndroidIRCX:addonConfig:v1';
const ADDON_ID = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const CHECKSUM = /^[0-9a-f]{64}$/;
const MAX_BYTES = 256 * 1024;
const MAX_DEPTH = 20;
const MAX_NODES = 10_000;
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

export type AddonConfigValue =
  | null
  | boolean
  | number
  | string
  | AddonConfigValue[]
  | { [key: string]: AddonConfigValue };

interface AddonConfigRecord {
  current: AddonConfigValue;
  snapshots: Record<string, AddonConfigValue>;
}

type StoredState = Record<string, AddonConfigRecord>;

export interface AddonConfigStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export class AddonConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AddonConfigError';
  }
}

/** JSON-only addon configuration with checksum-addressed rollback snapshots. */
export class AddonConfigStore {
  private records = new Map<string, AddonConfigRecord>();
  private initialized = false;

  constructor(private readonly storage: AddonConfigStorage = AsyncStorage) {}

  async initialize(): Promise<void> {
    if (this.initialized) return;
    const raw = await this.storage.getItem(STORAGE_KEY);
    if (raw) this.restore(JSON.parse(raw) as unknown);
    this.initialized = true;
  }

  get(addonId: string): AddonConfigValue {
    this.validateAddonId(addonId);
    return clone(this.records.get(addonId)?.current ?? {});
  }

  async set(addonId: string, value: AddonConfigValue): Promise<void> {
    await this.initialize();
    this.validateAddonId(addonId);
    const safe = validateAddonJson(value);
    const previous = this.records.get(addonId);
    await this.persistWith(addonId, {
      current: safe,
      snapshots: previous ? cloneSnapshots(previous.snapshots) : {},
    });
  }

  async snapshot(addonId: string, checksum: string): Promise<void> {
    await this.initialize();
    this.validateAddonId(addonId);
    this.validateChecksum(checksum);
    const previous = this.records.get(addonId) ?? {
      current: {},
      snapshots: {},
    };
    await this.persistWith(addonId, {
      current: clone(previous.current),
      snapshots: {
        ...cloneSnapshots(previous.snapshots),
        [checksum]: clone(previous.current),
      },
    });
  }

  async restoreSnapshot(addonId: string, checksum: string): Promise<void> {
    await this.initialize();
    this.validateAddonId(addonId);
    this.validateChecksum(checksum);
    const previous = this.records.get(addonId);
    const snapshot = previous?.snapshots[checksum];
    if (snapshot === undefined)
      throw new AddonConfigError('No configuration snapshot is available.');
    await this.persistWith(addonId, {
      current: clone(snapshot),
      snapshots: cloneSnapshots(previous!.snapshots),
    });
  }

  /** Applies only a trusted host migration and persists nothing on failure. */
  async migrate(
    addonId: string,
    migrate: (current: AddonConfigValue) => AddonConfigValue,
  ): Promise<void> {
    await this.initialize();
    const current = this.get(addonId);
    const migrated = migrate(current);
    await this.set(addonId, migrated);
  }

  private async persistWith(
    addonId: string,
    record: AddonConfigRecord,
  ): Promise<void> {
    const next = new Map(this.records);
    next.set(addonId, record);
    const state = Object.create(null) as StoredState;
    next.forEach((value, id) => {
      state[id] = value;
    });
    await this.storage.setItem(STORAGE_KEY, JSON.stringify(state));
    this.records.set(addonId, record);
  }

  private restore(value: unknown): void {
    if (!isPlainObject(value))
      throw new AddonConfigError('Addon configuration registry is corrupt.');
    const restored = new Map<string, AddonConfigRecord>();
    for (const [addonId, candidate] of Object.entries(value)) {
      this.validateAddonId(addonId);
      if (!isPlainObject(candidate) || !isPlainObject(candidate.snapshots))
        throw new AddonConfigError('Addon configuration registry is corrupt.');
      const snapshots: Record<string, AddonConfigValue> = Object.create(null);
      for (const [checksum, snapshot] of Object.entries(candidate.snapshots)) {
        this.validateChecksum(checksum);
        snapshots[checksum] = validateAddonJson(snapshot);
      }
      restored.set(addonId, {
        current: validateAddonJson(candidate.current),
        snapshots,
      });
    }
    this.records = restored;
  }

  private validateAddonId(addonId: string): void {
    if (!ADDON_ID.test(addonId))
      throw new AddonConfigError('Invalid addon id.');
  }

  private validateChecksum(checksum: string): void {
    if (!CHECKSUM.test(checksum))
      throw new AddonConfigError('Invalid addon checksum.');
  }
}

export function validateAddonJson(
  value: unknown,
  maxBytes = MAX_BYTES,
): AddonConfigValue {
  let nodes = 0;
  const visit = (candidate: unknown, depth: number): AddonConfigValue => {
    nodes += 1;
    if (nodes > MAX_NODES || depth > MAX_DEPTH)
      throw new AddonConfigError('Addon configuration is too complex.');
    if (
      candidate === null ||
      typeof candidate === 'boolean' ||
      typeof candidate === 'string'
    )
      return candidate;
    if (typeof candidate === 'number') {
      if (!Number.isFinite(candidate))
        throw new AddonConfigError(
          'Addon configuration contains an invalid number.',
        );
      return candidate;
    }
    if (Array.isArray(candidate))
      return candidate.map(item => visit(item, depth + 1));
    if (!isPlainObject(candidate))
      throw new AddonConfigError(
        'Addon configuration must contain JSON values only.',
      );
    const result = Object.create(null) as Record<string, AddonConfigValue>;
    for (const [key, item] of Object.entries(candidate)) {
      if (FORBIDDEN_KEYS.has(key) || key.length === 0 || key.length > 120)
        throw new AddonConfigError(
          'Addon configuration contains an unsafe key.',
        );
      result[key] = visit(item, depth + 1);
    }
    return result;
  };
  const safe = visit(value, 0);
  if (new TextEncoder().encode(JSON.stringify(safe)).length > maxBytes)
    throw new AddonConfigError('Addon configuration is too large.');
  return safe;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype ||
    Object.getPrototypeOf(value) === null);

const clone = (value: AddonConfigValue): AddonConfigValue =>
  validateAddonJson(value);

const cloneSnapshots = (
  snapshots: Record<string, AddonConfigValue>,
): Record<string, AddonConfigValue> => {
  const result: Record<string, AddonConfigValue> = Object.create(null);
  Object.entries(snapshots).forEach(([checksum, value]) => {
    result[checksum] = clone(value);
  });
  return result;
};

export const addonConfigStore = new AddonConfigStore();

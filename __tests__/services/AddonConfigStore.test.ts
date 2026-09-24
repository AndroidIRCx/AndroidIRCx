/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import {
  AddonConfigError,
  AddonConfigStore,
  type AddonConfigStorage,
} from '../../src/services/scripting/AddonConfigStore';

const addonId = 'rs.androidircx.config-test';
const checksumA = 'a'.repeat(64);
const checksumB = 'b'.repeat(64);

function dependencies(initial: string | null = null) {
  let stored = initial;
  const storage: AddonConfigStorage = {
    getItem: jest.fn(async () => stored),
    setItem: jest.fn(async (_key, value) => {
      stored = value;
    }),
  };
  return { storage, store: new AddonConfigStore(storage), read: () => stored };
}

describe('AddonConfigStore', () => {
  it('stores detached JSON-only values', async () => {
    const { store } = dependencies();
    const input = { channel: '#chat', nested: { enabled: true } };
    await store.set(addonId, input);
    input.nested.enabled = false;

    expect(store.get(addonId)).toEqual({
      channel: '#chat',
      nested: { enabled: true },
    });
    const output = store.get(addonId) as any;
    output.nested.enabled = false;
    expect(store.get(addonId)).toEqual({
      channel: '#chat',
      nested: { enabled: true },
    });
  });

  it('snapshots configuration by package checksum and restores either version', async () => {
    const { store } = dependencies();
    await store.set(addonId, { greeting: 'old' });
    await store.snapshot(addonId, checksumA);
    await store.set(addonId, { greeting: 'new' });
    await store.snapshot(addonId, checksumB);

    await store.restoreSnapshot(addonId, checksumA);
    expect(store.get(addonId)).toEqual({ greeting: 'old' });
    await store.restoreSnapshot(addonId, checksumB);
    expect(store.get(addonId)).toEqual({ greeting: 'new' });
  });

  it('runs trusted migrations atomically and rejects invalid output', async () => {
    const { store, storage } = dependencies();
    await store.set(addonId, { version: 1 });
    await store.migrate(addonId, current => ({
      ...(current as Record<string, any>),
      version: 2,
    }));
    expect(store.get(addonId)).toEqual({ version: 2 });

    const calls = (storage.setItem as jest.Mock).mock.calls.length;
    await expect(
      store.migrate(addonId, () => ({ invalid: Number.NaN })),
    ).rejects.toBeInstanceOf(AddonConfigError);
    expect(storage.setItem).toHaveBeenCalledTimes(calls);
    expect(store.get(addonId)).toEqual({ version: 2 });
  });

  it('rejects prototype keys, non-JSON values, excess depth and missing snapshots', async () => {
    const { store } = dependencies();
    const polluted = JSON.parse('{"__proto__":{"polluted":true}}');
    await expect(store.set(addonId, polluted)).rejects.toThrow('unsafe key');
    await expect(store.set(addonId, { fn: () => true } as any)).rejects.toThrow(
      'JSON values only',
    );
    let deep: any = 'end';
    for (let index = 0; index < 22; index += 1) deep = { next: deep };
    await expect(store.set(addonId, deep)).rejects.toThrow('too complex');
    await expect(store.restoreSnapshot(addonId, checksumA)).rejects.toThrow(
      'No configuration snapshot',
    );
  });

  it('rejects corrupt persisted registries without partially restoring them', async () => {
    const { store } = dependencies(
      JSON.stringify({
        [addonId]: {
          current: {},
          snapshots: { not_a_checksum: {} },
        },
      }),
    );
    await expect(store.initialize()).rejects.toThrow('Invalid addon checksum');
    expect(store.get(addonId)).toEqual({});
  });

  it('does not mutate memory when persistence fails', async () => {
    const { store, storage } = dependencies();
    await store.set(addonId, { stable: true });
    (storage.setItem as jest.Mock).mockRejectedValueOnce(new Error('disk'));
    await expect(store.set(addonId, { stable: false })).rejects.toThrow('disk');
    expect(store.get(addonId)).toEqual({ stable: true });
  });
});

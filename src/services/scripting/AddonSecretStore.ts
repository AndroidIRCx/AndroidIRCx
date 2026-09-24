/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import { secureStorageService } from '../SecureStorageService';

/**
 * Secrets an addon holds, kept in the device Keychain and out of everything
 * that leaves the device.
 *
 * The important asymmetry: an addon may **write** a secret and **ask whether
 * one exists**, but the only way to read a value back is the addon that stored
 * it asking for its own key. Nothing enumerates values, and no listing anywhere
 * returns one — a secrets namespace that can be walked is a credential dump
 * waiting for the first addon with a bug in it.
 */

/** Every addon secret starts with this, which is what backup filtering keys off. */
export const ADDON_SECRET_PREFIX = 'addon.secret.';

export const MAX_SECRET_KEYS_PER_ADDON = 20;
export const MAX_SECRET_CHARS = 4096;

const SAFE_SEGMENT = /^[a-zA-Z0-9._:-]{1,80}$/;

export interface SecretMetadata {
  key: string;
  /** Deliberately no value, and no length either - length leaks shape. */
  exists: true;
}

interface SecureBoundary {
  setSecret(key: string, value?: string | null): Promise<void>;
  getSecret(key: string): Promise<string | null>;
  removeSecret(key: string): Promise<void>;
  getAllSecretKeys(): Promise<string[]>;
}

export class AddonSecretStore {
  constructor(private readonly secure: SecureBoundary = secureStorageService) {}

  async set(addonId: string, key: string, value: string): Promise<void> {
    this.requireSafe(addonId, key);
    if (typeof value !== 'string' || value.length === 0)
      throw new Error('Addon secret value must be a non-empty string.');
    if (value.length > MAX_SECRET_CHARS)
      throw new Error('Addon secret value is too large.');

    const existing = await this.keys(addonId);
    if (!existing.includes(key) && existing.length >= MAX_SECRET_KEYS_PER_ADDON)
      throw new Error('Addon secret limit exceeded.');

    await this.secure.setSecret(this.storageKey(addonId, key), value);
  }

  /** Only the owning addon's own key. There is no cross-addon read. */
  async get(addonId: string, key: string): Promise<string | null> {
    this.requireSafe(addonId, key);
    return this.secure.getSecret(this.storageKey(addonId, key));
  }

  async delete(addonId: string, key: string): Promise<void> {
    this.requireSafe(addonId, key);
    await this.secure.removeSecret(this.storageKey(addonId, key));
  }

  async has(addonId: string, key: string): Promise<boolean> {
    return (await this.get(addonId, key)) !== null;
  }

  /** Key names only, for the settings screen. Never values. */
  async keys(addonId: string): Promise<string[]> {
    if (!SAFE_SEGMENT.test(addonId))
      throw new Error('Addon id is invalid for secret storage.');
    const prefix = `${ADDON_SECRET_PREFIX}${addonId}/`;
    return (await this.secure.getAllSecretKeys())
      .filter(key => key.startsWith(prefix))
      .map(key => key.slice(prefix.length));
  }

  async metadata(addonId: string): Promise<SecretMetadata[]> {
    return (await this.keys(addonId)).map(key => ({ key, exists: true }));
  }

  /**
   * Called on uninstall, and only after the user has chosen.
   *
   * A secret is the one thing an uninstall cannot decide on the user's behalf:
   * deleting it destroys a credential they may still need, and keeping it
   * leaves a credential behind on a device they thought they had cleaned.
   */
  async deleteAll(addonId: string): Promise<number> {
    const keys = await this.keys(addonId);
    for (const key of keys)
      await this.secure.removeSecret(this.storageKey(addonId, key));
    return keys.length;
  }

  /**
   * `/` separates the two segments because it is the one character
   * `SAFE_SEGMENT` forbids in both. A dot would be ambiguous: addon ids here
   * are dotted, so addon `a` asking for key `b.c` and addon `a.b` asking for
   * key `c` would address the same Keychain entry, and the separation between
   * two add-ons would be gone in one string.
   */
  private storageKey(addonId: string, key: string): string {
    return `${ADDON_SECRET_PREFIX}${addonId}/${key}`;
  }

  private requireSafe(addonId: string, key: string): void {
    if (!SAFE_SEGMENT.test(addonId))
      throw new Error('Addon id is invalid for secret storage.');
    if (!SAFE_SEGMENT.test(key))
      throw new Error('Addon secret key is invalid.');
  }
}

/** True when this Keychain key belongs to an addon and must never be exported. */
export function isAddonSecretKey(key: string): boolean {
  return typeof key === 'string' && key.startsWith(ADDON_SECRET_PREFIX);
}

export const addonSecretStore = new AddonSecretStore();

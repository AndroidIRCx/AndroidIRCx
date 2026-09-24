/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ADDON_CAPABILITIES, type AddonCapability } from './AddonManifest';
import { ADDON_CAPABILITY_DEFINITIONS } from './AddonCapabilities';

const STORAGE_KEY = '@AndroidIRCX:addonPermissionGrants:v1';
const knownCapabilities = new Set<string>(ADDON_CAPABILITIES);

export class AddonPermissionDeniedError extends Error {
  readonly code = 'ADDON_PERMISSION_DENIED';

  constructor(
    readonly addonId: string,
    readonly capability: string,
  ) {
    super(`Addon ${addonId} is not allowed to use ${capability}.`);
    this.name = 'AddonPermissionDeniedError';
  }
}

const normalize = (values: readonly string[]): AddonCapability[] =>
  [...new Set(values)]
    .filter((value): value is AddonCapability => knownCapabilities.has(value))
    .sort();

export class AddonPermissionService {
  private persistent = new Map<string, AddonCapability[]>();
  private session = new Map<string, Set<AddonCapability>>();
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as unknown) : {};
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        Object.entries(parsed as Record<string, unknown>).forEach(
          ([addonId, grants]) => {
            if (Array.isArray(grants)) {
              const allowed = normalize(
                grants.filter(value => typeof value === 'string'),
              ).filter(
                capability =>
                  ADDON_CAPABILITY_DEFINITIONS[capability]
                    .persistentGrantAllowed,
              );
              if (allowed.length > 0) this.persistent.set(addonId, allowed);
            }
          },
        );
      }
    } catch {
      this.persistent.clear();
    }
    this.initialized = true;
  }

  getEffectiveGrants(
    addonId: string,
    declared: readonly AddonCapability[],
  ): AddonCapability[] {
    const declaredSet = new Set(declared);
    return normalize([
      ...(this.persistent.get(addonId) ?? []),
      ...(this.session.get(addonId) ?? []),
    ]).filter(capability => declaredSet.has(capability));
  }

  isGranted(
    addonId: string,
    declared: readonly AddonCapability[],
    capability: string,
  ): capability is AddonCapability {
    if (!knownCapabilities.has(capability)) return false;
    return this.getEffectiveGrants(addonId, declared).includes(
      capability as AddonCapability,
    );
  }

  requireGrant(
    addonId: string,
    declared: readonly AddonCapability[],
    capability: string,
  ): asserts capability is AddonCapability {
    if (!this.isGranted(addonId, declared, capability))
      throw new AddonPermissionDeniedError(addonId, capability);
  }

  async grant(
    addonId: string,
    declared: readonly AddonCapability[],
    capability: AddonCapability,
    persist: boolean,
  ): Promise<void> {
    if (!declared.includes(capability))
      throw new Error(`Addon did not declare permission: ${capability}.`);
    if (
      persist &&
      !ADDON_CAPABILITY_DEFINITIONS[capability].persistentGrantAllowed
    )
      throw new Error(
        `Permission cannot be granted permanently: ${capability}.`,
      );

    if (persist) {
      this.persistent.set(
        addonId,
        normalize([...(this.persistent.get(addonId) ?? []), capability]),
      );
      await this.save();
      return;
    }
    const grants = this.session.get(addonId) ?? new Set<AddonCapability>();
    grants.add(capability);
    this.session.set(addonId, grants);
  }

  async revoke(addonId: string, capability: AddonCapability): Promise<void> {
    this.session.get(addonId)?.delete(capability);
    const remaining = (this.persistent.get(addonId) ?? []).filter(
      grant => grant !== capability,
    );
    if (remaining.length > 0) this.persistent.set(addonId, remaining);
    else this.persistent.delete(addonId);
    await this.save();
  }

  async revokeAll(addonId: string): Promise<void> {
    this.session.delete(addonId);
    this.persistent.delete(addonId);
    await this.save();
  }

  async reconcileDeclared(
    addonId: string,
    declared: readonly AddonCapability[],
  ): Promise<void> {
    const previousPersistent = this.persistent.get(addonId);
    const previousSession = this.session.get(addonId);
    const allowed = new Set(declared);
    const persistent = (previousPersistent ?? []).filter(capability =>
      allowed.has(capability),
    );
    const session = new Set(
      [...(previousSession ?? [])].filter(capability =>
        allowed.has(capability),
      ),
    );

    if (persistent.length > 0) this.persistent.set(addonId, persistent);
    else this.persistent.delete(addonId);
    if (session.size > 0) this.session.set(addonId, session);
    else this.session.delete(addonId);

    try {
      await this.save();
    } catch (error) {
      if (previousPersistent) this.persistent.set(addonId, previousPersistent);
      else this.persistent.delete(addonId);
      if (previousSession) this.session.set(addonId, previousSession);
      else this.session.delete(addonId);
      throw error;
    }
  }

  clearSession(): void {
    this.session.clear();
  }

  private async save(): Promise<void> {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(Object.fromEntries(this.persistent)),
    );
  }
}

export const addonPermissionService = new AddonPermissionService();

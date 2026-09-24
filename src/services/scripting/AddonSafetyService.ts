/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@AndroidIRCX:addonSafety:v1';
const FAILURE_LIMIT = 3;

export interface DisabledAddon {
  reason: 'boot-crash' | 'repeated-failure' | 'user-disabled';
  disabledAt: number;
}

export interface AddonSafetySnapshot {
  safeMode: boolean;
  bootPending: boolean;
  startupAddonId?: string;
  disabled: ReadonlyMap<string, DisabledAddon>;
  failures: ReadonlyMap<string, number>;
}

interface StoredState {
  safeMode: boolean;
  bootPending: boolean;
  startupAddonId?: string;
  disabled: Array<[string, DisabledAddon]>;
  failures: Array<[string, number]>;
}

export class AddonSafetyService {
  private safeMode = false;
  private bootPending = false;
  private startupAddonId?: string;
  private disabled = new Map<string, DisabledAddon>();
  private failures = new Map<string, number>();
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) this.restore(JSON.parse(raw) as unknown);
    } catch {
      this.safeMode = true;
    }
    this.initialized = true;
  }

  async beginStartup(): Promise<AddonSafetySnapshot> {
    await this.initialize();
    if (this.bootPending) {
      this.safeMode = true;
      if (this.startupAddonId) {
        this.disabled.set(this.startupAddonId, {
          reason: 'boot-crash',
          disabledAt: Date.now(),
        });
      }
    }
    this.bootPending = true;
    this.startupAddonId = undefined;
    await this.saveFailClosed();
    return this.getSnapshot();
  }

  async completeStartup(): Promise<void> {
    this.bootPending = false;
    this.startupAddonId = undefined;
    await this.saveFailClosed();
  }

  async beginAddonStartup(addonId: string): Promise<boolean> {
    if (!this.shouldLoadThirdPartyAddon(addonId)) return false;
    this.startupAddonId = addonId;
    await this.saveFailClosed();
    return true;
  }

  async completeAddonStartup(addonId: string): Promise<void> {
    if (this.startupAddonId === addonId) {
      this.startupAddonId = undefined;
      this.failures.delete(addonId);
      await this.saveFailClosed();
    }
  }

  async recordFailure(addonId: string): Promise<boolean> {
    const count = (this.failures.get(addonId) ?? 0) + 1;
    this.failures.set(addonId, count);
    if (count >= FAILURE_LIMIT) {
      this.disabled.set(addonId, {
        reason: 'repeated-failure',
        disabledAt: Date.now(),
      });
    }
    await this.saveFailClosed();
    return this.disabled.has(addonId);
  }

  async disable(addonId: string): Promise<void> {
    this.disabled.set(addonId, {
      reason: 'user-disabled',
      disabledAt: Date.now(),
    });
    await this.saveFailClosed();
  }

  async reenable(addonId: string): Promise<void> {
    this.disabled.delete(addonId);
    this.failures.delete(addonId);
    await this.saveFailClosed();
  }

  async setSafeMode(enabled: boolean): Promise<void> {
    this.safeMode = enabled;
    await this.saveFailClosed();
  }

  shouldLoadThirdPartyAddon(addonId: string): boolean {
    return !this.safeMode && !this.disabled.has(addonId);
  }

  getSnapshot(): AddonSafetySnapshot {
    return {
      safeMode: this.safeMode,
      bootPending: this.bootPending,
      startupAddonId: this.startupAddonId,
      disabled: new Map(this.disabled),
      failures: new Map(this.failures),
    };
  }

  private restore(value: unknown): void {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    const state = value as Partial<StoredState>;
    this.safeMode = state.safeMode === true;
    this.bootPending = state.bootPending === true;
    this.startupAddonId =
      typeof state.startupAddonId === 'string'
        ? state.startupAddonId
        : undefined;
    this.disabled = new Map(
      Array.isArray(state.disabled)
        ? state.disabled.filter(isValidDisabledEntry)
        : [],
    );
    this.failures = new Map(
      Array.isArray(state.failures)
        ? state.failures.filter(isValidFailureEntry)
        : [],
    );
  }

  private async saveFailClosed(): Promise<void> {
    const state: StoredState = {
      safeMode: this.safeMode,
      bootPending: this.bootPending,
      startupAddonId: this.startupAddonId,
      disabled: [...this.disabled],
      failures: [...this.failures],
    };
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      this.safeMode = true;
      throw new Error('Addon safety state could not be persisted.');
    }
  }
}

const safeId = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-zA-Z0-9._:-]{1,100}$/.test(value);

function isValidDisabledEntry(
  value: unknown,
): value is [string, DisabledAddon] {
  if (!Array.isArray(value) || value.length !== 2 || !safeId(value[0]))
    return false;
  const record = value[1] as DisabledAddon | undefined;
  return (
    !!record &&
    (record.reason === 'boot-crash' ||
      record.reason === 'repeated-failure' ||
      record.reason === 'user-disabled') &&
    Number.isFinite(record.disabledAt)
  );
}

function isValidFailureEntry(value: unknown): value is [string, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    safeId(value[0]) &&
    Number.isSafeInteger(value[1]) &&
    value[1] >= 0 &&
    value[1] <= FAILURE_LIMIT
  );
}

export const addonSafetyService = new AddonSafetyService();

/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ADDON_CAPABILITIES, type AddonCapability } from './AddonManifest';

const STORAGE_KEY = '@AndroidIRCX:addonAudit:v1';
const MAX_ENTRIES = 500;
const SAFE_TOKEN = /^[a-zA-Z0-9._:-]{1,80}$/;
const KNOWN_CAPABILITIES = new Set<string>(ADDON_CAPABILITIES);
const AUDIT_TARGETS: ReadonlySet<string> = new Set([
  'irc-network',
  'irc-channel',
  'irc-user',
  'history',
  'tab',
  'theme',
  'addon-storage',
  'addon-secrets',
  'public-network',
  'private-network',
  'user-selected-file',
  'notification',
  'clipboard',
  'ai-provider',
]);

export type AddonAuditResult = 'allowed' | 'denied' | 'failed';
export type AddonAuditTarget =
  | 'irc-network'
  | 'irc-channel'
  | 'irc-user'
  | 'history'
  | 'tab'
  | 'theme'
  | 'addon-storage'
  | 'addon-secrets'
  | 'public-network'
  | 'private-network'
  | 'user-selected-file'
  | 'notification'
  | 'clipboard'
  | 'ai-provider';

export interface AddonAuditEntry {
  id: string;
  timestamp: number;
  addonId: string;
  capability: AddonCapability;
  action: string;
  target: AddonAuditTarget;
  result: AddonAuditResult;
}

export class AddonAuditService {
  private entries: AddonAuditEntry[] = [];
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      this.entries = Array.isArray(parsed)
        ? parsed.filter(isAuditEntry).slice(-MAX_ENTRIES)
        : [];
    } catch {
      this.entries = [];
    }
    this.initialized = true;
  }

  async record(
    entry: Omit<AddonAuditEntry, 'id' | 'timestamp'>,
  ): Promise<void> {
    if (!SAFE_TOKEN.test(entry.addonId) || !SAFE_TOKEN.test(entry.action))
      return;
    this.entries.push({
      ...entry,
      id: `audit-${Date.now()}-${this.entries.length}`,
      timestamp: Date.now(),
    });
    this.entries = this.entries.slice(-MAX_ENTRIES);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.entries));
    } catch {
      // Auditing must never interrupt IRC processing or a permission denial.
    }
  }

  list(addonId?: string): AddonAuditEntry[] {
    return this.entries
      .filter(entry => addonId === undefined || entry.addonId === addonId)
      .map(entry => ({ ...entry }));
  }

  async clear(addonId?: string): Promise<void> {
    this.entries = addonId
      ? this.entries.filter(entry => entry.addonId !== addonId)
      : [];
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.entries));
    } catch {
      // Keep the in-memory privacy action effective even if storage is failing.
    }
  }
}

function isAuditEntry(value: unknown): value is AddonAuditEntry {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const entry = value as Partial<AddonAuditEntry>;
  return (
    typeof entry.id === 'string' &&
    typeof entry.timestamp === 'number' &&
    typeof entry.addonId === 'string' &&
    SAFE_TOKEN.test(entry.addonId) &&
    typeof entry.capability === 'string' &&
    KNOWN_CAPABILITIES.has(entry.capability) &&
    typeof entry.action === 'string' &&
    SAFE_TOKEN.test(entry.action) &&
    typeof entry.target === 'string' &&
    AUDIT_TARGETS.has(entry.target) &&
    (entry.result === 'allowed' ||
      entry.result === 'denied' ||
      entry.result === 'failed')
  );
}

export const addonAuditService = new AddonAuditService();

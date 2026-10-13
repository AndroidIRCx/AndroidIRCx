/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { ScriptConfig } from '../services/ScriptingService';
import { compareStrings } from './localeSafe';

export type ScriptSortOrder = 'enabled' | 'name' | 'slowest';

export const SCRIPT_SORT_ORDERS: ScriptSortOrder[] = [
  'enabled',
  'name',
  'slowest',
];

export const isScriptSortOrder = (value: unknown): value is ScriptSortOrder =>
  SCRIPT_SORT_ORDERS.includes(value as ScriptSortOrder);

const byName = (a: ScriptConfig, b: ScriptConfig) =>
  compareStrings(a.name.toLowerCase(), b.name.toLowerCase()) ||
  compareStrings(a.id, b.id);

/**
 * Order the installed scripts for the list.
 * - enabled: running scripts first, so the ones to switch off are on top
 * - name: A-Z
 * - slowest: most time spent in hooks this session first (costMs by id)
 */
export const sortScripts = (
  scripts: ScriptConfig[],
  order: ScriptSortOrder,
  costMs: ReadonlyMap<string, number> = new Map(),
): ScriptConfig[] => {
  const sorted = [...scripts];
  if (order === 'name') return sorted.sort(byName);
  if (order === 'slowest') {
    return sorted.sort(
      (a, b) =>
        (costMs.get(b.id) ?? 0) - (costMs.get(a.id) ?? 0) ||
        Number(b.enabled) - Number(a.enabled) ||
        byName(a, b),
    );
  }
  return sorted.sort(
    (a, b) => Number(b.enabled) - Number(a.enabled) || byName(a, b),
  );
};

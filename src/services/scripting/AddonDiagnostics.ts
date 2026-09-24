/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * One place to answer "what has this addon actually been doing".
 *
 * The counters already existed — in the audit trail, the raw middleware, the
 * table store — but nowhere that could answer the question a user asks when an
 * addon misbehaves: which one, how often, and how much is it costing me.
 *
 * Everything here is in memory and bounded. Nothing is persisted, because a
 * diagnostic that survives a restart invites being treated as a record, and
 * these are counters, not evidence.
 */

export const MAX_RECENT_ERRORS = 20;
/** Rolling window for the "recent" rates the manager shows. */
export const RATE_WINDOW_MS = 60_000;

export type CounterKind =
  | 'events'
  | 'timeouts'
  | 'errors'
  | 'ircSends'
  | 'networkCalls'
  | 'fileWrites'
  | 'uiRegistrations';

export interface AddonCounters {
  events: number;
  timeouts: number;
  errors: number;
  ircSends: number;
  networkCalls: number;
  fileWrites: number;
  uiRegistrations: number;
  /** Total time spent inside this addon's hooks, in milliseconds. */
  executionMs: number;
  /** The slowest single hook seen, which is what a freeze report needs. */
  slowestMs: number;
  storageBytes: number;
}

export interface AddonErrorRecord {
  at: number;
  hook: string;
  /** The message only. Stack traces carry file paths and are not kept. */
  message: string;
}

export interface AddonHealth {
  addonId: string;
  counters: AddonCounters;
  recentErrors: AddonErrorRecord[];
  /** Events in the last minute, so a runaway addon is visible as it happens. */
  eventsPerMinute: number;
  lastActiveAt?: number;
}

const emptyCounters = (): AddonCounters => ({
  events: 0,
  timeouts: 0,
  errors: 0,
  ircSends: 0,
  networkCalls: 0,
  fileWrites: 0,
  uiRegistrations: 0,
  executionMs: 0,
  slowestMs: 0,
  storageBytes: 0,
});

interface Record_ {
  counters: AddonCounters;
  errors: AddonErrorRecord[];
  recentEvents: number[];
  lastActiveAt?: number;
}

export class AddonDiagnostics {
  private byAddon = new Map<string, Record_>();

  count(
    addonId: string,
    kind: CounterKind,
    by = 1,
    at: number = Date.now(),
  ): void {
    const record = this.record(addonId);
    record.counters[kind] += by;
    record.lastActiveAt = at;
    if (kind === 'events') {
      record.recentEvents = record.recentEvents.filter(
        seen => at - seen < RATE_WINDOW_MS,
      );
      record.recentEvents.push(at);
    }
  }

  /** Time spent in one hook. `slowestMs` is what a freeze report needs. */
  recordExecution(addonId: string, durationMs: number): void {
    if (!Number.isFinite(durationMs) || durationMs < 0) return;
    const record = this.record(addonId);
    record.counters.executionMs += durationMs;
    record.counters.slowestMs = Math.max(record.counters.slowestMs, durationMs);
  }

  /**
   * Record a failure.
   *
   * The message is kept and the stack is not: a stack trace carries absolute
   * file paths, and this text ends up in an export the user may send to
   * somebody. The message alone is what identifies the failure anyway.
   */
  recordError(
    addonId: string,
    hook: string,
    error: unknown,
    at: number = Date.now(),
  ): void {
    const record = this.record(addonId);
    record.counters.errors += 1;
    record.lastActiveAt = at;
    record.errors.push({
      at,
      hook: String(hook).slice(0, 80),
      message: String(
        (error as Error)?.message ?? error ?? 'unknown error',
      ).slice(0, 200),
    });
    record.errors = record.errors.slice(-MAX_RECENT_ERRORS);
  }

  setStorageBytes(addonId: string, bytes: number): void {
    if (!Number.isFinite(bytes) || bytes < 0) return;
    this.record(addonId).counters.storageBytes = bytes;
  }

  health(addonId: string, at: number = Date.now()): AddonHealth {
    const record = this.record(addonId);
    return {
      addonId,
      counters: { ...record.counters },
      recentErrors: record.errors.map(entry => ({ ...entry })),
      eventsPerMinute: record.recentEvents.filter(
        seen => at - seen < RATE_WINDOW_MS,
      ).length,
      lastActiveAt: record.lastActiveAt,
    };
  }

  all(at: number = Date.now()): AddonHealth[] {
    return [...this.byAddon.keys()].map(addonId => this.health(addonId, at));
  }

  /**
   * A report the user can send somewhere.
   *
   * Counters and error messages only. No channel names, nicks, hostmasks, URLs,
   * file paths or message text passes through this class at all, so the export
   * cannot leak them however it is later extended.
   */
  export(addonId: string, packageChecksum?: string): string {
    const health = this.health(addonId);
    return JSON.stringify(
      {
        format: 'androidircx.addon-diagnostics',
        formatVersion: 1,
        addonId,
        packageChecksum,
        generatedAt: Date.now(),
        counters: health.counters,
        eventsPerMinute: health.eventsPerMinute,
        errors: health.recentErrors,
      },
      null,
      2,
    );
  }

  clear(addonId: string): void {
    this.byAddon.delete(addonId);
  }

  resetForTests(): void {
    this.byAddon.clear();
  }

  private record(addonId: string): Record_ {
    let record = this.byAddon.get(addonId);
    if (!record) {
      record = { counters: emptyCounters(), errors: [], recentEvents: [] };
      this.byAddon.set(addonId, record);
    }
    return record;
  }
}

export const addonDiagnostics = new AddonDiagnostics();

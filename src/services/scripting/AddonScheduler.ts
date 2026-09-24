/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Scheduled addon work, with what Android actually permits written into the
 * design rather than discovered later.
 *
 * **Nothing here promises background execution.** Android may doze the process,
 * kill it, or defer a timer indefinitely, and a scheduler that pretends
 * otherwise produces add-ons that silently stop working on exactly the devices
 * their author does not own. A job runs when the app is running and its time
 * has come; a job whose time passed while the app was closed is handled by an
 * explicit missed-run policy the addon chose.
 */

const STORAGE_KEY = '@AndroidIRCX:addonSchedules:v1';

export const MIN_INTERVAL_MS = 30_000;
export const MAX_JOBS_PER_ADDON = 10;
export const MAX_JOBS_TOTAL = 50;

export type ScheduleKind =
  /** Once, after a delay. */
  | 'once'
  /** Repeatedly, no faster than MIN_INTERVAL_MS. */
  | 'interval'
  /** At a wall-clock time, repeating daily. */
  | 'daily'
  /** The next time a network finishes connecting. */
  | 'connect'
  /** The next time the app becomes active. */
  | 'active';

/** What to do about a run whose moment passed while the app was not running. */
export type MissedRunPolicy =
  /** Run it once, now. The default: a reminder late beats a reminder never. */
  | 'run-once'
  /** Forget it and wait for the next scheduled moment. */
  | 'skip';

export interface AddonJob {
  id: string;
  addonId: string;
  kind: ScheduleKind;
  /** Delay or interval in ms for `once`/`interval`. */
  everyMs?: number;
  /** Minutes past midnight, local time, for `daily`. */
  atMinutes?: number;
  /** Absolute time the job is next due, for the time-based kinds. */
  dueAt?: number;
  missedRunPolicy: MissedRunPolicy;
  /** Persistent jobs survive a restart; the rest do not. */
  persistent: boolean;
  lastRunAt?: number;
  suspended: boolean;
}

export interface ScheduleRequest {
  id: string;
  kind: ScheduleKind;
  everyMs?: number;
  atMinutes?: number;
  missedRunPolicy?: MissedRunPolicy;
  persistent?: boolean;
}

const SAFE_ID = /^[a-zA-Z0-9._:-]{1,60}$/;

export class AddonScheduler {
  private jobs = new Map<string, AddonJob>();
  private loaded = false;

  async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      for (const job of JSON.parse(raw ?? '[]') as AddonJob[])
        if (job?.id && job.addonId && job.persistent)
          this.jobs.set(this.key(job.addonId, job.id), { ...job });
    } catch {
      this.jobs.clear();
    }
  }

  async schedule(
    addonId: string,
    request: ScheduleRequest,
    now: number = Date.now(),
  ): Promise<AddonJob> {
    if (!SAFE_ID.test(addonId) || !SAFE_ID.test(request?.id ?? ''))
      throw new Error('Schedule id is invalid.');

    const mine = [...this.jobs.values()].filter(job => job.addonId === addonId);
    const key = this.key(addonId, request.id);
    if (!this.jobs.has(key)) {
      if (mine.length >= MAX_JOBS_PER_ADDON)
        throw new Error('Addon schedule limit exceeded.');
      if (this.jobs.size >= MAX_JOBS_TOTAL)
        throw new Error('Global schedule limit exceeded.');
    }

    const job: AddonJob = {
      id: request.id,
      addonId,
      kind: request.kind,
      // Clamped rather than refused: an addon asking for a one-second timer has
      // misjudged a phone, not done something malicious.
      everyMs:
        request.everyMs !== undefined
          ? Math.max(MIN_INTERVAL_MS, Math.trunc(request.everyMs))
          : undefined,
      atMinutes:
        request.atMinutes !== undefined
          ? Math.min(1439, Math.max(0, Math.trunc(request.atMinutes)))
          : undefined,
      missedRunPolicy: request.missedRunPolicy ?? 'run-once',
      persistent: request.persistent === true,
      suspended: false,
    };
    job.dueAt = this.nextDue(job, now);
    this.jobs.set(key, job);
    await this.persist();
    return { ...job };
  }

  /**
   * The jobs due now, marked as run.
   *
   * `daily` is computed from wall-clock minutes each time rather than by adding
   * 24 hours, so a job stays at the hour the user asked for across a daylight
   * saving change or a manual clock adjustment.
   */
  async due(
    trigger: 'timer' | 'connect' | 'active',
    now: number = Date.now(),
  ): Promise<AddonJob[]> {
    const fired: AddonJob[] = [];
    for (const job of this.jobs.values()) {
      if (job.suspended) continue;
      if (!this.matches(job, trigger, now)) continue;

      if (
        job.dueAt !== undefined &&
        job.lastRunAt === undefined &&
        now - job.dueAt > 0 &&
        job.missedRunPolicy === 'skip' &&
        now - job.dueAt > (job.everyMs ?? 0) + MIN_INTERVAL_MS
      ) {
        // Missed while the app was closed and the addon asked us to skip it.
        job.dueAt = this.nextDue(job, now);
        continue;
      }

      job.lastRunAt = now;
      fired.push({ ...job });
      if (job.kind === 'once') this.jobs.delete(this.key(job.addonId, job.id));
      else job.dueAt = this.nextDue(job, now);
    }
    if (fired.length) await this.persist();
    return fired;
  }

  async cancel(addonId: string, id: string): Promise<boolean> {
    const removed = this.jobs.delete(this.key(addonId, id));
    if (removed) await this.persist();
    return removed;
  }

  /** Disabling an addon suspends its jobs; they resume when it is enabled. */
  async suspendAll(addonId: string): Promise<void> {
    for (const job of this.jobs.values())
      if (job.addonId === addonId) job.suspended = true;
    await this.persist();
  }

  async resumeAll(addonId: string, now: number = Date.now()): Promise<void> {
    for (const job of this.jobs.values())
      if (job.addonId === addonId) {
        job.suspended = false;
        job.dueAt = this.nextDue(job, now);
      }
    await this.persist();
  }

  /** Uninstall: gone, persistent or not. */
  async clearAddon(addonId: string): Promise<void> {
    for (const [key, job] of [...this.jobs])
      if (job.addonId === addonId) this.jobs.delete(key);
    await this.persist();
  }

  list(addonId?: string): AddonJob[] {
    return [...this.jobs.values()]
      .filter(job => addonId === undefined || job.addonId === addonId)
      .map(job => ({ ...job }));
  }

  resetForTests(): void {
    this.jobs.clear();
    this.loaded = false;
  }

  private matches(
    job: AddonJob,
    trigger: 'timer' | 'connect' | 'active',
    now: number,
  ): boolean {
    if (job.kind === 'connect') return trigger === 'connect';
    if (job.kind === 'active') return trigger === 'active';
    if (trigger !== 'timer') return false;
    return job.dueAt !== undefined && job.dueAt <= now;
  }

  private nextDue(job: AddonJob, now: number): number | undefined {
    switch (job.kind) {
      case 'once':
      case 'interval':
        return now + (job.everyMs ?? MIN_INTERVAL_MS);
      case 'daily': {
        const date = new Date(now);
        const target = new Date(now);
        target.setHours(
          Math.floor((job.atMinutes ?? 0) / 60),
          (job.atMinutes ?? 0) % 60,
          0,
          0,
        );
        if (target.getTime() <= date.getTime())
          target.setDate(target.getDate() + 1);
        return target.getTime();
      }
      default:
        return undefined;
    }
  }

  private key(addonId: string, id: string): string {
    return `${addonId}/${id}`;
  }

  private async persist(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEY,
        // Only explicitly persistent jobs are written: a one-off timer that
        // outlived the app it belonged to is a surprise, not a feature.
        JSON.stringify([...this.jobs.values()].filter(job => job.persistent)),
      );
    } catch {
      // In-memory schedule stays correct for this session.
    }
  }
}

export const addonScheduler = new AddonScheduler();

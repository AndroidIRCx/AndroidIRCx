/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AddonScheduler,
  MAX_JOBS_PER_ADDON,
  MIN_INTERVAL_MS,
} from '../../src/services/scripting/AddonScheduler';

const ADDON = 'sched.addon';

describe('AddonScheduler', () => {
  let scheduler: AddonScheduler;
  const now = Date.UTC(2026, 8, 24, 12, 0, 0);

  beforeEach(() => {
    (AsyncStorage as any).__reset?.();
    scheduler = new AddonScheduler();
  });

  describe('scheduling', () => {
    it('schedules a one-off and fires it once', async () => {
      await scheduler.schedule(
        ADDON,
        { id: 'j', kind: 'once', everyMs: 60_000 },
        now,
      );

      expect(await scheduler.due('timer', now + 1000)).toHaveLength(0);
      expect(await scheduler.due('timer', now + 61_000)).toHaveLength(1);
      // A one-off is gone after it runs.
      expect(await scheduler.due('timer', now + 200_000)).toHaveLength(0);
      expect(scheduler.list(ADDON)).toHaveLength(0);
    });

    it('repeats an interval job', async () => {
      await scheduler.schedule(
        ADDON,
        { id: 'j', kind: 'interval', everyMs: MIN_INTERVAL_MS },
        now,
      );

      expect(await scheduler.due('timer', now + MIN_INTERVAL_MS)).toHaveLength(
        1,
      );
      expect(
        await scheduler.due('timer', now + MIN_INTERVAL_MS + 1),
      ).toHaveLength(0);
      expect(
        await scheduler.due('timer', now + MIN_INTERVAL_MS * 2 + 10),
      ).toHaveLength(1);
    });

    it('clamps an interval faster than the phone can sustain', async () => {
      // Asking for a one-second timer is a misjudgement, not an attack.
      const job = await scheduler.schedule(
        ADDON,
        { id: 'j', kind: 'interval', everyMs: 1000 },
        now,
      );
      expect(job.everyMs).toBe(MIN_INTERVAL_MS);
    });

    it('fires connect and active jobs only on their own trigger', async () => {
      await scheduler.schedule(ADDON, { id: 'c', kind: 'connect' }, now);
      await scheduler.schedule(ADDON, { id: 'a', kind: 'active' }, now);

      expect(await scheduler.due('timer', now)).toHaveLength(0);
      expect((await scheduler.due('connect', now)).map(j => j.id)).toEqual([
        'c',
      ]);
      expect((await scheduler.due('active', now)).map(j => j.id)).toEqual([
        'a',
      ]);
    });

    it('rejects an invalid id', async () => {
      await expect(
        scheduler.schedule(ADDON, { id: 'bad id', kind: 'once' }, now),
      ).rejects.toThrow(/invalid/i);
      await expect(
        scheduler.schedule('bad addon', { id: 'j', kind: 'once' }, now),
      ).rejects.toThrow(/invalid/i);
    });

    it('bounds jobs per addon, but lets one be replaced', async () => {
      for (let index = 0; index < MAX_JOBS_PER_ADDON; index += 1)
        await scheduler.schedule(
          ADDON,
          { id: `j${index}`, kind: 'connect' },
          now,
        );

      await expect(
        scheduler.schedule(ADDON, { id: 'overflow', kind: 'connect' }, now),
      ).rejects.toThrow(/limit/i);
      await expect(
        scheduler.schedule(ADDON, { id: 'j0', kind: 'active' }, now),
      ).resolves.toBeTruthy();
    });
  });

  describe('daily jobs', () => {
    it('computes the next occurrence from wall-clock minutes', async () => {
      const at = new Date(now);
      const minutes = at.getHours() * 60 + at.getMinutes() + 30;
      const job = await scheduler.schedule(
        ADDON,
        { id: 'd', kind: 'daily', atMinutes: minutes },
        now,
      );

      expect(job.dueAt).toBe(now + 30 * 60_000);
    });

    it('rolls to tomorrow when the time has already passed today', async () => {
      const at = new Date(now);
      const minutes = at.getHours() * 60 + at.getMinutes() - 30;
      const job = await scheduler.schedule(
        ADDON,
        { id: 'd', kind: 'daily', atMinutes: minutes },
        now,
      );

      expect(job.dueAt).toBeGreaterThan(now);
      expect(job.dueAt! - now).toBeGreaterThan(23 * 3600_000);
    });

    it('stays at the requested hour rather than adding 24 hours', async () => {
      // Recomputed from wall-clock each time, so a daylight saving change or a
      // manual clock adjustment does not drift the job off its hour.
      const at = new Date(now);
      const minutes = at.getHours() * 60 + at.getMinutes() + 1;
      await scheduler.schedule(
        ADDON,
        { id: 'd', kind: 'daily', atMinutes: minutes },
        now,
      );
      await scheduler.due('timer', now + 61_000);

      const next = scheduler.list(ADDON)[0];
      const nextDate = new Date(next.dueAt!);
      expect(nextDate.getHours() * 60 + nextDate.getMinutes()).toBe(minutes);
    });

    it('clamps an out-of-range time instead of producing a bad date', async () => {
      const job = await scheduler.schedule(
        ADDON,
        { id: 'd', kind: 'daily', atMinutes: 9999 },
        now,
      );
      expect(job.atMinutes).toBe(1439);
    });
  });

  describe('suspend, cancel and uninstall', () => {
    it('suspends and resumes an addon jobs', async () => {
      await scheduler.schedule(
        ADDON,
        { id: 'j', kind: 'interval', everyMs: MIN_INTERVAL_MS },
        now,
      );

      await scheduler.suspendAll(ADDON);
      expect(
        await scheduler.due('timer', now + MIN_INTERVAL_MS * 5),
      ).toHaveLength(0);

      await scheduler.resumeAll(ADDON, now + MIN_INTERVAL_MS * 5);
      expect(
        await scheduler.due('timer', now + MIN_INTERVAL_MS * 7),
      ).toHaveLength(1);
    });

    it('cancels one job and clears an addon entirely', async () => {
      await scheduler.schedule(ADDON, { id: 'a', kind: 'connect' }, now);
      await scheduler.schedule(ADDON, { id: 'b', kind: 'connect' }, now);

      expect(await scheduler.cancel(ADDON, 'a')).toBe(true);
      expect(await scheduler.cancel(ADDON, 'a')).toBe(false);
      expect(scheduler.list(ADDON)).toHaveLength(1);

      await scheduler.clearAddon(ADDON);
      expect(scheduler.list(ADDON)).toHaveLength(0);
    });

    it('leaves another addon jobs alone', async () => {
      await scheduler.schedule(ADDON, { id: 'j', kind: 'connect' }, now);
      await scheduler.schedule(
        'other.addon',
        { id: 'j', kind: 'connect' },
        now,
      );

      await scheduler.clearAddon(ADDON);
      expect(scheduler.list('other.addon')).toHaveLength(1);
    });
  });

  describe('persistence', () => {
    it('restores only explicitly persistent jobs', async () => {
      await scheduler.schedule(
        ADDON,
        {
          id: 'keeps',
          kind: 'interval',
          everyMs: MIN_INTERVAL_MS,
          persistent: true,
        },
        now,
      );
      await scheduler.schedule(
        ADDON,
        { id: 'forgets', kind: 'interval', everyMs: MIN_INTERVAL_MS },
        now,
      );

      const reloaded = new AddonScheduler();
      await reloaded.load();

      // A one-off timer that outlived the app it belonged to is a surprise.
      expect(reloaded.list(ADDON).map(job => job.id)).toEqual(['keeps']);
    });

    it('starts empty when stored schedules are corrupt', async () => {
      await AsyncStorage.setItem('@AndroidIRCX:addonSchedules:v1', 'not json');
      const reloaded = new AddonScheduler();
      await reloaded.load();
      expect(reloaded.list()).toEqual([]);
    });
  });

  describe('missed runs', () => {
    it('runs a missed job once by default', async () => {
      await scheduler.schedule(
        ADDON,
        { id: 'j', kind: 'interval', everyMs: MIN_INTERVAL_MS },
        now,
      );
      // A reminder late beats a reminder never.
      const fired = await scheduler.due('timer', now + 86_400_000);
      expect(fired).toHaveLength(1);
    });

    it('skips a long-missed job when the addon asked to skip', async () => {
      await scheduler.schedule(
        ADDON,
        {
          id: 'j',
          kind: 'interval',
          everyMs: MIN_INTERVAL_MS,
          missedRunPolicy: 'skip',
        },
        now,
      );

      expect(await scheduler.due('timer', now + 86_400_000)).toHaveLength(0);
      // It is not lost - it is rescheduled from now.
      expect(scheduler.list(ADDON)[0].dueAt).toBeGreaterThan(now + 86_400_000);
    });
  });
});

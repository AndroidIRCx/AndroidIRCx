/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import { addonGroupService, type AddonGroupService } from './AddonGroupService';
import { addonUIRegistry, type AddonUIRegistry } from './AddonUIRegistry';
import { addonScheduler, type AddonScheduler } from './AddonScheduler';

/**
 * Connects "the user switched a feature group off" to the things that group
 * had registered.
 *
 * It lives in its own file so `AddonGroupService` stays a state store with no
 * opinion about what a group owns — and so this wiring can be installed once,
 * at startup, rather than being re-derived by each screen that happens to show
 * a group switch.
 */

export interface GroupWiringDependencies {
  groups?: AddonGroupService;
  ui?: AddonUIRegistry;
  scheduler?: AddonScheduler;
}

export function installAddonGroupWiring(
  dependencies: GroupWiringDependencies = {},
): () => void {
  const groups = dependencies.groups ?? addonGroupService;
  const ui = dependencies.ui ?? addonUIRegistry;
  const scheduler = dependencies.scheduler ?? addonScheduler;

  return groups.onTeardown((addonId, groupId) => {
    // Only what this group registered. Clearing the whole addon would take the
    // rest of it down with the one feature the user turned off.
    ui.clearGroup(addonId, groupId);

    // Scheduled work is not tagged by group, so a job id prefixed with the
    // group is the convention that makes it removable. Anything not following
    // it keeps running, which is the safe direction to be wrong in: a job that
    // outlives its group is visible in the manager, one silently cancelled is
    // not.
    for (const job of scheduler.list(addonId))
      if (job.id === groupId || job.id.startsWith(`${groupId}.`))
        scheduler.cancel(addonId, job.id).catch(() => {});
  });
}

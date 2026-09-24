/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  AddonCapability,
  AddonGroupDeclaration,
  AddonManifest,
} from './AddonManifest';

/**
 * Optional feature groups, so an addon does not have to be all-or-nothing.
 *
 * mIRC scripts solve this by shipping several files and telling people which
 * to load. A group is the same idea made visible: the user sees what each part
 * does and what it needs, and turning one off removes its registrations and
 * stops its permissions being asked for at all.
 *
 * A group that needs a permission **never starts on**, whatever the manifest
 * says. An addon deciding on the user's behalf that its `irc.send` feature
 * should be active on first run is the thing this exists to prevent.
 */

const STORAGE_KEY = '@AndroidIRCX:addonGroups:v1';

export interface GroupState {
  id: string;
  name: string;
  description: string;
  permissions: AddonCapability[];
  enabled: boolean;
  /** True when this group starting off was the platform's decision, not the manifest's. */
  forcedOffAtInstall: boolean;
}

/** Called when a group goes off, so its contributions go with it. */
export type GroupTeardown = (addonId: string, groupId: string) => void;

export class AddonGroupService {
  private enabled = new Map<string, Set<string>>();
  private teardowns: GroupTeardown[] = [];
  private loaded = false;

  async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const stored = JSON.parse(raw ?? '{}') as Record<string, string[]>;
      for (const [addonId, groups] of Object.entries(stored))
        if (Array.isArray(groups))
          this.enabled.set(addonId, new Set(groups.filter(isSafeId)));
    } catch {
      // Unreadable state means every optional group is off, which is the same
      // answer a fresh install gives.
      this.enabled.clear();
    }
  }

  onTeardown(teardown: GroupTeardown): () => void {
    this.teardowns.push(teardown);
    return () => {
      this.teardowns = this.teardowns.filter(entry => entry !== teardown);
    };
  }

  /**
   * Apply an addon's declared defaults on first install.
   *
   * Only groups that need no permission may start on. Anything else waits to
   * be turned on deliberately, and `forcedOffAtInstall` records that the
   * platform overrode the manifest so the UI can say so.
   */
  async applyDefaults(manifest: AddonManifest): Promise<void> {
    await this.load();
    if (this.enabled.has(manifest.id)) return;
    const on = new Set<string>();
    for (const group of manifest.groups ?? [])
      if (group.enabledByDefault === true && group.permissions.length === 0)
        on.add(group.id);
    this.enabled.set(manifest.id, on);
    await this.persist();
  }

  isEnabled(addonId: string, groupId: string): boolean {
    return this.enabled.get(addonId)?.has(groupId) === true;
  }

  async setEnabled(
    addonId: string,
    groupId: string,
    enabled: boolean,
  ): Promise<void> {
    const groups = this.enabled.get(addonId) ?? new Set<string>();
    if (enabled) groups.add(groupId);
    else groups.delete(groupId);
    this.enabled.set(addonId, groups);
    await this.persist();

    if (!enabled)
      for (const teardown of [...this.teardowns]) {
        try {
          teardown(addonId, groupId);
        } catch {
          // One listener failing must not leave the rest of the group's
          // contributions in place.
        }
      }
  }

  /**
   * The permissions actually in force: the addon's own, minus any that exist
   * only to serve a group that is currently off.
   *
   * A permission listed both at the top level and inside a group stays
   * required — the group is not the only thing that wanted it.
   */
  effectivePermissions(manifest: AddonManifest): AddonCapability[] {
    const groups = manifest.groups ?? [];
    if (groups.length === 0) return [...manifest.permissions];

    const neededByOffGroups = new Set<AddonCapability>();
    const neededByOnGroups = new Set<AddonCapability>();
    for (const group of groups) {
      const target = this.isEnabled(manifest.id, group.id)
        ? neededByOnGroups
        : neededByOffGroups;
      for (const capability of group.permissions) target.add(capability);
    }

    return manifest.permissions.filter(capability => {
      if (!neededByOffGroups.has(capability)) return true;
      // Declared for a group that is off: keep it only if something that is on
      // also needs it.
      return neededByOnGroups.has(capability);
    });
  }

  /** What the settings screen shows for one addon. */
  describe(manifest: AddonManifest): GroupState[] {
    return (manifest.groups ?? []).map((group: AddonGroupDeclaration) => ({
      id: group.id,
      name: group.name,
      description: group.description,
      permissions: [...group.permissions],
      enabled: this.isEnabled(manifest.id, group.id),
      forcedOffAtInstall:
        group.enabledByDefault === true && group.permissions.length > 0,
    }));
  }

  async clearAddon(addonId: string): Promise<void> {
    this.enabled.delete(addonId);
    await this.persist();
  }

  resetForTests(): void {
    this.enabled.clear();
    this.teardowns = [];
    this.loaded = false;
  }

  private async persist(): Promise<void> {
    const stored: Record<string, string[]> = {};
    for (const [addonId, groups] of this.enabled) stored[addonId] = [...groups];
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch {
      // The in-session choice still holds; it will not survive a restart.
    }
  }
}

const isSafeId = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(value);

export const addonGroupService = new AddonGroupService();

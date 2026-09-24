/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export const ADDON_API_VERSION = 1;

export const ADDON_CAPABILITIES = [
  'irc.read',
  'irc.send',
  'irc.moderate',
  'irc.raw.observe',
  'irc.raw.modify',
  'history.read',
  'tabs.read',
  'tabs.write',
  'ui.extend',
  'theme.read',
  'theme.write',
  'storage',
  'secrets',
  'network',
  'network.private',
  'files.userSelected',
  'notifications',
  'clipboard.write',
  'ai',
] as const;

export type AddonCapability = (typeof ADDON_CAPABILITIES)[number];

export interface AddonManifest {
  id: string;
  name: string;
  author: string;
  version: string;
  description: string;
  license: string;
  apiVersion: number;
  minAppVersion: string;
  entry: string;
  permissions: AddonCapability[];
  homepage?: string;
  icon?: string;
  assets?: string[];
  /**
   * Optional feature groups. A group is a slice of the addon the user can turn
   * off without uninstalling it, and its permissions are only requested while
   * it is on - so an addon can ship an optional feature that needs `irc.send`
   * without every user having to grant that to use the rest.
   */
  groups?: AddonGroupDeclaration[];
}

export interface AddonGroupDeclaration {
  id: string;
  name: string;
  description: string;
  /** Must be a subset of the addon's own `permissions`. */
  permissions: AddonCapability[];
  /** Whether the group starts on. Anything needing a permission starts off. */
  enabledByDefault?: boolean;
}

export type AddonManifestValidation =
  { ok: true; manifest: AddonManifest } | { ok: false; errors: string[] };

const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const ADDON_ID = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const capabilitySet = new Set<string>(ADDON_CAPABILITIES);
const MANIFEST_KEYS = new Set([
  'id',
  'name',
  'author',
  'version',
  'description',
  'license',
  'apiVersion',
  'minAppVersion',
  'entry',
  'permissions',
  'homepage',
  'icon',
  'assets',
  'groups',
]);

const GROUP_ID = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const MAX_GROUPS = 12;

export const isSafeAddonPath = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.length === 0 || value.length > 240)
    return false;
  const normalized = value.replace(/\\/g, '/');
  if (
    normalized.startsWith('/') ||
    /^[A-Za-z]:/.test(normalized) ||
    normalized.includes('\0')
  )
    return false;
  const parts = normalized.split('/');
  return parts.every(part => part.length > 0 && part !== '.' && part !== '..');
};

export function validateAddonManifest(input: unknown): AddonManifestValidation {
  const errors: string[] = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, errors: ['Manifest must be a JSON object.'] };
  }
  const value = input as Record<string, unknown>;
  Object.keys(value).forEach(key => {
    if (!MANIFEST_KEYS.has(key)) errors.push(`Unknown manifest field: ${key}.`);
  });
  const text = (key: string, max: number, pattern?: RegExp) => {
    const candidate = value[key];
    if (
      typeof candidate !== 'string' ||
      candidate.trim() !== candidate ||
      candidate.length === 0 ||
      candidate.length > max ||
      (pattern && !pattern.test(candidate))
    )
      errors.push(`Invalid ${key}.`);
  };

  text('id', 100, ADDON_ID);
  text('name', 100);
  text('author', 100);
  text('version', 50, SEMVER);
  text('description', 1000);
  text('license', 100);
  text('minAppVersion', 50, SEMVER);
  if (value.apiVersion !== ADDON_API_VERSION)
    errors.push(`Unsupported apiVersion: ${String(value.apiVersion)}.`);
  if (!isSafeAddonPath(value.entry) || !value.entry.endsWith('.js'))
    errors.push('Invalid entry path.');

  if (!Array.isArray(value.permissions)) {
    errors.push('Permissions must be an array.');
  } else {
    const seen = new Set<string>();
    value.permissions.forEach(permission => {
      if (typeof permission !== 'string' || !capabilitySet.has(permission))
        errors.push(`Unknown permission: ${String(permission)}.`);
      else if (seen.has(permission))
        errors.push(`Duplicate permission: ${permission}.`);
      seen.add(String(permission));
    });
  }

  if (value.homepage !== undefined) {
    try {
      if (typeof value.homepage !== 'string')
        throw new Error('String required');
      const url = new URL(value.homepage);
      if (url.protocol !== 'https:') throw new Error('HTTPS required');
    } catch {
      errors.push('Invalid homepage.');
    }
  }
  if (value.icon !== undefined && !isSafeAddonPath(value.icon))
    errors.push('Invalid icon path.');
  if (value.assets !== undefined) {
    if (
      !Array.isArray(value.assets) ||
      value.assets.some(asset => !isSafeAddonPath(asset)) ||
      new Set(
        value.assets.map(asset => String(asset).toLocaleLowerCase('en-US')),
      ).size !== value.assets.length
    )
      errors.push('Invalid assets.');
  }

  if (value.groups !== undefined) {
    const groups = value.groups as unknown;
    if (!Array.isArray(groups) || groups.length > MAX_GROUPS) {
      errors.push('Invalid groups.');
    } else {
      const declared = new Set(
        Array.isArray(value.permissions) ? (value.permissions as string[]) : [],
      );
      const seen = new Set<string>();
      for (const raw of groups) {
        const group = raw as Partial<AddonGroupDeclaration>;
        if (
          typeof group?.id !== 'string' ||
          !GROUP_ID.test(group.id) ||
          seen.has(group.id) ||
          typeof group.name !== 'string' ||
          group.name.trim().length === 0 ||
          group.name.length > 60 ||
          typeof group.description !== 'string' ||
          group.description.length > 200 ||
          !Array.isArray(group.permissions)
        ) {
          errors.push('Invalid groups.');
          break;
        }
        seen.add(group.id);
        // A group cannot widen the addon: its permissions must already be
        // declared at the top level, or install review would have shown the
        // user a shorter list than the addon can actually ask for.
        if (group.permissions.some(capability => !declared.has(capability))) {
          errors.push('Group requests a permission the addon did not declare.');
          break;
        }
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, manifest: value as unknown as AddonManifest };
}

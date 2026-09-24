/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

export const ADDON_DISPLAY_ROLES = [
  'message',
  'notice',
  'error',
  'warning',
  'success',
  'info',
  'accent',
  'muted',
] as const;

export type AddonDisplayRole = (typeof ADDON_DISPLAY_ROLES)[number];

export interface AddonDisplayStyle {
  role?: AddonDisplayRole;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

export interface AddonDisplayRoute {
  kind: 'current' | 'server' | 'channel' | 'query';
  target?: string;
  network?: string;
}

export interface AddonDisplayResult {
  display?: 'show' | 'hide';
  replacement?: string;
  style?: AddonDisplayStyle;
  routeTo?: AddonDisplayRoute;
  stopPropagation?: boolean;
}

const RESULT_KEYS = new Set([
  'display',
  'replacement',
  'style',
  'routeTo',
  'stopPropagation',
  // L1 compatibility accepted while scripts migrate to display: 'hide'.
  'hideDefault',
]);
const STYLE_KEYS = new Set(['role', 'bold', 'italic', 'underline']);
const ROUTE_KEYS = new Set(['kind', 'target', 'network']);
const ROLE_SET = new Set<string>(ADDON_DISPLAY_ROLES);

export function parseAddonDisplayResult(
  resultJson?: string,
): AddonDisplayResult {
  if (!resultJson) return {};
  const parsed = JSON.parse(resultJson) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new Error('Addon display result is invalid.');
  const value = parsed as Record<string, unknown>;
  if (Object.keys(value).some(key => !RESULT_KEYS.has(key)))
    throw new Error('Addon display result has unknown fields.');
  if (
    value.display !== undefined &&
    value.display !== 'show' &&
    value.display !== 'hide'
  )
    throw new Error('Addon display mode is invalid.');
  if (
    value.replacement !== undefined &&
    (typeof value.replacement !== 'string' || value.replacement.length > 4000)
  )
    throw new Error('Addon display replacement is invalid.');
  if (
    value.stopPropagation !== undefined &&
    typeof value.stopPropagation !== 'boolean'
  )
    throw new Error('Addon stopPropagation is invalid.');
  if (value.hideDefault !== undefined && typeof value.hideDefault !== 'boolean')
    throw new Error('Addon hideDefault is invalid.');

  const style = parseStyle(value.style);
  const routeTo = parseRoute(value.routeTo);
  if ((style || routeTo) && typeof value.replacement !== 'string')
    throw new Error(
      'Addon display style and route require a local replacement.',
    );
  return {
    display:
      value.display === 'hide' || value.hideDefault === true
        ? 'hide'
        : value.display === 'show'
          ? 'show'
          : undefined,
    replacement: value.replacement as string | undefined,
    style,
    routeTo,
    stopPropagation: value.stopPropagation === true || undefined,
  };
}

function parseStyle(value: unknown): AddonDisplayStyle | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Addon display style is invalid.');
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => !STYLE_KEYS.has(key)))
    throw new Error('Addon display style has unknown fields.');
  if (input.role !== undefined && !ROLE_SET.has(String(input.role)))
    throw new Error('Addon display role is invalid.');
  for (const key of ['bold', 'italic', 'underline']) {
    if (input[key] !== undefined && typeof input[key] !== 'boolean')
      throw new Error('Addon display style flag is invalid.');
  }
  return {
    role: input.role as AddonDisplayRole | undefined,
    bold: input.bold as boolean | undefined,
    italic: input.italic as boolean | undefined,
    underline: input.underline as boolean | undefined,
  };
}

function parseRoute(value: unknown): AddonDisplayRoute | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Addon display route is invalid.');
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => !ROUTE_KEYS.has(key)))
    throw new Error('Addon display route has unknown fields.');
  if (!['current', 'server', 'channel', 'query'].includes(String(input.kind)))
    throw new Error('Addon display route kind is invalid.');
  for (const key of ['target', 'network']) {
    if (
      input[key] !== undefined &&
      (typeof input[key] !== 'string' ||
        input[key].length === 0 ||
        input[key].length > 200)
    )
      throw new Error('Addon display route target is invalid.');
  }
  if (
    (input.kind === 'channel' || input.kind === 'query') &&
    typeof input.target !== 'string'
  )
    throw new Error('Addon display route target is required.');
  return input as unknown as AddonDisplayRoute;
}

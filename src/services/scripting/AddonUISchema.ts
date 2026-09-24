/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import { ensureReadable } from '../../themes/palette';

/**
 * The declarative vocabulary an addon may use to contribute interface.
 *
 * An addon describes *what* it wants shown; app-owned components decide how.
 * Nothing here can become a React element supplied by the addon, which is the
 * whole point: a panel is data, so theming, font scaling, rotation, tablet
 * layout and accessibility stay the app's problem and keep working when an
 * addon author never thought about them.
 *
 * Validation fails closed. An unknown node kind is an error, not something
 * skipped quietly — an addon written for a newer app must be told its panel
 * will not render rather than showing the user a blank box.
 */

export const MAX_LABEL_CHARS = 60;
export const MAX_TEXT_CHARS = 2000;
export const MAX_MENU_DEPTH = 3;
export const MAX_MENU_ITEMS = 20;
export const MAX_PANEL_NODES = 50;
export const MAX_TABLE_ROWS = 200;
export const MAX_TABLE_COLUMNS = 8;
export const MAX_LIST_ITEMS = 200;
export const MAX_FIELDS = 30;
export const MAX_OPTIONS = 50;

const ID = /^[a-zA-Z0-9._:-]{1,60}$/;

/** Where a menu item may appear. */
export type AddonMenuTarget =
  | 'nick'
  | 'nicks'
  | 'channel'
  | 'query'
  | 'tab'
  | 'message'
  | 'composer'
  | 'app';

export const MENU_TARGETS: readonly AddonMenuTarget[] = [
  'nick',
  'nicks',
  'channel',
  'query',
  'tab',
  'message',
  'composer',
  'app',
];

/**
 * Meaning, not colour. An addon says "this is a warning" and the active theme
 * decides what a warning looks like, so a contribution stays readable on all
 * of the built-in themes rather than only the one its author was using.
 */
export type AddonTone =
  'default' | 'muted' | 'info' | 'success' | 'warning' | 'danger';

export const TONES: readonly AddonTone[] = [
  'default',
  'muted',
  'info',
  'success',
  'warning',
  'danger',
];

/** Icon names the app already ships. An addon cannot supply its own image here. */
export const ALLOWED_ICONS: readonly string[] = [
  'info',
  'warning',
  'error',
  'check',
  'close',
  'star',
  'flag',
  'shield',
  'user',
  'users',
  'message',
  'settings',
  'search',
  'refresh',
  'link',
  'block',
];

export interface AddonMenuItem {
  id: string;
  label: string;
  icon?: string;
  checked?: boolean;
  disabled?: boolean;
  separatorBefore?: boolean;
  submenu?: AddonMenuItem[];
}

export interface AddonMenuContribution {
  id: string;
  target: AddonMenuTarget;
  items: AddonMenuItem[];
}

export type AddonPanelNode =
  | { kind: 'text'; text: string; tone?: AddonTone }
  | {
      kind: 'list';
      items: Array<{ label: string; detail?: string; tone?: AddonTone }>;
    }
  | { kind: 'table'; columns: string[]; rows: string[][] }
  | { kind: 'keyValue'; pairs: Array<{ key: string; value: string }> }
  | {
      kind: 'buttons';
      buttons: Array<{ id: string; label: string; disabled?: boolean }>;
    }
  | { kind: 'progress'; value: number; label?: string }
  | { kind: 'image'; url: string; alt: string };

export type AddonFieldNode =
  | {
      kind: 'text' | 'secureText';
      id: string;
      label: string;
      default?: string;
      required?: boolean;
      maxLength?: number;
    }
  | {
      kind: 'number';
      id: string;
      label: string;
      default?: number;
      min?: number;
      max?: number;
    }
  | { kind: 'toggle'; id: string; label: string; default?: boolean }
  | {
      kind: 'select' | 'multiSelect';
      id: string;
      label: string;
      options: Array<{ value: string; label: string }>;
      default?: string | string[];
    }
  | { kind: 'status'; id: string; label: string; text: string }
  | { kind: 'action'; id: string; label: string };

export interface ValidationResult<T> {
  ok: boolean;
  value?: T;
  errors: string[];
}

// ─────────────────────────────────────────────────────────── primitives ──

/**
 * Characters that change what text *appears* to say without changing what it
 * is: the bidirectional overrides, the zero-width joiners and separators, and
 * the byte-order mark. A label reading "Disable" that renders as "Enable" is
 * not a formatting quirk, it is a way to get a tap the user did not mean to
 * give — and none of them have a legitimate place in an addon's label.
 *
 * Newlines go too: every one of these is a single-line control, and a label
 * containing one breaks the row rather than saying anything.
 */
// eslint-disable-next-line no-control-regex, no-misleading-character-class
const DECEPTIVE = /[\u0000-\u001f\u007f\u061c\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g;

/** Text an addon supplied, with the deceptive characters removed. */
export function sanitizeDisplayText(value: string): string {
  return value.replace(DECEPTIVE, '');
}

const isLabel = (value: unknown, max = MAX_LABEL_CHARS): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= max;

const isId = (value: unknown): value is string =>
  typeof value === 'string' && ID.test(value);

// ──────────────────────────────────────────────────────────────── menus ──

export function validateMenu(
  input: unknown,
): ValidationResult<AddonMenuContribution> {
  const errors: string[] = [];
  const menu = input as Partial<AddonMenuContribution> | null;
  if (!menu || typeof menu !== 'object')
    return { ok: false, errors: ['menu must be an object'] };
  if (!isId(menu.id)) errors.push('menu.id is invalid');
  if (!MENU_TARGETS.includes(menu.target as AddonMenuTarget))
    errors.push(`menu.target must be one of ${MENU_TARGETS.join(', ')}`);

  const items = validateMenuItems(menu.items, 1, errors, 'menu.items');
  return errors.length
    ? { ok: false, errors }
    : {
        ok: true,
        value: {
          id: menu.id as string,
          target: menu.target as AddonMenuTarget,
          items,
        },
        errors: [],
      };
}

function validateMenuItems(
  input: unknown,
  depth: number,
  errors: string[],
  path: string,
): AddonMenuItem[] {
  if (!Array.isArray(input)) {
    errors.push(`${path} must be an array`);
    return [];
  }
  if (input.length === 0) errors.push(`${path} must not be empty`);
  if (input.length > MAX_MENU_ITEMS)
    errors.push(`${path} may hold at most ${MAX_MENU_ITEMS} items`);

  return input.slice(0, MAX_MENU_ITEMS).map((raw, index) => {
    const item = (raw ?? {}) as Partial<AddonMenuItem>;
    const here = `${path}[${index}]`;
    if (!isId(item.id)) errors.push(`${here}.id is invalid`);
    if (!isLabel(item.label)) errors.push(`${here}.label is invalid`);
    if (item.icon !== undefined && !ALLOWED_ICONS.includes(item.icon))
      errors.push(`${here}.icon is not one of the app's icons`);

    let submenu: AddonMenuItem[] | undefined;
    if (item.submenu !== undefined) {
      if (depth >= MAX_MENU_DEPTH)
        errors.push(`${here}.submenu exceeds depth ${MAX_MENU_DEPTH}`);
      else
        submenu = validateMenuItems(
          item.submenu,
          depth + 1,
          errors,
          `${here}.submenu`,
        );
    }

    return {
      id: item.id as string,
      label: sanitizeDisplayText(item.label as string),
      icon: item.icon,
      checked: item.checked === true ? true : undefined,
      disabled: item.disabled === true ? true : undefined,
      separatorBefore: item.separatorBefore === true ? true : undefined,
      submenu,
    };
  });
}

// ─────────────────────────────────────────────────────────────── panels ──

export function validatePanel(
  input: unknown,
): ValidationResult<AddonPanelNode[]> {
  const errors: string[] = [];
  if (!Array.isArray(input))
    return { ok: false, errors: ['panel must be an array of nodes'] };
  if (input.length > MAX_PANEL_NODES)
    errors.push(`panel may hold at most ${MAX_PANEL_NODES} nodes`);

  const nodes = input
    .slice(0, MAX_PANEL_NODES)
    .map((raw, index) => validatePanelNode(raw, errors, `panel[${index}]`))
    .filter((node): node is AddonPanelNode => node !== undefined);

  return errors.length
    ? { ok: false, errors }
    : { ok: true, value: nodes, errors: [] };
}

function validatePanelNode(
  raw: unknown,
  errors: string[],
  path: string,
): AddonPanelNode | undefined {
  const node = (raw ?? {}) as { kind?: unknown };
  switch (node.kind) {
    case 'text': {
      const value = node as Extract<AddonPanelNode, { kind: 'text' }>;
      if (!isLabel(value.text, MAX_TEXT_CHARS))
        errors.push(`${path}.text is invalid`);
      return {
        kind: 'text',
        text: sanitizeDisplayText(value.text),
        tone: tone(value.tone, errors, path),
      };
    }
    case 'list': {
      const value = node as Extract<AddonPanelNode, { kind: 'list' }>;
      if (!Array.isArray(value.items)) {
        errors.push(`${path}.items must be an array`);
        return undefined;
      }
      if (value.items.length > MAX_LIST_ITEMS)
        errors.push(`${path}.items may hold at most ${MAX_LIST_ITEMS} entries`);
      return {
        kind: 'list',
        items: value.items.slice(0, MAX_LIST_ITEMS).map((entry, index) => {
          if (!isLabel(entry?.label))
            errors.push(`${path}.items[${index}].label is invalid`);
          return {
            label: sanitizeDisplayText(String(entry?.label ?? '')),
            detail:
              entry?.detail !== undefined &&
              isLabel(entry.detail, MAX_TEXT_CHARS)
                ? sanitizeDisplayText(entry.detail)
                : undefined,
            tone: tone(entry?.tone, errors, `${path}.items[${index}]`),
          };
        }),
      };
    }
    case 'table': {
      const value = node as Extract<AddonPanelNode, { kind: 'table' }>;
      if (!Array.isArray(value.columns) || value.columns.length === 0)
        errors.push(`${path}.columns must be a non-empty array`);
      else if (value.columns.length > MAX_TABLE_COLUMNS)
        errors.push(`${path}.columns may hold at most ${MAX_TABLE_COLUMNS}`);
      if (!Array.isArray(value.rows)) {
        errors.push(`${path}.rows must be an array`);
        return undefined;
      }
      if (value.rows.length > MAX_TABLE_ROWS)
        errors.push(`${path}.rows may hold at most ${MAX_TABLE_ROWS}`);
      const columns = (value.columns ?? [])
        .slice(0, MAX_TABLE_COLUMNS)
        .map(column => sanitizeDisplayText(String(column ?? '')));
      return {
        kind: 'table',
        columns,
        // Ragged rows are padded rather than rejected: a table that renders
        // short is more useful than an error the user cannot act on.
        rows: value.rows
          .slice(0, MAX_TABLE_ROWS)
          .map(row =>
            columns.map((_column, index) =>
              sanitizeDisplayText(String((row ?? [])[index] ?? '')),
            ),
          ),
      };
    }
    case 'keyValue': {
      const value = node as Extract<AddonPanelNode, { kind: 'keyValue' }>;
      if (!Array.isArray(value.pairs)) {
        errors.push(`${path}.pairs must be an array`);
        return undefined;
      }
      return {
        kind: 'keyValue',
        pairs: value.pairs.slice(0, MAX_LIST_ITEMS).map(pair => ({
          key: sanitizeDisplayText(
            String(pair?.key ?? '').slice(0, MAX_LABEL_CHARS),
          ),
          value: sanitizeDisplayText(
            String(pair?.value ?? '').slice(0, MAX_TEXT_CHARS),
          ),
        })),
      };
    }
    case 'buttons': {
      const value = node as Extract<AddonPanelNode, { kind: 'buttons' }>;
      if (!Array.isArray(value.buttons)) {
        errors.push(`${path}.buttons must be an array`);
        return undefined;
      }
      return {
        kind: 'buttons',
        buttons: value.buttons.slice(0, MAX_MENU_ITEMS).map((button, index) => {
          if (!isId(button?.id))
            errors.push(`${path}.buttons[${index}].id is invalid`);
          if (!isLabel(button?.label))
            errors.push(`${path}.buttons[${index}].label is invalid`);
          return {
            id: button?.id,
            label: sanitizeDisplayText(String(button?.label ?? '')),
            disabled: button?.disabled === true ? true : undefined,
          };
        }),
      };
    }
    case 'progress': {
      const value = node as Extract<AddonPanelNode, { kind: 'progress' }>;
      const raw01 = Number(value.value);
      if (!Number.isFinite(raw01))
        errors.push(`${path}.value must be a number`);
      return {
        kind: 'progress',
        // Clamped rather than refused: a progress bar is decoration, and a bad
        // number should not take the whole panel down with it.
        value: Number.isFinite(raw01) ? Math.min(1, Math.max(0, raw01)) : 0,
        label: isLabel(value.label) ? value.label : undefined,
      };
    }
    case 'image': {
      const value = node as Extract<AddonPanelNode, { kind: 'image' }>;
      if (!isPermittedImageUrl(value.url))
        errors.push(`${path}.url must be an https URL`);
      // Required, not optional: a decorative image with no alt text is a hole
      // in the page for anyone using a screen reader.
      if (!isLabel(value.alt)) errors.push(`${path}.alt is required`);
      return { kind: 'image', url: value.url, alt: value.alt };
    }
    default:
      errors.push(`${path}.kind "${String(node.kind)}" is not a known node`);
      return undefined;
  }
}

function tone(
  value: unknown,
  errors: string[],
  path: string,
): AddonTone | undefined {
  if (value === undefined) return undefined;
  if (!TONES.includes(value as AddonTone)) {
    errors.push(`${path}.tone is not a known tone`);
    return undefined;
  }
  return value as AddonTone;
}

/** Only https, and never a private address — the same rule web access uses. */
export function isPermittedImageUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  const host = url.hostname.toLowerCase();
  return !(
    host === 'localhost' ||
    host.endsWith('.local') ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^169\.254\./.test(host) ||
    host === '::1' ||
    host === '0.0.0.0'
  );
}

// ─────────────────────────────────────────────────────────────── fields ──

export function validateFields(
  input: unknown,
): ValidationResult<AddonFieldNode[]> {
  const errors: string[] = [];
  if (!Array.isArray(input))
    return { ok: false, errors: ['fields must be an array'] };
  if (input.length > MAX_FIELDS)
    errors.push(`fields may hold at most ${MAX_FIELDS}`);

  const seen = new Set<string>();
  const fields = input
    .slice(0, MAX_FIELDS)
    .map((raw, index) => {
      const field = (raw ?? {}) as Partial<AddonFieldNode> & { kind?: string };
      const path = `fields[${index}]`;
      if (!isId(field.id)) errors.push(`${path}.id is invalid`);
      else if (seen.has(field.id)) errors.push(`${path}.id is duplicated`);
      else seen.add(field.id);
      if (!isLabel(field.label)) errors.push(`${path}.label is invalid`);

      switch (field.kind) {
        case 'text':
        case 'secureText':
        case 'number':
        case 'toggle':
        case 'status':
        case 'action':
          return field as AddonFieldNode;
        case 'select':
        case 'multiSelect': {
          const options = (field as { options?: unknown }).options;
          if (!Array.isArray(options) || options.length === 0)
            errors.push(`${path}.options must be a non-empty array`);
          else if (options.length > MAX_OPTIONS)
            errors.push(`${path}.options may hold at most ${MAX_OPTIONS}`);
          return field as AddonFieldNode;
        }
        default:
          errors.push(
            `${path}.kind "${String(field.kind)}" is not a known field`,
          );
          return undefined;
      }
    })
    .filter((field): field is AddonFieldNode => field !== undefined);

  return errors.length
    ? { ok: false, errors }
    : { ok: true, value: fields, errors: [] };
}

/** Which field ids hold secrets, so a caller can route them to the Keychain. */
export function secretFieldIds(fields: readonly AddonFieldNode[]): string[] {
  return fields
    .filter(field => field.kind === 'secureText')
    .map(field => field.id);
}

// ───────────────────────────────────────────────────────── decoration ──

/**
 * An addon-supplied colour, forced to stay readable on the active background.
 *
 * Addons are encouraged to use a tone instead, but one that insists on a
 * colour still must not be able to print dark grey on black. `ensureReadable`
 * is the app's existing contrast helper, reused rather than reimplemented.
 */
export function normalizeAddonColour(
  colour: unknown,
  background: string,
): string | undefined {
  if (typeof colour !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(colour))
    return undefined;
  return ensureReadable(colour, background);
}

/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import {
  addonTableStore,
  type AddonTableStore,
  type TableEntry,
} from './AddonTableStore';

/**
 * Moving an addon's own data on and off the device.
 *
 * Two rules shape everything here. **Secrets never travel** — the export walks
 * tables only, and `AddonSecretStore` is not reachable from this module at all,
 * so a change here cannot start including them by accident. And **an import is
 * previewed, then applied, then rolled back if anything fails**: replacing a
 * user's addon data with a file they have not seen the contents of is not a
 * decision this code gets to make.
 */

export const EXPORT_FORMAT = 'androidircx.addon-data';
export const EXPORT_FORMAT_VERSION = 1;
export const MAX_IMPORT_BYTES = 4 * 1024 * 1024;

export interface AddonDataExport {
  format: typeof EXPORT_FORMAT;
  formatVersion: number;
  addonId: string;
  /** The addon's own data schema version, so it can migrate on import. */
  schemaVersion: number;
  exportedAt: number;
  tables: Record<string, TableEntry[]>;
}

export interface ImportPreview {
  ok: boolean;
  errors: string[];
  addonId?: string;
  schemaVersion?: number;
  /** Table name to how many entries it would bring. */
  tables?: Record<string, number>;
  totalEntries?: number;
  /** True when this export came from a different addon than the target. */
  foreign?: boolean;
}

export interface ImportResult {
  ok: boolean;
  error?: string;
  imported?: number;
}

export class AddonDataTransfer {
  constructor(private readonly tables: AddonTableStore = addonTableStore) {}

  /** Everything the addon owns in tables. Never secrets. */
  export(addonId: string): AddonDataExport {
    const tables: Record<string, TableEntry[]> = {};
    for (const name of this.tables.tableNames(addonId))
      tables[name] = this.tables.query(addonId, name, { limit: 500 });

    return {
      format: EXPORT_FORMAT,
      formatVersion: EXPORT_FORMAT_VERSION,
      addonId,
      schemaVersion: this.tables.schemaVersion(addonId),
      exportedAt: Date.now(),
      tables,
    };
  }

  /**
   * Read a file and describe what importing it would do, without doing it.
   *
   * The preview is the point: it is what lets the user refuse. It reports a
   * foreign export rather than refusing one outright, because moving data
   * between two versions of the same addon under different ids is a real thing
   * people do — but they should be told.
   */
  preview(raw: string, targetAddonId: string): ImportPreview {
    const errors: string[] = [];
    if (typeof raw !== 'string' || raw.length === 0)
      return { ok: false, errors: ['The file is empty.'] };
    if (raw.length > MAX_IMPORT_BYTES)
      return { ok: false, errors: ['The file is too large to import.'] };

    let parsed: Partial<AddonDataExport>;
    try {
      parsed = JSON.parse(raw) as Partial<AddonDataExport>;
    } catch {
      return { ok: false, errors: ['The file is not valid JSON.'] };
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      return { ok: false, errors: ['The file is not an addon data export.'] };
    if (parsed.format !== EXPORT_FORMAT)
      errors.push('The file is not an addon data export.');
    if (
      typeof parsed.formatVersion !== 'number' ||
      parsed.formatVersion > EXPORT_FORMAT_VERSION
    )
      // Forward-compatible would mean guessing what a newer field means.
      errors.push('The file was written by a newer version of the app.');
    if (typeof parsed.addonId !== 'string' || !parsed.addonId)
      errors.push('The file does not say which addon it came from.');
    if (!parsed.tables || typeof parsed.tables !== 'object')
      errors.push('The file contains no tables.');

    if (errors.length) return { ok: false, errors };

    const counts: Record<string, number> = {};
    let total = 0;
    for (const [name, entries] of Object.entries(parsed.tables ?? {})) {
      if (!Array.isArray(entries)) {
        errors.push(`Table "${name}" is malformed.`);
        continue;
      }
      const valid = entries.filter(
        entry => entry && typeof entry.key === 'string',
      );
      counts[name] = valid.length;
      total += valid.length;
    }

    return errors.length
      ? { ok: false, errors }
      : {
          ok: true,
          errors: [],
          addonId: parsed.addonId,
          schemaVersion:
            typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : 0,
          tables: counts,
          totalEntries: total,
          foreign: parsed.addonId !== targetAddonId,
        };
  }

  /**
   * Apply a previewed export.
   *
   * Everything that was there is captured first and put back if any write is
   * refused — a quota rejection halfway through would otherwise leave the addon
   * holding half its old data and half the file's, which is worse than either.
   */
  async apply(
    targetAddonId: string,
    raw: string,
    options: { replace?: boolean } = {},
  ): Promise<ImportResult> {
    const preview = this.preview(raw, targetAddonId);
    if (!preview.ok) return { ok: false, error: preview.errors.join(' ') };

    const parsed = JSON.parse(raw) as AddonDataExport;
    const rollback = this.export(targetAddonId);

    if (options.replace)
      for (const name of this.tables.tableNames(targetAddonId))
        await this.tables.dropTable(targetAddonId, name);

    let imported = 0;
    for (const [name, entries] of Object.entries(parsed.tables)) {
      for (const entry of entries) {
        if (!entry || typeof entry.key !== 'string') continue;
        const result = await this.tables.set(
          targetAddonId,
          name,
          entry.key,
          entry.value ?? null,
          entry.expiresAt ? entry.expiresAt - Date.now() : undefined,
        );
        if (!result.ok) {
          await this.restore(targetAddonId, rollback);
          return {
            ok: false,
            error: `Import stopped: ${result.reason}. Nothing was changed.`,
          };
        }
        imported += 1;
      }
    }

    return { ok: true, imported };
  }

  private async restore(
    addonId: string,
    snapshot: AddonDataExport,
  ): Promise<void> {
    for (const name of this.tables.tableNames(addonId))
      await this.tables.dropTable(addonId, name);
    for (const [name, entries] of Object.entries(snapshot.tables))
      for (const entry of entries)
        await this.tables.set(addonId, name, entry.key, entry.value ?? null);
  }
}

export const addonDataTransfer = new AddonDataTransfer();

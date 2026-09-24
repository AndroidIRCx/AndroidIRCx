/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import { addonAuditService } from './AddonAuditService';
import { addonManagementService } from './AddonManagementService';
import { addonPackageStore } from './AddonPackageStore';
import { addonSafetyService } from './AddonSafetyService';

export class AddonExportCancelledError extends Error {
  constructor() {
    super('Addon export was cancelled.');
    this.name = 'AddonExportCancelledError';
  }
}

/** Exports only user-requested source or the structured, secret-free audit log. */
export class AddonExportService {
  constructor(
    private readonly files = RNFS,
    private readonly sharing = Share,
    private readonly management = addonManagementService,
    private readonly packages = addonPackageStore,
    private readonly safety = addonSafetyService,
    private readonly audit = addonAuditService,
    private readonly now: () => number = Date.now,
  ) {}

  async shareSource(addonId: string): Promise<void> {
    const source = await this.management.readSource(addonId);
    await this.shareFile(
      addonId,
      'source.js',
      source,
      'application/javascript',
    );
  }

  async shareDiagnostics(addonId: string): Promise<void> {
    await Promise.all([
      this.packages.initialize(),
      this.safety.initialize(),
      this.audit.initialize(),
    ]);
    const installed = this.packages.get(addonId);
    if (!installed) throw new Error('Addon package is not installed.');
    const safety = this.safety.getSnapshot();
    const disabled = safety.disabled.get(addonId);
    const report = {
      format: 'AndroidIRCX addon diagnostics v1',
      exportedAt: new Date().toISOString(),
      addon: {
        id: installed.manifest.id,
        name: installed.manifest.name,
        version: installed.manifest.version,
        activeChecksum: installed.activeChecksum,
      },
      recovery: {
        safeMode: safety.safeMode,
        disabledReason: disabled?.reason ?? null,
        disabledAt: disabled?.disabledAt ?? null,
        failureCount: safety.failures.get(addonId) ?? 0,
      },
      // Audit entries contain only allow-listed tokens and never message text,
      // URLs, filesystem paths, credentials, or addon secrets.
      audit: this.audit.list(addonId),
    };
    await this.shareFile(
      addonId,
      'diagnostics.json',
      JSON.stringify(report, null, 2),
      'application/json',
    );
  }

  private async shareFile(
    addonId: string,
    suffix: string,
    content: string,
    type: string,
  ): Promise<void> {
    const path = `${this.files.CachesDirectoryPath}/${addonId}-${this.now()}-${suffix}`;
    try {
      await this.files.writeFile(path, content, 'utf8');
      await this.sharing.open({
        url: `file://${path}`,
        type,
        subject: `AndroidIRCX addon ${addonId}`,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        /user did not share|cancel/i.test(error.message)
      )
        throw new AddonExportCancelledError();
      throw error;
    } finally {
      if (await this.files.exists(path)) await this.files.unlink(path);
    }
  }
}

export const addonExportService = new AddonExportService();

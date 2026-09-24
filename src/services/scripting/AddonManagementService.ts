/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import { TextDecoder } from 'text-encoding';
import { addonAuditService } from './AddonAuditService';
import { addonLifecycleService } from './AddonLifecycleService';
import { addonPackageStore } from './AddonPackageStore';
import { addonPermissionService } from './AddonPermissionService';
import { addonSafetyService } from './AddonSafetyService';
import { addonConfigStore } from './AddonConfigStore';
import { addonHostApiGateway } from './AddonHostApiGateway';
import { addonEventRouter } from './AddonEventRouter';

interface PackageBoundary {
  initialize(): Promise<void>;
  list(): ReturnType<typeof addonPackageStore.list>;
  rollback(addonId: string): ReturnType<typeof addonPackageStore.rollback>;
  uninstall(addonId: string): Promise<void>;
  loadActive(addonId: string): ReturnType<typeof addonPackageStore.loadActive>;
  get(addonId: string): ReturnType<typeof addonPackageStore.get>;
}

type SafetyBoundary = Pick<
  typeof addonSafetyService,
  | 'initialize'
  | 'getSnapshot'
  | 'reenable'
  | 'disable'
  | 'shouldLoadThirdPartyAddon'
>;
type PermissionBoundary = Pick<
  typeof addonPermissionService,
  'initialize' | 'reconcileDeclared' | 'revokeAll'
>;
type AuditBoundary = Pick<typeof addonAuditService, 'initialize' | 'clear'>;
type LifecycleBoundary = Pick<
  typeof addonLifecycleService,
  'startOne' | 'stop'
>;
type ConfigBoundary = Pick<
  typeof addonConfigStore,
  'initialize' | 'snapshot' | 'restoreSnapshot'
>;
type HostApiBoundary = Pick<typeof addonHostApiGateway, 'clearUsage'>;
type EventRouterBoundary = Pick<typeof addonEventRouter, 'clear'>;

/** Coordinates user-visible addon controls so cleanup cannot be half-done. */
export class AddonManagementService {
  constructor(
    private readonly packages: PackageBoundary = addonPackageStore,
    private readonly safety: SafetyBoundary = addonSafetyService,
    private readonly permissions: PermissionBoundary = addonPermissionService,
    private readonly audit: AuditBoundary = addonAuditService,
    private readonly lifecycle: LifecycleBoundary = addonLifecycleService,
    private readonly config: ConfigBoundary = addonConfigStore,
    private readonly hostApi: HostApiBoundary = addonHostApiGateway,
    private readonly eventRouter: EventRouterBoundary = addonEventRouter,
  ) {}

  async initialize(): Promise<void> {
    await Promise.all([
      this.packages.initialize(),
      this.safety.initialize(),
      this.permissions.initialize(),
      this.audit.initialize(),
      this.config.initialize(),
    ]);
  }

  list() {
    const disabled = this.safety.getSnapshot().disabled;
    return this.packages.list().map(record => ({
      ...record,
      enabled: !disabled.has(record.manifest.id),
      disabledReason: disabled.get(record.manifest.id)?.reason,
    }));
  }

  async setEnabled(addonId: string, enabled: boolean): Promise<void> {
    if (enabled) {
      await this.safety.reenable(addonId);
      const result = await this.lifecycle.startOne(addonId);
      if (!result.started) {
        await this.safety.disable(addonId);
        throw new Error(result.error || 'Addon could not be started.');
      }
      return;
    }
    await this.lifecycle.stop(addonId);
    this.eventRouter.clear(addonId);
    await this.safety.disable(addonId);
  }

  async rollback(addonId: string): Promise<void> {
    await this.lifecycle.stop(addonId);
    this.eventRouter.clear(addonId);
    const current = this.packages.get(addonId);
    if (!current) throw new Error('Addon package is not installed.');
    await this.config.snapshot(addonId, current.activeChecksum);
    const rolledBack = await this.packages.rollback(addonId);
    try {
      await this.config.restoreSnapshot(addonId, rolledBack.activeChecksum);
      await this.permissions.reconcileDeclared(
        addonId,
        rolledBack.manifest.permissions,
      );
    } catch (error) {
      // Package, configuration and grants move as one user-visible rollback.
      await this.packages.rollback(addonId);
      await this.config.restoreSnapshot(addonId, current.activeChecksum);
      await this.permissions.reconcileDeclared(
        addonId,
        current.manifest.permissions,
      );
      throw error;
    }
    if (this.safety.shouldLoadThirdPartyAddon(addonId)) {
      const result = await this.lifecycle.startOne(addonId);
      if (!result.started)
        throw new Error(result.error || 'Rolled-back addon could not start.');
    }
  }

  async uninstall(addonId: string): Promise<void> {
    await this.lifecycle.stop(addonId);
    this.eventRouter.clear(addonId);
    await this.packages.uninstall(addonId);
    await this.permissions.revokeAll(addonId);
    await this.audit.clear(addonId);
    this.hostApi.clearUsage(addonId);
  }

  async readSource(addonId: string): Promise<string> {
    const verified = await this.packages.loadActive(addonId);
    return new TextDecoder('utf-8').decode(
      verified.files.get(verified.manifest.entry)!,
    );
  }
}

export const addonManagementService = new AddonManagementService();

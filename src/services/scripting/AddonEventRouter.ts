/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import type { AddonCapability } from './AddonManifest';
import type { InstalledAddonPackage } from './AddonPackageStore';
import { addonPackageStore } from './AddonPackageStore';
import { addonPermissionService } from './AddonPermissionService';
import { addonRuntimeManager } from './AddonRuntimeManager';
import { addonAuditService, type AddonAuditTarget } from './AddonAuditService';
import type { AddonEventEnvelope } from './AddonEventEnvelope';
import { addonDiagnostics } from './AddonDiagnostics';
import {
  compileAddonEventFilter,
  type AddonEventFilter,
  type AddonEventFilterContext,
  type CompiledAddonEventFilter,
} from './AddonEventFilter';
import {
  parseAddonDisplayResult,
  type AddonDisplayResult,
} from './AddonDisplayResult';

const MAX_SUBSCRIPTIONS_PER_ADDON = 32;
const SAFE_HOOK = /^[A-Za-z_$][A-Za-z0-9_$]{0,79}$/;

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

interface RuntimeBoundary {
  invoke(
    addonId: string,
    request: { hook: string; payloadJson: string },
  ): Promise<{ resultJson?: string }>;
}

interface AuditBoundary {
  initialize(): Promise<void>;
  record(entry: {
    addonId: string;
    capability: 'irc.read';
    action: string;
    target: AddonAuditTarget;
    result: 'allowed' | 'denied' | 'failed';
  }): Promise<void>;
}

export type AddonEventPriorityBand =
  'app-safety' | 'built-in-core' | 'user-trusted' | 'normal';

const PRIORITY: Record<AddonEventPriorityBand, number> = {
  'app-safety': 0,
  'built-in-core': 1,
  'user-trusted': 2,
  normal: 3,
};

interface Subscription {
  id: number;
  addonId: string;
  hook: string;
  match: CompiledAddonEventFilter;
  priority: number;
}

export interface AddonEventRouteResult {
  delivered: number;
  failed: number;
  stoppedBy?: string;
  hideDefaultRequestedBy: string[];
  transformations: Array<{ addonId: string; result: AddonDisplayResult }>;
}

export interface AddonEventPreviewResult extends AddonEventRouteResult {
  matched: number;
}

/** Permission-aware deterministic route into isolated imported-addon runtimes. */
export class AddonEventRouter {
  private subscriptions: Subscription[] = [];
  private sequence = 0;

  constructor(
    private readonly packages: PackageBoundary = addonPackageStore,
    private readonly permissions: PermissionBoundary = addonPermissionService,
    private readonly runtimes: RuntimeBoundary = addonRuntimeManager,
    private readonly audit: AuditBoundary = addonAuditService,
  ) {}

  async register(
    addonId: string,
    hook: string,
    filter: AddonEventFilter,
    context: AddonEventFilterContext = {},
    priorityBand: AddonEventPriorityBand = 'normal',
  ): Promise<() => void> {
    if (!SAFE_HOOK.test(hook)) throw new Error('Addon event hook is invalid.');
    await Promise.all([
      this.packages.initialize(),
      this.permissions.initialize(),
      this.audit.initialize(),
    ]);
    const installed = this.packages.get(addonId);
    if (!installed) throw new Error('Addon package is not installed.');
    this.permissions.requireGrant(
      addonId,
      installed.manifest.permissions,
      'irc.read',
    );
    if (
      this.subscriptions.filter(
        subscription => subscription.addonId === addonId,
      ).length >= MAX_SUBSCRIPTIONS_PER_ADDON
    )
      throw new Error('Addon event subscription limit exceeded.');

    const subscription: Subscription = {
      id: ++this.sequence,
      addonId,
      hook,
      match: compileAddonEventFilter(filter, context),
      priority: PRIORITY[priorityBand],
    };
    this.subscriptions.push(subscription);
    return () => {
      this.subscriptions = this.subscriptions.filter(
        candidate => candidate.id !== subscription.id,
      );
    };
  }

  async route(
    event: Readonly<AddonEventEnvelope>,
  ): Promise<AddonEventRouteResult> {
    const result = await this.routeInternal(event);
    return {
      delivered: result.delivered,
      failed: result.failed,
      stoppedBy: result.stoppedBy,
      hideDefaultRequestedBy: result.hideDefaultRequestedBy,
      transformations: result.transformations,
    };
  }

  /**
   * Runs a synthetic editor event against one addon only. The event is never
   * published to the normal router and its result is returned to the editor;
   * callers must not append it to IRC history or apply it to protocol state.
   */
  async preview(
    addonId: string,
    event: Readonly<AddonEventEnvelope>,
  ): Promise<AddonEventPreviewResult> {
    return this.routeInternal(event, addonId);
  }

  private async routeInternal(
    event: Readonly<AddonEventEnvelope>,
    onlyAddonId?: string,
  ): Promise<AddonEventPreviewResult> {
    const payloadJson = JSON.stringify(event);
    let delivered = 0;
    let failed = 0;
    let stoppedBy: string | undefined;
    const hideDefaultRequestedBy: string[] = [];
    const transformations: Array<{
      addonId: string;
      result: AddonDisplayResult;
    }> = [];
    let matched = 0;
    // Snapshot preserves FIFO registration order even if a hook unregisters.
    const ordered = [...this.subscriptions].sort(
      (left, right) => left.priority - right.priority || left.id - right.id,
    );
    for (const subscription of ordered) {
      if (onlyAddonId && subscription.addonId !== onlyAddonId) continue;
      if (!subscription.match(event)) continue;
      matched += 1;
      const installed = this.packages.get(subscription.addonId);
      if (!installed) continue;
      const startedAt = Date.now();
      try {
        this.permissions.requireGrant(
          subscription.addonId,
          installed.manifest.permissions,
          'irc.read',
        );
        const result = await this.runtimes.invoke(subscription.addonId, {
          hook: subscription.hook,
          payloadJson,
        });
        delivered += 1;
        // Counted here rather than in each caller, so the manager's numbers
        // come from the one place delivery actually happens.
        addonDiagnostics.count(subscription.addonId, 'events');
        addonDiagnostics.recordExecution(
          subscription.addonId,
          Date.now() - startedAt,
        );
        const control = parseAddonDisplayResult(result.resultJson);
        const transformsDisplay =
          control.replacement !== undefined ||
          control.style !== undefined ||
          control.routeTo !== undefined;
        if (control.display === 'hide') {
          hideDefaultRequestedBy.push(subscription.addonId);
          await this.recordControl(subscription.addonId, event, 'event.hide');
        }
        if (transformsDisplay) {
          transformations.push({
            addonId: subscription.addonId,
            result: control,
          });
          await this.recordControl(
            subscription.addonId,
            event,
            'event.transform',
          );
        }
        if (control.stopPropagation === true) {
          stoppedBy = subscription.addonId;
          await this.recordControl(subscription.addonId, event, 'event.stop');
          break;
        }
      } catch (error) {
        failed += 1;
        addonDiagnostics.recordError(
          subscription.addonId,
          subscription.hook,
          error,
        );
      }
    }
    return {
      delivered,
      failed,
      stoppedBy,
      hideDefaultRequestedBy,
      transformations,
      matched,
    };
  }

  clear(addonId: string): void {
    this.subscriptions = this.subscriptions.filter(
      subscription => subscription.addonId !== addonId,
    );
  }

  private recordControl(
    addonId: string,
    event: Readonly<AddonEventEnvelope>,
    action: 'event.hide' | 'event.stop' | 'event.transform',
  ): Promise<void> {
    return this.audit.record({
      addonId,
      capability: 'irc.read',
      action,
      target: event.channel ? 'irc-channel' : 'irc-network',
      result: 'allowed',
    });
  }
}

export const addonEventRouter = new AddonEventRouter();

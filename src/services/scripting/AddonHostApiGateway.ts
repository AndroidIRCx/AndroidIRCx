/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import type { AddonAuditTarget } from './AddonAuditService';
import { addonAuditService } from './AddonAuditService';
import { validateAddonJson, type AddonConfigValue } from './AddonConfigStore';
import type { AddonCapability } from './AddonManifest';
import { addonPackageStore } from './AddonPackageStore';
import {
  AddonPermissionDeniedError,
  addonPermissionService,
} from './AddonPermissionService';

const MAX_BRIDGE_BYTES = 1024 * 1024;
const WINDOW_MS = 60_000;

export const ADDON_HOST_OPERATIONS = Object.freeze({
  'irc.events.read': operation('irc.read', 'irc-network', 600),
  'irc.message.send': operation('irc.send', 'irc-channel', 60),
  'irc.moderate': operation('irc.moderate', 'irc-channel', 30),
  'irc.raw.observe': operation('irc.raw.observe', 'irc-network', 600),
  'irc.raw.modify': operation('irc.raw.modify', 'irc-network', 30),
  'history.read': operation('history.read', 'history', 60),
  'tabs.read': operation('tabs.read', 'tab', 120),
  'tabs.write': operation('tabs.write', 'tab', 30),
  'ui.extend': operation('ui.extend', 'tab', 30),
  'theme.read': operation('theme.read', 'theme', 120),
  'theme.write': operation('theme.write', 'theme', 10),
  'storage.read': operation('storage', 'addon-storage', 240),
  'storage.write': operation('storage', 'addon-storage', 120),
  'secrets.read': operation('secrets', 'addon-secrets', 60),
  'secrets.write': operation('secrets', 'addon-secrets', 30),
  'network.fetch': operation('network', 'public-network', 60),
  'network.private.fetch': operation('network.private', 'private-network', 20),
  'files.pick': operation('files.userSelected', 'user-selected-file', 10),
  'notifications.show': operation('notifications', 'notification', 20),
  'clipboard.write': operation('clipboard.write', 'clipboard', 20),
  'ai.complete': operation('ai', 'ai-provider', 20),
});

export type AddonHostOperation = keyof typeof ADDON_HOST_OPERATIONS;
export type AddonHostHandler = (
  addonId: string,
  args: AddonConfigValue,
) => Promise<unknown>;
export type AddonHostHandlers = Partial<
  Record<AddonHostOperation, AddonHostHandler>
>;

interface OperationDefinition {
  capability: AddonCapability;
  target: AddonAuditTarget;
  callsPerMinute: number;
}

interface UsageWindow {
  startedAt: number;
  calls: number;
}

interface PermissionBoundary {
  initialize(): Promise<void>;
  requireGrant(
    addonId: string,
    declared: readonly AddonCapability[],
    capability: string,
  ): asserts capability is AddonCapability;
}

export class AddonHostApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AddonHostApiError';
  }
}

/** The only permitted path from isolated addon code to app-owned services. */
export class AddonHostApiGateway {
  private readonly usage = new Map<string, UsageWindow>();

  constructor(
    private readonly handlers: AddonHostHandlers,
    private readonly packages = addonPackageStore,
    private readonly permissions: PermissionBoundary = addonPermissionService,
    private readonly audit = addonAuditService,
    private readonly now: () => number = Date.now,
  ) {}

  async invoke(
    addonId: string,
    operationName: string,
    args: unknown,
  ): Promise<AddonConfigValue> {
    const definition = ADDON_HOST_OPERATIONS[
      operationName as AddonHostOperation
    ] as OperationDefinition | undefined;
    if (!definition)
      throw new AddonHostApiError('Unknown addon host operation.');
    // Take ownership before the first await so caller mutation cannot change a
    // request after it was submitted for permission checking.
    const safeArgs = validateAddonJson(args, MAX_BRIDGE_BYTES);

    await Promise.all([
      this.packages.initialize(),
      this.permissions.initialize(),
      this.audit.initialize(),
    ]);
    const installed = this.packages.get(addonId);
    if (!installed)
      throw new AddonHostApiError('Addon package is not installed.');

    try {
      this.permissions.requireGrant(
        addonId,
        installed.manifest.permissions,
        definition.capability,
      );
    } catch (error) {
      await this.record(addonId, operationName, definition, 'denied');
      throw error;
    }

    const handler = this.handlers[operationName as AddonHostOperation];
    if (!handler) {
      await this.record(addonId, operationName, definition, 'failed');
      throw new AddonHostApiError('Addon host operation is not available.');
    }

    try {
      this.consume(addonId, operationName, definition.callsPerMinute);
      const result = await handler(addonId, safeArgs);
      const safeResult = validateAddonJson(result, MAX_BRIDGE_BYTES);
      await this.record(addonId, operationName, definition, 'allowed');
      return safeResult;
    } catch (error) {
      await this.record(addonId, operationName, definition, 'failed');
      throw error;
    }
  }

  clearUsage(addonId: string): void {
    const prefix = `${addonId}:`;
    [...this.usage.keys()].forEach(key => {
      if (key.startsWith(prefix)) this.usage.delete(key);
    });
  }

  private consume(addonId: string, operationName: string, limit: number): void {
    const key = `${addonId}:${operationName}`;
    const now = this.now();
    const previous = this.usage.get(key);
    const window =
      !previous || now - previous.startedAt >= WINDOW_MS
        ? { startedAt: now, calls: 0 }
        : previous;
    if (window.calls >= limit)
      throw new AddonHostApiError('Addon host operation rate limit exceeded.');
    window.calls += 1;
    this.usage.set(key, window);
  }

  private record(
    addonId: string,
    action: string,
    definition: OperationDefinition,
    result: 'allowed' | 'denied' | 'failed',
  ): Promise<void> {
    return this.audit.record({
      addonId,
      capability: definition.capability,
      action,
      target: definition.target,
      result,
    });
  }
}

function operation(
  capability: AddonCapability,
  target: AddonAuditTarget,
  callsPerMinute: number,
): OperationDefinition {
  return Object.freeze({ capability, target, callsPerMinute });
}

/**
 * Handlers are required lazily rather than imported, so this file keeps no
 * static dependency on the services it guards. The gateway decides whether a
 * call is allowed; it must not be able to perform one by accident.
 */
export const addonHostApiGateway = new AddonHostApiGateway(
  (
    require('./AddonHostHandlers') as typeof import('./AddonHostHandlers')
  ).createAddonHostHandlers(),
);

export { AddonPermissionDeniedError };

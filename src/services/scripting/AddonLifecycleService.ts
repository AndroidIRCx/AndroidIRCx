import { TextDecoder } from 'text-encoding';
import { addonPackageStore } from './AddonPackageStore';
import { addonRuntimeManager } from './AddonRuntimeManager';
import {
  DEFAULT_ADDON_RUNTIME_LIMITS,
  type AddonRuntimeRequest,
} from './AddonRuntime';
import type { InstalledAddonPackage } from './AddonPackageStore';
import type { ReadAddonPackage } from './AddonPackageReader';
import { addonSafetyService } from './AddonSafetyService';
import { addonEventRouter } from './AddonEventRouter';
import type { AddonEventFilter } from './AddonEventFilter';

interface AddonLifecycleSafetyBoundary {
  shouldLoadThirdPartyAddon(addonId: string): boolean;
  recordFailure(addonId: string): Promise<boolean>;
}

interface AddonLifecyclePackageBoundary {
  initialize(): Promise<void>;
  list(): InstalledAddonPackage[];
  loadActive(addonId: string): Promise<ReadAddonPackage>;
}

interface AddonLifecycleRuntimeBoundary {
  start(request: AddonRuntimeRequest): Promise<boolean>;
  stop(addonId: string): Promise<void>;
  stopAll(): Promise<void>;
  invoke(
    addonId: string,
    request: { hook: string; payloadJson: string },
  ): Promise<{ resultJson?: string }>;
}

interface AddonLifecycleEventBoundary {
  register(
    addonId: string,
    hook: string,
    filter: AddonEventFilter,
  ): Promise<() => void>;
  clear(addonId: string): void;
}

export interface AddonStartupResult {
  addonId: string;
  started: boolean;
  error?: string;
}

/** Loads only verified active blobs and sends their entry source to QuickJS. */
export class AddonLifecycleService {
  constructor(
    private readonly packages: AddonLifecyclePackageBoundary = addonPackageStore,
    private readonly runtimes: AddonLifecycleRuntimeBoundary = addonRuntimeManager,
    private readonly safety: AddonLifecycleSafetyBoundary = addonSafetyService,
    private readonly events: AddonLifecycleEventBoundary = addonEventRouter,
  ) {}

  async startInstalled(): Promise<AddonStartupResult[]> {
    await this.packages.initialize();
    const results: AddonStartupResult[] = [];
    for (const installed of this.packages.list()) {
      const addonId = installed.manifest.id;
      if (!this.safety.shouldLoadThirdPartyAddon(addonId)) {
        results.push({ addonId, started: false });
        continue;
      }

      results.push(await this.startOne(addonId));
    }
    return results;
  }

  async startOne(addonId: string): Promise<AddonStartupResult> {
    if (!this.safety.shouldLoadThirdPartyAddon(addonId))
      return { addonId, started: false };
    let verified;
    try {
      verified = await this.packages.loadActive(addonId);
    } catch (error) {
      await this.safety.recordFailure(addonId);
      return {
        addonId,
        started: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
    try {
      const source = new TextDecoder('utf-8').decode(
        verified.files.get(verified.manifest.entry)!,
      );
      const started = await this.runtimes.start({
        addonId,
        source,
        filename: verified.manifest.entry,
        limits: { ...DEFAULT_ADDON_RUNTIME_LIMITS },
      });
      if (started) await this.registerEventSubscriptions(addonId);
      return { addonId, started };
    } catch (error) {
      this.events.clear(addonId);
      await this.runtimes.stop(addonId).catch(() => undefined);
      return {
        addonId,
        started: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  stop(addonId: string): Promise<void> {
    this.events.clear(addonId);
    return this.runtimes.stop(addonId);
  }

  stopAll(): Promise<void> {
    this.packages
      .list()
      .forEach(record => this.events.clear(record.manifest.id));
    return this.runtimes.stopAll();
  }

  private async registerEventSubscriptions(addonId: string): Promise<void> {
    const result = await this.runtimes.invoke(addonId, {
      hook: '__androidircxSubscriptions',
      payloadJson: '{}',
    });
    const parsed = result.resultJson
      ? (JSON.parse(result.resultJson) as unknown)
      : [];
    if (!Array.isArray(parsed) || parsed.length > 32)
      throw new Error('Addon event subscriptions are invalid.');
    for (const item of parsed) {
      if (!item || typeof item !== 'object' || Array.isArray(item))
        throw new Error('Addon event subscription is invalid.');
      const value = item as Record<string, unknown>;
      if (
        Object.keys(value).some(key => key !== 'hook' && key !== 'filter') ||
        typeof value.hook !== 'string' ||
        !value.filter ||
        typeof value.filter !== 'object' ||
        Array.isArray(value.filter)
      )
        throw new Error('Addon event subscription is invalid.');
      await this.events.register(
        addonId,
        value.hook,
        value.filter as AddonEventFilter,
      );
    }
  }
}

export const addonLifecycleService = new AddonLifecycleService();

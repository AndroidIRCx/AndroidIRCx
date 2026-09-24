import {
  type AddonNativeRuntimeBridge,
  type AddonRuntimeHookRequest,
  type AddonRuntimeHookResult,
  type AddonRuntimeRequest,
  AddonRuntimeSecurityError,
  AddonRuntimeUnavailableError,
  ImportedAddonRuntime,
} from './AddonRuntime';
import { addonSafetyService } from './AddonSafetyService';
import { nativeAddonRuntimeBridge } from './NativeAddonRuntimeBridge';

export interface AddonRuntimeSafetyBoundary {
  beginAddonStartup(addonId: string): Promise<boolean>;
  completeAddonStartup(addonId: string): Promise<void>;
  recordFailure(addonId: string): Promise<boolean>;
  shouldLoadThirdPartyAddon(addonId: string): boolean;
}

/**
 * Owns imported addon runtimes. Existing locally-authored scripts intentionally
 * remain in ScriptingService; package addons may only enter through this class.
 */
export class AddonRuntimeManager {
  private readonly runtimes = new Map<string, ImportedAddonRuntime>();
  private readonly starting = new Set<string>();

  constructor(
    private readonly bridge?: AddonNativeRuntimeBridge,
    private readonly safety: AddonRuntimeSafetyBoundary = addonSafetyService,
  ) {}

  async start(request: AddonRuntimeRequest): Promise<boolean> {
    if (
      this.runtimes.has(request.addonId) ||
      this.starting.has(request.addonId)
    )
      throw new AddonRuntimeSecurityError(
        `Addon runtime is already active: ${request.addonId}`,
      );
    if (!(await this.safety.beginAddonStartup(request.addonId))) return false;

    this.starting.add(request.addonId);
    const runtime = new ImportedAddonRuntime(this.bridge);
    try {
      await runtime.initialize(request);
      this.runtimes.set(request.addonId, runtime);
      await this.safety.completeAddonStartup(request.addonId);
      return true;
    } catch (error) {
      await runtime.dispose().catch(() => undefined);
      await this.safety.recordFailure(request.addonId);
      throw error;
    } finally {
      this.starting.delete(request.addonId);
    }
  }

  async invoke(
    addonId: string,
    request: AddonRuntimeHookRequest,
  ): Promise<AddonRuntimeHookResult> {
    const runtime = this.runtimes.get(addonId);
    if (!runtime || !this.safety.shouldLoadThirdPartyAddon(addonId)) {
      if (runtime) await this.stop(addonId);
      throw new AddonRuntimeUnavailableError(
        `Addon runtime is disabled or unavailable: ${addonId}`,
      );
    }

    try {
      return await runtime.invokeHook(request);
    } catch (error) {
      const disabled = await this.safety.recordFailure(addonId);
      if (disabled) await this.stop(addonId);
      throw error;
    }
  }

  async stop(addonId: string): Promise<void> {
    const runtime = this.runtimes.get(addonId);
    this.runtimes.delete(addonId);
    if (runtime) await runtime.dispose();
  }

  async stopAll(): Promise<void> {
    const active = [...this.runtimes.entries()];
    this.runtimes.clear();
    await Promise.all(active.map(([, runtime]) => runtime.dispose()));
  }

  isActive(addonId: string): boolean {
    return this.runtimes.has(addonId);
  }
}

export const addonRuntimeManager = new AddonRuntimeManager(
  nativeAddonRuntimeBridge,
);

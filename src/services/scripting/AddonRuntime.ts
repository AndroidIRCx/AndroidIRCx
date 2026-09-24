export const ADDON_RUNTIME_API_VERSION = 1 as const;

export interface AddonRuntimeLimits {
  memoryBytes: number;
  stackBytes: number;
  hookDeadlineMs: number;
  maxQueuedHooks: number;
  maxTimers: number;
  maxConcurrentAsync: number;
}

export const DEFAULT_ADDON_RUNTIME_LIMITS: Readonly<AddonRuntimeLimits> = {
  memoryBytes: 8 * 1024 * 1024,
  stackBytes: 256 * 1024,
  hookDeadlineMs: 100,
  maxQueuedHooks: 32,
  maxTimers: 16,
  maxConcurrentAsync: 4,
};

export interface AddonRuntimeSecurityFeatures {
  apiVersion: number;
  isolatedGlobals: boolean;
  memoryLimit: boolean;
  stackLimit: boolean;
  interruptHandler: boolean;
}

export interface AddonRuntimeRequest {
  addonId: string;
  source: string;
  filename: string;
  limits: AddonRuntimeLimits;
}

export interface AddonRuntimeHookRequest {
  hook: string;
  payloadJson: string;
}

export interface AddonRuntimeHookResult {
  resultJson?: string;
}

/**
 * Native boundary required for imported addons. Implementations must host each
 * addon in a separate QuickJS runtime (or equivalently isolated native VM).
 * This deliberately has no JavaScript-eval fallback.
 */
export interface AddonNativeRuntimeBridge {
  getSecurityFeatures(): Promise<AddonRuntimeSecurityFeatures>;
  createRuntime(request: AddonRuntimeRequest): Promise<string>;
  invokeHook(
    runtimeId: string,
    request: AddonRuntimeHookRequest,
  ): Promise<AddonRuntimeHookResult>;
  disposeRuntime(runtimeId: string): Promise<void>;
}

export class AddonRuntimeUnavailableError extends Error {
  constructor(message = 'The isolated addon runtime is unavailable') {
    super(message);
    this.name = 'AddonRuntimeUnavailableError';
  }
}

export class AddonRuntimeSecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AddonRuntimeSecurityError';
  }
}

function assertPositiveInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new AddonRuntimeSecurityError(`${field} must be a positive integer`);
  }
}

function validateRequest(request: AddonRuntimeRequest): void {
  if (!request.addonId.trim() || !request.source || !request.filename.trim()) {
    throw new AddonRuntimeSecurityError('Addon runtime request is incomplete');
  }

  assertPositiveInteger(request.limits.memoryBytes, 'memoryBytes');
  assertPositiveInteger(request.limits.stackBytes, 'stackBytes');
  assertPositiveInteger(request.limits.hookDeadlineMs, 'hookDeadlineMs');
  assertPositiveInteger(request.limits.maxQueuedHooks, 'maxQueuedHooks');
  assertPositiveInteger(request.limits.maxTimers, 'maxTimers');
  assertPositiveInteger(
    request.limits.maxConcurrentAsync,
    'maxConcurrentAsync',
  );
}

function validateSecurityFeatures(
  features: AddonRuntimeSecurityFeatures,
): void {
  if (features.apiVersion !== ADDON_RUNTIME_API_VERSION) {
    throw new AddonRuntimeSecurityError(
      `Unsupported addon runtime API version: ${features.apiVersion}`,
    );
  }

  const missing = (
    [
      'isolatedGlobals',
      'memoryLimit',
      'stackLimit',
      'interruptHandler',
    ] as const
  ).filter(feature => features[feature] !== true);

  if (missing.length > 0) {
    throw new AddonRuntimeSecurityError(
      `Addon runtime is missing required security controls: ${missing.join(', ')}`,
    );
  }
}

export class ImportedAddonRuntime {
  private runtimeId?: string;

  constructor(private readonly bridge?: AddonNativeRuntimeBridge) {}

  async initialize(request: AddonRuntimeRequest): Promise<void> {
    if (!this.bridge) {
      throw new AddonRuntimeUnavailableError();
    }
    if (this.runtimeId) {
      throw new AddonRuntimeSecurityError(
        'Addon runtime is already initialized',
      );
    }

    validateRequest(request);
    const features = await this.bridge.getSecurityFeatures();
    validateSecurityFeatures(features);

    const runtimeId = await this.bridge.createRuntime(request);
    if (!runtimeId.trim()) {
      throw new AddonRuntimeSecurityError(
        'Native addon runtime returned an invalid runtime id',
      );
    }
    this.runtimeId = runtimeId;
  }

  async invokeHook(
    request: AddonRuntimeHookRequest,
  ): Promise<AddonRuntimeHookResult> {
    if (!this.bridge || !this.runtimeId) {
      throw new AddonRuntimeUnavailableError(
        'The imported addon has no initialized isolated runtime',
      );
    }
    if (!request.hook.trim()) {
      throw new AddonRuntimeSecurityError('Addon hook name is required');
    }

    return this.bridge.invokeHook(this.runtimeId, request);
  }

  async dispose(): Promise<void> {
    const runtimeId = this.runtimeId;
    this.runtimeId = undefined;
    if (runtimeId && this.bridge) {
      await this.bridge.disposeRuntime(runtimeId);
    }
  }
}

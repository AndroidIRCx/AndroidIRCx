import { NativeModules, Platform } from 'react-native';
import type {
  AddonNativeRuntimeBridge,
  AddonRuntimeHookRequest,
  AddonRuntimeHookResult,
  AddonRuntimeRequest,
  AddonRuntimeSecurityFeatures,
} from './AddonRuntime';

interface NativeAddonRuntimeModule {
  getSecurityFeatures(): Promise<AddonRuntimeSecurityFeatures>;
  createRuntime(request: AddonRuntimeRequest): Promise<string>;
  invokeHook(
    runtimeId: string,
    request: AddonRuntimeHookRequest,
  ): Promise<AddonRuntimeHookResult>;
  disposeRuntime(runtimeId: string): Promise<void>;
}

const hasMethod = (
  value: Record<string, unknown>,
  name: keyof NativeAddonRuntimeModule,
): boolean => typeof value[name] === 'function';

export function createNativeAddonRuntimeBridge(
  candidate: unknown = NativeModules.AndroidIRCXAddonRuntime,
): AddonNativeRuntimeBridge | undefined {
  if (Platform.OS !== 'android' || !candidate || typeof candidate !== 'object')
    return undefined;
  const module = candidate as Record<string, unknown>;
  if (
    !hasMethod(module, 'getSecurityFeatures') ||
    !hasMethod(module, 'createRuntime') ||
    !hasMethod(module, 'invokeHook') ||
    !hasMethod(module, 'disposeRuntime')
  )
    return undefined;

  const native = candidate as NativeAddonRuntimeModule;
  return {
    getSecurityFeatures: () => native.getSecurityFeatures(),
    createRuntime: request => native.createRuntime(request),
    invokeHook: (runtimeId, request) => native.invokeHook(runtimeId, request),
    disposeRuntime: runtimeId => native.disposeRuntime(runtimeId),
  };
}

export const nativeAddonRuntimeBridge = createNativeAddonRuntimeBridge();

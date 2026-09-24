import {
  ADDON_RUNTIME_API_VERSION,
  AddonNativeRuntimeBridge,
  AddonRuntimeRequest,
  AddonRuntimeSecurityError,
  AddonRuntimeUnavailableError,
  ImportedAddonRuntime,
} from '../../src/services/scripting/AddonRuntime';

const request: AddonRuntimeRequest = {
  addonId: 'dev.androidircx.example',
  source: 'export default {};',
  filename: 'main.js',
  limits: {
    memoryBytes: 8 * 1024 * 1024,
    stackBytes: 256 * 1024,
    hookDeadlineMs: 100,
    maxQueuedHooks: 32,
    maxTimers: 16,
    maxConcurrentAsync: 4,
  },
};

function createBridge(): jest.Mocked<AddonNativeRuntimeBridge> {
  return {
    getSecurityFeatures: jest.fn().mockResolvedValue({
      apiVersion: ADDON_RUNTIME_API_VERSION,
      isolatedGlobals: true,
      memoryLimit: true,
      stackLimit: true,
      interruptHandler: true,
    }),
    createRuntime: jest.fn().mockResolvedValue('runtime-1'),
    invokeHook: jest.fn().mockResolvedValue({ resultJson: '{"ok":true}' }),
    disposeRuntime: jest.fn().mockResolvedValue(undefined),
  };
}

describe('ImportedAddonRuntime', () => {
  it('fails closed when no native isolated runtime is installed', async () => {
    const runtime = new ImportedAddonRuntime();

    await expect(runtime.initialize(request)).rejects.toBeInstanceOf(
      AddonRuntimeUnavailableError,
    );
    await expect(
      runtime.invokeHook({ hook: 'onMessage', payloadJson: '{}' }),
    ).rejects.toBeInstanceOf(AddonRuntimeUnavailableError);
  });

  it('rejects a bridge that lacks any required security control', async () => {
    const bridge = createBridge();
    bridge.getSecurityFeatures.mockResolvedValue({
      apiVersion: ADDON_RUNTIME_API_VERSION,
      isolatedGlobals: true,
      memoryLimit: true,
      stackLimit: true,
      interruptHandler: false,
    });

    await expect(
      new ImportedAddonRuntime(bridge).initialize(request),
    ).rejects.toThrow(AddonRuntimeSecurityError);
    expect(bridge.createRuntime).not.toHaveBeenCalled();
  });

  it('validates limits before creating native state', async () => {
    const bridge = createBridge();
    const runtime = new ImportedAddonRuntime(bridge);

    await expect(
      runtime.initialize({
        ...request,
        limits: { ...request.limits, hookDeadlineMs: 0 },
      }),
    ).rejects.toThrow('hookDeadlineMs must be a positive integer');
    expect(bridge.getSecurityFeatures).not.toHaveBeenCalled();
  });

  it('invokes hooks only after secure initialization and disposes once', async () => {
    const bridge = createBridge();
    const runtime = new ImportedAddonRuntime(bridge);

    await runtime.initialize(request);
    await expect(
      runtime.invokeHook({ hook: 'onMessage', payloadJson: '{"text":"hi"}' }),
    ).resolves.toEqual({ resultJson: '{"ok":true}' });
    expect(bridge.invokeHook).toHaveBeenCalledWith('runtime-1', {
      hook: 'onMessage',
      payloadJson: '{"text":"hi"}',
    });

    await runtime.dispose();
    await runtime.dispose();
    expect(bridge.disposeRuntime).toHaveBeenCalledTimes(1);
    await expect(
      runtime.invokeHook({ hook: 'onMessage', payloadJson: '{}' }),
    ).rejects.toBeInstanceOf(AddonRuntimeUnavailableError);
  });
});

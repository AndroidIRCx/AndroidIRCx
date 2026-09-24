import {
  ADDON_RUNTIME_API_VERSION,
  type AddonNativeRuntimeBridge,
  type AddonRuntimeRequest,
  AddonRuntimeUnavailableError,
} from '../../src/services/scripting/AddonRuntime';
import {
  AddonRuntimeManager,
  type AddonRuntimeSafetyBoundary,
} from '../../src/services/scripting/AddonRuntimeManager';

const request: AddonRuntimeRequest = {
  addonId: 'rs.androidircx.manager-test',
  source: 'export default {};',
  filename: 'main.js',
  limits: {
    memoryBytes: 1024,
    stackBytes: 512,
    hookDeadlineMs: 20,
    maxQueuedHooks: 2,
    maxTimers: 1,
    maxConcurrentAsync: 1,
  },
};

function bridge(): jest.Mocked<AddonNativeRuntimeBridge> {
  return {
    getSecurityFeatures: jest.fn().mockResolvedValue({
      apiVersion: ADDON_RUNTIME_API_VERSION,
      isolatedGlobals: true,
      memoryLimit: true,
      stackLimit: true,
      interruptHandler: true,
    }),
    createRuntime: jest.fn().mockResolvedValue('runtime-id'),
    invokeHook: jest.fn().mockResolvedValue({ resultJson: '{}' }),
    disposeRuntime: jest.fn().mockResolvedValue(undefined),
  };
}

function safety(): jest.Mocked<AddonRuntimeSafetyBoundary> {
  return {
    beginAddonStartup: jest.fn().mockResolvedValue(true),
    completeAddonStartup: jest.fn().mockResolvedValue(undefined),
    recordFailure: jest.fn().mockResolvedValue(false),
    shouldLoadThirdPartyAddon: jest.fn().mockReturnValue(true),
  };
}

describe('AddonRuntimeManager', () => {
  it('does not compile an addon rejected by Safe Mode', async () => {
    const native = bridge();
    const recovery = safety();
    recovery.beginAddonStartup.mockResolvedValue(false);

    await expect(
      new AddonRuntimeManager(native, recovery).start(request),
    ).resolves.toBe(false);
    expect(native.createRuntime).not.toHaveBeenCalled();
  });

  it('brackets successful startup with recovery markers', async () => {
    const native = bridge();
    const recovery = safety();
    const manager = new AddonRuntimeManager(native, recovery);

    await expect(manager.start(request)).resolves.toBe(true);
    expect(recovery.beginAddonStartup).toHaveBeenCalledWith(request.addonId);
    expect(recovery.completeAddonStartup).toHaveBeenCalledWith(request.addonId);
    expect(manager.isActive(request.addonId)).toBe(true);
  });

  it('records initialization failures without leaving a runtime active', async () => {
    const recovery = safety();
    const manager = new AddonRuntimeManager(undefined, recovery);

    await expect(manager.start(request)).rejects.toBeInstanceOf(
      AddonRuntimeUnavailableError,
    );
    expect(recovery.recordFailure).toHaveBeenCalledWith(request.addonId);
    expect(manager.isActive(request.addonId)).toBe(false);
  });

  it('disposes only the failing addon when recovery disables it', async () => {
    const native = bridge();
    const recovery = safety();
    const manager = new AddonRuntimeManager(native, recovery);
    await manager.start(request);
    native.invokeHook.mockRejectedValue(new Error('interrupted'));
    recovery.recordFailure.mockResolvedValue(true);

    await expect(
      manager.invoke(request.addonId, { hook: 'onMessage', payloadJson: '{}' }),
    ).rejects.toThrow('interrupted');
    expect(native.disposeRuntime).toHaveBeenCalledWith('runtime-id');
    expect(manager.isActive(request.addonId)).toBe(false);
  });

  it('tears down an active runtime immediately when Safe Mode changes', async () => {
    const native = bridge();
    const recovery = safety();
    const manager = new AddonRuntimeManager(native, recovery);
    await manager.start(request);
    recovery.shouldLoadThirdPartyAddon.mockReturnValue(false);

    await expect(
      manager.invoke(request.addonId, { hook: 'onMessage', payloadJson: '{}' }),
    ).rejects.toBeInstanceOf(AddonRuntimeUnavailableError);
    expect(native.disposeRuntime).toHaveBeenCalledWith('runtime-id');
  });
});

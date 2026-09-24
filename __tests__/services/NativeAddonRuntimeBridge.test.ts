import { Platform } from 'react-native';
import { createNativeAddonRuntimeBridge } from '../../src/services/scripting/NativeAddonRuntimeBridge';

describe('createNativeAddonRuntimeBridge', () => {
  const originalOs = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOs });
  });

  it('fails closed off Android and for incomplete native modules', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios' });
    expect(createNativeAddonRuntimeBridge({})).toBeUndefined();
    Object.defineProperty(Platform, 'OS', { value: 'android' });
    expect(
      createNativeAddonRuntimeBridge({ getSecurityFeatures: jest.fn() }),
    ).toBeUndefined();
  });

  it('forwards only through a complete Android native boundary', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'android' });
    const native = {
      getSecurityFeatures: jest.fn().mockResolvedValue({ apiVersion: 1 }),
      createRuntime: jest.fn().mockResolvedValue('runtime'),
      invokeHook: jest.fn().mockResolvedValue({ resultJson: '{}' }),
      disposeRuntime: jest.fn().mockResolvedValue(undefined),
    };
    const bridge = createNativeAddonRuntimeBridge(native)!;

    await bridge.getSecurityFeatures();
    await bridge.disposeRuntime('runtime');
    expect(native.getSecurityFeatures).toHaveBeenCalledTimes(1);
    expect(native.disposeRuntime).toHaveBeenCalledWith('runtime');
  });
});

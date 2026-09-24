import AsyncStorage from '@react-native-async-storage/async-storage';
import { AddonSafetyService } from '../../src/services/scripting/AddonSafetyService';

describe('AddonSafetyService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage as any).__reset?.();
  });

  it('allows a clean startup to complete without entering Safe Mode', async () => {
    const first = new AddonSafetyService();
    await first.beginStartup();
    await first.completeStartup();
    const next = new AddonSafetyService();
    const snapshot = await next.beginStartup();
    expect(snapshot.safeMode).toBe(false);
    expect(next.shouldLoadThirdPartyAddon('addon')).toBe(true);
  });

  it('enters Safe Mode and disables the addon active during a boot crash', async () => {
    const crashed = new AddonSafetyService();
    await crashed.beginStartup();
    expect(await crashed.beginAddonStartup('bad.addon')).toBe(true);

    const recovered = new AddonSafetyService();
    const snapshot = await recovered.beginStartup();
    expect(snapshot.safeMode).toBe(true);
    expect(snapshot.disabled.get('bad.addon')?.reason).toBe('boot-crash');
    expect(recovered.shouldLoadThirdPartyAddon('bad.addon')).toBe(false);
  });

  it('auto-disables only the addon that fails three times', async () => {
    const service = new AddonSafetyService();
    await service.initialize();
    expect(await service.recordFailure('bad.addon')).toBe(false);
    expect(await service.recordFailure('bad.addon')).toBe(false);
    expect(await service.recordFailure('bad.addon')).toBe(true);
    expect(service.shouldLoadThirdPartyAddon('bad.addon')).toBe(false);
    expect(service.shouldLoadThirdPartyAddon('good.addon')).toBe(true);
    await service.reenable('bad.addon');
    expect(service.shouldLoadThirdPartyAddon('bad.addon')).toBe(true);
  });

  it('supports explicit Safe Mode and user disable without deleting state', async () => {
    const service = new AddonSafetyService();
    await service.initialize();
    await service.disable('addon');
    expect(service.getSnapshot().disabled.get('addon')?.reason).toBe(
      'user-disabled',
    );
    await service.setSafeMode(true);
    expect(service.shouldLoadThirdPartyAddon('other')).toBe(false);
    await service.setSafeMode(false);
    expect(service.shouldLoadThirdPartyAddon('other')).toBe(true);
  });

  it('fails closed when safety storage cannot be read or written', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(
      new Error('read'),
    );
    const readFailure = new AddonSafetyService();
    await readFailure.initialize();
    expect(readFailure.getSnapshot().safeMode).toBe(true);

    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
      new Error('write'),
    );
    await expect(readFailure.setSafeMode(false)).rejects.toThrow(
      'Addon safety state could not be persisted.',
    );
    expect(readFailure.getSnapshot().safeMode).toBe(true);
  });
});

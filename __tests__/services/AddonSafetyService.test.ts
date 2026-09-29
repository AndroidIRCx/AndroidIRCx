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

  /**
   * What is on disk is whatever the last version of the app wrote, or whatever
   * survived a half-finished write. Everything restored here is validated
   * before it is trusted: a disabled entry that unlocked an addon it should
   * not, or a failure count out of range, would either hide a crashing addon
   * or keep a good one switched off forever.
   */
  describe('restoring safety state that cannot be trusted', () => {
    const write = (value: unknown) =>
      AsyncStorage.setItem(
        '@AndroidIRCX:addonSafety:v1',
        JSON.stringify(value),
      );

    const snapshotAfter = async (value: unknown) => {
      await write(value);
      const service = new AddonSafetyService();
      await service.initialize();
      return service.getSnapshot();
    };

    it.each([[null], [[]], ['nope'], [42]])(
      'ignores a stored state that is not an object (%p)',
      async stored => {
        const snapshot = await snapshotAfter(stored);
        expect(snapshot.safeMode).toBe(false);
        expect(snapshot.disabled.size).toBe(0);
        expect(snapshot.failures.size).toBe(0);
      },
    );

    it('ignores fields of the wrong shape rather than half-trusting them', async () => {
      const snapshot = await snapshotAfter({
        safeMode: 'yes',
        bootPending: 1,
        startupAddonId: 42,
        disabled: 'not a list',
        failures: { not: 'a list' },
      });

      // Only an exact `true` turns these on: a truthy string must not.
      expect(snapshot.safeMode).toBe(false);
      expect(snapshot.bootPending).toBe(false);
      expect(snapshot.startupAddonId).toBeUndefined();
      expect(snapshot.disabled.size).toBe(0);
      expect(snapshot.failures.size).toBe(0);
    });

    it('drops disabled entries that are malformed and keeps the good one', async () => {
      const good: [string, unknown] = [
        'rs.good.addon',
        { reason: 'user-disabled', disabledAt: 1700000000000 },
      ];

      const snapshot = await snapshotAfter({
        disabled: [
          good,
          'not a pair',
          [], // wrong length
          ['id', { reason: 'user-disabled', disabledAt: 1 }, 'extra'],
          ['../escape', { reason: 'user-disabled', disabledAt: 1 }],
          ['x'.repeat(200), { reason: 'user-disabled', disabledAt: 1 }],
          [42, { reason: 'user-disabled', disabledAt: 1 }],
          ['rs.a', undefined],
          ['rs.b', { reason: 'invented', disabledAt: 1 }],
          ['rs.c', { reason: 'boot-crash', disabledAt: 'soon' }],
          ['rs.d', { reason: 'repeated-failure' }],
        ],
      });

      expect([...snapshot.disabled.keys()]).toEqual(['rs.good.addon']);
    });

    it('drops failure counts that are malformed or out of range', async () => {
      const snapshot = await snapshotAfter({
        failures: [
          ['rs.good.addon', 2],
          'not a pair',
          ['rs.a'], // wrong length
          ['../escape', 1],
          ['rs.b', -1],
          ['rs.c', 99],
          ['rs.d', 1.5],
          ['rs.e', '2'],
        ],
      });

      expect([...snapshot.failures.entries()]).toEqual([['rs.good.addon', 2]]);
    });

    it('accepts every reason the app itself writes', async () => {
      const snapshot = await snapshotAfter({
        disabled: [
          ['rs.one', { reason: 'boot-crash', disabledAt: 1 }],
          ['rs.two', { reason: 'repeated-failure', disabledAt: 2 }],
          ['rs.three', { reason: 'user-disabled', disabledAt: 3 }],
        ],
      });

      expect(snapshot.disabled.size).toBe(3);
    });
  });

  describe('startup bookkeeping', () => {
    it('initializes once, however often it is asked', async () => {
      const service = new AddonSafetyService();
      await service.initialize();
      await service.setSafeMode(true);
      // A second initialize must not read the file again and undo that.
      await service.initialize();
      expect(service.getSnapshot().safeMode).toBe(true);
    });

    it('enters Safe Mode after a crash even when no addon was starting', async () => {
      const crashed = new AddonSafetyService();
      await crashed.beginStartup();
      // No beginAddonStartup: the crash happened outside any one addon.

      const recovered = new AddonSafetyService();
      const snapshot = await recovered.beginStartup();
      expect(snapshot.safeMode).toBe(true);
      expect(snapshot.disabled.size).toBe(0);
    });

    it('refuses to start an addon that Safe Mode has switched off', async () => {
      const service = new AddonSafetyService();
      await service.beginStartup();
      await service.setSafeMode(true);

      expect(await service.beginAddonStartup('rs.addon')).toBe(false);
      expect(service.getSnapshot().startupAddonId).toBeUndefined();
    });

    it('only clears the addon it was actually told started', async () => {
      const service = new AddonSafetyService();
      await service.beginStartup();
      await service.beginAddonStartup('rs.one');

      // A late completion from a different addon must not clear the marker
      // for the one that is still starting.
      await service.completeAddonStartup('rs.two');
      expect(service.getSnapshot().startupAddonId).toBe('rs.one');

      await service.completeAddonStartup('rs.one');
      expect(service.getSnapshot().startupAddonId).toBeUndefined();
    });

    it('re-enables an addon and forgets what it had counted against it', async () => {
      const service = new AddonSafetyService();
      await service.beginStartup();
      await service.disable('rs.addon');
      expect(service.shouldLoadThirdPartyAddon('rs.addon')).toBe(false);

      await service.reenable('rs.addon');
      expect(service.shouldLoadThirdPartyAddon('rs.addon')).toBe(true);
      expect(service.getSnapshot().failures.has('rs.addon')).toBe(false);
    });
  });
});

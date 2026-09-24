import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AddonPermissionDeniedError,
  AddonPermissionService,
} from '../../src/services/scripting/AddonPermissionService';
import type { AddonCapability } from '../../src/services/scripting/AddonManifest';

const declared: AddonCapability[] = ['irc.read', 'irc.send', 'irc.raw.modify'];

describe('AddonPermissionService', () => {
  beforeEach(() => {
    (AsyncStorage as any).__reset?.();
    jest.restoreAllMocks();
  });

  it('keeps declared, granted and effective permissions separate', async () => {
    const service = new AddonPermissionService();
    await service.initialize();
    expect(service.getEffectiveGrants('addon', declared)).toEqual([]);
    await service.grant('addon', declared, 'irc.read', true);
    expect(service.getEffectiveGrants('addon', declared)).toEqual(['irc.read']);
    expect(service.getEffectiveGrants('addon', ['irc.send'])).toEqual([]);
  });

  it('applies revocation immediately to persistent and session grants', async () => {
    const service = new AddonPermissionService();
    await service.initialize();
    await service.grant('addon', declared, 'irc.read', true);
    await service.grant('addon', declared, 'irc.send', false);
    await service.revoke('addon', 'irc.read');
    expect(service.isGranted('addon', declared, 'irc.read')).toBe(false);
    expect(service.isGranted('addon', declared, 'irc.send')).toBe(true);
    await service.revokeAll('addon');
    expect(service.getEffectiveGrants('addon', declared)).toEqual([]);
  });

  it('rejects undeclared and forbidden persistent grants', async () => {
    const service = new AddonPermissionService();
    await service.initialize();
    await expect(
      service.grant('addon', declared, 'network', true),
    ).rejects.toThrow('Addon did not declare permission: network.');
    await expect(
      service.grant('addon', declared, 'irc.raw.modify', true),
    ).rejects.toThrow(
      'Permission cannot be granted permanently: irc.raw.modify.',
    );
    await service.grant('addon', declared, 'irc.raw.modify', false);
    expect(service.isGranted('addon', declared, 'irc.raw.modify')).toBe(true);
  });

  it('fails closed for unknown capabilities and corrupt storage', async () => {
    await AsyncStorage.setItem(
      '@AndroidIRCX:addonPermissionGrants:v1',
      '{broken',
    );
    const service = new AddonPermissionService();
    await service.initialize();
    expect(service.isGranted('addon', declared, 'future.root')).toBe(false);
  });

  it('filters unknown and non-persistable grants loaded from storage', async () => {
    await AsyncStorage.setItem(
      '@AndroidIRCX:addonPermissionGrants:v1',
      JSON.stringify({
        addon: ['irc.send', 'irc.raw.modify', 'future.root', 42],
      }),
    );
    const service = new AddonPermissionService();
    await service.initialize();
    expect(service.getEffectiveGrants('addon', declared)).toEqual(['irc.send']);
    service.clearSession();
  });

  it('does not permit addon ids to mutate object prototypes', async () => {
    const service = new AddonPermissionService();
    await service.initialize();
    await service.grant('__proto__', declared, 'irc.read', true);
    expect(service.isGranted('__proto__', declared, 'irc.read')).toBe(true);
    expect(({} as Record<string, unknown>).ircRead).toBeUndefined();
  });

  it('provides a fail-closed enforcement boundary', async () => {
    const service = new AddonPermissionService();
    await service.initialize();
    expect(() => service.requireGrant('addon', declared, 'irc.send')).toThrow(
      AddonPermissionDeniedError,
    );
    expect(() =>
      service.requireGrant('addon', declared, 'future.root'),
    ).toThrow('Addon addon is not allowed to use future.root.');
    await service.grant('addon', declared, 'irc.send', false);
    expect(() =>
      service.requireGrant('addon', declared, 'irc.send'),
    ).not.toThrow();
  });

  it('reconciles update grants atomically against the new declaration', async () => {
    const service = new AddonPermissionService();
    await service.initialize();
    await service.grant('addon', declared, 'irc.read', true);
    await service.grant('addon', declared, 'irc.send', false);
    await service.reconcileDeclared('addon', ['irc.read']);
    expect(service.getEffectiveGrants('addon', declared)).toEqual(['irc.read']);

    jest
      .spyOn(AsyncStorage, 'setItem')
      .mockRejectedValueOnce(new Error('disk'));
    await expect(service.reconcileDeclared('addon', [])).rejects.toThrow(
      'disk',
    );
    expect(service.getEffectiveGrants('addon', declared)).toEqual(['irc.read']);
  });
});

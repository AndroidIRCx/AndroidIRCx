import AsyncStorage from '@react-native-async-storage/async-storage';
import { AddonAuditService } from '../../src/services/scripting/AddonAuditService';

describe('AddonAuditService', () => {
  beforeEach(() => (AsyncStorage as any).__reset?.());

  it('records only structured metadata without a free-form secret field', async () => {
    const service = new AddonAuditService();
    await service.initialize();
    await service.record({
      addonId: 'rs.androidircx.tools',
      capability: 'irc.send',
      action: 'send-message',
      target: 'irc-channel',
      result: 'allowed',
    });
    expect(service.list()).toEqual([
      expect.objectContaining({
        addonId: 'rs.androidircx.tools',
        action: 'send-message',
        target: 'irc-channel',
      }),
    ]);
    expect(JSON.stringify(service.list())).not.toContain('messageText');
  });

  it('rejects unsafe free-form identifiers instead of logging them', async () => {
    const service = new AddonAuditService();
    await service.initialize();
    await service.record({
      addonId: 'addon\nsecret=value',
      capability: 'network',
      action: 'GET?token=secret',
      target: 'public-network',
      result: 'denied',
    });
    expect(service.list()).toEqual([]);
  });

  it('filters corrupt stored values and supports addon-scoped clearing', async () => {
    await AsyncStorage.setItem(
      '@AndroidIRCX:addonAudit:v1',
      JSON.stringify([
        { bad: true },
        {
          id: 'poison',
          timestamp: 1,
          addonId: 'addon',
          capability: 'future.root',
          action: 'GET?token=secret',
          target: 'https://secret',
          result: 'allowed',
        },
      ]),
    );
    const service = new AddonAuditService();
    await service.initialize();
    await service.record({
      addonId: 'one',
      capability: 'tabs.read',
      action: 'list',
      target: 'tab',
      result: 'allowed',
    });
    await service.record({
      addonId: 'two',
      capability: 'tabs.read',
      action: 'list',
      target: 'tab',
      result: 'allowed',
    });
    await service.clear('one');
    expect(service.list().map(entry => entry.addonId)).toEqual(['two']);
  });

  it('does not throw when persistence fails', async () => {
    const service = new AddonAuditService();
    await service.initialize();
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
      new Error('disk'),
    );
    await expect(
      service.record({
        addonId: 'addon',
        capability: 'irc.read',
        action: 'observe',
        target: 'irc-network',
        result: 'allowed',
      }),
    ).resolves.toBeUndefined();
    expect(service.list()).toHaveLength(1);
  });
});

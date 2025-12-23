import type { IRCNetworkConfig } from '../src/services/SettingsService';
import { settingsService } from '../src/services/SettingsService';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('SettingsService', () => {
  beforeEach(() => {
    (AsyncStorage as any).__reset();
    // Reset in-memory networks to avoid cross-test leakage
    (settingsService as any).networks = [];
  });

  it('creates default DBase network when storage is empty', async () => {
    const networks = await settingsService.loadNetworks();

    expect(networks.length).toBe(1);
    const defaultNet = networks[0];
    expect(defaultNet.name).toBe('DBase');
    expect(defaultNet.servers[0]).toMatchObject({
      hostname: 'irc.dbase.in.rs',
      port: 6697,
      ssl: true,
    });

    expect((AsyncStorage as any).setItem).toHaveBeenCalledWith(
      '@AndroidIRCX:networks',
      expect.any(String)
    );
  });

  it('persists added networks and can retrieve them', async () => {
    await settingsService.loadNetworks();

    const newNetwork: IRCNetworkConfig = {
      id: 'test-net',
      name: 'TestNet',
      nick: 'tester',
      realname: 'Test User',
      servers: [
        {
          id: 'srv-1',
          hostname: 'irc.test.net',
          port: 6697,
          ssl: true,
        },
      ],
    };

    await settingsService.addNetwork(newNetwork);

    const networks = await settingsService.loadNetworks();
    const found = networks.find(n => n.id === 'test-net');

    expect(found).toBeTruthy();
    expect(found?.servers[0].hostname).toBe('irc.test.net');

    const fetched = await settingsService.getNetwork('test-net');
    expect(fetched?.name).toBe('TestNet');
  });

  it('updates and deletes servers inside a network', async () => {
    const baseNetwork: IRCNetworkConfig = {
      id: 'custom',
      name: 'CustomNet',
      nick: 'nick',
      realname: 'Real Name',
      servers: [
        {
          id: 'srv-1',
          hostname: 'irc.custom.net',
          port: 6667,
          ssl: false,
        },
      ],
    };

    // Seed storage so loadNetworks starts with our custom network
    (AsyncStorage as any).__STORE.set('@AndroidIRCX:networks', JSON.stringify([baseNetwork]));
    const networks = await settingsService.loadNetworks();
    expect(networks.find(n => n.id === 'custom')).toBeTruthy();

    await settingsService.updateServerInNetwork('custom', 'srv-1', { port: 6697, ssl: true });
    const updated = await settingsService.getNetwork('custom');
    expect(updated?.servers[0]).toMatchObject({ port: 6697, ssl: true });

    await settingsService.deleteServerFromNetwork('custom', 'srv-1');
    const afterDelete = await settingsService.getNetwork('custom');
    // ensureDefaults re-adds a placeholder server when none exist
    expect(afterDelete?.servers.length).toBeGreaterThanOrEqual(1);
  });

  it('notifies listeners on setting change and supports unsubscribe', async () => {
    const callback = jest.fn();
    const unsubscribe = settingsService.onSettingChange('theme', callback);

    await settingsService.setSetting('theme', 'dark');
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('dark');

    unsubscribe();
    await settingsService.setSetting('theme', 'light');
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('marks the default server as favorite by default', async () => {
    const networks = await settingsService.loadNetworks();
    const defaultNet = networks.find(n => n.name === 'DBase');
    expect(defaultNet?.servers[0].favorite).toBe(true);
  });

  it('enforces a single favorite server per network', async () => {
    const baseNetwork: IRCNetworkConfig = {
      id: 'fav-test',
      name: 'FavTest',
      nick: 'nick',
      realname: 'Real Name',
      servers: [
        { id: 'srv-1', hostname: 'one.example', port: 6697, ssl: true, favorite: true },
        { id: 'srv-2', hostname: 'two.example', port: 6697, ssl: true },
      ],
    };

    (AsyncStorage as any).__STORE.set('@AndroidIRCX:networks', JSON.stringify([baseNetwork]));
    await settingsService.loadNetworks();

    await settingsService.updateServerInNetwork('fav-test', 'srv-2', { favorite: true });
    const updated = await settingsService.getNetwork('fav-test');

    expect(updated?.servers.find(s => s.id === 'srv-2')?.favorite).toBe(true);
    expect(updated?.servers.find(s => s.id === 'srv-1')?.favorite).toBe(false);
  });

  it('resets other favorites when adding a new favorite server', async () => {
    const baseNetwork: IRCNetworkConfig = {
      id: 'fav-add',
      name: 'FavAdd',
      nick: 'nick',
      realname: 'Real Name',
      servers: [{ id: 'srv-1', hostname: 'one.example', port: 6697, ssl: true, favorite: true }],
    };

    (AsyncStorage as any).__STORE.set('@AndroidIRCX:networks', JSON.stringify([baseNetwork]));
    await settingsService.loadNetworks();

    await settingsService.addServerToNetwork('fav-add', {
      id: 'srv-2',
      hostname: 'two.example',
      port: 6697,
      ssl: true,
      favorite: true,
    });

    const updated = await settingsService.getNetwork('fav-add');
    expect(updated?.servers.find(s => s.id === 'srv-2')?.favorite).toBe(true);
    expect(updated?.servers.find(s => s.id === 'srv-1')?.favorite).toBe(false);
  });

  it('disables the global proxy by default', async () => {
    const cfg = await settingsService.getSetting('globalProxy', { enabled: false } as any);
    expect(cfg.enabled).toBe(false);
  });

  it('persists global proxy enable toggles and host/port', async () => {
    await settingsService.setSetting('globalProxy', {
      enabled: true,
      type: 'socks5',
      host: '127.0.0.1',
      port: 9050,
    } as any);

    const cfg = await settingsService.getSetting('globalProxy', { enabled: false } as any);
    expect(cfg.enabled).toBe(true);
    expect(cfg.host).toBe('127.0.0.1');
    expect(cfg.port).toBe(9050);
  });
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import { channelFavoritesService } from '../src/services/ChannelFavoritesService';

describe('ChannelFavoritesService', () => {
  beforeEach(() => {
    (AsyncStorage as any).__reset();
    // reset internal state
    (channelFavoritesService as any).favorites = new Map();
    (channelFavoritesService as any).listeners = [];
  });

  it('adds, updates, and removes favorites', async () => {
    await channelFavoritesService.addFavorite('net1', '#chan', 'key', true);
    expect(channelFavoritesService.isFavorite('net1', '#chan')).toBe(true);
    expect(channelFavoritesService.getFavorites('net1')[0]).toMatchObject({ key: 'key', autoJoin: true });

    await channelFavoritesService.addFavorite('net1', '#chan', 'newkey', false);
    expect(channelFavoritesService.getFavorites('net1')[0]).toMatchObject({ key: 'newkey', autoJoin: false });

    await channelFavoritesService.removeFavorite('net1', '#chan');
    expect(channelFavoritesService.isFavorite('net1', '#chan')).toBe(false);
  });

  it('moves favorites between networks preserving data', async () => {
    await channelFavoritesService.addFavorite('net1', '#chan', 'key', true);
    await channelFavoritesService.moveFavorite('net1', '#chan', 'net2');

    expect(channelFavoritesService.isFavorite('net1', '#chan')).toBe(false);
    const moved = channelFavoritesService.getFavorites('net2')[0];
    expect(moved).toMatchObject({ name: '#chan', network: 'net2', key: 'key', autoJoin: true });
  });

  it('toggles autoJoin and key updates', async () => {
    await channelFavoritesService.addFavorite('net', '#chan', undefined, false);
    await channelFavoritesService.setAutoJoin('net', '#chan', true);
    expect(channelFavoritesService.getAutoJoinChannels('net')[0]?.autoJoin).toBe(true);

    await channelFavoritesService.updateFavoriteKey('net', '#chan', 'pass');
    expect(channelFavoritesService.getFavorites('net')[0].key).toBe('pass');
  });

  it('initializes from storage and returns auto-join only entries', async () => {
    const seed = new Map([
      ['net', [{ name: '#a', network: 'net', autoJoin: true, addedAt: 1 }, { name: '#b', network: 'net', autoJoin: false, addedAt: 2 }]],
    ]);
    (AsyncStorage as any).__STORE.set('@AndroidIRCX:channelFavorites', JSON.stringify(Object.fromEntries(seed)));

    await channelFavoritesService.initialize();

    const autoJoin = channelFavoritesService.getAutoJoinChannels('net');
    expect(autoJoin).toHaveLength(1);
    expect(autoJoin[0].name).toBe('#a');
  });

  it('notifies listeners on change', async () => {
    const spy = jest.fn();
    const unsub = channelFavoritesService.onFavoritesChange(spy);

    await channelFavoritesService.addFavorite('net', '#chan');
    expect(spy).toHaveBeenCalledWith('net', expect.any(Array));

    unsub();
    await channelFavoritesService.addFavorite('net', '#other');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('gracefully handles toggles and key updates for missing favorites', async () => {
    // No favorites exist yet; these should not throw
    await expect(channelFavoritesService.setAutoJoin('net', '#missing', true)).resolves.not.toThrow();
    await expect(channelFavoritesService.updateFavoriteKey('net', '#missing', 'k')).resolves.not.toThrow();
    expect(channelFavoritesService.getFavorites('net')).toHaveLength(0);
  });

  it('getAllFavorites returns a copy of internal map', async () => {
    await channelFavoritesService.addFavorite('net', '#chan');
    const all = channelFavoritesService.getAllFavorites();
    const copyFromAll = all.get('net')!;
    copyFromAll.push({ name: '#mutated', network: 'net', addedAt: Date.now() });

    // internal data should remain untouched when mutating the map value
    const fresh = channelFavoritesService.getFavorites('net');
    expect(fresh.find(f => f.name === '#mutated')).toBeUndefined();

    // mutating the favorites array returned by getFavorites should not persist
    const favs = channelFavoritesService.getFavorites('net');
    favs.push({ name: '#another', network: 'net', addedAt: Date.now() });
    const freshAgain = channelFavoritesService.getFavorites('net');
    expect(freshAgain.find(f => f.name === '#another')).toBeUndefined();
  });
});

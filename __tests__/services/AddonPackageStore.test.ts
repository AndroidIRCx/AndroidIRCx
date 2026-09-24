import AsyncStorage from '@react-native-async-storage/async-storage';
import { strToU8, zipSync } from 'fflate';
import {
  AddonPackageStore,
  AddonPackageStoreError,
  type AddonPackageFileStore,
} from '../../src/services/scripting/AddonPackageStore';
import { readAddonPackage } from '../../src/services/scripting/AddonPackageReader';

const manifest = (version: string) => ({
  id: 'rs.androidircx.store-test',
  name: 'Store Test',
  author: 'AndroidIRCX',
  version,
  description: 'Package store test.',
  license: 'GPL-3.0-or-later',
  apiVersion: 1,
  minAppVersion: '1.10.0',
  entry: 'main.js',
  permissions: ['irc.read'],
});

const createPackage = (version: string) => {
  const bytes = zipSync({
    'manifest.json': strToU8(JSON.stringify(manifest(version))),
    'main.js': strToU8(`module.exports = { version: '${version}' };`),
  });
  return { bytes, verified: readAddonPackage(bytes) };
};

function createFiles(): AddonPackageFileStore & {
  data: Map<string, Uint8Array>;
} {
  const data = new Map<string, Uint8Array>();
  return {
    data,
    write: jest.fn(async (path, bytes) => data.set(path, bytes.slice())),
    read: jest.fn(async path => data.get(path)?.slice() ?? new Uint8Array()),
    exists: jest.fn(async path => data.has(path)),
    remove: jest.fn(async path => {
      data.delete(path);
    }),
  };
}

describe('AddonPackageStore', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.restoreAllMocks();
  });

  it('keeps immutable active and previous packages and rolls back by pointer', async () => {
    const files = createFiles();
    const store = new AddonPackageStore(files, '/private/addons');
    const first = createPackage('1.0.0');
    const second = createPackage('1.1.0');

    const installed = await store.install(first.verified, first.bytes);
    const updated = await store.install(second.verified, second.bytes);
    expect(updated.previousChecksum).toBe(installed.activeChecksum);
    expect(files.data.size).toBe(2);

    const rolledBack = await store.rollback(first.verified.manifest.id);
    expect(rolledBack.manifest.version).toBe('1.0.0');
    expect(rolledBack.previousManifest?.version).toBe('1.1.0');
    expect(files.data.size).toBe(2);
  });

  it('does not change the active pointer when metadata persistence fails', async () => {
    const files = createFiles();
    const store = new AddonPackageStore(files, '/private/addons');
    const first = createPackage('1.0.0');
    const second = createPackage('1.1.0');
    await store.install(first.verified, first.bytes);
    jest
      .spyOn(AsyncStorage, 'setItem')
      .mockRejectedValueOnce(new Error('disk'));

    await expect(store.install(second.verified, second.bytes)).rejects.toThrow(
      'disk',
    );
    expect(store.get(first.verified.manifest.id)?.manifest.version).toBe(
      '1.0.0',
    );
  });

  it('rejects bytes that differ from the reviewed package', async () => {
    const files = createFiles();
    const store = new AddonPackageStore(files, '/private/addons');
    const first = createPackage('1.0.0');

    await expect(
      store.install(first.verified, new Uint8Array([1, 2, 3])),
    ).rejects.toBeInstanceOf(AddonPackageStoreError);
    expect(files.data.size).toBe(0);
  });

  it('loads and re-verifies the active immutable package', async () => {
    const files = createFiles();
    const store = new AddonPackageStore(files, '/private/addons');
    const first = createPackage('1.0.0');
    await store.install(first.verified, first.bytes);

    await expect(
      store.loadActive(first.verified.manifest.id),
    ).resolves.toMatchObject({
      checksumSha256: first.verified.checksumSha256,
      manifest: { version: '1.0.0' },
    });
    const path = store.packagePath(
      first.verified.manifest.id,
      first.verified.checksumSha256,
    );
    files.data.set(path, new Uint8Array([1, 2, 3]));
    await expect(
      store.loadActive(first.verified.manifest.id),
    ).rejects.toThrow();
  });

  it('fails closed on corrupt registry metadata', async () => {
    await AsyncStorage.setItem(
      '@AndroidIRCX:addonPackages:v1',
      JSON.stringify({ addons: [{ activeChecksum: '../bad' }] }),
    );
    const store = new AddonPackageStore(createFiles(), '/private/addons');

    await expect(store.initialize()).rejects.toThrow(
      'Addon package registry is corrupt.',
    );
  });

  it('uninstalls only exact checksum paths owned by the addon', async () => {
    const files = createFiles();
    const store = new AddonPackageStore(files, '/private/addons');
    const first = createPackage('1.0.0');
    const second = createPackage('1.1.0');
    await store.install(first.verified, first.bytes);
    await store.install(second.verified, second.bytes);

    await store.uninstall(first.verified.manifest.id);
    expect(store.get(first.verified.manifest.id)).toBeUndefined();
    expect(files.data.size).toBe(0);
    expect(files.remove).toHaveBeenCalledTimes(2);
  });
});

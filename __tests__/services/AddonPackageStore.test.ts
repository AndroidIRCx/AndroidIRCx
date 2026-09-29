import AsyncStorage from '@react-native-async-storage/async-storage';
const mockRnfsWriteFile = jest.fn(async () => undefined);
const mockRnfsReadFile = jest.fn(async () => '');
const mockRnfsExists = jest.fn(async () => false);
const mockRnfsMkdir = jest.fn(async () => undefined);
const mockRnfsUnlink = jest.fn(async () => undefined);

// The shared setup's react-native-fs stub has no mkdir/writeFile, and the
// default file store needs both to be exercised at all.
jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/mock/documents',
  writeFile: (...args: unknown[]) => mockRnfsWriteFile(...(args as [])),
  readFile: (...args: unknown[]) => mockRnfsReadFile(...(args as [])),
  exists: (...args: unknown[]) => mockRnfsExists(...(args as [])),
  mkdir: (...args: unknown[]) => mockRnfsMkdir(...(args as [])),
  unlink: (...args: unknown[]) => mockRnfsUnlink(...(args as [])),
}));

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

  describe('path safety', () => {
    it('refuses an id or a checksum that could escape the addon directory', () => {
      const store = new AddonPackageStore(createFiles(), '/private/addons');
      const good = 'a'.repeat(64);
      expect(() => store.packagePath('../etc', good)).toThrow(
        AddonPackageStoreError,
      );
      expect(() => store.packagePath('rs.demo', '../secret')).toThrow(
        AddonPackageStoreError,
      );
      expect(() => store.packagePath('rs.demo', 'NOTHEX'.repeat(10))).toThrow(
        AddonPackageStoreError,
      );
      expect(store.packagePath('rs.demo', good)).toBe(
        `/private/addons/rs.demo/${good}.ircx-addon`,
      );
    });
  });

  describe('rollback refusals', () => {
    it('refuses when nothing was installed before', async () => {
      const files = createFiles();
      const store = new AddonPackageStore(files, '/private/addons');
      const first = createPackage('1.0.0');
      await store.install(first.verified, first.bytes);

      await expect(store.rollback(first.verified.manifest.id)).rejects.toThrow(
        'No previous addon package is available.',
      );
    });

    it('refuses when the previous blob is gone from disk', async () => {
      const files = createFiles();
      const store = new AddonPackageStore(files, '/private/addons');
      const first = createPackage('1.0.0');
      const second = createPackage('1.1.0');
      await store.install(first.verified, first.bytes);
      await store.install(second.verified, second.bytes);

      files.data.delete(
        store.packagePath(
          first.verified.manifest.id,
          first.verified.checksumSha256,
        ),
      );
      await expect(store.rollback(first.verified.manifest.id)).rejects.toThrow(
        'Previous addon package is missing.',
      );
      // The pointer is untouched, so the working version still loads.
      expect(store.get(first.verified.manifest.id)?.manifest.version).toBe(
        '1.1.0',
      );
    });
  });

  describe('loadActive refusals', () => {
    it('refuses an addon that is not installed', async () => {
      const store = new AddonPackageStore(createFiles(), '/private/addons');
      await expect(store.loadActive('rs.androidircx.absent')).rejects.toThrow(
        'Addon package is not installed.',
      );
    });

    it('refuses when the active blob is missing', async () => {
      const files = createFiles();
      const store = new AddonPackageStore(files, '/private/addons');
      const first = createPackage('1.0.0');
      await store.install(first.verified, first.bytes);
      files.data.clear();

      await expect(
        store.loadActive(first.verified.manifest.id),
      ).rejects.toThrow('Active addon package is missing.');
    });

    it('refuses a blob whose contents are a different, valid package', async () => {
      const files = createFiles();
      const store = new AddonPackageStore(files, '/private/addons');
      const first = createPackage('1.0.0');
      const second = createPackage('1.1.0');
      await store.install(first.verified, first.bytes);
      // The path still claims the 1.0.0 checksum, but the bytes are 1.1.0.
      files.data.set(
        store.packagePath(
          first.verified.manifest.id,
          first.verified.checksumSha256,
        ),
        second.bytes,
      );

      await expect(
        store.loadActive(first.verified.manifest.id),
      ).rejects.toThrow('failed integrity verification');
    });
  });

  describe('uninstall', () => {
    it('does nothing for an addon that was never installed', async () => {
      const files = createFiles();
      const store = new AddonPackageStore(files, '/private/addons');
      await store.uninstall('rs.androidircx.absent');
      expect(files.remove).not.toHaveBeenCalled();
    });
  });

  describe('restoring the registry', () => {
    const write = (value: unknown) =>
      AsyncStorage.setItem(
        '@AndroidIRCX:addonPackages:v1',
        JSON.stringify(value),
      );

    it('reads back what it wrote', async () => {
      const files = createFiles();
      const first = createPackage('1.0.0');
      await new AddonPackageStore(files, '/private/addons').install(
        first.verified,
        first.bytes,
      );

      const reopened = new AddonPackageStore(createFiles(), '/private/addons');
      await reopened.initialize();
      expect(reopened.list()).toHaveLength(1);
      expect(reopened.get(first.verified.manifest.id)?.manifest.version).toBe(
        '1.0.0',
      );
      // A second initialize is a no-op rather than a second read.
      await reopened.initialize();
      expect(reopened.list()).toHaveLength(1);
    });

    it('starts empty when nothing was ever stored', async () => {
      const store = new AddonPackageStore(createFiles(), '/private/addons');
      await store.initialize();
      expect(store.list()).toEqual([]);
    });

    it('refuses a registry that is not an object with an addons array', async () => {
      for (const corrupt of [null, [], 'nope', { addons: 'no' }, {}]) {
        await write(corrupt);
        const store = new AddonPackageStore(createFiles(), '/private/addons');
        await expect(store.initialize()).rejects.toThrow(
          'Addon package registry is corrupt.',
        );
      }
    });

    it('refuses a duplicate addon id', async () => {
      const files = createFiles();
      const first = createPackage('1.0.0');
      const store = new AddonPackageStore(files, '/private/addons');
      await store.install(first.verified, first.bytes);
      const raw = JSON.parse(
        (await AsyncStorage.getItem('@AndroidIRCX:addonPackages:v1')) ?? '{}',
      );
      await write({ addons: [raw.addons[0], raw.addons[0]] });

      await expect(
        new AddonPackageStore(createFiles(), '/private/addons').initialize(),
      ).rejects.toThrow('Addon package registry is corrupt.');
    });

    it('refuses a record whose previous half is inconsistent', async () => {
      const files = createFiles();
      const first = createPackage('1.0.0');
      const store = new AddonPackageStore(files, '/private/addons');
      await store.install(first.verified, first.bytes);
      const raw = JSON.parse(
        (await AsyncStorage.getItem('@AndroidIRCX:addonPackages:v1')) ?? '{}',
      );
      // A previous checksum with no previous manifest behind it.
      await write({
        addons: [{ ...raw.addons[0], previousChecksum: 'b'.repeat(64) }],
      });

      await expect(
        new AddonPackageStore(createFiles(), '/private/addons').initialize(),
      ).rejects.toThrow('Addon package registry is corrupt.');
    });

    it('refuses a record with no timestamps', async () => {
      const files = createFiles();
      const first = createPackage('1.0.0');
      await new AddonPackageStore(files, '/private/addons').install(
        first.verified,
        first.bytes,
      );
      const raw = JSON.parse(
        (await AsyncStorage.getItem('@AndroidIRCX:addonPackages:v1')) ?? '{}',
      );
      await write({ addons: [{ ...raw.addons[0], installedAt: 'soon' }] });

      await expect(
        new AddonPackageStore(createFiles(), '/private/addons').initialize(),
      ).rejects.toThrow('Addon package registry is corrupt.');
    });
  });

  describe('the default file store, on RNFS', () => {
    it('round-trips package bytes through base64', async () => {
      const store = new AddonPackageStore(undefined, '/private/addons');
      const first = createPackage('1.0.0');
      mockRnfsExists.mockResolvedValue(false);

      await store.install(first.verified, first.bytes);
      expect(mockRnfsMkdir).toHaveBeenCalledWith(
        `/private/addons/${first.verified.manifest.id}`,
      );

      const [, base64] = mockRnfsWriteFile.mock.calls[0];
      mockRnfsExists.mockResolvedValue(true);
      mockRnfsReadFile.mockResolvedValue(base64);

      const loaded = await store.loadActive(first.verified.manifest.id);
      expect(loaded.checksumSha256).toBe(first.verified.checksumSha256);
      expect(loaded.manifest.version).toBe('1.0.0');
    });

    it('encodes both padding lengths', async () => {
      const store = new AddonPackageStore(undefined, '/private/addons');
      const first = createPackage('1.0.0');
      mockRnfsExists.mockResolvedValue(false);
      await store.install(first.verified, first.bytes);
      const [, base64] = mockRnfsWriteFile.mock.calls[0] as [string, string];
      expect(/^[A-Za-z0-9+/]+={0,2}$/.test(base64)).toBe(true);
      expect(base64.length % 4).toBe(0);
    });

    it('refuses stored bytes that are not valid base64', async () => {
      const store = new AddonPackageStore(undefined, '/private/addons');
      const first = createPackage('1.0.0');
      mockRnfsExists.mockResolvedValue(false);
      await store.install(first.verified, first.bytes);

      mockRnfsExists.mockResolvedValue(true);
      mockRnfsReadFile.mockResolvedValue('not base64!!');
      await expect(
        store.loadActive(first.verified.manifest.id),
      ).rejects.toThrow('not valid base64');
    });

    it('removes a blob only when it is there', async () => {
      const store = new AddonPackageStore(undefined, '/private/addons');
      const first = createPackage('1.0.0');
      mockRnfsExists.mockResolvedValue(false);
      await store.install(first.verified, first.bytes);

      mockRnfsUnlink.mockClear();
      mockRnfsExists.mockResolvedValue(false);
      await store.uninstall(first.verified.manifest.id);
      expect(mockRnfsUnlink).not.toHaveBeenCalled();
    });

    it('skips the write when the immutable blob is already on disk', async () => {
      const store = new AddonPackageStore(undefined, '/private/addons');
      const first = createPackage('1.0.0');
      mockRnfsExists.mockResolvedValue(true);
      mockRnfsWriteFile.mockClear();

      await store.install(first.verified, first.bytes);
      expect(mockRnfsWriteFile).not.toHaveBeenCalled();
    });
  });
});

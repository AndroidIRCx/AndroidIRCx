import AsyncStorage from '@react-native-async-storage/async-storage';
import { strToU8, zipSync } from 'fflate';
import {
  AddonInstallBlockedError,
  AddonInstallerService,
  type AddonInstallPermissionBoundary,
  type AddonInstallConfigBoundary,
} from '../../src/services/scripting/AddonInstallerService';
import {
  AddonPackageStore,
  type AddonPackageFileStore,
} from '../../src/services/scripting/AddonPackageStore';

const packageBytes = (version: string, permissions = ['irc.read']) =>
  zipSync({
    'manifest.json': strToU8(
      JSON.stringify({
        id: 'rs.androidircx.installer-test',
        name: 'Installer Test',
        author: 'AndroidIRCX',
        version,
        description: 'Installer orchestration test.',
        license: 'GPL-3.0-or-later',
        apiVersion: 1,
        minAppVersion: '1.10.0',
        entry: 'main.js',
        permissions,
      }),
    ),
    'main.js': strToU8(`module.exports = { version: '${version}' };`),
  });

function dependencies() {
  const data = new Map<string, Uint8Array>();
  const files: AddonPackageFileStore = {
    write: jest.fn(async (path, bytes) => data.set(path, bytes.slice())),
    read: jest.fn(async path => data.get(path)?.slice() ?? new Uint8Array()),
    exists: jest.fn(async path => data.has(path)),
    remove: jest.fn(async path => {
      data.delete(path);
    }),
  };
  const permissions: jest.Mocked<AddonInstallPermissionBoundary> = {
    reconcileDeclared: jest.fn().mockResolvedValue(undefined),
  };
  const config: jest.Mocked<AddonInstallConfigBoundary> = {
    snapshot: jest.fn().mockResolvedValue(undefined),
  };
  return {
    store: new AddonPackageStore(files, '/private/addons'),
    permissions,
    config,
  };
}

describe('AddonInstallerService', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('parses unsigned packages but blocks confirmation outside Developer Mode', async () => {
    const { store, permissions, config } = dependencies();
    const service = new AddonInstallerService(store, permissions, config);
    const prepared = await service.prepare(packageBytes('1.0.0'), {
      developerMode: false,
    });

    expect(prepared.review.signatureStatus).toBe('unsigned');
    expect(prepared.review.canInstall).toBe(false);
    await expect(service.confirm(prepared)).rejects.toBeInstanceOf(
      AddonInstallBlockedError,
    );
    expect(store.list()).toHaveLength(0);
  });

  it('installs only after explicit confirmation and consumes the session once', async () => {
    const { store, permissions, config } = dependencies();
    const service = new AddonInstallerService(store, permissions, config);
    const prepared = await service.prepare(packageBytes('1.0.0'), {
      developerMode: true,
    });

    expect(store.list()).toHaveLength(0);
    await expect(service.confirm(prepared)).resolves.toMatchObject({
      manifest: { version: '1.0.0' },
    });
    await expect(service.confirm(prepared)).rejects.toThrow(
      'already been used',
    );
  });

  it('shows newly requested permissions and revokes removed update grants', async () => {
    const { store, permissions, config } = dependencies();
    const service = new AddonInstallerService(store, permissions, config);
    await service.confirm(
      await service.prepare(packageBytes('1.0.0', ['irc.read', 'irc.send']), {
        developerMode: true,
      }),
    );

    const update = await service.prepare(
      packageBytes('1.1.0', ['irc.read', 'notifications']),
      { developerMode: true },
    );
    expect(
      update.review.permissions.find(
        permission => permission.capability === 'notifications',
      )?.isNew,
    ).toBe(true);
    await service.confirm(update);
    expect(config.snapshot).toHaveBeenCalledWith(
      'rs.androidircx.installer-test',
      expect.stringMatching(/^[0-9a-f]{64}$/),
    );
    expect(permissions.reconcileDeclared).toHaveBeenCalledWith(
      'rs.androidircx.installer-test',
      ['irc.read', 'notifications'],
    );
  });

  it('rolls the package pointer back when permission reconciliation fails', async () => {
    const { store, permissions, config } = dependencies();
    const service = new AddonInstallerService(store, permissions, config);
    await service.confirm(
      await service.prepare(packageBytes('1.0.0', ['irc.read']), {
        developerMode: true,
      }),
    );
    permissions.reconcileDeclared.mockRejectedValueOnce(new Error('disk'));
    const update = await service.prepare(
      packageBytes('1.1.0', ['notifications']),
      { developerMode: true },
    );

    await expect(service.confirm(update)).rejects.toThrow('disk');
    expect(store.get('rs.androidircx.installer-test')?.manifest.version).toBe(
      '1.0.0',
    );
  });

  it('owns a byte copy so caller mutation cannot change reviewed content', async () => {
    const { store, permissions, config } = dependencies();
    const service = new AddonInstallerService(store, permissions, config);
    const bytes = packageBytes('1.0.0');
    const prepared = await service.prepare(bytes, { developerMode: true });
    bytes.fill(0);

    await expect(service.confirm(prepared)).resolves.toMatchObject({
      manifest: { version: '1.0.0' },
    });
  });

  it('does not activate an update when its configuration snapshot fails', async () => {
    const { store, permissions, config } = dependencies();
    const service = new AddonInstallerService(store, permissions, config);
    await service.confirm(
      await service.prepare(packageBytes('1.0.0'), { developerMode: true }),
    );
    config.snapshot.mockRejectedValueOnce(new Error('snapshot failed'));

    await expect(
      service.confirm(
        await service.prepare(packageBytes('1.1.0'), { developerMode: true }),
      ),
    ).rejects.toThrow('snapshot failed');
    expect(store.get('rs.androidircx.installer-test')?.manifest.version).toBe(
      '1.0.0',
    );
  });
});

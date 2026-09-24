import { strToU8, zipSync } from 'fflate';
import { AddonLifecycleService } from '../../src/services/scripting/AddonLifecycleService';
import { readAddonPackage } from '../../src/services/scripting/AddonPackageReader';

const bytes = zipSync({
  'manifest.json': strToU8(
    JSON.stringify({
      id: 'rs.androidircx.lifecycle-test',
      name: 'Lifecycle Test',
      author: 'AndroidIRCX',
      version: '1.0.0',
      description: 'Lifecycle test.',
      license: 'GPL-3.0-or-later',
      apiVersion: 1,
      minAppVersion: '1.10.0',
      entry: 'main.js',
      permissions: [],
    }),
  ),
  'main.js': strToU8('module.exports = { onStart() {} };'),
});
const verified = readAddonPackage(bytes);
const record = {
  manifest: verified.manifest,
  activeChecksum: verified.checksumSha256,
  installedAt: 1,
  updatedAt: 1,
};

function dependencies() {
  const packages = {
    initialize: jest.fn().mockResolvedValue(undefined),
    list: jest.fn().mockReturnValue([record]),
    loadActive: jest.fn().mockResolvedValue(verified),
  };
  const runtimes = {
    start: jest.fn().mockResolvedValue(true),
    stop: jest.fn().mockResolvedValue(undefined),
    stopAll: jest.fn().mockResolvedValue(undefined),
    invoke: jest.fn().mockResolvedValue({ resultJson: '[]' }),
  };
  const safety = {
    shouldLoadThirdPartyAddon: jest.fn().mockReturnValue(true),
    recordFailure: jest.fn().mockResolvedValue(false),
  };
  const events = {
    register: jest.fn().mockResolvedValue(jest.fn()),
    clear: jest.fn(),
  };
  return { packages, runtimes, safety, events };
}

describe('AddonLifecycleService', () => {
  it('does not read or compile packages while their addon is disabled', async () => {
    const deps = dependencies();
    deps.safety.shouldLoadThirdPartyAddon.mockReturnValue(false);
    const service = new AddonLifecycleService(
      deps.packages,
      deps.runtimes,
      deps.safety,
      deps.events,
    );

    await expect(service.startInstalled()).resolves.toEqual([
      { addonId: verified.manifest.id, started: false },
    ]);
    expect(deps.packages.loadActive).not.toHaveBeenCalled();
    expect(deps.runtimes.start).not.toHaveBeenCalled();
  });

  it('re-verifies storage and sends only entry source into the runtime', async () => {
    const deps = dependencies();
    const service = new AddonLifecycleService(
      deps.packages,
      deps.runtimes,
      deps.safety,
      deps.events,
    );

    await expect(service.startInstalled()).resolves.toEqual([
      { addonId: verified.manifest.id, started: true },
    ]);
    expect(deps.runtimes.start).toHaveBeenCalledWith(
      expect.objectContaining({
        addonId: verified.manifest.id,
        filename: 'main.js',
        source: 'module.exports = { onStart() {} };',
      }),
    );
    expect(deps.runtimes.invoke).toHaveBeenCalledWith(verified.manifest.id, {
      hook: '__androidircxSubscriptions',
      payloadJson: '{}',
    });
  });

  it('records package integrity failures without starting native code', async () => {
    const deps = dependencies();
    deps.packages.loadActive.mockRejectedValue(new Error('integrity'));
    const service = new AddonLifecycleService(
      deps.packages,
      deps.runtimes,
      deps.safety,
      deps.events,
    );

    await expect(service.startInstalled()).resolves.toEqual([
      {
        addonId: verified.manifest.id,
        started: false,
        error: 'integrity',
      },
    ]);
    expect(deps.safety.recordFailure).toHaveBeenCalledWith(
      verified.manifest.id,
    );
    expect(deps.runtimes.start).not.toHaveBeenCalled();
  });

  it('starts and stops one installed addon on demand', async () => {
    const deps = dependencies();
    const service = new AddonLifecycleService(
      deps.packages,
      deps.runtimes,
      deps.safety,
      deps.events,
    );

    await expect(service.startOne(verified.manifest.id)).resolves.toEqual({
      addonId: verified.manifest.id,
      started: true,
    });
    await service.stop(verified.manifest.id);
    expect(deps.runtimes.stop).toHaveBeenCalledWith(verified.manifest.id);
    expect(deps.events.clear).toHaveBeenCalledWith(verified.manifest.id);
  });

  it('registers declarative api.events.on subscriptions after runtime start', async () => {
    const deps = dependencies();
    deps.runtimes.invoke.mockResolvedValue({
      resultJson: JSON.stringify([
        { hook: '__event0', filter: { event: 'irc.message', notSelf: true } },
      ]),
    });
    const service = new AddonLifecycleService(
      deps.packages,
      deps.runtimes,
      deps.safety,
      deps.events,
    );

    await expect(service.startOne(verified.manifest.id)).resolves.toEqual({
      addonId: verified.manifest.id,
      started: true,
    });
    expect(deps.events.register).toHaveBeenCalledWith(
      verified.manifest.id,
      '__event0',
      { event: 'irc.message', notSelf: true },
    );
  });

  it('stops the runtime when subscription metadata is invalid', async () => {
    const deps = dependencies();
    deps.runtimes.invoke.mockResolvedValue({ resultJson: '{"bad":true}' });
    const service = new AddonLifecycleService(
      deps.packages,
      deps.runtimes,
      deps.safety,
      deps.events,
    );

    await expect(service.startOne(verified.manifest.id)).resolves.toEqual(
      expect.objectContaining({ started: false }),
    );
    expect(deps.events.clear).toHaveBeenCalledWith(verified.manifest.id);
    expect(deps.runtimes.stop).toHaveBeenCalledWith(verified.manifest.id);
  });
});

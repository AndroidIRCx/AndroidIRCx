/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

const mockPackages = {
  initialize: jest.fn(),
  list: jest.fn(),
  rollback: jest.fn(),
  uninstall: jest.fn(),
  loadActive: jest.fn(),
  get: jest.fn(),
};
const mockSafety = {
  initialize: jest.fn(),
  getSnapshot: jest.fn(),
  reenable: jest.fn(),
  disable: jest.fn(),
  shouldLoadThirdPartyAddon: jest.fn(),
};
const mockPermissions = {
  initialize: jest.fn(),
  reconcileDeclared: jest.fn(),
  revokeAll: jest.fn(),
};
const mockAudit = {
  initialize: jest.fn(),
  clear: jest.fn(),
};
const mockLifecycle = {
  startOne: jest.fn(),
  stop: jest.fn(),
};
const mockConfig = {
  initialize: jest.fn(),
  snapshot: jest.fn(),
  restoreSnapshot: jest.fn(),
};
const mockHostApi = { clearUsage: jest.fn() };

import { AddonManagementService } from '../../src/services/scripting/AddonManagementService';

const manifest = {
  id: 'rs.androidircx.manage',
  name: 'Manage',
  author: 'AndroidIRCX',
  version: '1.0.0',
  description: 'Test.',
  license: 'GPL-3.0-or-later',
  apiVersion: 1,
  minAppVersion: '1.10.0',
  entry: 'main.js',
  permissions: ['irc.read'],
};
const record = {
  manifest,
  activeChecksum: 'a'.repeat(64),
  installedAt: 1,
  updatedAt: 1,
};

describe('AddonManagementService', () => {
  const service = new AddonManagementService(
    mockPackages as any,
    mockSafety as any,
    mockPermissions as any,
    mockAudit as any,
    mockLifecycle as any,
    mockConfig as any,
    mockHostApi as any,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    Object.values({
      ...mockPackages,
      ...mockSafety,
      ...mockPermissions,
      ...mockAudit,
      ...mockLifecycle,
      ...mockConfig,
      ...mockHostApi,
    }).forEach(mock => mock.mockResolvedValue?.(undefined));
    mockPackages.list.mockReturnValue([record]);
    mockPackages.get.mockReturnValue(record);
    mockSafety.getSnapshot.mockReturnValue({ disabled: new Map() });
    mockSafety.shouldLoadThirdPartyAddon.mockReturnValue(true);
    mockLifecycle.startOne.mockResolvedValue({
      addonId: manifest.id,
      started: true,
    });
  });

  it('initializes boundaries and reports user-disabled state', async () => {
    await service.initialize();
    expect(mockPackages.initialize).toHaveBeenCalled();
    expect(mockConfig.initialize).toHaveBeenCalled();
    expect(service.list()[0]).toMatchObject({ enabled: true });
    mockSafety.getSnapshot.mockReturnValue({
      disabled: new Map([[manifest.id, { reason: 'user-disabled' }]]),
    });
    expect(service.list()[0]).toMatchObject({ enabled: false });
    expect(service.list()[0]).toMatchObject({
      disabledReason: 'user-disabled',
    });
  });

  it('enables explicitly and returns to disabled if startup fails', async () => {
    await service.setEnabled(manifest.id, true);
    expect(mockSafety.reenable).toHaveBeenCalledWith(manifest.id);
    expect(mockLifecycle.startOne).toHaveBeenCalledWith(manifest.id);

    mockLifecycle.startOne.mockResolvedValue({
      addonId: manifest.id,
      started: false,
      error: 'runtime rejected',
    });
    await expect(service.setEnabled(manifest.id, true)).rejects.toThrow(
      'runtime rejected',
    );
    expect(mockSafety.disable).toHaveBeenCalledWith(manifest.id);
  });

  it('stops before disabling and fully removes addon-owned state', async () => {
    await service.setEnabled(manifest.id, false);
    expect(mockLifecycle.stop).toHaveBeenCalledWith(manifest.id);
    expect(mockSafety.disable).toHaveBeenCalledWith(manifest.id);

    await service.uninstall(manifest.id);
    expect(mockPackages.uninstall).toHaveBeenCalledWith(manifest.id);
    expect(mockPermissions.revokeAll).toHaveBeenCalledWith(manifest.id);
    expect(mockAudit.clear).toHaveBeenCalledWith(manifest.id);
    expect(mockHostApi.clearUsage).toHaveBeenCalledWith(manifest.id);
  });

  it('reconciles permissions and restarts an enabled rollback', async () => {
    mockPackages.rollback.mockResolvedValue(record);
    await service.rollback(manifest.id);
    expect(mockPermissions.reconcileDeclared).toHaveBeenCalledWith(
      manifest.id,
      manifest.permissions,
    );
    expect(mockConfig.snapshot).toHaveBeenCalledWith(
      manifest.id,
      record.activeChecksum,
    );
    expect(mockConfig.restoreSnapshot).toHaveBeenCalledWith(
      manifest.id,
      record.activeChecksum,
    );
    expect(mockLifecycle.startOne).toHaveBeenCalledWith(manifest.id);
  });

  it('undoes package rollback when configuration restore fails', async () => {
    const previous = {
      ...record,
      activeChecksum: 'b'.repeat(64),
      manifest: { ...manifest, version: '0.9.0' },
    };
    mockPackages.rollback
      .mockResolvedValueOnce(previous)
      .mockResolvedValueOnce(record);
    mockConfig.restoreSnapshot.mockRejectedValueOnce(new Error('bad snapshot'));

    await expect(service.rollback(manifest.id)).rejects.toThrow('bad snapshot');
    expect(mockPackages.rollback).toHaveBeenCalledTimes(2);
    expect(mockConfig.restoreSnapshot).toHaveBeenLastCalledWith(
      manifest.id,
      record.activeChecksum,
    );
  });

  it('decodes the verified active entry for source review', async () => {
    mockPackages.loadActive.mockResolvedValue({
      manifest,
      files: new Map([['main.js', new Uint8Array([111, 107])]]),
    });
    await expect(service.readSource(manifest.id)).resolves.toBe('ok');
  });
});

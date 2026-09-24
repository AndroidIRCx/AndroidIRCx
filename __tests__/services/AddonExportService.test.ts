/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import {
  AddonExportCancelledError,
  AddonExportService,
} from '../../src/services/scripting/AddonExportService';

const addonId = 'rs.androidircx.export';
const files = {
  CachesDirectoryPath: '/cache',
  writeFile: jest.fn().mockResolvedValue(undefined),
  exists: jest.fn().mockResolvedValue(true),
  unlink: jest.fn().mockResolvedValue(undefined),
};
const sharing = { open: jest.fn().mockResolvedValue(undefined) };
const management = { readSource: jest.fn().mockResolvedValue('source();') };
const packages = {
  initialize: jest.fn().mockResolvedValue(undefined),
  get: jest.fn().mockReturnValue({
    manifest: { id: addonId, name: 'Export', version: '1.0.0' },
    activeChecksum: 'a'.repeat(64),
  }),
};
const safety = {
  initialize: jest.fn().mockResolvedValue(undefined),
  getSnapshot: jest.fn().mockReturnValue({
    safeMode: false,
    disabled: new Map([
      [addonId, { reason: 'repeated-failure', disabledAt: 10 }],
    ]),
    failures: new Map([[addonId, 3]]),
  }),
};
const audit = {
  initialize: jest.fn().mockResolvedValue(undefined),
  list: jest
    .fn()
    .mockReturnValue([
      { action: 'send', target: 'irc-channel', result: 'denied' },
    ]),
};

describe('AddonExportService', () => {
  const service = new AddonExportService(
    files as any,
    sharing as any,
    management as any,
    packages as any,
    safety as any,
    audit as any,
    () => 123,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    files.exists.mockResolvedValue(true);
    sharing.open.mockResolvedValue(undefined);
  });

  it('shares verified source through a temporary file and cleans it', async () => {
    await service.shareSource(addonId);
    expect(files.writeFile).toHaveBeenCalledWith(
      `/cache/${addonId}-123-source.js`,
      'source();',
      'utf8',
    );
    expect(sharing.open).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'application/javascript' }),
    );
    expect(files.unlink).toHaveBeenCalled();
  });

  it('exports only structured recovery and audit diagnostics', async () => {
    await service.shareDiagnostics(addonId);
    const content = files.writeFile.mock.calls[0][1] as string;
    expect(JSON.parse(content)).toMatchObject({
      addon: { id: addonId, version: '1.0.0' },
      recovery: {
        disabledReason: 'repeated-failure',
        failureCount: 3,
      },
      audit: [{ action: 'send', result: 'denied' }],
    });
    expect(content).not.toContain('password');
  });

  it('reports cancellation distinctly and still removes the file', async () => {
    sharing.open.mockRejectedValue(new Error('User did not share'));
    await expect(service.shareSource(addonId)).rejects.toBeInstanceOf(
      AddonExportCancelledError,
    );
    expect(files.unlink).toHaveBeenCalled();
  });
});

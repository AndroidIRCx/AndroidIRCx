/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import {
  AddonHostApiError,
  AddonHostApiGateway,
} from '../../src/services/scripting/AddonHostApiGateway';
import { AddonPermissionDeniedError } from '../../src/services/scripting/AddonPermissionService';

const addonId = 'rs.androidircx.gateway-test';
const manifest = {
  id: addonId,
  permissions: ['irc.send', 'storage'],
};

function dependencies() {
  const packages = {
    initialize: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockReturnValue({ manifest }),
  };
  const permissions = {
    initialize: jest.fn().mockResolvedValue(undefined),
    requireGrant: jest.fn(),
  };
  const audit = {
    initialize: jest.fn().mockResolvedValue(undefined),
    record: jest.fn().mockResolvedValue(undefined),
  };
  let now = 1_000;
  const send = jest.fn().mockResolvedValue({ sent: true });
  const service = new AddonHostApiGateway(
    { 'irc.message.send': send },
    packages as any,
    permissions as any,
    audit as any,
    () => now,
  );
  return {
    packages,
    permissions,
    audit,
    send,
    service,
    tick: (ms: number) => (now += ms),
  };
}

describe('AddonHostApiGateway', () => {
  it('checks the exact declared grant before calling an owning service', async () => {
    const { service, permissions, send, audit } = dependencies();
    await expect(
      service.invoke(addonId, 'irc.message.send', {
        network: 'libera',
        target: '#androidircx',
        text: 'hello',
      }),
    ).resolves.toEqual({ sent: true });

    expect(permissions.requireGrant).toHaveBeenCalledWith(
      addonId,
      manifest.permissions,
      'irc.send',
    );
    expect(send).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        addonId,
        capability: 'irc.send',
        action: 'irc.message.send',
        target: 'irc-channel',
        result: 'allowed',
      }),
    );
  });

  it('audits denial and never calls the handler after revocation', async () => {
    const { service, permissions, send, audit } = dependencies();
    permissions.requireGrant.mockImplementation(() => {
      throw new AddonPermissionDeniedError(addonId, 'irc.send');
    });

    await expect(
      service.invoke(addonId, 'irc.message.send', { text: 'blocked' }),
    ).rejects.toBeInstanceOf(AddonPermissionDeniedError);
    expect(send).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ result: 'denied' }),
    );
  });

  it('fails closed for unknown and unimplemented operations', async () => {
    const { service, audit } = dependencies();
    await expect(service.invoke(addonId, 'device.shell', {})).rejects.toThrow(
      'Unknown addon host operation',
    );
    await expect(service.invoke(addonId, 'storage.read', {})).rejects.toThrow(
      'not available',
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        capability: 'storage',
        result: 'failed',
      }),
    );
  });

  it('clones JSON arguments/results and rejects unsafe bridge values', async () => {
    const { service, send } = dependencies();
    const args = { nested: { value: 1 } };
    const promise = service.invoke(addonId, 'irc.message.send', args);
    args.nested.value = 2;
    await promise;
    expect(send.mock.calls[0][1]).toEqual({ nested: { value: 1 } });

    send.mockResolvedValueOnce({ value: Number.NaN });
    await expect(
      service.invoke(addonId, 'irc.message.send', {}),
    ).rejects.toThrow('invalid number');
  });

  it('enforces per-addon operation limits and resets usage explicitly', async () => {
    const { service, send } = dependencies();
    for (let index = 0; index < 60; index += 1)
      await service.invoke(addonId, 'irc.message.send', {});
    await expect(
      service.invoke(addonId, 'irc.message.send', {}),
    ).rejects.toThrow('rate limit');

    service.clearUsage(addonId);
    await expect(
      service.invoke(addonId, 'irc.message.send', {}),
    ).resolves.toEqual({ sent: true });
    expect(send).toHaveBeenCalledTimes(61);
  });

  it('rejects calls for packages that are no longer installed', async () => {
    const { service, packages, permissions } = dependencies();
    packages.get.mockReturnValue(undefined);
    await expect(
      service.invoke(addonId, 'irc.message.send', {}),
    ).rejects.toBeInstanceOf(AddonHostApiError);
    expect(permissions.requireGrant).not.toHaveBeenCalled();
  });
});

/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IapConnectionService } from '../../src/services/IapConnectionService';

describe('IapConnectionService', () => {
  const createIapModule = () => ({
    initConnection: jest.fn(() => Promise.resolve(true)),
    endConnection: jest.fn(() => Promise.resolve(true)),
  });

  it('shares one native init across concurrent owners', async () => {
    const iapModule = createIapModule();
    const service = new IapConnectionService(iapModule);

    const [firstLease, secondLease] = await Promise.all([
      service.acquire(),
      service.acquire(),
    ]);

    expect(iapModule.initConnection).toHaveBeenCalledTimes(1);

    await firstLease.release();
    expect(iapModule.endConnection).not.toHaveBeenCalled();

    await secondLease.release();
    expect(iapModule.endConnection).toHaveBeenCalledTimes(1);
  });

  it('does not double release the same owner', async () => {
    const iapModule = createIapModule();
    const service = new IapConnectionService(iapModule);
    const lease = await service.acquire();

    await lease.release();
    await lease.release();

    expect(iapModule.endConnection).toHaveBeenCalledTimes(1);
  });

  it('rolls back ownership when init fails so a later retry can connect', async () => {
    const iapModule = createIapModule();
    iapModule.initConnection
      .mockRejectedValueOnce(new Error('billing unavailable'))
      .mockResolvedValueOnce(true);
    const service = new IapConnectionService(iapModule);

    await expect(service.acquire()).rejects.toThrow('billing unavailable');

    const lease = await service.acquire();
    await lease.release();

    expect(iapModule.initConnection).toHaveBeenCalledTimes(2);
    expect(iapModule.endConnection).toHaveBeenCalledTimes(1);
  });

  it('closes after an in-flight init only if no owner remains', async () => {
    const iapModule = createIapModule();
    let resolveInit: (value: boolean) => void = () => {};
    iapModule.initConnection.mockImplementationOnce(
      () =>
        new Promise<boolean>(resolve => {
          resolveInit = resolve;
        }),
    );
    const service = new IapConnectionService(iapModule);
    const firstLeasePromise = service.acquire();
    const secondLeasePromise = service.acquire();
    resolveInit(true);

    const firstLease = await firstLeasePromise;
    const secondLease = await secondLeasePromise;
    await firstLease.release();

    expect(iapModule.endConnection).not.toHaveBeenCalled();

    await secondLease.release();
    expect(iapModule.endConnection).toHaveBeenCalledTimes(1);
  });
});

/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import { createAddonEventEnvelope } from '../../src/services/scripting/AddonEventEnvelope';
import { AddonEventRouter } from '../../src/services/scripting/AddonEventRouter';

const manifest = {
  id: 'test.addon',
  name: 'Test',
  author: 'Test',
  version: '1.0.0',
  description: 'Test',
  license: 'MIT',
  apiVersion: 1,
  minAppVersion: '1.10.0',
  entry: 'index.js',
  permissions: ['irc.read'],
} as any;

describe('AddonEventRouter', () => {
  const audit = () => ({
    initialize: jest.fn(async () => undefined),
    record: jest.fn(async () => undefined),
  });

  it('requires permission and routes matching events in FIFO order', async () => {
    const invoke = jest.fn(async () => ({}));
    const packages = {
      initialize: jest.fn(async () => undefined),
      get: jest.fn(() => ({ manifest })),
    } as any;
    const permissions = {
      initialize: jest.fn(async () => undefined),
      requireGrant: jest.fn(),
    } as any;
    const router = new AddonEventRouter(
      packages,
      permissions,
      { invoke },
      audit(),
    );
    await router.register('test.addon', 'first', { event: 'irc.*' });
    const removeSecond = await router.register('test.addon', 'second', {
      channel: '#test',
    });
    const event = createAddonEventEnvelope({
      id: 'e1',
      type: 'irc.message',
      channel: '#test',
      payload: { text: 'hi' },
    });

    expect(await router.route(event)).toEqual({
      delivered: 2,
      failed: 0,
      stoppedBy: undefined,
      hideDefaultRequestedBy: [],
      transformations: [],
    });
    expect(invoke.mock.calls.map(call => call[1].hook)).toEqual([
      'first',
      'second',
    ]);
    expect(JSON.parse(invoke.mock.calls[0][1].payloadJson).id).toBe('e1');
    removeSecond();
    expect(await router.route(event)).toEqual({
      delivered: 1,
      failed: 0,
      stoppedBy: undefined,
      hideDefaultRequestedBy: [],
      transformations: [],
    });
  });

  it('isolates failures and rechecks revoked grants at delivery', async () => {
    let denied = false;
    const permissions = {
      initialize: jest.fn(async () => undefined),
      requireGrant: jest.fn(() => {
        if (denied) throw new Error('denied');
      }),
    } as any;
    const invoke = jest.fn().mockRejectedValueOnce(new Error('hook failed'));
    const router = new AddonEventRouter(
      { initialize: async () => undefined, get: () => ({ manifest }) } as any,
      permissions,
      { invoke },
      audit(),
    );
    await router.register('test.addon', 'event', {});
    const event = createAddonEventEnvelope({ id: 'e2', type: 'irc.notice' });
    expect(await router.route(event)).toEqual({
      delivered: 0,
      failed: 1,
      stoppedBy: undefined,
      hideDefaultRequestedBy: [],
      transformations: [],
    });
    denied = true;
    expect(await router.route(event)).toEqual({
      delivered: 0,
      failed: 1,
      stoppedBy: undefined,
      hideDefaultRequestedBy: [],
      transformations: [],
    });
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid hooks and enforces the per-addon registration cap', async () => {
    const router = new AddonEventRouter(
      { initialize: async () => undefined, get: () => ({ manifest }) } as any,
      {
        initialize: async () => undefined,
        requireGrant: () => undefined,
      } as any,
      { invoke: async () => ({}) },
      audit(),
    );
    await expect(router.register('test.addon', '../bad', {})).rejects.toThrow(
      'invalid',
    );
    for (let index = 0; index < 32; index += 1)
      await router.register('test.addon', `hook${index}`, {});
    await expect(router.register('test.addon', 'overflow', {})).rejects.toThrow(
      'limit',
    );
  });

  it('orders priority bands before FIFO and separates hide from stop', async () => {
    const calls: string[] = [];
    const invoke = jest.fn(async (_addonId: string, request: any) => {
      calls.push(request.hook);
      if (request.hook === 'trustedStop')
        return { resultJson: '{"stopPropagation":true}' };
      if (request.hook === 'trustedHide')
        return {
          resultJson:
            '{"display":"hide","replacement":"local","style":{"role":"notice"}}',
        };
      return {};
    });
    const auditBoundary = audit();
    const router = new AddonEventRouter(
      { initialize: async () => undefined, get: () => ({ manifest }) } as any,
      {
        initialize: async () => undefined,
        requireGrant: () => undefined,
      } as any,
      { invoke },
      auditBoundary,
    );
    await router.register('test.addon', 'normal', {}, {}, 'normal');
    await router.register(
      'test.addon',
      'trustedHide',
      { event: 'irc.notice' },
      {},
      'user-trusted',
    );
    await router.register(
      'test.addon',
      'trustedStop',
      { event: 'irc.message' },
      {},
      'user-trusted',
    );
    const notice = createAddonEventEnvelope({ id: 'n1', type: 'irc.notice' });
    expect(await router.route(notice)).toEqual({
      delivered: 2,
      failed: 0,
      stoppedBy: undefined,
      hideDefaultRequestedBy: ['test.addon'],
      transformations: [
        {
          addonId: 'test.addon',
          result: {
            display: 'hide',
            replacement: 'local',
            style: {
              role: 'notice',
              bold: undefined,
              italic: undefined,
              underline: undefined,
            },
            routeTo: undefined,
            stopPropagation: undefined,
          },
        },
      ],
    });
    expect(calls).toEqual(['trustedHide', 'normal']);

    calls.length = 0;
    const message = createAddonEventEnvelope({ id: 'm1', type: 'irc.message' });
    expect(await router.route(message)).toEqual({
      delivered: 1,
      failed: 0,
      stoppedBy: 'test.addon',
      hideDefaultRequestedBy: [],
      transformations: [],
    });
    expect(calls).toEqual(['trustedStop']);
    expect(auditBoundary.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'event.hide' }),
    );
    expect(auditBoundary.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'event.stop' }),
    );
    expect(auditBoundary.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'event.transform' }),
    );
  });

  it('previews only the selected addon without publishing to other addons', async () => {
    const otherManifest = { ...manifest, id: 'other.addon' };
    const invoke = jest.fn(async (addonId: string) => ({
      resultJson:
        addonId === manifest.id
          ? '{"display":"hide","replacement":"preview"}'
          : '{"replacement":"wrong addon"}',
    }));
    const router = new AddonEventRouter(
      {
        initialize: async () => undefined,
        get: (addonId: string) => ({
          manifest: addonId === manifest.id ? manifest : otherManifest,
        }),
      } as any,
      {
        initialize: async () => undefined,
        requireGrant: () => undefined,
      } as any,
      { invoke },
      audit(),
    );
    await router.register(manifest.id, 'selected', { event: 'irc.message' });
    await router.register(otherManifest.id, 'other', {
      event: 'irc.message',
    });

    const result = await router.preview(
      manifest.id,
      createAddonEventEnvelope({ id: 'preview-1', type: 'irc.message' }),
    );

    expect(result).toEqual(
      expect.objectContaining({
        matched: 1,
        delivered: 1,
        failed: 0,
        hideDefaultRequestedBy: [manifest.id],
      }),
    );
    expect(result.transformations[0]).toEqual(
      expect.objectContaining({
        addonId: manifest.id,
        result: expect.objectContaining({ replacement: 'preview' }),
      }),
    );
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith(
      manifest.id,
      expect.objectContaining({ hook: 'selected' }),
    );
  });
});

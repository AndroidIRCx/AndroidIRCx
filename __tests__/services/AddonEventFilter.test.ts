/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import { createAddonEventEnvelope } from '../../src/services/scripting/AddonEventEnvelope';
import { compileAddonEventFilter } from '../../src/services/scripting/AddonEventFilter';

const event = createAddonEventEnvelope({
  id: 'event-1',
  type: 'irc.message',
  network: 'Libera',
  channel: '#AndroidIRCX',
  sender: {
    nick: 'Alice',
    ident: 'user',
    host: 'example.test',
    account: 'alice',
  },
  payload: { senderIsOp: true, text: 'hello' },
  origin: { self: false, server: false, playback: false },
});

describe('AddonEventFilter', () => {
  it('combines event, location, identity, origin and op filters', () => {
    const match = compileAddonEventFilter({
      event: ['irc.message', 'irc.notice'],
      network: 'lib*',
      channel: '#android?rcx',
      sender: { regex: '^ali(?:ce)$', flags: 'i' },
      account: 'alice',
      hostmask: '*!user@example.test',
      notSelf: true,
      server: false,
      playback: false,
      requireOp: true,
    });
    expect(match(event)).toBe(true);
    expect(match({ ...event, origin: { ...event.origin, self: true } })).toBe(
      false,
    );
    expect(match({ ...event, payload: { senderIsOp: false } })).toBe(false);
  });

  it('supports the $me helper without copying numeric access levels', () => {
    const match = compileAddonEventFilter({ sender: '$me' });
    expect(match(event)).toBe(false);
    expect(match({ ...event, origin: { ...event.origin, self: true } })).toBe(
      true,
    );
  });

  it('rejects unsafe, unsupported and oversized regex patterns', () => {
    expect(() =>
      compileAddonEventFilter({ sender: { regex: '(a+)+$' } }),
    ).toThrow('unsafe');
    expect(() =>
      compileAddonEventFilter({ sender: { regex: '(a)\\1' } }),
    ).toThrow('unsafe');
    expect(() =>
      compileAddonEventFilter({ sender: { regex: 'a', flags: 'g' as any } }),
    ).toThrow('flags');
    expect(() => compileAddonEventFilter({ sender: 'x'.repeat(129) })).toThrow(
      'length',
    );
  });
});

/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Every numeric handler, driven down the paths a per-module test does not
 * normally reach.
 *
 * Each handler pulls its text out of `params` with a fallback, and the ones
 * that touch cached state guard the service being absent. A server sending a
 * numeric with nothing after it is ordinary — a bare 305, a 401 with no
 * message — so those fallbacks are a normal path rather than an edge case, and
 * a handler that throws on one takes the whole read loop down with it.
 *
 * The three sweeps below are deliberately generic: a numeric added later is
 * covered the moment it lands in its module's map, without anyone remembering
 * to add a case here.
 */

jest.mock('../../../../src/i18n/localization', () => ({
  tx: {
    t: (key: string, params?: Record<string, unknown>) => {
      let result = key;
      if (params) {
        for (const [name, value] of Object.entries(params)) {
          result = result.replace(`{${name}}`, String(value));
        }
      }
      return result;
    },
  },
}));

jest.mock('../../../../src/stores/uiStore', () => ({
  useUIStore: { getState: jest.fn(() => ({ whoisDisplayMode: 'active' })) },
}));

import type { NumericHandler } from '../../../../src/services/irc/types';
import { channelHandlers } from '../../../../src/services/irc/numerics/ChannelNumerics';
import { errorHandlers } from '../../../../src/services/irc/numerics/ErrorNumerics';
import { extendedHandlers } from '../../../../src/services/irc/numerics/ExtendedNumerics';
import { lusersHandlers } from '../../../../src/services/irc/numerics/LusersNumerics';
import { miscHandlers } from '../../../../src/services/irc/numerics/MiscNumerics';
import { monitorHandlers } from '../../../../src/services/irc/numerics/MonitorNumerics';
import { motdHandlers } from '../../../../src/services/irc/numerics/MotdNumerics';
import { registrationHandlers } from '../../../../src/services/irc/numerics/RegistrationNumerics';
import { saslHandlers } from '../../../../src/services/irc/numerics/SaslNumerics';
import { starttlsHandlers } from '../../../../src/services/irc/numerics/StarttlsNumerics';
import { statefulChannelHandlers } from '../../../../src/services/irc/numerics/StatefulChannelNumerics';
import { statsHandlers } from '../../../../src/services/irc/numerics/StatsNumerics';
import { traceHandlers } from '../../../../src/services/irc/numerics/TraceNumerics';
import { versionInfoHandlers } from '../../../../src/services/irc/numerics/VersionInfoNumerics';
import { whoisHandlers } from '../../../../src/services/irc/numerics/WhoisNumerics';

const MODULES: Array<[string, Map<number, NumericHandler>]> = [
  ['channel', channelHandlers],
  ['error', errorHandlers],
  ['extended', extendedHandlers],
  ['lusers', lusersHandlers],
  ['misc', miscHandlers],
  ['monitor', monitorHandlers],
  ['motd', motdHandlers],
  ['registration', registrationHandlers],
  ['sasl', saslHandlers],
  ['starttls', starttlsHandlers],
  ['statefulChannel', statefulChannelHandlers],
  ['stats', statsHandlers],
  ['trace', traceHandlers],
  ['versionInfo', versionInfoHandlers],
  ['whois', whoisHandlers],
];

/** Every numeric in the app, as [module, numeric, handler]. */
const ALL: Array<[string, number, NumericHandler]> = MODULES.flatMap(
  ([name, map]) =>
    [...map.entries()].map(
      ([numeric, handler]) =>
        [name, numeric, handler] as [string, number, NumericHandler],
    ),
);

const updateWHOIS = jest.fn();

/** A context where everything answers, so a handler runs to its end. */
const fullContext = () => ({
  addMessage: jest.fn(),
  addRawMessage: jest.fn(),
  addToNamesBuffer: jest.fn(),
  clearNamesBuffer: jest.fn(),
  clearUserRequestedNames: jest.fn(),
  disconnect: jest.fn(),
  emit: jest.fn(),
  emitUserListChange: jest.fn(),
  endCAPNegotiation: jest.fn(),
  getAltNick: jest.fn(() => 'AltNick'),
  getChannelTopicInfo: jest.fn(() => ({ topic: 'a topic' })),
  getCurrentNick: jest.fn(() => 'CurrentNick'),
  getNamesBuffer: jest.fn(() => new Map([['#channel', ['alice', '@bob']]])),
  getNetworkName: jest.fn(() => 'TestNet'),
  getNickChangeAttempts: jest.fn(() => 0),
  getSilentWhoCallback: jest.fn(() => undefined),
  getUserManagementService: jest.fn(() => ({ updateWHOIS })),
  getWhowasAt: jest.fn(() => 0),
  getWhowasTarget: jest.fn(() => 'Alice'),
  hasCapability: jest.fn(() => true),
  incrementNickChangeAttempts: jest.fn(),
  isSilentModeNick: jest.fn(() => false),
  isSilentWhoNick: jest.fn(() => false),
  isUserRequestedNames: jest.fn(() => true),
  logRaw: jest.fn(),
  maybeEmitChannelIntro: jest.fn(),
  parseUserWithPrefixes: jest.fn((nick: string) => ({ nick, prefixes: [] })),
  processISupport: jest.fn(),
  removeSilentModeNick: jest.fn(),
  removeSilentWhoCallback: jest.fn(),
  removeSilentWhoNick: jest.fn(),
  requestChatHistory: jest.fn(),
  sendCommand: jest.fn(),
  sendRaw: jest.fn(),
  setChannelTopicInfo: jest.fn(),
  setChannelUsers: jest.fn(),
  setCurrentNick: jest.fn(),
  setRegistered: jest.fn(),
  setSaslAuthenticating: jest.fn(),
  updateSelfUserModes: jest.fn(),
});

beforeEach(() => jest.clearAllMocks());

describe('every numeric', () => {
  it('is claimed by exactly one module', () => {
    // Two modules claiming one numeric means whichever `IRCNumericHandlers`
    // merges last wins, silently, and the other handler can never run. 364 and
    // 365 (RPL_LINKS) were written twice until the unreachable pair in
    // StatsNumerics was deleted; this keeps a third from appearing unnoticed.
    const claims = new Map<number, string[]>();
    for (const [moduleName, numeric] of ALL) {
      claims.set(numeric, [...(claims.get(numeric) ?? []), moduleName]);
    }

    const duplicated = [...claims.entries()].filter(
      ([, modules]) => modules.length > 1,
    );
    expect(duplicated).toEqual([]);
    expect(claims.size).toBe(ALL.length);
    expect(ALL.length).toBeGreaterThan(300);
  });

  it.each(ALL)(
    '%s %i survives a reply with no parameters at all',
    (_module, _numeric, handler) => {
      const ctx = fullContext();

      expect(() => handler(ctx as any, 'server', [], 1000)).not.toThrow();

      // Whatever it prints, it must not print the word "undefined" at someone.
      for (const call of ctx.addMessage.mock.calls) {
        if (typeof call[0]?.text === 'string') {
          expect(call[0].text).not.toMatch(/undefined|\[object Object\]/);
        }
      }
    },
  );

  it.each(ALL)(
    '%s %i survives a reply with only the target nick',
    (_module, _numeric, handler) => {
      const ctx = fullContext();

      expect(() =>
        handler(ctx as any, 'irc.example', ['CurrentNick'], 1001),
      ).not.toThrow();
    },
  );

  it.each(ALL)(
    '%s %i survives without a user management service',
    (_module, _numeric, handler) => {
      const ctx = fullContext();
      ctx.getUserManagementService = jest.fn(() => undefined) as any;

      expect(() =>
        handler(ctx as any, 'server', ['CurrentNick', 'Alice', ':text'], 1002),
      ).not.toThrow();
    },
  );

  it.each(ALL)(
    '%s %i survives a service that cannot cache WHOIS',
    (_module, _numeric, handler) => {
      // An older service object with no updateWHOIS on it: the guard is two
      // conditions and only one of them is normally exercised.
      const ctx = fullContext();
      ctx.getUserManagementService = jest.fn(() => ({})) as any;

      expect(() =>
        handler(ctx as any, 'server', ['CurrentNick', 'Alice', ':text'], 1003),
      ).not.toThrow();
      expect(updateWHOIS).not.toHaveBeenCalled();
    },
  );

  it.each(ALL)(
    '%s %i survives a full reply with several trailing words',
    (_module, _numeric, handler) => {
      const ctx = fullContext();

      expect(() =>
        handler(
          ctx as any,
          'irc.example',
          ['CurrentNick', '#channel', 'Alice', '42', ':a longer trailing text'],
          1004,
        ),
      ).not.toThrow();
    },
  );
});

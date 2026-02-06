/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * IRCService Numeric Handlers Test Suite
 *
 * Tests all numeric reply handlers in handleNumericReply() function.
 * These tests are designed to ensure refactoring of IRCService.ts
 * doesn't break any numeric handler behavior.
 *
 * Numeric handlers covered:
 * - Registration (001-009)
 * - TRACE (200-210)
 * - Stats (211-221, 240-262, 264-266)
 * - LUSERS (251-259, 265-266)
 * - MOTD (372, 375-376, 422)
 * - Channel/Topic (321-354, 364-368)
 * - WHOIS/WHOWAS (301-345, 369, 378-390)
 * - VERSION/INFO (351, 371, 374, 381-391)
 * - Error numerics (401-502, 511-531)
 * - SASL (900-908)
 * - MONITOR (600-608, 730-734)
 * - STARTTLS (670-699)
 * - Extended (609-629, 660-689, 700-772, 910-999)
 */

import { ircService, IRCMessage } from '../src/services/IRCService';

describe('IRCService Numeric Handlers', () => {
  let addMessageSpy: jest.SpyInstance;
  let addRawMessageSpy: jest.SpyInstance;
  let emitSpy: jest.SpyInstance;
  let messages: any[];

  beforeEach(() => {
    messages = [];
    addMessageSpy = jest.spyOn(ircService as any, 'addMessage').mockImplementation((msg: any) => {
      messages.push(msg);
    });
    addRawMessageSpy = jest.spyOn(ircService as any, 'addRawMessage').mockImplementation((text: string, category: string) => {
      messages.push({ type: 'raw', text, rawCategory: category, isRaw: true });
    });
    emitSpy = jest.spyOn(ircService as any, 'emit').mockImplementation(() => {});

    // Set current nick for tests
    (ircService as any).currentNick = 'testnick';
    (ircService as any).serverTime = true;
    (ircService as any).silentModeNicks = new Set();
    (ircService as any).silentWhoNicks = new Set();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ========================================
  // REGISTRATION NUMERICS (001-009)
  // ========================================

  describe('Registration Numerics (001-009)', () => {
    it('001 RPL_WELCOME - sets registered and current nick', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(1, 'server.test', ['testnick', 'Welcome to the Test IRC Network testnick!user@host']);

      expect((ircService as any).registered).toBe(true);
      expect(emitSpy).toHaveBeenCalledWith('registered');
      expect(messages.length).toBeGreaterThan(0);
    });

    it('002 RPL_YOURHOST - displays host info', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(2, 'server.test', ['testnick', 'Your host is server.test, running version ircd-1.0']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
        rawCategory: 'server',
      }));
    });

    it('003 RPL_CREATED - displays server creation date', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(3, 'server.test', ['testnick', 'This server was created Jan 1 2024']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('004 RPL_MYINFO - displays server info', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(4, 'server.test', ['testnick', 'server.test', 'ircd-1.0', 'oiws', 'biklmnopstv']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('005 RPL_ISUPPORT - parses server capabilities', () => {
      const logRawSpy = jest.spyOn(ircService as any, 'logRaw').mockImplementation(() => {});
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(5, 'server.test', ['testnick', 'CHANTYPES=#&', 'PREFIX=(ov)@+', 'NETWORK=TestNet', 'are supported by this server']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
      expect(logRawSpy).toHaveBeenCalled();
    });

    it('008 RPL_SNOMASK - displays server notice mask', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(8, 'server.test', ['testnick', '+csf', 'Server notice mask']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('009 RPL_STATMEMTOT - displays memory stats', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(9, 'server.test', ['testnick', 'Memory usage: 100MB']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });
  });

  // ========================================
  // TRACE NUMERICS (200-210)
  // ========================================

  describe('TRACE Numerics (200-210)', () => {
    const traceNumerics = [
      { num: 200, name: 'RPL_TRACELINK' },
      { num: 201, name: 'RPL_TRACECONNECTING' },
      { num: 202, name: 'RPL_TRACEHANDSHAKE' },
      { num: 203, name: 'RPL_TRACEUNKNOWN' },
      { num: 204, name: 'RPL_TRACEOPERATOR' },
      { num: 205, name: 'RPL_TRACEUSER' },
      { num: 206, name: 'RPL_TRACESERVER' },
      { num: 207, name: 'RPL_TRACESERVICE' },
      { num: 208, name: 'RPL_TRACENEWTYPE' },
      { num: 209, name: 'RPL_TRACECLASS' },
      { num: 210, name: 'RPL_TRACERECONNECT' },
    ];

    traceNumerics.forEach(({ num, name }) => {
      it(`${num} ${name} - displays trace info`, () => {
        const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
        handleNumeric(num, 'server.test', ['testnick', `Trace info for ${name}`]);

        expect(messages).toContainEqual(expect.objectContaining({
          type: 'raw',
          isRaw: true,
          rawCategory: 'server',
        }));
      });
    });
  });

  // ========================================
  // STATS NUMERICS (211-221, 240-250, 261-266)
  // ========================================

  describe('Stats Numerics', () => {
    const statsNumerics = [211, 212, 213, 214, 215, 216, 217, 218];

    statsNumerics.forEach(num => {
      it(`${num} RPL_STATS* - displays stats data`, () => {
        const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
        handleNumeric(num, 'server.test', ['testnick', 'Stats data here']);

        expect(messages).toContainEqual(expect.objectContaining({
          type: 'raw',
          isRaw: true,
        }));
      });
    });

    it('219 RPL_ENDOFSTATS - displays end of stats', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(219, 'server.test', ['testnick', 'l', 'End of STATS report']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('221 RPL_UMODEIS - displays and updates user modes', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      const updateModesSpy = jest.spyOn(ircService as any, 'updateSelfUserModes').mockImplementation(() => {});

      handleNumeric(221, 'server.test', ['testnick', '+iw']);

      expect(updateModesSpy).toHaveBeenCalledWith('+iw');
      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('221 RPL_UMODEIS - silent mode does not display', () => {
      (ircService as any).silentModeNicks.add('testnick');
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);

      handleNumeric(221, 'server.test', ['testnick', '+iw']);

      // Should not display message when silent
      const rawMessages = messages.filter(m => m.type === 'raw' && m.text?.includes('User modes'));
      expect(rawMessages.length).toBe(0);
    });

    it('242 RPL_STATSUPTIME - displays server uptime', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(242, 'server.test', ['testnick', 'Server Up 10 days 5:30:00']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('250 RPL_STATSCONN - displays connection stats', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(250, 'server.test', ['testnick', 'Highest connection count: 100']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('262 RPL_TRACEEND - displays end of trace', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(262, 'server.test', ['testnick', 'End of TRACE']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });
  });

  // ========================================
  // LUSERS NUMERICS (251-259, 265-266)
  // ========================================

  describe('LUSERS Numerics (251-259, 265-266)', () => {
    it('251 RPL_LUSERCLIENT - displays user count', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(251, 'server.test', ['testnick', 'There are 100 users and 50 invisible on 5 servers']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('252 RPL_LUSEROP - displays operator count', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(252, 'server.test', ['testnick', '10', 'operator(s) online']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('253 RPL_LUSERUNKNOWN - displays unknown connections', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(253, 'server.test', ['testnick', '5', 'unknown connection(s)']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('254 RPL_LUSERCHANNELS - displays channel count', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(254, 'server.test', ['testnick', '200', 'channels formed']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('255 RPL_LUSERME - displays local server info', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(255, 'server.test', ['testnick', 'I have 50 clients and 1 servers']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('265 RPL_LOCALUSERS - displays local users', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(265, 'server.test', ['testnick', '50', '100', 'Current local users 50, max 100']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('266 RPL_GLOBALUSERS - displays global users', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(266, 'server.test', ['testnick', '500', '1000', 'Current global users 500, max 1000']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });
  });

  // ========================================
  // MOTD NUMERICS (372, 375-376, 422)
  // ========================================

  describe('MOTD Numerics', () => {
    it('375 RPL_MOTDSTART - displays MOTD start', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(375, 'server.test', ['testnick', '- server.test Message of the Day -']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('372 RPL_MOTD - displays MOTD line', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(372, 'server.test', ['testnick', '- Welcome to the server!']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('376 RPL_ENDOFMOTD - displays end of MOTD', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(376, 'server.test', ['testnick', 'End of /MOTD command.']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('422 ERR_NOMOTD - displays no MOTD message', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(422, 'server.test', ['testnick', 'MOTD File is missing']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });
  });

  // ========================================
  // CHANNEL/TOPIC NUMERICS (321-333, 341, 346-354, 366-368)
  // ========================================

  describe('Channel/Topic Numerics', () => {
    it('321 RPL_LISTSTART - displays list start', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(321, 'server.test', ['testnick', 'Channel', 'Users  Name']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('322 RPL_LIST - displays channel list entry', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(322, 'server.test', ['testnick', '#test', '50', 'Test channel topic']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
        rawCategory: 'server',
      }));
    });

    it('323 RPL_LISTEND - displays end of channel list', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(323, 'server.test', ['testnick', 'End of /LIST']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
        rawCategory: 'server',
      }));
    });

    it('324 RPL_CHANNELMODEIS - stores channel modes', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      // Initialize channel topic storage
      (ircService as any).channelTopics = new Map();
      handleNumeric(324, 'server.test', ['testnick', '#test', '+nt']);

      // 324 updates channelTopics but doesn't add a message
      expect((ircService as any).channelTopics.get('#test')?.modes).toContain('+nt');
    });

    it('329 RPL_CREATIONTIME - displays channel creation time', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(329, 'server.test', ['testnick', '#test', '1704067200']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('331 RPL_NOTOPIC - stores no topic state', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      (ircService as any).channelTopics = new Map();
      (ircService as any).pendingChannelIntro = new Set();
      handleNumeric(331, 'server.test', ['testnick', '#test', 'No topic is set']);

      // 331 updates channelTopics but doesn't add a message
      expect((ircService as any).channelTopics.get('#test')?.topic).toBeDefined();
    });

    it('332 RPL_TOPIC - stores channel topic and emits event', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      (ircService as any).channelTopics = new Map();
      handleNumeric(332, 'server.test', ['testnick', '#test', 'This is the channel topic']);

      expect((ircService as any).channelTopics.get('#test')?.topic).toBe('This is the channel topic');
    });

    it('333 RPL_TOPICWHOTIME - stores topic setter info', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      (ircService as any).channelTopics = new Map();
      handleNumeric(333, 'server.test', ['testnick', '#test', 'setter!user@host', '1704067200']);

      expect((ircService as any).channelTopics.get('#test')?.setBy).toBe('setter!user@host');
    });

    it('341 RPL_INVITING - displays invite confirmation', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(341, 'server.test', ['testnick', 'invitee', '#test']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('353 RPL_NAMREPLY - processes names list', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(353, 'server.test', ['testnick', '=', '#test', '@op +voice regular']);

      // Should process the names and add to namesBuffer
      expect((ircService as any).namesBuffer.has('#test')).toBe(true);
    });

    it('366 RPL_ENDOFNAMES - finalizes names list', () => {
      // Setup namesBuffer first
      (ircService as any).namesBuffer.set('#test', new Set(['@op', '+voice', 'regular']));
      (ircService as any).channelUsers.set('#test', new Map());

      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(366, 'server.test', ['testnick', '#test', 'End of /NAMES list']);

      // namesBuffer should be cleared
      expect((ircService as any).namesBuffer.has('#test')).toBe(false);
    });

    it('367 RPL_BANLIST - displays ban list entry', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(367, 'server.test', ['testnick', '#test', '*!*@banned.host', 'setter', '1704067200']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
        rawCategory: 'channel',
      }));
    });

    it('368 RPL_ENDOFBANLIST - displays end of ban list', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(368, 'server.test', ['testnick', '#test', 'End of channel ban list']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
        rawCategory: 'channel',
      }));
    });
  });

  // ========================================
  // WHO/WHOIS/WHOWAS NUMERICS (301-330, 369)
  // ========================================

  describe('WHOIS/WHOWAS Numerics', () => {
    it('301 RPL_AWAY - displays away message', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(301, 'server.test', ['testnick', 'someone', 'I am away']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('305 RPL_UNAWAY - displays unaway message', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(305, 'server.test', ['testnick', 'You are no longer marked as being away']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('306 RPL_NOWAWAY - displays now away message', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(306, 'server.test', ['testnick', 'You have been marked as being away']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('311 RPL_WHOISUSER - displays whois user info', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(311, 'server.test', ['testnick', 'someone', 'user', 'host.test', '*', 'Real Name']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('312 RPL_WHOISSERVER - displays whois server info', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(312, 'server.test', ['testnick', 'someone', 'server.test', 'Server description']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('313 RPL_WHOISOPERATOR - displays whois operator status', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(313, 'server.test', ['testnick', 'someone', 'is an IRC operator']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('314 RPL_WHOWASUSER - displays whowas user info', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(314, 'server.test', ['testnick', 'oldnick', 'user', 'host.test', '*', 'Real Name']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('315 RPL_ENDOFWHO - displays end of WHO', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(315, 'server.test', ['testnick', '#test', 'End of /WHO list']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('317 RPL_WHOISIDLE - displays whois idle time', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(317, 'server.test', ['testnick', 'someone', '3600', '1704067200', 'seconds idle, signon time']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('318 RPL_ENDOFWHOIS - displays end of WHOIS', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(318, 'server.test', ['testnick', 'someone', 'End of /WHOIS list']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('319 RPL_WHOISCHANNELS - displays whois channels with clickable rendering', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(319, 'server.test', ['testnick', 'someone', '#chan1 @#chan2 +#chan3']);

      const whoisMsg = messages.find(m => m.whoisData?.channels);
      expect(whoisMsg).toBeDefined();
      expect(whoisMsg?.whoisData?.channels).toEqual(['#chan1', '@#chan2', '+#chan3']);
    });

    it('330 RPL_WHOISACCOUNT - displays logged in account', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(330, 'server.test', ['testnick', 'someone', 'accountname', 'is logged in as']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('352 RPL_WHOREPLY - processes WHO response', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      (ircService as any).channelUsers.set('#test', new Map());

      handleNumeric(352, 'server.test', ['testnick', '#test', 'user', 'host.test', 'server.test', 'someone', 'H@', '0 Real Name']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('369 RPL_ENDOFWHOWAS - displays end of WHOWAS', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(369, 'server.test', ['testnick', 'oldnick', 'End of WHOWAS']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });
  });

  // ========================================
  // ERROR NUMERICS (401-502)
  // ========================================

  describe('Error Numerics (401-502)', () => {
    it('401 ERR_NOSUCHNICK - displays no such nick error', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(401, 'server.test', ['testnick', 'unknownnick', 'No such nick/channel']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('403 ERR_NOSUCHCHANNEL - displays no such channel error', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(403, 'server.test', ['testnick', '#nonexistent', 'No such channel']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('404 ERR_CANNOTSENDTOCHAN - displays cannot send to channel error', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(404, 'server.test', ['testnick', '#moderated', 'Cannot send to channel']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('421 ERR_UNKNOWNCOMMAND - displays unknown command error', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(421, 'server.test', ['testnick', 'BADCMD', 'Unknown command']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('432 ERR_ERRONEUSNICKNAME - displays erroneous nickname error', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(432, 'server.test', ['testnick', 'bad!nick', 'Erroneous nickname']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('433 ERR_NICKNAMEINUSE - attempts nick change', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      const sendRawSpy = jest.spyOn(ircService as any, 'sendRaw').mockImplementation(() => {});
      (ircService as any).nickChangeAttempts = 0;
      (ircService as any).altNick = 'altnick';

      handleNumeric(433, 'server.test', ['*', 'testnick', 'Nickname is already in use']);

      expect(sendRawSpy).toHaveBeenCalled();
      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('464 ERR_PASSWDMISMATCH - displays password mismatch error', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(464, 'server.test', ['testnick', 'Password incorrect']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('465 ERR_YOUREBANNEDCREEP - displays banned error', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(465, 'server.test', ['testnick', 'You are banned from this server']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    const channelErrorNumerics = [
      { num: 471, name: 'ERR_CHANNELISFULL', message: 'Channel is full' },
      { num: 472, name: 'ERR_UNKNOWNMODE', message: 'Unknown mode' },
      { num: 473, name: 'ERR_INVITEONLYCHAN', message: 'Invite only channel' },
      { num: 474, name: 'ERR_BANNEDFROMCHAN', message: 'Banned from channel' },
      { num: 475, name: 'ERR_BADCHANNELKEY', message: 'Bad channel key' },
      { num: 476, name: 'ERR_BADCHANMASK', message: 'Bad channel mask' },
      { num: 477, name: 'ERR_NOCHANMODES', message: 'No channel modes' },
      { num: 478, name: 'ERR_BANLISTFULL', message: 'Ban list full' },
      { num: 482, name: 'ERR_CHANOPRIVSNEEDED', message: 'You are not channel operator' },
    ];

    channelErrorNumerics.forEach(({ num, name, message }) => {
      it(`${num} ${name} - displays channel error`, () => {
        const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
        handleNumeric(num, 'server.test', ['testnick', '#test', message]);

        expect(messages).toContainEqual(expect.objectContaining({
          type: 'error',
        }));
      });
    });
  });

  // ========================================
  // SASL NUMERICS (900-908)
  // ========================================

  describe('SASL Numerics (900-908)', () => {
    it('900 RPL_LOGGEDIN - displays logged in message', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(900, 'server.test', ['testnick', 'testnick!user@host', 'account', 'You are now logged in as account']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
        rawCategory: 'auth',
      }));
    });

    it('901 RPL_LOGGEDOUT - displays logged out message', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(901, 'server.test', ['testnick', 'testnick!user@host', 'You are now logged out']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
        rawCategory: 'auth',
      }));
    });

    it('902 ERR_NICKLOCKED - displays nick locked error', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(902, 'server.test', ['testnick', 'You must use a registered nick']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('903 RPL_SASLSUCCESS - displays SASL success', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      (ircService as any).saslAuthenticating = true;

      handleNumeric(903, 'server.test', ['testnick', 'SASL authentication successful']);

      expect((ircService as any).saslAuthenticating).toBe(false);
      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
        rawCategory: 'auth',
      }));
    });

    it('904 ERR_SASLFAIL - displays SASL failure', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      (ircService as any).saslAuthenticating = true;

      handleNumeric(904, 'server.test', ['testnick', 'SASL authentication failed']);

      expect((ircService as any).saslAuthenticating).toBe(false);
      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('905 ERR_SASLTOOLONG - displays SASL too long error', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(905, 'server.test', ['testnick', 'SASL message too long']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('906 ERR_SASLABORTED - displays SASL aborted', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(906, 'server.test', ['testnick', 'SASL authentication aborted']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('907 ERR_SASLALREADY - displays SASL already authenticated', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(907, 'server.test', ['testnick', 'You have already authenticated']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('908 RPL_SASLMECHS - displays available SASL mechanisms', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(908, 'server.test', ['testnick', 'PLAIN,EXTERNAL', 'are available SASL mechanisms']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });
  });

  // ========================================
  // MONITOR NUMERICS (730-734)
  // ========================================

  describe('MONITOR Numerics (730-734)', () => {
    it('730 RPL_MONONLINE - displays online nicks', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(730, 'server.test', ['testnick', 'friend1!user@host,friend2!user@host']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
        rawCategory: 'server',
      }));
    });

    it('731 RPL_MONOFFLINE - displays offline nicks', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(731, 'server.test', ['testnick', 'friend1,friend2']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
        rawCategory: 'server',
      }));
    });

    it('732 RPL_MONLIST - displays monitor list entry', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(732, 'server.test', ['testnick', 'friend1,friend2']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('733 RPL_ENDOFMONLIST - displays end of monitor list', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(733, 'server.test', ['testnick', 'End of MONITOR list']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('734 ERR_MONLISTFULL - displays monitor list full error', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(734, 'server.test', ['testnick', '100', 'friend1', 'Monitor list is full']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });
  });

  // ========================================
  // WATCH NUMERICS (600-608)
  // ========================================

  describe('WATCH Numerics (600-608)', () => {
    it('600 RPL_LOGON - displays user logon', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(600, 'server.test', ['testnick', 'friend', 'user', 'host.test', '*', 'logged on']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
        rawCategory: 'user',
      }));
    });

    it('601 RPL_LOGOFF - displays user logoff', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(601, 'server.test', ['testnick', 'friend', 'user', 'host.test', '*', 'logged off']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
        rawCategory: 'user',
      }));
    });

    it('604 RPL_NOWON - displays user is online', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(604, 'server.test', ['testnick', 'friend', 'user', 'host.test', '*', 'is online']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
        rawCategory: 'user',
      }));
    });

    it('605 RPL_NOWOFF - displays user is offline', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(605, 'server.test', ['testnick', 'friend', '*', '*', '*', 'is offline']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
        rawCategory: 'user',
      }));
    });
  });

  // ========================================
  // STARTTLS NUMERICS (670-699)
  // ========================================

  describe('STARTTLS Numerics (670-699)', () => {
    it('670 RPL_STARTTLS - displays STARTTLS success', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(670, 'server.test', ['testnick', 'STARTTLS successful']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('691 ERR_STARTTLS - displays STARTTLS error', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(691, 'server.test', ['testnick', 'STARTTLS failed']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });
  });

  // ========================================
  // VERSION/INFO NUMERICS (351, 371, 374, 381-391)
  // ========================================

  describe('VERSION/INFO Numerics', () => {
    it('351 RPL_VERSION - displays server version', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(351, 'server.test', ['testnick', 'ircd-1.0', 'server.test', 'Server description']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('371 RPL_INFO - displays info line', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(371, 'server.test', ['testnick', 'Server information line']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('374 RPL_ENDOFINFO - displays end of info', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(374, 'server.test', ['testnick', 'End of INFO list']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('381 RPL_YOUREOPER - displays oper success', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(381, 'server.test', ['testnick', 'You are now an IRC operator']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('382 RPL_REHASHING - displays rehashing message', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(382, 'server.test', ['testnick', 'ircd.conf', 'Rehashing']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('391 RPL_TIME - displays server time', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(391, 'server.test', ['testnick', 'server.test', 'Monday January 1 2024 -- 12:00:00 +0000']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });
  });

  // ========================================
  // INVITE/EXCEPTION LIST NUMERICS (346-349)
  // ========================================

  describe('Invite/Exception List Numerics', () => {
    it('346 RPL_INVITELIST - displays invite list entry', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(346, 'server.test', ['testnick', '#test', '*!*@invited.host', 'setter', '1704067200']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
        rawCategory: 'channel',
      }));
    });

    it('347 RPL_ENDOFINVITELIST - displays end of invite list', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(347, 'server.test', ['testnick', '#test', 'End of channel invite list']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
        rawCategory: 'channel',
      }));
    });

    it('348 RPL_EXCEPTLIST - displays exception list entry', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(348, 'server.test', ['testnick', '#test', '*!*@exempt.host', 'setter', '1704067200']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
        rawCategory: 'channel',
      }));
    });

    it('349 RPL_ENDOFEXCEPTLIST - displays end of exception list', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(349, 'server.test', ['testnick', '#test', 'End of channel exception list']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
        rawCategory: 'channel',
      }));
    });
  });

  // ========================================
  // DEFAULT HANDLER (UNKNOWN NUMERICS)
  // ========================================

  describe('Default Handler (Unknown Numerics)', () => {
    it('handles unknown numerics gracefully', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(999, 'server.test', ['testnick', 'Some unknown message']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('formats unknown numeric with code prefix', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(888, 'server.test', ['testnick', 'Custom server message']);

      const msg = messages.find(m => m.type === 'raw');
      expect(msg?.text).toContain('[888]');
    });
  });

  // ========================================
  // LINKS NUMERICS (364-365)
  // ========================================

  describe('LINKS Numerics', () => {
    it('364 RPL_LINKS - displays links entry', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(364, 'server.test', ['testnick', '*', 'server2.test', '1 Server description']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('365 RPL_ENDOFLINKS - displays end of links', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(365, 'server.test', ['testnick', '*', 'End of LINKS list']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });
  });

  // ========================================
  // TLS/SSL NUMERICS (671)
  // ========================================

  describe('TLS/SSL Numerics', () => {
    it('671 RPL_WHOISSECURE - displays secure connection info', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(671, 'server.test', ['testnick', 'someone', 'is using a secure connection']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });
  });

  // ========================================
  // ADMIN NUMERICS (256-259)
  // ========================================

  describe('ADMIN Numerics (256-259)', () => {
    it('256 RPL_ADMINME - displays admin server', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(256, 'server.test', ['testnick', 'server.test', 'Administrative info']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('257 RPL_ADMINLOC1 - displays admin location 1', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(257, 'server.test', ['testnick', 'Server Location']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('258 RPL_ADMINLOC2 - displays admin location 2', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(258, 'server.test', ['testnick', 'Organization']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('259 RPL_ADMINEMAIL - displays admin email', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(259, 'server.test', ['testnick', 'admin@server.test']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });
  });

  // ========================================
  // QUIET LIST NUMERICS (728-729)
  // ========================================

  describe('Quiet List Numerics (728-729)', () => {
    it('728 RPL_QUIETLIST - displays quiet list entry', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(728, 'server.test', ['testnick', '#test', 'q', '*!*@quiet.host', 'setter', '1704067200']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('729 RPL_ENDOFQUIETLIST - displays end of quiet list', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(729, 'server.test', ['testnick', '#test', 'q', 'End of channel quiet list']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });
  });

  // ========================================
  // SERVICES NUMERICS (307, 310, 320, 335, 378, 379)
  // ========================================

  describe('Services Numerics', () => {
    it('307 RPL_WHOISREGNICK - displays registered nick', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(307, 'server.test', ['testnick', 'someone', 'is a registered nick']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('310 RPL_WHOISHELPOP - displays help operator status', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(310, 'server.test', ['testnick', 'someone', 'is available for help']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('320 RPL_WHOISSPECIAL - displays special status', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(320, 'server.test', ['testnick', 'someone', 'is a Network Administrator']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('335 RPL_WHOISBOT - displays bot status', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(335, 'server.test', ['testnick', 'botname', 'is a Bot on TestNet']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('378 RPL_WHOISHOST - displays connecting host', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(378, 'server.test', ['testnick', 'someone', 'is connecting from *@192.168.1.1']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('379 RPL_WHOISMODES - displays user modes', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(379, 'server.test', ['testnick', 'someone', 'is using modes +iwx']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });
  });

  // ========================================
  // EXTENDED REGISTRATION NUMERICS (6, 7, 10, 15-20, 42, 43)
  // ========================================

  describe('Extended Registration Numerics', () => {
    it('006 RPL_MAP - displays server map', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(6, 'server.test', ['testnick', 'Server map info']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('007 RPL_MAPEND - displays end of server map', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(7, 'server.test', ['testnick', 'End of /MAP']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('010 RPL_BOUNCE - displays bounce/redirect info', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(10, 'server.test', ['testnick', 'other.server.test', '6667', 'Please use this Server/Portinstead']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('015 RPL_MAP - displays server map line', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(15, 'server.test', ['testnick', 'Map line']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('016 RPL_MAPMORE - displays more map', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(16, 'server.test', ['testnick', 'More map info']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('017 RPL_MAPEND - displays end of map', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(17, 'server.test', ['testnick', 'End of /MAP']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('018 RPL_MAPSTART - displays map start', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(18, 'server.test', ['testnick', 'Map start']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('020 RPL_CONNECTING - displays connecting info', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(20, 'server.test', ['testnick', 'Please wait while we process your connection']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('042 RPL_YOURID - displays unique ID', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(42, 'server.test', ['testnick', 'ABC123DEF', 'your unique ID']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('043 RPL_SAVENICK - displays nick saved', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(43, 'server.test', ['testnick', 'newnick', 'Nick collision, your nick is being changed']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });
  });

  // ========================================
  // EXTENDED STATS NUMERICS (220, 240-249, 261, 263-264)
  // ========================================

  describe('Extended Stats Numerics', () => {
    it('220 RPL_STATSPLINE - displays P-line stats', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(220, 'server.test', ['testnick', 'P-line stats info']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('240 RPL_STATSVLINE - displays V-line stats', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(240, 'server.test', ['testnick', 'V-line stats']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    const statsNumerics240s = [241, 243, 244, 245, 246, 247, 248, 249];
    statsNumerics240s.forEach(num => {
      it(`${num} RPL_STATS* - displays stats data`, () => {
        const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
        handleNumeric(num, 'server.test', ['testnick', 'Stats data']);

        expect(messages).toContainEqual(expect.objectContaining({
          type: 'raw',
          isRaw: true,
        }));
      });
    });

    it('261 RPL_TRACELOG - displays trace log', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(261, 'server.test', ['testnick', 'Trace log info']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('263 RPL_TRYAGAIN - displays try again error', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(263, 'server.test', ['testnick', 'STATS', 'Please wait a while and try again']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('264 RPL_STATSHLINE - displays H-line stats', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(264, 'server.test', ['testnick', 'H-line stats']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });
  });

  // ========================================
  // EXTENDED WHOIS NUMERICS
  // ========================================

  describe('Extended WHOIS Numerics', () => {
    it('276 RPL_WHOISCERTFP - displays certificate fingerprint', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(276, 'server.test', ['testnick', 'someone', 'has client certificate fingerprint ABC123']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('302 RPL_USERHOST - displays userhost reply', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(302, 'server.test', ['testnick', 'nick=+user@host']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('303 RPL_ISON - displays ISON reply', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(303, 'server.test', ['testnick', 'nick1 nick2 nick3']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('304 RPL_TEXT - displays text reply', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(304, 'server.test', ['testnick', 'Text reply']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('308 RPL_WHOISADMIN - displays admin status', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(308, 'server.test', ['testnick', 'someone', 'is a Server Administrator']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('309 RPL_WHOISSADMIN - displays services admin', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(309, 'server.test', ['testnick', 'someone', 'is a Services Administrator']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('316 RPL_WHOISCHANOP - displays channel op status', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(316, 'server.test', ['testnick', 'someone', 'is a channel operator']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('325 RPL_UNIQOPIS - displays unique operator', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(325, 'server.test', ['testnick', '#test', 'someone']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('326 RPL_NOCHANPASS - displays no channel password', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(326, 'server.test', ['testnick', '#test', 'No channel password']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('327 RPL_CHPASSUNKNOWN - displays channel password unknown', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(327, 'server.test', ['testnick', '#test', 'Channel password unknown']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('328 RPL_CHANNEL_URL - displays channel URL', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(328, 'server.test', ['testnick', '#test', 'https://example.com']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('334 RPL_LISTUSAGE - displays list usage', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(334, 'server.test', ['testnick', 'Usage info']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('336 RPL_INVITELIST - displays invite list', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(336, 'server.test', ['testnick', '#test']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('337 RPL_ENDOFINVITELIST - displays end of invite list', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(337, 'server.test', ['testnick', 'End of /INVITE list']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('338 RPL_WHOISACTUALLY - displays actual host', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(338, 'server.test', ['testnick', 'someone', 'user@actual.host', 'actually using host']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('339 RPL_BADCHANPASS - displays bad channel password', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(339, 'server.test', ['testnick', '#test', 'Bad channel password']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('340 RPL_USERIP - displays user IP', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(340, 'server.test', ['testnick', 'nick=+192.168.1.1']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('342 RPL_SUMMONING - displays summoning', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(342, 'server.test', ['testnick', 'someone', 'Summoning user to IRC']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('343 RPL_STATS - displays stats info', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(343, 'server.test', ['testnick', 'Stats info']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('344 RPL_REOPLIST - displays reop list', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(344, 'server.test', ['testnick', '#test', 'Reop list entry']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('345 RPL_ENDOFREOPLIST - displays end of reop list', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(345, 'server.test', ['testnick', '#test', 'End of reop list']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('350 RPL_WHOISGATEWAY - displays gateway info', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(350, 'server.test', ['testnick', 'someone', 'is connected via gateway']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('354 RPL_WHOSPCRPL - displays extended WHO', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      (ircService as any).channelUsers.set('#test', new Map());
      handleNumeric(354, 'server.test', ['testnick', '#test', 'user', 'host.test', 'server.test', 'someone', 'H@', '0', 'Real Name']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('380 RPL_YOURHELPER - displays helper status', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(380, 'server.test', ['testnick', 'You are now a helper']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('383 RPL_YOURESERVICE - displays service mode', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(383, 'server.test', ['testnick', 'You are service']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('384 RPL_MYPORTIS - displays port info', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(384, 'server.test', ['testnick', '6667', 'Port to local server is']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('385 RPL_NOTOPERANYMORE - displays not oper anymore', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(385, 'server.test', ['testnick', 'You are no longer an oper']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('386 RPL_QLIST - displays Q-list entry', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(386, 'server.test', ['testnick', '#test', 'founder']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('387 RPL_ENDOFQLIST - displays end of Q-list', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(387, 'server.test', ['testnick', '#test', 'End of Q list']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('388 RPL_ALIST - displays A-list entry', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(388, 'server.test', ['testnick', '#test', 'protected']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('389 RPL_ENDOFALIST - displays end of A-list', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(389, 'server.test', ['testnick', '#test', 'End of A list']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('390 RPL_ENDOFWHOWAS - displays end of whowas', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(390, 'server.test', ['testnick', 'someone', 'End of WHOWAS']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });
  });

  // ========================================
  // SERVER INFO NUMERICS (392-396)
  // ========================================

  describe('Server Info Numerics (392-396)', () => {
    it('392 RPL_USERSSTART - displays users start', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(392, 'server.test', ['testnick', 'UserID   Terminal  Host']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('393 RPL_USERS - displays users', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(393, 'server.test', ['testnick', 'username pts/0 host.test']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('394 RPL_ENDOFUSERS - displays end of users', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(394, 'server.test', ['testnick', 'End of users']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('395 RPL_NOUSERS - displays no users', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(395, 'server.test', ['testnick', 'Nobody logged in']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('396 RPL_HOSTHIDDEN - displays hidden host', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(396, 'server.test', ['testnick', 'hidden.host', 'is now your displayed host']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });
  });

  // ========================================
  // EXTENDED ERROR NUMERICS
  // ========================================

  describe('Extended Error Numerics', () => {
    it('402 ERR_NOSUCHSERVER - displays no such server', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(402, 'server.test', ['testnick', 'unknown.server', 'No such server']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('405 ERR_TOOMANYCHANNELS - displays too many channels', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(405, 'server.test', ['testnick', '#test', 'You have joined too many channels']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('406 ERR_WASNOSUCHNICK - displays was no such nick', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(406, 'server.test', ['testnick', 'oldnick', 'There was no such nickname']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('407 ERR_TOOMANYTARGETS - displays too many targets', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(407, 'server.test', ['testnick', 'target', 'Too many targets']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('408 ERR_NOSUCHSERVICE - displays no such service', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(408, 'server.test', ['testnick', 'service', 'No such service']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('409 ERR_NOORIGIN - displays no origin', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(409, 'server.test', ['testnick', 'No origin specified']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    const missingParamErrors = [
      { num: 411, name: 'ERR_NORECIPIENT' },
      { num: 412, name: 'ERR_NOTEXTTOSEND' },
      { num: 413, name: 'ERR_NOTOPLEVEL' },
      { num: 414, name: 'ERR_WILDTOPLEVEL' },
      { num: 415, name: 'ERR_BADMASK' },
    ];

    missingParamErrors.forEach(({ num, name }) => {
      it(`${num} ${name} - displays error`, () => {
        const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
        handleNumeric(num, 'server.test', ['testnick', 'Error message']);

        expect(messages).toContainEqual(expect.objectContaining({
          type: 'error',
        }));
      });
    });

    it('416 ERR_TOOMANYMATCHES - displays too many matches', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(416, 'server.test', ['testnick', 'WHO', 'Too many matches']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('417 ERR_INPUTTOOLONG - displays input too long', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(417, 'server.test', ['testnick', 'Input line was too long']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('423 ERR_NOADMININFO - displays no admin info', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(423, 'server.test', ['testnick', 'server.test', 'No administrative info available']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('424 ERR_FILEERROR - displays file error', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(424, 'server.test', ['testnick', 'File error doing operation']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('431 ERR_NONICKNAMEGIVEN - displays no nickname given', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(431, 'server.test', ['testnick', 'No nickname given']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('434 ERR_SERVICENAMEINUSE - displays service name in use', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(434, 'server.test', ['testnick', 'servicenick', 'Service name is already in use']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('435 ERR_SERVICECONFUSED - displays service confused', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(435, 'server.test', ['testnick', 'Service is confused']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('436 ERR_NICKCOLLISION - displays nick collision', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(436, 'server.test', ['testnick', 'newnick', 'Nickname collision']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('437 ERR_UNAVAILRESOURCE - displays unavailable resource', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(437, 'server.test', ['testnick', 'resource', 'Nick/channel is temporarily unavailable']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('438 ERR_NICKTOOFAST - displays nick change too fast', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(438, 'server.test', ['testnick', 'newnick', 'Nick change too fast']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('439 ERR_TARGETTOOFAST - displays target too fast', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(439, 'server.test', ['testnick', 'target', 'Target change too fast']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('440 ERR_SERVICESDOWN - displays services down', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(440, 'server.test', ['testnick', 'Services are currently unavailable']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('441 ERR_USERNOTINCHANNEL - displays user not in channel', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(441, 'server.test', ['testnick', 'someone', '#test', 'They are not on that channel']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('442 ERR_NOTONCHANNEL - displays not on channel', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(442, 'server.test', ['testnick', '#test', 'You are not on that channel']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('443 ERR_USERONCHANNEL - displays user on channel', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(443, 'server.test', ['testnick', 'someone', '#test', 'is already on channel']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('444 ERR_NOLOGIN - displays no login', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(444, 'server.test', ['testnick', 'someone', 'User not logged in']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('445 ERR_SUMMONDISABLED - displays summon disabled', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(445, 'server.test', ['testnick', 'SUMMON has been disabled']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('446 ERR_USERSDISABLED - displays users disabled', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(446, 'server.test', ['testnick', 'USERS has been disabled']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('447 ERR_NONICKCHANGE - displays no nick change', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(447, 'server.test', ['testnick', 'Cannot change nickname while banned']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('449 ERR_NOTIMPLEMENTED - displays not implemented', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(449, 'server.test', ['testnick', 'Command not implemented']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('451 ERR_NOTREGISTERED - displays not registered', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(451, 'server.test', ['testnick', 'You have not registered']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('452 ERR_IDCOLLISION - displays ID collision', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(452, 'server.test', ['testnick', 'ID collision']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('453 ERR_NICKLOST - displays nick lost', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(453, 'server.test', ['testnick', 'Nick lost']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('455 ERR_HOSTILENAME - displays hostile name', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(455, 'server.test', ['testnick', 'Your username is hostile']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('461 ERR_NEEDMOREPARAMS - displays need more params', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(461, 'server.test', ['testnick', 'JOIN', 'Not enough parameters']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('462 ERR_ALREADYREGISTRED - displays already registered', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(462, 'server.test', ['testnick', 'You may not reregister']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('463 ERR_NOPERMFORHOST - displays no perm for host', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(463, 'server.test', ['testnick', 'Your host is not among the privileged']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('466 ERR_YOUWILLBEBANNED - displays you will be banned', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(466, 'server.test', ['testnick', 'You will be banned']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('467 ERR_KEYSET - displays key set', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(467, 'server.test', ['testnick', '#test', 'Channel key already set']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('468 ERR_INVALIDUSERNAME - displays invalid username', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(468, 'server.test', ['testnick', 'Invalid username']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('469 ERR_LINKSET - displays link set', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(469, 'server.test', ['testnick', '#test', 'Link already set']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('470 ERR_LINKCHANNEL - displays link/forward channel notice', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(470, 'server.test', ['testnick', '#source', '#target', 'Forwarding to another channel']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'notice',
        isRaw: true,
      }));
    });

    it('479 ERR_BADCHANNAME - displays bad channel name', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(479, 'server.test', ['testnick', '#bad!channel', 'Illegal channel name']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('480 ERR_SSLONLYCHAN - displays SSL only channel', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(480, 'server.test', ['testnick', '#secure', 'Cannot join channel (+S)']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('481 ERR_NOPRIVILEGES - displays no privileges', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(481, 'server.test', ['testnick', 'Permission Denied']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('483 ERR_CANTKILLSERVER - displays cannot kill server', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(483, 'server.test', ['testnick', 'You cannot kill a server!']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('484 ERR_RESTRICTED - displays restricted', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(484, 'server.test', ['testnick', 'Your connection is restricted']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('485 ERR_UNIQOPPRIVSNEEDED - displays unique op privs needed', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(485, 'server.test', ['testnick', 'You are not the channel owner']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('486 ERR_NONONREG - displays no non-reg', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(486, 'server.test', ['testnick', 'someone', 'You must be identified to message this user']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('487 ERR_CHANTOOOLD - displays channel too old', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(487, 'server.test', ['testnick', '#test', 'Channel is too old']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('488 ERR_TSREQUIRED - displays TS required', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(488, 'server.test', ['testnick', 'Timestamp required']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('489 ERR_VOICENEEDED - displays voice needed', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(489, 'server.test', ['testnick', '#test', 'You need voice']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('490 ERR_SECUREONLYCHAN - displays secure only', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(490, 'server.test', ['testnick', '#test', 'Cannot join channel (secure only)']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('491 ERR_NOOPERHOST - displays no oper host', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(491, 'server.test', ['testnick', 'No O-lines for your host']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('492 ERR_NOSERVICEHOST - displays no service host', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(492, 'server.test', ['testnick', 'No service host']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    const extendedErrors = [493, 494, 495, 496, 497, 498, 499];
    extendedErrors.forEach(num => {
      it(`${num} ERR_* - displays extended error`, () => {
        const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
        handleNumeric(num, 'server.test', ['testnick', 'Error message']);

        expect(messages).toContainEqual(expect.objectContaining({
          type: 'error',
        }));
      });
    });

    it('501 ERR_UMODEUNKNOWNFLAG - displays unknown mode flag', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(501, 'server.test', ['testnick', 'Unknown MODE flag']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('502 ERR_USERSDONTMATCH - displays users dont match', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(502, 'server.test', ['testnick', 'Cannot change mode for other users']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('503 ERR_GHOSTEDCLIENT - displays ghosted client', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(503, 'server.test', ['testnick', 'Message could not be delivered']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    const extendedServerErrors = [
      { num: 511, name: 'ERR_SILELISTFULL' },
      { num: 512, name: 'ERR_TOOMANYWATCH' },
      { num: 513, name: 'ERR_BADPING' },
      { num: 514, name: 'ERR_INVALID_ERROR' },
      { num: 521, name: 'ERR_LISTSYNTAX' },
      { num: 524, name: 'ERR_HELPNOTFOUND' },
      { num: 525, name: 'ERR_INVALIDKEY' },
      { num: 531, name: 'ERR_CANTSENDTOUSER' },
    ];

    extendedServerErrors.forEach(({ num, name }) => {
      it(`${num} ${name} - displays error`, () => {
        const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
        handleNumeric(num, 'server.test', ['testnick', 'Error message']);

        expect(messages).toContainEqual(expect.objectContaining({
          type: 'error',
        }));
      });
    });
  });

  // ========================================
  // EXTENDED WATCH NUMERICS (602-603, 606-608)
  // ========================================

  describe('Extended WATCH Numerics', () => {
    it('602 RPL_WATCHOFF - displays watch removed', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(602, 'server.test', ['testnick', 'friend', 'user', 'host.test', '0', 'stopped watching']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('603 RPL_WATCHSTAT - displays watch stats', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(603, 'server.test', ['testnick', 'You have 5 and are on 3 WATCH entries']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('606 RPL_WATCHLIST - displays watch list', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(606, 'server.test', ['testnick', 'friend1 friend2 friend3']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('607 RPL_ENDOFWATCHLIST - displays end of watch list', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(607, 'server.test', ['testnick', 'End of WATCH list']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });

    it('608 RPL_CLEARWATCH - displays watch cleared', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(608, 'server.test', ['testnick', 'Your WATCH list has been cleared']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'raw',
        isRaw: true,
      }));
    });
  });

  // ========================================
  // EXTENDED SERVICES NUMERICS (609-629)
  // ========================================

  describe('Extended Services Numerics (609-629)', () => {
    const servicesNumerics = [
      { num: 609, desc: 'RPL_WHOISWEBIRC' },
      { num: 610, desc: 'RPL_WHOISWEBHOST' },
      { num: 611, desc: 'RPL_WHOISMARKS' },
      { num: 612, desc: 'RPL_WHOISACTUA' },
      { num: 613, desc: 'RPL_WHOISKIDLE' },
      { num: 614, desc: 'RPL_WHOISLOCAL' },
      { num: 615, desc: 'RPL_WHOISLANGUAGE' },
      { num: 616, desc: 'RPL_WHOISLOGGEDAS' },
      { num: 617, desc: 'RPL_DCCSTATUS' },
      { num: 618, desc: 'RPL_DCCLIST' },
      { num: 619, desc: 'RPL_ENDOFDCCLIST' },
      { num: 620, desc: 'RPL_DCCINFO' },
      { num: 621, desc: 'RPL_RULES' },
      { num: 622, desc: 'RPL_ENDOFRULES' },
      { num: 623, desc: 'RPL_MAPMORE' },
      { num: 624, desc: 'RPL_OMOTDSTART' },
      { num: 625, desc: 'RPL_OMOTD' },
      { num: 626, desc: 'RPL_ENDOFOMOTD' },
      { num: 627, desc: 'RPL_SETTINGS' },
      { num: 628, desc: 'RPL_ENDOFSETTINGS' },
      { num: 629, desc: 'RPL_CREATIONTIME' },
    ];

    servicesNumerics.forEach(({ num, desc }) => {
      it(`${num} ${desc} - displays message`, () => {
        const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
        handleNumeric(num, 'server.test', ['testnick', 'Some info']);

        expect(messages).toContainEqual(expect.objectContaining({
          type: 'raw',
          isRaw: true,
        }));
      });
    });
  });

  // ========================================
  // EXTENDED SSL/TLS NUMERICS (660-689)
  // ========================================

  describe('Extended SSL/TLS Numerics (660-689)', () => {
    // Raw message numerics
    const sslRawNumerics = [
      660, 661, 662, 663, 664, 665, 666, 668, 669,
      672, 673, 675, 676, 678, 679, 680, 681, 682,
      687, 688, 689,
    ];

    sslRawNumerics.forEach(num => {
      it(`${num} - displays SSL/TLS info`, () => {
        const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
        handleNumeric(num, 'server.test', ['testnick', 'SSL/TLS info']);

        expect(messages).toContainEqual(expect.objectContaining({
          type: 'raw',
          isRaw: true,
        }));
      });
    });

    // 667 ERR_TARGCHANGE is an error
    it('667 ERR_TARGCHANGE - displays error', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(667, 'server.test', ['testnick', 'target', 'Target change too fast']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    // 674 ERR_CANNOTSETMODES is an error
    it('674 ERR_CANNOTSETMODES - displays error', () => {
      const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
      handleNumeric(674, 'server.test', ['testnick', '#test', 'Cannot set modes']);

      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    // 690-699 are generic extended numerics, handled as raw messages
    const extendedNumerics = [690, 692, 693, 694, 695, 696, 697, 698, 699];

    extendedNumerics.forEach(num => {
      it(`${num} - displays extended numeric info`, () => {
        const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
        handleNumeric(num, 'server.test', ['testnick', 'Extended info']);

        expect(messages).toContainEqual(expect.objectContaining({
          type: 'raw',
          isRaw: true,
        }));
      });
    });
  });

  // ========================================
  // EXTENDED NUMERICS (700-727)
  // ========================================

  describe('Extended Numerics (700-727)', () => {
    // Raw message numerics
    const rawNumerics = [
      { num: 700, desc: 'RPL_COMMANDS' },
      { num: 701, desc: 'RPL_ENDOFCOMMANDS' },
      { num: 702, desc: 'RPL_MODLIST' },
      { num: 703, desc: 'RPL_ENDOFMODLIST' },
      { num: 704, desc: 'RPL_HELPSTART' },
      { num: 705, desc: 'RPL_HELPTXT' },
      { num: 706, desc: 'RPL_ENDOFHELP' },
      { num: 707, desc: 'RPL_ETRACE' },
      { num: 708, desc: 'RPL_ETRACEFULL' },
      { num: 709, desc: 'RPL_ETRACE_END' },
      { num: 710, desc: 'RPL_KNOCK' },
      { num: 711, desc: 'RPL_KNOCKDLVR' },
      { num: 716, desc: 'RPL_TARGUMODEG' },
      { num: 717, desc: 'RPL_TARGNOTIFY' },
      { num: 718, desc: 'RPL_UMODEGMSG' },
      { num: 720, desc: 'RPL_OMOTDSTART' },
      { num: 721, desc: 'RPL_OMOTD' },
      { num: 722, desc: 'RPL_ENDOFOMOTD' },
      { num: 724, desc: 'RPL_TESTMARK' },
      { num: 725, desc: 'RPL_TESTLINE' },
      { num: 726, desc: 'RPL_NOTESTLINE' },
      { num: 727, desc: 'RPL_TESTMASKGECOS' },
    ];

    rawNumerics.forEach(({ num, desc }) => {
      it(`${num} ${desc} - displays message`, () => {
        const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
        handleNumeric(num, 'server.test', ['testnick', 'Extended info']);

        expect(messages).toContainEqual(expect.objectContaining({
          type: 'raw',
          isRaw: true,
        }));
      });
    });

    // Error numerics
    const errorNumerics = [
      { num: 712, desc: 'ERR_TOOMANYKNOCK' },
      { num: 713, desc: 'ERR_CHANOPEN' },
      { num: 714, desc: 'ERR_KNOCKONCHAN' },
      { num: 715, desc: 'ERR_KNOCKDISABLED' },
      { num: 723, desc: 'ERR_NOPRIVS' },
    ];

    errorNumerics.forEach(({ num, desc }) => {
      it(`${num} ${desc} - displays error`, () => {
        const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
        handleNumeric(num, 'server.test', ['testnick', '#test', 'Error message']);

        expect(messages).toContainEqual(expect.objectContaining({
          type: 'error',
        }));
      });
    });
  });

  // ========================================
  // EXTENDED NUMERICS (740-772)
  // ========================================

  describe('Extended Numerics (740-772)', () => {
    // Raw message numerics
    const rawNumerics = [
      { num: 740, desc: 'RPL_RSACHALLENGE2' },
      { num: 741, desc: 'RPL_ENDOFRSACHALLENGE2' },
      { num: 750, desc: 'RPL_SCANMATCHED' },
      { num: 751, desc: 'RPL_SCANUMODES' },
      { num: 752, desc: 'RPL_ETRACEEND' },
      { num: 759, desc: 'RPL_ETRACEFULL' },
      { num: 760, desc: 'RPL_WHOISKEYVALUE' },
      { num: 761, desc: 'RPL_KEYVALUE' },
      { num: 762, desc: 'RPL_METADATAEND' },
      { num: 770, desc: 'RPL_XINFO' },
      { num: 771, desc: 'RPL_XINFOSTART' },
      { num: 772, desc: 'RPL_XINFOEND' },
    ];

    rawNumerics.forEach(({ num, desc }) => {
      it(`${num} ${desc} - displays message`, () => {
        const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
        handleNumeric(num, 'server.test', ['testnick', 'Extended info']);

        expect(messages).toContainEqual(expect.objectContaining({
          type: 'raw',
          isRaw: true,
        }));
      });
    });

    // Error numerics
    const errorNumerics = [
      { num: 742, desc: 'ERR_MLOCKRESTRICTED' },
      { num: 743, desc: 'ERR_INVALIDBAN' },
      { num: 744, desc: 'ERR_TOPICLOCK' },
      { num: 764, desc: 'ERR_METADATALIMIT' },
      { num: 765, desc: 'ERR_TARGETINVALID' },
      { num: 766, desc: 'ERR_NOMATCHINGKEY' },
      { num: 767, desc: 'ERR_KEYINVALID' },
      { num: 768, desc: 'ERR_KEYNOTSET' },
      { num: 769, desc: 'ERR_KEYNOPERMISSION' },
    ];

    errorNumerics.forEach(({ num, desc }) => {
      it(`${num} ${desc} - displays error`, () => {
        const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
        handleNumeric(num, 'server.test', ['testnick', '#test', 'Error info']);

        expect(messages).toContainEqual(expect.objectContaining({
          type: 'error',
        }));
      });
    });
  });

  // ========================================
  // EXTENDED AUTH/SERVICES NUMERICS (910-999)
  // ========================================

  describe('Extended Auth/Services Numerics (910-999)', () => {
    // Raw message numerics
    const rawNumerics = [
      { num: 910, desc: 'RPL_ACCESSADD' },
      { num: 911, desc: 'RPL_ACCESSDEL' },
      { num: 912, desc: 'RPL_ACCESSSTART' },
      { num: 913, desc: 'RPL_ACCESSENTRY' },
      { num: 914, desc: 'RPL_ACCESSEND' },
      { num: 920, desc: 'RPL_DNSSTART' },
      { num: 921, desc: 'RPL_DNSGOOD' },
      { num: 922, desc: 'RPL_DNSBAD' },
      { num: 923, desc: 'RPL_DNSEND' },
      { num: 940, desc: 'RPL_ELISTSTART' },
      { num: 941, desc: 'RPL_ELISTENTRY' },
      { num: 942, desc: 'RPL_ELISTEND' },
      { num: 998, desc: 'RPL_PONG' },
      { num: 999, desc: 'RPL_ENDOFSTATS' },
    ];

    rawNumerics.forEach(({ num, desc }) => {
      it(`${num} ${desc} - displays message`, () => {
        const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
        handleNumeric(num, 'server.test', ['testnick', 'Auth/Service info']);

        expect(messages).toContainEqual(expect.objectContaining({
          type: 'raw',
          isRaw: true,
        }));
      });
    });

    // Error numerics
    const errorNumerics = [
      { num: 915, desc: 'ERR_ACCESSDENIED' },
      { num: 936, desc: 'ERR_CENSORED' },
      { num: 972, desc: 'ERR_CANNOTDOCOMMAND' },
      { num: 973, desc: 'ERR_CANNOTCHANGENICK' },
      { num: 974, desc: 'ERR_CANNOTDEOP' },
      { num: 975, desc: 'ERR_ISREALSERVICE' },
    ];

    errorNumerics.forEach(({ num, desc }) => {
      it(`${num} ${desc} - displays error`, () => {
        const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);
        handleNumeric(num, 'server.test', ['testnick', '#test', 'Error info']);

        expect(messages).toContainEqual(expect.objectContaining({
          type: 'error',
        }));
      });
    });
  });

  // ========================================
  // GENERIC COVERAGE FOR REMAINING NUMERICS
  // ========================================

  describe('Generic Coverage for Remaining Numerics', () => {
    const defaultParams = ['testnick', '#test', 'param1', 'param2', 'param3'];
    const handleNumeric = (ircService as any).handleNumericReply.bind(ircService);

    const numerics = [
      200, 201, 202, 203, 204, 205, 206, 207, 208, 209, 210,
      211, 212, 213, 214, 215, 216, 217, 218,
      241, 243, 244, 245, 246, 247, 248, 249,
      411, 412, 413, 414, 415,
      471, 472, 473, 474, 475, 476, 477, 478, 482,
      493, 494, 495, 496, 497, 498, 499,
      511, 512, 513, 514, 521, 524, 525, 531,
      609, 610, 611, 612, 613, 614, 615, 616, 617, 618, 619,
      620, 621, 622, 623, 624, 625, 626, 627, 628, 629,
      660, 661, 662, 663, 664, 665, 666, 668, 669,
      672, 673, 675, 676, 678, 679, 680, 681, 682,
      687, 688, 689,
      690, 692, 693, 694, 695, 696, 697, 698, 699,
      700, 701, 702, 703, 704, 705, 706, 707, 708, 709, 710,
      711, 712, 713, 714, 715, 716, 717, 718,
      720, 721, 722, 723, 724, 725, 726, 727,
      740, 741, 742, 743, 744, 750, 751, 752, 759, 760, 761, 762,
      764, 765, 766, 767, 768, 769, 770, 771, 772,
      910, 911, 912, 913, 914, 915,
      920, 921, 922, 923,
      936, 940, 941, 942,
      972, 973, 974, 975,
      998,
    ];

    numerics.forEach(num => {
      it(`${num} - produces a message`, () => {
        const before = messages.length;
        handleNumeric(num, 'server.test', [...defaultParams]);
        expect(messages.length).toBeGreaterThan(before);
      });
    });
  });
});

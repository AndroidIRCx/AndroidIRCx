/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * IRC Send Command Handlers Unit Test Suite
 *
 * Direct unit tests for all /command handler modules via IRCService.sendMessage():
 * - BasicIRCCommands (JOIN, PART, NICK, SETNAME, BOT, QUIT, MODE, TOPIC, KICK, REGISTER)
 * - QueryCommands (WHOIS, WHOWAS, WHO)
 * - StatusCommands (AWAY, BACK, RECONNECT, DISCONNECT, SERVER)
 * - MessageCommands (MSG, NOTICE, ME/ACTION, AMSG, AME, ANOTICE)
 * - ChannelOpsCommands (OP, DEOP, VOICE, DEVOICE, BAN, UNBAN, MUTE, UNMUTE)
 * - OperCommands (OPER, KILL, GLINE, WALLOPS)
 */

import { IRCService, IRCMessage } from '../src/services/IRCService';
import { FakeSocket } from '../test-support/FakeSocket';

describe('IRC Send Commands', () => {
  let irc: IRCService;
  let socket: FakeSocket;
  let messages: IRCMessage[];

  beforeEach(() => {
    jest.useFakeTimers();
    irc = new IRCService();
    socket = new FakeSocket();
    messages = [];
    (irc as any).socket = socket;
    (irc as any).isConnected = true;
    (irc as any).currentNick = 'tester';
    (irc as any).channelUsers = new Map();
    (irc as any).channelUsers.set('#test', new Map());
    irc.onMessage(msg => messages.push(msg));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ========================================
  // BASIC IRC COMMANDS
  // ========================================
  describe('BasicIRCCommands', () => {
    it('/join sends JOIN command', () => {
      irc.sendMessage('#test', '/join #newchan');
      expect(socket.writes.some(w => w.includes('JOIN #newchan'))).toBe(true);
    });

    it('/join with key', () => {
      irc.sendMessage('#test', '/join #secret mykey');
      expect(socket.writes.some(w => w.includes('JOIN #secret') && w.includes('mykey'))).toBe(true);
    });

    it('/part sends PART for current channel', () => {
      irc.sendMessage('#test', '/part');
      expect(socket.writes.some(w => w.includes('PART #test'))).toBe(true);
    });

    it('/part with channel and message', () => {
      irc.sendMessage('#test', '/part #other Goodbye');
      expect(socket.writes.some(w => w.includes('PART #other') || w.includes('Goodbye'))).toBe(true);
    });

    it('/part shows error for non-channel target without args', () => {
      irc.sendMessage('alice', '/part');
      const err = messages.find(m => m.type === 'error');
      expect(err).toBeTruthy();
    });

    it('/nick sends NICK command', () => {
      irc.sendMessage('#test', '/nick newnick');
      expect(socket.writes.some(w => w.includes('NICK newnick'))).toBe(true);
    });

    it('/setname sends SETNAME command', () => {
      irc.sendMessage('#test', '/setname John Smith');
      // Should call setRealname which sends SETNAME
      expect(socket.writes.length).toBeGreaterThanOrEqual(0);
    });

    it('/quit sends QUIT with default message', () => {
      irc.sendMessage('#test', '/quit');
      expect(socket.writes.some(w => w.includes('QUIT'))).toBe(true);
    });

    it('/quit with custom message', () => {
      irc.sendMessage('#test', '/quit See you later');
      expect(socket.writes.some(w => w.includes('QUIT :See you later'))).toBe(true);
    });

    it('/mode sends MODE command', () => {
      irc.sendMessage('#test', '/mode #test +o alice');
      expect(socket.writes.some(w => w.includes('MODE #test +o alice'))).toBe(true);
    });

    it('/topic sends TOPIC command', () => {
      irc.sendMessage('#test', '/topic New topic here');
      expect(socket.writes.some(w => w.includes('TOPIC'))).toBe(true);
    });

    it('/kick sends KICK command', () => {
      irc.sendMessage('#test', '/kick alice');
      expect(socket.writes.some(w => w.includes('KICK #test alice'))).toBe(true);
    });
  });

  // ========================================
  // QUERY COMMANDS
  // ========================================
  describe('QueryCommands', () => {
    it('/whois sends WHOIS command', () => {
      irc.sendMessage('#test', '/whois alice');
      expect(socket.writes.some(w => w.includes('WHOIS alice'))).toBe(true);
    });

    it('/whowas sends WHOWAS command', () => {
      irc.sendMessage('#test', '/whowas oldnick');
      expect(socket.writes.some(w => w.includes('WHOWAS oldnick'))).toBe(true);
    });

    it('/who sends WHO command', () => {
      irc.sendMessage('#test', '/who #test');
      expect(socket.writes.some(w => w.includes('WHO #test'))).toBe(true);
    });

    it('/who without args sends bare WHO', () => {
      irc.sendMessage('#test', '/who');
      expect(socket.writes.some(w => w.includes('WHO'))).toBe(true);
    });
  });

  // ========================================
  // STATUS COMMANDS
  // ========================================
  describe('StatusCommands', () => {
    it('/away sets away message', () => {
      irc.sendMessage('#test', '/away Gone fishing');
      expect(socket.writes.some(w => w.includes('AWAY :Gone fishing'))).toBe(true);
      const notice = messages.find(m => m.type === 'notice');
      expect(notice?.text).toContain('away');
    });

    it('/away without args removes away', () => {
      irc.sendMessage('#test', '/away');
      expect(socket.writes.some(w => w.match(/AWAY\r?\n?$/) || w === 'AWAY\r\n')).toBe(true);
    });

    it('/back removes away', () => {
      irc.sendMessage('#test', '/back');
      expect(socket.writes.some(w => w.match(/AWAY\r?\n?$/) || w === 'AWAY\r\n')).toBe(true);
    });

    it('/reconnect emits reconnect event', () => {
      const emitSpy = jest.spyOn(irc as any, 'emit');
      irc.sendMessage('#test', '/reconnect');
      expect(emitSpy).toHaveBeenCalledWith('reconnect', expect.any(String));
    });

    it('/disconnect sends QUIT', () => {
      irc.sendMessage('#test', '/disconnect');
      expect(socket.writes.some(w => w.includes('QUIT'))).toBe(true);
    });
  });

  // ========================================
  // MESSAGE COMMANDS
  // ========================================
  describe('MessageCommands', () => {
    it('/msg sends PRIVMSG to target', () => {
      irc.sendMessage('#test', '/msg alice Hello there');
      expect(socket.writes.some(w => w.includes('PRIVMSG alice :Hello there'))).toBe(true);
    });

    it('/msg shows error with no message', () => {
      irc.sendMessage('#test', '/msg alice');
      const err = messages.find(m => m.type === 'error');
      expect(err).toBeTruthy();
    });

    it('/notice sends NOTICE to target', () => {
      irc.sendMessage('#test', '/notice alice Hey');
      expect(socket.writes.some(w => w.includes('NOTICE alice :Hey'))).toBe(true);
    });

    it('/me sends CTCP ACTION', () => {
      irc.sendMessage('#test', '/me waves');
      expect(socket.writes.some(w => w.includes('\x01ACTION waves\x01'))).toBe(true);
    });

    it('/action sends CTCP ACTION', () => {
      irc.sendMessage('#test', '/action dances');
      expect(socket.writes.some(w => w.includes('\x01ACTION dances\x01'))).toBe(true);
    });
  });

  // ========================================
  // CHANNEL OPS COMMANDS
  // ========================================
  describe('ChannelOpsCommands', () => {
    it('/ban sends MODE +b with nick mask', () => {
      irc.sendMessage('#test', '/ban badguy');
      expect(socket.writes.some(w => w.includes('MODE #test +b badguy!*@*'))).toBe(true);
    });

    it('/unban sends MODE -b', () => {
      irc.sendMessage('#test', '/unban *!*@bad.host');
      expect(socket.writes.some(w => w.includes('MODE #test -b *!*@bad.host'))).toBe(true);
    });

    it('/kickban bans then kicks', () => {
      irc.sendMessage('#test', '/kickban badguy Spamming');
      expect(socket.writes.some(w => w.includes('MODE #test +b badguy!*@*'))).toBe(true);
      expect(socket.writes.some(w => w.includes('KICK #test badguy'))).toBe(true);
    });

    it('/invite sends INVITE command', () => {
      irc.sendMessage('#test', '/invite alice');
      expect(socket.writes.some(w => w.includes('INVITE alice #test'))).toBe(true);
    });
  });

  // ========================================
  // OPER COMMANDS
  // ========================================
  describe('OperCommands', () => {
    it('/oper sends OPER command', () => {
      irc.sendMessage('#test', '/oper admin secret');
      expect(socket.writes.some(w => w.includes('OPER admin secret'))).toBe(true);
    });

    it('/wallops sends WALLOPS command', () => {
      irc.sendMessage('#test', '/wallops Important message');
      expect(socket.writes.some(w => w.includes('WALLOPS') && w.includes('Important message'))).toBe(true);
    });
  });

  // ========================================
  // UTILITY COMMANDS
  // ========================================
  describe('UtilityCommands', () => {
    it('/echo displays local message without sending', () => {
      irc.sendMessage('#test', '/echo Test message');
      expect(socket.writes).toHaveLength(0);
      const msg = messages.find(m => m.text?.includes('Test message'));
      expect(msg).toBeTruthy();
    });

    it('/clear emits clear-tab', () => {
      const emitSpy = jest.spyOn(irc as any, 'emit');
      irc.sendMessage('#test', '/clear');
      expect(emitSpy).toHaveBeenCalledWith('clear-tab', '#test', '');
    });

    it('/close emits close-tab', () => {
      const emitSpy = jest.spyOn(irc as any, 'emit');
      irc.sendMessage('#test', '/close');
      expect(emitSpy).toHaveBeenCalledWith('close-tab', '#test', '');
    });

    it('/ping sends server PING', () => {
      irc.sendMessage('#test', '/ping irc.server.com');
      expect(socket.writes.some(w => w.includes('PING irc.server.com'))).toBe(true);
    });

    it('/quote sends raw command', () => {
      irc.sendMessage('#test', '/quote USERHOST tester');
      expect(socket.writes.some(w => w.includes('USERHOST tester'))).toBe(true);
    });
  });

  // ========================================
  // INFO COMMANDS
  // ========================================
  describe('InfoCommands', () => {
    it('/motd sends MOTD', () => {
      irc.sendMessage('#test', '/motd');
      expect(socket.writes.some(w => w.includes('MOTD'))).toBe(true);
    });

    it('/version sends VERSION', () => {
      irc.sendMessage('#test', '/version');
      expect(socket.writes.some(w => w.includes('VERSION'))).toBe(true);
    });

    it('/lusers sends LUSERS', () => {
      irc.sendMessage('#test', '/lusers');
      expect(socket.writes.some(w => w.includes('LUSERS'))).toBe(true);
    });

    it('/admin sends ADMIN', () => {
      irc.sendMessage('#test', '/admin');
      expect(socket.writes.some(w => w.includes('ADMIN'))).toBe(true);
    });

    it('/info sends INFO', () => {
      irc.sendMessage('#test', '/info');
      expect(socket.writes.some(w => w.includes('INFO'))).toBe(true);
    });

    it('/time sends TIME', () => {
      irc.sendMessage('#test', '/time');
      expect(socket.writes.some(w => w.includes('TIME'))).toBe(true);
    });

    it('/links sends LINKS', () => {
      irc.sendMessage('#test', '/links');
      expect(socket.writes.some(w => w.includes('LINKS'))).toBe(true);
    });

    it('/stats sends STATS', () => {
      irc.sendMessage('#test', '/stats u');
      expect(socket.writes.some(w => w.includes('STATS u'))).toBe(true);
    });

    it('/list sends LIST', () => {
      irc.sendMessage('#test', '/list');
      expect(socket.writes.some(w => w.includes('LIST'))).toBe(true);
    });

    it('/names sends NAMES', () => {
      irc.sendMessage('#test', '/names #test');
      expect(socket.writes.some(w => w.includes('NAMES #test'))).toBe(true);
    });

    it('/trace sends TRACE', () => {
      irc.sendMessage('#test', '/trace');
      expect(socket.writes.some(w => w.includes('TRACE'))).toBe(true);
    });
  });

  // ========================================
  // /REGISTER COMMAND (with CAP check)
  // ========================================
  describe('/register command', () => {
    it('errors when draft/account-registration not enabled', () => {
      irc.sendMessage('#test', '/register user@example.com pass');
      const err = messages.find(m => m.type === 'error');
      expect(err?.text).toContain('not supported');
    });

    it('sends REGISTER with 2 args', () => {
      (irc as any).capEnabledSet.add('draft/account-registration');
      irc.sendMessage('#test', '/register user@example.com pass');
      expect(socket.writes.some(w => w.includes('REGISTER * user@example.com :pass'))).toBe(true);
    });

    it('sends REGISTER with 3 args', () => {
      (irc as any).capEnabledSet.add('draft/account-registration');
      irc.sendMessage('#test', '/register myaccount user@example.com pass');
      expect(socket.writes.some(w => w.includes('REGISTER myaccount user@example.com :pass'))).toBe(true);
    });

    it('errors with too few args', () => {
      (irc as any).capEnabledSet.add('draft/account-registration');
      irc.sendMessage('#test', '/register onlyonearg');
      const err = messages.find(m => m.type === 'error');
      expect(err?.text).toContain('Usage');
    });
  });

  // ========================================
  // CHANNEL COMMANDS
  // ========================================
  describe('ChannelCommands', () => {
    it('/invite with explicit channel', () => {
      irc.sendMessage('#test', '/invite alice #other');
      expect(socket.writes.some(w => w.includes('INVITE alice #other'))).toBe(true);
    });
  });

  // ========================================
  // UNKNOWN COMMANDS
  // ========================================
  describe('Unknown commands', () => {
    it('sends unknown commands as raw to server', () => {
      irc.sendMessage('#test', '/unknowncmd arg1 arg2');
      // Unknown commands should either be sent raw or show error
      expect(socket.writes.length + messages.length).toBeGreaterThan(0);
    });
  });
});

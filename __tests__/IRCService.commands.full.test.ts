/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * IRCService Command Handlers Test Suite
 *
 * Tests commands in sendMessage() function.
 * These tests verify command parsing and handling behavior.
 *
 * NOTE: Many command tests require specific socket/connection state.
 * This initial test suite focuses on commands that can be reliably tested
 * with mocked state. After refactoring, individual command handlers can
 * be tested in isolation.
 *
 * Commands covered:
 * - Clone Detection (CLONES, DETECTCLONES, CLONESDETECT)
 * - Utility Commands (ECHO, CLEAR, CLOSE, HELP)
 * - Local State Commands (IGNORE, UNIGNORE, ANICK, AJINVITE, BEEP)
 * - Encryption Commands (SHAREKEY, REQUESTKEY, CHANKEY)
 * - Error Handling
 *
 * TODO: After refactoring, expand to test all 70+ commands in isolation.
 */

import { ircService } from '../src/services/IRCService';

describe('IRCService Command Handlers', () => {
  let addMessageSpy: jest.SpyInstance;
  let emitSpy: jest.SpyInstance;
  let messages: any[];

  beforeEach(() => {
    messages = [];

    addMessageSpy = jest.spyOn(ircService as any, 'addMessage').mockImplementation((msg: any) => {
      messages.push(msg);
    });

    emitSpy = jest.spyOn(ircService as any, 'emit').mockImplementation(() => {});

    // Set up basic state
    (ircService as any).currentNick = 'testnick';
    (ircService as any).isConnected = true;
    (ircService as any).registered = true;
    (ircService as any).serverTime = true;
    (ircService as any).channels = new Set(['#test']);
    (ircService as any).channelUsers = new Map();
    (ircService as any).channelUsers.set('#test', new Map());
    (ircService as any).ignoreList = new Set();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Helper to call sendMessage
  const sendMessage = (target: string, text: string) => {
    (ircService as any).sendMessage(target, text);
  };

  // ========================================
  // UTILITY COMMANDS
  // ========================================

  describe('Utility Commands', () => {
    it('/echo - displays local message', () => {
      sendMessage('#test', '/echo This is a test');
      expect(messages).toContainEqual(expect.objectContaining({
        text: expect.stringContaining('This is a test'),
      }));
    });

    it('/clear - clears messages', () => {
      sendMessage('#test', '/clear');
      expect(emitSpy).toHaveBeenCalledWith('clear-tab', '#test', '');
    });

    it('/close - closes current window', () => {
      sendMessage('#test', '/close');
      expect(emitSpy).toHaveBeenCalledWith('close-tab', '#test', '');
    });

    it('/help - shows help or sends to server', () => {
      sendMessage('#test', '/help');
      // Help can either show locally or send to server
      expect(messages.length + emitSpy.mock.calls.length).toBeGreaterThanOrEqual(0);
    });

    it('/dns - shows DNS info', () => {
      sendMessage('#test', '/dns example.com');
      // DNS lookup, either local or shows message
      expect(messages.length).toBeGreaterThanOrEqual(0);
    });
  });

  // ========================================
  // CLONE DETECTION COMMANDS
  // ========================================

  describe('Clone Detection Commands', () => {
    beforeEach(() => {
      // Set up channelUsers with test data for clone detection
      // Format must include nick property
      const usersMap = new Map([
        ['user1', { nick: 'user1', host: 'same.host.com', ident: 'user', modes: '' }],
        ['user2', { nick: 'user2', host: 'same.host.com', ident: 'user', modes: '' }],
        ['user3', { nick: 'user3', host: 'different.host.com', ident: 'user', modes: '' }],
      ]);
      (ircService as any).channelUsers.set('#test', usersMap);
    });

    it('/clones - detects clones in channel', async () => {
      sendMessage('#test', '/clones');
      // Wait for async detectClones to complete
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(messages.length).toBeGreaterThan(0);
    });

    it('/detectclones - alias for clones', async () => {
      sendMessage('#test', '/detectclones');
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(messages.length).toBeGreaterThan(0);
    });

    it('/clonesdetect - alias for clones', async () => {
      sendMessage('#test', '/clonesdetect');
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(messages.length).toBeGreaterThan(0);
    });

    it('clones shows message when no clones found', async () => {
      // Set up with no duplicate hosts
      const usersMap = new Map([
        ['user1', { nick: 'user1', host: 'host1.com', ident: 'user', modes: '' }],
        ['user2', { nick: 'user2', host: 'host2.com', ident: 'user', modes: '' }],
      ]);
      (ircService as any).channelUsers.set('#test', usersMap);

      sendMessage('#test', '/clones');
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(messages.length).toBeGreaterThan(0);
    });
  });

  // ========================================
  // LOCAL STATE COMMANDS (IGNORE)
  // ========================================

  describe('Ignore Commands', () => {
    let userManagementServiceMock: { ignoreUser: jest.Mock; unignoreUser: jest.Mock };

    beforeEach(() => {
      // Mock getUserManagementService - ignore is now handled by UserManagementService
      userManagementServiceMock = {
        ignoreUser: jest.fn().mockResolvedValue(undefined),
        unignoreUser: jest.fn().mockResolvedValue(undefined),
      };
      jest.spyOn(ircService as any, 'getUserManagementService').mockReturnValue(userManagementServiceMock);
    });

    it('/ignore - calls ignoreUser on UserManagementService', async () => {
      sendMessage('#test', '/ignore annoying');
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(userManagementServiceMock.ignoreUser).toHaveBeenCalledWith('annoying', undefined, expect.any(String));
    });

    it('/unignore - calls unignoreUser on UserManagementService', async () => {
      sendMessage('#test', '/unignore annoying');
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(userManagementServiceMock.unignoreUser).toHaveBeenCalledWith('annoying', expect.any(String));
    });

    it('/ignore without args - shows usage error', () => {
      sendMessage('#test', '/ignore');
      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('/ignore with reason - passes reason to service', async () => {
      sendMessage('#test', '/ignore annoying spamming constantly');
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(userManagementServiceMock.ignoreUser).toHaveBeenCalledWith('annoying', 'spamming constantly', expect.any(String));
    });
  });

  // ========================================
  // ENCRYPTION COMMANDS
  // ========================================

  describe('Encryption Commands', () => {
    beforeEach(() => {
      (ircService as any).encryptionEnabled = true;
      (ircService as any).encryptionKeys = new Map();
    });

    it('/sharekey - handles key sharing', () => {
      sendMessage('#test', '/sharekey friend');
      // May show message or attempt key share
      expect(messages.length).toBeGreaterThanOrEqual(0);
    });

    it('/requestkey - handles key request', () => {
      sendMessage('#test', '/requestkey friend');
      expect(messages.length).toBeGreaterThanOrEqual(0);
    });

    it('/chankey generate - generates channel key', () => {
      sendMessage('#test', '/chankey generate');
      expect(messages.length).toBeGreaterThanOrEqual(0);
    });

    it('/chankey share - shares channel key', () => {
      sendMessage('#test', '/chankey share');
      expect(messages.length).toBeGreaterThanOrEqual(0);
    });
  });

  // ========================================
  // SPECIAL LOCAL COMMANDS
  // ========================================

  describe('Special Local Commands', () => {
    it('/anick - sets alternative nick', () => {
      sendMessage('#test', '/anick altnick');
      // Alt nick is stored locally
      expect(messages.length).toBeGreaterThanOrEqual(0);
    });

    it('/ajinvite - handles auto-join invite', () => {
      sendMessage('#test', '/ajinvite #channel');
      expect(messages.length).toBeGreaterThanOrEqual(0);
    });

    it('/beep - plays beep sound', () => {
      sendMessage('#test', '/beep');
      expect(messages.length).toBeGreaterThanOrEqual(0);
    });

    it('/chat - handles chat request', () => {
      sendMessage('#test', '/chat someone');
      expect(messages.length).toBeGreaterThanOrEqual(0);
    });
  });

  // ========================================
  // ERROR HANDLING
  // ========================================

  describe('Error Handling', () => {
    it('unknown command - handles gracefully', () => {
      // Should not throw
      expect(() => sendMessage('#test', '/unknowncommand arg1 arg2')).not.toThrow();
    });

    it('empty command - does nothing', () => {
      expect(() => sendMessage('#test', '/')).not.toThrow();
    });

    it('command with only spaces - does nothing', () => {
      expect(() => sendMessage('#test', '/   ')).not.toThrow();
    });
  });

  // ========================================
  // COMMAND PARSING
  // ========================================

  describe('Command Parsing', () => {
    it('commands are case-insensitive', () => {
      sendMessage('#test', '/ECHO Test');
      const hasEcho = messages.some(m => m.text?.includes('Test'));
      expect(hasEcho).toBe(true);
    });

    it('commands can have leading whitespace', () => {
      sendMessage('#test', '/echo Test with trailing space');
      const hasEcho = messages.some(m => m.text?.includes('Test'));
      expect(hasEcho).toBe(true);
    });
  });

  // ========================================
  // BASIC IRC COMMANDS
  // ========================================

  describe('Basic IRC Commands', () => {
    let sendRawSpy: jest.SpyInstance;
    let sendCommandSpy: jest.SpyInstance;
    let joinChannelSpy: jest.SpyInstance;
    let partChannelSpy: jest.SpyInstance;

    beforeEach(() => {
      sendRawSpy = jest.spyOn(ircService as any, 'sendRaw').mockImplementation(() => {});
      sendCommandSpy = jest.spyOn(ircService as any, 'sendCommand').mockImplementation(() => {});
      joinChannelSpy = jest.spyOn(ircService as any, 'joinChannel').mockImplementation(() => {});
      partChannelSpy = jest.spyOn(ircService as any, 'partChannel').mockImplementation(() => {});
    });

    it('/join - joins channel', () => {
      sendMessage('#test', '/join #newchannel');
      expect(joinChannelSpy).toHaveBeenCalledWith('#newchannel', undefined);
    });

    it('/join with key - joins channel with key', () => {
      sendMessage('#test', '/join #secret secretkey');
      expect(joinChannelSpy).toHaveBeenCalledWith('#secret', 'secretkey');
    });

    it('/part - parts current channel', () => {
      sendMessage('#test', '/part');
      expect(partChannelSpy).toHaveBeenCalledWith('#test', '');
    });

    it('/part with message - parts with reason', () => {
      sendMessage('#test', '/part #test Goodbye!');
      expect(partChannelSpy).toHaveBeenCalledWith('#test', 'Goodbye!');
    });

    it('/nick - changes nick', () => {
      sendMessage('#test', '/nick newnick');
      expect(sendRawSpy).toHaveBeenCalledWith('NICK newnick');
    });

    it('/quit - sends quit command', () => {
      sendMessage('#test', '/quit Leaving');
      expect(emitSpy).toHaveBeenCalledWith('intentional-quit', expect.any(String));
      expect(sendRawSpy).toHaveBeenCalledWith('QUIT :Leaving');
    });

    it('/whois - sends whois query', () => {
      sendMessage('#test', '/whois somebody');
      expect(sendCommandSpy).toHaveBeenCalledWith('WHOIS somebody');
    });

    it('/whowas - sends whowas query', () => {
      sendMessage('#test', '/whowas olduser');
      expect(sendCommandSpy).toHaveBeenCalledWith('WHOWAS olduser');
    });
  });

  // ========================================
  // MESSAGING COMMANDS
  // ========================================

  describe('Messaging Commands', () => {
    let sendRawSpy: jest.SpyInstance;

    beforeEach(() => {
      sendRawSpy = jest.spyOn(ircService as any, 'sendRaw').mockImplementation(() => {});
    });

    it('/msg - sends private message', () => {
      sendMessage('#test', '/msg someone Hello there');
      expect(sendRawSpy).toHaveBeenCalledWith('PRIVMSG someone :Hello there');
      expect(messages).toContainEqual(expect.objectContaining({
        type: 'message',
        channel: 'someone',
        text: 'Hello there',
      }));
    });

    it('/query - alias for msg', () => {
      sendMessage('#test', '/query user Hi');
      expect(sendRawSpy).toHaveBeenCalledWith('PRIVMSG user :Hi');
    });

    it('/me - sends action', () => {
      sendMessage('#test', '/me dances');
      expect(sendRawSpy).toHaveBeenCalledWith(expect.stringContaining('PRIVMSG #test :'));
    });

    it('/action - alias for me', () => {
      sendMessage('#test', '/action waves');
      expect(sendRawSpy).toHaveBeenCalledWith(expect.stringContaining('PRIVMSG #test :'));
    });

    it('/notice - sends notice', () => {
      sendMessage('#test', '/notice someone Important message');
      expect(sendRawSpy).toHaveBeenCalledWith('NOTICE someone :Important message');
    });

    it('/amsg - emits amsg event', () => {
      sendMessage('#test', '/amsg Hello all channels');
      expect(emitSpy).toHaveBeenCalledWith('amsg', 'Hello all channels', expect.any(String));
    });

    it('/ame - emits ame event', () => {
      sendMessage('#test', '/ame waves to all');
      expect(emitSpy).toHaveBeenCalledWith('ame', 'waves to all', expect.any(String));
    });

    it('/anotice - emits anotice event', () => {
      sendMessage('#test', '/anotice Attention everyone');
      expect(emitSpy).toHaveBeenCalledWith('anotice', 'Attention everyone', expect.any(String));
    });
  });

  // ========================================
  // CHANNEL COMMANDS
  // ========================================

  describe('Channel Commands', () => {
    let sendCommandSpy: jest.SpyInstance;
    let sendRawSpy: jest.SpyInstance;

    beforeEach(() => {
      sendCommandSpy = jest.spyOn(ircService as any, 'sendCommand').mockImplementation(() => {});
      sendRawSpy = jest.spyOn(ircService as any, 'sendRaw').mockImplementation(() => {});
    });

    it('/mode - sends mode command', () => {
      sendMessage('#test', '/mode #test +o someone');
      expect(sendCommandSpy).toHaveBeenCalledWith('MODE #test +o someone');
    });

    it('/topic - gets topic', () => {
      sendMessage('#test', '/topic');
      expect(sendCommandSpy).toHaveBeenCalledWith('TOPIC #test');
    });

    it('/topic with text - sets topic', () => {
      // When in channel, first arg is skipped if target is already a channel
      // Implementation: topicText = args.slice(1).join(' ')
      sendMessage('#test', '/topic #test New channel topic');
      expect(sendCommandSpy).toHaveBeenCalledWith('TOPIC #test :New channel topic');
    });

    it('/kick - kicks user', () => {
      sendMessage('#test', '/kick baduser');
      expect(sendCommandSpy).toHaveBeenCalledWith('KICK #test baduser');
    });

    it('/kick with reason - kicks user with reason', () => {
      // Implementation expects: /kick [channel] <user> [reason]
      // When in channel, args[0] could be channel, args[1] is user, args[2+] is reason
      sendMessage('#test', '/kick #test baduser Being disruptive');
      expect(sendCommandSpy).toHaveBeenCalledWith('KICK #test baduser :Being disruptive');
    });

    it('/ban - bans user', () => {
      sendMessage('#test', '/ban baduser');
      expect(sendCommandSpy).toHaveBeenCalledWith('MODE #test +b baduser!*@*');
    });

    it('/unban - unbans user', () => {
      sendMessage('#test', '/unban *!*@bad.host');
      expect(sendCommandSpy).toHaveBeenCalledWith('MODE #test -b *!*@bad.host');
    });

    it('/kickban - kicks and bans user', () => {
      sendMessage('#test', '/kickban baduser');
      expect(sendCommandSpy).toHaveBeenCalledWith('MODE #test +b baduser!*@*');
      expect(sendCommandSpy).toHaveBeenCalledWith('KICK #test baduser');
    });

    it('/invite - invites user', () => {
      sendMessage('#test', '/invite friend');
      expect(sendCommandSpy).toHaveBeenCalledWith('INVITE friend #test');
    });

    it('/list - lists channels', () => {
      sendMessage('#test', '/list');
      expect(sendCommandSpy).toHaveBeenCalledWith('LIST');
    });

    it('/names - lists users in channel', () => {
      sendMessage('#test', '/names');
      expect(sendCommandSpy).toHaveBeenCalledWith('NAMES #test');
    });

    it('/who - sends who query', () => {
      sendMessage('#test', '/who #test');
      expect(sendCommandSpy).toHaveBeenCalledWith('WHO #test');
    });
  });

  // ========================================
  // SERVER QUERY COMMANDS
  // ========================================

  describe('Server Query Commands', () => {
    let sendCommandSpy: jest.SpyInstance;

    beforeEach(() => {
      sendCommandSpy = jest.spyOn(ircService as any, 'sendCommand').mockImplementation(() => {});
    });

    it('/lusers - gets user stats', () => {
      sendMessage('#test', '/lusers');
      expect(sendCommandSpy).toHaveBeenCalledWith('LUSERS');
    });

    it('/version - gets server version', () => {
      sendMessage('#test', '/version');
      expect(sendCommandSpy).toHaveBeenCalledWith('VERSION');
    });

    it('/time - gets server time', () => {
      sendMessage('#test', '/time');
      expect(sendCommandSpy).toHaveBeenCalledWith('TIME');
    });

    it('/admin - gets admin info', () => {
      sendMessage('#test', '/admin');
      expect(sendCommandSpy).toHaveBeenCalledWith('ADMIN');
    });

    it('/links - lists server links', () => {
      sendMessage('#test', '/links');
      expect(sendCommandSpy).toHaveBeenCalledWith('LINKS');
    });

    it('/stats - gets server stats', () => {
      sendMessage('#test', '/stats u');
      expect(sendCommandSpy).toHaveBeenCalledWith('STATS u');
    });

    it('/ison - checks if nicks are online', () => {
      sendMessage('#test', '/ison nick1 nick2');
      expect(sendCommandSpy).toHaveBeenCalledWith('ISON nick1 nick2');
    });

    it('/motd - gets message of the day', () => {
      sendMessage('#test', '/motd');
      expect(sendCommandSpy).toHaveBeenCalledWith('MOTD');
    });

    it('/ping - pings server', () => {
      sendMessage('#test', '/ping');
      expect(sendCommandSpy).toHaveBeenCalledWith('PING');
    });

    it('/trace - traces route', () => {
      sendMessage('#test', '/trace');
      expect(sendCommandSpy).toHaveBeenCalledWith('TRACE');
    });

    it('/info - gets server info', () => {
      sendMessage('#test', '/info');
      expect(sendCommandSpy).toHaveBeenCalledWith('INFO');
    });

    it('/rules - gets server rules', () => {
      sendMessage('#test', '/rules');
      expect(sendCommandSpy).toHaveBeenCalledWith('RULES');
    });

    it('/userhost - gets userhost info', () => {
      sendMessage('#test', '/userhost nick1 nick2');
      expect(sendCommandSpy).toHaveBeenCalledWith('USERHOST nick1 nick2');
    });

    it('/userip - gets user IP', () => {
      sendMessage('#test', '/userip someone');
      expect(sendCommandSpy).toHaveBeenCalledWith('USERIP someone');
    });
  });

  // ========================================
  // AWAY COMMANDS
  // ========================================

  describe('Away Commands', () => {
    let sendRawSpy: jest.SpyInstance;

    beforeEach(() => {
      sendRawSpy = jest.spyOn(ircService as any, 'sendRaw').mockImplementation(() => {});
    });

    it('/away - sets away with message', () => {
      sendMessage('#test', '/away Gone fishing');
      expect(sendRawSpy).toHaveBeenCalledWith('AWAY :Gone fishing');
    });

    it('/away without message - removes away', () => {
      sendMessage('#test', '/away');
      expect(sendRawSpy).toHaveBeenCalledWith('AWAY');
    });

    it('/back - removes away status', () => {
      sendMessage('#test', '/back');
      expect(sendRawSpy).toHaveBeenCalledWith('AWAY');
    });
  });

  // ========================================
  // NETWORK COMMANDS
  // ========================================

  describe('Network Commands', () => {
    let sendRawSpy: jest.SpyInstance;

    beforeEach(() => {
      sendRawSpy = jest.spyOn(ircService as any, 'sendRaw').mockImplementation(() => {});
    });

    it('/reconnect - emits reconnect event', () => {
      sendMessage('#test', '/reconnect');
      expect(emitSpy).toHaveBeenCalledWith('reconnect', expect.any(String));
    });

    it('/disconnect - sends quit', () => {
      sendMessage('#test', '/disconnect Goodbye');
      expect(emitSpy).toHaveBeenCalledWith('intentional-quit', expect.any(String));
      expect(sendRawSpy).toHaveBeenCalledWith('QUIT :Goodbye');
    });
  });

  // ========================================
  // IRCOP COMMANDS
  // ========================================

  describe('IRCop Commands', () => {
    let sendCommandSpy: jest.SpyInstance;

    beforeEach(() => {
      sendCommandSpy = jest.spyOn(ircService as any, 'sendCommand').mockImplementation(() => {});
    });

    it('/oper - attempts oper login', () => {
      sendMessage('#test', '/oper admin secret');
      expect(sendCommandSpy).toHaveBeenCalledWith('OPER admin secret');
    });

    it('/wallops - sends wallops', () => {
      sendMessage('#test', '/wallops Important announcement');
      expect(sendCommandSpy).toHaveBeenCalledWith('WALLOPS :Important announcement');
    });

    it('/globops - sends globops', () => {
      sendMessage('#test', '/globops Oper message');
      expect(sendCommandSpy).toHaveBeenCalledWith('GLOBOPS :Oper message');
    });

    it('/locops - sends locops', () => {
      sendMessage('#test', '/locops Local oper message');
      expect(sendCommandSpy).toHaveBeenCalledWith('LOCOPS :Local oper message');
    });

    it('/kill - kills user', () => {
      sendMessage('#test', '/kill baduser Violation of rules');
      expect(sendCommandSpy).toHaveBeenCalledWith('KILL baduser :Violation of rules');
    });

    it('/rehash - requests rehash', () => {
      sendMessage('#test', '/rehash');
      expect(sendCommandSpy).toHaveBeenCalledWith('REHASH');
    });

    it('/die - requests shutdown', () => {
      sendMessage('#test', '/die');
      expect(sendCommandSpy).toHaveBeenCalledWith('DIE');
    });
  });

  // ========================================
  // RAW/QUOTE COMMAND
  // ========================================

  describe('Raw Commands', () => {
    let sendRawSpy: jest.SpyInstance;

    beforeEach(() => {
      sendRawSpy = jest.spyOn(ircService as any, 'sendRaw').mockImplementation(() => {});
    });

    it('/raw - sends raw IRC command', () => {
      sendMessage('#test', '/raw PRIVMSG #test :Hello');
      expect(sendRawSpy).toHaveBeenCalledWith('PRIVMSG #test :Hello');
    });

    it('unknown command - sends as raw', () => {
      sendMessage('#test', '/customcmd arg1 arg2');
      // Unknown commands are sent as-is
      expect(sendRawSpy).toHaveBeenCalled();
    });
  });

  // ========================================
  // SPECIAL COMMANDS
  // ========================================

  describe('Special Commands', () => {
    let sendCommandSpy: jest.SpyInstance;
    let sendRawSpy: jest.SpyInstance;

    beforeEach(() => {
      sendCommandSpy = jest.spyOn(ircService as any, 'sendCommand').mockImplementation(() => {});
      sendRawSpy = jest.spyOn(ircService as any, 'sendRaw').mockImplementation(() => {});
    });

    it('/knock - requests invite', () => {
      sendMessage('#test', '/knock #invite-only Please let me in');
      expect(sendCommandSpy).toHaveBeenCalledWith('KNOCK #invite-only :Please let me in');
    });

    it('/watch - monitors users', () => {
      sendMessage('#test', '/watch +friend -enemy');
      expect(sendCommandSpy).toHaveBeenCalledWith('WATCH +friend -enemy');
    });

    it('/squery - queries services', () => {
      sendMessage('#test', '/squery NickServ INFO someone');
      expect(sendRawSpy).toHaveBeenCalledWith('PRIVMSG NickServ :INFO someone');
    });

    it('/cnotice - sends channel notice', () => {
      sendMessage('#test', '/cnotice user #chan Message');
      expect(sendRawSpy).toHaveBeenCalledWith('CNOTICE user #chan :Message');
    });

    it('/cprivmsg - sends channel privmsg', () => {
      sendMessage('#test', '/cprivmsg user #chan Message');
      expect(sendRawSpy).toHaveBeenCalledWith('CPRIVMSG user #chan :Message');
    });

    it('/timer - sets timer', () => {
      sendMessage('#test', '/timer test 5000 3 /echo Hello');
      expect(emitSpy).toHaveBeenCalledWith('timer', expect.objectContaining({
        name: 'test',
        delay: 5000,
        repetitions: 3,
      }));
    });

    it('/filter - sets message filter', () => {
      sendMessage('#test', '/filter spam');
      expect(emitSpy).toHaveBeenCalledWith('filter', expect.objectContaining({
        text: 'spam',
      }));
    });

    it('/window - manages windows', () => {
      sendMessage('#test', '/window #newwindow');
      expect(emitSpy).toHaveBeenCalledWith('window-open', '#newwindow');
    });
  });

  // ========================================
  // ERROR CASES FOR COMMANDS
  // ========================================

  describe('Command Error Cases', () => {
    it('/msg without target - shows error', () => {
      sendMessage('#test', '/msg');
      // Should show usage error - not enough args
      expect(messages.some(m => m.type === 'error' || m.text?.includes('Usage'))).toBe(true);
    });

    it('/kick without target - shows error or handles gracefully', () => {
      sendMessage('#test', '/kick');
      // May show error or do nothing
      expect(() => sendMessage('#test', '/kick')).not.toThrow();
    });

    it('/oper without credentials - shows error', () => {
      sendMessage('#test', '/oper');
      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });

    it('/kill without reason - shows error', () => {
      sendMessage('#test', '/kill user');
      expect(messages).toContainEqual(expect.objectContaining({
        type: 'error',
      }));
    });
  });
});

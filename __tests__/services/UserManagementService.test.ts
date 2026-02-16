/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for UserManagementService
 */

import { userManagementService } from '../../src/services/UserManagementService';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('UserManagementService', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    // @ts-ignore - clear caches
    userManagementService.whoisCache.clear();
    // @ts-ignore
    userManagementService.whowasCache.clear();
    // @ts-ignore
    userManagementService.userNotes.clear();
    // @ts-ignore
    userManagementService.userAliases.clear();
    // @ts-ignore
    userManagementService.ignoredUsers.clear();
    // @ts-ignore
    userManagementService.blacklistedUsers.clear();
    // @ts-ignore
    userManagementService.whoisListeners = [];
    // @ts-ignore
    userManagementService.whowasListeners = [];
    // @ts-ignore
    userManagementService.currentNetwork = '';
  });

  describe('initialize', () => {
    it('should initialize without errors', async () => {
      await expect(userManagementService.initialize()).resolves.not.toThrow();
    });

    it('should load data from storage', async () => {
      const note = { nick: 'testuser', note: 'Test note', network: 'testnet', updatedAt: Date.now() };
      await AsyncStorage.setItem('@AndroidIRCX:users:notes:testnet:testuser', JSON.stringify(note));
      
      const { UserManagementService } = jest.requireActual('../../src/services/UserManagementService');
      const newService = new UserManagementService();
      await newService.initialize();
      
      expect(newService.getUserNote('testuser', 'testnet')).toBe('Test note');
    });
  });

  describe('setNetwork', () => {
    it('should set current network', () => {
      userManagementService.setNetwork('TestNetwork');
      // @ts-ignore
      expect(userManagementService.currentNetwork).toBe('TestNetwork');
    });
  });

  describe('WHOIS', () => {
    it('should update and get WHOIS info', () => {
      userManagementService.setNetwork('TestNetwork');
      
      userManagementService.updateWHOIS({
        nick: 'testuser',
        username: 'test',
        hostname: 'test.com',
        realname: 'Test User',
      });
      
      const info = userManagementService.getWHOIS('testuser');
      expect(info?.nick).toBe('testuser');
      expect(info?.username).toBe('test');
      expect(info?.hostname).toBe('test.com');
    });

    it('should get WHOIS for specific network', () => {
      userManagementService.updateWHOIS({ nick: 'testuser', realname: 'User1' }, 'Network1');
      userManagementService.updateWHOIS({ nick: 'testuser', realname: 'User2' }, 'Network2');
      
      const info1 = userManagementService.getWHOIS('testuser', 'Network1');
      const info2 = userManagementService.getWHOIS('testuser', 'Network2');
      
      expect(info1?.realname).toBe('User1');
      expect(info2?.realname).toBe('User2');
    });

    it('should emit WHOIS update to listeners', () => {
      const listener = jest.fn();
      const unsubscribe = userManagementService.onWHOISUpdate(listener);
      
      userManagementService.updateWHOIS({ nick: 'testuser', realname: 'Test' });
      
      expect(listener).toHaveBeenCalled();
      expect(listener.mock.calls[0][0].nick).toBe('testuser');
      
      unsubscribe();
    });

    it('should clear WHOIS cache', () => {
      userManagementService.updateWHOIS({ nick: 'testuser', realname: 'Test' }, 'Network1');
      
      userManagementService.clearWHOISCache();
      
      expect(userManagementService.getWHOIS('testuser')).toBeUndefined();
    });

    it('should clear WHOIS cache for specific network', () => {
      userManagementService.updateWHOIS({ nick: 'testuser', realname: 'Test' }, 'Network1');
      userManagementService.updateWHOIS({ nick: 'testuser2', realname: 'Test2' }, 'Network2');
      
      userManagementService.clearWHOISCache('Network1');
      
      expect(userManagementService.getWHOIS('testuser', 'Network1')).toBeUndefined();
      expect(userManagementService.getWHOIS('testuser2', 'Network2')).toBeDefined();
    });
  });

  describe('WHOWAS', () => {
    it('should update and get WHOWAS info', () => {
      userManagementService.setNetwork('TestNetwork');
      
      userManagementService.updateWHOWAS({
        nick: 'oldnick',
        username: 'olduser',
        hostname: 'old.com',
        realname: 'Old User',
      });
      
      const info = userManagementService.getWHOWAS('oldnick');
      expect(info).toHaveLength(1);
      expect(info[0].nick).toBe('oldnick');
    });

    it('should keep history of WHOWAS entries', () => {
      userManagementService.setNetwork('TestNetwork');
      
      userManagementService.updateWHOWAS({ nick: 'testnick', realname: 'User1' });
      userManagementService.updateWHOWAS({ nick: 'testnick', realname: 'User2' });
      
      const info = userManagementService.getWHOWAS('testnick');
      expect(info).toHaveLength(2);
    });

    it('should limit WHOWAS history to 10 entries', () => {
      userManagementService.setNetwork('TestNetwork');
      
      for (let i = 0; i < 15; i++) {
        userManagementService.updateWHOWAS({ nick: 'testnick', realname: `User${i}` });
      }
      
      const info = userManagementService.getWHOWAS('testnick');
      expect(info.length).toBeLessThanOrEqual(10);
    });

    it('should emit WHOWAS update to listeners', () => {
      const listener = jest.fn();
      const unsubscribe = userManagementService.onWHOWASUpdate(listener);
      
      userManagementService.updateWHOWAS({ nick: 'testnick', realname: 'Test' });
      
      expect(listener).toHaveBeenCalled();
      
      unsubscribe();
    });
  });

  describe('User Notes', () => {
    it('should add and get user note', async () => {
      await userManagementService.addUserNote('testuser', 'This is a note', 'TestNetwork');
      
      const note = userManagementService.getUserNote('testuser', 'TestNetwork');
      expect(note).toBe('This is a note');
    });

    it('should update existing note', async () => {
      await userManagementService.addUserNote('testuser', 'Old note', 'TestNetwork');
      await userManagementService.addUserNote('testuser', 'New note', 'TestNetwork');
      
      const note = userManagementService.getUserNote('testuser', 'TestNetwork');
      expect(note).toBe('New note');
    });

    it('should remove user note', async () => {
      await userManagementService.addUserNote('testuser', 'Note to remove', 'TestNetwork');
      await userManagementService.removeUserNote('testuser', 'TestNetwork');
      
      const note = userManagementService.getUserNote('testuser', 'TestNetwork');
      expect(note).toBeUndefined();
    });

    it('should list all user notes', async () => {
      await userManagementService.addUserNote('user1', 'Note 1', 'Network1');
      await userManagementService.addUserNote('user2', 'Note 2', 'Network1');
      await userManagementService.addUserNote('user3', 'Note 3', 'Network2');
      
      const allNotes = userManagementService.getUserNotes();
      expect(allNotes).toHaveLength(3);
      
      const network1Notes = userManagementService.getUserNotes('Network1');
      expect(network1Notes).toHaveLength(2);
    });
  });

  describe('User Aliases', () => {
    it('should add and get user alias', async () => {
      await userManagementService.addUserAlias('testuser', 'Testy', 'TestNetwork');
      
      const alias = userManagementService.getUserAlias('testuser', 'TestNetwork');
      expect(alias).toBe('Testy');
    });

    it('should get nick from alias', async () => {
      await userManagementService.addUserAlias('testuser', 'Testy', 'TestNetwork');
      
      const nick = userManagementService.getNickFromAlias('Testy', 'TestNetwork');
      expect(nick).toBe('testuser');
    });

    it('should return undefined for unknown alias', () => {
      const nick = userManagementService.getNickFromAlias('Unknown', 'TestNetwork');
      expect(nick).toBeUndefined();
    });

    it('should remove user alias', async () => {
      await userManagementService.addUserAlias('testuser', 'Testy', 'TestNetwork');
      await userManagementService.removeUserAlias('testuser', 'TestNetwork');
      
      const alias = userManagementService.getUserAlias('testuser', 'TestNetwork');
      expect(alias).toBeUndefined();
    });

    it('should list all aliases', async () => {
      await userManagementService.addUserAlias('user1', 'Alias1', 'Network1');
      await userManagementService.addUserAlias('user2', 'Alias2', 'Network2');
      
      const allAliases = userManagementService.getUserAliases();
      expect(allAliases).toHaveLength(2);
      
      const network1Aliases = userManagementService.getUserAliases('Network1');
      expect(network1Aliases).toHaveLength(1);
    });
  });

  describe('Ignore List', () => {
    it('should ignore user', async () => {
      await userManagementService.ignoreUser('annoyinguser', 'Spammer', 'TestNetwork');
      
      const ignored = userManagementService.isUserIgnored('annoyinguser', undefined, undefined, 'TestNetwork');
      expect(ignored).toBe(true);
    });

    it('should unignore user', async () => {
      await userManagementService.ignoreUser('annoyinguser', 'Spammer', 'TestNetwork');
      await userManagementService.unignoreUser('annoyinguser', 'TestNetwork');
      
      const ignored = userManagementService.isUserIgnored('annoyinguser', undefined, undefined, 'TestNetwork');
      expect(ignored).toBe(false);
    });

    it('should check ignore with full mask pattern', async () => {
      await userManagementService.ignoreUser('nick!user@host.com', undefined, 'TestNetwork');
      
      expect(userManagementService.isUserIgnored('nick', 'user', 'host.com', 'TestNetwork')).toBe(true);
      expect(userManagementService.isUserIgnored('other', 'user', 'host.com', 'TestNetwork')).toBe(false);
    });

    it('should check ignore with wildcard mask', async () => {
      await userManagementService.ignoreUser('*!*@badhost.com', undefined, 'TestNetwork');
      
      expect(userManagementService.isUserIgnored('anynick', 'anyuser', 'badhost.com', 'TestNetwork')).toBe(true);
    });

    it('should get all ignored users', async () => {
      await userManagementService.ignoreUser('user1', 'Reason 1', 'Network1');
      await userManagementService.ignoreUser('user2', 'Reason 2', 'Network1');
      await userManagementService.ignoreUser('user3', 'Reason 3', 'Network2');
      
      const allIgnored = userManagementService.getIgnoredUsers();
      expect(allIgnored).toHaveLength(3);
      
      const network1Ignored = userManagementService.getIgnoredUsers('Network1');
      expect(network1Ignored).toHaveLength(2);
    });

    it('should return all ignored users when passing null', async () => {
      await userManagementService.ignoreUser('user1', 'Reason 1', 'Network1');
      await userManagementService.ignoreUser('user2', 'Reason 2', 'Network2');

      const allIgnored = userManagementService.getIgnoredUsers(null);
      expect(allIgnored).toHaveLength(2);
    });

    it('should unignore user from a different network than current', async () => {
      // Add entries on two different networks
      await userManagementService.ignoreUser('spammer', 'Spam', 'Network1');
      await userManagementService.ignoreUser('troll', 'Trolling', 'Network2');

      // Remove the Network1 entry by passing its actual network
      await userManagementService.unignoreUser('spammer', 'Network1');

      // spammer should be gone, troll should remain
      const allIgnored = userManagementService.getIgnoredUsers(null);
      expect(allIgnored).toHaveLength(1);
      expect(allIgnored[0].mask).toBe('troll');
      expect(userManagementService.isUserIgnored('spammer', undefined, undefined, 'Network1')).toBe(false);
    });
  });

  describe('Blacklist', () => {
    it('should add blacklist entry', async () => {
      await userManagementService.addBlacklistEntry('baduser!*@*', 'ban', 'Bad behavior', 'TestNetwork');
      
      const entries = userManagementService.getBlacklistEntries('TestNetwork');
      expect(entries).toHaveLength(1);
      expect(entries[0].action).toBe('ban');
    });

    it('should remove blacklist entry', async () => {
      await userManagementService.addBlacklistEntry('baduser', 'ban', undefined, 'TestNetwork');
      await userManagementService.removeBlacklistEntry('baduser', 'TestNetwork');
      
      const entries = userManagementService.getBlacklistEntries('TestNetwork');
      expect(entries).toHaveLength(0);
    });

    it('should find matching blacklist entry', async () => {
      await userManagementService.addBlacklistEntry('spam*!*@*', 'ban', undefined, 'TestNetwork');
      
      const entry = userManagementService.findMatchingBlacklistEntry('spammer123', 'user', 'host.com', 'TestNetwork');
      expect(entry).toBeDefined();
      expect(entry?.action).toBe('ban');
    });

    it('should resolve blacklist mask', async () => {
      const entry = { mask: 'baduser', action: 'ban' as const, addedAt: Date.now() };
      
      const mask = userManagementService.resolveBlacklistMask(entry, 'baduser', 'user', 'host.com');
      expect(mask).toBe('*!*@host.com');
    });

    it('should use existing mask if contains ! and @', async () => {
      const entry = { mask: 'baduser!*@*', action: 'ban' as const, addedAt: Date.now() };
      
      const mask = userManagementService.resolveBlacklistMask(entry, 'baduser', 'user', 'host.com');
      expect(mask).toBe('baduser!*@*');
    });
  });

  describe('listeners', () => {
    it('should remove WHOIS listener', () => {
      const listener = jest.fn();
      const unsubscribe = userManagementService.onWHOISUpdate(listener);
      
      unsubscribe();
      
      userManagementService.updateWHOIS({ nick: 'test', realname: 'Test' });
      expect(listener).not.toHaveBeenCalled();
    });

    it('should remove WHOWAS listener', () => {
      const listener = jest.fn();
      const unsubscribe = userManagementService.onWHOWASUpdate(listener);
      
      unsubscribe();
      
      userManagementService.updateWHOWAS({ nick: 'test', realname: 'Test' });
      expect(listener).not.toHaveBeenCalled();
    });
  });
});

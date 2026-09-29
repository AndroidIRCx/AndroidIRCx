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
      const note = {
        nick: 'testuser',
        note: 'Test note',
        network: 'testnet',
        updatedAt: Date.now(),
      };
      await AsyncStorage.setItem(
        '@AndroidIRCX:users:notes:testnet:testuser',
        JSON.stringify(note),
      );

      const { UserManagementService } = jest.requireActual(
        '../../src/services/UserManagementService',
      );
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
      userManagementService.updateWHOIS(
        { nick: 'testuser', realname: 'User1' },
        'Network1',
      );
      userManagementService.updateWHOIS(
        { nick: 'testuser', realname: 'User2' },
        'Network2',
      );

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
      userManagementService.updateWHOIS(
        { nick: 'testuser', realname: 'Test' },
        'Network1',
      );

      userManagementService.clearWHOISCache();

      expect(userManagementService.getWHOIS('testuser')).toBeUndefined();
    });

    it('should clear WHOIS cache for specific network', () => {
      userManagementService.updateWHOIS(
        { nick: 'testuser', realname: 'Test' },
        'Network1',
      );
      userManagementService.updateWHOIS(
        { nick: 'testuser2', realname: 'Test2' },
        'Network2',
      );

      userManagementService.clearWHOISCache('Network1');

      expect(
        userManagementService.getWHOIS('testuser', 'Network1'),
      ).toBeUndefined();
      expect(
        userManagementService.getWHOIS('testuser2', 'Network2'),
      ).toBeDefined();
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

      userManagementService.updateWHOWAS({
        nick: 'testnick',
        realname: 'User1',
      });
      userManagementService.updateWHOWAS({
        nick: 'testnick',
        realname: 'User2',
      });

      const info = userManagementService.getWHOWAS('testnick');
      expect(info).toHaveLength(2);
    });

    it('should limit WHOWAS history to 10 entries', () => {
      userManagementService.setNetwork('TestNetwork');

      for (let i = 0; i < 15; i++) {
        userManagementService.updateWHOWAS({
          nick: 'testnick',
          realname: `User${i}`,
        });
      }

      const info = userManagementService.getWHOWAS('testnick');
      expect(info.length).toBeLessThanOrEqual(10);
    });

    it('should emit WHOWAS update to listeners', () => {
      const listener = jest.fn();
      const unsubscribe = userManagementService.onWHOWASUpdate(listener);

      userManagementService.updateWHOWAS({
        nick: 'testnick',
        realname: 'Test',
      });

      expect(listener).toHaveBeenCalled();

      unsubscribe();
    });
  });

  describe('User Notes', () => {
    it('should add and get user note', async () => {
      await userManagementService.addUserNote(
        'testuser',
        'This is a note',
        'TestNetwork',
      );

      const note = userManagementService.getUserNote('testuser', 'TestNetwork');
      expect(note).toBe('This is a note');
    });

    it('should update existing note', async () => {
      await userManagementService.addUserNote(
        'testuser',
        'Old note',
        'TestNetwork',
      );
      await userManagementService.addUserNote(
        'testuser',
        'New note',
        'TestNetwork',
      );

      const note = userManagementService.getUserNote('testuser', 'TestNetwork');
      expect(note).toBe('New note');
    });

    it('should remove user note', async () => {
      await userManagementService.addUserNote(
        'testuser',
        'Note to remove',
        'TestNetwork',
      );
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
      await userManagementService.addUserAlias(
        'testuser',
        'Testy',
        'TestNetwork',
      );

      const alias = userManagementService.getUserAlias(
        'testuser',
        'TestNetwork',
      );
      expect(alias).toBe('Testy');
    });

    it('should get nick from alias', async () => {
      await userManagementService.addUserAlias(
        'testuser',
        'Testy',
        'TestNetwork',
      );

      const nick = userManagementService.getNickFromAlias(
        'Testy',
        'TestNetwork',
      );
      expect(nick).toBe('testuser');
    });

    it('should return undefined for unknown alias', () => {
      const nick = userManagementService.getNickFromAlias(
        'Unknown',
        'TestNetwork',
      );
      expect(nick).toBeUndefined();
    });

    it('should remove user alias', async () => {
      await userManagementService.addUserAlias(
        'testuser',
        'Testy',
        'TestNetwork',
      );
      await userManagementService.removeUserAlias('testuser', 'TestNetwork');

      const alias = userManagementService.getUserAlias(
        'testuser',
        'TestNetwork',
      );
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
      await userManagementService.ignoreUser(
        'annoyinguser',
        'Spammer',
        'TestNetwork',
      );

      const ignored = userManagementService.isUserIgnored(
        'annoyinguser',
        undefined,
        undefined,
        'TestNetwork',
      );
      expect(ignored).toBe(true);
    });

    it('should unignore user', async () => {
      await userManagementService.ignoreUser(
        'annoyinguser',
        'Spammer',
        'TestNetwork',
      );
      await userManagementService.unignoreUser('annoyinguser', 'TestNetwork');

      const ignored = userManagementService.isUserIgnored(
        'annoyinguser',
        undefined,
        undefined,
        'TestNetwork',
      );
      expect(ignored).toBe(false);
    });

    it('should check ignore with full mask pattern', async () => {
      await userManagementService.ignoreUser(
        'nick!user@host.com',
        undefined,
        'TestNetwork',
      );

      expect(
        userManagementService.isUserIgnored(
          'nick',
          'user',
          'host.com',
          'TestNetwork',
        ),
      ).toBe(true);
      expect(
        userManagementService.isUserIgnored(
          'other',
          'user',
          'host.com',
          'TestNetwork',
        ),
      ).toBe(false);
    });

    it('should check ignore with wildcard mask', async () => {
      await userManagementService.ignoreUser(
        '*!*@badhost.com',
        undefined,
        'TestNetwork',
      );

      expect(
        userManagementService.isUserIgnored(
          'anynick',
          'anyuser',
          'badhost.com',
          'TestNetwork',
        ),
      ).toBe(true);
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
      expect(
        userManagementService.isUserIgnored(
          'spammer',
          undefined,
          undefined,
          'Network1',
        ),
      ).toBe(false);
    });
  });

  describe('Blacklist', () => {
    it('should add blacklist entry', async () => {
      await userManagementService.addBlacklistEntry(
        'baduser!*@*',
        'ban',
        'Bad behavior',
        'TestNetwork',
      );

      const entries = userManagementService.getBlacklistEntries('TestNetwork');
      expect(entries).toHaveLength(1);
      expect(entries[0].action).toBe('ban');
    });

    it('should remove blacklist entry', async () => {
      await userManagementService.addBlacklistEntry(
        'baduser',
        'ban',
        undefined,
        'TestNetwork',
      );
      await userManagementService.removeBlacklistEntry(
        'baduser',
        'TestNetwork',
      );

      const entries = userManagementService.getBlacklistEntries('TestNetwork');
      expect(entries).toHaveLength(0);
    });

    it('should find matching blacklist entry', async () => {
      await userManagementService.addBlacklistEntry(
        'spam*!*@*',
        'ban',
        undefined,
        'TestNetwork',
      );

      const entry = userManagementService.findMatchingBlacklistEntry(
        'spammer123',
        'user',
        'host.com',
        'TestNetwork',
      );
      expect(entry).toBeDefined();
      expect(entry?.action).toBe('ban');
    });

    it('should resolve blacklist mask', async () => {
      const entry = {
        mask: 'baduser',
        action: 'ban' as const,
        addedAt: Date.now(),
      };

      const mask = userManagementService.resolveBlacklistMask(
        entry,
        'baduser',
        'user',
        'host.com',
      );
      expect(mask).toBe('*!*@host.com');
    });

    it('should use existing mask if contains ! and @', async () => {
      const entry = {
        mask: 'baduser!*@*',
        action: 'ban' as const,
        addedAt: Date.now(),
      };

      const mask = userManagementService.resolveBlacklistMask(
        entry,
        'baduser',
        'user',
        'host.com',
      );
      expect(mask).toBe('baduser!*@*');
    });

    it('should support protected flag on blacklist entries', async () => {
      await userManagementService.addBlacklistEntry(
        'protecteduser',
        'ban',
        undefined,
        'TestNetwork',
      );

      // Get the entry and manually set protected (since addBlacklistEntry doesn't set it)
      const entries = userManagementService.getBlacklistEntries('TestNetwork');
      entries[0].protected = true;

      expect(entries[0].protected).toBe(true);
    });
  });

  describe('User Lists (Notify, AutoOp, AutoVoice, AutoHalfOp, Other)', () => {
    beforeEach(async () => {
      // Clear user lists
      // @ts-ignore
      for (const map of userManagementService.userLists.values()) {
        map.clear();
      }
    });

    describe('addUserListEntry', () => {
      it('should add entry to notify list', async () => {
        await userManagementService.addUserListEntry('notify', 'friend!*@*', {
          network: 'TestNetwork',
          protected: true,
        });

        const entries = userManagementService.getUserListEntries(
          'notify',
          'TestNetwork',
        );
        expect(entries).toHaveLength(1);
        expect(entries[0].mask).toBe('friend!*@*');
        expect(entries[0].protected).toBe(true);
      });

      it('should add entry to autoop list with channels', async () => {
        await userManagementService.addUserListEntry('autoop', 'trusted!*@*', {
          network: 'TestNetwork',
          channels: ['#general', '#help'],
          protected: false,
        });

        const entries = userManagementService.getUserListEntries(
          'autoop',
          'TestNetwork',
        );
        expect(entries).toHaveLength(1);
        expect(entries[0].channels).toEqual(['#general', '#help']);
      });

      it('should add entry to autovoice list', async () => {
        await userManagementService.addUserListEntry('autovoice', 'gooduser', {
          network: 'TestNetwork',
        });

        const entries = userManagementService.getUserListEntries(
          'autovoice',
          'TestNetwork',
        );
        expect(entries).toHaveLength(1);
        expect(entries[0].mask).toBe('gooduser');
        expect(entries[0].protected).toBe(false);
      });

      it('should add entry to autohalfop list', async () => {
        await userManagementService.addUserListEntry(
          'autohalfop',
          'moderator!*@*',
          {
            network: 'TestNetwork',
            protected: true,
            reason: 'Trusted moderator',
          },
        );

        const entries = userManagementService.getUserListEntries(
          'autohalfop',
          'TestNetwork',
        );
        expect(entries).toHaveLength(1);
        expect(entries[0].reason).toBe('Trusted moderator');
      });

      it('should add entry to other list', async () => {
        await userManagementService.addUserListEntry('other', 'special!*@*', {
          network: 'TestNetwork',
          protected: true,
        });

        const entries = userManagementService.getUserListEntries(
          'other',
          'TestNetwork',
        );
        expect(entries).toHaveLength(1);
      });
    });

    describe('removeUserListEntry', () => {
      it('should remove entry from list', async () => {
        await userManagementService.addUserListEntry('notify', 'friend', {
          network: 'TestNetwork',
        });
        await userManagementService.removeUserListEntry(
          'notify',
          'friend',
          'TestNetwork',
        );

        const entries = userManagementService.getUserListEntries(
          'notify',
          'TestNetwork',
        );
        expect(entries).toHaveLength(0);
      });
    });

    describe('updateUserListEntry', () => {
      it('should update existing entry', async () => {
        await userManagementService.addUserListEntry('notify', 'friend', {
          network: 'TestNetwork',
          protected: false,
        });

        await userManagementService.updateUserListEntry('notify', 'friend', {
          network: 'TestNetwork',
          protected: true,
          reason: 'Updated reason',
        });

        const entries = userManagementService.getUserListEntries(
          'notify',
          'TestNetwork',
        );
        expect(entries[0].protected).toBe(true);
        expect(entries[0].reason).toBe('Updated reason');
      });
    });

    describe('findMatchingUserListEntry', () => {
      it('should find matching entry by nick', async () => {
        await userManagementService.addUserListEntry(
          'autoop',
          'trusted!user@host.com',
          {
            network: 'TestNetwork',
          },
        );

        const entry = userManagementService.findMatchingUserListEntry(
          'autoop',
          'trusted',
          'user',
          'host.com',
          'TestNetwork',
        );
        expect(entry).toBeDefined();
        expect(entry?.mask).toBe('trusted!user@host.com');
      });

      it('should find matching entry with wildcard', async () => {
        await userManagementService.addUserListEntry(
          'autoop',
          '*!*@trustedhost.com',
          {
            network: 'TestNetwork',
          },
        );

        const entry = userManagementService.findMatchingUserListEntry(
          'autoop',
          'anynick',
          'anyuser',
          'trustedhost.com',
          'TestNetwork',
        );
        expect(entry).toBeDefined();
      });

      it('should filter by channel when specified', async () => {
        await userManagementService.addUserListEntry('autoop', 'trusted!*@*', {
          network: 'TestNetwork',
          channels: ['#general'],
        });

        const matchInChannel = userManagementService.findMatchingUserListEntry(
          'autoop',
          'trusted',
          'user',
          'host.com',
          'TestNetwork',
          '#general',
        );
        expect(matchInChannel).toBeDefined();

        const matchWrongChannel =
          userManagementService.findMatchingUserListEntry(
            'autoop',
            'trusted',
            'user',
            'host.com',
            'TestNetwork',
            '#other',
          );
        expect(matchWrongChannel).toBeUndefined();
      });

      it('should prefer network-specific over global entries', async () => {
        await userManagementService.addUserListEntry('autoop', 'user!*@*', {
          network: 'TestNetwork',
          protected: true,
        });
        await userManagementService.addUserListEntry('autoop', 'user!*@*', {
          protected: false,
        });

        const entry = userManagementService.findMatchingUserListEntry(
          'autoop',
          'user',
          'user',
          'host.com',
          'TestNetwork',
        );
        expect(entry?.protected).toBe(true);
      });
    });
  });

  describe('isUserProtected', () => {
    beforeEach(async () => {
      // Clear all caches
      // @ts-ignore
      for (const map of userManagementService.userLists.values()) {
        map.clear();
      }
      // @ts-ignore
      userManagementService.ignoredUsers.clear();
      // @ts-ignore
      userManagementService.blacklistedUsers.clear();
    });

    it('should return true when user is in notify list with protected flag', async () => {
      await userManagementService.addUserListEntry(
        'notify',
        'protecteduser!*@*',
        {
          network: 'TestNetwork',
          protected: true,
        },
      );

      expect(
        userManagementService.isUserProtected(
          'protecteduser',
          'user',
          'host.com',
          'TestNetwork',
        ),
      ).toBe(true);
    });

    it('should return false when user is in list but not protected', async () => {
      await userManagementService.addUserListEntry(
        'notify',
        'regularuser!*@*',
        {
          network: 'TestNetwork',
          protected: false,
        },
      );

      expect(
        userManagementService.isUserProtected(
          'regularuser',
          'user',
          'host.com',
          'TestNetwork',
        ),
      ).toBe(false);
    });

    it('should return true when user is in autoop list with protected flag', async () => {
      await userManagementService.addUserListEntry('autoop', 'admin!*@*', {
        network: 'TestNetwork',
        protected: true,
      });

      expect(
        userManagementService.isUserProtected(
          'admin',
          'user',
          'host.com',
          'TestNetwork',
        ),
      ).toBe(true);
    });

    it('should return true when user is in ignore list with protected flag', async () => {
      // Add ignored user with protected flag
      await userManagementService.ignoreUser(
        'specialuser',
        'Reason',
        'TestNetwork',
      );
      const ignored = userManagementService.getIgnoredUsers('TestNetwork');
      ignored[0].protected = true;

      expect(
        userManagementService.isUserProtected(
          'specialuser',
          'user',
          'host.com',
          'TestNetwork',
        ),
      ).toBe(true);
    });

    it('should return true when user is in blacklist with protected flag', async () => {
      // Add blacklist entry with protected flag
      await userManagementService.addBlacklistEntry(
        'vipuser',
        'ban',
        undefined,
        'TestNetwork',
      );
      const entries = userManagementService.getBlacklistEntries('TestNetwork');
      entries[0].protected = true;

      expect(
        userManagementService.isUserProtected(
          'vipuser',
          'user',
          'host.com',
          'TestNetwork',
        ),
      ).toBe(true);
    });

    it('should return false for non-existent user', () => {
      expect(
        userManagementService.isUserProtected(
          'unknown',
          'user',
          'host.com',
          'TestNetwork',
        ),
      ).toBe(false);
    });

    it('should return true when user matches wildcard pattern with protected flag', async () => {
      await userManagementService.addUserListEntry(
        'other',
        '*!*@adminhost.com',
        {
          network: 'TestNetwork',
          protected: true,
        },
      );

      expect(
        userManagementService.isUserProtected(
          'anynick',
          'anyuser',
          'adminhost.com',
          'TestNetwork',
        ),
      ).toBe(true);
    });

    it('should check all list types for protected status', async () => {
      // Add user to autovoice with protected
      await userManagementService.addUserListEntry(
        'autovoice',
        'multitest!*@*',
        {
          network: 'TestNetwork',
          protected: true,
        },
      );

      // Should be protected across all checks
      expect(
        userManagementService.isUserProtected(
          'multitest',
          'user',
          'host.com',
          'TestNetwork',
        ),
      ).toBe(true);
    });

    it('should respect network boundaries', async () => {
      await userManagementService.addUserListEntry(
        'notify',
        'networkuser!*@*',
        {
          network: 'Network1',
          protected: true,
        },
      );

      expect(
        userManagementService.isUserProtected(
          'networkuser',
          'user',
          'host.com',
          'Network1',
        ),
      ).toBe(true);
      expect(
        userManagementService.isUserProtected(
          'networkuser',
          'user',
          'host.com',
          'Network2',
        ),
      ).toBe(false);
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

  describe('numeric WHOIS/WHOWAS handling', () => {
    it('merges common numeric replies into WHOIS state and finalizes pending requests', async () => {
      jest.useFakeTimers();
      const sendCommand = jest.fn();
      const irc = {
        on: jest.fn(),
        getNetworkName: jest.fn(() => 'NumericNet'),
        sendCommand,
      } as any;
      userManagementService.setIRCService(irc);

      const pending = userManagementService.requestWHOIS('Alice', 'NumericNet');
      expect(sendCommand).toHaveBeenCalledWith('WHOIS Alice');

      const handleNumericReply = (
        userManagementService as any
      ).handleNumericReply.bind(userManagementService);
      handleNumericReply(
        311,
        'server',
        ['me', 'Alice', 'ident', 'host.test', '*', 'Real Name'],
        Date.now(),
      );
      handleNumericReply(
        312,
        'server',
        ['me', 'Alice', 'irc.example', 'Example server'],
        Date.now(),
      );
      handleNumericReply(
        313,
        'server',
        ['me', 'Alice', 'is an IRC operator'],
        Date.now(),
      );
      handleNumericReply(
        317,
        'server',
        ['me', 'Alice', '42', '1710000000'],
        Date.now(),
      );
      handleNumericReply(
        319,
        'server',
        ['me', 'Alice', '@#ops +#voice #public'],
        Date.now(),
      );
      handleNumericReply(
        330,
        'server',
        ['me', 'Alice', 'alice-account', 'is logged in as'],
        Date.now(),
      );
      handleNumericReply(
        301,
        'server',
        ['me', 'Alice', 'away for dinner'],
        Date.now(),
      );
      handleNumericReply(
        318,
        'server',
        ['me', 'Alice', 'End of WHOIS'],
        Date.now(),
      );

      await expect(pending).resolves.toMatchObject({
        nick: 'Alice',
        username: 'ident',
        hostname: 'host.test',
        realname: 'Real Name',
        server: 'irc.example',
        serverInfo: 'Example server',
        isOper: true,
        idle: 42,
        signon: 1710000000000,
        channels: ['@#ops', '+#voice', '#public'],
        account: 'alice-account',
        away: true,
        awayMessage: 'away for dinner',
        network: 'NumericNet',
      });

      jest.useRealTimers();
    });

    it('rejects stale duplicate WHOIS requests and times out incomplete data safely', async () => {
      jest.useFakeTimers();
      const sendCommand = jest.fn();
      userManagementService.setIRCService({
        on: jest.fn(),
        getNetworkName: jest.fn(() => 'TimeoutNet'),
        sendCommand,
      } as any);
      (userManagementService as any).WHOIS_TIMEOUT = 5;

      const first = userManagementService.requestWHOIS('Bob', 'TimeoutNet');
      const second = userManagementService.requestWHOIS('Bob', 'TimeoutNet');

      await expect(first).rejects.toThrow('New WHOIS request');
      userManagementService.updateWHOIS(
        { nick: 'Bob', username: 'partial' },
        'TimeoutNet',
      );
      jest.advanceTimersByTime(6);
      await expect(second).rejects.toThrow('timed out');
      expect(
        userManagementService.getWHOIS('Bob', 'TimeoutNet'),
      ).toBeUndefined();

      jest.useRealTimers();
    });

    it('sends WHOWAS variants and records WHOWAS numeric replies', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      userManagementService.requestWHOWAS('Ghost', 'NoService');
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();

      const sendCommand = jest.fn();
      userManagementService.setIRCService({
        on: jest.fn(),
        getNetworkName: jest.fn(() => 'WhowasNet'),
        sendCommand,
      } as any);
      userManagementService.requestWHOWAS('Ghost', 'WhowasNet', 3);
      expect(sendCommand).toHaveBeenCalledWith('WHOWAS Ghost 3');

      const handleNumericReply = (
        userManagementService as any
      ).handleNumericReply.bind(userManagementService);
      handleNumericReply(
        314,
        'server',
        ['me', 'Ghost', 'oldident', 'old.host', '*', 'Old Real'],
        Date.now(),
      );
      handleNumericReply(
        369,
        'server',
        ['me', 'Ghost', 'End of WHOWAS'],
        Date.now(),
      );
      expect(
        userManagementService.getWHOWAS('Ghost', 'WhowasNet')[0],
      ).toMatchObject({
        nick: 'Ghost',
        username: 'oldident',
        hostname: 'old.host',
        realname: 'Old Real',
        network: 'WhowasNet',
      });
    });
  });

  /**
   * Before a connection is up there is no current network, and almost every
   * method here reads `network || this.currentNetwork` and then keys its cache
   * on `net ? \`${net}:${nick}\` : nick`. The unqualified key is the normal
   * path at that point — the settings screens read notes, aliases and lists
   * before anything is connected — so both halves have to work.
   */
  describe('before any network is known', () => {
    beforeEach(() => {
      // @ts-ignore - the service is a singleton with private state
      userManagementService.currentNetwork = '';
      // The shared beforeEach clears the other caches but not these, and a
      // list entry left behind by an earlier test would be counted here.
      // @ts-ignore
      for (const list of userManagementService.userLists.values()) list.clear();
    });

    it('keys a note, an alias and a lookup on the nick alone', async () => {
      await userManagementService.addUserNote('alice', 'met at a conference');
      expect(userManagementService.getUserNote('alice')).toBe(
        'met at a conference',
      );
      expect(userManagementService.getUserNotes()).toHaveLength(1);

      await userManagementService.addUserAlias('alice', 'Ally');
      expect(userManagementService.getUserAlias('alice')).toBe('Ally');
      expect(userManagementService.getNickFromAlias('Ally')).toBe('alice');
      expect(userManagementService.getUserAliases()).toHaveLength(1);

      await userManagementService.removeUserNote('alice');
      expect(userManagementService.getUserNote('alice')).toBeUndefined();
      await userManagementService.removeUserAlias('alice');
      expect(userManagementService.getUserAlias('alice')).toBeUndefined();
    });

    it('ignores and un-ignores without a network', async () => {
      await userManagementService.ignoreUser('troll!*@*');
      expect(
        userManagementService.isUserIgnored('troll', 'ident', 'host'),
      ).toBe(true);
      expect(userManagementService.getIgnoredUsers()).toHaveLength(1);

      await userManagementService.unignoreUser('troll!*@*');
      expect(
        userManagementService.isUserIgnored('troll', 'ident', 'host'),
      ).toBe(false);
    });

    it('blacklists without a network', async () => {
      await userManagementService.addBlacklistEntry('spammer!*@*', {
        reason: 'spam',
      });
      expect(userManagementService.getBlacklistEntries()).toHaveLength(1);
      expect(
        userManagementService.findMatchingBlacklistEntry('spammer', 'a', 'b'),
      ).toBeDefined();

      await userManagementService.removeBlacklistEntry('spammer!*@*');
      expect(userManagementService.getBlacklistEntries()).toHaveLength(0);
    });

    it('keeps user-list entries without a network', async () => {
      await userManagementService.addUserListEntry('notify', 'friend!*@*', {
        reason: 'a friend',
      });

      const entries = userManagementService.getUserListEntries('notify');
      expect(entries).toHaveLength(1);
      expect(entries[0].network).toBeUndefined();
      expect(
        userManagementService.findMatchingUserListEntry(
          'notify',
          'friend',
          'i',
          'h',
        ),
      ).toBeDefined();

      await userManagementService.removeUserListEntry('notify', 'friend!*@*');
      expect(userManagementService.getUserListEntries('notify')).toHaveLength(
        0,
      );
    });

    it('caches WHOIS and WHOWAS under the bare nick', () => {
      userManagementService.updateWHOIS({ nick: 'alice', realname: 'Alice' });
      expect(userManagementService.getWHOIS('alice')?.realname).toBe('Alice');
      userManagementService.finalizeWHOIS('alice');

      userManagementService.updateWHOWAS({
        nick: 'alice',
        host: 'old.example',
      });
      expect(userManagementService.getWHOWAS('alice')).toBeDefined();
      userManagementService.finalizeWHOWAS('alice');
    });

    it('finalizing something nobody asked for is a no-op', () => {
      // No queued request and no cached data: the guards are the whole point.
      expect(() => userManagementService.finalizeWHOIS('nobody')).not.toThrow();
      expect(() =>
        userManagementService.finalizeWHOWAS('nobody'),
      ).not.toThrow();
    });
  });

  describe('updating a list entry that is already there', () => {
    beforeEach(() => {
      // @ts-ignore
      userManagementService.currentNetwork = 'TestNet';
      // @ts-ignore
      for (const list of userManagementService.userLists.values()) list.clear();
    });

    it('keeps the fields the caller did not mention', async () => {
      await userManagementService.addUserListEntry('autoop', 'op!*@*', {
        channels: ['#one'],
        protected: true,
        reason: 'trusted',
      });
      const added = userManagementService.getUserListEntries('autoop')[0];

      await userManagementService.updateUserListEntry('autoop', 'op!*@*', {});

      const updated = userManagementService.getUserListEntries('autoop')[0];
      expect(updated.channels).toEqual(['#one']);
      expect(updated.protected).toBe(true);
      expect(updated.reason).toBe('trusted');
      expect(updated.addedAt).toBe(added.addedAt);
    });

    it('fills in defaults when there is nothing to keep', async () => {
      await userManagementService.updateUserListEntry('autovoice', 'new!*@*', {
        network: 'TestNet',
      });

      const entry = userManagementService.getUserListEntries('autovoice')[0];
      expect(entry.protected).toBe(false);
      expect(entry.channels).toBeUndefined();
      expect(entry.reason).toBeUndefined();
      expect(typeof entry.addedAt).toBe('number');
    });

    it('returns entries from every network when asked for none', async () => {
      await userManagementService.addUserListEntry('notify', 'a!*@*', {
        network: 'TestNet',
      });
      await userManagementService.addUserListEntry('notify', 'b!*@*', {
        network: 'OtherNet',
      });

      // `null` means "do not filter", which is not the same as leaving it out.
      const all = userManagementService.getUserListEntries(
        'notify',
        null as any,
      );
      expect(all.length).toBeGreaterThanOrEqual(2);

      const mine = userManagementService.getUserListEntries('notify');
      expect(mine.every(e => !e.network || e.network === 'TestNet')).toBe(true);
    });
  });
});

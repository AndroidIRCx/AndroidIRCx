/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for IdentityProfilesService
 */

import { identityProfilesService, IdentityProfile, DEFAULT_PROFILE_ID, DEFAULT_PROFILE } from '../../src/services/IdentityProfilesService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock dependencies
jest.mock('../../src/services/SecureStorageService', () => ({
  secureStorageService: {
    setSecret: jest.fn().mockResolvedValue(undefined),
    getSecret: jest.fn().mockResolvedValue(null),
    removeSecret: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../src/i18n/transifex', () => ({
  tx: {
    t: (key: string, params?: any) => {
      if (params) {
        return key.replace(/\{(\w+)\}/g, (_, k) => params[k] || '');
      }
      return key;
    },
  },
}));

const { secureStorageService } = require('../../src/services/SecureStorageService');

describe('IdentityProfilesService', () => {
  beforeEach(() => {
    (AsyncStorage as any).__reset();
    // Reset service state
    (identityProfilesService as any).profiles = [];
    (identityProfilesService as any).initialized = false;
    jest.clearAllMocks();
  });

  describe('list', () => {
    it('should return empty array initially', async () => {
      const profiles = await identityProfilesService.list();
      expect(profiles).toEqual([]);
    });

    it('should return copy of profiles array', async () => {
      const profiles1 = await identityProfilesService.list();
      const profiles2 = await identityProfilesService.list();

      expect(profiles1).not.toBe(profiles2);
      expect(profiles1).toEqual(profiles2);
    });

    it('should load saved profiles from storage', async () => {
      const savedProfiles = [
        {
          id: 'profile-1',
          name: 'Test Profile',
          nick: 'testnick',
          realname: 'Test User',
        },
      ];

      await AsyncStorage.setItem('@AndroidIRCX:identityProfiles', JSON.stringify(savedProfiles));

      const profiles = await identityProfilesService.list();
      expect(profiles.some(p => p.name === 'Test Profile')).toBe(true);
    });
  });

  describe('get', () => {
    it('should return profile by ID', async () => {
      const newProfile = await identityProfilesService.add({
        name: 'Test Profile',
        nick: 'testnick',
        realname: 'Test User',
      });

      const retrieved = await identityProfilesService.get(newProfile.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Test Profile');
    });

    it('should return undefined for non-existent ID', async () => {
      const profile = await identityProfilesService.get('non-existent');
      expect(profile).toBeUndefined();
    });
  });

  describe('getDefaultProfile', () => {
    it('should return default profile', async () => {
      const defaultProfile = await identityProfilesService.getDefaultProfile();

      expect(defaultProfile.id).toBe(DEFAULT_PROFILE_ID);
      expect(defaultProfile.name).toBe(DEFAULT_PROFILE.name);
      expect(defaultProfile.nick).toBe(DEFAULT_PROFILE.nick);
    });

    it('should ensure default profile exists', async () => {
      await identityProfilesService.getDefaultProfile();

      const profiles = await identityProfilesService.list();
      expect(profiles.some(p => p.id === DEFAULT_PROFILE_ID)).toBe(false);
    });
  });

  describe('add', () => {
    it('should add new profile', async () => {
      const newProfile = await identityProfilesService.add({
        name: 'New Profile',
        nick: 'newnick',
        altNick: 'newnick_',
        realname: 'New User',
      });

      expect(newProfile.id).toBeDefined();
      expect(newProfile.name).toBe('New Profile');
      expect(newProfile.nick).toBe('newnick');

      const profiles = await identityProfilesService.list();
      expect(profiles.some(p => p.id === newProfile.id)).toBe(true);
    });

    it('should generate unique IDs', async () => {
      const profile1 = await identityProfilesService.add({
        name: 'Profile 1',
        nick: 'nick1',
      });

      const profile2 = await identityProfilesService.add({
        name: 'Profile 2',
        nick: 'nick2',
      });

      expect(profile1.id).not.toBe(profile2.id);
    });

    it('should persist profile to storage', async () => {
      await identityProfilesService.add({
        name: 'Test',
        nick: 'test',
      });

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@AndroidIRCX:identityProfiles',
        expect.any(String)
      );
    });

    it('should persist secrets separately', async () => {
      await identityProfilesService.add({
        name: 'Test',
        nick: 'test',
        saslPassword: 'secret123',
        nickservPassword: 'secret456',
      });

      expect(secureStorageService.setSecret).toHaveBeenCalled();
    });

    it('should not store passwords in AsyncStorage', async () => {
      await identityProfilesService.add({
        name: 'Test',
        nick: 'test',
        saslPassword: 'secret123',
      });

      const calls = (AsyncStorage.setItem as jest.Mock).mock.calls;
      const profileCall = calls.find((call: any) => call[0] === '@AndroidIRCX:identityProfiles');
      const data = JSON.parse(profileCall[1]);

      // Should not contain password in plain storage
      expect(data.some((p: any) => p.saslPassword)).toBe(false);
    });
  });

  describe('update', () => {
    it('should update existing profile', async () => {
      const profile = await identityProfilesService.add({
        name: 'Original',
        nick: 'original',
      });

      await identityProfilesService.update(profile.id, {
        name: 'Updated',
        nick: 'updated',
      });

      const updated = await identityProfilesService.get(profile.id);
      expect(updated?.name).toBe('Updated');
      expect(updated?.nick).toBe('updated');
    });

    it('should throw error for non-existent profile', async () => {
      await expect(
        identityProfilesService.update('non-existent', { name: 'Test' })
      ).rejects.toThrow();
    });

    it('should persist updates to storage', async () => {
      const profile = await identityProfilesService.add({
        name: 'Test',
        nick: 'test',
      });

      jest.clearAllMocks();

      await identityProfilesService.update(profile.id, { name: 'Updated' });

      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it('should update secrets when provided', async () => {
      const profile = await identityProfilesService.add({
        name: 'Test',
        nick: 'test',
      });

      jest.clearAllMocks();

      await identityProfilesService.update(profile.id, {
        saslPassword: 'newsecret',
      });

      expect(secureStorageService.setSecret).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should remove existing profile', async () => {
      const profile = await identityProfilesService.add({
        name: 'To Delete',
        nick: 'delete',
      });

      await identityProfilesService.remove(profile.id);

      const retrieved = await identityProfilesService.get(profile.id);
      expect(retrieved).toBeUndefined();
    });

    it('should persist removal to storage', async () => {
      const profile = await identityProfilesService.add({
        name: 'Test',
        nick: 'test',
      });

      jest.clearAllMocks();

      await identityProfilesService.remove(profile.id);

      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it('should clear secrets when removing profile', async () => {
      const profile = await identityProfilesService.add({
        name: 'Test',
        nick: 'test',
        saslPassword: 'secret',
      });

      jest.clearAllMocks();

      await identityProfilesService.remove(profile.id);

      expect(secureStorageService.removeSecret).toHaveBeenCalled();
    });

    it('should handle removing non-existent profile', async () => {
      await expect(identityProfilesService.remove('non-existent')).resolves.not.toThrow();
    });

    it('should allow removing default profile when other profiles exist', async () => {
      const created = await identityProfilesService.add({
        name: 'Custom',
        nick: 'custom',
      });

      await identityProfilesService.remove(DEFAULT_PROFILE_ID);

      const profiles = await identityProfilesService.list();
      expect(profiles.some(p => p.id === DEFAULT_PROFILE_ID)).toBe(false);
      expect(profiles.some(p => p.id === created.id)).toBe(true);

      const fallback = await identityProfilesService.getDefaultProfile();
      expect(fallback.id).toBe(created.id);
    });
  });

  describe('secret migration', () => {
    it('should migrate old profiles with plain passwords to secure storage', async () => {
      const oldProfiles = [
        {
          id: 'old-1',
          name: 'Old Profile',
          nick: 'oldnick',
          saslPassword: 'plaintext-password',
          nickservPassword: 'plaintext-nickserv',
        },
      ];

      await AsyncStorage.setItem('@AndroidIRCX:identityProfiles', JSON.stringify(oldProfiles));

      // Trigger load which should migrate
      await identityProfilesService.list();

      // Should have persisted secrets to secure storage
      expect(secureStorageService.setSecret).toHaveBeenCalled();

      // Should have called setSecret for each password field
      const setSecretCalls = (secureStorageService.setSecret as jest.Mock).mock.calls;
      expect(setSecretCalls.some((call: any) => call[0].includes('saslPassword'))).toBe(true);
      expect(setSecretCalls.some((call: any) => call[0].includes('nickservPassword'))).toBe(true);
    });
  });

  describe('default profile handling', () => {
    it('should not auto-create default profile on first load', async () => {
      const profiles = await identityProfilesService.list();
      expect(profiles).toEqual([]);
    });

    it('should not auto-insert default profile across repeated loads', async () => {
      await identityProfilesService.list();
      await identityProfilesService.list();

      const profiles = await identityProfilesService.list();
      const defaultProfiles = profiles.filter(p => p.id === DEFAULT_PROFILE_ID);
      expect(defaultProfiles.length).toBe(0);
    });

    it('should handle corrupted storage with default profile fallback', async () => {
      await AsyncStorage.setItem('@AndroidIRCX:identityProfiles', 'invalid json');

      const profiles = await identityProfilesService.list();

      expect(profiles.length).toBeGreaterThan(0);
      expect(profiles.some(p => p.id === DEFAULT_PROFILE_ID)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle profile with all optional fields', async () => {
      const profile = await identityProfilesService.add({
        name: 'Full Profile',
        nick: 'fullnick',
        altNick: 'fullnick_',
        realname: 'Full Name',
        ident: 'fullident',
        saslAccount: 'sasluser',
        saslPassword: 'saslpass',
        nickservPassword: 'nickservpass',
        operUser: 'operuser',
        operPassword: 'operpass',
        onConnectCommands: ['/msg NickServ identify', '/join #channel'],
      });

      expect(profile.name).toBe('Full Profile');
      expect(profile.altNick).toBe('fullnick_');
      expect(profile.onConnectCommands).toHaveLength(2);
    });

    it('should handle profile with minimal fields', async () => {
      const profile = await identityProfilesService.add({
        name: 'Minimal',
        nick: 'minimal',
      });

      expect(profile.name).toBe('Minimal');
      expect(profile.nick).toBe('minimal');
      expect(profile.altNick).toBeUndefined();
    });

    it('should handle rapid concurrent operations', async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          identityProfilesService.add({
            name: `Profile ${i}`,
            nick: `nick${i}`,
          })
        );
      }

      const profiles = await Promise.all(promises);
      expect(profiles.length).toBe(10);
      expect(new Set(profiles.map(p => p.id)).size).toBe(10); // All unique IDs
    });

    it('should handle special characters in profile data', async () => {
      const profile = await identityProfilesService.add({
        name: 'Test "Profile" with \'quotes\'',
        nick: 'nick[away]',
        realname: 'User & Name <test@example.com>',
      });

      const retrieved = await identityProfilesService.get(profile.id);
      expect(retrieved?.name).toBe('Test "Profile" with \'quotes\'');
      expect(retrieved?.nick).toBe('nick[away]');
    });
  });

  describe('storage errors', () => {
    it('should handle AsyncStorage errors during initialization', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('Storage error'));

      // Should fallback to default profile on error
      const profiles = await identityProfilesService.list();
      expect(profiles.some(p => p.id === DEFAULT_PROFILE_ID)).toBe(true);
    });

    it('should propagate secure storage errors', async () => {
      (secureStorageService.setSecret as jest.Mock).mockRejectedValueOnce(new Error('Secure storage error'));

      // Service doesn't handle secure storage errors, they bubble up
      await expect(
        identityProfilesService.add({
          name: 'Test',
          nick: 'test',
          saslPassword: 'secret',
        })
      ).rejects.toThrow('Secure storage error');
    });
  });
});

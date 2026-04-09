/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for ConnectionProfilesService
 */

import {
  connectionProfilesService,
  ProfileTemplate,
} from '../../src/services/ConnectionProfilesService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock transifex
jest.mock('../../src/i18n/transifex', () => ({
  tx: {
    t: (key: string) => key,
  },
}));

describe('ConnectionProfilesService', () => {
  beforeEach(async () => {
    (AsyncStorage as any).__reset();
    // Reset service state
    (connectionProfilesService as any).profiles = [];
    (connectionProfilesService as any).listeners = [];
  });

  describe('initialize', () => {
    it('should initialize without errors', async () => {
      await expect(
        connectionProfilesService.initialize(),
      ).resolves.not.toThrow();
    });

    it('should load saved profiles from storage', async () => {
      const savedProfiles = [
        {
          id: 'profile-1',
          name: 'Test Profile',
          network: {
            id: 'net-1',
            name: 'TestNet',
            nick: 'testnick',
            realname: 'Test User',
            servers: [],
          },
          isTemplate: false,
          createdAt: Date.now(),
          useCount: 0,
        },
      ];

      await AsyncStorage.setItem(
        '@AndroidIRCX:connectionProfiles',
        JSON.stringify(savedProfiles),
      );
      await connectionProfilesService.initialize();

      const profiles = connectionProfilesService.getProfiles();
      expect(profiles.length).toBe(1);
      expect(profiles[0].name).toBe('Test Profile');
    });

    it('should handle corrupted storage data gracefully', async () => {
      await AsyncStorage.setItem(
        '@AndroidIRCX:connectionProfiles',
        'invalid json',
      );
      await expect(
        connectionProfilesService.initialize(),
      ).resolves.not.toThrow();

      const profiles = connectionProfilesService.getProfiles();
      expect(profiles).toEqual([]);
    });

    it('should initialize with empty array when no data', async () => {
      await connectionProfilesService.initialize();

      const profiles = connectionProfilesService.getProfiles();
      expect(profiles).toEqual([]);
    });
  });

  describe('createProfile', () => {
    it('should create a new profile', async () => {
      const network = {
        id: 'net-1',
        name: 'TestNet',
        nick: 'testnick',
        realname: 'Test User',
        servers: [],
      };

      const profile = await connectionProfilesService.createProfile(
        'My Profile',
        network,
        'Test description',
      );

      expect(profile.id).toBeDefined();
      expect(profile.name).toBe('My Profile');
      expect(profile.description).toBe('Test description');
      expect(profile.network).toEqual(network);
      expect(profile.isTemplate).toBe(false);
      expect(profile.useCount).toBe(0);
    });

    it('should generate unique IDs for profiles', async () => {
      const network = {
        id: 'net-1',
        name: 'TestNet',
        nick: 'testnick',
        realname: 'Test User',
        servers: [],
      };

      const profile1 = await connectionProfilesService.createProfile(
        'Profile 1',
        network,
      );
      const profile2 = await connectionProfilesService.createProfile(
        'Profile 2',
        network,
      );

      expect(profile1.id).not.toBe(profile2.id);
    });

    it('should persist profile to storage', async () => {
      const network = {
        id: 'net-1',
        name: 'TestNet',
        nick: 'testnick',
        realname: 'Test User',
        servers: [],
      };

      await connectionProfilesService.createProfile('My Profile', network);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@AndroidIRCX:connectionProfiles',
        expect.any(String),
      );
    });

    it('should create template profile', async () => {
      const network = {
        id: 'net-1',
        name: 'TestNet',
        nick: 'testnick',
        realname: 'Test User',
        servers: [],
      };

      const profile = await connectionProfilesService.createProfile(
        'Template',
        network,
        'Template desc',
        true,
        'gaming',
      );

      expect(profile.isTemplate).toBe(true);
      expect(profile.templateCategory).toBe('gaming');
    });
  });

  describe('createFromTemplate', () => {
    it('should create profile from template', async () => {
      const template: ProfileTemplate = {
        name: 'Freenode',
        description: 'Freenode IRC',
        category: 'general',
        network: {
          name: 'Freenode',
          nick: 'testnick',
          realname: 'Test User',
          servers: [
            {
              id: 'srv-1',
              hostname: 'irc.freenode.net',
              port: 6697,
              ssl: true,
            },
          ],
        },
      };

      const profile =
        await connectionProfilesService.createFromTemplate(template);

      expect(profile.name).toBe('Freenode');
      expect(profile.network.name).toBe('Freenode');
      expect(profile.network.id).toBeDefined(); // Auto-generated
      expect(profile.templateCategory).toBe('general');
    });

    it('should use custom name when provided', async () => {
      const template: ProfileTemplate = {
        name: 'Freenode',
        description: 'Freenode IRC',
        category: 'general',
        network: {
          name: 'Freenode',
          nick: 'testnick',
          realname: 'Test User',
          servers: [],
        },
      };

      const profile = await connectionProfilesService.createFromTemplate(
        template,
        'Custom Name',
      );

      expect(profile.name).toBe('Custom Name');
    });
  });

  describe('updateProfile', () => {
    it('should update existing profile', async () => {
      const network = {
        id: 'net-1',
        name: 'TestNet',
        nick: 'testnick',
        realname: 'Test User',
        servers: [],
      };

      const profile = await connectionProfilesService.createProfile(
        'Original',
        network,
      );

      const updated = await connectionProfilesService.updateProfile(
        profile.id,
        {
          name: 'Updated',
          description: 'Updated description',
        },
      );

      expect(updated).toBe(true);

      const retrieved = connectionProfilesService.getProfile(profile.id);
      expect(retrieved?.name).toBe('Updated');
      expect(retrieved?.description).toBe('Updated description');
    });

    it('should return false for non-existent profile', async () => {
      const updated = await connectionProfilesService.updateProfile(
        'non-existent',
        { name: 'Test' },
      );
      expect(updated).toBe(false);
    });

    it('should persist update to storage', async () => {
      const network = {
        id: 'net-1',
        name: 'TestNet',
        nick: 'testnick',
        realname: 'Test User',
        servers: [],
      };

      const profile = await connectionProfilesService.createProfile(
        'Original',
        network,
      );
      jest.clearAllMocks();

      await connectionProfilesService.updateProfile(profile.id, {
        name: 'Updated',
      });

      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('deleteProfile', () => {
    it('should delete existing profile', async () => {
      const network = {
        id: 'net-1',
        name: 'TestNet',
        nick: 'testnick',
        realname: 'Test User',
        servers: [],
      };

      const profile = await connectionProfilesService.createProfile(
        'To Delete',
        network,
      );

      const deleted = await connectionProfilesService.deleteProfile(profile.id);
      expect(deleted).toBe(true);

      const retrieved = connectionProfilesService.getProfile(profile.id);
      expect(retrieved).toBeUndefined();
    });

    it('should return false for non-existent profile', async () => {
      const deleted =
        await connectionProfilesService.deleteProfile('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('getProfiles', () => {
    it('should return all profiles', async () => {
      const network = {
        id: 'net-1',
        name: 'TestNet',
        nick: 'testnick',
        realname: 'Test User',
        servers: [],
      };

      await connectionProfilesService.createProfile('Profile 1', network);
      await connectionProfilesService.createProfile('Profile 2', network);

      const profiles = connectionProfilesService.getProfiles();
      expect(profiles.length).toBe(2);
    });

    it('should return copy of profiles array', async () => {
      const network = {
        id: 'net-1',
        name: 'TestNet',
        nick: 'testnick',
        realname: 'Test User',
        servers: [],
      };

      await connectionProfilesService.createProfile('Profile 1', network);

      const profiles1 = connectionProfilesService.getProfiles();
      const profiles2 = connectionProfilesService.getProfiles();

      expect(profiles1).not.toBe(profiles2);
      expect(profiles1).toEqual(profiles2);
    });
  });

  describe('getProfile', () => {
    it('should return profile by ID', async () => {
      const network = {
        id: 'net-1',
        name: 'TestNet',
        nick: 'testnick',
        realname: 'Test User',
        servers: [],
      };

      const created = await connectionProfilesService.createProfile(
        'Test Profile',
        network,
      );
      const retrieved = connectionProfilesService.getProfile(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Test Profile');
    });

    it('should return undefined for non-existent ID', () => {
      const profile = connectionProfilesService.getProfile('non-existent');
      expect(profile).toBeUndefined();
    });
  });

  describe('getProfilesByCategory', () => {
    it('should return profiles by category', async () => {
      const network = {
        id: 'net-1',
        name: 'TestNet',
        nick: 'testnick',
        realname: 'Test User',
        servers: [],
      };

      await connectionProfilesService.createProfile(
        'Gaming 1',
        network,
        undefined,
        true,
        'gaming',
      );
      await connectionProfilesService.createProfile(
        'Tech 1',
        network,
        undefined,
        true,
        'tech',
      );
      await connectionProfilesService.createProfile(
        'Gaming 2',
        network,
        undefined,
        true,
        'gaming',
      );

      const gamingProfiles =
        connectionProfilesService.getProfilesByCategory('gaming');
      expect(gamingProfiles.length).toBe(2);
      expect(gamingProfiles.every(p => p.templateCategory === 'gaming')).toBe(
        true,
      );
    });
  });

  describe('getUserProfiles', () => {
    it('should return only user-created profiles', async () => {
      const network = {
        id: 'net-1',
        name: 'TestNet',
        nick: 'testnick',
        realname: 'Test User',
        servers: [],
      };

      await connectionProfilesService.createProfile(
        'User Profile',
        network,
        undefined,
        false,
      );
      await connectionProfilesService.createProfile(
        'Template',
        network,
        undefined,
        true,
      );

      const userProfiles = connectionProfilesService.getUserProfiles();
      expect(userProfiles.length).toBe(1);
      expect(userProfiles[0].name).toBe('User Profile');
    });
  });

  describe('getTemplates', () => {
    it('should return built-in templates', () => {
      const templates = connectionProfilesService.getTemplates();

      expect(templates.length).toBeGreaterThan(0);
      expect(templates.some(t => t.name === 'Freenode')).toBe(true);
      expect(templates.some(t => t.name === 'Libera Chat')).toBe(true);
    });
  });

  describe('getTemplatesByCategory', () => {
    it('should return templates by category', () => {
      const gamingTemplates =
        connectionProfilesService.getTemplatesByCategory('gaming');

      expect(gamingTemplates.length).toBeGreaterThan(0);
      expect(gamingTemplates.every(t => t.category === 'gaming')).toBe(true);
    });
  });

  describe('markProfileUsed', () => {
    it('should increment use count and update last used', async () => {
      const network = {
        id: 'net-1',
        name: 'TestNet',
        nick: 'testnick',
        realname: 'Test User',
        servers: [],
      };

      const profile = await connectionProfilesService.createProfile(
        'Test',
        network,
      );
      const before = Date.now();

      await connectionProfilesService.markProfileUsed(profile.id);

      const updated = connectionProfilesService.getProfile(profile.id);
      expect(updated?.useCount).toBe(1);
      expect(updated?.lastUsed).toBeGreaterThanOrEqual(before);
    });

    it('should increment use count on multiple uses', async () => {
      const network = {
        id: 'net-1',
        name: 'TestNet',
        nick: 'testnick',
        realname: 'Test User',
        servers: [],
      };

      const profile = await connectionProfilesService.createProfile(
        'Test',
        network,
      );

      await connectionProfilesService.markProfileUsed(profile.id);
      await connectionProfilesService.markProfileUsed(profile.id);
      await connectionProfilesService.markProfileUsed(profile.id);

      const updated = connectionProfilesService.getProfile(profile.id);
      expect(updated?.useCount).toBe(3);
    });

    it('should handle non-existent profile gracefully', async () => {
      await expect(
        connectionProfilesService.markProfileUsed('non-existent'),
      ).resolves.not.toThrow();
    });
  });

  describe('getMostUsedProfiles', () => {
    it('should return most used profiles', async () => {
      const network = {
        id: 'net-1',
        name: 'TestNet',
        nick: 'testnick',
        realname: 'Test User',
        servers: [],
      };

      const profile1 = await connectionProfilesService.createProfile(
        'P1',
        network,
      );
      const profile2 = await connectionProfilesService.createProfile(
        'P2',
        network,
      );
      const profile3 = await connectionProfilesService.createProfile(
        'P3',
        network,
      );

      await connectionProfilesService.markProfileUsed(profile1.id);
      await connectionProfilesService.markProfileUsed(profile2.id);
      await connectionProfilesService.markProfileUsed(profile2.id);
      await connectionProfilesService.markProfileUsed(profile3.id);
      await connectionProfilesService.markProfileUsed(profile3.id);
      await connectionProfilesService.markProfileUsed(profile3.id);

      const mostUsed = connectionProfilesService.getMostUsedProfiles(3);

      expect(mostUsed[0].id).toBe(profile3.id); // 3 uses
      expect(mostUsed[1].id).toBe(profile2.id); // 2 uses
      expect(mostUsed[2].id).toBe(profile1.id); // 1 use
    });

    it('should respect limit parameter', async () => {
      const network = {
        id: 'net-1',
        name: 'TestNet',
        nick: 'testnick',
        realname: 'Test User',
        servers: [],
      };

      await connectionProfilesService.createProfile('P1', network);
      await connectionProfilesService.createProfile('P2', network);
      await connectionProfilesService.createProfile('P3', network);

      const mostUsed = connectionProfilesService.getMostUsedProfiles(2);
      expect(mostUsed.length).toBe(2);
    });
  });

  describe('getRecentlyUsedProfiles', () => {
    it('should return recently used profiles', async () => {
      const network = {
        id: 'net-1',
        name: 'TestNet',
        nick: 'testnick',
        realname: 'Test User',
        servers: [],
      };

      const profile1 = await connectionProfilesService.createProfile(
        'P1',
        network,
      );
      const profile2 = await connectionProfilesService.createProfile(
        'P2',
        network,
      );

      await connectionProfilesService.markProfileUsed(profile1.id);
      await new Promise(resolve => setTimeout(resolve, 10));
      await connectionProfilesService.markProfileUsed(profile2.id);

      const recentlyUsed = connectionProfilesService.getRecentlyUsedProfiles(2);

      expect(recentlyUsed[0].id).toBe(profile2.id); // Most recent
      expect(recentlyUsed[1].id).toBe(profile1.id);
    });

    it('should only include profiles that have been used', async () => {
      const network = {
        id: 'net-1',
        name: 'TestNet',
        nick: 'testnick',
        realname: 'Test User',
        servers: [],
      };

      const profile1 = await connectionProfilesService.createProfile(
        'P1',
        network,
      );
      await connectionProfilesService.createProfile('P2', network); // Never used

      await connectionProfilesService.markProfileUsed(profile1.id);

      const recentlyUsed = connectionProfilesService.getRecentlyUsedProfiles(5);
      expect(recentlyUsed.length).toBe(1);
    });
  });

  describe('onProfilesChange', () => {
    it('should notify listeners on profile changes', async () => {
      const listener = jest.fn();
      connectionProfilesService.onProfilesChange(listener);

      const network = {
        id: 'net-1',
        name: 'TestNet',
        nick: 'testnick',
        realname: 'Test User',
        servers: [],
      };

      await connectionProfilesService.createProfile('Test', network);

      expect(listener).toHaveBeenCalled();
    });

    it('should allow unsubscribing', async () => {
      const listener = jest.fn();
      const unsubscribe = connectionProfilesService.onProfilesChange(listener);

      const network = {
        id: 'net-1',
        name: 'TestNet',
        nick: 'testnick',
        realname: 'Test User',
        servers: [],
      };

      await connectionProfilesService.createProfile('Test', network);
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();

      await connectionProfilesService.createProfile('Test 2', network);
      expect(listener).toHaveBeenCalledTimes(1); // Not called again
    });
  });
});

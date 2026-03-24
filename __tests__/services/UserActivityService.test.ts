/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for UserActivityService - 100% coverage target
 */

import { userActivityService } from '../../src/services/UserActivityService';

describe('UserActivityService', () => {
  beforeEach(() => {
    // Clear all activities before each test
    // @ts-ignore - accessing private for testing
    userActivityService.activities.clear();
    jest.clearAllMocks();
  });

  describe('recordEvent', () => {
    it('should record a basic event', () => {
      userActivityService.recordEvent('TestUser', 'freenode', 'PRIVMSG');
      
      const activity = userActivityService.getActivity('TestUser', 'freenode');
      expect(activity).toBeDefined();
      expect(activity?.nick).toBe('TestUser');
      expect(activity?.network).toBe('freenode');
      expect(activity?.lastAction).toBe('PRIVMSG');
      expect(activity?.lastSeenAt).toBeGreaterThan(0);
    });

    it('should not record event for undefined nick', () => {
      userActivityService.recordEvent(undefined, 'freenode', 'PRIVMSG');
      
      // @ts-ignore - accessing private for testing
      expect(userActivityService.activities.size).toBe(0);
    });

    it('should record event with channel context', () => {
      userActivityService.recordEvent('TestUser', 'freenode', 'JOIN', { channel: '#general' });
      
      const activity = userActivityService.getActivity('TestUser', 'freenode');
      expect(activity?.channel).toBe('#general');
    });

    it('should record event with text context', () => {
      userActivityService.recordEvent('TestUser', 'freenode', 'PRIVMSG', { 
        channel: '#general',
        text: 'Hello everyone!' 
      });
      
      const activity = userActivityService.getActivity('TestUser', 'freenode');
      expect(activity?.text).toBe('Hello everyone!');
    });

    it('should update existing activity', async () => {
      userActivityService.recordEvent('TestUser', 'freenode', 'JOIN', { channel: '#general' });
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      userActivityService.recordEvent('TestUser', 'freenode', 'PRIVMSG', { channel: '#random' });
      
      const activity = userActivityService.getActivity('TestUser', 'freenode');
      expect(activity?.lastAction).toBe('PRIVMSG');
      expect(activity?.channel).toBe('#random'); // Updated channel
    });

    it('should preserve existing channel if not provided in update', () => {
      userActivityService.recordEvent('TestUser', 'freenode', 'JOIN', { channel: '#general' });
      userActivityService.recordEvent('TestUser', 'freenode', 'NICK');
      
      const activity = userActivityService.getActivity('TestUser', 'freenode');
      expect(activity?.channel).toBe('#general'); // Preserved
    });

    it('should handle case-insensitive nick matching', () => {
      userActivityService.recordEvent('TestUser', 'freenode', 'PRIVMSG');
      
      const activity1 = userActivityService.getActivity('TestUser', 'freenode');
      const activity2 = userActivityService.getActivity('testuser', 'freenode');
      const activity3 = userActivityService.getActivity('TESTUSER', 'freenode');
      
      expect(activity1).toEqual(activity2);
      expect(activity2).toEqual(activity3);
    });

    it('should handle undefined network', () => {
      userActivityService.recordEvent('TestUser', undefined, 'PRIVMSG');
      
      const activity = userActivityService.getActivity('TestUser', undefined);
      expect(activity).toBeDefined();
      expect(activity?.network).toBeUndefined();
    });

    it('should distinguish users by network', () => {
      userActivityService.recordEvent('TestUser', 'freenode', 'PRIVMSG');
      userActivityService.recordEvent('TestUser', 'libera', 'JOIN');
      
      const freenodeActivity = userActivityService.getActivity('TestUser', 'freenode');
      const liberaActivity = userActivityService.getActivity('TestUser', 'libera');
      
      expect(freenodeActivity?.lastAction).toBe('PRIVMSG');
      expect(liberaActivity?.lastAction).toBe('JOIN');
    });
  });

  describe('getActivity', () => {
    it('should return undefined for unknown user', () => {
      const activity = userActivityService.getActivity('UnknownUser', 'freenode');
      expect(activity).toBeUndefined();
    });

    it('should return undefined for undefined nick', () => {
      const activity = userActivityService.getActivity(undefined as any, 'freenode');
      expect(activity).toBeUndefined();
    });

    it('should return correct activity after recording', () => {
      userActivityService.recordEvent('TestUser', 'freenode', 'JOIN', { channel: '#general' });
      
      const activity = userActivityService.getActivity('TestUser', 'freenode');
      expect(activity).toMatchObject({
        nick: 'TestUser',
        network: 'freenode',
        lastAction: 'JOIN',
        channel: '#general',
      });
    });
  });

  describe('clearNetwork', () => {
    it('should clear all activities for a network', () => {
      userActivityService.recordEvent('User1', 'freenode', 'PRIVMSG');
      userActivityService.recordEvent('User2', 'freenode', 'JOIN');
      userActivityService.recordEvent('User3', 'libera', 'PRIVMSG');
      
      userActivityService.clearNetwork('freenode');
      
      expect(userActivityService.getActivity('User1', 'freenode')).toBeUndefined();
      expect(userActivityService.getActivity('User2', 'freenode')).toBeUndefined();
      expect(userActivityService.getActivity('User3', 'libera')).toBeDefined();
    });

    it('should handle clearing empty network', () => {
      expect(() => userActivityService.clearNetwork('nonexistent')).not.toThrow();
    });

    it('should only clear exact network matches', () => {
      userActivityService.recordEvent('User1', 'freenode', 'PRIVMSG');
      userActivityService.recordEvent('User2', 'freenode-backup', 'JOIN');
      
      userActivityService.clearNetwork('freenode');
      
      expect(userActivityService.getActivity('User1', 'freenode')).toBeUndefined();
      expect(userActivityService.getActivity('User2', 'freenode-backup')).toBeDefined();
    });
  });
});

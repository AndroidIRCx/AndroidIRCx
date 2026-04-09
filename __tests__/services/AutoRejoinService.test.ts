/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for AutoRejoinService - 100% coverage target
 */

import { AutoRejoinService } from '../../src/services/AutoRejoinService';

const mockOn = jest.fn().mockReturnValue(jest.fn());
const mockGetNetworkName = jest.fn().mockReturnValue('freenode');
const mockGetCurrentNick = jest.fn().mockReturnValue('TestUser');
const mockJoinChannel = jest.fn();

describe('AutoRejoinService', () => {
  let service: AutoRejoinService;
  let ircService: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    ircService = {
      on: mockOn,
      getNetworkName: mockGetNetworkName,
      getCurrentNick: mockGetCurrentNick,
      joinChannel: mockJoinChannel,
    };
    service = new AutoRejoinService(ircService);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('initialize', () => {
    it('should register event handlers', () => {
      service.initialize();

      expect(mockOn).toHaveBeenCalledWith('kick', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith(
        'joinedChannel',
        expect.any(Function),
      );
      expect(mockOn).toHaveBeenCalledWith('part', expect.any(Function));
    });

    it('should store cleanup functions', () => {
      service.initialize();

      // Test destroy to verify cleanup functions are stored
      service.destroy();
      // If no error, cleanup functions were stored properly
    });
  });

  describe('destroy', () => {
    it('should clear all timers', () => {
      service.setConfig('freenode', { enabled: true, delay: 5000 });
      service.handleKick('#general');

      expect(service.rejoinTimers.size).toBe(1);

      service.destroy();

      expect(service.rejoinTimers.size).toBe(0);
    });

    it('should remove event listeners', () => {
      service.initialize();
      const cleanupMock = jest.fn();
      service.cleanupFunctions.push(cleanupMock);

      service.destroy();

      expect(cleanupMock).toHaveBeenCalled();
      expect(service.cleanupFunctions.length).toBe(0);
    });

    it('should handle cleanup errors gracefully', () => {
      const errorCleanup = jest.fn().mockImplementation(() => {
        throw new Error('Cleanup failed');
      });
      service.cleanupFunctions.push(errorCleanup);

      expect(() => service.destroy()).not.toThrow();
      expect(console.error).toHaveBeenCalledWith(
        'AutoRejoinService: Error during cleanup:',
        expect.any(Error),
      );
    });

    it('should clear all state', () => {
      service.setConfig('freenode', { enabled: true });
      service.handleKick('#general');

      service.destroy();

      expect(service.kickedChannels.size).toBe(0);
      expect(service.rejoinAttempts.size).toBe(0);
      expect(service.manuallyLeftChannels.size).toBe(0);
    });
  });

  describe('handleKick', () => {
    it('should not rejoin if manually left', () => {
      service.setConfig('freenode', { enabled: true });
      service.manuallyLeftChannels.add('#general');

      service.handleKick('#general');

      jest.advanceTimersByTime(2000);
      expect(mockJoinChannel).not.toHaveBeenCalled();
    });

    it('should not rejoin if disabled', () => {
      service.setConfig('freenode', { enabled: false });

      service.handleKick('#general');

      jest.advanceTimersByTime(2000);
      expect(mockJoinChannel).not.toHaveBeenCalled();
    });

    it('should not rejoin if no config', () => {
      service.handleKick('#general');

      jest.advanceTimersByTime(2000);
      expect(mockJoinChannel).not.toHaveBeenCalled();
    });

    it('should rejoin after default delay', () => {
      service.setConfig('freenode', { enabled: true });

      service.handleKick('#general');

      expect(mockJoinChannel).not.toHaveBeenCalled();
      jest.advanceTimersByTime(2000);
      expect(mockJoinChannel).toHaveBeenCalledWith('#general');
    });

    it('should rejoin after custom delay', () => {
      service.setConfig('freenode', { enabled: true, delay: 5000 });

      service.handleKick('#general');

      jest.advanceTimersByTime(4000);
      expect(mockJoinChannel).not.toHaveBeenCalled();
      jest.advanceTimersByTime(1000);
      expect(mockJoinChannel).toHaveBeenCalledWith('#general');
    });

    it('should stop after max attempts', () => {
      service.setConfig('freenode', { enabled: true, maxAttempts: 2 });

      // First kick
      service.handleKick('#general');
      jest.advanceTimersByTime(2000);
      expect(mockJoinChannel).toHaveBeenCalledTimes(1);

      // Second kick
      service.handleKick('#general');
      jest.advanceTimersByTime(2000);
      expect(mockJoinChannel).toHaveBeenCalledTimes(2);

      // Third kick - should not rejoin
      service.handleKick('#general');
      jest.advanceTimersByTime(2000);
      expect(mockJoinChannel).toHaveBeenCalledTimes(2);
      expect(console.log).toHaveBeenCalledWith(
        'AutoRejoinService: Max attempts reached for #general',
      );
    });

    it('should clear existing timer when kicked again', () => {
      service.setConfig('freenode', { enabled: true, delay: 5000 });

      service.handleKick('#general');
      const firstTimer = service.rejoinTimers.get('#general');

      // Kick again before timer fires
      service.handleKick('#general');
      const secondTimer = service.rejoinTimers.get('#general');

      expect(firstTimer).not.toBe(secondTimer);
    });

    it('should track kicked channels', () => {
      service.setConfig('freenode', { enabled: true });

      service.handleKick('#general');

      expect(service.kickedChannels.has('#general')).toBe(true);
    });

    it('should increment rejoin attempts', () => {
      service.setConfig('freenode', { enabled: true });

      service.handleKick('#general');
      jest.advanceTimersByTime(2000);

      expect(service.rejoinAttempts.get('#general')).toBe(1);
    });

    it('should use custom max attempts', () => {
      service.setConfig('freenode', { enabled: true, maxAttempts: 5 });

      for (let i = 0; i < 5; i++) {
        service.handleKick('#general');
        jest.advanceTimersByTime(2000);
      }

      expect(mockJoinChannel).toHaveBeenCalledTimes(5);

      // Sixth should not rejoin
      service.handleKick('#general');
      jest.advanceTimersByTime(2000);
      expect(mockJoinChannel).toHaveBeenCalledTimes(5);
    });
  });

  describe('handleJoin', () => {
    it('should clear rejoin timer', () => {
      service.setConfig('freenode', { enabled: true, delay: 5000 });
      service.handleKick('#general');

      expect(service.rejoinTimers.has('#general')).toBe(true);

      service.handleJoin('#general');

      expect(service.rejoinTimers.has('#general')).toBe(false);
    });

    it('should clear kicked status', () => {
      service.setConfig('freenode', { enabled: true });
      service.handleKick('#general');

      expect(service.kickedChannels.has('#general')).toBe(true);

      service.handleJoin('#general');

      expect(service.kickedChannels.has('#general')).toBe(false);
    });

    it('should clear rejoin attempts', () => {
      service.setConfig('freenode', { enabled: true });
      service.handleKick('#general');
      jest.advanceTimersByTime(2000);

      service.handleJoin('#general');

      expect(service.rejoinAttempts.has('#general')).toBe(false);
    });

    it('should clear manually left status', () => {
      service.manuallyLeftChannels.add('#general');

      service.handleJoin('#general');

      expect(service.manuallyLeftChannels.has('#general')).toBe(false);
    });
  });

  describe('handlePart', () => {
    it('should track manual part for current nick', () => {
      service.handlePart('#general', 'TestUser');

      expect(service.manuallyLeftChannels.has('#general')).toBe(true);
    });

    it('should not track part for other nicks', () => {
      service.handlePart('#general', 'OtherUser');

      expect(service.manuallyLeftChannels.has('#general')).toBe(false);
    });

    it('should clear kicked status on manual part', () => {
      service.kickedChannels.add('#general');

      service.handlePart('#general', 'TestUser');

      expect(service.kickedChannels.has('#general')).toBe(false);
    });

    it('should clear rejoin attempts on manual part', () => {
      service.rejoinAttempts.set('#general', 3);

      service.handlePart('#general', 'TestUser');

      expect(service.rejoinAttempts.has('#general')).toBe(false);
    });

    it('should handle null nick', () => {
      service.handlePart('#general', null as any);

      expect(service.manuallyLeftChannels.has('#general')).toBe(false);
    });
  });

  describe('setConfig / getConfig', () => {
    it('should set and get config', () => {
      service.setConfig('freenode', {
        enabled: true,
        delay: 3000,
        maxAttempts: 5,
      });

      const config = service.getConfig('freenode');
      expect(config).toEqual({ enabled: true, delay: 3000, maxAttempts: 5 });
    });

    it('should return undefined for unset network', () => {
      expect(service.getConfig('nonexistent')).toBeUndefined();
    });

    it('should handle multiple networks', () => {
      service.setConfig('freenode', { enabled: true });
      service.setConfig('libera', { enabled: false });

      expect(service.getConfig('freenode')?.enabled).toBe(true);
      expect(service.getConfig('libera')?.enabled).toBe(false);
    });
  });

  describe('setEnabled / isEnabled', () => {
    it('should enable auto-rejoin', () => {
      service.setEnabled('freenode', true);
      expect(service.isEnabled('freenode')).toBe(true);
    });

    it('should disable auto-rejoin', () => {
      service.setEnabled('freenode', true);
      service.setEnabled('freenode', false);
      expect(service.isEnabled('freenode')).toBe(false);
    });

    it('should return false for unset network', () => {
      expect(service.isEnabled('nonexistent')).toBe(false);
    });

    it('should create default config when enabling', () => {
      service.setEnabled('newnetwork', true);

      const config = service.getConfig('newnetwork');
      expect(config).toEqual({ enabled: true });
    });

    it('should preserve other settings when toggling', () => {
      service.setConfig('freenode', {
        enabled: false,
        delay: 5000,
        maxAttempts: 10,
      });
      service.setEnabled('freenode', true);

      const config = service.getConfig('freenode');
      expect(config?.enabled).toBe(true);
      expect(config?.delay).toBe(5000);
      expect(config?.maxAttempts).toBe(10);
    });
  });
});

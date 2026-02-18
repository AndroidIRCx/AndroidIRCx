/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for NotifyService
 */

import { NotifyService, notifyService } from '../../src/services/NotifyService';
import { userManagementService } from '../../src/services/UserManagementService';

// Mock dependencies
jest.mock('../../src/services/UserManagementService', () => ({
  userManagementService: {
    addUserListEntry: jest.fn(),
    removeUserListEntry: jest.fn(),
    getUserListEntries: jest.fn(),
  },
}));

jest.mock('../../src/services/SoundService', () => ({
  soundService: {
    playSound: jest.fn(),
  },
}));

jest.mock('../../src/services/NotificationService', () => ({
  notificationService: {
    showLocalNotification: jest.fn(),
  },
}));

describe('NotifyService', () => {
  let service: NotifyService;
  let mockIRCService: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockIRCService = {
      on: jest.fn(),
      sendRaw: jest.fn(),
      getNetworkName: jest.fn().mockReturnValue('TestNetwork'),
      addRawMessage: jest.fn(),
      addMessage: jest.fn(),
      hasCapability: jest.fn().mockReturnValue(false),
    };

    service = new NotifyService();
    service.setIRCService(mockIRCService);
  });

  afterEach(() => {
    jest.useRealTimers();
    service.destroy();
  });

  describe('Module exports', () => {
    it('exports NotifyService class', () => {
      expect(NotifyService).toBeDefined();
      expect(typeof NotifyService).toBe('function');
    });

    it('exports singleton instance', () => {
      expect(notifyService).toBeDefined();
      expect(notifyService instanceof NotifyService).toBe(true);
    });
  });

  describe('Initialization', () => {
    it('should initialize without errors', () => {
      expect(() => service.initialize()).not.toThrow();
    });

    it('should set network', () => {
      (userManagementService.getUserListEntries as jest.Mock).mockReturnValue([]);
      service.setNetwork('NewNetwork');
      expect(service.getNotifyEntries()).toEqual([]); // Should use the new network
    });
  });

  describe('IRC event listeners', () => {
    it('should set up IRC listeners on setIRCService', () => {
      expect(mockIRCService.on).toHaveBeenCalledWith('connected', expect.any(Function));
      expect(mockIRCService.on).toHaveBeenCalledWith('disconnected', expect.any(Function));
      expect(mockIRCService.on).toHaveBeenCalledWith('cap_ack', expect.any(Function));
      expect(mockIRCService.on).toHaveBeenCalledWith('numeric', expect.any(Function));
    });

    it('should handle connection event', () => {
      const connectedHandler = mockIRCService.on.mock.calls.find(
        (call: [string, Function]) => call[0] === 'connected'
      )[1];

      (userManagementService.getUserListEntries as jest.Mock).mockReturnValue([
        { mask: 'Friend1!*@*', network: 'TestNetwork', protected: false, addedAt: Date.now() },
      ]);

      connectedHandler();

      expect(service['isConnected']).toBe(true);
    });

    it('should handle disconnection event', () => {
      const connectedHandler = mockIRCService.on.mock.calls.find(
        (call: [string, Function]) => call[0] === 'connected'
      )[1];
      const disconnectedHandler = mockIRCService.on.mock.calls.find(
        (call: [string, Function]) => call[0] === 'disconnected'
      )[1];

      // First connect
      connectedHandler();
      // Then disconnect
      disconnectedHandler();

      expect(service['isConnected']).toBe(false);
    });
  });

  describe('Numeric handling', () => {
    beforeEach(() => {
      service.setNetwork('TestNetwork');
      (userManagementService.getUserListEntries as jest.Mock).mockReturnValue([]);
    });

    const getNumericHandler = () => {
      return mockIRCService.on.mock.calls.find(
        (call: [string, Function]) => call[0] === 'numeric'
      )[1];
    };

    it('should handle RPL_LOGON (600) for WATCH', () => {
      const handler = getNumericHandler();
      const listener = jest.fn();
      service.on('online', listener);

      handler(600, 'server', ['*', 'Friend', 'user', 'host.com', '*', ':is online'], Date.now());

      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        nick: 'Friend',
        host: 'user@host.com',
      }));
    });

    it('should handle RPL_NOWON (604) for WATCH', () => {
      const handler = getNumericHandler();
      const listener = jest.fn();
      service.on('online', listener);

      handler(604, 'server', ['', 'Friend', 'user', 'host.com'], Date.now());

      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        nick: 'Friend',
      }));
    });

    it('should handle RPL_LOGOFF (601) for WATCH', () => {
      const handler = getNumericHandler();
      const listener = jest.fn();
      service.on('offline', listener);

      // First go online
      handler(600, 'server', ['', 'Friend', 'user', 'host.com'], Date.now());
      // Then offline
      handler(601, 'server', ['', 'Friend', 'user', 'host.com', ':offline'], Date.now());

      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        nick: 'Friend',
      }));
    });

    it('should handle RPL_NOWOFF (605) for WATCH', () => {
      const handler = getNumericHandler();
      const listener = jest.fn();
      service.on('offline', listener);

      // First put user online
      handler(604, 'server', ['*', 'Friend', 'user', 'host.com'], Date.now());
      // Then offline
      handler(605, 'server', ['*', 'Friend', 'user', 'host.com'], Date.now());

      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        nick: 'Friend',
      }));
    });

    it('should handle RPL_MONONLINE (730) for MONITOR', () => {
      const handler = getNumericHandler();
      const listener = jest.fn();
      service.on('online', listener);

      // Note: params[0] is usually the target, nick starts at params[1]
      handler(730, 'server', ['*', 'Friend!user@host.com,Friend2'], Date.now());

      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        nick: 'Friend',
      }));
    });

    it('should handle RPL_MONOFFLINE (731) for MONITOR', () => {
      const handler = getNumericHandler();
      const listener = jest.fn();
      service.on('offline', listener);

      // First put user online
      handler(730, 'server', ['*', 'Friend!user@host.com'], Date.now());
      // Then offline
      handler(731, 'server', ['*', 'Friend,Friend2'], Date.now());

      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        nick: 'Friend',
      }));
    });

    it('should handle ERR_MONLISTFULL (734)', () => {
      const handler = getNumericHandler();
      const listener = jest.fn();
      service.on('listFull', listener);

      handler(734, 'server', ['*', '100'], Date.now());

      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        limit: 100,
      }));
    });

    it('should handle RPL_ISON (303)', () => {
      const handler = getNumericHandler();
      const listener = jest.fn();
      service.on('online', listener);

      (userManagementService.getUserListEntries as jest.Mock).mockReturnValue([
        { mask: 'Friend!*@*', network: 'TestNetwork', protected: false, addedAt: Date.now() },
        { mask: 'AwayUser!*@*', network: 'TestNetwork', protected: false, addedAt: Date.now() },
      ]);

      handler(303, 'server', ['*', ':Friend'], Date.now());

      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        nick: 'Friend',
      }));
    });
  });

  describe('addNotify', () => {
    beforeEach(() => {
      service.setNetwork('TestNetwork');
      service['isConnected'] = true;
      service['protocol'] = 'monitor';
    });

    it('should add nick to notify list via UserManagementService', async () => {
      await service.addNotify('NewFriend');

      expect(userManagementService.addUserListEntry).toHaveBeenCalledWith(
        'notify',
        'NewFriend',
        expect.objectContaining({ network: 'TestNetwork' })
      );
    });

    it('should send MONITOR + when connected with monitor protocol', async () => {
      await service.addNotify('NewFriend');

      expect(mockIRCService.sendRaw).toHaveBeenCalledWith('MONITOR + NewFriend');
    });

    it('should send WATCH + when connected with watch protocol', async () => {
      service['protocol'] = 'watch';
      await service.addNotify('NewFriend');

      expect(mockIRCService.sendRaw).toHaveBeenCalledWith('WATCH +NewFriend');
    });
  });

  describe('removeNotify', () => {
    beforeEach(() => {
      service.setNetwork('TestNetwork');
      service['isConnected'] = true;
      service['protocol'] = 'monitor';
    });

    it('should remove nick from notify list', async () => {
      await service.removeNotify('OldFriend');

      expect(userManagementService.removeUserListEntry).toHaveBeenCalledWith(
        'notify',
        'OldFriend',
        'TestNetwork'
      );
    });

    it('should send MONITOR - when connected', async () => {
      await service.removeNotify('OldFriend');

      expect(mockIRCService.sendRaw).toHaveBeenCalledWith('MONITOR - OldFriend');
    });

    it('should send WATCH - when using watch protocol', async () => {
      service['protocol'] = 'watch';
      await service.removeNotify('OldFriend');

      expect(mockIRCService.sendRaw).toHaveBeenCalledWith('WATCH -OldFriend');
    });

    it('should clear status when removing', async () => {
      // Set up status first
      service['notifyStatus'].set('OldFriend', { online: true });

      await service.removeNotify('OldFriend');

      expect(service.getStatus('OldFriend')).toBeUndefined();
    });
  });

  describe('getNotifyEntries', () => {
    it('should get entries from UserManagementService', () => {
      const entries = [
        { mask: 'Friend1!*@*', network: 'TestNetwork', protected: false, addedAt: Date.now() },
      ];
      (userManagementService.getUserListEntries as jest.Mock).mockReturnValue(entries);

      const result = service.getNotifyEntries('TestNetwork');

      expect(result).toEqual(entries);
      expect(userManagementService.getUserListEntries).toHaveBeenCalledWith('notify', 'TestNetwork');
    });
  });

  describe('getStatus', () => {
    it('should return status for a nick', () => {
      service['notifyStatus'].set('Friend', { online: true, lastSeen: Date.now() });

      const status = service.getStatus('Friend');

      expect(status).toEqual(expect.objectContaining({
        online: true,
      }));
    });

    it('should return undefined for unknown nick', () => {
      expect(service.getStatus('Unknown')).toBeUndefined();
    });
  });

  describe('getAllStatuses', () => {
    it('should return all statuses', () => {
      service['notifyStatus'].set('Friend1', { online: true });
      service['notifyStatus'].set('Friend2', { online: false });

      const statuses = service.getAllStatuses();

      expect(statuses.size).toBe(2);
      expect(statuses.get('Friend1')).toEqual(expect.objectContaining({ online: true }));
    });
  });

  describe('getProtocol', () => {
    it('should return current protocol', () => {
      service['protocol'] = 'monitor';
      expect(service.getProtocol()).toBe('monitor');

      service['protocol'] = 'ison';
      expect(service.getProtocol()).toBe('ison');
    });
  });

  describe('clearAll', () => {
    beforeEach(() => {
      service.setNetwork('TestNetwork');
      service['isConnected'] = true;
      service['protocol'] = 'monitor';
      (userManagementService.getUserListEntries as jest.Mock).mockReturnValue([
        { mask: 'Friend1!*@*', network: 'TestNetwork', protected: false, addedAt: Date.now() },
        { mask: 'Friend2!*@*', network: 'TestNetwork', protected: false, addedAt: Date.now() },
      ]);
    });

    it('should remove all entries', async () => {
      await service.clearAll();

      expect(userManagementService.removeUserListEntry).toHaveBeenCalledTimes(2);
    });

    it('should send MONITOR - for all entries', async () => {
      await service.clearAll();

      expect(mockIRCService.sendRaw).toHaveBeenCalledWith('MONITOR - Friend1,Friend2');
    });

    it('should clear all statuses', async () => {
      service['notifyStatus'].set('Friend1', { online: true });
      service['notifyStatus'].set('Friend2', { online: false });

      await service.clearAll();

      expect(service.getAllStatuses().size).toBe(0);
    });
  });

  describe('destroy', () => {
    it('should clear ISON interval', () => {
      service['isonInterval'] = setInterval(() => {}, 1000);
      
      service.destroy();

      expect(service['isonInterval']).toBeNull();
    });

    it('should remove all listeners', () => {
      const removeListenerMock = jest.fn();
      service.removeAllListeners = removeListenerMock;

      service.destroy();

      expect(removeListenerMock).toHaveBeenCalled();
    });
  });
});

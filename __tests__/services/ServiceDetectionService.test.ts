/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * ServiceDetectionService Unit Tests
 */

import { serviceDetectionService, ServiceDetectionService } from '../../src/services/ServiceDetectionService';

describe('ServiceDetectionService', () => {
  let localService: ServiceDetectionService;

  beforeEach(() => {
    // Reset the singleton state before each test
    serviceDetectionService.cleanupNetwork('test-network');
    localService = new ServiceDetectionService();
  });

  afterEach(() => {
    serviceDetectionService.cleanupNetwork('test-network');
  });

  describe('initializeNetwork', () => {
    it('should initialize detection state for a network', () => {
      serviceDetectionService.initializeNetwork('test-network');
      const result = serviceDetectionService.getDetectionResult('test-network');
      expect(result).toBeUndefined();
    });
  });

  describe('processISupport', () => {
    it('auto-initializes state when processing an unknown network', () => {
      serviceDetectionService.processISupport('test-network', ['NETWORK=Undernet']);

      const result = serviceDetectionService.getDetectionResult('test-network');
      expect(result?.serviceType).toBe('undernet');
    });

    it('should detect Anope services from NICKSERV/CHANSERV tokens', () => {
      serviceDetectionService.initializeNetwork('test-network');
      
      serviceDetectionService.processISupport('test-network', [
        'NICKSERV=NickServ',
        'CHANSERV=ChanServ',
        'HOSTSERV=HostServ',
      ]);

      const result = serviceDetectionService.getDetectionResult('test-network');
      expect(result).toBeDefined();
      expect(result?.serviceType).toBe('anope');
      expect(result?.confidence).toBeGreaterThan(0.5);
    });

    it('should detect UnrealIRCd from specific tokens', () => {
      serviceDetectionService.initializeNetwork('test-network');
      
      serviceDetectionService.processISupport('test-network', [
        'NICKCHARS=',
        'NICKIP=',
        'ESVID=',
      ]);

      const result = serviceDetectionService.getDetectionResult('test-network');
      expect(result).toBeDefined();
      expect(result?.ircdType).toBe('unrealircd');
    });

    it('should detect InspIRCd from NICKMAXLEN token', () => {
      serviceDetectionService.initializeNetwork('test-network');
      
      serviceDetectionService.processISupport('test-network', [
        'NICKMAXLEN=30',
      ]);

      const result = serviceDetectionService.getDetectionResult('test-network');
      expect(result).toBeDefined();
      expect(result?.ircdType).toBe('inspircd');
    });

    it('should detect Charybdis from EUID token', () => {
      serviceDetectionService.initializeNetwork('test-network');
      
      serviceDetectionService.processISupport('test-network', [
        'EUID=',
      ]);

      const result = serviceDetectionService.getDetectionResult('test-network');
      expect(result).toBeDefined();
      expect(result?.ircdType).toBe('charybdis');
    });

    it('should extract NETWORK name from token', () => {
      serviceDetectionService.initializeNetwork('test-network');
      
      serviceDetectionService.processISupport('test-network', [
        'NETWORK=DALnet',
      ]);

      const result = serviceDetectionService.getDetectionResult('test-network');
      expect(result).toBeDefined();
      expect(result?.serviceType).toBe('dalnet');
    });

    it('stores raw token data in the detection result', () => {
      serviceDetectionService.initializeNetwork('test-network');

      serviceDetectionService.processISupport('test-network', [
        'NICKSERV=NickServ',
        'CHANSERV=ChanServ',
        'SAFELIST',
      ]);

      const result = serviceDetectionService.getDetectionResult('test-network');
      expect(result?.rawData).toMatchObject({
        isupportTokens: {
          NICKSERV: 'NickServ',
          CHANSERV: 'ChanServ',
          SAFELIST: 'true',
        },
        detectedServices: {
          nickserv: 'nickserv',
          chanserv: 'chanserv',
        },
      });
    });
  });

  describe('processNetworkName', () => {
    it('auto-initializes when processing a network name on a fresh network', () => {
      serviceDetectionService.processNetworkName('test-network', 'QuakeNet');

      expect(serviceDetectionService.getDetectionResult('test-network')?.serviceType).toBe('quakenet');
    });

    it('should detect DALnet from network name', () => {
      serviceDetectionService.initializeNetwork('test-network');
      
      serviceDetectionService.processNetworkName('test-network', 'DALnet');

      const result = serviceDetectionService.getDetectionResult('test-network');
      expect(result).toBeDefined();
      expect(result?.serviceType).toBe('dalnet');
    });

    it('should detect Undernet from network name', () => {
      serviceDetectionService.initializeNetwork('test-network');
      
      serviceDetectionService.processNetworkName('test-network', 'Undernet');

      const result = serviceDetectionService.getDetectionResult('test-network');
      expect(result).toBeDefined();
      expect(result?.serviceType).toBe('undernet');
      expect(result?.ircdType).toBe('charybdis');
    });

    it('should detect QuakeNet from network name', () => {
      serviceDetectionService.initializeNetwork('test-network');
      
      serviceDetectionService.processNetworkName('test-network', 'QuakeNet');

      const result = serviceDetectionService.getDetectionResult('test-network');
      expect(result).toBeDefined();
      expect(result?.serviceType).toBe('quakenet');
    });
  });

  describe('processVersion', () => {
    it('auto-initializes when processing version on a fresh network', () => {
      serviceDetectionService.processVersion('test-network', 'ngIRCd-26');

      expect(serviceDetectionService.getDetectionResult('test-network')?.ircdType).toBe('ngircd');
    });

    it('should detect UnrealIRCd from version string', () => {
      serviceDetectionService.initializeNetwork('test-network');
      
      serviceDetectionService.processVersion('test-network', 'UnrealIRCd-6.0.0');

      const result = serviceDetectionService.getDetectionResult('test-network');
      expect(result).toBeDefined();
      expect(result?.ircdType).toBe('unrealircd');
    });

    it('should detect InspIRCd from version string', () => {
      serviceDetectionService.initializeNetwork('test-network');
      
      serviceDetectionService.processVersion('test-network', 'InspIRCd-3.0.0');

      const result = serviceDetectionService.getDetectionResult('test-network');
      expect(result).toBeDefined();
      expect(result?.ircdType).toBe('inspircd');
    });

    it('should detect Charybdis from version string', () => {
      serviceDetectionService.initializeNetwork('test-network');
      
      serviceDetectionService.processVersion('test-network', 'charybdis-4.0');

      const result = serviceDetectionService.getDetectionResult('test-network');
      expect(result).toBeDefined();
      expect(result?.ircdType).toBe('charybdis');
    });

    it('should detect Solanum as Charybdis', () => {
      serviceDetectionService.initializeNetwork('test-network');
      
      serviceDetectionService.processVersion('test-network', 'solanum-1.0');

      const result = serviceDetectionService.getDetectionResult('test-network');
      expect(result).toBeDefined();
      expect(result?.ircdType).toBe('charybdis');
    });

    it('should detect hybrid from version string', () => {
      serviceDetectionService.initializeNetwork('test-network');

      serviceDetectionService.processVersion('test-network', 'ircd-hybrid-8.2.44');

      expect(serviceDetectionService.getDetectionResult('test-network')?.ircdType).toBe('hybrid');
    });
  });

  describe('processServiceMessage', () => {
    it('detects Undernet from X service messages', () => {
      serviceDetectionService.processServiceMessage(
        'test-network',
        'X',
        'Welcome to channel services'
      );

      const result = serviceDetectionService.getDetectionResult('test-network');
      expect(result?.serviceType).toBe('undernet');
      expect(result?.method).toBe('services');
    });

    it('detects Anope-style services from message content', () => {
      serviceDetectionService.processServiceMessage(
        'test-network',
        'NickServ',
        'You can register your nickname with REGISTER'
      );
      serviceDetectionService.processServiceMessage(
        'test-network',
        'ChanServ',
        'You can register a channel with REGISTER'
      );

      const result = serviceDetectionService.getDetectionResult('test-network');
      expect(result?.serviceType).toBe('anope');
      expect(result?.ircdType).toBe('unrealircd');
    });

    it('ignores messages from non-service nicks', () => {
      serviceDetectionService.processServiceMessage('test-network', 'RegularUser', 'register your nickname');

      expect(serviceDetectionService.getDetectionResult('test-network')).toBeUndefined();
    });
  });

  describe('isServiceNick', () => {
    it('should identify NickServ as service nick', () => {
      expect(serviceDetectionService.isServiceNick('NickServ')).toBe(true);
      expect(serviceDetectionService.isServiceNick('nickserv')).toBe(true);
    });

    it('should identify ChanServ as service nick', () => {
      expect(serviceDetectionService.isServiceNick('ChanServ')).toBe(true);
      expect(serviceDetectionService.isServiceNick('chanserv')).toBe(true);
    });

    it('should identify Undernet X as service nick', () => {
      expect(serviceDetectionService.isServiceNick('X')).toBe(true);
    });

    it('should identify QuakeNet Q as service nick', () => {
      expect(serviceDetectionService.isServiceNick('Q')).toBe(true);
    });

    it('should not identify regular nicks as service', () => {
      expect(serviceDetectionService.isServiceNick('JohnDoe')).toBe(false);
      expect(serviceDetectionService.isServiceNick('regular_user')).toBe(false);
    });
  });

  describe('onDetection callback', () => {
    it('should emit detection event when services are detected', (done) => {
      serviceDetectionService.initializeNetwork('test-network');
      
      const unsubscribe = serviceDetectionService.onDetection((networkId, result) => {
        if (networkId === 'test-network') {
          expect(result.serviceType).toBe('dalnet');
          unsubscribe();
          done();
        }
      });

      serviceDetectionService.processNetworkName('test-network', 'DALnet');
    });

    it('allows callbacks to unsubscribe', () => {
      const callback = jest.fn();
      const unsubscribe = serviceDetectionService.onDetection(callback);

      unsubscribe();
      serviceDetectionService.processNetworkName('test-network', 'DALnet');

      expect(callback).not.toHaveBeenCalled();
    });

    it('swallows callback errors and continues notifying others', () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const throwingCallback = jest.fn(() => {
        throw new Error('boom');
      });
      const healthyCallback = jest.fn();

      localService.onDetection(throwingCallback);
      localService.onDetection(healthyCallback);

      localService.processNetworkName('test-network', 'DALnet');

      expect(throwingCallback).toHaveBeenCalled();
      expect(healthyCallback).toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith(
        'ServiceDetectionService: Error in detection callback:',
        expect.any(Error)
      );

      errorSpy.mockRestore();
    });
  });

  describe('getServiceConfig', () => {
    it('should return config for detected service type', () => {
      serviceDetectionService.initializeNetwork('test-network');
      serviceDetectionService.processNetworkName('test-network', 'DALnet');

      const config = serviceDetectionService.getServiceConfig('test-network');
      expect(config).toBeDefined();
      expect(config?.serviceType).toBe('dalnet');
    });

    it('should return undefined when no detection result', () => {
      const config = serviceDetectionService.getServiceConfig('unknown-network');
      expect(config).toBeUndefined();
    });
  });

  describe('cleanupNetwork', () => {
    it('should remove detection state for a network', () => {
      serviceDetectionService.initializeNetwork('test-network');
      serviceDetectionService.processNetworkName('test-network', 'DALnet');
      
      expect(serviceDetectionService.getDetectionResult('test-network')).toBeDefined();
      
      serviceDetectionService.cleanupNetwork('test-network');
      
      expect(serviceDetectionService.getDetectionResult('test-network')).toBeUndefined();
    });
  });

  describe('getAllCommands', () => {
    it('should return all available commands for detected service', () => {
      serviceDetectionService.initializeNetwork('test-network');
      serviceDetectionService.processNetworkName('test-network', 'DALnet');

      const commands = serviceDetectionService.getAllCommands('test-network');
      expect(Array.isArray(commands)).toBe(true);
      
      if (commands.length > 0) {
        expect(commands[0]).toHaveProperty('service');
        expect(commands[0]).toHaveProperty('command');
        expect(commands[0]).toHaveProperty('description');
      }
    });

    it('should return empty array when no detection result', () => {
      const commands = serviceDetectionService.getAllCommands('unknown-network');
      expect(commands).toEqual([]);
    });
  });

  describe('getServiceByNick', () => {
    it('returns a service definition for a detected network', () => {
      serviceDetectionService.processNetworkName('test-network', 'DALnet');

      const service = serviceDetectionService.getServiceByNick('test-network', 'NickServ');
      expect(service).toBeDefined();
      expect(service?.nick).toBe('NickServ');
      expect(Array.isArray(service?.commands)).toBe(true);
    });

    it('returns undefined when the network has no config or nick is unknown', () => {
      expect(serviceDetectionService.getServiceByNick('missing-network', 'NickServ')).toBeUndefined();

      serviceDetectionService.processNetworkName('test-network', 'DALnet');
      expect(serviceDetectionService.getServiceByNick('test-network', 'UnknownServ')).toBeUndefined();
    });
  });

  describe('detection precedence', () => {
    it('keeps a high-confidence detection instead of replacing it with a weaker one', () => {
      serviceDetectionService.processNetworkName('test-network', 'DALnet');
      const initialResult = serviceDetectionService.getDetectionResult('test-network');

      serviceDetectionService.processServiceMessage(
        'test-network',
        'NickServ',
        'Please register your nickname'
      );
      serviceDetectionService.processServiceMessage(
        'test-network',
        'ChanServ',
        'Please register your channel'
      );

      const finalResult = serviceDetectionService.getDetectionResult('test-network');
      expect(initialResult).toBeDefined();
      expect(finalResult).toEqual(initialResult);
    });
  });
});

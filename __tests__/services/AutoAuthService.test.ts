/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * AutoAuthService Unit Tests
 */

import { AutoAuthService, createAutoAuthService, AuthMethod, AuthResult } from '../../src/services/AutoAuthService';
import { serviceDetectionService } from '../../src/services/ServiceDetectionService';
import { IRCService } from '../../src/services/IRCService';

// Mock IRCService
const createMockIRCService = (): jest.Mocked<Partial<IRCService>> => ({
  sendRaw: jest.fn(),
  addRawMessage: jest.fn(),
  isSaslAvailable: jest.fn().mockReturnValue(true),
  isSaslAuthenticating: jest.fn().mockReturnValue(false),
  isSaslExternal: jest.fn().mockReturnValue(false),
  isSaslPlain: jest.fn().mockReturnValue(false),
  getSaslAccount: jest.fn().mockReturnValue(undefined),
  on: jest.fn().mockReturnValue(() => {}),
});

describe('AutoAuthService', () => {
  let mockIRCService: jest.Mocked<Partial<IRCService>>;

  beforeEach(() => {
    mockIRCService = createMockIRCService();
    serviceDetectionService.cleanupNetwork('test-network');
  });

  afterEach(() => {
    serviceDetectionService.cleanupNetwork('test-network');
  });

  describe('determineBestMethod', () => {
    it('should return sasl_external when certificate is available', () => {
      const service = createAutoAuthService({
        networkId: 'test-network',
        ircService: mockIRCService as IRCService,
        authConfig: {
          clientCert: '-----BEGIN CERTIFICATE-----',
          saslForce: false,
        },
        saslAvailable: true,
        saslAuthenticated: false,
      });

      const method = service.determineBestMethod();
      expect(method).toBe('sasl_external');
    });

    it('should return sasl_plain when account and password are available', () => {
      const service = createAutoAuthService({
        networkId: 'test-network',
        ircService: mockIRCService as IRCService,
        authConfig: {
          saslAccount: 'testuser',
          saslPassword: 'testpass',
        },
        saslAvailable: true,
        saslAuthenticated: false,
      });

      const method = service.determineBestMethod();
      expect(method).toBe('sasl_plain');
    });

    it('should return nickserv when only password is available', () => {
      const service = createAutoAuthService({
        networkId: 'test-network',
        ircService: mockIRCService as IRCService,
        authConfig: {
          nickservPassword: 'testpass',
        },
        saslAvailable: false,
        saslAuthenticated: false,
      });

      const method = service.determineBestMethod();
      expect(method).toBe('nickserv');
    });

    it('should return none when no credentials available', () => {
      const service = createAutoAuthService({
        networkId: 'test-network',
        ircService: mockIRCService as IRCService,
        authConfig: {},
        saslAvailable: false,
        saslAuthenticated: false,
      });

      const method = service.determineBestMethod();
      expect(method).toBe('none');
    });

    it('should detect quakenet from service detection', () => {
      serviceDetectionService.initializeNetwork('test-network');
      serviceDetectionService.processNetworkName('test-network', 'QuakeNet');

      const service = createAutoAuthService({
        networkId: 'test-network',
        ircService: mockIRCService as IRCService,
        authConfig: {
          nickservPassword: 'testpass',
        },
        saslAvailable: false,
        saslAuthenticated: false,
      });

      const method = service.determineBestMethod();
      expect(method).toBe('quakenet');
    });

    it('should detect undernet from service detection', () => {
      serviceDetectionService.initializeNetwork('test-network');
      serviceDetectionService.processNetworkName('test-network', 'Undernet');

      const service = createAutoAuthService({
        networkId: 'test-network',
        ircService: mockIRCService as IRCService,
        authConfig: {
          nickservPassword: 'testpass',
        },
        saslAvailable: false,
        saslAuthenticated: false,
      });

      const method = service.determineBestMethod();
      expect(method).toBe('undernet');
    });
  });

  describe('authenticate', () => {
    it('should not re-authenticate if already attempted', async () => {
      const service = createAutoAuthService({
        networkId: 'test-network',
        ircService: mockIRCService as IRCService,
        authConfig: {
          nickservPassword: 'testpass',
        },
        saslAvailable: false,
        saslAuthenticated: false,
      });

      // First attempt
      await service.authenticate();

      // Second attempt should fail
      const result = await service.authenticate();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Authentication already attempted');
    });

    it('should not authenticate if already authenticated via SASL', async () => {
      const service = createAutoAuthService({
        networkId: 'test-network',
        ircService: mockIRCService as IRCService,
        authConfig: {
          saslAccount: 'testuser',
          saslPassword: 'testpass',
        },
        saslAvailable: true,
        saslAuthenticated: true,
      });

      const result = await service.authenticate();
      expect(result.success).toBe(true);
      expect(result.method).toBe('sasl_plain');
    });

    it('should authenticate with NickServ', async () => {
      const service = createAutoAuthService({
        networkId: 'test-network',
        ircService: mockIRCService as IRCService,
        authConfig: {
          nickservPassword: 'testpass123',
        },
        saslAvailable: false,
        saslAuthenticated: false,
      });

      const result = await service.authenticate();
      
      expect(result.success).toBe(true);
      expect(result.method).toBe('nickserv');
      expect(mockIRCService.sendRaw).toHaveBeenCalledWith(
        expect.stringContaining('PRIVMSG')
      );
      expect(mockIRCService.sendRaw).toHaveBeenCalledWith(
        expect.stringContaining('IDENTIFY')
      );
    });

    it('should fail nickserv auth if no password', async () => {
      const service = createAutoAuthService({
        networkId: 'test-network',
        ircService: mockIRCService as IRCService,
        authConfig: {},
        saslAvailable: false,
        saslAuthenticated: false,
      });

      const result = await service.authenticate();
      
      expect(result.success).toBe(false);
      expect(result.method).toBe('none');
    });
  });

  describe('authenticateWithNickServ', () => {
    it('should send correct NickServ identify command', async () => {
      const service = createAutoAuthService({
        networkId: 'test-network',
        ircService: mockIRCService as IRCService,
        authConfig: {
          nickservPassword: 'mypassword',
        },
        saslAvailable: false,
        saslAuthenticated: false,
      });

      // @ts-ignore - accessing private method for testing
      const result = await service.authenticateWithNickServ();

      expect(result.success).toBe(true);
      expect(mockIRCService.sendRaw).toHaveBeenCalledWith(
        'PRIVMSG NickServ :IDENTIFY mypassword'
      );
    });
  });

  describe('authenticateWithQuakeNet', () => {
    it('should send correct Q auth command', async () => {
      const service = createAutoAuthService({
        networkId: 'test-network',
        ircService: mockIRCService as IRCService,
        authConfig: {
          nickservPassword: 'mypassword',
        },
        saslAvailable: false,
        saslAuthenticated: false,
      });

      // @ts-ignore - accessing private method for testing
      const result = await service.authenticateWithQuakeNet();

      expect(result.success).toBe(true);
      expect(mockIRCService.sendRaw).toHaveBeenCalledWith(
        expect.stringContaining('Q@CServe.quakenet.org')
      );
      expect(mockIRCService.sendRaw).toHaveBeenCalledWith(
        expect.stringContaining('AUTH')
      );
    });
  });

  describe('authenticateWithUndernet', () => {
    it('should send correct X login command', async () => {
      const service = createAutoAuthService({
        networkId: 'test-network',
        ircService: mockIRCService as IRCService,
        authConfig: {
          nickservPassword: 'mypassword',
        },
        saslAvailable: false,
        saslAuthenticated: false,
      });

      // @ts-ignore - accessing private method for testing
      const result = await service.authenticateWithUndernet();

      expect(result.success).toBe(true);
      expect(mockIRCService.sendRaw).toHaveBeenCalledWith(
        expect.stringContaining('X@channels.undernet.org')
      );
      expect(mockIRCService.sendRaw).toHaveBeenCalledWith(
        expect.stringContaining('LOGIN')
      );
    });
  });

  describe('isAuthenticated', () => {
    it('should return false before authentication', () => {
      const service = createAutoAuthService({
        networkId: 'test-network',
        ircService: mockIRCService as IRCService,
        authConfig: {
          nickservPassword: 'testpass',
        },
        saslAvailable: false,
        saslAuthenticated: false,
      });

      expect(service.isAuthenticated()).toBe(false);
    });

    it('should return true after successful authentication', async () => {
      const service = createAutoAuthService({
        networkId: 'test-network',
        ircService: mockIRCService as IRCService,
        authConfig: {
          nickservPassword: 'testpass',
        },
        saslAvailable: false,
        saslAuthenticated: false,
      });

      await service.authenticate();
      expect(service.isAuthenticated()).toBe(true);
    });

    it('should return true if authenticated via SASL', () => {
      const service = createAutoAuthService({
        networkId: 'test-network',
        ircService: mockIRCService as IRCService,
        authConfig: {},
        saslAvailable: true,
        saslAuthenticated: true,
      });

      expect(service.isAuthenticated()).toBe(true);
    });
  });

  describe('getStatus', () => {
    it('should return initial status', () => {
      const service = createAutoAuthService({
        networkId: 'test-network',
        ircService: mockIRCService as IRCService,
        authConfig: {
          nickservPassword: 'testpass',
        },
        saslAvailable: false,
        saslAuthenticated: false,
      });

      const status = service.getStatus();
      expect(status.attempted).toBe(false);
      expect(status.completed).toBe(false);
      expect(status.method).toBe('nickserv');
    });

    it('should return status after authentication', async () => {
      const service = createAutoAuthService({
        networkId: 'test-network',
        ircService: mockIRCService as IRCService,
        authConfig: {
          nickservPassword: 'testpass',
        },
        saslAvailable: false,
        saslAuthenticated: false,
      });

      await service.authenticate();
      const status = service.getStatus();
      
      expect(status.attempted).toBe(true);
      expect(status.completed).toBe(true);
    });
  });

  describe('updateSaslStatus', () => {
    it('should update SASL availability', () => {
      const service = createAutoAuthService({
        networkId: 'test-network',
        ircService: mockIRCService as IRCService,
        authConfig: {},
        saslAvailable: false,
        saslAuthenticated: false,
      });

      service.updateSaslStatus(true, false);
      const status = service.getStatus();
      
      // Method should now prefer SASL methods
      expect(status.method).toBe('none');
    });

    it('should mark as completed when SASL authenticates', () => {
      const service = createAutoAuthService({
        networkId: 'test-network',
        ircService: mockIRCService as IRCService,
        authConfig: {
          saslAccount: 'testuser',
          saslPassword: 'testpass',
        },
        saslAvailable: true,
        saslAuthenticated: false,
      });

      service.updateSaslStatus(true, true);
      expect(service.isAuthenticated()).toBe(true);
    });
  });

  describe('reset', () => {
    it('should reset authentication state', async () => {
      const service = createAutoAuthService({
        networkId: 'test-network',
        ircService: mockIRCService as IRCService,
        authConfig: {
          nickservPassword: 'testpass',
        },
        saslAvailable: false,
        saslAuthenticated: false,
      });

      await service.authenticate();
      expect(service.isAuthenticated()).toBe(true);

      service.reset();
      
      const status = service.getStatus();
      expect(status.attempted).toBe(false);
      expect(status.completed).toBe(false);
    });
  });

  describe('destroy', () => {
    it('should clean up without errors', () => {
      const service = createAutoAuthService({
        networkId: 'test-network',
        ircService: mockIRCService as IRCService,
        authConfig: {
          nickservPassword: 'testpass',
        },
        saslAvailable: false,
        saslAuthenticated: false,
      });

      expect(() => service.destroy()).not.toThrow();
    });
  });
});

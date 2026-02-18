/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for UserListCommands
 */

import {
  handleNOTIFY,
  handleUNNOTIFY,
  handleAUTOOP,
  handleUNAUTOOP,
  handleAUTOVOICE,
  handleUNAUTOVOICE,
  handleAUTOHALFOP,
  handleUNAUTOHALFOP,
  handlePROTECT,
  handleUNPROTECT,
  handleUSERLISTS,
  userListCommands,
} from '../../../../src/services/irc/sendCommands/UserListCommands';

// Mock UserManagementService
jest.mock('../../../../src/services/UserManagementService', () => ({
  UserListType: {
    NOTIFY: 'notify',
    AUTOOP: 'autoop',
    AUTOVOICE: 'autovoice',
    AUTOHALFOP: 'autohalfop',
    OTHER: 'other',
  },
}));

describe('UserListCommands', () => {
  let ctx: any;
  let addMessageMock: jest.Mock;
  let addUserListEntryMock: jest.Mock;
  let removeUserListEntryMock: jest.Mock;
  let findMatchingUserListEntryMock: jest.Mock;
  let getUserListEntriesMock: jest.Mock;

  beforeEach(() => {
    addMessageMock = jest.fn();
    addUserListEntryMock = jest.fn().mockResolvedValue(undefined);
    removeUserListEntryMock = jest.fn().mockResolvedValue(undefined);
    findMatchingUserListEntryMock = jest.fn().mockReturnValue(undefined);
    getUserListEntriesMock = jest.fn().mockReturnValue([]);

    ctx = {
      addMessage: addMessageMock,
      getUserManagementService: jest.fn().mockReturnValue({
        addUserListEntry: addUserListEntryMock,
        removeUserListEntry: removeUserListEntryMock,
        findMatchingUserListEntry: findMatchingUserListEntryMock,
        getUserListEntries: getUserListEntriesMock,
      }),
      getNetworkName: jest.fn().mockReturnValue('TestNetwork'),
    };
  });

  describe('Module exports', () => {
    it('exports all handlers', () => {
      expect(handleNOTIFY).toBeDefined();
      expect(handleUNNOTIFY).toBeDefined();
      expect(handleAUTOOP).toBeDefined();
      expect(handleUNAUTOOP).toBeDefined();
      expect(handleAUTOVOICE).toBeDefined();
      expect(handleUNAUTOVOICE).toBeDefined();
      expect(handleAUTOHALFOP).toBeDefined();
      expect(handleUNAUTOHALFOP).toBeDefined();
      expect(handlePROTECT).toBeDefined();
      expect(handleUNPROTECT).toBeDefined();
      expect(handleUSERLISTS).toBeDefined();
    });

    it('exports command registry', () => {
      expect(userListCommands).toBeDefined();
      expect(userListCommands.has('NOTIFY')).toBe(true);
      expect(userListCommands.has('AUTOOP')).toBe(true);
      expect(userListCommands.has('PROTECT')).toBe(true);
    });
  });

  describe('handleNOTIFY', () => {
    it('should show error when no nick provided', async () => {
      await handleNOTIFY(ctx, []);

      expect(addMessageMock).toHaveBeenCalledWith(expect.objectContaining({
        type: 'error',
        text: expect.stringContaining('Usage'),
      }));
    });

    it('should add nick to notify list', async () => {
      await handleNOTIFY(ctx, ['Friend']);

      expect(addUserListEntryMock).toHaveBeenCalledWith(
        'notify',
        'Friend!*@*',
        expect.objectContaining({
          network: 'TestNetwork',
          channels: undefined,
          protected: false,
        })
      );
      expect(addMessageMock).toHaveBeenCalledWith(expect.objectContaining({
        type: 'notice',
        text: expect.stringContaining('Added'),
      }));
    });

    it('should show error when user already in list', async () => {
      findMatchingUserListEntryMock.mockReturnValue({ mask: 'Friend!*@*' });

      await handleNOTIFY(ctx, ['Friend']);

      expect(addUserListEntryMock).not.toHaveBeenCalled();
      expect(addMessageMock).toHaveBeenCalledWith(expect.objectContaining({
        type: 'error',
        text: expect.stringContaining('already'),
      }));
    });

    it('should support full mask format', async () => {
      await handleNOTIFY(ctx, ['Friend!user@host.com']);

      expect(addUserListEntryMock).toHaveBeenCalledWith(
        'notify',
        'Friend!user@host.com',
        expect.any(Object)
      );
    });
  });

  describe('handleUNNOTIFY', () => {
    it('should show error when no nick provided', async () => {
      await handleUNNOTIFY(ctx, []);

      expect(addMessageMock).toHaveBeenCalledWith(expect.objectContaining({
        type: 'error',
      }));
    });

    it('should remove nick from notify list', async () => {
      getUserListEntriesMock.mockReturnValue([
        { mask: 'Friend!*@*', network: 'TestNetwork', protected: false, addedAt: Date.now() },
      ]);

      await handleUNNOTIFY(ctx, ['Friend']);

      expect(removeUserListEntryMock).toHaveBeenCalledWith('notify', 'Friend!*@*', 'TestNetwork');
      expect(addMessageMock).toHaveBeenCalledWith(expect.objectContaining({
        type: 'notice',
        text: expect.stringContaining('Removed'),
      }));
    });

    it('should show error when user not in list', async () => {
      getUserListEntriesMock.mockReturnValue([]);

      await handleUNNOTIFY(ctx, ['Unknown']);

      expect(removeUserListEntryMock).not.toHaveBeenCalled();
      expect(addMessageMock).toHaveBeenCalledWith(expect.objectContaining({
        type: 'error',
        text: expect.stringContaining('not in'),
      }));
    });
  });

  describe('handleAUTOOP', () => {
    it('should show error when no nick provided', async () => {
      await handleAUTOOP(ctx, []);

      expect(addMessageMock).toHaveBeenCalledWith(expect.objectContaining({
        type: 'error',
        text: expect.stringContaining('Usage'),
      }));
    });

    it('should add nick to autoop list without channel', async () => {
      await handleAUTOOP(ctx, ['TrustedUser']);

      expect(addUserListEntryMock).toHaveBeenCalledWith(
        'autoop',
        'TrustedUser!*@*',
        expect.objectContaining({
          network: 'TestNetwork',
          channels: undefined,
        })
      );
    });

    it('should add nick to autoop list with channel', async () => {
      await handleAUTOOP(ctx, ['TrustedUser', '#general']);

      expect(addUserListEntryMock).toHaveBeenCalledWith(
        'autoop',
        'TrustedUser!*@*',
        expect.objectContaining({
          channels: ['#general'],
        })
      );
    });
  });

  describe('handleUNAUTOOP', () => {
    it('should remove nick from autoop list', async () => {
      getUserListEntriesMock.mockReturnValue([
        { mask: 'TrustedUser!*@*', network: 'TestNetwork', protected: false, addedAt: Date.now() },
      ]);

      await handleUNAUTOOP(ctx, ['TrustedUser']);

      expect(removeUserListEntryMock).toHaveBeenCalledWith('autoop', 'TrustedUser!*@*', 'TestNetwork');
    });
  });

  describe('handleAUTOVOICE', () => {
    it('should add nick to autovoice list', async () => {
      await handleAUTOVOICE(ctx, ['Speaker']);

      expect(addUserListEntryMock).toHaveBeenCalledWith(
        'autovoice',
        'Speaker!*@*',
        expect.any(Object)
      );
    });

    it('should add nick with channel', async () => {
      await handleAUTOVOICE(ctx, ['Speaker', '#lobby']);

      expect(addUserListEntryMock).toHaveBeenCalledWith(
        'autovoice',
        'Speaker!*@*',
        expect.objectContaining({
          channels: ['#lobby'],
        })
      );
    });
  });

  describe('handleUNAUTOVOICE', () => {
    it('should remove nick from autovoice list', async () => {
      getUserListEntriesMock.mockReturnValue([
        { mask: 'Speaker!*@*', network: 'TestNetwork', protected: false, addedAt: Date.now() },
      ]);

      await handleUNAUTOVOICE(ctx, ['Speaker']);

      expect(removeUserListEntryMock).toHaveBeenCalledWith('autovoice', expect.any(String), 'TestNetwork');
    });
  });

  describe('handleAUTOHALFOP', () => {
    it('should add nick to autohalfop list', async () => {
      await handleAUTOHALFOP(ctx, ['Moderator']);

      expect(addUserListEntryMock).toHaveBeenCalledWith(
        'autohalfop',
        'Moderator!*@*',
        expect.any(Object)
      );
    });
  });

  describe('handleUNAUTOHALFOP', () => {
    it('should remove nick from autohalfop list', async () => {
      getUserListEntriesMock.mockReturnValue([
        { mask: 'Moderator!*@*', network: 'TestNetwork', protected: false, addedAt: Date.now() },
      ]);

      await handleUNAUTOHALFOP(ctx, ['Moderator']);

      expect(removeUserListEntryMock).toHaveBeenCalledWith('autohalfop', expect.any(String), 'TestNetwork');
    });
  });

  describe('handlePROTECT', () => {
    it('should show error when no nick provided', async () => {
      await handlePROTECT(ctx, []);

      expect(addMessageMock).toHaveBeenCalledWith(expect.objectContaining({
        type: 'error',
        text: expect.stringContaining('Usage'),
      }));
    });

    it('should add nick to protected list', async () => {
      findMatchingUserListEntryMock.mockReturnValue(undefined);

      await handlePROTECT(ctx, ['VIPUser']);

      expect(addUserListEntryMock).toHaveBeenCalledWith(
        'other',
        'VIPUser!*@*',
        expect.objectContaining({
          network: 'TestNetwork',
          protected: true,
          reason: 'Protected user',
        })
      );
      expect(addMessageMock).toHaveBeenCalledWith(expect.objectContaining({
        type: 'notice',
        text: expect.stringContaining('protected'),
      }));
    });

    it('should show error when user already protected', async () => {
      findMatchingUserListEntryMock.mockReturnValue({ mask: 'VIPUser!*@*', protected: true });

      await handlePROTECT(ctx, ['VIPUser']);

      expect(addUserListEntryMock).not.toHaveBeenCalled();
      expect(addMessageMock).toHaveBeenCalledWith(expect.objectContaining({
        type: 'error',
        text: expect.stringContaining('already protected'),
      }));
    });

    it('should add with channel when specified', async () => {
      findMatchingUserListEntryMock.mockReturnValue(undefined);

      await handlePROTECT(ctx, ['VIPUser', '#admin']);

      expect(addUserListEntryMock).toHaveBeenCalledWith(
        'other',
        'VIPUser!*@*',
        expect.objectContaining({
          channels: ['#admin'],
        })
      );
    });
  });

  describe('handleUNPROTECT', () => {
    it('should show error when no nick provided', async () => {
      await handleUNPROTECT(ctx, []);

      expect(addMessageMock).toHaveBeenCalledWith(expect.objectContaining({
        type: 'error',
      }));
    });

    it('should remove nick from protected list', async () => {
      getUserListEntriesMock.mockReturnValue([
        { mask: 'VIPUser!*@*', network: 'TestNetwork', protected: true, addedAt: Date.now() },
      ]);

      await handleUNPROTECT(ctx, ['VIPUser']);

      expect(removeUserListEntryMock).toHaveBeenCalledWith('other', expect.any(String), 'TestNetwork');
    });
  });

  describe('handleUSERLISTS', () => {
    it('should exist as a handler', () => {
      expect(handleUSERLISTS).toBeDefined();
      expect(typeof handleUSERLISTS).toBe('function');
    });

    it('should show notice when called', () => {
      handleUSERLISTS(ctx, []);

      expect(addMessageMock).toHaveBeenCalledWith(expect.objectContaining({
        type: 'notice',
        text: expect.stringContaining('Opening'),
      }));
    });

    // Note: Testing the UI store interaction would require more complex mocking
    // of the dynamic require in the handler. The core functionality is tested above.
  });

  describe('Mask handling', () => {
    it('should use provided mask as-is if it contains !', async () => {
      await handleNOTIFY(ctx, ['Custom!user@host.com']);

      expect(addUserListEntryMock).toHaveBeenCalledWith(
        'notify',
        'Custom!user@host.com',
        expect.any(Object)
      );
    });

    it('should create default mask for simple nick', async () => {
      await handleNOTIFY(ctx, ['SimpleNick']);

      expect(addUserListEntryMock).toHaveBeenCalledWith(
        'notify',
        'SimpleNick!*@*',
        expect.any(Object)
      );
    });
  });
});

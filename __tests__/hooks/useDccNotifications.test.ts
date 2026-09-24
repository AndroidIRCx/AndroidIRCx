/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for useDccNotifications hook
 */

import { renderHook } from '@testing-library/react-native';
import { useDccNotifications } from '../../src/hooks/useDccNotifications';

// Mock the services and modules used in the hook
jest.mock('../../src/services/DCCFileService', () => ({
  dccFileService: {
    onTransferUpdate: jest.fn().mockReturnValue(jest.fn()),
    list: jest.fn().mockReturnValue([]),
  },
}));

jest.mock('../../src/services/ScriptingService', () => ({
  scriptingService: {
    handleDccDisplay: jest.fn().mockResolvedValue({
      delivered: 0,
      failed: 0,
      hideDefaultRequestedBy: [],
      transformations: [],
    }),
  },
}));

jest.mock('../../src/stores/uiStore', () => ({
  useUIStore: {
    getState: jest.fn().mockReturnValue({
      dccTransfersMinimized: false,
      setDccTransfersMinimized: jest.fn(),
    }),
  },
}));

const mockAddMessage = jest.fn();
jest.mock('../../src/services/ConnectionManager', () => ({
  connectionManager: {
    getConnection: jest.fn(() => ({
      ircService: { addMessage: mockAddMessage },
    })),
    getActiveConnection: jest.fn(() => null),
  },
}));

jest.mock('../../src/stores/tabStore', () => ({
  useTabStore: {
    getState: jest.fn(() => ({
      getActiveTab: jest.fn(() => ({
        name: '#active',
        type: 'channel',
        networkId: 'net1',
      })),
    })),
  },
}));

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    createChannel: jest.fn().mockResolvedValue('dcc-transfers'),
    displayNotification: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('useDccNotifications', () => {
  const mockSafeAlert = jest.fn();
  const mockT = jest.fn(str => str);
  const mockSetDccTransfers = jest.fn();
  const mockIsMountedRef = { current: true };

  const defaultProps = {
    safeAlert: mockSafeAlert,
    t: mockT,
    setDccTransfers: mockSetDccTransfers,
    isMountedRef: mockIsMountedRef,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Set default mock implementations
    require('../../src/services/DCCFileService').dccFileService.list.mockReturnValue(
      [],
    );
    require('../../src/stores/uiStore').useUIStore.getState.mockReturnValue({
      dccTransfersMinimized: false,
      setDccTransfersMinimized: jest.fn(),
    });
  });

  it('should render without crashing', async () => {
    await renderHook(() => useDccNotifications(defaultProps));
  });

  it('should set up transfer update listener on mount', async () => {
    await renderHook(() => useDccNotifications(defaultProps));

    expect(
      require('../../src/services/DCCFileService').dccFileService
        .onTransferUpdate,
    ).toHaveBeenCalled();
  });

  it('should clean up transfer update listener on unmount', async () => {
    const mockUnsubscribe = jest.fn();
    require('../../src/services/DCCFileService').dccFileService.onTransferUpdate.mockReturnValue(
      mockUnsubscribe,
    );

    const { unmount } = await renderHook(() =>
      useDccNotifications(defaultProps),
    );

    await unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('should show alert when transfer completes', async () => {
    const mockUnsubscribe = jest.fn();
    const mockTransferCallback = jest.fn();
    require('../../src/services/DCCFileService').dccFileService.onTransferUpdate.mockImplementation(
      callback => {
        mockTransferCallback.mockImplementation(callback);
        return mockUnsubscribe;
      },
    );

    await renderHook(() => useDccNotifications(defaultProps));

    // Trigger the transfer update callback with completed status
    const completedTransfer = {
      status: 'completed',
      offer: { filename: 'test.txt' },
      bytesReceived: 1024,
    };

    await mockTransferCallback(completedTransfer);

    expect(mockSafeAlert).toHaveBeenCalledWith(
      'DCC Transfer Complete',
      '{filename} received ({bytes} bytes).',
    );
  });

  it('should show alert when transfer fails', async () => {
    const mockUnsubscribe = jest.fn();
    const mockTransferCallback = jest.fn();
    require('../../src/services/DCCFileService').dccFileService.onTransferUpdate.mockImplementation(
      callback => {
        mockTransferCallback.mockImplementation(callback);
        return mockUnsubscribe;
      },
    );

    await renderHook(() => useDccNotifications(defaultProps));

    // Trigger the transfer update callback with failed status
    const failedTransfer = {
      status: 'failed',
      error: 'Connection timeout',
    };

    await mockTransferCallback(failedTransfer);

    expect(mockSafeAlert).toHaveBeenCalledWith(
      'DCC Transfer Failed',
      'Connection timeout',
    );
  });

  it('should update transfers list when transfer status changes', async () => {
    const mockUnsubscribe = jest.fn();
    const mockTransferCallback = jest.fn();
    require('../../src/services/DCCFileService').dccFileService.onTransferUpdate.mockImplementation(
      callback => {
        mockTransferCallback.mockImplementation(callback);
        return mockUnsubscribe;
      },
    );

    await renderHook(() => useDccNotifications(defaultProps));

    // Trigger the transfer update callback
    const transfer = {
      status: 'completed',
      offer: { filename: 'test.txt' },
      bytesReceived: 1024,
    };

    await mockTransferCallback(transfer);

    expect(
      require('../../src/services/DCCFileService').dccFileService.list,
    ).toHaveBeenCalled();
    expect(mockSetDccTransfers).toHaveBeenCalled();
  });

  it('should send system notification when transfer completes and UI is minimized', async () => {
    const mockUnsubscribe = jest.fn();
    const mockTransferCallback = jest.fn();
    require('../../src/services/DCCFileService').dccFileService.onTransferUpdate.mockImplementation(
      callback => {
        mockTransferCallback.mockImplementation(callback);
        return mockUnsubscribe;
      },
    );

    // Mock UI store to return minimized state
    require('../../src/stores/uiStore').useUIStore.getState.mockReturnValue({
      dccTransfersMinimized: true,
      setDccTransfersMinimized: jest.fn(),
    });

    await renderHook(() => useDccNotifications(defaultProps));

    // Trigger the transfer update callback with completed status
    const completedTransfer = {
      status: 'completed',
      offer: { filename: 'test.txt' },
      bytesReceived: 1024,
    };

    await mockTransferCallback(completedTransfer);
    await new Promise(resolve => setTimeout(resolve, 0));

    // Check that notification was sent
    expect(
      require('@notifee/react-native').default.displayNotification,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'DCC Transfer Complete',
        body: '{filename} received ({bytes} bytes).',
      }),
    );
  });

  it('should send system notification when transfer fails and UI is minimized', async () => {
    const mockUnsubscribe = jest.fn();
    const mockTransferCallback = jest.fn();
    require('../../src/services/DCCFileService').dccFileService.onTransferUpdate.mockImplementation(
      callback => {
        mockTransferCallback.mockImplementation(callback);
        return mockUnsubscribe;
      },
    );

    // Mock UI store to return minimized state
    require('../../src/stores/uiStore').useUIStore.getState.mockReturnValue({
      dccTransfersMinimized: true,
      setDccTransfersMinimized: jest.fn(),
    });

    await renderHook(() => useDccNotifications(defaultProps));

    // Trigger the transfer update callback with failed status
    const failedTransfer = {
      status: 'failed',
      error: 'Connection timeout',
    };

    await mockTransferCallback(failedTransfer);
    await new Promise(resolve => setTimeout(resolve, 0));

    // Check that notification was sent
    expect(
      require('@notifee/react-native').default.displayNotification,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'DCC Transfer Failed',
        body: 'Connection timeout',
      }),
    );
  });

  it('should not send system notification when UI is not minimized', async () => {
    const mockUnsubscribe = jest.fn();
    const mockTransferCallback = jest.fn();
    require('../../src/services/DCCFileService').dccFileService.onTransferUpdate.mockImplementation(
      callback => {
        mockTransferCallback.mockImplementation(callback);
        return mockUnsubscribe;
      },
    );

    // Mock UI store to return non-minimized state
    require('../../src/stores/uiStore').useUIStore.getState.mockReturnValue({
      dccTransfersMinimized: false,
      setDccTransfersMinimized: jest.fn(),
    });

    await renderHook(() => useDccNotifications(defaultProps));

    // Trigger the transfer update callback with completed status
    const completedTransfer = {
      status: 'completed',
      offer: { filename: 'test.txt' },
      bytesReceived: 1024,
    };

    await mockTransferCallback(completedTransfer);

    // Check that notification was NOT sent
    expect(
      require('@notifee/react-native').default.displayNotification,
    ).not.toHaveBeenCalled();
  });

  it('should restore UI when all transfers complete and UI was minimized', async () => {
    const mockUnsubscribe = jest.fn();
    const mockTransferCallback = jest.fn();
    require('../../src/services/DCCFileService').dccFileService.onTransferUpdate.mockImplementation(
      callback => {
        mockTransferCallback.mockImplementation(callback);
        return mockUnsubscribe;
      },
    );

    // Mock UI store to return minimized state and setDccTransfersMinimized
    const mockSetDccTransfersMinimized = jest.fn();
    require('../../src/stores/uiStore').useUIStore.getState.mockReturnValue({
      dccTransfersMinimized: true,
      setDccTransfersMinimized: mockSetDccTransfersMinimized,
    });

    // Mock that there are no active transfers left
    require('../../src/services/DCCFileService').dccFileService.list.mockReturnValue(
      [],
    );

    await renderHook(() => useDccNotifications(defaultProps));

    // Trigger the transfer update callback
    const completedTransfer = {
      status: 'completed',
      offer: { filename: 'test.txt' },
      bytesReceived: 1024,
    };

    await mockTransferCallback(completedTransfer);

    // Check that UI was restored (minimized set to false)
    expect(mockSetDccTransfersMinimized).toHaveBeenCalledWith(false);
  });

  it('should not restore UI when there are still active transfers', async () => {
    const mockUnsubscribe = jest.fn();
    const mockTransferCallback = jest.fn();
    require('../../src/services/DCCFileService').dccFileService.onTransferUpdate.mockImplementation(
      callback => {
        mockTransferCallback.mockImplementation(callback);
        return mockUnsubscribe;
      },
    );

    // Mock UI store to return minimized state and setDccTransfersMinimized
    const mockSetDccTransfersMinimized = jest.fn();
    require('../../src/stores/uiStore').useUIStore.getState.mockReturnValue({
      dccTransfersMinimized: true,
      setDccTransfersMinimized: mockSetDccTransfersMinimized,
    });

    // Mock that there are still active transfers
    require('../../src/services/DCCFileService').dccFileService.list.mockReturnValue(
      [{ status: 'downloading', id: 'active-transfer' }],
    );

    await renderHook(() => useDccNotifications(defaultProps));

    // Trigger the transfer update callback
    const completedTransfer = {
      status: 'completed',
      offer: { filename: 'test.txt' },
      bytesReceived: 1024,
    };

    await mockTransferCallback(completedTransfer);

    // Check that UI was NOT restored since there are still active transfers
    expect(mockSetDccTransfersMinimized).not.toHaveBeenCalled();
  });

  it('should handle notification sending errors gracefully', async () => {
    // Mock notification service to throw an error
    require('@notifee/react-native').default.createChannel.mockRejectedValue(
      new Error('Notification error'),
    );

    const mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation();

    const mockUnsubscribe = jest.fn();
    const mockTransferCallback = jest.fn();
    require('../../src/services/DCCFileService').dccFileService.onTransferUpdate.mockImplementation(
      callback => {
        mockTransferCallback.mockImplementation(callback);
        return mockUnsubscribe;
      },
    );

    // Mock UI store to return minimized state
    require('../../src/stores/uiStore').useUIStore.getState.mockReturnValue({
      dccTransfersMinimized: true,
      setDccTransfersMinimized: jest.fn(),
    });

    await renderHook(() => useDccNotifications(defaultProps));

    // Trigger the transfer update callback with completed status
    const completedTransfer = {
      status: 'completed',
      offer: { filename: 'test.txt' },
      bytesReceived: 1024,
    };

    await mockTransferCallback(completedTransfer);

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mockConsoleWarn).toHaveBeenCalledWith(
      '[useDccNotifications] Failed to send notification:',
      expect.any(Error),
    );

    mockConsoleWarn.mockRestore();
  });

  it('can hide the default status and show addon replacements', async () => {
    let transferCallback: any;
    require('../../src/services/DCCFileService').dccFileService.onTransferUpdate.mockImplementation(
      callback => {
        transferCallback = callback;
        return jest.fn();
      },
    );
    const { scriptingService } = require('../../src/services/ScriptingService');
    scriptingService.handleDccDisplay.mockResolvedValueOnce({
      delivered: 1,
      failed: 0,
      hideDefaultRequestedBy: ['test.addon'],
      transformations: [
        {
          addonId: 'test.addon',
          result: {
            replacement: 'Custom transfer status',
            style: { role: 'success', bold: true },
            routeTo: { kind: 'channel', target: '#files', network: 'net1' },
          },
        },
      ],
    });
    await renderHook(() => useDccNotifications(defaultProps));

    await transferCallback({
      id: 'dcc-1',
      status: 'completed',
      offer: { filename: 'test.txt' },
      bytesReceived: 1024,
    });

    expect(mockSafeAlert).not.toHaveBeenCalled();
    expect(mockAddMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'notice',
        text: 'Custom transfer status',
        channel: '#files',
        addonDisplayStyle: { role: 'success', bold: true },
        addonDisplayProcessed: true,
      }),
    );
  });
});

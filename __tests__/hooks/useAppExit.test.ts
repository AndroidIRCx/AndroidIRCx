/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for useAppExit hook
 */

import { renderHook, act } from '@testing-library/react-hooks';
import { useAppExit } from '../../src/hooks/useAppExit';
import { Platform, BackHandler } from 'react-native';

// Mock services
jest.mock('../../src/services/SettingsService', () => ({
  settingsService: {
    getSetting: jest.fn().mockResolvedValue('Goodbye!'),
  },
  DEFAULT_QUIT_MESSAGE: 'Leaving',
}));

jest.mock('../../src/services/BackgroundService', () => ({
  backgroundService: {
    cleanup: jest.fn(),
  },
}));

jest.mock('../../src/services/MessageHistoryBatching', () => ({
  messageHistoryBatching: {
    flushSync: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
  },
  BackHandler: {
    exitApp: jest.fn(),
  },
}));

import { settingsService } from '../../src/services/SettingsService';
import { backgroundService } from '../../src/services/BackgroundService';
import { messageHistoryBatching } from '../../src/services/MessageHistoryBatching';

describe('useAppExit', () => {
  const mockSafeAlert = jest.fn();
  const mockDisconnect = jest.fn().mockResolvedValue(undefined);
  const mockGetActiveIRCService = jest.fn().mockReturnValue({
    disconnect: mockDisconnect,
  });
  const mockT = jest.fn((key: string) => key);

  const defaultProps = {
    isConnected: true,
    getActiveIRCService: mockGetActiveIRCService,
    safeAlert: mockSafeAlert,
    t: mockT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as any).OS = 'android';
  });

  it('should return handleExit function', () => {
    const { result } = renderHook(() => useAppExit(defaultProps));

    expect(result.current.handleExit).toBeDefined();
    expect(typeof result.current.handleExit).toBe('function');
  });

  it('should show exit confirmation alert', () => {
    const { result } = renderHook(() => useAppExit(defaultProps));

    act(() => {
      result.current.handleExit();
    });

    expect(mockSafeAlert).toHaveBeenCalledWith(
      'Exit Application',
      'Are you sure you want to exit? This will disconnect from the server.',
      expect.arrayContaining([
        expect.objectContaining({ text: 'Cancel', style: 'cancel' }),
        expect.objectContaining({ text: 'Exit', style: 'destructive' }),
      ]),
    );
  });

  it('should use t function for translations', () => {
    const { result } = renderHook(() => useAppExit(defaultProps));

    act(() => {
      result.current.handleExit();
    });

    expect(mockT).toHaveBeenCalledWith('Exit Application', expect.any(Object));
    expect(mockT).toHaveBeenCalledWith('Cancel', expect.any(Object));
    expect(mockT).toHaveBeenCalledWith('Exit', expect.any(Object));
  });

  it('should not call disconnect when not connected', async () => {
    const { result } = renderHook(() =>
      useAppExit({ ...defaultProps, isConnected: false }),
    );

    act(() => {
      result.current.handleExit();
    });

    // Get the onPress handler for Exit button
    const exitButton = mockSafeAlert.mock.calls[0][2].find(
      (btn: any) => btn.text === 'Exit',
    );

    await act(async () => {
      await exitButton.onPress();
    });

    expect(mockDisconnect).not.toHaveBeenCalled();
    expect(backgroundService.cleanup).toHaveBeenCalled();
  });

  it('should flush message history on exit', async () => {
    const { result } = renderHook(() => useAppExit(defaultProps));

    act(() => {
      result.current.handleExit();
    });

    const exitButton = mockSafeAlert.mock.calls[0][2].find(
      (btn: any) => btn.text === 'Exit',
    );

    await act(async () => {
      await exitButton.onPress();
    });

    expect(messageHistoryBatching.flushSync).toHaveBeenCalled();
  });

  it('should cleanup background service on exit', async () => {
    const { result } = renderHook(() => useAppExit(defaultProps));

    act(() => {
      result.current.handleExit();
    });

    const exitButton = mockSafeAlert.mock.calls[0][2].find(
      (btn: any) => btn.text === 'Exit',
    );

    await act(async () => {
      await exitButton.onPress();
    });

    expect(backgroundService.cleanup).toHaveBeenCalled();
  });

  it('should load custom quit message from settings', async () => {
    const { result } = renderHook(() => useAppExit(defaultProps));

    act(() => {
      result.current.handleExit();
    });

    const exitButton = mockSafeAlert.mock.calls[0][2].find(
      (btn: any) => btn.text === 'Exit',
    );

    await act(async () => {
      await exitButton.onPress();
    });

    expect(settingsService.getSetting).toHaveBeenCalledWith(
      'quitMessage',
      'Leaving',
    );
    expect(mockDisconnect).toHaveBeenCalledWith('Goodbye!');
  });

  it('should use default quit message when settings fail', async () => {
    (settingsService.getSetting as jest.Mock).mockResolvedValue(null);

    const { result } = renderHook(() => useAppExit(defaultProps));

    act(() => {
      result.current.handleExit();
    });

    const exitButton = mockSafeAlert.mock.calls[0][2].find(
      (btn: any) => btn.text === 'Exit',
    );

    await act(async () => {
      await exitButton.onPress();
    });

    expect(mockDisconnect).toHaveBeenCalledWith(null);
  });

  it('should exit app on Android after cleanup', async () => {
    (Platform as any).OS = 'android';
    const { result } = renderHook(() => useAppExit(defaultProps));

    act(() => {
      result.current.handleExit();
    });

    const exitButton = mockSafeAlert.mock.calls[0][2].find(
      (btn: any) => btn.text === 'Exit',
    );

    await act(async () => {
      await exitButton.onPress();
    });

    expect(BackHandler.exitApp).toHaveBeenCalled();
  });

  it('should show iOS close-from-switcher message instead of exiting app', async () => {
    (Platform as any).OS = 'ios';
    const { result } = renderHook(() => useAppExit(defaultProps));

    act(() => {
      result.current.handleExit();
    });

    const exitButton = mockSafeAlert.mock.calls[0][2].find(
      (btn: any) => btn.text === 'Exit',
    );

    await act(async () => {
      await exitButton.onPress();
    });

    expect(BackHandler.exitApp).not.toHaveBeenCalled();
    expect(mockSafeAlert).toHaveBeenCalledWith(
      'Disconnected',
      'You can now close the app from the app switcher.',
    );
  });

  it('should continue exit flow when flushSync fails', async () => {
    (messageHistoryBatching.flushSync as jest.Mock).mockRejectedValueOnce(
      new Error('flush failed'),
    );
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const { result } = renderHook(() => useAppExit(defaultProps));
    act(() => {
      result.current.handleExit();
    });

    const exitButton = mockSafeAlert.mock.calls[0][2].find(
      (btn: any) => btn.text === 'Exit',
    );

    await act(async () => {
      await exitButton.onPress();
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error flushing message history on exit:',
      expect.any(Error),
    );
    expect(backgroundService.cleanup).toHaveBeenCalled();
    expect(BackHandler.exitApp).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('should fallback to forced exit when disconnect throws', async () => {
    mockDisconnect.mockRejectedValueOnce(new Error('disconnect failed'));
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const { result } = renderHook(() => useAppExit(defaultProps));
    act(() => {
      result.current.handleExit();
    });

    const exitButton = mockSafeAlert.mock.calls[0][2].find(
      (btn: any) => btn.text === 'Exit',
    );

    await act(async () => {
      await exitButton.onPress();
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error during exit:',
      expect.any(Error),
    );
    expect(BackHandler.exitApp).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});

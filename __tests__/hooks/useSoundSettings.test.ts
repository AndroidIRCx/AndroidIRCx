/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for useSoundSettings hook
 */

import { renderHook, act } from '@testing-library/react-hooks';
import { useSoundSettings } from '../../src/hooks/useSoundSettings';

const mockSettings = {
  enabled: true,
  masterVolume: 0.8,
  playInForeground: true,
  playInBackground: false,
  activeSchemeId: 'default',
  events: {
    message: { enabled: true, useCustom: false, volume: 1.0 },
    join: { enabled: false, useCustom: false, volume: 0.5 },
  },
};

const mockSchemes = [
  { id: 'default', name: 'Default', description: 'Default sounds' },
  { id: 'custom1', name: 'Custom', description: 'Custom sounds' },
];

let listenerCallback: ((settings: any) => void) | null = null;

jest.mock('../../src/services/SoundService', () => ({
  soundService: {
    initialize: jest.fn().mockResolvedValue(undefined),
    getSettings: jest.fn(() => mockSettings),
    getSchemes: jest.fn(() => mockSchemes),
    getActiveScheme: jest.fn(() => mockSchemes[0]),
    addListener: jest.fn((cb: any) => {
      listenerCallback = cb;
      return jest.fn(() => {
        listenerCallback = null;
      });
    }),
    updateSettings: jest.fn().mockResolvedValue(undefined),
    setActiveScheme: jest.fn().mockResolvedValue(undefined),
    createScheme: jest.fn().mockResolvedValue({ id: 'new', name: 'New' }),
    deleteScheme: jest.fn().mockResolvedValue(undefined),
    updateEventConfig: jest.fn().mockResolvedValue(undefined),
    setCustomSound: jest.fn().mockResolvedValue(undefined),
    resetToDefault: jest.fn().mockResolvedValue(undefined),
    previewSound: jest.fn().mockResolvedValue(undefined),
    previewCustomSound: jest.fn().mockResolvedValue(undefined),
    stopSound: jest.fn().mockResolvedValue(undefined),
    resetAllToDefaults: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../src/types/sound', () => ({
  SoundEventType: { Message: 'message', Join: 'join' },
}));

import { soundService } from '../../src/services/SoundService';

const flushPromises = () =>
  act(async () => {
    await new Promise(r => setTimeout(r, 0));
  });

describe('useSoundSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listenerCallback = null;
  });

  it('should return initial settings', () => {
    const { result } = renderHook(() => useSoundSettings());

    expect(result.current.settings).toEqual(mockSettings);
    expect(result.current.schemes).toEqual(mockSchemes);
    expect(result.current.activeScheme).toEqual(mockSchemes[0]);
    expect(result.current.isLoading).toBe(true);
  });

  it('should initialize service and set loading to false', async () => {
    const { result } = renderHook(() => useSoundSettings());

    await flushPromises();

    expect(soundService.initialize).toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });

  it('should subscribe to settings changes', () => {
    renderHook(() => useSoundSettings());

    expect(soundService.addListener).toHaveBeenCalled();
  });

  it('should update settings when listener fires', async () => {
    const { result } = renderHook(() => useSoundSettings());

    await flushPromises();

    const newSettings = { ...mockSettings, enabled: false, masterVolume: 0.5 };

    act(() => {
      if (listenerCallback) {
        listenerCallback(newSettings);
      }
    });

    expect(result.current.settings).toEqual(newSettings);
  });

  it('should call setEnabled', async () => {
    const { result } = renderHook(() => useSoundSettings());

    await act(async () => {
      await result.current.setEnabled(false);
    });

    expect(soundService.updateSettings).toHaveBeenCalledWith({
      enabled: false,
    });
  });

  it('should call setMasterVolume with clamped value', async () => {
    const { result } = renderHook(() => useSoundSettings());

    await act(async () => {
      await result.current.setMasterVolume(1.5);
    });

    expect(soundService.updateSettings).toHaveBeenCalledWith({
      masterVolume: 1,
    });

    await act(async () => {
      await result.current.setMasterVolume(-0.5);
    });

    expect(soundService.updateSettings).toHaveBeenCalledWith({
      masterVolume: 0,
    });
  });

  it('should call setPlayInForeground', async () => {
    const { result } = renderHook(() => useSoundSettings());

    await act(async () => {
      await result.current.setPlayInForeground(false);
    });

    expect(soundService.updateSettings).toHaveBeenCalledWith({
      playInForeground: false,
    });
  });

  it('should call setPlayInBackground', async () => {
    const { result } = renderHook(() => useSoundSettings());

    await act(async () => {
      await result.current.setPlayInBackground(true);
    });

    expect(soundService.updateSettings).toHaveBeenCalledWith({
      playInBackground: true,
    });
  });

  it('should call setActiveScheme', async () => {
    const { result } = renderHook(() => useSoundSettings());

    await act(async () => {
      await result.current.setActiveScheme('custom1');
    });

    expect(soundService.setActiveScheme).toHaveBeenCalledWith('custom1');
  });

  it('should call createScheme', async () => {
    const { result } = renderHook(() => useSoundSettings());

    let scheme: any;
    await act(async () => {
      scheme = await result.current.createScheme('MyScheme', 'My description');
    });

    expect(soundService.createScheme).toHaveBeenCalledWith(
      'MyScheme',
      'My description',
    );
    expect(scheme).toEqual({ id: 'new', name: 'New' });
  });

  it('should call deleteScheme', async () => {
    const { result } = renderHook(() => useSoundSettings());

    await act(async () => {
      await result.current.deleteScheme('custom1');
    });

    expect(soundService.deleteScheme).toHaveBeenCalledWith('custom1');
  });

  it('should call setEventEnabled', async () => {
    const { result } = renderHook(() => useSoundSettings());

    await act(async () => {
      await result.current.setEventEnabled('message' as any, false);
    });

    expect(soundService.updateEventConfig).toHaveBeenCalledWith('message', {
      enabled: false,
    });
  });

  it('should call setEventVolume with clamped value', async () => {
    const { result } = renderHook(() => useSoundSettings());

    await act(async () => {
      await result.current.setEventVolume('message' as any, 2.0);
    });

    expect(soundService.updateEventConfig).toHaveBeenCalledWith('message', {
      volume: 1,
    });
  });

  it('should call setCustomSound', async () => {
    const { result } = renderHook(() => useSoundSettings());

    await act(async () => {
      await result.current.setCustomSound(
        'message' as any,
        '/path/to/sound.mp3',
      );
    });

    expect(soundService.setCustomSound).toHaveBeenCalledWith(
      'message',
      '/path/to/sound.mp3',
    );
  });

  it('should call resetEventToDefault', async () => {
    const { result } = renderHook(() => useSoundSettings());

    await act(async () => {
      await result.current.resetEventToDefault('join' as any);
    });

    expect(soundService.resetToDefault).toHaveBeenCalledWith('join');
  });

  it('should return event config or default', () => {
    const { result } = renderHook(() => useSoundSettings());

    const config = result.current.getEventConfig('message' as any);
    expect(config).toEqual({ enabled: true, useCustom: false, volume: 1.0 });

    const missing = result.current.getEventConfig('nonexistent' as any);
    expect(missing).toEqual({ enabled: false, useCustom: false, volume: 1.0 });
  });

  it('should call previewSound', async () => {
    const { result } = renderHook(() => useSoundSettings());

    await act(async () => {
      await result.current.previewSound('message' as any);
    });

    expect(soundService.previewSound).toHaveBeenCalledWith('message');
  });

  it('should call previewCustomSound', async () => {
    const { result } = renderHook(() => useSoundSettings());

    await act(async () => {
      await result.current.previewCustomSound('/path/to/custom.mp3');
    });

    expect(soundService.previewCustomSound).toHaveBeenCalledWith(
      '/path/to/custom.mp3',
    );
  });

  it('should call stopSound', async () => {
    const { result } = renderHook(() => useSoundSettings());

    await act(async () => {
      await result.current.stopSound();
    });

    expect(soundService.stopSound).toHaveBeenCalled();
  });

  it('should call resetAllToDefaults', async () => {
    const { result } = renderHook(() => useSoundSettings());

    await act(async () => {
      await result.current.resetAllToDefaults();
    });

    expect(soundService.resetAllToDefaults).toHaveBeenCalled();
  });

  it('should clean up listener on unmount', () => {
    const { unmount } = renderHook(() => useSoundSettings());

    unmount();

    const unsubscribeFn = (soundService.addListener as jest.Mock).mock
      .results[0]?.value;
    expect(unsubscribeFn).toHaveBeenCalled();
  });
});

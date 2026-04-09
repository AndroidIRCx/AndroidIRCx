/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for useTabEncryption hook
 */

// Ensure no global mocks interfere
jest.unmock('../../src/hooks/useTabEncryption');

import { renderHook } from '@testing-library/react-hooks';
import { useTabEncryption } from '../../src/hooks/useTabEncryption';

let alwaysEncryptCallback:
  | ((channel: string, network: string, value: boolean) => void)
  | null = null;

jest.mock('../../src/stores/tabStore', () => ({
  useTabStore: {
    getState: jest.fn(() => ({
      tabs: [
        {
          id: 'channel::net1::#secret',
          type: 'channel',
          name: '#secret',
          networkId: 'net1',
          isEncrypted: false,
          sendEncrypted: false,
        },
        {
          id: 'query::net1::Alice',
          type: 'query',
          name: 'Alice',
          networkId: 'net1',
          isEncrypted: false,
          sendEncrypted: false,
        },
        {
          id: 'server::net1',
          type: 'server',
          name: 'net1',
          networkId: 'net1',
        },
      ],
    })),
  },
}));

jest.mock('../../src/services/ChannelEncryptionService', () => ({
  channelEncryptionService: {
    hasChannelKey: jest.fn().mockResolvedValue(false),
  },
}));

jest.mock('../../src/services/EncryptedDMService', () => ({
  encryptedDMService: {
    isEncryptedForNetwork: jest.fn().mockResolvedValue(false),
  },
}));

jest.mock('../../src/services/ChannelEncryptionSettingsService', () => ({
  channelEncryptionSettingsService: {
    getAlwaysEncrypt: jest.fn().mockResolvedValue(false),
    onAlwaysEncryptChange: jest.fn((cb: any) => {
      alwaysEncryptCallback = cb;
      return jest.fn(() => {
        alwaysEncryptCallback = null;
      });
    }),
  },
}));

import { channelEncryptionService } from '../../src/services/ChannelEncryptionService';
import { encryptedDMService } from '../../src/services/EncryptedDMService';
import { channelEncryptionSettingsService } from '../../src/services/ChannelEncryptionSettingsService';
import { useTabStore } from '../../src/stores/tabStore';

describe('useTabEncryption', () => {
  const mockSetTabs = jest.fn();
  const mockTabsRef = { current: [] as any[] };

  beforeEach(() => {
    jest.clearAllMocks();
    alwaysEncryptCallback = null;
    mockTabsRef.current = (useTabStore.getState as jest.Mock)().tabs;
  });

  it('should not run reconciliation when disconnected', () => {
    renderHook(() =>
      useTabEncryption({
        isConnected: false,
        setTabs: mockSetTabs,
        tabsRef: mockTabsRef,
      }),
    );

    expect(channelEncryptionService.hasChannelKey).not.toHaveBeenCalled();
  });

  it('should check encryption keys when connected', async () => {
    const { waitForNextUpdate } = renderHook(() =>
      useTabEncryption({
        isConnected: true,
        setTabs: mockSetTabs,
        tabsRef: mockTabsRef,
      }),
    );

    // Wait for async reconciliation
    await waitForNextUpdate().catch(() => {});

    // Should check channel key for channel tab
    expect(channelEncryptionService.hasChannelKey).toHaveBeenCalledWith(
      '#secret',
      'net1',
    );
    // Should check DM encryption for query tab
    expect(encryptedDMService.isEncryptedForNetwork).toHaveBeenCalledWith(
      'net1',
      'Alice',
    );
  });

  it('should update tabs when channel has encryption key', async () => {
    (channelEncryptionService.hasChannelKey as jest.Mock).mockResolvedValue(
      true,
    );
    (
      channelEncryptionSettingsService.getAlwaysEncrypt as jest.Mock
    ).mockResolvedValue(true);

    const { waitForNextUpdate } = renderHook(() =>
      useTabEncryption({
        isConnected: true,
        setTabs: mockSetTabs,
        tabsRef: mockTabsRef,
      }),
    );

    await waitForNextUpdate().catch(() => {});

    // Should call setTabs with updated encryption flags
    expect(mockSetTabs).toHaveBeenCalled();
    const updatedTabs = mockSetTabs.mock.calls[0][0];
    const channelTab = updatedTabs.find((t: any) => t.type === 'channel');
    expect(channelTab.isEncrypted).toBe(true);
    expect(channelTab.sendEncrypted).toBe(true);
  });

  it('should update query tabs when DM encryption bundle exists', async () => {
    (encryptedDMService.isEncryptedForNetwork as jest.Mock).mockResolvedValue(
      true,
    );
    (
      channelEncryptionSettingsService.getAlwaysEncrypt as jest.Mock
    ).mockResolvedValue(true);

    const { waitForNextUpdate } = renderHook(() =>
      useTabEncryption({
        isConnected: true,
        setTabs: mockSetTabs,
        tabsRef: mockTabsRef,
      }),
    );

    await waitForNextUpdate().catch(() => {});

    expect(mockSetTabs).toHaveBeenCalled();
    const updatedTabs = mockSetTabs.mock.calls[0][0];
    const queryTab = updatedTabs.find((t: any) => t.type === 'query');
    expect(queryTab.isEncrypted).toBe(true);
    expect(queryTab.sendEncrypted).toBe(true);
  });

  it('should not update tabs when nothing changed', async () => {
    // All defaults are false, tabs already have false -> no change
    (channelEncryptionService.hasChannelKey as jest.Mock).mockResolvedValue(
      false,
    );
    (encryptedDMService.isEncryptedForNetwork as jest.Mock).mockResolvedValue(
      false,
    );

    renderHook(() =>
      useTabEncryption({
        isConnected: true,
        setTabs: mockSetTabs,
        tabsRef: mockTabsRef,
      }),
    );

    // Give async operations time to complete
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(mockSetTabs).not.toHaveBeenCalled();
  });

  it('should subscribe to always encrypt changes', () => {
    renderHook(() =>
      useTabEncryption({
        isConnected: true,
        setTabs: mockSetTabs,
        tabsRef: mockTabsRef,
      }),
    );

    expect(
      channelEncryptionSettingsService.onAlwaysEncryptChange,
    ).toHaveBeenCalled();
  });

  it('should handle always encrypt change for matching channel', async () => {
    (channelEncryptionService.hasChannelKey as jest.Mock).mockResolvedValue(
      true,
    );

    renderHook(() =>
      useTabEncryption({
        isConnected: true,
        setTabs: mockSetTabs,
        tabsRef: mockTabsRef,
      }),
    );

    // Reset from initial reconciliation
    mockSetTabs.mockClear();

    // Trigger always encrypt change
    if (alwaysEncryptCallback) {
      await alwaysEncryptCallback('#secret', 'net1', true);
    }

    expect(mockSetTabs).toHaveBeenCalled();
    const updatedTabs = mockSetTabs.mock.calls[0][0];
    const channelTab = updatedTabs.find((t: any) => t.name === '#secret');
    expect(channelTab.sendEncrypted).toBe(true);
  });

  it('should not update tabs for non-matching channel in always encrypt change', async () => {
    renderHook(() =>
      useTabEncryption({
        isConnected: true,
        setTabs: mockSetTabs,
        tabsRef: mockTabsRef,
      }),
    );

    mockSetTabs.mockClear();

    // Trigger change for a different channel
    if (alwaysEncryptCallback) {
      await alwaysEncryptCallback('#other', 'net1', true);
    }

    expect(mockSetTabs).not.toHaveBeenCalled();
  });

  it('should disable sendEncrypted when always encrypt is off and no key', async () => {
    (channelEncryptionService.hasChannelKey as jest.Mock).mockResolvedValue(
      false,
    );

    // Set tab to have sendEncrypted true initially
    (useTabStore.getState as jest.Mock).mockReturnValue({
      tabs: [
        {
          id: 'channel::net1::#secret',
          type: 'channel',
          name: '#secret',
          networkId: 'net1',
          isEncrypted: true,
          sendEncrypted: true,
        },
      ],
    });

    const { waitForNextUpdate } = renderHook(() =>
      useTabEncryption({
        isConnected: true,
        setTabs: mockSetTabs,
        tabsRef: mockTabsRef,
      }),
    );

    await waitForNextUpdate().catch(() => {});

    expect(mockSetTabs).toHaveBeenCalled();
    const updatedTabs = mockSetTabs.mock.calls[0][0];
    const channelTab = updatedTabs[0];
    expect(channelTab.isEncrypted).toBe(false);
    expect(channelTab.sendEncrypted).toBe(false);
  });

  it('should clean up listeners on unmount', () => {
    const { unmount } = renderHook(() =>
      useTabEncryption({
        isConnected: true,
        setTabs: mockSetTabs,
        tabsRef: mockTabsRef,
      }),
    );

    unmount();

    const unsubscribeFn = (
      channelEncryptionSettingsService.onAlwaysEncryptChange as jest.Mock
    ).mock.results[0]?.value;
    expect(unsubscribeFn).toHaveBeenCalled();
  });
});

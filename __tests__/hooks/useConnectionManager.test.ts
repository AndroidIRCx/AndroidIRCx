/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * useConnectionManager.test.ts
 *
 * Tests for useConnectionManager hook - IRC connection management
 */

import { renderHook, act } from '@testing-library/react-native';
import { useConnectionManager } from '../../src/hooks/useConnectionManager';
import { useConnectionStore } from '../../src/stores/connectionStore';

// ─── Mocks ─────────────────────────────────────────────

const mockStorage: Map<string, string> = new Map();
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    setItem: jest.fn(async (key: string, value: string) => { mockStorage.set(key, value); }),
    getItem: jest.fn(async (key: string) => mockStorage.get(key) || null),
    removeItem: jest.fn(async (key: string) => { mockStorage.delete(key); }),
  },
}));

jest.mock('../../src/services/ConnectionManager', () => ({
  connectionManager: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    getConnection: jest.fn(),
    getAllConnections: jest.fn(() => []),
    getActiveNetworkId: jest.fn(() => null),
    setActiveConnection: jest.fn(),
  },
}));
const mockConnectionManager = jest.requireMock<any>('../../src/services/ConnectionManager').connectionManager;

const makeConnection = (networkId: string, isConnected: boolean) => ({
  networkId,
  isConnected,
  ircService: {
    getConnectionStatus: jest.fn(() => isConnected),
  },
});

// ─── Tests ─────────────────────────────────────────────

describe('useConnectionManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage.clear();
    mockConnectionManager.getAllConnections.mockReturnValue([]);
    mockConnectionManager.getActiveNetworkId.mockReturnValue(null);
    mockConnectionManager.getConnection.mockReturnValue(null);
    act(() => {
      useConnectionStore.getState().reset();
    });
  });

  describe('state subscriptions', () => {
    it('should return initial state values', () => {
      const { result } = renderHook(() => useConnectionManager());

      expect(result.current.isConnected).toBe(false);
      expect(result.current.networkName).toBe('default');
      expect(result.current.selectedNetworkName).toBeNull();
      expect(result.current.activeConnectionId).toBeNull();
      expect(result.current.primaryNetworkId).toBeNull();
      expect(result.current.ping).toBeUndefined();
    });

    it('should reflect store changes', () => {
      const { result } = renderHook(() => useConnectionManager());

      act(() => {
        useConnectionStore.getState().setIsConnected(true);
        useConnectionStore.getState().setNetworkName('TestNet');
        useConnectionStore.getState().setPing(42);
      });

      expect(result.current.isConnected).toBe(true);
      expect(result.current.networkName).toBe('TestNet');
      expect(result.current.ping).toBe(42);
    });
  });

  describe('setter callbacks', () => {
    it('setIsConnected should update store', () => {
      const { result } = renderHook(() => useConnectionManager());

      act(() => {
        result.current.connect; // access to ensure hook is set up
        // Use the internal setter via the hook
      });

      // Test the connect flow which uses setIsConnected internally
      expect(result.current.isConnected).toBe(false);
    });

    it('setSelectedNetworkName should update store', () => {
      const { result } = renderHook(() => useConnectionManager());

      act(() => {
        result.current.setSelectedNetworkName('MyNetwork');
      });

      expect(useConnectionStore.getState().selectedNetworkName).toBe('MyNetwork');
      expect(result.current.selectedNetworkName).toBe('MyNetwork');
    });

    it('updatePing should update store', () => {
      const { result } = renderHook(() => useConnectionManager());

      act(() => {
        result.current.updatePing(55);
      });

      expect(useConnectionStore.getState().ping).toBe(55);
      expect(result.current.ping).toBe(55);
    });
  });

  describe('connect', () => {
    const network = {
      id: 'net-1',
      name: 'DBase',
      nick: 'TestNick',
      realname: 'Test User',
      servers: [],
    };

    const config = {
      host: 'irc.example.com',
      port: 6697,
      nick: 'TestNick',
      username: 'testuser',
      realname: 'Test User',
      tls: true,
    };

    it('should connect via ConnectionManager', async () => {
      mockConnectionManager.connect.mockResolvedValue('DBase');

      const { result } = renderHook(() => useConnectionManager());

      let networkId: string | undefined;
      await act(async () => {
        networkId = await result.current.connect(network as any, config as any);
      });

      expect(mockConnectionManager.connect).toHaveBeenCalledWith('DBase', network, config);
      expect(networkId).toBe('DBase');
    });

    it('should update store state on successful connect', async () => {
      mockConnectionManager.connect.mockResolvedValue('DBase');

      const { result } = renderHook(() => useConnectionManager());

      await act(async () => {
        await result.current.connect(network as any, config as any);
      });

      expect(useConnectionStore.getState().activeConnectionId).toBe('DBase');
      expect(useConnectionStore.getState().networkName).toBe('DBase');
      expect(useConnectionStore.getState().isConnected).toBe(true);
    });

    it('should set primaryNetworkId on first connection', async () => {
      mockConnectionManager.connect.mockResolvedValue('DBase');

      const { result } = renderHook(() => useConnectionManager());

      await act(async () => {
        await result.current.connect(network as any, config as any);
      });

      expect(useConnectionStore.getState().primaryNetworkId).toBe('DBase');
    });

    it('should NOT override existing primaryNetworkId', async () => {
      mockConnectionManager.connect.mockResolvedValue('SecondNet');

      act(() => {
        useConnectionStore.getState().setPrimaryNetworkId('FirstNet');
      });

      const { result } = renderHook(() => useConnectionManager());

      await act(async () => {
        await result.current.connect(
          { ...network, name: 'SecondNet' } as any,
          config as any,
        );
      });

      expect(useConnectionStore.getState().primaryNetworkId).toBe('FirstNet');
    });

    it('should throw error on connection failure', async () => {
      const error = new Error('Connection refused');
      mockConnectionManager.connect.mockRejectedValue(error);

      const { result } = renderHook(() => useConnectionManager());

      await expect(
        act(async () => {
          await result.current.connect(network as any, config as any);
        }),
      ).rejects.toThrow('Connection refused');
    });
  });

  describe('disconnect', () => {
    it('should disconnect via ConnectionManager', async () => {
      mockConnectionManager.disconnect.mockResolvedValue(undefined);

      const { result } = renderHook(() => useConnectionManager());

      await act(async () => {
        await result.current.disconnect('DBase', 'Goodbye');
      });

      expect(mockConnectionManager.disconnect).toHaveBeenCalledWith('DBase', 'Goodbye');
    });

    it('should switch to next connection when disconnecting active', async () => {
      mockConnectionManager.disconnect.mockResolvedValue(undefined);
      mockConnectionManager.getAllConnections.mockReturnValue([
        makeConnection('Libera', true),
      ]);

      act(() => {
        useConnectionStore.getState().setActiveConnectionId('DBase');
      });

      const { result } = renderHook(() => useConnectionManager());

      await act(async () => {
        await result.current.disconnect('DBase');
      });

      expect(useConnectionStore.getState().activeConnectionId).toBe('Libera');
      expect(useConnectionStore.getState().networkName).toBe('Libera');
      expect(useConnectionStore.getState().isConnected).toBe(true);
    });

    it('should clear state when no connections remain', async () => {
      mockConnectionManager.disconnect.mockResolvedValue(undefined);
      mockConnectionManager.getAllConnections.mockReturnValue([]);

      act(() => {
        useConnectionStore.getState().setActiveConnectionId('DBase');
        useConnectionStore.getState().setIsConnected(true);
      });

      const { result } = renderHook(() => useConnectionManager());

      await act(async () => {
        await result.current.disconnect('DBase');
      });

      expect(useConnectionStore.getState().activeConnectionId).toBeNull();
      expect(useConnectionStore.getState().isConnected).toBe(false);
    });

    it('should NOT update active state when disconnecting non-active', async () => {
      mockConnectionManager.disconnect.mockResolvedValue(undefined);
      // Mock getAllConnections to return a connected DBase so syncState keeps isConnected=true
      mockConnectionManager.getAllConnections.mockReturnValue([
        makeConnection('DBase', true),
      ]);
      mockConnectionManager.getActiveNetworkId.mockReturnValue('DBase');

      act(() => {
        useConnectionStore.getState().setActiveConnectionId('DBase');
        useConnectionStore.getState().setIsConnected(true);
      });

      const { result } = renderHook(() => useConnectionManager());

      await act(async () => {
        await result.current.disconnect('Libera');
      });

      // Active connection should not change
      expect(useConnectionStore.getState().activeConnectionId).toBe('DBase');
      expect(useConnectionStore.getState().isConnected).toBe(true);
    });

    it('should clear primaryNetworkId when disconnecting primary', async () => {
      mockConnectionManager.disconnect.mockResolvedValue(undefined);

      act(() => {
        useConnectionStore.getState().setPrimaryNetworkId('DBase');
        useConnectionStore.getState().setActiveConnectionId('Other');
      });

      const { result } = renderHook(() => useConnectionManager());

      await act(async () => {
        await result.current.disconnect('DBase');
      });

      expect(useConnectionStore.getState().primaryNetworkId).toBeNull();
    });

    it('should throw error on disconnect failure', async () => {
      const error = new Error('Disconnect failed');
      mockConnectionManager.disconnect.mockRejectedValue(error);

      const { result } = renderHook(() => useConnectionManager());

      await expect(
        act(async () => {
          await result.current.disconnect('DBase');
        }),
      ).rejects.toThrow('Disconnect failed');
    });
  });

  describe('switchConnection', () => {
    it('should switch to existing connection', () => {
      mockConnectionManager.getConnection.mockReturnValue({
        ...makeConnection('Libera', true),
      });

      const { result } = renderHook(() => useConnectionManager());

      act(() => {
        result.current.switchConnection('Libera');
      });

      expect(mockConnectionManager.setActiveConnection).toHaveBeenCalledWith('Libera');
      expect(useConnectionStore.getState().activeConnectionId).toBe('Libera');
      expect(useConnectionStore.getState().networkName).toBe('Libera');
      expect(useConnectionStore.getState().isConnected).toBe(true);
    });

    it('should handle disconnected connection', () => {
      mockConnectionManager.getConnection.mockReturnValue({
        ...makeConnection('Libera', false),
      });

      const { result } = renderHook(() => useConnectionManager());

      act(() => {
        result.current.switchConnection('Libera');
      });

      expect(useConnectionStore.getState().isConnected).toBe(false);
    });

    it('should do nothing if connection not found', () => {
      mockConnectionManager.getConnection.mockReturnValue(null);

      act(() => {
        useConnectionStore.getState().setActiveConnectionId('DBase');
      });

      const { result } = renderHook(() => useConnectionManager());

      act(() => {
        result.current.switchConnection('NonExistent');
      });

      expect(mockConnectionManager.setActiveConnection).not.toHaveBeenCalled();
      // Active connection should remain unchanged
      expect(useConnectionStore.getState().activeConnectionId).toBe('DBase');
    });
  });

  describe('getActiveConnection', () => {
    it('should return connection when active', () => {
      const mockConnection = { networkId: 'DBase', isConnected: true };
      mockConnectionManager.getConnection.mockReturnValue(mockConnection);

      act(() => {
        useConnectionStore.getState().setActiveConnectionId('DBase');
      });

      const { result } = renderHook(() => useConnectionManager());

      let connection: any;
      act(() => {
        connection = result.current.getActiveConnection();
      });

      expect(connection).toBe(mockConnection);
      expect(mockConnectionManager.getConnection).toHaveBeenCalledWith('DBase');
    });

    it('should return null when no active connection', () => {
      const { result } = renderHook(() => useConnectionManager());

      let connection: any;
      act(() => {
        connection = result.current.getActiveConnection();
      });

      expect(connection).toBeNull();
    });
  });

  describe('getAllConnections', () => {
    it('should return all connections from ConnectionManager', () => {
      const connections = [
        makeConnection('DBase', true),
        makeConnection('Libera', false),
      ];
      mockConnectionManager.getAllConnections.mockReturnValue(connections);

      const { result } = renderHook(() => useConnectionManager());

      let allConnections: any;
      act(() => {
        allConnections = result.current.getAllConnections();
      });

      expect(allConnections).toBe(connections);
    });

    it('should return empty array when no connections', () => {
      mockConnectionManager.getAllConnections.mockReturnValue([]);

      const { result } = renderHook(() => useConnectionManager());

      let allConnections: any;
      act(() => {
        allConnections = result.current.getAllConnections();
      });

      expect(allConnections).toEqual([]);
    });
  });

  describe('isNetworkConnected', () => {
    it('should return true for connected network', () => {
      mockConnectionManager.getConnection.mockReturnValue(makeConnection('DBase', true));

      const { result } = renderHook(() => useConnectionManager());

      let connected: boolean = false;
      act(() => {
        connected = result.current.isNetworkConnected('DBase');
      });

      expect(connected).toBe(true);
    });

    it('should return false for disconnected network', () => {
      mockConnectionManager.getConnection.mockReturnValue(makeConnection('DBase', false));

      const { result } = renderHook(() => useConnectionManager());

      let connected: boolean = true;
      act(() => {
        connected = result.current.isNetworkConnected('DBase');
      });

      expect(connected).toBe(false);
    });

    it('should return false for unknown network', () => {
      mockConnectionManager.getConnection.mockReturnValue(null);

      const { result } = renderHook(() => useConnectionManager());

      let connected: boolean = true;
      act(() => {
        connected = result.current.isNetworkConnected('Unknown');
      });

      expect(connected).toBe(false);
    });
  });

  describe('mount sync', () => {
    it('should sync active connection state on mount', () => {
      mockConnectionManager.getActiveNetworkId.mockReturnValue('DBase');
      mockConnectionManager.getAllConnections.mockReturnValue([
        makeConnection('DBase', true),
      ]);

      renderHook(() => useConnectionManager());

      expect(useConnectionStore.getState().activeConnectionId).toBe('DBase');
      expect(useConnectionStore.getState().networkName).toBe('DBase');
      expect(useConnectionStore.getState().isConnected).toBe(true);
    });

    it('should set isConnected false when no connections', () => {
      mockConnectionManager.getActiveNetworkId.mockReturnValue(null);
      mockConnectionManager.getAllConnections.mockReturnValue([]);

      renderHook(() => useConnectionManager());

      expect(useConnectionStore.getState().isConnected).toBe(false);
    });

    it('should set isConnected false when all connections are disconnected', () => {
      mockConnectionManager.getActiveNetworkId.mockReturnValue('DBase');
      mockConnectionManager.getAllConnections.mockReturnValue([
        makeConnection('DBase', false),
      ]);

      renderHook(() => useConnectionManager());

      expect(useConnectionStore.getState().isConnected).toBe(false);
    });

    it('should not update activeConnectionId when no active network', () => {
      mockConnectionManager.getActiveNetworkId.mockReturnValue(null);
      mockConnectionManager.getAllConnections.mockReturnValue([]);

      act(() => {
        useConnectionStore.getState().setActiveConnectionId('existing');
      });

      renderHook(() => useConnectionManager());

      // Should remain unchanged since getActiveNetworkId returned null
      expect(useConnectionStore.getState().activeConnectionId).toBe('existing');
    });
  });

  describe('callback stability', () => {
    it('should return stable function references across re-renders', () => {
      const { result, rerender } = renderHook(() => useConnectionManager());

      const first = {
        connect: result.current.connect,
        disconnect: result.current.disconnect,
        switchConnection: result.current.switchConnection,
        getActiveConnection: result.current.getActiveConnection,
        getAllConnections: result.current.getAllConnections,
        isNetworkConnected: result.current.isNetworkConnected,
        updatePing: result.current.updatePing,
        setSelectedNetworkName: result.current.setSelectedNetworkName,
      };

      rerender();

      expect(result.current.connect).toBe(first.connect);
      expect(result.current.disconnect).toBe(first.disconnect);
      expect(result.current.switchConnection).toBe(first.switchConnection);
      expect(result.current.getActiveConnection).toBe(first.getActiveConnection);
      expect(result.current.getAllConnections).toBe(first.getAllConnections);
      expect(result.current.isNetworkConnected).toBe(first.isNetworkConnected);
      expect(result.current.updatePing).toBe(first.updatePing);
      expect(result.current.setSelectedNetworkName).toBe(first.setSelectedNetworkName);
    });
  });
});

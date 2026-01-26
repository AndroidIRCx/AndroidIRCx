import { useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { settingsService } from '../services/SettingsService';
import { channelFavoritesService } from '../services/ChannelFavoritesService';

interface UseAutoJoinChannelsParams {
  isConnected: boolean;
  activeConnectionId: string | null;
  selectedNetworkName: string | null;
  getActiveIRCService: () => any;
  motdCompleteRef: MutableRefObject<Set<string>>;
  motdSignal: number;
}

export const useAutoJoinChannels = (params: UseAutoJoinChannelsParams) => {
  const {
    isConnected,
    activeConnectionId,
    selectedNetworkName,
    getActiveIRCService,
    motdCompleteRef,
    motdSignal,
  } = params;

  const [autoJoinAttempted, setAutoJoinAttempted] = useState(false);
  const [autoJoinFavoritesEnabled, setAutoJoinFavoritesEnabled] = useState(true);
  const [motdFallbackSignal, setMotdFallbackSignal] = useState(0);
  const motdFallbackReadyRef = useRef<Set<string>>(new Set());
  const motdFallbackTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    settingsService
      .getSetting('autoJoinFavorites', true)
      .then(value => setAutoJoinFavoritesEnabled(value !== false));
  }, []);

  useEffect(() => {
    return () => {
      Object.values(motdFallbackTimersRef.current).forEach(timer => clearTimeout(timer));
      motdFallbackTimersRef.current = {};
    };
  }, []);

  useEffect(() => {
    setAutoJoinAttempted(false);
    motdFallbackReadyRef.current.clear();
    Object.values(motdFallbackTimersRef.current).forEach(timer => clearTimeout(timer));
    motdFallbackTimersRef.current = {};
  }, [activeConnectionId]);

  useEffect(() => {
    const handleAutoJoin = async () => {
      const activeIRCService = getActiveIRCService();
      // Check if connected and registered, and auto-join hasn't been attempted yet for this connection
      const activeNetId = activeConnectionId || selectedNetworkName;
      if (isConnected && activeIRCService.isRegistered() && !autoJoinAttempted && activeNetId) {
        const motdReady =
          motdCompleteRef.current.has(activeNetId) ||
          motdFallbackReadyRef.current.has(activeNetId);
        if (!motdReady) {
          if (!motdFallbackTimersRef.current[activeNetId]) {
            motdFallbackTimersRef.current[activeNetId] = setTimeout(() => {
              motdFallbackReadyRef.current.add(activeNetId);
              setMotdFallbackSignal(signal => signal + 1);
            }, 4000);
          }
          return; // wait for MOTD to complete (or fallback timeout)
        }
        setAutoJoinAttempted(true); // Mark as attempted

        const networks = await settingsService.loadNetworks();
        const exactMatch = networks.find(n => n.id === activeNetId || n.name === activeNetId) || null;
        const normalizedId = activeNetId.replace(/\s+\(\d+\)$/, '');
        const networkConfig = exactMatch || networks.find(
          n => n.id === normalizedId || n.name === normalizedId
        ) || null;
        const favoritesNetworkName = networkConfig?.name || activeNetId;
        const favorites = autoJoinFavoritesEnabled
          ? channelFavoritesService.getFavorites(favoritesNetworkName) // join all favorites when enabled
          : [];
        const favoriteNames = favorites.map(f => f.name);
        const autoJoin = networkConfig?.autoJoinChannels || [];

        // If identity profile exists, assume NickServ identify done before we join (after MOTD)
        const channelsToJoin = Array.from(new Set([...favoriteNames, ...autoJoin]));
        channelsToJoin.forEach(channel => {
          const favorite = favorites.find(f => f.name === channel);
          activeIRCService.joinChannel(channel, favorite?.key);
        });
      }
    };

    handleAutoJoin();

    // Reset autoJoinAttempted when disconnected
    if (!isConnected) {
      setAutoJoinAttempted(false);
      const activeNetId = activeConnectionId || selectedNetworkName;
      if (activeNetId) {
        motdFallbackReadyRef.current.delete(activeNetId);
        const timer = motdFallbackTimersRef.current[activeNetId];
        if (timer) {
          clearTimeout(timer);
          delete motdFallbackTimersRef.current[activeNetId];
        }
      }
    }
  }, [
    activeConnectionId,
    autoJoinAttempted,
    autoJoinFavoritesEnabled,
    getActiveIRCService,
    isConnected,
    motdFallbackSignal,
    motdSignal,
    motdCompleteRef,
    selectedNetworkName,
  ]);
};

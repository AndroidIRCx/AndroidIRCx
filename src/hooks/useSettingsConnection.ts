import { useState, useEffect, useCallback } from 'react';
import { settingsService, IRCNetworkConfig } from '../services/SettingsService';
import { autoReconnectService, AutoReconnectConfig } from '../services/AutoReconnectService';
import { connectionQualityService, RateLimitConfig, FloodProtectionConfig, LagMonitoringConfig } from '../services/ConnectionQualityService';
import { bouncerService, BouncerConfig } from '../services/BouncerService';

export interface UseSettingsConnectionReturn {
  // Networks
  networks: IRCNetworkConfig[];
  
  // Auto reconnect
  autoReconnectConfig: AutoReconnectConfig | null;
  
  // Connection quality
  rateLimitConfig: RateLimitConfig | null;
  floodProtectionConfig: FloodProtectionConfig | null;
  lagMonitoringConfig: LagMonitoringConfig | null;
  connectionStats: any;
  
  // Bouncer
  bouncerConfig: BouncerConfig | null;
  bouncerInfo: any;
  
  // Actions
  refreshNetworks: () => Promise<void>;
  updateAutoReconnectConfig: (config: Partial<AutoReconnectConfig>) => Promise<void>;
  updateRateLimitConfig: (config: Partial<RateLimitConfig>) => Promise<void>;
  updateFloodProtectionConfig: (config: Partial<FloodProtectionConfig>) => Promise<void>;
  updateLagMonitoringConfig: (config: Partial<LagMonitoringConfig>) => Promise<void>;
  updateBouncerConfig: (config: Partial<BouncerConfig>) => Promise<void>;
}

export const useSettingsConnection = (): UseSettingsConnectionReturn => {
  const [networks, setNetworks] = useState<IRCNetworkConfig[]>([]);
  const [autoReconnectConfig, setAutoReconnectConfig] = useState<AutoReconnectConfig | null>(null);
  const [rateLimitConfig, setRateLimitConfig] = useState<RateLimitConfig | null>(null);
  const [floodProtectionConfig, setFloodProtectionConfig] = useState<FloodProtectionConfig | null>(null);
  const [lagMonitoringConfig, setLagMonitoringConfig] = useState<LagMonitoringConfig | null>(null);
  const [connectionStats, setConnectionStats] = useState<any>(null);
  const [bouncerConfig, setBouncerConfig] = useState<BouncerConfig | null>(null);
  const [bouncerInfo, setBouncerInfo] = useState<any>(null);

  // Load initial state
  useEffect(() => {
    const loadSettings = async () => {
      const loadedNetworks = await settingsService.loadNetworks();
      setNetworks(loadedNetworks);
      
      const reconnectConfig = autoReconnectService.getConfig();
      setAutoReconnectConfig(reconnectConfig);
      
      const rateLimit = connectionQualityService.getRateLimitConfig();
      setRateLimitConfig(rateLimit);
      
      const floodProtection = connectionQualityService.getFloodProtectionConfig();
      setFloodProtectionConfig(floodProtection);
      
      const lagMonitoring = connectionQualityService.getLagMonitoringConfig();
      setLagMonitoringConfig(lagMonitoring);
      
      const stats = connectionQualityService.getStatistics();
      setConnectionStats(stats);
      
      const bouncer = bouncerService.getConfig();
      setBouncerConfig(bouncer);
      
      const bouncerInfoData = bouncerService.getBouncerInfo();
      setBouncerInfo(bouncerInfoData);
    };
    loadSettings();
    
    // Update statistics periodically
    const statsInterval = setInterval(() => {
      const stats = connectionQualityService.getStatistics();
      setConnectionStats(stats);
      const bouncerInfoData = bouncerService.getBouncerInfo();
      setBouncerInfo(bouncerInfoData);
    }, 1000);
    
    return () => {
      clearInterval(statsInterval);
    };
  }, []);

  const refreshNetworks = useCallback(async () => {
    const loadedNetworks = await settingsService.loadNetworks();
    setNetworks(loadedNetworks);
  }, []);

  const updateAutoReconnectConfig = useCallback(async (config: Partial<AutoReconnectConfig>) => {
    await autoReconnectService.setConfig({ ...autoReconnectConfig!, ...config });
    setAutoReconnectConfig(autoReconnectService.getConfig());
  }, [autoReconnectConfig]);

  const updateRateLimitConfig = useCallback(async (config: Partial<RateLimitConfig>) => {
    await connectionQualityService.setRateLimitConfig({ ...rateLimitConfig!, ...config });
    setRateLimitConfig(connectionQualityService.getRateLimitConfig());
  }, [rateLimitConfig]);

  const updateFloodProtectionConfig = useCallback(async (config: Partial<FloodProtectionConfig>) => {
    await connectionQualityService.setFloodProtectionConfig({ ...floodProtectionConfig!, ...config });
    setFloodProtectionConfig(connectionQualityService.getFloodProtectionConfig());
  }, [floodProtectionConfig]);

  const updateLagMonitoringConfig = useCallback(async (config: Partial<LagMonitoringConfig>) => {
    await connectionQualityService.setLagMonitoringConfig({ ...lagMonitoringConfig!, ...config });
    setLagMonitoringConfig(connectionQualityService.getLagMonitoringConfig());
  }, [lagMonitoringConfig]);

  const updateBouncerConfig = useCallback(async (config: Partial<BouncerConfig>) => {
    await bouncerService.setConfig({ ...bouncerConfig!, ...config });
    setBouncerConfig(bouncerService.getConfig());
  }, [bouncerConfig]);

  return {
    networks,
    autoReconnectConfig,
    rateLimitConfig,
    floodProtectionConfig,
    lagMonitoringConfig,
    connectionStats,
    bouncerConfig,
    bouncerInfo,
    refreshNetworks,
    updateAutoReconnectConfig,
    updateRateLimitConfig,
    updateFloodProtectionConfig,
    updateLagMonitoringConfig,
    updateBouncerConfig,
  };
};

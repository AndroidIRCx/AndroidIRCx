/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * React Hook for IRC Service Commands
 * Provides UI integration for service commands and auto-completion
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ServiceCommand,
  DetectionResult,
  CompletionContext,
  AccessLevel,
} from '../interfaces/ServiceTypes';
import { serviceDetectionService } from '../services/ServiceDetectionService';
import {
  serviceCommandProvider,
  CommandSuggestion,
  CommandExecutionResult,
} from '../services/ServiceCommandProvider';
import { useTabStore } from '../stores/tabStore';

interface UseServiceCommandsParams {
  /** Network ID */
  networkId: string;
  /** Current channel (if any) */
  currentChannel?: string;
  /** User's access level (default: 'user') */
  userLevel?: AccessLevel;
  /** Whether user is authenticated with services */
  isAuthenticated?: boolean;
}

interface UseServiceCommandsReturn {
  // Detection state
  /** Whether service detection has completed */
  isDetected: boolean;
  /** Detection result (undefined if not detected yet) */
  detectionResult?: DetectionResult;
  /** Detected service type name */
  serviceTypeName: string;
  
  // Commands
  /** All available commands for this network */
  availableCommands: ServiceCommand[];
  /** Safe aliases for this network */
  safeAliases: Array<{ alias: string; command: string; description: string }>;
  /** Get suggestions for a query */
  getSuggestions: (query: string) => CommandSuggestion[];
  /** Find a specific command */
  findCommand: (query: string) => { command: ServiceCommand; serviceNick: string } | undefined;
  
  // Command execution
  /** Build a command string for execution */
  buildCommand: (commandName: string, args: string[]) => CommandExecutionResult;
  /** Parse user input to check if it's a service command */
  parseInput: (input: string) => {
    isServiceCommand: boolean;
    serviceNick?: string;
    command?: string;
    args: string[];
  };
  /** Get help text for a command */
  getCommandHelp: (commandName: string) => string | undefined;
  
  // IRCd info
  /** Available user modes */
  userModes: string[];
  /** Available channel modes */
  channelModes: string[];
  /** Available oper commands */
  operCommands: string[];
  
  // Service nicks
  /** Check if a nick is a service */
  isServiceNick: (nick: string) => boolean;
  /** Get service by nick */
  getServiceByNick: (nick: string) => { nick: string; commands: ServiceCommand[] } | undefined;
}

/**
 * React hook for IRC service commands
 * Integrates service detection and command provider with React UI
 */
export function useServiceCommands(params: UseServiceCommandsParams): UseServiceCommandsReturn {
  const { networkId, currentChannel, userLevel = 'user', isAuthenticated = false } = params;
  
  // Detection state
  const [detectionResult, setDetectionResult] = useState<DetectionResult | undefined>(
    serviceDetectionService.getDetectionResult(networkId)
  );
  
  // Use ref for callbacks to avoid re-subscription
  const contextRef = useRef<CompletionContext>({
    availableChannels: [],
    availableNicks: [],
    userLevel,
    isAuthenticated,
  });
  
  // Update context ref when values change
  useEffect(() => {
    contextRef.current = {
      currentChannel,
      currentNetwork: networkId,
      availableChannels: [],
      availableNicks: [],
      userLevel,
      isAuthenticated,
    };
  }, [currentChannel, networkId, userLevel, isAuthenticated]);

  // Subscribe to detection events
  useEffect(() => {
    // Initialize detection for this network
    if (!serviceDetectionService.getDetectionResult(networkId)) {
      serviceDetectionService.initializeNetwork(networkId);
    }

    // Subscribe to detection events
    const unsubscribe = serviceDetectionService.onDetection((detectedNetworkId, result) => {
      if (detectedNetworkId === networkId) {
        setDetectionResult(result);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [networkId]);

  // Get available channels from store
  const tabs = useTabStore((state) => state.tabs);
  const availableChannels = useMemo(() => {
    return tabs
      .filter(t => t.type === 'channel' && t.networkId === networkId)
      .map(t => t.name);
  }, [tabs, networkId]);

  // Update available channels in context
  useEffect(() => {
    contextRef.current.availableChannels = availableChannels;
  }, [availableChannels]);

  // Derived state
  const isDetected = !!detectionResult;
  
  const serviceTypeName = useMemo(() => {
    if (!detectionResult) return 'Detecting...';
    
    const names: Record<string, string> = {
      anope: 'Anope Services',
      atheme: 'Atheme Services',
      dalnet: 'DALnet Services',
      undernet: 'Undernet X',
      quakenet: 'QuakeNet Q',
      generic: 'Generic Services',
    };
    
    return names[detectionResult.serviceType] || detectionResult.serviceType;
  }, [detectionResult]);

  // Get all available commands
  const availableCommands = useMemo(() => {
    const commands = serviceCommandProvider.getCommands(networkId);
    return commands.map(c => c.command);
  }, [networkId, detectionResult]);

  // Get safe aliases
  const safeAliases = useMemo(() => {
    return serviceCommandProvider.getSafeAliases(networkId);
  }, [networkId, detectionResult]);

  // Get IRCd info
  const ircdInfo = useMemo(() => {
    return serviceCommandProvider.getIRCdInfo(networkId);
  }, [networkId, detectionResult]);

  // Callback: Get suggestions
  const getSuggestions = useCallback((query: string): CommandSuggestion[] => {
    return serviceCommandProvider.getSuggestions(
      networkId,
      query,
      contextRef.current
    );
  }, [networkId]);

  // Callback: Find command
  const findCommand = useCallback((query: string) => {
    const result = serviceCommandProvider.findCommand(networkId, query);
    if (!result) return undefined;
    
    return {
      command: result.command,
      serviceNick: result.serviceNick,
    };
  }, [networkId]);

  // Callback: Build command
  const buildCommand = useCallback((commandName: string, args: string[]) => {
    return serviceCommandProvider.buildCommand(networkId, commandName, args);
  }, [networkId]);

  // Callback: Parse input
  const parseInput = useCallback((input: string) => {
    return serviceCommandProvider.parseInput(input);
  }, []);

  // Callback: Get command help
  const getCommandHelp = useCallback((commandName: string) => {
    return serviceCommandProvider.getCommandHelp(networkId, commandName);
  }, [networkId]);

  // Callback: Check if nick is service
  const isServiceNick = useCallback((nick: string) => {
    return serviceDetectionService.isServiceNick(nick);
  }, []);

  // Callback: Get service by nick
  const getServiceByNick = useCallback((nick: string) => {
    const service = serviceDetectionService.getServiceByNick(networkId, nick);
    if (!service) return undefined;
    
    return {
      nick: service.nick,
      commands: service.commands || [],
    };
  }, [networkId]);

  return {
    // Detection state
    isDetected,
    detectionResult,
    serviceTypeName,
    
    // Commands
    availableCommands,
    safeAliases,
    getSuggestions,
    findCommand,
    
    // Command execution
    buildCommand,
    parseInput,
    getCommandHelp,
    
    // IRCd info
    userModes: ircdInfo?.userModes || [],
    channelModes: ircdInfo?.channelModes || [],
    operCommands: ircdInfo?.operCommands || [],
    
    // Service nicks
    isServiceNick,
    getServiceByNick,
  };
}

/**
 * Hook to check if services are available for a network
 */
export function useServicesAvailable(networkId: string): boolean {
  const [isAvailable, setIsAvailable] = useState(() => {
    const result = serviceDetectionService.getDetectionResult(networkId);
    return result !== undefined && result.serviceType !== 'generic';
  });

  useEffect(() => {
    const unsubscribe = serviceDetectionService.onDetection((detectedNetworkId, result) => {
      if (detectedNetworkId === networkId) {
        setIsAvailable(result.serviceType !== 'generic');
      }
    });

    return () => unsubscribe();
  }, [networkId]);

  return isAvailable;
}

/**
 * Hook to get service type for a network
 */
export function useServiceType(networkId: string): string {
  const [serviceType, setServiceType] = useState(() => {
    const result = serviceDetectionService.getDetectionResult(networkId);
    return result?.serviceType || 'unknown';
  });

  useEffect(() => {
    const unsubscribe = serviceDetectionService.onDetection((detectedNetworkId, result) => {
      if (detectedNetworkId === networkId) {
        setServiceType(result.serviceType);
      }
    });

    return () => unsubscribe();
  }, [networkId]);

  return serviceType;
}

export default useServiceCommands;

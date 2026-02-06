/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Types for IRC service modules
 * Extracted from IRCService.ts for modular architecture
 */

import type { IRCMessage } from '../IRCService';

/**
 * Context provided to numeric handlers for accessing IRCService functionality
 */
export interface NumericHandlerContext {
  // State accessors
  getCurrentNick: () => string;
  getNetworkName: () => string;
  isServerOper: () => boolean;

  // State mutators
  setRegistered: (value: boolean) => void;
  setCurrentNick: (nick: string) => void;
  setServerOper: (value: boolean) => void;
  updateSelfUserModes: (modes: string) => void;

  // Messaging
  addMessage: (message: Partial<IRCMessage> & { type: string; timestamp: number }) => void;
  addRawMessage: (text: string, category: string) => void;

  // Events
  emit: (event: string, ...args: any[]) => void;

  // Commands
  sendCommand: (command: string) => void;
  sendRaw: (command: string) => void;

  // Logging
  logRaw: (message: string) => void;

  // Channel/User management
  getChannelUsers: (channel: string) => Map<string, any> | undefined;
  setChannelUsers: (channel: string, users: Map<string, any>) => void;
  emitUserListChange: (channel: string, users: any[]) => void;
  parseUserWithPrefixes: (userStr: string) => any | null;
  requestChatHistory: (target: string, limit?: number, before?: string) => void;

  // Channel topic state
  getChannelTopicInfo: (channel: string) => any;
  setChannelTopicInfo: (channel: string, info: any) => void;
  maybeEmitChannelIntro: (channel: string, timestamp: number) => void;
  removeUserFromChannel: (channel: string, nick: string) => void;

  // WHOIS state
  getWhoisTarget: () => string | null;
  setWhoisTarget: (nick: string | null) => void;
  getWhoisData: () => Map<string, any>;

  // WHOWAS state
  getWhowasTarget: () => string | null;
  setWhowasTarget: (nick: string | null) => void;
  getWhowasAt: () => number;
  setWhowasAt: (time: number) => void;

  // Silent mode (for suppressing output)
  isSilentModeNick: (nick: string) => boolean;
  isSilentWhoNick: (nick: string) => boolean;
  getSilentWhoCallback: (nick: string) => ((user: string, host: string) => void) | undefined;
  removeSilentModeNick: (nick: string) => void;
  removeSilentWhoNick: (nick: string) => void;
  removeSilentWhoCallback: (nick: string) => void;

  // Channel list
  getChannelListBuffer: () => any[];
  clearChannelListBuffer: () => void;
  addToChannelListBuffer: (entry: any) => void;

  // Links list
  getLinksBuffer: () => any[];
  clearLinksBuffer: () => void;
  addToLinksBuffer: (entry: any) => void;

  // Stats buffer
  getStatsBuffer: () => string[];
  clearStatsBuffer: () => void;
  addToStatsBuffer: (line: string) => void;

  // Ban list
  getBanListBuffer: () => Map<string, any[]>;
  clearBanListBuffer: (channel: string) => void;
  addToBanListBuffer: (channel: string, entry: any) => void;

  // Invite/Except list
  getInviteListBuffer: () => Map<string, any[]>;
  getExceptListBuffer: () => Map<string, any[]>;
  clearInviteListBuffer: (channel: string) => void;
  clearExceptListBuffer: (channel: string) => void;
  addToInviteListBuffer: (channel: string, entry: any) => void;
  addToExceptListBuffer: (channel: string, entry: any) => void;

  // Names reply accumulator
  getNamesBuffer: () => Map<string, Set<string>>;
  clearNamesBuffer: (channel: string) => void;
  addToNamesBuffer: (channel: string, names: string[]) => void;

  // SASL state
  getSaslMechanism: () => string | null;
  setSaslMechanism: (mechanism: string | null) => void;
  getSaslState: () => string;
  setSaslState: (state: string) => void;

  // Monitor state
  getMonitoredNicks: () => Set<string>;

  // SASL state
  getSaslAuthenticating: () => boolean;
  setSaslAuthenticating: (value: boolean) => void;
  endCAPNegotiation: () => void;

  // Nick state (for 433 nick in use)
  getAltNick: () => string | null;
  getNickChangeAttempts: () => number;
  incrementNickChangeAttempts: () => void;
  setCurrentNick: (nick: string) => void;

  // Utility methods
  logRaw: (message: string) => void;
  sendRaw: (command: string) => void;
  addRawMessage: (text: string, category: string) => void;
  disconnect: (reason?: string) => void;

  // Capabilities
  hasCapability: (cap: string) => boolean;

  // Config
  getConfig: () => any;
}

/**
 * Type for a numeric handler function
 */
export type NumericHandler = (
  ctx: NumericHandlerContext,
  prefix: string,
  params: string[],
  timestamp: number
) => void;

/**
 * Registry of numeric handlers by numeric code
 */
export type NumericHandlerRegistry = Map<number, NumericHandler>;

/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { IRCMessage } from '../IRCService';

/**
 * Context provided to command handlers for accessing IRCService functionality
 */
export interface CommandHandlerContext {
  // Messaging
  addMessage: (
    message: Partial<IRCMessage> & { type: string; timestamp: number },
    batchTag?: string
  ) => void;
  addRawMessage: (text: string, category: string, timestamp?: number) => void;

  // Events
  emit: (event: string, ...args: any[]) => void;

  // Utilities
  extractNick: (prefix: string) => string;
  parseCTCP: (message: string) => { isCTCP: boolean; command?: string; args?: string };
  getNetworkName: () => string;
  getCurrentNick: () => string;
  getUserManagementService: () => any;
  getProtectionTabContext: (target: string, from: string, isChannel: boolean) => any;
  handleProtectionBlock: (kind: string, nick: string, username?: string, hostname?: string, channel?: string | null) => void;
  extractMaskFromNotice: (text: string) => { nick: string; username?: string; hostname?: string } | null;
  runBlacklistAction: (entry: any, context: any) => void;
  logRaw: (message: string) => void;
  handleServerError: (errorText: string) => void;
  decodeIfBase64Like: (value: string) => string;
  handleBatchStart: (refTag: string, type: string, params: string[], timestamp: number) => void;
  handleBatchEnd: (refTag: string, timestamp: number) => void;
  handleCAPCommand: (params: string[]) => void;

  // Channel topic/mode state
  getChannelTopicInfo: (channel: string) => any;
  setChannelTopicInfo: (channel: string, info: any) => void;
  maybeEmitChannelIntro: (channel: string, timestamp: number) => void;
  handleChannelModeChange: (channel: string, modeParams: string[]) => void;
  updateSelfUserModes: (modeString: string) => void;
  getChannelUsers: (channel: string) => Map<string, any> | undefined;
  updateChannelUserList: (channel: string) => void;
  getAllChannelUsers: () => Map<string, Map<string, any>>;
  getCurrentNick: () => string;
  setCurrentNick: (nick: string) => void;
  getNetworkName: () => string;
  hasUser: (channel: string, nick: string) => boolean;
  setUser: (channel: string, nick: string, user: any) => void;
  getUser: (channel: string, nick: string) => any | undefined;
  ensureChannelUsersMap: (channel: string) => Map<string, any>;
  runBlacklistCheckForJoin: (nick: string, username?: string, hostname?: string, channel?: string) => void;
  runAutoModeCheckForJoin: (nick: string, username?: string, hostname?: string, channel?: string) => void;
  isExtendedJoinEnabled: () => boolean;
  emitJoinedChannel: (channel: string) => void;
  addPendingChannelIntro: (channel: string) => void;
  emitPart: (channel: string, nick: string) => void;
  emitConnection: (connected: boolean) => void;
  handleKillDisconnect: (reason: string) => void;

  // SASL
  sendSASLCredentials: () => void;
  setSaslAuthenticating: (value: boolean) => void;
  getSaslMechanism?: () => string | null;
  getSaslState?: () => string;
  handleScramServerFirst?: (message: string) => void;
  handleScramServerFinal?: (message: string) => void;

  // PRIVMSG support
  sendRaw: (command: string) => void;
  handleCTCPRequest: (from: string, target: string, command: string, args?: string) => void;
  isUserIgnored: (nick: string, username?: string, hostname?: string, network?: string) => boolean;
  isUserProtected: (nick: string, username?: string, hostname?: string, network?: string) => boolean;
  evaluateProtectionDecision: (
    message: { type: string; channel: string; from: string; text: string; timestamp: number; network: string; username?: string; hostname?: string },
    context: { isActiveTab: boolean; isQueryOpen: boolean; isChannel: boolean; isCtcp: boolean },
  ) => { kind: string } | null;
  handleMultilineMessage: (
    from: string, target: string, text: string, concatTag: string | undefined,
    otherTags: { timestamp: number; account?: string; msgid?: string; channelContext?: string; replyTo?: string },
  ) => string | null;
  getEncryptedDMService: () => any;
  getChannelEncryptionService: () => any;
}

/**
 * Type for a command handler function
 */
export type CommandHandler = (
  ctx: CommandHandlerContext,
  prefix: string,
  params: string[],
  timestamp: number,
  meta?: {
    batchTag?: string;
    accountTag?: string;
    msgidTag?: string;
    channelContextTag?: string;
    replyTag?: string;
    reactTag?: string;
    typingTag?: string;
    multilineConcatTag?: string;
    intentTag?: string;
  }
) => void;

/**
 * Registry of command handlers by command name
 */
export type CommandHandlerRegistry = Map<string, CommandHandler>;

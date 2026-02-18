/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * IRC Numeric Handlers Coordinator
 *
 * This module coordinates all numeric reply handlers extracted from IRCService.
 * It provides a context bridge that allows handlers to access IRCService functionality
 * without direct coupling.
 *
 * Usage:
 *   const handlers = new IRCNumericHandlers(ircService);
 *   handlers.handle(numeric, prefix, params, timestamp);
 */

import type { NumericHandlerContext, NumericHandler } from './types';
import { registrationHandlers } from './numerics/RegistrationNumerics';
import { traceHandlers } from './numerics/TraceNumerics';
import { lusersHandlers } from './numerics/LusersNumerics';
import { motdHandlers } from './numerics/MotdNumerics';
import { statsHandlers } from './numerics/StatsNumerics';
import { channelHandlers } from './numerics/ChannelNumerics';
import { whoisHandlers } from './numerics/WhoisNumerics';
import { errorHandlers } from './numerics/ErrorNumerics';
import { versionInfoHandlers } from './numerics/VersionInfoNumerics';
import { monitorHandlers } from './numerics/MonitorNumerics';
import { starttlsHandlers } from './numerics/StarttlsNumerics';
import { saslHandlers } from './numerics/SaslNumerics';
import { extendedHandlers } from './numerics/ExtendedNumerics';
import { miscHandlers } from './numerics/MiscNumerics';
import { statefulChannelHandlers } from './numerics/StatefulChannelNumerics';

/**
 * Interface for the IRCService methods needed by numeric handlers
 */
interface IRCServiceInterface {
  // State
  registered: boolean;
  currentNick: string;
  isServerOper: boolean;

  // Methods
  addMessage: (message: any) => void;
  addRawMessage: (text: string, category: string) => void;
  emit: (event: string, ...args: any[]) => void;
  sendCommand: (command: string) => void;
  sendRaw: (command: string) => void;
  logRaw: (message: string) => void;
  getNetworkName: () => string;
  hasCapability: (cap: string) => boolean;

  // Channel/User
  channelUsers: Map<string, Map<string, any>>;
  emitUserListChange: (channel: string, users: any[]) => void;
  parseUserWithPrefixes: (userStr: string) => any | null;
  requestChatHistory: (target: string, limit?: number, before?: string) => void;
  maybeEmitChannelIntro: (channel: string, timestamp: number) => void;
  channelTopics: Map<string, any>;

  // WHOIS
  whoisTarget: string | null;
  whoisData: Map<string, any>;

  // WHOWAS
  lastWhowasTarget: string | null;
  lastWhowasAt: number;

  // Silent mode
  silentModeNicks: Set<string>;
  silentWhoNicks: Set<string>;
  silentWhoCallbacks: Map<string, (user: string, host: string) => void>;

  // Buffers
  channelListBuffer: any[];
  linksBuffer: any[];
  statsBuffer: string[];
  banListBuffer: Map<string, any[]>;
  inviteListBuffer: Map<string, any[]>;
  exceptListBuffer: Map<string, any[]>;
  namesBuffer: Map<string, Set<string>>;

  // SASL
  saslMechanism: string | null;
  saslState: string;

  // Monitor
  monitoredNicks: Set<string>;

  // SASL
  saslAuthenticating: boolean;
  endCAPNegotiation: () => void;

  // Nick state
  altNick: string | null;
  nickChangeAttempts: number;

  // Utility methods
  logRaw: (...args: any[]) => void;
  sendRaw: (command: string) => void;
  addRawMessage: (text: string, category: string) => void;
  disconnect: (message?: string) => void;

  // Config
  config: any;
}

/**
 * IRC Numeric Handlers Coordinator
 */
export class IRCNumericHandlers {
  private handlers: Map<number, NumericHandler> = new Map();
  private ctx: NumericHandlerContext;

  constructor(private service: IRCServiceInterface) {
    // Create context that bridges to the IRCService
    this.ctx = this.createContext();

    // Register all handlers
    this.registerHandlers();
  }

  /**
   * Creates a context object that provides access to IRCService functionality
   */
  private createContext(): NumericHandlerContext {
    const svc = this.service;

    return {
      // State accessors
      getCurrentNick: () => svc.currentNick,
      getNetworkName: () => svc.getNetworkName(),
      isServerOper: () => svc.isServerOper,

      // State mutators
      setRegistered: (value: boolean) => { svc.registered = value; },
      setCurrentNick: (nick: string) => { svc.currentNick = nick; },
      setServerOper: (value: boolean) => { svc.isServerOper = value; },
      updateSelfUserModes: (modes: string) => { (svc as any).updateSelfUserModes(modes); },

      // Messaging
      addMessage: (msg: any) => svc.addMessage(msg),
      addRawMessage: (text: string, category: string) => svc.addRawMessage(text, category),

      // Events
      emit: (event: string, ...args: any[]) => svc.emit(event, ...args),

      // Commands
      sendCommand: (cmd: string) => svc.sendCommand(cmd),
      sendRaw: (cmd: string) => svc.sendRaw(cmd),

      // Logging
      logRaw: (msg: string) => svc.logRaw(msg),

      // Channel/User management
      getChannelUsers: (channel: string) => svc.channelUsers.get(channel),
      setChannelUsers: (channel: string, users: Map<string, any>) => { svc.channelUsers.set(channel, users); },
      emitUserListChange: (channel: string, users: any[]) => svc.emitUserListChange(channel, users),
      parseUserWithPrefixes: (userStr: string) => svc.parseUserWithPrefixes(userStr),
      requestChatHistory: (target: string, limit?: number, before?: string) =>
        svc.requestChatHistory(target, limit, before),
      getChannelTopicInfo: (channel: string) => svc.channelTopics.get(channel) || {},
      setChannelTopicInfo: (channel: string, info: any) => { svc.channelTopics.set(channel, info); },
      maybeEmitChannelIntro: (channel: string, timestamp: number) => svc.maybeEmitChannelIntro(channel, timestamp),
      removeUserFromChannel: (channel: string, nick: string) => {
        const users = svc.channelUsers.get(channel);
        if (users) users.delete(nick);
      },

      // WHOIS state
      getWhoisTarget: () => svc.whoisTarget,
      setWhoisTarget: (nick: string | null) => { svc.whoisTarget = nick; },
      getWhoisData: () => svc.whoisData,

      // WHOWAS state
      getWhowasTarget: () => svc.lastWhowasTarget,
      setWhowasTarget: (nick: string | null) => { svc.lastWhowasTarget = nick; },
      getWhowasAt: () => svc.lastWhowasAt,
      setWhowasAt: (time: number) => { svc.lastWhowasAt = time; },

      // Silent mode
      isSilentModeNick: (nick: string) => svc.silentModeNicks.has(nick),
      isSilentWhoNick: (nick: string) => svc.silentWhoNicks.has(nick),
      getSilentWhoCallback: (nick: string) => svc.silentWhoCallbacks.get(nick),
      removeSilentModeNick: (nick: string) => { svc.silentModeNicks.delete(nick); },
      removeSilentWhoNick: (nick: string) => { svc.silentWhoNicks.delete(nick); },
      removeSilentWhoCallback: (nick: string) => { svc.silentWhoCallbacks.delete(nick); },

      // Channel list
      getChannelListBuffer: () => svc.channelListBuffer,
      clearChannelListBuffer: () => { svc.channelListBuffer.length = 0; },
      addToChannelListBuffer: (entry: any) => { svc.channelListBuffer.push(entry); },

      // Links list
      getLinksBuffer: () => svc.linksBuffer,
      clearLinksBuffer: () => { svc.linksBuffer.length = 0; },
      addToLinksBuffer: (entry: any) => { svc.linksBuffer.push(entry); },

      // Stats buffer
      getStatsBuffer: () => svc.statsBuffer,
      clearStatsBuffer: () => { svc.statsBuffer.length = 0; },
      addToStatsBuffer: (line: string) => { svc.statsBuffer.push(line); },

      // Ban list
      getBanListBuffer: () => svc.banListBuffer,
      clearBanListBuffer: (channel: string) => { svc.banListBuffer.delete(channel); },
      addToBanListBuffer: (channel: string, entry: any) => {
        const list = svc.banListBuffer.get(channel) || [];
        list.push(entry);
        svc.banListBuffer.set(channel, list);
      },

      // Invite/Except list
      getInviteListBuffer: () => svc.inviteListBuffer,
      getExceptListBuffer: () => svc.exceptListBuffer,
      clearInviteListBuffer: (channel: string) => { svc.inviteListBuffer.delete(channel); },
      clearExceptListBuffer: (channel: string) => { svc.exceptListBuffer.delete(channel); },
      addToInviteListBuffer: (channel: string, entry: any) => {
        const list = svc.inviteListBuffer.get(channel) || [];
        list.push(entry);
        svc.inviteListBuffer.set(channel, list);
      },
      addToExceptListBuffer: (channel: string, entry: any) => {
        const list = svc.exceptListBuffer.get(channel) || [];
        list.push(entry);
        svc.exceptListBuffer.set(channel, list);
      },

      // Names buffer
      getNamesBuffer: () => svc.namesBuffer,
      clearNamesBuffer: (channel: string) => { svc.namesBuffer.delete(channel); },
      addToNamesBuffer: (channel: string, names: string[]) => {
        let buffer = svc.namesBuffer.get(channel);
        if (!buffer) {
          buffer = new Set<string>();
          svc.namesBuffer.set(channel, buffer);
        }
        names.forEach(name => buffer!.add(name));
      },

      // SASL state
      getSaslMechanism: () => svc.saslMechanism,
      setSaslMechanism: (mechanism: string | null) => { svc.saslMechanism = mechanism; },
      getSaslState: () => svc.saslState,
      setSaslState: (state: string) => { svc.saslState = state; },

      // Monitor
      getMonitoredNicks: () => svc.monitoredNicks,

      // SASL state
      getSaslAuthenticating: () => svc.saslAuthenticating,
      setSaslAuthenticating: (value: boolean) => { svc.saslAuthenticating = value; },
      endCAPNegotiation: () => svc.endCAPNegotiation(),

      // Nick state
      getAltNick: () => svc.altNick,
      getNickChangeAttempts: () => svc.nickChangeAttempts,
      incrementNickChangeAttempts: () => { svc.nickChangeAttempts++; },
      setCurrentNick: (nick: string) => { svc.currentNick = nick; },

      // User management service
      getUserManagementService: () => svc.getUserManagementService(),

      // Utility methods
      logRaw: (msg: string) => svc.logRaw(msg),
      sendRaw: (cmd: string) => svc.sendRaw(cmd),
      addRawMessage: (text: string, category: string) => svc.addRawMessage(text, category),
      disconnect: (reason?: string) => svc.disconnect(reason),

      // Capabilities
      hasCapability: (cap: string) => svc.hasCapability(cap),

      // Config
      getConfig: () => svc.config,
    };
  }

  /**
   * Registers all numeric handlers from sub-modules
   */
  private registerHandlers(): void {
    // Registration numerics (001-009)
    for (const [num, handler] of registrationHandlers) {
      this.handlers.set(num, handler);
    }

    // TRACE numerics (200-210)
    for (const [num, handler] of traceHandlers) {
      this.handlers.set(num, handler);
    }

    // LUSERS/ADMIN numerics (251-259, 265-266)
    for (const [num, handler] of lusersHandlers) {
      this.handlers.set(num, handler);
    }

    // MOTD numerics (372, 375-376, 422)
    for (const [num, handler] of motdHandlers) {
      this.handlers.set(num, handler);
    }

    // Stats numerics (211-250, 261-264)
    for (const [num, handler] of statsHandlers) {
      this.handlers.set(num, handler);
    }

    // Channel numerics (321-323, 329, 341, 346-349, 364-365, 367-368)
    // NOTE: Complex state-modifying handlers (324, 331-333, 352-353, 315, 366)
    // remain in IRCService until context interface is extended
    for (const [num, handler] of channelHandlers) {
      this.handlers.set(num, handler);
    }

    // WHOIS/WHOWAS numerics (301-379)
    for (const [num, handler] of whoisHandlers) {
      this.handlers.set(num, handler);
    }

    // Error numerics (401-502)
    for (const [num, handler] of errorHandlers) {
      this.handlers.set(num, handler);
    }

    // Version/Info numerics (351, 371, 374, 381-391)
    for (const [num, handler] of versionInfoHandlers) {
      this.handlers.set(num, handler);
    }

    // MONITOR/WATCH numerics (600-608, 730-734)
    for (const [num, handler] of monitorHandlers) {
      this.handlers.set(num, handler);
    }

    // STARTTLS numerics (670-699)
    for (const [num, handler] of starttlsHandlers) {
      this.handlers.set(num, handler);
    }

    // SASL numerics (900-908)
    for (const [num, handler] of saslHandlers) {
      this.handlers.set(num, handler);
    }

    // Extended numerics (609-629, 660-689, 700-772, 910-999)
    for (const [num, handler] of extendedHandlers) {
      this.handlers.set(num, handler);
    }

    // Misc numerics extracted from IRCService:
    for (const [num, handler] of miscHandlers) {
      this.handlers.set(num, handler);
    }

    // Stateful channel/WHO numerics (315, 324, 331-333, 352-353, 366)
    for (const [num, handler] of statefulChannelHandlers) {
      this.handlers.set(num, handler);
    }
  }

  /**
   * Handles a numeric reply
   * @returns true if the handler was found and executed, false otherwise
   */
  public handle(numeric: number, prefix: string, params: string[], timestamp: number): boolean {
    const handler = this.handlers.get(numeric);
    if (handler) {
      handler(this.ctx, prefix, params, timestamp);
      return true;
    }
    return false;
  }

  /**
   * Checks if a handler exists for the given numeric
   */
  public hasHandler(numeric: number): boolean {
    return this.handlers.has(numeric);
  }
}

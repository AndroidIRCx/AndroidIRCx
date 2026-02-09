/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * IRC Command Handlers Coordinator
 *
 * Coordinates command handlers extracted from IRCService.
 */

import type { CommandHandlerContext, CommandHandler } from './commandTypes';
import { standardCommandHandlers } from './commands/StandardCommandHandlers';
import { noticeCommandHandlers } from './commands/NoticeCommandHandlers';
import { serverCommandHandlers } from './commands/ServerCommandHandlers';
import { userStateCommandHandlers } from './commands/UserStateCommandHandlers';
import { setnameCommandHandlers } from './commands/SetnameCommandHandlers';
import { readMarkerCommandHandlers } from './commands/ReadMarkerCommandHandlers';
import { batchCommandHandlers } from './commands/BatchCommandHandlers';
import { capCommandHandlers } from './commands/CapCommandHandlers';
import { topicModeCommandHandlers } from './commands/TopicModeCommandHandlers';
import { kickCommandHandlers } from './commands/KickCommandHandlers';
import { nickCommandHandlers } from './commands/NickCommandHandlers';
import { joinCommandHandlers } from './commands/JoinCommandHandlers';
import { partCommandHandlers } from './commands/PartCommandHandlers';
import { quitCommandHandlers } from './commands/QuitCommandHandlers';
import { killCommandHandlers } from './commands/KillCommandHandlers';
import { authenticateCommandHandlers } from './commands/AuthenticateCommandHandlers';
import { privmsgCommandHandlers } from './commands/PrivmsgCommandHandlers';

/**
 * Interface for the IRCService methods needed by command handlers
 */
interface IRCServiceCommandInterface {
  addMessage: (message: any) => void;
  addRawMessage: (text: string, category: string, timestamp?: number) => void;
  emit: (event: string, ...args: any[]) => void;
  extractNick: (prefix: string) => string;
  parseCTCP: (message: string) => { isCTCP: boolean; command?: string; args?: string };
  getNetworkName: () => string;
  currentNick: string;
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
  channelTopics: Map<string, any>;
  maybeEmitChannelIntro: (channel: string, timestamp: number) => void;
  handleChannelModeChange: (channel: string, modeParams: string[]) => void;
  updateSelfUserModes: (modeString: string) => void;
  channelUsers: Map<string, Map<string, any>>;
  updateChannelUserList: (channel: string) => void;
  currentNick: string;
  getNetworkName: () => string;
  getUserManagementService: () => any;
  runBlacklistAction: (entry: any, context: any) => void;
}

export class IRCCommandHandlers {
  private handlers: Map<string, CommandHandler> = new Map();
  private ctx: CommandHandlerContext;

  constructor(private service: IRCServiceCommandInterface) {
    this.ctx = this.createContext();
    this.registerHandlers();
  }

  private createContext(): CommandHandlerContext {
    const svc = this.service;
    return {
      addMessage: (msg: any, batchTag?: string) => svc.addMessage(msg, batchTag),
      addRawMessage: (text: string, category: string, timestamp?: number) =>
        svc.addRawMessage(text, category, timestamp),
      emit: (event: string, ...args: any[]) => svc.emit(event, ...args),
      extractNick: (prefix: string) => svc.extractNick(prefix),
      parseCTCP: (message: string) => svc.parseCTCP(message),
      getNetworkName: () => svc.getNetworkName(),
      getCurrentNick: () => svc.currentNick,
      getUserManagementService: () => svc.getUserManagementService(),
      getProtectionTabContext: (target: string, from: string, isChannel: boolean) =>
        svc.getProtectionTabContext(target, from, isChannel),
      handleProtectionBlock: (kind: string, nick: string, username?: string, hostname?: string, channel?: string | null) =>
        svc.handleProtectionBlock(kind, nick, username, hostname, channel),
      extractMaskFromNotice: (text: string) => svc.extractMaskFromNotice(text),
      runBlacklistAction: (entry: any, context: any) => svc.runBlacklistAction(entry, context),
      logRaw: (message: string) => svc.logRaw(message),
      handleServerError: (errorText: string) => (svc as any).handleServerError(errorText),
      decodeIfBase64Like: (value: string) => (svc as any).decodeIfBase64Like?.(value) ?? value,
      handleBatchStart: (refTag: string, type: string, params: string[], timestamp: number) =>
        (svc as any).handleBatchStart(refTag, type, params, timestamp),
      handleBatchEnd: (refTag: string, timestamp: number) =>
        (svc as any).handleBatchEnd(refTag, timestamp),
      handleCAPCommand: (params: string[]) => (svc as any).handleCAPCommand(params),
      getChannelTopicInfo: (channel: string) => (svc as any).channelTopics?.get(channel) || {},
      setChannelTopicInfo: (channel: string, info: any) => (svc as any).channelTopics?.set(channel, info),
      maybeEmitChannelIntro: (channel: string, timestamp: number) => (svc as any).maybeEmitChannelIntro(channel, timestamp),
      handleChannelModeChange: (channel: string, modeParams: string[]) =>
        (svc as any).handleChannelModeChange(channel, modeParams),
      updateSelfUserModes: (modeString: string) => (svc as any).updateSelfUserModes(modeString),
      getChannelUsers: (channel: string) => (svc as any).channelUsers?.get(channel),
      updateChannelUserList: (channel: string) => (svc as any).updateChannelUserList(channel),
      getAllChannelUsers: () => (svc as any).channelUsers,
      getCurrentNick: () => (svc as any).currentNick,
      setCurrentNick: (nick: string) => { (svc as any).currentNick = nick; },
      getNetworkName: () => (svc as any).getNetworkName(),
      hasUser: (channel: string, nick: string) => {
        const users = (svc as any).channelUsers?.get(channel);
        return users ? users.has(nick.toLowerCase()) : false;
      },
      setUser: (channel: string, nick: string, user: any) => {
        const users = (svc as any).channelUsers?.get(channel);
        if (users) users.set(nick.toLowerCase(), user);
      },
      getUser: (channel: string, nick: string) => {
        const users = (svc as any).channelUsers?.get(channel);
        return users ? users.get(nick.toLowerCase()) : undefined;
      },
      ensureChannelUsersMap: (channel: string) => {
        let users = (svc as any).channelUsers?.get(channel);
        if (!users) {
          users = new Map();
          (svc as any).channelUsers?.set(channel, users);
        }
        return users;
      },
      runBlacklistCheckForJoin: (nick: string, username?: string, hostname?: string, channel?: string) => {
        const network = (svc as any).getNetworkName();
        const entry = (svc as any).getUserManagementService()
          .findMatchingBlacklistEntry(nick, username, hostname, network);
        if (entry) {
          (svc as any).runBlacklistAction(entry, {
            nick,
            username,
            hostname,
            channel,
            network,
          });
        }
      },
      isExtendedJoinEnabled: () => Boolean((svc as any).extendedJoin),
      emitJoinedChannel: (channel: string) => (svc as any).emit('joinedChannel', channel),
      addPendingChannelIntro: (channel: string) => (svc as any).pendingChannelIntro?.add(channel),
      emitPart: (channel: string, nick: string) => (svc as any).emit('part', channel, nick),
      emitConnection: (connected: boolean) => (svc as any).emitConnection(connected),
      handleKillDisconnect: (reason: string) => (svc as any).handleKillDisconnect(reason),
      sendSASLCredentials: () => (svc as any).sendSASLCredentials(),
      setSaslAuthenticating: (value: boolean) => { (svc as any).saslAuthenticating = value; },
      sendRaw: (command: string) => (svc as any).sendRaw(command),
      handleCTCPRequest: (from: string, target: string, command: string, args?: string) =>
        (svc as any).handleCTCPRequest(from, target, command, args),
      isUserIgnored: (nick: string, username?: string, hostname?: string, network?: string) =>
        (svc as any).getUserManagementService().isUserIgnored(nick, username, hostname, network),
      evaluateProtectionDecision: (message: any, context: any) => {
        const protectionService = require('../ProtectionService').protectionService;
        return protectionService.evaluateIncomingMessage(message, context);
      },
      handleMultilineMessage: (from: string, target: string, text: string, concatTag: string | undefined, otherTags: any) =>
        (svc as any).handleMultilineMessage(from, target, text, concatTag, otherTags),
      getEncryptedDMService: () => require('../EncryptedDMService').encryptedDMService,
      getChannelEncryptionService: () => require('../ChannelEncryptionService').channelEncryptionService,
    };
  }

  private registerHandlers(): void {
    for (const [command, handler] of standardCommandHandlers) {
      this.handlers.set(command, handler);
    }
    for (const [command, handler] of noticeCommandHandlers) {
      this.handlers.set(command, handler);
    }
    for (const [command, handler] of serverCommandHandlers) {
      this.handlers.set(command, handler);
    }
    for (const [command, handler] of userStateCommandHandlers) {
      this.handlers.set(command, handler);
    }
    for (const [command, handler] of setnameCommandHandlers) {
      this.handlers.set(command, handler);
    }
    for (const [command, handler] of readMarkerCommandHandlers) {
      this.handlers.set(command, handler);
    }
    for (const [command, handler] of batchCommandHandlers) {
      this.handlers.set(command, handler);
    }
    for (const [command, handler] of capCommandHandlers) {
      this.handlers.set(command, handler);
    }
    for (const [command, handler] of topicModeCommandHandlers) {
      this.handlers.set(command, handler);
    }
    for (const [command, handler] of kickCommandHandlers) {
      this.handlers.set(command, handler);
    }
    for (const [command, handler] of nickCommandHandlers) {
      this.handlers.set(command, handler);
    }
    for (const [command, handler] of joinCommandHandlers) {
      this.handlers.set(command, handler);
    }
    for (const [command, handler] of partCommandHandlers) {
      this.handlers.set(command, handler);
    }
    for (const [command, handler] of quitCommandHandlers) {
      this.handlers.set(command, handler);
    }
    for (const [command, handler] of killCommandHandlers) {
      this.handlers.set(command, handler);
    }
    for (const [command, handler] of authenticateCommandHandlers) {
      this.handlers.set(command, handler);
    }
    for (const [command, handler] of privmsgCommandHandlers) {
      this.handlers.set(command, handler);
    }
  }

  /**
   * Handles a command
   * @returns true if the handler was found and executed, false otherwise
   */
  public handle(
    command: string,
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
    }
  ): boolean {
    const handler = this.handlers.get(command.toUpperCase());
    if (handler) {
      handler(this.ctx, prefix, params, timestamp, meta);
      return true;
    }
    // Default: display unhandled commands as raw
    const fullMessage = `${prefix ? `:${prefix} ` : ''}${command} ${params.join(' ')}`;
    this.ctx.addRawMessage(`*** RAW Command: ${fullMessage}`, 'server', timestamp);
    return false;
  }
}

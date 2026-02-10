/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * IRC Send Message Command Handlers Coordinator
 *
 * Coordinates user-facing /command handlers extracted from IRCService.sendMessage().
 */

import type { SendMessageContext, SendMessageHandler } from './sendMessageTypes';
import { basicIRCCommands } from './sendCommands/BasicIRCCommands';
import { queryCommands } from './sendCommands/QueryCommands';
import { messageCommands } from './sendCommands/MessageCommands';
import { encryptionCommands } from './sendCommands/EncryptionCommands';
import { channelOpsCommands } from './sendCommands/ChannelOpsCommands';
import { statusCommands } from './sendCommands/StatusCommands';
import { operCommands } from './sendCommands/OperCommands';
import { utilityCommands } from './sendCommands/UtilityCommands';
import { infoCommands } from './sendCommands/InfoCommands';
import { channelCommands } from './sendCommands/ChannelCommands';

/**
 * Interface for the IRCService methods needed by sendMessage handlers
 */
interface IRCServiceSendInterface {
  currentNick: string;
  getNetworkName: () => string;
  sendRaw: (command: string) => void;
  sendCommand: (command: string) => void;
  addMessage: (message: any) => void;
  emit: (event: string, ...args: any[]) => void;
  encodeCTCP: (command: string, args?: string) => string;
  joinChannel: (channel: string, key?: string) => void;
  partChannel: (channel: string, message?: string) => void;
  setRealname: (newRealname: string) => void;
  toggleBotMode: (enable: boolean) => void;
  detectClones: (channel: string) => Promise<Map<string, string[]>>;
  parseServerCommand: (args: string[]) => any;
  getUserManagementService: () => any;
  // Capability check
  capEnabledSet: Set<string>;
  // WHOWAS state
  lastWhowasTarget: string | null;
  lastWhowasAt: number;
}

export class IRCSendMessageHandlers {
  private handlers: Map<string, SendMessageHandler> = new Map();
  private ctx: SendMessageContext;

  constructor(private service: IRCServiceSendInterface) {
    this.ctx = this.createContext();
    this.registerHandlers();
  }

  private createContext(): SendMessageContext {
    const svc = this.service;
    return {
      getCurrentNick: () => svc.currentNick,
      getNetworkName: () => svc.getNetworkName(),
      sendRaw: (command: string) => svc.sendRaw(command),
      sendCommand: (command: string) => svc.sendCommand(command),
      addMessage: (message: any) => svc.addMessage(message),
      emit: (event: string, ...args: any[]) => {
        // Intercept set-whowas-target to directly set state
        if (event === 'set-whowas-target') {
          svc.lastWhowasTarget = args[0] || null;
          svc.lastWhowasAt = args[1] || Date.now();
          return;
        }
        svc.emit(event, ...args);
      },
      encodeCTCP: (command: string, args?: string) => svc.encodeCTCP(command, args),
      joinChannel: (channel: string, key?: string) => svc.joinChannel(channel, key),
      partChannel: (channel: string, message?: string) => svc.partChannel(channel, message),
      setRealname: (newRealname: string) => svc.setRealname(newRealname),
      toggleBotMode: (enable: boolean) => svc.toggleBotMode(enable),
      detectClones: (channel: string) => svc.detectClones(channel),
      parseServerCommand: (args: string[]) => svc.parseServerCommand(args),
      getEncryptedDMService: () => require('../EncryptedDMService').encryptedDMService,
      getChannelEncryptionService: () => require('../ChannelEncryptionService').channelEncryptionService,
      getUserManagementService: () => svc.getUserManagementService(),
      hasCapability: (cap: string) => svc.capEnabledSet.has(cap),
    };
  }

  private registerHandlers(): void {
    const registries = [
      basicIRCCommands,
      queryCommands,
      messageCommands,
      encryptionCommands,
      channelOpsCommands,
      statusCommands,
      operCommands,
      utilityCommands,
      infoCommands,
      channelCommands,
    ];
    for (const registry of registries) {
      for (const [command, handler] of registry) {
        this.handlers.set(command, handler);
      }
    }
  }

  /**
   * Handles a user-typed /command.
   * @returns true if the handler was found and executed, false otherwise
   */
  public handle(command: string, args: string[], target: string): boolean {
    const handler = this.handlers.get(command.toUpperCase());
    if (handler) {
      handler(this.ctx, args, target);
      return true;
    }
    return false;
  }
}

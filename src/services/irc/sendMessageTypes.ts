/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { IRCMessage } from '../IRCService';

/**
 * Context provided to sendMessage command handlers for accessing IRCService functionality.
 */
export interface SendMessageContext {
  // Current state
  getCurrentNick: () => string;
  getNetworkName: () => string;
  getWhoisUseDoubleNick: () => boolean;

  // Outgoing operations
  sendRaw: (command: string) => void;
  sendCommand: (command: string) => void;
  /** Send user text as one or more lines that fit; returns the pieces sent. */
  sendSplitText: (
    command: 'PRIVMSG' | 'NOTICE',
    target: string,
    text: string,
    options?: { wrap?: (piece: string) => string; wrapBytes?: number },
  ) => string[];
  /** Send an encrypted message, split before encryption; returns pieces sent. */
  sendEncryptedText: (
    target: string,
    plaintext: string,
    marker: '!enc-msg' | '!chanenc-msg',
    encrypt: (piece: string) => Promise<unknown>,
  ) => Promise<string[]>;

  // Message display
  addMessage: (
    message: Partial<IRCMessage> & { type: string; timestamp: number },
  ) => void;

  // Events
  emit: (event: string, ...args: any[]) => void;

  // Service access
  getEncryptedDMService: () => any;
  getChannelEncryptionService: () => any;
  getUserManagementService: () => any;

  // CTCP encoding
  encodeCTCP: (command: string, args?: string) => string;

  // Channel operations
  joinChannel: (channel: string, key?: string) => void;
  partChannel: (channel: string, message?: string) => void;
  setRealname: (newRealname: string) => void;
  toggleBotMode: (enable: boolean) => void;

  // Clone detection
  detectClones: (channel: string) => Promise<Map<string, string[]>>;

  // Server command parsing
  parseServerCommand: (args: string[]) => any;

  // Capability check
  hasCapability: (cap: string) => boolean;

  // User-requested response tracking
  markUserRequestedNames?: (channel: string) => void;
}

/**
 * Type for a sendMessage command handler function.
 */
export type SendMessageHandler = (
  ctx: SendMessageContext,
  args: string[],
  target: string,
) => void;

/**
 * Registry of sendMessage command handlers by command name.
 */
export type SendMessageHandlerRegistry = Map<string, SendMessageHandler>;

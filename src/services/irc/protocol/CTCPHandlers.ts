/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * CTCP (Client-To-Client Protocol) utility functions and request handler.
 * Extracted from IRCService.ts for modular architecture.
 */

import { APP_VERSION } from '../../../config/appVersion';

/** Parse a CTCP message: checks for \x01 delimiters and extracts command + args */
export function parseCTCP(message: string): { isCTCP: boolean; command?: string; args?: string } {
  if (!message || !message.startsWith('\x01') || !message.endsWith('\x01')) return { isCTCP: false };
  const content = message.slice(1, -1);
  const spaceIndex = content.indexOf(' ');
  if (spaceIndex === -1) return { isCTCP: true, command: content.toUpperCase() };
  return { isCTCP: true, command: content.substring(0, spaceIndex).toUpperCase(), args: content.substring(spaceIndex + 1) };
}

/** Encode a CTCP message by wrapping with \x01 delimiters */
export function encodeCTCP(command: string, args?: string): string {
  return `\x01${args ? `${command} ${args}` : command}\x01`;
}

export interface CTCPContext {
  sendRaw: (command: string) => void;
  addMessage: (message: any) => void;
  logRaw: (message: string) => void;
  getCurrentNick: () => string;
  getRealname: () => string;
  isConnected: () => boolean;
  getCtcpVersionMessage: () => Promise<string>;
}

/** Handle an incoming CTCP request */
export async function handleCTCPRequest(
  ctx: CTCPContext,
  from: string,
  target: string,
  command: string,
  args?: string,
): Promise<void> {
  const sendResponse = (cmd: string, responseArgs?: string) => {
    if (ctx.isConnected()) ctx.sendRaw(`NOTICE ${from} :${encodeCTCP(cmd, responseArgs)}`);
  };

  switch (command) {
    case 'VERSION': {
      const customMessage = await ctx.getCtcpVersionMessage();
      const versionResponse = customMessage.trim()
        ? `AndroidIRCX ${APP_VERSION} ${customMessage.trim()}`
        : `AndroidIRCX ${APP_VERSION}`;
      sendResponse('VERSION', versionResponse);
      break;
    }
    case 'TIME':
      sendResponse('TIME', new Date().toISOString());
      break;
    case 'PING':
      sendResponse('PING', args || Date.now().toString());
      break;
    case 'ACTION':
      break;
    case 'DCC':
      ctx.addMessage({
        type: 'ctcp',
        from,
        text: `\x01DCC ${args || ''}\x01`,
        channel: target,
        timestamp: Date.now(),
      });
      break;
    case 'SLOTS':
    case 'XDCC':
    case 'TDCC':
    case 'RDCC':
      ctx.addMessage({
        type: 'ctcp',
        from,
        text: `\x01${command} ${args || ''}\x01`,
        channel: target,
        timestamp: Date.now(),
      });
      break;
    case 'CLIENTINFO':
      sendResponse('CLIENTINFO', 'ACTION DCC PING TIME VERSION CLIENTINFO USERINFO SOURCE FINGER');
      break;
    case 'USERINFO':
      sendResponse('USERINFO', ctx.getRealname() || 'AndroidIRCX User');
      break;
    case 'SOURCE':
      sendResponse('SOURCE', 'https://github.com/AndroidIRCX');
      break;
    case 'FINGER':
      sendResponse('FINGER', `${ctx.getCurrentNick()} - AndroidIRCX`);
      break;
    default:
      ctx.addMessage({
        type: 'ctcp',
        from,
        text: `\x01${command} ${args || ''}\x01`,
        channel: target,
        timestamp: Date.now(),
      });
      ctx.logRaw(`CTCP ${command} from ${from}: ${args || '(no args)'}`);
  }
}

/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * User list command handlers for sendMessage:
 * NOTIFY, AUTOOP, AUTOVOICE, AUTOHALFOP, PROTECT
 * and their removal counterparts
 */

import { tx } from '../../../i18n/transifex';
import type { SendMessageHandler, SendMessageHandlerRegistry } from '../sendMessageTypes';
import { UserListType } from '../../UserManagementService';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

// Helper to parse nick and optional channel from args
const parseNickAndChannel = (args: string[]): { nick: string; channel?: string } | null => {
  if (args.length === 0) return null;
  
  const nick = args[0];
  let channel: string | undefined;
  
  // Check for channel in remaining args
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('#') || arg.startsWith('&')) {
      channel = arg;
      break;
    }
  }
  
  return { nick, channel };
};

// Helper to add user to a list
const addToList = async (
  ctx: any,
  listType: UserListType,
  nick: string,
  channel?: string
) => {
  const userMgmt = ctx.getUserManagementService();
  const network = ctx.getNetworkName();
  const channels = channel ? [channel] : undefined;
  const mask = nick.includes('!') ? nick : `${nick}!*@*`;
  
  // Check if already exists
  const existing = userMgmt.findMatchingUserListEntry(listType, nick, undefined, undefined, network, channel);
  if (existing) {
    ctx.addMessage({
      type: 'error',
      text: t('{nick} is already in the {list} list', { nick, list: listType }),
      timestamp: Date.now(),
    });
    return;
  }
  
  await userMgmt.addUserListEntry(listType, mask, {
    network,
    channels,
    protected: listType === 'other', // Protected users go to 'other' list with protected flag
  });
  
  const listName = listType === 'other' ? 'protected' : listType;
  ctx.addMessage({
    type: 'notice',
    text: t('*** Added {nick} to {list} list', { nick, list: listName }),
    timestamp: Date.now(),
  });
};

// Helper to remove user from a list
const removeFromList = async (
  ctx: any,
  listType: UserListType,
  nick: string
) => {
  const userMgmt = ctx.getUserManagementService();
  const network = ctx.getNetworkName();
  const mask = nick.includes('!') ? nick : `${nick}!*@*`;
  
  // Try to find and remove the entry
  const entries = userMgmt.getUserListEntries(listType, network);
  const matchingEntry = entries.find(e => 
    e.mask.toLowerCase() === mask.toLowerCase() || 
    e.mask.toLowerCase().startsWith(nick.toLowerCase() + '!')
  );
  
  if (!matchingEntry) {
    ctx.addMessage({
      type: 'error',
      text: t('{nick} is not in the {list} list', { nick, list: listType }),
      timestamp: Date.now(),
    });
    return;
  }
  
  await userMgmt.removeUserListEntry(listType, matchingEntry.mask, network);
  
  const listName = listType === 'other' ? 'protected' : listType;
  ctx.addMessage({
    type: 'notice',
    text: t('*** Removed {nick} from {list} list', { nick, list: listName }),
    timestamp: Date.now(),
  });
};

// NOTIFY - Add to notify list
export const handleNOTIFY: SendMessageHandler = async (ctx, args) => {
  const parsed = parseNickAndChannel(args);
  if (!parsed) {
    ctx.addMessage({
      type: 'error',
      text: t('Usage: /notify <nick>'),
      timestamp: Date.now(),
    });
    return;
  }
  
  await addToList(ctx, 'notify', parsed.nick, parsed.channel);
};

// UNNOTIFY - Remove from notify list
export const handleUNNOTIFY: SendMessageHandler = async (ctx, args) => {
  if (args.length === 0) {
    ctx.addMessage({
      type: 'error',
      text: t('Usage: /unnotify <nick>'),
      timestamp: Date.now(),
    });
    return;
  }
  
  await removeFromList(ctx, 'notify', args[0]);
};

// AUTOOP - Add to auto-op list
export const handleAUTOOP: SendMessageHandler = async (ctx, args) => {
  const parsed = parseNickAndChannel(args);
  if (!parsed) {
    ctx.addMessage({
      type: 'error',
      text: t('Usage: /autoop <nick> [#channel]'),
      timestamp: Date.now(),
    });
    return;
  }
  
  await addToList(ctx, 'autoop', parsed.nick, parsed.channel);
};

// UNAUTOOP - Remove from auto-op list
export const handleUNAUTOOP: SendMessageHandler = async (ctx, args) => {
  if (args.length === 0) {
    ctx.addMessage({
      type: 'error',
      text: t('Usage: /unautoop <nick>'),
      timestamp: Date.now(),
    });
    return;
  }
  
  await removeFromList(ctx, 'autoop', args[0]);
};

// AUTOVOICE - Add to auto-voice list
export const handleAUTOVOICE: SendMessageHandler = async (ctx, args) => {
  const parsed = parseNickAndChannel(args);
  if (!parsed) {
    ctx.addMessage({
      type: 'error',
      text: t('Usage: /autovoice <nick> [#channel]'),
      timestamp: Date.now(),
    });
    return;
  }
  
  await addToList(ctx, 'autovoice', parsed.nick, parsed.channel);
};

// UNAUTOVOICE - Remove from auto-voice list
export const handleUNAUTOVOICE: SendMessageHandler = async (ctx, args) => {
  if (args.length === 0) {
    ctx.addMessage({
      type: 'error',
      text: t('Usage: /unautovoice <nick>'),
      timestamp: Date.now(),
    });
    return;
  }
  
  await removeFromList(ctx, 'autovoice', args[0]);
};

// AUTOHALFOP - Add to auto-halfop list
export const handleAUTOHALFOP: SendMessageHandler = async (ctx, args) => {
  const parsed = parseNickAndChannel(args);
  if (!parsed) {
    ctx.addMessage({
      type: 'error',
      text: t('Usage: /autohalfop <nick> [#channel]'),
      timestamp: Date.now(),
    });
    return;
  }
  
  await addToList(ctx, 'autohalfop', parsed.nick, parsed.channel);
};

// UNAUTOHALFOP - Remove from auto-halfop list
export const handleUNAUTOHALFOP: SendMessageHandler = async (ctx, args) => {
  if (args.length === 0) {
    ctx.addMessage({
      type: 'error',
      text: t('Usage: /unautohalfop <nick>'),
      timestamp: Date.now(),
    });
    return;
  }
  
  await removeFromList(ctx, 'autohalfop', args[0]);
};

// PROTECT - Add to protected list
export const handlePROTECT: SendMessageHandler = async (ctx, args) => {
  const parsed = parseNickAndChannel(args);
  if (!parsed) {
    ctx.addMessage({
      type: 'error',
      text: t('Usage: /protect <nick> [#channel]'),
      timestamp: Date.now(),
    });
    return;
  }
  
  const userMgmt = ctx.getUserManagementService();
  const network = ctx.getNetworkName();
  const channels = parsed.channel ? [parsed.channel] : undefined;
  const mask = parsed.nick.includes('!') ? parsed.nick : `${parsed.nick}!*@*`;
  
  // Check if already protected
  const existing = userMgmt.findMatchingUserListEntry('other', parsed.nick, undefined, undefined, network, parsed.channel);
  if (existing?.protected) {
    ctx.addMessage({
      type: 'error',
      text: t('{nick} is already protected', { nick: parsed.nick }),
      timestamp: Date.now(),
    });
    return;
  }
  
  await userMgmt.addUserListEntry('other', mask, {
    network,
    channels,
    protected: true,
    reason: 'Protected user',
  });
  
  ctx.addMessage({
    type: 'notice',
    text: t('*** Added {nick} to protected list', { nick: parsed.nick }),
    timestamp: Date.now(),
  });
};

// UNPROTECT - Remove from protected list
export const handleUNPROTECT: SendMessageHandler = async (ctx, args) => {
  if (args.length === 0) {
    ctx.addMessage({
      type: 'error',
      text: t('Usage: /unprotect <nick>'),
      timestamp: Date.now(),
    });
    return;
  }
  
  const nick = args[0];
  await removeFromList(ctx, 'other', nick);
};

// USERLISTS - Open user lists screen
export const handleUSERLISTS: SendMessageHandler = (ctx, args) => {
  const tab = args[0]?.toLowerCase() as UserListType | 'blacklist' | undefined;
  const validTabs = ['notify', 'ignore', 'autoop', 'autovoice', 'autohalfop', 'blacklist', 'other'];
  
  const { useUIStore } = require('../../../stores/uiStore');
  const uiStore = useUIStore.getState();
  
  uiStore.setUserListsInitialTab(tab && validTabs.includes(tab) ? tab : 'notify');
  uiStore.setShowUserLists(true);
  
  ctx.addMessage({
    type: 'notice',
    text: t('*** Opening user lists...'),
    timestamp: Date.now(),
  });
};

export const userListCommands: SendMessageHandlerRegistry = new Map([
  ['NOTIFY', handleNOTIFY],
  ['UNNOTIFY', handleUNNOTIFY],
  ['AUTOOP', handleAUTOOP],
  ['UNAUTOOP', handleUNAUTOOP],
  ['AUTOVOICE', handleAUTOVOICE],
  ['UNAUTOVOICE', handleUNAUTOVOICE],
  ['AUTOHALFOP', handleAUTOHALFOP],
  ['UNAUTOHALFOP', handleUNAUTOHALFOP],
  ['PROTECT', handlePROTECT],
  ['UNPROTECT', handleUNPROTECT],
  ['USERLISTS', handleUSERLISTS],
]);

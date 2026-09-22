/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * The AndroidIRCX scripting vocabulary, in one place.
 *
 * Three consumers read these lists: the editor's syntax highlighting, its
 * autocomplete, and the AI script generator's system prompt. Keeping them
 * here is what makes the generator self-maintaining — adding an `api.*`
 * method to ScriptingService and listing it below teaches the generator about
 * it, with no prompt to rewrite.
 *
 * Keep API_MEMBERS in sync with ScriptingService.makeApi().
 */

export const IRCX_HOOKS =
  'onConnect|onDisconnect|onMessage|onNotice|onJoin|onPart|onQuit|' +
  'onNickChange|onKick|onMode|onTopic|onInvite|onCTCP|onAction|onHighlight|' +
  'onRaw|onCommand|onTimer';

export const HOOK_LIST = IRCX_HOOKS.split('|');
// `api.*` members (kept in sync with ScriptingService.makeApi).
export const API_MEMBERS = [
  'log',
  'warn',
  'error',
  'userNick',
  'appVersion',
  'getConfig',
  'sendMessage',
  'sendCommand',
  'sendNotice',
  'sendCTCP',
  'registerCommand',
  'addMenuItem',
  'join',
  'part',
  'kick',
  'mode',
  'op',
  'deop',
  'voice',
  'devoice',
  'ban',
  'unban',
  'setTopic',
  'changeNick',
  'setAway',
  'back',
  'whois',
  'action',
  'rand',
  'list',
  'getChannelUsers',
  'getChannels',
  'getChannelInfo',
  'getTabs',
  'getActiveTab',
  'switchToTab',
  'getUserInfo',
  'getUserNote',
  'setUserNote',
  'getUserAlias',
  'setUserAlias',
  'isIgnored',
  'getChannelNote',
  'setChannelNote',
  'isChannelBookmarked',
  'getHighlightWords',
  'addHighlightWord',
  'removeHighlightWord',
  'isHighlighted',
  'searchHistory',
  'getRecentMessages',
  'getHistoryStats',
  'getSetting',
  'getTheme',
  'getConnectionStats',
  'setTimer',
  'clearTimer',
  'getNetworkId',
  'getAllNetworks',
  'isConnected',
  'getStorage',
  'setStorage',
  'removeStorage',
  'playSound',
  'openLink',
  'now',
  'sleep',
  // AI namespace: completed as `api.ai`, then its own members below.
  'ai',
];
// Members of the `api.ai` namespace, offered after `api.ai.`.
export const AI_MEMBERS = ['ask', 'chat', 'listProviders', 'isAvailable'];
export const JS_KEYWORDS = [
  'const',
  'let',
  'var',
  'function',
  'return',
  'if',
  'else',
  'for',
  'while',
  'switch',
  'case',
  'break',
  'continue',
  'new',
  'try',
  'catch',
  'throw',
  'async',
  'await',
  'true',
  'false',
  'null',
  'typeof',
  'module',
  'exports',
  'console',
];

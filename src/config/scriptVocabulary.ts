/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * The AndroidIRCX scripting vocabulary, in one place.
 *
 * Four consumers read these lists: the editor's syntax highlighting, its
 * autocomplete, the in-app help, and the AI script generator's system prompt.
 * Keeping them here is what makes the generator self-maintaining — adding an
 * `api.*` method to ScriptingService and listing it below teaches the
 * generator about it, with no prompt to rewrite.
 *
 * Every entry carries its **signature and a one-line summary**, not just a
 * name. A completion list of bare names cannot say whether `userNick` is a
 * value or a call, or what `setTimer` wants, so the editor could offer a name
 * and leave the user no better off. The same text improves the generator's
 * prompt for free, because both read this file.
 *
 * Keep API_ENTRIES in sync with ScriptingService.makeApi().
 */

export interface VocabularyEntry {
  /** The identifier as typed. */
  name: string;
  /**
   * How it is used: `sendMessage(channel, text, networkId?)` for a function,
   * the bare name for a value. A trailing `?` marks an optional argument.
   */
  signature: string;
  /** One line, in plain words, about what it does. */
  summary: string;
  /** True when it returns a promise and must be awaited. */
  isAsync?: boolean;
}

// --- Hooks ---------------------------------------------------------------

export const HOOK_ENTRIES: VocabularyEntry[] = [
  {
    name: 'onConnect',
    signature: 'onConnect(networkId)',
    summary: 'A network finished connecting.',
  },
  {
    name: 'onDisconnect',
    signature: 'onDisconnect(networkId, reason?)',
    summary: 'A network dropped or was disconnected.',
  },
  {
    name: 'onMessage',
    signature: 'onMessage(msg)',
    summary:
      'A channel message or private message arrived. msg has from, text, channel, network.',
  },
  {
    name: 'onNotice',
    signature: 'onNotice(msg)',
    summary: 'A NOTICE arrived. Never reply to one, or two bots will loop.',
  },
  {
    name: 'onJoin',
    signature: 'onJoin(channel, nick, msg)',
    summary: 'Someone joined a channel — including you.',
  },
  {
    name: 'onPart',
    signature: 'onPart(channel, nick, reason, msg)',
    summary: 'Someone left a channel.',
  },
  {
    name: 'onQuit',
    signature: 'onQuit(nick, reason, msg)',
    summary: 'Someone quit the network entirely.',
  },
  {
    name: 'onNickChange',
    signature: 'onNickChange(oldNick, newNick, msg)',
    summary: 'Someone changed their nick.',
  },
  {
    name: 'onKick',
    signature: 'onKick(channel, kickedNick, kickerNick, reason, msg)',
    summary: 'Someone was kicked from a channel.',
  },
  {
    name: 'onMode',
    signature: 'onMode(channel, setterNick, mode, target, msg)',
    summary: 'A mode changed. target is undefined for a channel-wide mode.',
  },
  {
    name: 'onBan',
    signature: 'onBan(channel, setter, mask, msg)',
    summary: 'A ban mask was added.',
  },
  {
    name: 'onUnban',
    signature: 'onUnban(channel, setter, mask, msg)',
    summary: 'A ban mask was removed.',
  },
  {
    name: 'onOp',
    signature: 'onOp(channel, setter, nick, msg)',
    summary: 'Someone was given operator status.',
  },
  {
    name: 'onDeop',
    signature: 'onDeop(channel, setter, nick, msg)',
    summary: 'Someone lost operator status.',
  },
  {
    name: 'onVoice',
    signature: 'onVoice(channel, setter, nick, msg)',
    summary: 'Someone was given voice.',
  },
  {
    name: 'onDevoice',
    signature: 'onDevoice(channel, setter, nick, msg)',
    summary: 'Someone lost voice.',
  },
  {
    name: 'onHelp',
    signature: 'onHelp(channel, setter, nick, msg)',
    summary: 'Someone was given half-operator status.',
  },
  {
    name: 'onDehelp',
    signature: 'onDehelp(channel, setter, nick, msg)',
    summary: 'Someone lost half-operator status.',
  },
  {
    name: 'onUserMode',
    signature: 'onUserMode(target, setter, mode, msg)',
    summary: 'A user mode changed.',
  },
  {
    name: 'onServerMode',
    signature: 'onServerMode(target, server, mode, msg)',
    summary: 'A server-originated channel mode changed.',
  },
  {
    name: 'onServerNotice',
    signature: 'onServerNotice(from, text, msg)',
    summary: 'A notice from the server itself, not from a user.',
  },
  {
    name: 'onWallops',
    signature: 'onWallops(from, text, msg)',
    summary: 'A WALLOPS message, broadcast to operators.',
  },
  {
    name: 'onServerError',
    signature: 'onServerError(text, msg)',
    summary: 'The server sent an ERROR, usually just before closing the link.',
  },
  {
    name: 'onPing',
    signature: 'onPing(token, direction)',
    summary:
      'A PING passed by. Observation only - a return value cannot block or replace it.',
  },
  {
    name: 'onPong',
    signature: 'onPong(token, direction)',
    summary: 'A PONG passed by. Observation only.',
  },
  {
    name: 'onNotifyOnline',
    signature: 'onNotifyOnline(nick, user, host, msg)',
    summary: 'MONITOR or WATCH reports a nick came online.',
  },
  {
    name: 'onNotifyOffline',
    signature: 'onNotifyOffline(nick, msg)',
    summary: 'MONITOR or WATCH reports a nick went offline.',
  },
  {
    name: 'onTopic',
    signature: 'onTopic(channel, topic, setterNick, msg)',
    summary: 'A channel topic was changed.',
  },
  {
    name: 'onInvite',
    signature: 'onInvite(channel, inviterNick, msg)',
    summary: 'You were invited to a channel.',
  },
  {
    name: 'onCTCP',
    signature: 'onCTCP(type, from, text, msg)',
    summary: 'A CTCP request arrived, such as VERSION or PING.',
  },
  {
    name: 'onAction',
    signature: 'onAction(target, nick, text, msg)',
    summary: 'Someone used /me.',
  },
  {
    name: 'onHighlight',
    signature: 'onHighlight(msg)',
    summary: 'A message matched one of your highlight words.',
  },
  {
    name: 'onRaw',
    signature: 'onRaw(line, direction, msg?)',
    summary:
      'Every raw IRC line, in or out. Observation only; anything returned is ignored.',
  },
  {
    name: 'onNumeric',
    signature: 'onNumeric(code, params, text, msg)',
    summary:
      'A parsed server numeric. Return false to hide its default display without blocking protocol handling.',
  },
  {
    name: 'onTabOpen',
    signature: 'onTabOpen(tab)',
    summary: 'A server, channel, query, notice or DCC tab opened.',
  },
  {
    name: 'onTabClose',
    signature: 'onTabClose(tab)',
    summary: 'A server, channel, query, notice or DCC tab closed.',
  },
  {
    name: 'onTabActivate',
    signature: 'onTabActivate(previous, current)',
    summary:
      'The active tab changed. Either value may be undefined during restore or close.',
  },
  {
    name: 'onFileSent',
    signature: 'onFileSent(transfer)',
    summary: 'An outgoing DCC file transfer completed.',
  },
  {
    name: 'onFileReceived',
    signature: 'onFileReceived(transfer)',
    summary: 'An incoming DCC file transfer completed.',
  },
  {
    name: 'onDccSendFailed',
    signature: 'onDccSendFailed(transfer)',
    summary: 'An outgoing DCC file transfer failed.',
  },
  {
    name: 'onDccReceiveFailed',
    signature: 'onDccReceiveFailed(transfer)',
    summary: 'An incoming DCC file transfer failed.',
  },
  {
    name: 'onAppStateChange',
    signature: 'onAppStateChange(state)',
    summary: 'The app became active, inactive or backgrounded.',
  },
  {
    name: 'onLoad',
    signature: 'onLoad()',
    summary: 'Runs once after the script is installed or replaced.',
  },
  {
    name: 'onStart',
    signature: 'onStart()',
    summary:
      'Runs whenever an enabled script starts, including at app startup.',
  },
  {
    name: 'onCommand',
    signature: 'onCommand(text, ctx)',
    summary:
      'Text you typed, before it is sent. Must return synchronously; return false to swallow it.',
  },
  {
    name: 'onInput',
    signature: 'onInput(text, context)',
    summary:
      'Transforms or cancels submitted chat-composer text before onCommand. Secure form fields never enter this hook.',
  },
  {
    name: 'onTabComplete',
    signature: 'onTabComplete(text, cursor, context)',
    summary:
      'Returns up to eight synchronous composer completions after built-in results.',
  },
  {
    name: 'onTimer',
    signature: 'onTimer(name)',
    summary: 'A timer you set with api.setTimer fired.',
  },
  {
    name: 'onSignal',
    signature: 'onSignal({ name, payload, from, scope })',
    summary:
      'Another script raised a signal. scope is self, addon or broadcast.',
  },
  {
    name: 'onUnload',
    signature: 'onUnload()',
    summary:
      'The script is being switched off or replaced. Must return synchronously; commands, menus and timers are cleared for you either way.',
  },
];

export const HOOK_LIST = HOOK_ENTRIES.map(entry => entry.name);
export const IRCX_HOOKS = HOOK_LIST.join('|');

// --- api.* ---------------------------------------------------------------

export const API_ENTRIES: VocabularyEntry[] = [
  // Logging
  {
    name: 'log',
    signature: 'log(text)',
    summary: 'Write a line to the script log.',
  },
  {
    name: 'warn',
    signature: 'warn(text)',
    summary: 'Write a warning to the script log.',
  },
  {
    name: 'error',
    signature: 'error(text)',
    summary: 'Write an error to the script log.',
  },

  // Identity and config
  {
    name: 'userNick',
    signature: 'userNick',
    summary:
      'Your current nick, as a value not a call. Compare msg.from against it so a script does not answer itself.',
  },
  {
    name: 'appVersion',
    signature: 'appVersion',
    summary: 'The app version, as a value.',
  },
  {
    name: 'getConfig',
    signature: 'getConfig()',
    summary: "This script's own config object.",
  },

  // Sending
  {
    name: 'sendMessage',
    signature: 'sendMessage(channel, text, networkId?)',
    summary: 'Send a message to a channel or a nick.',
  },
  {
    name: 'sendCommand',
    signature: 'sendCommand(command, networkId?)',
    summary:
      'Run a slash command. Never pass an AI answer or channel text to this.',
  },
  {
    name: 'echo',
    signature: 'echo(target, text, networkId?)',
    summary:
      "Print a line into a tab, locally. Nothing is sent to IRC \u2014 mIRC's /echo. Prefer this over sendNotice for talking to your own user.",
  },
  {
    name: 'sendNotice',
    signature: 'sendNotice(target, text, networkId?)',
    summary: 'Send a NOTICE. Good for talking to yourself without flooding.',
  },
  {
    name: 'sendCTCP',
    signature: 'sendCTCP(target, type, params?, networkId?)',
    summary: 'Send a CTCP request.',
  },
  {
    name: 'action',
    signature: 'action(target, text, networkId?)',
    summary: 'Send a /me action.',
  },

  // Extending the app
  {
    name: 'registerCommand',
    signature: 'registerCommand(name, handler, description?)',
    summary:
      'Add your own slash command. handler(args, ctx) must return synchronously. The description is shown in autocomplete when someone types / and the first letters.',
  },
  {
    name: 'addMenuItem',
    signature: 'addMenuItem({ menu, label, onSelect })',
    summary:
      "Add an item to a long-press menu. menu is 'nick', 'channel' or 'tab'.",
  },

  // Channel operations
  {
    name: 'join',
    signature: 'join(channel, networkId?)',
    summary: 'Join a channel.',
  },
  {
    name: 'part',
    signature: 'part(channel, reason?, networkId?)',
    summary: 'Leave a channel.',
  },
  {
    name: 'kick',
    signature: 'kick(channel, nick, reason?, networkId?)',
    summary: 'Kick someone. Needs ops.',
  },
  {
    name: 'mode',
    signature: 'mode(target, modes, networkId?)',
    summary: 'Set modes on a channel or a nick.',
  },
  {
    name: 'op',
    signature: 'op(channel, nick, networkId?)',
    summary: 'Give ops.',
  },
  {
    name: 'deop',
    signature: 'deop(channel, nick, networkId?)',
    summary: 'Take ops away.',
  },
  {
    name: 'voice',
    signature: 'voice(channel, nick, networkId?)',
    summary: 'Give voice.',
  },
  {
    name: 'devoice',
    signature: 'devoice(channel, nick, networkId?)',
    summary: 'Take voice away.',
  },
  {
    name: 'ban',
    signature: 'ban(channel, mask, networkId?)',
    summary: 'Ban a mask.',
  },
  {
    name: 'unban',
    signature: 'unban(channel, mask, networkId?)',
    summary: 'Remove a ban.',
  },
  {
    name: 'banMask',
    signature: 'banMask(nick, banType?, networkId?)',
    summary:
      "The ban mask for a nick, the way the app builds it \u2014 mIRC's $mask(). Null when no host is known yet.",
    isAsync: true,
  },
  {
    name: 'getBanTypes',
    signature: 'getBanTypes()',
    summary: 'The mask types the app offers, with their numbers.',
  },
  {
    name: 'getReactions',
    signature: 'getReactions(messageId)',
    summary: 'Reactions on a message. The id comes from msg.msgid in a hook.',
  },
  {
    name: 'react',
    signature: 'react(messageId, emoji)',
    summary: 'Add or remove your reaction on a message. Toggles.',
    isAsync: true,
  },
  {
    name: 'getFavorites',
    signature: 'getFavorites(networkId?)',
    summary: 'Saved channels for a network.',
  },
  {
    name: 'isFavorite',
    signature: 'isFavorite(channel, networkId?)',
    summary: 'True when the channel is saved.',
  },
  {
    name: 'addFavorite',
    signature: 'addFavorite(channel, networkId?)',
    summary: 'Save a channel.',
    isAsync: true,
  },
  {
    name: 'removeFavorite',
    signature: 'removeFavorite(channel, networkId?)',
    summary: 'Unsave a channel.',
    isAsync: true,
  },
  {
    name: 'getAutoJoinChannels',
    signature: 'getAutoJoinChannels(networkId?)',
    summary: 'Saved channels marked to join on connect.',
  },
  {
    name: 'setAutoJoin',
    signature: 'setAutoJoin(channel, autoJoin, networkId?)',
    summary: 'Turn autojoin on or off for a saved channel.',
    isAsync: true,
  },
  {
    name: 'setTopic',
    signature: 'setTopic(channel, topic, networkId?)',
    summary: 'Change the channel topic.',
  },

  // You
  {
    name: 'changeNick',
    signature: 'changeNick(newNick, networkId?)',
    summary: 'Change your nick.',
  },
  {
    name: 'setAway',
    signature: 'setAway(reason?, networkId?)',
    summary: 'Mark yourself away.',
  },
  {
    name: 'back',
    signature: 'back(networkId?)',
    summary: 'Mark yourself back.',
  },
  {
    name: 'whois',
    signature: 'whois(nick, networkId?)',
    summary: 'Send a WHOIS.',
  },

  // Reading state
  {
    name: 'getChannelUsers',
    signature: 'getChannelUsers(channel, networkId?)',
    summary: 'Nicks in a channel, as an array of strings.',
  },
  {
    name: 'getChannels',
    signature: 'getChannels(networkId?)',
    summary: 'Channels you are in, as an array of strings.',
  },
  {
    name: 'getChannelList',
    signature: 'getChannelList(query?, networkId?)',
    summary:
      'The channel list already fetched, optionally filtered by name or topic. Reads the cache only \u2014 it never runs /LIST, which is expensive and some servers throttle it.',
    isAsync: true,
  },
  {
    name: 'getSharedChannels',
    signature: 'getSharedChannels(nick, networkId?)',
    summary: "Channels you are both in \u2014 mIRC's $comchan.",
  },
  {
    name: 'users.get',
    signature: 'users.get(nick, networkId?)',
    summary:
      "Everything known about one user - ident, host, account, certfp, away, shared channels - with where each fact came from. mIRC's $ial. Cache only; it never sends a WHOIS.",
  },
  {
    name: 'users.find',
    signature: 'users.find(mask, { account, certfp, channel, away, limit }?)',
    summary:
      'Users matching a hostmask, optionally filtered. Bounded result count.',
  },
  {
    name: 'users.onChannel',
    signature: 'users.onChannel(channel, networkId?)',
    summary: 'Every user record for one channel, with their prefix modes.',
  },
  {
    name: 'users.sharedChannels',
    signature: 'users.sharedChannels(nick, networkId?)',
    summary: 'Channels you are both in, read from the address list.',
  },
  {
    name: 'users.matchesMask',
    signature: 'users.matchesMask(user, mask)',
    summary:
      'Whether a user matches a hostmask, with full IRC wildcards. A component the user has no value for matches only *.',
  },
  {
    name: 'channelState.get',
    signature: 'channelState.get(channel, networkId?)',
    summary:
      'Topic with who set it and when, current modes and their parameters.',
  },
  {
    name: 'channelState.getList',
    signature:
      "channelState.getList(channel, 'ban'|'except'|'invite'|'quiet', networkId?)",
    summary:
      'A cached mask list with setter and time where the server sent them. status is "unknown" until fetched - which is NOT the same as empty.',
  },
  {
    name: 'server.get',
    signature: 'server.get(networkId?)',
    summary:
      'ISUPPORT tokens, negotiated capabilities, prefix and mode mappings, network name.',
  },
  {
    name: 'server.token',
    signature: 'server.token(name, networkId?)',
    summary:
      'One raw ISUPPORT token, including ones this app does not parse, so a new network needs no app release.',
  },
  {
    name: 'server.hasCapability',
    signature: 'server.hasCapability(capability, networkId?)',
    summary: 'Whether an IRCv3 capability was negotiated on this connection.',
  },
  {
    name: 'server.isChannel',
    signature: 'server.isChannel(target, networkId?)',
    summary:
      "Whether a target is a channel, by the server's own CHANTYPES rather than a guess at '#'.",
  },
  {
    name: 'files.read',
    signature: 'files.read(path)',
    summary:
      "mIRC's $read, inside your own directory. Paths are relative; traversal and absolute paths are refused. Returns { ok, value?, reason? }.",
    isAsync: true,
  },
  {
    name: 'files.write',
    signature: 'files.write(path, contents)',
    summary:
      'Writes a file in your own directory. Atomic: an interrupted write leaves the previous file intact.',
    isAsync: true,
  },
  {
    name: 'files.list',
    signature: 'files.list(directory?)',
    summary: 'Everything in your workspace, or in one directory of it.',
    isAsync: true,
  },
  {
    name: 'files.stat',
    signature: 'files.stat(path)',
    summary: 'Size, kind and modification time for one entry.',
    isAsync: true,
  },
  {
    name: 'files.remove',
    signature: 'files.remove(path)',
    summary: 'Deletes one file from your workspace.',
    isAsync: true,
  },
  {
    name: 'files.rename',
    signature: 'files.rename(from, to)',
    summary:
      'Renames a file. Both names are checked, so a rename cannot leave your workspace.',
    isAsync: true,
  },
  {
    name: 'files.usedBytes',
    signature: 'files.usedBytes()',
    summary: 'How much of your file quota is in use.',
    isAsync: true,
  },
  {
    name: 'parse.lines',
    signature: 'parse.lines(text)',
    summary: 'Splits text into lines, tolerating CRLF and a trailing newline.',
  },
  {
    name: 'parse.json',
    signature: 'parse.json(text)',
    summary:
      'JSON.parse that reports instead of throwing: returns { ok, value, error }.',
  },
  {
    name: 'parse.csv',
    signature: 'parse.csv(text)',
    summary:
      'RFC 4180 CSV: quoted fields may contain commas, quotes and newlines.',
  },
  {
    name: 'parse.ini',
    signature: 'parse.ini(text)',
    summary:
      'INI text. Keys before any [section] go under "", as $readini does.',
  },
  {
    name: 'format.lines',
    signature: 'format.lines(lines)',
    summary: 'Joins lines back into text with a trailing newline.',
  },
  {
    name: 'format.csv',
    signature: 'format.csv(rows)',
    summary:
      'Writes CSV, quoting a field only when it has to so a plain file stays readable.',
  },
  {
    name: 'format.ini',
    signature: 'format.ini(data)',
    summary: 'Writes INI text from { section: { key: value } }.',
  },
  {
    name: 'store.table',
    signature: 'store.table(name)',
    summary:
      "mIRC's hash tables, scoped to your script. Returns { get, set, has, keys, delete, increment, compareAndSet, batch, query, drop }. set() returns { ok, reason } rather than throwing when a quota is hit.",
  },
  {
    name: 'store.tables',
    signature: 'store.tables()',
    summary: 'The names of the tables your script owns.',
  },
  {
    name: 'store.usedBytes',
    signature: 'store.usedBytes()',
    summary: 'How much of your storage quota is in use.',
  },
  {
    name: 'secrets.set',
    signature: 'secrets.set(key, value)',
    summary:
      'Store a secret in the device Keychain. Excluded from every backup and export.',
    isAsync: true,
  },
  {
    name: 'secrets.get',
    signature: 'secrets.get(key)',
    summary: 'Read back one of your own secrets. No script can read another’s.',
    isAsync: true,
  },
  {
    name: 'secrets.has',
    signature: 'secrets.has(key)',
    summary: 'Whether one of your secrets exists, without reading it.',
    isAsync: true,
  },
  {
    name: 'secrets.delete',
    signature: 'secrets.delete(key)',
    summary: 'Removes one of your secrets.',
    isAsync: true,
  },
  {
    name: 'secrets.keys',
    signature: 'secrets.keys()',
    summary: 'Your secret names. Names only - values are never enumerable.',
    isAsync: true,
  },
  {
    name: 'signal',
    signature: 'signal(name, payload?, target?)',
    summary:
      "mIRC's /signal. Without a target it broadcasts to every other script; a broadcast never comes back to you. Returns { delivered, failed? }.",
  },
  {
    name: 'getChannelInfo',
    signature: 'getChannelInfo(channel, networkId?)',
    summary: 'Topic, modes and user count for one channel.',
  },
  {
    name: 'getTabs',
    signature: 'getTabs()',
    summary: 'Every open tab.',
  },
  {
    name: 'getActiveTab',
    signature: 'getActiveTab()',
    summary: 'The tab the user is looking at.',
  },
  {
    name: 'switchToTab',
    signature: 'switchToTab(tabId)',
    summary: 'Bring a tab to the front.',
  },
  {
    name: 'getUserInfo',
    signature: 'getUserInfo(nick, networkId?)',
    summary: 'What is known about a nick.',
    isAsync: true,
  },
  {
    name: 'isIgnored',
    signature: 'isIgnored(nick, networkId?)',
    summary: 'True when you have that nick on ignore.',
  },
  {
    name: 'isAnyAway',
    signature: 'isAnyAway()',
    summary: 'True when you are marked away on any network.',
  },
  {
    name: 'getUserActivity',
    signature: 'getUserActivity(nick, networkId?)',
    summary:
      'When a nick was last seen doing something, or undefined if nothing has been recorded.',
  },
  {
    name: 'getSpamLog',
    signature: 'getSpamLog(limit?)',
    summary:
      'What the flood protection caught, newest last. Default 50 lines, capped at 500.',
    isAsync: true,
  },
  {
    name: 'getConnectionStats',
    signature: 'getConnectionStats(networkId?)',
    summary: 'Uptime, lag and traffic counters.',
  },
  {
    name: 'getNetworkId',
    signature: 'getNetworkId()',
    summary: 'The network the user is currently on.',
  },
  {
    name: 'getAllNetworks',
    signature: 'getAllNetworks()',
    summary: 'Every configured network.',
  },
  {
    name: 'isConnected',
    signature: 'isConnected(networkId?)',
    summary: 'True when that network is connected.',
  },

  // Notes and aliases
  {
    name: 'getUserNote',
    signature: 'getUserNote(nick, networkId?)',
    summary: 'Your note about a nick.',
    isAsync: true,
  },
  {
    name: 'setUserNote',
    signature: 'setUserNote(nick, note, networkId?)',
    summary: 'Write a note about a nick.',
    isAsync: true,
  },
  {
    name: 'getUserAlias',
    signature: 'getUserAlias(nick, networkId?)',
    summary: 'The display name you gave a nick.',
    isAsync: true,
  },
  {
    name: 'setUserAlias',
    signature: 'setUserAlias(nick, alias, networkId?)',
    summary: 'Give a nick a display name.',
    isAsync: true,
  },
  {
    name: 'getChannelNote',
    signature: 'getChannelNote(channel, networkId?)',
    summary: 'Your note about a channel.',
    isAsync: true,
  },
  {
    name: 'setChannelNote',
    signature: 'setChannelNote(channel, note, networkId?)',
    summary: 'Write a note about a channel.',
    isAsync: true,
  },
  {
    name: 'isChannelBookmarked',
    signature: 'isChannelBookmarked(channel, networkId?)',
    summary: 'True when the channel is bookmarked.',
    isAsync: true,
  },

  // Highlights
  {
    name: 'getHighlightWords',
    signature: 'getHighlightWords()',
    summary: 'Your highlight words.',
  },
  {
    name: 'addHighlightWord',
    signature: 'addHighlightWord(word)',
    summary: 'Add a highlight word.',
    isAsync: true,
  },
  {
    name: 'removeHighlightWord',
    signature: 'removeHighlightWord(word)',
    summary: 'Remove a highlight word.',
    isAsync: true,
  },
  {
    name: 'isHighlighted',
    signature: 'isHighlighted(text)',
    summary: 'True when the text would highlight you.',
  },

  // History
  {
    name: 'getRecentMessages',
    signature: 'getRecentMessages(channel, limit?, networkId?)',
    summary:
      'The last messages in a channel, newest last. limit is capped at 200, default 50.',
    isAsync: true,
  },
  {
    name: 'searchHistory',
    signature:
      'searchHistory({ network?, channel?, from?, text?, startDate?, endDate?, limit? })',
    summary: 'Search stored history. limit is capped at 1000.',
    isAsync: true,
  },
  {
    name: 'getHistoryStats',
    signature: 'getHistoryStats(networkId?)',
    summary: 'How much history is stored, and for which channels.',
    isAsync: true,
  },

  // Settings and theme
  {
    name: 'getSetting',
    signature: 'getSetting(key)',
    summary: 'Read one app setting.',
    isAsync: true,
  },
  {
    name: 'getTheme',
    signature: 'getTheme()',
    summary:
      'The current theme: { name, isDark, colors }. Read it before choosing your own colours, so output stays readable on light and dark.',
  },
  {
    name: 'themeColour',
    signature: 'themeColour(role)',
    summary:
      'Resolve a semantic colour such as warning, error or messageText from the active theme.',
  },
  {
    name: 'setTheme',
    signature: 'setTheme(name)',
    summary:
      'Ask the user to approve changing to a built-in or custom theme. Returns true only after approval.',
    isAsync: true,
  },

  // Timers
  {
    name: 'setTimer',
    signature: 'setTimer(name, delayMs, repeat?)',
    summary: 'Fire onTimer(name) after a delay, once or repeatedly.',
  },
  {
    name: 'clearTimer',
    signature: 'clearTimer(name)',
    summary: 'Stop a timer.',
  },

  // Storage
  {
    name: 'getStorage',
    signature: 'getStorage(key)',
    summary: "Read from this script's own storage.",
    isAsync: true,
  },
  {
    name: 'setStorage',
    signature: 'setStorage(key, value)',
    summary: "Write to this script's own storage.",
    isAsync: true,
  },
  {
    name: 'listStorage',
    signature: 'listStorage(prefix?)',
    summary:
      "The keys this script stored, sorted. Without it you cannot iterate what you saved \u2014 mIRC's $hget(table, N).item.",
    isAsync: true,
  },
  {
    name: 'clearStorage',
    signature: 'clearStorage(prefix?)',
    summary:
      'Delete everything this script stored, or everything under a prefix. Returns how many went.',
    isAsync: true,
  },
  {
    name: 'removeStorage',
    signature: 'removeStorage(key)',
    summary: 'Delete one stored key.',
    isAsync: true,
  },

  // Odds and ends
  {
    name: 'bold',
    signature: 'bold(text)',
    summary: 'Wrap text in the bold control code.',
  },
  {
    name: 'italic',
    signature: 'italic(text)',
    summary: 'Wrap text in the italic control code.',
  },
  {
    name: 'underline',
    signature: 'underline(text)',
    summary: 'Wrap text in the underline control code.',
  },
  {
    name: 'colour',
    signature: 'colour(text, fg, bg?)',
    summary: 'Wrap text in IRC colour codes. 0-99.',
  },
  {
    name: 'strip',
    signature: 'strip(text)',
    summary:
      'Text with every colour and formatting code removed. Use before matching on what someone said.',
  },
  {
    name: 'rand',
    signature: 'rand(min, max)',
    summary: 'A random whole number between min and max.',
  },
  {
    name: 'list',
    signature: 'list(name)',
    summary: 'One of the built-in word lists, by name.',
  },
  {
    name: 'notify',
    signature: 'notify(title, text)',
    summary:
      'Put up a system notification. At most one a second, so a hook on every line cannot bury the shade.',
  },
  {
    name: 'setInput',
    signature: 'setInput(text)',
    summary:
      'Put text in the composer for the user to edit. It does NOT send it.',
  },
  {
    name: 'aiStatus',
    signature:
      "aiStatus(target, 'working'|'failed'|'done', { text?, kind?, retry?, networkId? })",
    summary:
      'Show what AI is doing in the strip above the composer. A failure can carry a retry command, which becomes a Retry button.',
  },
  {
    name: 'confirm',
    signature: 'confirm(question)',
    summary:
      'Ask a yes/no question. Resolves false if dismissed, so it never hangs.',
    isAsync: true,
  },
  {
    name: 'ask',
    signature: 'ask(question, options)',
    summary:
      'Ask the user to pick one of up to three choices. Resolves the choice, or null if dismissed.',
    isAsync: true,
  },
  {
    name: 'copyToClipboard',
    signature: 'copyToClipboard(text)',
    summary: 'Put text on the clipboard.',
  },
  {
    name: 'http',
    signature: 'http(url)',
    summary:
      'Fetch a page as text, or null. Only sites on the allowed list in Settings > AI, and never a private address.',
    isAsync: true,
  },
  {
    name: 'playSound',
    signature: 'playSound(name)',
    summary: 'Play one of the app sounds.',
  },
  {
    name: 'openLink',
    signature: 'openLink(url)',
    summary: 'Open a URL outside the app.',
  },
  {
    name: 'now',
    signature: 'now()',
    summary: 'The current time in milliseconds.',
  },
  {
    name: 'sleep',
    signature: 'sleep(ms)',
    summary: 'Wait. Capped at 10 seconds, and cannot be used in onRaw.',
    isAsync: true,
  },

  // AI namespace: completed as `api.ai`, then its own members below.
  {
    name: 'ai',
    signature: 'ai',
    summary: 'The AI namespace — api.ai.ask and friends.',
  },
];

export const API_MEMBERS = API_ENTRIES.map(entry => entry.name);

// --- api.ai.* ------------------------------------------------------------

export const AI_ENTRIES: VocabularyEntry[] = [
  {
    name: 'ask',
    signature:
      'ask(prompt, { provider?, maxTokens?, system?, channel?, network? })',
    summary:
      'One question, one answer. Resolves null on any failure. Name channel when the prompt carries what other people said.',
    isAsync: true,
  },
  {
    name: 'chat',
    signature:
      'chat(messages, { provider?, maxTokens?, system?, channel?, network? })',
    summary:
      'Multi-turn version of ask. messages is [{ role, content }]. Resolves null on failure.',
    isAsync: true,
  },
  {
    name: 'listProviders',
    signature: 'listProviders()',
    summary: 'Configured providers — id, name and model only.',
    isAsync: true,
  },
  {
    name: 'isAvailable',
    signature: 'isAvailable()',
    summary: 'True when a provider is set up and ready.',
    isAsync: true,
  },
];

export const AI_MEMBERS = AI_ENTRIES.map(entry => entry.name);

// --- Lookup --------------------------------------------------------------

const BY_NAME = new Map<string, VocabularyEntry>();
for (const entry of [...HOOK_ENTRIES, ...API_ENTRIES]) {
  BY_NAME.set(entry.name, entry);
}
// `api.ai.*` members are keyed separately: `chat` and `list` would otherwise
// collide with entries that mean something else.
const AI_BY_NAME = new Map(AI_ENTRIES.map(entry => [entry.name, entry]));

/**
 * The entry for a name, for the editor's completion list.
 *
 * `scope` matters because the same word can exist in both namespaces: `chat`
 * is `api.ai.chat`, and looking it up without saying so would find nothing.
 */
export function describeMember(
  name: string,
  scope: 'api' | 'ai' | 'hook' = 'api',
): VocabularyEntry | undefined {
  return scope === 'ai' ? AI_BY_NAME.get(name) : BY_NAME.get(name);
}

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

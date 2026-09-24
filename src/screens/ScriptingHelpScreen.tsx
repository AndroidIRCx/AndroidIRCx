/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { useT } from '../i18n/localization';
import { ModalSafeArea } from '../components/ModalSafeArea';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export const ScriptingHelpScreen: React.FC<Props> = ({ visible, onClose }) => {
  const { colors } = useTheme();
  const t = useT();
  const styles = createStyles(colors);

  if (!visible) return null;

  return (
    <ModalSafeArea style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('Scripting Help')}</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.link}>{t('Close')}</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{t('Quick Start')}</Text>
        <Text style={styles.text}>
          {t(
            'Scripts are plain JavaScript modules. Export hooks to react to events:',
          )}
        </Text>
        <Text style={styles.code}>
          {`module.exports = {
  onConnect: (networkId) => { /* ... */ },
  onDisconnect: (networkId, reason) => { /* ... */ },
  onMessage: (msg) => { /* msg.channel, msg.from, msg.text */ },
  onNotice: (msg) => { /* notice messages */ },
  onJoin: (channel, nick, msg) => { /* ... */ },
  onPart: (channel, nick, reason, msg) => { /* ... */ },
  onQuit: (nick, reason, msg) => { /* ... */ },
  onNickChange: (oldNick, newNick, msg) => { /* ... */ },
  onKick: (channel, kickedNick, kickerNick, reason, msg) => { /* ... */ },
  onMode: (channel, setterNick, mode, target, msg) => { /* ... */ },
  onTopic: (channel, topic, setterNick, msg) => { /* ... */ },
  onInvite: (channel, inviterNick, msg) => { /* ... */ },
  onCTCP: (type, from, text, msg) => { /* ... */ },
  onAction: (target, nick, text, msg) => { /* /me actions */ },
  onHighlight: (msg) => { /* your nick/word was mentioned */ },
  onRaw: (line, direction, msg) => { /* observe only */ },
  onNumeric: (code, params, text, msg) => { /* return false to hide default display */ },
  onTabOpen: (tab) => { /* ... */ },
  onTabClose: (tab) => { /* ... */ },
  onFileSent: (transfer) => { /* outgoing DCC completed */ },
  onFileReceived: (transfer) => { /* incoming DCC completed */ },
  onCommand: (text, ctx) => { /* return newText or { cancel: true } */ },
  onTimer: (name) => { /* timer fired */ },
};`}
        </Text>

        <Text style={styles.title}>{t('API')}</Text>
        <Text style={styles.sub}>{t('Available functions')}</Text>
        <Text style={styles.bullet}>
          {t('• api.log(text) — log to script log buffer')}
        </Text>
        <Text style={styles.bullet}>
          {t(
            '• onBan/onUnban, onOp/onDeop, onVoice/onDevoice, onHelp/onDehelp — parsed target mode changes',
          )}
        </Text>
        <Text style={styles.bullet}>
          {t(
            '• onUserMode / onServerMode — user or server-originated mode change',
          )}
        </Text>
        <Text style={styles.bullet}>
          {t('• api.sendMessage(channel, text, networkId?)')}
        </Text>
        <Text style={styles.bullet}>
          {t('• api.sendCommand(command, networkId?)')}
        </Text>
        <Text style={styles.bullet}>
          {t('• api.sendNotice(target, text, networkId?)')}
        </Text>
        <Text style={styles.bullet}>
          {t('• api.sendCTCP(target, type, params?, networkId?)')}
        </Text>
        <Text style={styles.bullet}>
          {t('• api.getChannelUsers(channel, networkId?) — returns string[]')}
        </Text>
        <Text style={styles.bullet}>
          {t('• api.getChannels(networkId?) — returns string[]')}
        </Text>
        <Text style={styles.bullet}>
          {t('• api.setTimer(name, delayMs, repeat?) — set timer')}
        </Text>
        <Text style={styles.bullet}>
          {t('• api.clearTimer(name) — clear timer')}
        </Text>
        <Text style={styles.bullet}>
          {t('• api.getNetworkId() — current network ID')}
        </Text>
        <Text style={styles.bullet}>
          {t('• api.isConnected(networkId?) — check connection')}
        </Text>
        <Text style={styles.bullet}>{t('• api.userNick — current nick')}</Text>
        <Text style={styles.bullet}>
          {t('• api.getConfig() — script config JSON')}
        </Text>

        <Text style={styles.sub}>{t('Custom commands & menus')}</Text>
        <Text style={styles.bullet}>
          {t(
            '• api.registerCommand(name, (args, ctx) => {}) — user types /name; ctx = { channel?, networkId?, nick? }',
          )}
        </Text>
        <Text style={styles.bullet}>
          {t(
            "• api.addMenuItem({ menu: 'nick'|'channel'|'tab', label, onSelect: (target, ctx) => {} })",
          )}
        </Text>

        <Text style={styles.sub}>{t('The wire, and the theme')}</Text>
        <Text style={styles.bullet}>
          {t(
            '• onRaw(line, direction, msg) sees every raw line in and out, after it has been written or read. Anything it returns is ignored.',
          )}
        </Text>
        <Text style={styles.bullet}>
          {t(
            '• That is deliberate: a script able to swallow raw protocol would only have to drop a PONG or a CAP END to hang its own connection with nothing to show why. Use onCommand to stop something going out.',
          )}
        </Text>
        <Text style={styles.bullet}>
          {t(
            '• api.getTheme() returns { name, isDark, colors }. Read it before choosing your own colours — a hardcoded palette clashes with whichever theme the user is actually on.',
          )}
        </Text>
        <Text style={styles.bullet}>
          {t(
            '• api.themeColour(role) resolves semantic colours such as warning, error or messageText. await api.setTheme(name) always asks you before it changes the app theme.',
          )}
        </Text>
        <Text style={styles.bullet}>
          {t(
            '• onNumeric(code, params, text, msg) receives parsed server numerics. Return false to hide only the default line; protocol handling still runs.',
          )}
        </Text>
        <Text style={styles.bullet}>
          {t(
            '• onTabOpen/onTabClose receive the tab. onFileSent/onFileReceived run once when a DCC transfer completes.',
          )}
        </Text>

        <Text style={styles.sub}>{t('Storage you can iterate')}</Text>
        <Text style={styles.bullet}>
          {t(
            '• await api.listStorage(prefix?) gives the keys this script saved. Without it you could write a value per nick but never count, iterate or clean them up.',
          )}
        </Text>
        <Text style={styles.bullet}>
          {t(
            '• await api.clearStorage(prefix?) deletes them and returns how many went. Each script sees only its own keys.',
          )}
        </Text>

        <Text style={styles.sub}>{t('Asking the user')}</Text>
        <Text style={styles.bullet}>
          {t(
            '• await api.confirm(question) resolves false if dismissed. await api.ask(question, options) resolves the choice, or null. Neither can leave a script waiting forever.',
          )}
        </Text>
        <Text style={styles.bullet}>
          {t(
            '• Buttons, not a text box: Android\u2019s alert has no text field, and three choices is what it holds.',
          )}
        </Text>

        <Text style={styles.sub}>{t('Formatting and cleanup')}</Text>
        <Text style={styles.bullet}>
          {t(
            '• api.bold, api.italic, api.underline, api.colour(text, fg, bg?) and api.strip(text). Remember strip: colour codes sit between you and any attempt to match what somebody said.',
          )}
        </Text>
        <Text style={styles.bullet}>
          {t(
            '• onUnload() runs when the script is switched off or replaced. Commands, menus and timers are cleared for you; this is for what only your script knows about. Must return synchronously.',
          )}
        </Text>
        <Text style={styles.bullet}>
          {t(
            '• api.getSharedChannels(nick) \u2014 channels you are both in, mIRC\u2019s $comchan.',
          )}
        </Text>

        <Text style={styles.sub}>{t('Bans and saved channels')}</Text>
        <Text style={styles.bullet}>
          {t(
            '• await api.banMask(nick, banType?, networkId?) builds a ban mask the way the app does \u2014 mIRC\u2019s $mask(). Null when no host is known yet, because a WHOIS has to have happened first and guessing would ban the wrong people. api.getBanTypes() lists the types.',
          )}
        </Text>
        <Text style={styles.bullet}>
          {t(
            '• api.getFavorites, isFavorite, addFavorite, removeFavorite, getAutoJoinChannels, setAutoJoin \u2014 the saved channel list.',
          )}
        </Text>

        <Text style={styles.sub}>{t('Looking around')}</Text>
        <Text style={styles.bullet}>
          {t(
            '• await api.getChannelList(query?, networkId?) reads the list already fetched and NEVER runs /LIST \u2014 that is thousands of lines on a big network and some servers throttle or disconnect over it. An empty array means there is no list, not that there are no channels.',
          )}
        </Text>
        <Text style={styles.bullet}>
          {t(
            '• api.isAnyAway(), api.getUserActivity(nick), await api.getSpamLog(limit?) \u2014 away state, when someone was last seen, and what the flood protection caught. The log is capped; it grows for as long as the app has been used.',
          )}
        </Text>
        <Text style={styles.bullet}>
          {t(
            '• await api.react(msg.msgid, emoji) toggles a reaction, api.getReactions(msg.msgid) reads them. Hooks give you the id as msg.msgid.',
          )}
        </Text>

        <Text style={styles.sub}>{t('Talking to your own user')}</Text>
        <Text style={styles.bullet}>
          {t(
            '• api.echo(target, text, networkId?) puts a line in that tab and sends NOTHING. This is mIRC\u2019s /echo and it is usually what you want.',
          )}
        </Text>
        <Text style={styles.bullet}>
          {t(
            '• api.sendNotice(target, text) is a real IRC NOTICE: it goes out and comes back, some networks throttle it, a few show it to other people. Use echo unless you mean to send.',
          )}
        </Text>
        <Text style={styles.bullet}>
          {t('• api.log(text) goes to the script log, for debugging.')}
        </Text>

        <Text style={styles.sub}>
          {t('Notifications, clipboard, composer')}
        </Text>
        <Text style={styles.bullet}>
          {t(
            '• api.notify(title, text) puts up a system notification. At most one a second, so a hook on every line cannot bury the shade.',
          )}
        </Text>
        <Text style={styles.bullet}>{t('• api.copyToClipboard(text)')}</Text>
        <Text style={styles.bullet}>
          {t(
            '• api.setInput(text) puts text in the composer for you to edit. It does NOT send it \u2014 which is the point when a model wrote it.',
          )}
        </Text>

        <Text style={styles.sub}>
          {t('Showing that something is happening')}
        </Text>
        <Text style={styles.bullet}>
          {t(
            "• api.aiStatus(target, 'working'|'failed'|'done', { text, retry, networkId }) drives the strip above the composer, where the typing indicator appears. retry becomes a Retry button that runs that command again.",
          )}
        </Text>
        <Text style={styles.bullet}>
          {t(
            '• Worth doing for anything slow. A script that thinks for ten seconds and says nothing looks exactly like one that is broken.',
          )}
        </Text>

        <Text style={styles.sub}>{t('Fetching a page')}</Text>
        <Text style={styles.bullet}>
          {t(
            '• await api.http(url) returns the page as text, or null. It uses the SAME allowlist as the assistant (Settings > AI > Sites the assistant may read), so there is one list of sites rather than two. Private addresses are refused whatever the list says, and a refusal is written to the script log.',
          )}
        </Text>

        <Text style={styles.sub}>{t('Action helpers')}</Text>
        <Text style={styles.bullet}>
          {t('• api.join(channel, networkId?)')}
        </Text>
        <Text style={styles.bullet}>
          {t('• api.part(channel, reason?, networkId?)')}
        </Text>
        <Text style={styles.bullet}>
          {t('• api.kick(channel, nick, reason?, networkId?)')}
        </Text>
        <Text style={styles.bullet}>
          {t('• api.mode(target, modes, networkId?)')}
        </Text>
        <Text style={styles.bullet}>
          {t('• api.op / api.deop / api.voice / api.devoice(channel, nick)')}
        </Text>
        <Text style={styles.bullet}>
          {t('• api.ban / api.unban(channel, mask)')}
        </Text>
        <Text style={styles.bullet}>{t('• api.setTopic(channel, topic)')}</Text>
        <Text style={styles.bullet}>
          {t('• api.changeNick(newNick) / api.setAway(reason?) / api.back()')}
        </Text>
        <Text style={styles.bullet}>{t('• api.whois(nick)')}</Text>
        <Text style={styles.bullet}>
          {t('• api.action(target, text, networkId?) — send a /me action')}
        </Text>

        <Text style={styles.sub}>{t('Sound & links')}</Text>
        <Text style={styles.bullet}>
          {t(
            '• api.playSound(name) — play a sound. name is either a built-in event (mention, private_message, join, kick, notice, notify, ctcp, disconnect, login, send, fail, ring, flood, op, deop) OR the name of a custom sound you added in Settings > Sounds. Respects your sound settings; max 1/second.',
          )}
        </Text>
        <Text style={styles.bullet}>
          {t(
            '• api.openLink(url) — open an http/https link. Always asks you to confirm first; max 1 every 3s.',
          )}
        </Text>
        <Text style={styles.bullet}>
          {t(
            '• Use YOUR OWN sound from your phone (preferred): open Settings > Sounds > Custom Sounds, add a sound, give it a name (e.g. "tada") and pick a file from your phone. Then call api.playSound("tada") in your script.',
          )}
        </Text>
        <Text style={styles.bullet}>
          {t(
            '• Or use an event slot: in Settings > Sounds assign a custom file to an event (e.g. Mention), then call api.playSound("mention") — it plays your custom file.',
          )}
        </Text>

        <Text style={styles.sub}>{t('Storage & utilities')}</Text>
        <Text style={styles.bullet}>
          {t('• api.getStorage(key) / api.setStorage(key, value) — persistent')}
        </Text>
        <Text style={styles.bullet}>
          {t('• api.rand(min, max) — random integer in [min, max]')}
        </Text>
        <Text style={styles.bullet}>
          {t(
            '• api.list(name) — persistent list: .add(line), .all(), .random(), .clear()',
          )}
        </Text>
        <Text style={styles.bullet}>
          {t('• api.isHighlighted(text) — matches your highlight words')}
        </Text>

        <Text style={styles.title}>{t('AI')}</Text>
        <Text style={styles.text}>
          {t(
            'Everything here is off until you turn it on, and the app never provides a model of its own. You bring your own API key, or point it at a model server on your own network.',
          )}
        </Text>

        <Text style={styles.sub}>{t('Setting it up')}</Text>
        <Text style={styles.bullet}>
          {t(
            '• Settings > AI > AI Providers > Add. Pick your provider, paste your key, then Load models and choose one.',
          )}
        </Text>
        <Text style={styles.bullet}>
          {t(
            '• Settings > AI > Privacy > Allow sending messages to a provider. Nothing leaves the phone until you agree to this. A local provider on your own network never asks.',
          )}
        </Text>
        <Text style={styles.bullet}>
          {t(
            '• Settings > AI > Privacy > Channels AI may read. Every channel is off until you switch it on, one at a time. The other people in a channel never agreed to have their words sent anywhere, which is why this is not a single yes.',
          )}
        </Text>
        <Text style={styles.bullet}>
          {t(
            '• You can also allow or stop a channel from its own tab: long-press the tab and use the AI item.',
          )}
        </Text>
        <Text style={styles.bullet}>
          {t(
            '• Remove identifying data, on by default, replaces nicknames with user1, user2… and strips IP addresses, hostmasks and e-mail addresses before anything is sent.',
          )}
        </Text>

        <Text style={styles.sub}>{t('The assistant')}</Text>
        <Text style={styles.bullet}>
          {t(
            '• Settings > AI > Assistant. Ask about your own session — which channels you are in, what you missed, who said what.',
          )}
        </Text>
        <Text style={styles.bullet}>
          {t(
            '• Reading happens straight away; anything that sends, joins or leaves stops and asks you first, one clear action at a time.',
          )}
        </Text>
        <Text style={styles.bullet}>
          {t(
            '• Long-press any message to copy it. If a turn fails, Try again resends the same question.',
          )}
        </Text>

        <Text style={styles.sub}>{t('Assistant conversations')}</Text>
        <Text style={styles.bullet}>
          {t(
            '• Tap the title at the top of the Assistant for the list. One conversation for drafting a script, one catching up on a channel — each keeps its own thread. New starts one, Delete removes one.',
          )}
        </Text>
        <Text style={styles.bullet}>
          {t(
            '• They are kept on this phone, so closing the screen or the app does not lose the thread. They are not deleted when you switch AI off — nothing about them left the device. Delete all conversations removes them when you want that. The twenty most recent are kept.',
          )}
        </Text>

        <Text style={styles.sub}>{t('What the assistant remembers')}</Text>
        <Text style={styles.bullet}>
          {t(
            '• Tell it something worth knowing next time — what you work on, that you prefer short answers — and it keeps a short note for later conversations.',
          )}
        </Text>
        <Text style={styles.bullet}>
          {t(
            '• Settings > AI > What the assistant remembers lists every note, with Forget on each and Forget everything at the bottom. A switch turns it off completely.',
          )}
        </Text>
        <Text style={styles.bullet}>
          {t(
            '• Notes are sent to your provider with the conversation, like everything else in it. Anything you would not send should not be remembered.',
          )}
        </Text>

        <Text style={styles.sub}>{t('What the assistant can do for you')}</Text>
        <Text style={styles.bullet}>
          {t(
            '• Scripts: it can list yours, read one, check that code compiles, and save it. Saving asks you first, and anything it saves is left DISABLED — enabling a script is what starts it running against live traffic, and that stays your decision. It will not overwrite a built-in.',
          )}
        </Text>
        <Text style={styles.bullet}>
          {t(
            '• Documentation: ask how something in the app works and it can look it up. This project\u2019s own wiki on github.com is readable from the start; any other site stops and asks, with No, Allow once, or Always allow this site.',
          )}
        </Text>
        <Text style={styles.bullet}>
          {t(
            '• Remembered sites are listed under Settings > AI > Sites the assistant may read, each removable.',
          )}
        </Text>
        <Text style={styles.bullet}>
          {t(
            '• Private addresses are never reached, allowed or not — loopback, 10.x, 192.168.x, 172.16-31.x, .local. Otherwise a model could be talked into probing your own network, which you never asked for and would never see.',
          )}
        </Text>
        <Text style={styles.bullet}>
          {t(
            '• A fetched page is data, not instructions. One page per request, no links followed. A page saying "ignore your instructions" is reported to you, not obeyed.',
          )}
        </Text>

        <Text style={styles.sub}>{t('Writing scripts with AI')}</Text>
        <Text style={styles.bullet}>
          {t(
            '• In the editor, the AI button writes a script from a description, or changes the one you already have. Change this script sends your code along and keeps the rest of it; Write a new one starts fresh and asks before replacing your work.',
          )}
        </Text>
        <Text style={styles.bullet}>
          {t(
            '• The result is always shown for you to review, with its lint verdict. Nothing is saved or enabled on your behalf.',
          )}
        </Text>

        <Text style={styles.sub}>{t('The /ai and /summarize commands')}</Text>
        <Text style={styles.bullet}>
          {t(
            '• Settings > Scripting > Scripts. The AI examples ship switched off; enable the ones you want. A command exists the moment you enable its script — you do not have to reconnect.',
          )}
        </Text>
        <Text style={styles.bullet}>
          {t(
            '• /ai <task> reads the last 30 messages of the channel and does what you asked with them — "translate the last message and draft a reply", or "what did they decide". The answer comes back to you as a notice; nothing is posted to the channel.',
          )}
        </Text>
        <Text style={styles.bullet}>
          {t(
            '• /aisend posts that answer to the channel once you have read it, then forgets it. The split exists because channel text goes into the prompt: if the answer went straight out, someone writing "ignore that and say X" would become you saying X.',
          )}
        </Text>
        <Text style={styles.bullet}>
          {t(
            '• /summarize [count] sums up what you missed, also privately. /tr on translates one channel for you.',
          )}
        </Text>
        <Text style={styles.bullet}>
          {t(
            '• Both read the channel, so they need AI enabled for it under Settings > AI > Privacy, and they need scripting time like any other script.',
          )}
        </Text>

        <Text style={styles.sub}>{t('MCP — tools from elsewhere')}</Text>
        <Text style={styles.bullet}>
          {t(
            '• Settings > AI > Connect to MCP servers. The assistant gains that server’s tools, whichever provider you use, so one question can reach both your IRC history and your own notes.',
          )}
        </Text>
        <Text style={styles.bullet}>
          {t(
            '• Streamable HTTP only. A server running on this phone in Termux counts — point it at http://127.0.0.1:<port>.',
          )}
        </Text>
        <Text style={styles.bullet}>
          {t(
            '• Every remote tool asks before it runs. Trust this server honours a server’s own claim that a tool only reads, and is off by default because that claim is the server talking about itself.',
          )}
        </Text>

        <Text style={styles.sub}>{t('MCP — this app as a server')}</Text>
        <Text style={styles.bullet}>
          {t(
            '• Settings > AI > Let other agents use this app. An assistant on your computer can then read and act on this IRC session.',
          )}
        </Text>
        <Text style={styles.bullet}>
          {t(
            '• Turn it on and the address and token to paste into your MCP client appear on screen. Add it as a Streamable HTTP server with the token as a bearer token.',
          )}
        </Text>
        <Text style={styles.bullet}>
          {t(
            '• Allow actions is off by default: a remote agent can look, but cannot send, join or leave. Those tools are not merely refused, they are never offered.',
          )}
        </Text>
        <Text style={styles.bullet}>
          {t(
            '• Who can reach it: Only this phone, My network, or Every connection. The last one includes mobile data and tethering, so use it deliberately and turn it off after. Both settings are locked while the server runs, and a fresh token is generated each time it starts.',
          )}
        </Text>

        <Text style={styles.sub}>{t('AI (your own API key)')}</Text>
        <Text style={styles.bullet}>
          {t(
            '• Set this up first in Settings > AI > AI Providers. You need your OWN API key (console.anthropic.com or platform.openai.com), or a model server on your network such as Ollama. A Claude Pro or ChatGPT Plus subscription does NOT work here — those plans include no API access.',
          )}
        </Text>
        <Text style={styles.bullet}>
          {t(
            '• await api.ai.ask(prompt, options?) — returns the answer text, or null if the call could not be made (the reason lands in the script log). options: { provider, maxTokens, system }.',
          )}
        </Text>
        <Text style={styles.bullet}>
          {t(
            '• await api.ai.chat(messages, options?) — same, for a multi-turn conversation. messages is [{ role: "user" | "assistant" | "system", content }].',
          )}
        </Text>
        <Text style={styles.bullet}>
          {t(
            '• await api.ai.isAvailable() / api.ai.listProviders() — check before asking. listProviders() returns { id, name, model } only; a script can never read an API key.',
          )}
        </Text>
        <Text style={styles.bullet}>
          {t(
            '• Limits per script: one call every 5 seconds, 100 per day, 2 at a time, 8000 characters per prompt. These stop a runaway script from flooding a channel and from spending your provider credit.',
          )}
        </Text>
        <Text style={styles.bullet}>
          {t(
            '• IMPORTANT — onRaw and onCommand must return immediately, so you cannot await an AI answer inside them. Return first, then send the answer with api.sendMessage when it arrives.',
          )}
        </Text>
        <Text style={styles.bullet}>
          {t(
            '• IMPORTANT — never feed an AI answer straight into api.sendCommand. Channel text goes into the prompt, so anyone present can try to steer the reply; an injected "/kick someone" would become a real kick. Send AI text as a message or notice.',
          )}
        </Text>
        <Text style={styles.bullet}>
          {t(
            '• IMPORTANT — if a script answers inside onMessage, make it ignore its own output (for example by tagging the text it sends), or two bots in one channel will answer each other forever.',
          )}
        </Text>

        <Text style={styles.title}>{t('Hooks')}</Text>
        <Text style={styles.sub}>{t('Connection Events')}</Text>
        <Text style={styles.bullet}>
          {t('• onConnect(networkId) — when connected')}
        </Text>
        <Text style={styles.bullet}>
          {t('• onDisconnect(networkId, reason?) — when disconnected')}
        </Text>
        <Text style={styles.sub}>{t('Message Events')}</Text>
        <Text style={styles.bullet}>
          {t('• onMessage(msg) — channel/query messages')}
        </Text>
        <Text style={styles.bullet}>
          {t('• onNotice(msg) — notice messages')}
        </Text>
        <Text style={styles.bullet}>
          {t('• onCTCP(type, from, text, msg) — CTCP requests')}
        </Text>
        <Text style={styles.bullet}>
          {t('• onAction(target, nick, text, msg) — /me actions')}
        </Text>
        <Text style={styles.bullet}>
          {t('• onHighlight(msg) — a highlight word was matched')}
        </Text>
        <Text style={styles.sub}>{t('Channel Events')}</Text>
        <Text style={styles.bullet}>
          {t('• onJoin(channel, nick, msg) — user joined')}
        </Text>
        <Text style={styles.bullet}>
          {t('• onPart(channel, nick, reason, msg) — user parted')}
        </Text>
        <Text style={styles.bullet}>
          {t('• onQuit(nick, reason, msg) — user quit')}
        </Text>
        <Text style={styles.bullet}>
          {t('• onNickChange(oldNick, newNick, msg) — nick changed')}
        </Text>
        <Text style={styles.bullet}>
          {t(
            '• onKick(channel, kickedNick, kickerNick, reason, msg) — user kicked',
          )}
        </Text>
        <Text style={styles.bullet}>
          {t(
            '• onMode(channel, setterNick, mode, target?, msg) — mode changed',
          )}
        </Text>
        <Text style={styles.bullet}>
          {t('• onTopic(channel, topic, setterNick, msg) — topic changed')}
        </Text>
        <Text style={styles.bullet}>
          {t('• onInvite(channel, inviterNick, msg) — channel invite')}
        </Text>
        <Text style={styles.sub}>{t('Other Events')}</Text>
        <Text style={styles.bullet}>
          {t('• onRaw(line, direction, msg?) — raw IRC line (in/out)')}
        </Text>
        <Text style={styles.bullet}>
          {t('• onPing / onPong — observing-only keepalive events')}
        </Text>
        <Text style={styles.bullet}>
          {t('• onServerNotice / onWallops / onServerError — server events')}
        </Text>
        <Text style={styles.bullet}>
          {t('• onNotifyOnline / onNotifyOffline — MONITOR/WATCH presence')}
        </Text>
        <Text style={styles.bullet}>
          {t('• onCommand(text, ctx) — outgoing command')}
        </Text>
        <Text style={styles.bullet}>
          {t(
            '• onInput(text, ctx) — transform/cancel submitted composer text; never receives secure form fields',
          )}
        </Text>
        <Text style={styles.bullet}>
          {t(
            '• onTabComplete(text, cursor, ctx) — return bounded synchronous composer suggestions',
          )}
        </Text>
        <Text style={styles.bullet}>{t('• onTimer(name) — timer fired')}</Text>
        <Text style={styles.bullet}>
          {t('• onTabActivate(previous, current) — active tab changed')}
        </Text>
        <Text style={styles.bullet}>
          {t('• onDccSendFailed / onDccReceiveFailed — file transfer failed')}
        </Text>
        <Text style={styles.bullet}>
          {t('• onAppStateChange(state) — app foreground/background state')}
        </Text>
        <Text style={styles.bullet}>
          {t('• onLoad / onStart — installation and enabled startup lifecycle')}
        </Text>

        <Text style={styles.title}>{t('Examples')}</Text>
        <Text style={styles.sub}>{t('Auto-op')}</Text>
        <Text style={styles.code}>
          {`module.exports = {
  onJoin: (channel, nick, msg) => {
    if (nick === api.userNick) return;
    api.sendCommand('MODE ' + channel + ' +o ' + nick);
  },
};`}
        </Text>
        <Text style={styles.sub}>{t('Welcome')}</Text>
        <Text style={styles.code}>
          {`module.exports = {
  onJoin: (channel, nick) => {
    api.sendMessage(channel, 'Welcome, ' + nick + '!');
  },
};`}
        </Text>
        <Text style={styles.sub}>{t('Alias (/hello)')}</Text>
        <Text style={styles.code}>
          {`module.exports = {
  onCommand: (text) => {
    if (text.startsWith('/hello')) return '/say Hello there!';
    return text;
  },
};`}
        </Text>
        <Text style={styles.sub}>{t('CTCP Responder')}</Text>
        <Text style={styles.code}>
          {`module.exports = {
  onCTCP: (type, from, text) => {
    if (type === 'VERSION') {
      api.sendCTCP(from, 'VERSION', 'AndroidIRCX');
    }
  },
};`}
        </Text>
        <Text style={styles.sub}>{t('Timer Example')}</Text>
        <Text style={styles.code}>
          {`module.exports = {
  onConnect: () => {
    api.setTimer('periodic', 60000, true); // every 60s
  },
  onTimer: (name) => {
    if (name === 'periodic') {
      api.log('Timer fired!');
    }
  },
  onDisconnect: () => {
    api.clearTimer('periodic');
  },
};`}
        </Text>
        <Text style={styles.sub}>{t('Kick Protection')}</Text>
        <Text style={styles.code}>
          {`module.exports = {
  onKick: (channel, kickedNick, kickerNick, reason) => {
    if (kickedNick === api.userNick) {
      api.sendCommand('JOIN ' + channel);
    }
  },
};`}
        </Text>
        <Text style={styles.sub}>{t('Custom Command (/opall)')}</Text>
        <Text style={styles.code}>
          {`// Call registerCommand at load time (top level), not inside a hook.
api.registerCommand('opall', (args, ctx) => {
  if (!ctx.channel) return;
  const users = api.getChannelUsers(ctx.channel, ctx.networkId);
  users.forEach(u => {
    if (u.startsWith('@')) return; // already op
    const nick = u.replace(/^[+%~&]/, '');
    if (nick && nick !== api.userNick) api.op(ctx.channel, nick, ctx.networkId);
  });
});
module.exports = {};`}
        </Text>
        <Text style={styles.sub}>{t('Context-Menu Item (Slap)')}</Text>
        <Text style={styles.code}>
          {`api.addMenuItem({
  menu: 'nick',
  label: 'Slap',
  onSelect: (nick, ctx) => {
    if (ctx.channel) api.action(ctx.channel, 'slaps ' + nick + ' with a trout');
  },
});
module.exports = {};`}
        </Text>
        <Text style={styles.sub}>{t('Mention Notifier')}</Text>
        <Text style={styles.code}>
          {`module.exports = {
  onHighlight: (msg) => {
    api.log('Mentioned in ' + msg.channel + ' by ' + msg.from);
    api.sendNotice(api.userNick, 'Mentioned by ' + msg.from, msg.network);
  },
};`}
        </Text>
        <Text style={styles.sub}>{t('Random Greeter (list)')}</Text>
        <Text style={styles.code}>
          {`module.exports = {
  onConnect: async () => {
    const g = api.list('greetings');
    if ((await g.all()).length === 0) await g.add('Welcome, $nick!');
  },
  onJoin: async (channel, nick, msg) => {
    if (nick === api.userNick) return;
    const line = await api.list('greetings').random();
    if (line) api.sendMessage(channel, line.replace('$nick', nick), msg?.network);
  },
};`}
        </Text>

        <Text style={styles.title}>{t('Tips')}</Text>
        <Text style={styles.bullet}>
          {t('• Scripts are disabled by default; enable each one.')}
        </Text>
        <Text style={styles.bullet}>
          {t('• Use Lint to catch syntax errors.')}
        </Text>
        <Text style={styles.bullet}>
          {t('• Enable logging to see script output/errors in the log tab.')}
        </Text>
        <Text style={styles.bullet}>
          {t('• onCommand can cancel send by returning { cancel: true }.')}
        </Text>
        <Text style={styles.bullet}>
          {t(
            '• onRaw observes raw IRC lines; use onNumeric to hide a numeric display safely.',
          )}
        </Text>
        <Text style={styles.bullet}>
          {t(
            '• Use timers for periodic tasks, remember to clear on disconnect.',
          )}
        </Text>
        <Text style={styles.bullet}>
          {t('• Check api.isConnected() before sending commands.')}
        </Text>
        <Text style={styles.bullet}>
          {t(
            '• Call registerCommand / addMenuItem at load time (top level), then export hooks.',
          )}
        </Text>
        <Text style={styles.bullet}>
          {t('• api.list(...) methods are async — remember to await them.')}
        </Text>

        <View style={styles.footerSpace} />
      </ScrollView>
    </ModalSafeArea>
  );
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      marginBottom: 8,
    },
    headerTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
    link: { color: colors.primary, fontWeight: '600' },
    body: { paddingHorizontal: 16 },
    title: {
      marginTop: 12,
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    sub: { marginTop: 8, fontSize: 14, fontWeight: '600', color: colors.text },
    text: { color: colors.text, marginTop: 4, lineHeight: 20 },
    bullet: { color: colors.text, marginTop: 4, lineHeight: 18 },
    code: {
      marginTop: 6,
      backgroundColor: colors.surfaceVariant,
      color: colors.text,
      padding: 8,
      borderRadius: 6,
      fontFamily: 'monospace',
    },
    footerSpace: { height: 40 },
  });

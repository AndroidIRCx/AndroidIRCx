import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { useT } from '../i18n/transifex';

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
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('Scripting Help')}</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.link}>{t('Close')}</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{t('Quick Start')}</Text>
        <Text style={styles.text}>
          {t('Scripts are plain JavaScript modules. Export hooks to react to events:')}
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
  onRaw: (line, direction, msg) => { /* return modified line or { cancel: true } */ },
  onCommand: (text, ctx) => { /* return newText or { cancel: true } */ },
  onTimer: (name) => { /* timer fired */ },
};`}
        </Text>

        <Text style={styles.title}>{t('API')}</Text>
        <Text style={styles.sub}>{t('Available functions')}</Text>
        <Text style={styles.bullet}>{t('• api.log(text) — log to script log buffer')}</Text>
        <Text style={styles.bullet}>{t('• api.sendMessage(channel, text, networkId?)')}</Text>
        <Text style={styles.bullet}>{t('• api.sendCommand(command, networkId?)')}</Text>
        <Text style={styles.bullet}>{t('• api.sendNotice(target, text, networkId?)')}</Text>
        <Text style={styles.bullet}>{t('• api.sendCTCP(target, type, params?, networkId?)')}</Text>
        <Text style={styles.bullet}>{t('• api.getChannelUsers(channel, networkId?) — returns string[]')}</Text>
        <Text style={styles.bullet}>{t('• api.getChannels(networkId?) — returns string[]')}</Text>
        <Text style={styles.bullet}>{t('• api.setTimer(name, delayMs, repeat?) — set timer')}</Text>
        <Text style={styles.bullet}>{t('• api.clearTimer(name) — clear timer')}</Text>
        <Text style={styles.bullet}>{t('• api.getNetworkId() — current network ID')}</Text>
        <Text style={styles.bullet}>{t('• api.isConnected(networkId?) — check connection')}</Text>
        <Text style={styles.bullet}>{t('• api.userNick — current nick')}</Text>
        <Text style={styles.bullet}>{t('• api.getConfig() — script config JSON')}</Text>

        <Text style={styles.title}>{t('Hooks')}</Text>
        <Text style={styles.sub}>{t('Connection Events')}</Text>
        <Text style={styles.bullet}>{t('• onConnect(networkId) — when connected')}</Text>
        <Text style={styles.bullet}>{t('• onDisconnect(networkId, reason?) — when disconnected')}</Text>
        <Text style={styles.sub}>{t('Message Events')}</Text>
        <Text style={styles.bullet}>{t('• onMessage(msg) — channel/query messages')}</Text>
        <Text style={styles.bullet}>{t('• onNotice(msg) — notice messages')}</Text>
        <Text style={styles.bullet}>{t('• onCTCP(type, from, text, msg) — CTCP requests')}</Text>
        <Text style={styles.sub}>{t('Channel Events')}</Text>
        <Text style={styles.bullet}>{t('• onJoin(channel, nick, msg) — user joined')}</Text>
        <Text style={styles.bullet}>{t('• onPart(channel, nick, reason, msg) — user parted')}</Text>
        <Text style={styles.bullet}>{t('• onQuit(nick, reason, msg) — user quit')}</Text>
        <Text style={styles.bullet}>{t('• onNickChange(oldNick, newNick, msg) — nick changed')}</Text>
        <Text style={styles.bullet}>{t('• onKick(channel, kickedNick, kickerNick, reason, msg) — user kicked')}</Text>
        <Text style={styles.bullet}>{t('• onMode(channel, setterNick, mode, target?, msg) — mode changed')}</Text>
        <Text style={styles.bullet}>{t('• onTopic(channel, topic, setterNick, msg) — topic changed')}</Text>
        <Text style={styles.bullet}>{t('• onInvite(channel, inviterNick, msg) — channel invite')}</Text>
        <Text style={styles.sub}>{t('Other Events')}</Text>
        <Text style={styles.bullet}>{t('• onRaw(line, direction, msg?) — raw IRC line (in/out)')}</Text>
        <Text style={styles.bullet}>{t('• onCommand(text, ctx) — outgoing command')}</Text>
        <Text style={styles.bullet}>{t('• onTimer(name) — timer fired')}</Text>

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

        <Text style={styles.title}>{t('Tips')}</Text>
        <Text style={styles.bullet}>{t('• Scripts are disabled by default; enable each one.')}</Text>
        <Text style={styles.bullet}>{t('• Use Lint to catch syntax errors.')}</Text>
        <Text style={styles.bullet}>{t('• Enable logging to see script output/errors in the log tab.')}</Text>
        <Text style={styles.bullet}>{t('• onCommand can cancel send by returning { cancel: true }.')}</Text>
        <Text style={styles.bullet}>{t('• onRaw can modify or cancel raw IRC lines.')}</Text>
        <Text style={styles.bullet}>{t('• Use timers for periodic tasks, remember to clear on disconnect.')}</Text>
        <Text style={styles.bullet}>{t('• Check api.isConnected() before sending commands.')}</Text>

        <View style={styles.footerSpace} />
      </ScrollView>
    </View>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 8 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  link: { color: colors.primary, fontWeight: '600' },
  body: { paddingHorizontal: 16 },
  title: { marginTop: 12, fontSize: 16, fontWeight: '700', color: colors.text },
  sub: { marginTop: 8, fontSize: 14, fontWeight: '600', color: colors.text },
  text: { color: colors.text, marginTop: 4, lineHeight: 20 },
  bullet: { color: colors.text, marginTop: 4, lineHeight: 18 },
  code: { marginTop: 6, backgroundColor: colors.surfaceVariant, color: colors.text, padding: 8, borderRadius: 6, fontFamily: 'monospace' },
  footerSpace: { height: 40 },
});

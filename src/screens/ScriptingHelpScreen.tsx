import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme } from '../hooks/useTheme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export const ScriptingHelpScreen: React.FC<Props> = ({ visible, onClose }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Scripting Help</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.link}>Close</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Quick Start</Text>
        <Text style={styles.text}>
          Scripts are plain JavaScript modules. Export hooks to react to events:
        </Text>
        <Text style={styles.code}>
{`module.exports = {
  onConnect: (networkId) => { /* ... */ },
  onMessage: (msg) => { /* msg.channel, msg.from, msg.text */ },
  onJoin: (channel, nick, msg) => { /* ... */ },
  onCommand: (text, ctx) => { /* return newText or { cancel: true } */ },
};`}
        </Text>

        <Text style={styles.title}>API</Text>
        <Text style={styles.sub}>Available functions</Text>
        <Text style={styles.bullet}>• api.log(text) — log to script log buffer</Text>
        <Text style={styles.bullet}>• api.sendMessage(channel, text, networkId?)</Text>
        <Text style={styles.bullet}>• api.sendCommand(command, networkId?)</Text>
        <Text style={styles.bullet}>• api.userNick — current nick</Text>
        <Text style={styles.bullet}>• api.getConfig() — script config JSON</Text>

        <Text style={styles.title}>Hooks</Text>
        <Text style={styles.bullet}>• onConnect(networkId)</Text>
        <Text style={styles.bullet}>• onMessage(msg)</Text>
        <Text style={styles.bullet}>• onJoin(channel, nick, msg)</Text>
        <Text style={styles.bullet}>• onCommand(text, ctx) ⇒ string | {"{ command, cancel }"}</Text>

        <Text style={styles.title}>Examples</Text>
        <Text style={styles.sub}>Auto-op</Text>
        <Text style={styles.code}>
{`module.exports = {
  onJoin: (channel, nick, msg) => {
    if (nick === api.userNick) return;
    api.sendCommand('MODE ' + channel + ' +o ' + nick);
  },
};`}
        </Text>
        <Text style={styles.sub}>Welcome</Text>
        <Text style={styles.code}>
{`module.exports = {
  onJoin: (channel, nick) => {
    api.sendMessage(channel, 'Welcome, ' + nick + '!');
  },
};`}
        </Text>
        <Text style={styles.sub}>Alias (/hello)</Text>
        <Text style={styles.code}>
{`module.exports = {
  onCommand: (text) => {
    if (text.startsWith('/hello')) return '/say Hello there!';
    return text;
  },
};`}
        </Text>

        <Text style={styles.title}>Tips</Text>
        <Text style={styles.bullet}>• Scripts are disabled by default; enable each one.</Text>
        <Text style={styles.bullet}>• Use Lint to catch syntax errors.</Text>
        <Text style={styles.bullet}>• Enable logging to see script output/errors in the log tab.</Text>
        <Text style={styles.bullet}>• onCommand can cancel send by returning {"{ cancel: true }"}.</Text>

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

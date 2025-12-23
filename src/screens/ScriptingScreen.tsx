import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Switch, TextInput, Modal, ScrollView, Alert, ActivityIndicator, useWindowDimensions } from 'react-native';
import { scriptingService, ScriptConfig, ScriptLogEntry } from '../services/ScriptingService';
import { adRewardService } from '../services/AdRewardService';
import { useTheme } from '../hooks/useTheme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export const ScriptingScreen: React.FC<Props> = ({ visible, onClose }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [scripts, setScripts] = useState<ScriptConfig[]>([]);
  const [loggingEnabled, setLoggingEnabled] = useState<boolean>(scriptingService.isLoggingEnabled());
  const [logs, setLogs] = useState<ScriptLogEntry[]>([]);
  const [repo, setRepo] = useState<ScriptConfig[]>([]);
  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState<ScriptConfig | null>(null);
  const [logFilter, setLogFilter] = useState<string | null>(null);
  const [showHighlight, setShowHighlight] = useState(false);
  const [remainingTime, setRemainingTime] = useState<string>('0s');
  const [hasTime, setHasTime] = useState<boolean>(false);
  const [adReady, setAdReady] = useState<boolean>(false);
  const [adLoading, setAdLoading] = useState<boolean>(false);
  const [adCooldown, setAdCooldown] = useState<boolean>(false);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);
  const [showingAd, setShowingAd] = useState<boolean>(false);
  const [adUnitType, setAdUnitType] = useState<string>('Primary');
  const highlightScrollRef = useRef<ScrollView | null>(null);
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const refresh = useCallback(async () => {
    await scriptingService.initialize();
    setScripts(scriptingService.list());
    setLoggingEnabled(scriptingService.isLoggingEnabled());
    setLogs(scriptingService.getLogs());
    setRepo(scriptingService.listRepository());
    setRemainingTime(adRewardService.getRemainingTimeFormatted());
    setHasTime(adRewardService.hasAvailableTime());

    const adStatus = adRewardService.getAdStatus();
    setAdReady(adStatus.ready);
    setAdLoading(adStatus.loading);
    setAdCooldown(adStatus.cooldown);
    setCooldownSeconds(adStatus.cooldownSeconds);
    setAdUnitType(adStatus.adUnitType);
  }, []);

  useEffect(() => {
    if (visible) {
      refresh();
    }
  }, [visible, refresh]);

  useEffect(() => {
    if (!visible) return;

    // Listen for time changes
    const unsubscribe = adRewardService.addListener((remainingMs) => {
      setRemainingTime(adRewardService.getRemainingTimeFormatted());
      setHasTime(adRewardService.hasAvailableTime());

      // Update ad status
      const adStatus = adRewardService.getAdStatus();
      setAdReady(adStatus.ready);
      setAdLoading(adStatus.loading);
      setAdCooldown(adStatus.cooldown);
      setCooldownSeconds(adStatus.cooldownSeconds);
      setAdUnitType(adStatus.adUnitType);

      // Refresh scripts list if time runs out to show disabled state
      if (remainingMs === 0) {
        setScripts(scriptingService.list());
      }
    });

    // Update ad status periodically (every second for countdown)
    const interval = setInterval(() => {
      const adStatus = adRewardService.getAdStatus();
      setAdReady(adStatus.ready);
      setAdLoading(adStatus.loading);
      setAdCooldown(adStatus.cooldown);
      setCooldownSeconds(adStatus.cooldownSeconds);
      setAdUnitType(adStatus.adUnitType);
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [visible]);

  const toggleScript = async (id: string, enabled: boolean) => {
    try {
      await scriptingService.setEnabled(id, enabled);
      setScripts(scriptingService.list());
    } catch (error) {
      Alert.alert('Cannot Enable Script', error instanceof Error ? error.message : 'Unknown error');
      setScripts(scriptingService.list());
    }
  };

  const handleWatchAd = async () => {
    console.log('👆 Watch Ad button clicked');
    console.log('Current state:', { adReady, adLoading, adCooldown, showingAd });

    if (showingAd) return;

    // If ad is ready, show it
    if (adReady) {
      console.log('✅ Ad is ready, showing ad...');
      setShowingAd(true);
      try {
        const success = await adRewardService.showRewardedAd();
        console.log('Show ad result:', success);
        if (success) {
          // Ad will call the reward callback automatically
          Alert.alert('Thank You!', 'You earned scripting time!');
        } else {
          Alert.alert('Ad Failed', 'Could not show the ad. Please try again.');
        }
      } catch (error) {
        console.error('Error showing ad:', error);
        Alert.alert('Error', error instanceof Error ? error.message : 'Failed to show ad');
      } finally {
        setShowingAd(false);
      }
      return;
    }

    // If ad is not ready, try to load it
    console.log('🔄 Ad not ready, attempting manual load...');
    const result = await adRewardService.manualLoadAd();
    console.log('Manual load result:', result);
    Alert.alert(
      result.success ? 'Loading Ad' : 'Cannot Load Ad',
      result.message
    );
  };

  const removeScript = async (id: string) => {
    await scriptingService.remove(id);
    setScripts(scriptingService.list());
  };

  const installBuiltIns = async () => {
    await scriptingService.installBuiltIns(scriptingService.getBuiltInScripts());
    setScripts(scriptingService.list());
  };

  const installFromRepo = async (id: string) => {
    const item = repo.find(r => r.id === id);
    if (!item) return;
    await scriptingService.add(item);
    setScripts(scriptingService.list());
  };

  const handleSaveScript = async () => {
    if (!editing) return;
    await scriptingService.remove(editing.id);
    await scriptingService.add(editing);
    setScripts(scriptingService.list());
    setShowEditor(false);
    setEditing(null);
  };

  const handleNewScript = () => {
    setEditing({
      id: `custom-${Date.now()}`,
      name: 'New Script',
      enabled: false,
      code: '// module.exports = { onMessage: (msg) => { /* ... */ } };',
      config: {},
    });
    setShowEditor(true);
  };

  const handleEdit = (script: ScriptConfig) => {
    setEditing({ ...script });
    setShowEditor(true);
  };

  const toggleLogging = async (value: boolean) => {
    await scriptingService.setLoggingEnabled(value);
    setLoggingEnabled(value);
  };

  const clearLogs = async () => {
    await scriptingService.clearLogs();
    setLogs([]);
  };

  const handleTestHook = (scriptId: string, hook: 'onConnect' | 'onMessage' | 'onJoin' | 'onCommand') => {
    scriptingService.testHook(scriptId, hook);
    setLogs(scriptingService.getLogs());
  };

  const handleLint = () => {
    if (!editing) return;
    const result = scriptingService.lint(editing.code);
    Alert.alert(result.ok ? 'Lint Passed' : 'Syntax Error', result.message);
  };
  
  const highlightParts = (code: string) => {
    const parts: { text: string; style: any }[] = [];
    const regex = /(\/\/.*$|\/\*[\s\S]*?\*\/|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|\b(function|const|let|var|return|if|else|for|while|switch|case|break|continue|new|class|extends|import|from|export|default|async|await|try|catch|throw)\b|\b\d+(\.\d+)?\b)/gm;
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(code)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ text: code.slice(lastIndex, match.index), style: styles.codeText });
      }
      const [full, , keyword] = match;
      if (full.startsWith('//') || full.startsWith('/*')) {
        parts.push({ text: full, style: styles.codeComment });
      } else if (full.startsWith('"') || full.startsWith("'") || full.startsWith('`')) {
        parts.push({ text: full, style: styles.codeString });
      } else if (keyword) {
        parts.push({ text: full, style: styles.codeKeyword });
      } else {
        parts.push({ text: full, style: styles.codeNumber });
      }
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < code.length) {
      parts.push({ text: code.slice(lastIndex), style: styles.codeText });
    }
    return parts;
  };

  const highlightedCode = useMemo(
    () => (showHighlight ? highlightParts(editing?.code ?? '') : []),
    [editing?.code, showHighlight]
  );

  const filteredLogs = logFilter ? logs.filter(l => l.scriptId === logFilter) : logs;

  const renderScript = ({ item }: { item: ScriptConfig }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.title}>{item.name}</Text>
          <Text style={styles.subtitle}>{item.id}</Text>
          {item.description ? <Text style={styles.subtitle}>{item.description}</Text> : null}
        </View>
        <Switch value={item.enabled} onValueChange={(v) => toggleScript(item.id, v)} />
      </View>
      <View style={styles.row}>
        <TouchableOpacity style={styles.button} onPress={() => handleEdit(item)}>
          <Text style={styles.buttonText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.danger]} onPress={() => removeScript(item.id)}>
          <Text style={[styles.buttonText, styles.dangerText]}>Delete</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={() => handleTestHook(item.id, 'onMessage')}>
          <Text style={styles.buttonText}>Test</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Scripts</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.close}>Close</Text>
          </TouchableOpacity>
        </View>

        {/* Scripting Time & Ad Reward Section */}
        <View style={styles.adRewardSection}>
          <View style={styles.timeDisplay}>
            <Text style={styles.timeLabel}>Scripting Time Remaining:</Text>
            <Text style={[styles.timeValue, !hasTime && styles.timeExpired]}>{remainingTime}</Text>
          </View>
          {adUnitType === 'Fallback' && (
            <Text style={[styles.subtitle, { marginBottom: 8, fontStyle: 'italic' }]}>
              Using fallback ad unit
            </Text>
          )}
          <TouchableOpacity
            style={[styles.watchAdButton, (showingAd) && styles.watchAdButtonDisabled]}
            onPress={handleWatchAd}
            disabled={showingAd}
          >
            {showingAd ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.watchAdButtonText}>
                {adReady
                  ? 'Watch Ad (+60 min)'
                  : adCooldown
                    ? `Cooldown (${cooldownSeconds}s)`
                    : adLoading
                      ? 'Loading Ad...'
                      : 'Request Ad'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
        {!hasTime && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              No scripting time available. Watch an ad to gain scripting access. Scripts will be automatically disabled when time runs out.
            </Text>
          </View>
        )}
        {!adReady && !adLoading && !adCooldown && (
          <View style={[styles.warningBox, { backgroundColor: '#2196F3' + '20', borderLeftColor: '#2196F3' }]}>
            <Text style={[styles.warningText, { color: '#2196F3' }]}>
              Tap "Request Ad" to load an ad from Google. First load may take a few moments.
            </Text>
          </View>
        )}
        {adCooldown && (
          <View style={[styles.warningBox, { backgroundColor: '#FF9800' + '20', borderLeftColor: '#FF9800' }]}>
            <Text style={[styles.warningText, { color: '#FF9800' }]}>
              Ads temporarily unavailable. The app works fine without them. Retrying in {cooldownSeconds}s...
            </Text>
          </View>
        )}

        <View style={styles.row}>
          <TouchableOpacity style={styles.button} onPress={handleNewScript}>
            <Text style={styles.buttonText}>New Script</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={installBuiltIns}>
            <Text style={styles.buttonText}>Install Built-ins</Text>
          </TouchableOpacity>
          <View style={styles.switchRow}>
            <Text style={styles.subtitle}>Logging</Text>
            <Switch value={loggingEnabled} onValueChange={toggleLogging} />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Repository</Text>
        {repo.length === 0 ? (
          <Text style={styles.subtitle}>No scripts in repository.</Text>
        ) : null}

        <FlatList
          data={scripts}
          keyExtractor={(item) => item.id}
          renderItem={renderScript}
          ListEmptyComponent={<Text style={styles.subtitle}>No scripts installed.</Text>}
          contentContainerStyle={styles.list}
        />

        <View style={styles.logHeader}>
          <Text style={styles.title}>Script Logs</Text>
          <TouchableOpacity onPress={clearLogs}>
            <Text style={styles.buttonText}>Clear</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.subtitle}>Filter by script</Text>
          <TextInput
            style={styles.input}
            placeholder="script id"
            placeholderTextColor={colors.textSecondary}
            value={logFilter || ''}
            onChangeText={(t) => setLogFilter(t || null)}
          />
        </View>
        <ScrollView style={styles.logBox}>
          {filteredLogs.length === 0 && <Text style={styles.subtitle}>No logs yet.</Text>}
          {filteredLogs.map((log) => (
            <Text key={log.id} style={styles.logLine}>
              [{new Date(log.ts).toLocaleTimeString()}] {log.level.toUpperCase()} {log.scriptId ? `[${log.scriptId}]` : ''} {log.message}
            </Text>
          ))}
        </ScrollView>
      </View>

      <Modal visible={showEditor} animationType="slide" onRequestClose={() => setShowEditor(false)}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Edit Script</Text>
            <TouchableOpacity onPress={() => setShowEditor(false)}>
              <Text style={styles.close}>Close</Text>
            </TouchableOpacity>
          </View>
          {editing && (
            <>
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                value={editing.name}
                onChangeText={(t) => setEditing({ ...editing, name: t })}
              />
              <View style={styles.switchRow}>
                <Text style={styles.subtitle}>Enabled</Text>
                <Switch value={editing.enabled} onValueChange={(v) => setEditing({ ...editing, enabled: v })} />
                <View style={{ width: 16 }} />
                <Text style={styles.subtitle}>Highlight</Text>
                <Switch value={showHighlight} onValueChange={setShowHighlight} />
              </View>
              <Text style={styles.label}>Code</Text>
              <View style={styles.codeEditorWrapper}>
                {showHighlight && (
                  <ScrollView
                    ref={highlightScrollRef}
                    style={styles.codeHighlight}
                    contentContainerStyle={styles.codeHighlightContent}
                    showsVerticalScrollIndicator={false}
                    scrollEnabled={false}
                  >
                    <Text style={styles.codeText}>
                      {highlightedCode.map((part, idx) => (
                        <Text key={idx} style={part.style}>
                          {part.text}
                        </Text>
                      ))}
                    </Text>
                  </ScrollView>
                )}
                <TextInput
                  style={[styles.codeInput, showHighlight && styles.codeInputOverlay]}
                  multiline
                  value={editing.code}
                  onChangeText={(t) => setEditing({ ...editing, code: t })}
                  onScroll={
                    showHighlight
                      ? (e) => {
                          const y = e.nativeEvent.contentOffset?.y || 0;
                          highlightScrollRef.current?.scrollTo({ y, animated: false });
                        }
                      : undefined
                  }
                  scrollEventThrottle={16}
                  selectionColor={colors.primary}
                  caretColor={colors.primary}
                />
              </View>
              <Text style={styles.label}>Config (JSON)</Text>
              <TextInput
                style={styles.codeInput}
                multiline
                value={JSON.stringify(editing.config || {}, null, 2)}
                onChangeText={(t) => {
                  try {
                    const parsed = JSON.parse(t || '{}');
                    setEditing({ ...editing, config: parsed });
                  } catch (err) {
                    Alert.alert('Invalid JSON', String(err));
                  }
                }}
              />
              <TouchableOpacity style={styles.button} onPress={handleSaveScript}>
                <Text style={styles.buttonText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.button} onPress={handleLint}>
                <Text style={styles.buttonText}>Lint</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </Modal>
    </Modal>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  close: { color: colors.primary, fontWeight: '600' },
  adRewardSection: { backgroundColor: colors.surface, padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  timeDisplay: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  timeLabel: { color: colors.text, fontSize: 14, fontWeight: '600' },
  timeValue: { color: colors.primary, fontSize: 18, fontWeight: '700' },
  timeExpired: { color: colors.error },
  watchAdButton: { backgroundColor: '#4CAF50', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center' },
  watchAdButtonDisabled: { backgroundColor: colors.border, opacity: 0.6 },
  watchAdButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  warningBox: { backgroundColor: colors.error + '20', padding: 12, borderRadius: 8, marginBottom: 8, borderLeftWidth: 4, borderLeftColor: colors.error },
  warningText: { color: colors.error, fontSize: 13, fontWeight: '600' },
  list: { paddingBottom: 12 },
  card: { backgroundColor: colors.surface, padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: colors.text, fontWeight: '700', fontSize: 16 },
  subtitle: { color: colors.textSecondary, fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 8 },
  button: { backgroundColor: colors.primary, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6 },
  buttonText: { color: colors.buttonText || '#fff', fontWeight: '600' },
  danger: { backgroundColor: colors.surface },
  dangerText: { color: colors.error },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { color: colors.text, fontWeight: '700', marginTop: 8, marginBottom: 4 },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  logBox: { backgroundColor: colors.surfaceVariant, padding: 8, borderRadius: 8, height: 180, marginTop: 4 },
  logLine: { color: colors.text, fontSize: 12, marginBottom: 4 },
  label: { color: colors.text, marginTop: 8, marginBottom: 4, fontWeight: '600' },
  input: { backgroundColor: colors.surfaceVariant, color: colors.text, padding: 8, borderRadius: 6, marginBottom: 8, fontFamily: 'monospace' },
  codeEditorWrapper: { position: 'relative', height: 240 },
  codeHighlight: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.surfaceVariant, borderRadius: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, pointerEvents: 'none', zIndex: 2, opacity: 0.95 },
  codeHighlightContent: { padding: 8 },
  codeInput: { backgroundColor: colors.surfaceVariant, color: colors.text, padding: 8, borderRadius: 6, height: 240, textAlignVertical: 'top', fontFamily: 'monospace', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, zIndex: 1 },
  codeInputOverlay: { backgroundColor: 'transparent' },
  syntax: { backgroundColor: 'transparent', padding: 0, fontSize: 13 },
  codeText: { color: colors.text, fontFamily: 'monospace' },
  codeKeyword: { color: '#c792ea', fontFamily: 'monospace' },
  codeString: { color: '#91b859', fontFamily: 'monospace' },
  codeComment: { color: '#9e9e9e', fontFamily: 'monospace' },
  codeNumber: { color: '#f78c6c', fontFamily: 'monospace' },
});

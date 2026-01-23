import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Switch, TextInput, Modal, ScrollView, Alert, ActivityIndicator, useWindowDimensions } from 'react-native';
import { scriptingService, ScriptConfig, ScriptLogEntry } from '../services/ScriptingService';
import { adRewardService } from '../services/AdRewardService';
import { inAppPurchaseService } from '../services/InAppPurchaseService';
import { useTheme } from '../hooks/useTheme';
import { useT } from '../i18n/transifex';
import Prism from 'prismjs';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';

interface Props {
  visible: boolean;
  onClose: () => void;
  onShowPurchaseScreen?: () => void;
}

export const ScriptingScreen: React.FC<Props> = ({ visible, onClose, onShowPurchaseScreen }) => {
  const { colors } = useTheme();
  const t = useT();
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
  const [hasUnlimitedScripting, setHasUnlimitedScripting] = useState<boolean>(false);
  const [adReady, setAdReady] = useState<boolean>(false);
  const [adLoading, setAdLoading] = useState<boolean>(false);
  const [adCooldown, setAdCooldown] = useState<boolean>(false);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);
  const [showingAd, setShowingAd] = useState<boolean>(false);
  const [adUnitType, setAdUnitType] = useState<string>('Primary');
  const [scriptingTimeActive, setScriptingTimeActive] = useState<boolean>(false);
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
    setHasUnlimitedScripting(inAppPurchaseService.hasUnlimitedScripting());
    setScriptingTimeActive(adRewardService.isTracking());

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

    // Update ad status and tracking status periodically (every second for countdown)
    const interval = setInterval(() => {
      const adStatus = adRewardService.getAdStatus();
      setAdReady(adStatus.ready);
      setAdLoading(adStatus.loading);
      setAdCooldown(adStatus.cooldown);
      setCooldownSeconds(adStatus.cooldownSeconds);
      setAdUnitType(adStatus.adUnitType);
      setScriptingTimeActive(adRewardService.isTracking());
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [visible]);

  const toggleScriptingTimeActive = useCallback((value: boolean) => {
    if (value) {
      // Start scripting time tracking (also enables no-ads mode)
      // For users with unlimited scripting, this will just enable the mode without tracking
      adRewardService.startUsageTracking();
    } else {
      // Stop scripting time tracking (also disables no-ads mode)
      adRewardService.stopUsageTracking();
    }
    // Update state immediately for better UX
    setScriptingTimeActive(value);
  }, []);

  const toggleScript = async (id: string, enabled: boolean) => {
    try {
      await scriptingService.setEnabled(id, enabled);
      setScripts(scriptingService.list());
    } catch (error) {
      Alert.alert(t('Cannot Enable Script'), error instanceof Error ? error.message : 'Unknown error');
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
          Alert.alert(t('Thank You!'), t('You earned scripting time!'));
        } else {
          Alert.alert(t('Ad Failed'), t('Could not show the ad. Please try again.'));
        }
      } catch (error) {
        console.error('Error showing ad:', error);
        Alert.alert(t('Error'), error instanceof Error ? error.message : t('Failed to show ad'));
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
      result.success ? t('Loading Ad') : t('Cannot Load Ad'),
      t(result.messageKey, result.messageParams as Record<string, any>)
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
      name: t('New Script'),
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
    Alert.alert(result.ok ? t('Lint Passed') : t('Syntax Error'), result.message);
  };
  
  const highlightPartsFallback = (code: string) => {
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

  const highlightParts = (code: string) => {
    try {
      const grammar = Prism.languages.javascript;
      if (!grammar) return highlightPartsFallback(code);

      const parts: { text: string; style: any }[] = [];
      const tokenStyle = (type: string | undefined) => {
        switch (type) {
          case 'comment':
            return styles.codeComment;
          case 'string':
            return styles.codeString;
          case 'keyword':
            return styles.codeKeyword;
          case 'number':
            return styles.codeNumber;
          default:
            return styles.codeText;
        }
      };
      const pushToken = (token: any, inheritedStyle: any) => {
        if (typeof token === 'string') {
          if (token.length) parts.push({ text: token, style: inheritedStyle });
          return;
        }
        if (Array.isArray(token)) {
          token.forEach(t => pushToken(t, inheritedStyle));
          return;
        }
        const nextStyle = tokenStyle(token.type) || inheritedStyle;
        pushToken(token.content, nextStyle);
      };

      const tokens = Prism.tokenize(code, grammar);
      pushToken(tokens, styles.codeText);
      return parts;
    } catch {
      return highlightPartsFallback(code);
    }
  };

  const highlightedCode = useMemo(
    () => (showHighlight ? highlightParts(editing?.code ?? '') : []),
    [editing?.code, showHighlight]
  );

  const filteredLogs = logFilter ? logs.filter(l => l.scriptId === logFilter) : logs;

  const renderScript = ({ item }: { item: ScriptConfig }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderText}>
          <Text style={styles.title}>{item.name}</Text>
          <Text style={styles.subtitle}>{item.id}</Text>
          {item.description ? <Text style={styles.subtitle}>{item.description}</Text> : null}
        </View>
        <Switch 
          value={item.enabled} 
          onValueChange={(v) => toggleScript(item.id, v)}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={item.enabled ? '#fff' : colors.textSecondary}
          style={{ transform: [{ scaleX: 1.15 }, { scaleY: 1.15 }] }}
        />
      </View>
      <View style={styles.row}>
        <TouchableOpacity style={styles.button} onPress={() => handleEdit(item)}>
          <Text style={styles.buttonText}>{t('Edit')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.danger]} onPress={() => removeScript(item.id)}>
          <Text style={[styles.buttonText, styles.dangerText]}>{t('Delete')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={() => handleTestHook(item.id, 'onMessage')}>
          <Text style={styles.buttonText}>{t('Test')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('Scripts')}</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.close}>{t('Close')}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
        >
          {/* Scripting Time & Ad Reward Section */}
          <View style={styles.adRewardSection}>
          <View style={styles.timeDisplay}>
            <Text style={styles.timeLabel}>{t('Scripting Time & No-Ads Remaining:')}</Text>
            <Text style={[styles.timeValue, !hasTime && styles.timeExpired]}>{remainingTime}</Text>
          </View>

          {/* Master Toggle for Scripting Time / No-Ads Mode */}
          <View style={[styles.masterToggleContainer, { backgroundColor: scriptingTimeActive ? colors.primary + '10' : colors.surface }]}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={[styles.timeLabel, { marginBottom: 4 }]}>
                {scriptingTimeActive ? '✅ ' : ''}{t('Scripting Time & No-Ads Active')}
              </Text>
              <Text style={[styles.subtitle, { fontSize: 12 }]}>
                {t('When ON: Time counts down, scripts can run, no banner ads')}
              </Text>
              {hasUnlimitedScripting && (
                <Text style={[styles.subtitle, { fontSize: 11, marginTop: 4, fontStyle: 'italic' }]}>
                  {t('Unlimited scripting: Toggle enables/disables no-ads mode')}
                </Text>
              )}
            </View>
            <Switch
              value={scriptingTimeActive}
              onValueChange={toggleScriptingTimeActive}
              disabled={!hasTime && !hasUnlimitedScripting}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={scriptingTimeActive ? '#fff' : colors.textSecondary}
              style={{ transform: [{ scaleX: 1.2 }, { scaleY: 1.2 }] }}
            />
          </View>
          {adUnitType === 'Fallback' && (
            <Text style={[styles.subtitle, { marginBottom: 8, fontStyle: 'italic' }]}>
              {t('Using fallback ad unit')}
            </Text>
          )}
          {/* Watch Ad button - always show for normal users, configurable for premium */}
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
                  ? t('Watch Ad (+60 min Scripting & No-Ads)')
                  : adCooldown
                    ? t('Cooldown ({cooldownSeconds}s)').replace('{cooldownSeconds}', cooldownSeconds.toString())
                    : adLoading
                      ? t('Loading Ad...')
                      : t('Request Ad')}
              </Text>
            )}
          </TouchableOpacity>
          {!hasUnlimitedScripting && onShowPurchaseScreen && (
            <TouchableOpacity
              style={[styles.upgradeButton]}
              onPress={() => {
                onClose();
                onShowPurchaseScreen();
              }}
            >
              <Text style={styles.upgradeButtonText}>
                💎 {t('Upgrade to Unlimited Scripting & No-Ads')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
          {!hasTime && !hasUnlimitedScripting && (
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>
                {t('No scripting time available. Watch an ad to gain 60 minutes of scripting time and no-ads. Scripts will be automatically disabled when time runs out.')}
              </Text>
            </View>
          )}
          {!adReady && !adLoading && !adCooldown && (
            <View style={[styles.warningBox, { backgroundColor: '#2196F3' + '20', borderLeftColor: '#2196F3' }]}>
              <Text style={[styles.warningText, { color: '#2196F3' }]}>
                {t('Tap "Request Ad" to load an ad from Google. First load may take a few moments.')}
              </Text>
            </View>
          )}
          {adCooldown && (
            <View style={[styles.warningBox, { backgroundColor: '#FF9800' + '20', borderLeftColor: '#FF9800' }]}>
              <Text style={[styles.warningText, { color: '#FF9800' }]}>
                {t('Ads temporarily unavailable. The app works fine without them. Retrying in {cooldownSeconds}s...').replace('{cooldownSeconds}', cooldownSeconds.toString())}
              </Text>
            </View>
          )}
          <View style={[styles.warningBox, { backgroundColor: '#2196F3' + '20', borderLeftColor: '#2196F3' }]}>
            <Text style={[styles.warningText, { color: '#2196F3' }]}>
              {t('Scripts run with full access to your local IRC data. Only install scripts you trust and avoid running scripts from unknown sources.')}
            </Text>
          </View>

          <View style={styles.row}>
          <TouchableOpacity style={styles.button} onPress={handleNewScript}>
            <Text style={styles.buttonText}>{t('New Script')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={installBuiltIns}>
            <Text style={styles.buttonText}>{t('Install Built-ins')}</Text>
          </TouchableOpacity>
          <View style={styles.switchRow}>
            <Text style={styles.subtitle}>{t('Logging')}</Text>
            <Switch 
              value={loggingEnabled} 
              onValueChange={toggleLogging}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={loggingEnabled ? '#fff' : colors.textSecondary}
              style={{ transform: [{ scaleX: 1.15 }, { scaleY: 1.15 }] }}
            />
          </View>
        </View>

          <Text style={styles.sectionTitle}>{t('Repository')}</Text>
          {repo.length === 0 ? (
            <Text style={styles.subtitle}>{t('No scripts in repository.')}</Text>
          ) : null}

          {scripts.length === 0 ? (
            <Text style={styles.subtitle}>{t('No scripts installed.')}</Text>
          ) : (
            scripts.map((item) => (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderText}>
                    <Text style={styles.title}>{item.name}</Text>
                    <Text style={styles.subtitle}>{item.id}</Text>
                    {item.description ? <Text style={styles.subtitle}>{item.description}</Text> : null}
                  </View>
                  <Switch value={item.enabled} onValueChange={(v) => toggleScript(item.id, v)} />
                </View>
                <View style={styles.row}>
                  <TouchableOpacity style={styles.button} onPress={() => handleEdit(item)}>
                    <Text style={styles.buttonText}>{t('Edit')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.button, styles.danger]} onPress={() => removeScript(item.id)}>
                    <Text style={[styles.buttonText, styles.dangerText]}>{t('Delete')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.button} onPress={() => handleTestHook(item.id, 'onMessage')}>
                    <Text style={styles.buttonText}>{t('Test')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}

          <View style={styles.logHeader}>
            <Text style={styles.title}>{t('Script Logs')}</Text>
            <TouchableOpacity onPress={clearLogs}>
              <Text style={styles.buttonText}>{t('Clear')}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.switchRow}>
            <Text style={styles.subtitle}>{t('Filter by script')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('script id')}
              placeholderTextColor={colors.textSecondary}
              value={logFilter || ''}
              onChangeText={(t) => setLogFilter(t || null)}
            />
          </View>
          <ScrollView style={styles.logBox} nestedScrollEnabled={true}>
            {filteredLogs.length === 0 && <Text style={styles.subtitle}>{t('No logs yet.')}</Text>}
            {filteredLogs.map((log) => (
              <Text key={log.id} style={styles.logLine}>
                [{new Date(log.ts).toLocaleTimeString()}] {log.level.toUpperCase()} {log.scriptId ? `[${log.scriptId}]` : ''} {log.message}
              </Text>
            ))}
          </ScrollView>
        </ScrollView>
      </View>

      <Modal visible={showEditor} animationType="slide" onRequestClose={() => setShowEditor(false)}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{t('Edit Script')}</Text>
            <TouchableOpacity onPress={() => setShowEditor(false)}>
              <Text style={styles.close}>{t('Close')}</Text>
            </TouchableOpacity>
          </View>
          {editing && (
            <>
              <Text style={styles.label}>{t('Name')}</Text>
              <TextInput
                style={styles.input}
                value={editing.name}
                onChangeText={(t) => setEditing({ ...editing, name: t })}
              />
              <View style={styles.switchRow}>
                <Text style={styles.subtitle}>{t('Enabled')}</Text>
                <Switch 
                  value={editing.enabled} 
                  onValueChange={(v) => setEditing({ ...editing, enabled: v })}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={editing.enabled ? '#fff' : colors.textSecondary}
                  style={{ transform: [{ scaleX: 1.15 }, { scaleY: 1.15 }] }}
                />
                <View style={{ width: 16 }} />
                <Text style={styles.subtitle}>{t('Highlight')}</Text>
                <Switch 
                  value={showHighlight} 
                  onValueChange={setShowHighlight}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={showHighlight ? '#fff' : colors.textSecondary}
                  style={{ transform: [{ scaleX: 1.15 }, { scaleY: 1.15 }] }}
                />
              </View>
              <Text style={styles.label}>{t('Code')}</Text>
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
              <Text style={styles.label}>{t('Config (JSON)')}</Text>
              <TextInput
                style={styles.codeInput}
                multiline
                value={JSON.stringify(editing.config || {}, null, 2)}
                onChangeText={(t) => {
                  try {
                    const parsed = JSON.parse(t || '{}');
                    setEditing({ ...editing, config: parsed });
                  } catch (err) {
                    Alert.alert(t('Invalid JSON'), String(err));
                  }
                }}
              />
              <TouchableOpacity style={styles.button} onPress={handleSaveScript}>
                <Text style={styles.buttonText}>{t('Save')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.button} onPress={handleLint}>
                <Text style={styles.buttonText}>{t('Lint')}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </Modal>
    </Modal>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  headerTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  close: { color: colors.primary, fontWeight: '600' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  adRewardSection: { backgroundColor: colors.surface, padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  timeDisplay: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  timeLabel: { color: colors.text, fontSize: 14, fontWeight: '600' },
  timeValue: { color: colors.primary, fontSize: 18, fontWeight: '700' },
  timeExpired: { color: colors.error },
  masterToggleContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  watchAdButton: { backgroundColor: '#4CAF50', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, alignItems: 'center', marginBottom: 8 },
  watchAdButtonDisabled: { backgroundColor: colors.border, opacity: 0.6 },
  watchAdButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  upgradeButton: { backgroundColor: '#FFB300', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, alignItems: 'center', borderWidth: 2, borderColor: '#FF8F00' },
  upgradeButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  warningBox: { backgroundColor: colors.error + '20', padding: 12, borderRadius: 8, marginBottom: 8, borderLeftWidth: 4, borderLeftColor: colors.error },
  warningText: { color: colors.error, fontSize: 13, fontWeight: '600' },
  list: { paddingBottom: 12 },
  card: { backgroundColor: colors.surface, padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardHeaderText: { flex: 1, marginRight: 12, minWidth: 0, flexShrink: 1 },
  title: { color: colors.text, fontWeight: '700', fontSize: 16 },
  subtitle: { color: colors.textSecondary, fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 8, flexWrap: 'wrap' },
  button: { backgroundColor: colors.primary, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 },
  buttonText: { color: colors.buttonText || '#fff', fontWeight: '600', fontSize: 13 },
  danger: { backgroundColor: colors.surface },
  dangerText: { color: colors.error },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { color: colors.text, fontWeight: '700', marginTop: 8, marginBottom: 4 },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  logBox: { backgroundColor: colors.surfaceVariant, padding: 8, borderRadius: 8, height: 180, marginTop: 4 },
  logLine: { color: colors.text, fontSize: 12, marginBottom: 4 },
  label: { color: colors.text, marginTop: 8, marginBottom: 4, fontWeight: '600' },
  input: { backgroundColor: colors.surfaceVariant, color: colors.text, padding: 8, borderRadius: 6, marginBottom: 8, fontFamily: 'monospace', flex: 1 },
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

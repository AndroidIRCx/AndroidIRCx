/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import {
  Animated,
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Switch,
  TextInput,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { ModalSafeArea } from '../components/ModalSafeArea';
import {
  scriptingService,
  ScriptConfig,
  ScriptLogEntry,
} from '../services/ScriptingService';
import { adRewardService } from '../services/AdRewardService';
import { scriptGenerator } from '../services/ai/ScriptGenerator';
import { aiService } from '../services/ai/AIService';
import { AIReadiness } from '../services/ai/types';
import { inAppPurchaseService } from '../services/InAppPurchaseService';
import { useTheme } from '../hooks/useTheme';
import { useT } from '../i18n/localization';
import Prism from 'prismjs';
import { formatClockTime } from '../utils/localeSafe';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { deriveSyntaxColors } from '../themes/syntaxColors';
import {
  AI_MEMBERS,
  API_MEMBERS,
  describeMember,
  HOOK_LIST,
  IRCX_HOOKS,
  JS_KEYWORDS,
} from '../config/scriptVocabulary';

// Teach Prism about the AndroidIRCX scripting vocabulary so the editor
// highlights our own hooks and `api.*` calls, not just plain JavaScript.
let ircxGrammarReady = false;
const ensureIrcxGrammar = () => {
  if (ircxGrammarReady || !Prism.languages.javascript) return;
  // Insert before `function-variable`, otherwise Prism tags a hook written as
  // an object key (`onAction: () => ...`) as a function-variable first.
  const target = Prism.languages.javascript['function-variable']
    ? 'function-variable'
    : 'function';
  Prism.languages.insertBefore('javascript', target, {
    'ircx-hook': { pattern: new RegExp('\\b(?:' + IRCX_HOOKS + ')\\b') },
    // `api.<anything>` — colours `api`, the dot and the method name; any
    // current or future api method is matched by the identifier pattern.
    'ircx-api-call': {
      pattern: /\bapi\s*\.\s*[A-Za-z_$][\w$]*/,
      inside: {
        'ircx-api': /\bapi\b/,
        punctuation: /\./,
        'ircx-method': /[A-Za-z_$][\w$]*/,
      },
    },
    'ircx-api': /\bapi\b/,
  });
  ircxGrammarReady = true;
};

// --- Editor autocomplete vocabulary ---
const WORD_POOL = Array.from(new Set([...HOOK_LIST, 'api', ...JS_KEYWORDS]));

interface Completion {
  items: string[];
  start: number; // index where the token being completed begins
  end: number; // index where it ends (caret)
  /**
   * Which namespace the suggestions came from, so the signature shown under
   * each one is looked up in the right place: `chat` means `api.ai.chat` after
   * `api.ai.`, and something else entirely on its own.
   */
  scope: 'api' | 'ai' | 'word';
}

// Compute completions for the token immediately before `caret` in `code`.
const completionsAt = (code: string, caret: number): Completion => {
  const before = code.slice(0, caret);
  // Nested namespace first: `api . ai . <partial>` — checked before the
  // plain member pattern, which would otherwise match `api.ai` and offer
  // the wrong set.
  const aiMember = before.match(/\bapi\s*\.\s*ai\s*\.\s*([A-Za-z_$][\w$]*)?$/);
  if (aiMember) {
    const prefix = aiMember[1] || '';
    const items = AI_MEMBERS.filter(m => m.startsWith(prefix)).slice(0, 8);
    return { items, start: caret - prefix.length, end: caret, scope: 'ai' };
  }
  // Member access: `api . <partial>`
  const member = before.match(/\bapi\s*\.\s*([A-Za-z_$][\w$]*)?$/);
  if (member) {
    const prefix = member[1] || '';
    const items = API_MEMBERS.filter(m => m.startsWith(prefix)).slice(0, 8);
    return { items, start: caret - prefix.length, end: caret, scope: 'api' };
  }
  // Bare word: hook names, `api`, keywords (need >= 2 chars to reduce noise)
  const word = before.match(/([A-Za-z_$][\w$]*)$/);
  if (word) {
    const prefix = word[1];
    if (prefix.length < 2) {
      return { items: [], start: caret, end: caret, scope: 'word' };
    }
    const items = WORD_POOL.filter(
      w => w.startsWith(prefix) && w !== prefix,
    ).slice(0, 8);
    return { items, start: caret - prefix.length, end: caret, scope: 'word' };
  }
  return { items: [], start: caret, end: caret, scope: 'word' };
};

interface Props {
  visible: boolean;
  onClose: () => void;
  onShowPurchaseScreen?: () => void;
}

export const ScriptingScreen: React.FC<Props> = ({
  visible,
  onClose,
  onShowPurchaseScreen,
}) => {
  const { colors } = useTheme();
  const t = useT();
  const styles = createStyles(colors);
  const masterToggleContentStyle = { flex: 1, marginRight: 12 };
  const titleSpacingStyle = { marginBottom: 4 };
  const compactSubtitleStyle = { fontSize: 12 };
  const italicSubtitleStyle = {
    fontSize: 11,
    marginTop: 4,
    fontStyle: 'italic' as const,
  };
  const fallbackSubtitleStyle = {
    marginBottom: 8,
    fontStyle: 'italic' as const,
  };
  const spacerStyle = { width: 16 };
  const accentBlueBorderStyle = { borderLeftColor: '#2196F3' };
  const accentBlueTextStyle = { color: '#2196F3' };
  const accentOrangeBorderStyle = { borderLeftColor: '#FF9800' };
  const accentOrangeTextStyle = { color: '#FF9800' };
  const [scripts, setScripts] = useState<ScriptConfig[]>([]);
  const [loggingEnabled, setLoggingEnabled] = useState<boolean>(
    scriptingService.isLoggingEnabled(),
  );
  const [logs, setLogs] = useState<ScriptLogEntry[]>([]);
  const [repo, setRepo] = useState<ScriptConfig[]>([]);
  const [showEditor, setShowEditor] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [generatorPrompt, setGeneratorPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [generatedLint, setGeneratedLint] = useState<string | null>(null);
  /**
   * Whether the generator changes the script in the editor or writes a fresh
   * one. It only means anything when the editor already holds code; opening
   * the generator on an empty script forces it off.
   */
  const [generatorEdits, setGeneratorEdits] = useState(true);
  const [aiBlocker, setAiBlocker] = useState<AIReadiness | null>(null);
  // Whether ANY provider exists. Someone who never asked for AI has none,
  // and should not be offered the button at all.
  const [aiConfigured, setAiConfigured] = useState(false);
  const [editing, setEditing] = useState<ScriptConfig | null>(null);
  const [logFilter, setLogFilter] = useState<string | null>(null);
  const [showHighlight, setShowHighlight] = useState(false);
  const [remainingTime, setRemainingTime] = useState<string>('0s');
  const [hasTime, setHasTime] = useState<boolean>(false);
  const [hasUnlimitedScripting, setHasUnlimitedScripting] =
    useState<boolean>(false);
  const [adReady, setAdReady] = useState<boolean>(false);
  const [adLoading, setAdLoading] = useState<boolean>(false);
  const [adCooldown, setAdCooldown] = useState<boolean>(false);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);
  const [showingAd, setShowingAd] = useState<boolean>(false);
  const [adUnitType, setAdUnitType] = useState<string>('Primary');
  const [scriptingTimeActive, setScriptingTimeActive] =
    useState<boolean>(false);
  /**
   * How far the code input is scrolled. The highlight layer is translated by
   * the negative of it, which is the only way the two stay aligned: a
   * ScrollView with scrolling disabled ignores scrollTo on Android.
   */
  const highlightOffset = useRef(new Animated.Value(0)).current;
  const highlightShift = useMemo(
    () => Animated.multiply(highlightOffset, -1),
    [highlightOffset],
  );
  const codeInputRef = useRef<React.ComponentRef<typeof TextInput> | null>(
    null,
  );
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (blurTimer.current) clearTimeout(blurTimer.current);
    },
    [],
  );
  const [selection, setSelection] = useState<{ start: number; end: number }>({
    start: 0,
    end: 0,
  });
  /**
   * Set only while the caret is being moved deliberately — after accepting a
   * completion, for instance — and released as soon as the field reports it
   * landed there.
   *
   * Feeding `selection` back into the input on every render instead is what
   * broke typing: each keystroke re-rendered the highlight layer, and the
   * caret was pushed back to where it had been before the character arrived.
   * It only showed up with highlight on because that render is the slow one.
   */
  const [caretTarget, setCaretTarget] = useState<{
    start: number;
    end: number;
  } | null>(null);
  const [completion, setCompletion] = useState<Completion>({
    items: [],
    start: 0,
    end: 0,
    scope: 'word',
  });
  const [editorFocused, setEditorFocused] = useState(false);

  // Recompute autocomplete suggestions as the code or caret changes.
  useEffect(() => {
    if (!editorFocused || !editing) {
      setCompletion({ items: [], start: 0, end: 0, scope: 'word' });
      return;
    }
    setCompletion(completionsAt(editing.code || '', selection.start));
  }, [editing, editorFocused, selection.start]);

  // Insert the chosen suggestion, replacing the token being typed.
  const acceptCompletion = useCallback(
    (word: string) => {
      if (!editing) return;
      const code = editing.code || '';
      const { start, end } = completionsAt(code, selection.start);
      const next = code.slice(0, start) + word + code.slice(end);
      const caret = start + word.length;
      if (blurTimer.current) clearTimeout(blurTimer.current);
      setEditing({ ...editing, code: next });
      setSelection({ start: caret, end: caret });
      setCaretTarget({ start: caret, end: caret });
      setCompletion({ items: [], start: 0, end: 0, scope: 'word' });
      codeInputRef.current?.focus();
    },
    [editing, selection.start],
  );

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
    const unsubscribe = adRewardService.addListener(remainingMs => {
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
      Alert.alert(
        t('Cannot Enable Script'),
        error instanceof Error ? error.message : 'Unknown error',
      );
      setScripts(scriptingService.list());
    }
  };

  const handleWatchAd = async () => {
    console.log('👆 Watch Ad button clicked');
    console.log('Current state:', {
      adReady,
      adLoading,
      adCooldown,
      showingAd,
    });

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
          Alert.alert(
            t('Ad Failed'),
            t('Could not show the ad. Please try again.'),
          );
        }
      } catch (error) {
        console.error('Error showing ad:', error);
        Alert.alert(
          t('Error'),
          error instanceof Error ? error.message : t('Failed to show ad'),
        );
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
      t(result.messageKey, result.messageParams as Record<string, any>),
    );
  };

  const removeScript = async (id: string) => {
    await scriptingService.remove(id);
    setScripts(scriptingService.list());
  };

  const installBuiltIns = async () => {
    await scriptingService.installBuiltIns(
      scriptingService.getBuiltInScripts(),
    );
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

  const handleTestHook = (
    scriptId: string,
    hook: 'onConnect' | 'onMessage' | 'onJoin' | 'onCommand',
  ) => {
    scriptingService.testHook(scriptId, hook);
    setLogs(scriptingService.getLogs());
  };

  useEffect(() => {
    if (!showEditor) return;
    // Hide the button only when there is no provider at all. Hiding it
    // because consent or a key is missing would make a button the user set
    // up disappear with no explanation; the modal's banner covers those.
    aiService
      .diagnose()
      .then(readiness => setAiConfigured(readiness.code !== 'no_provider'));
  }, [showEditor]);

  useEffect(() => {
    if (!showGenerator) return;
    aiService
      .diagnose()
      .then(readiness => setAiBlocker(readiness.ready ? null : readiness));
  }, [showGenerator]);

  /** Code the generator would be editing, or '' when there is nothing to edit. */
  const editableCode = editing?.code?.trim() ? editing.code : '';
  const willEdit = generatorEdits && editableCode !== '';

  // A freshly opened script starts at the top, and so must the layer.
  useEffect(() => {
    highlightOffset.setValue(0);
  }, [editing?.id, showHighlight, highlightOffset]);

  const openGenerator = () => {
    // Default to editing whenever there is something to edit — someone who
    // opens this from a script they wrote almost always means "change this",
    // and the old behaviour of always starting fresh threw that work away.
    setGeneratorEdits(editableCode !== '');
    setGeneratedCode(null);
    setGeneratedLint(null);
    setShowGenerator(true);
  };

  const handleGenerate = async () => {
    if (!generatorPrompt.trim()) return;
    setGenerating(true);
    setGeneratedCode(null);
    setGeneratedLint(null);
    try {
      const result = await scriptGenerator.generate(
        generatorPrompt,
        willEdit ? editableCode : undefined,
      );
      setGeneratedCode(result.code);
      // Show the lint verdict rather than silently trusting the model: a
      // script that cannot compile is worth knowing about before it is kept.
      setGeneratedLint(result.lint.ok ? null : result.lint.message);
    } catch (error: any) {
      Alert.alert(t('Could not generate'), String(error?.message ?? error));
    } finally {
      setGenerating(false);
    }
  };

  /** Put the generated code in the editor. It is never saved or enabled here. */
  const handleUseGenerated = () => {
    if (!editing || !generatedCode) return;
    const apply = () => {
      setEditing(current =>
        current ? { ...current, code: generatedCode } : current,
      );
      setShowGenerator(false);
      setGeneratedCode(null);
      setGeneratedLint(null);
      setGeneratorPrompt('');
    };

    // Writing a new script on top of one the user already has is the one case
    // where this button destroys work. Editing does not need the prompt: the
    // model was given the original and asked to keep it.
    if (!willEdit && editableCode !== '') {
      Alert.alert(
        t('Replace this script?'),
        t(
          'This will overwrite the code in the editor. It is not saved until you tap Save.',
        ),
        [
          { text: t('Cancel'), style: 'cancel' },
          { text: t('Replace'), style: 'destructive', onPress: apply },
        ],
      );
      return;
    }
    apply();
  };

  const handleLint = () => {
    if (!editing) return;
    const result = scriptingService.lint(editing.code);
    Alert.alert(
      result.ok ? t('Lint Passed') : t('Syntax Error'),
      result.message,
    );
  };

  const highlightPartsFallback = useCallback(
    (code: string) => {
      const parts: { text: string; style: any }[] = [];
      const regex =
        /(\/\/.*$|\/\*[\s\S]*?\*\/|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|\b(function|const|let|var|return|if|else|for|while|switch|case|break|continue|new|class|extends|import|from|export|default|async|await|try|catch|throw)\b|\b\d+(\.\d+)?\b)/gm;
      let lastIndex = 0;
      let match;
      while ((match = regex.exec(code)) !== null) {
        if (match.index > lastIndex) {
          parts.push({
            text: code.slice(lastIndex, match.index),
            style: styles.codeText,
          });
        }
        const [full, , keyword] = match;
        if (full.startsWith('//') || full.startsWith('/*')) {
          parts.push({ text: full, style: styles.codeComment });
        } else if (
          full.startsWith('"') ||
          full.startsWith("'") ||
          full.startsWith('`')
        ) {
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
    },
    [styles],
  );

  const highlightParts = useCallback(
    (code: string) => {
      try {
        ensureIrcxGrammar();
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
            case 'ircx-hook':
              return styles.codeHook;
            case 'ircx-api':
              return styles.codeApi;
            case 'ircx-method':
              return styles.codeApiMethod;
            default:
              return styles.codeText;
          }
        };
        const pushToken = (token: any, inheritedStyle: any) => {
          if (typeof token === 'string') {
            if (token.length)
              parts.push({ text: token, style: inheritedStyle });
            return;
          }
          if (Array.isArray(token)) {
            token.forEach(childToken => pushToken(childToken, inheritedStyle));
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
    },
    [highlightPartsFallback, styles],
  );

  const highlightedCode = useMemo(
    () => (showHighlight ? highlightParts(editing?.code ?? '') : []),
    [editing?.code, showHighlight, highlightParts],
  );

  const filteredLogs = logFilter
    ? logs.filter(l => l.scriptId === logFilter)
    : logs;

  const renderScript = ({ item }: { item: ScriptConfig }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderText}>
          <Text style={styles.title}>{item.name}</Text>
          <Text style={styles.subtitle}>{item.id}</Text>
          {item.description ? (
            <Text style={styles.subtitle}>{item.description}</Text>
          ) : null}
        </View>
        <Switch
          value={item.enabled}
          onValueChange={v => toggleScript(item.id, v)}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={item.enabled ? '#fff' : colors.textSecondary}
          style={{ transform: [{ scaleX: 1.15 }, { scaleY: 1.15 }] }}
        />
      </View>
      <View style={styles.row}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => handleEdit(item)}
        >
          <Text style={styles.buttonText}>{t('Edit')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.danger]}
          onPress={() => removeScript(item.id)}
        >
          <Text style={[styles.buttonText, styles.dangerText]}>
            {t('Delete')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.button}
          onPress={() => handleTestHook(item.id, 'onMessage')}
        >
          <Text style={styles.buttonText}>{t('Test')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <ModalSafeArea style={styles.container}>
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
              <Text style={styles.timeLabel}>
                {t('Scripting Time & No-Ads Remaining:')}
              </Text>
              <Text style={[styles.timeValue, !hasTime && styles.timeExpired]}>
                {remainingTime}
              </Text>
            </View>

            {/* Master Toggle for Scripting Time / No-Ads Mode */}
            <View
              style={[
                styles.masterToggleContainer,
                {
                  backgroundColor: scriptingTimeActive
                    ? colors.primary + '10'
                    : colors.surface,
                },
              ]}
            >
              <View style={masterToggleContentStyle}>
                <Text style={[styles.timeLabel, titleSpacingStyle]}>
                  {scriptingTimeActive ? '✅ ' : ''}
                  {t('Scripting Time & No-Ads Active')}
                </Text>
                <Text style={[styles.subtitle, compactSubtitleStyle]}>
                  {t(
                    'When ON: Time counts down, scripts can run, no banner ads',
                  )}
                </Text>
                {hasUnlimitedScripting && (
                  <Text style={[styles.subtitle, italicSubtitleStyle]}>
                    {t(
                      'Unlimited scripting: Toggle enables/disables no-ads mode',
                    )}
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
              <Text style={[styles.subtitle, fallbackSubtitleStyle]}>
                {t('Using fallback ad unit')}
              </Text>
            )}
            {/* Watch Ad button - always show for normal users, configurable for premium */}
            <TouchableOpacity
              style={[
                styles.watchAdButton,
                showingAd && styles.watchAdButtonDisabled,
              ]}
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
                      ? t('Cooldown ({cooldownSeconds}s)').replace(
                          '{cooldownSeconds}',
                          cooldownSeconds.toString(),
                        )
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
                {t(
                  'No scripting time available. Watch an ad to gain 60 minutes of scripting time and no-ads. Scripts will be automatically disabled when time runs out.',
                )}
              </Text>
            </View>
          )}
          {!adReady && !adLoading && !adCooldown && (
            <View
              style={[
                styles.warningBox,
                { backgroundColor: '#2196F3' + '20' },
                accentBlueBorderStyle,
              ]}
            >
              <Text style={[styles.warningText, accentBlueTextStyle]}>
                {t(
                  'Tap "Request Ad" to load an ad from Google. First load may take a few moments.',
                )}
              </Text>
            </View>
          )}
          {adCooldown && (
            <View
              style={[
                styles.warningBox,
                { backgroundColor: '#FF9800' + '20' },
                accentOrangeBorderStyle,
              ]}
            >
              <Text style={[styles.warningText, accentOrangeTextStyle]}>
                {t(
                  'Ads temporarily unavailable. The app works fine without them. Retrying in {cooldownSeconds}s...',
                ).replace('{cooldownSeconds}', cooldownSeconds.toString())}
              </Text>
            </View>
          )}
          <View
            style={[
              styles.warningBox,
              { backgroundColor: '#2196F3' + '20' },
              accentBlueBorderStyle,
            ]}
          >
            <Text style={[styles.warningText, accentBlueTextStyle]}>
              {t(
                'Scripts run with full access to your local IRC data. Only install scripts you trust and avoid running scripts from unknown sources.',
              )}
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
            <Text style={styles.subtitle}>
              {t('No scripts in repository.')}
            </Text>
          ) : null}

          {scripts.length === 0 ? (
            <Text style={styles.subtitle}>{t('No scripts installed.')}</Text>
          ) : (
            <FlatList
              data={scripts}
              keyExtractor={item => item.id}
              renderItem={renderScript}
              scrollEnabled={false}
            />
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
              onChangeText={value => setLogFilter(value || null)}
            />
          </View>
          <ScrollView style={styles.logBox} nestedScrollEnabled={true}>
            {filteredLogs.length === 0 && (
              <Text style={styles.subtitle}>{t('No logs yet.')}</Text>
            )}
            {filteredLogs.map(log => (
              <Text key={log.id} style={styles.logLine}>
                [{formatClockTime(log.ts, '24h')}] {log.level.toUpperCase()}{' '}
                {log.scriptId ? `[${log.scriptId}]` : ''} {log.message}
              </Text>
            ))}
          </ScrollView>
        </ScrollView>
      </ModalSafeArea>

      <Modal
        visible={showEditor}
        animationType="slide"
        onRequestClose={() => setShowEditor(false)}
        statusBarTranslucent
        navigationBarTranslucent
      >
        <ModalSafeArea style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{t('Edit Script')}</Text>
            <TouchableOpacity onPress={() => setShowEditor(false)}>
              <Text style={styles.close}>{t('Close')}</Text>
            </TouchableOpacity>
          </View>
          {editing && (
            <>
              {/*
                Scrollable, because the editor used to be a fixed column: in
                landscape the buttons sat below the fold with no way to reach
                them. `keyboardShouldPersistTaps` keeps the autocomplete list
                tappable while the keyboard is up.
              */}
              <ScrollView
                style={styles.editorBody}
                contentContainerStyle={styles.editorBodyContent}
                keyboardShouldPersistTaps="handled"
              >
                <TextInput
                  style={styles.nameInput}
                  value={editing.name}
                  placeholder={t('Script name')}
                  placeholderTextColor={colors.textSecondary}
                  onChangeText={value =>
                    setEditing({ ...editing, name: value })
                  }
                />
                <View style={styles.switchRow}>
                  <Text style={styles.subtitle}>{t('Enabled')}</Text>
                  <Switch
                    value={editing.enabled}
                    onValueChange={v => setEditing({ ...editing, enabled: v })}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor={editing.enabled ? '#fff' : colors.textSecondary}
                    style={{ transform: [{ scaleX: 1.15 }, { scaleY: 1.15 }] }}
                  />
                  <View style={spacerStyle} />
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
                    <Animated.View
                      testID="script-highlight-layer"
                      pointerEvents="none"
                      style={[
                        styles.codeHighlight,
                        { transform: [{ translateY: highlightShift }] },
                      ]}
                    >
                      <Text style={styles.codeText}>
                        {highlightedCode.map((part, idx) => (
                          <Text key={idx} style={part.style}>
                            {part.text}
                          </Text>
                        ))}
                      </Text>
                    </Animated.View>
                  )}
                  <TextInput
                    ref={codeInputRef}
                    style={[
                      styles.codeInput,
                      showHighlight && styles.codeInputOverlay,
                    ]}
                    multiline
                    value={editing.code}
                    selection={
                      caretTarget
                        ? {
                            start: Math.min(
                              caretTarget.start,
                              editing.code.length,
                            ),
                            end: Math.min(caretTarget.end, editing.code.length),
                          }
                        : undefined
                    }
                    onSelectionChange={e => {
                      const next = e.nativeEvent.selection;
                      setSelection(next);
                      // The caret arrived where it was sent, so hand control of
                      // it back to the field.
                      if (
                        caretTarget &&
                        next.start === caretTarget.start &&
                        next.end === caretTarget.end
                      ) {
                        setCaretTarget(null);
                      }
                    }}
                    onFocus={() => {
                      if (blurTimer.current) clearTimeout(blurTimer.current);
                      setEditorFocused(true);
                    }}
                    onBlur={() => {
                      blurTimer.current = setTimeout(
                        () => setEditorFocused(false),
                        200,
                      );
                    }}
                    onKeyPress={e => {
                      if (
                        e.nativeEvent.key === 'Tab' &&
                        completion.items.length > 0
                      ) {
                        acceptCompletion(completion.items[0]);
                      }
                    }}
                    onChangeText={value => {
                      // Typing releases the caret unconditionally: if a forced
                      // position were ever left set, every keystroke after it
                      // would be dragged back to the same spot.
                      setCaretTarget(null);
                      setEditing({ ...editing, code: value });
                    }}
                    onScroll={
                      showHighlight
                        ? e => {
                            // Shift the layer rather than scrolling it. The
                            // old code called scrollTo on a ScrollView with
                            // scrollEnabled={false}, which Android ignores, so
                            // the two layers drifted apart and the editor
                            // showed two different parts of the script at once.
                            highlightOffset.setValue(
                              e.nativeEvent.contentOffset?.y || 0,
                            );
                          }
                        : undefined
                    }
                    selectionColor={colors.primary}
                    cursorColor={colors.primary}
                  />
                </View>
                {editorFocused && completion.items.length > 0 && (
                  <View style={styles.autocompleteBox}>
                    <ScrollView
                      keyboardShouldPersistTaps="always"
                      nestedScrollEnabled
                      style={styles.autocompleteList}
                    >
                      {completion.items.map((item, idx) => {
                        // The signature and summary are the point: a list of
                        // bare names cannot say whether `userNick` is a value
                        // or a call, or what `setTimer` wants.
                        const entry = describeMember(
                          item,
                          completion.scope === 'ai' ? 'ai' : 'api',
                        );
                        return (
                          <TouchableOpacity
                            key={item}
                            style={[
                              styles.autocompleteItem,
                              idx === 0 && styles.autocompleteItemFirst,
                            ]}
                            onPress={() => acceptCompletion(item)}
                          >
                            <View style={styles.autocompleteHead}>
                              <Text style={styles.autocompleteText}>
                                {entry?.signature ?? item}
                              </Text>
                              <Text style={styles.autocompleteTag}>
                                {entry?.isAsync
                                  ? t('async')
                                  : HOOK_LIST.includes(item)
                                    ? t('hook')
                                    : completion.scope === 'ai'
                                      ? t('api.ai')
                                      : API_MEMBERS.includes(item)
                                        ? t('api')
                                        : t('keyword')}
                              </Text>
                            </View>
                            {!!entry?.summary && (
                              <Text
                                style={styles.autocompleteDoc}
                                numberOfLines={2}
                              >
                                {entry.summary}
                              </Text>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
                <Text style={styles.label}>{t('Config (JSON)')}</Text>
                <TextInput
                  style={styles.codeInput}
                  multiline
                  value={JSON.stringify(editing.config || {}, null, 2)}
                  onChangeText={jsonText => {
                    try {
                      const parsed = JSON.parse(jsonText || '{}');
                      setEditing({ ...editing, config: parsed });
                    } catch (err) {
                      Alert.alert(t('Invalid JSON'), String(err));
                    }
                  }}
                />
              </ScrollView>

              {/*
                Pinned below the scroll area so Save is always one tap away,
                whichever way the phone is held.
              */}
              <View style={styles.editorActions}>
                <TouchableOpacity
                  style={[styles.editorAction, styles.editorActionPrimary]}
                  onPress={handleSaveScript}
                >
                  <Icon name="save" size={15} color={colors.onPrimary} solid />
                  <Text style={styles.editorActionPrimaryText}>
                    {t('Save')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.editorAction}
                  onPress={handleLint}
                >
                  <Icon name="check-circle" size={15} color={colors.primary} />
                  <Text style={styles.editorActionText}>{t('Lint')}</Text>
                </TouchableOpacity>
                {aiConfigured && (
                  <TouchableOpacity
                    style={styles.editorAction}
                    onPress={openGenerator}
                    // The visible label is short so three buttons fit a phone
                    // in portrait; the full one is still announced.
                    accessibilityLabel={t('Generate with AI')}
                  >
                    <Icon name="robot" size={15} color={colors.primary} />
                    <Text style={styles.editorActionText}>{t('AI')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}
        </ModalSafeArea>

        <Modal
          visible={showGenerator}
          animationType="slide"
          statusBarTranslucent
          navigationBarTranslucent
          onRequestClose={() => setShowGenerator(false)}
        >
          <ModalSafeArea style={styles.container}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>{t('Generate with AI')}</Text>
              <TouchableOpacity onPress={() => setShowGenerator(false)}>
                <Text style={styles.close}>{t('Close')}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.generatorBody}>
              <Text style={styles.subtitle}>
                {willEdit
                  ? t(
                      'Describe the change you want. Your script is sent along so the rest of it is kept. The result is shown for you to review — it is never saved or enabled on its own.',
                    )
                  : t(
                      'Describe what the script should do. The generated code is shown for you to review — it is never saved or enabled on its own.',
                    )}
              </Text>

              {editableCode !== '' && (
                <View style={styles.generatorModes}>
                  <TouchableOpacity
                    style={[
                      styles.generatorMode,
                      generatorEdits && styles.generatorModeActive,
                    ]}
                    onPress={() => setGeneratorEdits(true)}
                  >
                    <Text
                      style={[
                        styles.generatorModeText,
                        generatorEdits && styles.generatorModeTextActive,
                      ]}
                    >
                      {t('Change this script')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.generatorMode,
                      !generatorEdits && styles.generatorModeActive,
                    ]}
                    onPress={() => setGeneratorEdits(false)}
                  >
                    <Text
                      style={[
                        styles.generatorModeText,
                        !generatorEdits && styles.generatorModeTextActive,
                      ]}
                    >
                      {t('Write a new one')}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
              {aiBlocker && (
                <View style={styles.generatorBlocker}>
                  <Text style={styles.generatorBlockerReason}>
                    {aiBlocker.reason}
                  </Text>
                  <Text style={styles.generatorBlockerWhere}>
                    {aiBlocker.where}
                  </Text>
                </View>
              )}

              <Text style={styles.label}>
                {willEdit ? t('Change to make') : t('Description')}
              </Text>
              <TextInput
                style={styles.generatorInput}
                value={generatorPrompt}
                onChangeText={setGeneratorPrompt}
                multiline
                placeholder={
                  willEdit
                    ? t('e.g. only greet people once per day, not every join')
                    : t(
                        'e.g. greet people who join #chat, but only once per nick per day',
                      )
                }
                placeholderTextColor={colors.textSecondary}
              />
              <TouchableOpacity
                style={[
                  styles.generatorAction,
                  (generating || !generatorPrompt.trim()) &&
                    styles.generatorActionDisabled,
                ]}
                onPress={handleGenerate}
                disabled={generating || !generatorPrompt.trim()}
              >
                {generating ? (
                  <ActivityIndicator size="small" color={colors.onPrimary} />
                ) : (
                  <Text style={styles.generatorActionText}>
                    {willEdit ? t('Apply the change') : t('Generate')}
                  </Text>
                )}
              </TouchableOpacity>

              {generatedLint && (
                <Text style={styles.generatorWarning}>
                  {t('This code does not compile: {message}', {
                    message: generatedLint,
                  })}
                </Text>
              )}

              {generatedCode && (
                <>
                  <Text style={styles.label}>
                    {willEdit ? t('Updated script') : t('Generated code')}
                  </Text>
                  <ScrollView
                    horizontal
                    style={styles.generatedCodeBox}
                    contentContainerStyle={styles.generatedCodeContent}
                  >
                    <Text style={styles.codeText}>{generatedCode}</Text>
                  </ScrollView>
                  <TouchableOpacity
                    style={styles.generatorAction}
                    onPress={handleUseGenerated}
                  >
                    <Text style={styles.generatorActionText}>
                      {willEdit
                        ? t('Use the updated script')
                        : t('Put it in the editor')}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </ModalSafeArea>
        </Modal>
      </Modal>
    </Modal>
  );
};

const createStyles = (colors: any) => {
  const syntaxColors = deriveSyntaxColors(colors.surfaceVariant, colors.text);
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    headerTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
    close: { color: colors.primary, fontWeight: '600' },
    scrollView: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 32 },
    adRewardSection: {
      backgroundColor: colors.surface,
      padding: 12,
      borderRadius: 8,
      marginBottom: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    timeDisplay: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    timeLabel: { color: colors.text, fontSize: 14, fontWeight: '600' },
    timeValue: { color: colors.primary, fontSize: 18, fontWeight: '700' },
    timeExpired: { color: colors.error },
    masterToggleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    watchAdButton: {
      backgroundColor: '#4CAF50',
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 8,
      alignItems: 'center',
      marginBottom: 8,
    },
    generatorBody: { padding: 12, paddingBottom: 40 },
    generatorBlocker: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.warning,
      backgroundColor: colors.surface,
      borderRadius: 8,
      padding: 12,
      marginTop: 10,
    },
    generatorBlockerReason: {
      color: colors.text,
      fontSize: 13,
      lineHeight: 18,
    },
    generatorBlockerWhere: {
      color: colors.warning,
      fontSize: 12.5,
      fontWeight: '600',
      lineHeight: 18,
      marginTop: 4,
    },
    generatorAction: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 4,
    },
    generatorActionDisabled: { opacity: 0.45 },
    generatorActionText: {
      color: colors.onPrimary || colors.buttonText || '#fff',
      fontWeight: '700',
      fontSize: 15.5,
    },
    generatorModes: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceVariant,
      borderRadius: 8,
      padding: 3,
      marginTop: 12,
    },
    generatorMode: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 6,
      alignItems: 'center',
    },
    generatorModeActive: {
      backgroundColor: colors.surface,
    },
    generatorModeText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '500',
    },
    generatorModeTextActive: {
      color: colors.primary,
      fontWeight: '700',
    },
    generatorInput: {
      backgroundColor: colors.surfaceVariant,
      color: colors.text,
      borderRadius: 6,
      padding: 10,
      minHeight: 90,
      textAlignVertical: 'top',
      marginBottom: 10,
    },
    generatorWarning: {
      color: colors.warning,
      fontSize: 12.5,
      marginTop: 10,
      lineHeight: 18,
    },
    generatedCodeBox: {
      backgroundColor: colors.surfaceVariant,
      borderRadius: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      maxHeight: 280,
      marginBottom: 10,
    },
    generatedCodeContent: { padding: 10 },
    watchAdButtonDisabled: { backgroundColor: colors.border, opacity: 0.6 },
    watchAdButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
    upgradeButton: {
      backgroundColor: '#FFB300',
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 8,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: '#FF8F00',
    },
    upgradeButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
    warningBox: {
      backgroundColor: colors.error + '20',
      padding: 12,
      borderRadius: 8,
      marginBottom: 8,
      borderLeftWidth: 4,
      borderLeftColor: colors.error,
    },
    warningText: { color: colors.error, fontSize: 13, fontWeight: '600' },
    list: { paddingBottom: 12 },
    card: {
      backgroundColor: colors.surface,
      padding: 12,
      borderRadius: 8,
      marginBottom: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    cardHeaderText: { flex: 1, marginRight: 12, minWidth: 0, flexShrink: 1 },
    title: { color: colors.text, fontWeight: '700', fontSize: 16 },
    subtitle: { color: colors.textSecondary, fontSize: 12 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginVertical: 8,
      flexWrap: 'wrap',
    },
    button: {
      backgroundColor: colors.primary,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 6,
    },
    buttonText: {
      color: colors.buttonText || '#fff',
      fontWeight: '600',
      fontSize: 13,
    },
    danger: { backgroundColor: colors.surface },
    dangerText: { color: colors.error },
    switchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sectionTitle: {
      color: colors.text,
      fontWeight: '700',
      marginTop: 8,
      marginBottom: 4,
    },
    logHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 8,
    },
    logBox: {
      backgroundColor: colors.surfaceVariant,
      padding: 8,
      borderRadius: 8,
      height: 180,
      marginTop: 4,
    },
    logLine: { color: colors.text, fontSize: 12, marginBottom: 4 },
    label: {
      color: colors.text,
      marginTop: 8,
      marginBottom: 4,
      fontWeight: '600',
    },
    input: {
      backgroundColor: colors.surfaceVariant,
      color: colors.text,
      padding: 8,
      borderRadius: 6,
      marginBottom: 8,
      fontFamily: 'monospace',
      flex: 1,
    },
    codeEditorWrapper: {
      position: 'relative',
      height: 240,
      backgroundColor: colors.surfaceVariant,
      borderRadius: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    // BEHIND the input, and it has to stay there.
    //
    // In front, `pointerEvents="none"` is not enough on Android: taps never
    // reach the field, so there is no caret and the editor reads as a preview
    // you cannot type into. Behind, every tap lands on the input.
    //
    // The doubled, offset copy of the script that this layer was once blamed
    // for had nothing to do with z-order - it showed up in both arrangements,
    // because the two layers were scrolled independently. That is fixed by
    // translating this one with the input's scroll offset instead.
    codeHighlight: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      // No `bottom`: the layer is as tall as the script and is shifted up as
      // the input scrolls, with the wrapper's overflow clipping the rest.
      padding: 8,
      backgroundColor: 'transparent',
      zIndex: 1,
    },

    codeInput: {
      backgroundColor: 'transparent',
      color: colors.text,
      padding: 8,
      height: 240,
      textAlignVertical: 'top',
      includeFontPadding: false,
      fontFamily: 'monospace',
      fontSize: 13,
      lineHeight: 20,
      // Above the highlight layer, so it receives every tap and draws the
      // caret and the selection. Its own glyphs are transparent.
      zIndex: 2,
    },
    // When highlight is on, hide the input's own glyphs (keep caret/selection
    // visible) so only the coloured layer behind is read.
    codeInputOverlay: { backgroundColor: 'transparent', color: 'transparent' },
    syntax: { backgroundColor: 'transparent', padding: 0, fontSize: 13 },
    codeText: {
      color: colors.text,
      fontFamily: 'monospace',
      fontSize: 13,
      lineHeight: 20,
      includeFontPadding: false,
    },
    codeKeyword: {
      color: syntaxColors.keyword,
      fontFamily: 'monospace',
      fontSize: 13,
    },
    codeString: {
      color: syntaxColors.string,
      fontFamily: 'monospace',
      fontSize: 13,
    },
    codeComment: {
      color: syntaxColors.comment,
      fontFamily: 'monospace',
      fontSize: 13,
    },
    codeNumber: {
      color: syntaxColors.number,
      fontFamily: 'monospace',
      fontSize: 13,
    },
    // AndroidIRCX scripting vocabulary
    codeHook: {
      color: syntaxColors.hook,
      fontFamily: 'monospace',
      fontSize: 13,
    },
    codeApi: {
      color: syntaxColors.api,
      fontFamily: 'monospace',
      fontSize: 13,
    },
    codeApiMethod: {
      color: syntaxColors.apiMethod,
      fontFamily: 'monospace',
      fontSize: 13,
    },
    autocompleteBox: {
      marginTop: 4,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    editorBody: { flex: 1 },
    editorBodyContent: { paddingBottom: 16 },
    nameInput: {
      backgroundColor: colors.surfaceVariant,
      color: colors.text,
      borderRadius: 6,
      paddingHorizontal: 10,
      paddingVertical: 8,
      fontSize: 15,
      marginBottom: 4,
    },
    editorActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    editorAction: {
      // Share the row evenly rather than each shrinking to its own label,
      // which left three differently sized buttons floating to the left.
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 46,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    editorActionPrimary: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    editorActionText: {
      color: colors.primary,
      fontWeight: '600',
      fontSize: 15,
    },
    editorActionPrimaryText: {
      color: colors.onPrimary,
      fontWeight: '700',
      fontSize: 15,
    },
    autocompleteList: { maxHeight: 220 },
    autocompleteItem: {
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    autocompleteHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    autocompleteItemFirst: {
      borderTopWidth: 0,
      backgroundColor: colors.surfaceVariant,
    },
    autocompleteText: {
      color: colors.text,
      fontFamily: 'monospace',
      fontSize: 14,
    },
    autocompleteTag: {
      color: colors.textSecondary,
      fontSize: 11,
      textTransform: 'uppercase',
      marginLeft: 8,
    },
    autocompleteDoc: {
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 16,
      marginTop: 3,
    },
  });
};

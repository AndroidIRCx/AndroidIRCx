/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ModalSafeArea } from '../components/ModalSafeArea';
import { AIProviderPreset, presetsFor } from '../config/aiProviderPresets';
import { useTheme } from '../hooks/useTheme';
import { useT } from '../i18n/localization';
import { aiService } from '../services/ai/AIService';
import {
  aiProviderStore,
  DEFAULT_MAX_TOKENS,
  MAX_ALLOWED_TOKENS,
} from '../services/ai/AIProviderStore';
import {
  AIError,
  AIProvider,
  AIProviderKind,
  AIReadiness,
} from '../services/ai/types';
import {
  mcpServerService,
  McpBindMode,
  McpServerStatus,
} from '../services/ai/McpServerService';
import {
  mcpClientService,
  McpClientServer,
} from '../services/ai/McpClientService';
import { aiMemoryService, AIMemory } from '../services/ai/AIMemoryService';
import { webAccessService } from '../services/ai/WebAccessService';
import { useTabStore } from '../stores/tabStore';

interface Props {
  visible: boolean;
  onClose: () => void;
}

/**
 * The bind choices, widest last. The descriptions come from the service so the
 * screen and the wiki cannot drift apart.
 */
const BIND_MODES: Array<{ value: McpBindMode; title: string }> = [
  { value: 'loopback', title: 'Only this phone' },
  { value: 'lan', title: 'My network' },
  { value: 'any', title: 'Every connection' },
];

interface Draft {
  id: string | null;
  name: string;
  kind: AIProviderKind;
  baseUrl: string;
  model: string;
  maxTokens: string;
  apiKey: string;
  hasStoredKey: boolean;
}

/** Sensible starting point per kind, so the user types as little as possible. */
const BASE_URL_PRESET: Partial<Record<AIProviderKind, string>> = {
  'openai-compatible': 'https://api.openai.com/v1',
  local: 'http://192.168.1.10:11434/v1',
};

const emptyDraft = (kind: AIProviderKind): Draft => ({
  id: null,
  name: '',
  kind,
  baseUrl: BASE_URL_PRESET[kind] ?? '',
  model: '',
  maxTokens: String(DEFAULT_MAX_TOKENS),
  apiKey: '',
  hasStoredKey: false,
});

export const AISettingsScreen: React.FC<Props> = ({ visible, onClose }) => {
  const { colors } = useTheme();
  const t = useT();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const kinds = useMemo(() => aiService.supportedKinds(), []);
  const presets = useMemo(() => presetsFor(kinds), [kinds]);
  const kindLabels: Record<AIProviderKind, string> = {
    anthropic: t('Claude'),
    'openai-compatible': t('OpenAI-compatible'),
    gemini: t('Gemini'),
    local: t('Local / LAN'),
  };

  const [enabled, setEnabled] = useState(true);
  const [consent, setConsent] = useState(false);
  const [redaction, setRedaction] = useState(true);
  const [allowedChannels, setAllowedChannels] = useState<string[]>([]);
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [defaultId, setDefaultId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const tabs = useTabStore(state => state.tabs);
  const [blocker, setBlocker] = useState<AIReadiness | null>(null);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [models, setModels] = useState<string[] | null>(null);
  const [mcpName, setMcpName] = useState('');
  const [mcpUrl, setMcpUrl] = useState('');
  const [mcpTools, setMcpTools] = useState('');
  const [mcpToken, setMcpToken] = useState('');
  const [serverStatus, setServerStatus] = useState<McpServerStatus | null>(
    null,
  );
  const [serverWrites, setServerWrites] = useState(false);
  const [serverBind, setServerBind] = useState<McpBindMode>('loopback');
  const [serverBusy, setServerBusy] = useState(false);
  const [clientServers, setClientServers] = useState<McpClientServer[]>([]);
  const [clientName, setClientName] = useState('');
  const [clientUrl, setClientUrl] = useState('');
  const [clientToken, setClientToken] = useState('');
  const [showClientEditor, setShowClientEditor] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelFilter, setModelFilter] = useState('');
  const [preset, setPreset] = useState<AIProviderPreset | null>(null);
  const [allowedHosts, setAllowedHosts] = useState<string[]>([]);
  const [memories, setMemories] = useState<AIMemory[]>([]);
  const [memoryOn, setMemoryOn] = useState(true);

  const refresh = useCallback(async () => {
    await aiService.loadSettings();
    const [list, currentDefault] = await Promise.all([
      aiProviderStore.list(),
      aiProviderStore.getDefaultId(),
    ]);
    const readiness = await aiService.diagnose();
    setBlocker(readiness.ready ? null : readiness);
    setEnabled(aiService.isEnabled());
    setConsent(aiService.hasConsent());
    setRedaction(aiService.isRedactionEnabled());
    setAllowedChannels(aiService.listAllowedChannels());
    await webAccessService.load();
    setAllowedHosts(webAccessService.listHosts());
    await aiMemoryService.load();
    setMemories(aiMemoryService.list());
    setMemoryOn(aiMemoryService.isEnabled());
    setProviders(list);
    setDefaultId(currentDefault);
    if (mcpClientService.isSupported()) {
      setClientServers(await mcpClientService.list());
    }
    if (mcpServerService.isSupported()) {
      // Read the saved settings, not the running server's: both switches are
      // decisions about exposure, and a screen that forgets them makes the
      // user re-decide blind every time.
      const [status, saved] = await Promise.all([
        mcpServerService.getStatus(),
        mcpServerService.loadConfig(),
      ]);
      setServerStatus(status);
      setServerWrites(saved.allowWrites);
      setServerBind(status.running ? status.bindMode : saved.bindMode);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (visible) {
      setLoading(true);
      refresh();
    }
  }, [visible, refresh]);

  const describeError = useCallback(
    (error: unknown): string => {
      if (error instanceof AIError) {
        switch (error.code) {
          case 'auth_failed':
            return t('The API key was rejected by the provider.');
          case 'timeout':
            return t('The provider did not answer in time.');
          case 'network':
            return t(
              'Could not reach the provider. Check the base URL and your connection.',
            );
          case 'rate_limited':
            return t('The provider is rate limiting this key right now.');
          case 'missing_key':
            return t('No API key is stored for this provider.');
          case 'consent_required':
            return t(
              'You have not agreed to send conversation content to this provider yet.',
            );
          case 'channel_not_allowed':
            return t('AI is not enabled for that channel.');
          default:
            return error.message;
        }
      }
      return String(error);
    },
    [t],
  );

  const toggleEnabled = useCallback(
    async (value: boolean) => {
      setEnabled(value);
      await aiService.setEnabled(value);
      await refresh();
    },
    [refresh],
  );

  /**
   * Consent is asked for explicitly and names what actually happens, because
   * the people in a channel never agreed to anything — the user is consenting
   * on their behalf. Turning it off needs no confirmation.
   */
  const toggleConsent = useCallback(
    (value: boolean) => {
      if (!value) {
        setConsent(false);
        aiService.setConsent(false).then(refresh);
        return;
      }
      Alert.alert(
        t('Send messages to an AI provider?'),
        t(
          'Text you send to AI — including messages written by other people in a channel — will be transmitted to the provider you configured, which is a company outside AndroidIRCX. Nicknames, IP addresses and hostmasks are removed first when redaction is on. Local providers on your own network are not affected.',
        ),
        [
          { text: t('Cancel'), style: 'cancel' },
          {
            text: t('I agree'),
            onPress: async () => {
              await aiService.setConsent(true);
              setConsent(true);
              await refresh();
            },
          },
        ],
      );
    },
    [t, refresh],
  );

  const toggleRedaction = useCallback((value: boolean) => {
    setRedaction(value);
    aiService.setRedactionEnabled(value);
  }, []);

  const revokeChannel = useCallback(async (entry: string) => {
    const separator = entry.indexOf('::');
    const network = separator > -1 ? entry.substring(0, separator) : undefined;
    const channel = separator > -1 ? entry.substring(separator + 2) : entry;
    await aiService.setChannelAllowed(channel, false, network);
    setAllowedChannels(aiService.listAllowedChannels());
  }, []);

  const toggleMemory = useCallback(async (value: boolean) => {
    setMemoryOn(value);
    await aiMemoryService.setEnabled(value);
  }, []);

  const forgetMemory = useCallback(async (id: string) => {
    await aiMemoryService.forget(id);
    setMemories(aiMemoryService.list());
  }, []);

  const clearMemories = useCallback(() => {
    Alert.alert(
      t('Forget everything?'),
      t('The assistant will start from nothing again. This cannot be undone.'),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Forget all'),
          style: 'destructive',
          onPress: async () => {
            await aiMemoryService.clearAll();
            setMemories([]);
          },
        },
      ],
    );
  }, [t]);

  const forgetHost = useCallback(async (host: string) => {
    await webAccessService.forgetHost(host);
    setAllowedHosts(webAccessService.listHosts());
  }, []);

  const setChannel = useCallback(
    async (channel: string, network: string, allowed: boolean) => {
      await aiService.setChannelAllowed(channel, allowed, network);
      setAllowedChannels(aiService.listAllowedChannels());
    },
    [],
  );

  /**
   * The channels the user is actually in, grouped by network.
   *
   * This list is the only way to opt a channel in. Before it existed the
   * screen could revoke a channel but never add one, so the per-channel gate
   * refused everything and nothing that reads a channel could ever run.
   */
  const joinedByNetwork = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const tab of tabs) {
      if (tab.type !== 'channel') continue;
      const list = groups.get(tab.networkId) ?? [];
      list.push(tab.name);
      groups.set(tab.networkId, list);
    }
    return Array.from(groups.entries())
      .map(([network, channels]) => ({
        network,
        channels: channels.sort((a, b) => a.localeCompare(b)),
      }))
      .sort((a, b) => a.network.localeCompare(b.network));
  }, [tabs]);

  const allowedSet = useMemo(() => new Set(allowedChannels), [allowedChannels]);

  /**
   * Channels that are allowed but not currently joined. They stay listed so a
   * permission cannot outlive the user's memory of granting it.
   */
  const allowedElsewhere = useMemo(() => {
    const joined = new Set(
      joinedByNetwork.flatMap(group =>
        group.channels.map(
          channel => `${group.network}::${channel.toLowerCase()}`,
        ),
      ),
    );
    return allowedChannels.filter(entry => !joined.has(entry));
  }, [allowedChannels, joinedByNetwork]);

  /**
   * Some providers list dozens of models, most of them irrelevant. Typing a
   * couple of characters beats scrolling for the one you came for.
   */
  const visibleModels = useMemo(() => {
    const term = modelFilter.trim().toLowerCase();
    if (!term || !models) return models ?? [];
    return models.filter(model => model.toLowerCase().includes(term));
  }, [models, modelFilter]);

  const openClientEditor = useCallback(() => {
    setClientName('');
    setClientUrl('');
    setClientToken('');
    setShowClientEditor(true);
  }, []);

  const addClientServer = useCallback(async () => {
    try {
      await mcpClientService.add({
        name: clientName,
        url: clientUrl,
        token: clientToken || undefined,
      });
      setClientName('');
      setClientUrl('');
      setClientToken('');
      setShowClientEditor(false);
      await refresh();
    } catch (error: any) {
      Alert.alert(t('Could not add'), String(error?.message ?? error));
    }
  }, [clientName, clientUrl, clientToken, refresh, t]);

  const removeClientServer = useCallback(
    async (id: string) => {
      await mcpClientService.remove(id);
      await refresh();
    },
    [refresh],
  );

  const toggleClientTrust = useCallback(
    async (id: string, trust: boolean) => {
      await mcpClientService.update(id, { trustReadOnlyHints: trust });
      await refresh();
    },
    [refresh],
  );

  const toggleServer = useCallback(
    async (on: boolean) => {
      setServerBusy(true);
      try {
        const status = on
          ? await mcpServerService.start({
              allowWrites: serverWrites,
              bindMode: serverBind,
            })
          : await mcpServerService.stop();
        setServerStatus(status);
      } catch (error: any) {
        Alert.alert(
          t('Could not change the server'),
          String(error?.message ?? error),
        );
      } finally {
        setServerBusy(false);
      }
    },
    [serverWrites, serverBind, t],
  );

  /** Remember a switch the moment it moves, not only when the server starts. */
  const changeServerWrites = useCallback((on: boolean) => {
    setServerWrites(on);
    mcpServerService.saveConfig({ allowWrites: on });
  }, []);

  const changeServerBind = useCallback((mode: McpBindMode) => {
    setServerBind(mode);
    mcpServerService.saveConfig({ bindMode: mode });
  }, []);

  const addMcpServer = useCallback(async () => {
    if (!draft?.id) return;
    const tools = mcpTools
      .split(',')
      .map(tool => tool.trim())
      .filter(Boolean);
    if (!mcpName.trim() || !mcpUrl.trim() || tools.length === 0) {
      Alert.alert(
        t('Incomplete server'),
        t(
          'A name, an https URL and at least one tool name are required — the provider refuses a server with no tools listed.',
        ),
      );
      return;
    }
    const current = providers.find(p => p.id === draft.id)?.mcpServers ?? [];
    const updated = await aiProviderStore.setMcpServers(draft.id, [
      ...current.map(server => ({
        name: server.name,
        url: server.url,
        tools: server.tools,
      })),
      { name: mcpName.trim(), url: mcpUrl.trim(), tools },
    ]);
    if (updated && mcpToken.trim()) {
      await aiProviderStore.setMcpToken(
        draft.id,
        mcpName.trim(),
        mcpToken.trim(),
      );
    }
    setMcpName('');
    setMcpUrl('');
    setMcpTools('');
    setMcpToken('');
    await refresh();
  }, [draft, mcpName, mcpUrl, mcpTools, mcpToken, providers, refresh, t]);

  const removeMcpServer = useCallback(
    async (name: string) => {
      if (!draft?.id) return;
      const current = providers.find(p => p.id === draft.id)?.mcpServers ?? [];
      await aiProviderStore.setMcpServers(
        draft.id,
        current
          .filter(server => server.name !== name)
          .map(server => ({
            name: server.name,
            url: server.url,
            tools: server.tools,
          })),
      );
      await refresh();
    },
    [draft, providers, refresh],
  );

  /**
   * Fill the draft from a preset. Only blanks are filled, so a preset tapped
   * by mistake cannot wipe a name or URL the user already typed.
   */
  const applyPreset = useCallback((chosen: AIProviderPreset) => {
    setPreset(chosen);
    setDraft(current =>
      current
        ? {
            ...current,
            kind: chosen.kind,
            name: current.name || chosen.label,
            baseUrl:
              chosen.baseUrl ??
              (current.kind === chosen.kind ? current.baseUrl : ''),
          }
        : current,
    );
  }, []);

  const openEditor = useCallback((provider?: AIProvider) => {
    setModels(null);
    setModelFilter('');
    setPreset(null);
    if (!provider) {
      setDraft(
        emptyDraft(aiService.supportedKinds()[0] ?? 'openai-compatible'),
      );
      return;
    }
    setDraft({
      id: provider.id,
      name: provider.name,
      kind: provider.kind,
      baseUrl: provider.baseUrl ?? '',
      model: provider.model,
      maxTokens: String(provider.maxTokens),
      apiKey: '',
      hasStoredKey: provider.hasKey,
    });
  }, []);

  const saveDraft = useCallback(async (): Promise<string | null> => {
    if (!draft) return null;
    setSaving(true);
    try {
      const parsedTokens = parseInt(draft.maxTokens, 10);
      const payload = {
        name: draft.name,
        kind: draft.kind,
        baseUrl: draft.baseUrl,
        model: draft.model,
        maxTokens: Number.isFinite(parsedTokens) ? parsedTokens : undefined,
      };

      let id = draft.id;
      if (id) {
        await aiProviderStore.update(id, payload);
        // An empty field means "leave the stored key alone", never "clear it".
        if (draft.apiKey.trim()) {
          await aiProviderStore.setKey(id, draft.apiKey.trim());
        }
      } else {
        const created = await aiProviderStore.add(
          payload,
          draft.apiKey.trim() || undefined,
        );
        id = created.id;
      }

      await refresh();
      setDraft(current =>
        current ? { ...current, id, apiKey: '', hasStoredKey: true } : current,
      );
      return id;
    } catch (error) {
      Alert.alert(t('Could not save'), describeError(error));
      return null;
    } finally {
      setSaving(false);
    }
  }, [draft, refresh, t, describeError]);

  const loadModels = useCallback(async () => {
    if (!draft) return;
    const id = draft.id ?? (await saveDraft());
    if (!id) return;
    setLoadingModels(true);
    try {
      const list = await aiService.listModels(id);
      setModels(list);
      if (list.length === 0) {
        Alert.alert(
          t('No models'),
          t('The provider answered, but listed no models for this key.'),
        );
      }
    } catch (error) {
      Alert.alert(t('Could not load models'), describeError(error));
    } finally {
      setLoadingModels(false);
    }
  }, [draft, saveDraft, t, describeError]);

  const testProvider = useCallback(
    async (id: string) => {
      setTestingId(id);
      try {
        const list = await aiService.listModels(id);
        Alert.alert(
          t('Connection works'),
          t('The provider answered with {count} models.', {
            count: list.length,
          }),
        );
      } catch (error) {
        Alert.alert(t('Connection failed'), describeError(error));
      } finally {
        setTestingId(null);
      }
    },
    [t, describeError],
  );

  const removeProvider = useCallback(
    (provider: AIProvider) => {
      Alert.alert(
        t('Remove {name}?', { name: provider.name }),
        t('The stored API key is deleted with it.'),
        [
          { text: t('Cancel'), style: 'cancel' },
          {
            text: t('Remove'),
            style: 'destructive',
            onPress: async () => {
              await aiProviderStore.remove(provider.id);
              await refresh();
            },
          },
        ],
      );
    },
    [refresh, t],
  );

  const toggleProvider = useCallback(
    async (provider: AIProvider, value: boolean) => {
      await aiProviderStore.update(provider.id, { enabled: value });
      await refresh();
    },
    [refresh],
  );

  const makeDefault = useCallback(
    async (provider: AIProvider) => {
      await aiProviderStore.setDefault(provider.id);
      await refresh();
    },
    [refresh],
  );

  if (!visible) return null;

  const needsBaseUrl = draft
    ? draft.kind === 'openai-compatible' || draft.kind === 'local'
    : false;
  const needsKey = draft ? aiProviderStore.requiresKey(draft.kind) : false;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <ModalSafeArea style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} accessibilityRole="button">
            <Text style={styles.headerAction}>{t('Close')}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('AI Providers')}</Text>
          <TouchableOpacity
            onPress={() => openEditor()}
            accessibilityRole="button"
          >
            <Text style={styles.headerAction}>{t('Add')}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.masterRow}>
            <View style={styles.masterText}>
              <Text style={styles.masterTitle}>{t('Enable AI')}</Text>
              <Text style={styles.subtle}>
                {t('Turns off every AI call from scripts immediately.')}
              </Text>
            </View>
            <Switch value={enabled} onValueChange={toggleEnabled} />
          </View>

          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>{t('You need an API key')}</Text>
            <Text style={styles.subtle}>
              {t(
                'A Claude Pro or ChatGPT Plus subscription cannot be used here — those plans include no API access. Create a developer key with your provider, or point AndroidIRCX at a model server running on your own network.',
              )}
            </Text>
          </View>

          {blocker && (
            <View style={styles.blocker}>
              <Text style={styles.blockerTitle}>
                {t('AI will not run yet')}
              </Text>
              <Text style={styles.blockerReason}>{blocker.reason}</Text>
              <Text style={styles.blockerWhere}>{blocker.where}</Text>
            </View>
          )}

          <Text style={styles.groupHeading}>{t('Privacy')}</Text>

          <View style={styles.masterRow}>
            <View style={styles.masterText}>
              <Text style={styles.masterTitle}>
                {t('Allow sending messages to a provider')}
              </Text>
              <Text style={styles.subtle}>
                {t(
                  'Required before any cloud provider runs. Local providers on your own network never need it.',
                )}
              </Text>
            </View>
            <Switch value={consent} onValueChange={toggleConsent} />
          </View>

          <View style={styles.masterRow}>
            <View style={styles.masterText}>
              <Text style={styles.masterTitle}>
                {t('Remove identifying data')}
              </Text>
              <Text style={styles.subtle}>
                {t(
                  'Replaces nicknames with user1, user2… and strips IP addresses, hostmasks and e-mail addresses before sending.',
                )}
              </Text>
            </View>
            <Switch value={redaction} onValueChange={toggleRedaction} />
          </View>

          <Text style={styles.masterTitle}>{t('Channels AI may read')}</Text>
          <Text style={styles.subtle}>
            {t(
              'Off for every channel until you say otherwise. The other people in a channel never agreed to have their words sent to a provider, so this is asked per channel rather than once.',
            )}
          </Text>

          {joinedByNetwork.length === 0 ? (
            <Text style={styles.empty}>
              {t(
                'You are not in any channel right now. Join one and it appears here.',
              )}
            </Text>
          ) : (
            joinedByNetwork.map(group => (
              <View key={group.network}>
                <Text style={styles.channelNetwork}>{group.network}</Text>
                {group.channels.map(channel => {
                  const key = `${group.network}::${channel.toLowerCase()}`;
                  return (
                    <View key={key} style={styles.channelRow}>
                      <Text style={styles.channelText}>{channel}</Text>
                      <Switch
                        value={allowedSet.has(key)}
                        onValueChange={value =>
                          setChannel(channel, group.network, value)
                        }
                      />
                    </View>
                  );
                })}
              </View>
            ))
          )}

          {allowedElsewhere.length > 0 && (
            <>
              <Text style={styles.channelNetwork}>
                {t('Allowed, but not joined right now')}
              </Text>
              {allowedElsewhere.map(entry => (
                <View key={entry} style={styles.channelRow}>
                  <Text style={styles.channelText}>{entry}</Text>
                  <TouchableOpacity onPress={() => revokeChannel(entry)}>
                    <Text style={styles.actionDanger}>{t('Revoke')}</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}

          <View style={styles.masterRow}>
            <View style={styles.masterText}>
              <Text style={styles.masterTitle}>
                {t('What the assistant remembers')}
              </Text>
              <Text style={styles.subtle}>
                {t(
                  'Short facts it keeps between conversations \u2014 your role, a preference, what you are working on. Every one is listed below and can be deleted. They are sent to your provider with the conversation, like everything else, so anything you would not send should not be remembered.',
                )}
              </Text>
            </View>
            <Switch value={memoryOn} onValueChange={toggleMemory} />
          </View>
          {memories.length === 0 ? (
            <Text style={styles.empty}>{t('Nothing remembered yet.')}</Text>
          ) : (
            <>
              {memories.map(memory => (
                <View key={memory.id} style={styles.channelRow}>
                  <View style={styles.masterText}>
                    <Text style={styles.channelText}>{memory.text}</Text>
                    <Text style={styles.subtle}>{memory.category}</Text>
                  </View>
                  <TouchableOpacity onPress={() => forgetMemory(memory.id)}>
                    <Text style={styles.actionDanger}>{t('Forget')}</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity onPress={clearMemories}>
                <Text style={styles.actionDanger}>
                  {t('Forget everything')}
                </Text>
              </TouchableOpacity>
            </>
          )}

          <Text style={styles.masterTitle}>
            {t('Sites the assistant may read')}
          </Text>
          <Text style={styles.subtle}>
            {t(
              "The assistant can look something up when a question is about how this app works. This project's own documentation is allowed from the start; any other site asks you first, and you can allow it once or add it here.",
            )}
          </Text>
          {allowedHosts.map(host => (
            <View key={host} style={styles.channelRow}>
              <Text style={styles.channelText}>{host}</Text>
              {webAccessService.isDefaultHost(host) ? (
                <Text style={styles.subtle}>{t('built in')}</Text>
              ) : (
                <TouchableOpacity onPress={() => forgetHost(host)}>
                  <Text style={styles.actionDanger}>{t('Remove')}</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}

          {mcpClientService.isSupported() && (
            <>
              <Text style={styles.groupHeading}>
                {t('Connect to MCP servers')}
              </Text>
              <Text style={styles.subtle}>
                {t(
                  'Their tools become available to the assistant, whichever provider you use. Remote servers only \u2014 a server running on this phone in Termux counts, at http://127.0.0.1:<port>.',
                )}
              </Text>

              {clientServers.map(server => (
                <View key={server.id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={styles.cardText}>
                      <Text style={styles.cardTitle}>{server.name}</Text>
                      <Text style={styles.subtle}>
                        {server.url}
                        {server.hasToken ? ' \u00b7 token' : ''}
                      </Text>
                    </View>
                    <Switch
                      value={server.enabled}
                      onValueChange={value =>
                        mcpClientService
                          .update(server.id, { enabled: value })
                          .then(refresh)
                      }
                    />
                  </View>
                  <View style={styles.masterRow}>
                    <View style={styles.masterText}>
                      <Text style={styles.masterTitle}>
                        {t('Trust this server')}
                      </Text>
                      <Text style={styles.subtle}>
                        {t(
                          'Honour this server when it says a tool only reads. Off means every one of its tools asks you first.',
                        )}
                      </Text>
                    </View>
                    <Switch
                      value={server.trustReadOnlyHints}
                      onValueChange={value =>
                        toggleClientTrust(server.id, value)
                      }
                    />
                  </View>
                  <View style={styles.actions}>
                    <TouchableOpacity
                      onPress={() => removeClientServer(server.id)}
                    >
                      <Text style={styles.actionDanger}>{t('Remove')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              {clientServers.length === 0 && (
                <Text style={styles.empty}>
                  {t('No MCP servers yet. Tap Add to connect one.')}
                </Text>
              )}

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={openClientEditor}
              >
                <Text style={styles.secondaryButtonText}>
                  {t('Add MCP server')}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {mcpServerService.isSupported() && (
            <>
              <Text style={styles.groupHeading}>
                {t('Let other agents use this app')}
              </Text>
              <Text style={styles.subtle}>
                {t(
                  'Runs an MCP server so an assistant elsewhere \u2014 on your computer, for instance \u2014 can read and act on this IRC session.',
                )}
              </Text>

              <View style={styles.masterRow}>
                <View style={styles.masterText}>
                  <Text style={styles.masterTitle}>{t('MCP server')}</Text>
                  <Text style={styles.subtle}>
                    {serverStatus?.running
                      ? mcpServerService.describeEndpoint(serverStatus)
                      : t('Off')}
                  </Text>
                </View>
                {serverBusy ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <Switch
                    value={!!serverStatus?.running}
                    onValueChange={toggleServer}
                  />
                )}
              </View>

              {serverStatus?.running ? (
                <View style={styles.mcpEndpoint}>
                  <Text style={styles.mcpEndpointLabel}>
                    {t('Add this to your MCP client')}
                  </Text>
                  <Text style={styles.mcpEndpointHint}>
                    {t('Type: Streamable HTTP')}
                  </Text>
                  <Text style={styles.mcpEndpointValue} selectable>
                    {mcpServerService.describeEndpoint(serverStatus)}
                  </Text>
                  {!!serverStatus.token && (
                    <>
                      <Text style={styles.mcpEndpointHint}>
                        {t('Bearer token — treat it like a password')}
                      </Text>
                      <Text style={styles.mcpEndpointValue} selectable>
                        {serverStatus.token}
                      </Text>
                    </>
                  )}
                  {!serverStatus.host && serverBind !== 'loopback' && (
                    <Text style={styles.mcpEndpointWarning}>
                      {t(
                        'This phone has no network address right now, so nothing can reach it.',
                      )}
                    </Text>
                  )}
                </View>
              ) : (
                <Text style={styles.subtle}>
                  {t(
                    'Turn it on and the address and token to paste into your MCP client appear here.',
                  )}
                </Text>
              )}

              <View style={styles.masterRow}>
                <View style={styles.masterText}>
                  <Text style={styles.masterTitle}>{t('Allow actions')}</Text>
                  <Text style={styles.subtle}>
                    {t(
                      'Off by default: a remote agent can look, but cannot send, join or leave. Nobody is watching it the way you watch the in-app assistant.',
                    )}
                  </Text>
                </View>
                <Switch
                  value={serverWrites}
                  onValueChange={changeServerWrites}
                  disabled={!!serverStatus?.running}
                />
              </View>

              <Text style={styles.masterTitle}>{t('Who can reach it')}</Text>
              {BIND_MODES.map(mode => {
                const active = serverBind === mode.value;
                return (
                  <TouchableOpacity
                    key={mode.value}
                    style={[styles.bindRow, active && styles.bindRowActive]}
                    disabled={!!serverStatus?.running}
                    onPress={() => changeServerBind(mode.value)}
                  >
                    <View style={styles.bindRadio}>
                      {active && <View style={styles.bindRadioDot} />}
                    </View>
                    <View style={styles.masterText}>
                      <Text style={styles.bindTitle}>{t(mode.title)}</Text>
                      <Text style={styles.subtle}>
                        {mcpServerService.describeBindMode(mode.value)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
              {serverBind === 'any' && (
                <Text style={styles.bindWarning}>
                  {t(
                    'This puts your IRC session on every network you join, including cafe and airport Wi-Fi. Turn it off when you are done.',
                  )}
                </Text>
              )}
              {!!serverStatus?.running && (
                <Text style={styles.subtle}>
                  {t(
                    'These are locked while the server is running, so what is listening is always what you agreed to.',
                  )}
                </Text>
              )}
            </>
          )}

          <Text style={styles.groupHeading}>{t('Providers')}</Text>

          {loading ? (
            <ActivityIndicator style={styles.loader} color={colors.primary} />
          ) : providers.length === 0 ? (
            <Text style={styles.empty}>
              {t('No providers yet. Tap Add to set one up.')}
            </Text>
          ) : (
            providers.map(provider => {
              const isDefault = provider.id === defaultId;
              const keyMissing =
                aiProviderStore.requiresKey(provider.kind) && !provider.hasKey;
              return (
                <View key={provider.id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={styles.cardText}>
                      <View style={styles.titleRow}>
                        <Text style={styles.cardTitle}>{provider.name}</Text>
                        {isDefault && (
                          <Text style={styles.badge}>{t('DEFAULT')}</Text>
                        )}
                      </View>
                      <Text style={styles.subtle}>
                        {kindLabels[provider.kind]} · {provider.model}
                      </Text>
                      {keyMissing && (
                        <Text style={styles.warning}>
                          {t('No API key stored')}
                        </Text>
                      )}
                    </View>
                    <Switch
                      value={provider.enabled}
                      onValueChange={value => toggleProvider(provider, value)}
                    />
                  </View>

                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={styles.action}
                      onPress={() => testProvider(provider.id)}
                      disabled={testingId === provider.id}
                    >
                      {testingId === provider.id ? (
                        <ActivityIndicator
                          size="small"
                          color={colors.primary}
                        />
                      ) : (
                        <Text style={styles.actionText}>{t('Test')}</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.action}
                      onPress={() => openEditor(provider)}
                    >
                      <Text style={styles.actionText}>{t('Edit')}</Text>
                    </TouchableOpacity>
                    {!isDefault && (
                      <TouchableOpacity
                        style={styles.action}
                        onPress={() => makeDefault(provider)}
                      >
                        <Text style={styles.actionText}>
                          {t('Make default')}
                        </Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.action}
                      onPress={() => removeProvider(provider)}
                    >
                      <Text style={styles.actionDanger}>{t('Remove')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      </ModalSafeArea>

      <Modal
        visible={showClientEditor}
        animationType="slide"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setShowClientEditor(false)}
      >
        <ModalSafeArea style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setShowClientEditor(false)}>
              <Text style={styles.headerAction}>{t('Cancel')}</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t('Add MCP server')}</Text>
            <TouchableOpacity
              onPress={addClientServer}
              disabled={!clientName.trim() || !clientUrl.trim()}
            >
              <Text style={styles.headerAction}>{t('Add')}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Text style={styles.subtle}>
              {t(
                'The app connects to this server and offers its tools to the assistant. Every one of them asks you before it runs.',
              )}
            </Text>

            <Text style={styles.label}>{t('Name')}</Text>
            <TextInput
              style={styles.input}
              value={clientName}
              autoCapitalize="none"
              placeholder={t('My notes')}
              placeholderTextColor={colors.textSecondary}
              onChangeText={setClientName}
            />

            <Text style={styles.label}>{t('Address')}</Text>
            <TextInput
              style={styles.input}
              value={clientUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder="https://mcp.example.com/mcp"
              placeholderTextColor={colors.textSecondary}
              onChangeText={setClientUrl}
            />
            <Text style={styles.subtle}>
              {t(
                'A Streamable HTTP endpoint. A server running on this phone in Termux counts too — use http://127.0.0.1:<port>.',
              )}
            </Text>

            <Text style={styles.label}>{t('Token (optional)')}</Text>
            <TextInput
              style={styles.input}
              value={clientToken}
              autoCapitalize="none"
              secureTextEntry
              placeholder={t('Only if the server asks for one')}
              placeholderTextColor={colors.textSecondary}
              onChangeText={setClientToken}
            />
            <Text style={styles.subtle}>
              {t('Stored in this phone’s keychain, like an API key.')}
            </Text>
          </ScrollView>
        </ModalSafeArea>
      </Modal>

      <Modal
        visible={!!draft}
        animationType="slide"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setDraft(null)}
      >
        <ModalSafeArea style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setDraft(null)}>
              <Text style={styles.headerAction}>{t('Cancel')}</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {draft?.id ? t('Edit provider') : t('Add provider')}
            </Text>
            <TouchableOpacity
              onPress={async () => {
                const id = await saveDraft();
                if (id) setDraft(null);
              }}
              disabled={saving}
            >
              <Text style={styles.headerAction}>
                {saving ? t('Saving…') : t('Save')}
              </Text>
            </TouchableOpacity>
          </View>

          {draft && (
            <ScrollView contentContainerStyle={styles.scrollContent}>
              <Text style={styles.label}>{t('Name')}</Text>
              <TextInput
                style={styles.input}
                value={draft.name}
                placeholder={t('My provider')}
                placeholderTextColor={colors.textSecondary}
                onChangeText={value =>
                  setDraft({ ...draft, name: value.substring(0, 60) })
                }
              />

              {!draft.id && (
                <>
                  <Text style={styles.label}>{t('Provider')}</Text>
                  <View style={styles.presetList}>
                    {presets.map(item => (
                      <TouchableOpacity
                        key={item.id}
                        style={[
                          styles.presetRow,
                          preset?.id === item.id && styles.presetRowActive,
                        ]}
                        onPress={() => applyPreset(item)}
                      >
                        <View style={styles.presetText}>
                          <View style={styles.titleRow}>
                            <Text style={styles.presetName}>{item.label}</Text>
                            {item.free && (
                              <Text style={styles.freeBadge}>{t('FREE')}</Text>
                            )}
                          </View>
                          <Text style={styles.subtle}>{item.note}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {!!preset?.keyUrl && (
                    <TouchableOpacity
                      onPress={() => Linking.openURL(preset.keyUrl as string)}
                    >
                      <Text style={styles.presetLink}>
                        {t('Get a key: {url}', { url: preset.keyUrl })}
                      </Text>
                    </TouchableOpacity>
                  )}
                </>
              )}

              <Text style={styles.label}>{t('Kind')}</Text>
              <View style={styles.kindRow}>
                {kinds.map(kind => (
                  <TouchableOpacity
                    key={kind}
                    style={[
                      styles.kindChip,
                      draft.kind === kind && styles.kindChipActive,
                    ]}
                    onPress={() =>
                      setDraft({
                        ...draft,
                        kind,
                        baseUrl: draft.baseUrl || BASE_URL_PRESET[kind] || '',
                      })
                    }
                  >
                    <Text
                      style={[
                        styles.kindChipText,
                        draft.kind === kind && styles.kindChipTextActive,
                      ]}
                    >
                      {kindLabels[kind]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {needsBaseUrl && (
                <>
                  <Text style={styles.label}>{t('Base URL')}</Text>
                  <TextInput
                    style={styles.input}
                    value={draft.baseUrl}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    placeholder="https://api.openai.com/v1"
                    placeholderTextColor={colors.textSecondary}
                    onChangeText={value =>
                      setDraft({ ...draft, baseUrl: value })
                    }
                  />
                </>
              )}

              {needsKey && (
                <>
                  <Text style={styles.label}>{t('API key')}</Text>
                  <TextInput
                    style={styles.input}
                    value={draft.apiKey}
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry
                    placeholder={
                      draft.hasStoredKey
                        ? t('Stored — type to replace')
                        : 'sk-…'
                    }
                    placeholderTextColor={colors.textSecondary}
                    onChangeText={value =>
                      setDraft({ ...draft, apiKey: value })
                    }
                  />
                  <Text style={styles.subtle}>
                    {t('Stored in the device keychain, never in backups.')}
                  </Text>
                </>
              )}

              <Text style={styles.label}>{t('Model')}</Text>
              <TextInput
                style={styles.input}
                value={draft.model}
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor={colors.textSecondary}
                onChangeText={value => setDraft({ ...draft, model: value })}
              />
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={loadModels}
                disabled={loadingModels}
              >
                {loadingModels ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={styles.secondaryButtonText}>
                    {t('Load models from provider')}
                  </Text>
                )}
              </TouchableOpacity>

              {models && models.length > 0 && (
                <View style={styles.modelList}>
                  {models.length > 8 && (
                    <TextInput
                      style={styles.modelFilter}
                      value={modelFilter}
                      autoCapitalize="none"
                      autoCorrect={false}
                      placeholder={t('Filter {count} models', {
                        count: models.length,
                      })}
                      placeholderTextColor={colors.textSecondary}
                      onChangeText={setModelFilter}
                    />
                  )}
                  {visibleModels.length === 0 && (
                    <Text style={styles.subtle}>
                      {t('Nothing matches that.')}
                    </Text>
                  )}
                  {visibleModels.map(model => (
                    <TouchableOpacity
                      key={model}
                      style={[
                        styles.modelRow,
                        draft.model === model && styles.modelRowActive,
                      ]}
                      onPress={() => setDraft({ ...draft, model })}
                    >
                      <Text style={styles.modelText}>{model}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={styles.label}>{t('Max tokens per reply')}</Text>
              <TextInput
                style={styles.input}
                value={draft.maxTokens}
                keyboardType="numeric"
                placeholderTextColor={colors.textSecondary}
                onChangeText={value =>
                  setDraft({
                    ...draft,
                    maxTokens: value.replace(/[^0-9]/g, ''),
                  })
                }
              />
              <Text style={styles.subtle}>
                {t('Capped at {max}.', { max: MAX_ALLOWED_TOKENS })}
              </Text>

              {aiService.supportsMcp(draft.kind) && (
                <>
                  <Text style={styles.groupHeading}>{t('MCP servers')}</Text>
                  <Text style={styles.subtle}>
                    {t(
                      'Remote MCP servers this provider connects to on your behalf. Local (stdio) servers cannot be used from a phone — there are no subprocesses on Android.',
                    )}
                  </Text>

                  {!draft.id && (
                    <Text style={styles.subtle}>
                      {t('Save the provider first, then add servers.')}
                    </Text>
                  )}

                  {(
                    providers.find(p => p.id === draft.id)?.mcpServers ?? []
                  ).map(server => (
                    <View key={server.name} style={styles.channelRow}>
                      <Text style={styles.channelText}>
                        {server.name} · {server.tools.join(', ')}
                        {server.hasToken ? ' · token' : ''}
                      </Text>
                      <TouchableOpacity
                        onPress={() => removeMcpServer(server.name)}
                      >
                        <Text style={styles.actionDanger}>{t('Remove')}</Text>
                      </TouchableOpacity>
                    </View>
                  ))}

                  {draft.id && (
                    <>
                      <TextInput
                        style={styles.input}
                        value={mcpName}
                        autoCapitalize="none"
                        placeholder={t('Server name')}
                        placeholderTextColor={colors.textSecondary}
                        onChangeText={setMcpName}
                      />
                      <TextInput
                        style={styles.input}
                        value={mcpUrl}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="url"
                        placeholder="https://mcp.example.com"
                        placeholderTextColor={colors.textSecondary}
                        onChangeText={setMcpUrl}
                      />
                      <TextInput
                        style={styles.input}
                        value={mcpTools}
                        autoCapitalize="none"
                        placeholder={t('Tool names, comma separated')}
                        placeholderTextColor={colors.textSecondary}
                        onChangeText={setMcpTools}
                      />
                      <TextInput
                        style={styles.input}
                        value={mcpToken}
                        autoCapitalize="none"
                        secureTextEntry
                        placeholder={t('Token (optional)')}
                        placeholderTextColor={colors.textSecondary}
                        onChangeText={setMcpToken}
                      />
                      <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={addMcpServer}
                      >
                        <Text style={styles.secondaryButtonText}>
                          {t('Add server')}
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                </>
              )}
            </ScrollView>
          )}
        </ModalSafeArea>
      </Modal>
    </Modal>
  );
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    headerTitle: { color: colors.text, fontSize: 17, fontWeight: '600' },
    headerAction: { color: colors.primary, fontSize: 15, fontWeight: '600' },
    scrollContent: { padding: 16, paddingBottom: 48 },
    masterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    masterText: { flex: 1, marginRight: 12 },
    groupHeading: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      marginTop: 8,
      marginBottom: 10,
    },
    channelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    channelText: {
      color: colors.text,
      fontSize: 13.5,
      fontFamily: 'monospace',
      flex: 1,
      marginRight: 12,
    },
    masterTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
    actionDisabled: { opacity: 0.4 },
    channelNetwork: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: 14,
      marginBottom: 2,
    },
    mcpEndpoint: {
      backgroundColor: colors.surfaceVariant,
      borderRadius: 8,
      padding: 12,
      marginTop: 8,
      marginBottom: 4,
    },
    mcpEndpointLabel: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 6,
    },
    mcpEndpointHint: {
      color: colors.textSecondary,
      fontSize: 12,
      marginTop: 6,
    },
    mcpEndpointValue: {
      color: colors.primary,
      fontSize: 13.5,
      fontFamily: 'monospace',
      marginTop: 2,
    },
    mcpEndpointWarning: {
      color: colors.warning,
      fontSize: 12.5,
      marginTop: 8,
      lineHeight: 18,
    },
    bindRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: 10,
      paddingHorizontal: 10,
      borderRadius: 8,
      marginTop: 6,
    },
    bindRowActive: { backgroundColor: colors.surfaceVariant },
    bindRadio: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 2,
      borderColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
      marginTop: 2,
    },
    bindRadioDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
    },
    bindTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
    bindWarning: {
      color: colors.warning,
      fontSize: 12.5,
      lineHeight: 18,
      marginTop: 8,
    },
    notice: {
      backgroundColor: colors.surfaceVariant,
      borderRadius: 8,
      padding: 12,
      marginBottom: 20,
    },
    noticeTitle: {
      color: colors.text,
      fontWeight: '600',
      marginBottom: 4,
    },
    subtle: { color: colors.textSecondary, fontSize: 12.5, lineHeight: 18 },
    blocker: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.warning,
      backgroundColor: colors.surface,
      borderRadius: 8,
      padding: 12,
      marginBottom: 18,
    },
    blockerTitle: {
      color: colors.warning,
      fontWeight: '700',
      fontSize: 13,
      marginBottom: 4,
    },
    blockerReason: { color: colors.text, fontSize: 13.5, lineHeight: 19 },
    blockerWhere: {
      color: colors.textSecondary,
      fontSize: 12.5,
      lineHeight: 18,
      marginTop: 4,
    },
    warning: { color: colors.warning, fontSize: 12.5, marginTop: 2 },
    loader: { marginTop: 24 },
    empty: {
      color: colors.textSecondary,
      fontStyle: 'italic',
      textAlign: 'center',
      marginTop: 24,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 12,
    },
    cardTop: { flexDirection: 'row', alignItems: 'flex-start' },
    cardText: { flex: 1, marginRight: 12 },
    titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
    cardTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
    badge: {
      color: colors.onPrimary,
      backgroundColor: colors.primary,
      fontSize: 10,
      fontWeight: '700',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      marginLeft: 8,
      overflow: 'hidden',
    },
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: 10,
      gap: 16,
    },
    action: { paddingVertical: 4 },
    actionText: { color: colors.primary, fontSize: 13.5, fontWeight: '600' },
    actionDanger: { color: colors.error, fontSize: 13.5, fontWeight: '600' },
    label: {
      color: colors.text,
      fontWeight: '600',
      marginTop: 14,
      marginBottom: 6,
    },
    input: {
      backgroundColor: colors.surfaceVariant,
      color: colors.text,
      borderRadius: 6,
      paddingHorizontal: 10,
      paddingVertical: 9,
    },
    presetList: {
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    presetRow: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    presetRowActive: { backgroundColor: colors.surfaceVariant },
    presetText: { flex: 1 },
    presetName: { color: colors.text, fontSize: 14.5, fontWeight: '600' },
    freeBadge: {
      color: colors.onPrimary,
      backgroundColor: colors.success ?? colors.primary,
      fontSize: 10,
      fontWeight: '700',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      marginLeft: 8,
      overflow: 'hidden',
    },
    presetLink: {
      color: colors.primary,
      fontSize: 12.5,
      marginTop: 8,
      textDecorationLine: 'underline',
    },
    kindRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    kindChip: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    kindChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    kindChipText: { color: colors.textSecondary, fontSize: 13 },
    kindChipTextActive: { color: colors.onPrimary, fontWeight: '600' },
    secondaryButton: {
      marginTop: 8,
      alignSelf: 'flex-start',
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.primary,
    },
    secondaryButtonText: {
      color: colors.primary,
      fontSize: 13.5,
      fontWeight: '600',
    },
    modelFilter: {
      backgroundColor: colors.surfaceVariant,
      color: colors.text,
      paddingHorizontal: 12,
      paddingVertical: 9,
      fontSize: 14,
    },
    modelList: {
      marginTop: 10,
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    modelRow: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    modelRowActive: { backgroundColor: colors.surfaceVariant },
    modelText: { color: colors.text, fontSize: 13.5, fontFamily: 'monospace' },
  });

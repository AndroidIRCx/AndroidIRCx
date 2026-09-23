/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React, { useCallback, useEffect, useState } from 'react';
import { SettingItem } from '../SettingItem';
import { useT } from '../../../i18n/localization';
import { aiService } from '../../../services/ai/AIService';
import { aiProviderStore } from '../../../services/ai/AIProviderStore';
import { AIReadiness } from '../../../services/ai/types';
import {
  SettingItem as SettingItemType,
  SettingIcon,
} from '../../../types/settings';

interface AISectionProps {
  colors: {
    text: string;
    textSecondary: string;
    primary: string;
    onPrimary?: string;
    surface: string;
    border: string;
    background: string;
  };
  styles: {
    settingItem: any;
    settingContent: any;
    settingTitleRow: any;
    settingTitle: any;
    settingDescription: any;
    disabledItem: any;
    disabledText: any;
    chevron: any;
  };
  settingIcons: Record<string, SettingIcon | undefined>;
  onShowAISettings: () => void;
  onShowAIAgent: () => void;
}

export const AISection: React.FC<AISectionProps> = ({
  colors,
  styles,
  settingIcons,
  onShowAISettings,
  onShowAIAgent,
}) => {
  const t = useT();
  const tags = 'screen:settings,file:AISection.tsx,feature:settings';

  const [enabled, setEnabled] = useState(true);
  const [providerCount, setProviderCount] = useState(0);
  const [usable, setUsable] = useState(false);
  const [blocker, setBlocker] = useState<AIReadiness | null>(null);

  const refresh = useCallback(async () => {
    await aiService.loadSettings();
    const providers = await aiProviderStore.list();
    const readiness = await aiService.diagnose();
    setEnabled(aiService.isEnabled());
    setProviderCount(providers.length);
    setUsable(readiness.ready);
    setBlocker(readiness.ready ? null : readiness);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const describeProviders = () => {
    if (providerCount === 0) {
      return t(
        'No provider configured yet — add your own API key or a local model',
        {
          _tags: tags,
        },
      );
    }
    if (!usable && blocker) {
      // Name the blocker and where to fix it: "not ready" on its own leaves
      // the user hunting through settings for which of four things is wrong.
      return `${blocker.reason} ${blocker.where}`;
    }
    return t('{count} configured', { count: providerCount, _tags: tags });
  };

  const sectionData: SettingItemType[] = [
    {
      id: 'ai-enabled',
      title: t('Enable AI', { _tags: tags }),
      description: t('Master switch for every AI call made by scripts', {
        _tags: tags,
      }),
      type: 'switch',
      value: enabled,
      searchKeywords: ['ai', 'enable', 'disable', 'kill switch', 'off'],
      onValueChange: async (value: boolean | string) => {
        setEnabled(value as boolean);
        await aiService.setEnabled(value as boolean);
        await refresh();
      },
    },
    {
      id: 'ai-providers',
      title: t('AI Providers', { _tags: tags }),
      description: describeProviders(),
      type: 'button',
      searchKeywords: [
        'ai',
        'provider',
        'api key',
        'claude',
        'anthropic',
        'openai',
        'chatgpt',
        'gemini',
        'ollama',
        'local',
        'model',
        'llm',
      ],
      onPress: onShowAISettings,
    },
    {
      id: 'ai-agent',
      title: t('Assistant', { _tags: tags }),
      description: usable
        ? t('Ask about your session. It asks before it sends anything.', {
            _tags: tags,
          })
        : blocker
          ? `${blocker.reason} ${blocker.where}`
          : t('Set up a provider first', { _tags: tags }),
      type: 'button',
      disabled: !usable,
      searchKeywords: [
        'assistant',
        'agent',
        'chat',
        'ask',
        'ai',
        'bot',
        'help',
      ],
      onPress: onShowAIAgent,
    },
  ];

  return (
    <>
      {sectionData.map(item => {
        const itemIcon =
          (typeof item.icon === 'object' ? item.icon : undefined) ||
          settingIcons[item.id];
        return (
          <SettingItem
            key={item.id}
            item={item}
            icon={itemIcon}
            colors={colors}
            styles={styles}
          />
        );
      })}
    </>
  );
};

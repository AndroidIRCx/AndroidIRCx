import React, { useMemo, useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { SettingItem } from '../SettingItem';
import { useT } from '../../../i18n/transifex';
import { SettingItem as SettingItemType, SettingIcon } from '../../../types/settings';
import { highlightService } from '../../../services/HighlightService';

interface HighlightingSectionProps {
  colors: {
    text: string;
    textSecondary: string;
    primary: string;
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
    input?: any;
    disabledInput?: any;
  };
  settingIcons: Record<string, SettingIcon | undefined>;
}

export const HighlightingSection: React.FC<HighlightingSectionProps> = ({
  colors,
  styles,
  settingIcons,
}) => {
  const t = useT();
  const tags = 'screen:settings,file:HighlightingSection.tsx,feature:settings';
  
  const [highlightWords, setHighlightWords] = useState<string[]>([]);
  const [newHighlightWord, setNewHighlightWord] = useState('');

  // Load initial state
  useEffect(() => {
    setHighlightWords(highlightService.getHighlightWords());
  }, []);

  const sectionData: SettingItemType[] = useMemo(() => {
    const items: SettingItemType[] = [
      {
        id: 'highlight-add',
        title: t('Add Highlight Word', { _tags: tags }),
        description: t('Messages containing these words will be highlighted.', { _tags: tags }),
        type: 'input',
        value: newHighlightWord,
        placeholder: t('Enter a word to highlight...', { _tags: tags }),
        onValueChange: (value: string | boolean) => setNewHighlightWord(value as string),
        onPress: async () => {
          if (newHighlightWord.trim()) {
            await highlightService.addHighlightWord(newHighlightWord.trim());
            setHighlightWords(highlightService.getHighlightWords());
            setNewHighlightWord('');
          }
        },
      },
      ...highlightWords.map(word => ({
        id: `highlight-word-${word}`,
        title: word,
        type: 'button' as const,
        onPress: () => {
          Alert.alert(
            t('Remove Highlight Word', { _tags: tags }),
            t('Are you sure you want to remove "{word}"?', { word, _tags: tags }),
            [
              { text: t('Cancel', { _tags: tags }), style: 'cancel' },
              {
                text: t('Remove', { _tags: tags }),
                style: 'destructive',
                onPress: async () => {
                  await highlightService.removeHighlightWord(word);
                  setHighlightWords(highlightService.getHighlightWords());
                },
              },
            ],
          );
        },
      })),
    ];

    return items;
  }, [highlightWords, newHighlightWord, t, tags]);

  return (
    <>
      {sectionData.map((item) => {
        const itemIcon = (typeof item.icon === 'object' ? item.icon : undefined) || settingIcons[item.id];
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

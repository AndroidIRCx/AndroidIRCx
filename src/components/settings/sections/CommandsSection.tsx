import React, { useMemo, useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { SettingItem } from '../SettingItem';
import { useT } from '../../../i18n/transifex';
import { SettingItem as SettingItemType, SettingIcon } from '../../../types/settings';
import { commandService, CommandAlias, CommandHistoryEntry, CustomCommand } from '../../../services/CommandService';

interface CommandsSectionProps {
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

export const CommandsSection: React.FC<CommandsSectionProps> = ({
  colors,
  styles,
  settingIcons,
}) => {
  const t = useT();
  const tags = 'screen:settings,file:CommandsSection.tsx,feature:settings';
  
  const [commandAliases, setCommandAliases] = useState<CommandAlias[]>([]);
  const [customCommands, setCustomCommands] = useState<CustomCommand[]>([]);
  const [commandHistory, setCommandHistory] = useState<CommandHistoryEntry[]>([]);
  const [newAliasName, setNewAliasName] = useState('');
  const [newAliasCommand, setNewAliasCommand] = useState('');
  const [newCmdName, setNewCmdName] = useState('');
  const [newCmdCommand, setNewCmdCommand] = useState('');

  // Load initial state
  useEffect(() => {
    setCommandAliases(commandService.getAliases());
    setCustomCommands(commandService.getCustomCommands());
    setCommandHistory(commandService.getHistory(20)); // Last 20 commands
  }, []);

  const sectionData: SettingItemType[] = useMemo(() => {
    const items: SettingItemType[] = [
      {
        id: 'commands-history',
        title: t('Command History', { _tags: tags }),
        description: `${commandHistory.length} commands in history`,
        type: 'submenu',
        submenuItems: [
          ...commandHistory.map((entry) => ({
            id: `history-${entry.id}`,
            title: entry.command,
            description: `${new Date(entry.timestamp).toLocaleString()}${entry.channel ? ` · ${entry.channel}` : ''}`,
            type: 'button' as const,
            onPress: () => {
              Alert.alert(
                'Delete Entry',
                `Remove this command?\n\n${entry.command}`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                      await commandService.deleteHistoryEntry(entry.id);
                      setCommandHistory(commandService.getHistory(50));
                    },
                  },
                ]
              );
            },
          })),
          {
            id: 'history-clear',
            title: t('Clear All History', { _tags: tags }),
            description: t('Delete every command entry', { _tags: tags }),
            type: 'button' as const,
            onPress: () => {
              Alert.alert(
                t('Clear Command History', { _tags: tags }),
                t('Are you sure you want to delete all command history?', { _tags: tags }),
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete All',
                    style: 'destructive',
                    onPress: async () => {
                      await commandService.clearHistory();
                      setCommandHistory([]);
                    },
                  },
                ]
              );
            },
          },
        ],
      },
      {
        id: 'commands-aliases',
        title: t('Command Aliases', { _tags: tags }),
        description: `${commandAliases.length} aliases configured`,
        type: 'submenu',
        submenuItems: [
          {
            id: 'alias-name-input',
            title: t('Alias Name (without /)', { _tags: tags }),
            type: 'input',
            value: newAliasName,
            placeholder: t('e.g. j', { _tags: tags }),
            onValueChange: (value: string | boolean) => setNewAliasName(value as string),
          },
          {
            id: 'alias-command-input',
            title: t('Alias Command', { _tags: tags }),
            description: t('Example: /join {channel}', { _tags: tags }),
            type: 'input',
            value: newAliasCommand,
            placeholder: t('e.g. /join {channel}', { _tags: tags }),
            onValueChange: (value: string | boolean) => setNewAliasCommand(value as string),
          },
          {
            id: 'alias-add',
            title: t('Add Alias', { _tags: tags }),
            description: t('Create or update alias', { _tags: tags }),
            type: 'button',
            onPress: async () => {
              const aliasName = newAliasName.trim().replace(/^\//, '');
              const aliasCmd = newAliasCommand.trim();
              if (!aliasName || !aliasCmd) return;
              await commandService.addAlias({
                alias: aliasName,
                command: aliasCmd,
                description: '',
              });
              setCommandAliases(commandService.getAliases());
              setNewAliasName('');
              setNewAliasCommand('');
            },
          },
          ...commandAliases.map(alias => ({
            id: `alias-${alias.alias}`,
            title: `/${alias.alias}`,
            description: `${alias.command} - ${alias.description || 'No description'}`,
            type: 'button' as const,
            onPress: () => {
              Alert.alert(
                `Alias: /${alias.alias}`,
                `Command: ${alias.command}\nDescription: ${alias.description || 'No description'}`,
                [
                  { text: 'Delete', style: 'destructive', onPress: async () => {
                    await commandService.removeAlias(alias.alias);
                    setCommandAliases(commandService.getAliases());
                  }},
                  { text: 'OK' },
                ]
              );
            },
          })),
        ],
      },
      {
        id: 'commands-custom',
        title: t('Custom Commands', { _tags: tags }),
        description: `${customCommands.length} custom commands`,
        type: 'submenu',
        submenuItems: [
          {
            id: 'custom-name-input',
            title: t('Command Name (without /)', { _tags: tags }),
            type: 'input',
            value: newCmdName,
            placeholder: t('e.g. greet', { _tags: tags }),
            onValueChange: (value: string | boolean) => setNewCmdName(value as string),
          },
          {
            id: 'custom-command-input',
            title: t('Command Template', { _tags: tags }),
            description: t('Use {param1}, {channel}, {nick} placeholders', { _tags: tags }),
            type: 'input',
            value: newCmdCommand,
            placeholder: t('e.g. /msg {channel} Hello {param1}', { _tags: tags }),
            onValueChange: (value: string | boolean) => setNewCmdCommand(value as string),
          },
          {
            id: 'cmd-add',
            title: t('Add Custom Command', { _tags: tags }),
            description: t('Save template with placeholders', { _tags: tags }),
            type: 'button',
            onPress: async () => {
              const cmdName = newCmdName.trim().replace(/^\//, '');
              const cmdString = newCmdCommand.trim();
              if (!cmdName || !cmdString) return;
              const paramMatches = cmdString.match(/\{(\w+)\}/g);
              const parameters = paramMatches
                ? [...new Set(paramMatches.map(m => m.slice(1, -1)))]
                : [];
              await commandService.addCustomCommand({
                name: cmdName,
                command: cmdString,
                description: '',
                parameters: parameters.length > 0 ? parameters : undefined,
              });
              setCustomCommands(commandService.getCustomCommands());
              setNewCmdName('');
              setNewCmdCommand('');
            },
          },
          ...customCommands.map(cmd => ({
            id: `cmd-${cmd.name}`,
            title: `/${cmd.name}`,
            description: `${cmd.command} - ${cmd.description || 'No description'}`,
            type: 'button' as const,
            onPress: () => {
              Alert.alert(
                `Custom Command: /${cmd.name}`,
                `Command: ${cmd.command}\nDescription: ${cmd.description || 'No description'}\nParameters: ${cmd.parameters?.join(', ') || 'None'}`,
                [
                  { text: 'Delete', style: 'destructive', onPress: async () => {
                    await commandService.removeCustomCommand(cmd.name);
                    setCustomCommands(commandService.getCustomCommands());
                  }},
                  { text: 'OK' },
                ]
              );
            },
          })),
        ],
      },
    ];

    return items;
  }, [
    commandHistory,
    commandAliases,
    customCommands,
    newAliasName,
    newAliasCommand,
    newCmdName,
    newCmdCommand,
    t,
    tags,
  ]);

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

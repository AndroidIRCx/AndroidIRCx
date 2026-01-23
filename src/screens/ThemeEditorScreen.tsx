import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Alert,
} from 'react-native';
import { themeService, Theme, ThemeColors } from '../services/ThemeService';
import { useT } from '../i18n/transifex';

interface ThemeEditorScreenProps {
  visible: boolean;
  theme?: Theme;
  onClose: () => void;
  onSave: (theme: Theme) => void;
}

export const ThemeEditorScreen: React.FC<ThemeEditorScreenProps> = ({
  visible,
  theme,
  onClose,
  onSave,
}) => {
  const t = useT();
  const [themeName, setThemeName] = useState('');
  const [colors, setColors] = useState<ThemeColors>(themeService.getColors());
  const [editingColor, setEditingColor] = useState<keyof ThemeColors | null>(null);
  const [colorValue, setColorValue] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [hexInput, setHexInput] = useState('');

  useEffect(() => {
    if (theme) {
      setThemeName(theme.name);
      setColors(theme.colors);
    } else {
      setThemeName('');
      setColors(themeService.getColors());
    }
  }, [theme, visible]);

  const handleColorPress = (key: keyof ThemeColors) => {
    setEditingColor(key);
    setColorValue(colors[key]);
    setHexInput(colors[key]);
    setShowColorPicker(true);
  };

  const isValidColor = (value: string) => {
    const hexPattern = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    return hexPattern.test(value) || value.startsWith('rgba(');
  };

  const applyColorValue = (value: string) => {
    if (!editingColor) {
      return;
    }
    setColors(prev => ({
      ...prev,
      [editingColor]: value,
    }));
    setColorValue(value);
  };

  const handleSave = async () => {
    if (!themeName.trim()) {
      Alert.alert(t('Error'), t('Please enter a theme name'));
      return;
    }

    if (theme) {
      // Update existing theme
      await themeService.updateCustomTheme(theme.id, {
        name: themeName,
        colors,
      });
      onSave({
        ...theme,
        name: themeName,
        colors,
      });
    } else {
      // Create new theme
      const newTheme = await themeService.createCustomTheme(themeName, 'dark');
      await themeService.updateCustomTheme(newTheme.id, { colors });
      onSave({
        ...newTheme,
        colors,
      });
    }

    onClose();
  };

  const colorCategories: Array<{ title: string; keys: Array<keyof ThemeColors> }> = [
    {
      title: t('Background'),
      keys: ['background', 'surface', 'surfaceVariant'],
    },
    {
      title: t('Text'),
      keys: ['text', 'textSecondary', 'textDisabled'],
    },
    {
      title: t('Primary'),
      keys: ['primary', 'primaryDark', 'primaryLight', 'onPrimary'],
    },
    {
      title: t('Secondary'),
      keys: ['secondary', 'onSecondary'],
    },
    {
      title: t('Status'),
      keys: ['success', 'error', 'warning', 'info'],
    },
    {
      title: t('Borders'),
      keys: ['border', 'borderLight', 'divider'],
    },
    {
      title: t('Messages'),
      keys: [
        'messageBackground',
        'messageText',
        'messageNick',
        'messageTimestamp',
        'systemMessage',
        'joinMessage',
        'partMessage',
        'quitMessage',
        'topicMessage',
        'actionMessage',
      ],
    },
    {
      title: t('Input'),
      keys: ['inputBackground', 'inputText', 'inputBorder', 'inputPlaceholder'],
    },
    {
      title: t('Buttons'),
      keys: [
        'buttonPrimary',
        'buttonPrimaryText',
        'buttonSecondary',
        'buttonSecondaryText',
        'buttonDisabled',
        'buttonDisabledText',
      ],
    },
    {
      title: t('Tabs'),
      keys: [
        'tabActive',
        'tabInactive',
        'tabActiveText',
        'tabInactiveText',
        'tabBorder',
      ],
    },
    {
      title: t('Modal'),
      keys: ['modalOverlay', 'modalBackground', 'modalText'],
    },
    {
      title: t('User List'),
      keys: [
        'userListBackground',
        'userListText',
        'userListBorder',
        'userOp',
        'userVoice',
        'userNormal',
      ],
    },
  ];

  const currentColors = themeService.getColors();
  const predefinedColors = [
    '#000000',
    '#1A1A1A',
    '#2D2D2D',
    '#3C3C3C',
    '#4A4A4A',
    '#5C5C5C',
    '#6B6B6B',
    '#8A8A8A',
    '#B0B0B0',
    '#D0D0D0',
    '#E6E6E6',
    '#FFFFFF',
    '#1E3A8A',
    '#2563EB',
    '#3B82F6',
    '#60A5FA',
    '#93C5FD',
    '#0F766E',
    '#14B8A6',
    '#2DD4BF',
    '#34D399',
    '#10B981',
    '#16A34A',
    '#22C55E',
    '#4ADE80',
    '#86EFAC',
    '#F59E0B',
    '#F97316',
    '#EA580C',
    '#EF4444',
    '#DC2626',
    '#B91C1C',
    '#7C3AED',
    '#A855F7',
    '#C084FC',
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: currentColors.background }]}>
        <View style={[styles.header, { backgroundColor: currentColors.primary }]}>
          <TouchableOpacity onPress={onClose} style={styles.cancelButton}>
            <Text style={[styles.cancelText, { color: currentColors.onPrimary }]}>{t('Cancel')}</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: currentColors.onPrimary }]}>
            {theme ? t('Edit Theme') : t('New Theme')}
          </Text>
          <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
            <Text style={[styles.saveText, { color: currentColors.onPrimary }]}>{t('Save')}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          <View style={[styles.section, { borderBottomColor: currentColors.divider }]}>
            <Text style={[styles.sectionTitle, { color: currentColors.text }]}>{t('Theme Name')}</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: currentColors.surface,
                  color: currentColors.text,
                  borderColor: currentColors.border,
                },
              ]}
              value={themeName}
              onChangeText={setThemeName}
              placeholder={t('Enter theme name')}
              placeholderTextColor={currentColors.textSecondary}
            />
          </View>

          {colorCategories.map(category => (
            <View
              key={category.title}
              style={[styles.section, { borderBottomColor: currentColors.divider }]}>
              <Text style={[styles.sectionTitle, { color: currentColors.text }]}>
                {category.title}
              </Text>
              {category.keys.map(key => (
                <View key={key} style={styles.colorRow}>
                  <Text style={[styles.colorLabel, { color: currentColors.textSecondary }]}>
                    {key}
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.colorPreview,
                      { backgroundColor: colors[key] },
                      { borderColor: currentColors.border },
                    ]}
                    onPress={() => handleColorPress(key)}
                  />
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      </View>
      <Modal
        visible={showColorPicker}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowColorPicker(false);
          setEditingColor(null);
          setHexInput('');
        }}>
        <View style={styles.pickerOverlay}>
          <View style={[styles.pickerContainer, { backgroundColor: currentColors.surface }]}>
            <Text style={[styles.pickerTitle, { color: currentColors.text }]}>
              {t('Choose Color')}
            </Text>
            <Text style={[styles.pickerSubtitle, { color: currentColors.textSecondary }]}>
              {t('Current color: {color}', { color: colorValue || '' })}
            </Text>
            <View style={styles.pickerPreviewRow}>
              <View
                style={[
                  styles.pickerPreview,
                  { backgroundColor: colorValue || currentColors.surfaceVariant, borderColor: currentColors.border },
                ]}
              />
            </View>
            <View style={styles.pickerInputRow}>
              <Text style={[styles.pickerLabel, { color: currentColors.text }]}>
                {t('Hex Color:')}
              </Text>
              <TextInput
                style={[
                  styles.pickerInput,
                  {
                    backgroundColor: currentColors.surface,
                    color: currentColors.text,
                    borderColor: currentColors.border,
                  },
                ]}
                value={hexInput}
                onChangeText={(text) => {
                  setHexInput(text);
                  if (isValidColor(text)) {
                    applyColorValue(text);
                  }
                }}
                placeholder={t('#FFFFFF')}
                placeholderTextColor={currentColors.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <ScrollView style={styles.pickerGridScroll}>
              <View style={styles.pickerGrid}>
                {predefinedColors.map((value) => (
                  <TouchableOpacity
                    key={value}
                    style={[
                      styles.pickerSwatch,
                      { backgroundColor: value },
                      value === colorValue && { borderColor: currentColors.primary, borderWidth: 2 },
                    ]}
                    onPress={() => {
                      setHexInput(value);
                      applyColorValue(value);
                    }}
                  />
                ))}
              </View>
            </ScrollView>
            <View style={styles.pickerActions}>
              <TouchableOpacity
                style={[styles.pickerButton, { backgroundColor: currentColors.surfaceVariant }]}
                onPress={() => {
                  setShowColorPicker(false);
                  setEditingColor(null);
                  setHexInput('');
                }}>
                <Text style={[styles.pickerButtonText, { color: currentColors.text }]}>
                  {t('Cancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pickerButton, { backgroundColor: currentColors.primary }]}
                onPress={() => {
                  if (hexInput && !isValidColor(hexInput)) {
                    Alert.alert(t('Invalid Color'), t('Please enter a valid hex color (e.g., #FF0000) or rgba value'));
                    return;
                  }
                  setShowColorPicker(false);
                  setEditingColor(null);
                  setHexInput('');
                }}>
                <Text style={[styles.pickerButtonText, { color: currentColors.onPrimary }]}>
                  {t('Done')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  cancelButton: {
    padding: 8,
  },
  cancelText: {
    fontSize: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  saveButton: {
    padding: 8,
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 4,
    padding: 12,
    fontSize: 14,
  },
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 4,
  },
  colorLabel: {
    flex: 1,
    fontSize: 14,
  },
  colorPreview: {
    width: 40,
    height: 40,
    borderRadius: 4,
    borderWidth: 1,
    marginLeft: 12,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerContainer: {
    width: '90%',
    maxWidth: 420,
    borderRadius: 12,
    padding: 16,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 6,
  },
  pickerSubtitle: {
    fontSize: 12,
    marginBottom: 12,
  },
  pickerPreviewRow: {
    alignItems: 'center',
    marginBottom: 12,
  },
  pickerPreview: {
    width: 72,
    height: 72,
    borderRadius: 8,
    borderWidth: 1,
  },
  pickerInputRow: {
    marginBottom: 12,
  },
  pickerLabel: {
    fontSize: 12,
    marginBottom: 6,
  },
  pickerInput: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
  },
  pickerGridScroll: {
    maxHeight: 220,
    marginBottom: 12,
  },
  pickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pickerSwatch: {
    width: 32,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  pickerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  pickerButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  pickerButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});


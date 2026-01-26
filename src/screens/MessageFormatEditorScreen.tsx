import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  TextStyle,
} from 'react-native';
import { useT } from '../i18n/transifex';
import {
  MessageFormatPart,
  MessageFormatStyle,
  ThemeColors,
  ThemeMessageFormats,
} from '../services/ThemeService';
import {
  AVAILABLE_MESSAGE_FORMAT_TOKENS,
  getDefaultMessageFormats,
} from '../utils/MessageFormatDefaults';
import { IRC_EXTENDED_COLOR_MAP, IRC_STANDARD_COLOR_MAP } from '../utils/IRCFormatter';

interface MessageFormatEditorScreenProps {
  visible: boolean;
  colors: ThemeColors;
  initialFormats?: ThemeMessageFormats;
  onSave: (formats: ThemeMessageFormats) => void;
  onCancel: () => void;
}

type FormatKey = keyof ThemeMessageFormats;

type EditMode = 'add' | 'edit';

interface EditState {
  mode: EditMode;
  formatKey: FormatKey;
  index: number;
  part: MessageFormatPart;
}

type ColorTarget = 'color' | 'backgroundColor';

const buildDefaultPart = (): MessageFormatPart => ({
  type: 'token',
  value: AVAILABLE_MESSAGE_FORMAT_TOKENS[0].value,
  style: {},
});

const clonePart = (part: MessageFormatPart): MessageFormatPart =>
  JSON.parse(JSON.stringify(part));

const applyPreviewStyle = (baseStyle: TextStyle, formatStyle?: MessageFormatStyle): TextStyle => {
  if (!formatStyle) {
    return baseStyle;
  }

  const textStyle: TextStyle = { ...baseStyle };

  if (formatStyle.bold) {
    textStyle.fontWeight = 'bold';
  }
  if (formatStyle.italic) {
    textStyle.fontStyle = 'italic';
  }
  if (formatStyle.underline) {
    textStyle.textDecorationLine = textStyle.textDecorationLine
      ? `${textStyle.textDecorationLine} underline`
      : 'underline';
  }
  if (formatStyle.strikethrough) {
    textStyle.textDecorationLine = textStyle.textDecorationLine
      ? `${textStyle.textDecorationLine} line-through`
      : 'line-through';
  }
  if (formatStyle.color) {
    textStyle.color = formatStyle.color;
  }
  if (formatStyle.backgroundColor) {
    textStyle.backgroundColor = formatStyle.backgroundColor;
  }
  if (formatStyle.reverse) {
    const prevColor = textStyle.color;
    textStyle.color = textStyle.backgroundColor;
    textStyle.backgroundColor = prevColor;
  }

  return textStyle;
};

export const MessageFormatEditorScreen: React.FC<MessageFormatEditorScreenProps> = ({
  visible,
  colors,
  initialFormats,
  onSave,
  onCancel,
}) => {
  const t = useT();
  const [formats, setFormats] = useState<ThemeMessageFormats>(getDefaultMessageFormats());
  const [editState, setEditState] = useState<EditState | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [colorTarget, setColorTarget] = useState<ColorTarget>('color');
  const [colorMode, setColorMode] = useState<'standard' | 'extended' | 'custom'>('standard');
  const [customColor, setCustomColor] = useState('#FFFFFF');

  useEffect(() => {
    if (visible) {
      setFormats(initialFormats ? JSON.parse(JSON.stringify(initialFormats)) : getDefaultMessageFormats());
    }
  }, [visible, initialFormats]);

  const formatSections = useMemo(
    () => [
      { key: 'message', title: t('Message format') },
      { key: 'messageMention', title: t('Message with mention format') },
      { key: 'action', title: t('Action (/me) message format') },
      { key: 'actionMention', title: t('Action (/me) message with mention format') },
      { key: 'notice', title: t('Notice message format') },
      { key: 'event', title: t('Event (join/leave/etc.) message format') },
    ],
    [t],
  );

  const tokenLabels = useMemo(
    () => ({
      time: t('time'),
      nick: t('sender'),
      message: t('message'),
      channel: t('channel'),
      network: t('network'),
      account: t('account'),
      username: t('username'),
      hostname: t('hostname'),
      hostmask: t('hostmask'),
      target: t('target'),
      mode: t('mode'),
      topic: t('topic'),
      reason: t('reason'),
      numeric: t('numeric'),
      command: t('command'),
    }),
    [t],
  );

  const previewValues = useMemo<Record<FormatKey, Record<string, string>>>(
    () => ({
      message: {
        time: '12:00',
        nick: 'sender-nick',
        message: t('This is an example message.'),
        channel: '#example',
        network: 'Network',
        account: 'account',
        username: 'user',
        hostname: 'host.test',
        hostmask: 'sender-nick!user@host.test',
        target: '#example',
        mode: '+o',
        topic: t('Example topic'),
        reason: t('Example reason'),
        numeric: '001',
        command: 'PRIVMSG',
      },
      messageMention: {
        time: '12:00',
        nick: 'sender-nick',
        message: t('This is an example message.'),
        channel: '#example',
        network: 'Network',
        account: 'account',
        username: 'user',
        hostname: 'host.test',
        hostmask: 'sender-nick!user@host.test',
        target: '#example',
        mode: '+o',
        topic: t('Example topic'),
        reason: t('Example reason'),
        numeric: '001',
        command: 'PRIVMSG',
      },
      action: {
        time: '12:00',
        nick: 'sender-nick',
        message: t('does an example action'),
        channel: '#example',
        network: 'Network',
        account: 'account',
        username: 'user',
        hostname: 'host.test',
        hostmask: 'sender-nick!user@host.test',
        target: '#example',
        mode: '+o',
        topic: t('Example topic'),
        reason: t('Example reason'),
        numeric: '001',
        command: 'ACTION',
      },
      actionMention: {
        time: '12:00',
        nick: 'sender-nick',
        message: t('does an example action'),
        channel: '#example',
        network: 'Network',
        account: 'account',
        username: 'user',
        hostname: 'host.test',
        hostmask: 'sender-nick!user@host.test',
        target: '#example',
        mode: '+o',
        topic: t('Example topic'),
        reason: t('Example reason'),
        numeric: '001',
        command: 'ACTION',
      },
      notice: {
        time: '12:00',
        nick: 'sender-nick',
        message: t('This is an example message.'),
        channel: '#example',
        network: 'Network',
        account: 'account',
        username: 'user',
        hostname: 'host.test',
        hostmask: 'sender-nick!user@host.test',
        target: '#example',
        mode: '+o',
        topic: t('Example topic'),
        reason: t('Example reason'),
        numeric: '001',
        command: 'NOTICE',
      },
      event: {
        time: '12:00',
        nick: 'sender-nick',
        message: t('[sender-nick!user@host.test has joined]'),
        channel: '#example',
        network: 'Network',
        account: 'account',
        username: 'user',
        hostname: 'host.test',
        hostmask: 'sender-nick!user@host.test',
        target: '#example',
        mode: '+o',
        topic: t('Example topic'),
        reason: t('Example reason'),
        numeric: '001',
        command: 'JOIN',
      },
    }),
    [t],
  );

  const updateFormatParts = (formatKey: FormatKey, nextParts: MessageFormatPart[]) => {
    setFormats(prev => ({
      ...prev,
      [formatKey]: nextParts,
    }));
  };

  const openAddPart = (formatKey: FormatKey) => {
    setEditState({
      mode: 'add',
      formatKey,
      index: formats[formatKey].length,
      part: buildDefaultPart(),
    });
  };

  const openEditPart = (formatKey: FormatKey, index: number) => {
    setEditState({
      mode: 'edit',
      formatKey,
      index,
      part: clonePart(formats[formatKey][index]),
    });
  };

  const applyEdit = () => {
    if (!editState) return;
    const { formatKey, index, part, mode } = editState;
    const nextParts = [...formats[formatKey]];
    if (mode === 'add') {
      nextParts.push(part);
    } else {
      nextParts[index] = part;
    }
    updateFormatParts(formatKey, nextParts);
    setEditState(null);
  };

  const deletePart = () => {
    if (!editState || editState.mode !== 'edit') return;
    const { formatKey, index } = editState;
    const nextParts = formats[formatKey].filter((_, idx) => idx !== index);
    updateFormatParts(formatKey, nextParts);
    setEditState(null);
  };

  const movePart = (direction: -1 | 1) => {
    if (!editState || editState.mode !== 'edit') return;
    const { formatKey, index } = editState;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= formats[formatKey].length) return;
    const nextParts = [...formats[formatKey]];
    const [item] = nextParts.splice(index, 1);
    nextParts.splice(nextIndex, 0, item);
    updateFormatParts(formatKey, nextParts);
    setEditState({
      ...editState,
      index: nextIndex,
    });
  };

  const updateEditPart = (updates: Partial<MessageFormatPart>) => {
    if (!editState) return;
    setEditState(prev => (prev ? { ...prev, part: { ...prev.part, ...updates } } : prev));
  };

  const updateEditStyle = (updates: Partial<MessageFormatStyle>) => {
    if (!editState) return;
    setEditState(prev =>
      prev
        ? {
            ...prev,
            part: {
              ...prev.part,
              style: {
                ...(prev.part.style || {}),
                ...updates,
              },
            },
          }
        : prev,
    );
  };

  const openColorPicker = (target: ColorTarget) => {
    setColorTarget(target);
    setShowColorPicker(true);
  };

  const applyColor = (value: string) => {
    updateEditStyle({ [colorTarget]: value });
    setShowColorPicker(false);
  };

  const clearColor = () => {
    updateEditStyle({ [colorTarget]: undefined });
    setShowColorPicker(false);
  };

  const currentStyle = editState?.part.style || {};

  const renderPreviewParts = (formatKey: FormatKey) => {
    const parts = formats[formatKey];
    const values = previewValues[formatKey];
    const baseStyle: TextStyle = {
      fontSize: 14,
      color: colors.text,
    };

    return (
      <>
        {parts.map((part, index) => {
          if (part.type === 'text') {
            if (!part.value) {
              return null;
            }
            return (
              <Text key={`preview-${index}`} style={applyPreviewStyle(baseStyle, part.style)}>
                {part.value}
              </Text>
            );
          }

          const tokenValue = values[part.value] || '';
          if (!tokenValue) {
            return null;
          }

            return (
              <Text key={`preview-${index}`} style={applyPreviewStyle(baseStyle, part.style)}>
                {tokenValue}
              </Text>
            );
        })}
      </>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.primary }]}>
          <TouchableOpacity onPress={onCancel}>
            <Text style={[styles.headerText, { color: colors.onPrimary }]}>{t('Cancel')}</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.onPrimary }]}>{t('Message Format')}</Text>
          <TouchableOpacity onPress={() => onSave(formats)}>
            <Text style={[styles.headerText, { color: colors.onPrimary }]}>{t('Save')}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {formatSections.map(section => {
            const formatKey = section.key as FormatKey;
            return (
              <View
                key={section.key}
                style={[styles.section, { borderBottomColor: colors.divider }]}
              >
                <Text style={[styles.sectionTitle, { color: colors.text }]}>{section.title}</Text>
                <View style={[styles.previewRow, { backgroundColor: colors.surfaceVariant }]}>
                  {renderPreviewParts(formatKey)}
                </View>
                <View style={styles.partsRow}>
                  {formats[formatKey].map((part, index) => (
                    <TouchableOpacity
                      key={`${section.key}-${index}`}
                      style={[
                        styles.partChip,
                        { backgroundColor: colors.surface, borderColor: colors.border },
                      ]}
                      onPress={() => openEditPart(formatKey, index)}
                    >
                      <Text style={[styles.partText, { color: colors.text }]}>
                        {part.type === 'token'
                          ? `{${tokenLabels[part.value as keyof typeof tokenLabels] || part.value}}`
                          : part.value || t('Text')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={[styles.addChip, { borderColor: colors.primary }]}
                    onPress={() => openAddPart(formatKey)}
                  >
                    <Text style={[styles.addChipText, { color: colors.primary }]}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>

        <Modal
          visible={!!editState}
          transparent
          animationType="fade"
          onRequestClose={() => setEditState(null)}
        >
          <View style={styles.overlay}>
            <View style={[styles.editorCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.editorTitle, { color: colors.text }]}>
                {editState?.mode === 'add' ? t('Add Part') : t('Edit Part')}
              </Text>

              <View style={styles.editorRow}>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    {
                      backgroundColor:
                        editState?.part.type === 'token' ? colors.primary : colors.surfaceVariant,
                    },
                  ]}
                  onPress={() => updateEditPart({ type: 'token', value: 'time' })}
                >
                  <Text
                    style={[
                      styles.toggleText,
                      {
                        color:
                          editState?.part.type === 'token' ? colors.onPrimary : colors.text,
                      },
                    ]}
                  >
                    {t('Token')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    {
                      backgroundColor:
                        editState?.part.type === 'text' ? colors.primary : colors.surfaceVariant,
                    },
                  ]}
                  onPress={() => updateEditPart({ type: 'text', value: '' })}
                >
                  <Text
                    style={[
                      styles.toggleText,
                      {
                        color: editState?.part.type === 'text' ? colors.onPrimary : colors.text,
                      },
                    ]}
                  >
                    {t('Text')}
                  </Text>
                </TouchableOpacity>
              </View>

              {editState?.part.type === 'token' ? (
                <View style={styles.tokenList}>
                  {AVAILABLE_MESSAGE_FORMAT_TOKENS.map(token => (
                    <TouchableOpacity
                      key={token.value}
                      style={[
                        styles.tokenChip,
                        {
                          backgroundColor:
                            editState.part.value === token.value
                              ? colors.primary
                              : colors.surfaceVariant,
                        },
                      ]}
                      onPress={() => updateEditPart({ value: token.value })}
                    >
                      <Text
                        style={[
                          styles.tokenText,
                          {
                            color:
                              editState.part.value === token.value
                                ? colors.onPrimary
                                : colors.text,
                          },
                        ]}
                      >
                        {`{${tokenLabels[token.value as keyof typeof tokenLabels] || token.value}}`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <TextInput
                  style={[
                    styles.textInput,
                    { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface },
                  ]}
                  value={editState?.part.value || ''}
                  onChangeText={text => updateEditPart({ value: text })}
                  placeholder={t('Text')}
                  placeholderTextColor={colors.textSecondary}
                />
              )}

              <View style={styles.styleRow}>
                <TouchableOpacity
                  style={[
                    styles.styleButton,
                    { backgroundColor: currentStyle.bold ? colors.primary : colors.surfaceVariant },
                  ]}
                  onPress={() => updateEditStyle({ bold: !currentStyle.bold })}
                >
                  <Text
                    style={[
                      styles.styleButtonText,
                      { color: currentStyle.bold ? colors.onPrimary : colors.text },
                    ]}
                  >
                    B
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.styleButton,
                    { backgroundColor: currentStyle.italic ? colors.primary : colors.surfaceVariant },
                  ]}
                  onPress={() => updateEditStyle({ italic: !currentStyle.italic })}
                >
                  <Text
                    style={[
                      styles.styleButtonText,
                      { color: currentStyle.italic ? colors.onPrimary : colors.text },
                    ]}
                  >
                    I
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.styleButton,
                    {
                      backgroundColor: currentStyle.underline ? colors.primary : colors.surfaceVariant,
                    },
                  ]}
                  onPress={() => updateEditStyle({ underline: !currentStyle.underline })}
                >
                  <Text
                    style={[
                      styles.styleButtonText,
                      { color: currentStyle.underline ? colors.onPrimary : colors.text },
                    ]}
                  >
                    U
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.styleButton,
                    {
                      backgroundColor: currentStyle.strikethrough
                        ? colors.primary
                        : colors.surfaceVariant,
                    },
                  ]}
                  onPress={() => updateEditStyle({ strikethrough: !currentStyle.strikethrough })}
                >
                  <Text
                    style={[
                      styles.styleButtonText,
                      { color: currentStyle.strikethrough ? colors.onPrimary : colors.text },
                    ]}
                  >
                    S
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.styleButton,
                    { backgroundColor: currentStyle.reverse ? colors.primary : colors.surfaceVariant },
                  ]}
                  onPress={() => updateEditStyle({ reverse: !currentStyle.reverse })}
                >
                  <Text
                    style={[
                      styles.styleButtonText,
                      { color: currentStyle.reverse ? colors.onPrimary : colors.text },
                    ]}
                  >
                    R
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.editorRow}>
                <TouchableOpacity
                  style={[styles.colorButton, { backgroundColor: colors.surfaceVariant }]}
                  onPress={() => openColorPicker('color')}
                >
                  <View
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: currentStyle.color || 'transparent', borderColor: colors.border },
                    ]}
                  />
                  <Text style={[styles.colorButtonText, { color: colors.text }]}>
                    {t('Text color')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.colorButton, { backgroundColor: colors.surfaceVariant }]}
                  onPress={() => openColorPicker('backgroundColor')}
                >
                  <View
                    style={[
                      styles.colorSwatch,
                      {
                        backgroundColor: currentStyle.backgroundColor || 'transparent',
                        borderColor: colors.border,
                      },
                    ]}
                  />
                  <Text style={[styles.colorButtonText, { color: colors.text }]}>
                    {t('Background')}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.editorRow}>
                {editState?.mode === 'edit' && (
                  <TouchableOpacity
                    style={[styles.secondaryButton, { backgroundColor: colors.surfaceVariant }]}
                    onPress={deletePart}
                  >
                    <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
                      {t('Delete')}
                    </Text>
                  </TouchableOpacity>
                )}
                {editState?.mode === 'edit' && (
                  <TouchableOpacity
                    style={[styles.secondaryButton, { backgroundColor: colors.surfaceVariant }]}
                    onPress={() => movePart(-1)}
                  >
                    <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
                      {t('Move Left')}
                    </Text>
                  </TouchableOpacity>
                )}
                {editState?.mode === 'edit' && (
                  <TouchableOpacity
                    style={[styles.secondaryButton, { backgroundColor: colors.surfaceVariant }]}
                    onPress={() => movePart(1)}
                  >
                    <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
                      {t('Move Right')}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.editorRow}>
                <TouchableOpacity
                  style={[styles.secondaryButton, { backgroundColor: colors.surfaceVariant }]}
                  onPress={() => setEditState(null)}
                >
                  <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
                    {t('Cancel')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                  onPress={applyEdit}
                >
                  <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                    {t('Apply')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={showColorPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowColorPicker(false)}
        >
          <View style={styles.overlay}>
            <View style={[styles.colorPickerCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.editorTitle, { color: colors.text }]}>
                {t('Pick Color')}
              </Text>
              <View style={styles.editorRow}>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    {
                      backgroundColor: colorMode === 'standard' ? colors.primary : colors.surfaceVariant,
                    },
                  ]}
                  onPress={() => setColorMode('standard')}
                >
                  <Text
                    style={[
                      styles.toggleText,
                      { color: colorMode === 'standard' ? colors.onPrimary : colors.text },
                    ]}
                  >
                    {t('Standard')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    {
                      backgroundColor: colorMode === 'extended' ? colors.primary : colors.surfaceVariant,
                    },
                  ]}
                  onPress={() => setColorMode('extended')}
                >
                  <Text
                    style={[
                      styles.toggleText,
                      { color: colorMode === 'extended' ? colors.onPrimary : colors.text },
                    ]}
                  >
                    {t('Extended')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    {
                      backgroundColor: colorMode === 'custom' ? colors.primary : colors.surfaceVariant,
                    },
                  ]}
                  onPress={() => setColorMode('custom')}
                >
                  <Text
                    style={[
                      styles.toggleText,
                      { color: colorMode === 'custom' ? colors.onPrimary : colors.text },
                    ]}
                  >
                    {t('Custom')}
                  </Text>
                </TouchableOpacity>
              </View>

              {colorMode === 'custom' ? (
                <TextInput
                  style={[
                    styles.textInput,
                    { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface },
                  ]}
                  value={customColor}
                  onChangeText={setCustomColor}
                  placeholder={t('#RRGGBB')}
                  placeholderTextColor={colors.textSecondary}
                />
              ) : (
                <ScrollView contentContainerStyle={styles.paletteGrid}>
                  {Object.entries(colorMode === 'standard' ? IRC_STANDARD_COLOR_MAP : IRC_EXTENDED_COLOR_MAP).map(
                    ([key, value]) => (
                      <TouchableOpacity
                        key={`${colorMode}-${key}`}
                        style={[styles.paletteSwatch, { backgroundColor: value }]}
                        onPress={() => applyColor(value)}
                      />
                    ),
                  )}
                </ScrollView>
              )}

              <View style={styles.editorRow}>
                <TouchableOpacity
                  style={[styles.secondaryButton, { backgroundColor: colors.surfaceVariant }]}
                  onPress={clearColor}
                >
                  <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
                    {t('Clear')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    if (colorMode === 'custom') {
                      applyColor(customColor.trim());
                      return;
                    }
                    setShowColorPicker(false);
                  }}
                >
                  <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                    {t('Apply')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerText: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 32,
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  partsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  partChip: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  partText: {
    fontSize: 13,
  },
  addChip: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderStyle: 'dashed',
    marginRight: 8,
    marginBottom: 8,
  },
  addChipText: {
    fontSize: 16,
    fontWeight: '700',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  editorCard: {
    width: '100%',
    borderRadius: 12,
    padding: 16,
  },
  colorPickerCard: {
    width: '100%',
    borderRadius: 12,
    padding: 16,
    maxHeight: '80%',
  },
  editorTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  editorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  toggleButton: {
    flexGrow: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 8,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '600',
  },
  tokenList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  tokenChip: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  tokenText: {
    fontSize: 12,
    fontWeight: '600',
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    marginBottom: 12,
  },
  styleRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  styleButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  styleButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  colorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  colorSwatch: {
    width: 18,
    height: 18,
    borderWidth: 1,
    borderRadius: 4,
    marginRight: 8,
  },
  colorButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  secondaryButton: {
    flexGrow: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 8,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  primaryButton: {
    flexGrow: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 8,
  },
  primaryButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  paletteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingBottom: 12,
  },
  paletteSwatch: {
    width: 24,
    height: 24,
    borderRadius: 4,
    marginRight: 8,
    marginBottom: 8,
  },
  previewRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 8,
    minHeight: 32,
    alignItems: 'center',
    borderRadius: 4,
  },
});

/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import React, { useMemo } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { TouchableOpacity } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import type {
  AddonPanelNode,
  AddonTone,
} from '../services/scripting/AddonUISchema';

/**
 * Renders an addon's declarative panel using the app's own components.
 *
 * The addon supplies data and nothing else — no element, no style object, no
 * callback into React. That is what keeps theming, font scaling, rotation and
 * accessibility working on a panel whose author never considered any of them,
 * and it is why an addon cannot reach the React tree to begin with.
 */

interface Props {
  nodes: readonly AddonPanelNode[];
  /** Button presses are routed back to the addon by the caller, never here. */
  onButtonPress?: (buttonId: string) => void;
  testID?: string;
}

export const AddonPanelView: React.FC<Props> = ({
  nodes,
  onButtonPress,
  testID,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Tones are resolved here, against the active theme, rather than anywhere an
  // addon can see. An addon says "warning"; what a warning looks like is the
  // theme's business.
  const toneColor = (tone?: AddonTone): string => {
    switch (tone) {
      case 'muted':
        return colors.textSecondary;
      case 'info':
        return colors.info;
      case 'success':
        return colors.success;
      case 'warning':
        return colors.warning;
      case 'danger':
        return colors.error;
      default:
        return colors.text;
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      testID={testID}
    >
      {nodes.map((node, index) => (
        <View key={index} style={styles.node}>
          {renderNode(node)}
        </View>
      ))}
    </ScrollView>
  );

  function renderNode(node: AddonPanelNode): React.ReactNode {
    switch (node.kind) {
      case 'text':
        return (
          <Text style={[styles.text, { color: toneColor(node.tone) }]}>
            {node.text}
          </Text>
        );

      case 'list':
        return node.items.map((item, index) => (
          <View key={index} style={styles.row}>
            <Text style={[styles.text, { color: toneColor(item.tone) }]}>
              {item.label}
            </Text>
            {item.detail ? (
              <Text style={styles.detail}>{item.detail}</Text>
            ) : null}
          </View>
        ));

      case 'table':
        // Horizontally scrollable so a wide table stays usable on a phone
        // instead of squeezing every column into illegibility.
        return (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              <View style={[styles.tableRow, styles.tableHeader]}>
                {node.columns.map((column, index) => (
                  <Text key={index} style={[styles.cell, styles.headerCell]}>
                    {column}
                  </Text>
                ))}
              </View>
              {node.rows.map((row, rowIndex) => (
                <View key={rowIndex} style={styles.tableRow}>
                  {row.map((cell, cellIndex) => (
                    <Text key={cellIndex} style={styles.cell}>
                      {cell}
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
        );

      case 'keyValue':
        return node.pairs.map((pair, index) => (
          <View key={index} style={styles.pair}>
            <Text style={styles.pairKey}>{pair.key}</Text>
            <Text style={styles.pairValue}>{pair.value}</Text>
          </View>
        ));

      case 'buttons':
        return (
          <View style={styles.buttons}>
            {node.buttons.map(button => (
              <TouchableOpacity
                key={button.id}
                accessibilityRole="button"
                accessibilityLabel={button.label}
                accessibilityState={{ disabled: !!button.disabled }}
                disabled={!!button.disabled}
                style={[
                  styles.button,
                  button.disabled && styles.buttonDisabled,
                ]}
                onPress={() => onButtonPress?.(button.id)}
              >
                <Text style={styles.buttonText}>{button.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        );

      case 'progress':
        return (
          <View
            accessibilityRole="progressbar"
            accessibilityValue={{
              now: Math.round(node.value * 100),
              min: 0,
              max: 100,
            }}
          >
            {node.label ? <Text style={styles.text}>{node.label}</Text> : null}
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.round(node.value * 100)}%` },
                ]}
              />
            </View>
          </View>
        );

      case 'image':
        return (
          <Image
            source={{ uri: node.url }}
            style={styles.image}
            resizeMode="contain"
            accessible
            accessibilityLabel={node.alt}
          />
        );

      default:
        // Validation rejects unknown kinds long before here; this exists so a
        // future node type cannot crash a panel if one ever slips through.
        return null;
    }
  }
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 12, paddingBottom: 24 },
    node: { marginBottom: 12 },
    text: { color: colors.text, fontSize: 14, lineHeight: 20 },
    detail: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
    row: { paddingVertical: 4 },
    tableRow: { flexDirection: 'row' },
    tableHeader: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      marginBottom: 4,
    },
    cell: {
      color: colors.text,
      fontSize: 13,
      lineHeight: 20,
      minWidth: 80,
      paddingRight: 12,
      paddingVertical: 2,
    },
    headerCell: { color: colors.textSecondary, fontWeight: '600' },
    pair: { flexDirection: 'row', paddingVertical: 3 },
    pairKey: { color: colors.textSecondary, fontSize: 13, flex: 1 },
    pairValue: { color: colors.text, fontSize: 13, flex: 2 },
    buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    button: {
      backgroundColor: colors.primary,
      borderRadius: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    buttonDisabled: { opacity: 0.5 },
    buttonText: { color: colors.onPrimary, fontSize: 14, fontWeight: '600' },
    progressTrack: {
      backgroundColor: colors.surfaceVariant,
      borderRadius: 4,
      height: 8,
      marginTop: 6,
      overflow: 'hidden',
    },
    progressFill: { backgroundColor: colors.primary, height: 8 },
    image: { width: '100%', height: 160, borderRadius: 6 },
  });

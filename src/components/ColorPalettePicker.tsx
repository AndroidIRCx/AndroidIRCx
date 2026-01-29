/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useT } from '../i18n/transifex';
import { IRC_EXTENDED_COLOR_MAP, IRC_STANDARD_COLOR_MAP, IRC_FORMAT_CODES } from '../utils/IRCFormatter';

type ColorTarget = 'fg' | 'bg';
type PaletteMode = 'standard' | 'extended';

type OutputMode = 'mirc' | 'hex';
type TargetMode = 'fgbg' | 'single';

interface ColorPalettePickerProps {
  colors: {
    text: string;
    textSecondary: string;
    primary: string;
    surface: string;
    border: string;
    background: string;
  };
  onInsert: (code: string) => void;
  autoInsertOnBg?: boolean;
  outputMode?: OutputMode;
  targetMode?: TargetMode;
  insertLabel?: string;
  clearLabel?: string;
  onClear?: () => void;
}

const MIR_STANDARD_COLORS = Array.from({ length: 16 }, (_, index) => IRC_STANDARD_COLOR_MAP[index]);
const MIR_EXTENDED_COLORS = Array.from({ length: 99 }, (_, index) => {
  if (index < 16) return IRC_STANDARD_COLOR_MAP[index];
  return IRC_EXTENDED_COLOR_MAP[index];
});

const formatColorCode = (fg: number, bg?: number | null) => {
  const fgText = fg.toString().padStart(2, '0');
  const bgText = bg === null || bg === undefined ? '' : `,${bg.toString().padStart(2, '0')}`;
  return `${String.fromCharCode(IRC_FORMAT_CODES.COLOR)}${fgText}${bgText}`;
};

export const ColorPalettePicker: React.FC<ColorPalettePickerProps> = ({
  colors,
  onInsert,
  autoInsertOnBg = false,
  outputMode = 'mirc',
  targetMode = 'fgbg',
  insertLabel,
  clearLabel,
  onClear,
}) => {
  const t = useT();
  const [paletteMode, setPaletteMode] = useState<PaletteMode>('standard');
  const [colorTarget, setColorTarget] = useState<ColorTarget>('fg');
  const [selectedFg, setSelectedFg] = useState<number | null>(null);
  const [selectedBg, setSelectedBg] = useState<number | null>(null);

  const styles = useMemo(() => StyleSheet.create({
    tabs: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
      gap: 8,
    },
    tab: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tabActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    tabText: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '600',
    },
    tabTextActive: {
      color: '#fff',
    },
    spacer: {
      flex: 1,
    },
    gridScroll: {
      maxHeight: 320,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    swatch: {
      width: 30,
      height: 30,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    swatchCheck: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '700',
      textShadowColor: 'rgba(0,0,0,0.6)',
      textShadowRadius: 2,
    },
    actionRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 10,
      marginTop: 12,
    },
    actionButton: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 8,
      backgroundColor: colors.primary,
    },
    actionButtonSecondary: {
      backgroundColor: colors.border,
    },
    actionText: {
      color: '#fff',
      fontWeight: '600',
    },
    actionTextSecondary: {
      color: colors.text,
      fontWeight: '600',
    },
  }), [colors]);

  const palette = paletteMode === 'standard' ? MIR_STANDARD_COLORS : MIR_EXTENDED_COLORS;
  const isSingleTarget = targetMode === 'single';

  const formatOutput = (fgIndex: number, bgIndex?: number | null) => {
    if (outputMode === 'hex') {
      return palette[fgIndex];
    }
    return formatColorCode(fgIndex, bgIndex);
  };

  const handlePick = (index: number) => {
    if (isSingleTarget) {
      setSelectedFg(index);
      return;
    }
    if (colorTarget === 'bg') {
      setSelectedBg(index);
      if (autoInsertOnBg && selectedFg !== null && selectedFg !== undefined) {
        onInsert(formatOutput(selectedFg, index));
      }
      return;
    }
    setSelectedFg(index);
  };

  const handleInsert = () => {
    if (selectedFg === null || selectedFg === undefined) return;
    onInsert(formatOutput(selectedFg, selectedBg));
  };

  const handleClear = () => {
    setSelectedFg(null);
    setSelectedBg(null);
    if (onClear) {
      onClear();
    }
  };

  return (
    <View>
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, paletteMode === 'standard' && styles.tabActive]}
          onPress={() => setPaletteMode('standard')}
        >
          <Text style={[styles.tabText, paletteMode === 'standard' && styles.tabTextActive]}>
            {t('Standard')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, paletteMode === 'extended' && styles.tabActive]}
          onPress={() => setPaletteMode('extended')}
        >
          <Text style={[styles.tabText, paletteMode === 'extended' && styles.tabTextActive]}>
            {t('Extended')}
          </Text>
        </TouchableOpacity>
        {!isSingleTarget && (
          <>
            <View style={styles.spacer} />
            <TouchableOpacity
              style={[styles.tab, colorTarget === 'fg' && styles.tabActive]}
              onPress={() => setColorTarget('fg')}
            >
              <Text style={[styles.tabText, colorTarget === 'fg' && styles.tabTextActive]}>
                {t('FG')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, colorTarget === 'bg' && styles.tabActive]}
              onPress={() => setColorTarget('bg')}
            >
              <Text style={[styles.tabText, colorTarget === 'bg' && styles.tabTextActive]}>
                {t('BG')}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
      <ScrollView style={styles.gridScroll} contentContainerStyle={styles.grid}>
        {palette.map((hex, index) => (
          <TouchableOpacity
            key={`${paletteMode}-${index}`}
            style={[styles.swatch, { backgroundColor: hex }]}
            onPress={() => handlePick(index)}
          >
            {((isSingleTarget ? selectedFg : colorTarget === 'fg' ? selectedFg : selectedBg) === index) && (
              <Text style={styles.swatchCheck}>✓</Text>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View style={styles.actionRow}>
        <TouchableOpacity style={[styles.actionButton, styles.actionButtonSecondary]} onPress={handleClear}>
          <Text style={styles.actionTextSecondary}>{clearLabel || t('Clear')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={handleInsert}>
          <Text style={styles.actionText}>{insertLabel || t('Insert')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

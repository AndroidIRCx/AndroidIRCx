/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React, { useCallback, useState } from 'react';
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { useT } from '../i18n/localization';

interface PasswordInputProps extends Omit<TextInputProps, 'secureTextEntry'> {
  /** The colour to draw the eye in. Defaults to the placeholder colour. */
  iconColor?: string;
  /** Style for the wrapper, when the caller needs to place it. */
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * A password field you can look at.
 *
 * Typing a server password or a SASL secret on a phone keyboard, blind, is how
 * people end up unable to connect and unable to see why. The eye is inside the
 * field rather than being a separate "show password" row: several of these
 * forms already carry three or four password fields, and a checkbox each would
 * cost more room than the fields themselves.
 *
 * It always starts hidden, and nothing remembers that it was ever opened —
 * not the component after it unmounts, and nothing on disk. Revealing is a
 * glance, not a setting.
 */
export const PasswordInput: React.FC<PasswordInputProps> = ({
  iconColor,
  containerStyle,
  style,
  placeholderTextColor,
  ...textInputProps
}) => {
  const t = useT();
  const [revealed, setRevealed] = useState(false);

  const toggle = useCallback(() => setRevealed(current => !current), []);

  return (
    <View style={[styles.container, containerStyle]}>
      <TextInput
        {...textInputProps}
        style={[style as StyleProp<TextStyle>, styles.input]}
        placeholderTextColor={placeholderTextColor}
        secureTextEntry={!revealed}
        autoCapitalize={textInputProps.autoCapitalize ?? 'none'}
        autoCorrect={textInputProps.autoCorrect ?? false}
      />
      <TouchableOpacity
        onPress={toggle}
        disabled={textInputProps.editable === false}
        accessibilityRole="button"
        accessibilityLabel={revealed ? t('Hide password') : t('Show password')}
        style={styles.toggle}
        // The icon itself is small; this keeps the tap target at the size a
        // thumb actually needs.
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Icon
          name={revealed ? 'eye-slash' : 'eye'}
          size={16}
          color={iconColor ?? (placeholderTextColor as string) ?? '#888888'}
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    justifyContent: 'center',
  },
  input: {
    // Room for the eye, so a long password does not run underneath it.
    paddingEnd: 44,
  },
  toggle: {
    position: 'absolute',
    end: 12,
    // Centred without knowing the field's height, which every caller styles
    // differently.
    alignSelf: 'center',
    padding: 4,
  },
});

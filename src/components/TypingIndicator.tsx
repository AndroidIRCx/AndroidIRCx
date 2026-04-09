/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { useT } from '../i18n/transifex';

interface TypingIndicatorProps {
  typingUsers: Map<
    string,
    { status: 'active' | 'paused' | 'done'; timestamp: number }
  >;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({
  typingUsers,
}) => {
  const { colors } = useTheme();
  const t = useT();
  const [fadeAnim] = useState(new Animated.Value(0));

  // Get list of users who are actively typing
  const activeTypers = Array.from(typingUsers.entries())
    .filter(([_, data]) => data.status === 'active')
    .map(([nick]) => nick);

  useEffect(() => {
    const animation = Animated.timing(fadeAnim, {
      toValue: activeTypers.length > 0 ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    });

    animation.start();

    return () => {
      animation.stop();
    };
  }, [activeTypers.length, fadeAnim]);

  if (activeTypers.length === 0) {
    return null;
  }

  // Format the typing message
  let typingText = '';
  if (activeTypers.length === 1) {
    typingText = t('{user} is typing...', { user: activeTypers[0] });
  } else if (activeTypers.length === 2) {
    typingText = t('{userA} and {userB} are typing...', {
      userA: activeTypers[0],
      userB: activeTypers[1],
    });
  } else if (activeTypers.length === 3) {
    typingText = t('{userA}, {userB}, and {userC} are typing...', {
      userA: activeTypers[0],
      userB: activeTypers[1],
      userC: activeTypers[2],
    });
  } else {
    typingText = t('{userA}, {userB}, and {count} others are typing...', {
      userA: activeTypers[0],
      userB: activeTypers[1],
      count: activeTypers.length - 2,
    });
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          opacity: fadeAnim,
        },
      ]}
    >
      <View style={styles.dotsContainer}>
        <View style={[styles.dot, { backgroundColor: colors.primary }]} />
        <View style={[styles.dot, { backgroundColor: colors.primary }]} />
        <View style={[styles.dot, { backgroundColor: colors.primary }]} />
      </View>
      <Text style={[styles.text, { color: colors.textSecondary }]}>
        {typingText}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderTopWidth: 1,
  },
  dotsContainer: {
    flexDirection: 'row',
    marginRight: 8,
    gap: 3,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  text: {
    fontSize: 12,
    fontStyle: 'italic',
  },
});

/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import {
  SafeAreaProvider,
  SafeAreaView,
  type Edge,
} from 'react-native-safe-area-context';

const DEFAULT_EDGES: readonly Edge[] = ['top', 'left', 'right', 'bottom'];

interface ModalSafeAreaProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  edges?: readonly Edge[];
}

/**
 * Safe-area container for full-screen `<Modal>` page content.
 *
 * A React Native `<Modal>` renders in its OWN native window, so the root
 * `SafeAreaProvider` (in `App.tsx`) does not measure it — `useSafeAreaInsets()`
 * inside a modal returns 0. This wraps modal content in a modal-local
 * `SafeAreaProvider` + `SafeAreaView`, which measures the modal window's real
 * insets and pads every edge. It adapts to status bar, navigation bar, display
 * cutouts/notches, orientation (portrait/landscape) and tablets automatically.
 *
 * Use it as the direct child of a `<Modal statusBarTranslucent
 * navigationBarTranslucent>` in place of the old `<View style={styles.container}>`.
 */
export const ModalSafeArea: React.FC<ModalSafeAreaProps> = ({
  children,
  style,
  edges = DEFAULT_EDGES,
}) => (
  <SafeAreaProvider>
    <SafeAreaView edges={edges} style={style}>
      {children}
    </SafeAreaView>
  </SafeAreaProvider>
);

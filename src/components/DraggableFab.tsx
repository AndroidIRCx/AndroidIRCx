/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  GestureResponderEvent,
  I18nManager,
  LayoutChangeEvent,
  PanResponder,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { useT } from '../i18n/localization';
import { settingsService } from '../services/SettingsService';

/** Distance from the end edge and the bottom edge of the parent, in dp. */
export interface FabPosition {
  end: number;
  bottom: number;
}

interface Props {
  /** Names the stored position, so each button remembers its own spot. */
  id: string;
  defaultPosition: FabPosition;
  size?: number;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  children: React.ReactNode;
}

/** Hold this long before the button lifts and follows the finger. */
export const LIFT_DELAY_MS = 300;
/** Further than this before lifting, and it was a scroll, not a press. */
const TAP_SLOP = 10;
/** Kept this far from every edge. */
const EDGE = 8;

export const fabStorageKey = (id: string) => `floatingButton:${id}`;

/** Keep the button wholly inside the parent, whatever the stored spot was. */
export function clampPosition(
  position: FabPosition,
  bounds: { width: number; height: number },
  size: number,
): FabPosition {
  if (!bounds.width || !bounds.height) return position;
  const clamp = (value: number, max: number) =>
    Math.min(Math.max(value, EDGE), Math.max(EDGE, max - size - EDGE));
  return {
    end: clamp(position.end, bounds.width),
    bottom: clamp(position.bottom, bounds.height),
  };
}

/**
 * A floating button the user can move.
 *
 * A tap presses it. Holding it lifts it, and then it follows the finger until
 * released, where it stays — remembered, so it is still there next launch.
 * The hold is what keeps a drag from firing the button, and a plain swipe
 * across it from moving it by accident.
 *
 * Positioned from the end edge rather than the right, so a right-to-left
 * layout keeps it on its own side by default.
 */
export const DraggableFab: React.FC<Props> = ({
  id,
  defaultPosition,
  size = 56,
  onPress,
  style,
  accessibilityLabel,
  children,
}) => {
  const t = useT();
  const [position, setPosition] = useState<FabPosition>(defaultPosition);
  const [lifted, setLifted] = useState(false);
  const bounds = useRef({ width: 0, height: 0 });
  const start = useRef(defaultPosition);
  const current = useRef(defaultPosition);
  const liftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLifted = useRef(false);
  const moved = useRef(0);
  const pressRef = useRef(onPress);
  pressRef.current = onPress;

  current.current = position;

  useEffect(() => {
    let alive = true;
    settingsService
      .getSetting<FabPosition | null>(fabStorageKey(id), null)
      .then(saved => {
        if (
          alive &&
          saved &&
          typeof saved.end === 'number' &&
          typeof saved.bottom === 'number'
        ) {
          setPosition(clampPosition(saved, bounds.current, size));
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
      if (liftTimer.current) clearTimeout(liftTimer.current);
    };
  }, [id, size]);

  const responder = useMemo(() => {
    const cancelLift = () => {
      if (liftTimer.current) clearTimeout(liftTimer.current);
      liftTimer.current = null;
    };
    const drop = () => {
      cancelLift();
      isLifted.current = false;
      setLifted(false);
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        start.current = current.current;
        moved.current = 0;
        isLifted.current = false;
        cancelLift();
        liftTimer.current = setTimeout(() => {
          isLifted.current = true;
          setLifted(true);
        }, LIFT_DELAY_MS);
      },
      onPanResponderMove: (_event: GestureResponderEvent, gesture) => {
        moved.current = Math.max(
          moved.current,
          Math.abs(gesture.dx) + Math.abs(gesture.dy),
        );
        if (!isLifted.current) {
          if (moved.current > TAP_SLOP) cancelLift();
          return;
        }
        // "End" is the right edge left-to-right and the left edge in RTL, so
        // a move towards it shrinks the distance in one and grows it in the
        // other.
        const towardsEnd = I18nManager.isRTL ? -gesture.dx : gesture.dx;
        const next = clampPosition(
          {
            end: start.current.end - towardsEnd,
            bottom: start.current.bottom - gesture.dy,
          },
          bounds.current,
          size,
        );
        // Kept in the ref straight away, not on the next render: a release
        // can arrive before React has drawn the last move, and saving the
        // spot from one frame earlier would put the button back there.
        current.current = next;
        setPosition(next);
      },
      onPanResponderRelease: () => {
        const wasLifted = isLifted.current;
        drop();
        if (wasLifted) {
          settingsService
            .setSetting(fabStorageKey(id), current.current)
            .catch(() => undefined);
        } else if (moved.current <= TAP_SLOP) {
          pressRef.current();
        }
      },
      onPanResponderTerminate: drop,
    });
  }, [id, size]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    bounds.current = { width, height };
    setPosition(previous => clampPosition(previous, bounds.current, size));
  };

  return (
    // A layer the size of the parent, so the button knows how far it may go.
    // It lets every touch through except the ones on the button itself.
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
      onLayout={onLayout}
      testID={`fab-layer-${id}`}
    >
      <View
        {...responder.panHandlers}
        accessible
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={t('Hold and drag to move it')}
        onAccessibilityTap={onPress}
        style={[
          style,
          styles.placed,
          {
            end: position.end,
            bottom: position.bottom,
            width: size,
            height: size,
            borderRadius: size / 2,
          },
          lifted && styles.lifted,
        ]}
        testID={`fab-${id}`}
      >
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  placed: { position: 'absolute' },
  lifted: { opacity: 0.85, transform: [{ scale: 1.15 }] },
});

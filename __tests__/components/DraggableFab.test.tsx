/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { I18nManager, Text } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import {
  clampPosition,
  DraggableFab,
  fabStorageKey,
  LIFT_DELAY_MS,
} from '../../src/components/DraggableFab';

const mockGetSetting = jest.fn();
const mockSetSetting = jest.fn();
jest.mock('../../src/services/SettingsService', () => ({
  settingsService: {
    getSetting: (...args: unknown[]) => mockGetSetting(...args),
    setSetting: (...args: unknown[]) => mockSetSetting(...args),
  },
}));

jest.mock('../../src/i18n/localization', () => ({
  useT: () => (key: string) => key,
}));

/** The shape PanResponder reads: one finger, at (x, y), at time `ts`. */
const touch = (x: number, y: number, ts: number, px = 0, py = 0) => ({
  nativeEvent: { touches: [{}], changedTouches: [{}] },
  touchHistory: {
    numberActiveTouches: 1,
    indexOfSingleActiveTouch: 0,
    mostRecentTimeStamp: ts,
    touchBank: [
      {
        touchActive: true,
        startPageX: 0,
        startPageY: 0,
        startTimeStamp: 0,
        currentPageX: x,
        currentPageY: y,
        currentTimeStamp: ts,
        previousPageX: px,
        previousPageY: py,
        previousTimeStamp: ts - 1,
      },
    ],
  },
});

const DEFAULT = { end: 16, bottom: 80 };

async function setup(onPress = jest.fn()) {
  const utils = await render(
    <DraggableFab
      id="search"
      defaultPosition={DEFAULT}
      onPress={onPress}
      accessibilityLabel="Search"
    >
      <Text>S</Text>
    </DraggableFab>,
  );
  await act(async () => {
    fireEvent(utils.getByTestId('fab-layer-search'), 'layout', {
      nativeEvent: { layout: { width: 400, height: 800 } },
    });
  });
  return { ...utils, onPress, fab: () => utils.getByTestId('fab-search') };
}

const placed = (element: any) => {
  const style = [element.props.style].flat(Infinity).filter(Boolean);
  return Object.assign({}, ...style);
};

describe('clampPosition', () => {
  const bounds = { width: 400, height: 800 };

  it('keeps the button inside every edge', () => {
    expect(clampPosition({ end: -50, bottom: 5000 }, bounds, 56)).toEqual({
      end: 8,
      bottom: 800 - 56 - 8,
    });
    expect(clampPosition({ end: 9999, bottom: -1 }, bounds, 56)).toEqual({
      end: 400 - 56 - 8,
      bottom: 8,
    });
  });

  it('leaves a position alone until the bounds are known', () => {
    expect(
      clampPosition({ end: -50, bottom: 1 }, { width: 0, height: 0 }, 56),
    ).toEqual({ end: -50, bottom: 1 });
  });
});

describe('DraggableFab', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockGetSetting.mockReset().mockResolvedValue(null);
    mockSetSetting.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts where it was told to', async () => {
    const { fab } = await setup();
    expect(placed(fab())).toMatchObject(DEFAULT);
  });

  it('comes back where it was left', async () => {
    mockGetSetting.mockResolvedValue({ end: 120, bottom: 300 });
    const { fab } = await setup();

    expect(mockGetSetting).toHaveBeenCalledWith(fabStorageKey('search'), null);
    expect(placed(fab())).toMatchObject({ end: 120, bottom: 300 });
  });

  it('ignores a stored position that is not one', async () => {
    mockGetSetting.mockResolvedValue({ end: 'left' });
    const { fab } = await setup();
    expect(placed(fab())).toMatchObject(DEFAULT);
  });

  it('presses on a tap', async () => {
    const { fab, onPress } = await setup();

    await act(async () => {
      fireEvent(fab(), 'responderGrant', touch(0, 0, 1));
      fireEvent(fab(), 'responderRelease', touch(0, 0, 2));
    });

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(mockSetSetting).not.toHaveBeenCalled();
  });

  it('presses for accessibility services too', async () => {
    const { fab, onPress } = await setup();
    await act(async () => {
      fireEvent(fab(), 'accessibilityTap');
    });
    expect(onPress).toHaveBeenCalled();
  });

  it('treats a swipe across it as neither a press nor a move', async () => {
    const { fab, onPress } = await setup();

    await act(async () => {
      fireEvent(fab(), 'responderGrant', touch(0, 0, 1));
      fireEvent(fab(), 'responderMove', touch(-60, 0, 2));
      jest.advanceTimersByTime(LIFT_DELAY_MS + 50);
      fireEvent(fab(), 'responderRelease', touch(-60, 0, 3));
    });

    expect(onPress).not.toHaveBeenCalled();
    expect(mockSetSetting).not.toHaveBeenCalled();
    expect(placed(fab())).toMatchObject(DEFAULT);
  });

  it('follows the finger once held, and remembers where it was dropped', async () => {
    const { fab, onPress } = await setup();

    await act(async () => {
      fireEvent(fab(), 'responderGrant', touch(0, 0, 1));
      jest.advanceTimersByTime(LIFT_DELAY_MS + 10);
    });
    // Lifted: it grows a little so the user can tell.
    expect(placed(fab()).transform).toEqual([{ scale: 1.15 }]);

    await act(async () => {
      // Left and up, so further from the end edge and the bottom.
      fireEvent(fab(), 'responderMove', touch(-100, -200, 2));
      fireEvent(fab(), 'responderRelease', touch(-100, -200, 3));
    });

    const expected = I18nManager.isRTL
      ? { end: 8, bottom: 280 }
      : { end: 116, bottom: 280 };
    expect(placed(fab())).toMatchObject(expected);
    expect(onPress).not.toHaveBeenCalled();
    expect(mockSetSetting).toHaveBeenCalledWith(
      fabStorageKey('search'),
      expected,
    );
  });

  it('cannot be dragged off the screen', async () => {
    const { fab } = await setup();

    await act(async () => {
      fireEvent(fab(), 'responderGrant', touch(0, 0, 1));
      jest.advanceTimersByTime(LIFT_DELAY_MS + 10);
      fireEvent(fab(), 'responderMove', touch(5000, 5000, 2));
      fireEvent(fab(), 'responderRelease', touch(5000, 5000, 3));
    });

    const { end, bottom } = placed(fab());
    expect(end).toBeGreaterThanOrEqual(8);
    expect(bottom).toBe(8);
  });

  it('drops the button if the gesture is taken away', async () => {
    const { fab } = await setup();

    await act(async () => {
      fireEvent(fab(), 'responderGrant', touch(0, 0, 1));
      jest.advanceTimersByTime(LIFT_DELAY_MS + 10);
      fireEvent(fab(), 'responderTerminate', touch(0, 0, 2));
    });

    expect(placed(fab()).transform).toBeUndefined();
  });
});

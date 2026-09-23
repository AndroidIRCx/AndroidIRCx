/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { AIActivityStrip } from '../../src/components/AIActivityStrip';

jest.mock('../../src/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      surface: '#111',
      border: '#444',
      warning: '#FF9800',
      primary: '#4caf50',
      textSecondary: '#bbb',
    },
  }),
}));

jest.mock('../../src/i18n/localization', () => ({
  useT: () => (key: string) => key,
}));

const activity = (over: Record<string, unknown> = {}) =>
  ({
    state: 'working',
    text: 'translate the last message',
    at: Date.now(),
    ...over,
  }) as any;

describe('AIActivityStrip', () => {
  it('shows what it is working on, with no buttons', async () => {
    const { queryByText, getByText } = await render(
      <AIActivityStrip
        activity={activity()}
        onRetry={jest.fn()}
        onDismiss={jest.fn()}
      />,
    );

    expect(getByText('translate the last message')).toBeTruthy();
    // Nothing to retry or dismiss while it is still going.
    expect(queryByText('Retry')).toBeNull();
    expect(queryByText('Dismiss')).toBeNull();
  });

  it('names which layer a failure came from', async () => {
    const { getByText } = await render(
      <AIActivityStrip
        activity={activity({
          state: 'failed',
          text: 'Could not finish',
          kind: 'auth_failed',
        })}
        onRetry={jest.fn()}
        onDismiss={jest.fn()}
      />,
    );

    // "no network", "the provider refused" and "a limit here" used to arrive
    // as the same grey sentence, so nobody could tell whether to check their
    // signal, their key, or just wait.
    expect(getByText('The API key was rejected')).toBeTruthy();
  });

  it('offers retry only when there is something to retry', async () => {
    const onRetry = jest.fn();
    const { queryByText, rerender, getByText } = await render(
      <AIActivityStrip
        activity={activity({ state: 'failed', text: 'gone wrong' })}
        onRetry={onRetry}
        onDismiss={jest.fn()}
      />,
    );

    expect(queryByText('Retry')).toBeNull();

    await rerender(
      <AIActivityStrip
        activity={activity({
          state: 'failed',
          text: 'gone wrong',
          retry: '/ai retry',
        })}
        onRetry={onRetry}
        onDismiss={jest.fn()}
      />,
    );

    await fireEvent.press(getByText('Retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('can be dismissed', async () => {
    const onDismiss = jest.fn();
    const { getByText } = await render(
      <AIActivityStrip
        activity={activity({ state: 'failed', text: 'gone wrong' })}
        onRetry={jest.fn()}
        onDismiss={onDismiss}
      />,
    );

    await fireEvent.press(getByText('Dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

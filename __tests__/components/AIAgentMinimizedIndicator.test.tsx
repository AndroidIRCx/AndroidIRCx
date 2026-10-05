/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { AIAgentMinimizedIndicator } from '../../src/components/AIAgentMinimizedIndicator';
import { useUIStore } from '../../src/stores/uiStore';

jest.mock('../../src/hooks/useTheme', () => ({
  useTheme: () => ({ colors: { primary: '#4caf50', onPrimary: '#fff' } }),
}));

jest.mock('../../src/i18n/localization', () => ({
  useT:
    () =>
    (key: string, params: Record<string, string> = {}) =>
      key.replace(/\{(\w+)\}/g, (_, name) => params[name] ?? ''),
}));

let mockActivity: any = { kind: 'idle' };
let mockListener: ((activity: any) => void) | null = null;
jest.mock('../../src/services/ai/AgentService', () => ({
  agentService: {
    currentActivity: () => mockActivity,
    isBusy: () => mockActivity.kind !== 'idle',
    onActivity: (listener: (activity: any) => void) => {
      mockListener = listener;
      return () => {
        mockListener = null;
      };
    },
  },
}));

const emit = async (activity: any) => {
  mockActivity = activity;
  await act(async () => {
    mockListener?.(activity);
  });
};

describe('AIAgentMinimizedIndicator', () => {
  beforeEach(() => {
    mockActivity = { kind: 'idle' };
    mockListener = null;
    useUIStore.setState({ aiAgentMinimized: false, showAIAgent: false });
  });

  it('is not there unless the assistant was minimised', async () => {
    const { queryByText } = await render(<AIAgentMinimizedIndicator />);
    expect(queryByText('Assistant')).toBeNull();
  });

  it('is not there while the assistant is open', async () => {
    useUIStore.setState({ aiAgentMinimized: true, showAIAgent: true });
    const { queryByText } = await render(<AIAgentMinimizedIndicator />);
    expect(queryByText('Assistant')).toBeNull();
  });

  it('shows what the assistant is doing, as it happens', async () => {
    mockActivity = { kind: 'thinking' };
    useUIStore.setState({ aiAgentMinimized: true });
    const { getByText } = await render(<AIAgentMinimizedIndicator />);
    expect(getByText('Thinking…')).toBeTruthy();

    await emit({ kind: 'tool', name: 'x', label: 'MemPalace › search' });
    expect(getByText('Running MemPalace › search…')).toBeTruthy();

    await emit({ kind: 'compacting' });
    expect(getByText('Summarising earlier messages…')).toBeTruthy();
  });

  it('says an answer is waiting once the work finishes', async () => {
    mockActivity = { kind: 'thinking' };
    useUIStore.setState({ aiAgentMinimized: true });
    const { getByText } = await render(<AIAgentMinimizedIndicator />);

    await emit({ kind: 'idle' });

    expect(getByText('Answer ready — tap to read it')).toBeTruthy();
  });

  it('just offers the way back when nothing is running', async () => {
    useUIStore.setState({ aiAgentMinimized: true });
    const { getByText } = await render(<AIAgentMinimizedIndicator />);
    expect(getByText('Tap to return to the conversation')).toBeTruthy();
  });

  it('brings the conversation back on a tap', async () => {
    useUIStore.setState({ aiAgentMinimized: true });
    const { getByText } = await render(<AIAgentMinimizedIndicator />);

    await act(async () => {
      fireEvent.press(getByText('Assistant'));
    });

    expect(useUIStore.getState().showAIAgent).toBe(true);
    expect(useUIStore.getState().aiAgentMinimized).toBe(false);
  });

  it('can be put away without opening anything', async () => {
    useUIStore.setState({ aiAgentMinimized: true });
    const { getByLabelText, queryByText } = await render(
      <AIAgentMinimizedIndicator />,
    );

    await act(async () => {
      fireEvent.press(getByLabelText('Hide the assistant bubble'));
    });

    expect(useUIStore.getState().aiAgentMinimized).toBe(false);
    expect(useUIStore.getState().showAIAgent).toBe(false);
    expect(queryByText('Assistant')).toBeNull();
  });

  it('forgets the waiting answer once the conversation was opened', async () => {
    mockActivity = { kind: 'thinking' };
    useUIStore.setState({ aiAgentMinimized: true });
    const { getByText, queryByText } = await render(
      <AIAgentMinimizedIndicator />,
    );
    await emit({ kind: 'idle' });

    await act(async () => {
      useUIStore.setState({ showAIAgent: true });
    });
    await act(async () => {
      useUIStore.setState({ showAIAgent: false, aiAgentMinimized: true });
    });

    expect(queryByText('Answer ready — tap to read it')).toBeNull();
    expect(getByText('Tap to return to the conversation')).toBeTruthy();
  });
});

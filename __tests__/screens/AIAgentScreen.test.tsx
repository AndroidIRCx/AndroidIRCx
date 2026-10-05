/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { Alert, Platform, ToastAndroid } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

jest.mock('../../src/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#000',
      surface: '#111',
      surfaceVariant: '#222',
      text: '#fff',
      textSecondary: '#bbb',
      primary: '#4caf50',
      onPrimary: '#fff',
      border: '#444',
      error: '#f44336',
      warning: '#ff9800',
    },
  }),
}));

jest.mock('../../src/i18n/localization', () => ({
  useT: () => (key: string, params?: Record<string, unknown>) =>
    params
      ? Object.entries(params).reduce(
          (result, [name, value]) => result.replace(`{${name}}`, String(value)),
          key,
        )
      : key,
}));

// The shared setup mocks the rest of this module but not the view, and the
// screen wraps its content in it.
jest.mock('react-native-keyboard-controller', () => {
  const { View } = require('react-native');
  return {
    KeyboardAvoidingView: View,
    KeyboardProvider: ({ children }: { children: React.ReactNode }) => children,
  };
});

// AgentService drags the whole IRC stack in behind it; the screen only ever
// talks to this surface of it.
jest.mock('../../src/services/ai/AgentService', () => ({
  agentService: {
    history: jest.fn(() => []),
    listSessions: jest.fn(() => []),
    load: jest.fn(async () => undefined),
    connectMcp: jest.fn(async () => 0),
    send: jest.fn(),
    retry: jest.fn(),
    resolvePending: jest.fn(),
    newSession: jest.fn(async () => undefined),
    switchTo: jest.fn(async () => undefined),
    deleteSession: jest.fn(async () => undefined),
    clearAllSessions: jest.fn(async () => undefined),
    compactNow: jest.fn(async () => true),
    activeSessionId: jest.fn(() => 's1'),
    currentActivity: jest.fn(() => ({ kind: 'idle' })),
    isBusy: jest.fn(() => false),
    lastMemorySave: jest.fn(() => []),
    onActivity: jest.fn(() => () => undefined),
  },
}));

jest.mock('../../src/services/ai/AIService', () => ({
  aiService: {
    diagnose: jest.fn(async () => ({ ready: true, reason: '', where: '' })),
  },
}));

jest.mock('../../src/services/ai/WebAccessService', () => ({
  webAccessService: {
    hostOf: jest.fn((url: string) => {
      const match = /^https?:\/\/([^/]+)/.exec(url);
      return match ? match[1] : null;
    }),
    isAllowed: jest.fn(() => false),
  },
}));

import { AIAgentScreen } from '../../src/screens/AIAgentScreen';
import { agentService } from '../../src/services/ai/AgentService';
import { aiService } from '../../src/services/ai/AIService';
import { webAccessService } from '../../src/services/ai/WebAccessService';

const ok = (turn: Record<string, unknown> = {}) => ({
  status: 'ok',
  text: 'an answer',
  ...turn,
});

const renderScreen = async (onClose = jest.fn()) => {
  const utils = await render(<AIAgentScreen visible onClose={onClose} />);
  // The mount kicks off diagnose/connectMcp/load; let them settle so the
  // assertions are not racing the first render.
  await waitFor(() => expect(agentService.load).toHaveBeenCalled());
  return { ...utils, onClose };
};

beforeEach(() => {
  jest.clearAllMocks();
  (agentService.history as jest.Mock).mockReturnValue([]);
  (agentService.listSessions as jest.Mock).mockReturnValue([]);
  (agentService.load as jest.Mock).mockResolvedValue(undefined);
  (agentService.connectMcp as jest.Mock).mockResolvedValue(0);
  (agentService.send as jest.Mock).mockResolvedValue(ok());
  (agentService.retry as jest.Mock).mockResolvedValue(ok());
  (agentService.resolvePending as jest.Mock).mockResolvedValue(ok());
  (agentService.compactNow as jest.Mock).mockResolvedValue(true);
  (agentService.isBusy as jest.Mock).mockReturnValue(false);
  (agentService.lastMemorySave as jest.Mock).mockReturnValue([]);
  (agentService.activeSessionId as jest.Mock).mockReturnValue('s1');
  (agentService.currentActivity as jest.Mock).mockReturnValue({ kind: 'idle' });
  (agentService.onActivity as jest.Mock).mockImplementation(
    () => () => undefined,
  );
  (aiService.diagnose as jest.Mock).mockResolvedValue({
    ready: true,
    reason: '',
    where: '',
  });
  (webAccessService.isAllowed as jest.Mock).mockReturnValue(false);
});

describe('visibility', () => {
  it('renders nothing while hidden and does not wake the service', async () => {
    const { queryByText } = await render(
      <AIAgentScreen visible={false} onClose={jest.fn()} />,
    );
    expect(queryByText('Close')).toBeNull();
    expect(agentService.load).not.toHaveBeenCalled();
    expect(aiService.diagnose).not.toHaveBeenCalled();
  });

  it('closes through the header', async () => {
    const { getByText, onClose } = await renderScreen();
    await fireEvent.press(getByText('Close'));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('opening', () => {
  it('rebuilds the thread from the service and skips empty messages', async () => {
    (agentService.history as jest.Mock).mockReturnValue([
      { role: 'user', content: 'what did I miss?' },
      { role: 'assistant', content: 'not much' },
      { role: 'assistant', content: '   ' },
      { role: 'tool', content: '' },
    ]);
    const { findByText, queryByText } = await renderScreen();
    expect(await findByText('what did I miss?')).toBeTruthy();
    expect(await findByText('not much')).toBeTruthy();
    expect(queryByText('   ')).toBeNull();
  });

  it('shows the empty prompt when there is no thread', async () => {
    const { findByText } = await renderScreen();
    expect(await findByText(/Ask about your session/)).toBeTruthy();
  });

  it('reports why AI is not ready', async () => {
    (aiService.diagnose as jest.Mock).mockResolvedValue({
      ready: false,
      reason: 'No API key',
      where: 'Settings > AI',
    });
    const { findByText } = await renderScreen();
    expect(await findByText('No API key')).toBeTruthy();
    expect(await findByText('Settings > AI')).toBeTruthy();
  });

  it('mentions MCP tools only when some connected', async () => {
    const { queryByText } = await renderScreen();
    expect(queryByText('3 tools from MCP servers are available.')).toBeNull();
  });

  it('counts the MCP tools that connected', async () => {
    (agentService.connectMcp as jest.Mock).mockResolvedValue(3);
    const { findByText } = await renderScreen();
    expect(
      await findByText('3 tools from MCP servers are available.'),
    ).toBeTruthy();
  });
});

describe('sending', () => {
  it('sends the typed question and shows both sides', async () => {
    const { getByPlaceholderText, getByText, findByText } =
      await renderScreen();
    await fireEvent.changeText(getByPlaceholderText('Ask something…'), 'hello');
    await fireEvent.press(getByText('Send'));
    await waitFor(() =>
      expect(agentService.send).toHaveBeenCalledWith('hello'),
    );
    expect(await findByText('hello')).toBeTruthy();
    expect(await findByText('an answer')).toBeTruthy();
  });

  it('ignores an empty question', async () => {
    const { getByText, getByPlaceholderText } = await renderScreen();
    await fireEvent.changeText(getByPlaceholderText('Ask something…'), '   ');
    await fireEvent.press(getByText('Send'));
    expect(agentService.send).not.toHaveBeenCalled();
  });

  it('says when the older half was summarised away', async () => {
    (agentService.send as jest.Mock).mockResolvedValue(ok({ compacted: true }));
    const { getByPlaceholderText, getByText, findByText } =
      await renderScreen();
    await fireEvent.changeText(getByPlaceholderText('Ask something…'), 'hi');
    await fireEvent.press(getByText('Send'));
    expect(
      await findByText('Earlier messages were summarised to make room.'),
    ).toBeTruthy();
  });

  it('offers a retry after a failed turn, and takes it', async () => {
    (agentService.send as jest.Mock).mockResolvedValue({
      status: 'error',
      error: 'the provider refused',
    });
    const { getByPlaceholderText, getByText, findByText } =
      await renderScreen();
    await fireEvent.changeText(getByPlaceholderText('Ask something…'), 'hi');
    await fireEvent.press(getByText('Send'));
    expect(await findByText('the provider refused')).toBeTruthy();

    await fireEvent.press(await findByText('Try again'));
    await waitFor(() => expect(agentService.retry).toHaveBeenCalled());
    expect(await findByText('an answer')).toBeTruthy();
  });

  it('falls back to a generic message when the error has no text', async () => {
    (agentService.send as jest.Mock).mockResolvedValue({ status: 'error' });
    const { getByPlaceholderText, getByText, findByText } =
      await renderScreen();
    await fireEvent.changeText(getByPlaceholderText('Ask something…'), 'hi');
    await fireEvent.press(getByText('Send'));
    expect(await findByText('Something went wrong.')).toBeTruthy();
  });
});

describe('copying', () => {
  it('copies a bubble and shows a toast', async () => {
    (agentService.history as jest.Mock).mockReturnValue([
      { role: 'assistant', content: 'copy me' },
    ]);
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, 'OS', {
      value: 'android',
      configurable: true,
    });
    const toast = jest.spyOn(ToastAndroid, 'show').mockImplementation(() => {});
    try {
      const { findByText, getAllByText } = await renderScreen();
      await findByText('copy me');
      await fireEvent.press(getAllByText('Copy')[0]);
      expect(Clipboard.setString).toHaveBeenCalledWith('copy me');
      expect(toast).toHaveBeenCalledWith('Copied', ToastAndroid.SHORT);
    } finally {
      toast.mockRestore();
      Object.defineProperty(Platform, 'OS', {
        value: originalOS,
        configurable: true,
      });
    }
  });

  it('copies on a long press too', async () => {
    (agentService.history as jest.Mock).mockReturnValue([
      { role: 'user', content: 'long press me' },
    ]);
    const { findByText } = await renderScreen();
    fireEvent(await findByText('long press me'), 'longPress');
    expect(Clipboard.setString).toHaveBeenCalledWith('long press me');
  });
});

describe('confirmation', () => {
  const pendingTurn = (url?: string) => ({
    status: 'needs_confirmation',
    text: '',
    pending: [
      {
        call: {
          id: 'c1',
          name: url ? 'fetch_page' : 'send_message',
          input: url ? { url } : { target: '#chat', text: 'hi' },
        },
        summary: 'send_message #chat',
      },
    ],
  });

  const askFor = async (url?: string) => {
    (agentService.send as jest.Mock).mockResolvedValue(pendingTurn(url));
    const utils = await renderScreen();
    await fireEvent.changeText(
      utils.getByPlaceholderText('Ask something…'),
      'do it',
    );
    await fireEvent.press(utils.getByText('Send'));
    await utils.findByText('The assistant wants to do this:');
    return utils;
  };

  it('approves everything the agent asked for', async () => {
    const { getByText, findByText } = await askFor();
    await fireEvent.press(getByText('Do it'));
    await waitFor(() =>
      expect(agentService.resolvePending).toHaveBeenCalledWith(
        { c1: true },
        [],
      ),
    );
    expect(await findByText('You approved the action.')).toBeTruthy();
  });

  it('declines everything', async () => {
    const { getByText, findByText } = await askFor();
    await fireEvent.press(getByText('No'));
    await waitFor(() =>
      expect(agentService.resolvePending).toHaveBeenCalledWith(
        { c1: false },
        [],
      ),
    );
    expect(await findByText('You declined the action.')).toBeTruthy();
  });

  it('names a host that is not on the allowed list', async () => {
    const { findByText } = await askFor('https://example.com/page');
    expect(
      await findByText(
        'It wants to read example.com, which is not on your allowed list.',
      ),
    ).toBeTruthy();
    expect(await findByText('Allow once')).toBeTruthy();
  });

  it('remembers the host when asked to always allow it', async () => {
    const { getByText, findByText } = await askFor('https://example.com/page');
    await fireEvent.press(getByText('Always allow this site'));
    await waitFor(() =>
      expect(agentService.resolvePending).toHaveBeenCalledWith({ c1: true }, [
        'example.com',
      ]),
    );
    expect(
      await findByText('Allowed, and example.com is remembered.'),
    ).toBeTruthy();
  });

  it('does not offer to remember a host that is already allowed', async () => {
    (webAccessService.isAllowed as jest.Mock).mockReturnValue(true);
    const { queryByText, getByText } = await askFor('https://example.com/p');
    expect(queryByText('Always allow this site')).toBeNull();
    expect(getByText('Do it')).toBeTruthy();
  });
});

describe('conversations', () => {
  const sessions = [
    { id: 's1', title: 'Scripting', messageCount: 4, active: true },
    { id: 's2', title: 'Catch up', messageCount: 2, active: false },
  ];

  it('titles the header from the active session', async () => {
    (agentService.listSessions as jest.Mock).mockReturnValue(sessions);
    const { findByText } = await renderScreen();
    expect(await findByText('Scripting')).toBeTruthy();
    expect(await findByText('2 conversations')).toBeTruthy();
  });

  it('falls back to a generic title with no sessions', async () => {
    const { findByText } = await renderScreen();
    expect(await findByText('Assistant')).toBeTruthy();
  });

  it('starts a new conversation and clears the thread', async () => {
    (agentService.history as jest.Mock).mockReturnValue([
      { role: 'user', content: 'old thread' },
    ]);
    const { findByText, getAllByText, queryByText } = await renderScreen();
    await findByText('old thread');
    await fireEvent.press(getAllByText('New')[0]);
    await waitFor(() => expect(agentService.newSession).toHaveBeenCalled());
    await waitFor(() => expect(queryByText('old thread')).toBeNull());
  });

  it('switches to another conversation from the list', async () => {
    (agentService.listSessions as jest.Mock).mockReturnValue(sessions);
    const { findByText } = await renderScreen();
    await fireEvent.press(await findByText('Scripting'));
    await fireEvent.press(await findByText('Catch up'));
    await waitFor(() =>
      expect(agentService.switchTo).toHaveBeenCalledWith('s2'),
    );
  });

  it('deletes one conversation', async () => {
    (agentService.listSessions as jest.Mock).mockReturnValue(sessions);
    const { findByText, getAllByText } = await renderScreen();
    await fireEvent.press(await findByText('Scripting'));
    await fireEvent.press(getAllByText('Delete')[0]);
    await waitFor(() =>
      expect(agentService.deleteSession).toHaveBeenCalledWith('s1'),
    );
  });

  it('asks before deleting every conversation, and obeys the answer', async () => {
    (agentService.listSessions as jest.Mock).mockReturnValue(sessions);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { findByText } = await renderScreen();
    await fireEvent.press(await findByText('Scripting'));
    await fireEvent.press(await findByText('Delete all conversations'));
    expect(alert).toHaveBeenCalled();
    expect(agentService.clearAllSessions).not.toHaveBeenCalled();

    const buttons = alert.mock.calls[0][2] as any[];
    await buttons.find(button => button.style === 'destructive').onPress();
    expect(agentService.clearAllSessions).toHaveBeenCalled();
    alert.mockRestore();
  });

  it('does not offer to delete everything with only one conversation', async () => {
    (agentService.listSessions as jest.Mock).mockReturnValue([sessions[0]]);
    const { findByText, queryByText } = await renderScreen();
    await fireEvent.press(await findByText('Scripting'));
    expect(queryByText('Delete all conversations')).toBeNull();
  });

  it('says so when there are no conversations yet', async () => {
    const { findByText } = await renderScreen();
    await fireEvent.press(await findByText('Assistant'));
    expect(
      await findByText('Nothing yet. Ask something and it lands here.'),
    ).toBeTruthy();
  });

  it('closes the conversation list again', async () => {
    (agentService.listSessions as jest.Mock).mockReturnValue(sessions);
    const { findByText, queryByText } = await renderScreen();
    await fireEvent.press(await findByText('Scripting'));
    expect(await findByText('Conversations')).toBeTruthy();
    await fireEvent.press(await findByText('Back'));
    await waitFor(() => expect(queryByText('Conversations')).toBeNull());
  });
});

describe('minimising', () => {
  const renderMinimisable = async () => {
    const onClose = jest.fn();
    const onMinimize = jest.fn();
    const utils = await render(
      <AIAgentScreen visible onClose={onClose} onMinimize={onMinimize} />,
    );
    await waitFor(() => expect(agentService.load).toHaveBeenCalled());
    return { ...utils, onClose, onMinimize };
  };

  it('offers Minimize instead of Close, and says the work carries on', async () => {
    const original = Platform.OS;
    Platform.OS = 'android';
    const toast = jest.spyOn(ToastAndroid, 'show').mockImplementation(() => {});
    (agentService.isBusy as jest.Mock).mockReturnValue(true);
    try {
      const { getByText, queryByText, onMinimize, onClose } =
        await renderMinimisable();
      expect(queryByText('Close')).toBeNull();

      await fireEvent.press(getByText('Minimize'));

      expect(onMinimize).toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
      expect(toast).toHaveBeenCalledWith(
        'The assistant keeps working. Tap its bubble to come back.',
        ToastAndroid.SHORT,
      );
    } finally {
      Platform.OS = original;
      toast.mockRestore();
    }
  });

  it('says how to come back when nothing is running', async () => {
    const original = Platform.OS;
    Platform.OS = 'android';
    const toast = jest.spyOn(ToastAndroid, 'show').mockImplementation(() => {});
    try {
      const { getByText } = await renderMinimisable();
      await fireEvent.press(getByText('Minimize'));
      expect(toast).toHaveBeenCalledWith(
        'Minimised. Tap the assistant bubble to come back.',
        ToastAndroid.SHORT,
      );
    } finally {
      Platform.OS = original;
      toast.mockRestore();
    }
  });

  it('keeps the thread as it was when it comes back to the same conversation', async () => {
    (agentService.send as jest.Mock).mockResolvedValue(
      ok({ toolsUsed: ['list_channels'] }),
    );
    const onMinimize = jest.fn();
    const { getByPlaceholderText, getByText, findByText, rerender } =
      await render(
        <AIAgentScreen visible onClose={jest.fn()} onMinimize={onMinimize} />,
      );
    await fireEvent.changeText(getByPlaceholderText('Ask something…'), 'hi');
    await fireEvent.press(getByText('Send'));
    expect(await findByText('Used: list_channels')).toBeTruthy();

    await rerender(
      <AIAgentScreen
        visible={false}
        onClose={jest.fn()}
        onMinimize={onMinimize}
      />,
    );
    await rerender(
      <AIAgentScreen visible onClose={jest.fn()} onMinimize={onMinimize} />,
    );

    // A rebuild from history would have lost the note; it is still there.
    expect(await findByText('Used: list_channels')).toBeTruthy();
  });
});

describe('showing the work', () => {
  it('says which tool is running while it waits', async () => {
    let listener: ((activity: any) => void) | undefined;
    (agentService.onActivity as jest.Mock).mockImplementation(fn => {
      listener = fn;
      return () => undefined;
    });
    let finish: (turn: any) => void = () => undefined;
    (agentService.send as jest.Mock).mockReturnValue(
      new Promise(resolve => {
        finish = resolve;
      }),
    );
    const { getByPlaceholderText, getByText, findByText } =
      await renderScreen();
    await fireEvent.changeText(getByPlaceholderText('Ask something…'), 'hi');
    // Not awaited: the turn is still running, which is the point.
    fireEvent.press(getByText('Send'));

    expect(await findByText('Thinking\u2026')).toBeTruthy();
    expect(listener).toBeDefined();
    await act(async () => {
      listener!({ kind: 'tool', name: 'x', label: 'MemPalace \u203a search' });
    });
    expect(getByText('Running MemPalace \u203a search\u2026')).toBeTruthy();
    await act(async () => {
      listener!({ kind: 'compacting' });
    });
    expect(getByText('Summarising earlier messages\u2026')).toBeTruthy();

    await act(async () => {
      finish(ok());
    });
    expect(await findByText('an answer')).toBeTruthy();
  });

  it('lists the tools a turn used, once each with a count', async () => {
    (agentService.send as jest.Mock).mockResolvedValue(
      ok({ toolsUsed: ['a', 'b', 'a', 'a'] }),
    );
    const { getByPlaceholderText, getByText, findByText } =
      await renderScreen();
    await fireEvent.changeText(getByPlaceholderText('Ask something…'), 'hi');
    await fireEvent.press(getByText('Send'));
    expect(await findByText('Used: a ×3, b')).toBeTruthy();
  });

  it('says when it made room by summarising', async () => {
    (agentService.send as jest.Mock).mockResolvedValue(
      ok({ recovered: 'compact' }),
    );
    const { getByPlaceholderText, getByText, findByText } =
      await renderScreen();
    await fireEvent.changeText(getByPlaceholderText('Ask something…'), 'hi');
    await fireEvent.press(getByText('Send'));
    expect(
      await findByText(
        'That was too much for the model, so the conversation was summarised and sent again.',
      ),
    ).toBeTruthy();
  });

  it('says when it had to send the question alone', async () => {
    (agentService.send as jest.Mock).mockResolvedValue(
      ok({ recovered: 'question_only' }),
    );
    const { getByPlaceholderText, getByText, findByText } =
      await renderScreen();
    await fireEvent.changeText(getByPlaceholderText('Ask something…'), 'hi');
    await fireEvent.press(getByText('Send'));
    expect(
      await findByText(
        'That was too much for the model even summarised, so only your question was sent.',
      ),
    ).toBeTruthy();
  });
});

describe('when it is too long', () => {
  const failTooLong = async () => {
    (agentService.send as jest.Mock).mockResolvedValue({
      status: 'error',
      error: 'context window is full',
      tooLong: true,
    });
    const utils = await renderScreen();
    await fireEvent.changeText(
      utils.getByPlaceholderText('Ask something…'),
      'hi',
    );
    await fireEvent.press(utils.getByText('Send'));
    expect(await utils.findByText('context window is full')).toBeTruthy();
    return utils;
  };

  it('offers ways out instead of a plain retry', async () => {
    const { queryByText, findByText } = await failTooLong();
    expect(await findByText('Summarise and retry')).toBeTruthy();
    expect(await findByText('Ask just this question')).toBeTruthy();
    expect(queryByText('Try again')).toBeNull();
  });

  it('summarises and retries', async () => {
    const { findByText } = await failTooLong();
    await fireEvent.press(await findByText('Summarise and retry'));
    await waitFor(() =>
      expect(agentService.retry).toHaveBeenCalledWith('compact'),
    );
  });

  it('retries with the question alone', async () => {
    const { findByText } = await failTooLong();
    await fireEvent.press(await findByText('Ask just this question'));
    await waitFor(() =>
      expect(agentService.retry).toHaveBeenCalledWith('question_only'),
    );
  });
});

describe('compacting by hand', () => {
  const withThread = () =>
    (agentService.history as jest.Mock).mockReturnValue([
      { role: 'user', content: 'q' },
      { role: 'assistant', content: 'a' },
    ]);

  it('is offered once there is a conversation', async () => {
    const { queryByText } = await renderScreen();
    expect(queryByText('Compact')).toBeNull();
  });

  it('summarises the thread and says so', async () => {
    withThread();
    const { findByText } = await renderScreen();

    await fireEvent.press(await findByText('Compact'));

    await waitFor(() => expect(agentService.compactNow).toHaveBeenCalled());
    expect(
      await findByText(
        'The conversation was summarised. Ask the next question.',
      ),
    ).toBeTruthy();
  });

  it('says when there was nothing to summarise', async () => {
    withThread();
    (agentService.compactNow as jest.Mock).mockResolvedValue(false);
    const { findByText } = await renderScreen();

    await fireEvent.press(await findByText('Compact'));

    expect(await findByText('There is nothing to summarise yet.')).toBeTruthy();
  });
});

describe('saving summaries to memory', () => {
  const ask = async (turn: Record<string, unknown>) => {
    (agentService.send as jest.Mock).mockResolvedValue(ok(turn));
    const utils = await renderScreen();
    await fireEvent.changeText(
      utils.getByPlaceholderText('Ask something…'),
      'hi',
    );
    await fireEvent.press(utils.getByText('Send'));
    return utils;
  };

  it('says where the summary was saved', async () => {
    const { findByText } = await ask({
      compacted: true,
      memory: [
        { ok: true, server: 'Palace' },
        { ok: true, server: 'Notes' },
      ],
    });
    expect(
      await findByText('The summary was saved to Palace, Notes.'),
    ).toBeTruthy();
  });

  it('says why it could not be saved', async () => {
    const { findByText } = await ask({
      compacted: true,
      memory: [
        { ok: true, server: 'Notes' },
        { ok: false, server: 'Palace', error: 'no such wing' },
      ],
    });
    expect(await findByText('The summary was saved to Notes.')).toBeTruthy();
    expect(
      await findByText('Could not save the summary to Palace: no such wing'),
    ).toBeTruthy();
  });

  it('reports the save after a compaction by hand', async () => {
    (agentService.history as jest.Mock).mockReturnValue([
      { role: 'user', content: 'q' },
      { role: 'assistant', content: 'a' },
    ]);
    (agentService.lastMemorySave as jest.Mock).mockReturnValue([
      { ok: true, server: 'Palace' },
    ]);
    const { findByText } = await renderScreen();

    await fireEvent.press(await findByText('Compact'));

    expect(await findByText('The summary was saved to Palace.')).toBeTruthy();
  });
});

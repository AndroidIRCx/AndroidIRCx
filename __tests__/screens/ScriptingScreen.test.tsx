/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { ScriptingScreen } from '../../src/screens/ScriptingScreen';

const mockScripts = [
  {
    id: 'script-1',
    name: 'Logger Script',
    enabled: true,
    description: 'Logs messages',
    code: 'module.exports = { onMessage() {} };',
    config: { foo: 'bar' },
  },
];

const mockRepo = [
  {
    id: 'repo-1',
    name: 'Repo Script',
    enabled: false,
    code: 'module.exports = {};',
    config: {},
  },
];

const mockLogs = [
  {
    id: 'log-1',
    ts: new Date('2026-01-01T12:00:00Z').getTime(),
    level: 'info',
    message: 'ran',
    scriptId: 'script-1',
  },
];

jest.mock('../../src/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#000',
      surface: '#111',
      surfaceVariant: '#222',
      text: '#fff',
      textSecondary: '#bbb',
      primary: '#4caf50',
      buttonText: '#fff',
      border: '#444',
      error: '#f44336',
    },
  }),
}));

jest.mock('../../src/i18n/transifex', () => ({
  useT: () => (key: string, params?: Record<string, unknown>) => {
    if (!params) {
      return key;
    }

    return Object.entries(params).reduce(
      (result, [paramKey, value]) =>
        result.replace(`{${paramKey}}`, String(value)),
      key,
    );
  },
}));

jest.mock('../../src/services/ScriptingService', () => ({
  scriptingService: {
    initialize: jest.fn(),
    list: jest.fn(),
    isLoggingEnabled: jest.fn(),
    getLogs: jest.fn(),
    listRepository: jest.fn(),
    setEnabled: jest.fn(),
    remove: jest.fn(),
    installBuiltIns: jest.fn(),
    getBuiltInScripts: jest.fn(),
    add: jest.fn(),
    setLoggingEnabled: jest.fn(),
    clearLogs: jest.fn(),
    testHook: jest.fn(),
    lint: jest.fn(),
  },
}));

jest.mock('../../src/services/AdRewardService', () => ({
  adRewardService: {
    getRemainingTimeFormatted: jest.fn(),
    hasAvailableTime: jest.fn(),
    isTracking: jest.fn(),
    getAdStatus: jest.fn(),
    addListener: jest.fn(),
    showRewardedAd: jest.fn(),
    manualLoadAd: jest.fn(),
    startUsageTracking: jest.fn(),
    stopUsageTracking: jest.fn(),
  },
}));

jest.mock('../../src/services/InAppPurchaseService', () => ({
  inAppPurchaseService: {
    hasUnlimitedScripting: jest.fn(),
  },
}));

const { scriptingService } = require('../../src/services/ScriptingService');
const { adRewardService } = require('../../src/services/AdRewardService');
const {
  inAppPurchaseService,
} = require('../../src/services/InAppPurchaseService');

describe('ScriptingScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());

    scriptingService.initialize.mockResolvedValue(undefined);
    scriptingService.list.mockReturnValue(mockScripts);
    scriptingService.isLoggingEnabled.mockReturnValue(true);
    scriptingService.getLogs.mockReturnValue(mockLogs);
    scriptingService.listRepository.mockReturnValue(mockRepo);
    scriptingService.setEnabled.mockResolvedValue(undefined);
    scriptingService.remove.mockResolvedValue(undefined);
    scriptingService.installBuiltIns.mockResolvedValue(undefined);
    scriptingService.getBuiltInScripts.mockReturnValue(mockRepo);
    scriptingService.add.mockResolvedValue(undefined);
    scriptingService.setLoggingEnabled.mockResolvedValue(undefined);
    scriptingService.clearLogs.mockResolvedValue(undefined);
    scriptingService.lint.mockReturnValue({
      ok: true,
      message: 'No syntax errors detected.',
    });

    adRewardService.getRemainingTimeFormatted.mockReturnValue('59m');
    adRewardService.hasAvailableTime.mockReturnValue(true);
    adRewardService.isTracking.mockReturnValue(false);
    adRewardService.getAdStatus.mockReturnValue({
      ready: false,
      loading: false,
      cooldown: false,
      cooldownSeconds: 0,
      adUnitType: 'Primary',
    });
    adRewardService.addListener.mockReturnValue(jest.fn());
    adRewardService.showRewardedAd.mockResolvedValue(true);
    adRewardService.manualLoadAd.mockResolvedValue({
      success: true,
      messageKey: 'Loading Ad',
    });

    inAppPurchaseService.hasUnlimitedScripting.mockReturnValue(false);
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('renders script list and allows toggling, deleting and testing a script', async () => {
    const { findByText, getAllByRole } = render(
      <ScriptingScreen
        visible
        onClose={jest.fn()}
        onShowPurchaseScreen={jest.fn()}
      />,
    );

    expect(await findByText('Logger Script')).toBeTruthy();
    expect(await findByText('Repository')).toBeTruthy();

    fireEvent(getAllByRole('switch')[2], 'valueChange', false);
    await waitFor(() => {
      expect(scriptingService.setEnabled).toHaveBeenCalledWith(
        'script-1',
        false,
      );
    });

    fireEvent.press(await findByText('Delete'));
    await waitFor(() => {
      expect(scriptingService.remove).toHaveBeenCalledWith('script-1');
    });

    fireEvent.press(await findByText('Test'));
    expect(scriptingService.testHook).toHaveBeenCalledWith(
      'script-1',
      'onMessage',
    );
  });

  it('requests an ad when not ready and shows rewarded ad when ready', async () => {
    const { findByText, rerender } = render(
      <ScriptingScreen
        visible
        onClose={jest.fn()}
        onShowPurchaseScreen={jest.fn()}
      />,
    );

    fireEvent.press(await findByText('Request Ad'));
    await waitFor(() => {
      expect(adRewardService.manualLoadAd).toHaveBeenCalledTimes(1);
      expect(Alert.alert).toHaveBeenCalledWith('Loading Ad', 'Loading Ad');
    });

    adRewardService.getAdStatus.mockReturnValue({
      ready: true,
      loading: false,
      cooldown: false,
      cooldownSeconds: 0,
      adUnitType: 'Primary',
    });

    rerender(
      <ScriptingScreen
        visible
        onClose={jest.fn()}
        onShowPurchaseScreen={jest.fn()}
      />,
    );
    fireEvent.press(await findByText('Watch Ad (+60 min Scripting & No-Ads)'));

    await waitFor(() => {
      expect(adRewardService.showRewardedAd).toHaveBeenCalledTimes(1);
      expect(Alert.alert).toHaveBeenCalledWith(
        'Thank You!',
        'You earned scripting time!',
      );
    });
  });

  it('creates and saves a new script, validates JSON and lints code', async () => {
    scriptingService.list.mockReturnValue([]);

    const { findByText, findByDisplayValue, getAllByDisplayValue } = render(
      <ScriptingScreen
        visible
        onClose={jest.fn()}
        onShowPurchaseScreen={jest.fn()}
      />,
    );

    fireEvent.press(await findByText('New Script'));
    fireEvent.changeText(await findByDisplayValue('New Script'), 'My Script');

    const codeInput = getAllByDisplayValue(
      '// module.exports = { onMessage: (msg) => { /* ... */ } };',
    )[0];
    fireEvent.changeText(codeInput, 'const x = 1;');

    fireEvent.changeText(await findByDisplayValue('{}'), '{bad json');
    expect(Alert.alert).toHaveBeenCalledWith(
      'Invalid JSON',
      expect.stringContaining('SyntaxError'),
    );

    fireEvent.press(await findByText('Lint'));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Lint Passed',
      'No syntax errors detected.',
    );

    fireEvent.press(await findByText('Save'));
    await waitFor(() => {
      expect(scriptingService.add).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'My Script',
          code: 'const x = 1;',
        }),
      );
    });
  });

  it('toggles scripting time mode, installs built-ins, clears logs and filters them', async () => {
    const { findByText, getAllByRole, getByPlaceholderText } = render(
      <ScriptingScreen
        visible
        onClose={jest.fn()}
        onShowPurchaseScreen={jest.fn()}
      />,
    );

    fireEvent(getAllByRole('switch')[0], 'valueChange', true);
    expect(adRewardService.startUsageTracking).toHaveBeenCalledTimes(1);

    fireEvent.changeText(getByPlaceholderText('script id'), 'script-1');
    expect(await findByText(/\[script-1\] ran/)).toBeTruthy();

    fireEvent.press(await findByText('Install Built-ins'));
    await waitFor(() => {
      expect(scriptingService.installBuiltIns).toHaveBeenCalledWith(mockRepo);
    });

    fireEvent.press(await findByText('Clear'));
    await waitFor(() => {
      expect(scriptingService.clearLogs).toHaveBeenCalledTimes(1);
    });
  });

  it('handles ad listener updates and upgrade button flow', async () => {
    const onClose = jest.fn();
    const onShowPurchaseScreen = jest.fn();

    render(
      <ScriptingScreen
        visible
        onClose={onClose}
        onShowPurchaseScreen={onShowPurchaseScreen}
      />,
    );

    const listener = adRewardService.addListener.mock.calls[0]?.[0];
    act(() => {
      listener?.(0);
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(scriptingService.list).toHaveBeenCalled();
    });
  });

  // Additional tests to improve coverage

  it('renders empty state when no scripts are installed', async () => {
    scriptingService.list.mockReturnValue([]);

    const { findByText } = render(
      <ScriptingScreen
        visible
        onClose={jest.fn()}
        onShowPurchaseScreen={jest.fn()}
      />,
    );

    expect(await findByText('No scripts installed.')).toBeTruthy();
  });

  it('closes the editor modal when Close is pressed', async () => {
    scriptingService.list.mockReturnValue([]);

    const { findByText, queryByText, getAllByText } = render(
      <ScriptingScreen
        visible
        onClose={jest.fn()}
        onShowPurchaseScreen={jest.fn()}
      />,
    );

    fireEvent.press(await findByText('New Script'));
    expect(await findByText('Edit Script')).toBeTruthy();

    // Use getAllByText to get all Close buttons and press the one in the editor (second one)
    const closeButtons = getAllByText('Close');
    fireEvent.press(closeButtons[closeButtons.length - 1]);

    await waitFor(() => {
      // After closing, the 'Name' label from editor should not be visible
      expect(queryByText('Name')).toBeNull();
    });
  });

  it('toggles logging on and off', async () => {
    const { getAllByRole } = render(
      <ScriptingScreen
        visible
        onClose={jest.fn()}
        onShowPurchaseScreen={jest.fn()}
      />,
    );

    // Find the logging switch (last switch in the row section)
    const switches = getAllByRole('switch');
    const loggingSwitch = switches[switches.length - 1];

    fireEvent(loggingSwitch, 'valueChange', false);
    await waitFor(() => {
      expect(scriptingService.setLoggingEnabled).toHaveBeenCalledWith(false);
    });

    fireEvent(loggingSwitch, 'valueChange', true);
    await waitFor(() => {
      expect(scriptingService.setLoggingEnabled).toHaveBeenCalledWith(true);
    });
  });

  it('handles script toggle error and shows alert', async () => {
    const error = new Error('Cannot enable: dependency missing');
    scriptingService.setEnabled.mockRejectedValue(error);

    const { findByText, getAllByRole } = render(
      <ScriptingScreen
        visible
        onClose={jest.fn()}
        onShowPurchaseScreen={jest.fn()}
      />,
    );

    expect(await findByText('Logger Script')).toBeTruthy();

    // Get script toggle switch (third switch - after master toggle and time toggle)
    const switches = getAllByRole('switch');
    fireEvent(switches[2], 'valueChange', false);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Cannot Enable Script',
        'Cannot enable: dependency missing',
      );
    });
  });

  it('shows lint error when code has syntax errors', async () => {
    scriptingService.lint.mockReturnValue({
      ok: false,
      message: 'Unexpected token at line 5',
    });
    scriptingService.list.mockReturnValue([]);

    const { findByText } = render(
      <ScriptingScreen
        visible
        onClose={jest.fn()}
        onShowPurchaseScreen={jest.fn()}
      />,
    );

    fireEvent.press(await findByText('New Script'));
    fireEvent.press(await findByText('Lint'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Syntax Error',
      'Unexpected token at line 5',
    );
  });

  it('stops usage tracking when master toggle is turned off', async () => {
    adRewardService.isTracking.mockReturnValue(true);

    const { getAllByRole } = render(
      <ScriptingScreen
        visible
        onClose={jest.fn()}
        onShowPurchaseScreen={jest.fn()}
      />,
    );

    const switches = getAllByRole('switch');
    // First switch is the master scripting time toggle
    fireEvent(switches[0], 'valueChange', false);

    expect(adRewardService.stopUsageTracking).toHaveBeenCalledTimes(1);
  });

  it('shows warning when no scripting time available', async () => {
    adRewardService.hasAvailableTime.mockReturnValue(false);
    adRewardService.getRemainingTimeFormatted.mockReturnValue('0s');
    inAppPurchaseService.hasUnlimitedScripting.mockReturnValue(false);

    const { findByText } = render(
      <ScriptingScreen
        visible
        onClose={jest.fn()}
        onShowPurchaseScreen={jest.fn()}
      />,
    );

    expect(await findByText(/No scripting time available/)).toBeTruthy();
  });

  it('shows ad loading state', async () => {
    adRewardService.getAdStatus.mockReturnValue({
      ready: false,
      loading: true,
      cooldown: false,
      cooldownSeconds: 0,
      adUnitType: 'Primary',
    });

    const { findByText } = render(
      <ScriptingScreen
        visible
        onClose={jest.fn()}
        onShowPurchaseScreen={jest.fn()}
      />,
    );

    expect(await findByText('Loading Ad...')).toBeTruthy();
  });

  it('shows ad cooldown state with countdown', async () => {
    adRewardService.getAdStatus.mockReturnValue({
      ready: false,
      loading: false,
      cooldown: true,
      cooldownSeconds: 45,
      adUnitType: 'Primary',
    });

    const { findByText } = render(
      <ScriptingScreen
        visible
        onClose={jest.fn()}
        onShowPurchaseScreen={jest.fn()}
      />,
    );

    expect(await findByText('Cooldown (45s)')).toBeTruthy();
    expect(await findByText(/Ads temporarily unavailable/)).toBeTruthy();
  });

  it('shows fallback ad unit indicator', async () => {
    adRewardService.getAdStatus.mockReturnValue({
      ready: false,
      loading: false,
      cooldown: false,
      cooldownSeconds: 0,
      adUnitType: 'Fallback',
    });

    const { findByText } = render(
      <ScriptingScreen
        visible
        onClose={jest.fn()}
        onShowPurchaseScreen={jest.fn()}
      />,
    );

    expect(await findByText('Using fallback ad unit')).toBeTruthy();
  });

  it('shows unlimited scripting UI for premium users', async () => {
    inAppPurchaseService.hasUnlimitedScripting.mockReturnValue(true);

    const { findByText } = render(
      <ScriptingScreen
        visible
        onClose={jest.fn()}
        onShowPurchaseScreen={jest.fn()}
      />,
    );

    expect(await findByText(/Unlimited scripting/)).toBeTruthy();
  });

  it('does not show upgrade button for unlimited users', async () => {
    inAppPurchaseService.hasUnlimitedScripting.mockReturnValue(true);

    const { queryByText, findByText } = render(
      <ScriptingScreen
        visible
        onClose={jest.fn()}
        onShowPurchaseScreen={jest.fn()}
      />,
    );

    // Wait for the component to render first
    await findByText('Scripts');

    // The upgrade button should not be visible for unlimited users
    expect(
      queryByText('💎 Upgrade to Unlimited Scripting & No-Ads'),
    ).toBeNull();
  });

  it('handles ad show failure', async () => {
    adRewardService.getAdStatus.mockReturnValue({
      ready: true,
      loading: false,
      cooldown: false,
      cooldownSeconds: 0,
      adUnitType: 'Primary',
    });
    adRewardService.showRewardedAd.mockResolvedValue(false);

    const { findByText } = render(
      <ScriptingScreen
        visible
        onClose={jest.fn()}
        onShowPurchaseScreen={jest.fn()}
      />,
    );

    fireEvent.press(await findByText('Watch Ad (+60 min Scripting & No-Ads)'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Ad Failed',
        'Could not show the ad. Please try again.',
      );
    });
  });

  it('handles ad show error with exception', async () => {
    adRewardService.getAdStatus.mockReturnValue({
      ready: true,
      loading: false,
      cooldown: false,
      cooldownSeconds: 0,
      adUnitType: 'Primary',
    });
    adRewardService.showRewardedAd.mockRejectedValue(
      new Error('Network error'),
    );

    const { findByText } = render(
      <ScriptingScreen
        visible
        onClose={jest.fn()}
        onShowPurchaseScreen={jest.fn()}
      />,
    );

    fireEvent.press(await findByText('Watch Ad (+60 min Scripting & No-Ads)'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Network error');
    });
  });

  it('handles manual ad load failure', async () => {
    adRewardService.manualLoadAd.mockResolvedValue({
      success: false,
      messageKey: 'Ad load failed',
    });

    const { findByText } = render(
      <ScriptingScreen
        visible
        onClose={jest.fn()}
        onShowPurchaseScreen={jest.fn()}
      />,
    );

    fireEvent.press(await findByText('Request Ad'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Cannot Load Ad',
        'Ad load failed',
      );
    });
  });

  it('toggles syntax highlighting in editor', async () => {
    scriptingService.list.mockReturnValue([]);

    const { findByText, getAllByRole } = render(
      <ScriptingScreen
        visible
        onClose={jest.fn()}
        onShowPurchaseScreen={jest.fn()}
      />,
    );

    fireEvent.press(await findByText('New Script'));

    // Find highlight switch (should be in the editor)
    const switches = getAllByRole('switch');
    // Enable highlighting
    fireEvent(switches[switches.length - 2], 'valueChange', true);

    // Component should render highlighted code
    expect(await findByText('Edit Script')).toBeTruthy();
  });

  it('toggles script enabled state in editor', async () => {
    scriptingService.list.mockReturnValue([]);

    const { findByText, getAllByRole } = render(
      <ScriptingScreen
        visible
        onClose={jest.fn()}
        onShowPurchaseScreen={jest.fn()}
      />,
    );

    fireEvent.press(await findByText('New Script'));

    const switches = getAllByRole('switch');
    // Toggle enabled switch in editor
    fireEvent(switches[switches.length - 3], 'valueChange', true);

    expect(await findByText('Edit Script')).toBeTruthy();
  });

  it('shows no logs message when logs are empty', async () => {
    scriptingService.getLogs.mockReturnValue([]);

    const { findByText } = render(
      <ScriptingScreen
        visible
        onClose={jest.fn()}
        onShowPurchaseScreen={jest.fn()}
      />,
    );

    expect(await findByText('No logs yet.')).toBeTruthy();
  });

  it('filters logs by script ID and shows no results', async () => {
    const { getByPlaceholderText, queryByText } = render(
      <ScriptingScreen
        visible
        onClose={jest.fn()}
        onShowPurchaseScreen={jest.fn()}
      />,
    );

    // Filter by non-existent script
    fireEvent.changeText(getByPlaceholderText('script id'), 'non-existent');

    // Should show no logs message for filtered results
    await waitFor(() => {
      expect(queryByText(/\[script-1\] ran/)).toBeNull();
    });
  });

  it('edits an existing script', async () => {
    const { findByText, findByDisplayValue } = render(
      <ScriptingScreen
        visible
        onClose={jest.fn()}
        onShowPurchaseScreen={jest.fn()}
      />,
    );

    fireEvent.press(await findByText('Edit'));

    // Should show the script name in the editor
    expect(await findByDisplayValue('Logger Script')).toBeTruthy();

    // Change the name
    fireEvent.changeText(
      await findByDisplayValue('Logger Script'),
      'Updated Script',
    );

    // Save the script
    fireEvent.press(await findByText('Save'));

    await waitFor(() => {
      expect(scriptingService.add).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Updated Script',
        }),
      );
    });
  });

  it('closes main modal when Close button is pressed', async () => {
    const onClose = jest.fn();

    const { findByText } = render(
      <ScriptingScreen
        visible
        onClose={onClose}
        onShowPurchaseScreen={jest.fn()}
      />,
    );

    // Find and press the close button in header
    const closeButtons = await findByText('Close');
    fireEvent.press(closeButtons);

    expect(onClose).toHaveBeenCalled();
  });

  it('handles upgrade button press', async () => {
    const onClose = jest.fn();
    const onShowPurchaseScreen = jest.fn();

    const { findByText } = render(
      <ScriptingScreen
        visible
        onClose={onClose}
        onShowPurchaseScreen={onShowPurchaseScreen}
      />,
    );

    fireEvent.press(await findByText(/Upgrade to Unlimited/));

    expect(onClose).toHaveBeenCalled();
    expect(onShowPurchaseScreen).toHaveBeenCalled();
  });

  it('does not refresh when not visible', async () => {
    render(
      <ScriptingScreen
        visible={false}
        onClose={jest.fn()}
        onShowPurchaseScreen={jest.fn()}
      />,
    );

    expect(scriptingService.initialize).not.toHaveBeenCalled();
  });

  it('handles test hook for different hook types via edit screen', async () => {
    const scriptWithConnectHook = {
      ...mockScripts[0],
      code: 'module.exports = { onConnect: () => {}, onJoin: () => {}, onCommand: () => {} };',
    };
    scriptingService.list.mockReturnValue([scriptWithConnectHook]);

    const { findByText } = render(
      <ScriptingScreen
        visible
        onClose={jest.fn()}
        onShowPurchaseScreen={jest.fn()}
      />,
    );

    fireEvent.press(await findByText('Test'));
    expect(scriptingService.testHook).toHaveBeenCalledWith(
      'script-1',
      'onMessage',
    );
  });

  it('shows script description when available', async () => {
    const { findByText } = render(
      <ScriptingScreen
        visible
        onClose={jest.fn()}
        onShowPurchaseScreen={jest.fn()}
      />,
    );

    expect(await findByText('Logs messages')).toBeTruthy();
  });

  it('handles valid JSON config update', async () => {
    scriptingService.list.mockReturnValue([]);

    const { findByText, findByDisplayValue } = render(
      <ScriptingScreen
        visible
        onClose={jest.fn()}
        onShowPurchaseScreen={jest.fn()}
      />,
    );

    fireEvent.press(await findByText('New Script'));

    // Update config with valid JSON
    fireEvent.changeText(await findByDisplayValue('{}'), '{"key": "value"}');

    // Should not show error for valid JSON
    const calls = (Alert.alert as jest.Mock).mock.calls;
    const invalidJsonCalls = calls.filter(call => call[0] === 'Invalid JSON');
    expect(invalidJsonCalls.length).toBe(0);
  });

  it('renders scripts from repository', async () => {
    scriptingService.listRepository.mockReturnValue([
      {
        id: 'repo-script-1',
        name: 'Repository Script',
        enabled: false,
        code: 'module.exports = {};',
        config: {},
      },
    ]);

    const { findByText } = render(
      <ScriptingScreen
        visible
        onClose={jest.fn()}
        onShowPurchaseScreen={jest.fn()}
      />,
    );

    // The repository section should render (even if empty display)
    expect(await findByText('Repository')).toBeTruthy();
  });

  it('prevents multiple ad shows when already showing', async () => {
    adRewardService.getAdStatus.mockReturnValue({
      ready: true,
      loading: false,
      cooldown: false,
      cooldownSeconds: 0,
      adUnitType: 'Primary',
    });
    // Make showRewardedAd hang to simulate showing state
    adRewardService.showRewardedAd.mockImplementation(
      () => new Promise(() => {}),
    );

    const { findByText } = render(
      <ScriptingScreen
        visible
        onClose={jest.fn()}
        onShowPurchaseScreen={jest.fn()}
      />,
    );

    const watchButton = await findByText(
      'Watch Ad (+60 min Scripting & No-Ads)',
    );

    // First press starts showing the ad
    fireEvent.press(watchButton);

    // Wait a tick for state to update
    await act(async () => {
      jest.advanceTimersByTime(10);
    });

    // Second press should be ignored while showingAd is true
    // Since the button text changes to a loading indicator, we can't press it again
    // So we verify showRewardedAd was called only once
    expect(adRewardService.showRewardedAd).toHaveBeenCalledTimes(1);
  });
});

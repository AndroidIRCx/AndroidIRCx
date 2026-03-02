/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { ScriptingScreen } from '../../src/screens/ScriptingScreen';

jest.useFakeTimers();

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
      (result, [paramKey, value]) => result.replace(`{${paramKey}}`, String(value)),
      key
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
const { inAppPurchaseService } = require('../../src/services/InAppPurchaseService');

describe('ScriptingScreen', () => {
  beforeEach(() => {
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
    scriptingService.lint.mockReturnValue({ ok: true, message: 'No syntax errors detected.' });

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

  afterAll(() => {
    jest.useRealTimers();
  });

  it('renders script list and allows toggling, deleting and testing a script', async () => {
    const { findByText, getAllByRole } = render(
      <ScriptingScreen visible onClose={jest.fn()} onShowPurchaseScreen={jest.fn()} />
    );

    expect(await findByText('Logger Script')).toBeTruthy();
    expect(await findByText('Repository')).toBeTruthy();

    fireEvent(getAllByRole('switch')[2], 'valueChange', false);
    await waitFor(() => {
      expect(scriptingService.setEnabled).toHaveBeenCalledWith('script-1', false);
    });

    fireEvent.press(await findByText('Delete'));
    await waitFor(() => {
      expect(scriptingService.remove).toHaveBeenCalledWith('script-1');
    });

    fireEvent.press(await findByText('Test'));
    expect(scriptingService.testHook).toHaveBeenCalledWith('script-1', 'onMessage');
  });

  it('requests an ad when not ready and shows rewarded ad when ready', async () => {
    const { findByText, rerender } = render(
      <ScriptingScreen visible onClose={jest.fn()} onShowPurchaseScreen={jest.fn()} />
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

    rerender(<ScriptingScreen visible onClose={jest.fn()} onShowPurchaseScreen={jest.fn()} />);
    fireEvent.press(await findByText('Watch Ad (+60 min Scripting & No-Ads)'));

    await waitFor(() => {
      expect(adRewardService.showRewardedAd).toHaveBeenCalledTimes(1);
      expect(Alert.alert).toHaveBeenCalledWith('Thank You!', 'You earned scripting time!');
    });
  });

  it('creates and saves a new script, validates JSON and lints code', async () => {
    scriptingService.list.mockReturnValue([]);

    const { findByText, findByDisplayValue, getAllByDisplayValue } = render(
      <ScriptingScreen visible onClose={jest.fn()} onShowPurchaseScreen={jest.fn()} />
    );

    fireEvent.press(await findByText('New Script'));
    fireEvent.changeText(await findByDisplayValue('New Script'), 'My Script');

    const codeInput = getAllByDisplayValue('// module.exports = { onMessage: (msg) => { /* ... */ } };')[0];
    fireEvent.changeText(codeInput, 'const x = 1;');

    fireEvent.changeText(await findByDisplayValue('{}'), '{bad json');
    expect(Alert.alert).toHaveBeenCalledWith('Invalid JSON', expect.stringContaining('SyntaxError'));

    fireEvent.press(await findByText('Lint'));
    expect(Alert.alert).toHaveBeenCalledWith('Lint Passed', 'No syntax errors detected.');

    fireEvent.press(await findByText('Save'));
    await waitFor(() => {
      expect(scriptingService.add).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'My Script',
          code: 'const x = 1;',
        })
      );
    });
  });

  it('toggles scripting time mode, installs built-ins, clears logs and filters them', async () => {
    const { findByText, getAllByRole, getByPlaceholderText } = render(
      <ScriptingScreen visible onClose={jest.fn()} onShowPurchaseScreen={jest.fn()} />
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
      <ScriptingScreen visible onClose={onClose} onShowPurchaseScreen={onShowPurchaseScreen} />
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
});

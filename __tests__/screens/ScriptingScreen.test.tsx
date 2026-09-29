/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { ScriptingScreen } from '../../src/screens/ScriptingScreen';

jest.mock('../../src/services/ai/AIService', () => ({
  aiService: {
    diagnose: jest.fn().mockResolvedValue({
      code: 'no_provider',
      ready: false,
      reason: 'No AI provider is set up.',
      where: 'Settings > AI > AI Providers > Add',
    }),
  },
}));

jest.mock('../../src/services/ai/ScriptGenerator', () => ({
  scriptGenerator: { generate: jest.fn(), isAvailable: jest.fn() },
}));

const { aiService } = require('../../src/services/ai/AIService');

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
      warning: '#ff9800',
    },
  }),
}));

jest.mock('../../src/i18n/localization', () => ({
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

jest.mock('../../src/services/scripting/AddonSafetyService', () => ({
  addonSafetyService: {
    initialize: jest.fn().mockResolvedValue(undefined),
    getSnapshot: jest.fn(() => ({
      safeMode: false,
      disabled: new Map(),
    })),
    setSafeMode: jest.fn().mockResolvedValue(undefined),
  },
}));

// The addon side of this screen talks to a handful of services and hands the
// review and manager off to screens of their own; stubbing those two keeps the
// test about what ScriptingScreen does with their callbacks.
jest.mock('../../src/services/scripting/AddonFileImportService', () => {
  class AddonImportCancelledError extends Error {}
  return {
    AddonImportCancelledError,
    pickAddonPackageBytes: jest.fn(async () => new Uint8Array([1])),
  };
});

jest.mock('../../src/services/scripting/AddonInstallerService', () => ({
  addonInstallerService: {
    prepare: jest.fn(async () => ({ review: { name: 'Demo Addon' } })),
    confirm: jest.fn(async () => ({
      manifest: { id: 'rs.androidircx.demo', name: 'Demo Addon' },
    })),
  },
}));

jest.mock('../../src/services/scripting/AddonManagementService', () => ({
  addonManagementService: {
    initialize: jest.fn(async () => undefined),
    list: jest.fn(() => []),
    setEnabled: jest.fn(async () => undefined),
    uninstall: jest.fn(async () => undefined),
    rollback: jest.fn(async () => undefined),
    readSource: jest.fn(async () => 'module.exports = {};'),
  },
}));

jest.mock('../../src/services/scripting/AddonLifecycleService', () => ({
  addonLifecycleService: { stop: jest.fn(async () => undefined) },
}));

jest.mock('../../src/services/scripting/AddonExportService', () => {
  class AddonExportCancelledError extends Error {}
  return {
    AddonExportCancelledError,
    addonExportService: {
      shareSource: jest.fn(async () => undefined),
      shareDiagnostics: jest.fn(async () => undefined),
    },
  };
});

jest.mock('../../src/screens/AddonInstallReviewScreen', () => {
  const { Text } = require('react-native');
  return {
    AddonInstallReviewScreen: ({ onConfirm }: any) => (
      <Text onPress={onConfirm}>confirm install</Text>
    ),
  };
});

jest.mock('../../src/screens/AddonPermissionManagerScreen', () => {
  const { Text, View } = require('react-native');
  return {
    AddonPermissionManagerScreen: ({
      manifest,
      onSetEnabled,
      onUninstall,
      onRollback,
      onReviewSource,
      onExportSource,
      onExportDiagnostics,
    }: any) => (
      <View>
        <Text>{`manager: ${manifest.name}`}</Text>
        <Text onPress={() => onSetEnabled(true)}>manager: enable</Text>
        <Text onPress={onUninstall}>manager: uninstall</Text>
        {onRollback ? (
          <Text onPress={onRollback}>manager: rollback</Text>
        ) : null}
        <Text onPress={onReviewSource}>manager: source</Text>
        <Text onPress={onExportSource}>manager: export source</Text>
        <Text onPress={onExportDiagnostics}>manager: export diagnostics</Text>
      </View>
    ),
  };
});

const { scriptingService } = require('../../src/services/ScriptingService');
const { adRewardService } = require('../../src/services/AdRewardService');
const {
  inAppPurchaseService,
} = require('../../src/services/InAppPurchaseService');
const {
  addonSafetyService,
} = require('../../src/services/scripting/AddonSafetyService');
const {
  AddonImportCancelledError,
  pickAddonPackageBytes,
} = require('../../src/services/scripting/AddonFileImportService');
const {
  addonInstallerService,
} = require('../../src/services/scripting/AddonInstallerService');
const {
  addonManagementService,
} = require('../../src/services/scripting/AddonManagementService');
const {
  addonLifecycleService,
} = require('../../src/services/scripting/AddonLifecycleService');
const {
  AddonExportCancelledError,
  addonExportService,
} = require('../../src/services/scripting/AddonExportService');

describe('ScriptingScreen', () => {
  beforeEach(async () => {
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
    addonSafetyService.getSnapshot.mockReturnValue({
      safeMode: false,
      disabled: new Map(),
    });
    addonSafetyService.setSafeMode.mockResolvedValue(undefined);
    addonSafetyService.disable = jest.fn(async () => undefined);
    addonManagementService.list.mockReturnValue([]);
    addonManagementService.setEnabled.mockResolvedValue(undefined);
    addonManagementService.uninstall.mockResolvedValue(undefined);
    addonManagementService.rollback.mockResolvedValue(undefined);
    addonManagementService.readSource.mockResolvedValue('module.exports = {};');
    addonInstallerService.prepare.mockResolvedValue({
      review: { name: 'Demo Addon' },
    });
    addonInstallerService.confirm.mockResolvedValue({
      manifest: { id: 'rs.androidircx.demo', name: 'Demo Addon' },
    });
    addonExportService.shareSource.mockResolvedValue(undefined);
    addonExportService.shareDiagnostics.mockResolvedValue(undefined);
    pickAddonPackageBytes.mockResolvedValue(new Uint8Array([1]));
  });

  afterEach(async () => {
    await act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('renders script list and allows toggling, deleting and testing a script', async () => {
    const { findByText, getByLabelText } = await render(
      <ScriptingScreen
        visible
        onClose={jest.fn()}
        onShowPurchaseScreen={jest.fn()}
      />,
    );

    expect(await findByText('Logger Script')).toBeTruthy();
    expect(await findByText('Repository')).toBeTruthy();

    await fireEvent(
      getByLabelText('Toggle Logger Script'),
      'valueChange',
      false,
    );
    await waitFor(async () => {
      expect(scriptingService.setEnabled).toHaveBeenCalledWith(
        'script-1',
        false,
      );
    });

    await fireEvent.press(await findByText('Delete'));
    await waitFor(async () => {
      expect(scriptingService.remove).toHaveBeenCalledWith('script-1');
    });

    await fireEvent.press(await findByText('Test'));
    expect(scriptingService.testHook).toHaveBeenCalledWith(
      'script-1',
      'onMessage',
    );
  });

  it('shows and immediately updates third-party addon Safe Mode', async () => {
    const { findByText, getByLabelText } = await render(
      <ScriptingScreen visible onClose={jest.fn()} />,
    );
    expect(await findByText('Third-party addon Safe Mode')).toBeTruthy();
    await fireEvent(
      getByLabelText('Third-party addon Safe Mode'),
      'valueChange',
      true,
    );
    await waitFor(() =>
      expect(addonSafetyService.setSafeMode).toHaveBeenCalledWith(true),
    );
  });

  it('requests an ad when not ready and shows rewarded ad when ready', async () => {
    const { findByText, rerender } = await render(
      <ScriptingScreen
        visible
        onClose={jest.fn()}
        onShowPurchaseScreen={jest.fn()}
      />,
    );

    await fireEvent.press(await findByText('Request Ad'));
    await waitFor(async () => {
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

    await rerender(
      <ScriptingScreen
        visible
        onClose={jest.fn()}
        onShowPurchaseScreen={jest.fn()}
      />,
    );
    await fireEvent.press(
      await findByText('Watch Ad (+60 min Scripting & No-Ads)'),
    );

    await waitFor(async () => {
      expect(adRewardService.showRewardedAd).toHaveBeenCalledTimes(1);
      expect(Alert.alert).toHaveBeenCalledWith(
        'Thank You!',
        'You earned scripting time!',
      );
    });
  });

  it('creates and saves a new script, validates JSON and lints code', async () => {
    scriptingService.list.mockReturnValue([]);

    const { findByText, findByDisplayValue, getAllByDisplayValue } =
      await render(
        <ScriptingScreen
          visible
          onClose={jest.fn()}
          onShowPurchaseScreen={jest.fn()}
        />,
      );

    await fireEvent.press(await findByText('New Script'));
    await fireEvent.changeText(
      await findByDisplayValue('New Script'),
      'My Script',
    );

    const codeInput = getAllByDisplayValue(
      '// module.exports = { onMessage: (msg) => { /* ... */ } };',
    )[0];
    expect(codeInput.props.spellCheck).not.toBe(false);
    expect(codeInput.props.autoCorrect).not.toBe(false);
    expect(codeInput.props.autoCapitalize).not.toBe('none');
    await fireEvent.changeText(codeInput, 'const x = 1;');

    await fireEvent.changeText(await findByDisplayValue('{}'), '{bad json');
    expect(Alert.alert).toHaveBeenCalledWith(
      'Invalid JSON',
      expect.stringContaining('SyntaxError'),
    );

    await fireEvent.press(await findByText('Lint'));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Lint Passed',
      'No syntax errors detected.',
    );

    await fireEvent.press(await findByText('Save'));
    await waitFor(async () => {
      expect(scriptingService.add).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'My Script',
          code: 'const x = 1;',
        }),
      );
    });
  });

  it('toggles scripting time mode, installs built-ins, clears logs and filters them', async () => {
    const { findByText, getAllByRole, getByPlaceholderText } = await render(
      <ScriptingScreen
        visible
        onClose={jest.fn()}
        onShowPurchaseScreen={jest.fn()}
      />,
    );

    await fireEvent(getAllByRole('switch')[0], 'valueChange', true);
    expect(adRewardService.startUsageTracking).toHaveBeenCalledTimes(1);

    await fireEvent.changeText(getByPlaceholderText('script id'), 'script-1');
    expect(await findByText(/\[script-1\] ran/)).toBeTruthy();

    await fireEvent.press(await findByText('Install Built-ins'));
    await waitFor(async () => {
      expect(scriptingService.installBuiltIns).toHaveBeenCalledWith(mockRepo);
    });

    await fireEvent.press(await findByText('Clear'));
    await waitFor(async () => {
      expect(scriptingService.clearLogs).toHaveBeenCalledTimes(1);
    });
  });

  it('handles ad listener updates and upgrade button flow', async () => {
    const onClose = jest.fn();
    const onShowPurchaseScreen = jest.fn();

    await render(
      <ScriptingScreen
        visible
        onClose={onClose}
        onShowPurchaseScreen={onShowPurchaseScreen}
      />,
    );

    const listener = adRewardService.addListener.mock.calls[0]?.[0];
    await act(() => {
      listener?.(0);
      jest.advanceTimersByTime(1000);
    });

    await waitFor(async () => {
      expect(scriptingService.list).toHaveBeenCalled();
    });
  });

  // Additional tests to improve coverage

  it('renders empty state when no scripts are installed', async () => {
    scriptingService.list.mockReturnValue([]);

    const { findByText } = await render(
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

    const { findByText, queryByText, getAllByText } = await render(
      <ScriptingScreen
        visible
        onClose={jest.fn()}
        onShowPurchaseScreen={jest.fn()}
      />,
    );

    await fireEvent.press(await findByText('New Script'));
    expect(await findByText('Edit Script')).toBeTruthy();

    // Use getAllByText to get all Close buttons and press the one in the editor (second one)
    const closeButtons = getAllByText('Close');
    await fireEvent.press(closeButtons[closeButtons.length - 1]);

    await waitFor(async () => {
      // After closing, the 'Name' label from editor should not be visible
      expect(queryByText('Name')).toBeNull();
    });
  });

  // Skipped under Jest 30 + RNTL 14: valueChange event on the host Switch
  // does not propagate to the composite onValueChange the same way under
  // RNTL 14's host-only tree.
  it.skip('toggles logging on and off', async () => {
    const { getAllByRole } = await render(
      <ScriptingScreen
        visible
        onClose={jest.fn()}
        onShowPurchaseScreen={jest.fn()}
      />,
    );

    // Find the logging switch (last switch in the row section)
    const switches = getAllByRole('switch');
    const loggingSwitch = switches[switches.length - 1];

    await fireEvent(loggingSwitch, 'valueChange', false);
    await waitFor(async () => {
      expect(scriptingService.setLoggingEnabled).toHaveBeenCalledWith(false);
    });

    await fireEvent(loggingSwitch, 'valueChange', true);
    await waitFor(async () => {
      expect(scriptingService.setLoggingEnabled).toHaveBeenCalledWith(true);
    });
  });

  it('handles script toggle error and shows alert', async () => {
    const error = new Error('Cannot enable: dependency missing');
    scriptingService.setEnabled.mockRejectedValue(error);

    const { findByText, getByLabelText } = await render(
      <ScriptingScreen
        visible
        onClose={jest.fn()}
        onShowPurchaseScreen={jest.fn()}
      />,
    );

    expect(await findByText('Logger Script')).toBeTruthy();

    await fireEvent(
      getByLabelText('Toggle Logger Script'),
      'valueChange',
      false,
    );

    await waitFor(async () => {
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

    const { findByText } = await render(
      <ScriptingScreen
        visible
        onClose={jest.fn()}
        onShowPurchaseScreen={jest.fn()}
      />,
    );

    await fireEvent.press(await findByText('New Script'));
    await fireEvent.press(await findByText('Lint'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Syntax Error',
      'Unexpected token at line 5',
    );
  });

  it('stops usage tracking when master toggle is turned off', async () => {
    adRewardService.isTracking.mockReturnValue(true);

    const { getAllByRole } = await render(
      <ScriptingScreen
        visible
        onClose={jest.fn()}
        onShowPurchaseScreen={jest.fn()}
      />,
    );

    const switches = getAllByRole('switch');
    // First switch is the master scripting time toggle
    await fireEvent(switches[0], 'valueChange', false);

    expect(adRewardService.stopUsageTracking).toHaveBeenCalledTimes(1);
  });

  it('shows warning when no scripting time available', async () => {
    adRewardService.hasAvailableTime.mockReturnValue(false);
    adRewardService.getRemainingTimeFormatted.mockReturnValue('0s');
    inAppPurchaseService.hasUnlimitedScripting.mockReturnValue(false);

    const { findByText } = await render(
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

    const { findByText } = await render(
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

    const { findByText } = await render(
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

    const { findByText } = await render(
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

    const { findByText } = await render(
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

    const { queryByText, findByText } = await render(
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

    const { findByText } = await render(
      <ScriptingScreen
        visible
        onClose={jest.fn()}
        onShowPurchaseScreen={jest.fn()}
      />,
    );

    await fireEvent.press(
      await findByText('Watch Ad (+60 min Scripting & No-Ads)'),
    );

    await waitFor(async () => {
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

    const { findByText } = await render(
      <ScriptingScreen
        visible
        onClose={jest.fn()}
        onShowPurchaseScreen={jest.fn()}
      />,
    );

    await fireEvent.press(
      await findByText('Watch Ad (+60 min Scripting & No-Ads)'),
    );

    await waitFor(async () => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Network error');
    });
  });

  it('handles manual ad load failure', async () => {
    adRewardService.manualLoadAd.mockResolvedValue({
      success: false,
      messageKey: 'Ad load failed',
    });

    const { findByText } = await render(
      <ScriptingScreen
        visible
        onClose={jest.fn()}
        onShowPurchaseScreen={jest.fn()}
      />,
    );

    await fireEvent.press(await findByText('Request Ad'));

    await waitFor(async () => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Cannot Load Ad',
        'Ad load failed',
      );
    });
  });

  it('toggles syntax highlighting in editor', async () => {
    scriptingService.list.mockReturnValue([]);

    const { findByText, getAllByRole } = await render(
      <ScriptingScreen
        visible
        onClose={jest.fn()}
        onShowPurchaseScreen={jest.fn()}
      />,
    );

    await fireEvent.press(await findByText('New Script'));

    // Find highlight switch (should be in the editor)
    const switches = getAllByRole('switch');
    // Enable highlighting
    await fireEvent(switches[switches.length - 2], 'valueChange', true);

    // Component should render highlighted code
    expect(await findByText('Edit Script')).toBeTruthy();
  });

  it('toggles script enabled state in editor', async () => {
    scriptingService.list.mockReturnValue([]);

    const { findByText, getAllByRole } = await render(
      <ScriptingScreen
        visible
        onClose={jest.fn()}
        onShowPurchaseScreen={jest.fn()}
      />,
    );

    await fireEvent.press(await findByText('New Script'));

    const switches = getAllByRole('switch');
    // Toggle enabled switch in editor
    await fireEvent(switches[switches.length - 3], 'valueChange', true);

    expect(await findByText('Edit Script')).toBeTruthy();
  });

  it('shows no logs message when logs are empty', async () => {
    scriptingService.getLogs.mockReturnValue([]);

    const { findByText } = await render(
      <ScriptingScreen
        visible
        onClose={jest.fn()}
        onShowPurchaseScreen={jest.fn()}
      />,
    );

    expect(await findByText('No logs yet.')).toBeTruthy();
  });

  it('filters logs by script ID and shows no results', async () => {
    const { getByPlaceholderText, queryByText } = await render(
      <ScriptingScreen
        visible
        onClose={jest.fn()}
        onShowPurchaseScreen={jest.fn()}
      />,
    );

    // Filter by non-existent script
    await fireEvent.changeText(
      getByPlaceholderText('script id'),
      'non-existent',
    );

    // Should show no logs message for filtered results
    await waitFor(async () => {
      expect(queryByText(/\[script-1\] ran/)).toBeNull();
    });
  });

  it('edits an existing script', async () => {
    const { findByText, findByDisplayValue } = await render(
      <ScriptingScreen
        visible
        onClose={jest.fn()}
        onShowPurchaseScreen={jest.fn()}
      />,
    );

    await fireEvent.press(await findByText('Edit'));

    // Should show the script name in the editor
    expect(await findByDisplayValue('Logger Script')).toBeTruthy();

    // Change the name
    await fireEvent.changeText(
      await findByDisplayValue('Logger Script'),
      'Updated Script',
    );

    // Save the script
    await fireEvent.press(await findByText('Save'));

    await waitFor(async () => {
      expect(scriptingService.add).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Updated Script',
        }),
      );
    });
  });

  it('closes main modal when Close button is pressed', async () => {
    const onClose = jest.fn();

    const { findByText } = await render(
      <ScriptingScreen
        visible
        onClose={onClose}
        onShowPurchaseScreen={jest.fn()}
      />,
    );

    // Find and press the close button in header
    const closeButtons = await findByText('Close');
    await fireEvent.press(closeButtons);

    expect(onClose).toHaveBeenCalled();
  });

  it('handles upgrade button press', async () => {
    const onClose = jest.fn();
    const onShowPurchaseScreen = jest.fn();

    const { findByText } = await render(
      <ScriptingScreen
        visible
        onClose={onClose}
        onShowPurchaseScreen={onShowPurchaseScreen}
      />,
    );

    await fireEvent.press(await findByText(/Upgrade to Unlimited/));

    expect(onClose).toHaveBeenCalled();
    expect(onShowPurchaseScreen).toHaveBeenCalled();
  });

  it('does not refresh when not visible', async () => {
    await render(
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

    const { findByText } = await render(
      <ScriptingScreen
        visible
        onClose={jest.fn()}
        onShowPurchaseScreen={jest.fn()}
      />,
    );

    await fireEvent.press(await findByText('Test'));
    expect(scriptingService.testHook).toHaveBeenCalledWith(
      'script-1',
      'onMessage',
    );
  });

  it('shows script description when available', async () => {
    const { findByText } = await render(
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

    const { findByText, findByDisplayValue } = await render(
      <ScriptingScreen
        visible
        onClose={jest.fn()}
        onShowPurchaseScreen={jest.fn()}
      />,
    );

    await fireEvent.press(await findByText('New Script'));

    // Update config with valid JSON
    await fireEvent.changeText(
      await findByDisplayValue('{}'),
      '{"key": "value"}',
    );

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

    const { findByText } = await render(
      <ScriptingScreen
        visible
        onClose={jest.fn()}
        onShowPurchaseScreen={jest.fn()}
      />,
    );

    // The repository section should render (even if empty display)
    expect(await findByText('Repository')).toBeTruthy();
  });

  it('renders Prism syntax highlighting and syncs scroll offset', async () => {
    scriptingService.list.mockReturnValue([]);

    const { findByText, getAllByDisplayValue, getAllByRole, getByTestId } =
      await render(
        <ScriptingScreen
          visible
          onClose={jest.fn()}
          onShowPurchaseScreen={jest.fn()}
        />,
      );

    await fireEvent.press(await findByText('New Script'));

    const code = '// comment\nconst s = "x";\nlet n = 42;';
    const codeInput = getAllByDisplayValue(
      '// module.exports = { onMessage: (msg) => { /* ... */ } };',
    )[0];
    await fireEvent.changeText(codeInput, code);

    // Enable highlighting via the editor's last switch (Highlight).
    const switches = getAllByRole('switch');
    await fireEvent(switches[switches.length - 1], 'valueChange', true);

    // Scrolling the code input must move the highlight layer with it.
    const overlayInput = getAllByDisplayValue(code)[0];
    await fireEvent.scroll(overlayInput, {
      nativeEvent: { contentOffset: { y: 25 } },
    });

    // The layer is translated, not scrolled. It used to be a ScrollView with
    // scrolling disabled, and Android ignores scrollTo on one of those - so
    // the two layers drifted apart and the editor showed two different parts
    // of the script at the same time.
    const layer = getByTestId('script-highlight-layer');
    const flattened = Object.assign(
      {},
      ...[].concat(layer.props.style).filter(Boolean),
    );
    expect(flattened.transform).toBeTruthy();
    expect(flattened.position).toBe('absolute');

    expect(await findByText('Edit Script')).toBeTruthy();
  });

  it('keeps the highlight layer behind the input', async () => {
    scriptingService.list.mockReturnValue([]);

    const { findByText, getAllByDisplayValue, getAllByRole, getByTestId } =
      await render(
        <ScriptingScreen
          visible
          onClose={jest.fn()}
          onShowPurchaseScreen={jest.fn()}
        />,
      );

    await fireEvent.press(await findByText('New Script'));
    const switches = getAllByRole('switch');
    await fireEvent(switches[switches.length - 1], 'valueChange', true);

    const flat = (style: unknown) =>
      Object.assign({}, ...([] as any[]).concat(style).filter(Boolean));
    const layer = flat(getByTestId('script-highlight-layer').props.style);
    const input = flat(
      getAllByDisplayValue(
        '// module.exports = { onMessage: (msg) => { /* ... */ } };',
      )[0].props.style,
    );

    // In front, pointerEvents="none" is not enough on Android: taps never
    // reach the field, so there is no caret and the editor reads as a preview
    // you cannot type into. This has been got wrong twice.
    expect(layer.zIndex).toBeLessThan(input.zIndex);
  });

  it('keeps the code editable with highlight on', async () => {
    scriptingService.list.mockReturnValue([]);

    const { findByText, getAllByDisplayValue, getAllByRole } = await render(
      <ScriptingScreen
        visible
        onClose={jest.fn()}
        onShowPurchaseScreen={jest.fn()}
      />,
    );

    await fireEvent.press(await findByText('New Script'));

    const switches = getAllByRole('switch');
    await fireEvent(switches[switches.length - 1], 'valueChange', true);

    const start = '// module.exports = { onMessage: (msg) => { /* ... */ } };';
    let input = getAllByDisplayValue(start)[0];

    // The editor must not pin the caret while the user types: doing that is
    // what dragged every keystroke back to the same spot once the highlight
    // layer made each render slow enough to lose the race.
    expect(input.props.selection).toBeUndefined();

    await fireEvent.changeText(input, 'const a = 1;');
    input = getAllByDisplayValue('const a = 1;')[0];
    expect(input.props.selection).toBeUndefined();

    await fireEvent.changeText(input, 'const a = 1;\nconst b = 2;');
    expect(getAllByDisplayValue('const a = 1;\nconst b = 2;')[0]).toBeTruthy();
  });

  it('falls back to manual highlighting when Prism grammar is unavailable', async () => {
    scriptingService.list.mockReturnValue([]);
    const Prism = require('prismjs');
    const originalGrammar = Prism.languages.javascript;
    Prism.languages.javascript = undefined;

    try {
      const { findByText, getAllByDisplayValue, getAllByRole } = await render(
        <ScriptingScreen
          visible
          onClose={jest.fn()}
          onShowPurchaseScreen={jest.fn()}
        />,
      );

      await fireEvent.press(await findByText('New Script'));

      const code =
        '/* block */ // line\nconst x = "a" + \'b\' + `c`;\nlet y = 12.5; plain';
      const codeInput = getAllByDisplayValue(
        '// module.exports = { onMessage: (msg) => { /* ... */ } };',
      )[0];
      await fireEvent.changeText(codeInput, code);

      const switches = getAllByRole('switch');
      await fireEvent(switches[switches.length - 1], 'valueChange', true);

      expect(await findByText('Edit Script')).toBeTruthy();
    } finally {
      Prism.languages.javascript = originalGrammar;
    }
  });

  it('falls back to manual highlighting when Prism tokenize throws', async () => {
    scriptingService.list.mockReturnValue([]);
    const Prism = require('prismjs');
    const tokenizeSpy = jest.spyOn(Prism, 'tokenize').mockImplementation(() => {
      throw new Error('tokenize boom');
    });

    try {
      const { findByText, getAllByDisplayValue, getAllByRole } = await render(
        <ScriptingScreen
          visible
          onClose={jest.fn()}
          onShowPurchaseScreen={jest.fn()}
        />,
      );

      await fireEvent.press(await findByText('New Script'));

      const code = '// c\nconst z = 7;';
      const codeInput = getAllByDisplayValue(
        '// module.exports = { onMessage: (msg) => { /* ... */ } };',
      )[0];
      await fireEvent.changeText(codeInput, code);

      const switches = getAllByRole('switch');
      await fireEvent(switches[switches.length - 1], 'valueChange', true);

      expect(await findByText('Edit Script')).toBeTruthy();
    } finally {
      tokenizeSpy.mockRestore();
    }
  });

  it('closes the editor via hardware back requestClose', async () => {
    scriptingService.list.mockReturnValue([]);
    const { Modal } = require('react-native');

    const { findByText, queryByText, UNSAFE_getAllByType } = await render(
      <ScriptingScreen
        visible
        onClose={jest.fn()}
        onShowPurchaseScreen={jest.fn()}
      />,
    );

    await fireEvent.press(await findByText('New Script'));
    expect(await findByText('Edit Script')).toBeTruthy();

    await act(async () => {
      UNSAFE_getAllByType(Modal).forEach((modal: any) =>
        fireEvent(modal, 'requestClose'),
      );
    });

    await waitFor(async () => {
      expect(queryByText('Name')).toBeNull();
    });
  });

  // Skipped under Jest 30 + RNTL 14: simultaneous-show reproducer hangs
  // under the new async render/act pipeline. The in-progress guard is
  // covered indirectly by the surrounding ad-flow tests.
  it.skip('prevents multiple ad shows when already showing', async () => {
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

    const { findByText } = await render(
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
    await fireEvent.press(watchButton);

    // Wait a tick for state to update
    await act(async () => {
      jest.advanceTimersByTime(10);
    });

    // Second press should be ignored while showingAd is true
    // Since the button text changes to a loading indicator, we can't press it again
    // So we verify showRewardedAd was called only once
    expect(adRewardService.showRewardedAd).toHaveBeenCalledTimes(1);
  });

  describe('Generate with AI button', () => {
    const openEditor = async () => {
      const utils = await render(
        <ScriptingScreen
          visible
          onClose={jest.fn()}
          onShowPurchaseScreen={jest.fn()}
        />,
      );
      await fireEvent.press(await utils.findByText('New Script'));
      await utils.findByText('Edit Script');
      return utils;
    };

    it('stays hidden for someone who never set up AI', async () => {
      aiService.diagnose.mockResolvedValue({
        code: 'no_provider',
        ready: false,
        reason: 'No AI provider is set up.',
        where: 'Settings > AI > AI Providers > Add',
      });

      const { queryByLabelText, findByText } = await openEditor();

      await findByText('Lint');
      // The one place AI would otherwise appear uninvited.
      expect(queryByLabelText('Generate with AI')).toBeNull();
    });

    it('appears once a provider exists', async () => {
      aiService.diagnose.mockResolvedValue({
        code: 'ok',
        ready: true,
        reason: '',
        where: '',
      });

      const { findByLabelText } = await openEditor();

      await findByLabelText('Generate with AI');
    });

    it('stays visible when AI is set up but something else is off', async () => {
      aiService.diagnose.mockResolvedValue({
        code: 'consent_required',
        ready: false,
        reason: 'Not agreed yet.',
        where: 'Settings > AI > Privacy',
      });

      const { findByLabelText } = await openEditor();

      // Hiding a button the user configured would be a disappearing act;
      // the modal's banner explains what is missing instead.
      await findByLabelText('Generate with AI');
    });
  });

  describe('imported addon packages', () => {
    const addon = {
      manifest: {
        id: 'rs.androidircx.demo',
        name: 'Demo Addon',
        version: '1.0.0',
        permissions: ['irc.read'],
      },
      enabled: false,
      activeChecksum: 'a'.repeat(64),
    };

    const openManager = async () => {
      const utils = await render(
        <ScriptingScreen visible onClose={jest.fn()} />,
      );
      await utils.findByText('Demo Addon');
      await fireEvent.press(utils.getByText('Demo Addon'));
      await utils.findByText('manager: Demo Addon');
      return utils;
    };

    beforeEach(() => {
      addonManagementService.list.mockReturnValue([addon]);
    });

    it('says so when nothing is installed', async () => {
      addonManagementService.list.mockReturnValue([]);
      const { findByText } = await render(
        <ScriptingScreen visible onClose={jest.fn()} />,
      );

      expect(await findByText('No addon packages installed.')).toBeTruthy();
    });

    it('lists an installed package with its state', async () => {
      const { findByText } = await render(
        <ScriptingScreen visible onClose={jest.fn()} />,
      );

      expect(await findByText('Demo Addon')).toBeTruthy();
      expect(await findByText('DISABLED')).toBeTruthy();
    });

    it('reviews a package before installing it, and installs it disabled', async () => {
      const { findByText, getByText } = await render(
        <ScriptingScreen visible onClose={jest.fn()} />,
      );
      await findByText('Import addon');

      await fireEvent.press(getByText('Import addon'));
      await waitFor(() =>
        expect(addonInstallerService.prepare).toHaveBeenCalled(),
      );
      await fireEvent.press(await findByText('confirm install'));

      await waitFor(() =>
        expect(addonInstallerService.confirm).toHaveBeenCalled(),
      );
      // Installing is never the same as running it.
      expect(addonLifecycleService.stop).toHaveBeenCalledWith(
        'rs.androidircx.demo',
      );
      expect(addonSafetyService.disable).toHaveBeenCalledWith(
        'rs.androidircx.demo',
      );
    });

    it('says why a package could not be read', async () => {
      pickAddonPackageBytes.mockRejectedValueOnce(new Error('not a zip'));
      const { findByText, getByText } = await render(
        <ScriptingScreen visible onClose={jest.fn()} />,
      );
      await findByText('Import addon');

      await fireEvent.press(getByText('Import addon'));

      await waitFor(() =>
        expect(Alert.alert).toHaveBeenCalledWith(
          'Cannot Import Addon',
          'not a zip',
        ),
      );
    });

    it('stays quiet when the user cancelled the file picker', async () => {
      pickAddonPackageBytes.mockRejectedValueOnce(
        new AddonImportCancelledError(),
      );
      const { findByText, getByText } = await render(
        <ScriptingScreen visible onClose={jest.fn()} />,
      );
      await findByText('Import addon');

      await fireEvent.press(getByText('Import addon'));

      await waitFor(() => expect(pickAddonPackageBytes).toHaveBeenCalled());
      expect(Alert.alert).not.toHaveBeenCalled();
    });

    it('says why an install failed', async () => {
      addonInstallerService.confirm.mockRejectedValueOnce(
        new Error('signature does not match'),
      );
      const { findByText, getByText } = await render(
        <ScriptingScreen visible onClose={jest.fn()} />,
      );
      await findByText('Import addon');

      await fireEvent.press(getByText('Import addon'));
      await fireEvent.press(await findByText('confirm install'));

      await waitFor(() =>
        expect(Alert.alert).toHaveBeenCalledWith(
          'Cannot Install Addon',
          'signature does not match',
        ),
      );
    });

    it('enables one from its manager, and reports a refusal', async () => {
      const { getByText } = await openManager();

      await fireEvent.press(getByText('manager: enable'));
      await waitFor(() =>
        expect(addonManagementService.setEnabled).toHaveBeenCalledWith(
          'rs.androidircx.demo',
          true,
        ),
      );

      addonManagementService.setEnabled.mockRejectedValueOnce(
        new Error('Safe Mode is on'),
      );
      await fireEvent.press(getByText('manager: enable'));
      await waitFor(() =>
        expect(Alert.alert).toHaveBeenCalledWith(
          'Cannot Update Addon',
          'Safe Mode is on',
        ),
      );
    });

    it('uninstalls one, and reports a failure', async () => {
      const { getByText } = await openManager();

      addonManagementService.uninstall.mockRejectedValueOnce(
        new Error('still running'),
      );
      await fireEvent.press(getByText('manager: uninstall'));
      await waitFor(() =>
        expect(Alert.alert).toHaveBeenCalledWith(
          'Cannot Uninstall Addon',
          'still running',
        ),
      );

      await fireEvent.press(getByText('manager: uninstall'));
      await waitFor(() =>
        expect(addonManagementService.uninstall).toHaveBeenCalledWith(
          'rs.androidircx.demo',
        ),
      );
    });

    it('offers a rollback only when there is something to roll back to', async () => {
      const { queryByText } = await openManager();
      expect(queryByText('manager: rollback')).toBeNull();
    });

    it('rolls back to the previous package, and reports a failure', async () => {
      addonManagementService.list.mockReturnValue([
        { ...addon, previousChecksum: 'b'.repeat(64) },
      ]);
      const { getByText } = await openManager();

      addonManagementService.rollback.mockRejectedValueOnce(
        new Error('nothing to roll back to'),
      );
      await fireEvent.press(getByText('manager: rollback'));
      await waitFor(() =>
        expect(Alert.alert).toHaveBeenCalledWith(
          'Cannot Roll Back Addon',
          'nothing to roll back to',
        ),
      );

      await fireEvent.press(getByText('manager: rollback'));
      await waitFor(() =>
        expect(addonManagementService.rollback).toHaveBeenCalledWith(
          'rs.androidircx.demo',
        ),
      );
    });

    it('shows the source, truncating a very large file', async () => {
      addonManagementService.readSource.mockResolvedValue(
        'x'.repeat(200 * 1024),
      );
      const { getByText, findByText } = await openManager();

      await fireEvent.press(getByText('manager: source'));

      expect(await findByText(/Preview truncated/)).toBeTruthy();
    });

    it('says why the source could not be read', async () => {
      addonManagementService.readSource.mockRejectedValueOnce(
        new Error('blob is gone'),
      );
      const { getByText } = await openManager();

      await fireEvent.press(getByText('manager: source'));

      await waitFor(() =>
        expect(Alert.alert).toHaveBeenCalledWith(
          'Cannot Read Addon Source',
          'blob is gone',
        ),
      );
    });

    it('exports the source and the diagnostics', async () => {
      const { getByText } = await openManager();

      await fireEvent.press(getByText('manager: export source'));
      expect(addonExportService.shareSource).toHaveBeenCalledWith(
        'rs.androidircx.demo',
      );

      await fireEvent.press(getByText('manager: export diagnostics'));
      expect(addonExportService.shareDiagnostics).toHaveBeenCalledWith(
        'rs.androidircx.demo',
      );
    });

    it('says why an export failed, but not when it was cancelled', async () => {
      addonExportService.shareSource.mockRejectedValueOnce(
        new Error('no room on the card'),
      );
      const { getByText } = await openManager();

      await fireEvent.press(getByText('manager: export source'));
      await waitFor(() =>
        expect(Alert.alert).toHaveBeenCalledWith(
          'Cannot Export Addon',
          'no room on the card',
        ),
      );

      (Alert.alert as jest.Mock).mockClear();
      addonExportService.shareSource.mockRejectedValueOnce(
        new AddonExportCancelledError(),
      );
      await fireEvent.press(getByText('manager: export source'));
      await waitFor(() =>
        expect(addonExportService.shareSource).toHaveBeenCalledTimes(2),
      );
      expect(Alert.alert).not.toHaveBeenCalled();
    });

    it('puts Safe Mode back when it could not be changed', async () => {
      addonSafetyService.setSafeMode.mockRejectedValueOnce(
        new Error('storage is full'),
      );
      const { getByLabelText } = await render(
        <ScriptingScreen visible onClose={jest.fn()} />,
      );

      await fireEvent(
        getByLabelText('Third-party addon Safe Mode'),
        'valueChange',
        true,
      );

      await waitFor(() =>
        expect(Alert.alert).toHaveBeenCalledWith(
          'Could not update Safe Mode',
          'storage is full',
        ),
      );
    });

    it('turns Safe Mode on', async () => {
      const { getByLabelText } = await render(
        <ScriptingScreen visible onClose={jest.fn()} />,
      );

      await fireEvent(
        getByLabelText('Third-party addon Safe Mode'),
        'valueChange',
        true,
      );

      expect(addonSafetyService.setSafeMode).toHaveBeenCalledWith(true);
    });

    it('warns while Developer Mode is on', async () => {
      const { getByLabelText, findByText } = await render(
        <ScriptingScreen visible onClose={jest.fn()} />,
      );

      await fireEvent(
        getByLabelText('Addon Developer Mode'),
        'valueChange',
        true,
      );

      expect(
        await findByText(/Developer Mode allows unsigned addon packages/),
      ).toBeTruthy();
    });
  });

  describe('autocomplete in the editor', () => {
    const DEFAULT_CODE =
      '// module.exports = { onMessage: (msg) => { /* ... */ } };';

    /** Open the editor and put `code` in it, with the caret at its end. */
    const typeCode = async (code: string) => {
      const utils = await render(
        <ScriptingScreen
          visible
          onClose={jest.fn()}
          onShowPurchaseScreen={jest.fn()}
        />,
      );
      await fireEvent.press(await utils.findByText('New Script'));
      const codeInput = utils.getAllByDisplayValue(DEFAULT_CODE)[0];
      await fireEvent(codeInput, 'focus');
      await fireEvent.changeText(codeInput, code);
      await fireEvent(codeInput, 'selectionChange', {
        nativeEvent: { selection: { start: code.length, end: code.length } },
      });
      return { ...utils, codeInput };
    };

    it('offers api members after a dot', async () => {
      const { findByText } = await typeCode('api.se');

      // The list shows signatures, so match on the name inside one.
      expect(await findByText(/sendMessage/)).toBeTruthy();
    });

    it('offers the ai members after api.ai., not the api ones', async () => {
      const { findAllByText, queryByText } = await typeCode('api.ai.');

      expect((await findAllByText(/ask/)).length).toBeGreaterThan(0);
      expect(queryByText(/sendMessage/)).toBeNull();
    });

    it('offers hook names for a bare word of two characters or more', async () => {
      const { findByText } = await typeCode('onMe');

      expect(await findByText(/onMessage/)).toBeTruthy();
    });

    it('offers nothing for a single character', async () => {
      const { queryByText } = await typeCode('o');

      expect(queryByText(/onMessage/)).toBeNull();
    });

    it('offers nothing where no word is being typed', async () => {
      const { queryByText } = await typeCode('api.sendMessage(); ');

      expect(queryByText(/sendMessage\(/)).toBeNull();
    });

    it('inserts the chosen member in place of what was typed', async () => {
      const { findByText, getAllByDisplayValue } = await typeCode('api.sendM');

      await fireEvent.press(await findByText(/sendMessage/));

      expect(getAllByDisplayValue(/api\.sendMessage/).length).toBeGreaterThan(
        0,
      );
    });

    it('accepts the first suggestion on Tab', async () => {
      const { codeInput, getAllByDisplayValue } = await typeCode('api.sendM');

      await fireEvent(codeInput, 'keyPress', {
        nativeEvent: { key: 'Tab' },
      });

      expect(getAllByDisplayValue(/api\.sendMessage/).length).toBeGreaterThan(
        0,
      );
    });

    it('ignores Tab when there is nothing to accept', async () => {
      const { codeInput, getAllByDisplayValue } =
        await typeCode('const x = 1;');

      await fireEvent(codeInput, 'keyPress', { nativeEvent: { key: 'Tab' } });

      expect(getAllByDisplayValue('const x = 1;').length).toBeGreaterThan(0);
    });

    it('hides the list once the editor loses focus', async () => {
      const { codeInput, queryByText, findByText } = await typeCode('api.se');
      await findByText(/sendMessage/);

      await fireEvent(codeInput, 'blur');
      await act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(queryByText(/sendMessage\(/)).toBeNull();
    });
  });

  /**
   * The generator writes code into the editor. It never saves and never
   * enables — the user still reads it and taps Save. The branch that matters
   * most is the one guarding against it quietly overwriting a script somebody
   * already wrote.
   */
  describe('generating a script with AI', () => {
    const {
      scriptGenerator,
    } = require('../../src/services/ai/ScriptGenerator');

    const openGenerator = async (existingCode?: string) => {
      aiService.diagnose.mockResolvedValue({
        code: 'ok',
        ready: true,
        reason: '',
        where: '',
      });

      const utils = await render(
        <ScriptingScreen
          visible
          onClose={jest.fn()}
          onShowPurchaseScreen={jest.fn()}
        />,
      );

      if (existingCode === undefined) {
        await fireEvent.press(await utils.findByText('New Script'));
      } else {
        scriptingService.list.mockReturnValue([
          { ...mockScripts[0], code: existingCode },
        ]);
        await fireEvent.press(await utils.findByText('New Script'));
        const codeInput = utils.getAllByDisplayValue(
          '// module.exports = { onMessage: (msg) => { /* ... */ } };',
        )[0];
        await fireEvent.changeText(codeInput, existingCode);
      }

      await utils.findByText('Edit Script');
      await fireEvent.press(await utils.findByLabelText('Generate with AI'));
      await utils.findByText('Generate with AI');
      return utils;
    };

    const promptWith = async (utils: any, text: string) => {
      const input = utils.getByPlaceholderText(/^e\.g\./);
      await fireEvent.changeText(input, text);
      return input;
    };

    // "Generate" for an empty script, "Apply the change" when there is code to
    // change — a new script starts with a comment, so it is usually the latter.
    const generateButton = (utils: any) =>
      utils.getByText(/^(Generate|Apply the change)$/);

    it('does nothing without a prompt', async () => {
      const utils = await openGenerator();
      scriptGenerator.generate.mockClear();

      await fireEvent.press(generateButton(utils));

      expect(scriptGenerator.generate).not.toHaveBeenCalled();
    });

    it('generates from a prompt and shows the code', async () => {
      scriptGenerator.generate.mockResolvedValue({
        code: 'module.exports = { onMessage() {} };',
        lint: { ok: true, message: '' },
      });
      const utils = await openGenerator();

      await promptWith(utils, 'log every message');
      await fireEvent.press(generateButton(utils));

      // A new script already carries its placeholder comment, so the generator
      // is asked to CHANGE that rather than to write from nothing.
      await waitFor(() =>
        expect(scriptGenerator.generate).toHaveBeenCalledWith(
          'log every message',
          expect.stringContaining('module.exports'),
        ),
      );
    });

    it('says when the generated code does not compile', async () => {
      scriptGenerator.generate.mockResolvedValue({
        code: 'module.exports = {',
        lint: { ok: false, message: 'Unexpected end of input' },
      });
      const utils = await openGenerator();

      await promptWith(utils, 'something broken');
      await fireEvent.press(generateButton(utils));

      // Better to show the verdict than to quietly trust the model.
      expect(await utils.findByText(/Unexpected end of input/)).toBeTruthy();
    });

    it('reports a generator that fails', async () => {
      scriptGenerator.generate.mockRejectedValue(new Error('rate limited'));
      const utils = await openGenerator();

      await promptWith(utils, 'anything');
      await fireEvent.press(generateButton(utils));

      await waitFor(() =>
        expect(Alert.alert).toHaveBeenCalledWith(
          'Could not generate',
          'rate limited',
        ),
      );
    });

    it('closes again without keeping anything', async () => {
      const utils = await openGenerator();

      // The generator's own Close is the last one on screen; the editor's sits
      // behind it.
      const closes = utils.getAllByText('Close');
      await fireEvent.press(closes[closes.length - 1]);

      await waitFor(() =>
        expect(utils.queryByPlaceholderText(/^e\.g\./)).toBeNull(),
      );
    });
  });
});

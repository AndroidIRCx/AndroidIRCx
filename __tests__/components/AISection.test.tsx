/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { AISection } from '../../src/components/settings/sections/AISection';

jest.mock('../../src/i18n/localization', () => ({
  useT: () => (key: string, params?: Record<string, unknown>) => {
    if (!params) return key;
    return Object.entries(params).reduce(
      (result, [paramKey, value]) =>
        paramKey === '_tags'
          ? result
          : result.replace(`{${paramKey}}`, String(value)),
      key,
    );
  },
}));

jest.mock('../../src/services/ai/AIService', () => ({
  aiService: {
    loadSettings: jest.fn().mockResolvedValue(undefined),
    isEnabled: jest.fn().mockReturnValue(true),
    setEnabled: jest.fn().mockResolvedValue(undefined),
    isAvailable: jest.fn().mockResolvedValue(true),
    diagnose: jest
      .fn()
      .mockResolvedValue({ code: 'ok', ready: true, reason: '', where: '' }),
  },
}));

jest.mock('../../src/services/ai/AIProviderStore', () => ({
  aiProviderStore: { list: jest.fn() },
}));

const { aiService } = require('../../src/services/ai/AIService');
const { aiProviderStore } = require('../../src/services/ai/AIProviderStore');

const colors = {
  text: '#fff',
  textSecondary: '#bbb',
  primary: '#4caf50',
  onPrimary: '#fff',
  surface: '#111',
  border: '#444',
  background: '#000',
};

const styles = {
  settingItem: {},
  settingContent: {},
  settingTitleRow: {},
  settingTitle: {},
  settingDescription: {},
  disabledItem: {},
  disabledText: {},
  chevron: {},
};

const renderSection = (
  onShowAISettings = jest.fn(),
  onShowAIAgent = jest.fn(),
) =>
  render(
    <AISection
      colors={colors}
      styles={styles}
      settingIcons={{}}
      onShowAISettings={onShowAISettings}
      onShowAIAgent={onShowAIAgent}
    />,
  );

describe('AISection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    aiService.isEnabled.mockReturnValue(true);
    aiService.isAvailable.mockResolvedValue(true);
    aiService.diagnose.mockResolvedValue({
      code: 'ok',
      ready: true,
      reason: '',
      where: '',
    });
    aiProviderStore.list.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]);
  });

  it('summarizes how many providers are configured', async () => {
    const { findByText } = await renderSection();

    await findByText('2 configured');
  });

  it('nudges the user when nothing is set up', async () => {
    aiProviderStore.list.mockResolvedValue([]);
    aiService.diagnose.mockResolvedValue({
      code: 'no_provider',
      ready: false,
      reason: 'No AI provider is set up.',
      where: 'Settings › AI › AI Providers › Add',
    });

    const { findByText } = await renderSection();

    await findByText(
      'No provider configured yet — add your own API key or a local model',
    );
  });

  it('names the blocker and where to fix it', async () => {
    aiProviderStore.list.mockResolvedValue([{ id: 'p1' }]);
    aiService.diagnose.mockResolvedValue({
      code: 'consent_required',
      ready: false,
      reason: 'Sending messages to "DeepSeek" has not been agreed to yet.',
      where: 'Settings › AI › Privacy › Allow sending messages to a provider',
    });

    const { findAllByText } = await renderSection();

    // "not ready" alone leaves the user hunting; the row must say which of
    // the four things is wrong and where the switch is.
    const matches = await findAllByText(
      /has not been agreed to yet\. Settings . AI . Privacy/,
    );
    expect(matches.length).toBeGreaterThan(0);
  });

  it('opens the provider screen', async () => {
    const onShow = jest.fn();
    const { findByText } = await renderSection(onShow);

    await fireEvent.press(await findByText('AI Providers'));

    expect(onShow).toHaveBeenCalled();
  });

  it('opens the assistant', async () => {
    const onAgent = jest.fn();
    const { findByText } = await renderSection(jest.fn(), onAgent);

    await fireEvent.press(await findByText('Assistant'));

    expect(onAgent).toHaveBeenCalled();
  });

  it('tells the assistant row what is missing, not just that it is off', async () => {
    aiProviderStore.list.mockResolvedValue([]);
    aiService.diagnose.mockResolvedValue({
      code: 'missing_key',
      ready: false,
      reason: '"DeepSeek" has no API key stored.',
      where: 'Settings › AI › AI Providers › DeepSeek › Edit',
    });

    const { findAllByText } = await renderSection();

    const matches = await findAllByText(/has no API key stored\..*Edit/);
    expect(matches.length).toBeGreaterThan(0);
  });

  it('flips the kill switch through the service', async () => {
    const { UNSAFE_getAllByType } = await renderSection();
    const { Switch } = require('react-native');

    await waitFor(() => expect(aiProviderStore.list).toHaveBeenCalled());
    await fireEvent(UNSAFE_getAllByType(Switch)[0], 'valueChange', false);

    expect(aiService.setEnabled).toHaveBeenCalledWith(false);
  });

  describe('the floating assistant button', () => {
    const { settingsService } = require('../../src/services/SettingsService');
    const { Switch } = require('react-native');

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('is offered here, off by default', async () => {
      jest.spyOn(settingsService, 'getSetting').mockResolvedValue(false);
      const { findByText, UNSAFE_getAllByType } = await renderSection();

      expect(await findByText('Show Assistant Button')).toBeTruthy();
      // The kill switch, then this one.
      expect(UNSAFE_getAllByType(Switch)[1].props.value).toBe(false);
    });

    it('saves the choice to the setting Appearance shares', async () => {
      jest.spyOn(settingsService, 'getSetting').mockResolvedValue(false);
      const set = jest
        .spyOn(settingsService, 'setSetting')
        .mockResolvedValue(undefined);
      const { findByText, UNSAFE_getAllByType } = await renderSection();
      await findByText('Show Assistant Button');

      await fireEvent(UNSAFE_getAllByType(Switch)[1], 'valueChange', true);

      expect(set).toHaveBeenCalledWith('showMessageAreaAssistantButton', true);
      await waitFor(() =>
        expect(UNSAFE_getAllByType(Switch)[1].props.value).toBe(true),
      );
    });

    it('follows a change made in Appearance', async () => {
      let notify: (value: boolean) => void = () => undefined;
      jest.spyOn(settingsService, 'getSetting').mockResolvedValue(false);
      jest
        .spyOn(settingsService, 'onSettingChange')
        .mockImplementation((_key: any, handler: any) => {
          notify = handler;
          return () => undefined;
        });
      const { findByText, UNSAFE_getAllByType } = await renderSection();
      await findByText('Show Assistant Button');

      await waitFor(() => notify(true));

      await waitFor(() =>
        expect(UNSAFE_getAllByType(Switch)[1].props.value).toBe(true),
      );
    });

    it('ignores a value that arrives after the section is gone', async () => {
      let resolve: (value: boolean) => void = () => undefined;
      jest.spyOn(settingsService, 'getSetting').mockReturnValue(
        new Promise(done => {
          resolve = done;
        }),
      );
      const { unmount } = await renderSection();

      await unmount();
      // Would set state on an unmounted component without the guard.
      await waitFor(() => resolve(true));
    });

    it('stays off when the setting cannot be read', async () => {
      jest
        .spyOn(settingsService, 'getSetting')
        .mockRejectedValue(new Error('gone'));
      const { findByText, UNSAFE_getAllByType } = await renderSection();
      await findByText('Show Assistant Button');

      expect(UNSAFE_getAllByType(Switch)[1].props.value).toBe(false);
    });
  });
});

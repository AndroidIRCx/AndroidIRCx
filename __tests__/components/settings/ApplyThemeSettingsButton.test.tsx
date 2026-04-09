import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import { ApplyThemeSettingsButton } from '../../../src/components/settings/ApplyThemeSettingsButton';

const mockUseTheme = jest.fn();
const mockHasRecommendedSettings = jest.fn();
const mockGetRecommendedSettings = jest.fn();
const mockSetSetting = jest.fn();

jest.mock('../../../src/hooks/useTheme', () => ({
  useTheme: () => mockUseTheme(),
}));

jest.mock('../../../src/services/ThemeService', () => ({
  themeService: {
    hasRecommendedSettings: () => mockHasRecommendedSettings(),
    getRecommendedSettings: () => mockGetRecommendedSettings(),
  },
}));

jest.mock('../../../src/services/SettingsService', () => ({
  settingsService: {
    setSetting: (...args: unknown[]) => mockSetSetting(...args),
  },
}));

jest.mock('../../../src/i18n/transifex', () => ({
  tx: {
    t: (key: string, params?: Record<string, string>) => {
      if (params?.themeName) return `${key}:${params.themeName}`;
      return key;
    },
  },
}));

describe('ApplyThemeSettingsButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTheme.mockReturnValue({ theme: { name: 'Oceanic' } });
    mockSetSetting.mockResolvedValue(undefined);
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  });

  it('returns null when recommended settings are unavailable', () => {
    mockHasRecommendedSettings.mockReturnValue(false);
    mockGetRecommendedSettings.mockReturnValue(null);

    const { toJSON } = render(<ApplyThemeSettingsButton />);
    expect(toJSON()).toBeNull();
  });

  it('applies mapped settings after confirmation', async () => {
    mockHasRecommendedSettings.mockReturnValue(true);
    mockGetRecommendedSettings.mockReturnValue({
      tabPosition: 'bottom',
      fontSize: 'large',
      bannerPosition: 'above_header',
      showTimestamps: true,
      messageSpacing: 2,
    });

    const onApplied = jest.fn();
    const { getByText } = render(
      <ApplyThemeSettingsButton onApplied={onApplied} />,
    );

    fireEvent.press(getByText('Apply Theme Settings'));
    const firstAlertArgs = (Alert.alert as jest.Mock).mock.calls[0];
    const applyAction = firstAlertArgs[2][1];

    await act(async () => {
      await applyAction.onPress();
    });

    expect(mockSetSetting).toHaveBeenCalledWith('tabPosition', 'bottom');
    expect(mockSetSetting).toHaveBeenCalledWith('layoutType', 'relaxed');
    expect(mockSetSetting).toHaveBeenCalledWith('bannerPosition', 'tabs_above');
    expect(mockSetSetting).toHaveBeenCalledWith('showTimestamps', true);
    expect(mockSetSetting).toHaveBeenCalledWith('messageSpacing', 2);
    expect(onApplied).toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      'Settings Applied',
      'Theme settings have been applied successfully.',
    );
  });

  it('shows error alert when applying settings fails', async () => {
    mockHasRecommendedSettings.mockReturnValue(true);
    mockGetRecommendedSettings.mockReturnValue({
      fontSize: 'xlarge',
      bannerPosition: 'unknown_position',
    });
    mockSetSetting.mockRejectedValueOnce(new Error('boom'));

    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const { getByText } = render(<ApplyThemeSettingsButton />);

    fireEvent.press(getByText('Apply Theme Settings'));
    const firstAlertArgs = (Alert.alert as jest.Mock).mock.calls[0];
    const applyAction = firstAlertArgs[2][1];

    await act(async () => {
      await applyAction.onPress();
    });

    expect(mockSetSetting).toHaveBeenCalledWith('layoutType', 'custom');
    expect(mockSetSetting).not.toHaveBeenCalledWith(
      'bannerPosition',
      expect.anything(),
    );
    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Failed to apply theme settings. Please try again.',
    );

    consoleSpy.mockRestore();
  });
});

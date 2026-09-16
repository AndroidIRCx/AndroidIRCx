import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import { ThemeSelectorWithSettings } from '../../../src/components/settings/ThemeSelectorWithSettings';

const mockSetTheme = jest.fn();
const mockUseThemeWithSettings = jest.fn();

jest.mock('../../../src/hooks/useThemeWithSettings', () => ({
  useThemeWithSettings: () => mockUseThemeWithSettings(),
}));

jest.mock('../../../src/i18n/localization', () => ({
  tx: {
    t: (key: string, params?: Record<string, string>) => {
      if (params?.themeName) return `${key}:${params.themeName}`;
      return key;
    },
  },
}));

const themes = [
  {
    id: 'light',
    name: 'Light',
    colors: { background: '#fff', primary: '#000' },
  },
  {
    id: 'oceanic',
    name: 'Oceanic',
    colors: { background: '#001122', primary: '#33ccff' },
    recommendedSettings: { fontSize: 'large' },
    isCustom: true,
  },
] as any;

describe('ThemeSelectorWithSettings', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockSetTheme.mockResolvedValue(undefined);
    mockUseThemeWithSettings.mockReturnValue({
      theme: { id: 'light', name: 'Light' },
      setTheme: mockSetTheme,
      hasRecommendedSettings: true,
      recommendedSettings: { fontSize: 'large' },
    });
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  });

  it('applies simple theme change when no recommended settings exist', async () => {
    const onThemeChange = jest.fn();
    const { getByText } = await render(
      <ThemeSelectorWithSettings
        themes={themes}
        onThemeChange={onThemeChange}
      />,
    );

    await act(async () => {
      await fireEvent.press(getByText('Light'));
    });

    expect(mockSetTheme).toHaveBeenCalledWith('light', false);
    expect(onThemeChange).toHaveBeenCalledWith('light');
  });

  it('supports Theme Only path for theme with recommended settings', async () => {
    const onThemeChange = jest.fn();
    const { getByText } = await render(
      <ThemeSelectorWithSettings
        themes={themes}
        onThemeChange={onThemeChange}
      />,
    );

    await fireEvent.press(getByText('Oceanic'));
    const firstAlertArgs = (Alert.alert as jest.Mock).mock.calls[0];
    const themeOnlyAction = firstAlertArgs[2][0];

    await act(async () => {
      await themeOnlyAction.onPress();
    });

    expect(mockSetTheme).toHaveBeenCalledWith('oceanic', false);
    expect(onThemeChange).toHaveBeenCalledWith('oceanic');
  });

  it('supports Apply All path and success notification', async () => {
    const onThemeChange = jest.fn();
    const { getByText } = await render(
      <ThemeSelectorWithSettings
        themes={themes}
        onThemeChange={onThemeChange}
      />,
    );

    await fireEvent.press(getByText('Oceanic'));
    const firstAlertArgs = (Alert.alert as jest.Mock).mock.calls[0];
    const applyAllAction = firstAlertArgs[2][1];

    await act(async () => {
      await applyAllAction.onPress();
    });

    expect(mockSetTheme).toHaveBeenCalledWith('oceanic', true);
    expect(onThemeChange).toHaveBeenCalledWith('oceanic');
    expect(Alert.alert).toHaveBeenCalledWith(
      'Settings Applied',
      'Theme and recommended settings have been applied.',
    );
  });

  it('shows error alert when Apply All fails', async () => {
    mockSetTheme.mockRejectedValueOnce(new Error('set theme failed'));
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const { getByText } = await render(
      <ThemeSelectorWithSettings themes={themes} />,
    );

    await fireEvent.press(getByText('Oceanic'));
    const firstAlertArgs = (Alert.alert as jest.Mock).mock.calls[0];
    const applyAllAction = firstAlertArgs[2][1];

    await act(async () => {
      await applyAllAction.onPress();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Failed to apply theme settings.',
    );
    consoleSpy.mockRestore();
  });

  it('renders current-theme recommended-settings info box', async () => {
    const { getByText } = await render(
      <ThemeSelectorWithSettings themes={themes} />,
    );
    expect(
      getByText('Current theme has recommended settings that can be applied.'),
    ).toBeTruthy();
  });

  it('renders grouped section headers (built-in family + Custom)', async () => {
    const { getByText } = await render(
      <ThemeSelectorWithSettings themes={themes} />,
    );
    // 'light' is a known built-in (Originals); 'oceanic' is unknown -> Custom.
    expect(getByText('Originals')).toBeTruthy();
    expect(getByText('Custom')).toBeTruthy();
    // Rows still render their names and the recommended badge.
    expect(getByText('Light')).toBeTruthy();
    expect(getByText('Oceanic')).toBeTruthy();
    expect(getByText('Recommended settings available')).toBeTruthy();
  });

  it('shows light/dark mode chips based on background luminance', async () => {
    const { getByText } = await render(
      <ThemeSelectorWithSettings themes={themes} />,
    );
    // Chip text is upper-cased and distinct from the theme names.
    expect(getByText('LIGHT')).toBeTruthy();
    expect(getByText('DARK')).toBeTruthy();
  });
});

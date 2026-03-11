import React from 'react';
import { ScrollView } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import { ChannelTabs } from '../../src/components/ChannelTabs';

const mockGetAlwaysEncrypt = jest.fn();
const mockOnAlwaysEncryptChange = jest.fn();
const mockGetSetting = jest.fn();
const mockOnSettingChange = jest.fn();

jest.mock('../../src/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      surface: '#111',
      tabBorder: '#222',
      tabInactive: '#111',
      tabActive: '#333',
      surfaceVariant: '#222',
      tabInactiveText: '#aaa',
      tabActiveText: '#fff',
      warning: '#ff0',
    },
  }),
}));

jest.mock('../../src/services/ChannelEncryptionSettingsService', () => ({
  channelEncryptionSettingsService: {
    getAlwaysEncrypt: (...args: unknown[]) => mockGetAlwaysEncrypt(...args),
    onAlwaysEncryptChange: (...args: unknown[]) => mockOnAlwaysEncryptChange(...args),
  },
}));

jest.mock('../../src/services/SettingsService', () => ({
  NEW_FEATURE_DEFAULTS: {
    channelListScrollSwitchTabs: false,
    channelListScrollSwitchTabsInverse: false,
  },
  settingsService: {
    getSetting: (...args: unknown[]) => mockGetSetting(...args),
    onSettingChange: (...args: unknown[]) => mockOnSettingChange(...args),
  },
}));

describe('ChannelTabs', () => {
  let settingChangeHandlers: Record<string, (value: boolean) => void>;

  beforeEach(() => {
    jest.clearAllMocks();
    settingChangeHandlers = {};
    mockGetAlwaysEncrypt.mockResolvedValue(false);
    mockOnAlwaysEncryptChange.mockImplementation(() => () => {});
    mockGetSetting.mockImplementation((key: string, def: any) => Promise.resolve(def));
    mockOnSettingChange.mockImplementation((key: string, handler: (value: boolean) => void) => {
      settingChangeHandlers[key] = handler;
      return () => {};
    });
  });

  it('renders tabs and handles press/long press', async () => {
    const onTabPress = jest.fn();
    const onTabLongPress = jest.fn();

    const tabs = [
      { id: '1', name: '#general', type: 'channel', networkId: 'n1', isEncrypted: false },
      { id: '2', name: 'alice', type: 'query', networkId: 'n1', isEncrypted: true, hasActivity: true },
    ] as any;

    const { getByText } = render(
      <ChannelTabs
        tabs={tabs}
        activeTabId="1"
        onTabPress={onTabPress}
        onTabLongPress={onTabLongPress}
      />
    );

    await act(async () => {});

    fireEvent.press(getByText('#general'));
    fireEvent(getByText('alice'), 'longPress');

    expect(onTabPress).toHaveBeenCalledWith('1');
    expect(onTabLongPress).toHaveBeenCalledWith(tabs[1]);
    expect(getByText('🔓')).toBeTruthy();
    expect(getByText('🔒')).toBeTruthy();
  });

  it('shows always-encrypt indicator when enabled', async () => {
    mockGetAlwaysEncrypt.mockResolvedValueOnce(true);

    const tabs = [{ id: '1', name: '#general', type: 'channel', networkId: 'n1', isEncrypted: false }] as any;

    const { getByText } = render(
      <ChannelTabs
        tabs={tabs}
        activeTabId="1"
        onTabPress={jest.fn()}
        onTabLongPress={jest.fn()}
      />
    );

    await act(async () => {});
    expect(getByText('🔐')).toBeTruthy();
  });

  it('switches tab on scroll when enabled', async () => {
    mockGetSetting.mockImplementation((key: string) => {
      if (key === 'channelListScrollSwitchTabs') return Promise.resolve(true);
      if (key === 'channelListScrollSwitchTabsInverse') return Promise.resolve(false);
      return Promise.resolve(false);
    });

    const onTabPress = jest.fn();
    const tabs = [
      { id: '1', name: '#a', type: 'channel', networkId: 'n1' },
      { id: '2', name: '#b', type: 'channel', networkId: 'n1' },
    ] as any;

    const { UNSAFE_getByType } = render(
      <ChannelTabs tabs={tabs} activeTabId="1" onTabPress={onTabPress} onTabLongPress={jest.fn()} />
    );

    await act(async () => {});

    const scroll = UNSAFE_getByType(ScrollView);
    fireEvent.scroll(scroll, { nativeEvent: { contentOffset: { x: 40, y: 0 } } });

    expect(onTabPress).toHaveBeenCalledWith('2');
  });

  it('supports inverse scroll switching and always-encrypt change updates', async () => {
    let changeHandler: ((channel: string, network: string) => Promise<void>) | undefined;

    mockGetSetting.mockImplementation((key: string) => {
      if (key === 'channelListScrollSwitchTabs') return Promise.resolve(true);
      if (key === 'channelListScrollSwitchTabsInverse') return Promise.resolve(true);
      return Promise.resolve(false);
    });
    mockOnAlwaysEncryptChange.mockImplementation((handler: typeof changeHandler) => {
      changeHandler = handler as any;
      return () => {};
    });
    mockGetAlwaysEncrypt
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    const onTabPress = jest.fn();
    const tabs = [
      { id: '1', name: '#a', type: 'channel', networkId: 'n1', isEncrypted: false },
      { id: '2', name: '#b', type: 'channel', networkId: 'n1', isEncrypted: false },
    ] as any;

    const { UNSAFE_getByType, getAllByText } = render(
      <ChannelTabs tabs={tabs} activeTabId="2" onTabPress={onTabPress} onTabLongPress={jest.fn()} position="left" />
    );

    await act(async () => {});
    expect(getAllByText('🔓')).toHaveLength(2);

    await act(async () => {
      await changeHandler?.('#a', 'n1');
    });
    expect(getAllByText('🔐')).toHaveLength(1);

    const scroll = UNSAFE_getByType(ScrollView);
    fireEvent.scroll(scroll, { nativeEvent: { contentOffset: { x: 0, y: 40 } } });

    expect(onTabPress).toHaveBeenCalledWith('1');
  });

  it('skips encryption icons when indicators are disabled', async () => {
    const tabs = [{ id: '1', name: 'alice', type: 'query', networkId: 'n1', isEncrypted: true }] as any;

    const { queryByText } = render(
      <ChannelTabs
        tabs={tabs}
        activeTabId="1"
        onTabPress={jest.fn()}
        onTabLongPress={jest.fn()}
        showEncryptionIndicators={false}
      />
    );

    await act(async () => {});
    expect(queryByText('🔒')).toBeNull();
    expect(queryByText('🔐')).toBeNull();
  });

  it('reacts to runtime settings changes for tab switching', async () => {
    const onTabPress = jest.fn();
    const tabs = [
      { id: '1', name: '#a', type: 'channel', networkId: 'n1' },
      { id: '2', name: '#b', type: 'channel', networkId: 'n1' },
    ] as any;

    const { UNSAFE_getByType } = render(
      <ChannelTabs tabs={tabs} activeTabId="1" onTabPress={onTabPress} onTabLongPress={jest.fn()} />
    );

    await act(async () => {});

    const scroll = UNSAFE_getByType(ScrollView);

    await act(async () => {
      settingChangeHandlers.channelListScrollSwitchTabs?.(true);
      settingChangeHandlers.channelListScrollSwitchTabsInverse?.(false);
    });
    fireEvent.scroll(scroll, { nativeEvent: { contentOffset: { x: 50, y: 0 } } });

    await act(async () => {
      settingChangeHandlers.channelListScrollSwitchTabsInverse?.(true);
    });
    fireEvent.scroll(scroll, { nativeEvent: { contentOffset: { x: 0, y: 0 } } });

    expect(onTabPress).toHaveBeenCalledWith('2');
  });
});

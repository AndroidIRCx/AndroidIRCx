import React from 'react';
import { render } from '@testing-library/react-native';
import { AppModals } from '../../src/components/AppModals';

const mockOptionsMenu = jest.fn(() => null);
const mockJoinChannelModal = jest.fn(() => null);
const mockNetworksListScreen = jest.fn(() => null);
const mockSettingsScreen = jest.fn(() => null);
const mockPurchaseScreen = jest.fn(() => null);
const mockIgnoreListScreen = jest.fn(() => null);
const mockBlacklistScreen = jest.fn(() => null);
const mockUserListsScreen = jest.fn(() => null);
const mockWHOISDisplay = jest.fn(() => null);
const mockQueryEncryptionMenu = jest.fn(() => null);
const mockChannelListScreen = jest.fn(() => null);
const mockChannelNoteModal = jest.fn(() => null);
const mockChannelLogModal = jest.fn(() => null);
const mockRenameModal = jest.fn(() => null);
const mockTabOptionsModal = jest.fn(() => null);
const mockChannelSettingsScreen = jest.fn(() => null);
const mockDccTransfersModal = jest.fn(() => null);
const mockDccTransfersMinimizedIndicator = jest.fn(() => null);
const mockDccSendModal = jest.fn(() => null);
const mockAppUnlockModal = jest.fn(() => null);
const mockWebRTCCallModal = jest.fn(() => null);
const mockHelpTroubleshootingScreen = jest.fn(() => null);
const mockHelpConnectionScreen = jest.fn(() => null);
const mockHelpCommandsScreen = jest.fn(() => null);
const mockHelpEncryptionScreen = jest.fn(() => null);
const mockHelpMediaScreen = jest.fn(() => null);
const mockHelpChannelManagementScreen = jest.fn(() => null);
const mockFirstRunSetupScreen = jest.fn(() => null);

const mockUseUIState = jest.fn();
const mockUseStoreSetters = jest.fn();
const mockUseUIStore = jest.fn();
const mockUseTabStoreGetState = jest.fn();
const mockGetConnection = jest.fn();
const mockChannelNotesSetNote = jest.fn();
const mockChannelNotesClearLog = jest.fn();
const mockDccAccept = jest.fn();
const mockDccCancel = jest.fn();
const mockDccSendFile = jest.fn();

jest.mock('../../src/hooks/useUIState', () => ({
  useUIState: () => mockUseUIState(),
}));

jest.mock('../../src/hooks/useStoreSetters', () => ({
  useStoreSetters: () => mockUseStoreSetters(),
}));

jest.mock('../../src/stores/uiStore', () => ({
  useUIStore: Object.assign(
    (selector: (state: any) => any) => mockUseUIStore(selector),
    {
      getState: () => mockUseUIStore.getState(),
    },
  ),
}));

jest.mock('../../src/stores/tabStore', () => ({
  useTabStore: {
    getState: () => mockUseTabStoreGetState(),
  },
}));

jest.mock('../../src/services/ConnectionManager', () => ({
  connectionManager: {
    getConnection: (...args: unknown[]) => mockGetConnection(...args),
  },
}));

jest.mock('../../src/services/ChannelNotesService', () => ({
  channelNotesService: {
    setNote: (...args: unknown[]) => mockChannelNotesSetNote(...args),
    clearLog: (...args: unknown[]) => mockChannelNotesClearLog(...args),
  },
}));

jest.mock('../../src/services/DCCFileService', () => ({
  dccFileService: {
    accept: (...args: unknown[]) => mockDccAccept(...args),
    cancel: (...args: unknown[]) => mockDccCancel(...args),
    sendFile: (...args: unknown[]) => mockDccSendFile(...args),
  },
}));

jest.mock('../../src/i18n/transifex', () => ({
  useT: () => (key: string) => key,
}));

jest.mock('../../src/screens/FirstRunSetupScreen', () => ({
  FirstRunSetupScreen: (p: any) => mockFirstRunSetupScreen(p),
}));
jest.mock('../../src/components/OptionsMenu', () => ({
  OptionsMenu: (p: any) => mockOptionsMenu(p),
}));
jest.mock('../../src/components/JoinChannelModal', () => ({
  JoinChannelModal: (p: any) => mockJoinChannelModal(p),
}));
jest.mock('../../src/screens/NetworksListScreen', () => ({
  NetworksListScreen: (p: any) => mockNetworksListScreen(p),
}));
jest.mock('../../src/screens/SettingsScreen', () => ({
  SettingsScreen: (p: any) => mockSettingsScreen(p),
}));
jest.mock('../../src/screens/PurchaseScreen', () => ({
  PurchaseScreen: (p: any) => mockPurchaseScreen(p),
}));
jest.mock('../../src/screens/IgnoreListScreen', () => ({
  IgnoreListScreen: (p: any) => mockIgnoreListScreen(p),
}));
jest.mock('../../src/screens/BlacklistScreen', () => ({
  BlacklistScreen: (p: any) => mockBlacklistScreen(p),
}));
jest.mock('../../src/screens/UserListsScreen', () => ({
  UserListsScreen: (p: any) => mockUserListsScreen(p),
}));
jest.mock('../../src/components/WHOISDisplay', () => ({
  WHOISDisplay: (p: any) => mockWHOISDisplay(p),
}));
jest.mock('../../src/components/QueryEncryptionMenu', () => ({
  QueryEncryptionMenu: (p: any) => mockQueryEncryptionMenu(p),
}));
jest.mock('../../src/screens/ChannelListScreen', () => ({
  ChannelListScreen: (p: any) => mockChannelListScreen(p),
}));
jest.mock('../../src/components/ChannelNoteModal', () => ({
  ChannelNoteModal: (p: any) => mockChannelNoteModal(p),
}));
jest.mock('../../src/components/ChannelLogModal', () => ({
  ChannelLogModal: (p: any) => mockChannelLogModal(p),
}));
jest.mock('../../src/components/RenameModal', () => ({
  RenameModal: (p: any) => mockRenameModal(p),
}));
jest.mock('../../src/components/TabOptionsModal', () => ({
  TabOptionsModal: (p: any) => mockTabOptionsModal(p),
}));
jest.mock('../../src/screens/ChannelSettingsScreen', () => ({
  ChannelSettingsScreen: (p: any) => mockChannelSettingsScreen(p),
}));
jest.mock('../../src/components/DccTransfersModal', () => ({
  DccTransfersModal: (p: any) => mockDccTransfersModal(p),
}));
jest.mock('../../src/components/DccTransfersMinimizedIndicator', () => ({
  DccTransfersMinimizedIndicator: (p: any) =>
    mockDccTransfersMinimizedIndicator(p),
}));
jest.mock('../../src/components/DccSendModal', () => ({
  DccSendModal: (p: any) => mockDccSendModal(p),
}));
jest.mock('../../src/components/AppUnlockModal', () => ({
  AppUnlockModal: (p: any) => mockAppUnlockModal(p),
}));
jest.mock('../../src/components/WebRTCCallModal', () => ({
  WebRTCCallModal: (p: any) => mockWebRTCCallModal(p),
}));
jest.mock('../../src/screens/help/HelpTroubleshootingScreen', () => ({
  HelpTroubleshootingScreen: (p: any) => mockHelpTroubleshootingScreen(p),
}));
jest.mock('../../src/screens/help/HelpConnectionScreen', () => ({
  HelpConnectionScreen: (p: any) => mockHelpConnectionScreen(p),
}));
jest.mock('../../src/screens/help/HelpCommandsScreen', () => ({
  HelpCommandsScreen: (p: any) => mockHelpCommandsScreen(p),
}));
jest.mock('../../src/screens/help/HelpEncryptionScreen', () => ({
  HelpEncryptionScreen: (p: any) => mockHelpEncryptionScreen(p),
}));
jest.mock('../../src/screens/help/HelpMediaScreen', () => ({
  HelpMediaScreen: (p: any) => mockHelpMediaScreen(p),
}));
jest.mock('../../src/screens/help/HelpChannelManagementScreen', () => ({
  HelpChannelManagementScreen: (p: any) => mockHelpChannelManagementScreen(p),
}));

const createUIState = (overrides: Record<string, unknown> = {}) => ({
  showFirstRunSetup: false,
  showChannelModal: false,
  showNetworksList: false,
  showPurchaseScreen: false,
  showIgnoreList: false,
  showBlacklist: false,
  showUserLists: false,
  userListsInitialTab: 'notify',
  showWHOIS: false,
  whoisNick: '',
  showQueryEncryptionMenu: false,
  showChannelList: false,
  showChannelNoteModal: false,
  channelNoteTarget: null,
  channelNoteValue: '',
  showChannelLogModal: false,
  channelLogEntries: [],
  showRenameModal: false,
  renameTargetTabId: null,
  renameValue: '',
  showTabOptionsModal: false,
  tabOptionsTitle: '',
  tabOptions: [],
  showChannelSettings: false,
  channelSettingsTarget: null,
  channelSettingsNetwork: null,
  showDccTransfers: false,
  dccTransfersMinimized: false,
  showDccSendModal: false,
  dccSendTarget: null,
  dccSendPath: '',
  appUnlockModalVisible: false,
  appLockEnabled: false,
  appLockUseBiometric: false,
  appLockUsePin: false,
  appPinEntry: '',
  appPinError: '',
  showHelpConnection: false,
  showHelpCommands: false,
  showHelpEncryption: false,
  showHelpMedia: false,
  showHelpChannelManagement: false,
  showHelpTroubleshooting: false,
  ...overrides,
});

const createSetters = () => ({
  setShowFirstRunSetup: jest.fn(),
  setChannelName: jest.fn(),
  setChannelNoteValue: jest.fn(),
  setRenameValue: jest.fn(),
  setDccSendPath: jest.fn(),
  setAppPinEntry: jest.fn(),
  setAppPinError: jest.fn(),
  setShowOptionsMenu: jest.fn(),
  setShowSettings: jest.fn(),
  setShowHelpConnection: jest.fn(),
  setShowHelpCommands: jest.fn(),
  setShowHelpEncryption: jest.fn(),
  setShowHelpMedia: jest.fn(),
  setShowHelpChannelManagement: jest.fn(),
  setShowHelpTroubleshooting: jest.fn(),
});

const createUIStoreState = () => ({
  setShowChannelModal: jest.fn(),
  setChannelName: jest.fn(),
  setShowNetworksList: jest.fn(),
  setShowPurchaseScreen: jest.fn(),
  setShowIgnoreList: jest.fn(),
  setShowBlacklist: jest.fn(),
  setUserListsInitialTab: jest.fn(),
  setShowUserLists: jest.fn(),
  setShowWHOIS: jest.fn(),
  setWhoisNick: jest.fn(),
  setShowQueryEncryptionMenu: jest.fn(),
  setShowChannelList: jest.fn(),
  setShowChannelNoteModal: jest.fn(),
  setShowChannelLogModal: jest.fn(),
  setChannelLogEntries: jest.fn(),
  setShowRenameModal: jest.fn(),
  setShowTabOptionsModal: jest.fn(),
  setShowChannelSettings: jest.fn(),
  setShowDccTransfers: jest.fn(),
  setDccTransfersMinimized: jest.fn(),
  setShowDccSendModal: jest.fn(),
  setDccSendPath: jest.fn(),
});

const baseProps = {
  activeTab: {
    id: 'chan:1',
    name: '#general',
    type: 'channel',
    networkId: 'net-1',
    messages: [],
  },
  isConnected: true,
  networkName: 'freenode',
  focusedNetworkId: 'net-1',
  showRawCommands: false,
  rawCategoryVisibility: {},
  showEncryptionIndicators: true,
  showTypingIndicators: true,
  tabSortAlphabetical: false,
  dccTransfers: [],
  channelName: '#general',
  handleConnect: jest.fn(),
  handleJoinChannel: jest.fn(),
  handleExit: jest.fn(),
  handleFirstRunSetupComplete: jest.fn(),
  persistentSetShowRawCommands: jest.fn(),
  persistentSetRawCategoryVisibility: jest.fn(),
  persistentSetShowEncryptionIndicators: jest.fn(),
  persistentSetShowTypingIndicators: jest.fn(),
  setActiveConnectionId: jest.fn(),
  setTabs: jest.fn(),
  getActiveIRCService: jest.fn(() => ({ sendRaw: jest.fn() })),
  safeAlert: jest.fn(),
  attemptBiometricUnlock: jest.fn(),
  handleAppPinUnlock: jest.fn(),
  onKillSwitchFromUnlock: jest.fn(),
  killSwitchEnabledOnLockScreen: true,
  styles: { modalOverlay: {}, modalContent: {} },
  colors: { text: '#111' },
};

describe('AppModals', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    const uiStoreState = createUIStoreState();
    mockUseUIStore.mockImplementation((selector: (s: any) => any) =>
      selector({ showOptionsMenu: false, showSettings: false }),
    );
    mockUseUIStore.getState = jest.fn(() => uiStoreState);

    mockUseUIState.mockReturnValue(createUIState());
    mockUseStoreSetters.mockReturnValue(createSetters());
    mockUseTabStoreGetState.mockReturnValue({
      tabs: [],
      setTabs: jest.fn(),
      setActiveTabId: jest.fn(),
    });
    mockGetConnection.mockReturnValue({ ircService: { sendRaw: jest.fn() } });
    mockDccSendFile.mockResolvedValue(undefined);
  });

  it('always renders core modal wrappers', () => {
    render(<AppModals {...baseProps} />);

    expect(mockOptionsMenu).toHaveBeenCalledTimes(1);
    expect(mockSettingsScreen).toHaveBeenCalledTimes(1);
    expect(mockTabOptionsModal).toHaveBeenCalledTimes(1);
    expect(mockAppUnlockModal).toHaveBeenCalledTimes(1);
    expect(mockWebRTCCallModal).toHaveBeenCalledTimes(1);
    expect(mockDccTransfersMinimizedIndicator).toHaveBeenCalledTimes(1);
  });

  it('handles join channel callbacks and resets modal state', () => {
    const uiStoreState = createUIStoreState();
    mockUseUIStore.getState = jest.fn(() => uiStoreState);
    mockUseUIState.mockReturnValue(createUIState({ showChannelModal: true }));

    render(<AppModals {...baseProps} />);

    const props = mockJoinChannelModal.mock.calls[0][0];
    props.onJoin('#android');
    props.onCancel();

    expect(baseProps.handleJoinChannel).toHaveBeenCalledWith('#android');
    expect(uiStoreState.setChannelName).toHaveBeenCalledWith('');
    expect(uiStoreState.setShowChannelModal).toHaveBeenCalledWith(false);
  });

  it('normalizes WHOIS channel join and opens query tab', () => {
    const uiStoreState = createUIStoreState();
    const sendRaw = jest.fn();
    const setTabs = jest.fn();
    const setActiveTabId = jest.fn();

    mockUseUIStore.getState = jest.fn(() => uiStoreState);
    mockUseUIState.mockReturnValue(
      createUIState({ showWHOIS: true, whoisNick: 'Alice' }),
    );
    mockGetConnection.mockReturnValue({ ircService: { sendRaw } });
    mockUseTabStoreGetState.mockReturnValue({
      tabs: [],
      setTabs,
      setActiveTabId,
    });

    render(<AppModals {...baseProps} />);

    const props = mockWHOISDisplay.mock.calls[0][0];
    props.onChannelPress('@#room');
    props.onNickPress('Bob');

    expect(sendRaw).toHaveBeenCalledWith('JOIN #room');
    expect(setTabs).toHaveBeenCalledTimes(1);
    expect(setActiveTabId).toHaveBeenCalledWith('query:net-1:bob');
    expect(uiStoreState.setShowWHOIS).toHaveBeenCalledWith(false);
    expect(uiStoreState.setWhoisNick).toHaveBeenCalledWith('');
  });

  it('handles DCC send success and error path', async () => {
    const uiStoreState = createUIStoreState();
    mockUseUIStore.getState = jest.fn(() => uiStoreState);
    mockUseUIState.mockReturnValue(
      createUIState({
        showDccSendModal: true,
        dccSendTarget: { nick: 'Bob', networkId: 'net-1' },
        dccSendPath: '/tmp/file.txt',
      }),
    );

    render(<AppModals {...baseProps} />);

    const props = mockDccSendModal.mock.calls[0][0];
    await props.onSend();

    expect(mockDccSendFile).toHaveBeenCalledWith(
      expect.anything(),
      'Bob',
      'net-1',
      '/tmp/file.txt',
    );
    expect(uiStoreState.setShowDccSendModal).toHaveBeenCalledWith(false);
    expect(uiStoreState.setDccSendPath).toHaveBeenCalledWith('');

    mockDccSendFile.mockRejectedValueOnce(new Error('send failed'));
    await props.onSend();

    expect(baseProps.safeAlert).toHaveBeenCalled();
  });

  it('renders all help screens and toggles minimized DCC panel', () => {
    const setters = createSetters();
    const uiStoreState = createUIStoreState();

    mockUseStoreSetters.mockReturnValue(setters);
    mockUseUIStore.getState = jest.fn(() => uiStoreState);
    mockUseUIState.mockReturnValue(
      createUIState({
        showHelpConnection: true,
        showHelpCommands: true,
        showHelpEncryption: true,
        showHelpMedia: true,
        showHelpChannelManagement: true,
        showHelpTroubleshooting: true,
        dccTransfersMinimized: true,
      }),
    );

    render(<AppModals {...baseProps} />);

    expect(mockHelpConnectionScreen).toHaveBeenCalledTimes(1);
    expect(mockHelpCommandsScreen).toHaveBeenCalledTimes(1);
    expect(mockHelpEncryptionScreen).toHaveBeenCalledTimes(1);
    expect(mockHelpMediaScreen).toHaveBeenCalledTimes(1);
    expect(mockHelpChannelManagementScreen).toHaveBeenCalledTimes(1);
    expect(mockHelpTroubleshootingScreen).toHaveBeenCalledTimes(1);

    const indicatorProps = mockDccTransfersMinimizedIndicator.mock.calls[0][0];
    indicatorProps.onPress();

    expect(uiStoreState.setDccTransfersMinimized).toHaveBeenCalledWith(false);
    expect(uiStoreState.setShowDccTransfers).toHaveBeenCalledWith(true);
  });

  it('handles first-run setup callbacks and settings launcher callbacks', () => {
    const uiStoreState = createUIStoreState();
    mockUseUIStore.getState = jest.fn(() => uiStoreState);
    mockUseUIState.mockReturnValue(
      createUIState({
        showFirstRunSetup: true,
      }),
    );

    render(<AppModals {...baseProps} />);

    const firstRunProps = mockFirstRunSetupScreen.mock.calls[0][0];
    firstRunProps.onSkip();
    firstRunProps.onComplete({ id: 'net-1' });

    expect(baseProps.handleFirstRunSetupComplete).toHaveBeenCalledWith({
      id: 'net-1',
    });

    const settingsProps = mockSettingsScreen.mock.calls[0][0];
    settingsProps.onShowBlacklist();
    settingsProps.onShowUserLists();
    settingsProps.onShowPurchaseScreen();

    expect(uiStoreState.setShowBlacklist).toHaveBeenCalledWith(true);
    expect(uiStoreState.setUserListsInitialTab).toHaveBeenCalledWith('notify');
    expect(uiStoreState.setShowUserLists).toHaveBeenCalledWith(true);
    expect(uiStoreState.setShowPurchaseScreen).toHaveBeenCalledWith(true);
  });

  it('handles channel note/log and rename flows', async () => {
    const uiStoreState = createUIStoreState();
    mockUseUIStore.getState = jest.fn(() => uiStoreState);
    mockUseUIState.mockReturnValue(
      createUIState({
        showChannelNoteModal: true,
        channelNoteTarget: { networkId: 'net-1', channel: '#general' },
        channelNoteValue: 'remember this',
        showChannelLogModal: true,
        channelLogEntries: [{ id: '1', text: 'x' }],
        showRenameModal: true,
        renameTargetTabId: 'chan:1',
        renameValue: 'new-name',
      }),
    );

    const setTabs = jest.fn();
    render(<AppModals {...baseProps} setTabs={setTabs} />);

    const noteProps = mockChannelNoteModal.mock.calls[0][0];
    await noteProps.onSave();
    expect(mockChannelNotesSetNote).toHaveBeenCalledWith(
      'net-1',
      '#general',
      'remember this',
    );

    const logProps = mockChannelLogModal.mock.calls[0][0];
    await logProps.onClearLog();
    expect(mockChannelNotesClearLog).toHaveBeenCalledWith('net-1', '#general');
    expect(uiStoreState.setChannelLogEntries).toHaveBeenCalledWith([]);

    const renameProps = mockRenameModal.mock.calls[0][0];
    renameProps.onRename();
    const updater = setTabs.mock.calls[0][0];
    const renamed = updater([
      { id: 'chan:1', name: '#general' },
      { id: 'query:1', name: 'alice' },
    ]);
    expect(renamed[0].name).toBe('new-name');
    expect(renamed[1].name).toBe('alice');
  });

  it('handles dcc transfers accept/cancel/minimize callbacks', () => {
    const uiStoreState = createUIStoreState();
    const getActiveIRCService = jest.fn(() => ({ id: 'irc' }));
    mockUseUIStore.getState = jest.fn(() => uiStoreState);
    mockUseUIState.mockReturnValue(
      createUIState({
        showDccTransfers: true,
      }),
    );

    render(
      <AppModals {...baseProps} getActiveIRCService={getActiveIRCService} />,
    );

    const dccProps = mockDccTransfersModal.mock.calls[0][0];
    dccProps.onAccept('tr-1', '/tmp/a.bin');
    dccProps.onCancel('tr-2');
    dccProps.onMinimize();

    expect(mockDccAccept).toHaveBeenCalledWith(
      'tr-1',
      { id: 'irc' },
      '/tmp/a.bin',
    );
    expect(mockDccCancel).toHaveBeenCalledWith('tr-2');
    expect(uiStoreState.setShowDccTransfers).toHaveBeenCalledWith(false);
    expect(uiStoreState.setDccTransfersMinimized).toHaveBeenCalledWith(true);
  });

  it('renders query encryption menu only for active query tab and closes it', () => {
    const uiStoreState = createUIStoreState();
    mockUseUIStore.getState = jest.fn(() => uiStoreState);
    mockUseUIState.mockReturnValue(
      createUIState({
        showQueryEncryptionMenu: true,
      }),
    );

    render(
      <AppModals
        {...baseProps}
        activeTab={{
          id: 'query:1',
          name: 'Alice',
          type: 'query',
          networkId: 'net-1',
          messages: [],
        }}
      />,
    );

    expect(mockQueryEncryptionMenu).toHaveBeenCalledTimes(1);
    const queryProps = mockQueryEncryptionMenu.mock.calls[0][0];
    queryProps.onClose();
    expect(uiStoreState.setShowQueryEncryptionMenu).toHaveBeenCalledWith(false);

    jest.clearAllMocks();
    mockUseUIStore.getState = jest.fn(() => uiStoreState);
    mockUseUIState.mockReturnValue(
      createUIState({ showQueryEncryptionMenu: true }),
    );
    render(
      <AppModals
        {...baseProps}
        activeTab={{
          id: 'chan:1',
          name: '#general',
          type: 'channel',
          networkId: 'net-1',
          messages: [],
        }}
      />,
    );
    expect(mockQueryEncryptionMenu).not.toHaveBeenCalled();
  });

  it('handles channel list and app unlock modal callbacks', () => {
    const uiStoreState = createUIStoreState();
    mockUseUIStore.getState = jest.fn(() => uiStoreState);
    mockUseUIState.mockReturnValue(
      createUIState({
        showChannelList: true,
        appUnlockModalVisible: true,
        appLockEnabled: true,
        appLockUseBiometric: true,
        appLockUsePin: true,
        appPinEntry: '12',
        appPinError: 'bad',
      }),
    );

    const setters = createSetters();
    mockUseStoreSetters.mockReturnValue(setters);

    render(<AppModals {...baseProps} />);

    const channelListProps = mockChannelListScreen.mock.calls[0][0];
    channelListProps.onJoinChannel('#x');
    channelListProps.onClose();
    expect(baseProps.handleJoinChannel).toHaveBeenCalledWith('#x');
    expect(uiStoreState.setShowChannelList).toHaveBeenCalledWith(false);

    const unlockProps = mockAppUnlockModal.mock.calls[0][0];
    expect(unlockProps.visible).toBe(true);
    unlockProps.onChangePinEntry('9999');
    unlockProps.onClearPinError();
    unlockProps.onBiometricUnlock();
    unlockProps.onPinUnlock();
    unlockProps.onKillSwitch();

    expect(setters.setAppPinEntry).toHaveBeenCalledWith('9999');
    expect(setters.setAppPinError).toHaveBeenCalledWith('');
    expect(baseProps.attemptBiometricUnlock).toHaveBeenCalled();
    expect(baseProps.handleAppPinUnlock).toHaveBeenCalledWith('12');
    expect(baseProps.onKillSwitchFromUnlock).toHaveBeenCalled();
  });
});

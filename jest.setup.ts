// Global Jest setup for React Native project to mock native modules used in tests.

jest.mock('@react-native-async-storage/async-storage', () => {
  const asyncStore = new Map<string, string>();
  const mock = {
    getItem: jest.fn(async (key: string) => (asyncStore.has(key) ? asyncStore.get(key)! : null)),
    setItem: jest.fn(async (key: string, value: string) => {
      asyncStore.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      asyncStore.delete(key);
    }),
    clear: jest.fn(async () => {
      asyncStore.clear();
    }),
    __STORE: asyncStore,
    __reset: () => {
      asyncStore.clear();
      mock.getItem.mockClear();
      mock.setItem.mockClear();
      mock.removeItem.mockClear();
      mock.clear.mockClear();
    },
  };
  return mock;
});

jest.mock('react-native-bootsplash', () => ({
  hide: jest.fn(),
  show: jest.fn(),
  setBackgroundColor: jest.fn(),
  setMinimumBackgroundDuration: jest.fn(),
}));

jest.mock('react-native-google-mobile-ads', () => {
  const adapterStatuses = [
    { id: 'dummy', state: 1, latency: 0, initializationState: 'READY' },
  ];
  const mobileAdsFn = () => ({
    initialize: jest.fn().mockResolvedValue(adapterStatuses),
    setRequestConfiguration: jest.fn().mockResolvedValue(undefined),
    openAdInspector: jest.fn().mockResolvedValue(undefined),
  });
  const instance = mobileAdsFn();
  mobileAdsFn.initialize = instance.initialize;
  mobileAdsFn.setRequestConfiguration = instance.setRequestConfiguration;
  mobileAdsFn.openAdInspector = instance.openAdInspector;
  return {
    __esModule: true,
    default: mobileAdsFn,
    MobileAds: mobileAdsFn,
    AdsConsent: {},
    AdapterStatus: { READY: 'READY' },
    AdEventType: { CLOSED: 'CLOSED', OPENED: 'OPENED', ERROR: 'ERROR' },
    RewardedAdEventType: { LOADED: 'LOADED', EARNED_REWARD: 'EARNED_REWARD' },
    RewardedAd: {
      createForAdRequest: jest.fn(() => ({
        load: jest.fn(),
        show: jest.fn(),
        addAdEventListener: jest.fn((event, cb) => {
          if (!cb) return;
          if (event === 'LOADED' || event === 'loaded' || event === 'RewardedAdEventType.LOADED') {
            cb();
          }
          if (event === 'EARNED_REWARD' || event === 'earned_reward') {
            cb({ type: 'EARNED_REWARD', reward: { amount: 1, type: 'test' } });
          }
        }),
      })),
    },
  };
});

jest.mock('./src/services/AdRewardService', () => ({
  adRewardService: {
    initialize: jest.fn().mockResolvedValue(undefined),
    setupRewardedAd: jest.fn(),
    loadAd: jest.fn(),
    addAdEventListener: jest.fn(),
    initialized: true,
  },
}));

jest.mock('@react-native-clipboard/clipboard', () => ({
  setString: jest.fn(),
  getString: jest.fn().mockResolvedValue(''),
  hasString: jest.fn().mockResolvedValue(false),
}));

jest.mock('react-native-fs', () => ({
  downloadFile: jest.fn(() => ({ promise: Promise.resolve({ statusCode: 200 }) })),
  readFile: jest.fn().mockResolvedValue(''),
  exists: jest.fn().mockResolvedValue(false),
  unlink: jest.fn().mockResolvedValue(undefined),
  DocumentDirectoryPath: '/tmp',
}));

jest.mock('react-native-tcp-socket', () => {
  const mockSocket = {
    on: jest.fn(),
    once: jest.fn(),
    write: jest.fn(),
    destroy: jest.fn(),
  };
  return {
    createConnection: jest.fn(() => mockSocket),
    connectTLS: jest.fn(() => mockSocket),
    Socket: jest.fn(() => mockSocket),
    default: {
      createConnection: jest.fn(() => mockSocket),
      connectTLS: jest.fn(() => mockSocket),
    },
  };
});

jest.mock('@notifee/react-native', () => ({
  onForegroundEvent: jest.fn(),
  onBackgroundEvent: jest.fn(),
  displayNotification: jest.fn().mockResolvedValue(undefined),
  cancelAllNotifications: jest.fn().mockResolvedValue(undefined),
  getNotificationSettings: jest.fn().mockResolvedValue({ authorizationStatus: 1 }),
  requestPermission: jest.fn().mockResolvedValue({ authorizationStatus: 1 }),
  setNotificationCategories: jest.fn(),
  createChannel: jest.fn().mockResolvedValue('channel'),
  EventType: {},
  AndroidImportance: {},
  AndroidCategory: {},
  default: {
    onForegroundEvent: jest.fn(),
    onBackgroundEvent: jest.fn(),
    displayNotification: jest.fn().mockResolvedValue(undefined),
    cancelAllNotifications: jest.fn().mockResolvedValue(undefined),
    getNotificationSettings: jest.fn().mockResolvedValue({ authorizationStatus: 1 }),
    requestPermission: jest.fn().mockResolvedValue({ authorizationStatus: 1 }),
    setNotificationCategories: jest.fn(),
    createChannel: jest.fn().mockResolvedValue('channel'),
    EventType: {},
    AndroidImportance: {},
    AndroidCategory: {},
  },
}));

jest.mock('@react-native-firebase/app', () => ({
  getApp: jest.fn(() => ({})),
  default: {},
}));

jest.mock('@react-native-firebase/app-check', () => {
  const appCheckInstance = {
    isSupported: jest.fn(() => true),
    activate: jest.fn(),
    setTokenAutoRefreshEnabled: jest.fn(),
  };
  const appCheckDefault = () => appCheckInstance;
  return {
    __esModule: true,
    default: appCheckDefault,
    GooglePlayIntegrityProviderFactory: jest.fn(() => ({})),
  };
});

jest.mock('@react-native-firebase/crashlytics', () => {
  const mockInstance = {
    log: jest.fn(),
    recordError: jest.fn(),
    setCrashlyticsCollectionEnabled: jest.fn(),
  };
  return () => mockInstance;
});

jest.mock('react-native-libsodium', () => {
  const makeBytes = (len: number, filler = 1) =>
    Uint8Array.from({ length: len }, (_, i) => (filler + i) % 255);
  return {
    ready: Promise.resolve(),
    to_base64: (bytes: Uint8Array) => Buffer.from(bytes).toString('base64'),
    from_base64: (b64: string) => Uint8Array.from(Buffer.from(b64, 'base64')),
    crypto_sign_keypair: () => ({
      publicKey: makeBytes(32, 5),
      privateKey: makeBytes(64, 9),
    }),
    crypto_box_keypair: () => ({
      publicKey: makeBytes(32, 7),
      privateKey: makeBytes(32, 11),
    }),
    crypto_sign_detached: () => makeBytes(64, 13),
    crypto_sign_verify_detached: () => true,
    crypto_generichash: (len: number) => makeBytes(len, 17),
    randombytes_buf: (len: number) => makeBytes(len, 21),
    crypto_aead_xchacha20poly1305_ietf_NPUBBYTES: 24,
    crypto_aead_xchacha20poly1305_ietf_encrypt: (message: Uint8Array) => Uint8Array.from(message),
    crypto_aead_xchacha20poly1305_ietf_decrypt: (_secret: any, cipher: Uint8Array) =>
      Uint8Array.from(cipher),
  };
});

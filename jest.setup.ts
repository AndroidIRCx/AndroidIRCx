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
    multiGet: jest.fn(async (keys: string[]) => {
      return keys.map(key => [key, asyncStore.has(key) ? asyncStore.get(key)! : null]);
    }),
    multiSet: jest.fn(async (pairs: [string, string][]) => {
      pairs.forEach(([key, value]) => asyncStore.set(key, value));
    }),
    multiRemove: jest.fn(async (keys: string[]) => {
      keys.forEach(key => asyncStore.delete(key));
    }),
    getAllKeys: jest.fn(async () => Array.from(asyncStore.keys())),
    __STORE: asyncStore,
    __reset: () => {
      asyncStore.clear();
      mock.getItem.mockClear();
      mock.setItem.mockClear();
      mock.removeItem.mockClear();
      mock.clear.mockClear();
      mock.multiGet.mockClear();
      mock.multiSet.mockClear();
      mock.multiRemove.mockClear();
      mock.getAllKeys.mockClear();
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
    AdsConsent: {
      requestInfoUpdate: jest.fn().mockResolvedValue({ status: 3 }),
      showForm: jest.fn().mockResolvedValue({ status: 3 }),
      loadAndShowConsentFormIfRequired: jest.fn().mockResolvedValue({ status: 3 }),
      reset: jest.fn().mockResolvedValue(undefined),
    },
    AdsConsentStatus: {
      UNKNOWN: 0,
      REQUIRED: 1,
      NOT_REQUIRED: 2,
      OBTAINED: 3,
    },
    AdsConsentDebugGeography: {
      DISABLED: 0,
      EEA: 1,
      NOT_EEA: 2,
    },
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
    to_hex: (bytes: Uint8Array) => Buffer.from(bytes).toString('hex'),
    from_hex: (hex: string) => Uint8Array.from(Buffer.from(hex, 'hex')),
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
    crypto_pwhash_SALTBYTES: 16,
    crypto_pwhash_OPSLIMIT_INTERACTIVE: 2,
    crypto_pwhash_MEMLIMIT_INTERACTIVE: 67108864,
    crypto_pwhash_ALG_ARGON2ID13: 2,
    crypto_secretbox_KEYBYTES: 32,
    crypto_secretbox_NONCEBYTES: 24,
    crypto_pwhash: (keyLen: number) => makeBytes(keyLen, 31),
    crypto_secretbox_easy: (message: Uint8Array) => Uint8Array.from(message),
    crypto_secretbox_open_easy: (cipher: Uint8Array) => Uint8Array.from(cipher),
  };
});

jest.mock('react-native-keychain', () => {
  const keychainStore = new Map<string, any>();
  return {
    setGenericPassword: jest.fn(async (username: string, password: string, options?: any) => {
      const key = options?.service || 'default';
      keychainStore.set(key, { username, password });
      return true;
    }),
    getGenericPassword: jest.fn(async (options?: any) => {
      const key = options?.service || 'default';
      const data = keychainStore.get(key);
      if (!data) return false;
      return {
        username: data.username,
        password: data.password,
        service: key,
      };
    }),
    resetGenericPassword: jest.fn(async (options?: any) => {
      const key = options?.service || 'default';
      keychainStore.delete(key);
      return true;
    }),
    setInternetCredentials: jest.fn(async (server: string, username: string, password: string) => {
      keychainStore.set(`internet:${server}`, { username, password });
      return true;
    }),
    getInternetCredentials: jest.fn(async (server: string) => {
      const data = keychainStore.get(`internet:${server}`);
      if (!data) return false;
      return {
        username: data.username,
        password: data.password,
        server,
      };
    }),
    resetInternetCredentials: jest.fn(async (server: string) => {
      keychainStore.delete(`internet:${server}`);
      return true;
    }),
    getAllGenericPasswordServices: jest.fn(async () => {
      const services: string[] = [];
      keychainStore.forEach((_, key) => {
        if (!key.startsWith('internet:')) {
          services.push(key);
        }
      });
      return services;
    }),
    getAllInternetPasswordServers: jest.fn(async () => {
      const servers: string[] = [];
      keychainStore.forEach((_, key) => {
        if (key.startsWith('internet:')) {
          servers.push(key.substring(9));
        }
      });
      return servers;
    }),
    SECURITY_LEVEL: {
      SECURE_SOFTWARE: 'SECURE_SOFTWARE',
      SECURE_HARDWARE: 'SECURE_HARDWARE',
    },
    ACCESS_CONTROL: {},
    AUTHENTICATION_TYPE: {},
    BIOMETRY_TYPE: {},
    __STORE: keychainStore,
    __reset: () => {
      keychainStore.clear();
    },
  };
});

jest.mock('react-native-qrcode-svg', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: jest.fn(() => React.createElement('View', null, 'QRCode')),
  };
});

jest.mock('react-native-vision-camera', () => ({
  Camera: jest.fn(() => null),
  useCameraDevice: jest.fn(() => null),
  useCameraPermission: jest.fn(() => ({
    hasPermission: false,
    requestPermission: jest.fn(),
  })),
  useCodeScanner: jest.fn(() => ({})),
}));

jest.mock('react-native-share', () => ({
  __esModule: true,
  default: {
    open: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('react-native-nfc-manager', () => ({
  __esModule: true,
  default: {
    start: jest.fn().mockResolvedValue(undefined),
    registerTagEvent: jest.fn().mockResolvedValue(undefined),
    unregisterTagEvent: jest.fn().mockResolvedValue(undefined),
    isSupported: jest.fn().mockResolvedValue(true),
  },
  NfcTech: {},
}));

jest.mock('react-native-localize', () => ({
  getLocales: jest.fn(() => [
    { countryCode: 'US', languageTag: 'en-US', languageCode: 'en', isRTL: false },
  ]),
  getNumberFormatSettings: jest.fn(() => ({
    decimalSeparator: '.',
    groupingSeparator: ',',
  })),
  getCalendar: jest.fn(() => 'gregorian'),
  getCountry: jest.fn(() => 'US'),
  getCurrencies: jest.fn(() => ['USD']),
  getTemperatureUnit: jest.fn(() => 'celsius'),
  getTimeZone: jest.fn(() => 'America/New_York'),
  uses24HourClock: jest.fn(() => false),
  usesMetricSystem: jest.fn(() => false),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  findBestLanguageTag: jest.fn(() => ({ languageTag: 'en-US', isRTL: false })),
}));

jest.mock('react-native-config', () => ({
  __esModule: true,
  default: {
    TRANSIFEX_NATIVE_TOKEN: '',
    TRANSIFEX_CDS_HOST: 'https://cds.svc.transifex.net',
  },
}));

jest.mock('@react-native-documents/picker', () => ({
  __esModule: true,
  pick: jest.fn().mockResolvedValue([]),
  pickDirectory: jest.fn().mockResolvedValue(null),
  isErrorWithCode: jest.fn(() => false),
  errorCodes: {
    OPERATION_CANCELED: 'OPERATION_CANCELED',
    IN_PROGRESS: 'ASYNC_OP_IN_PROGRESS',
    UNABLE_TO_OPEN_FILE_TYPE: 'UNABLE_TO_OPEN_FILE_TYPE',
    NULL_PRESENTER: 'NULL_PRESENTER',
  },
  types: {
    allFiles: '*/*',
    images: 'image/*',
    plainText: 'text/plain',
    audio: 'audio/*',
    pdf: 'application/pdf',
    zip: 'application/zip',
    csv: 'text/csv',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
}));

jest.mock('react-native-vector-icons/FontAwesome5', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: jest.fn(() => React.createElement('Text', null, 'Icon')),
  };
});

jest.mock('react-native-iap', () => ({
  initConnection: jest.fn().mockResolvedValue(true),
  endConnection: jest.fn().mockResolvedValue(undefined),
  getProducts: jest.fn().mockResolvedValue([]),
  getPurchaseHistory: jest.fn().mockResolvedValue([]),
  getAvailablePurchases: jest.fn().mockResolvedValue([]),
  requestPurchase: jest.fn().mockResolvedValue({}),
  finishTransaction: jest.fn().mockResolvedValue(undefined),
  flushFailedPurchasesCachedAsPendingAndroid: jest.fn().mockResolvedValue(undefined),
  purchaseUpdatedListener: jest.fn(() => ({ remove: jest.fn() })),
  purchaseErrorListener: jest.fn(() => ({ remove: jest.fn() })),
  ProductType: {
    inapp: 'inapp',
    subs: 'subs',
  },
}));

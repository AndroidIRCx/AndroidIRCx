/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for useStartupServices hook - Wave 4
 */

import { renderHook } from '@testing-library/react-hooks';
import { useStartupServices } from '../../src/hooks/useStartupServices';

// Track which services were initialized
const initializedServices: string[] = [];

// Mock all service dependencies
jest.mock('react-native', () => ({
  BackHandler: {
    exitApp: jest.fn(),
  },
  DeviceEventEmitter: {
    addListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  },
  Platform: {
    OS: 'android',
  },
}));

jest.mock('react-native-bootsplash', () => ({
  hide: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/services/IRCService', () => ({
  ircService: {},
}));

jest.mock('../../src/services/BackgroundService', () => ({
  backgroundService: {
    initialize: jest.fn().mockImplementation(() => {
      initializedServices.push('backgroundService');
      return Promise.resolve();
    }),
    cleanup: jest.fn().mockImplementation(() => {
      initializedServices.push('backgroundService.cleanup');
    }),
  },
}));

jest.mock('../../src/services/NotificationService', () => ({
  notificationService: {
    initialize: jest.fn().mockImplementation(() => {
      initializedServices.push('notificationService');
      return Promise.resolve();
    }),
  },
}));

jest.mock('../../src/services/ConnectionManager', () => ({
  connectionManager: {
    disconnectAll: jest.fn(),
  },
}));

jest.mock('../../src/services/IRCForegroundService', () => ({
  ircForegroundService: {
    stop: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../src/services/ChannelManagementService', () => ({
  channelManagementService: {
    initialize: jest.fn().mockImplementation(() => {
      initializedServices.push('channelManagementService');
    }),
  },
}));

jest.mock('../../src/services/UserManagementService', () => ({
  userManagementService: {
    setIRCService: jest.fn(),
    initialize: jest.fn().mockImplementation(() => {
      initializedServices.push('userManagementService');
    }),
  },
}));

jest.mock('../../src/services/MessageReactionsService', () => ({
  messageReactionsService: {
    initialize: jest.fn().mockImplementation(() => {
      initializedServices.push('messageReactionsService');
    }),
  },
}));

jest.mock('../../src/services/ChannelFavoritesService', () => ({
  channelFavoritesService: {
    initialize: jest.fn().mockImplementation(() => {
      initializedServices.push('channelFavoritesService');
    }),
  },
}));

jest.mock('../../src/services/AutoRejoinService', () => ({
  autoRejoinService: {
    initialize: jest.fn().mockImplementation(() => {
      initializedServices.push('autoRejoinService');
    }),
  },
}));

jest.mock('../../src/services/AutoVoiceService', () => ({
  autoVoiceService: {
    initialize: jest.fn().mockImplementation(() => {
      initializedServices.push('autoVoiceService');
    }),
  },
}));

jest.mock('../../src/services/ConnectionProfilesService', () => ({
  connectionProfilesService: {
    initialize: jest.fn().mockImplementation(() => {
      initializedServices.push('connectionProfilesService');
    }),
  },
}));

jest.mock('../../src/services/AutoReconnectService', () => ({
  autoReconnectService: {
    initialize: jest.fn().mockImplementation(() => {
      initializedServices.push('autoReconnectService');
    }),
  },
}));

jest.mock('../../src/services/ConnectionQualityService', () => ({
  connectionQualityService: {
    setIRCService: jest.fn(),
    initialize: jest.fn().mockImplementation(() => {
      initializedServices.push('connectionQualityService');
    }),
  },
}));

jest.mock('../../src/services/BouncerService', () => ({
  bouncerService: {
    initialize: jest.fn().mockImplementation(() => {
      initializedServices.push('bouncerService');
    }),
  },
}));

jest.mock('../../src/services/LayoutService', () => ({
  layoutService: {
    initialize: jest.fn().mockImplementation(() => {
      initializedServices.push('layoutService');
    }),
  },
}));

jest.mock('../../src/services/BanService', () => ({
  banService: {
    initialize: jest.fn().mockImplementation(() => {
      initializedServices.push('banService');
    }),
  },
}));

jest.mock('../../src/services/CommandService', () => ({
  commandService: {
    setIRCService: jest.fn(),
    initialize: jest.fn().mockImplementation(() => {
      initializedServices.push('commandService');
    }),
  },
}));

jest.mock('../../src/services/PerformanceService', () => ({
  performanceService: {
    initialize: jest.fn().mockImplementation(() => {
      initializedServices.push('performanceService');
    }),
  },
}));

jest.mock('../../src/services/ThemeService', () => ({
  themeService: {
    initialize: jest.fn().mockImplementation(() => {
      initializedServices.push('themeService');
    }),
  },
}));

jest.mock('../../src/services/ScriptingService', () => ({
  scriptingService: {
    initialize: jest.fn().mockImplementation(() => {
      initializedServices.push('scriptingService');
      return Promise.resolve();
    }),
  },
}));

jest.mock('../../src/services/MessageHistoryBatching', () => ({
  messageHistoryBatching: {
    flushSync: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../src/services/SettingsService', () => ({
  settingsService: {
    getSetting: jest.fn().mockImplementation((key, defaultValue) => Promise.resolve(defaultValue)),
    setSetting: jest.fn().mockResolvedValue(undefined),
  },
  NEW_FEATURE_DEFAULTS: {
    spamPmKeywords: ['spam', 'virus'],
    dccAcceptExts: ['zip', 'txt'],
    dccRejectExts: ['exe', 'dll'],
    dccDontSendExts: ['bat', 'cmd'],
  },
  DEFAULT_QUIT_MESSAGE: 'AndroidIRCX - https://androidircx.app',
}));

jest.mock('../../src/services/AwayService', () => ({
  awayService: {
    initialize: jest.fn().mockImplementation(() => {
      initializedServices.push('awayService');
    }),
  },
}));

jest.mock('../../src/services/ProtectionService', () => ({
  protectionService: {
    initialize: jest.fn().mockImplementation(() => {
      initializedServices.push('protectionService');
    }),
    setProtectedCheckCallback: jest.fn().mockImplementation(() => {
      initializedServices.push('protectionService.setProtectedCheckCallback');
    }),
  },
}));

jest.mock('../../src/services/PresetImportService', () => ({
  presetImportService: {
    initialize: jest.fn().mockImplementation(() => {
      initializedServices.push('presetImportService');
    }),
  },
}));

import { themeService } from '../../src/services/ThemeService';
import { messageReactionsService } from '../../src/services/MessageReactionsService';
import { channelFavoritesService } from '../../src/services/ChannelFavoritesService';
import { autoRejoinService } from '../../src/services/AutoRejoinService';
import { autoVoiceService } from '../../src/services/AutoVoiceService';
import { connectionProfilesService } from '../../src/services/ConnectionProfilesService';
import { autoReconnectService } from '../../src/services/AutoReconnectService';
import { connectionQualityService } from '../../src/services/ConnectionQualityService';
import { bouncerService } from '../../src/services/BouncerService';
import { layoutService } from '../../src/services/LayoutService';
import { banService } from '../../src/services/BanService';
import { commandService } from '../../src/services/CommandService';
import { performanceService } from '../../src/services/PerformanceService';
import { awayService } from '../../src/services/AwayService';
import { protectionService } from '../../src/services/ProtectionService';
import { presetImportService } from '../../src/services/PresetImportService';
import { backgroundService } from '../../src/services/BackgroundService';

describe('useStartupServices', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    initializedServices.length = 0;
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should initialize theme service on mount', () => {
    renderHook(() => useStartupServices());
    expect(themeService.initialize).toHaveBeenCalled();
  });

  it('should initialize message reactions service', () => {
    renderHook(() => useStartupServices());
    expect(messageReactionsService.initialize).toHaveBeenCalled();
  });

  it('should initialize channel favorites service', () => {
    renderHook(() => useStartupServices());
    expect(channelFavoritesService.initialize).toHaveBeenCalled();
  });

  it('should initialize auto rejoin and auto voice services', () => {
    renderHook(() => useStartupServices());
    expect(autoRejoinService.initialize).toHaveBeenCalled();
    expect(autoVoiceService.initialize).toHaveBeenCalled();
  });

  it('should initialize connection profiles service', () => {
    renderHook(() => useStartupServices());
    expect(connectionProfilesService.initialize).toHaveBeenCalled();
  });

  it('should initialize auto reconnect service', () => {
    renderHook(() => useStartupServices());
    expect(autoReconnectService.initialize).toHaveBeenCalled();
  });

  it('should initialize connection quality service', () => {
    renderHook(() => useStartupServices());
    expect(connectionQualityService.setIRCService).toHaveBeenCalled();
    expect(connectionQualityService.initialize).toHaveBeenCalled();
  });

  it('should initialize bouncer service', () => {
    renderHook(() => useStartupServices());
    expect(bouncerService.initialize).toHaveBeenCalled();
  });

  it('should initialize layout service', () => {
    renderHook(() => useStartupServices());
    expect(layoutService.initialize).toHaveBeenCalled();
  });

  it('should initialize ban service', () => {
    renderHook(() => useStartupServices());
    expect(banService.initialize).toHaveBeenCalled();
  });

  it('should initialize command service', () => {
    renderHook(() => useStartupServices());
    expect(commandService.setIRCService).toHaveBeenCalled();
    expect(commandService.initialize).toHaveBeenCalled();
  });

  it('should initialize performance service', () => {
    renderHook(() => useStartupServices());
    expect(performanceService.initialize).toHaveBeenCalled();
  });

  it('should initialize away service', () => {
    renderHook(() => useStartupServices());
    expect(awayService.initialize).toHaveBeenCalled();
  });

  it('should initialize protection service', () => {
    renderHook(() => useStartupServices());
    expect(protectionService.initialize).toHaveBeenCalled();
  });

  it('should initialize preset import service', () => {
    renderHook(() => useStartupServices());
    expect(presetImportService.initialize).toHaveBeenCalled();
  });

  it('should cleanup background service on unmount', () => {
    const { unmount } = renderHook(() => useStartupServices());
    
    unmount();

    expect(backgroundService.cleanup).toHaveBeenCalled();
  });
});

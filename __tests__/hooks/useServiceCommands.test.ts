/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for useServiceCommands hook - Wave 4
 */

import { renderHook, act } from '@testing-library/react-hooks';
import { useServiceCommands, useServicesAvailable, useServiceType } from '../../src/hooks/useServiceCommands';

// Mock dependencies
jest.mock('../../src/interfaces/ServiceTypes', () => ({
  AccessLevel: {
    USER: 'user',
    VOICE: 'voice',
    HALFOP: 'halfop',
    OP: 'op',
    ADMIN: 'admin',
    OWNER: 'owner',
  },
}));

const mockUnsubscribe = jest.fn();
const mockDetectionCallbacks: Array<(networkId: string, result: any) => void> = [];

jest.mock('../../src/services/ServiceDetectionService', () => ({
  serviceDetectionService: {
    getDetectionResult: jest.fn().mockReturnValue(undefined),
    initializeNetwork: jest.fn(),
    onDetection: jest.fn().mockImplementation((cb) => {
      mockDetectionCallbacks.push(cb);
      return mockUnsubscribe;
    }),
    isServiceNick: jest.fn().mockReturnValue(false),
    getServiceByNick: jest.fn().mockReturnValue(undefined),
  },
}));

jest.mock('../../src/services/ServiceCommandProvider', () => ({
  serviceCommandProvider: {
    getCommands: jest.fn().mockReturnValue([]),
    getSafeAliases: jest.fn().mockReturnValue([]),
    getIRCdInfo: jest.fn().mockReturnValue({
      userModes: ['i', 'w', 'o'],
      channelModes: ['n', 't', 's', 'p'],
      operCommands: ['DIE', 'RESTART', 'REHASH'],
    }),
    getSuggestions: jest.fn().mockReturnValue([]),
    findCommand: jest.fn().mockReturnValue(undefined),
    buildCommand: jest.fn().mockReturnValue({ command: '', success: true }),
    parseInput: jest.fn().mockReturnValue({ isServiceCommand: false, args: [] }),
    getCommandHelp: jest.fn().mockReturnValue(undefined),
  },
}));

// Mock tabStore with selector pattern
jest.mock('../../src/stores/tabStore', () => ({
  useTabStore: jest.fn((selector) => selector({ tabs: [] })),
}));

import { serviceDetectionService } from '../../src/services/ServiceDetectionService';
import { serviceCommandProvider } from '../../src/services/ServiceCommandProvider';
import { useTabStore } from '../../src/stores/tabStore';

describe('useServiceCommands', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDetectionCallbacks.length = 0;
    (serviceDetectionService.getDetectionResult as jest.Mock).mockReturnValue(undefined);
  });

  it('should return initial state when no detection result', () => {
    const { result } = renderHook(() =>
      useServiceCommands({ networkId: 'freenode' })
    );

    expect(result.current.isDetected).toBe(false);
    expect(result.current.detectionResult).toBeUndefined();
    expect(result.current.serviceTypeName).toBe('Detecting...');
    expect(result.current.availableCommands).toEqual([]);
    expect(result.current.safeAliases).toEqual([]);
  });

  it('should initialize network on mount', () => {
    renderHook(() => useServiceCommands({ networkId: 'freenode' }));

    expect(serviceDetectionService.initializeNetwork).toHaveBeenCalledWith('freenode');
  });

  it('should not initialize network if detection already exists', () => {
    (serviceDetectionService.getDetectionResult as jest.Mock).mockReturnValue({
      serviceType: 'anope',
      networkId: 'freenode',
      timestamp: Date.now(),
    });
    renderHook(() => useServiceCommands({ networkId: 'freenode' }));
    expect(serviceDetectionService.initializeNetwork).not.toHaveBeenCalled();
  });

  it('should subscribe to detection events', () => {
    renderHook(() => useServiceCommands({ networkId: 'freenode' }));

    expect(serviceDetectionService.onDetection).toHaveBeenCalledWith(expect.any(Function));
  });

  it('should unsubscribe on unmount', () => {
    const { unmount } = renderHook(() => useServiceCommands({ networkId: 'freenode' }));

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('should update when detection result changes', () => {
    const mockDetectionResult = {
      serviceType: 'anope',
      networkId: 'freenode',
      timestamp: Date.now(),
    };

    (serviceDetectionService.getDetectionResult as jest.Mock).mockReturnValue(mockDetectionResult);

    const { result } = renderHook(() => useServiceCommands({ networkId: 'freenode' }));

    expect(result.current.isDetected).toBe(true);
    expect(result.current.detectionResult).toEqual(mockDetectionResult);
    expect(result.current.serviceTypeName).toBe('Anope Services');
  });

  it('updates detection state only for matching network callback events', () => {
    const { result } = renderHook(() => useServiceCommands({ networkId: 'freenode' }));
    expect(result.current.detectionResult).toBeUndefined();

    const incoming = {
      serviceType: 'atheme',
      networkId: 'freenode',
      timestamp: Date.now(),
    };

    act(() => {
      mockDetectionCallbacks[0]('othernet', incoming);
    });
    expect(result.current.detectionResult).toBeUndefined();

    act(() => {
      mockDetectionCallbacks[0]('freenode', incoming);
    });
    expect(result.current.detectionResult).toEqual(incoming);
    expect(result.current.isDetected).toBe(true);
  });

  it('should return service type names correctly', () => {
    const testCases = [
      { type: 'anope', name: 'Anope Services' },
      { type: 'atheme', name: 'Atheme Services' },
      { type: 'dalnet', name: 'DALnet Services' },
      { type: 'undernet', name: 'Undernet X' },
      { type: 'quakenet', name: 'QuakeNet Q' },
      { type: 'generic', name: 'Generic Services' },
      { type: 'unknown', name: 'unknown' },
    ];

    for (const { type, name } of testCases) {
      (serviceDetectionService.getDetectionResult as jest.Mock).mockReturnValue({
        serviceType: type,
        networkId: 'test',
        timestamp: Date.now(),
      });

      const { result } = renderHook(() => useServiceCommands({ networkId: 'test' }));
      expect(result.current.serviceTypeName).toBe(name);
    }
  });

  it('should get suggestions', () => {
    const mockSuggestions = [
      { text: 'REGISTER', description: 'Register a channel' },
    ];
    (serviceCommandProvider.getSuggestions as jest.Mock).mockReturnValue(mockSuggestions);

    const { result } = renderHook(() => useServiceCommands({ networkId: 'freenode' }));

    const suggestions = result.current.getSuggestions('REG');
    expect(serviceCommandProvider.getSuggestions).toHaveBeenCalledWith(
      'freenode',
      'REG',
      expect.any(Object)
    );
    expect(suggestions).toEqual(mockSuggestions);
  });

  it('should find command', () => {
    const mockCommand = {
      command: { name: 'REGISTER', description: 'Register channel' },
      serviceNick: 'ChanServ',
    };
    (serviceCommandProvider.findCommand as jest.Mock).mockReturnValue(mockCommand);

    const { result } = renderHook(() => useServiceCommands({ networkId: 'freenode' }));

    const found = result.current.findCommand('register');
    expect(serviceCommandProvider.findCommand).toHaveBeenCalledWith('freenode', 'register');
    expect(found).toEqual(mockCommand);
  });

  it('should return undefined when command is not found', () => {
    (serviceCommandProvider.findCommand as jest.Mock).mockReturnValue(undefined);
    const { result } = renderHook(() => useServiceCommands({ networkId: 'freenode' }));
    expect(result.current.findCommand('missing')).toBeUndefined();
  });

  it('should build command', () => {
    const mockResult = { command: 'PRIVMSG ChanServ :REGISTER #channel', success: true };
    (serviceCommandProvider.buildCommand as jest.Mock).mockReturnValue(mockResult);

    const { result } = renderHook(() => useServiceCommands({ networkId: 'freenode' }));

    const built = result.current.buildCommand('REGISTER', ['#channel']);
    expect(serviceCommandProvider.buildCommand).toHaveBeenCalledWith(
      'freenode',
      'REGISTER',
      ['#channel']
    );
    expect(built).toEqual(mockResult);
  });

  it('should parse input', () => {
    const mockParseResult = { isServiceCommand: true, serviceNick: 'ChanServ', command: 'REGISTER', args: ['#channel'] };
    (serviceCommandProvider.parseInput as jest.Mock).mockReturnValue(mockParseResult);

    const { result } = renderHook(() => useServiceCommands({ networkId: 'freenode' }));

    const parsed = result.current.parseInput('/cs register #channel');
    expect(serviceCommandProvider.parseInput).toHaveBeenCalledWith('/cs register #channel');
    expect(parsed).toEqual(mockParseResult);
  });

  it('should get command help', () => {
    const helpText = 'REGISTER <channel> [description] - Registers a channel';
    (serviceCommandProvider.getCommandHelp as jest.Mock).mockReturnValue(helpText);

    const { result } = renderHook(() => useServiceCommands({ networkId: 'freenode' }));

    const help = result.current.getCommandHelp('REGISTER');
    expect(serviceCommandProvider.getCommandHelp).toHaveBeenCalledWith('freenode', 'REGISTER');
    expect(help).toBe(helpText);
  });

  it('should check if nick is service', () => {
    (serviceDetectionService.isServiceNick as jest.Mock).mockReturnValue(true);

    const { result } = renderHook(() => useServiceCommands({ networkId: 'freenode' }));

    const isService = result.current.isServiceNick('ChanServ');
    expect(serviceDetectionService.isServiceNick).toHaveBeenCalledWith('ChanServ');
    expect(isService).toBe(true);
  });

  it('should get service by nick', () => {
    const mockService = { nick: 'ChanServ', commands: [] };
    (serviceDetectionService.getServiceByNick as jest.Mock).mockReturnValue(mockService);

    const { result } = renderHook(() => useServiceCommands({ networkId: 'freenode' }));

    const service = result.current.getServiceByNick('ChanServ');
    expect(serviceDetectionService.getServiceByNick).toHaveBeenCalledWith('freenode', 'ChanServ');
    expect(service).toEqual(mockService);
  });

  it('should return empty commands when service has no command list', () => {
    (serviceDetectionService.getServiceByNick as jest.Mock).mockReturnValue({ nick: 'NickServ' });
    const { result } = renderHook(() => useServiceCommands({ networkId: 'freenode' }));
    expect(result.current.getServiceByNick('NickServ')).toEqual({ nick: 'NickServ', commands: [] });
  });

  it('should include channel context from tab store in suggestions', () => {
    (useTabStore as jest.Mock).mockImplementation((selector: any) => selector({
      tabs: [
        { id: '1', type: 'channel', networkId: 'freenode', name: '#a' },
        { id: '2', type: 'channel', networkId: 'other', name: '#b' },
      ],
    }));

    renderHook(() => useServiceCommands({ networkId: 'freenode', currentChannel: '#a' }));
    // trigger suggestions call after render
    const hook = renderHook(() => useServiceCommands({ networkId: 'freenode', currentChannel: '#a' }));
    hook.result.current.getSuggestions('REG');
    const context = (serviceCommandProvider.getSuggestions as jest.Mock).mock.calls.slice(-1)[0][2];
    expect(context.currentChannel).toBe('#a');
    expect(context.availableChannels).toEqual(['#a']);
  });

  it('should return IRCd info', () => {
    const { result } = renderHook(() => useServiceCommands({ networkId: 'freenode' }));

    expect(result.current.userModes).toEqual(['i', 'w', 'o']);
    expect(result.current.channelModes).toEqual(['n', 't', 's', 'p']);
    expect(result.current.operCommands).toEqual(['DIE', 'RESTART', 'REHASH']);
  });
});

describe('useServicesAvailable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (serviceDetectionService.getDetectionResult as jest.Mock).mockReturnValue(undefined);
    mockDetectionCallbacks.length = 0;
  });

  it('should return false when no detection result', () => {
    (serviceDetectionService.getDetectionResult as jest.Mock).mockReturnValue(undefined);

    const { result } = renderHook(() => useServicesAvailable('freenode'));

    expect(result.current).toBe(false);
  });

  it('should return false for generic services', () => {
    (serviceDetectionService.getDetectionResult as jest.Mock).mockReturnValue({
      serviceType: 'generic',
      networkId: 'freenode',
      timestamp: Date.now(),
    });

    const { result } = renderHook(() => useServicesAvailable('freenode'));

    expect(result.current).toBe(false);
  });

  it('should return true for specific services', () => {
    (serviceDetectionService.getDetectionResult as jest.Mock).mockReturnValue({
      serviceType: 'anope',
      networkId: 'freenode',
      timestamp: Date.now(),
    });

    const { result } = renderHook(() => useServicesAvailable('freenode'));

    expect(result.current).toBe(true);
  });

  it('updates only when detection callback matches network', () => {
    const { result } = renderHook(() => useServicesAvailable('freenode'));
    expect(result.current).toBe(false);

    act(() => {
      mockDetectionCallbacks[0]('othernet', { serviceType: 'anope' });
    });
    expect(result.current).toBe(false);

    act(() => {
      mockDetectionCallbacks[0]('freenode', { serviceType: 'anope' });
    });
    expect(result.current).toBe(true);
  });
});

describe('useServiceType', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (serviceDetectionService.getDetectionResult as jest.Mock).mockReturnValue(undefined);
    mockDetectionCallbacks.length = 0;
  });

  it('should return unknown when no detection result', () => {
    (serviceDetectionService.getDetectionResult as jest.Mock).mockReturnValue(undefined);

    const { result } = renderHook(() => useServiceType('freenode'));

    expect(result.current).toBe('unknown');
  });

  it('should return service type when detected', () => {
    (serviceDetectionService.getDetectionResult as jest.Mock).mockReturnValue({
      serviceType: 'atheme',
      networkId: 'freenode',
      timestamp: Date.now(),
    });

    const { result } = renderHook(() => useServiceType('freenode'));

    expect(result.current).toBe('atheme');
  });

  it('updates type only for matching network events', () => {
    const { result } = renderHook(() => useServiceType('freenode'));
    expect(result.current).toBe('unknown');

    act(() => {
      mockDetectionCallbacks[0]('othernet', { serviceType: 'anope' });
    });
    expect(result.current).toBe('unknown');

    act(() => {
      mockDetectionCallbacks[0]('freenode', { serviceType: 'anope' });
    });
    expect(result.current).toBe('anope');
  });
});

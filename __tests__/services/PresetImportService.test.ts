/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for PresetImportService - 100% coverage target
 */

// Define mocks first
const mockGetSetting = jest.fn();
const mockSetSetting = jest.fn();
const mockDecodeMircPresetBase64 = jest.fn();
const mockParseGenericPresets = jest.fn();
const mockParseIrcapDecorationEti = jest.fn();
const mockParseNickCompletionPresets = jest.fn();

// Setup module mocks
jest.mock('../../src/services/SettingsService', () => ({
  settingsService: {
    getSetting: (...args: any[]) => mockGetSetting(...args),
    setSetting: (...args: any[]) => mockSetSetting(...args),
  },
}));

jest.mock('../../src/utils/MircPresetParser', () => ({
  decodeMircPresetBase64: (...args: any[]) =>
    mockDecodeMircPresetBase64(...args),
  parseGenericPresets: (...args: any[]) => mockParseGenericPresets(...args),
  parseIrcapDecorationEti: (...args: any[]) =>
    mockParseIrcapDecorationEti(...args),
  parseNickCompletionPresets: (...args: any[]) =>
    mockParseNickCompletionPresets(...args),
}));

jest.mock('../../src/presets/IRcapPresets', () => ({
  IRCAP_PRESETS_BASE64: {
    awayPresets: 'mock-away-base64',
    textDecorationPresets: 'mock-decoration-base64',
    nickCompletionPresets: 'mock-nick-completion-base64',
    topicPresets: 'mock-topic-base64',
  },
}));

// Import after mocks
import { presetImportService } from '../../src/services/PresetImportService';

describe('PresetImportService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset service state
    (presetImportService as any).initialized = false;
  });

  describe('initialize', () => {
    it('should import all presets on first initialize', async () => {
      mockGetSetting.mockResolvedValue([]);
      mockDecodeMircPresetBase64.mockReturnValue('decoded content');
      mockParseGenericPresets.mockReturnValue([]);
      mockParseIrcapDecorationEti.mockReturnValue([]);
      mockParseNickCompletionPresets.mockReturnValue([]);

      await presetImportService.initialize();

      expect(mockGetSetting).toHaveBeenCalledWith('awayPresets', []);
      expect(mockGetSetting).toHaveBeenCalledWith('decorStyles', []);
      expect(mockGetSetting).toHaveBeenCalledWith('nickCompleteStyles', []);
      expect(mockGetSetting).toHaveBeenCalledWith('topicStyles', []);
    });

    it('should not import presets if already initialized', async () => {
      mockGetSetting.mockResolvedValue([]);
      mockDecodeMircPresetBase64.mockReturnValue('decoded content');
      mockParseGenericPresets.mockReturnValue([]);
      mockParseIrcapDecorationEti.mockReturnValue([]);
      mockParseNickCompletionPresets.mockReturnValue([]);

      await presetImportService.initialize();
      await presetImportService.initialize();

      // Should only be called once per setting type
      expect(mockGetSetting).toHaveBeenCalledTimes(4);
    });
  });

  describe('importAwayPresets', () => {
    it('should import away presets when empty', async () => {
      mockGetSetting.mockResolvedValue([]);
      mockDecodeMircPresetBase64.mockReturnValue('away raw content');
      mockParseGenericPresets.mockReturnValue([
        { id: '1', raw: 'Away preset 1' },
        { id: '2', raw: 'Away preset 2' },
      ]);

      await presetImportService.initialize();

      expect(mockDecodeMircPresetBase64).toHaveBeenCalledWith(
        'mock-away-base64',
      );
      expect(mockParseGenericPresets).toHaveBeenCalledWith('away raw content');
      expect(mockSetSetting).toHaveBeenCalledWith('awayPresets', [
        'Away preset 1',
        'Away preset 2',
      ]);
    });

    it('should not import if presets already exist and do not need reimport', async () => {
      mockGetSetting.mockResolvedValue(['Existing preset']);
      mockDecodeMircPresetBase64.mockReturnValue('away raw content');

      await presetImportService.initialize();

      expect(mockSetSetting).not.toHaveBeenCalledWith(
        'awayPresets',
        expect.anything(),
      );
    });

    it('should reimport if existing presets have corruption markers (ÂÃ�)', async () => {
      mockGetSetting.mockResolvedValue(['Corrupted ÂÃ preset']);
      mockDecodeMircPresetBase64.mockReturnValue('away raw content');
      mockParseGenericPresets.mockReturnValue([
        { id: '1', raw: 'Clean preset' },
      ]);

      await presetImportService.initialize();

      expect(mockSetSetting).toHaveBeenCalledWith('awayPresets', [
        'Clean preset',
      ]);
    });

    it('should reimport if existing presets have on/off suffixes', async () => {
      mockGetSetting.mockResolvedValue(['Preset with on']);
      mockDecodeMircPresetBase64.mockReturnValue('away raw content');
      mockParseGenericPresets.mockReturnValue([
        { id: '1', raw: 'Clean preset' },
      ]);

      await presetImportService.initialize();

      expect(mockSetSetting).toHaveBeenCalledWith('awayPresets', [
        'Clean preset',
      ]);
    });

    it('should not set setting if no presets parsed', async () => {
      mockGetSetting.mockResolvedValue([]);
      mockDecodeMircPresetBase64.mockReturnValue('away raw content');
      mockParseGenericPresets.mockReturnValue([]);

      await presetImportService.initialize();

      expect(mockSetSetting).not.toHaveBeenCalledWith(
        'awayPresets',
        expect.anything(),
      );
    });
  });

  describe('importDecorationPresets', () => {
    it('should merge with existing decoration presets', async () => {
      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'decorStyles') return Promise.resolve(['Existing style']);
        return Promise.resolve([]);
      });
      mockDecodeMircPresetBase64.mockReturnValue('decoration raw content');
      mockParseIrcapDecorationEti.mockReturnValue([
        'New style 1',
        'Existing style',
        'New style 2',
      ]);

      await presetImportService.initialize();

      expect(mockSetSetting).toHaveBeenCalledWith('decorStyles', [
        'Existing style',
        'New style 1',
        'New style 2',
      ]);
    });

    it('should replace existing if needs reimport', async () => {
      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'decorStyles')
          return Promise.resolve(['Corrupted Â style']);
        return Promise.resolve([]);
      });
      mockDecodeMircPresetBase64.mockReturnValue('decoration raw content');
      mockParseIrcapDecorationEti.mockReturnValue(['Style 1', 'Style 2']);

      await presetImportService.initialize();

      expect(mockSetSetting).toHaveBeenCalledWith('decorStyles', [
        'Style 1',
        'Style 2',
      ]);
    });

    it('should not set setting if no presets parsed', async () => {
      mockGetSetting.mockResolvedValue([]);
      mockDecodeMircPresetBase64.mockReturnValue('decoration raw content');
      mockParseIrcapDecorationEti.mockReturnValue([]);

      await presetImportService.initialize();

      const decorCalls = mockSetSetting.mock.calls.filter(
        (call: any[]) => call[0] === 'decorStyles',
      );
      expect(decorCalls).toHaveLength(0);
    });
  });

  describe('importNickCompletionPresets', () => {
    it('should import nick completion presets and set default style', async () => {
      mockGetSetting.mockResolvedValue([]);
      mockDecodeMircPresetBase64.mockReturnValue('nick completion raw content');
      mockParseNickCompletionPresets.mockReturnValue([
        { id: '1', raw: 'Style 1' },
        { id: '2', raw: 'Style 2' },
      ]);

      await presetImportService.initialize();

      expect(mockSetSetting).toHaveBeenCalledWith('nickCompleteStyles', [
        'Style 1',
        'Style 2',
      ]);
      expect(mockSetSetting).toHaveBeenCalledWith(
        'nickCompleteStyleId',
        'Style 1',
      );
    });

    it('should not import if presets exist and valid', async () => {
      mockGetSetting.mockResolvedValue(['Existing style']);
      mockDecodeMircPresetBase64.mockReturnValue('nick completion raw content');

      await presetImportService.initialize();

      expect(mockSetSetting).not.toHaveBeenCalledWith(
        'nickCompleteStyles',
        expect.anything(),
      );
    });

    it('should reimport if presets have corruption markers', async () => {
      mockGetSetting.mockResolvedValue(['Corrupted� preset']);
      mockDecodeMircPresetBase64.mockReturnValue('nick completion raw content');
      mockParseNickCompletionPresets.mockReturnValue([
        { id: '1', raw: 'Clean' },
      ]);

      await presetImportService.initialize();

      expect(mockSetSetting).toHaveBeenCalledWith('nickCompleteStyles', [
        'Clean',
      ]);
    });
  });

  describe('importTopicPresets', () => {
    it('should import topic presets and set default style', async () => {
      mockGetSetting.mockResolvedValue([]);
      mockDecodeMircPresetBase64.mockReturnValue('topic raw content');
      mockParseGenericPresets.mockReturnValue([
        { id: '1', raw: 'Topic style 1' },
        { id: '2', raw: 'Topic style 2' },
      ]);

      await presetImportService.initialize();

      expect(mockSetSetting).toHaveBeenCalledWith('topicStyles', [
        'Topic style 1',
        'Topic style 2',
      ]);
      expect(mockSetSetting).toHaveBeenCalledWith(
        'topicStyleId',
        'Topic style 1',
      );
    });

    it('should not import if presets exist and valid', async () => {
      mockGetSetting.mockResolvedValue(['Existing topic style']);
      mockDecodeMircPresetBase64.mockReturnValue('topic raw content');

      await presetImportService.initialize();

      expect(mockSetSetting).not.toHaveBeenCalledWith(
        'topicStyles',
        expect.anything(),
      );
    });

    it('should reimport if presets have trailing on/off', async () => {
      mockGetSetting.mockResolvedValue(['Style with OFF']);
      mockDecodeMircPresetBase64.mockReturnValue('topic raw content');
      mockParseGenericPresets.mockReturnValue([
        { id: '1', raw: 'Clean topic' },
      ]);

      await presetImportService.initialize();

      expect(mockSetSetting).toHaveBeenCalledWith('topicStyles', [
        'Clean topic',
      ]);
    });
  });

  describe('needsReimport', () => {
    it('should detect corruption markers', async () => {
      mockGetSetting.mockResolvedValue(['Preset with Â character']);
      mockDecodeMircPresetBase64.mockReturnValue('content');
      mockParseGenericPresets.mockReturnValue([{ id: '1', raw: 'Clean' }]);

      await presetImportService.initialize();

      expect(mockSetSetting).toHaveBeenCalled();
    });

    it('should detect on/off suffixes with spaces', async () => {
      mockGetSetting.mockResolvedValue(['Preset with  on']);
      mockDecodeMircPresetBase64.mockReturnValue('content');
      mockParseGenericPresets.mockReturnValue([{ id: '1', raw: 'Clean' }]);

      await presetImportService.initialize();

      expect(mockSetSetting).toHaveBeenCalled();
    });

    it('should detect off suffix case-insensitively', async () => {
      mockGetSetting.mockResolvedValue(['Preset OFF']);
      mockDecodeMircPresetBase64.mockReturnValue('content');
      mockParseGenericPresets.mockReturnValue([{ id: '1', raw: 'Clean' }]);

      await presetImportService.initialize();

      expect(mockSetSetting).toHaveBeenCalled();
    });
  });
});

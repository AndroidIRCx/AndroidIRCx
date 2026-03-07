/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  handleRENAME,
  renameCommandHandlers,
} from '../../../../src/services/irc/commands/RenameCommandHandlers';

jest.mock('../../../../src/i18n/transifex', () => ({
  tx: { t: (key: string) => key },
}));

describe('RenameCommandHandlers', () => {
  let ctx: any;
  let channelUsersMap: Map<string, Map<string, any>>;

  beforeEach(() => {
    channelUsersMap = new Map();
    ctx = {
      addMessage: jest.fn(),
      emit: jest.fn(),
      getChannelUsers: jest.fn().mockReturnValue(null),
      getAllChannelUsers: jest.fn().mockReturnValue(channelUsersMap),
      getChannelTopicInfo: jest.fn().mockReturnValue(null),
      setChannelTopicInfo: jest.fn(),
    };
  });

  describe('renameCommandHandlers map', () => {
    it('registers RENAME', () => {
      expect(renameCommandHandlers.has('RENAME')).toBe(true);
    });
  });

  describe('handleRENAME', () => {
    it('emits channel-renamed event', () => {
      handleRENAME(ctx, '', ['#old', '#new', 'Merge'], Date.now());
      expect(ctx.emit).toHaveBeenCalledWith('channel-renamed', '#old', '#new', 'Merge');
    });

    it('adds raw message about rename', () => {
      handleRENAME(ctx, '', ['#old', '#new', 'reason'], Date.now());
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'raw', channel: '#old', isRaw: true, rawCategory: 'server' })
      );
    });

    it('adds message without reason when reason empty', () => {
      handleRENAME(ctx, '', ['#old', '#new', ''], Date.now());
      expect(ctx.addMessage).toHaveBeenCalled();
      expect(ctx.emit).toHaveBeenCalledWith('channel-renamed', '#old', '#new', '');
    });

    it('returns early when no oldChannel', () => {
      handleRENAME(ctx, '', ['', '#new'], Date.now());
      expect(ctx.addMessage).not.toHaveBeenCalled();
      expect(ctx.emit).not.toHaveBeenCalled();
    });

    it('returns early when no newChannel', () => {
      handleRENAME(ctx, '', ['#old', ''], Date.now());
      expect(ctx.addMessage).not.toHaveBeenCalled();
      expect(ctx.emit).not.toHaveBeenCalled();
    });

    it('migrates channel users when users exist', () => {
      const usersMap = new Map([['nick', { nick: 'nick' }]]);
      ctx.getChannelUsers = jest.fn().mockReturnValue(usersMap);
      handleRENAME(ctx, '', ['#old', '#new'], Date.now());
      expect(channelUsersMap.get('#new')).toBe(usersMap);
      expect(channelUsersMap.has('#old')).toBe(false);
    });

    it('does not migrate when no users map', () => {
      ctx.getChannelUsers = jest.fn().mockReturnValue(null);
      handleRENAME(ctx, '', ['#old', '#new'], Date.now());
      expect(ctx.getAllChannelUsers).not.toHaveBeenCalled();
    });

    it('migrates topic info when topic exists', () => {
      const topicInfo = { topic: 'Old topic', setBy: 'nick' };
      ctx.getChannelTopicInfo = jest.fn().mockReturnValue(topicInfo);
      handleRENAME(ctx, '', ['#old', '#new'], Date.now());
      expect(ctx.setChannelTopicInfo).toHaveBeenCalledWith('#new', topicInfo);
      expect(ctx.setChannelTopicInfo).toHaveBeenCalledWith('#old', {});
    });

    it('does not migrate topic when no topic info', () => {
      ctx.getChannelTopicInfo = jest.fn().mockReturnValue(null);
      handleRENAME(ctx, '', ['#old', '#new'], Date.now());
      expect(ctx.setChannelTopicInfo).not.toHaveBeenCalled();
    });

    it('handles params without reason', () => {
      handleRENAME(ctx, '', ['#old', '#new'], Date.now());
      expect(ctx.emit).toHaveBeenCalledWith('channel-renamed', '#old', '#new', '');
    });
  });
});

/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  handleTOPIC,
  handleMODE,
  topicModeCommandHandlers,
} from '../../../../src/services/irc/commands/TopicModeCommandHandlers';

jest.mock('../../../../src/i18n/transifex', () => ({
  tx: {
    t: (key: string, params?: Record<string, unknown>) => {
      if (!params) return key;
      return Object.entries(params).reduce(
        (acc, [paramKey, value]) => acc.replace(`{${paramKey}}`, String(value)),
        key,
      );
    },
  },
}));

describe('TopicModeCommandHandlers', () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      addMessage: jest.fn(),
      emit: jest.fn(),
      extractNick: jest.fn((prefix: string) => prefix.split('!')[0]),
      getCurrentNick: jest.fn().mockReturnValue('MyNick'),
      getChannelTopicInfo: jest.fn().mockReturnValue(null),
      setChannelTopicInfo: jest.fn(),
      maybeEmitChannelIntro: jest.fn(),
      handleChannelModeChange: jest.fn(),
      updateSelfUserModes: jest.fn(),
    };
  });

  describe('topicModeCommandHandlers map', () => {
    it('registers TOPIC', () => {
      expect(topicModeCommandHandlers.has('TOPIC')).toBe(true);
    });

    it('registers MODE', () => {
      expect(topicModeCommandHandlers.has('MODE')).toBe(true);
    });
  });

  describe('handleTOPIC', () => {
    it('emits topic event with channel, topic, setBy', () => {
      handleTOPIC(ctx, 'nick!user@host', ['#general', 'New topic here'], Date.now());
      expect(ctx.emit).toHaveBeenCalledWith('topic', '#general', 'New topic here', 'nick');
    });

    it('adds topic message', () => {
      handleTOPIC(ctx, 'nick!user@host', ['#general', 'New topic'], Date.now());
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'topic', channel: '#general', from: 'nick' })
      );
    });

    it('sets channel topic info', () => {
      const ts = Date.now();
      handleTOPIC(ctx, 'nick!user@host', ['#general', 'New topic'], ts);
      expect(ctx.setChannelTopicInfo).toHaveBeenCalledWith(
        '#general',
        expect.objectContaining({ topic: 'New topic', setBy: 'nick' })
      );
    });

    it('calls maybeEmitChannelIntro when channel provided', () => {
      handleTOPIC(ctx, 'nick!user@host', ['#general', 'topic'], Date.now());
      expect(ctx.maybeEmitChannelIntro).toHaveBeenCalledWith('#general', expect.any(Number));
    });

    it('merges with existing topic info', () => {
      ctx.getChannelTopicInfo = jest.fn().mockReturnValue({ modes: '+m' });
      handleTOPIC(ctx, 'nick!user@host', ['#general', 'new topic'], Date.now());
      expect(ctx.setChannelTopicInfo).toHaveBeenCalledWith(
        '#general',
        expect.objectContaining({ modes: '+m', topic: 'new topic' })
      );
    });

    it('handles empty topic string', () => {
      handleTOPIC(ctx, 'nick!user@host', ['#general', ''], Date.now());
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'topic', topic: '' })
      );
    });

    it('does not call setChannelTopicInfo when no channel', () => {
      handleTOPIC(ctx, 'nick!user@host', ['', 'topic'], Date.now());
      expect(ctx.setChannelTopicInfo).not.toHaveBeenCalled();
    });

    it('extracts nick from prefix', () => {
      ctx.extractNick = jest.fn().mockReturnValue('topicsetter');
      handleTOPIC(ctx, 'topicsetter!user@host', ['#channel', 'topic'], Date.now());
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ from: 'topicsetter' })
      );
    });
  });

  describe('handleMODE', () => {
    it('handles channel mode change', () => {
      handleMODE(ctx, 'oper!oper@host', ['#general', '+m'], Date.now());
      expect(ctx.handleChannelModeChange).toHaveBeenCalledWith('#general', ['+m']);
      expect(ctx.emit).toHaveBeenCalledWith('channelMode', '#general', '+m', []);
    });

    it('adds mode message for channel mode', () => {
      handleMODE(ctx, 'oper!oper@host', ['#general', '+o', 'somenick'], Date.now());
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'mode', channel: '#general' })
      );
    });

    it('handles user mode change for self', () => {
      ctx.getCurrentNick = jest.fn().mockReturnValue('MyNick');
      handleMODE(ctx, 'server', ['MyNick', '+i'], Date.now());
      expect(ctx.updateSelfUserModes).toHaveBeenCalledWith('+i');
    });

    it('adds raw message for user mode change', () => {
      ctx.getCurrentNick = jest.fn().mockReturnValue('MyNick');
      handleMODE(ctx, 'server', ['MyNick', '+i'], Date.now());
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'raw', isRaw: true, rawCategory: 'server' })
      );
    });

    it('does not update self modes for channel mode', () => {
      handleMODE(ctx, 'oper!oper@host', ['#general', '+m'], Date.now());
      expect(ctx.updateSelfUserModes).not.toHaveBeenCalled();
    });

    it('updates topic info when channel mode set', () => {
      ctx.getChannelTopicInfo = jest.fn().mockReturnValue({ topic: 'test' });
      handleMODE(ctx, 'oper!oper@host', ['#general', '+m'], Date.now());
      expect(ctx.setChannelTopicInfo).toHaveBeenCalledWith(
        '#general',
        expect.objectContaining({ modes: '+m' })
      );
    });

    it('handles & channel prefix', () => {
      handleMODE(ctx, 'oper!oper@host', ['&local', '+m'], Date.now());
      expect(ctx.handleChannelModeChange).toHaveBeenCalledWith('&local', ['+m']);
    });

    it('handles + and ! channel prefixes', () => {
      handleMODE(ctx, 'oper!oper@host', ['+modeless', '+m'], Date.now());
      handleMODE(ctx, 'oper!oper@host', ['!safechan', '+m'], Date.now());

      expect(ctx.handleChannelModeChange).toHaveBeenCalledWith('+modeless', ['+m']);
      expect(ctx.handleChannelModeChange).toHaveBeenCalledWith('!safechan', ['+m']);
    });

    it('adds message for mode with mode params', () => {
      handleMODE(ctx, 'oper!oper@host', ['#general', '+o', 'nick'], Date.now());
      const call = ctx.addMessage.mock.calls[0][0];
      // Mode message should be recorded with mode info
      expect(call.mode).toBeDefined();
      expect(call.command).toBe('MODE');
    });

    it('handles MODE with no params', () => {
      handleMODE(ctx, 'server', [], Date.now());
      expect(ctx.addMessage).toHaveBeenCalled();
    });

    it('colorizes added and removed channel privilege/list modes', () => {
      handleMODE(ctx, 'oper!oper@host', ['#general', '+ovhqabeI-k', 'nick', 'other'], Date.now());

      expect(ctx.addMessage).toHaveBeenCalledWith(expect.objectContaining({
        text: expect.stringContaining('\x0304o\x0F'),
      }));
      expect(ctx.addMessage).toHaveBeenCalledWith(expect.objectContaining({
        text: expect.stringContaining('\x0309v\x0F'),
      }));
      expect(ctx.addMessage).toHaveBeenCalledWith(expect.objectContaining({
        text: expect.stringContaining('\x0308h\x0F'),
      }));
      expect(ctx.addMessage).toHaveBeenCalledWith(expect.objectContaining({
        text: expect.stringContaining('\x0306q\x0F'),
      }));
      expect(ctx.addMessage).toHaveBeenCalledWith(expect.objectContaining({
        text: expect.stringContaining('\x0307a\x0F'),
      }));
      expect(ctx.addMessage).toHaveBeenCalledWith(expect.objectContaining({
        text: expect.stringContaining('\x0304b\x0F'),
      }));
      expect(ctx.addMessage).toHaveBeenCalledWith(expect.objectContaining({
        text: expect.stringContaining('\x0307e\x0F'),
      }));
      expect(ctx.addMessage).toHaveBeenCalledWith(expect.objectContaining({
        text: expect.stringContaining('\x0303I\x0F'),
      }));
      expect(ctx.addMessage).toHaveBeenCalledWith(expect.objectContaining({
        text: expect.stringContaining('\x0314-\x0F'),
      }));
      expect(ctx.addMessage).toHaveBeenCalledWith(expect.objectContaining({
        text: expect.stringContaining('\x0314k\x0F'),
      }));
    });

    it('treats empty modeChannel as user mode change without updating self modes', () => {
      handleMODE(ctx, 'server', ['', '+i'], Date.now());

      expect(ctx.updateSelfUserModes).not.toHaveBeenCalled();
      expect(ctx.addMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: 'raw',
        channel: undefined,
      }));
    });
  });
});

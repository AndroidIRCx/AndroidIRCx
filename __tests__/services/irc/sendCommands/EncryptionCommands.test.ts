/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

jest.mock('../../../../src/i18n/transifex', () => ({
  tx: {
    t: (key: string, params?: Record<string, unknown>) => {
      if (!params) return key;
      return Object.entries(params).reduce(
        (acc, [k, v]) => acc.replace(`{${k}}`, String(v)),
        key,
      );
    },
  },
}));

import {
  encryptionCommands,
  handleCHANKEY,
  handleENC,
  handleENCMSG,
  handleREQUESTKEY,
  handleSHAREKEY,
} from '../../../../src/services/irc/sendCommands/EncryptionCommands';

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('EncryptionCommands', () => {
  const createContext = () => {
    const encryptedDMService = {
      exportBundle: jest.fn().mockResolvedValue({ pub: 'bundle' }),
      encryptForNetwork: jest.fn().mockResolvedValue({ box: 'cipher' }),
    };

    const channelEncryptionService = {
      generateChannelKey: jest.fn().mockResolvedValue(undefined),
      encryptMessage: jest.fn().mockResolvedValue({ box: 'chan-cipher' }),
      exportChannelKey: jest.fn().mockResolvedValue('chan-key'),
      removeChannelKey: jest.fn().mockResolvedValue(undefined),
    };

    const ctx = {
      getEncryptedDMService: jest.fn(() => encryptedDMService),
      getChannelEncryptionService: jest.fn(() => channelEncryptionService),
      getNetworkName: jest.fn(() => 'DBase'),
      getCurrentNick: jest.fn(() => 'AndroidIRCX'),
      sendRaw: jest.fn(),
      addMessage: jest.fn(),
    };

    return { ctx: ctx as any, encryptedDMService, channelEncryptionService };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('handles SHAREKEY success and usage error', async () => {
    const { ctx } = createContext();

    handleSHAREKEY(ctx, ['munZe'], '#dbase');
    await flushPromises();

    expect(ctx.sendRaw).toHaveBeenCalledWith(
      expect.stringContaining('PRIVMSG munZe :!enc-offer '),
    );
    expect(ctx.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'system', channel: 'munZe' }),
    );

    handleSHAREKEY(ctx, [], '#dbase');
    expect(ctx.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        text: 'Usage: /sharekey <nick>',
      }),
    );
  });

  it('handles SHAREKEY export error', async () => {
    const { ctx, encryptedDMService } = createContext();
    encryptedDMService.exportBundle.mockRejectedValueOnce(
      new Error('export failed'),
    );

    handleSHAREKEY(ctx, ['munZe'], '#dbase');
    await flushPromises();

    expect(ctx.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        text: expect.stringContaining('Failed to share encryption key'),
      }),
    );
  });

  it('handles REQUESTKEY success and usage error', () => {
    const { ctx } = createContext();

    handleREQUESTKEY(ctx, ['munZe'], '#dbase');
    expect(ctx.sendRaw).toHaveBeenCalledWith('PRIVMSG munZe :!enc-req');
    expect(ctx.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'system', channel: 'munZe' }),
    );

    handleREQUESTKEY(ctx, [], '#dbase');
    expect(ctx.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        text: 'Usage: /requestkey <nick>',
      }),
    );
  });

  it('handles ENCMSG success, failure and usage error', async () => {
    const { ctx, encryptedDMService } = createContext();

    handleENCMSG(ctx, ['munZe', 'hello', 'there'], '#dbase');
    await flushPromises();

    expect(encryptedDMService.encryptForNetwork).toHaveBeenCalledWith(
      'hello there',
      'DBase',
      'munZe',
    );
    expect(ctx.sendRaw).toHaveBeenCalledWith(
      expect.stringContaining('PRIVMSG munZe :!enc-msg '),
    );
    expect(ctx.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'message',
        channel: 'munZe',
        from: 'AndroidIRCX',
        status: 'sent',
      }),
    );

    encryptedDMService.encryptForNetwork.mockRejectedValueOnce(
      new Error('no key'),
    );
    handleENCMSG(ctx, ['munZe', 'again'], '#dbase');
    await flushPromises();

    expect(ctx.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        text: expect.stringContaining('Encrypted send failed'),
      }),
    );

    handleENCMSG(ctx, ['munZe'], '#dbase');
    expect(ctx.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        text: 'Usage: /encmsg <nick> <message>',
      }),
    );
  });

  it('handles ENC help output', () => {
    const { ctx } = createContext();
    handleENC(ctx, [], '#dbase');

    const noticeCalls = (ctx.addMessage as jest.Mock).mock.calls.filter(
      ([msg]) => msg.type === 'notice',
    );
    expect(noticeCalls.length).toBe(5);
    expect(noticeCalls[0][0].text).toContain('DM encryption');
  });

  it('handles CHANKEY help and invalid usage', () => {
    const { ctx } = createContext();

    handleCHANKEY(ctx, [], '#dbase');
    expect(ctx.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        text: 'Usage: /chankey <generate|share|request|remove|send|help> [args]',
      }),
    );

    handleCHANKEY(ctx, ['help'], '#dbase');
    const noticeCalls = (ctx.addMessage as jest.Mock).mock.calls.filter(
      ([msg]) => msg.type === 'notice',
    );
    expect(noticeCalls.length).toBeGreaterThanOrEqual(6);

    handleCHANKEY(ctx, ['unknown'], '#dbase');
    expect(ctx.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        text: 'Usage: /chankey <generate|share|request|remove|send|help> [args]',
      }),
    );
  });

  it('handles CHANKEY generate success, validation and failure', async () => {
    const { ctx, channelEncryptionService } = createContext();

    handleCHANKEY(ctx, ['generate'], 'munZe');
    expect(ctx.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        text: expect.stringContaining('only be generated in a channel'),
      }),
    );

    handleCHANKEY(ctx, ['generate'], '#dbase');
    await flushPromises();
    expect(channelEncryptionService.generateChannelKey).toHaveBeenCalledWith(
      '#dbase',
      'DBase',
    );
    expect(ctx.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'notice' }),
    );

    channelEncryptionService.generateChannelKey.mockRejectedValueOnce(
      new Error('gen fail'),
    );
    handleCHANKEY(ctx, ['generate'], '#dbase');
    await flushPromises();
    expect(ctx.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        text: expect.stringContaining('gen fail'),
      }),
    );
  });

  it('handles CHANKEY send success and errors', async () => {
    const { ctx, channelEncryptionService } = createContext();

    handleCHANKEY(ctx, ['send'], '#dbase');
    expect(ctx.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        text: 'Usage: /chankey send <message>',
      }),
    );

    handleCHANKEY(ctx, ['send', 'hello'], 'munZe');
    expect(ctx.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        text: expect.stringContaining('must be used from a channel'),
      }),
    );

    handleCHANKEY(ctx, ['send', 'hello', 'channel'], '#dbase');
    await flushPromises();
    expect(channelEncryptionService.encryptMessage).toHaveBeenCalledWith(
      'hello channel',
      '#dbase',
      'DBase',
    );
    expect(ctx.sendRaw).toHaveBeenCalledWith(
      expect.stringContaining('PRIVMSG #dbase :!chanenc-msg '),
    );

    channelEncryptionService.encryptMessage.mockRejectedValueOnce(
      new Error('no channel key'),
    );
    handleCHANKEY(ctx, ['send', 'again'], '#dbase');
    await flushPromises();
    expect(ctx.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        text: expect.stringContaining('Missing channel key'),
      }),
    );

    channelEncryptionService.encryptMessage.mockRejectedValueOnce(
      new Error('broken payload'),
    );
    handleCHANKEY(ctx, ['send', 'third'], '#dbase');
    await flushPromises();
    expect(ctx.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        text: expect.stringContaining('broken payload'),
      }),
    );
  });

  it('handles CHANKEY share success and errors', async () => {
    const { ctx, channelEncryptionService } = createContext();

    handleCHANKEY(ctx, ['share'], '#dbase');
    expect(ctx.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        text: 'Usage: /chankey share <nick>',
      }),
    );

    handleCHANKEY(ctx, ['share', 'munZe'], 'munZe');
    expect(ctx.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        text: expect.stringContaining('only be shared from a channel'),
      }),
    );

    handleCHANKEY(ctx, ['share', 'munZe'], '#dbase');
    await flushPromises();
    expect(channelEncryptionService.exportChannelKey).toHaveBeenCalledWith(
      '#dbase',
      'DBase',
    );
    expect(ctx.sendRaw).toHaveBeenCalledWith(
      'PRIVMSG munZe :!chanenc-key chan-key',
    );

    channelEncryptionService.exportChannelKey.mockRejectedValueOnce(
      new Error('no key'),
    );
    handleCHANKEY(ctx, ['share', 'munZe'], '#dbase');
    await flushPromises();
    expect(ctx.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        text: expect.stringContaining('Failed to share channel key'),
      }),
    );
  });

  it('handles CHANKEY request and remove branches', async () => {
    const { ctx, channelEncryptionService } = createContext();

    handleCHANKEY(ctx, ['request'], '#dbase');
    expect(ctx.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        text: 'Usage: /chankey request <nick>',
      }),
    );

    handleCHANKEY(ctx, ['request', 'munZe'], 'munZe');
    expect(ctx.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        text: expect.stringContaining('must be done from a channel'),
      }),
    );

    handleCHANKEY(ctx, ['request', 'munZe'], '#dbase');
    expect(ctx.sendRaw).toHaveBeenCalledWith(
      expect.stringContaining(
        'PRIVMSG munZe :Please share the channel key for #dbase',
      ),
    );

    handleCHANKEY(ctx, ['remove'], 'munZe');
    expect(ctx.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        text: expect.stringContaining('only be removed from a channel'),
      }),
    );

    handleCHANKEY(ctx, ['remove'], '#dbase');
    await flushPromises();
    expect(channelEncryptionService.removeChannelKey).toHaveBeenCalledWith(
      '#dbase',
      'DBase',
    );

    channelEncryptionService.removeChannelKey.mockRejectedValueOnce(
      new Error('remove fail'),
    );
    handleCHANKEY(ctx, ['remove'], '#dbase');
    await flushPromises();
    expect(ctx.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        text: expect.stringContaining('remove fail'),
      }),
    );
  });

  it('registers encryption command aliases', () => {
    expect(encryptionCommands.get('SHAREKEY')).toBe(handleSHAREKEY);
    expect(encryptionCommands.get('SENDKEY')).toBe(handleSHAREKEY);
    expect(encryptionCommands.get('REQUESTKEY')).toBe(handleREQUESTKEY);
    expect(encryptionCommands.get('ENCMSG')).toBe(handleENCMSG);
    expect(encryptionCommands.get('ENC')).toBe(handleENC);
    expect(encryptionCommands.get('ENCRYPT')).toBe(handleENC);
    expect(encryptionCommands.get('CHANKEY')).toBe(handleCHANKEY);
  });
});

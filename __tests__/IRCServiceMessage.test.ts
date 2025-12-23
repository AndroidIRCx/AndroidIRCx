import { ircService } from '../src/services/IRCService';

describe('IRCService handleIRCMessage basics', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('responds to PING with PONG', () => {
    const sendRawSpy = jest.spyOn(ircService as any, 'sendRaw').mockImplementation(() => {});
    (ircService as any).handleIRCMessage('PING :server.example');

    expect(sendRawSpy).toHaveBeenCalledWith('PONG :server.example');
  });

  it('applies server-time tag when parsing PRIVMSG', () => {
    const addMessageSpy = jest.spyOn(ircService as any, 'addMessage').mockImplementation(() => {});
    const ts = '2024-01-01T12:00:00.123Z';
    const line = `@time=${ts} :nick!user@host PRIVMSG #chan :hello there`;

    (ircService as any).handleIRCMessage(line);

    expect(addMessageSpy).toHaveBeenCalled();
    const call = addMessageSpy.mock.calls.find(c => c[0]?.type === 'message');
    expect(call).toBeDefined();
    const messageArg = call?.[0];
    expect(messageArg.timestamp).toBeGreaterThan(0);
    expect(messageArg.channel).toBe('#chan');
    expect(messageArg.text).toContain('hello there');
  });
});

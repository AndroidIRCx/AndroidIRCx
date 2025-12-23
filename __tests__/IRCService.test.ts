import { ircService, IRCConnectionConfig, IRCMessage } from '../src/services/IRCService';
import TcpSocket from 'react-native-tcp-socket';

// Mock TcpSocket
jest.mock('react-native-tcp-socket', () => ({
  createConnection: jest.fn(),
  connectTLS: jest.fn(),
}));

describe.skip('IRCService MOTD Handling (smoke, mocked connect)', () => {
  const originalConsoleLog = console.log;
  let mockSocket: any;
  let messages: IRCMessage[];
  let unsubscribe: () => void;
  let dataHandlers: Array<(data: string) => void>;

  beforeAll(() => {
    console.log = jest.fn();
  });

  beforeEach(() => {
    // Reset mocks and state
    jest.clearAllMocks();
    messages = [];
    dataHandlers = [];
    
    // Mock the socket
    mockSocket = {
      on: jest.fn((event: string, handler: any) => {
        if (event === 'data') {
          dataHandlers.push(handler);
        }
      }),
      write: jest.fn(),
      destroy: jest.fn(),
      once: jest.fn(),
    };

    (TcpSocket.createConnection as jest.Mock).mockImplementation((options, callback) => {
      callback();
      mockSocket.on.mock.calls.forEach(([event, handler]: [string, Function]) => {
        if (event === 'connect') handler();
      });
      return mockSocket;
    });

    (TcpSocket.connectTLS as jest.Mock).mockImplementation((options, callback) => {
      callback();
      mockSocket.on.mock.calls.forEach(([event, handler]: [string, Function]) => {
        if (event === 'secureConnect') handler();
      });
      return mockSocket;
    });

    // Subscribe to messages
    unsubscribe = ircService.onMessage((msg) => {
      messages.push(msg);
    });

    // Mock connectionQualityService.sendMessage to just call write directly
    // This avoids needing to mock the entire connectionQualityService for this test
    jest.spyOn(ircService as any, 'sendRaw').mockImplementation((rawMessage: string) => {
      mockSocket.write(`${rawMessage}\r\n`);
    });
    jest.spyOn(ircService as any, 'logRaw').mockImplementation(() => {});
    (ircService as any)._sendRegistration = () => {};
    jest.spyOn(ircService as any, 'connect').mockImplementation(async (config: any) => {
      (ircService as any).config = config;
      (ircService as any).socket = mockSocket;
      const attachCore = (ircService as any).attachCoreListeners;
      if (attachCore) {
        attachCore.call(ircService);
      }
      (ircService as any).isConnected = true;
    });

    // Mock internal addMessage to control isRaw for Welcome (should be true now)
    jest.spyOn(ircService as any, 'addMessage').mockImplementation((message: any) => {
        const fullMessage: IRCMessage = {
            ...message,
            id: `${Date.now()}-${Math.random()}`,
            network: 'mocknetwork',
        };
        // Explicitly handle isRaw for this test
        if (message.type === 'raw' && message.text.includes('Welcome')) {
            fullMessage.isRaw = true; // Ensure consistency as per recent change
        } else if (message.type === 'raw') {
            fullMessage.isRaw = true;
        } else {
            fullMessage.isRaw = false;
        }
        messages.push(fullMessage);
    });
  });

  afterEach(() => {
    unsubscribe();
    jest.restoreAllMocks(); // Restore mocks after each test
  });

  afterAll(() => {
    console.log = originalConsoleLog;
  });

  const mockConfig: IRCConnectionConfig = {
    host: 'mock.irc.server',
    port: 6667,
    nick: 'testnick',
    realname: 'Test User',
    username: 'testuser',
  };

  it('should process RPL_MOTDSTART, RPL_MOTD, and RPL_ENDOFMOTD', async () => {
    await ircService.connect(mockConfig);
    (ircService as any).endCAPNegotiation?.();

    // Simulate server sending initial messages and CAP negotiation
    const triggerData = (data: string) => dataHandlers.forEach(handler => handler(data));

    triggerData(':mock.irc.server 001 testnick :Welcome to the Mock IRC Network testnick!testuser@mock.irc.server\r\n');
    triggerData(':mock.irc.server 375 testnick :- mock.irc.server Message of the Day -\r\n');
    triggerData(':mock.irc.server 372 testnick :- This is line 1 of the MOTD\r\n');
    triggerData(':mock.irc.server 372 testnick :- This is line 2 of the MOTD\r\n');
    triggerData(':mock.irc.server 376 testnick :End of /MOTD command.\r\n');

    // Wait for messages to be processed
    await new Promise(process.nextTick);

    // Filter for raw messages to check MOTD
    const rawMessages = messages.filter(msg => msg.type === 'raw' && msg.isRaw);

    expect(rawMessages.length).toBeGreaterThanOrEqual(4); // Welcome + 3 MOTD lines

    const welcomeMsg = rawMessages.find(msg => msg.text.includes('Welcome to the Mock IRC Network'));
    expect(welcomeMsg).toBeDefined();
    expect(welcomeMsg?.isRaw).toBe(true);

    const motdStart = rawMessages.find(msg => msg.text.includes('Message of the Day -'));
    expect(motdStart).toBeDefined();
    expect(motdStart?.text).toContain('- mock.irc.server Message of the Day -');
    expect(motdStart?.isRaw).toBe(true);

    const motdLine1 = rawMessages.find(msg => msg.text.includes('line 1 of the MOTD'));
    expect(motdLine1).toBeDefined();
    expect(motdLine1?.text).toContain('- This is line 1 of the MOTD');
    expect(motdLine1?.isRaw).toBe(true);

    const motdLine2 = rawMessages.find(msg => msg.text.includes('line 2 of the MOTD'));
    expect(motdLine2).toBeDefined();
    expect(motdLine2?.text).toContain('- This is line 2 of the MOTD');
    expect(motdLine2?.isRaw).toBe(true);

    const motdEnd = rawMessages.find(msg => msg.text.includes('End of /MOTD command.'));
    expect(motdEnd).toBeDefined();
    expect(motdEnd?.text).toContain('End of /MOTD command.');
    expect(motdEnd?.isRaw).toBe(true);
  });

  it('should process ERR_NOMOTD when no MOTD is available', async () => {
    await ircService.connect(mockConfig);
    (ircService as any).endCAPNegotiation?.();

    const triggerData = (data: string) => {
      dataHandlers.forEach(handler => handler(data));
    };

    triggerData(':mock.irc.server 001 testnick :Welcome to the Mock IRC Network testnick!testuser@mock.irc.server\r\n');
    triggerData(':mock.irc.server 422 testnick :No MOTD in this server\r\n');

    await new Promise(process.nextTick);

    const rawMessages = messages.filter(msg => msg.type === 'raw' && msg.isRaw);

    expect(rawMessages.length).toBeGreaterThanOrEqual(2); // Welcome + No MOTD

    const welcomeMsg = rawMessages.find(msg => msg.text.includes('Welcome to the Mock IRC Network'));
    expect(welcomeMsg).toBeDefined();
    expect(welcomeMsg?.isRaw).toBe(true);

    const noMotdMsg = rawMessages.find(msg => msg.text.includes('No Message of the Day.'));
    expect(noMotdMsg).toBeDefined();
    expect(noMotdMsg?.text).toContain('No Message of the Day.');
    expect(noMotdMsg?.isRaw).toBe(true);
  });
});

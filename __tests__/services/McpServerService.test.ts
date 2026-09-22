/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const mockNative = {
  start: jest.fn(),
  stop: jest.fn(),
  getStatus: jest.fn(),
  resolveToolCall: jest.fn(),
};

let capturedListener: ((event: any) => void) | null = null;
const mockRemove = jest.fn();

// Replace react-native wholesale rather than spreading requireActual: the
// spread pulls in VirtualizedList and recurses through the module registry.
jest.mock('react-native', () => ({
  NativeModules: { McpServer: mockNative },
  NativeEventEmitter: jest.fn().mockImplementation(() => ({
    addListener: (_name: string, listener: (event: any) => void) => {
      capturedListener = listener;
      return { remove: mockRemove };
    },
  })),
}));

jest.mock('../../src/services/ai/AgentTools', () => ({
  agentToolSchemas: jest.fn(() => [
    {
      name: 'list_channels',
      description: 'List channels',
      inputSchema: { type: 'object', properties: {}, required: [] },
      mutates: false,
    },
    {
      name: 'send_message',
      description: 'Send a message',
      inputSchema: {
        type: 'object',
        properties: { target: { type: 'string' } },
        required: ['target'],
      },
      mutates: true,
    },
  ]),
  executeTool: jest.fn(),
}));

jest.mock('../../src/services/Logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// Imported after the mocks, so the service captures the mocked module.
const { mcpServerService } = require('../../src/services/ai/McpServerService');

const { executeTool } = require('../../src/services/ai/AgentTools');

const running = {
  running: true,
  port: 8765,
  token: 'abc123',
  bindLan: false,
};

describe('McpServerService', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    capturedListener = null;
    mockNative.start.mockResolvedValue(running);
    mockNative.stop.mockResolvedValue({
      ...running,
      running: false,
      token: '',
    });
    mockNative.getStatus.mockResolvedValue(running);
    executeTool.mockResolvedValue({ content: '#chat, #dev' });
    await mcpServerService.stop().catch(() => undefined);
    jest.clearAllMocks();
  });

  it('reports that the native module is present', () => {
    expect(mcpServerService.isSupported()).toBe(true);
  });

  it('defaults to loopback and read-only', async () => {
    await mcpServerService.start();

    const config = mockNative.start.mock.calls[0][0];
    // Nobody watches a remote caller, so neither writing nor LAN exposure
    // may happen by default.
    expect(config.bindLan).toBe(false);
    expect(config.allowWrites).toBe(false);
  });

  it('passes both flags through when the user opts in', async () => {
    await mcpServerService.start({
      bindLan: true,
      allowWrites: true,
      port: 9000,
    });

    expect(mockNative.start.mock.calls[0][0]).toMatchObject({
      bindLan: true,
      allowWrites: true,
      port: 9000,
    });
  });

  it('serializes each tool schema for the native side', async () => {
    await mcpServerService.start();

    const tools = mockNative.start.mock.calls[0][0].tools;
    expect(tools).toHaveLength(2);
    expect(tools[0]).toEqual({
      name: 'list_channels',
      description: 'List channels',
      inputSchema: JSON.stringify({
        type: 'object',
        properties: {},
        required: [],
      }),
      mutates: false,
    });
    // The mutates flag has to survive the crossing, or native cannot filter.
    expect(tools[1].mutates).toBe(true);
  });

  it('runs a forwarded tool call and answers native', async () => {
    await mcpServerService.start();

    await capturedListener?.({
      id: 'call-1',
      name: 'list_channels',
      input: '{"network":"net1"}',
    });

    expect(executeTool).toHaveBeenCalledWith({
      id: 'call-1',
      name: 'list_channels',
      input: { network: 'net1' },
    });
    expect(mockNative.resolveToolCall).toHaveBeenCalledWith(
      'call-1',
      '#chat, #dev',
      false,
    );
  });

  it('survives malformed arguments instead of crashing', async () => {
    await mcpServerService.start();

    await capturedListener?.({
      id: 'call-2',
      name: 'list_channels',
      input: '{not json',
    });

    expect(executeTool).toHaveBeenCalledWith(
      expect.objectContaining({ input: {} }),
    );
  });

  it('still answers native when a tool throws', async () => {
    executeTool.mockRejectedValue(new Error('boom'));
    await mcpServerService.start();

    await capturedListener?.({ id: 'call-3', name: 'x', input: '{}' });

    // Native is blocking on this id; silence would hold the remote request
    // open until its own timeout.
    expect(mockNative.resolveToolCall).toHaveBeenCalledWith(
      'call-3',
      'Error: boom',
      true,
    );
  });

  it('marks a tool error as an error', async () => {
    executeTool.mockResolvedValue({ content: 'not connected', isError: true });
    await mcpServerService.start();

    await capturedListener?.({ id: 'call-4', name: 'x', input: '{}' });

    expect(mockNative.resolveToolCall).toHaveBeenCalledWith(
      'call-4',
      'not connected',
      true,
    );
  });

  it('drops the listener when it stops', async () => {
    await mcpServerService.start();

    await mcpServerService.stop();

    expect(mockRemove).toHaveBeenCalled();
  });

  it('does not leave a listener behind when starting fails', async () => {
    mockNative.start.mockRejectedValue(new Error('port in use'));

    await expect(mcpServerService.start()).rejects.toThrow('port in use');
    expect(mockRemove).toHaveBeenCalled();
  });

  it('describes the endpoint a client should use', () => {
    expect(mcpServerService.describeEndpoint(running)).toBe(
      'http://127.0.0.1:8765/mcp',
    );
    expect(
      mcpServerService.describeEndpoint({ ...running, bindLan: true }),
    ).toBe('http://<phone-ip>:8765/mcp');
  });
});

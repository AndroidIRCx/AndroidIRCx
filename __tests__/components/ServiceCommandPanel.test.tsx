import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ServiceCommandPanel } from '../../src/components/ServiceCommandPanel';

const mockGetCommands = jest.fn();

jest.mock('../../src/services/ServiceCommandProvider', () => ({
  serviceCommandProvider: {
    getCommands: (...args: unknown[]) => mockGetCommands(...args),
  },
}));

jest.mock('../../src/i18n/localization', () => ({
  useT: () => (key: string) => key,
}));

const colors = {
  text: '#111111',
  textSecondary: '#666666',
  primary: '#2A7FFF',
  surface: '#FFFFFF',
  border: '#DDDDDD',
  background: '#F5F5F5',
};

const sampleCommands = [
  {
    serviceName: 'nickserv',
    serviceNick: 'NickServ',
    service: { nick: 'NickServ' },
    command: {
      name: 'REGISTER',
      service: 'NickServ',
      aliases: [],
      description: 'Register account',
      usage: 'REGISTER <password> <email>',
      example: 'REGISTER pass test@example.com',
      minLevel: 'user',
      requiresAuth: false,
      parameters: [
        {
          name: 'password',
          type: 'string',
          required: true,
          description: 'Password',
        },
      ],
      completion: { suggestAlias: 'nsregister' },
    },
  },
  {
    serviceName: 'chanserv',
    serviceNick: 'ChanServ',
    service: { nick: 'ChanServ' },
    command: {
      name: 'OP',
      service: 'ChanServ',
      aliases: [],
      description: 'Give operator status',
      usage: 'OP <#channel> <nick>',
      example: 'OP #room alice',
      minLevel: 'op',
      requiresAuth: true,
      parameters: [],
      completion: {},
    },
  },
];

describe('ServiceCommandPanel', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockGetCommands.mockReturnValue(sampleCommands);
  });

  it('renders commands and allows service filtering', async () => {
    const { getByText, queryByText } = await render(
      <ServiceCommandPanel
        visible
        onClose={jest.fn()}
        networkId="net-1"
        colors={colors}
      />,
    );

    expect(getByText('IRC Service Commands')).toBeTruthy();
    expect(getByText('NickServ')).toBeTruthy();
    expect(getByText('ChanServ')).toBeTruthy();

    await fireEvent.press(getByText('nickserv'));
    expect(getByText('REGISTER')).toBeTruthy();
    expect(queryByText('OP')).toBeNull();
  });

  it('filters commands via search and supports clearing search text', async () => {
    const { getByPlaceholderText, getByText, queryByText } = await render(
      <ServiceCommandPanel
        visible
        onClose={jest.fn()}
        networkId="net-1"
        colors={colors}
      />,
    );

    const searchInput = getByPlaceholderText('Search commands...');
    await fireEvent.changeText(searchInput, 'register');

    expect(getByText('REGISTER')).toBeTruthy();
    expect(queryByText('OP')).toBeNull();

    await fireEvent.changeText(searchInput, '');
    expect(getByText('OP')).toBeTruthy();
  });

  it('expands a command and executes it', async () => {
    const onClose = jest.fn();
    const onExecuteCommand = jest.fn();

    const { getByText } = await render(
      <ServiceCommandPanel
        visible
        onClose={onClose}
        networkId="net-1"
        colors={colors}
        onExecuteCommand={onExecuteCommand}
      />,
    );

    await fireEvent.press(getByText('REGISTER'));
    expect(getByText('Usage: REGISTER <password> <email>')).toBeTruthy();
    expect(getByText('Example: REGISTER pass test@example.com')).toBeTruthy();

    await fireEvent.press(getByText('Execute NickServ REGISTER'));

    expect(onExecuteCommand).toHaveBeenCalledWith('REGISTER', 'NickServ');
    expect(onClose).toHaveBeenCalled();
  });

  it('shows empty state when provider has no commands', async () => {
    mockGetCommands.mockReturnValue([]);

    const { getByText } = await render(
      <ServiceCommandPanel
        visible
        onClose={jest.fn()}
        networkId="net-1"
        colors={colors}
      />,
    );

    expect(getByText('No service commands available')).toBeTruthy();
  });
});

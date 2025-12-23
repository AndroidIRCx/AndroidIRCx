import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserManagementService } from '../src/services/UserManagementService';
import { IRCService } from '../src/services/IRCService';

describe('UserManagementService', () => {
  let svc: UserManagementService;
  let irc: IRCService;

  beforeEach(() => {
    (AsyncStorage as any).__reset();
    irc = new IRCService();
    svc = new UserManagementService();
    svc.setIRCService(irc);
  });

  it('stores WHOIS info via updateWHOIS and getWHOIS', () => {
    svc.setNetwork('Net');
    svc.updateWHOIS({ nick: 'nick', username: 'user', hostname: 'host', server: 'irc.test', channels: ['#chan'] }, 'Net');
    const info = svc.getWHOIS('nick', 'Net');
    expect(info?.nick).toBe('nick');
    expect(info?.hostname).toBe('host');
    expect(info?.server).toBe('irc.test');
  });

  it('adds and removes ignore masks', async () => {
    svc.setNetwork('Net');
    await svc.ignoreUser('badguy!*@host', 'rude', 'Net');
    let ignores = await svc.getIgnoredUsers('Net');
    expect(ignores.some((u: any) => u.mask === 'badguy!*@host')).toBe(true);

    await svc.unignoreUser('badguy!*@host', 'Net');
    ignores = await svc.getIgnoredUsers('Net');
    expect(ignores.length).toBe(0);
  });

  it('stores aliases and notes separately', async () => {
    svc.setNetwork('Net');
    await svc.addUserNote('nick', 'note text', 'Net');
    expect(svc.getUserNote('nick', 'Net')).toBe('note text');
  });
});

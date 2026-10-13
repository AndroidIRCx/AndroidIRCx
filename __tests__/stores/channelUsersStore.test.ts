/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { renderHook, act } from '@testing-library/react-native';
import {
  NO_CHANNEL_USERS,
  useChannelUsers,
  useChannelUsersStore,
} from '../../src/stores/channelUsersStore';

describe('channelUsersStore', () => {
  beforeEach(() => {
    useChannelUsersStore.setState({ channelUsers: new Map() });
  });

  it('accepts a map or an updater, like a React state setter', () => {
    const { setChannelUsers } = useChannelUsersStore.getState();
    const a = [{ nick: 'a', modes: [] }];
    setChannelUsers(new Map([['#a', a]]));
    setChannelUsers(prev => new Map(prev).set('#b', []));
    const map = useChannelUsersStore.getState().channelUsers;
    expect(map.get('#a')).toBe(a);
    expect(map.get('#b')).toEqual([]);
  });

  it('returns one shared empty list for no channel or an unknown one', async () => {
    const { result: none } = await renderHook(() => useChannelUsers(null));
    const { result: unknown } = await renderHook(() =>
      useChannelUsers('#nobody'),
    );
    expect(none.current).toBe(NO_CHANNEL_USERS);
    expect(unknown.current).toBe(NO_CHANNEL_USERS);
  });

  it('re-renders only when the selected channel changes', async () => {
    const mine = [{ nick: 'me', modes: [] }];
    useChannelUsersStore.setState({ channelUsers: new Map([['#mine', mine]]) });
    let renders = 0;
    const { result } = await renderHook(() => {
      renders += 1;
      return useChannelUsers('#mine');
    });
    const before = renders;

    await act(async () => {
      useChannelUsersStore
        .getState()
        .setChannelUsers(prev => new Map(prev).set('#other', []));
    });
    expect(renders).toBe(before);
    expect(result.current).toBe(mine);

    const updated = [...mine, { nick: 'you', modes: [] }];
    await act(async () => {
      useChannelUsersStore
        .getState()
        .setChannelUsers(prev => new Map(prev).set('#mine', updated));
    });
    expect(result.current).toBe(updated);
  });
});

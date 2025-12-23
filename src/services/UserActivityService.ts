export type UserActivity = {
  nick: string;
  network?: string;
  lastSeenAt: number;
  lastAction: string;
  channel?: string;
  text?: string;
};

/**
 * Tracks lightweight per-user activity such as last seen and last action.
 * Data is kept in-memory only; suitable for showing in WHOIS/user profile panels.
 */
class UserActivityService {
  private activities: Map<string, UserActivity> = new Map(); // key: `${network || ''}:${nickLower}`

  private makeKey(nick: string, network?: string) {
    return `${network || ''}:${nick.toLowerCase()}`;
  }

  recordEvent(
    nick: string | undefined,
    network: string | undefined,
    action: string,
    context?: { channel?: string; text?: string }
  ) {
    if (!nick) return;
    const key = this.makeKey(nick, network);
    const existing = this.activities.get(key);
    const updated: UserActivity = {
      nick,
      network,
      lastSeenAt: Date.now(),
      lastAction: action,
      channel: context?.channel || existing?.channel,
      text: context?.text,
    };
    this.activities.set(key, updated);
  }

  getActivity(nick: string, network?: string): UserActivity | undefined {
    if (!nick) return undefined;
    const key = this.makeKey(nick, network);
    return this.activities.get(key);
  }

  clearNetwork(network: string) {
    const prefix = `${network}:`;
    for (const key of this.activities.keys()) {
      if (key.startsWith(prefix)) {
        this.activities.delete(key);
      }
    }
  }
}

export const userActivityService = new UserActivityService();

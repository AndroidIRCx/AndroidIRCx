import AsyncStorage from '@react-native-async-storage/async-storage';

type LogEntry = {
  timestamp: number;
  text: string;
};

class ChannelNotesService {
  private NOTES_KEY = 'channelNotes';
  private BOOKMARKS_KEY = 'channelBookmarks';
  private LOGS_KEY = 'channelLogs';

  private notes: Record<string, string> = {};
  private bookmarks: Set<string> = new Set();
  private logs: Record<string, LogEntry[]> = {};
  private initialized = false;

  private key(network: string, channel: string) {
    return `${network}::${channel}`;
  }

  private async ensureLoaded() {
    if (this.initialized) return;
    try {
      const [notesRaw, bookmarksRaw, logsRaw] = await Promise.all([
        AsyncStorage.getItem(this.NOTES_KEY),
        AsyncStorage.getItem(this.BOOKMARKS_KEY),
        AsyncStorage.getItem(this.LOGS_KEY),
      ]);
      if (notesRaw) {
        this.notes = JSON.parse(notesRaw);
      }
      if (bookmarksRaw) {
        this.bookmarks = new Set(JSON.parse(bookmarksRaw));
      }
      if (logsRaw) {
        this.logs = JSON.parse(logsRaw);
      }
    } catch (e) {
      // Swallow errors; defaults are fine
    } finally {
      this.initialized = true;
    }
  }

  async setNote(network: string, channel: string, note: string) {
    await this.ensureLoaded();
    const key = this.key(network, channel);
    if (note.trim().length === 0) {
      delete this.notes[key];
    } else {
      this.notes[key] = note;
    }
    await AsyncStorage.setItem(this.NOTES_KEY, JSON.stringify(this.notes));
  }

  async getNote(network: string, channel: string): Promise<string> {
    await this.ensureLoaded();
    return this.notes[this.key(network, channel)] || '';
  }

  async setBookmarked(network: string, channel: string, bookmarked: boolean) {
    await this.ensureLoaded();
    const key = this.key(network, channel);
    if (bookmarked) {
      this.bookmarks.add(key);
    } else {
      this.bookmarks.delete(key);
    }
    await AsyncStorage.setItem(this.BOOKMARKS_KEY, JSON.stringify(Array.from(this.bookmarks)));
  }

  async isBookmarked(network: string, channel: string): Promise<boolean> {
    await this.ensureLoaded();
    return this.bookmarks.has(this.key(network, channel));
  }

  async addLogEntry(network: string, channel: string, entry: LogEntry) {
    await this.ensureLoaded();
    const key = this.key(network, channel);
    const list = this.logs[key] || [];
    const updated = [...list, entry].slice(-200); // keep last 200
    this.logs[key] = updated;
    await AsyncStorage.setItem(this.LOGS_KEY, JSON.stringify(this.logs));
  }

  async getLog(network: string, channel: string): Promise<LogEntry[]> {
    await this.ensureLoaded();
    return this.logs[this.key(network, channel)] || [];
  }

  async clearLog(network: string, channel: string) {
    await this.ensureLoaded();
    delete this.logs[this.key(network, channel)];
    await AsyncStorage.setItem(this.LOGS_KEY, JSON.stringify(this.logs));
  }
}

export const channelNotesService = new ChannelNotesService();
export type ChannelLogEntry = LogEntry;

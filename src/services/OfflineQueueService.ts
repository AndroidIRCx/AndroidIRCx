import AsyncStorage from '@react-native-async-storage/async-storage';
import { ircService } from './IRCService';
import { connectionManager } from './ConnectionManager';

const OFFLINE_QUEUE_STORAGE_KEY = 'OFFLINE_MESSAGE_QUEUE';
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export interface QueuedMessage {
  id: string;
  network: string;
  target: string;
  text: string;
  timestamp: number;
}

class OfflineQueueService {
  private queue: QueuedMessage[] = [];
  private isProcessing = false;

  constructor() {
    this.loadQueue();
  }

  private async loadQueue() {
    try {
      const storedQueue = await AsyncStorage.getItem(OFFLINE_QUEUE_STORAGE_KEY);
      if (storedQueue) {
        this.queue = JSON.parse(storedQueue);
      }
    } catch (error) {
      console.error('Failed to load offline message queue:', error);
    }
  }

  private async saveQueue() {
    try {
      await AsyncStorage.setItem(OFFLINE_QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.error('Failed to save offline message queue:', error);
    }
  }

  public addMessage(network: string, target: string, text: string) {
    const message: QueuedMessage = {
      id: `offline-${Date.now()}-${Math.random()}`,
      network,
      target,
      text,
      timestamp: Date.now(),
    };
    this.queue.push(message);
    this.saveQueue();
    // Here, you might want to emit an event to the UI
    // so the message can be displayed in a "pending" state.
  }

  public getQueue(): QueuedMessage[] {
    return [...this.queue];
  }

  public async processQueue() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const processingQueue = [...this.queue];
    this.queue = [];
    await this.saveQueue();

    for (const message of processingQueue) {
      try {
        const connection = connectionManager.getConnection(message.network) || connectionManager.getActiveConnection();
        const svc = connection?.ircService || ircService;
        if (!svc.getConnectionStatus()) {
          this.queue.unshift(message);
          continue;
        }
        svc.sendMessage(message.target, message.text, true);
        await delay(500); // small gap between queued sends
      } catch (error) {
        console.error(`Failed to send queued message: ${message.text}`, error);
        this.queue.unshift(message);
      }
    }

    this.isProcessing = false;
    await this.saveQueue();
  }
}

export const offlineQueueService = new OfflineQueueService();

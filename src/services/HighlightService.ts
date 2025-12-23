import AsyncStorage from '@react-native-async-storage/async-storage';

const HIGHLIGHT_WORDS_STORAGE_KEY = 'HIGHLIGHT_WORDS';

class HighlightService {
  private highlightWords: string[] = [];
  private listeners: Array<() => void> = [];

  constructor() {
    this.loadHighlightWords();
  }

  private async loadHighlightWords() {
    try {
      const storedWords = await AsyncStorage.getItem(HIGHLIGHT_WORDS_STORAGE_KEY);
      if (storedWords) {
        this.highlightWords = JSON.parse(storedWords);
      }
    } catch (error) {
      console.error('Failed to load highlight words:', error);
    }
  }

  private async saveHighlightWords() {
    try {
      await AsyncStorage.setItem(HIGHLIGHT_WORDS_STORAGE_KEY, JSON.stringify(this.highlightWords));
      this.notifyListeners();
    } catch (error) {
      console.error('Failed to save highlight words:', error);
    }
  }

  public getHighlightWords(): string[] {
    return [...this.highlightWords];
  }

  public async addHighlightWord(word: string) {
    const sanitizedWord = word.trim();
    if (sanitizedWord && !this.highlightWords.includes(sanitizedWord)) {
      this.highlightWords.push(sanitizedWord);
      await this.saveHighlightWords();
    }
  }

  public async removeHighlightWord(word: string) {
    this.highlightWords = this.highlightWords.filter(w => w !== word);
    await this.saveHighlightWords();
  }

  public isHighlighted(text: string): boolean {
    if (!text || this.highlightWords.length === 0) {
      return false;
    }

    for (const word of this.highlightWords) {
      try {
        const regex = new RegExp(`\b${word}\b`, 'i');
        if (regex.test(text)) {
          return true;
        }
      } catch (e) {
        console.error(`Invalid regex for highlight word "${word}":`, e);
      }
    }

    return false;
  }
  
  public onHighlightWordsChange(callback: () => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Error in highlight words listener:', error);
      }
    });
  }
}

export const highlightService = new HighlightService();

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ChannelFavorite {
  name: string;
  network: string;
  key?: string; // Channel password/key
  autoJoin?: boolean;
  addedAt: number;
}

class ChannelFavoritesService {
  private favorites: Map<string, ChannelFavorite[]> = new Map(); // network -> favorites
  private listeners: Array<(network: string, favorites: ChannelFavorite[]) => void> = [];
  private readonly STORAGE_KEY = '@AndroidIRCX:channelFavorites';

  async initialize(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        this.favorites = new Map(Object.entries(data));
      }
    } catch (error) {
      console.error('Failed to load channel favorites:', error);
    }
  }

  private async save(): Promise<void> {
    try {
      const data = Object.fromEntries(this.favorites);
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save channel favorites:', error);
    }
  }

  /**
   * Add a channel to favorites
   */
  async addFavorite(network: string, channel: string, key?: string, autoJoin?: boolean): Promise<void> {
    const networkFavorites = this.favorites.get(network) || [];
    
    // Check if already exists
    const existing = networkFavorites.find(f => f.name === channel);
    if (existing) {
      // Update existing
      existing.key = key;
      existing.autoJoin = autoJoin;
      await this.save();
      this.notifyListeners(network);
      return;
    }

    // Add new favorite
    const favorite: ChannelFavorite = {
      name: channel,
      network,
      key,
      autoJoin: autoJoin ?? false,
      addedAt: Date.now(),
    };

    networkFavorites.push(favorite);
    this.favorites.set(network, networkFavorites);
    await this.save();
    this.notifyListeners(network);
  }

  /**
   * Remove a channel from favorites
   */
  async removeFavorite(network: string, channel: string): Promise<void> {
    const networkFavorites = this.favorites.get(network) || [];
    const filtered = networkFavorites.filter(f => f.name !== channel);
    
    if (filtered.length === 0) {
      this.favorites.delete(network);
    } else {
      this.favorites.set(network, filtered);
    }
    
    await this.save();
    this.notifyListeners(network);
  }

  /**
   * Move a favorite to another network (keeps key/autoJoin)
   */
  async moveFavorite(fromNetwork: string, channel: string, toNetwork: string): Promise<void> {
    if (fromNetwork === toNetwork) return;

    const sourceFavorites = this.favorites.get(fromNetwork) || [];
    const favorite = sourceFavorites.find(f => f.name === channel);
    if (!favorite) return;

    // Remove from source
    const updatedSource = sourceFavorites.filter(f => f.name !== channel);
    if (updatedSource.length === 0) {
      this.favorites.delete(fromNetwork);
    } else {
      this.favorites.set(fromNetwork, updatedSource);
    }

    // Add or update on target
    const targetFavorites = this.favorites.get(toNetwork) || [];
    const existingTarget = targetFavorites.find(f => f.name === channel);
    if (existingTarget) {
      existingTarget.key = favorite.key;
      existingTarget.autoJoin = favorite.autoJoin;
      existingTarget.addedAt = favorite.addedAt;
    } else {
      targetFavorites.push({ ...favorite, network: toNetwork });
    }
    this.favorites.set(toNetwork, targetFavorites);

    await this.save();
    this.notifyListeners(fromNetwork);
    this.notifyListeners(toNetwork);
  }

  /**
   * Check if a channel is favorited
   */
  isFavorite(network: string, channel: string): boolean {
    const networkFavorites = this.favorites.get(network) || [];
    return networkFavorites.some(f => f.name === channel);
  }

  /**
   * Get favorites for a network
   */
  getFavorites(network: string): ChannelFavorite[] {
    return [...(this.favorites.get(network) || [])];
  }

  /**
   * Get all favorites
   */
  getAllFavorites(): Map<string, ChannelFavorite[]> {
    const clone = new Map<string, ChannelFavorite[]>();
    this.favorites.forEach((value, key) => {
      clone.set(key, [...value]);
    });
    return clone;
  }

  /**
   * Get auto-join channels for a network
   */
  getAutoJoinChannels(network: string): ChannelFavorite[] {
    const networkFavorites = this.favorites.get(network) || [];
    return networkFavorites.filter(f => f.autoJoin);
  }

  /**
   * Toggle auto-join for a favorite
   */
  async setAutoJoin(network: string, channel: string, autoJoin: boolean): Promise<void> {
    const networkFavorites = this.favorites.get(network) || [];
    const favorite = networkFavorites.find(f => f.name === channel);
    
    if (favorite) {
      favorite.autoJoin = autoJoin;
      await this.save();
      this.notifyListeners(network);
    }
  }

  /**
   * Update favorite key/password
   */
  async updateFavoriteKey(network: string, channel: string, key?: string): Promise<void> {
    const networkFavorites = this.favorites.get(network) || [];
    const favorite = networkFavorites.find(f => f.name === channel);
    
    if (favorite) {
      favorite.key = key;
      await this.save();
      this.notifyListeners(network);
    }
  }

  /**
   * Listen for favorites changes
   */
  onFavoritesChange(callback: (network: string, favorites: ChannelFavorite[]) => void): () => void {
    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(network: string): void {
    const networkFavorites = this.favorites.get(network) || [];
    this.listeners.forEach(callback => callback(network, networkFavorites));
  }
}

export const channelFavoritesService = new ChannelFavoritesService();


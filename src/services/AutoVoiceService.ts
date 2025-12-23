import { IRCService } from './IRCService';

export interface AutoVoiceConfig {
  enabled: boolean;
  forOperators: boolean; // Auto-voice if user is operator/halfoperator
  forIRCOps: boolean; // Auto-voice if user is ircadmin/netadmin (ircop)
  forAll: boolean; // Auto-voice for all users
}

export class AutoVoiceService {
  private ircService: IRCService;
  private config: Map<string, AutoVoiceConfig> = new Map(); // network -> config
  private userModes: Map<string, Set<string>> = new Map(); // network -> user modes

  constructor(ircService: IRCService) {
    this.ircService = ircService;
  }

  /**
   * Initialize auto-voice service
   */
  initialize(): void {
    this.ircService.on('joinedChannel', (channel: string) => this.handleJoin(channel));
  }

  /**
   * Handle channel join (called from IRCService)
   */
  handleJoin(channel: string): void {
    const network = this.ircService.getNetworkName();
    const config = this.config.get(network);

    if (!config || !config.enabled) {
      return;
    }

    const currentNick = this.ircService.getCurrentNick();
    const userModes = this.userModes.get(network) || new Set();

    // Check if we should request voice
    let shouldRequestVoice = false;

    if (config.forAll) {
      shouldRequestVoice = true;
    } else if (config.forOperators && (userModes.has('o') || userModes.has('h'))) {
      shouldRequestVoice = true;
    } else if (config.forIRCOps && (userModes.has('a') || userModes.has('q'))) {
      shouldRequestVoice = true;
    }

    if (shouldRequestVoice) {
      // Request voice mode
      // Note: This depends on server support and channel settings
      // Some servers use MODE +v, others may require different commands
      setTimeout(() => {
        this.ircService.sendCommand(`MODE ${channel} +v ${currentNick}`);
      }, 1000); // Small delay to ensure we're fully joined
    }
  }

  /**
   * Update user modes for a network
   */
  updateUserModes(network: string, modes: string[]): void {
    const modeSet = new Set(modes);
    this.userModes.set(network, modeSet);
  }

  /**
   * Configure auto-voice for a network
   */
  setConfig(network: string, config: AutoVoiceConfig): void {
    this.config.set(network, config);
  }

  /**
   * Get auto-voice config for a network
   */
  getConfig(network: string): AutoVoiceConfig | undefined {
    return this.config.get(network);
  }

  /**
   * Enable/disable auto-voice for a network
   */
  setEnabled(network: string, enabled: boolean): void {
    const config = this.config.get(network) || {
      enabled: false,
      forOperators: false,
      forIRCOps: false,
      forAll: false,
    };
    config.enabled = enabled;
    this.config.set(network, config);
  }

  /**
   * Check if auto-voice is enabled for a network
   */
  isEnabled(network: string): boolean {
    const config = this.config.get(network);
    return config?.enabled || false;
  }
}

const { ircService } = require('./IRCService');
export const autoVoiceService = new AutoVoiceService(ircService);


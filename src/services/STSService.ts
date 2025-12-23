import AsyncStorage from '@react-native-async-storage/async-storage';

const STS_POLICIES_STORAGE_KEY = 'STS_POLICIES';

export interface STSPolicy {
  hostname: string;
  port: number;
  duration: number; // in seconds
  expiresAt: number; // timestamp
}

export class STSService {
  private policies: Map<string, STSPolicy> = new Map();

  constructor() {
    this.loadPolicies();
  }

  private async loadPolicies() {
    try {
      const stored = await AsyncStorage.getItem(STS_POLICIES_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Prune expired policies on load
        const now = Date.now();
        const validPolicies = new Map<string, STSPolicy>();
        for (const [host, policy] of Object.entries(parsed)) {
          if ((policy as STSPolicy).expiresAt > now) {
            validPolicies.set(host, policy as STSPolicy);
          }
        }
        this.policies = validPolicies;
        this.savePolicies();
      }
    } catch (error) {
      console.error('Failed to load STS policies:', error);
    }
  }

  private async savePolicies() {
    try {
      const data = Object.fromEntries(this.policies);
      await AsyncStorage.setItem(STS_POLICIES_STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save STS policies:', error);
    }
  }

  public getPolicy(hostname: string): STSPolicy | undefined {
    const policy = this.policies.get(hostname.toLowerCase());
    if (policy && policy.expiresAt < Date.now()) {
      // Policy has expired
      this.policies.delete(hostname.toLowerCase());
      this.savePolicies();
      return undefined;
    }
    return policy;
  }

  public savePolicy(hostname: string, policyValues: { [key: string]: string }) {
    const duration = parseInt(policyValues['duration'], 10);
    const port = parseInt(policyValues['port'], 10);

    if (isNaN(duration) || duration <= 0) {
      // Invalid or zero duration, remove policy
      this.policies.delete(hostname.toLowerCase());
      console.log(`STS: Removed policy for ${hostname}`);
      this.savePolicies();
      return;
    }

    if (isNaN(port) || port <= 0) {
      console.error(`STS: Invalid port in policy for ${hostname}`);
      return;
    }

    const newPolicy: STSPolicy = {
      hostname: hostname.toLowerCase(),
      port,
      duration,
      expiresAt: Date.now() + duration * 1000,
    };

    this.policies.set(hostname.toLowerCase(), newPolicy);
    console.log(`STS: Saved policy for ${hostname}`, newPolicy);
    this.savePolicies();
  }
}

export const stsService = new STSService();

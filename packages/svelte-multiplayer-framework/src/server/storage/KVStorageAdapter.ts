import type { StorageAdapter } from './StorageAdapter';

// Memory storage for development fallback
const memoryStorage = new Map<string, string>();
let hasWarnedAboutMemoryStorage = false;

/**
 * Platform interface for Cloudflare KV binding
 */
export interface KVPlatform {
  env?: {
    [key: string]: any;
  };
}

/**
 * Configuration for KV Storage Adapter
 */
export interface KVStorageConfig {
  /**
   * Name of the KV namespace binding
   * This should match your wrangler.toml binding name
   */
  kvBindingName: string;
}

/**
 * Storage adapter for Cloudflare KV
 * Falls back to memory storage in development when KV is not available
 */
export class KVStorageAdapter implements StorageAdapter {
  private kv: any;
  private isMemoryMode: boolean;
  private bindingName: string;

  constructor(platform: KVPlatform, config: KVStorageConfig) {
    this.bindingName = config.kvBindingName;

    if (platform?.env?.[config.kvBindingName]) {
      this.kv = platform.env[config.kvBindingName];
      this.isMemoryMode = false;
    } else {
      // Fallback to memory storage for development
      this.kv = null;
      this.isMemoryMode = true;

      if (!hasWarnedAboutMemoryStorage) {
        console.warn(
          `🚨 ${config.kvBindingName} KV binding not available - using memory storage for development`
        );
        console.warn('⚠️  Data will not persist between server restarts');
        hasWarnedAboutMemoryStorage = true;
      }
    }
  }

  async get<T = any>(key: string): Promise<T | null> {
    try {
      let value: string | null;

      if (this.isMemoryMode) {
        value = memoryStorage.get(key) || null;
      } else {
        value = await this.kv.get(key);
      }

      if (!value) return null;

      try {
        return JSON.parse(value) as T;
      } catch {
        return value as T;
      }
    } catch (error) {
      console.error(`Error getting key ${key}:`, error);
      return null;
    }
  }

  async put(key: string, value: any): Promise<void> {
    try {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);

      if (this.isMemoryMode) {
        memoryStorage.set(key, serialized);
      } else {
        await this.kv.put(key, serialized);
      }
    } catch (error) {
      console.error(`Error putting key ${key}:`, error);
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      if (this.isMemoryMode) {
        memoryStorage.delete(key);
      } else {
        await this.kv.delete(key);
      }
    } catch (error) {
      console.error(`Error deleting key ${key}:`, error);
      throw error;
    }
  }

  async list(prefix?: string): Promise<{ keys: Array<{ name: string }> }> {
    try {
      if (this.isMemoryMode) {
        const keys = Array.from(memoryStorage.keys())
          .filter((key) => !prefix || key.startsWith(prefix))
          .map((name) => ({ name }));
        return { keys };
      } else {
        const options = prefix ? { prefix } : {};
        return await this.kv.list(options);
      }
    } catch (error) {
      console.error(`Error listing keys with prefix ${prefix}:`, error);
      return { keys: [] };
    }
  }

  getStorageInfo(): { type: string; keyCount?: number; bindingName: string } {
    if (this.isMemoryMode) {
      return {
        type: 'memory',
        keyCount: memoryStorage.size,
        bindingName: this.bindingName
      };
    }
    return {
      type: 'cloudflare-kv',
      bindingName: this.bindingName
    };
  }
}


import type { StorageAdapter, StorageInfo } from './StorageAdapter';

// Memory storage for development fallback
const memoryStorage = new Map<string, string>();
let hasWarnedAboutMemoryStorage = false;

/**
 * Platform interface for Cloudflare KV binding
 */
export interface KVPlatform {
  env?: {
    [key: string]: KVNamespace | unknown;
  };
}

/**
 * Cloudflare KV Namespace interface (subset of full API)
 */
interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string }): Promise<{ keys: Array<{ name: string }> }>;
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
 * Storage info specific to KV adapter
 */
export interface KVStorageInfo extends StorageInfo {
  type: 'memory' | 'cloudflare-kv';
  bindingName: string;
  keyCount?: number;
}

/**
 * Storage adapter for Cloudflare KV
 * Falls back to memory storage in development when KV is not available
 */
export class KVStorageAdapter implements StorageAdapter {
  private kv: KVNamespace | null;
  private isMemoryMode: boolean;
  private bindingName: string;

  constructor(platform: KVPlatform, config: KVStorageConfig) {
    this.bindingName = config.kvBindingName;

    const kvBinding = platform?.env?.[config.kvBindingName];
    if (kvBinding && this.isKVNamespace(kvBinding)) {
      this.kv = kvBinding;
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

  /**
   * Type guard to check if a value is a KV namespace
   */
  private isKVNamespace(value: unknown): value is KVNamespace {
    return (
      typeof value === 'object' &&
      value !== null &&
      'get' in value &&
      'put' in value &&
      'delete' in value &&
      'list' in value
    );
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      let value: string | null;

      if (this.isMemoryMode) {
        value = memoryStorage.get(key) || null;
      } else {
        value = await this.kv!.get(key);
      }

      if (!value) return null;

      try {
        return JSON.parse(value) as T;
      } catch {
        // If it's not valid JSON, return as-is (for string values)
        return value as unknown as T;
      }
    } catch (error) {
      console.error(`Error getting key ${key}:`, error);
      return null;
    }
  }

  async put<T>(key: string, value: T): Promise<void> {
    try {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);

      if (this.isMemoryMode) {
        memoryStorage.set(key, serialized);
      } else {
        await this.kv!.put(key, serialized);
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
        await this.kv!.delete(key);
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
        return await this.kv!.list(options);
      }
    } catch (error) {
      console.error(`Error listing keys with prefix ${prefix}:`, error);
      return { keys: [] };
    }
  }

  getStorageInfo(): KVStorageInfo {
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

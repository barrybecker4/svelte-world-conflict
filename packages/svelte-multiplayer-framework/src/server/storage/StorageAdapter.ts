/**
 * Generic storage adapter interface for persisting game data
 * Implementations can use Cloudflare KV, Redis, PostgreSQL, etc.
 */
export interface StorageAdapter {
  /**
   * Get a value from storage
   * @param key - Storage key
   * @returns The stored value or null if not found
   */
  get<T = any>(key: string): Promise<T | null>;

  /**
   * Store a value
   * @param key - Storage key
   * @param value - Value to store (will be JSON serialized)
   */
  put(key: string, value: any): Promise<void>;

  /**
   * Delete a value from storage
   * @param key - Storage key
   */
  delete(key: string): Promise<void>;

  /**
   * List keys with optional prefix filter
   * @param prefix - Optional prefix to filter keys
   * @returns Object containing array of key objects
   */
  list(prefix?: string): Promise<{ keys: Array<{ name: string }> }>;

  /**
   * Get information about the storage adapter
   * Useful for debugging and monitoring
   */
  getStorageInfo(): { type: string; [key: string]: any };
}


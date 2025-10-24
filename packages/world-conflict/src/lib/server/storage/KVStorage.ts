/**
 * World Conflict-specific wrapper around the framework KVStorageAdapter
 * This maintains backward compatibility with existing code
 */
import { KVStorageAdapter, type StorageAdapter } from '@svelte-mp/framework/server';

// Track KV writes for monitoring
let kvWriteCount = 0;

/**
 * KVStorage for World Conflict
 * Wraps the framework KVStorageAdapter with World Conflict-specific configuration
 */
export class KVStorage implements StorageAdapter {
    private adapter: KVStorageAdapter;

    constructor(platform: App.Platform) {
        this.adapter = new KVStorageAdapter(platform, {
            kvBindingName: 'WORLD_CONFLICT_KV'
        });
    }

    async get<T = any>(key: string): Promise<T | null> {
        return this.adapter.get<T>(key);
    }

    async put(key: string, value: any): Promise<void> {
        kvWriteCount++;
        console.log(`📊 KV WRITE #${kvWriteCount}: ${key}`);
        return this.adapter.put(key, value);
    }

    async delete(key: string): Promise<void> {
        return this.adapter.delete(key);
    }

    async list(prefix?: string): Promise<{ keys: Array<{ name: string }> }> {
        return this.adapter.list(prefix);
    }

    getStorageInfo(): { type: string; keyCount?: number } {
        return this.adapter.getStorageInfo();
    }
}

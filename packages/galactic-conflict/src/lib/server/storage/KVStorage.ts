/**
 * Galactic Conflict-specific wrapper around the framework KVStorageAdapter
 */
import { KVStorageAdapter, type StorageAdapter } from '@svelte-mp/framework/server';
import { logger } from '$lib/game/utils/logger';

/**
 * KVStorage for Galactic Conflict
 * Wraps the framework KVStorageAdapter with Galactic Conflict-specific configuration
 */
export class KVStorage implements StorageAdapter {
    private adapter: KVStorageAdapter;

    constructor(platform: App.Platform) {
        this.adapter = new KVStorageAdapter(platform, {
            kvBindingName: 'GALACTIC_CONFLICT_KV'
        });
    }

    async get<T = unknown>(key: string): Promise<T | null> {
        return this.adapter.get<T>(key);
    }

    async put(key: string, value: unknown): Promise<void> {
        logger.debug(`KV write: ${key}`);
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


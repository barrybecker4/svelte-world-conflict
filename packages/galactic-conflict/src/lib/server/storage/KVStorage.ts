/**
 * Galactic Conflict-specific wrapper around the framework KVStorageAdapter
 */
import { KVStorageAdapter, type StorageAdapter, type KVNamespace } from 'multiplayer-framework/server';
import { logger } from 'multiplayer-framework/shared';

const BINDING_NAME = 'GALACTIC_CONFLICT_KV';

/**
 * KVStorage for Galactic Conflict
 * Wraps the framework KVStorageAdapter with Galactic Conflict-specific configuration
 */
export class KVStorage implements StorageAdapter {
    private adapter: KVStorageAdapter;

    constructor(platform: App.Platform) {
        const kv = platform?.env?.[BINDING_NAME] as KVNamespace | undefined;
        this.adapter = new KVStorageAdapter(kv, BINDING_NAME);
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

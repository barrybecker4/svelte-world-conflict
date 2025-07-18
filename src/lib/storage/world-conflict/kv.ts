/**
 * KV Storage wrapper for World Conflict using WORLD_CONFLICT_KV binding
 */
export class WorldConflictKVStorage {
    private kv: any;

    constructor(platform: App.Platform) {
        if (!platform?.env?.WORLD_CONFLICT_KV) {
            throw new Error('WORLD_CONFLICT_KV binding not available');
        }
        this.kv = platform.env.WORLD_CONFLICT_KV;
    }

    async get<T = any>(key: string): Promise<T | null> {
        try {
            const value = await this.kv.get(key);
            if (!value) return null;

            // Try to parse as JSON, fallback to string
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
            await this.kv.put(key, serialized);
        } catch (error) {
            console.error(`Error putting key ${key}:`, error);
            throw error;
        }
    }

    async delete(key: string): Promise<void> {
        try {
            await this.kv.delete(key);
        } catch (error) {
            console.error(`Error deleting key ${key}:`, error);
            throw error;
        }
    }

    async list(prefix?: string): Promise<{ keys: Array<{ name: string }> }> {
        try {
            const options = prefix ? { prefix } : {};
            return await this.kv.list(options);
        } catch (error) {
            console.error(`Error listing keys with prefix ${prefix}:`, error);
            return { keys: [] };
        }
    }
}

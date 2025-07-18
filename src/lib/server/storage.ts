/**
 * Storage adapter that works with any KV-like storage
 */
export class StorageAdapter {
    private storage: any;
    private isMemory: boolean;

    constructor(platform?: App.Platform) {
        if (platform?.env?.WORLD_CONFLICT_KV) {
            this.storage = platform.env.WORLD_CONFLICT_KV;
            this.isMemory = false;
        } else {
            this.storage = new Map<string, string>();
            this.isMemory = true;
            console.warn('Using memory storage - data will not persist');
        }
    }

    async get(key: string): Promise<string | null> {
        if (this.isMemory) {
            return this.storage.get(key) || null;
        }
        return await this.storage.get(key);
    }

    async put(key: string, value: string): Promise<void> {
        if (this.isMemory) {
            this.storage.set(key, value);
        } else {
            await this.storage.put(key, value);
        }
    }

    async delete(key: string): Promise<void> {
        if (this.isMemory) {
            this.storage.delete(key);
        } else {
            await this.storage.delete(key);
        }
    }

    async list(prefix?: string): Promise<{ keys: Array<{ name: string }> }> {
        if (this.isMemory) {
            const keys = Array.from(this.storage.keys())
                .filter(key => !prefix || key.startsWith(prefix))
                .map(name => ({ name }));
            return { keys };
        }
        return await this.storage.list(prefix ? { prefix } : undefined);
    }

    // Helper methods for game data
    async getGameData<T = any>(key: string): Promise<T | null> {
        const value = await this.get(key);
        if (!value) return null;

        try {
            return JSON.parse(value) as T;
        } catch (error) {
            console.error('Error parsing JSON for key:', key, error);
            return null;
        }
    }

    async putGameData(key: string, data: any): Promise<void> {
        const serialized = JSON.stringify(data);
        await this.put(key, serialized);
    }

    isUsingMemoryStorage(): boolean {
        return this.isMemory;
    }
}

// Usage in API endpoints:
// const storage = new StorageAdapter(platform);
// const gameData = await storage.getGameData('game:123');
// await storage.putGameData('game:123', gameData);

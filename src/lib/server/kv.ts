/**
 * Simple, pragmatic KV storage that just works
 */

// Simple memory storage for development
const memoryStorage = new Map<string, string>();

/**
 * Get a value from storage
 */
export async function kvGet(platform: App.Platform | undefined, key: string): Promise<string | null> {
    if (platform?.env?.WORLD_CONFLICT_KV) {
        return await platform.env.WORLD_CONFLICT_KV.get(key);
    }

    // Fallback to memory storage
    if (!memoryStorage.has('_warned')) {
        console.warn('Using memory storage - data will not persist between server restarts');
        memoryStorage.set('_warned', 'true');
    }

    return memoryStorage.get(key) || null;
}

/**
 * Put a value into storage
 */
export async function kvPut(platform: App.Platform | undefined, key: string, value: string): Promise<void> {
    if (platform?.env?.WORLD_CONFLICT_KV) {
        await platform.env.WORLD_CONFLICT_KV.put(key, value);
        return;
    }

    // Fallback to memory storage
    memoryStorage.set(key, value);
}

/**
 * Delete a value from storage
 */
export async function kvDelete(platform: App.Platform | undefined, key: string): Promise<void> {
    if (platform?.env?.WORLD_CONFLICT_KV) {
        await platform.env.WORLD_CONFLICT_KV.delete(key);
        return;
    }

    // Fallback to memory storage
    memoryStorage.delete(key);
}

/**
 * List keys from storage
 */
export async function kvList(platform: App.Platform | undefined, prefix?: string): Promise<{ keys: Array<{ name: string }> }> {
    if (platform?.env?.WORLD_CONFLICT_KV) {
        return await platform.env.WORLD_CONFLICT_KV.list(prefix ? { prefix } : undefined);
    }

    // Fallback to memory storage
    const keys = Array.from(memoryStorage.keys())
        .filter(key => !prefix || key.startsWith(prefix))
        .filter(key => key !== '_warned') // Exclude our warning flag
        .map(name => ({ name }));

    return { keys };
}

/**
 * Helper: Get and parse JSON data
 */
export async function kvGetJSON<T = any>(platform: App.Platform | undefined, key: string): Promise<T | null> {
    const value = await kvGet(platform, key);
    if (!value) return null;

    try {
        return JSON.parse(value) as T;
    } catch (error) {
        console.error('Error parsing JSON for key:', key, error);
        return null;
    }
}

/**
 * Helper: Store JSON data
 */
export async function kvPutJSON(platform: App.Platform | undefined, key: string, data: any): Promise<void> {
    const serialized = JSON.stringify(data);
    await kvPut(platform, key, serialized);
}

/**
 * Helper: Check if a key exists
 */
export async function kvExists(platform: App.Platform | undefined, key: string): Promise<boolean> {
    const value = await kvGet(platform, key);
    return value !== null;
}

/**
 * Check if we're using real KV storage
 */
export function isUsingRealKV(platform?: App.Platform): boolean {
    return !!platform?.env?.WORLD_CONFLICT_KV;
}

// See https://svelte.dev/docs/kit/types#app.d.ts
//import { PlatformProxy } from 'wrangler';

// See https://kit.svelte.dev/docs/types#app
declare global {
  namespace App {
    interface Error {}
    interface Locals {}
    interface PageData {}
    interface PageState {}
    interface Platform {
      env: {
        WORLD_CONFLICT_KV: {
          get(key: string): Promise<string | null>;
          put(key: string, value: string): Promise<void>;
          delete(key: string): Promise<void>;
          list(options?: { prefix?: string }): Promise<{ keys: Array<{ name: string }> }>;
        };
        WEBSOCKET_HIBERNATION_SERVER: {
          idFromName(name: string): any;
          get(id: any): any;
        };
      };
      context: {
        waitUntil(promise: Promise<any>): void;
      };
      caches: CacheStorage & { default: Cache };
    }
  }
}

export {};

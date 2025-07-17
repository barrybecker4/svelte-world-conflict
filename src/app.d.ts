// See https://svelte.dev/docs/kit/types#app.d.ts
import { PlatformProxy } from 'wrangler';

// See https://kit.svelte.dev/docs/types#app
declare global {
  namespace App {
    interface Error {}
    interface Locals {}
    interface PageData {}
    interface PageState {}
    interface Platform {
      env: {
        TTT_GAME_KV: KVNamespace;
        WEBSOCKET_HIBERNATION_SERVER?: DurableObjectNamespace;
      };
      context: {
        waitUntil(promise: Promise<any>): void;
      };
      caches: CacheStorage & { default: Cache };
    }
  }
}

export {};

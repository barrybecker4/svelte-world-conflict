/**
 * Simple logger utility that can be toggled for production
 * Debug logs are only shown in development mode
 * 
 * Works in both browser and server (Node/Cloudflare Workers) contexts
 * No framework dependencies - pure TypeScript
 */

// Detect development mode - works in browser (Vite) and server (Node) contexts
const isDev = (): boolean => {
  // Browser context with Vite
  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV !== undefined) {
    return (import.meta as any).env.DEV;
  }
  // Node/server context - use globalThis to avoid TypeScript errors without @types/node
  const globalProcess = (globalThis as any).process;
  if (typeof globalProcess !== 'undefined' && globalProcess.env?.NODE_ENV !== undefined) {
    return globalProcess.env.NODE_ENV === 'development';
  }
  return false;
};

const DEBUG = isDev();

export const logger = {
  /** Debug logs - only shown in development */
  debug: (...args: unknown[]): void => {
    if (DEBUG) console.log('[DEBUG]', ...args);
  },
  
  /** Info logs - always shown */
  info: (...args: unknown[]): void => {
    console.log('[INFO]', ...args);
  },
  
  /** Warning logs - always shown */
  warn: (...args: unknown[]): void => {
    console.warn('[WARN]', ...args);
  },
  
  /** Error logs - always shown */
  error: (...args: unknown[]): void => {
    console.error('[ERROR]', ...args);
  }
};

export type Logger = typeof logger;


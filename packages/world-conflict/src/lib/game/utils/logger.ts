/**
 * Simple logger utility that can be toggled for production
 * Debug logs are only shown in development mode
 * 
 * Can be used by both client and server code
 */

// Detect development mode - works in both browser (Vite) and server (Node) contexts
const isDev = (): boolean => {
  // Browser context with Vite
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV !== undefined) {
    return import.meta.env.DEV;
  }
  // Node/server context
  if (typeof process !== 'undefined' && process.env?.NODE_ENV !== undefined) {
    return process.env.NODE_ENV === 'development';
  }
  return false;
};

const DEBUG = isDev();

export const logger = {
  /** Debug logs - only shown in development */
  debug: (...args: unknown[]): void => {
    if (DEBUG) console.log(...args);
  },
  
  /** Info logs - always shown */
  info: (...args: unknown[]): void => {
    console.log(...args);
  },
  
  /** Warning logs - always shown */
  warn: (...args: unknown[]): void => {
    console.warn(...args);
  },
  
  /** Error logs - always shown */
  error: (...args: unknown[]): void => {
    console.error(...args);
  }
};


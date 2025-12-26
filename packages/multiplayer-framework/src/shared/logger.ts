/**
 * Simple logger utility that can be toggled for production
 * Debug logs are only shown in development mode
 * 
 * Works in both browser and server (Node/Cloudflare Workers) contexts
 * No framework dependencies - pure TypeScript
 * 
 * LOG_LEVEL can be configured via environment variable:
 * - Server/Node: process.env.LOG_LEVEL
 * - Client/Browser: import.meta.env.VITE_LOG_LEVEL
 * - Default: 'INFO' if not specified
 * 
 * Allowed values: 'DEBUG', 'INFO', 'WARN', 'ERROR'
 * - DEBUG: Shows DEBUG (only if isDev), INFO, WARN, ERROR
 * - INFO: Shows INFO, WARN, ERROR
 * - WARN: Shows WARN, ERROR
 * - ERROR: Shows ERROR only
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

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

// Read LOG_LEVEL from environment variable
const getLogLevel = (): LogLevel => {
  // Browser context with Vite
  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_LOG_LEVEL) {
    const level = (import.meta as any).env.VITE_LOG_LEVEL.toUpperCase();
    if (level === 'DEBUG' || level === 'INFO' || level === 'WARN' || level === 'ERROR') {
      return level as LogLevel;
    }
  }
  // Node/server context
  const globalProcess = (globalThis as any).process;
  if (typeof globalProcess !== 'undefined' && globalProcess.env?.LOG_LEVEL) {
    const level = globalProcess.env.LOG_LEVEL.toUpperCase();
    if (level === 'DEBUG' || level === 'INFO' || level === 'WARN' || level === 'ERROR') {
      return level as LogLevel;
    }
  }
  // Default to INFO
  return 'INFO';
};

const currentLogLevel = getLogLevel();
const devMode = isDev();

// Helper function to check if a log level should be shown
const shouldLog = (level: LogLevel): boolean => {
  switch (currentLogLevel) {
    case 'DEBUG':
      // DEBUG logs only show if LOG_LEVEL is DEBUG AND isDev is true
      if (level === 'DEBUG') {
        return devMode;
      }
      return true; // All other levels shown
    case 'INFO':
      return level === 'INFO' || level === 'WARN' || level === 'ERROR';
    case 'WARN':
      return level === 'WARN' || level === 'ERROR';
    case 'ERROR':
      return level === 'ERROR';
    default:
      return true; // Fallback: show all
  }
};

export const logger = {
  /** Debug logs - only shown if LOG_LEVEL='DEBUG' AND isDev() is true */
  debug: (...args: unknown[]): void => {
    if (shouldLog('DEBUG')) {
      console.log('[DEBUG]', ...args);
    }
  },
  
  /** Info logs - shown if LOG_LEVEL is 'DEBUG' or 'INFO' */
  info: (...args: unknown[]): void => {
    if (shouldLog('INFO')) {
      console.log('[INFO]', ...args);
    }
  },
  
  /** Warning logs - shown if LOG_LEVEL is 'DEBUG', 'INFO', or 'WARN' */
  warn: (...args: unknown[]): void => {
    if (shouldLog('WARN')) {
      console.warn('[WARN]', ...args);
    }
  },
  
  /** Error logs - always shown regardless of LOG_LEVEL */
  error: (...args: unknown[]): void => {
    if (shouldLog('ERROR')) {
      console.error('[ERROR]', ...args);
    }
  }
};

export type Logger = typeof logger;

/**
 * Simple logger utility that can be toggled for production
 * Debug logs are only shown in development mode
 */

const DEBUG = typeof import.meta !== 'undefined' 
  ? import.meta.env?.DEV ?? false 
  : false;

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


/**
 * Simple logger utility for game debugging
 */

const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
} as const;

type LogLevel = keyof typeof LOG_LEVELS;

// Set to 'debug' for development, 'warn' or 'error' for production
const CURRENT_LOG_LEVEL: LogLevel = 'debug';

function shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[CURRENT_LOG_LEVEL];
}

export const logger = {
    debug: (...args: any[]) => {
        if (shouldLog('debug')) {
            console.log('[DEBUG]', ...args);
        }
    },
    info: (...args: any[]) => {
        if (shouldLog('info')) {
            console.info('[INFO]', ...args);
        }
    },
    warn: (...args: any[]) => {
        if (shouldLog('warn')) {
            console.warn('[WARN]', ...args);
        }
    },
    error: (...args: any[]) => {
        if (shouldLog('error')) {
            console.error('[ERROR]', ...args);
        }
    },
};


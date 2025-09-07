/**
 * Manages WebSocket reconnection logic with exponential backoff
 * Extracted from GameWebSocketClient for better separation of concerns
 */
export interface ReconnectionConfig {
    maxAttempts: number;
    initialDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
}

export interface ReconnectionCallbacks {
    onReconnectAttempt?: (attempt: number, delay: number) => void;
    onReconnectSuccess?: () => void;
    onReconnectFailed?: (error: Error) => void;
    onMaxAttemptsReached?: () => void;
}

export class ReconnectionManager {
    private config: ReconnectionConfig;
    private callbacks: ReconnectionCallbacks;

    private attempts = 0;
    private timeoutId: number | null = null;
    private isActive = false;

    constructor(
        config: Partial<ReconnectionConfig> = {},
        callbacks: ReconnectionCallbacks = {}
    ) {
        this.config = {
            maxAttempts: 3,
            initialDelayMs: 1000,
            maxDelayMs: 10000,
            backoffMultiplier: 2,
            ...config
        };
        this.callbacks = callbacks;
    }

    start(reconnectFunction: () => Promise<void>): void {
        if (this.isActive) {
            this.stop(); // Clear any existing reconnection
        }

        this.isActive = true;
        this.scheduleReconnect(reconnectFunction);
    }

    stop(): void {
        this.isActive = false;

        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
    }

    reset(): void {
        this.attempts = 0;
        this.stop();
    }

    hasReachedMaxAttempts(): boolean {
        return this.attempts >= this.config.maxAttempts;
    }

    getStatus() {
        return {
            attempts: this.attempts,
            maxAttempts: this.config.maxAttempts,
            isActive: this.isActive,
            hasReachedMax: this.hasReachedMaxAttempts()
        };
    }

    /**
     * Calculate delay using exponential backoff
     */
    private calculateDelay(): number {
        const delay = this.config.initialDelayMs * Math.pow(this.config.backoffMultiplier, this.attempts);
        return Math.min(delay, this.config.maxDelayMs);
    }

    private scheduleReconnect(reconnectFunction: () => Promise<void>): void {
        if (!this.isActive || this.hasReachedMaxAttempts()) {
            if (this.hasReachedMaxAttempts()) {
                this.callbacks.onMaxAttemptsReached?.();
            }
            return;
        }

        const delay = this.calculateDelay();

        this.callbacks.onReconnectAttempt?.(this.attempts + 1, delay);

        this.timeoutId = window.setTimeout(async () => {
            if (!this.isActive) return;

            this.attempts++;

            try {
                await reconnectFunction();
                this.callbacks.onReconnectSuccess?.();
                this.reset(); // Reset on successful reconnection
            } catch (error) {
                const reconnectError = error instanceof Error ? error : new Error('Reconnection failed');
                this.callbacks.onReconnectFailed?.(reconnectError);

                // Schedule next attempt if we haven't reached max
                if (!this.hasReachedMaxAttempts()) {
                    this.scheduleReconnect(reconnectFunction);
                } else {
                    this.callbacks.onMaxAttemptsReached?.();
                    this.isActive = false;
                }
            }
        }, delay);
    }

    updateConfig(newConfig: Partial<ReconnectionConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }

    updateCallbacks(newCallbacks: ReconnectionCallbacks): void {
        this.callbacks = { ...this.callbacks, ...newCallbacks };
    }
}

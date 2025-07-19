import type {WorldConflictGameRecord} from "$lib/storage/world-conflict";

// Update with your deployed worker URL
const WORKER_URL = 'https://svelte-world-conflict-websocket.barrybecker4.workers.dev';

const LOCAL_URLS = [
    'http://localhost:8787',
    'http://127.0.0.1:8787',
];

export class WebSocketNotificationHelper {

    /**
     * Send a game update notification
     */
    static async sendGameUpdate(gameState: WorldConflictGameRecord, platform: App.Platform): Promise<void> {
        console.log(`🔔 Sending gameUpdate notification for game ${gameState.gameId}`);

        const message = this.createMessage(gameState, 'gameUpdate');
        await this.sendNotification(gameState.gameId, message, platform);
    }

    private static createMessage(gameState: WorldConflictGameRecord, type: string) {
        return {
            type,
            gameId: gameState.gameId,
            data: {
                ...gameState,
            },
            timestamp: Date.now()
        };
    }

    /**
     * HTTP POST to WebSocket worker with retry and fallback
     */
    private static async sendNotification(gameId: string, message: any, platform: App.Platform): Promise<void> {
        const isLocalDevelopment = this.isLocalDev(platform);

        if (!isLocalDevelopment) {
            if (await this.sendMessageToWorker(WORKER_URL, message, gameId)) {
                return;
            }
        }

        for (const url of LOCAL_URLS) {
            if (await this.sendMessageToWorker(url, message, gameId)) {
                return;
            }
        }

        this.logWarning(gameId);
    }

    private static async sendMessageToWorker(workerUrl: string, message: any, gameId: string): Promise<boolean> {
        try {
            await this.sendToWorker(workerUrl, gameId, message);
            console.log(`✅ Successfully sent notification via ${workerUrl}`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to send to worker:`, error);
            return false;
        }
    }

    /**
     * Send notification to a specific worker URL
     */
    private static async sendToWorker(workerUrl: string, gameId: string, message: any): Promise<void> {
        const response = await fetch(`${workerUrl}/notify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'svelte-ttt-server' // Help identify the source
            },
            body: JSON.stringify({ gameId, message }),
            // Add timeout for local development
            signal: AbortSignal.timeout(4000)
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => 'No response body');
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const result = await response.json().catch(() => ({ success: true }));
        console.log(`✅ ${message.type} notification sent successfully to ${workerUrl}:`, result);
    }

    private static logWarning(gameId: string) {
        console.warn(`⚠️ Could not send WebSocket notification for game ${gameId}. WebSocket worker might not be running.`);
        console.warn(`⚠️ Make sure WebSocket worker is running: cd websocket-worker && npm run dev`);
    }

    /**
     * Simple environment detection
     */
    static getEnvironmentInfo(platform: App.Platform) {
        const isLocalDevelopment = this.isLocalDev(platform);
        return {
            isLocalDevelopment,
            webSocketNotificationsAvailable: true // Always true since we just use HTTP
        };
    }

    private static isLocalDev(platform: App.Platform): boolean {
        return !platform?.env?.WEBSOCKET_HIBERNATION_SERVER;
    }
}

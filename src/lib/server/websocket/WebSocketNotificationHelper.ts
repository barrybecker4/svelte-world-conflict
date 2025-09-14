import type { GameRecord } from "$lib/serber/storage/GameStorage";
import { WORKER_URL } from '$lib/server/api-utils.ts';

const LOCAL_URLS = [
    'http://localhost:8787',
    'http://127.0.0.1:8787',
];

export class WebSocketNotificationHelper {

    /**
     * Send a game update notification
     */
    static async sendGameUpdate(gameState: GameRecord, platform: App.Platform): Promise<void> {
        console.log(`Sending gameUpdate notification for game ${gameState.gameId}`);
        console.log('📤 Sending WebSocket notification:', {
            gameId: gameState.gameId,
            hasGameId: !!gameState.gameId,
            notificationData: {
                type: 'gameUpdate',
                gameId: gameState.gameId,
                gameState: gameState.worldConflictState ? 'present' : 'missing'
            }
        });

        const message = this.createMessage(gameState, 'gameUpdate');
        await this.sendNotification(gameState.gameId, message, platform);
    }

    private static createMessage(gameState: GameRecord, type: string) {
        return {
            type,
            gameId: gameState.gameId,
            gameState: gameState.worldConflictState,
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
            console.log(`✅ Successfully sent notification via ${workerUrl} for game ${gameId}`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to send to worker:`, error);
            return false;
        }
    }

    /**
     * Send notification to WebSocket worker
     * FIXED: Match the format expected by the fixed worker
     */
    private static async sendToWorker(workerUrl: string, gameId: string, message: any): Promise<void> {
        const response = await fetch(`${workerUrl}/notify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'svelte-world-conflict-server'
            },
            body: JSON.stringify({
                gameId,
                message  // Worker expects { gameId, message }
            }),
            signal: AbortSignal.timeout(5000)
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => 'No response body');
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const result = await response.json().catch(() => ({ success: true }));
        console.log(`✅ ${message.type} notification sent to ${workerUrl}:`, result);
    }

    private static logWarning(gameId: string) {
        console.warn(`⚠️ Could not send WebSocket notification for game ${gameId}.`);
        console.warn(`⚠️ Make sure WebSocket worker is running: npm run dev:websocket`);
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

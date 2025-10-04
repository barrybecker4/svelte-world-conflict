/**
 * Manages WebSocket sessions and game subscriptions
 */
export class SessionManager {
    constructor() {
        this.sessions = new Map(); // sessionId -> WebSocket
        this.gameSubscriptions = new Map(); // sessionId -> gameId
    }

    generateSessionId() {
        return Math.random().toString(36).substring(2, 15) +
            Math.random().toString(36).substring(2, 15);
    }

    addSession(sessionId, webSocket) {
        this.sessions.set(sessionId, webSocket);
        console.log(`Session ${sessionId} added`);
    }

    removeSession(sessionId) {
        console.log(`Session ${sessionId} disconnected`);
        this.sessions.delete(sessionId);
        this.gameSubscriptions.delete(sessionId);
    }

    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }

    isSessionConnected(sessionId) {
        const ws = this.sessions.get(sessionId);
        return ws && ws.readyState === 1;
    }

    subscribeToGame(sessionId, gameId) {
        if (!this.sessions.has(sessionId)) {
            throw new Error(`Session ${sessionId} not found`);
        }

        this.gameSubscriptions.set(sessionId, gameId);
        console.log(`Session ${sessionId} subscribed to game ${gameId}`);
    }

    unsubscribeFromGame(sessionId) {
        const gameId = this.gameSubscriptions.get(sessionId);
        if (gameId) {
            this.gameSubscriptions.delete(sessionId);
            console.log(`Session ${sessionId} unsubscribed from game ${gameId}`);
            return gameId;
        }
        return null;
    }

    getSessionGame(sessionId) {
        return this.gameSubscriptions.get(sessionId);
    }

    getGameSessions(gameId) {
        const gameSessions = [];
        for (const [sessionId, subscribedGameId] of this.gameSubscriptions.entries()) {
            if (subscribedGameId === gameId) {
                gameSessions.push(sessionId);
            }
        }
        return gameSessions;
    }

    sendToSession(sessionId, message) {
        const ws = this.sessions.get(sessionId);
        // FIX: Use numeric constant 1 for OPEN state
        if (ws && ws.readyState === 1) {
            try {
                const serialized = JSON.stringify(message);
                console.log(`📤 SessionManager sending to ${sessionId}:`, {
                    messageType: message.type,
                    messageKeys: Object.keys(message),
                    serializedLength: serialized.length,
                    first100chars: serialized.substring(0, 100)
                });

                ws.send(serialized);
                return true;
            } catch (error) {
                console.error(`Error sending to session ${sessionId}:`, error);
                this.removeSession(sessionId);
                return false;
            }
        } else {
            console.warn(`⚠Cannot send to session ${sessionId}: WebSocket not open (readyState: ${ws?.readyState})`);
            return false;
        }
    }

    broadcastToGame(gameId, message) {
        let sentCount = 0;
        const gameSessions = this.getGameSessions(gameId);

        console.log(`Broadcasting to ${gameSessions.length} sessions for game ${gameId}`);

        for (const sessionId of gameSessions) {
            if (this.sendToSession(sessionId, message)) {
                sentCount++;
            }
        }

        console.log(`Successfully broadcast to ${sentCount}/${gameSessions.length} sessions`);
        return sentCount;
    }

    cleanupDisconnectedSessions() {
        let cleanedCount = 0;

        for (const [sessionId, ws] of this.sessions.entries()) {
            if (ws.readyState !== 1) {
                this.removeSession(sessionId);
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            console.log(`Cleaned up ${cleanedCount} disconnected sessions`);
        }

        return cleanedCount;
    }
}
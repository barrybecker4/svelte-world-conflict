/**
 * Manages WebSocket sessions and game subscriptions
 */
export class SessionManager {
  private sessions: Map<string, WebSocket>;
  private gameSubscriptions: Map<string, string>; // sessionId -> gameId
  private playerSessions: Map<string, string>; // sessionId -> playerId

  constructor() {
    this.sessions = new Map();
    this.gameSubscriptions = new Map();
    this.playerSessions = new Map();
  }

  generateSessionId(): string {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }

  addSession(sessionId: string, webSocket: WebSocket): void {
    this.sessions.set(sessionId, webSocket);
    console.log(`Session ${sessionId} added`);
  }

  removeSession(sessionId: string): { gameId?: string; playerId?: string } {
    console.log(`Session ${sessionId} disconnected`);
    const gameId = this.gameSubscriptions.get(sessionId);
    const playerId = this.playerSessions.get(sessionId);
    
    this.sessions.delete(sessionId);
    this.gameSubscriptions.delete(sessionId);
    this.playerSessions.delete(sessionId);
    
    return { gameId, playerId };
  }

  getSession(sessionId: string): WebSocket | undefined {
    return this.sessions.get(sessionId);
  }

  isSessionConnected(sessionId: string): boolean {
    const ws = this.sessions.get(sessionId);
    return ws !== undefined && ws.readyState === 1;
  }

  subscribeToGame(sessionId: string, gameId: string, playerId?: string): void {
    if (!this.sessions.has(sessionId)) {
      throw new Error(`Session ${sessionId} not found`);
    }

    this.gameSubscriptions.set(sessionId, gameId);
    if (playerId) {
      this.playerSessions.set(sessionId, playerId);
      console.log(`Session ${sessionId} subscribed to game ${gameId} as player ${playerId}`);
    } else {
      console.log(`Session ${sessionId} subscribed to game ${gameId} (no player ID - observer)`);
    }
  }

  unsubscribeFromGame(sessionId: string): string | null {
    const gameId = this.gameSubscriptions.get(sessionId);
    if (gameId) {
      this.gameSubscriptions.delete(sessionId);
      console.log(`Session ${sessionId} unsubscribed from game ${gameId}`);
      return gameId;
    }
    return null;
  }

  getSessionGame(sessionId: string): string | undefined {
    return this.gameSubscriptions.get(sessionId);
  }

  getSessionPlayer(sessionId: string): string | undefined {
    return this.playerSessions.get(sessionId);
  }

  getGameSessions(gameId: string): string[] {
    const gameSessions: string[] = [];
    for (const [sessionId, subscribedGameId] of this.gameSubscriptions.entries()) {
      if (subscribedGameId === gameId) {
        gameSessions.push(sessionId);
      }
    }
    return gameSessions;
  }

  sendToSession(sessionId: string, message: any): boolean {
    const ws = this.sessions.get(sessionId);
    // Use numeric constant 1 for OPEN state
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
      console.warn(
        `⚠Cannot send to session ${sessionId}: WebSocket not open (readyState: ${ws?.readyState})`
      );
      return false;
    }
  }

  broadcastToGame(gameId: string, message: any): number {
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

  cleanupDisconnectedSessions(): number {
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

  getAllSessionCount(): number {
    return this.sessions.size;
  }
}

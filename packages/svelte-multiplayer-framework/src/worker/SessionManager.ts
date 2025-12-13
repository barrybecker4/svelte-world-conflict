import type { BaseMessage } from '../shared/types';

/**
 * Session info including game subscription and player identity
 */
export interface SessionInfo {
  webSocket: WebSocket;
  gameId?: string;
  playerId?: string;
}

/**
 * Result of removing a session
 */
export interface SessionRemovalResult {
  gameId?: string;
  playerId?: string;
}

/**
 * Manages WebSocket sessions and game subscriptions
 */
export class SessionManager {
  private sessions: Map<string, SessionInfo>;

  constructor() {
    this.sessions = new Map();
  }

  generateSessionId(): string {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }

  addSession(sessionId: string, webSocket: WebSocket): void {
    this.sessions.set(sessionId, { webSocket });
    console.log(`Session ${sessionId} added`);
  }

  removeSession(sessionId: string): SessionRemovalResult {
    console.log(`Session ${sessionId} disconnected`);
    const session = this.sessions.get(sessionId);
    const result: SessionRemovalResult = {
      gameId: session?.gameId,
      playerId: session?.playerId
    };
    
    this.sessions.delete(sessionId);
    
    return result;
  }

  getSession(sessionId: string): SessionInfo | undefined {
    return this.sessions.get(sessionId);
  }

  isSessionConnected(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    return session !== undefined && session.webSocket.readyState === 1;
  }

  subscribeToGame(sessionId: string, gameId: string, playerId?: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.gameId = gameId;
    if (playerId) {
      session.playerId = playerId;
      console.log(`Session ${sessionId} subscribed to game ${gameId} as player ${playerId}`);
    } else {
      console.log(`Session ${sessionId} subscribed to game ${gameId} (no player ID - observer)`);
    }
  }

  unsubscribeFromGame(sessionId: string): string | null {
    const session = this.sessions.get(sessionId);
    if (session?.gameId) {
      const gameId = session.gameId;
      session.gameId = undefined;
      session.playerId = undefined;
      console.log(`Session ${sessionId} unsubscribed from game ${gameId}`);
      return gameId;
    }
    return null;
  }

  getSessionGame(sessionId: string): string | undefined {
    return this.sessions.get(sessionId)?.gameId;
  }

  getSessionPlayer(sessionId: string): string | undefined {
    return this.sessions.get(sessionId)?.playerId;
  }

  getGameSessions(gameId: string): string[] {
    const gameSessions: string[] = [];
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.gameId === gameId) {
        gameSessions.push(sessionId);
      }
    }
    return gameSessions;
  }

  /**
   * Send a typed message to a specific session
   * @template TMessage - The type of message being sent
   */
  sendToSession<TMessage extends BaseMessage>(sessionId: string, message: TMessage): boolean {
    const session = this.sessions.get(sessionId);
    // Use numeric constant 1 for OPEN state
    if (session && session.webSocket.readyState === 1) {
      try {
        const serialized = JSON.stringify(message);
        console.log(`📤 SessionManager sending to ${sessionId}:`, {
          messageType: message.type,
          messageKeys: Object.keys(message),
          serializedLength: serialized.length,
          first100chars: serialized.substring(0, 100)
        });

        session.webSocket.send(serialized);
        return true;
      } catch (error) {
        console.error(`Error sending to session ${sessionId}:`, error);
        this.removeSession(sessionId);
        return false;
      }
    } else {
      console.warn(
        `⚠Cannot send to session ${sessionId}: WebSocket not open (readyState: ${session?.webSocket.readyState})`
      );
      return false;
    }
  }

  /**
   * Broadcast a typed message to all sessions in a game
   * @template TMessage - The type of message being broadcast
   */
  broadcastToGame<TMessage extends BaseMessage>(gameId: string, message: TMessage): number {
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

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.webSocket.readyState !== 1) {
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

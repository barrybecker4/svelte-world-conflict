import type { GameStateData } from '$lib/game/entities/gameTypes';

export interface EndTurnResponse {
  success?: boolean;
  gameState?: GameStateData;
  message?: string;
}

export interface ResignResponse {
  gameEnded?: boolean;
}

export interface PurchaseUpgradeResponse {
  gameState?: GameStateData;
}

export interface BattleMove {
  sourceRegionIndex: number;
  targetRegionIndex: number;
  soldierCount: number;
  gameState: GameStateData;
}

export interface BattleResult {
  success: boolean;
  gameState?: GameStateData;
  attackSequence?: any[];
  error?: string;
}

/**
 * Client for making API calls to the game server
 */
export class GameApiClient {
  constructor(private gameId: string) {}

  /**
   * Handle API response - throws on error, returns JSON on success
   */
  private async handleResponse<T>(response: Response, operation: string): Promise<T> {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(errorData.error || `Failed to ${operation}`);
    }
    return response.json() as Promise<T>;
  }

  /**
   * End the current player's turn
   */
  async endTurn(playerId: string, pendingMoves?: any[]): Promise<EndTurnResponse> {
    const response = await fetch(`/api/game/${this.gameId}/end-turn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId,
        moves: pendingMoves || []
      })
    });

    return this.handleResponse<EndTurnResponse>(response, 'end turn');
  }

  /**
   * Resign from the game
   */
  async resign(playerId: string): Promise<ResignResponse> {
    const response = await fetch(`/api/game/${this.gameId}/quit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId,
        reason: 'RESIGN'
      })
    });

    return this.handleResponse<ResignResponse>(response, 'resign from game');
  }
}

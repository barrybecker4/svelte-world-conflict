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
   * End the current player's turn
   */
  async endTurn(playerId: string, pendingMoves?: any[]): Promise<EndTurnResponse> {
    console.log('🔚 GameApiClient.endTurn called', {
      playerId,
      pendingMovesCount: pendingMoves?.length || 0
    });

    const response = await fetch(`/api/game/${this.gameId}/end-turn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId,
        moves: pendingMoves || [] // Include pending moves to be processed
      })
    });

    console.log('📡 End turn response:', response.status, response.ok);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { error?: string };
      console.error('❌ End turn failed:', errorData);
      throw new Error(errorData.error || 'Failed to end turn');
    }

    const result = await response.json() as EndTurnResponse;
    console.log('✅ Turn ended successfully:', result);
    return result;
  }

  /**
   * Resign from the game
   */
  async resign(playerId: string): Promise<ResignResponse> {
    console.log('🏳️ GameApiClient.resign called');

    const response = await fetch(`/api/game/${this.gameId}/quit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId,
        reason: 'RESIGN'
      })
    });

    console.log('Resign response:', response.status, response.ok);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { error?: string };
      console.error('❌ Resign failed:', errorData);
      throw new Error(errorData.error || 'Failed to resign from game');
    }

    const result = await response.json() as ResignResponse;
    console.log('✅ Resigned successfully:', result);
    return result;
  }

}

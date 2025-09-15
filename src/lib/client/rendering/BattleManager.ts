import { BattleAnimationSystem } from './BattleAnimationSystem';
import { audioSystem } from '$lib/client/audio/AudioSystem';
import { SOUNDS } from '$lib/client/audio/sounds';

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
 * Manages all battle-related operations including animations, timeouts, and state coordination
 */
export class BattleManager {
  private battleAnimationSystem: BattleAnimationSystem;
  private battleTimeouts = new Map<number, number>();
  private gameId: string;

  constructor(gameId: string, mapContainer?: HTMLElement) {
    this.gameId = gameId;
    this.battleAnimationSystem = new BattleAnimationSystem();

    if (mapContainer) {
      this.battleAnimationSystem.setMapContainer(mapContainer);
    }
  }

  setMapContainer(container: HTMLElement): void {
    this.battleAnimationSystem.setMapContainer(container);
  }

  isBattleRequired(move: BattleMove): boolean {
    const { targetRegionIndex, gameState } = move;

    const targetSoldiers = gameState.soldiersByRegion?.[targetRegionIndex] || [];
    const targetOwner = gameState.ownersByRegion?.[targetRegionIndex];
    const playerIndex = gameState.playerIndex;

    const isNeutralWithSoldiers = targetOwner === undefined && targetSoldiers.length > 0;
    const isEnemyTerritory = targetOwner !== undefined && targetOwner !== playerIndex && targetSoldiers.length > 0;

    return isNeutralWithSoldiers || isEnemyTerritory;
  }

  async executeMove(move: BattleMove, playerId: string, regions: Region[]): Promise<BattleResult> {
    if (this.isBattleRequired(move)) {
      return this.executeBattle(move, playerId, regions);
    } else {
      return this.executePeacefulMove(move, playerId);
    }
  }

  async executeBattle(move: BattleMove, playerId: string, regions: Region[]): Promise<BattleResult> {
    const { sourceRegionIndex, targetRegionIndex, soldierCount } = move;

    console.log('🏛️ BattleManager: Starting battle execution', {
      source: sourceRegionIndex,
      target: targetRegionIndex,
      soldiers: soldierCount
    });

    try {
      this.startBattleTimeout(targetRegionIndex);
      const battleState = this.createBattleState(move.gameState, targetRegionIndex, move);
      const result = await this.sendBattleToServer(move, playerId);

      if (result.attackSequence && result.attackSequence.length > 0) {
        await this.playBattleAnimation(result.attackSequence, regions);
      }

      this.clearBattleTimeout(targetRegionIndex);

      if (result.gameState) {
        result.gameState = this.clearBattleState(result.gameState);
      }

      console.log('✅ BattleManager: Battle completed successfully');
      return result;

    } catch (error) {
      console.error('❌ BattleManager: Battle failed:', error);
      this.clearBattleTimeout(targetRegionIndex);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown battle error',
        gameState: this.clearBattleState(move.gameState)
      };
    }
  }

  /**
   * Execute a non-battle move (peaceful territory occupation)
   */
  async executePeacefulMove(move: BattleMove, playerId: string): Promise<BattleResult> {
    const { sourceRegionIndex, targetRegionIndex, soldierCount } = move;

    console.log('🕊️ BattleManager: Executing peaceful move', {
      source: sourceRegionIndex,
      target: targetRegionIndex,
      soldiers: soldierCount
    });

    try {
      audioSystem.playSound(SOUNDS.MOVE);
      const result = await this.sendMoveToServer(move, playerId);
      console.log('✅ BattleManager: Peaceful move completed successfully');
      return result;
    } catch (error) {
      console.error('❌ BattleManager: Peaceful move failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown move error'
      };
    }
  }

  /**
   * Play battle animation sequence
   */
  private async playBattleAnimation(attackSequence: any[], regions?: Region[]): Promise<void> {
    console.log('🎬 BattleManager: Playing attack sequence');

    try {
      await this.battleAnimationSystem.playAttackSequence(attackSequence, regions);
    } catch (error) {
      console.warn('⚠️ BattleManager: Animation failed, continuing without animation:', error);
    }
  }

  /**
   * Create battle state for immediate UI feedback
   */
  private createBattleState(gameState: GameStateData, battleRegionIndex: number, move: BattleMove): GameStateData {
    return {
      ...gameState,
      battlesInProgress: [...new Set([...(gameState.battlesInProgress || []), battleRegionIndex])],
      pendingMoves: [
        ...(gameState.pendingMoves || []),
        {
          from: move.sourceRegionIndex,
          to: move.targetRegionIndex,
          count: move.soldierCount
        }
      ]
    };
  }

  private clearBattleState(gameState: GameStateData): GameStateData {
    return {
      ...gameState,
      battlesInProgress: [],
      pendingMoves: []
    };
  }

  private async sendBattleToServer(move: BattleMove, playerId: string): Promise<BattleResult> {
    return this.sendMoveToServer(move, playerId);
  }

  private async sendMoveToServer(move: BattleMove, playerId: string): Promise<BattleResult> {
    const { sourceRegionIndex, targetRegionIndex, soldierCount } = move;

    const response = await fetch(`/api/game/${this.gameId}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        moveType: 'ARMY_MOVE',
        playerId,
        source: sourceRegionIndex,
        destination: targetRegionIndex,
        count: soldierCount
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    return {
      success: true,
      gameState: result.gameState,
      attackSequence: result.attackSequence
    };
  }

  /**
   * Start battle timeout to prevent stuck battles
   */
  private startBattleTimeout(regionIndex: number): void {
    console.log('⏰ BattleManager: Starting battle timeout for region', regionIndex);

    const timeoutId = setTimeout(() => {
      console.warn('⚠️ BattleManager: Battle timeout reached for region', regionIndex);
      this.clearBattleTimeout(regionIndex);
    }, 3000);

    this.battleTimeouts.set(regionIndex, timeoutId);
  }

  /**
   * Clear battle timeout for a specific region
   */
  private clearBattleTimeout(regionIndex: number): void {
    const timeoutId = this.battleTimeouts.get(regionIndex);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.battleTimeouts.delete(regionIndex);
      console.log('🔄 BattleManager: Cleared battle timeout for region', regionIndex);
    }
  }

  clearAllBattleTimeouts(): void {
    console.log('🧹 BattleManager: Clearing all battle timeouts');
    this.battleTimeouts.forEach(timeout => clearTimeout(timeout));
    this.battleTimeouts.clear();
  }

  getBattleAnimationSystem(): BattleAnimationSystem {
    return this.battleAnimationSystem;
  }

  hasActiveBattles(): boolean {
    return this.battleTimeouts.size > 0;
  }

  getActiveBattleRegions(): number[] {
    return Array.from(this.battleTimeouts.keys());
  }

  destroy(): void {
    console.log('💥 BattleManager: Destroying and cleaning up');
    this.clearAllBattleTimeouts();
  }
}

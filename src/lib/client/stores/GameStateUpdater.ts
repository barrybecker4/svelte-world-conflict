import type { Writable } from 'svelte/store';
import { turnManager } from '$lib/game/mechanics/TurnManager';
import type { MoveSystem } from '$lib/game/mechanics/MoveSystem';
import { MoveReplayer } from '$lib/client/feedback/MoveReplayer';
import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';
import { audioSystem } from '$lib/client/audio/AudioSystem';
import { SOUNDS } from '$lib/client/audio/sounds';
import type { GameStateData, Player, Region } from '$lib/game/entities/gameTypes';

/**
 * Manages WebSocket game state updates with proper queuing and orchestration.
 *
 * Handles the complex flow of:
 * - Queuing multiple rapid updates
 * - Turn transition detection and banner coordination
 * - Elimination detection and banner display
 * - Move replay for other players' actions (timing handled by MoveReplayer)
 * - Audio feedback
 */
export class GameStateUpdater {
  private updateQueue: any[] = [];
  private isProcessingUpdate = false;
  private lastRawState: GameStateData | null = null; // Track raw state without overrides
  private onTurnReadyCallback: ((gameState: GameStateData) => void) | null = null;
  private isBattleInProgressCallback: (() => boolean) | null = null;

  constructor(
    private gameStateStore: Writable<GameStateData | null>,
    private regionsStore: Writable<Region[]>,
    private playersStore: Writable<Player[]>,
    private eliminationBannersStore: Writable<number[]>,
    private playerSlotIndex: number,
    private getMoveSystem: () => MoveSystem | null,
    private moveReplayer: MoveReplayer,
    private showEliminationBanner: (playerSlotIndex: number) => void
  ) {}

  /**
   * Set callback to be called when player's turn is ready for interaction
   */
  setOnTurnReadyCallback(callback: (gameState: GameStateData) => void): void {
    this.onTurnReadyCallback = callback;
  }

  /**
   * Set callback to check if a battle is currently in progress
   */
  setIsBattleInProgressCallback(callback: () => boolean): void {
    this.isBattleInProgressCallback = callback;
  }

  /**
   * Check for player eliminations and show banners immediately
   */
  private checkForEliminations(gameState: GameStateData): void {
    const players = gameState.players || [];
    const ownersByRegion = gameState.ownersByRegion || {};

    // Count regions owned by each player
    const regionCounts = new Map<number, number>();
    for (const playerSlotIndex of Object.values(ownersByRegion)) {
      regionCounts.set(playerSlotIndex, (regionCounts.get(playerSlotIndex) || 0) + 1);
    }

    // Check each player - if they have 0 regions, they're eliminated
    for (const player of players) {
      const regionCount = regionCounts.get(player.slotIndex) || 0;
      if (regionCount === 0) {
        console.log(`💀 Player ${player.name} (slot ${player.slotIndex}) has been eliminated!`);
        this.showEliminationBanner(player.slotIndex);
      }
    }
  }

  /**
   * Handle WebSocket game state updates
   * Updates are queued to ensure banners complete before next update
   */
  handleGameStateUpdate(updatedState: any) {
    console.log('🎮 Received game update via WebSocket:', updatedState);

    // Add to queue
    this.updateQueue.push(updatedState);

    // Start processing if not already processing
    if (!this.isProcessingUpdate) {
      this.processNextUpdate();
    }
  }


  /**
   * Process queued updates one at a time
   */
  private async processNextUpdate() {
    if (this.updateQueue.length === 0) {
      this.isProcessingUpdate = false;
      return;
    }

    // Wait if a battle is in progress
    if (this.isBattleInProgressCallback && this.isBattleInProgressCallback()) {
      console.log('⏸️ Battle in progress, delaying WebSocket update...');
      // Retry after a short delay
      setTimeout(() => this.processNextUpdate(), 100);
      return;
    }

    this.isProcessingUpdate = true;
    const updatedState = this.updateQueue.shift();

    // Use lastRawState for comparison (not the display state which might have overrides)
    const currentState = this.lastRawState;

    // Check if turn changed (either player changed OR turn number increased, indicating a full round)
    const playerChanged = currentState && updatedState.currentPlayerSlot !== currentState.currentPlayerSlot;
    const turnNumberIncreased = currentState && updatedState.turnNumber > currentState.turnNumber;
    const isNewTurn = playerChanged || turnNumberIncreased;
    const isOtherPlayersTurn = updatedState.currentPlayerSlot !== this.playerSlotIndex;

    console.log('🎯 Turn transition check:', {
        'currentState.currentPlayerSlot': currentState?.currentPlayerSlot,
        'currentState.turnNumber': currentState?.turnNumber,
        'updatedState.currentPlayerSlot': updatedState.currentPlayerSlot,
        'updatedState.turnNumber': updatedState.turnNumber,
        'my playerSlotIndex': this.playerSlotIndex,
        'playerChanged': playerChanged,
        'turnNumberIncreased': turnNumberIncreased,
        'isNewTurn': isNewTurn,
        'isOtherPlayersTurn': isOtherPlayersTurn,
        'queueLength': this.updateQueue.length
    });

    // Ensure battle states are cleared from server updates
    const cleanState = {
      ...updatedState,
      battlesInProgress: [], // Force clear
      pendingMoves: []       // Force clear
    };

    // Check for eliminations in the updated state (e.g., from AI moves)
    this.checkForEliminations(cleanState);

    if (isNewTurn) {
      console.log('🔄 Turn transition detected - showing turn banner for slot:', updatedState.currentPlayerSlot);
        
        // Update players store BEFORE transition so TurnManager can use updated list
        this.playersStore.set(cleanState.players || []);
        
        console.log('🎯 About to transition to player:', {
          currentPlayerSlot: cleanState.currentPlayerSlot,
          playerName: cleanState.players?.find((p: any) => p.slotIndex === cleanState.currentPlayerSlot)?.name,
          allPlayers: cleanState.players?.map((p: any) => ({ name: p.name, slot: p.slotIndex }))
        });
        
        await turnManager.transitionToPlayer(cleanState.currentPlayerSlot, cleanState);

        // Play appropriate sounds and handle animations based on whose turn it is
        if (isOtherPlayersTurn) {
          // DON'T update game state yet - keep old state for animations
          // The animations will update to intermediate states, then we apply final state
          
          // It's another player's turn - wait for banner, then replay moves
          await new Promise<void>((resolve) => {
            setTimeout(() => resolve(), GAME_CONSTANTS.BANNER_TIME);
          });

          // Detect and replay moves using state comparison
          console.log('📼 Detecting and replaying moves from state diff');
          await this.moveReplayer.replayMoves(updatedState, currentState);
          
          // NOW apply the final state after animations complete
          this.gameStateStore.set(cleanState);
          this.regionsStore.set(cleanState.regions || []);
          this.playersStore.set(cleanState.players || []);
        } else {
          // It's now our turn
          audioSystem.playSound(SOUNDS.GAME_STARTED);

          // Wait for banner to complete
          await new Promise<void>((resolve) => {
            setTimeout(() => resolve(), GAME_CONSTANTS.BANNER_TIME + 100);
          });
          
          // Apply state after banner
          this.gameStateStore.set(cleanState);
          this.regionsStore.set(cleanState.regions || []);
          this.playersStore.set(cleanState.players || []);

          // Notify that our turn is ready for interaction (after banner completes)
          if (this.onTurnReadyCallback) {
            console.log('⏰ Turn is ready - notifying callback');
            this.onTurnReadyCallback(cleanState);
          }
        }
    } else {
      // Same player slot - could be our move or another player's move (in multiplayer)
      console.log('🔄 Same player slot move detected');
      turnManager.updateGameState(cleanState);

      // Only replay moves if it's another player's turn (to avoid double animations)
      // When it's our own move, BattleManager already animated it
      if (isOtherPlayersTurn) {
        console.log('🔄 Replaying other player\'s move');
        // DON'T update game state yet - keep old state for animations
        
        // Detect and replay moves using state comparison
        console.log('📼 Detecting and replaying moves from state diff');
        await this.moveReplayer.replayMoves(updatedState, currentState);
        
        // NOW apply the final state after animations complete
        this.gameStateStore.set(cleanState);
        this.regionsStore.set(cleanState.regions || []);
        this.playersStore.set(cleanState.players || []);
      } else {
        console.log('✅ Applying update for our own move (already animated by BattleManager)');
        // For our own moves, BattleManager already animated and GameController will update
        // But we still need to apply this state update (it might be the GameController update)
        this.gameStateStore.set(cleanState);
        this.regionsStore.set(cleanState.regions || []);
        this.playersStore.set(cleanState.players || []);
      }
    }

    const moveSystem = this.getMoveSystem();
    if (moveSystem) {
      moveSystem.updateGameState(cleanState);
    }

    // Store raw state for NEXT comparison (after we've used currentState for this update)
    this.lastRawState = cleanState;

    // Process next update in queue
    this.processNextUpdate();
  }
}

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
 * - Elimination banner sequencing
 * - Move replay for other players' actions (timing handled by MoveReplayer)
 * - Audio feedback
 */
export class GameStateUpdater {
  private updateQueue: any[] = [];
  private isProcessingUpdate = false;
  private lastRawState: GameStateData | null = null; // Track raw state without overrides

  constructor(
    private gameStateStore: Writable<GameStateData | null>,
    private regionsStore: Writable<Region[]>,
    private playersStore: Writable<Player[]>,
    private eliminationBannersStore: Writable<number[]>,
    private playerSlotIndex: number,
    private getMoveSystem: () => MoveSystem | null,
    private moveReplayer: MoveReplayer
  ) {}


  /**
   * Detect conquests and dispatch battleAnimationStart events BEFORE applying state.
   * This prevents ownership from changing visually before animations play.
   * BattleAnimationUpdater handles the event and sets up the actual overrides.
   */
  private initializeBattleOverridesForConquests(newState: any, oldState: any): void {
    if (typeof window === 'undefined') return;

    const newOwners = newState.ownersByRegion || {};
    const oldOwners = oldState.ownersByRegion || {};
    const oldSoldiers = oldState.soldiersByRegion || {};
    const newSoldiers = newState.soldiersByRegion || {};
    const regions = newState.regions || [];

    // Check all regions for ownership changes
    for (const regionIndex of Object.keys(newOwners)) {
      const idx = parseInt(regionIndex);
      const newOwner = newOwners[idx];
      const oldOwner = oldOwners[idx];
      const oldCount = (oldSoldiers[idx] || []).length;
      const newCount = (newSoldiers[idx] || []).length;

      // Detect conquest (ownership changed OR neutral with defenders was taken)
      const isEnemyConquest = oldOwner !== undefined && newOwner !== oldOwner;
      const isNeutralConquest = oldOwner === undefined && oldCount > 0 && newOwner !== undefined;
      const isPeacefulExpansion = oldOwner === undefined && oldCount === 0 && newOwner !== undefined;
      const isConquest = isEnemyConquest || isNeutralConquest;
      const isAnyOwnershipChange = isConquest || isPeacefulExpansion;

      if (isAnyOwnershipChange) {
        // Find source region (neighbor that lost soldiers and has new owner)
        let sourceRegion = 0;
        const targetRegion = regions.find((r: any) => r.index === idx);
        if (targetRegion) {
          for (const neighborIdx of targetRegion.neighbors || []) {
            const oldNeighborCount = (oldSoldiers[neighborIdx] || []).length;
            const newNeighborCount = (newState.soldiersByRegion[neighborIdx] || []).length;
            if (newNeighborCount < oldNeighborCount && newOwners[neighborIdx] === newOwner) {
              sourceRegion = neighborIdx;
              break;
            }
          }
        }

        // Dispatch appropriate event based on whether it's a battle or peaceful movement
        if (isPeacefulExpansion) {
          // For peaceful movements, just freeze the ownership until movement completes
          window.dispatchEvent(new CustomEvent('movementAnimationStart', {
            detail: {
              targetRegion: idx,
              oldOwner: oldOwner, // undefined for neutral
              newOwner: newOwner
            }
          }));
        } else {
          // For battles, set up full battle animation overrides
          window.dispatchEvent(new CustomEvent('battleAnimationStart', {
            detail: {
              sourceRegion,
              targetRegion: idx,
              sourceCount: (oldSoldiers[sourceRegion] || []).length,
              targetCount: oldCount,
              targetOwner: oldOwner
            }
          }));
        }
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

    // IMPORTANT: Dispatch battleAnimationStart events BEFORE applying state to prevent
    // ownership from changing visually before animations play (for AI/multiplayer replays)
    if (isOtherPlayersTurn && currentState) {
      console.log('🎬 Setting up battle overrides for other player turn BEFORE state update');
      this.initializeBattleOverridesForConquests(cleanState, currentState);
      // Wait for Svelte's reactivity to process the override stores before applying new state
      // This ensures the derived displayGameState has the overrides active
      await new Promise<void>(resolve => requestAnimationFrame(() => {
        console.log('✅ Animation frame complete, overrides should be active');
        resolve();
      }));
    } else {
      console.log('⏭️ Skipping battle override setup:', { isOtherPlayersTurn, hasCurrentState: !!currentState });
    }

    this.gameStateStore.set(cleanState);
    this.regionsStore.set(cleanState.regions || []);
    this.playersStore.set(cleanState.players || []);

    if (isNewTurn) {
      // Check if there are elimination banners from the previous turn
      const hasEliminations = cleanState.previousTurnEliminations && cleanState.previousTurnEliminations.length > 0;

      if (hasEliminations) {
        console.log('💀 Players eliminated in previous turn:', cleanState.previousTurnEliminations);
        // Set the elimination banners - they will render and block the turn transition
        this.eliminationBannersStore.set([...cleanState.previousTurnEliminations!]);

        // Wait for user to dismiss all elimination banners before proceeding
        console.log('💀 Waiting for elimination banners to be dismissed...');
        await new Promise<void>((resolve) => {
          const checkInterval = setInterval(() => {
            let currentBanners: number[] = [];
            const unsubscribe = this.eliminationBannersStore.subscribe(b => { currentBanners = b; });
            unsubscribe();

            if (currentBanners.length === 0) {
              console.log('💀 All elimination banners dismissed');
              clearInterval(checkInterval);
              resolve();
            }
          }, 50); // Check every 50ms
        });
      }

      // Now that elimination banners are done (or there were none), show turn banner
      console.log('🔄 Turn transition detected - showing turn banner');
      await turnManager.transitionToPlayer(cleanState.currentPlayerSlot, cleanState);

      // Play appropriate sounds based on whose turn it is
      if (isOtherPlayersTurn) {
        // It's another player's turn - wait for banner, then replay moves
        await new Promise<void>((resolve) => {
          setTimeout(() => resolve(), GAME_CONSTANTS.BANNER_TIME);
        });

        // Replay moves - MoveReplayer now handles all timing automatically
        await this.moveReplayer.replayMoves(updatedState, currentState);
      } else {
        // It's now our turn
        audioSystem.playSound(SOUNDS.GAME_STARTED);

        // Wait for banner to complete
        await new Promise<void>((resolve) => {
          setTimeout(() => resolve(), GAME_CONSTANTS.BANNER_TIME + 100);
        });
      }
    } else {
      // Same player slot - could be our move or another player's move (in multiplayer)
      console.log('🔄 Same player slot move detected');
      turnManager.updateGameState(cleanState);

      // Only replay moves if it's another player's turn (to avoid double animations)
      // When it's our own move, BattleManager already animated it
      if (isOtherPlayersTurn) {
        console.log('🔄 Replaying other player\'s move');
        // Replay moves from this update - MoveReplayer handles all timing automatically
        await this.moveReplayer.replayMoves(updatedState, currentState);
      } else {
        console.log('✅ Skipping replay for our own move (already animated by BattleManager)');
        // For our own moves, don't clear overrides here - let BattleManager handle it
        // The WebSocket update just updates the underlying state, which shows through when overrides clear
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

import { writable, derived, type Readable, type Writable } from 'svelte/store';
import type { GameStateData } from '$lib/game/entities/gameTypes';

/**
 * Manages battle animation overrides for real-time visual updates during combat.
 * 
 * During battle animations, this updater temporarily overrides soldier counts and
 * region ownership to provide smooth, incremental visual feedback. When battles complete,
 * the overrides are cleared to reveal the final server state.
 */
export class BattleAnimationUpdater {
  private battleAnimationOverrides: Writable<{
    soldierCounts: Record<number, number>;
    ownership: Record<number, number | undefined>;
  }>;
  
  private currentGameStateSnapshot: GameStateData | null = null;
  private gameStateUnsubscribe: (() => void) | null = null;
  
  public readonly displayGameState: Readable<GameStateData | null>;
  
  private eventListeners: Array<{ event: string; listener: EventListener }> = [];
  
  constructor(private gameStateStore: Writable<GameStateData | null>) {
    // Initialize battle animation overrides
    this.battleAnimationOverrides = writable({
      soldierCounts: {},
      ownership: {}
    });
    
    // Create derived store that applies battle animation overrides to the game state
    this.displayGameState = derived(
      [this.gameStateStore, this.battleAnimationOverrides],
      ([$gameState, $overrides]) => {
        if (!$gameState || (Object.keys($overrides.soldierCounts).length === 0 && Object.keys($overrides.ownership).length === 0)) {
          return $gameState;
        }
        
        // Clone the game state and apply overrides
        const modifiedState = { ...$gameState };
        modifiedState.soldiersByRegion = { ...modifiedState.soldiersByRegion };
        modifiedState.ownersByRegion = { ...modifiedState.ownersByRegion };
        
        // Apply soldier count overrides
        for (const [regionIndex, newCount] of Object.entries($overrides.soldierCounts)) {
          const regionIdx = parseInt(regionIndex);
          const currentSoldiers = $gameState.soldiersByRegion?.[regionIdx] || [];
          
          // Adjust soldier array to match the override count
          if (newCount < currentSoldiers.length) {
            modifiedState.soldiersByRegion[regionIdx] = currentSoldiers.slice(0, newCount);
          } else if (newCount > currentSoldiers.length) {
            // This shouldn't happen during battle animations, but handle it anyway
            modifiedState.soldiersByRegion[regionIdx] = [...currentSoldiers];
          } else {
            modifiedState.soldiersByRegion[regionIdx] = currentSoldiers;
          }
        }
        
        // Apply ownership overrides
        for (const [regionIndex, owner] of Object.entries($overrides.ownership)) {
          const regionIdx = parseInt(regionIndex);
          if (owner === undefined) {
            delete modifiedState.ownersByRegion[regionIdx];
          } else {
            modifiedState.ownersByRegion[regionIdx] = owner;
          }
        }
        
        return modifiedState;
      }
    );
    
    // Store reference to current game state for battle animations
    this.gameStateUnsubscribe = this.gameStateStore.subscribe(state => {
      this.currentGameStateSnapshot = state;
    });
    
    // Set up battle animation event listeners
    this.setupEventListeners();
  }
  
  private setupEventListeners() {
    if (typeof window === 'undefined') return;
    
    const battleAnimationStartListener = ((event: CustomEvent) => {
      const { sourceRegion, targetRegion, sourceCount, targetCount, targetOwner } = event.detail;
      console.log(`🎬 Battle animation starting - initializing overrides: Source ${sourceRegion}: ${sourceCount}, Target ${targetRegion}: ${targetCount}, Owner: ${targetOwner}`);
      
      // Initialize overrides with starting counts and ownership to "freeze" the display before animation
      this.battleAnimationOverrides.set({
        soldierCounts: {
          [sourceRegion]: sourceCount,
          [targetRegion]: targetCount
        },
        ownership: {
          [targetRegion]: targetOwner // Preserve original owner during animation
        }
      });
    }) as EventListener;
    
    const battleRoundUpdateListener = ((event: CustomEvent) => {
      const { sourceRegion, targetRegion, attackerLosses, defenderLosses } = event.detail;
      this.updateBattleAnimation(sourceRegion, targetRegion, attackerLosses, defenderLosses);
    }) as EventListener;
    
    const battleCompleteListener = (() => {
      this.clearBattleAnimationOverrides();
    }) as EventListener;
    
    window.addEventListener('battleAnimationStart', battleAnimationStartListener);
    window.addEventListener('battleRoundUpdate', battleRoundUpdateListener);
    window.addEventListener('battleComplete', battleCompleteListener);
    
    // Store listeners for cleanup
    this.eventListeners.push(
      { event: 'battleAnimationStart', listener: battleAnimationStartListener },
      { event: 'battleRoundUpdate', listener: battleRoundUpdateListener },
      { event: 'battleComplete', listener: battleCompleteListener }
    );
  }
  
  /**
   * Update battle animation overrides for real-time soldier count display
   */
  updateBattleAnimation(sourceRegion: number, targetRegion: number, attackerLosses: number, defenderLosses: number) {
    if (!this.currentGameStateSnapshot) return;
    
    this.battleAnimationOverrides.update(overrides => {
      const newOverrides = {
        soldierCounts: { ...overrides.soldierCounts },
        ownership: { ...overrides.ownership }
      };
      
      const sourceSoldiers = this.currentGameStateSnapshot!.soldiersByRegion?.[sourceRegion]?.length || 0;
      const targetSoldiers = this.currentGameStateSnapshot!.soldiersByRegion?.[targetRegion]?.length || 0;
      
      // Apply losses
      const newSourceCount = Math.max(0, (newOverrides.soldierCounts[sourceRegion] ?? sourceSoldiers) - attackerLosses);
      const newTargetCount = Math.max(0, (newOverrides.soldierCounts[targetRegion] ?? targetSoldiers) - defenderLosses);
      
      newOverrides.soldierCounts[sourceRegion] = newSourceCount;
      newOverrides.soldierCounts[targetRegion] = newTargetCount;
      
      console.log(`🎯 Battle animation update: Source ${sourceRegion}: ${sourceSoldiers} -> ${newSourceCount}, Target ${targetRegion}: ${targetSoldiers} -> ${newTargetCount}`);
      
      return newOverrides;
    });
  }
  
  /**
   * Clear battle animation overrides after animation completes
   */
  clearBattleAnimationOverrides() {
    console.log('🎯 Clearing battle animation overrides');
    this.battleAnimationOverrides.set({ soldierCounts: {}, ownership: {} });
  }
  
  /**
   * Cleanup event listeners and subscriptions
   */
  destroy() {
    // Remove event listeners
    if (typeof window !== 'undefined') {
      for (const { event, listener } of this.eventListeners) {
        window.removeEventListener(event, listener);
      }
    }
    this.eventListeners = [];
    
    // Unsubscribe from game state
    if (this.gameStateUnsubscribe) {
      this.gameStateUnsubscribe();
      this.gameStateUnsubscribe = null;
    }
  }
}


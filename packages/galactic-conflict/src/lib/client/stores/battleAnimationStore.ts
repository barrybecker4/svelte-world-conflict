/**
 * Battle Animation Store
 * 
 * Plays back battle replays received from the server
 * Each replay contains the full battle sequence (dice rolls, casualties per round)
 */

import { writable, get, type Writable } from 'svelte/store';
import type { BattleReplay, BattleReplayRound } from '$lib/game/entities/gameTypes';
import { audioSystem, SOUNDS } from '$lib/client/audio';
import { GALACTIC_CONSTANTS } from '$lib/game/constants/gameConstants';

/**
 * Animation state for displaying a battle
 */
export interface BattleAnimationState {
    replay: BattleReplay;
    currentRoundIndex: number;
    displayedAttackerShips: number;
    displayedDefenderShips: number;
    currentDiceRolls: {
        attacker: number[];
        defender: number[];
    } | null;
    lastRoundResult: {
        attackerLost: number;
        defenderLost: number;
    } | null;
    phase: 'starting' | 'round' | 'outcome' | 'done';
    outcomeMessage: string | null;
    /** Pre-battle planet state (ownerId, ships) to preserve suspense during animation */
    preBattlePlanetState: {
        ownerId: number | null;
        ships: number;
    } | null;
}

/**
 * Store for active battle animations (keyed by replay id)
 */
export const battleAnimations: Writable<Map<string, BattleAnimationState>> = writable(new Map());

/**
 * Track which replays we've already started animating
 */
const processedReplayIds = new Set<string>();

/**
 * Queue a battle replay for animation
 */
export function queueBattleReplay(replay: BattleReplay): void {
    // Skip if we've already processed this replay
    if (processedReplayIds.has(replay.id)) {
        return;
    }
    processedReplayIds.add(replay.id);

    console.log(`[BattleAnimation] Queueing replay for ${replay.planetName}: ${replay.attackerInitialShips} vs ${replay.defenderInitialShips}`);

    // Capture pre-battle planet state from replay data
    // This preserves the suspense by showing the planet as it was before the battle
    // The planet in gameState has already been updated with the battle outcome
    const preBattlePlanetState: { ownerId: number | null; ships: number } = {
        ownerId: replay.defenderPlayerId === -1 ? null : replay.defenderPlayerId,
        ships: replay.defenderInitialShips,
    };

    const state: BattleAnimationState = {
        replay,
        currentRoundIndex: -1,
        displayedAttackerShips: replay.attackerInitialShips,
        displayedDefenderShips: replay.defenderInitialShips,
        currentDiceRolls: null,
        lastRoundResult: null,
        phase: 'starting',
        outcomeMessage: null,
        preBattlePlanetState: preBattlePlanetState,
    };

    battleAnimations.update(map => {
        map.set(replay.id, state);
        return new Map(map);
    });

    // Start the animation sequence
    playBattleAnimation(replay.id);
}

/**
 * Play the battle animation sequence
 */
async function playBattleAnimation(replayId: string): Promise<void> {
    const getState = () => get(battleAnimations).get(replayId);
    const state = getState();
    if (!state) return;

    const { replay } = state;

    console.log(`[BattleAnimation] Starting animation for ${replay.planetName} with ${replay.rounds.length} rounds`);

    // Play battle alarm when battle starts
    audioSystem.playSound(SOUNDS.BATTLE_ALARM);

    // Initial pause to show the battle starting
    await delay(600 / GALACTIC_CONSTANTS.BATTLE_REPLAY_SPEED);

    // Play each round
    for (let i = 0; i < replay.rounds.length; i++) {
        const round = replay.rounds[i];
        await playRound(replayId, round, i);
        
        // Check if animation was cancelled
        if (!get(battleAnimations).has(replayId)) {
            return;
        }
    }

    // Show outcome
    await showOutcome(replayId);

    // Mark as done so planet ownership updates immediately
    battleAnimations.update(map => {
        const state = map.get(replayId);
        if (state) {
            state.phase = 'done';
        }
        return new Map(map);
    });

    // Keep outcome visible for a bit, then clean up
    await delay(2500 / GALACTIC_CONSTANTS.BATTLE_REPLAY_SPEED);
    removeBattleAnimation(replayId);
}

/**
 * Play a single round animation
 */
async function playRound(replayId: string, round: BattleReplayRound, roundIndex: number): Promise<void> {
    // Show dice rolls
    battleAnimations.update(map => {
        const state = map.get(replayId);
        if (state) {
            state.phase = 'round';
            state.currentRoundIndex = roundIndex;
            state.currentDiceRolls = {
                attacker: round.attackerDice,
                defender: round.defenderDice,
            };
            state.lastRoundResult = null;
        }
        return new Map(map);
    });

    // Wait for dice to appear
    await delay(400 / GALACTIC_CONSTANTS.BATTLE_REPLAY_SPEED);

    // Show casualties and update ship counts
    battleAnimations.update(map => {
        const state = map.get(replayId);
        if (state) {
            state.lastRoundResult = {
                attackerLost: round.attackerLosses,
                defenderLost: round.defenderLosses,
            };
            state.displayedAttackerShips = round.attackerShipsAfter;
            state.displayedDefenderShips = round.defenderShipsAfter;
        }
        return new Map(map);
    });

    // Play destruction sounds for casualties (staggered)
    const totalCasualties = round.attackerLosses + round.defenderLosses;
    if (totalCasualties > 0) {
        // Play up to 3 destruction sounds, staggered
        const soundCount = Math.min(totalCasualties, 3);
        const soundDelay = 80 / GALACTIC_CONSTANTS.BATTLE_REPLAY_SPEED;
        for (let i = 0; i < soundCount; i++) {
            setTimeout(() => {
                audioSystem.playSound(SOUNDS.SHIP_DESTROYED);
            }, i * soundDelay);
        }
    }

    // Pause between rounds
    await delay(500 / GALACTIC_CONSTANTS.BATTLE_REPLAY_SPEED);
}

/**
 * Show the battle outcome
 */
async function showOutcome(replayId: string): Promise<void> {
    const state = get(battleAnimations).get(replayId);
    if (!state) {
        console.warn(`[BattleAnimation] Cannot show outcome - animation ${replayId} not found`);
        return;
    }

    const { replay } = state;

    let outcomeMessage: string;
    if (replay.winnerId === replay.attackerPlayerId) {
        outcomeMessage = `${replay.attackerName} conquers ${replay.planetName}!`;
        // Play conquest sound for attacker victory
        audioSystem.playSound(SOUNDS.PLANET_CONQUERED);
    } else if (replay.winnerId === replay.defenderPlayerId || replay.winnerId === -1) {
        outcomeMessage = `${replay.defenderName} defend ${replay.planetName}!`;
    } else if (replay.winnerId === null && replay.winnerShipsRemaining === 0) {
        outcomeMessage = 'Mutual destruction!';
    } else {
        outcomeMessage = `${replay.planetName} defended!`;
    }

    console.log(`[BattleAnimation] Showing outcome for ${replay.planetName}: ${outcomeMessage}`);

    battleAnimations.update(map => {
        const state = map.get(replayId);
        if (state) {
            state.phase = 'outcome';
            state.currentDiceRolls = null;
            state.outcomeMessage = outcomeMessage;
            console.log(`[BattleAnimation] Updated animation state - phase: ${state.phase}, message: ${state.outcomeMessage}`);
        } else {
            console.warn(`[BattleAnimation] State not found when updating outcome for ${replayId}`);
        }
        return new Map(map);
    });
    
    // Small delay to ensure the UI updates before continuing
    await delay(100);
}

/**
 * Remove a battle animation
 */
export function removeBattleAnimation(replayId: string): void {
    battleAnimations.update(map => {
        map.delete(replayId);
        return new Map(map);
    });
}

/**
 * Clear all battle animations
 */
export function clearAllBattleAnimations(): void {
    battleAnimations.set(new Map());
    processedReplayIds.clear();
}

/**
 * Process new battle replays from game state
 */
export function processNewBattleReplays(replays: BattleReplay[]): void {
    for (const replay of replays) {
        if (!processedReplayIds.has(replay.id)) {
            queueBattleReplay(replay);
        }
    }
}

/**
 * Helper delay function
 */
function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

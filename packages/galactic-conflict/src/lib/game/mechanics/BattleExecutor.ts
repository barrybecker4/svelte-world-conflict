/**
 * BattleExecutor - Executes battles and generates battle replays
 *
 * Handles:
 * - Creating battle replay structures
 * - Running battle rounds to completion
 * - Applying battle results to game state
 */

import type { Planet, BattleReplay, BattleReplayRound } from '$lib/game/entities/gameTypes';
import { BattleRound } from './BattleRound';
import type { GalacticGameState } from '$lib/game/state/GalacticGameState';
import { GALACTIC_CONSTANTS, NEUTRAL_COLOR } from '$lib/game/constants/gameConstants';
import { getPlayerColor } from '$lib/game/constants/playerConfigs';
import { logger } from 'multiplayer-framework/shared';
import { v4 as uuidv4 } from 'uuid';

export class BattleExecutor {
    private battleRound: BattleRound;

    constructor(private gameState: GalacticGameState) {
        this.battleRound = new BattleRound(gameState.rng);
    }

    /**
     * Execute a complete battle and generate replay
     * 
     * @param planet The planet where the battle occurs
     * @param attackerId The attacking player's ID
     * @param attackerShips Number of attacking ships
     * @param defenderId The defending player's ID (null for neutral)
     * @param defenderShips Number of defending ships
     * @returns The complete battle replay
     */
    executeBattle(
        planet: Planet,
        attackerId: number,
        attackerShips: number,
        defenderId: number | null,
        defenderShips: number
    ): BattleReplay {
        // Create battle replay structure
        const replay = this.createBattleReplay(planet, attackerId, attackerShips, defenderId, defenderShips);
        
        // Run battle rounds to completion
        const battleResult = this.runBattleToCompletion(replay, attackerShips, defenderShips);
        
        // Apply results to game state
        this.applyBattleResult(planet, attackerId, defenderId, battleResult, replay);
        
        return replay;
    }

    /**
     * Create a battle replay object with initial state
     */
    private createBattleReplay(
        planet: Planet,
        attackerId: number,
        attackerShips: number,
        defenderId: number | null,
        defenderShips: number
    ): BattleReplay {
        const attackerPlayer = this.gameState.getPlayer(attackerId);
        const defenderPlayer = defenderId !== null ? this.gameState.getPlayer(defenderId) : null;

        return {
            id: uuidv4(),
            planetId: planet.id,
            planetName: planet.name,
            attackerPlayerId: attackerId,
            attackerName: attackerPlayer?.name ?? `Player ${attackerId}`,
            attackerColor: attackerPlayer?.color ?? getPlayerColor(attackerId),
            attackerInitialShips: attackerShips,
            defenderPlayerId: defenderId ?? GALACTIC_CONSTANTS.NEUTRAL_PLAYER_ID,
            defenderName: defenderPlayer?.name ?? 'Defenders',
            defenderColor: defenderPlayer?.color ?? NEUTRAL_COLOR,
            defenderInitialShips: defenderShips,
            rounds: [],
            winnerId: null,
            winnerShipsRemaining: 0,
            timestamp: Date.now(),
        };
    }

    /**
     * Run battle rounds until completion and return final ship counts
     */
    private runBattleToCompletion(
        replay: BattleReplay,
        attackerShips: number,
        defenderShips: number
    ): { attackerShips: number; defenderShips: number } {
        let currentAttackerShips = attackerShips;
        let currentDefenderShips = defenderShips;
        let roundNumber = 0;

        while (currentAttackerShips > 0 && currentDefenderShips > 0) {
            roundNumber++;

            // Resolve one round
            const result = this.battleRound.resolve(currentAttackerShips, currentDefenderShips);

            // Apply casualties
            currentAttackerShips = Math.max(0, currentAttackerShips - result.attackerCasualties);
            currentDefenderShips = Math.max(0, currentDefenderShips - result.defenderCasualties);

            // Record round for replay
            const roundData: BattleReplayRound = {
                roundNumber,
                attackerDice: result.attackerRolls,
                defenderDice: result.defenderRolls,
                attackerLosses: result.attackerCasualties,
                defenderLosses: result.defenderCasualties,
                attackerShipsAfter: currentAttackerShips,
                defenderShipsAfter: currentDefenderShips,
            };
            replay.rounds.push(roundData);

            logger.debug(`  Round ${roundNumber}: Atk rolls ${result.attackerRolls.join(',')} Def rolls ${result.defenderRolls.join(',')} => Atk loses ${result.attackerCasualties}, Def loses ${result.defenderCasualties}`);

            // Safety: prevent infinite loops (shouldn't happen with proper logic)
            if (roundNumber > 1000) {
                logger.error('Battle exceeded 1000 rounds - breaking');
                break;
            }
        }

        return { attackerShips: currentAttackerShips, defenderShips: currentDefenderShips };
    }

    /**
     * Apply battle result to planet and update replay
     */
    private applyBattleResult(
        planet: Planet,
        attackerId: number,
        defenderId: number | null,
        battleResult: { attackerShips: number; defenderShips: number },
        replay: BattleReplay
    ): void {
        const { attackerShips, defenderShips } = battleResult;

        if (attackerShips > 0) {
            // Attacker wins
            replay.winnerId = attackerId;
            replay.winnerShipsRemaining = attackerShips;

            this.gameState.setPlanetOwner(planet.id, attackerId);
            this.gameState.setPlanetShips(planet.id, attackerShips);

            logger.debug(`Battle result: Attacker wins with ${attackerShips} ships`);
        } else if (defenderShips > 0) {
            // Defender wins
            replay.winnerId = defenderId ?? null; // null for neutral
            replay.winnerShipsRemaining = defenderShips;

            // Planet stays with defender (no change to owner)
            this.gameState.setPlanetShips(planet.id, defenderShips);

            logger.debug(`Battle result: Defender wins with ${defenderShips} ships`);
        } else {
            // Mutual destruction
            replay.winnerId = null;
            replay.winnerShipsRemaining = 0;

            // Planet becomes/stays neutral with 0 ships
            this.gameState.setPlanetOwner(planet.id, null);
            this.gameState.setPlanetShips(planet.id, 0);

            logger.debug(`Battle result: Mutual destruction`);
        }
    }
}


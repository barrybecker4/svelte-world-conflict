/**
 * BattleManager - Handles battles at planets
 *
 * - Battles are resolved IMMEDIATELY when armada arrives
 * - Full battle replay is generated for client animation
 * - No delayed/scheduled battle rounds
 *
 * For multi-player battles (rare):
 * - All attackers gang up on the weakest participant
 * - Continue until one player remains
 */

import type { Planet, BattleReplay, BattleReplayRound, ReinforcementEvent, ConquestEvent, PlayerEliminationEvent } from '$lib/game/entities/gameTypes';
import { BattleRound } from './BattleRound';
import type { GalacticGameState } from '$lib/game/state/GalacticGameState';
import { GALACTIC_CONSTANTS, NEUTRAL_COLOR } from '$lib/game/constants/gameConstants';
import { getPlayerColor } from '$lib/game/constants/playerConfigs';
import { logger } from 'multiplayer-framework/shared';
import { v4 as uuidv4 } from 'uuid';

export class BattleManager {
    private battleRound: BattleRound;

    constructor(private gameState: GalacticGameState) {
        this.battleRound = new BattleRound(gameState.rng);
    }

    /**
     * Handle an armada arriving at a planet
     */
    handleArmadaArrival(armadaId: string): void {
        const armada = this.gameState.getArmada(armadaId);
        if (!armada) {
            logger.warn(`Armada ${armadaId} not found`);
            return;
        }

        const planet = this.gameState.getPlanet(armada.destinationPlanetId);
        if (!planet) {
            logger.warn(`Destination planet ${armada.destinationPlanetId} not found`);
            return;
        }

        // Remove armada from transit
        this.gameState.removeArmada(armadaId);

        // Check if it's a reinforcement (same owner)
        if (planet.ownerId === armada.ownerId) {
            this.handleReinforcement(planet, armada.ships);
            return;
        }

        // Execute battle (resolved immediately)
        this.executeBattle(planet, armada.ownerId, armada.ships);
    }

    /**
     * Handle reinforcement - ships arriving at a friendly planet
     */
    private handleReinforcement(planet: Planet, ships: number): void {
        logger.debug(`Reinforcing planet ${planet.id} with ${ships} ships`);
        this.gameState.addPlanetShips(planet.id, ships);
        
        // Create reinforcement event for client display
        const player = this.gameState.getPlayer(planet.ownerId!);
        if (player) {
            const event: ReinforcementEvent = {
                id: uuidv4(),
                planetId: planet.id,
                planetName: planet.name,
                playerId: planet.ownerId!,
                playerName: player.name,
                playerColor: player.color,
                ships: ships,
                timestamp: Date.now(),
            };
            this.gameState.addReinforcementEvent(event);
        }
    }

    /**
     * Execute a complete battle immediately and generate replay for client
     */
    private executeBattle(planet: Planet, attackerId: number, attackerShips: number): void {
        const defenderShips = planet.ships;
        const defenderId = planet.ownerId; // null for neutral

        logger.debug(`Battle at ${planet.name}: attacker ${attackerId} (${attackerShips} ships) vs defender ${defenderId ?? 'neutral'} (${defenderShips} ships)`);

        // If planet has no defenders, just conquer it (no battle animation needed)
        if (defenderShips <= 0) {
            this.handleUndefendedConquest(planet, attackerId, attackerShips);
            return;
        }

        // Execute the battle
        const replay = this.createBattleReplay(planet, attackerId, attackerShips, defenderId, defenderShips);
        const battleResult = this.runBattleToCompletion(replay, attackerShips, defenderShips);
        this.applyBattleResult(planet, attackerId, defenderId, battleResult, replay);
        
        // Add replay to game state for client to consume
        this.gameState.addBattleReplay(replay);
        
        console.log(`[BattleManager] Battle replay created:`, {
            replayId: replay.id,
            planetName: replay.planetName,
            rounds: replay.rounds.length,
            winner: replay.winnerId === attackerId ? 'attacker' : 'defender',
            winnerShips: replay.winnerShipsRemaining,
            totalReplaysNow: this.gameState.recentBattleReplays.length
        });

        // Check for player eliminations
        this.checkPlayerEliminations(planet);
    }

    /**
     * Handle conquest of an undefended planet
     */
    private handleUndefendedConquest(planet: Planet, attackerId: number, attackerShips: number): void {
        logger.debug(`Planet ${planet.name} has no defenders - immediate conquest`);
        
        // Create conquest event for client display
        const attackerPlayer = this.gameState.getPlayer(attackerId);
        if (attackerPlayer) {
            const event: ConquestEvent = {
                id: uuidv4(),
                planetId: planet.id,
                planetName: planet.name,
                attackerPlayerId: attackerId,
                attackerName: attackerPlayer.name,
                attackerColor: attackerPlayer.color,
                ships: attackerShips,
                timestamp: Date.now(),
            };
            this.gameState.addConquestEvent(event);
        }
        
        this.gameState.setPlanetOwner(planet.id, attackerId);
        this.gameState.setPlanetShips(planet.id, attackerShips);
        this.checkPlayerEliminations(planet);
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

    /**
     * Check if any players have been eliminated
     * @param planet The planet that was just conquered (where elimination may have occurred)
     */
    private checkPlayerEliminations(planet: Planet): void {
        for (const player of this.gameState.players) {
            if (!this.gameState.isPlayerEliminated(player.slotIndex)) {
                if (!this.gameState.isPlayerAlive(player.slotIndex)) {
                    logger.debug(`Player ${player.name} (${player.slotIndex}) has been eliminated`);
                    this.gameState.eliminatePlayer(player.slotIndex);
                    
                    // Create elimination event for client display
                    const event: PlayerEliminationEvent = {
                        id: uuidv4(),
                        planetId: planet.id,
                        planetName: planet.name,
                        playerId: player.slotIndex,
                        playerName: player.name,
                        playerColor: player.color,
                        timestamp: Date.now(),
                    };
                    this.gameState.addPlayerEliminationEvent(event);
                }
            }
        }

        // Check if only one player remains
        const activePlayers = this.gameState.players.filter(
            p => !this.gameState.isPlayerEliminated(p.slotIndex)
        );

        if (activePlayers.length <= 1 && !this.gameState.isGameComplete()) {
            // Game ends - single player remaining
            this.gameState.endResult = activePlayers.length === 1
                ? activePlayers[0]
                : 'DRAWN_GAME';
            this.gameState.state.status = 'COMPLETED';

            logger.debug(`Game ended: ${this.gameState.endResult === 'DRAWN_GAME' ? 'Draw' : `Winner: ${activePlayers[0].name}`}`);
        }
    }
}

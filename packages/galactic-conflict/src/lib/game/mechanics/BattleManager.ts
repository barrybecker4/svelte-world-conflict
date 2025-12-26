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

import type { Planet, BattleReplay, ReinforcementEvent, ConquestEvent, PlayerEliminationEvent } from '$lib/game/entities/gameTypes';
import { BattleExecutor } from './BattleExecutor';
import type { GalacticGameState } from '$lib/game/state/GalacticGameState';
import { logger } from 'multiplayer-framework/shared';
import { v4 as uuidv4 } from 'uuid';

export class BattleManager {
    private battleExecutor: BattleExecutor;

    constructor(private gameState: GalacticGameState) {
        this.battleExecutor = new BattleExecutor(gameState);
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
        const replay = this.battleExecutor.executeBattle(planet, attackerId, attackerShips, defenderId, defenderShips);
        
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

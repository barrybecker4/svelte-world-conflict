/**
 * BattleManager - Handles multi-player battles at planets
 * 
 * Multi-player battle resolution:
 * 1. All players (N-1) gang up on the player with fewest ships
 * 2. Battle rounds continue until weakest is eliminated
 * 3. Process repeats until one player remains
 */

import type { Battle, BattleParticipant, Planet } from '$lib/game/entities/gameTypes';
import { BattleRound, type BattleRoundResult } from './BattleRound';
import type { GalacticGameState } from '$lib/game/state/GalacticGameState';
import {
    createBattle,
    addBattleParticipant,
    getWeakestParticipant,
    getAttackingParticipants,
    isBattleActive,
    getBattleWinner,
    recordBattleRound,
} from '$lib/game/entities/Battle';
import { logger } from '$lib/game/utils/logger';

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

        // Check if there's an existing battle at this planet
        const existingBattle = this.gameState.getBattleAtPlanet(planet.id);
        if (existingBattle) {
            this.joinExistingBattle(existingBattle, armada.ownerId, armada.ships);
            return;
        }

        // Start a new battle
        this.startNewBattle(planet, armada.ownerId, armada.ships);
    }

    /**
     * Handle reinforcement - ships arriving at a friendly planet
     */
    private handleReinforcement(planet: Planet, ships: number): void {
        logger.debug(`Reinforcing planet ${planet.id} with ${ships} ships`);
        this.gameState.addPlanetShips(planet.id, ships);
    }

    /**
     * Join an existing battle at a planet
     */
    private joinExistingBattle(battle: Battle, playerId: number, ships: number): void {
        logger.debug(`Player ${playerId} joining battle at planet ${battle.planetId} with ${ships} ships`);
        addBattleParticipant(battle, playerId, ships);
    }

    /**
     * Start a new battle at a planet
     */
    private startNewBattle(planet: Planet, attackerId: number, attackerShips: number): void {
        logger.debug(`Starting battle at planet ${planet.id}: attacker ${attackerId} (${attackerShips} ships) vs defender ${planet.ownerId} (${planet.ships} ships)`);

        const battle = createBattle(
            planet.id,
            planet.ownerId,
            planet.ships,
            attackerId,
            attackerShips
        );

        // Clear planet's ships since they're now in the battle
        this.gameState.setPlanetShips(planet.id, 0);

        this.gameState.addBattle(battle);
    }

    /**
     * Process a battle round
     */
    processBattleRound(battleId: string): void {
        const battle = this.gameState.getBattle(battleId);
        if (!battle || battle.status !== 'active') {
            return;
        }

        // Get the weakest participant (target of gang-up)
        const weakest = getWeakestParticipant(battle);
        if (!weakest) {
            this.resolveBattle(battle);
            return;
        }

        // Get all other participants (the gang)
        const attackers = getAttackingParticipants(battle);
        if (attackers.length === 0) {
            this.resolveBattle(battle);
            return;
        }

        // Each attacker fights the weakest
        for (const attacker of attackers) {
            if (weakest.ships <= 0) break; // Weakest already eliminated
            if (attacker.ships <= 0) continue; // Skip eliminated attackers

            const result = this.battleRound.resolve(attacker.ships, weakest.ships);

            // Record the round (this updates participant ship counts)
            recordBattleRound(
                battle,
                attacker.playerId,
                weakest.playerId,
                result.attackerCasualties,
                result.defenderCasualties,
                result.attackerRolls,
                result.defenderRolls
            );

            logger.debug(`Battle round: Player ${attacker.playerId} vs ${weakest.playerId} - ` +
                `Attacker lost ${result.attackerCasualties}, Defender lost ${result.defenderCasualties}`);
        }

        // Check if battle should continue
        if (!isBattleActive(battle)) {
            this.resolveBattle(battle);
        }
    }

    /**
     * Resolve a completed battle
     */
    private resolveBattle(battle: Battle): void {
        battle.status = 'resolved';
        battle.resolvedTime = Date.now();

        const winner = getBattleWinner(battle);
        const planet = this.gameState.getPlanet(battle.planetId);

        if (!planet) {
            logger.error(`Planet ${battle.planetId} not found when resolving battle`);
            return;
        }

        if (winner) {
            // Winner takes the planet
            this.gameState.setPlanetOwner(planet.id, winner.playerId);
            this.gameState.setPlanetShips(planet.id, winner.ships);
            battle.winnerId = winner.playerId;

            logger.debug(`Battle resolved: Player ${winner.playerId} wins planet ${planet.id} with ${winner.ships} ships`);
        } else {
            // No winner - planet becomes neutral
            this.gameState.setPlanetOwner(planet.id, null);
            this.gameState.setPlanetShips(planet.id, 0);
            battle.winnerId = null;

            logger.debug(`Battle resolved: Planet ${planet.id} becomes neutral (no survivors)`);
        }

        // Remove battle from active battles
        this.gameState.removeBattle(battle.id);

        // Check for player eliminations
        this.checkPlayerEliminations();
    }

    /**
     * Check if any players have been eliminated
     */
    private checkPlayerEliminations(): void {
        for (const player of this.gameState.players) {
            if (!this.gameState.isPlayerEliminated(player.slotIndex)) {
                if (!this.gameState.isPlayerAlive(player.slotIndex)) {
                    logger.debug(`Player ${player.name} (${player.slotIndex}) has been eliminated`);
                    this.gameState.eliminatePlayer(player.slotIndex);
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

